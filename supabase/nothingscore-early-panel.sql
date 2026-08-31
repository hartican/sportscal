-- Owner-controlled public Early panel rollout state.
-- This singleton is backend-only: public readers receive a derived snapshot and never query it directly.

create table if not exists public.nothingsports_nsc_early_panel_state (
  id text primary key default 'public' check (id = 'public'),
  public_enabled boolean not null default true,
  retirement_threshold smallint not null default 10 check (retirement_threshold between 3 and 100),
  retired_at timestamptz,
  retired_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.nothingsports_nsc_early_panel_state(id,public_enabled,retirement_threshold)
values ('public',true,10)
on conflict (id) do nothing;

alter table public.nothingsports_nsc_early_panel_state enable row level security;
alter table public.nothingsports_nsc_early_panel_state force row level security;
revoke all on public.nothingsports_nsc_early_panel_state from public,anon,authenticated;
revoke all on public.nothingsports_nsc_early_panel_state from service_role;
grant select,insert,update on public.nothingsports_nsc_early_panel_state to service_role;

alter table public.nothingsports_nsc_admin_audit
  drop constraint if exists nothingsports_nsc_admin_audit_action_check;
alter table public.nothingsports_nsc_admin_audit
  add constraint nothingsports_nsc_admin_audit_action_check check (action in (
    'approve','revoke-approval','suspend','reinstate',
    'hide-profile','restore-profile','suspend-contributions','reinstate-contributions',
    'mark-reviewed','dismiss','mark-actioned',
    'retire-early-panel','restore-early-panel'
  ));
