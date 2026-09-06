alter table public.room_sessions
  add column if not exists started_at timestamptz,
  add column if not exists expires_at timestamptz;

update public.room_sessions
set started_at = coalesce(started_at, created_at),
    expires_at = coalesce(expires_at, created_at + interval '24 hours');

alter table public.room_sessions
  alter column started_at set default now(),
  alter column started_at set not null,
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

-- Keep only the newest session per user before enforcing one active room per account.
with ranked as (
  select id,
         row_number() over (partition by user_id order by started_at desc, created_at desc) as rn
  from public.room_sessions
)
delete from public.room_sessions s
using ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists room_sessions_one_per_user_idx
  on public.room_sessions(user_id);

create index if not exists room_sessions_room_expiry_idx
  on public.room_sessions(room_id, expires_at);

create or replace function public.assign_room(p_max_members integer default 6)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_max_members < 2 or p_max_members > 12 then
    raise exception 'Invalid room capacity';
  end if;

  perform pg_advisory_xact_lock(260906);

  delete from public.room_sessions
  where expires_at <= now();

  select room_id into v_room_id
  from public.room_sessions
  where user_id = v_user_id
    and room_id is not null
    and expires_at > now()
  order by started_at desc
  limit 1;

  if v_room_id is not null then
    return v_room_id;
  end if;

  select r.id into v_room_id
  from public.rooms r
  left join public.room_sessions s
    on s.room_id = r.id
    and s.expires_at > now()
  group by r.id, r.created_at
  having count(s.id) < p_max_members
  order by count(s.id) desc, r.created_at asc
  limit 1;

  if v_room_id is null then
    insert into public.rooms default values returning id into v_room_id;
  end if;

  update public.rooms
  set updated_at = now()
  where id = v_room_id;

  return v_room_id;
end;
$$;

grant execute on function public.assign_room(integer) to authenticated;

create or replace function public.send_support_event(
  p_room_id uuid,
  p_request_id text,
  p_target_user_id uuid,
  p_kind text,
  p_actor_name text,
  p_actor_animal text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_event_id uuid;
  v_actor_punches integer;
  v_distinct_punchers integer;
begin
  if v_actor_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_kind not in ('push', 'punch') then
    raise exception 'Invalid support kind';
  end if;

  if v_actor_user_id = p_target_user_id then
    raise exception 'Cannot support yourself';
  end if;

  if not exists (
    select 1
    from public.room_sessions
    where room_id = p_room_id
      and user_id = v_actor_user_id
      and expires_at > now()
  ) then
    raise exception 'You are not in this room';
  end if;

  if not exists (
    select 1
    from public.room_sessions
    where room_id = p_room_id
      and user_id = p_target_user_id
      and status = 'help'
      and help_request_id = p_request_id
      and expires_at > now()
  ) then
    raise exception 'Help request is no longer active';
  end if;

  if p_kind = 'punch' then
    select count(*) into v_actor_punches
    from public.support_events
    where request_id = p_request_id
      and actor_user_id = v_actor_user_id
      and kind = 'punch';

    if v_actor_punches >= 2 then
      raise exception 'Punch limit reached';
    end if;

    select count(distinct actor_user_id) into v_distinct_punchers
    from public.support_events
    where request_id = p_request_id
      and kind = 'punch';

    if v_actor_punches = 0 and v_distinct_punchers >= 4 then
      raise exception 'Puncher limit reached';
    end if;
  end if;

  insert into public.support_events (
    room_id,
    request_id,
    target_user_id,
    actor_user_id,
    actor_name,
    actor_animal,
    kind
  ) values (
    p_room_id,
    p_request_id,
    p_target_user_id,
    v_actor_user_id,
    p_actor_name,
    p_actor_animal,
    p_kind
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.send_support_event(uuid, text, uuid, text, text, text) to authenticated;
