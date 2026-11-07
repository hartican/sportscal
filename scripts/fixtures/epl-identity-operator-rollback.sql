-- Operator-only reversal. Never restore/copy/delete customer rows.
-- Refuses subsequent scoped activity, erasure and function/trigger drift.
set local lock_timeout='5s';set local statement_timeout='90s';
do $epl_undo$
declare version_id constant text:='epl-provider-identity.20261013';inv jsonb;item record;t text;ids text[];state_hash text;trigger_state jsonb;event_tables text[];aux_state jsonb;function_post jsonb;security_post jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('sportscal:coverage-repair:v1'));
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select inventory into inv from nothingsports_recovery.coverage_repair_versions where version=version_id and completed_at is not null;
 if inv is null then raise exception 'Completed EPL bridge is missing';end if;
 ids:=array(select jsonb_array_elements_text(inv->'scope'));event_tables:=array(select jsonb_object_keys(inv->'postState'));
 foreach t in array event_tables loop
  execute format('lock table public.%I in share row exclusive mode',t);
  execute format('select md5(coalesce(string_agg(to_jsonb(r)::text,'''' order by to_jsonb(r)::text),'''')) from public.%I r where event_id=any($1)',t) into state_hash using ids;
  if state_hash is distinct from inv->'postState'->>t then raise exception 'EPL undo requires newer scoped activity/erasure review: %',t;end if;
 end loop;
 lock table public.nothingsports_reminder_intents,public.nothingsports_chat_rooms,public.nothingsports_user_state in share row exclusive mode;
 select jsonb_build_object(
 'reminderIntents',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) from public.nothingsports_reminder_intents r where r.fixture_id=any(ids) or r.aliases ?| ids),
 'privateRooms',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) from public.nothingsports_chat_rooms r where r.canonical_fixture_id=any(ids)),
 'savedState',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) from public.nothingsports_user_state r)) into aux_state;
 if aux_state is distinct from inv->'auxPostState' then raise exception 'EPL undo requires newer saved choice/private room review';end if;
 function_post:=inv->'functionPostState';
 select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('acl',p.proacl::text,'owner',p.proowner,'definer',p.prosecdef,'config',p.proconfig)) from pg_proc p where p.oid in(select key::regprocedure::oid from jsonb_each(function_post)) into security_post;
 if security_post is distinct from inv->'functionSecurityPost' then raise exception 'EPL undo requires newer function grant/owner review';end if;
 for item in select * from jsonb_each_text(inv->'functionPostState') loop
  if to_regprocedure(item.key) is null or md5(pg_get_functiondef(item.key::regprocedure)) is distinct from item.value then raise exception 'EPL undo requires newer function review: %',item.key;end if;
 end loop;
 select jsonb_agg(jsonb_build_object('table',c.relname,'name',g.tgname,'state',g.tgenabled,'definition',pg_get_triggerdef(g.oid)) order by c.relname,g.tgname) from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(event_tables) and not g.tgisinternal into trigger_state;
 if trigger_state is distinct from inv->'triggerState' then raise exception 'EPL undo requires newer trigger review';end if;
 if (select count(*) from nothingsports_recovery.coverage_repair_rows where version=version_id and table_name='@function')<>7 then raise exception 'EPL original function preimages are incomplete';end if;
 drop trigger epl_prediction_settlement_v1 on public.nothingsports_predictions;
 for item in select payload from nothingsports_recovery.coverage_repair_rows where version=version_id and table_name='@function' order by row_key loop execute item.payload->>'definition';end loop;
 -- Only new, unused, noncustomer catalog records can be removed.
 delete from public.nothingsports_prediction_rules where event_id in(select jsonb_array_elements_text(inv->'addedRules'));
 delete from public.nothingsports_score_fixtures where event_id in(select jsonb_array_elements_text(inv->'addedParents'));
 drop function public.nothingsports_epl_identity_ready();
 drop function nothingsports_recovery.epl_identity_ready_v1();
 drop function nothingsports_recovery.epl_operating_ids_v1(text);
 drop function nothingsports_recovery.epl_reward_clock_v1(text,text,timestamp with time zone);
 drop function nothingsports_recovery.epl_prediction_settlement_guard_v1();
 select jsonb_agg(jsonb_build_object('table',c.relname,'name',g.tgname,'state',g.tgenabled,'definition',pg_get_triggerdef(g.oid)) order by c.relname,g.tgname) from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(event_tables) and not g.tgisinternal into trigger_state;
 if trigger_state is distinct from inv->'triggerBefore' then raise exception 'EPL original triggers were not restored';end if;
 update nothingsports_recovery.coverage_repair_versions set completed_at=null,inventory=inventory||jsonb_build_object('operatorReversedAt',clock_timestamp()) where version=version_id;
end $epl_undo$;
