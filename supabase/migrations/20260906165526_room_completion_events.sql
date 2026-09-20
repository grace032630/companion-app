create table if not exists public.room_completion_events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  animal text not null,
  task text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_completion_events_room_created_idx
on public.room_completion_events(room_id, created_at desc);

alter table public.room_completion_events enable row level security;

drop policy if exists "authenticated users can read room completion events" on public.room_completion_events;
create policy "authenticated users can read room completion events"
on public.room_completion_events for select
to authenticated
using (true);

drop policy if exists "users can announce own completion" on public.room_completion_events;
create policy "users can announce own completion"
on public.room_completion_events for insert
to authenticated
with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.room_completion_events;
exception
  when duplicate_object then null;
end $$;
