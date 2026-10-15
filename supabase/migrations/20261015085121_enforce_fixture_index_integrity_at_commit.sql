set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_read_fixture_bundle_part(text,integer,text[],text[],text[],text[])'::regprocedure))<>'76f19d325c71317186dc152fcacc6969' then
  raise exception 'Fixture part reader differs from reviewed baseline; commit-integrity migration refused';
 end if;
end $guard$;
-- Existing canonical publishers own the source locks. Establish the invariant
-- atomically before replacing expensive read-time audits with commit enforcement.
lock table public.nothingsports_fixture_current,public.nothingsports_live_scores in share row exclusive mode;
lock table nothingsports_fixture_read_private.fixture_context,nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens in share row exclusive mode;
do $guard$ begin
 if not (not exists(select 1 from public.nothingsports_fixture_current c left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id) where ctx.fixture_id is null or ctx.shape_version<>1)
   and not exists(
    select 1 from (
     select c.source_id,c.fixture_id,expected.kind,expected.token
     from nothingsports_fixture_read_private.fixture_context c
     cross join lateral(select 1::smallint kind,id token from unnest(c.identity_keys) id where id is not null
      union all select 2::smallint,c.sides where c.sides is not null) expected
    ) expected full join nothingsports_fixture_read_private.fixture_tokens actual using(source_id,fixture_id,kind,token)
    where expected.fixture_id is null or actual.fixture_id is null)
   and not exists(
    select 1 from (select distinct source_id,kind,token from nothingsports_fixture_read_private.fixture_tokens) expected
    full join nothingsports_fixture_read_private.source_tokens actual using(source_id,kind,token)
    where expected.source_id is null or actual.source_id is null)) then raise exception 'Fixture index is incomplete; commit integrity refused';end if;
end $guard$;
create table nothingsports_fixture_read_private.integrity_pending(source_id text primary key);
alter table nothingsports_fixture_read_private.integrity_pending enable row level security;
revoke all on nothingsports_fixture_read_private.integrity_pending from public,anon,authenticated,service_role;
grant select on nothingsports_fixture_read_private.integrity_pending to service_role;

create function nothingsports_fixture_read_private.source_index_complete(p_source_id text) returns boolean
language sql stable security invoker set search_path='' as $check$
 select not exists(
  select 1 from public.nothingsports_fixture_current c
  left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
  where c.source_id=p_source_id and (ctx.fixture_id is null or ctx.shape_version<>1))
 and not exists(
  select 1 from (
   select c.source_id,c.fixture_id,expected.kind,expected.token
   from nothingsports_fixture_read_private.fixture_context c
   cross join lateral(select 1::smallint kind,id token from unnest(c.identity_keys) id where id is not null
    union all select 2::smallint,c.sides where c.sides is not null) expected
   where c.source_id=p_source_id
  ) expected full join (select * from nothingsports_fixture_read_private.fixture_tokens where source_id=p_source_id) actual
   using(source_id,fixture_id,kind,token)
  where expected.fixture_id is null or actual.fixture_id is null)
 and not exists(
  select 1 from (select distinct source_id,kind,token from nothingsports_fixture_read_private.fixture_tokens where source_id=p_source_id) expected
  full join (select * from nothingsports_fixture_read_private.source_tokens where source_id=p_source_id) actual using(source_id,kind,token)
  where expected.source_id is null or actual.source_id is null);
$check$;

-- Private definer triggers alone can change the pending set. Service callers
-- cannot delete a warning and bypass commit validation. No public definer RPC.
create function nothingsports_fixture_read_private.mark_integrity_pending() returns trigger
language plpgsql security definer set search_path='' as $mark$
begin
 if tg_op<>'INSERT' then
  insert into nothingsports_fixture_read_private.integrity_pending(source_id) values(old.source_id) on conflict do nothing;
 end if;
 if tg_op<>'DELETE' then
  insert into nothingsports_fixture_read_private.integrity_pending(source_id) values(new.source_id) on conflict do nothing;
 end if;
 return null;
end;
$mark$;

create function nothingsports_fixture_read_private.enforce_pending_integrity() returns trigger
language plpgsql security definer set search_path='' as $enforce$
begin
 if not exists(select 1 from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id) then return null;end if;
 if not nothingsports_fixture_read_private.source_index_complete(new.source_id) then
  raise exception using errcode='23514',message='Fixture index integrity is incomplete; canonical transaction refused';
 end if;
 delete from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id;
 return null;
end;
$enforce$;
revoke all on function nothingsports_fixture_read_private.source_index_complete(text),nothingsports_fixture_read_private.mark_integrity_pending(),nothingsports_fixture_read_private.enforce_pending_integrity() from public,anon,authenticated,service_role;
-- Only the read-only predicate is callable by the existing service identity.
grant execute on function nothingsports_fixture_read_private.source_index_complete(text) to service_role;
create constraint trigger fixture_integrity_at_commit after insert on nothingsports_fixture_read_private.integrity_pending
deferrable initially deferred for each row execute function nothingsports_fixture_read_private.enforce_pending_integrity();
create trigger fixture_current_integrity_after_change after insert or update or delete on public.nothingsports_fixture_current
for each row execute function nothingsports_fixture_read_private.mark_integrity_pending();
create trigger fixture_context_integrity_after_change after insert or update or delete on nothingsports_fixture_read_private.fixture_context
for each row execute function nothingsports_fixture_read_private.mark_integrity_pending();
create trigger fixture_tokens_integrity_after_change after insert or update or delete on nothingsports_fixture_read_private.fixture_tokens
for each row execute function nothingsports_fixture_read_private.mark_integrity_pending();
create trigger source_tokens_integrity_after_change after insert or update or delete on nothingsports_fixture_read_private.source_tokens
for each row execute function nothingsports_fixture_read_private.mark_integrity_pending();
create or replace function public.nothingsports_read_fixture_bundle_part(p_scope text,p_part integer,p_sport_keys text[],p_known_sport_keys text[],p_participant_ids text[],p_required_ids text[])
returns json language plpgsql stable set search_path='' set plan_cache_mode='force_generic_plan'
as $function$
begin
 return (
with recursive inputs as (
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
 c.base_key=any(p_sport_keys) or c.score_key=any(p_sport_keys) or nullif(c.base_key,'') is null or not c.base_key=any(p_known_sport_keys) or
 (c.has_score_key and (nullif(c.score_key,'') is null or not c.score_key=any(p_known_sport_keys))) or
 (c.source_id,c.fixture_id) in(select source_id,fixture_id from required_rows) or c.participant_ids && p_participant_ids )
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
 from inputs i cross join metadata
 );
end;
$function$;
