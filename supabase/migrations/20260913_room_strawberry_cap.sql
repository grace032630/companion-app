-- Keep room strawberries bounded and scoped to the current occupancy cycle.
-- At most 10 unclaimed strawberries may exist in one active room cycle.

begin;

-- Only expose berries from the user's current active occupancy cycle. This also
-- prevents old, unclaimed berries from previous room cycles from reappearing.
drop policy if exists "active room members can read strawberries" on public.room_strawberries;
create policy "active room members can read strawberries"
  on public.room_strawberries for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_sessions rs
      where rs.user_id = auth.uid()
        and rs.room_id = room_strawberries.room_id
        and rs.strawberry_cycle_id = room_strawberries.cycle_id
        and rs.expires_at > now()
        and rs.status <> 'done'
    )
  );

-- Seed 1-5 berries once per current occupancy cycle, while respecting the same
-- 10-berry ceiling in case completion drops already exist.
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
  v_existing integer := 0;
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
    pg_catalog.hashtextextended(v_room_id::text || ':' || v_cycle_id::text, 130915)
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

  select count(*) into v_existing
  from public.room_strawberries
  where room_id = v_room_id
    and cycle_id = v_cycle_id
    and claimed_by is null;

  v_count := least(
    1 + pg_catalog.floor(pg_catalog.random() * 5)::integer,
    greatest(0, 10 - v_existing)
  );

  if v_count <= 0 then return false; end if;

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

-- Claims must also belong to the user's current occupancy cycle, not merely the
-- same reusable room id.
create or replace function public.claim_room_strawberry(p_strawberry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_cycle_id uuid;
  v_berry public.room_strawberries%rowtype;
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

  if v_room_id is null or v_cycle_id is null then raise exception 'NO_ACTIVE_ROOM'; end if;

  select * into v_berry
  from public.room_strawberries
  where id = p_strawberry_id
  for update;

  if not found
    or v_berry.room_id <> v_room_id
    or v_berry.cycle_id is distinct from v_cycle_id
  then
    raise exception 'STRAWBERRY_NOT_IN_ROOM';
  end if;

  if v_berry.claimed_by is not null then return false; end if;

  update public.room_strawberries
  set claimed_by = v_user_id,
      claimed_at = pg_catalog.now()
  where id = p_strawberry_id;

  insert into public.strawberry_pickups(user_id, room_strawberry_id)
  values (v_user_id, p_strawberry_id)
  on conflict (room_strawberry_id) do nothing;

  return true;
end;
$$;

revoke execute on function public.claim_room_strawberry(uuid) from public, anon, authenticated;
grant execute on function public.claim_room_strawberry(uuid) to authenticated;

-- Every successful real-user completion still rolls a 1-3 berry drop, but the
-- actual insert is clipped so the current cycle never exceeds 10 unclaimed berries.
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
  v_existing integer := 0;
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

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_session.room_id::text || ':' || coalesce(v_session.strawberry_cycle_id::text, ''),
        130915
      )
    );

    select count(*) into v_existing
    from public.room_strawberries
    where room_id = v_session.room_id
      and cycle_id is not distinct from v_session.strawberry_cycle_id
      and claimed_by is null;

    v_drop_count := least(
      1 + pg_catalog.floor(pg_catalog.random() * 3)::integer,
      greatest(0, 10 - v_existing)
    );

    if v_drop_count > 0 then
      insert into public.room_strawberries(room_id, cycle_id, x_percent, y_percent, source)
      select
        v_session.room_id,
        v_session.strawberry_cycle_id,
        8 + pg_catalog.floor(pg_catalog.random() * 81)::integer,
        12 + pg_catalog.floor(pg_catalog.random() * 71)::integer,
        'completion'
      from pg_catalog.generate_series(1, v_drop_count);
    end if;
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
