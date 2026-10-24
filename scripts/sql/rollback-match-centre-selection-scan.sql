-- Restore exact reviewed D9 reader; DEPLOY-only guarded rollback.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure)) is distinct from '2b77bfdd5e17d2ceb0737ea53221a4d9' then
  raise exception 'Shared Match Centre selection reader differs from reviewed rollback baseline';
 end if;
 if has_function_privilege('anon','public.nothingsports_read_match_centre_fixture_bundle(text[])','EXECUTE')
 or has_function_privilege('authenticated','public.nothingsports_read_match_centre_fixture_bundle(text[])','EXECUTE')
 or not has_function_privilege('service_role','public.nothingsports_read_match_centre_fixture_bundle(text[])','EXECUTE')
 or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure and a.privilege_type='EXECUTE'
  and a.grantee not in(p.proowner,(select oid from pg_roles where rolname='service_role'))) then
  raise exception 'Shared Match Centre selection permissions differ';
 end if;
end $guard$;
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
  select c.source_id,c.fixture_id,c.identity_keys,s.first_completed_at,f.status,f.starts_at,
   case when f.status in('completed','finished','final','cancelled','canceled','abandoned') and
    (s.first_completed_at>=statement_timestamp()-interval '65 minutes') is not true then
    array[case when s.score ? 'actualEndTimeUtc' then s.score->>'actualEndTimeUtc' else b."actualEndTimeUtc" end,
     case when s.score ? 'completedAt' then s.score->>'completedAt' else b."completedAt" end,
     case when s.score ? 'firstConfirmedCompleteAt' then s.score->>'firstConfirmedCompleteAt' else b."firstConfirmedCompleteAt" end,
     case when s.score ? 'resultPublishedAt' then s.score->>'resultPublishedAt' else b."resultPublishedAt" end,
     s.score->>'statusCheckedAt',b."statusCheckedAt"] else null end as completion_marks
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s on s.source_id=c.source_id and s.fixture_id=c.fixture_id
  left join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
  cross join lateral (
   select
    case when ctx.base_selection?'calendarWindow' and ctx.score_selection?'calendarWindow' then case when (ctx.score_selection->'calendarWindow'->>'hasStatus')::boolean then ctx.score_selection->'calendarWindow'->>'status' else ctx.base_selection->'calendarWindow'->>'status' end else case when s.score ? 'status' then s.score->>'status' else c.global_fixture->>'status' end end as status,
    case when ctx.source_id is not null then case when (ctx.score_selection->>'hasStart')::boolean then ctx.score_selection->>'starts' else ctx.base_selection->>'starts' end else case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.global_fixture->>'startTimeUtc' end end as starts_at
  ) f
  cross join lateral jsonb_to_record(case when f.status in('completed','finished','final','cancelled','canceled','abandoned') and
   (s.first_completed_at>=statement_timestamp()-interval '65 minutes') is not true and jsonb_typeof(c.global_fixture)='object'
   then c.global_fixture else '{}'::jsonb end) b("actualEndTimeUtc" text,"completedAt" text,"firstConfirmedCompleteAt" text,"resultPublishedAt" text,"statusCheckedAt" text)
 ), seeds as materialized (
  select c.source_id,c.fixture_id from seed_inputs c cross join active_window w
  where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and (
   c.identity_keys && coalesce(p_membership_ids,'{}'::text[]) or
   c.status in('live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing') or
   (c.status in('scheduled','upcoming') and
    nullif(c.starts_at,'') is not null and
    case when c.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(c.starts_at,'timestamptz')
    then c.starts_at::timestamptz between w.observed_at and w.through else true end) or
   (c.status in('completed','finished','final','cancelled','canceled','abandoned') and (
    c.first_completed_at>=w.since or
    exists (
     select 1 from unnest(c.completion_marks) mark(value)
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
  -- Keep complete context selection and its sentinel, but sort/store keys only.
  select c.source_id,c.fixture_id
  from related_rows r
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join public.nothingsports_fixture_sources src using(source_id)
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
  from candidates selected
  cross join lateral (
   -- Parameterised primary-key projection prevents a recursive row estimate
   -- from hashing every wide fixture. OFFSET0 preserves the lookup boundary.
   select base.source_id,base.fixture_id,base.fixture,base.identity_keys,s.score,s.first_completed_at
   from public.nothingsports_fixture_current base
   left join public.nothingsports_live_scores s using(source_id,fixture_id)
   where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id
   offset 0
  ) c
  left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','match-centre',
  'complete',count(*)<=5000 and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$function$
;
