-- Everything's shared, service-owned source store is independent of personal
-- Feed eligibility. The old guard skipped domestic fixture rows, then their
-- compact score FK rolled back the entire legitimate source refresh.
-- Preserve all personal preference/action guards and the table's existing RLS.
drop trigger if exists cricket_coverage_v1 on public.nothingsports_fixture_current;
-- Retry the two affected failed sources through their existing scheduled owner.
-- Do not take an active lease or alter sporting data/failure history/cadence.
update public.nothingsports_fixture_sources
 set next_due_at=least(next_due_at,clock_timestamp())
 where source_id in('cricket-ca-current','discovery-cricket-near') and failure_count>0
  and (lease_until is null or lease_until<=clock_timestamp());
