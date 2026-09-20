-- Companion friends v1. Run after the profile dashboard, daily strawberries,
-- and room session expiry migrations.

create schema if not exists private;

create or replace function private.generate_public_friend_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
  v_result text := '';
  v_index integer;
begin
  for v_index in 0..7 loop
    v_result := v_result || pg_catalog.substr(
      v_alphabet,
      (pg_catalog.get_byte(v_bytes, v_index) % pg_catalog.length(v_alphabet)) + 1,
      1
    );
  end loop;
  return v_result;
end;
$$;

revoke execute on function private.generate_public_friend_id() from public, anon, authenticated;

alter table public.profiles
  add column if not exists public_friend_id text;

do $$
declare
  v_profile record;
  v_friend_id text;
begin
  for v_profile in
    select user_id from public.profiles where public_friend_id is null
  loop
    loop
      v_friend_id := private.generate_public_friend_id();
      exit when not exists (
        select 1 from public.profiles where public_friend_id = v_friend_id
      );
    end loop;

    update public.profiles
    set public_friend_id = v_friend_id
    where user_id = v_profile.user_id;
  end loop;
end;
$$;

alter table public.profiles
  alter column public_friend_id set not null;

alter table public.profiles
  drop constraint if exists profiles_public_friend_id_format_check;
alter table public.profiles
  add constraint profiles_public_friend_id_format_check
  check (public_friend_id ~ '^[A-HJ-NP-Z2-9]{8}$');

create unique index if not exists profiles_public_friend_id_unique_idx
  on public.profiles(public_friend_id);

create or replace function private.protect_profile_friend_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate text;
begin
  if tg_op = 'UPDATE' then
    if new.public_friend_id is distinct from old.public_friend_id then
      raise exception 'PUBLIC_FRIEND_ID_IMMUTABLE';
    end if;
    return new;
  end if;

  -- Ignore any client-supplied value on insert so users cannot choose or spoof
  -- their public ID.
  loop
    v_candidate := private.generate_public_friend_id();
    exit when not exists (
      select 1 from public.profiles where public_friend_id = v_candidate
    );
  end loop;
  new.public_friend_id := v_candidate;

  return new;
end;
$$;

revoke execute on function private.protect_profile_friend_id() from public, anon, authenticated;

drop trigger if exists profiles_protect_friend_id on public.profiles;
create trigger profiles_protect_friend_id
before insert or update of public_friend_id on public.profiles
for each row execute function private.protect_profile_friend_id();

-- Replace the original all-authenticated profile read policy. Friends are read
-- through limited RPCs below; direct profile reads remain available only to the
-- owner and active room peers so existing room quotes continue to work.
drop policy if exists "profiles readable by authenticated users" on public.profiles;
drop policy if exists "profiles readable by owner or active room peers" on public.profiles;
create policy "profiles readable by owner or active room peers"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.room_sessions mine
    join public.room_sessions peer on peer.room_id = mine.room_id
    where mine.user_id = (select auth.uid())
      and peer.user_id = profiles.user_id
      and mine.expires_at > now()
      and peer.expires_at > now()
  )
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair_idx
  on public.friendships(least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships(requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);

create table if not exists public.friend_checkin_reminders (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  reminder_date date not null,
  created_at timestamptz not null default now(),
  constraint friend_reminders_not_self check (sender_id <> recipient_id),
  unique (sender_id, recipient_id, reminder_date)
);

create index if not exists friend_reminders_recipient_idx
  on public.friend_checkin_reminders(recipient_id, created_at desc);

comment on table public.friend_checkin_reminders is
  'Friend check-in reminder events for future notification delivery workers.';

create table if not exists public.friend_strawberry_gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  gift_date date not null,
  created_at timestamptz not null default now(),
  constraint friend_gifts_not_self check (sender_id <> recipient_id),
  unique (sender_id, recipient_id, gift_date)
);

create index if not exists friend_gifts_recipient_idx
  on public.friend_strawberry_gifts(recipient_id, created_at desc);

-- TODO(friends-v2): add explicit, audited RPCs for removing and blocking friends.

create or replace function private.touch_friendship_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_friendship_updated_at() from public, anon, authenticated;

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at
before update on public.friendships
for each row execute function private.touch_friendship_updated_at();

alter table public.friendships enable row level security;
alter table public.friend_checkin_reminders enable row level security;
alter table public.friend_strawberry_gifts enable row level security;

revoke all on table public.friendships from anon, authenticated;
revoke all on table public.friend_checkin_reminders from anon, authenticated;
revoke all on table public.friend_strawberry_gifts from anon, authenticated;
grant select on table public.friendships to authenticated;
grant select on table public.friend_checkin_reminders to authenticated;
grant select on table public.friend_strawberry_gifts to authenticated;

drop policy if exists "users read related friendships" on public.friendships;
create policy "users read related friendships"
on public.friendships for select
to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "users read related reminders" on public.friend_checkin_reminders;
create policy "users read related reminders"
on public.friend_checkin_reminders for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

drop policy if exists "users read related strawberry gifts" on public.friend_strawberry_gifts;
create policy "users read related strawberry gifts"
on public.friend_strawberry_gifts for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

create or replace function private.friend_checkin_streak(p_user_id uuid, p_local_date date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cursor date := p_local_date;
  v_streak integer := 0;
begin
  while exists (
    select 1
    from public.daily_checkins
    where user_id = p_user_id
      and checkin_date = v_cursor
  ) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;
  return v_streak;
end;
$$;

revoke execute on function private.friend_checkin_streak(uuid, date) from public, anon, authenticated;

create or replace function public.fetch_my_friend_id()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_friend_id text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select public_friend_id into v_friend_id
  from public.profiles
  where user_id = v_user_id;
  return v_friend_id;
end;
$$;

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
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select user_id into v_addressee_id
  from public.profiles
  where public_friend_id = upper(trim(p_friend_id));

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

  return v_request_id;
exception
  when unique_violation then raise exception 'FRIENDSHIP_ALREADY_EXISTS';
end;
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.friendships
  set status = 'accepted'
  where id = p_request_id
    and addressee_id = v_user_id
    and status = 'pending';
  if not found then raise exception 'FRIEND_REQUEST_NOT_PENDING'; end if;
  return true;
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
  update public.friendships
  set status = 'rejected'
  where id = p_request_id
    and addressee_id = v_user_id
    and status = 'pending';
  if not found then raise exception 'FRIEND_REQUEST_NOT_PENDING'; end if;
  return true;
end;
$$;

create or replace function public.fetch_pending_friend_requests()
returns table (
  request_id uuid,
  user_id uuid,
  nickname text,
  animal text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, p.user_id, p.nickname, p.animal, f.created_at
  from public.friendships f
  join public.profiles p on p.user_id = f.requester_id
  where f.addressee_id = auth.uid()
    and f.status = 'pending'
  order by f.created_at asc;
$$;

create or replace function public.fetch_friends(p_local_date date)
returns table (
  user_id uuid,
  nickname text,
  animal text,
  public_friend_id text,
  streak integer,
  checked_in_today boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    p.nickname,
    p.animal,
    p.public_friend_id,
    private.friend_checkin_streak(p.user_id, p_local_date),
    exists (
      select 1 from public.daily_checkins d
      where d.user_id = p.user_id and d.checkin_date = p_local_date
    )
  from public.friendships f
  join public.profiles p
    on p.user_id = case
      when f.requester_id = auth.uid() then f.addressee_id
      else f.requester_id
    end
  where f.status = 'accepted'
    and auth.uid() in (f.requester_id, f.addressee_id)
  order by p.nickname asc;
$$;

create or replace function public.remind_friend(p_friend_user_id uuid, p_reminder_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_reminder_date is null then raise exception 'INVALID_LOCAL_DATE'; end if;

  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(v_user_id, p_friend_user_id)
      and greatest(requester_id, addressee_id) = greatest(v_user_id, p_friend_user_id)
  ) then raise exception 'NOT_FRIENDS'; end if;

  if exists (
    select 1 from public.daily_checkins
    where user_id = p_friend_user_id and checkin_date = p_reminder_date
  ) then return 'already_checked_in'; end if;

  insert into public.friend_checkin_reminders(sender_id, recipient_id, reminder_date)
  values (v_user_id, p_friend_user_id, p_reminder_date)
  on conflict (sender_id, recipient_id, reminder_date) do nothing;

  if not found then return 'already_reminded'; end if;
  return 'sent';
end;
$$;

create or replace function public.gift_friend_strawberry(p_friend_user_id uuid, p_gift_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_gift_date is null then raise exception 'INVALID_LOCAL_DATE'; end if;

  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(v_user_id, p_friend_user_id)
      and greatest(requester_id, addressee_id) = greatest(v_user_id, p_friend_user_id)
  ) then raise exception 'NOT_FRIENDS'; end if;

  insert into public.friend_strawberry_gifts(sender_id, recipient_id, gift_date)
  values (v_user_id, p_friend_user_id, p_gift_date)
  on conflict (sender_id, recipient_id, gift_date) do nothing;

  if not found then return 'already_gifted'; end if;
  return 'sent';
end;
$$;

revoke execute on function public.fetch_my_friend_id() from public, anon;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
revoke execute on function public.reject_friend_request(uuid) from public, anon;
revoke execute on function public.fetch_pending_friend_requests() from public, anon;
revoke execute on function public.fetch_friends(date) from public, anon;
revoke execute on function public.remind_friend(uuid, date) from public, anon;
revoke execute on function public.gift_friend_strawberry(uuid, date) from public, anon;

grant execute on function public.fetch_my_friend_id() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.reject_friend_request(uuid) to authenticated;
grant execute on function public.fetch_pending_friend_requests() to authenticated;
grant execute on function public.fetch_friends(date) to authenticated;
grant execute on function public.remind_friend(uuid, date) to authenticated;
grant execute on function public.gift_friend_strawberry(uuid, date) to authenticated;
