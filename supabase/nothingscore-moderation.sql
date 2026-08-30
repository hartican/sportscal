-- Nothing Sport owner-console moderation metadata and service-role audit ledger.
-- Status review never changes account access; profile and pilot controls are separate API actions.

alter table public.nothingsports_nsc_username_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text,
  add column if not exists resolved_at timestamptz;

alter table public.nothingsports_nsc_username_reports
  drop constraint if exists nothingsports_nsc_username_reports_resolution_length;
alter table public.nothingsports_nsc_username_reports
  add constraint nothingsports_nsc_username_reports_resolution_length
  check (resolution is null or char_length(resolution) between 1 and 1000);

create index if not exists nothingsports_nsc_reports_review_idx
  on public.nothingsports_nsc_username_reports(status,created_at desc);
create index if not exists nothingsports_nsc_reports_reviewer_idx
  on public.nothingsports_nsc_username_reports(reviewed_by,reviewed_at desc)
  where reviewed_by is not null;

create table if not exists public.nothingsports_nsc_admin_audit (
  audit_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  report_id uuid references public.nothingsports_nsc_username_reports(report_id) on delete set null,
  action text not null check (action in (
    'approve','revoke-approval','suspend','reinstate',
    'hide-profile','restore-profile','suspend-contributions','reinstate-contributions',
    'mark-reviewed','dismiss','mark-actioned'
  )),
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nothingsports_nsc_admin_audit_target_idx
  on public.nothingsports_nsc_admin_audit(target_user_id,created_at desc);
create index if not exists nothingsports_nsc_admin_audit_actor_idx
  on public.nothingsports_nsc_admin_audit(actor_user_id,created_at desc);
create index if not exists nothingsports_nsc_admin_audit_report_idx
  on public.nothingsports_nsc_admin_audit(report_id,created_at desc)
  where report_id is not null;

alter table public.nothingsports_nsc_admin_audit enable row level security;
alter table public.nothingsports_nsc_admin_audit force row level security;
revoke all on public.nothingsports_nsc_admin_audit from public,anon,authenticated;
revoke all on public.nothingsports_nsc_admin_audit from service_role;
grant select,insert on public.nothingsports_nsc_admin_audit to service_role;

alter table public.nothingsports_nsc_username_reports enable row level security;
alter table public.nothingsports_nsc_username_reports force row level security;
revoke all on public.nothingsports_nsc_username_reports from public,anon,authenticated;
grant select,insert,update,delete on public.nothingsports_nsc_username_reports to service_role;
