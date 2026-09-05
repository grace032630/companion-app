alter table public.room_sessions
  add column if not exists help_request_id text;

create table if not exists public.support_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  request_id text not null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_name text not null,
  actor_animal text not null,
  kind text not null check (kind in ('push', 'punch')),
  created_at timestamptz not null default now()
);

create index if not exists support_events_target_idx
  on public.support_events(target_user_id, created_at desc);

create index if not exists support_events_request_idx
  on public.support_events(request_id, created_at desc);

alter table public.support_events enable row level security;

drop policy if exists "authenticated users can read support events" on public.support_events;
create policy "authenticated users can read support events"
on public.support_events
for select
to authenticated
using (true);

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
      and last_seen >= now() - interval '2 minutes'
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
      and last_seen >= now() - interval '2 minutes'
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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_events'
  ) then
    alter publication supabase_realtime add table public.support_events;
  end if;
end $$;
