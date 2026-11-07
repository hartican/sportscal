-- Restore the unchanged global reader after unsuccessful performance experiments.
CREATE OR REPLACE FUNCTION public.nothingsports_read_current_fixture_bundle(p_fixture_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), candidates as materialized (
  select c.source_id,c.fixture_id,c.fixture,c.identity_keys,s.score,s.first_completed_at,
   src.discovery_report->'_fixtureObservations'->c.fixture_id as receipt
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
 ), projected as (
  select source_id,fixture_id,identity_keys,
   public.nothingsports_project_fixture_observations(
    case when p_fixture_ids is not null then fixture else
     ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
      case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
      case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
       (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end
    end,score,receipt,first_completed_at) as fixture
  from candidates
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','complete',count(*)<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$function$
;
revoke all on function public.nothingsports_read_current_fixture_bundle(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_current_fixture_bundle(text[]) to service_role;

-- One shared reminder scope: nearby clocks, all potentially automatic future rounds,
-- published candidates, nested sporting fixtures and saved decisions.
-- The JS policy remains authoritative; no per-account source request or scheduler is added.
create function public.nothingsports_read_reminder_fixture_bundle(p_required_ids text[] default '{}')
returns jsonb language sql stable security invoker set search_path='' as $$
 with source_receipts as materialized (
  select source_id,discovery_report->'_fixtureObservations' as observations
  from public.nothingsports_fixture_sources
 ), wanted as materialized (
  select unnest(coalesce(p_required_ids,'{}'::text[])) as id
  union select fixture_id from public.nothingsports_reminder_intents where enabled or choice='on'
  union select event_id from public.nothingsports_reminders where dispatched_at is null
 ), clocks as materialized (
  select c.source_id,c.fixture_id,c.identity_keys,
   c.fixture->'isKnockout'='true'::jsonb or c.fixture->'knockout'='true'::jsonb or
   s.score->'isKnockout'='true'::jsonb or s.score->'knockout'='true'::jsonb or
   lower(concat_ws(' ',c.fixture->>'stage',c.fixture->>'round',c.fixture->>'roundLabel',c.fixture->>'stageType',c.fixture->>'drawStage',s.score->>'stage',s.score->>'round',s.score->>'roundLabel',s.score->>'stageType',s.score->>'drawStage')) ~ '(qf|sf|r128|r64|r32|r16|round of|final|knockout|1st|2nd|3rd|4th|first|second|third|fourth)' as potential_round,
   c.fixture ?| array['rubbers','matches','publishedFixtures'] as nested,
   case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.fixture->>'startTimeUtc' end as starts_at
  from public.nothingsports_fixture_current c
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
 ), candidates as materialized (
  select c.source_id,c.fixture_id from clocks c
  where cardinality(coalesce(p_required_ids,'{}'::text[]))<=5000 and (
   c.identity_keys && array(select id from wanted) or c.nested or
   case when c.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
    then case when pg_catalog.pg_input_is_valid(c.starts_at,'timestamptz')
     then (c.starts_at::timestamptz between statement_timestamp()-interval '24 hours' and statement_timestamp()+interval '36 hours')
      or (c.potential_round and c.starts_at::timestamptz > statement_timestamp())
     else false end
    else false end
  )
  order by c.source_id,c.fixture_id limit 5001
 ), projected as (
  select c.source_id,c.fixture_id,c.identity_keys,
   public.nothingsports_project_fixture_observations(
    c.fixture-array['subEvents','editorialNarrative','storyline','fullSpiel','selectedSentence','spiel','fantasyDeadlines'],
    s.score,src.observations->c.fixture_id,s.first_completed_at) as fixture
  from candidates ids join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join source_receipts src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','reminders',
  'requiredIds',coalesce(to_jsonb(p_required_ids),'[]'::jsonb),
  'complete',count(*)<=5000 and cardinality(coalesce(p_required_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$$;
revoke all on function public.nothingsports_read_reminder_fixture_bundle(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_reminder_fixture_bundle(text[]) to service_role;
