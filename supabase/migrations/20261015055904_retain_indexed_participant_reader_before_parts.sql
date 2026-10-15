set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure))<>'bbff86aff03204a2b66be67fab4533ae' then
  raise exception 'Participant reader differs from rejected clock map; restoration refused';
 end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.nothingsports_read_participant_fixture_bundle(p_sport_keys text[], p_known_sport_keys text[], p_participant_ids text[], p_required_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with recursive inputs as (
  select cardinality(p_sport_keys) between 1 and 256 and cardinality(p_known_sport_keys) between 1 and 256
   and cardinality(p_participant_ids) between 1 and 1000 and cardinality(coalesce(p_required_ids,'{}'))<=5000
   and not exists(select 1 from unnest(p_sport_keys||p_known_sport_keys||p_participant_ids||coalesce(p_required_ids,'{}')) id where id is null or id !~ '^[-a-zA-Z0-9_:]{1,200}$')
   and p_sport_keys <@ p_known_sport_keys as valid,
   not exists(select 1 from public.nothingsports_fixture_current c left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id) where ctx.fixture_id is null or ctx.shape_version<>1)
   and not exists(
    select 1 from nothingsports_fixture_read_private.fixture_context c
    cross join lateral(select 1::smallint kind,id token from unnest(c.identity_keys) id where id is not null
     union all select 2::smallint,c.sides where c.sides is not null) expected
    where not exists(select 1 from nothingsports_fixture_read_private.fixture_tokens t
     where t.source_id=c.source_id and t.fixture_id=c.fixture_id and t.kind=expected.kind and t.token=expected.token))
   and not exists(
    select 1 from nothingsports_fixture_read_private.fixture_tokens t
    join nothingsports_fixture_read_private.fixture_context c using(source_id,fixture_id)
    where not coalesce((t.kind=1 and t.token=any(c.identity_keys)) or (t.kind=2 and t.token=c.sides),false))
   and not exists(
    select 1 from nothingsports_fixture_read_private.fixture_tokens t
    where not exists(select 1 from nothingsports_fixture_read_private.source_tokens s
     where s.source_id=t.source_id and s.kind=t.kind and s.token=t.token))
   and not exists(
    select 1 from nothingsports_fixture_read_private.source_tokens s
    where not exists(select 1 from nothingsports_fixture_read_private.fixture_tokens t
     where t.source_id=s.source_id and t.kind=s.kind and t.token=s.token)) as metadata_ready,
   (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), related_sources(source_id) as (
 select distinct c.source_id from nothingsports_fixture_read_private.fixture_context c cross join inputs i where i.valid and i.metadata_ready and (
 c.base_key=any(p_sport_keys) or c.score_key=any(p_sport_keys) or nullif(c.base_key,'') is null or not c.base_key=any(p_known_sport_keys) or
 (c.has_score_key and (nullif(c.score_key,'') is null or not c.score_key=any(p_known_sport_keys))) or
 c.identity_keys && coalesce(p_required_ids,'{}') or c.participant_ids && p_participant_ids)
 union
 select other.source_id from related_sources r join nothingsports_fixture_read_private.source_tokens seed using(source_id)
 join nothingsports_fixture_read_private.source_tokens other on other.kind=seed.kind and other.token=seed.token
 ), protected_rows(source_id,fixture_id) as (
 select c.source_id,c.fixture_id from nothingsports_fixture_read_private.fixture_context c where c.identity_keys && coalesce(p_required_ids,'{}')
 union
 select other.source_id,other.fixture_id from protected_rows p join nothingsports_fixture_read_private.fixture_tokens seed using(source_id,fixture_id)
 join nothingsports_fixture_read_private.fixture_tokens other on other.kind=seed.kind and other.token=seed.token
 ), candidates as materialized (
  select c.source_id,c.fixture_id,c.fixture,c.identity_keys,s.score,s.first_completed_at
  from related_sources r join public.nothingsports_fixture_current c using(source_id)
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  left join protected_rows protected using(source_id,fixture_id)
  cross join inputs i
  cross join lateral(select case when s.score ? 'status' then s.score->>'status' else c.fixture->>'status' end as status,
   case when s.score ? 'endDate' then s.score->>'endDate' else c.fixture->>'endDate' end as end_date,
   case when s.score ? 'date' then s.score->>'date' else c.fixture->>'date' end as date,
   case when s.score ? 'startDate' then s.score->>'startDate' else c.fixture->>'startDate' end as start_date,
   case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.fixture->'schedulingWindow' end as scheduling_window) f
  cross join lateral(select coalesce(nullif(f.end_date,''),nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'endsOn','') as ends_on,
   coalesce(nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'startsOn','') as starts_on) dates
  where protected.source_id is not null or f.status='live' or (
   (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (i.today-7)::text) and
   (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (i.today+interval '1 year')::date::text))
  order by c.source_id,c.fixture_id limit 5001
 ), receipts as materialized (
  select src.source_id,r.key as fixture_id,r.value as receipt from public.nothingsports_fixture_sources src
  join (select distinct source_id from candidates) needed using(source_id)
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), projected as (
  select c.source_id,c.fixture_id,c.identity_keys,public.nothingsports_project_fixture_observations(
   ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
    case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
    case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
     (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end,
   score,r.receipt,first_completed_at) as fixture from candidates c left join receipts r using(source_id,fixture_id)
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','participants',
  'sportKeys',to_jsonb(p_sport_keys),'knownSportKeys',to_jsonb(p_known_sport_keys),'participantIds',to_jsonb(p_participant_ids),'requiredIds',coalesce(to_jsonb(p_required_ids),'[]'::jsonb),
  'complete',coalesce((select valid and metadata_ready from inputs),false) and count(*)<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$function$;
