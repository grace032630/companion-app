-- Allow users to edit their daily quote whenever they want.
-- The previous trigger blocked every quote change after the first edit of the day,
-- which made the profile UI appear to keep the old quote.

drop trigger if exists enforce_daily_quote_update_trigger on public.profiles;
drop function if exists public.enforce_daily_quote_update();

alter table public.profiles
  drop column if exists quote_updated_at;
