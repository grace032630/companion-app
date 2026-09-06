-- Companion security hardening.
-- Apply after 20260906_friends.sql and 20260906_room_session_expiry.sql.
--
-- Calendar-day policy: all security-sensitive "today" values use
-- Asia/Taipei on the database server. Clients do not supply dates or ranges.

begin;

create schema if not exists private;

create or replace function private.companion_today()
returns date
language sql
stable
set search_path = ''
as $$
  select pg_catalog.timezone('Asia/Taipei', pg_catalog.now())::date;
$$;

revoke execute on function private.companion_today() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Check-ins: authenticated clients keep SELECT access to their own rows, but
-- all inserts go through a no-argument, server-dated RPC.
-- ---------------------------------------------------------------------------

drop policy if exists "users can insert own daily checkins" on public.daily_checkins;
revoke all on table public.daily_checkins from anon, authenticated;
grant select on table public.daily_checkins to authenticated;

create or replace function public.check_in_today()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_checkin_date date := private.companion_today();
  v_inserted uuid;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  insert into public.daily_checkins(user_id, checkin_date)
  values (v_user_id, v_checkin_date)
  on conflict (user_id, checkin_date) do nothing
  returning user_id into v_inserted;

  return v_inserted is not null;
end;
$$;

revoke execute on function public.check_in_today() from public, anon, authenticated;
grant execute on function public.check_in_today() to authenticated;

-- ---------------------------------------------------------------------------
-- Task completions: direct inserts are removed. A completion is tied to one
-- active room session and takes user/task data from that row.
-- ---------------------------------------------------------------------------

alter table public.task_completions
  add column if not exists room_session_id text;

create unique index if not exists task_completions_room_session_unique_idx
  on public.task_completions(room_session_id)
  where room_session_id is not null;

drop policy if exists "users can insert own task completions" on public.task_completions;
revoke all on table public.task_completions from anon, authenticated;
grant select on table public.task_completions to authenticated;

drop trigger if exists room_session_completion_log on public.room_sessions;
drop function if exists public.log_room_completion();

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

  insert into public.task_completions(user_id, task, room_session_id)
  values (v_user_id, v_session.task, v_session.id)
  on conflict do nothing
  returning id into v_completion_id;

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

-- ---------------------------------------------------------------------------
-- Daily strawberries: only a server-dated RPC can grant the signed-in user a
-- reward, and only when that user has a completion during today's Taipei day.
-- ---------------------------------------------------------------------------

drop policy if exists "users can insert own strawberries" on public.daily_strawberries;
revoke all on table public.daily_strawberries from anon, authenticated;
grant select on table public.daily_strawberries to authenticated;

drop function if exists public.claim_daily_strawberry(date, timestamptz, timestamptz);

create or replace function public.claim_daily_strawberry()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward_date date := private.companion_today();
  v_start timestamptz;
  v_end timestamptz;
  v_id bigint;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  v_start := pg_catalog.timezone('Asia/Taipei', v_reward_date::timestamp);
  v_end := pg_catalog.timezone('Asia/Taipei', (v_reward_date + 1)::timestamp);

  if not exists (
    select 1
    from public.task_completions
    where user_id = v_user_id
      and completed_at >= v_start
      and completed_at < v_end
  ) then
    return false;
  end if;

  insert into public.daily_strawberries(user_id, reward_date)
  values (v_user_id, v_reward_date)
  on conflict (user_id, reward_date) do nothing
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke execute on function public.claim_daily_strawberry() from public, anon, authenticated;
grant execute on function public.claim_daily_strawberry() to authenticated;

-- ---------------------------------------------------------------------------
-- Friend requests: rejected rows are not blocks. A private append-only event
-- table preserves the server-side daily rate limit even after rejection.
-- ---------------------------------------------------------------------------

create table if not exists private.friend_request_events (
  id bigint generated by default as identity primary key,
  friendship_id uuid,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  request_date date not null,
  created_at timestamptz not null default now()
);

alter table private.friend_request_events
  add column if not exists friendship_id uuid;

create unique index if not exists friend_request_events_friendship_unique_idx
  on private.friend_request_events(friendship_id)
  where friendship_id is not null;

create index if not exists friend_request_events_requester_date_idx
  on private.friend_request_events(requester_id, request_date);

revoke all on table private.friend_request_events from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

-- Count already-existing requests on the migration day too. The source id
-- makes this backfill idempotent and remains after a rejected row is deleted.
insert into private.friend_request_events(
  friendship_id,
  requester_id,
  addressee_id,
  request_date,
  created_at
)
select
  f.id,
  f.requester_id,
  f.addressee_id,
  pg_catalog.timezone('Asia/Taipei', f.created_at)::date,
  f.created_at
from public.friendships f
on conflict do nothing;

delete from public.friendships where status = 'rejected';

create or replace function public.send_friend_request(p_friend_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_addressee_id uuid;
  v_request_id uuid;
  v_request_date date := private.companion_today();
  v_daily_count integer;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Serialize each sender's rate-limit check and insert.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 260906)
  );

  select pg_catalog.count(*) into v_daily_count
  from private.friend_request_events
  where requester_id = v_user_id
    and request_date = v_request_date;

  if v_daily_count >= 20 then raise exception 'FRIEND_REQUEST_RATE_LIMIT'; end if;

  select user_id into v_addressee_id
  from public.profiles
  where public_friend_id = pg_catalog.upper(pg_catalog.btrim(p_friend_id));

  if v_addressee_id is null then raise exception 'FRIEND_ID_NOT_FOUND'; end if;
  if v_addressee_id = v_user_id then raise exception 'CANNOT_ADD_SELF'; end if;

  if exists (
    select 1 from public.friendships
    where least(requester_id, addressee_id) = least(v_user_id, v_addressee_id)
      and greatest(requester_id, addressee_id) = greatest(v_user_id, v_addressee_id)
  ) then
    raise exception 'FRIENDSHIP_ALREADY_EXISTS';
  end if;

  insert into public.friendships(requester_id, addressee_id)
  values (v_user_id, v_addressee_id)
  returning id into v_request_id;

  insert into private.friend_request_events(friendship_id, requester_id, addressee_id, request_date)
  values (v_request_id, v_user_id, v_addressee_id, v_request_date);

  return v_request_id;
exception
  when unique_violation then raise exception 'FRIENDSHIP_ALREADY_EXISTS';
end;
$$;

create or replace function public.reject_friend_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  delete from public.friendships
  where id = p_request_id
    and addressee_id = v_user_id
    and status = 'pending';

  if not found then raise exception 'FRIEND_REQUEST_NOT_PENDING'; end if;
  return true;
end;
$$;

-- Remove the client-date overloads before exposing the new signatures.
drop function if exists public.fetch_friends(date);
drop function if exists public.remind_friend(uuid, date);
drop function if exists public.gift_friend_strawberry(uuid, date);

create or replace function public.fetch_friends()
returns table (
  user_id uuid,
  nickname text,
  animal text,
  public_friend_id text,
  streak integer,
  checked_in_today boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := private.companion_today();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  return query
  select
    p.user_id,
    p.nickname,
    p.animal,
    p.public_friend_id,
    private.friend_checkin_streak(p.user_id, v_today),
    exists (
      select 1
      from public.daily_checkins d
      where d.user_id = p.user_id
        and d.checkin_date = v_today
    )
  from public.friendships f
  join public.profiles p
    on p.user_id = case
      when f.requester_id = v_user_id then f.addressee_id
      else f.requester_id
    end
  where f.status = 'accepted'
    and v_user_id in (f.requester_id, f.addressee_id)
  order by p.nickname asc;
end;
$$;

create or replace function public.remind_friend(p_friend_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reminder_date date := private.companion_today();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(v_user_id, p_friend_user_id)
      and greatest(requester_id, addressee_id) = greatest(v_user_id, p_friend_user_id)
  ) then raise exception 'NOT_FRIENDS'; end if;

  if exists (
    select 1 from public.daily_checkins
    where user_id = p_friend_user_id
      and checkin_date = v_reminder_date
  ) then return 'already_checked_in'; end if;

  insert into public.friend_checkin_reminders(sender_id, recipient_id, reminder_date)
  values (v_user_id, p_friend_user_id, v_reminder_date)
  on conflict (sender_id, recipient_id, reminder_date) do nothing;

  if not found then return 'already_reminded'; end if;
  return 'sent';
end;
$$;

create or replace function public.gift_friend_strawberry(p_friend_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_gift_date date := private.companion_today();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(v_user_id, p_friend_user_id)
      and greatest(requester_id, addressee_id) = greatest(v_user_id, p_friend_user_id)
  ) then raise exception 'NOT_FRIENDS'; end if;

  insert into public.friend_strawberry_gifts(sender_id, recipient_id, gift_date)
  values (v_user_id, p_friend_user_id, v_gift_date)
  on conflict (sender_id, recipient_id, gift_date) do nothing;

  if not found then return 'already_gifted'; end if;
  return 'sent';
end;
$$;

revoke execute on function public.send_friend_request(text) from public, anon, authenticated;
revoke execute on function public.reject_friend_request(uuid) from public, anon, authenticated;
revoke execute on function public.fetch_friends() from public, anon, authenticated;
revoke execute on function public.remind_friend(uuid) from public, anon, authenticated;
revoke execute on function public.gift_friend_strawberry(uuid) from public, anon, authenticated;

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.reject_friend_request(uuid) to authenticated;
grant execute on function public.fetch_friends() to authenticated;
grant execute on function public.remind_friend(uuid) to authenticated;
grant execute on function public.gift_friend_strawberry(uuid) to authenticated;

-- Reassert least privilege for unchanged friend RPCs created by the previous
-- migration, including revoking the default PUBLIC function privilege.
revoke execute on function public.fetch_my_friend_id() from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
revoke execute on function public.fetch_pending_friend_requests() from public, anon;
grant execute on function public.fetch_my_friend_id() to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.fetch_pending_friend_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- Room membership: assignments are issued only by matchmaking. A private RLS
-- helper breaks room_sessions self-recursion and exposes only the caller's
-- active room to the policy.
-- ---------------------------------------------------------------------------

create table if not exists private.room_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

revoke all on table private.room_assignments from public, anon, authenticated;

create or replace function private.assigned_room_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select room_id
  from private.room_assignments
  where user_id = (select auth.uid())
    and expires_at > pg_catalog.now();
$$;

create or replace function private.current_active_room_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select room_id
  from public.room_sessions
  where user_id = (select auth.uid())
    and expires_at > pg_catalog.now()
  order by started_at desc
  limit 1;
$$;

revoke execute on function private.assigned_room_id() from public, anon, authenticated;
revoke execute on function private.current_active_room_id() from public, anon, authenticated;
grant usage on schema private to authenticated;
-- These helpers must be executable for RLS evaluation. The private schema is
-- not exposed through the Data API, and each helper only returns the caller's
-- own assigned/current room id.
grant execute on function private.assigned_room_id() to authenticated;
grant execute on function private.current_active_room_id() to authenticated;

create or replace function private.enforce_room_session_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  -- Trusted server/database maintenance has no end-user JWT and is unaffected.
  if v_user_id is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from v_user_id then
      raise exception 'ROOM_SESSION_USER_MISMATCH';
    end if;
    new.started_at := pg_catalog.now();
    new.expires_at := pg_catalog.now() + interval '24 hours';
    new.last_seen := pg_catalog.now();
    new.status := 'working';
    new.help_request_id := null;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.room_id is distinct from old.room_id
    or new.started_at is distinct from old.started_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'ROOM_SESSION_IDENTITY_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_room_session_integrity() from public, anon, authenticated;

create or replace function private.consume_room_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.room_assignments
  where user_id = new.user_id
    and room_id = new.room_id;
  return new;
end;
$$;

revoke execute on function private.consume_room_assignment() from public, anon, authenticated;

drop trigger if exists room_sessions_enforce_integrity on public.room_sessions;
create trigger room_sessions_enforce_integrity
before insert or update on public.room_sessions
for each row execute function private.enforce_room_session_integrity();

drop trigger if exists room_sessions_consume_assignment on public.room_sessions;
create trigger room_sessions_consume_assignment
after insert on public.room_sessions
for each row execute function private.consume_room_assignment();

create or replace function public.assign_room(p_max_members integer default 6)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_max_members < 2 or p_max_members > 12 then raise exception 'INVALID_ROOM_CAPACITY'; end if;

  perform pg_catalog.pg_advisory_xact_lock(260906);

  delete from public.room_sessions where expires_at <= pg_catalog.now();
  delete from private.room_assignments where expires_at <= pg_catalog.now();

  select room_id into v_room_id
  from public.room_sessions
  where user_id = v_user_id
    and room_id is not null
    and expires_at > pg_catalog.now()
  order by started_at desc
  limit 1;

  if v_room_id is not null then
    delete from private.room_assignments where user_id = v_user_id;
    update public.rooms
    set updated_at = pg_catalog.now()
    where id = v_room_id;
    return v_room_id;
  end if;

  select room_id into v_room_id
  from private.room_assignments
  where user_id = v_user_id
    and expires_at > pg_catalog.now();

  if v_room_id is not null then
    return v_room_id;
  end if;

  select r.id into v_room_id
  from public.rooms r
  where (
    select pg_catalog.count(*)
    from public.room_sessions s
    where s.room_id = r.id
      and s.expires_at > pg_catalog.now()
  ) + (
    select pg_catalog.count(*)
    from private.room_assignments a
    where a.room_id = r.id
      and a.expires_at > pg_catalog.now()
  ) < p_max_members
  order by (
    select pg_catalog.count(*)
    from public.room_sessions s
    where s.room_id = r.id
      and s.expires_at > pg_catalog.now()
  ) + (
    select pg_catalog.count(*)
    from private.room_assignments a
    where a.room_id = r.id
      and a.expires_at > pg_catalog.now()
  ) desc,
  r.created_at asc
  limit 1;

  if v_room_id is null then
    insert into public.rooms default values returning id into v_room_id;
  end if;

  update public.rooms
  set updated_at = pg_catalog.now()
  where id = v_room_id;

  insert into private.room_assignments(user_id, room_id, expires_at)
  values (v_user_id, v_room_id, pg_catalog.now() + interval '10 minutes')
  on conflict (user_id) do update
  set room_id = excluded.room_id,
      expires_at = excluded.expires_at,
      created_at = pg_catalog.now();

  return v_room_id;
end;
$$;

revoke execute on function public.assign_room(integer) from public, anon, authenticated;
grant execute on function public.assign_room(integer) to authenticated;

drop policy if exists "authenticated users can read active room sessions" on public.room_sessions;
drop policy if exists "users can insert their own room session" on public.room_sessions;
drop policy if exists "users read own active session and current room peers" on public.room_sessions;
drop policy if exists "users insert only assigned room session" on public.room_sessions;

create policy "users read own active session and current room peers"
on public.room_sessions for select
to authenticated
using (
  expires_at > pg_catalog.now()
  and (
    user_id = (select auth.uid())
    or room_id = (select private.current_active_room_id())
  )
);

create policy "users insert only assigned room session"
on public.room_sessions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and room_id = (select private.assigned_room_id())
);

-- Existing update/delete policies continue to restrict mutation to the owner;
-- the integrity trigger additionally prevents changing membership or expiry.

-- Harden existing SECURITY DEFINER room RPCs without changing their behavior.
alter function public.send_support_event(uuid, text, uuid, text, text, text)
  set search_path = '';

revoke execute on function public.send_support_event(uuid, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.send_support_event(uuid, text, uuid, text, text, text)
  to authenticated;

commit;
