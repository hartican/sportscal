-- SHADOW FIRST. Existing reader/default and all canonical facts remain original.
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

do $fresh$ begin
 if to_regclass('nothingsports_fixture_read_private.global_read_epochs') is not null
 or to_regclass('nothingsports_fixture_read_private.global_read_generations') is not null
 or to_regclass('nothingsports_fixture_read_private.global_read_original') is not null
 or to_regclass('nothingsports_fixture_read_private.global_read_constructor') is not null then
  raise exception 'Global generation candidate already installed or partial';
 end if;
end $fresh$;
create table nothingsports_fixture_read_private.global_read_epochs(
 source_id text primary key references public.nothingsports_fixture_sources(source_id) on delete cascade on update cascade,
 token uuid not null default gen_random_uuid(), last_xid bigint not null
);
create table nothingsports_fixture_read_private.global_read_generations(
 slot smallint primary key check(slot in(0,1)), generation_id uuid not null,
 -- Only this private derived payload chooses LZ4; no database/session default.
 payload json storage extended compression lz4 not null check(octet_length(payload::text)<=16777216),
 source_vector jsonb not null, sydney_day date not null, policy text not null,
 parser_md5 text not null, session_timezone text not null, session_datestyle text not null,
 reference_clock timestamptz not null, valid_until timestamptz not null, installed_at timestamptz not null, witness bytea not null
);
alter table nothingsports_fixture_read_private.global_read_epochs enable row level security;
alter table nothingsports_fixture_read_private.global_read_epochs force row level security;
alter table nothingsports_fixture_read_private.global_read_generations enable row level security;
alter table nothingsports_fixture_read_private.global_read_generations force row level security;
revoke all on nothingsports_fixture_read_private.global_read_epochs,nothingsports_fixture_read_private.global_read_generations from public,anon,authenticated;
grant select,insert,update,delete on nothingsports_fixture_read_private.global_read_epochs,nothingsports_fixture_read_private.global_read_generations to service_role;
insert into nothingsports_fixture_read_private.global_read_epochs(source_id,last_xid)
 select source_id,txid_current() from public.nothingsports_fixture_sources;

-- Existing source transactions own this metadata. The transaction-local memo
-- coalesces all fixture/score/context/receipt changes into one epoch write.
create function nothingsports_fixture_read_private.touch_global_read_epoch(sid text,force_touch boolean default false) returns void
language plpgsql security invoker set search_path='' as $fn$
declare memo text:='nothingsports.global_read_'||md5(sid); xid text:=txid_current()::text;
begin
 -- Independent of surviving epoch/source rows, transaction-local and rolled
 -- back with a savepoint. Deleting the last source must still forbid builds.
 if current_setting('nothingsports.global_read_mutation_xid',true)is distinct from xid then perform set_config('nothingsports.global_read_mutation_xid',xid,true);end if;
 if not force_touch and current_setting(memo,true)=xid then return;end if;
 if not exists(select 1 from public.nothingsports_fixture_sources where source_id=sid)then return;end if;
 insert into nothingsports_fixture_read_private.global_read_epochs(source_id,last_xid)
 values(sid,xid::bigint)on conflict(source_id)do update set token=gen_random_uuid(),last_xid=excluded.last_xid
 where force_touch or global_read_epochs.last_xid is distinct from excluded.last_xid;
 perform set_config(memo,xid,true);
end $fn$;
create function nothingsports_fixture_read_private.global_read_epoch_changed()returns trigger
language plpgsql security invoker set search_path=''as $fn$
declare s text;
begin
 if tg_op='TRUNCATE' then
  perform set_config('nothingsports.global_read_mutation_xid',txid_current()::text,true);
  for s in select source_id from public.nothingsports_fixture_sources order by source_id loop
   perform nothingsports_fixture_read_private.touch_global_read_epoch(s,true);
  end loop;return null;
 end if;
 if tg_table_name='nothingsports_fixture_sources' then
  if tg_op='DELETE' then perform nothingsports_fixture_read_private.touch_global_read_epoch(old.source_id);perform set_config('nothingsports.global_read_'||md5(old.source_id),'',true);return null;end if;
  if tg_op='UPDATE' and new.source_id=old.source_id and
    new.discovery_report->'_fixtureObservations' is not distinct from old.discovery_report->'_fixtureObservations' then return null;end if;
  perform nothingsports_fixture_read_private.touch_global_read_epoch(new.source_id,tg_op='INSERT');return null;
 end if;
 if tg_op='UPDATE' and new is not distinct from old then return null;end if;
 if tg_op<>'INSERT' then perform nothingsports_fixture_read_private.touch_global_read_epoch(old.source_id);end if;
 if tg_op<>'DELETE' then perform nothingsports_fixture_read_private.touch_global_read_epoch(new.source_id);end if;
 return null;
end $fn$;
do $triggers$ declare relation text;begin
 foreach relation in array array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']loop
  execute format('create trigger global_read_epoch_after_change after insert or update or delete on %s for each row execute function nothingsports_fixture_read_private.global_read_epoch_changed()',relation);
  execute format('create trigger global_read_epoch_after_truncate after truncate on %s for each statement execute function nothingsports_fixture_read_private.global_read_epoch_changed()',relation);
 end loop;
end $triggers$;
create function nothingsports_fixture_read_private.global_read_vector()returns jsonb
language sql stable security invoker set search_path=''as $fn$
 select case when count(*)filter(where e.token is null)>0 then null::jsonb else
  coalesce(jsonb_agg(jsonb_build_array(s.source_id,e.token::text)order by s.source_id),'[]'::jsonb)end
 from public.nothingsports_fixture_sources s left join nothingsports_fixture_read_private.global_read_epochs e using(source_id)
$fn$;
-- Same regex/cast/exception semantics as the bound original parser. Only a
-- future-admissibility EXPIRY is calculated; no sporting clock is generated.
create function nothingsports_fixture_read_private.global_read_clock_transition(value text)returns timestamptz
language plpgsql stable security invoker set search_path=''as $fn$
declare stamp timestamptz;begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'then return null;end if;
 begin stamp:=value::timestamptz;exception when others then return null;end;
 if stamp>statement_timestamp()+interval '5 minutes'then return stamp-interval '5 minutes';end if;
 return null;
end $fn$;
-- Preserve the complete original expression as the builder/reference. JSON,
-- not JSONB, preserves full original response text and key order.
do $original$declare definition text;begin
 select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)into definition;
 execute 'create view nothingsports_fixture_read_private.global_read_original with(security_invoker=true)as '||definition;
end $original$;
revoke all on nothingsports_fixture_read_private.global_read_original from public,anon,authenticated;
grant select on nothingsports_fixture_read_private.global_read_original to service_role;

-- Derive from the pinned canonical expression, never a second membership query.
-- Only the outer output and final aggregate projection change. The original
-- JSON constructor, projected record and aggregate ordering stay byte-for-byte.
-- Reuse its compact raw clock_inputs; do not serialize then decode all fixtures
-- merely to recover keys and gather the same six clocks again.
do $constructor$
declare definition text;prefix text:=$prefix$ SELECT value AS bundle
   FROM ( WITH $prefix$;
 tail text:=$tail$ AS json_build_object
           FROM projected) global_query(value);$tail$;
begin
 select pg_get_viewdef('nothingsports_fixture_read_private.global_read_original'::regclass,true)into definition;
 if md5(definition)<>'fbc28299a5bf25428b286adc5ee2e0da'
 or left(definition,length(prefix))<>prefix or right(definition,length(tail))<>tail
 or cardinality(string_to_array(definition,prefix))<>2 or cardinality(string_to_array(definition,tail))<>2 then
  raise exception 'Canonical constructor anchors differ from reviewed baseline';
 end if;
 definition:=' SELECT value AS bundle, schema_version, complete, valid_until
   FROM ( WITH '||substring(definition from length(prefix)+1 for length(definition)-length(prefix)-length(tail))||$output$ AS json_build_object,
          'current-fixture-bundle.v1'::text AS schema_version, count(*)<=5000 AS complete,
          least((((statement_timestamp()at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney'),
           (select min(nothingsports_fixture_read_private.global_read_clock_transition(value))
            from(select distinct unnest(raw)value from clock_inputs)raw_values)) AS valid_until
           FROM projected) global_query(value,schema_version,complete,valid_until);$output$;
 execute 'create view nothingsports_fixture_read_private.global_read_constructor with(security_invoker=true)as '||definition;
 if md5(pg_get_viewdef('nothingsports_fixture_read_private.global_read_constructor'::regclass,true))<>'d7ce1167cde9c037c8f9da44c3d3d7e7'then
  raise exception 'Derived constructor differs from reviewed definition';
 end if;
end $constructor$;
revoke all on nothingsports_fixture_read_private.global_read_constructor from public,anon,authenticated;
grant select on nothingsports_fixture_read_private.global_read_constructor to service_role;

-- One full-value hash on install and opt-in read is real work, measured in
-- qualification. Fixed-size inner hashes avoid ambiguous text concatenation.
create function nothingsports_fixture_read_private.global_generation_witness(p json,v jsonb,d date,policy text,parser text,tz text,ds text,ref timestamptz,until_at timestamptz,installed timestamptz,gid uuid,slot smallint)returns bytea
language sql stable security invoker set search_path=''as $fn$
 select sha256(sha256(convert_to(p::text,'UTF8'))||sha256(convert_to(jsonb_build_array(v,d::text,policy,parser,tz,ds,extract(epoch from ref),extract(epoch from until_at),extract(epoch from installed),gid,slot)::text,'UTF8')))
$fn$;
create function nothingsports_fixture_read_private.guard_global_generation_write()returns trigger
language plpgsql security invoker set search_path=''as $fn$
begin
 if tg_op not in('INSERT','UPDATE')then raise exception 'Generation state is install-only';end if;
 if current_user<>'service_role'or current_setting('nothingsports.generation_install',true)is distinct from txid_current()::text||':'||new.generation_id::text then raise exception 'Generation state is install-only';end if;
 if new.slot not in(0,1)or octet_length(new.payload::text)>16777216 then raise exception using errcode='23514',message='Generation payload/slot cap';end if;
 new.witness:=nothingsports_fixture_read_private.global_generation_witness(new.payload,new.source_vector,new.sydney_day,new.policy,new.parser_md5,new.session_timezone,new.session_datestyle,new.reference_clock,new.valid_until,new.installed_at,new.generation_id,new.slot);
 return new;
end $fn$;
create trigger global_generation_install_only before insert or update or delete on nothingsports_fixture_read_private.global_read_generations for each row execute function nothingsports_fixture_read_private.guard_global_generation_write();
create trigger global_generation_no_truncate before truncate on nothingsports_fixture_read_private.global_read_generations for each statement execute function nothingsports_fixture_read_private.guard_global_generation_write();
-- Policy includes actual builder projection, epoch/expiry helpers and enabled
-- hooks. DDL/session policy changes must never reuse an earlier generation.
create function nothingsports_fixture_read_private.global_generation_policy()returns text
language sql stable security invoker set search_path=pg_catalog,public as $fn$
 select case when current_user='service_role'and(select rolbypassrls from pg_roles where rolname=current_user)
 and has_schema_privilege(current_user,'public','USAGE')and has_schema_privilege(current_user,'nothingsports_fixture_read_private','USAGE')
 and(select bool_and(has_table_privilege(current_user,r,'SELECT'))from unnest(array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']::regclass[])r)
 and has_function_privilege(current_user,'public.nothingsports_fixture_observation_time(text)','EXECUTE')
 and md5(pg_get_viewdef('nothingsports_fixture_read_private.global_read_original'::regclass,true))='fbc28299a5bf25428b286adc5ee2e0da'
 and md5(pg_get_viewdef('nothingsports_fixture_read_private.global_read_constructor'::regclass,true))='d7ce1167cde9c037c8f9da44c3d3d7e7'
 and exists(select 1 from pg_class c where c.oid='nothingsports_fixture_read_private.global_read_constructor'::regclass
  and c.relkind='v'and pg_get_userbyid(c.relowner)='postgres'and c.reloptions=array['security_invoker=true']
  and has_table_privilege(current_user,c.oid,'SELECT')
  and not exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a where a.grantee<>c.relowner
   and not(a.grantee=(select oid from pg_roles where rolname='service_role')and a.privilege_type='SELECT'and not a.is_grantable)))
 and(select count(*)=4 and bool_and(a.attacl is null and not a.attisdropped and a.atttypid=e.typ)
  from pg_attribute a left join(values(1,'json'::regtype),(2,'text'::regtype),(3,'boolean'::regtype),(4,'timestamptz'::regtype))e(num,typ)on e.num=a.attnum
  where a.attrelid='nothingsports_fixture_read_private.global_read_constructor'::regclass and a.attnum>0)
 and md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure))='13842433b7af056a35c01e8b234ae3c9'
 and(select md5(pg_get_expr(d.adbin,d.adrelid))from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture')='d7d2f883cba24dc54897fe44f9930365'
 and(select count(*)=2 and bool_and(tgenabled='O')from pg_trigger where tgrelid='nothingsports_fixture_read_private.global_read_generations'::regclass and tgname in('global_generation_install_only','global_generation_no_truncate'))
 and(select count(*)=10 and bool_and(t.tgenabled='O')from pg_trigger t where t.tgname in('global_read_epoch_after_change','global_read_epoch_after_truncate')
 and t.tgrelid=any(array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']::regclass[]))
 then 'global-read-generation.v1:'||md5(
 (select coalesce(string_agg(row_to_json(c)::text,'|'order by c.oid),'')from(select c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c where c.oid=any(array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']::regclass[]))c)||
 (select coalesce(string_agg(row_to_json(a)::text,'|'order by a.attrelid,a.attnum),'')from pg_attribute a where a.attrelid=any(array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']::regclass[])and a.attnum>0 and not a.attisdropped)||
 (select coalesce(string_agg(row_to_json(p)::text,'|'order by p.oid),'')from pg_policy p where p.polrelid=any(array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']::regclass[]))||
 (select coalesce(string_agg(row_to_json(r)::text,'|'order by r.oid),'')from pg_roles r where r.rolname=current_user)||
 (select coalesce(string_agg(row_to_json(m)::text,'|'order by m.roleid,m.member),'')from pg_auth_members m)||
 (select coalesce(p.proacl::text,'')from pg_proc p where p.oid='public.nothingsports_fixture_observation_time(text)'::regprocedure)||
 pg_get_functiondef(to_regprocedure('public.nothingsports_build_global_generation(integer)'))||
 pg_get_functiondef(to_regprocedure('nothingsports_fixture_read_private.global_generation_policy()'))||
 pg_get_functiondef(to_regprocedure('nothingsports_fixture_read_private.read_global_generation()'))||
 pg_get_functiondef('nothingsports_fixture_read_private.global_generation_witness(json,jsonb,date,text,text,text,text,timestamptz,timestamptz,timestamptz,uuid,smallint)'::regprocedure)||
 pg_get_functiondef('nothingsports_fixture_read_private.guard_global_generation_write()'::regprocedure)||
 pg_get_functiondef('nothingsports_fixture_read_private.touch_global_read_epoch(text,boolean)'::regprocedure)||
 pg_get_functiondef('nothingsports_fixture_read_private.global_read_epoch_changed()'::regprocedure)||
 pg_get_functiondef('nothingsports_fixture_read_private.global_read_vector()'::regprocedure)||
 pg_get_functiondef('nothingsports_fixture_read_private.global_read_clock_transition(text)'::regprocedure)||
 (select string_agg(pg_get_triggerdef(t.oid),'|'order by t.tgname)from pg_trigger t where t.tgrelid='nothingsports_fixture_read_private.global_read_generations'::regclass and t.tgname in('global_generation_install_only','global_generation_no_truncate'))||
 (select string_agg(pg_get_triggerdef(t.oid),'|'order by t.tgrelid::regclass::text,t.tgname)from pg_trigger t where t.tgname in('global_read_epoch_after_change','global_read_epoch_after_truncate')and t.tgrelid=any(array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']::regclass[])))end
$fn$;
create function nothingsports_fixture_read_private.read_global_generation()returns json
language sql stable security invoker set search_path=''as $fn$
 with latest as materialized(select * from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1),
 wall as materialized(select statement_timestamp()s,clock_timestamp()t)
 select g.payload from latest g cross join wall w
 where g.source_vector=nothingsports_fixture_read_private.global_read_vector()
 and g.sydney_day=(w.s at time zone 'Australia/Sydney')::date and w.s>=g.reference_clock and w.s<g.valid_until and w.t<g.valid_until
 and g.policy=nothingsports_fixture_read_private.global_generation_policy() and g.parser_md5=md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure))
 and g.witness=nothingsports_fixture_read_private.global_generation_witness(g.payload,g.source_vector,g.sydney_day,g.policy,g.parser_md5,g.session_timezone,g.session_datestyle,g.reference_clock,g.valid_until,g.installed_at,g.generation_id,g.slot)
 and g.session_timezone=current_setting('TimeZone')and g.session_datestyle=current_setting('DateStyle')
 and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
$fn$;
create function public.nothingsports_build_global_generation(p_budget_ms integer default 6000)returns jsonb
language plpgsql volatile security invoker set search_path='' set statement_timeout='6s' set lock_timeout='1s'as $fn$
declare payload json;tokens jsonb;day date;until_at timestamptz;schema_text text;complete_text text;receipt jsonb;began timestamptz:=clock_timestamp();
 current_policy text;reference_clock timestamptz:=statement_timestamp();parser text;tz text:=current_setting('TimeZone');ds text:=current_setting('DateStyle');next_slot smallint;installed integer;gid uuid:=gen_random_uuid();
begin
 if p_budget_ms is null or p_budget_ms<1 or p_budget_ms>6000 then raise exception 'Invalid global generation budget';end if;
 if current_setting('nothingsports.global_read_mutation_xid',true)=txid_current()::text or exists(select 1 from nothingsports_fixture_read_private.global_read_epochs where last_xid=txid_current())then return jsonb_build_object('state','deferred','reason','source_transaction');end if;
 current_policy:=nothingsports_fixture_read_private.global_generation_policy();
 parser:=md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure));
 if current_policy is null or parser<>'13842433b7af056a35c01e8b234ae3c9'or exists(select 1 from nothingsports_fixture_read_private.integrity_pending)then return jsonb_build_object('state','deferred','reason','parser_or_pending');end if;
 if nothingsports_fixture_read_private.read_global_generation()is not null then return jsonb_build_object('state','unchanged');end if;
 -- ONE coherent statement snapshot for payload, full epoch vector and expiry.
 select b.bundle,nothingsports_fixture_read_private.global_read_vector(),(statement_timestamp()at time zone 'Australia/Sydney')::date,
 b.valid_until,b.schema_version,b.complete::text
 into payload,tokens,day,until_at,schema_text,complete_text from nothingsports_fixture_read_private.global_read_constructor b;
 if tokens is null or schema_text<>'current-fixture-bundle.v1'or complete_text::boolean is not true then return jsonb_build_object('state','deferred','reason','incomplete');end if;
 if octet_length(payload::text)>16777216 then return jsonb_build_object('state','deferred','reason','payload_cap');end if;
 if clock_timestamp()>=began+p_budget_ms*interval '1 millisecond'then return jsonb_build_object('state','deferred','reason','budget');end if;
 -- A fresh SPI statement snapshot checks tokens after construction. No epoch
 -- lock during the build. A later racing commit is caught by EVERY read fence.
 select coalesce(1-slot,0)into next_slot from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1;
 next_slot:=coalesce(next_slot,0);
 perform set_config('nothingsports.generation_install',txid_current()::text||':'||gid::text,true);
 insert into nothingsports_fixture_read_private.global_read_generations(slot,generation_id,payload,source_vector,sydney_day,policy,parser_md5,session_timezone,session_datestyle,reference_clock,valid_until,installed_at)
 select next_slot,gid,payload,tokens,day,current_policy,parser,tz,ds,reference_clock,until_at,clock_timestamp()
 where current_policy=nothingsports_fixture_read_private.global_generation_policy()and tokens=nothingsports_fixture_read_private.global_read_vector()and day=(clock_timestamp()at time zone 'Australia/Sydney')::date
 and clock_timestamp()<until_at and clock_timestamp()<began+p_budget_ms*interval '1 millisecond'
 and parser=md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure))
 and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
 on conflict(slot)do update set generation_id=excluded.generation_id,payload=excluded.payload,source_vector=excluded.source_vector,sydney_day=excluded.sydney_day,policy=excluded.policy,parser_md5=excluded.parser_md5,session_timezone=excluded.session_timezone,session_datestyle=excluded.session_datestyle,reference_clock=excluded.reference_clock,valid_until=excluded.valid_until,installed_at=excluded.installed_at,witness=excluded.witness
 where excluded.installed_at>global_read_generations.installed_at;
 get diagnostics installed=row_count;
 perform set_config('nothingsports.generation_install','',true);
 if installed=1 and(clock_timestamp()>=until_at or tokens is distinct from nothingsports_fixture_read_private.global_read_vector()or current_policy is distinct from nothingsports_fixture_read_private.global_generation_policy())then
  receipt:=jsonb_build_object('state','deferred','reason','invalidated_after_install');
 else
  receipt:=jsonb_build_object('state',case when installed=1 then 'installed'else'deferred'end,'reason',case when installed=0 then 'fence_changed'else null end,'generationId',case when installed=1 then gid else null end,'payloadBytes',octet_length(payload::text));
 end if;
 -- Charge post-write fences and receipt construction before the last deadline
 -- check. Raising rolls back the entire call, including INSERT/UPSERT/witness.
 if installed=1 and clock_timestamp()>=began+p_budget_ms*interval '1 millisecond'then
  raise exception using errcode='57014',message='Global generation budget exceeded after install';
 end if;
 return receipt;
end $fn$;
revoke all on function nothingsports_fixture_read_private.touch_global_read_epoch(text,boolean),nothingsports_fixture_read_private.global_read_epoch_changed(),nothingsports_fixture_read_private.global_read_vector(),nothingsports_fixture_read_private.global_read_clock_transition(text),nothingsports_fixture_read_private.read_global_generation(),nothingsports_fixture_read_private.global_generation_witness(json,jsonb,date,text,text,text,text,timestamptz,timestamptz,timestamptz,uuid,smallint),nothingsports_fixture_read_private.guard_global_generation_write(),nothingsports_fixture_read_private.global_generation_policy(),public.nothingsports_build_global_generation(integer) from public,anon,authenticated;
grant execute on function nothingsports_fixture_read_private.touch_global_read_epoch(text,boolean),nothingsports_fixture_read_private.global_read_epoch_changed(),nothingsports_fixture_read_private.global_read_vector(),nothingsports_fixture_read_private.global_read_clock_transition(text),nothingsports_fixture_read_private.read_global_generation(),nothingsports_fixture_read_private.global_generation_witness(json,jsonb,date,text,text,text,text,timestamptz,timestamptz,timestamptz,uuid,smallint),nothingsports_fixture_read_private.guard_global_generation_write(),nothingsports_fixture_read_private.global_generation_policy(),public.nothingsports_build_global_generation(integer) to service_role;

-- Shadow opt-in only. Default, unknown and old clock-v1 headers keep fbc.
do $install$declare original text;begin
 select regexp_replace(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true),';[[:space:]]*$','')into original;
 execute format($view$create or replace view public.nothingsports_current_global_fixture_bundle with(security_invoker=true)as
 select case when(case when coalesce(nullif(current_setting('request.headers',true),''),'{}')is json object
 then nullif(current_setting('request.headers',true),'')::jsonb->>'x-ns-fixture-generation'='shadow-v1'else false end)
 then coalesce(nothingsports_fixture_read_private.read_global_generation(),(%s))else(%s)end as bundle$view$,original,original);
end $install$;
