create extension if not exists pgcrypto with schema extensions;

create table if not exists public.nothingsports_preference_resets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reset_id uuid not null unique default extensions.gen_random_uuid(),
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (expires_at > created_at)
);

alter table public.nothingsports_preference_resets enable row level security;
alter table public.nothingsports_preference_resets force row level security;

revoke all on table public.nothingsports_preference_resets from public;
revoke all on table public.nothingsports_preference_resets from anon;
revoke all on table public.nothingsports_preference_resets from authenticated;
grant select, insert, update, delete on table public.nothingsports_preference_resets to service_role;
grant update (preferences, updated_at) on table public.nothingsports_user_state to service_role;

create or replace function public.nothingsports_reset_preferences(
  target_user_id uuid,
  target_preferences jsonb,
  reset_time timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_state public.nothingsports_user_state%rowtype;
  updated_state public.nothingsports_user_state%rowtype;
  recovery public.nothingsports_preference_resets%rowtype;
begin
  if target_user_id is null or jsonb_typeof(target_preferences) is distinct from 'object' then
    raise exception 'A user and preference object are required.' using errcode = '22023';
  end if;

  delete from public.nothingsports_preference_resets where expires_at <= reset_time;

  select * into previous_state
  from public.nothingsports_user_state
  where user_id = target_user_id
  for update;

  if not found then
    raise exception 'User state is unavailable.' using errcode = 'P0002';
  end if;

  insert into public.nothingsports_preference_resets (
    user_id, reset_id, preferences, created_at, expires_at
  ) values (
    target_user_id,
    extensions.gen_random_uuid(),
    previous_state.preferences,
    reset_time,
    reset_time + interval '7 days'
  )
  on conflict (user_id) do update set
    reset_id = excluded.reset_id,
    preferences = excluded.preferences,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at
  returning * into recovery;

  update public.nothingsports_user_state
  set preferences = target_preferences,
      updated_at = greatest(reset_time, updated_at + interval '1 millisecond')
  where user_id = target_user_id
  returning * into updated_state;

  return jsonb_build_object(
    'recovery', jsonb_build_object(
      'resetId', recovery.reset_id,
      'createdAt', recovery.created_at,
      'expiresAt', recovery.expires_at
    ),
    'state', to_jsonb(updated_state)
  );
end;
$$;

create or replace function public.nothingsports_undo_preferences_reset(
  target_user_id uuid,
  target_reset_id uuid,
  restore_time timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recovery public.nothingsports_preference_resets%rowtype;
  updated_state public.nothingsports_user_state%rowtype;
begin
  select * into recovery
  from public.nothingsports_preference_resets
  where user_id = target_user_id
    and reset_id = target_reset_id
    and expires_at > restore_time
  for update;

  if not found then
    raise exception 'Preference reset recovery is unavailable or expired.' using errcode = 'P0002';
  end if;

  update public.nothingsports_user_state
  set preferences = recovery.preferences,
      updated_at = greatest(restore_time, updated_at + interval '1 millisecond')
  where user_id = target_user_id
  returning * into updated_state;

  delete from public.nothingsports_preference_resets
  where user_id = target_user_id and reset_id = target_reset_id;

  return jsonb_build_object('recovery', null, 'state', to_jsonb(updated_state));
end;
$$;

create or replace function public.nothingsports_active_preference_reset(
  target_user_id uuid,
  reference_time timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recovery public.nothingsports_preference_resets%rowtype;
begin
  delete from public.nothingsports_preference_resets
  where user_id = target_user_id and expires_at <= reference_time;

  select * into recovery
  from public.nothingsports_preference_resets
  where user_id = target_user_id and expires_at > reference_time;

  if not found then return null; end if;
  return jsonb_build_object(
    'resetId', recovery.reset_id,
    'createdAt', recovery.created_at,
    'expiresAt', recovery.expires_at
  );
end;
$$;

create or replace function public.nothingsports_purge_expired_preference_resets(
  reference_time timestamptz default now()
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  purged integer;
begin
  delete from public.nothingsports_preference_resets where expires_at <= reference_time;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.nothingsports_reset_preferences(uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.nothingsports_undo_preferences_reset(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.nothingsports_active_preference_reset(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.nothingsports_purge_expired_preference_resets(timestamptz) from public, anon, authenticated;
grant execute on function public.nothingsports_reset_preferences(uuid, jsonb, timestamptz) to service_role;
grant execute on function public.nothingsports_undo_preferences_reset(uuid, uuid, timestamptz) to service_role;
grant execute on function public.nothingsports_active_preference_reset(uuid, timestamptz) to service_role;
grant execute on function public.nothingsports_purge_expired_preference_resets(timestamptz) to service_role;

comment on table public.nothingsports_preference_resets is
  'Service-only latest preference snapshot for seven-day undo; account and durable participation data are not copied.';
