create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_sessions
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

create index if not exists room_sessions_room_id_idx
  on public.room_sessions(room_id);

alter table public.rooms enable row level security;

create policy "authenticated users can read rooms"
on public.rooms
for select
to authenticated
using (true);

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
  where last_seen < now() - interval '2 minutes';

  select room_id into v_room_id
  from public.room_sessions
  where user_id = v_user_id
    and room_id is not null
    and last_seen >= now() - interval '2 minutes'
  order by last_seen desc
  limit 1;

  if v_room_id is not null then
    return v_room_id;
  end if;

  select r.id into v_room_id
  from public.rooms r
  left join public.room_sessions s
    on s.room_id = r.id
    and s.last_seen >= now() - interval '2 minutes'
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
