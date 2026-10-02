-- Operator-only guarded undo; normal app rollback follows, never auto replay.
-- Refuse newer activity/consent, erased preimages or concurrent function changes.
set local lock_timeout='5s';set local statement_timeout='90s';
do $undo$
declare
 version_id constant text:='bledisloe-identity.20261002';
 canonical constant text:='rugby-australia-new-zealand-2026-10-17';
 ids constant text[]:=array['rugby-australia-new-zealand-2026-10-17','fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8','fixture-rugby-wr-e3cbae12-66b3-4835-b1ce-4014b63055c8','fixture:rugby:ra:949627','fixture-rugby-ra-949627'];
 restore_order constant text[]:=array['nothingsports_score_fixtures','nothingsports_score_votes','nothingsports_marquee_campaigns','nothingsports_live_rating_alerts','nothingsports_friend_activity','nothingsports_inbox','nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_reminder_intents','nothingsports_nsc_likes','nothingsports_nsc_presence'];
 delete_order constant text[]:=array['nothingsports_inbox','nothingsports_friend_activity','nothingsports_live_rating_alerts','nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_reminder_intents','nothingsports_nsc_likes','nothingsports_nsc_presence','nothingsports_marquee_campaigns','nothingsports_score_votes','nothingsports_score_fixtures'];
 t text;col text;item record;state_hash text;inv jsonb;trigger_state jsonb;command text;
begin
 perform pg_advisory_xact_lock(hashtext('sportscal:coverage-repair:v1'));
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select inventory into inv from nothingsports_recovery.coverage_repair_versions where version=version_id and completed_at is not null;
 if inv is null then raise exception 'Completed Bledisloe repair is missing';end if;
 for item in select * from jsonb_each_text(inv->'postState') loop
  execute format('lock table public.%I in share row exclusive mode',item.key);
  col:=case when item.key='nothingsports_reminder_intents' then 'fixture_id' else 'event_id' end;
  execute format('select md5(coalesce(string_agg(to_jsonb(r)::text,'''' order by to_jsonb(r)::text),'''')) from public.%I r where %I=any($1)',item.key,col) into state_hash using ids;
  if state_hash is distinct from item.value then raise exception 'Bledisloe undo requires newer activity review: %',item.key;end if;
 end loop;
 for item in select * from jsonb_each_text(inv->'functionPostState') loop
  if item.value is distinct from md5(pg_get_functiondef(item.key::regprocedure)) then raise exception 'Bledisloe undo requires newer function review: %',item.key;end if;
 end loop;
 select jsonb_agg(jsonb_build_object('table',c.relname,'name',g.tgname,'state',g.tgenabled) order by c.relname,g.tgname) into trigger_state from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and inv->'postState' ? c.relname and not g.tgisinternal;
 if trigger_state is distinct from inv->'triggerPostState' then raise exception 'Bledisloe undo requires newer trigger review';end if;
 if (select count(*) from nothingsports_recovery.coverage_repair_rows where version=version_id and table_name<>'@function')<>(inv->>'recoveryRows')::bigint then raise exception 'Bledisloe preimages were erased; never restore erased accounts';end if;
 for item in select payload from nothingsports_recovery.coverage_repair_rows where version=version_id and table_name='@function' loop execute item.payload->>'definition';end loop;
 drop trigger if exists bledisloe_intent_alias_v1 on public.nothingsports_reminder_intents;
 foreach t in array restore_order loop execute format('alter table public.%I disable trigger user',t);end loop;
 foreach t in array delete_order loop
  col:=case when t='nothingsports_reminder_intents' then 'fixture_id' else 'event_id' end;
  execute format('delete from public.%I where %I=any($1)',t,col) using ids;
 end loop;
 foreach t in array restore_order loop
  execute format('insert into public.%I overriding system value select (jsonb_populate_record(null::public.%I,payload)).* from nothingsports_recovery.coverage_repair_rows where version=$1 and table_name=$2',t,t) using version_id,t;
 end loop;
 for item in select * from jsonb_to_recordset(inv->'triggerState') x("table" text,name text,state text) loop
  if not item."table"=any(restore_order) then continue;end if;
  command:=case item.state when 'O' then 'enable' when 'D' then 'disable' when 'R' then 'enable replica' when 'A' then 'enable always' end;
  if command is null then raise exception 'Unexpected recorded trigger state';end if;
  execute format('alter table public.%I %s trigger %I',item."table",command,item.name);
 end loop;
 update nothingsports_recovery.coverage_repair_versions set completed_at=null where version=version_id;
end $undo$;
