-- Fix room strawberry seeding so strawberries are created once per actual
-- room occupancy cycle, not once per room per calendar day.
-- A cycle starts when the first session enters an empty room. Later users who
-- join while someone is still inside inherit the same cycle id.

begin;

alter table public.room_sessions
  add column if not exists strawberry_cycle_id uuid;

alter table public.room_strawberries
  add column if not exists cycle_id uuid;

-- Give every currently occupied room one shared cycle id so applying this
-- migration does not split people who are already together into different cycles.
with occupied_rooms as (
  select distinct rs.room_id, gen_random_uuid() as cycle_id
  from public.room_sessions rs
  where rs.room_id is not null
    and rs.expires_at > now()
    and rs.status <> 'done'
)
update public.room_sessions rs
set strawberry_cycle_id = occupied_rooms.cycle_id
from occupied_rooms
where rs.room_id = occupied_rooms.room_id
  and rs.expires_at > now()
  and rs.status <> 'done'
  and rs.strawberry_cycle_id is null;

create index if not exists room_sessions_room_cycle_idx
  on public.room_sessions(room_id, strawberry_cycle_id);

create index if not exists room_strawberries_room_cycle_idx
  on public.room_strawberries(room_id, cycle_id, spawned_at);

-- The database, not the client, decides which occupancy cycle a new room
-- session belongs to. Existing active members make the newcomer inherit their
-- cycle. If the room is truly empty, a new cycle id is created.
create or replace function public.assign_room_strawberry_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle_id uuid;
begin
  if new.room_id is null then
    new.strawberry_cycle_id := null;
    return new;
  end if;

  select rs.strawberry_cycle_id
  into v_cycle_id
  from public.room_sessions rs
  where rs.room_id = new.room_id
    and rs.expires_at > pg_catalog.now()
    and rs.status <> 'done'
    and rs.strawberry_cycle_id is not null
  order by rs.started_at asc
  limit 1;

  new.strawberry_cycle_id := coalesce(v_cycle_id, gen_random_uuid());
  return new;
end;
$$;

drop trigger if exists assign_room_strawberry_cycle_trigger on public.room_sessions;
create trigger assign_room_strawberry_cycle_trigger
before insert on public.room_sessions
for each row
execute function public.assign_room_strawberry_cycle();

-- Seed 1-5 berries exactly once for the caller's current occupancy cycle.
create or replace function public.ensure_room_strawberries()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_cycle_id uuid;
  v_count integer;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select room_id, strawberry_cycle_id
  into v_room_id, v_cycle_id
  from public.room_sessions
  where user_id = v_user_id
    and expires_at > pg_catalog.now()
    and status <> 'done'
  order by started_at desc
  limit 1;

  if v_room_id is null then raise exception 'NO_ACTIVE_ROOM'; end if;

  -- Sessions created before this migration can still be repaired lazily.
  if v_cycle_id is null then
    select rs.strawberry_cycle_id
    into v_cycle_id
    from public.room_sessions rs
    where rs.room_id = v_room_id
      and rs.expires_at > pg_catalog.now()
      and rs.status <> 'done'
      and rs.strawberry_cycle_id is not null
    order by rs.started_at asc
    limit 1;

    v_cycle_id := coalesce(v_cycle_id, gen_random_uuid());

    update public.room_sessions
    set strawberry_cycle_id = v_cycle_id
    where room_id = v_room_id
      and expires_at > pg_catalog.now()
      and status <> 'done'
      and strawberry_cycle_id is null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_room_id::text || ':' || v_cycle_id::text, 130914)
  );

  if exists (
    select 1
    from public.room_strawberries
    where room_id = v_room_id
      and cycle_id = v_cycle_id
      and source = 'entry'
  ) then
    return false;
  end if;

  v_count := 1 + pg_catalog.floor(pg_catalog.random() * 5)::integer;

  insert into public.room_strawberries(room_id, cycle_id, x_percent, y_percent, source)
  select
    v_room_id,
    v_cycle_id,
    8 + pg_catalog.floor(pg_catalog.random() * 81)::integer,
    12 + pg_catalog.floor(pg_catalog.random() * 71)::integer,
    'entry'
  from pg_catalog.generate_series(1, v_count);

  return true;
end;
$$;

revoke execute on function public.ensure_room_strawberries() from public, anon, authenticated;
grant execute on function public.ensure_room_strawberries() to authenticated;

-- Keep completion drops in the same occupancy cycle too.
create or replace function public.record_room_task_completion(p_room_session_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.room_sessions%rowtype;
  v_completion_id bigint;
  v_drop_count integer;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_room_session_id is null or pg_catalog.length(p_room_session_id) = 0 then
    raise exception 'INVALID_ROOM_SESSION';
  end if;

  select * into v_session
  from public.room_sessions
  where id = p_room_session_id
    and user_id = v_user_id
    and expires_at > pg_catalog.now()
  for update;

  if not found then raise exception 'INVALID_ROOM_SESSION'; end if;
  if v_session.room_id is null then raise exception 'INVALID_ROOM_SESSION'; end if;
  if v_session.started_at > pg_catalog.now() - interval '30 seconds' then
    raise exception 'ROOM_COMPLETION_TOO_EARLY';
  end if;

  insert into public.task_completions(user_id, task, room_session_id)
  values (v_user_id, v_session.task, v_session.id)
  on conflict do nothing
  returning id into v_completion_id;

  if v_completion_id is not null then
    insert into public.room_completion_events(room_id, user_id, name, animal, task)
    values (
      v_session.room_id::text,
      v_user_id,
      v_session.name,
      v_session.animal,
      v_session.task
    );

    v_drop_count := 1 + pg_catalog.floor(pg_catalog.random() * 3)::integer;
    insert into public.room_strawberries(room_id, cycle_id, x_percent, y_percent, source)
    select
      v_session.room_id,
      v_session.strawberry_cycle_id,
      8 + pg_catalog.floor(pg_catalog.random() * 81)::integer,
      12 + pg_catalog.floor(pg_catalog.random() * 71)::integer,
      'completion'
    from pg_catalog.generate_series(1, v_drop_count);
  end if;

  update public.room_sessions
  set status = 'done',
      help_request_id = null,
      last_seen = pg_catalog.now()
  where id = v_session.id
    and user_id = v_user_id;

  return v_completion_id is not null;
end;
$$;

revoke execute on function public.record_room_task_completion(text) from public, anon, authenticated;
grant execute on function public.record_room_task_completion(text) to authenticated;

commit;
