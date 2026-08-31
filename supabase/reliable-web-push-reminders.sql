-- Reliable Web Push reminder upgrade for the existing Nothing Sport project.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.nothingsports_reminders
  add column if not exists claimed_at timestamptz,
  add column if not exists delivery_mode text not null default 'match-15';

alter table public.nothingsports_reminders
  drop constraint if exists nothingsports_reminders_delivery_mode_check;

alter table public.nothingsports_reminders
  add constraint nothingsports_reminders_delivery_mode_check
  check (delivery_mode in ('match-15', 'broadcast-15', 'session-start'));

alter table public.nothingsports_push_installations
  add column if not exists chat_alerts_enabled boolean not null default true,
  add column if not exists badges_enabled boolean not null default true;

create index if not exists nothingsports_reminders_claim_idx
  on public.nothingsports_reminders (claimed_at, remind_at)
  where dispatched_at is null;

create table if not exists public.nothingsports_notification_dispatch_health (
  health_id text primary key default 'dispatcher' check (health_id = 'dispatcher'),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_success_at timestamptz,
  checked_count integer not null default 0,
  claimed_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.nothingsports_notification_dispatch_health (health_id)
values ('dispatcher')
on conflict (health_id) do nothing;

create table if not exists public.nothingsports_notification_tests (
  test_id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.nothingsports_push_installations(installation_id) on delete cascade,
  requested_at timestamptz not null default now(),
  dispatched_at timestamptz,
  received_at timestamptz,
  last_error text
);

create index if not exists nothingsports_notification_tests_installation_idx
  on public.nothingsports_notification_tests (installation_id, requested_at desc);

alter table public.nothingsports_notification_dispatch_health enable row level security;
alter table public.nothingsports_notification_dispatch_health force row level security;
alter table public.nothingsports_notification_tests enable row level security;
alter table public.nothingsports_notification_tests force row level security;

revoke all on table public.nothingsports_notification_dispatch_health from public, anon, authenticated;
revoke all on table public.nothingsports_notification_tests from public, anon, authenticated;

grant select, insert, update, delete on table public.nothingsports_push_installations to service_role;
grant select, insert, update, delete on table public.nothingsports_reminders to service_role;
grant select, insert, update, delete on table public.nothingsports_notification_dispatch_health to service_role;
grant select, insert, update, delete on table public.nothingsports_notification_tests to service_role;

comment on column public.nothingsports_reminders.claimed_at is
  'Short-lived dispatcher claim. Claims older than ten minutes can be recovered after an interrupted run.';

comment on column public.nothingsports_reminders.delivery_mode is
  'match-15 and broadcast-15 fire fifteen minutes before their published instant; session-start fires when a follows-only session begins.';
