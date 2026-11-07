-- Exact future fixture only. App/read gate deploys before this atomic cutover.
-- Retain original ledgers/history/receipts and private room/saved-state boundaries.
-- No delivery, settlement, new source or scheduler. Rehearse before production.
set local lock_timeout='5s';
set local statement_timeout='90s';
do $repair$
declare
 version_id constant text:='bledisloe-identity.20261002';
 canonical constant text:='rugby-australia-new-zealand-2026-10-17';
 ids constant text[]:=array['rugby-australia-new-zealand-2026-10-17','fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8','fixture-rugby-wr-e3cbae12-66b3-4835-b1ce-4014b63055c8','fixture:rugby:ra:949627','fixture-rugby-ra-949627'];
 event_tables constant text[]:=array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_marquee_campaigns','nothingsports_nsc_completed_fixtures','nothingsports_nsc_contributions','nothingsports_nsc_foresight_settlements','nothingsports_nsc_likes','nothingsports_nsc_marquee_sessions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_presence','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_saved_game_media','nothingsports_score_fixtures','nothingsports_score_votes'];
 tables text[];t text;col text;v_count bigint;v_function record;definition text;v_aliases jsonb;old_aliases text;
 credits jsonb;after_credits jsonb;history_count bigint;revision_count bigint;rooms_hash text;state_hash text;post_state jsonb:='{}';repair_inventory jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('sportscal:coverage-repair:v1'));
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 if exists(select 1 from nothingsports_recovery.coverage_repair_versions where version=version_id and completed_at is not null) then return;end if;
 if clock_timestamp()>='2026-10-17T05:00:00Z'::timestamptz then raise exception 'Future Bledisloe cutover window has closed';end if;
 if exists(select 1 from information_schema.columns c join information_schema.tables b using(table_schema,table_name) where c.table_schema='public' and c.column_name='event_id' and b.table_type='BASE TABLE' and not c.table_name=any(event_tables)) then raise exception 'New event activity table requires Bledisloe review';end if;
 if exists(select 1 from public.nothingsports_nsc_points p join public.nothingsports_nsc_points q on q.ledger_id=p.identity_reconciled_into where (p.event_id=any(ids)) is distinct from (q.event_id=any(ids))) then raise exception 'Cross-fixture ledger link requires Bledisloe review';end if;
 tables:=event_tables||array['nothingsports_reminder_intents'];
 foreach t in array tables loop execute format('lock table public.%I in share row exclusive mode',t);end loop;
 lock table public.nothingsports_user_state,public.nothingsports_chat_rooms,public.nothingsports_account_erasure_blocks in share row exclusive mode;
 -- Future predictions and unsent deliveries are supported; settled or active
 -- live-session state must not be reinterpreted by a schedule correction.
 foreach t in array array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_nsc_completed_fixtures','nothingsports_nsc_foresight_settlements','nothingsports_nsc_marquee_sessions','nothingsports_saved_game_media'] loop
  execute format('select count(*) from public.%I where event_id=any($1)',t) into v_count using ids;
  if v_count>0 then raise exception 'Bledisloe activity requires additional review: %',t;end if;
 end loop;
 if not exists(select 1 from public.nothingsports_score_fixtures where event_id=canonical) then raise exception 'Retained Bledisloe score parent missing';end if;
 if exists(select 1 from public.nothingsports_score_fixtures where event_id=any(ids) and status not in('scheduled','upcoming')) then raise exception 'Bledisloe is no longer a future fixture';end if;
 if exists(select 1 from public.nothingsports_predictions where event_id=any(ids) and (result<>'pending' or resolved_at is not null or matched_user_id is not null)) then raise exception 'Settled Bledisloe prediction requires review';end if;
 if exists(select 1 from public.nothingsports_prediction_rules where event_id=any(ids) and (cutoff is not null or completed_at is not null or settled_at is not null)) or (select count(distinct version) from public.nothingsports_prediction_rules where event_id=any(ids))>1 then raise exception 'Bledisloe prediction rules disagree';end if;
 if exists(select 1 from public.nothingsports_reminders where event_id=any(ids) and claimed_at is not null and dispatched_at is null) then raise exception 'Bledisloe reminder claim requires review';end if;
 if exists(select 1 from public.nothingsports_reminders where event_id=any(ids) and dispatched_at is null and delivery_started_at is null and delivery_mode<>'match-15') then raise exception 'Bledisloe reminder mode requires review';end if;
 if exists(select 1 from public.nothingsports_reminder_intents i join public.nothingsports_account_erasure_blocks b using(user_id) where i.fixture_id=any(ids)) then raise exception 'Erasing Bledisloe account requires review';end if;
 if exists(select 1 from public.nothingsports_marquee_campaigns where event_id=any(ids) and event_id<>canonical) then raise exception 'Legacy Bledisloe campaign requires explicit review';end if;
 if exists(select 1 from pg_trigger where tgrelid in('public.nothingsports_nsc_contributions'::regclass,'public.nothingsports_score_fixtures'::regclass) and tgname in('consensus_vote','nothingsports_live_rating_alert_outbox','nothingsports_nsc_lock_submitted_contribution','nsc_rating_history','nsc_vote_scoring_version','prediction_rule') and tgenabled<>'O') then raise exception 'Bledisloe trigger state requires review';end if;
 insert into nothingsports_recovery.coverage_repair_versions(version) values(version_id) on conflict do nothing;
 foreach t in array tables loop
  col:=case when t='nothingsports_reminder_intents' then 'fixture_id' else 'event_id' end;
  execute format('insert into nothingsports_recovery.coverage_repair_rows select $1,$2,md5(to_jsonb(s)::text),to_jsonb(s) from public.%I s where %I=any($3) on conflict do nothing',t,col) using version_id,t,ids;
 end loop;
 for v_function in select p.oid,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where (ns.nspname='nothingsports_recovery' and p.proname in('fixture_alias_v1','alias_guard_v1')) or (ns.nspname='public' and p.proname in('nothingsports_rate_v2','nothingsports_set_reminder_choice','nothingsports_sync_reminder_choices','nothingsports_reconcile_reminder_accounts')) loop
  insert into nothingsports_recovery.coverage_repair_rows values(version_id,'@function',v_function.oid::regprocedure::text,jsonb_build_object('definition',v_function.definition)) on conflict do nothing;
 end loop;
 insert into nothingsports_recovery.coverage_repair_subjects
 select r.version,r.table_name,r.row_key,u.id from nothingsports_recovery.coverage_repair_rows r join auth.users u on position(u.id::text in r.payload::text)>0 where r.version=version_id and r.table_name<>'@function' on conflict do nothing;
 -- Extend the live reviewed map, preserving aliases added by other modules.
 select pg_get_functiondef('nothingsports_recovery.fixture_alias_v1(text)'::regprocedure) into definition;
 old_aliases:=substring(definition from '\$aliases\$([^$]*)\$aliases\$');
 if old_aliases is null then raise exception 'Reviewed alias function format changed';end if;
 v_aliases:=old_aliases::jsonb;
 foreach t in array ids loop
  if t<>canonical and v_aliases ? t and v_aliases->>t<>canonical then raise exception 'Bledisloe alias conflicts';end if;
  if t<>canonical then v_aliases:=v_aliases||jsonb_build_object(t,canonical);end if;
 end loop;
 execute replace(definition,'$aliases$'||old_aliases||'$aliases$','$aliases$'||v_aliases::text||'$aliases$');
 -- Existing RPCs already canonicalise before locks/awards. Older deployed APIs
 -- must not put their stale kickoff or scheduled window back into the parent.
 select pg_get_functiondef('public.nothingsports_rate_v2(uuid,text,text,integer,timestamptz,timestamptz,text,text,text)'::regprocedure) into definition;
 if position('-- bledisloe-host-timing-v1' in definition)=0 then
  definition:=replace(definition,'-- reviewed-fixture-rpc-identity-v1',E'-- bledisloe-host-timing-v1\n if nothingsports_recovery.fixture_alias_v1(target_event_id)=\'rugby-australia-new-zealand-2026-10-17\' then\n fixture_start:=\'2026-10-17T05:00:00Z\'::timestamptz;\n if fixture_status in(\'scheduled\',\'upcoming\') then fixture_end:=\'2026-10-17T08:00:00Z\'::timestamptz;end if;\n end if;\n -- reviewed-fixture-rpc-identity-v1');
  if position('-- bledisloe-host-timing-v1' in definition)=0 then raise exception 'Reviewed rate RPC format changed';end if;
  execute definition;
 end if;
 -- Older immutable API deployments/dispatcher packets share the same DB.
 -- Canonicalise their choices and pin only this reviewed future schedule.
 select pg_get_functiondef('nothingsports_recovery.alias_guard_v1()'::regprocedure) into definition;
 if position('-- bledisloe-pending-timing-v1' in definition)=0 then
  definition:=replace(definition,'return new;',E'-- bledisloe-pending-timing-v1\n if tg_table_name=\'nothingsports_reminders\' and new.event_id=\'rugby-australia-new-zealand-2026-10-17\' then\n if new.dispatched_at is null and new.delivery_started_at is null and new.delivery_mode=\'match-15\' then\n new.starts_at:=\'2026-10-17T05:00:00Z\'::timestamptz;new.remind_at:=\'2026-10-17T04:45:00Z\'::timestamptz;new.schedule_starts_at:=new.starts_at;\n end if;end if;\n return new;');
  if position('-- bledisloe-pending-timing-v1' in definition)=0 then raise exception 'Alias guard format changed';end if;
  execute definition;
 end if;
 for v_function in select p.oid,p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname in('nothingsports_set_reminder_choice','nothingsports_sync_reminder_choices','nothingsports_reconcile_reminder_accounts') loop
  definition:=v_function.definition;
  if position('-- bledisloe-reminder-identity-v1' in definition)>0 then continue;end if;
  if v_function.proname='nothingsports_set_reminder_choice' then
   definition:=replace(definition,'select * into row from public.nothingsports_user_state',format(E'-- bledisloe-reminder-identity-v1\n fixture_key:=nothingsports_recovery.fixture_alias_v1(fixture_key);\n if fixture_key=\'rugby-australia-new-zealand-2026-10-17\' then fixture_aliases:=(select jsonb_agg(distinct item) from jsonb_array_elements_text(fixture_aliases||%L::jsonb) a(item));end if;\n select * into row from public.nothingsports_user_state',to_jsonb(ids)::text));
  elsif v_function.proname='nothingsports_sync_reminder_choices' then
   definition:=replace(definition,'key:=coalesce(existing.fixture_id,a.value->>''canonicalEventId'',a.key);',E'-- bledisloe-reminder-identity-v1\n key:=nothingsports_recovery.fixture_alias_v1(coalesce(existing.fixture_id,a.value->>\'canonicalEventId\',a.key));');
  else
   definition:=replace(definition,'if exists(select 1 from public.nothingsports_reminders r where r.user_id=p.user_id',format(E'-- bledisloe-reminder-identity-v1\n f.fixture_id:=nothingsports_recovery.fixture_alias_v1(f.fixture_id);\n if f.fixture_id=\'rugby-australia-new-zealand-2026-10-17\' then f.starts_at:=\'2026-10-17T05:00:00Z\'::timestamptz;f.precision:=\'exact\';f.aliases:=(select jsonb_agg(distinct item) from jsonb_array_elements_text(coalesce(f.aliases,\'[]\'::jsonb)||%L::jsonb) a(item));end if;\n if exists(select 1 from public.nothingsports_reminders r where r.user_id=p.user_id',to_jsonb(ids)::text));
  end if;
  if position('-- bledisloe-reminder-identity-v1' in definition)=0 then raise exception 'Reminder RPC format changed: %',v_function.proname;end if;
  execute definition;
 end loop;
 select jsonb_agg(x order by user_id,sydney_day) into credits from(select user_id,sydney_day,sum(points) points from public.nothingsports_nsc_points group by user_id,sydney_day)x;
 select count(*) into history_count from public.nothingsports_nsc_rating_history;
 select count(*) into revision_count from public.nothingsports_nsc_prediction_revisions;
 select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) into rooms_hash from public.nothingsports_chat_rooms r;
 select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by user_id),'')) into state_hash from public.nothingsports_user_state r;
 repair_inventory:=jsonb_build_object('creditsBefore',(select coalesce(sum(points),0) from public.nothingsports_nsc_points where event_id=any(ids)),'triggerState',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',g.tgname,'state',g.tgenabled) order by c.relname,g.tgname) from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(tables) and not g.tgisinternal),'recoveryRows',(select count(*) from nothingsports_recovery.coverage_repair_rows where version=version_id and table_name<>'@function'));
 alter table public.nothingsports_nsc_contributions disable trigger consensus_vote;
 alter table public.nothingsports_nsc_contributions disable trigger nothingsports_live_rating_alert_outbox;
 alter table public.nothingsports_nsc_contributions disable trigger nothingsports_nsc_lock_submitted_contribution;
 alter table public.nothingsports_nsc_contributions disable trigger nsc_rating_history;
 alter table public.nothingsports_nsc_contributions disable trigger nsc_vote_scoring_version;
 alter table public.nothingsports_score_fixtures disable trigger prediction_rule;
 -- Keep each current latest value; original ratings/prediction revisions and
 -- recovery preimages remain. No prediction is settled and no credit is minted.
 delete from public.nothingsports_predictions where ctid in(select tid from(select ctid tid,row_number() over(partition by user_id order by updated_at desc,(event_id=canonical) desc) n from public.nothingsports_predictions where event_id=any(ids))x where x.n>1);
 delete from public.nothingsports_nsc_contributions where ctid in(select tid from(select ctid tid,row_number() over(partition by user_id,phase,bucket_start order by greatest(updated_at,submitted_at) desc nulls last,(event_id=canonical) desc,contribution_id) n from public.nothingsports_nsc_contributions where event_id=any(ids))x where x.n>1);
 with ranked as(select ledger_id,first_value(ledger_id) over(partition by user_id,action_key order by (event_id=canonical) desc,awarded_at,ledger_id) keep_id from public.nothingsports_nsc_points where event_id=any(ids))
 update public.nothingsports_nsc_points p set identity_reconciled_into=r.keep_id from ranked r where p.ledger_id=r.ledger_id and r.ledger_id<>r.keep_id;
 delete from public.nothingsports_friend_activity where ctid in(select tid from(select ctid tid,row_number() over(partition by recipient_user_id,rater_user_id,phase order by created_at desc,id) n from public.nothingsports_friend_activity where event_id=any(ids))x where x.n>1);
 delete from public.nothingsports_score_votes where ctid in(select tid from(select ctid tid,row_number() over(partition by user_id,phase,rating order by recorded_at desc,(event_id=canonical) desc) n from public.nothingsports_score_votes where event_id=any(ids))x where x.n>1);
 delete from public.nothingsports_nsc_likes where ctid in(select tid from(select ctid tid,row_number() over(partition by user_id,phase order by updated_at desc,(event_id=canonical) desc) n from public.nothingsports_nsc_likes where event_id=any(ids))x where x.n>1);
 delete from public.nothingsports_nsc_presence where ctid in(select tid from(select ctid tid,row_number() over(partition by user_id order by last_heartbeat_at desc,(event_id=canonical) desc) n from public.nothingsports_nsc_presence where event_id=any(ids))x where x.n>1);
 -- Explicit choices outrank automatic derivation; newest explicit decision wins,
 -- with OFF winning an exact timestamp tie. Add legacy keys for offline replay.
 with expanded as(select user_id,jsonb_agg(distinct a.alias) aliases from public.nothingsports_reminder_intents i cross join lateral jsonb_array_elements_text(i.aliases||to_jsonb(ids)) a(alias) where fixture_id=any(ids) group by user_id)
 update public.nothingsports_reminder_intents i set aliases=e.aliases from expanded e where i.user_id=e.user_id and i.fixture_id=any(ids);
 delete from public.nothingsports_reminder_intents where ctid in(select tid from(select ctid tid,row_number() over(partition by user_id order by (choice in('on','off')) desc,chosen_at desc nulls last,(choice='off') desc,(fixture_id=canonical) desc) n from public.nothingsports_reminder_intents where fixture_id=any(ids))x where x.n>1);
 update public.nothingsports_reminder_intents set fixture_id=canonical where fixture_id=any(ids) and fixture_id<>canonical;
 -- One row per installation carries ALL delivery-begin/completion evidence.
 -- A claimed row fails above; unknown in-flight outcomes are never reset.
 with ranked as(select id,installation_id,row_number() over(partition by installation_id order by (dispatched_at is not null) desc,(delivery_started_at is not null) desc,(event_id=canonical) desc,updated_at desc,id) rn from public.nothingsports_reminders where event_id=any(ids)), folded as(select installation_id,min(dispatched_at) dispatched,min(delivery_started_at) started,sum(attempts)::integer attempts from public.nothingsports_reminders where event_id=any(ids) group by installation_id)
 update public.nothingsports_reminders r set dispatched_at=f.dispatched,delivery_started_at=f.started,attempts=f.attempts from ranked k join folded f using(installation_id) where r.id=k.id and k.rn=1;
 delete from public.nothingsports_reminders where ctid in(select tid from(select ctid tid,row_number() over(partition by installation_id order by (dispatched_at is not null) desc,(delivery_started_at is not null) desc,(event_id=canonical) desc,updated_at desc,id) n from public.nothingsports_reminders where event_id=any(ids))x where x.n>1);
 update public.nothingsports_reminders r set starts_at='2026-10-17T05:00:00Z',remind_at='2026-10-17T04:45:00Z',schedule_starts_at='2026-10-17T05:00:00Z',schedule_checked_at='2026-10-02T08:24:46.814Z',schedule_state=case when exists(select 1 from public.nothingsports_reminder_intents i where i.user_id=r.user_id and i.fixture_id=canonical and i.choice='off') then 'off' when r.schedule_state in('off','held') then r.schedule_state when exists(select 1 from public.nothingsports_reminder_intents i where i.user_id=r.user_id and i.fixture_id=canonical and i.enabled and i.choice<>'off') then 'ready' else 'held' end,updated_at=clock_timestamp()
 where r.event_id=any(ids) and r.dispatched_at is null and r.delivery_started_at is null;
 -- Keep published/exported material as history; flag stale timing for the
 -- existing owner review. Unpublished draft prose and approval state survive.
 update public.nothingsports_marquee_campaigns set export_stale=case when exported_at is not null then true else export_stale end,correction_required=true where event_id=canonical and (not correction_required or (exported_at is not null and not export_stale));
 -- Keep one unchanged scoring version; never infer completion or a cutoff.
 if not exists(select 1 from public.nothingsports_prediction_rules where event_id=canonical) then
  insert into public.nothingsports_prediction_rules select canonical,version,completed_at,cutoff,settled_at from public.nothingsports_prediction_rules where event_id=any(ids) limit 1;
 end if;
 delete from public.nothingsports_prediction_rules where event_id=any(ids) and event_id<>canonical;
 foreach t in array array['nothingsports_predictions','nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_friend_activity','nothingsports_score_votes','nothingsports_reminders','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_nsc_likes','nothingsports_nsc_presence','nothingsports_nsc_rating_history','nothingsports_nsc_prediction_revisions'] loop
  execute format('update public.%I set event_id=$1 where event_id=any($2) and event_id<>$1',t) using canonical,ids;
 end loop;
 delete from public.nothingsports_score_fixtures where event_id=any(ids) and event_id<>canonical;
 update public.nothingsports_score_fixtures set starts_at='2026-10-17T05:00:00Z',ends_at='2026-10-17T08:00:00Z' where event_id=canonical;
 alter table public.nothingsports_nsc_contributions enable trigger consensus_vote;
 alter table public.nothingsports_nsc_contributions enable trigger nothingsports_live_rating_alert_outbox;
 alter table public.nothingsports_nsc_contributions enable trigger nothingsports_nsc_lock_submitted_contribution;
 alter table public.nothingsports_nsc_contributions enable trigger nsc_rating_history;
 alter table public.nothingsports_nsc_contributions enable trigger nsc_vote_scoring_version;
 alter table public.nothingsports_score_fixtures enable trigger prediction_rule;
 -- Intent uses fixture_id rather than event_id. The exact new alias group
 -- also needs the direct service upsert guard; no other intent is rewritten.
 execute $ddl$create or replace function nothingsports_recovery.bledisloe_intent_alias_guard_v1() returns trigger language plpgsql security invoker set search_path='' as $guard$
 begin if nothingsports_recovery.fixture_alias_v1(new.fixture_id)='rugby-australia-new-zealand-2026-10-17' then new.fixture_id:='rugby-australia-new-zealand-2026-10-17';new.aliases:=(select jsonb_agg(distinct item) from jsonb_array_elements_text(coalesce(new.aliases,'[]'::jsonb)||'["rugby-australia-new-zealand-2026-10-17","fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8","fixture-rugby-wr-e3cbae12-66b3-4835-b1ce-4014b63055c8","fixture:rugby:ra:949627","fixture-rugby-ra-949627"]'::jsonb) a(item));end if;return new;end $guard$;$ddl$;
 revoke all on function nothingsports_recovery.bledisloe_intent_alias_guard_v1() from public,anon,authenticated,service_role;
 if not exists(select 1 from pg_trigger where tgrelid='public.nothingsports_reminder_intents'::regclass and tgname='bledisloe_intent_alias_v1') then
  create trigger bledisloe_intent_alias_v1 before insert or update of fixture_id on public.nothingsports_reminder_intents for each row execute function nothingsports_recovery.bledisloe_intent_alias_guard_v1();
 end if;
 select jsonb_agg(x order by user_id,sydney_day) into after_credits from(select user_id,sydney_day,sum(points) points from public.nothingsports_nsc_points group by user_id,sydney_day)x;
 if credits is distinct from after_credits then raise exception 'Bledisloe earned credit/day inventory changed';end if;
 if history_count<>(select count(*) from public.nothingsports_nsc_rating_history) or revision_count<>(select count(*) from public.nothingsports_nsc_prediction_revisions) then raise exception 'Bledisloe history/revisions changed';end if;
 if rooms_hash is distinct from(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from public.nothingsports_chat_rooms r) or state_hash is distinct from(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by user_id),'')) from public.nothingsports_user_state r) then raise exception 'Private rooms or saved state changed';end if;
 foreach t in array tables loop
  col:=case when t='nothingsports_reminder_intents' then 'fixture_id' else 'event_id' end;
  execute format('select count(*) from public.%I where %I=any($1) and %I<>$2',t,col,col) into v_count using ids,canonical;
  if v_count>0 then raise exception 'Unresolved Bledisloe activity: %',t;end if;
  execute format('select md5(coalesce(string_agg(to_jsonb(r)::text,'''' order by to_jsonb(r)::text),'''')) from public.%I r where %I=any($1)',t,col) into state_hash using ids;
  post_state:=post_state||jsonb_build_object(t,state_hash);
 end loop;
 repair_inventory:=repair_inventory||jsonb_build_object('creditsAfter',(select coalesce(sum(points),0) from public.nothingsports_nsc_points where event_id=canonical),'ratingHistory',history_count,'predictionRevisions',revision_count,'privateRoomsUnchanged',true,'savedStateUnchanged',true,'completedWithoutReplay',true,'triggerPostState',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',g.tgname,'state',g.tgenabled) order by c.relname,g.tgname) from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(tables) and not g.tgisinternal),'postState',post_state,'functionPostState',(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where (ns.nspname='nothingsports_recovery' and p.proname in('fixture_alias_v1','alias_guard_v1')) or (ns.nspname='public' and p.proname in('nothingsports_rate_v2','nothingsports_set_reminder_choice','nothingsports_sync_reminder_choices','nothingsports_reconcile_reminder_accounts'))));
 update nothingsports_recovery.coverage_repair_versions set completed_at=clock_timestamp(),inventory=repair_inventory where version=version_id;
end $repair$;
-- Keep privileged access in the existing unexposed recovery schema; expose
-- only the service-role boolean wrapper, never the preimages.
create or replace function nothingsports_recovery.bledisloe_identity_ready_v1()
returns boolean language sql stable security definer set search_path='' as $ready$
 select exists(select 1 from nothingsports_recovery.coverage_repair_versions where version='bledisloe-identity.20261002' and completed_at is not null);
$ready$;
revoke all on function nothingsports_recovery.bledisloe_identity_ready_v1() from public,anon,authenticated;
grant execute on function nothingsports_recovery.bledisloe_identity_ready_v1() to service_role;
create or replace function public.nothingsports_bledisloe_identity_ready()
returns boolean language sql stable security invoker set search_path='' as $ready$
 select nothingsports_recovery.bledisloe_identity_ready_v1();
$ready$;
revoke all on function public.nothingsports_bledisloe_identity_ready() from public,anon,authenticated;
grant execute on function public.nothingsports_bledisloe_identity_ready() to service_role;
