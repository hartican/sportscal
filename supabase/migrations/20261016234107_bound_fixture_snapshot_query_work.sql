set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$ begin
 if md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure))<>'d98d88497311a8d06a31556004df30a2' or
    md5(pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure))<>'8071c1ba3e6712a57a1c6b30c2cc6b9b' then
  raise exception 'Fixture readers differ from reviewed baseline; bounded query-work repair refused';
 end if;
end $guard$;
-- Compute the same scalar selection once, before filtering. Returned facts,
-- statement clocks, full context closure and completeness limits are unchanged.
CREATE OR REPLACE FUNCTION public.nothingsports_read_match_centre_fixture_bundle(p_membership_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with recursive index_state as materialized (
  select not exists(select 1 from nothingsports_fixture_read_private.integrity_pending) and not exists(
   select 1 from public.nothingsports_fixture_current c left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id) where ctx.source_id is null) as ready
 ), active_window as (
  select statement_timestamp() as observed_at,
   statement_timestamp()+interval '31 minutes' as through,
   statement_timestamp()-interval '65 minutes' as since
 ), seed_inputs as materialized (
  select c.source_id,c.fixture_id,c.identity_keys,s.first_completed_at,f.status,f.starts_at,f.actual_end,f.completed_at,f.first_confirmed,f.result_published,
   s.score->>'statusCheckedAt' as score_status_checked_at,c.fixture->>'statusCheckedAt' as base_status_checked_at
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s on s.source_id=c.source_id and s.fixture_id=c.fixture_id
  left join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
  cross join lateral (
   select
    case when ctx.base_selection?'calendarWindow' and ctx.score_selection?'calendarWindow' then case when (ctx.score_selection->'calendarWindow'->>'hasStatus')::boolean then ctx.score_selection->'calendarWindow'->>'status' else ctx.base_selection->'calendarWindow'->>'status' end else case when s.score ? 'status' then s.score->>'status' else c.fixture->>'status' end end as status,
    case when ctx.source_id is not null then case when (ctx.score_selection->>'hasStart')::boolean then ctx.score_selection->>'starts' else ctx.base_selection->>'starts' end else case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.fixture->>'startTimeUtc' end end as starts_at,
    case when s.score ? 'actualEndTimeUtc' then s.score->>'actualEndTimeUtc' else c.fixture->>'actualEndTimeUtc' end as actual_end,
    case when s.score ? 'completedAt' then s.score->>'completedAt' else c.fixture->>'completedAt' end as completed_at,
    case when s.score ? 'firstConfirmedCompleteAt' then s.score->>'firstConfirmedCompleteAt' else c.fixture->>'firstConfirmedCompleteAt' end as first_confirmed,
    case when s.score ? 'resultPublishedAt' then s.score->>'resultPublishedAt' else c.fixture->>'resultPublishedAt' end as result_published
  ) f
 ), seeds as materialized (
  select c.source_id,c.fixture_id from seed_inputs c cross join active_window w
  where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and (
   c.identity_keys && coalesce(p_membership_ids,'{}'::text[]) or
   c.status in('live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing') or
   (c.status in('scheduled','upcoming') and
    nullif(c.starts_at,'') is not null and
    case when c.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(c.starts_at,'timestamptz')
    then c.starts_at::timestamptz between w.observed_at and w.through else true end) or
   (c.status in('completed','finished','final') and (
    c.first_completed_at>=w.since or
    exists (
     select 1 from unnest(array[c.actual_end,c.completed_at,c.first_confirmed,
      c.result_published,c.score_status_checked_at,c.base_status_checked_at]) mark(value)
     where nullif(value,'') is not null and
      case when value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(value,'timestamptz')
       then value::timestamptz>=w.since else true end
    )
   ))
  )
  order by c.source_id,c.fixture_id limit 5001
 ), lookup as materialized (
  -- Keep this lookup small: no source receipt or fixture payload is decoded.
  -- Same-sided timed records may carry metadata joined by the JS model.
  -- Preserve possible context without duplicating its date/identity rules.
  select c.source_id,c.fixture_id,c.identity_keys,
   case when nullif(f.starts_at,'') is not null and nullif(f.home_id,'') is not null and nullif(f.away_id,'') is not null and f.home_id<>f.away_id
    then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)] else null end as sides,
   nullif(f.starts_at,'') is not null and not coalesce(f.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(f.starts_at,'timestamptz'),false) as uncertain_clock
  from public.nothingsports_fixture_current c
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  left join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
  cross join lateral (select case when ctx.source_id is not null then case when (ctx.score_selection->>'hasStart')::boolean then ctx.score_selection->>'starts' else ctx.base_selection->>'starts' end else case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.fixture->>'startTimeUtc' end end as starts_at,
   case when ctx.source_id is not null then case when (ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home' else ctx.base_selection->>'home' end else case when s.score ? 'homeParticipantId' then s.score->>'homeParticipantId' else c.fixture->>'homeParticipantId' end end as home_id,
   case when ctx.source_id is not null then case when (ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away' else ctx.base_selection->>'away' end else case when s.score ? 'awayParticipantId' then s.score->>'awayParticipantId' else c.fixture->>'awayParticipantId' end end as away_id) f
 ), related_rows(source_id,fixture_id,identity_keys,sides) as (
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from lookup l
  where exists(select 1 from seeds seed where seed.source_id=l.source_id and seed.fixture_id=l.fixture_id)
   or (l.uncertain_clock and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000)
  union
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from related_rows r
  cross join index_state idx
  cross join lateral (
   select ctx.source_id,ctx.fixture_id,ctx.identity_keys,
    case when ctx.sides is not null then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)] else null end as sides
   from nothingsports_fixture_read_private.fixture_tokens seed
   join nothingsports_fixture_read_private.fixture_tokens other on other.kind=seed.kind and other.token=seed.token
   join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=other.source_id and ctx.fixture_id=other.fixture_id
   cross join lateral(select
    case when (ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home' else ctx.base_selection->>'home' end home_id,
    case when (ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away' else ctx.base_selection->>'away' end away_id) f
   where idx.ready and seed.source_id=r.source_id and seed.fixture_id=r.fixture_id
   union
   select raw.source_id,raw.fixture_id,raw.identity_keys,raw.sides from lookup raw where not idx.ready and (raw.identity_keys && r.identity_keys or raw.sides=r.sides)
  ) l
  where l.identity_keys && r.identity_keys or l.sides=r.sides
 ), candidates as materialized (
  -- A score-only source can need another source's names, sides or venue.
  -- Traverse declared aliases and conservative same-sided context. The JS
  -- merger still owns whether records describe the same fixture.
  select c.source_id,c.fixture_id,c.fixture,c.identity_keys,s.score,s.first_completed_at
  from related_rows r
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  order by c.source_id,c.fixture_id limit 5001
 ), receipts as materialized (
  select src.source_id,r.key as fixture_id,r.value as receipt
  from public.nothingsports_fixture_sources src
  join (select distinct source_id from candidates) needed using(source_id)
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), projected as (
  select c.source_id,c.fixture_id,c.identity_keys,
   public.nothingsports_project_fixture_observations(
    ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
     case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
     case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
      (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end,
    score,r.receipt,first_completed_at) as fixture
  from candidates c left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','match-centre',
  'complete',count(*)<=5000 and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$function$;


CREATE OR REPLACE FUNCTION public.nothingsports_read_participant_fixture_bundle(p_sport_keys text[], p_known_sport_keys text[], p_participant_ids text[], p_required_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with recursive integrity_context as materialized (
  select source_id,fixture_id,identity_keys,sides,shape_version from nothingsports_fixture_read_private.fixture_context
 ), integrity_tokens as materialized (
  select source_id,fixture_id,kind,token from nothingsports_fixture_read_private.fixture_tokens
 ), expected_tokens as materialized (
  select c.source_id,c.fixture_id,w.kind,w.token from integrity_context c
  cross join lateral(select 1::smallint kind,id token from unnest(c.identity_keys) id where id is not null
   union all select 2::smallint,c.sides where c.sides is not null) w
 ), expected_sources as materialized (
  select distinct source_id,kind,token from integrity_tokens
 ), inputs as (
  select cardinality(p_sport_keys) between 1 and 256 and cardinality(p_known_sport_keys) between 1 and 256
   and cardinality(p_participant_ids) between 1 and 1000 and cardinality(coalesce(p_required_ids,'{}'))<=5000
   and not exists(select 1 from unnest(p_sport_keys||p_known_sport_keys||p_participant_ids||coalesce(p_required_ids,'{}')) id where id is null or id !~ '^[-a-zA-Z0-9_:]{1,200}$')
   and p_sport_keys <@ p_known_sport_keys as valid,
   not exists(
    select source_id,fixture_id from public.nothingsports_fixture_current
    except select source_id,fixture_id from integrity_context where shape_version is null or shape_version=1)
   and not exists(
    select source_id,fixture_id,kind,token from expected_tokens
    except select source_id,fixture_id,kind,token from integrity_tokens)
   and not exists(
    select t.source_id,t.fixture_id,t.kind,t.token from integrity_tokens t join integrity_context c using(source_id,fixture_id)
    except select source_id,fixture_id,kind,token from expected_tokens)
   and not exists(
    select source_id,kind,token from expected_sources
    except select source_id,kind,token from nothingsports_fixture_read_private.source_tokens)
   and not exists(
    select source_id,kind,token from nothingsports_fixture_read_private.source_tokens
    except select source_id,kind,token from expected_sources) as metadata_ready,
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
 ), calendar_inputs as materialized (
  select c.source_id,c.fixture_id,protected.source_id is not null as protected,
   i.today,f.status,dates.ends_on,dates.starts_on
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
 ), candidates as materialized (
  select c.source_id,c.fixture_id from calendar_inputs c
  where c.protected or c.status='live' or (
   (c.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or c.ends_on >= (c.today-7)::text) and
   (c.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or c.starts_on <= (c.today+interval '1 year')::date::text))
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
   score,r.receipt,first_completed_at) as fixture from candidates selected join public.nothingsports_fixture_current c using(source_id,fixture_id)
   left join public.nothingsports_live_scores s using(source_id,fixture_id) left join receipts r using(source_id,fixture_id)
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','participants',
  'sportKeys',to_jsonb(p_sport_keys),'knownSportKeys',to_jsonb(p_known_sport_keys),'participantIds',to_jsonb(p_participant_ids),'requiredIds',coalesce(to_jsonb(p_required_ids),'[]'::jsonb),
  'complete',coalesce((select valid and metadata_ready from inputs),false) and count(*)<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$function$;

-- Replacing bodies must retain the existing private service boundary and all
-- other readers. No new RPC, caller, cache, source, table or planner setting.
do $guard$ declare f record;begin
 for f in select p.* from pg_proc p where p.oid in (
  'public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure,
  'public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure) loop
  if f.prosecdef or f.provolatile<>'s' or f.proconfig<>array['search_path=""']::text[] or
     f.proacl::text<>'{postgres=X/postgres,service_role=X/postgres}' then
   raise exception 'Fixture reader service boundary changed; repair refused';
  end if;
 end loop;
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle(text[])'::regprocedure))<>'ef1658b2eb58a376f368ede88730ad43' or
    md5(pg_get_functiondef('public.nothingsports_read_current_fixtures(text[])'::regprocedure))<>'8f7e452c8a96f15ed11b50b4ea5cb751' then
  raise exception 'Unrelated fixture reader changed; repair refused';
 end if;
end $guard$;
