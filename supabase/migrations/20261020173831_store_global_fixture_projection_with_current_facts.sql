-- Store only the existing compact base beside its canonical current fixture.
-- Generated storage updates atomically with the same INSERT/UPDATE owner. It
-- contains no wall clock, membership, live overlay or freshness calculation.
-- Original fixture/identity/hash/clock columns and all writer functions remain.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$
declare signature text;
begin
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json(text[])'::regprocedure)) is distinct from 'a91f9bc32b11190240bba20ff0870bd8'
 or md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json_rows(text[])'::regprocedure)) is distinct from '54b7e2b79b51e77432f48403c8a9c4c3'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54'
 or md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9' then
  raise exception 'Global JSON inputs differ from reviewed baseline; stored global projection refused';
 end if;
 foreach signature in array array[
  'public.nothingsports_read_current_fixture_bundle_json(text[])',
  'public.nothingsports_read_current_fixture_bundle_json_rows(text[])'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE')
  or has_function_privilege('authenticated',signature,'EXECUTE')
  or not has_function_privilege('service_role',signature,'EXECUTE')
  or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   where p.oid=signature::regprocedure and a.privilege_type='EXECUTE'
    and a.grantee not in(p.proowner,(select oid from pg_roles where rolname='service_role'))) then
   raise exception 'Global JSON permissions differ from service-only baseline; stored global projection refused';
  end if;
 end loop;
 if exists(select 1 from pg_attribute where attrelid='public.nothingsports_fixture_current'::regclass and attname='global_fixture' and not attisdropped) then
  raise exception 'Stored global projection already exists; migration refused';
 end if;
 if not exists(select 1 from pg_class where oid='public.nothingsports_fixture_current'::regclass and relrowsecurity and relforcerowsecurity)
 or has_table_privilege('anon','public.nothingsports_fixture_current','SELECT')
 or has_table_privilege('authenticated','public.nothingsports_fixture_current','SELECT')
 or not has_table_privilege('service_role','public.nothingsports_fixture_current','SELECT') then
  raise exception 'Current fixture table permissions differ from private baseline; stored global projection refused';
 end if;
 -- Keep a conservative existing-capacity allowance; no automatic plan upgrade.
 if pg_database_size(current_database())+2*pg_total_relation_size('public.nothingsports_fixture_current')+33554432>450000000 then
  raise exception 'Stored projection capacity allowance exceeded; migration refused';
 end if;
end $guard$;
alter table public.nothingsports_fixture_current add column global_fixture jsonb generated always as (
 ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
  case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
 case when jsonb_typeof(fixture->'storyline')='object' then
  jsonb_set('{}'::jsonb,'{storyline}',(fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn'],true)
 else '{}'::jsonb end
) stored;
CREATE OR REPLACE FUNCTION public.nothingsports_read_current_fixture_bundle_json_rows(p_fixture_ids text[] DEFAULT NULL::text[])
RETURNS SETOF json LANGUAGE sql STABLE ROWS 1 SET search_path TO ''
AS $function$
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
  where p_fixture_ids is null
   and (f.status='live' or (
    (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (w.today-7)::text)
    and (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (w.today+interval '1 year')::date::text)
   ))
  union all
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  where p_fixture_ids is not null and c.identity_keys && p_fixture_ids
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
 ), projected as materialized (
  select c.source_id,c.fixture_id,c.identity_keys,
   case when jsonb_typeof(base)='object' and (s.score is null or jsonb_typeof(s.score)='object')
    then base||(coalesce(s.score,'{}'::jsonb)||patch||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end)
    else base||coalesce(s.score,'{}'::jsonb)||patch||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end end fixture
  from candidates k join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  join patches p using(source_id,fixture_id)
  -- Evaluate the compact value once per row without spooling full payloads.
  cross join lateral(select case when p_fixture_ids is not null then c.fixture else c.global_fixture end as base offset 0) cleaned
 )
 select json_build_object('schemaVersion','current-fixture-bundle.v1','complete',count(*)<=5000,
  'rows',coalesce(json_agg(row_to_json(projected) order by source_id,fixture_id),'[]'::json)) from projected;
$function$;
