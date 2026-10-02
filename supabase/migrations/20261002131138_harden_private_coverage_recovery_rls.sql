-- Defence in depth for the existing private archive. No rows or grants added.
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='nothingsports_recovery' and p.proname in('purge_repair_subject_v1','bledisloe_identity_ready_v1') and not(r.rolbypassrls or r.rolsuper)) then
  raise exception 'Private recovery owner requires RLS review';
 end if;
end $guard$;
alter table nothingsports_recovery.coverage_repair_versions enable row level security;
alter table nothingsports_recovery.coverage_repair_versions force row level security;
alter table nothingsports_recovery.coverage_repair_rows enable row level security;
alter table nothingsports_recovery.coverage_repair_rows force row level security;
alter table nothingsports_recovery.coverage_repair_subjects enable row level security;
alter table nothingsports_recovery.coverage_repair_subjects force row level security;
revoke all on nothingsports_recovery.coverage_repair_versions,nothingsports_recovery.coverage_repair_rows,nothingsports_recovery.coverage_repair_subjects from public,anon,authenticated,service_role;
