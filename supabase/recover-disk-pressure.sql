-- Staged recovery for a Nothing Sport database under /data pressure.
-- Run only after SUPABASE_MAINTENANCE_MODE=1 is live and SQL is writable.
-- User follows, ratings, chat, reminders and scoring ledgers are untouched.

-- Stop database-owned writers first. Definitions remain available for a
-- selective restart after the reduced-write migration is applied.
do $$
begin
  if to_regclass('cron.job') is not null then
    update cron.job set active=false where jobname like 'nothingsport-%';
  end if;
end;
$$;

-- Measure before cleanup. Save these results with the incident record.
select schemaname,relname,n_live_tup,n_dead_tup,
       pg_total_relation_size(format('%I.%I',schemaname,relname)::regclass) as total_bytes,
       pg_size_pretty(pg_total_relation_size(format('%I.%I',schemaname,relname)::regclass)) as total_size
  from pg_stat_user_tables
 order by total_bytes desc
 limit 30;

select count(*) filter (where end_time < clock_timestamp()-interval '7 days') as expired_cron_runs
  from cron.job_run_details;
select count(*) as expired_presence
  from public.nothingsports_nsc_presence
 where last_heartbeat_at < clock_timestamp()-interval '1 day';
select count(*) as expired_superseded_snapshots
  from public.nothingsports_fixture_snapshots snapshot
 where snapshot.published_at < clock_timestamp()-interval '7 days'
   and snapshot.revision <> coalesce((select source.revision from public.nothingsports_fixture_sources source where source.source_id=snapshot.source_id),-1);

-- One bounded batch per run limits WAL and I/O. Re-run only after checking disk
-- headroom and the returned row counts. Current snapshots and recent history stay.
with doomed as (
  select ctid from cron.job_run_details
   where end_time < clock_timestamp()-interval '7 days'
   order by end_time
   limit 1000
)
delete from cron.job_run_details target using doomed where target.ctid=doomed.ctid;

with doomed as (
  select ctid from public.nothingsports_nsc_presence
   where last_heartbeat_at < clock_timestamp()-interval '1 day'
   order by last_heartbeat_at
   limit 1000
)
delete from public.nothingsports_nsc_presence target using doomed where target.ctid=doomed.ctid;

with doomed as (
  select snapshot.ctid
    from public.nothingsports_fixture_snapshots snapshot
   where snapshot.published_at < clock_timestamp()-interval '7 days'
     and snapshot.revision <> coalesce((select source.revision from public.nothingsports_fixture_sources source where source.source_id=snapshot.source_id),-1)
   order by snapshot.published_at
   limit 100
)
delete from public.nothingsports_fixture_snapshots target using doomed where target.ctid=doomed.ctid;

select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_is_in_recovery() as in_recovery,
       current_setting('transaction_read_only') as transaction_read_only;

-- Run VACUUM ANALYZE separately after the bounded deletes and only while disk
-- headroom is stable. Never use VACUUM FULL during incident recovery.
