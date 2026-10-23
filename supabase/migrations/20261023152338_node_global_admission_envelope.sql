-- Global admission components: original unselected reader remains the exact fallback.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from 'fbc28299a5bf25428b286adc5ee2e0da' then
  raise exception 'Original global view differs from reviewed baseline';
 end if;

 if not exists(select 1 from pg_class c where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass
    and c.relkind='v' and pg_get_userbyid(c.relowner)='postgres' and c.reloptions=array['security_invoker=true'])
 or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass and a.grantee<>c.relowner
      and not(a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='SELECT' and not a.is_grantable))
 or not has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','SELECT')
 or (select count(*) from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attnum>0 and not attisdropped)<>1
 or not exists(select 1 from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attname='bundle' and atttypid='json'::regtype and attacl is null and not attisdropped) then
  raise exception 'Global component view contract or permissions differ from service-only baseline';
 end if;

 if md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54' then
  raise exception 'Original observation helpers differ from reviewed baseline';
 end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid in('public.nothingsports_fixture_observation_time(text)'::regprocedure,
                  'public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)
      and (pg_get_userbyid(p.proowner)<>'postgres' or (a.grantee<>p.proowner and not(
        a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='EXECUTE' and not a.is_grantable))))
 or not has_function_privilege('service_role','public.nothingsports_fixture_observation_time(text)','EXECUTE')
 or not has_function_privilege('service_role','public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)','EXECUTE') then
  raise exception 'Observation helper permissions differ from service-only baseline';
 end if;
 if not exists(select 1 from pg_class where oid='public.nothingsports_fixture_current'::regclass and relrowsecurity and relforcerowsecurity)
 or has_table_privilege('anon','public.nothingsports_fixture_current','SELECT')
 or has_table_privilege('authenticated','public.nothingsports_fixture_current','SELECT')
 or not has_table_privilege('service_role','public.nothingsports_fixture_current','SELECT') then
  raise exception 'Current fixture permissions differ from private baseline';
 end if;
 if not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture' and a.attgenerated='s'
      and a.atttypid='jsonb'::regtype and a.attacl is null and not a.attisdropped
      and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365') then
  raise exception 'Original compact projection differs from reviewed baseline';
 end if;
end $guard$;

-- One statement/snapshot owns every raw input, SQL parser and Sydney boundary.
-- Deliberately NO admission LIMIT here: only the decoder may apply 5001 after
-- the original calendar rule. No new table, function, writer or scheduler.
do $install$
declare original text;
begin
 select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true) into original;
 original:=regexp_replace(original, ';[[:space:]]*$', '');
 execute format($view$
 create or replace view public.nothingsports_current_global_fixture_bundle with(security_invoker=true) as
 select case when (case when coalesce(nullif(current_setting('request.headers',true),''),'{}') is json object
   then nullif(current_setting('request.headers',true),'')::jsonb->>'x-ns-fixture-components'='admission-v1'
   else false end)
 then (
 with sources as materialized (
   select source_id,discovery_report->'_fixtureObservations' receipts from public.nothingsports_fixture_sources
 ), inputs as materialized (
   select c.source_id,c.fixture_id,c.identity_keys,c.global_fixture as base,
     c.global_fixture is null as base_is_sql_null,
     s.score,s.score is null as score_is_sql_null,s.first_completed_at,
     array[s.score->>'scoreCheckedAt',c.global_fixture->>'scoreCheckedAt',
       s.score->>'statusCheckedAt',c.global_fixture->>'statusCheckedAt',
       (src.receipts->c.fixture_id)->>'s',(src.receipts->c.fixture_id)->>'t'] as raw,
     array[
       case when s.score ? 'status' then s.score->>'status' else c.global_fixture->>'status' end,
       case when s.score ? 'endDate' then s.score->>'endDate' else c.global_fixture->>'endDate' end,
       case when s.score ? 'date' then s.score->>'date' else c.global_fixture->>'date' end,
       case when s.score ? 'startDate' then s.score->>'startDate' else c.global_fixture->>'startDate' end,
       (case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.global_fixture->'schedulingWindow' end)->>'endsOn',
       (case when s.score ? 'schedulingWindow' then s.score->'schedulingWindow' else c.global_fixture->'schedulingWindow' end)->>'startsOn'
     ] as fallback,
     case when ctx.source_id is null then null::json else json_build_object(
       'shape_version',ctx.shape_version,
       'base_window',ctx.base_selection->'calendarWindow',
       'score_window',ctx.score_selection->'calendarWindow',
       'edges',array[
         ctx.base_selection->'calendarWindow'->'schedulingWindow'->>'endsOn',
         ctx.base_selection->'calendarWindow'->'schedulingWindow'->>'startsOn',
         ctx.score_selection->'calendarWindow'->'schedulingWindow'->>'endsOn',
         ctx.score_selection->'calendarWindow'->'schedulingWindow'->>'startsOn'
       ]) end as context
   from public.nothingsports_fixture_current c
   join sources src using(source_id)
   left join public.nothingsports_live_scores s using(source_id,fixture_id)
   left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
 ), parsed as materialized (
   select value,public.nothingsports_fixture_observation_time(value) stamp
   from (select distinct unnest(raw) value from inputs) distinct_clocks where value is not null
 ), boundary as (
   select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 )
 select json_build_object('schemaVersion','fixture-admission-components.v1','complete',true,
   'input_count',count(*),'integrity_clear',not exists(select 1 from nothingsports_fixture_read_private.integrity_pending),
   'statement_clock',statement_timestamp(),
   'lower_date',(select (today-7)::text from boundary),
   'upper_date',(select (today+interval '1 year')::date::text from boundary),
   'rows',coalesce(json_agg(row_to_json(inputs.*) order by inputs.source_id,inputs.fixture_id),'[]'::json),
   'parsed_clocks',coalesce((select json_agg(row_to_json(parsed.*) order by parsed.value) from parsed),'[]'::json))
 from inputs
 ) else ( %s ) end as bundle
 $view$,original);
end $install$;
do $contract$ begin

 if not exists(select 1 from pg_class c where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass
    and c.relkind='v' and pg_get_userbyid(c.relowner)='postgres' and c.reloptions=array['security_invoker=true'])
 or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass and a.grantee<>c.relowner
      and not(a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='SELECT' and not a.is_grantable))
 or not has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','SELECT')
 or (select count(*) from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attnum>0 and not attisdropped)<>1
 or not exists(select 1 from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attname='bundle' and atttypid='json'::regtype and attacl is null and not attisdropped) then
  raise exception 'Global component view contract or permissions differ from service-only baseline';
 end if;
end $contract$;
