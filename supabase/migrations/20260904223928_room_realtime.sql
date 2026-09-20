create table if not exists public.room_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  animal text not null,
  task text not null,
  status text not null default 'working' check (status in ('working', 'help', 'done')),
  action text not null,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists room_sessions_last_seen_idx on public.room_sessions(last_seen desc);
create index if not exists room_sessions_status_idx on public.room_sessions(status);

alter table public.room_sessions enable row level security;

create policy "authenticated users can read active room sessions"
on public.room_sessions
for select
to authenticated
using (true);

create policy "users can insert their own room session"
on public.room_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their own room session"
on public.room_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete their own room session"
on public.room_sessions
for delete
to authenticated
using (auth.uid() = user_id);

alter publication supabase_realtime add table public.room_sessions;
