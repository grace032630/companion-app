-- Expose a friend's trusted task-completion count through the existing friends RPC.
-- Level is still derived in the client: every 20 completed tasks = +1 level.

begin;

drop function if exists public.fetch_friends();

create function public.fetch_friends()
returns table (
  user_id uuid,
  nickname text,
  animal text,
  public_friend_id text,
  streak integer,
  checked_in_today boolean,
  total_completions bigint
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
    ),
    (
      select pg_catalog.count(*)
      from public.task_completions tc
      where tc.user_id = p.user_id
    )::bigint
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

revoke execute on function public.fetch_friends() from public, anon, authenticated;
grant execute on function public.fetch_friends() to authenticated;

commit;
