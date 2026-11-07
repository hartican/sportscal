-- Check a trustworthy distant upcoming clock before the more expensive date predicates.
-- Preserve uncertain clocks, protected corrections, source receipts and the existing budgets.
-- Everything needs current observations, not a year of future schedules.
-- Retain corrective updates for known members, all non-upcoming states and
-- uncertain clocks. The browser/server model still decides actual membership.
create or replace function public.nothingsports_read_match_centre_fixture_bundle(p_membership_ids text[] default '{}')
returns jsonb language sql stable security invoker set search_path = '' as $$
 with active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today,
   statement_timestamp()+interval '31 minutes' as through
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
    case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.fixture->>'startTimeUtc' end as starts_at,
    case when s.score ? 'endDate' then s.score->>'endDate' else c.fixture->>'endDate' end as end_date,
    case when s.score ? 'date' then s.score->>'date' else c.fixture->>'date' end as date,
    case when s.score ? 'startDate' then s.score->>'startDate' else c.fixture->>'startDate' end as start_date,
    case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.fixture->'schedulingWindow' end as scheduling_window
  ) f
  cross join lateral (
   select coalesce(nullif(f.end_date,''),nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'endsOn','') as ends_on,
    coalesce(nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'startsOn','') as starts_on
  ) dates
  where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and (
   c.identity_keys && coalesce(p_membership_ids,'{}'::text[]) or
   -- CASE preserves this evaluation order: skip a known distant upcoming
   -- clock before repeatedly extracting dates from potentially large JSON.
   case when (
    case when f.status in ('scheduled','upcoming') and
     f.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
    then case when pg_catalog.pg_input_is_valid(f.starts_at,'timestamptz')
     then f.starts_at::timestamptz>w.through else false end
    else false end
   ) then false else (
    f.status='live' or (
     (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (w.today-7)::text)
     and (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (w.today+interval '1 year')::date::text)
    )
   ) end
  )
  order by c.source_id,c.fixture_id limit 5001
 ), projected as (
  select source_id,fixture_id,identity_keys,
   public.nothingsports_project_fixture_observations(
    ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
     case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
     case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
      (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end,
    score,receipt,first_completed_at) as fixture
  from candidates
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','match-centre',
  'complete',count(*)<=5000 and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$$;
revoke all on function public.nothingsports_read_match_centre_fixture_bundle(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_match_centre_fixture_bundle(text[]) to service_role;
