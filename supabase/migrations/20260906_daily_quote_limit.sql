alter table public.profiles
  add column if not exists quote_updated_at timestamptz;

create or replace function public.enforce_daily_quote_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quote is distinct from old.quote then
    if old.quote_updated_at is not null
      and (old.quote_updated_at at time zone 'Asia/Taipei')::date = (now() at time zone 'Asia/Taipei')::date then
      raise exception 'Daily quote already updated today';
    end if;
    new.quote_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_daily_quote_update_trigger on public.profiles;
create trigger enforce_daily_quote_update_trigger
before update on public.profiles
for each row
execute function public.enforce_daily_quote_update();
