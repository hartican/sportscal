-- Reliable Web Push reminder upgrade for the existing Nothing Sport project.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.nothingsports_reminders
  add column if not exists claimed_at timestamptz;

alter table public.nothingsports_push_installations
  add column if not exists chat_alerts_enabled boolean not null default true,
  add column if not exists badges_enabled boolean not null default true;

create index if not exists nothingsports_reminders_claim_idx
  on public.nothingsports_reminders (claimed_at, remind_at)
  where dispatched_at is null;

grant select, insert, update, delete on table public.nothingsports_push_installations to service_role;
grant select, insert, update, delete on table public.nothingsports_reminders to service_role;

comment on column public.nothingsports_reminders.claimed_at is
  'Short-lived dispatcher claim. Claims older than ten minutes can be recovered after an interrupted run.';
