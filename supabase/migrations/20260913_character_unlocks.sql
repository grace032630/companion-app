-- Premium characters unlocked with earned strawberries.
-- The database calculates the balance and performs the purchase atomically.

begin;

create table if not exists public.character_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  animal text not null,
  price_paid integer not null default 500 check (price_paid >= 0),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, animal),
  constraint character_unlocks_premium_animal_check check (animal in ('🐨','🦁','🐺','🦝'))
);

alter table public.character_unlocks enable row level security;
revoke all on table public.character_unlocks from anon, authenticated;
grant select on table public.character_unlocks to authenticated;

create policy "users can read own character unlocks"
  on public.character_unlocks for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.unlock_character(p_animal text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_earned integer := 0;
  v_spent integer := 0;
  v_balance integer := 0;
  v_price constant integer := 500;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_animal not in ('🐨','🦁','🐺','🦝') then raise exception 'INVALID_CHARACTER'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':character-unlock', 130913)
  );

  if exists (
    select 1 from public.character_unlocks
    where user_id = v_user_id and animal = p_animal
  ) then
    select
      (select count(*) from public.daily_strawberries where user_id = v_user_id)
      + (select count(*) from public.friend_strawberry_gifts where recipient_id = v_user_id)
      + (select count(*) from public.strawberry_pickups where user_id = v_user_id)
      - coalesce((select sum(price_paid) from public.character_unlocks where user_id = v_user_id), 0)
    into v_balance;
    return greatest(v_balance, 0);
  end if;

  select
    (select count(*) from public.daily_strawberries where user_id = v_user_id)
    + (select count(*) from public.friend_strawberry_gifts where recipient_id = v_user_id)
    + (select count(*) from public.strawberry_pickups where user_id = v_user_id)
  into v_earned;

  select coalesce(sum(price_paid), 0)
  into v_spent
  from public.character_unlocks
  where user_id = v_user_id;

  v_balance := v_earned - v_spent;
  if v_balance < v_price then raise exception 'NOT_ENOUGH_STRAWBERRIES'; end if;

  insert into public.character_unlocks(user_id, animal, price_paid)
  values (v_user_id, p_animal, v_price);

  return v_balance - v_price;
end;
$$;

revoke execute on function public.unlock_character(text) from public, anon, authenticated;
grant execute on function public.unlock_character(text) to authenticated;

-- Prevent bypassing the unlock UI by directly updating profiles.animal.
create or replace function public.enforce_character_unlock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.animal in ('🐨','🦁','🐺','🦝') and not exists (
    select 1 from public.character_unlocks
    where user_id = new.user_id and animal = new.animal
  ) then
    raise exception 'CHARACTER_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_character_unlock_trigger on public.profiles;
create trigger enforce_character_unlock_trigger
before insert or update of animal on public.profiles
for each row execute function public.enforce_character_unlock();

commit;
