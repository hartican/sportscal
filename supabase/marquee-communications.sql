-- Nothing Sport marquee communications and guest participation.
-- Apply with the Supabase migration runner. All operational tables are service-role only.

create extension if not exists pgcrypto;

create table if not exists public.nothingsports_marquee_campaigns (
  campaign_id text primary key check (campaign_id ~ '^marquee_[a-f0-9]{16}$'),
  event_id text not null unique,
  source_revision text not null,
  campaign_revision integer not null default 1 check (campaign_revision > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('watching','draft','needs_review','approved','scheduled','connector_blocked','partially_published','published','needs_reapproval','failed','cancelled')),
  candidate jsonb not null,
  draft_copy jsonb not null,
  approved_copy jsonb,
  proposed_send_at timestamptz not null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  correction_required boolean not null default false,
  late boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approved_at is null and approved_by is null and approved_copy is null) or (approved_at is not null and approved_by is not null and approved_copy is not null))
);

create table if not exists public.nothingsports_marquee_subscribers (
  subscriber_id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique check (email_normalized = lower(email_normalized)),
  consented_at timestamptz not null,
  consent_source text not null,
  consent_scope text not null check (consent_scope = 'marquee_fixture_email'),
  evidence_reference text not null,
  suppressed_at timestamptz,
  suppression_reason text check (suppression_reason in ('unsubscribe','bounce','complaint','operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nothingsports_marquee_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.nothingsports_marquee_campaigns(campaign_id) on delete cascade,
  channel text not null check (channel in ('instagram','email','x','linkedin','facebook')),
  idempotency_key text not null unique,
  status text not null check (status in ('draft','scheduled','sent','delivered','bounced','complained','unsubscribed','connector_blocked','uncertain','failed')),
  external_id text,
  permalink text,
  receipt jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nothingsports_fixture_devices (
  device_hash text primary key check (device_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.nothingsports_fixture_participation (
  event_id text not null,
  device_hash text not null references public.nothingsports_fixture_devices(device_hash) on delete cascade,
  campaign_id text references public.nothingsports_marquee_campaigns(campaign_id) on delete set null,
  joined_at timestamptz,
  rating smallint check (rating between 1 and 5),
  rated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, device_hash)
);

create table if not exists public.nothingsports_fixture_write_limits (
  device_hash text not null references public.nothingsports_fixture_devices(device_hash) on delete cascade,
  action text not null check (action in ('join','rate')),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (device_hash, action)
);

create index if not exists nothingsports_marquee_campaign_state_idx on public.nothingsports_marquee_campaigns(state, proposed_send_at);
create index if not exists nothingsports_marquee_delivery_campaign_idx on public.nothingsports_marquee_deliveries(campaign_id, channel);
create index if not exists nothingsports_marquee_subscriber_suppression_idx on public.nothingsports_marquee_subscribers(suppressed_at);
create index if not exists nothingsports_fixture_participation_event_idx on public.nothingsports_fixture_participation(event_id);

alter table public.nothingsports_marquee_campaigns enable row level security;
alter table public.nothingsports_marquee_campaigns force row level security;
alter table public.nothingsports_marquee_subscribers enable row level security;
alter table public.nothingsports_marquee_subscribers force row level security;
alter table public.nothingsports_marquee_deliveries enable row level security;
alter table public.nothingsports_marquee_deliveries force row level security;
alter table public.nothingsports_fixture_devices enable row level security;
alter table public.nothingsports_fixture_devices force row level security;
alter table public.nothingsports_fixture_participation enable row level security;
alter table public.nothingsports_fixture_participation force row level security;
alter table public.nothingsports_fixture_write_limits enable row level security;
alter table public.nothingsports_fixture_write_limits force row level security;

revoke all on public.nothingsports_marquee_campaigns from anon, authenticated;
revoke all on public.nothingsports_marquee_subscribers from anon, authenticated;
revoke all on public.nothingsports_marquee_deliveries from anon, authenticated;
revoke all on public.nothingsports_fixture_devices from anon, authenticated;
revoke all on public.nothingsports_fixture_participation from anon, authenticated;
revoke all on public.nothingsports_fixture_write_limits from anon, authenticated;
grant select, insert, update, delete on public.nothingsports_marquee_campaigns to service_role;
grant select, insert, update, delete on public.nothingsports_marquee_subscribers to service_role;
grant select, insert, update, delete on public.nothingsports_marquee_deliveries to service_role;
grant select, insert, update, delete on public.nothingsports_fixture_devices to service_role;
grant select, insert, update, delete on public.nothingsports_fixture_participation to service_role;
grant select, insert, update, delete on public.nothingsports_fixture_write_limits to service_role;

create or replace function public.nothingsports_marquee_take_rate_limit(
  target_device_hash text,
  target_action text,
  target_now timestamptz,
  window_seconds integer default 60,
  maximum_requests integer default 10
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare current_row public.nothingsports_fixture_write_limits%rowtype;
begin
  if target_action not in ('join','rate') or maximum_requests < 1 or window_seconds < 1 then return false; end if;
  select * into current_row from public.nothingsports_fixture_write_limits
    where device_hash = target_device_hash and action = target_action for update;
  if not found or current_row.window_started_at + make_interval(secs => window_seconds) <= target_now then
    insert into public.nothingsports_fixture_write_limits(device_hash, action, window_started_at, request_count)
      values(target_device_hash, target_action, target_now, 1)
      on conflict(device_hash, action) do update set window_started_at = excluded.window_started_at, request_count = 1;
    return true;
  end if;
  if current_row.request_count >= maximum_requests then return false; end if;
  update public.nothingsports_fixture_write_limits set request_count = request_count + 1
    where device_hash = target_device_hash and action = target_action;
  return true;
end;
$$;

revoke all on function public.nothingsports_marquee_take_rate_limit(text,text,timestamptz,integer,integer) from public, anon, authenticated;
grant execute on function public.nothingsports_marquee_take_rate_limit(text,text,timestamptz,integer,integer) to service_role;

comment on table public.nothingsports_marquee_subscribers is 'Service-only express-consent evidence. Suppression wins unless a later consent record is explicitly supplied.';
comment on table public.nothingsports_fixture_devices is 'Opaque guest cookie hashes only. Raw tokens and IP addresses are never stored.';
