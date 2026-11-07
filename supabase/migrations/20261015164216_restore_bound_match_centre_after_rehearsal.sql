set local lock_timeout='2s';set local statement_timeout='8s';do $guard$ begin if md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure))<>'78b96084738778c548a40af8d2fab1c8' then raise exception 'Unexpected Match Centre reader; rollback refused';end if;end $guard$;
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
 ), seeds as materialized (
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s on s.source_id=c.source_id and s.fixture_id=c.fixture_id
  left join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
  cross join active_window w
  cross join lateral (
   select
    case when ctx.base_selection?'calendarWindow' and ctx.score_selection?'calendarWindow' then case when (ctx.score_selection->'calendarWindow'->>'hasStatus')::boolean then ctx.score_selection->'calendarWindow'->>'status' else ctx.base_selection->'calendarWindow'->>'status' end else case when s.score ? 'status' then s.score->>'status' else c.fixture->>'status' end end as status,
    case when ctx.source_id is not null then case when (ctx.score_selection->>'hasStart')::boolean then ctx.score_selection->>'starts' else ctx.base_selection->>'starts' end else case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.fixture->>'startTimeUtc' end end as starts_at,
    case when s.score ? 'actualEndTimeUtc' then s.score->>'actualEndTimeUtc' else c.fixture->>'actualEndTimeUtc' end as actual_end,
    case when s.score ? 'completedAt' then s.score->>'completedAt' else c.fixture->>'completedAt' end as completed_at,
    case when s.score ? 'firstConfirmedCompleteAt' then s.score->>'firstConfirmedCompleteAt' else c.fixture->>'firstConfirmedCompleteAt' end as first_confirmed,
    case when s.score ? 'resultPublishedAt' then s.score->>'resultPublishedAt' else c.fixture->>'resultPublishedAt' end as result_published
  ) f
  where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and (
   c.identity_keys && coalesce(p_membership_ids,'{}'::text[]) or
   f.status in('live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing') or
   (f.status in('scheduled','upcoming') and
    nullif(f.starts_at,'') is not null and
    case when f.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(f.starts_at,'timestamptz')
    then f.starts_at::timestamptz between w.observed_at and w.through else true end) or
   (f.status in('completed','finished','final') and (
    s.first_completed_at>=w.since or
    exists (
     select 1 from unnest(array[f.actual_end,f.completed_at,f.first_confirmed,
      f.result_published,s.score->>'statusCheckedAt',c.fixture->>'statusCheckedAt']) mark(value)
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

