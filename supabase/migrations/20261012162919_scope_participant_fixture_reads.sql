-- Add a service-only participant calendar read. Existing global, selected,
-- Match Centre, writer and scheduler owners remain unchanged.
set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle(text[])'::regprocedure)) <> 'ef1658b2eb58a376f368ede88730ad43' or
    md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure)) <> '942edfd41ac47710c03bf78d76af9af7' then
  raise exception 'Fixture readers differ from reviewed baseline; migration refused';
 end if;
 if to_regprocedure('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])') is not null then
  raise exception 'Participant reader already exists; migration refused';
 end if;
end $guard$;

create function public.nothingsports_read_participant_fixture_bundle(
 p_sport_keys text[],p_known_sport_keys text[],p_participant_ids text[],p_required_ids text[] default '{}')
returns jsonb language sql stable security invoker set search_path='' as $$
 with recursive inputs as (
  select cardinality(p_sport_keys) between 1 and 256 and cardinality(p_known_sport_keys) between 1 and 256
   and cardinality(p_participant_ids) between 1 and 1000 and cardinality(coalesce(p_required_ids,'{}'))<=5000
   and not exists(select 1 from unnest(p_sport_keys||p_known_sport_keys||p_participant_ids||coalesce(p_required_ids,'{}')) id where id is null or id !~ '^[-a-zA-Z0-9_:]{1,200}$')
   and p_sport_keys <@ p_known_sport_keys as valid,
   (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), lookup as materialized (
  -- Read lightweight selection fields before extracting large source receipts.
  -- Either raw observation can supply identity even when a later fact clears it.
  select c.source_id,c.fixture_id,c.identity_keys,
   (b.key=any(p_sport_keys) or t.key=any(p_sport_keys) or
    nullif(b.key,'') is null or not b.key=any(p_known_sport_keys) or
    (s.score ? 'key' and (nullif(t.key,'') is null or not t.key=any(p_known_sport_keys))) or
    c.identity_keys && coalesce(p_required_ids,'{}') or
    array[b."homeParticipantId",b."awayParticipantId",t."homeParticipantId",t."awayParticipantId"] && p_participant_ids or
    b."participantIds" ?| p_participant_ids or t."participantIds" ?| p_participant_ids or
    jsonb_path_query_array(b.participants,'$[*].id') ?| p_participant_ids or
    jsonb_path_query_array(b."participantSlots",'$[*].participantId') ?| p_participant_ids or
    jsonb_path_query_array(b."matchupSides",'$[*].players[*].id') ?| p_participant_ids or
    jsonb_path_query_array(t.participants,'$[*].id') ?| p_participant_ids or
    jsonb_path_query_array(t."participantSlots",'$[*].participantId') ?| p_participant_ids or
    jsonb_path_query_array(t."matchupSides",'$[*].players[*].id') ?| p_participant_ids) as wanted,
   case when nullif(f.starts_at,'') is not null and nullif(f.home_id,'') is not null and nullif(f.away_id,'') is not null and f.home_id<>f.away_id
    then least(f.home_id,f.away_id)||'|'||greatest(f.home_id,f.away_id) end as sides
  from public.nothingsports_fixture_current c
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  cross join inputs i
  cross join lateral jsonb_to_record(c.fixture) as b(key text,"startTimeUtc" text,"homeParticipantId" text,"awayParticipantId" text,"participantIds" jsonb,participants jsonb,"participantSlots" jsonb,"matchupSides" jsonb)
  cross join lateral jsonb_to_record(s.score) as t(key text,"startTimeUtc" text,"homeParticipantId" text,"awayParticipantId" text,"participantIds" jsonb,participants jsonb,"participantSlots" jsonb,"matchupSides" jsonb)
  cross join lateral(select case when s.score ? 'startTimeUtc' then t."startTimeUtc" else b."startTimeUtc" end as starts_at,
   case when s.score ? 'homeParticipantId' then t."homeParticipantId" else b."homeParticipantId" end as home_id,
   case when s.score ? 'awayParticipantId' then t."awayParticipantId" else b."awayParticipantId" end as away_id) f
  where i.valid
 ), source_groups as materialized (
  select source_id,bool_or(wanted) as wanted,
   array_agg(distinct id order by id) filter(where id is not null) as identities,
   array_agg(distinct sides order by sides) filter(where sides is not null) as sides
  from lookup left join lateral unnest(identity_keys) id on true group by source_id
 ), related_sources(source_id,identities,sides) as (
  select source_id,identities,sides from source_groups where wanted
  union
  select g.source_id,g.identities,g.sides from source_groups g join related_sources r
   on g.identities && r.identities or g.sides && r.sides
 ), protected_rows(source_id,fixture_id,identity_keys,sides) as (
  -- Retain alias/semantic context for requested corrections even when a new
  -- observation moves the fixture beyond its previously published horizon.
  select source_id,fixture_id,identity_keys,sides from lookup
  where identity_keys && coalesce(p_required_ids,'{}')
  union
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from lookup l
  join protected_rows p on l.identity_keys && p.identity_keys or l.sides=p.sides
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
  'complete',coalesce((select valid from inputs),false) and count(*)<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$$;
revoke all on function public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[]) to service_role;
