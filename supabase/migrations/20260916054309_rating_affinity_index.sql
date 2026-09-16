-- Supports the bounded per-user 90-day rating-affinity read used by Follow.
create index if not exists nothingsports_nsc_contributions_user_updated
on public.nothingsports_nsc_contributions(user_id,updated_at desc)
include(event_id,phase,submitted_at);
