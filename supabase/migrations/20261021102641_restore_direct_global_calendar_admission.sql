-- Actual complete production diagnostics found the descriptor shortcut slower
-- than its existing raw-fact fallback. Restore direct admission on this view only.
-- Retain batched observations, ordered complete output and the 5001 sentinel.
-- No reader function, canonical writer, stored facts, rights or budget changes.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from 'fbc28299a5bf25428b286adc5ee2e0da'
 or to_regclass('nothingsports_fixture_read_private.global_encoded_rows') is not null then
  raise exception 'Direct calendar repair requires the original unencoded global view';
 end if;
 if not exists(select 1 from pg_class where oid='public.nothingsports_current_global_fixture_bundle'::regclass and pg_get_userbyid(relowner)='postgres' and reloptions=array['security_invoker=true'])
 or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass and a.grantee not in(c.relowner,(select oid from pg_roles where rolname='service_role')))
 or has_table_privilege('anon','public.nothingsports_current_global_fixture_bundle','SELECT')
 or has_table_privilege('authenticated','public.nothingsports_current_global_fixture_bundle','SELECT')
 or not has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','SELECT')
 or has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
  raise exception 'Direct calendar repair requires unchanged service-only invoker rights';
 end if;
 if md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9'
 or not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture' and not a.attisdropped and a.attgenerated='s' and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365') then
  raise exception 'Direct calendar repair requires original projection and observation parser';
 end if;
end;$guard$;
create or replace view public.nothingsports_current_global_fixture_bundle with(security_invoker=true) as
select value bundle from (
with active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), scope_keys as (
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  cross join active_window w
  cross join lateral (
   select
    case when s.score ? 'status' then s.score->>'status' else c.global_fixture->>'status' end as status,
    case when s.score ? 'endDate' then s.score->>'endDate' else c.global_fixture->>'endDate' end as end_date,
    case when s.score ? 'date' then s.score->>'date' else c.global_fixture->>'date' end as date,
    case when s.score ? 'startDate' then s.score->>'startDate' else c.global_fixture->>'startDate' end as start_date,
    case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.global_fixture->'schedulingWindow' end as scheduling_window
  ) f
  cross join lateral (
   select coalesce(nullif(f.end_date,''),nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'endsOn','') as ends_on,
    coalesce(nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'startsOn','') as starts_on
  ) dates
  where NULL::text[] is null
   and (f.status='live' or (
    (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (w.today-7)::text)
    and (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (w.today+interval '1 year')::date::text)
   ))
  union all
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  where NULL::text[] is not null and c.identity_keys && NULL::text[]
 ), candidates as materialized (
  select source_id,fixture_id from scope_keys
  order by source_id,fixture_id limit 5001
 ), source_receipts as materialized (
  select src.source_id,src.discovery_report->'_fixtureObservations' as receipts
  from public.nothingsports_fixture_sources src
  where exists(select 1 from candidates k where k.source_id=src.source_id)
 ), clock_inputs as materialized (
  -- Array order: score fact, base score fact, status fact, base status fact,
  -- score receipt, status receipt. Parse values once; preserve each fallback.
  select k.source_id,k.fixture_id,array[s.score->>'scoreCheckedAt',c.global_fixture->>'scoreCheckedAt',s.score->>'statusCheckedAt',c.global_fixture->>'statusCheckedAt',r.receipts->c.fixture_id->>'s',r.receipts->c.fixture_id->>'t'] raw
  from candidates k join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  join source_receipts r using(source_id)
 ), parsed_clocks as materialized (
  select value,public.nothingsports_fixture_observation_time(value) stamp
  from (select distinct unnest(raw) value from clock_inputs) distinct_values where value is not null
 ), patches as materialized (
  select i.source_id,i.fixture_id,jsonb_build_object(
   'fixtureObservationSchema','fixture-observations.v1',
   'scoreFactObservedAt',coalesce(score_fact.stamp,base_score_fact.stamp),'statusFactObservedAt',coalesce(status_fact.stamp,base_status_fact.stamp),
   'scoreCheckedAt',coalesce(score_receipt.stamp,score_fact.stamp,base_score_fact.stamp),'statusCheckedAt',coalesce(status_receipt.stamp,status_fact.stamp,base_status_fact.stamp)) patch
  from clock_inputs i
  left join parsed_clocks score_fact on score_fact.value=i.raw[1]
  left join parsed_clocks base_score_fact on base_score_fact.value=i.raw[2]
  left join parsed_clocks status_fact on status_fact.value=i.raw[3]
  left join parsed_clocks base_status_fact on base_status_fact.value=i.raw[4]
  left join parsed_clocks score_receipt on score_receipt.value=i.raw[5]
  left join parsed_clocks status_receipt on status_receipt.value=i.raw[6]
 ), projected as not materialized (
  select c.source_id,c.fixture_id,c.identity_keys,
   case when jsonb_typeof(base)='object' and (s.score is null or jsonb_typeof(s.score)='object')
    then base||(coalesce(s.score,'{}'::jsonb)||patch||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end)
    else base||coalesce(s.score,'{}'::jsonb)||patch||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end end fixture
  from candidates k join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  join patches p using(source_id,fixture_id)
  -- Evaluate the compact value once per row without spooling full payloads.
  cross join lateral(select case when NULL::text[] is not null then c.fixture else c.global_fixture end as base offset 0) cleaned
 )
 select json_build_object('schemaVersion','current-fixture-bundle.v1','complete',count(*)<=5000,
  'rows',coalesce(json_agg(row_to_json(projected) order by source_id,fixture_id),'[]'::json)) from projected
) global_query(value);
