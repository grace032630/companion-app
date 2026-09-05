alter table public.profiles
  add column if not exists language text not null default 'zh-TW';

alter table public.profiles
  drop constraint if exists profiles_language_check;
alter table public.profiles
  add constraint profiles_language_check
  check (language in ('zh-TW', 'zh-CN', 'en', 'ja', 'ko'));

alter table public.profiles
  drop constraint if exists profiles_quote_length_check;
alter table public.profiles
  add constraint profiles_quote_length_check
  check (quote is null or char_length(quote) <= 60);
