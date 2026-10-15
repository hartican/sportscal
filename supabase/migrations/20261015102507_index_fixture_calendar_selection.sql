set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$ begin
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.selection_fields(jsonb)'::regprocedure))<>'d45c30bffe67e1be8779cc33dfedd2ce' or
 md5(pg_get_functiondef('public.nothingsports_read_fixture_bundle_part(text,integer,text[],text[],text[],text[])'::regprocedure))<>'68ba8a67492cadfc1b6495919e8a6982' then
  raise exception 'Fixture selection differs from reviewed baseline; calendar index refused';
 end if;
end $guard$;
-- Selection descriptors only: no returned sporting facts or observation clocks.
-- Existing canonical sync hooks own updates. Missing descriptors use raw facts,
-- so staged preparation cannot remove a global or participant candidate.
create function nothingsports_fixture_read_private.window_fields(v jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $window$
 select jsonb_build_object(
  'hasStatus',v?'status','status',v->>'status',
  'hasEndDate',v?'endDate','endDate',v->>'endDate',
  'hasDate',v?'date','date',v->>'date',
  'hasStartDate',v?'startDate','startDate',v->>'startDate',
  'hasSchedulingWindow',v?'schedulingWindow','schedulingWindow',v->'schedulingWindow');
$window$;
revoke all on function nothingsports_fixture_read_private.window_fields(jsonb) from public,anon,authenticated;
grant execute on function nothingsports_fixture_read_private.window_fields(jsonb) to service_role;
create or replace function nothingsports_fixture_read_private.selection_fields(v jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('key',b.key,'starts',b."startTimeUtc",'home',b."homeParticipantId",'away',b."awayParticipantId",
  'hasKey',v?'key','hasStart',v?'startTimeUtc','hasHome',v?'homeParticipantId','hasAway',v?'awayParticipantId',
  'participants',to_jsonb(array(select distinct id from unnest(array[b."homeParticipantId",b."awayParticipantId"]||
   nothingsports_fixture_read_private.top_match_keys(b."participantIds")||nothingsports_fixture_read_private.top_match_keys(jsonb_path_query_array(b.participants,'$[*].id'))||
   nothingsports_fixture_read_private.top_match_keys(jsonb_path_query_array(b."participantSlots",'$[*].participantId'))||
   nothingsports_fixture_read_private.top_match_keys(jsonb_path_query_array(b."matchupSides",'$[*].players[*].id'))) id where id is not null order by id)))||jsonb_build_object('calendarWindow',nothingsports_fixture_read_private.window_fields(v))
 from jsonb_to_record(v) as b(key text,"startTimeUtc" text,"homeParticipantId" text,"awayParticipantId" text,"participantIds" jsonb,participants jsonb,"participantSlots" jsonb,"matchupSides" jsonb);
$$;
create index fixture_context_participants_idx on nothingsports_fixture_read_private.fixture_context using gin(participant_ids);
create or replace function public.nothingsports_read_fixture_bundle_part(p_scope text,p_part integer,p_sport_keys text[],p_known_sport_keys text[],p_participant_ids text[],p_required_ids text[]) returns json language plpgsql stable set search_path='' set plan_cache_mode='force_generic_plan' as $function$ begin return (with recursive inputs as (
  select p_part in(0,1) and ((p_scope='global' and cardinality(p_sport_keys)=0 and cardinality(p_known_sport_keys)=0 and cardinality(p_participant_ids)=0 and cardinality(p_required_ids)=0) or (p_scope='participants' and (cardinality(p_sport_keys) between 1 and 256 and cardinality(p_known_sport_keys) between 1 and 256
   and cardinality(p_participant_ids) between 1 and 1000 and cardinality(coalesce(p_required_ids,'{}'))<=5000
   and not exists(select 1 from unnest(p_sport_keys||p_known_sport_keys||p_participant_ids||coalesce(p_required_ids,'{}')) id where id is null or id !~ '^[-a-zA-Z0-9_:]{1,200}$')
   and p_sport_keys <@ p_known_sport_keys))) as valid,
   (p_scope='global' or not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)) as metadata_ready,
   (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), required_rows as materialized (
  select distinct t.source_id,t.fixture_id
  from nothingsports_fixture_read_private.fixture_tokens t
  join (select distinct id from unnest(coalesce(p_required_ids,'{}'::text[])) id where id is not null) wanted on wanted.id=t.token
  where t.kind=1
 ), seed_sources(source_id) as (
 select source_id from public.nothingsports_fixture_sources where p_scope='global'
 union
 select distinct c.source_id from nothingsports_fixture_read_private.fixture_context c where p_scope='participants' and (
 c.base_key=any(p_sport_keys) or c.score_key=any(p_sport_keys) or nullif(c.base_key,'') is null or
 not exists(select 1 from unnest(p_known_sport_keys) known(id) where known.id=c.base_key) or
 (c.has_score_key and (nullif(c.score_key,'') is null or not exists(select 1 from unnest(p_known_sport_keys) known(id) where known.id=c.score_key))))
 union
 select source_id from required_rows where p_scope='participants'
 union
 select distinct source_id from nothingsports_fixture_read_private.fixture_context where p_scope='participants' and participant_ids && p_participant_ids
 ), related_sources(source_id) as (
 select s.source_id from seed_sources s cross join inputs i where i.valid and i.metadata_ready
 union
 select other.source_id from related_sources r join nothingsports_fixture_read_private.source_tokens seed using(source_id)
 join nothingsports_fixture_read_private.source_tokens other on other.kind=seed.kind and other.token=seed.token where p_scope='participants'
 ), protected_rows(source_id,fixture_id) as (
 select source_id,fixture_id from required_rows
 union
 select other.source_id,other.fixture_id from protected_rows p join nothingsports_fixture_read_private.fixture_tokens seed using(source_id,fixture_id)
 join nothingsports_fixture_read_private.fixture_tokens other on other.kind=seed.kind and other.token=seed.token
 ), candidates as materialized (
  select c.source_id,c.fixture_id
  from related_sources r join public.nothingsports_fixture_current c using(source_id)
  join public.nothingsports_fixture_sources src using(source_id)
  left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
  left join protected_rows protected using(source_id,fixture_id)
  cross join inputs i
  cross join lateral(select
   coalesce(ctx.base_selection->'calendarWindow',nothingsports_fixture_read_private.window_fields(c.fixture)) base_window,
   coalesce(ctx.score_selection->'calendarWindow',(select nothingsports_fixture_read_private.window_fields(s.score) from public.nothingsports_live_scores s where s.source_id=c.source_id and s.fixture_id=c.fixture_id)) score_window) w
  cross join lateral(select
   case when (w.score_window->>'hasStatus')::boolean then w.score_window->>'status' else w.base_window->>'status' end as status,
   case when (w.score_window->>'hasEndDate')::boolean then w.score_window->>'endDate' else w.base_window->>'endDate' end as end_date,
   case when (w.score_window->>'hasDate')::boolean then w.score_window->>'date' else w.base_window->>'date' end as date,
   case when (w.score_window->>'hasStartDate')::boolean then w.score_window->>'startDate' else w.base_window->>'startDate' end as start_date,
   case when (w.score_window->>'hasSchedulingWindow')::boolean then w.score_window->'schedulingWindow' else w.base_window->'schedulingWindow' end as scheduling_window) f
  cross join lateral(select coalesce(nullif(f.end_date,''),nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'endsOn','') as ends_on,
   coalesce(nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'startsOn','') as starts_on) dates
  where protected.source_id is not null or f.status='live' or (
   (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (i.today-7)::text) and
   (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (i.today+interval '1 year')::date::text))
  order by c.source_id,c.fixture_id limit 5001
 ), part_rows as materialized (
  select c.source_id,c.fixture_id,c.fixture,c.identity_keys,s.score,s.first_completed_at
  from candidates chosen join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  where get_byte(decode(md5(c.source_id||chr(31)||c.fixture_id),'hex'),0)%2=p_part
 ), receipts as materialized (
  select src.source_id,r.key as fixture_id,r.value as receipt from public.nothingsports_fixture_sources src
  join (select distinct source_id from part_rows) needed using(source_id)
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), clock_inputs as materialized (
  select c.source_id,c.fixture_id,array[c.score->>'scoreCheckedAt',c.fixture->>'scoreCheckedAt',c.score->>'statusCheckedAt',c.fixture->>'statusCheckedAt',r.receipt->>'s',r.receipt->>'t'] raw
  from part_rows c left join receipts r using(source_id,fixture_id)
 ), parsed_clocks as materialized (
  select jsonb_object_agg(value,public.nothingsports_fixture_observation_time(value)) stamps
  from (select distinct unnest(raw) value from clock_inputs) distinct_values where value is not null
 ), patches as materialized (
  select i.source_id,i.fixture_id,jsonb_build_object(
   'fixtureObservationSchema','fixture-observations.v1',
   'scoreFactObservedAt',coalesce(s,b),
   'statusFactObservedAt',coalesce(t,u),
   'scoreCheckedAt',coalesce(r,s,b),
   'statusCheckedAt',coalesce(v,t,u)) patch
  from clock_inputs i cross join parsed_clocks p cross join lateral (
   select nullif(p.stamps->(i.raw[1]),'null'::jsonb) s,
    nullif(p.stamps->(i.raw[2]),'null'::jsonb) b,
    nullif(p.stamps->(i.raw[3]),'null'::jsonb) t,
    nullif(p.stamps->(i.raw[4]),'null'::jsonb) u,
    nullif(p.stamps->(i.raw[5]),'null'::jsonb) r,
    nullif(p.stamps->(i.raw[6]),'null'::jsonb) v) clocks
 ), cleaned as (
  select c.source_id,c.fixture_id,c.identity_keys,c.score,c.first_completed_at,p.patch,jsonb_typeof(c.fixture) base_type,
   ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
    case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
    case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
     (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end as base from part_rows c join patches p using(source_id,fixture_id)
 ), projected as (
  select source_id,fixture_id,identity_keys,
   case when base_type='object' and (score is null or jsonb_typeof(score)='object')
    then base||(coalesce(score,'{}'::jsonb)||patch||case when first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',first_completed_at) end)
    else base||coalesce(score,'{}'::jsonb)||patch||case when first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',first_completed_at) end end fixture
  from cleaned
 ), metadata as materialized (
  select (select count(*) from candidates) total,
   (select coalesce(jsonb_agg(to_jsonb(h) order by source_id),'[]'::jsonb) from public.nothingsports_read_fixture_source_health() h) manifest
 )
 select json_build_object('schemaVersion','fixture-bundle-part.v1','scope',p_scope,'part',p_part,
  'sportKeys',to_jsonb(p_sport_keys),'knownSportKeys',to_jsonb(p_known_sport_keys),'participantIds',to_jsonb(p_participant_ids),'requiredIds',to_jsonb(coalesce(p_required_ids,'{}'::text[])),
  'complete',coalesce(i.valid and i.metadata_ready,false) and metadata.total<=5000,
  'rowCount',metadata.total,'snapshotVersion',md5(jsonb_build_array(metadata.manifest,i.today,metadata.total)::text),
  'manifest',case when p_part=0 then metadata.manifest else 'null'::jsonb end,
  'rows',coalesce((select json_agg(row_to_json(p) order by source_id,fixture_id) from projected p),'[]'::json))
 from inputs i cross join metadata);end;$function$;
