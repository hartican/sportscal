-- Expose the identical live global query as an invoker view, avoiding a full
-- set-returning-function result spool in the PostgREST transport frame.
-- No stored result, new writer, request, membership rule or deadline is added.
-- Reuse the existing canonical calendar-selection index, never cached membership.
-- Missing/unsupported/incomplete or pending descriptors read the original fields.
-- Only the existing global row-reader body changes; all index owners stay exact.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$
declare signature text; expected record;
begin
 if to_regclass('public.nothingsports_current_global_fixture_bundle') is not null then raise exception 'Global transport view already exists'; end if;
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle(text[])'::regprocedure)) is distinct from 'ef1658b2eb58a376f368ede88730ad43' then raise exception 'Original fixture reader differs from reviewed baseline'; end if;
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json(text[])'::regprocedure)) is distinct from 'a91f9bc32b11190240bba20ff0870bd8'
 or md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json_rows(text[])'::regprocedure)) is distinct from '9b0eb2dc9b6e954874be8419b8e9dbd0'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54'
 or md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9' then
  raise exception 'Global JSON inputs differ from reviewed baseline; indexed global admission refused';
 end if;
 foreach signature in array array[
  'public.nothingsports_read_current_fixture_bundle_json(text[])',
  'public.nothingsports_read_current_fixture_bundle_json_rows(text[])'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE')
  or has_function_privilege('authenticated',signature,'EXECUTE')
  or not has_function_privilege('service_role',signature,'EXECUTE')
  or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   where p.oid=signature::regprocedure and a.privilege_type='EXECUTE'
    and a.grantee not in(p.proowner,(select oid from pg_roles where rolname='service_role'))) then
   raise exception 'Global JSON permissions differ from service-only baseline; indexed global admission refused';
  end if;
 end loop;
 if not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture' and not a.attisdropped and a.attgenerated='s' and a.atttypid='jsonb'::regtype and not a.attnotnull and a.attacl is null and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365') then
  raise exception 'Stored global projection differs from reviewed baseline; indexed global admission refused';
 end if;
 if not exists(select 1 from pg_class where oid='public.nothingsports_fixture_current'::regclass and relrowsecurity and relforcerowsecurity)
 or has_table_privilege('anon','public.nothingsports_fixture_current','SELECT')
 or has_table_privilege('authenticated','public.nothingsports_fixture_current','SELECT')
 or not has_table_privilege('service_role','public.nothingsports_fixture_current','SELECT') then
  raise exception 'Current fixture table permissions differ from private baseline; indexed global admission refused';
 end if;

 for expected in select * from (values
  ('nothingsports_fixture_read_private.context_fields(jsonb,jsonb)','18dbb6a6afc42fcb7bd9462a3ddef0da','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.enforce_pending_integrity()','6b69919a197cf6abafef6040d5a41e60','{postgres=X/postgres}'),
  ('nothingsports_fixture_read_private.mark_integrity_pending()','7ea78bfefb71f46ede7d35d7d656e14e','{postgres=X/postgres}'),
  ('nothingsports_fixture_read_private.selection_fields(jsonb)','d9bad60ae66eb8157788e482a9fca783','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.source_index_complete(text)','85eb0ec44403c2ab6237ad76598cd2dd','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.sync_fixture(text,text)','3c20e52d95ebda90af1bb15369939738','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.sync_trigger()','6ad06f6cdab54b2eea83c993d094c160','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.token_membership_trigger()','d0fe27069e4d294d7385cff736776ad6','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.top_match_keys(jsonb)','0b5062260f46dfeb70e1e231db8d03db','{postgres=X/postgres,service_role=X/postgres}'),
  ('nothingsports_fixture_read_private.window_fields(jsonb)','6a39d774a7309099a986a2e6068d33fb','{postgres=X/postgres,service_role=X/postgres}')) v(signature,digest,acl) loop
  if not exists(select 1 from pg_proc p where p.oid=expected.signature::regprocedure and md5(pg_get_functiondef(p.oid))=expected.digest and p.proacl::text=expected.acl and pg_get_userbyid(p.proowner)='postgres') then
   raise exception 'Private index function contract differs from reviewed baseline; indexed global admission refused';
  end if;
 end loop;
 for expected in select * from (values
  ('nothingsports_fixture_current','fixture_current_integrity_after_change','73df0f45df51692e18c431c72027a91c'),
  ('nothingsports_fixture_current','fixture_read_context_after_current','3f06abe6825f9b8a4d9ce0332fa537ec'),
  ('nothingsports_fixture_read_private.fixture_context','fixture_context_integrity_after_change','bf03845ba9bf5898d3f34f3053a8ed63'),
  ('nothingsports_fixture_read_private.fixture_tokens','fixture_token_membership_after_change','6d907458def566339fc1d9e9a67d5652'),
  ('nothingsports_fixture_read_private.fixture_tokens','fixture_tokens_integrity_after_change','9b0c32efa6f1ed5eda212c9671c0ba7b'),
  ('nothingsports_fixture_read_private.integrity_pending','fixture_integrity_at_commit','9399bc70ad1f117e5f1e9219a0b34500'),
  ('nothingsports_fixture_read_private.source_tokens','source_tokens_integrity_after_change','37d4890aa003c3d1934270bb84d13b1e'),
  ('nothingsports_live_scores','fixture_read_context_after_score','880b3667a7d5c466eaf9791486980429')) v(relation,name,digest) loop
  if not exists(select 1 from pg_trigger t where t.tgrelid=expected.relation::regclass and t.tgname=expected.name and t.tgenabled='O' and md5(pg_get_triggerdef(t.oid))=expected.digest) then
   raise exception 'Canonical index trigger contract differs from reviewed baseline; indexed global admission refused';
  end if;
 end loop;
 for expected in select * from (values
  ('nothingsports_fixture_read_private.fixture_context','{postgres=arwdDxtm/postgres,service_role=arwd/postgres}'),
  ('nothingsports_fixture_read_private.integrity_pending','{postgres=arwdDxtm/postgres,service_role=r/postgres}')) v(relation,acl) loop
  if not exists(select 1 from pg_class t where t.oid=expected.relation::regclass and t.relrowsecurity and not t.relforcerowsecurity and t.relacl::text=expected.acl and pg_get_userbyid(t.relowner)='postgres') then
   raise exception 'Private index table contract differs from reviewed baseline; indexed global admission refused';
  end if;
 end loop;
 if not exists(select 1 from pg_namespace where oid='nothingsports_fixture_read_private'::regnamespace and nspacl::text='{postgres=UC/postgres,service_role=U/postgres}' and pg_get_userbyid(nspowner)='postgres') then
  raise exception 'Private index schema contract differs from reviewed baseline; indexed global admission refused';
 end if;
end $guard$;
create view public.nothingsports_current_global_fixture_bundle with(security_invoker=true) as
 select value as bundle from (
with calendar_windows as materialized (
  -- Decode each small descriptor once before shape checks and admission.
  select ctx.source_id,ctx.fixture_id,ctx.base_selection->'calendarWindow' base_window,ctx.score_selection->'calendarWindow' score_window
  from nothingsports_fixture_read_private.fixture_context ctx
  where ctx.shape_version=1 and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
 ), active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), scope_keys as (
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  left join calendar_windows ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id
   and jsonb_typeof(ctx.base_window)='object' and jsonb_typeof(ctx.score_window)='object'
   -- Complete descriptor shape: missing/invalid inner fields must use raw facts.
   and (ctx.base_window) ?& array['hasStatus','status','hasEndDate','endDate','hasDate','date','hasStartDate','startDate','hasSchedulingWindow','schedulingWindow']
   and jsonb_typeof(ctx.base_window->'hasStatus') in('boolean','null')
   and jsonb_typeof(ctx.base_window->'hasEndDate') in('boolean','null')
   and jsonb_typeof(ctx.base_window->'hasDate') in('boolean','null')
   and jsonb_typeof(ctx.base_window->'hasStartDate') in('boolean','null')
   and jsonb_typeof(ctx.base_window->'hasSchedulingWindow') in('boolean','null')
   and jsonb_typeof(ctx.base_window->'status') in('string','null')
   and jsonb_typeof(ctx.base_window->'endDate') in('string','null')
   and jsonb_typeof(ctx.base_window->'date') in('string','null')
   and jsonb_typeof(ctx.base_window->'startDate') in('string','null')
   and (ctx.score_window) ?& array['hasStatus','status','hasEndDate','endDate','hasDate','date','hasStartDate','startDate','hasSchedulingWindow','schedulingWindow']
   and jsonb_typeof(ctx.score_window->'hasStatus') in('boolean','null')
   and jsonb_typeof(ctx.score_window->'hasEndDate') in('boolean','null')
   and jsonb_typeof(ctx.score_window->'hasDate') in('boolean','null')
   and jsonb_typeof(ctx.score_window->'hasStartDate') in('boolean','null')
   and jsonb_typeof(ctx.score_window->'hasSchedulingWindow') in('boolean','null')
   and jsonb_typeof(ctx.score_window->'status') in('string','null')
   and jsonb_typeof(ctx.score_window->'endDate') in('string','null')
   and jsonb_typeof(ctx.score_window->'date') in('string','null')
   and jsonb_typeof(ctx.score_window->'startDate') in('string','null')
   -- End complete descriptor shape.
  cross join active_window w
  cross join lateral (
   select
    case when ctx.source_id is not null then case when (ctx.score_window->>'hasStatus')::boolean then ctx.score_window->>'status' else ctx.base_window->>'status' end else case when s.score ? 'status' then s.score->>'status' else c.global_fixture->>'status' end end as status,
    case when ctx.source_id is not null then case when (ctx.score_window->>'hasEndDate')::boolean then ctx.score_window->>'endDate' else ctx.base_window->>'endDate' end else case when s.score ? 'endDate' then s.score->>'endDate' else c.global_fixture->>'endDate' end end as end_date,
    case when ctx.source_id is not null then case when (ctx.score_window->>'hasDate')::boolean then ctx.score_window->>'date' else ctx.base_window->>'date' end else case when s.score ? 'date' then s.score->>'date' else c.global_fixture->>'date' end end as date,
    case when ctx.source_id is not null then case when (ctx.score_window->>'hasStartDate')::boolean then ctx.score_window->>'startDate' else ctx.base_window->>'startDate' end else case when s.score ? 'startDate' then s.score->>'startDate' else c.global_fixture->>'startDate' end end as start_date,
    case when ctx.source_id is not null then case when (ctx.score_window->>'hasSchedulingWindow')::boolean then ctx.score_window->'schedulingWindow' else ctx.base_window->'schedulingWindow' end else case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.global_fixture->'schedulingWindow' end end as scheduling_window
  ) f
  cross join lateral (
   select coalesce(nullif(f.end_date,''),nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'endsOn','') as ends_on,
    coalesce(nullif(f.date,''),nullif(f.start_date,''),f.scheduling_window->>'startsOn','') as starts_on
  ) dates
  where null::text[] is null
   and (f.status='live' or (
    (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.ends_on >= (w.today-7)::text)
    and (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or dates.starts_on <= (w.today+interval '1 year')::date::text)
   ))
  union all
  select c.source_id,c.fixture_id
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  where null::text[] is not null and c.identity_keys && null::text[]
 ), candidates as materialized (
  select source_id,fixture_id from scope_keys
  order by source_id,fixture_id limit 5001
 ), source_receipts as materialized (
  select src.source_id,src.discovery_report->'_fixtureObservations' as receipts
  from public.nothingsports_fixture_sources src
  where exists(select 1 from candidates k where k.source_id=src.source_id)
 ), clock_inputs as materialized (
  -- Array order: score fact, base score fact, status fact, base status fact,
  -- score receipt, status receipt. Parse values once; preserve each fallback.
  select k.source_id,k.fixture_id,array[s.score->>'scoreCheckedAt',c.global_fixture->>'scoreCheckedAt',s.score->>'statusCheckedAt',c.global_fixture->>'statusCheckedAt',r.receipts->c.fixture_id->>'s',r.receipts->c.fixture_id->>'t'] raw
  from candidates k join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  join source_receipts r using(source_id)
 ), parsed_clocks as materialized (
  select value,public.nothingsports_fixture_observation_time(value) stamp
  from (select distinct unnest(raw) value from clock_inputs) distinct_values where value is not null
 ), patches as materialized (
  select i.source_id,i.fixture_id,jsonb_build_object(
   'fixtureObservationSchema','fixture-observations.v1',
   'scoreFactObservedAt',coalesce(score_fact.stamp,base_score_fact.stamp),'statusFactObservedAt',coalesce(status_fact.stamp,base_status_fact.stamp),
   'scoreCheckedAt',coalesce(score_receipt.stamp,score_fact.stamp,base_score_fact.stamp),'statusCheckedAt',coalesce(status_receipt.stamp,status_fact.stamp,base_status_fact.stamp)) patch
  from clock_inputs i
  left join parsed_clocks score_fact on score_fact.value=i.raw[1]
  left join parsed_clocks base_score_fact on base_score_fact.value=i.raw[2]
  left join parsed_clocks status_fact on status_fact.value=i.raw[3]
  left join parsed_clocks base_status_fact on base_status_fact.value=i.raw[4]
  left join parsed_clocks score_receipt on score_receipt.value=i.raw[5]
  left join parsed_clocks status_receipt on status_receipt.value=i.raw[6]
 ), projected as not materialized (
  select c.source_id,c.fixture_id,c.identity_keys,
   case when jsonb_typeof(base)='object' and (s.score is null or jsonb_typeof(s.score)='object')
    then base||(coalesce(s.score,'{}'::jsonb)||patch||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end)
    else base||coalesce(s.score,'{}'::jsonb)||patch||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end end fixture
  from candidates k join public.nothingsports_fixture_current c using(source_id,fixture_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  join patches p using(source_id,fixture_id)
  -- Evaluate the compact value once per row without spooling full payloads.
  cross join lateral(select case when null::text[] is not null then c.fixture else c.global_fixture end as base offset 0) cleaned
 )
 select json_build_object('schemaVersion','current-fixture-bundle.v1','complete',count(*)<=5000,
  'rows',coalesce(json_agg(row_to_json(projected) order by source_id,fixture_id),'[]'::json)) from projected
 ) global_query(value);
revoke all on public.nothingsports_current_global_fixture_bundle from public,anon,authenticated,service_role;
grant select on public.nothingsports_current_global_fixture_bundle to service_role;
CREATE OR REPLACE FUNCTION public.nothingsports_read_current_fixture_bundle_json_rows(p_fixture_ids text[] DEFAULT NULL::text[])
RETURNS SETOF json LANGUAGE sql STABLE ROWS 1 SET search_path TO ''
AS $function$
 select bundle from public.nothingsports_current_global_fixture_bundle where p_fixture_ids is null
 union all
 select public.nothingsports_read_current_fixture_bundle(p_fixture_ids)::json where p_fixture_ids is not null;
$function$;
do $view_contract$ begin
 if not exists(select 1 from pg_class c where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass
  and c.relkind='v' and pg_get_userbyid(c.relowner)='postgres' and c.reloptions=array['security_invoker=true'])
 or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass and a.grantee<>c.relowner
   and not(a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='SELECT' and not a.is_grantable))
 or not has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','SELECT')
 or exists(select 1 from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attnum>0 and attacl is not null) then
  raise exception 'Global transport view permissions differ from service-only baseline';
 end if;
end $view_contract$;
notify pgrst, 'reload schema';
