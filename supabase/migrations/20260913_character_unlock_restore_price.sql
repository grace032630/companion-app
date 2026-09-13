-- Restore the production premium-character unlock price after testing.

begin;

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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':character-unlock', 130913));

  select
    (select count(*) from public.daily_strawberries where user_id = v_user_id)
    + (select count(*) from public.friend_strawberry_gifts where recipient_id = v_user_id)
    + (select count(*) from public.strawberry_pickups where user_id = v_user_id),
    coalesce((select sum(price_paid) from public.character_unlocks where user_id = v_user_id), 0)
  into v_earned, v_spent;

  v_balance := v_earned - v_spent;

  if exists (select 1 from public.character_unlocks where user_id = v_user_id and animal = p_animal) then
    return greatest(v_balance, 0);
  end if;

  if v_balance < v_price then raise exception 'NOT_ENOUGH_STRAWBERRIES'; end if;

  insert into public.character_unlocks(user_id, animal, price_paid)
  values (v_user_id, p_animal, v_price);

  return v_balance - v_price;
end;
$$;

revoke execute on function public.unlock_character(text) from public, anon, authenticated;
grant execute on function public.unlock_character(text) to authenticated;

create or replace function public.enforce_character_unlock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned integer := 0;
  v_spent integer := 0;
  v_balance integer := 0;
  v_price constant integer := 500;
begin
  if new.animal not in ('🐨','🦁','🐺','🦝') then return new; end if;
  if exists (select 1 from public.character_unlocks where user_id = new.user_id and animal = new.animal) then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || ':character-unlock', 130913));

  if exists (select 1 from public.character_unlocks where user_id = new.user_id and animal = new.animal) then return new; end if;

  select
    (select count(*) from public.daily_strawberries where user_id = new.user_id)
    + (select count(*) from public.friend_strawberry_gifts where recipient_id = new.user_id)
    + (select count(*) from public.strawberry_pickups where user_id = new.user_id),
    coalesce((select sum(price_paid) from public.character_unlocks where user_id = new.user_id), 0)
  into v_earned, v_spent;

  v_balance := v_earned - v_spent;
  if v_balance < v_price then raise exception 'NOT_ENOUGH_STRAWBERRIES'; end if;

  insert into public.character_unlocks(user_id, animal, price_paid)
  values (new.user_id, new.animal, v_price);

  return new;
end;
$$;

commit;
