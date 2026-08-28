-- Nothing Sport Nothingscore closed-pilot social layer.
-- Public reads and all writes pass through server APIs; raw identities and ledgers are never browser-selectable.

create extension if not exists pgcrypto;

create table if not exists public.nothingsports_nsc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null default gen_random_uuid() unique,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  visibility text not null default 'visible' check (visibility in ('visible','hidden','deleted')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.nothingsports_nsc_personas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  persona text not null default 'general' check (persona in ('general','pundit','rising','influencer','curator','editorial','admin')),
  moderation_flag boolean not null default false,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create table if not exists public.nothingsports_nsc_pilot_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved boolean not null default false,
  suspended boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.nothingsports_nsc_contributions (
  contribution_id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null check (phase in ('heat','pulse','impact')),
  bucket_start timestamptz not null default '1970-01-01T00:00:00Z',
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(event_id,user_id,phase,bucket_start),
  check (cardinality(tags) <= 3)
);

create table if not exists public.nothingsports_nsc_likes (
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null check (phase in ('heat','pulse','impact')),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(event_id,user_id,phase)
);

create table if not exists public.nothingsports_nsc_presence (
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  watching_started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  heartbeat_count integer not null default 1 check (heartbeat_count > 0),
  primary key(event_id,user_id)
);

create table if not exists public.nothingsports_nsc_marquee_sessions (
  event_id text primary key,
  status text not null check (status in ('active','stopped')),
  effective_start_at timestamptz not null,
  effective_end_at timestamptz not null,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz not null default now(),
  stopped_at timestamptz,
  frozen_pulse_mean numeric(3,2),
  frozen_pulse_contributors integer,
  impact_seed numeric(3,2),
  impact_seed_weight numeric(4,2),
  pulse_frozen_at timestamptz,
  updated_at timestamptz not null default now(),
  check (effective_end_at > effective_start_at)
);

create table if not exists public.nothingsports_nsc_points (
  ledger_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  action_key text not null,
  points smallint not null check (points between 1 and 10),
  sydney_day date not null,
  awarded_at timestamptz not null default now(),
  unique(user_id,event_id,action_key)
);

create table if not exists public.nothingsports_nsc_username_reports (
  report_id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('impersonation','offensive','misleading','privacy','other_fixed')),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  unique(reporter_user_id,target_user_id,reason)
);

create index if not exists nothingsports_nsc_contribution_event_idx on public.nothingsports_nsc_contributions(event_id,phase,updated_at desc);
create index if not exists nothingsports_nsc_contribution_user_idx on public.nothingsports_nsc_contributions(user_id);
create index if not exists nothingsports_nsc_like_event_idx on public.nothingsports_nsc_likes(event_id,phase) where active;
create index if not exists nothingsports_nsc_like_user_idx on public.nothingsports_nsc_likes(user_id);
create index if not exists nothingsports_nsc_presence_event_idx on public.nothingsports_nsc_presence(event_id,last_heartbeat_at desc);
create index if not exists nothingsports_nsc_presence_user_idx on public.nothingsports_nsc_presence(user_id);
create index if not exists nothingsports_nsc_points_week_idx on public.nothingsports_nsc_points(sydney_day,user_id);
create index if not exists nothingsports_nsc_reports_target_idx on public.nothingsports_nsc_username_reports(target_user_id,status);
create index if not exists nothingsports_nsc_persona_assigner_idx on public.nothingsports_nsc_personas(assigned_by) where assigned_by is not null;
create index if not exists nothingsports_nsc_pilot_approver_idx on public.nothingsports_nsc_pilot_members(approved_by) where approved_by is not null;
create index if not exists nothingsports_nsc_session_activator_idx on public.nothingsports_nsc_marquee_sessions(activated_by) where activated_by is not null;

do $$ declare table_name text; begin
  foreach table_name in array array[
    'nothingsports_nsc_profiles','nothingsports_nsc_personas','nothingsports_nsc_pilot_members',
    'nothingsports_nsc_contributions','nothingsports_nsc_likes','nothingsports_nsc_presence',
    'nothingsports_nsc_marquee_sessions','nothingsports_nsc_points','nothingsports_nsc_username_reports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
  end loop;
end $$;

create or replace function public.nothingsports_nsc_award_points(
  target_user_id uuid, target_event_id text, target_action_key text, requested_points integer, awarded_time timestamptz default now()
) returns integer
language plpgsql security definer set search_path=public
as $$
declare fixture_total integer; day_total integer; award integer; target_day date;
begin
  if requested_points < 1 or requested_points > 10 or target_event_id = '' or target_action_key = '' then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));
  if exists(select 1 from public.nothingsports_nsc_points where user_id=target_user_id and event_id=target_event_id and action_key=target_action_key) then return 0; end if;
  target_day := (awarded_time at time zone 'Australia/Sydney')::date;
  select coalesce(sum(points),0) into fixture_total from public.nothingsports_nsc_points where user_id=target_user_id and event_id=target_event_id;
  select coalesce(sum(points),0) into day_total from public.nothingsports_nsc_points where user_id=target_user_id and sydney_day=target_day;
  award := greatest(0, least(requested_points,10-fixture_total,25-day_total));
  if award > 0 then insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,awarded_at) values(target_user_id,target_event_id,target_action_key,award,target_day,awarded_time); end if;
  return award;
end;
$$;

revoke all on function public.nothingsports_nsc_award_points(uuid,text,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_award_points(uuid,text,text,integer,timestamptz) to service_role;

comment on table public.nothingsports_nsc_profiles is 'Public-facing names served only through the batched API. Hidden/deleted profiles are anonymised by the server.';
comment on table public.nothingsports_nsc_personas is 'Authoritative server-owned scoring roles. Never trust JWT user metadata for vote weight.';
comment on table public.nothingsports_nsc_points is 'Idempotent capped progression ledger; raw rows are never public.';
