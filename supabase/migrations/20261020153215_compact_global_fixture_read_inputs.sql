-- Keep only keys in the bounded candidate set, extract each source receipt map
-- once, and finish compact projection before ordered aggregation. Sporting facts,
-- filters, observation clocks, the 5001 sentinel and service-only rights are exact.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json(text[])'::regprocedure)) is distinct from 'a15bc809eaf15601a52855cb667f7b9f'
 or md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json_rows(text[])'::regprocedure)) is distinct from '08bdbca1af4b203b53a815e6ca600159'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54'
 or md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9' then
  raise exception 'Global JSON inputs differ from reviewed baseline; compact read refused';
 end if;
 if has_function_privilege('anon','public.nothingsports_read_current_fixture_bundle_json(text[])','EXECUTE')
 or has_function_privilege('authenticated','public.nothingsports_read_current_fixture_bundle_json(text[])','EXECUTE')
 or not has_function_privilege('service_role','public.nothingsports_read_current_fixture_bundle_json(text[])','EXECUTE')
 or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='public.nothingsports_read_current_fixture_bundle_json(text[])'::regprocedure
   and a.privilege_type='EXECUTE' and a.grantee not in (p.proowner,(select oid from pg_roles where rolname='service_role'))) then
  raise exception 'Global JSON permissions differ from service-only baseline; compact read refused';
 end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.nothingsports_read_current_fixture_bundle_json(p_fixture_ids text[] DEFAULT NULL::text[])
RETURNS json LANGUAGE sql STABLE SET search_path TO ''
AS $function$
 with active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), candidates as materialized (
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  cross join active_window w
  cross join lateral (
   select
    case when s.score ? 'status' then s.score->>'status' else c.fixture->>'status' end as status,
    case when s.score ? 'endDate' then s.score->>'endDate' else c.fixture->>'endDate' end as end_date,
    case when s.score ? 'date' then s.score->>'date' else c.fixture->>'date' end as date,
    case when s.score ? 'startDate' then s.score->>'startDate' else c.fixture->>'startDate' end as start_date,
    case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.fixture->'schedulingWindow' end as scheduling_window
  ) f
  cross join lateral (
   select coalesce(nullif(f.end_date,''),nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'endsOn','') as ends_on,
    coalesce(nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'startsOn','') as starts_on
  ) dates
  where (p_fixture_ids is null or c.identity_keys && p_fixture_ids)
   and (p_fixture_ids is not null or f.status='live' or (
    (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (w.today-7)::text)
    and (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (w.today+interval '1 year')::date::text)
   ))
  order by c.source_id,c.fixture_id limit 5001
 ), source_receipts as materialized (
  select src.source_id,src.discovery_report->'_fixtureObservations' as receipts
  from public.nothingsports_fixture_sources src
  where exists(select 1 from candidates k where k.source_id=src.source_id)
 ), projected as materialized (
  select k.source_id,k.fixture_id,c.identity_keys,
   public.nothingsports_project_fixture_observations(
    case when p_fixture_ids is not null then c.fixture else
     ((c.fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
      case when c.fixture->>'kind' in('tournament','major-event','event-card') or c.fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
      case when jsonb_typeof(c.fixture->'storyline')='object' then jsonb_build_object('storyline',
       (c.fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end
    end,s.score,r.receipts->c.fixture_id,s.first_completed_at) as fixture
  from candidates k
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  join source_receipts r using(source_id)
 )
 select json_build_object('schemaVersion','current-fixture-bundle.v1','complete',count(*)<=5000,
  'rows',coalesce(json_agg(row_to_json(projected) order by source_id,fixture_id),'[]'::json)) from projected;
$function$;
