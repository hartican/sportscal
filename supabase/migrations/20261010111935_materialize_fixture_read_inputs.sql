-- Decode source receipt maps and effective retention fields once per shared read.
-- Facts, observation clocks, selected context, horizon and completeness remain identical.
create or replace function public.nothingsports_read_current_fixture_bundle(p_fixture_ids text[] default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
with active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), receipts as materialized (
  select src.source_id, r.key as fixture_id, r.value as receipt
  from public.nothingsports_fixture_sources src
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), fields as materialized (
  select c.source_id,c.fixture_id,c.fixture,c.identity_keys,s.score,s.first_completed_at,
    case when s.score ? 'status' then s.score->>'status' else c.fixture->>'status' end as status,
    case when s.score ? 'endDate' then s.score->>'endDate' else c.fixture->>'endDate' end as end_date,
    case when s.score ? 'date' then s.score->>'date' else c.fixture->>'date' end as date,
    case when s.score ? 'startDate' then s.score->>'startDate' else c.fixture->>'startDate' end as start_date,
    case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.fixture->'schedulingWindow' end as scheduling_window
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  where p_fixture_ids is null or c.identity_keys && p_fixture_ids
 ), candidates as materialized (
  select c.source_id,c.fixture_id,c.fixture,c.identity_keys,c.score,c.first_completed_at,r.receipt
  from fields c
  left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
  cross join active_window w
  cross join lateral (
   select coalesce(nullif(c.end_date,''),nullif(c.date,''),nullif(c.start_date,''),c.scheduling_window->>'endsOn','') as ends_on,
    coalesce(nullif(c.date,''),nullif(c.start_date,''),c.scheduling_window->>'startsOn','') as starts_on
  ) dates
  where (p_fixture_ids is null or c.identity_keys && p_fixture_ids)
   and (p_fixture_ids is not null or c.status='live' or (
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
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected
$$;
revoke all on function public.nothingsports_read_current_fixture_bundle(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_current_fixture_bundle(text[]) to service_role;
