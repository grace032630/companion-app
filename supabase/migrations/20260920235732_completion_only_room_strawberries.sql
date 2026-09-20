-- Only task completions may create claimable room strawberries.
-- Historical claimed entry berries are intentionally retained so this migration
-- does not change existing user balances.

begin;

alter table public.room_strawberries
  add column if not exists task_completion_id bigint
  references public.task_completions(id) on delete restrict;

create index if not exists room_strawberries_task_completion_idx
  on public.room_strawberries(task_completion_id)
  where task_completion_id is not null;

-- These berries have never contributed to a user's balance, so removing them is
-- safe. Claimed entry berries and their pickup rows are deliberately preserved.
delete from public.room_strawberries
where source = 'entry'
  and claimed_by is null;

-- Keep the old RPC callable for already-installed clients, but make it a no-op.
-- This prevents those clients from farming a new entry reward each occupancy cycle.
create or replace function public.ensure_room_strawberries()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return false;
end;
$$;

revoke execute on function public.ensure_room_strawberries() from public, anon, authenticated;
grant execute on function public.ensure_room_strawberries() to authenticated;

-- Claims remain shared within the active occupancy cycle, but entry berries can
-- never be claimed by either new or old clients.
create or replace function public.claim_room_strawberry(p_strawberry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_cycle_id uuid;
  v_berry public.room_strawberries%rowtype;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select room_id, strawberry_cycle_id
  into v_room_id, v_cycle_id
  from public.room_sessions
  where user_id = v_user_id
    and expires_at > pg_catalog.now()
    and status <> 'done'
  order by started_at desc
  limit 1;

  if v_room_id is null or v_cycle_id is null then raise exception 'NO_ACTIVE_ROOM'; end if;

  select * into v_berry
  from public.room_strawberries
  where id = p_strawberry_id
  for update;

  if not found
    or v_berry.room_id <> v_room_id
    or v_berry.cycle_id is distinct from v_cycle_id
    or v_berry.source <> 'completion'
  then
    raise exception 'STRAWBERRY_NOT_CLAIMABLE';
  end if;

  if v_berry.claimed_by is not null then return false; end if;

  update public.room_strawberries
  set claimed_by = v_user_id,
      claimed_at = pg_catalog.now()
  where id = p_strawberry_id;

  insert into public.strawberry_pickups(user_id, room_strawberry_id)
  values (v_user_id, p_strawberry_id)
  on conflict (room_strawberry_id) do nothing;

  return true;
end;
$$;

revoke execute on function public.claim_room_strawberry(uuid) from public, anon, authenticated;
grant execute on function public.claim_room_strawberry(uuid) to authenticated;

-- New shared berries carry a direct reference to the completion that authorized
-- them. The existing unique room_session_id completion constraint keeps retries
-- idempotent, and this transaction creates berries only for a new completion.
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
  v_existing integer := 0;
  v_drop_count integer;
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
  if v_session.room_id is null then raise exception 'INVALID_ROOM_SESSION'; end if;
  if v_session.started_at > pg_catalog.now() - interval '30 seconds' then
    raise exception 'ROOM_COMPLETION_TOO_EARLY';
  end if;

  insert into public.task_completions(user_id, task, room_session_id)
  values (v_user_id, v_session.task, v_session.id)
  on conflict do nothing
  returning id into v_completion_id;

  if v_completion_id is not null then
    insert into public.room_completion_events(room_id, user_id, name, animal, task)
    values (
      v_session.room_id::text,
      v_user_id,
      v_session.name,
      v_session.animal,
      v_session.task
    );

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_session.room_id::text || ':' || coalesce(v_session.strawberry_cycle_id::text, ''),
        130920
      )
    );

    select count(*) into v_existing
    from public.room_strawberries
    where room_id = v_session.room_id
      and cycle_id is not distinct from v_session.strawberry_cycle_id
      and claimed_by is null;

    v_drop_count := least(
      1 + pg_catalog.floor(pg_catalog.random() * 3)::integer,
      greatest(0, 10 - v_existing)
    );

    if v_drop_count > 0 then
      insert into public.room_strawberries(
        room_id,
        cycle_id,
        task_completion_id,
        x_percent,
        y_percent,
        source
      )
      select
        v_session.room_id,
        v_session.strawberry_cycle_id,
        v_completion_id,
        8 + pg_catalog.floor(pg_catalog.random() * 81)::integer,
        12 + pg_catalog.floor(pg_catalog.random() * 71)::integer,
        'completion'
      from pg_catalog.generate_series(1, v_drop_count);
    end if;
  end if;

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

commit;
