-- One exact, reviewed past Rugby fixture. Source evidence and cutover proof:
-- docs/quality/rugby-identity-reconciliation-2026-10-02.md.
-- Apply atomically. Existing provider fixture IDs, user state, analytics and private
-- room/membership identities are not rewritten. No settlement or reminder replay.
set local lock_timeout='5s';
set local statement_timeout='90s';
do $locks$ begin
 perform pg_advisory_xact_lock(hashtext('sportscal:coverage-repair:v1'));
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
end $locks$;

-- Historical duplicate awards remain individual immutable ledger entries. Only
-- the active action key is unique; the existing alias guard and award RPC reject
-- another award when either the active or retained historical entry exists.
alter table public.nothingsports_nsc_points add column if not exists identity_reconciled_into uuid references public.nothingsports_nsc_points(ledger_id) on delete cascade;
alter table public.nothingsports_nsc_points drop constraint if exists nothingsports_nsc_points_user_id_event_id_action_key_key;
create unique index if not exists nothingsports_nsc_points_active_action_key on public.nothingsports_nsc_points(user_id,event_id,action_key) where identity_reconciled_into is null;

-- Retain preimages in the existing unexposed recovery schema. An account erasure
-- removes every repair preimage referring to it, including peer references.
create table if not exists nothingsports_recovery.coverage_repair_subjects(
 version text not null,table_name text not null,row_key text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(version,table_name,row_key,user_id),
 foreign key(version,table_name,row_key) references nothingsports_recovery.coverage_repair_rows(version,table_name,row_key) on delete cascade
);
alter table nothingsports_recovery.coverage_repair_subjects enable row level security;
revoke all on nothingsports_recovery.coverage_repair_subjects from public,anon,authenticated,service_role;
create or replace function nothingsports_recovery.purge_repair_subject_v1()
returns trigger language plpgsql security definer set search_path='' as $body$
begin
 delete from nothingsports_recovery.coverage_repair_rows
 where version=old.version and table_name=old.table_name and row_key=old.row_key;
 return old;
end $body$;
revoke all on function nothingsports_recovery.purge_repair_subject_v1() from public,anon,authenticated,service_role;
drop trigger if exists purge_repair_subject_v1 on nothingsports_recovery.coverage_repair_subjects;
create trigger purge_repair_subject_v1 after delete on nothingsports_recovery.coverage_repair_subjects for each row execute function nothingsports_recovery.purge_repair_subject_v1();

do $preflight$
declare t text;f record;n bigint;begin
 perform pg_advisory_xact_lock(hashtext('sportscal:coverage-repair:v1'));
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 if exists(select 1 from nothingsports_recovery.coverage_repair_versions where version='rugby-identity.20261002' and completed_at is not null) then return;end if;
 if exists(select 1 from information_schema.columns c join information_schema.tables b using(table_schema,table_name) where c.table_schema='public' and c.column_name='event_id' and b.table_type='BASE TABLE' and not c.table_name=any(array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_marquee_campaigns','nothingsports_nsc_completed_fixtures','nothingsports_nsc_contributions','nothingsports_nsc_foresight_settlements','nothingsports_nsc_likes','nothingsports_nsc_marquee_sessions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_presence','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_saved_game_media','nothingsports_score_fixtures','nothingsports_score_votes'])) then raise exception 'New event activity table requires Rugby repair review';end if;
 insert into nothingsports_recovery.coverage_repair_versions(version) values('rugby-identity.20261002') on conflict do nothing;
 foreach t in array array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_marquee_campaigns','nothingsports_nsc_completed_fixtures','nothingsports_nsc_contributions','nothingsports_nsc_foresight_settlements','nothingsports_nsc_likes','nothingsports_nsc_marquee_sessions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_presence','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_saved_game_media','nothingsports_score_fixtures','nothingsports_score_votes'] loop
  execute format('lock table public.%I in share row exclusive mode',t);
  execute format('insert into nothingsports_recovery.coverage_repair_rows select %L,%L,md5(to_jsonb(s)::text),to_jsonb(s) from public.%I s where event_id in (''rugby-australia-south-africa-2026-09-27'',''fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture:rugby:ra:949625'',''fixture-rugby-ra-949625'') on conflict do nothing','rugby-identity.20261002',t,t);
 end loop;
 -- Fail closed if new, unsupported activity appears between the preflight and
 -- cutover. Settlement receipts, pending predictions and campaigns need review.
 foreach t in array array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_marquee_campaigns','nothingsports_nsc_completed_fixtures','nothingsports_nsc_foresight_settlements','nothingsports_nsc_likes','nothingsports_nsc_marquee_sessions','nothingsports_nsc_presence','nothingsports_predictions','nothingsports_saved_game_media'] loop
  execute format('select count(*) from public.%I where event_id in (''rugby-australia-south-africa-2026-09-27'',''fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture:rugby:ra:949625'',''fixture-rugby-ra-949625'')',t) into n;
  if n>0 then raise exception 'Rugby repair requires additional activity review: %',t;end if;
 end loop;
 if exists(select 1 from public.nothingsports_reminders where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625') and (dispatched_at is null or claimed_at is not null)) then raise exception 'Rugby reminder delivery state needs review';end if;
 if exists(select 1 from public.nothingsports_prediction_rules where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625') group by version,cutoff,completed_at,settled_at having count(*)<>(select count(*) from public.nothingsports_prediction_rules where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625'))) then raise exception 'Rugby prediction rules disagree';end if;
 if not exists(select 1 from public.nothingsports_score_fixtures where event_id='rugby-australia-south-africa-2026-09-27') then raise exception 'Retained Rugby score parent is missing';end if;
 for f in select p.oid,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
 where (ns.nspname='nothingsports_recovery' and p.proname='fixture_alias_v1') or (ns.nspname='public' and p.proname in ('nothingsports_nsc_award_points','nothingsports_nsc_submit_rating','nothingsports_nsc_record_unconfirmed_opinion','nothingsports_rate_v2','nothingsports_resolve_predictions','nothingsports_resolve_predictions_legacy')) loop
  insert into nothingsports_recovery.coverage_repair_rows values('rugby-identity.20261002','@function',f.oid::regprocedure::text,jsonb_build_object('definition',f.definition)) on conflict do nothing;
 end loop;
 insert into nothingsports_recovery.coverage_repair_subjects
 select r.version,r.table_name,r.row_key,u.id from nothingsports_recovery.coverage_repair_rows r join auth.users u on position(u.id::text in r.payload::text)>0 where r.version='rugby-identity.20261002' and r.table_name<>'@function' on conflict do nothing;
end $preflight$;

create or replace function nothingsports_recovery.fixture_alias_v1(value text) returns text language sql immutable set search_path='' as $body$
 select coalesce($aliases${"fixture:cricket:CA:40593":"fixture:cricket:espn:1525658","fixture:rugby:wr:ac4f516c-300d-4f4b-85ea-514f0be5ddf6":"rugby-new-zealand-australia-2026-10-10","evt_87":"fixture:cricket:espn:1525659","evt_88":"fixture:cricket:espn:1525660","evt_89":"fixture:cricket:espn:1525661","fixture-cricket-espn-1525658":"fixture:cricket:espn:1525658","fixture-cricket-espn-1525659":"fixture:cricket:espn:1525659","fixture-cricket-espn-1525660":"fixture:cricket:espn:1525660","fixture-cricket-espn-1525661":"fixture:cricket:espn:1525661","fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945":"rugby-australia-south-africa-2026-09-27","fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945":"rugby-australia-south-africa-2026-09-27","fixture:rugby:ra:949625":"rugby-australia-south-africa-2026-09-27","fixture-rugby-ra-949625":"rugby-australia-south-africa-2026-09-27"}$aliases$::jsonb->>value,value);
$body$;
revoke all on function nothingsports_recovery.fixture_alias_v1(text) from public,anon,authenticated;
grant usage on schema nothingsports_recovery to service_role;
grant execute on function nothingsports_recovery.fixture_alias_v1(text) to service_role;

-- Canonicalise RPC arguments before locking, reading, computing caps or writing.
-- Preserve the current definitions, security mode, search path and existing ACLs.
-- SQL wrapper functions delegate to these routines; row triggers cover direct
-- REST inserts. A legacy deployed API cannot create a second reward ledger.
do $rpc$
declare f record;definition text;injection text;begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('nothingsports_nsc_award_points','nothingsports_nsc_submit_rating','nothingsports_nsc_record_unconfirmed_opinion','nothingsports_rate_v2','nothingsports_resolve_predictions','nothingsports_resolve_predictions_legacy') loop
  definition:=pg_get_functiondef(f.oid);
  if position('-- reviewed-fixture-rpc-identity-v1' in definition)>0 then continue;end if;
  injection:=E'begin\n -- reviewed-fixture-rpc-identity-v1\n target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);\n';
  if f.proname='nothingsports_rate_v2' then
   injection:=injection||E' if target_event_id=\'rugby-australia-south-africa-2026-09-27\' then fixture_start:=\'2026-09-27T09:45:00Z\'::timestamptz;end if;\n';
  end if;
  if definition !~* '\mbegin\M' then raise exception 'Unexpected reviewed RPC body: %',f.proname;end if;
  definition:=regexp_replace(definition,'\mbegin\M',injection,'i');
  execute definition;
 end loop;
end $rpc$;

do $repair$
declare t text;credits jsonb;after_credits jsonb;history_count bigint;rooms_hash text;repair_inventory jsonb;state_hash text;post_state jsonb:='{}';begin
 if exists(select 1 from nothingsports_recovery.coverage_repair_versions where version='rugby-identity.20261002' and completed_at is not null) then return;end if;
 select jsonb_agg(x order by user_id,sydney_day) into credits from (select user_id,sydney_day,sum(points) points from public.nothingsports_nsc_points group by user_id,sydney_day) x;
 select count(*) into history_count from public.nothingsports_nsc_rating_history;
 select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) into rooms_hash from public.nothingsports_chat_rooms r;
 repair_inventory:=jsonb_build_object('creditsBefore', (select coalesce(sum(points),0) from public.nothingsports_nsc_points where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625')),
 'ratingHistoryBefore',history_count,'recoveryRows',(select count(*) from nothingsports_recovery.coverage_repair_rows where version='rugby-identity.20261002' and table_name<>'@function'));
 -- Reconciliation changes identity, never submission behaviour or notifications.
 alter table public.nothingsports_nsc_contributions disable trigger consensus_vote;
 alter table public.nothingsports_nsc_contributions disable trigger nothingsports_live_rating_alert_outbox;
 alter table public.nothingsports_nsc_contributions disable trigger nothingsports_nsc_lock_submitted_contribution;
 alter table public.nothingsports_nsc_contributions disable trigger nsc_rating_history;
 alter table public.nothingsports_nsc_contributions disable trigger nsc_vote_scoring_version;
 alter table public.nothingsports_score_fixtures disable trigger prediction_rule;
 -- Keep the latest current rating in each phase/bucket; all history and preimages survive.
 delete from public.nothingsports_nsc_contributions where ctid in (
  select tid from (select ctid tid,row_number() over(partition by user_id,phase,bucket_start order by greatest(updated_at,submitted_at) desc nulls last,(event_id='rugby-australia-south-africa-2026-09-27') desc,contribution_id) n from public.nothingsports_nsc_contributions where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625')) ranked where n>1);
 -- Keep original ledger IDs, amounts, award dates, categories and action keys.
 -- The older source's duplicate is linked to the retained action, not deleted.
 with ranked as (select ledger_id,first_value(ledger_id) over(partition by user_id,action_key order by (event_id='rugby-australia-south-africa-2026-09-27') desc,awarded_at,ledger_id) keep_id from public.nothingsports_nsc_points where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625'))
 update public.nothingsports_nsc_points p set identity_reconciled_into=r.keep_id from ranked r where p.ledger_id=r.ledger_id and r.ledger_id<>r.keep_id;
 delete from public.nothingsports_friend_activity where ctid in (
 select tid from (select ctid tid,row_number() over(partition by recipient_user_id,rater_user_id,phase order by created_at desc,id) n from public.nothingsports_friend_activity where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625')) ranked where n>1);
 delete from public.nothingsports_score_votes where ctid in (
 select tid from (select ctid tid,row_number() over(partition by user_id,phase,rating order by recorded_at desc,(event_id='rugby-australia-south-africa-2026-09-27') desc) n from public.nothingsports_score_votes where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625')) ranked where n>1);
 delete from public.nothingsports_reminders where ctid in (
 select tid from (select ctid tid,row_number() over(partition by installation_id order by (event_id='rugby-australia-south-africa-2026-09-27') desc,updated_at desc,id) n from public.nothingsports_reminders where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625')) ranked where n>1);
 delete from public.nothingsports_prediction_rules where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625') and event_id<>'rugby-australia-south-africa-2026-09-27';
 foreach t in array array['nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_friend_activity','nothingsports_score_votes','nothingsports_reminders','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_nsc_rating_history','nothingsports_nsc_prediction_revisions'] loop
  execute format('update public.%I set event_id=%L where event_id in (''rugby-australia-south-africa-2026-09-27'',''fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture:rugby:ra:949625'',''fixture-rugby-ra-949625'') and event_id<>%L',t,'rugby-australia-south-africa-2026-09-27','rugby-australia-south-africa-2026-09-27');
 end loop;
 delete from public.nothingsports_score_fixtures where event_id in ('rugby-australia-south-africa-2026-09-27','fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945','fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945','fixture:rugby:ra:949625','fixture-rugby-ra-949625') and event_id<>'rugby-australia-south-africa-2026-09-27';
 update public.nothingsports_score_fixtures set starts_at='2026-09-27T09:45:00Z' where event_id='rugby-australia-south-africa-2026-09-27';
 alter table public.nothingsports_nsc_contributions enable trigger consensus_vote;
 alter table public.nothingsports_nsc_contributions enable trigger nothingsports_live_rating_alert_outbox;
 alter table public.nothingsports_nsc_contributions enable trigger nothingsports_nsc_lock_submitted_contribution;
 alter table public.nothingsports_nsc_contributions enable trigger nsc_rating_history;
 alter table public.nothingsports_nsc_contributions enable trigger nsc_vote_scoring_version;
 alter table public.nothingsports_score_fixtures enable trigger prediction_rule;
 select jsonb_agg(x order by user_id,sydney_day) into after_credits from (select user_id,sydney_day,sum(points) points from public.nothingsports_nsc_points group by user_id,sydney_day) x;
 if credits is distinct from after_credits then raise exception 'Earned credit or daily inventory changed';end if;
 if history_count<>(select count(*) from public.nothingsports_nsc_rating_history) then raise exception 'Rating history changed';end if;
 if rooms_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from public.nothingsports_chat_rooms r) then raise exception 'Private rooms changed';end if;
 foreach t in array array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_marquee_campaigns','nothingsports_nsc_completed_fixtures','nothingsports_nsc_contributions','nothingsports_nsc_foresight_settlements','nothingsports_nsc_likes','nothingsports_nsc_marquee_sessions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_presence','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_saved_game_media','nothingsports_score_fixtures','nothingsports_score_votes'] loop
  execute format('select count(*) from public.%I where event_id in (''rugby-australia-south-africa-2026-09-27'',''fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture:rugby:ra:949625'',''fixture-rugby-ra-949625'') and event_id<>%L',t,'rugby-australia-south-africa-2026-09-27') into history_count;
  if history_count>0 then raise exception 'Unresolved Rugby activity in %',t;end if;
 end loop;
 repair_inventory:=repair_inventory||jsonb_build_object('creditsAfter',(select coalesce(sum(points),0) from public.nothingsports_nsc_points where event_id='rugby-australia-south-africa-2026-09-27'),'ratingHistoryAfter',(select count(*) from public.nothingsports_nsc_rating_history),'privateRoomsUnchanged',true,'completedWithoutReplay',true);
 foreach t in array array['nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_fixture_participation','nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_marquee_campaigns','nothingsports_nsc_completed_fixtures','nothingsports_nsc_contributions','nothingsports_nsc_foresight_settlements','nothingsports_nsc_likes','nothingsports_nsc_marquee_sessions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_presence','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_predictions','nothingsports_reminders','nothingsports_saved_game_media','nothingsports_score_fixtures','nothingsports_score_votes'] loop
  execute format('select md5(coalesce(string_agg(to_jsonb(r)::text,'''' order by to_jsonb(r)::text),'''')) from public.%I r where event_id in (''rugby-australia-south-africa-2026-09-27'',''fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture:rugby:ra:949625'',''fixture-rugby-ra-949625'')',t) into state_hash;
  post_state:=post_state||jsonb_build_object(t,state_hash);
 end loop;
 repair_inventory:=repair_inventory||jsonb_build_object('postState',post_state,'functionPostState',(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='nothingsports_recovery' and p.proname='fixture_alias_v1') or (n.nspname='public' and p.proname in ('nothingsports_nsc_award_points','nothingsports_nsc_submit_rating','nothingsports_nsc_record_unconfirmed_opinion','nothingsports_rate_v2','nothingsports_resolve_predictions','nothingsports_resolve_predictions_legacy'))));
 update nothingsports_recovery.coverage_repair_versions set completed_at=clock_timestamp(),inventory=repair_inventory where version='rugby-identity.20261002';
end $repair$;

-- Deployment runs before consolidation. Only this fixture's writes pause until
-- the atomic repair completes; reads include both historical IDs throughout.
create or replace function public.nothingsports_rugby_identity_ready()
returns boolean language sql stable security definer set search_path='' as $ready$
 select exists(select 1 from nothingsports_recovery.coverage_repair_versions where version='rugby-identity.20261002' and completed_at is not null);
$ready$;
revoke all on function public.nothingsports_rugby_identity_ready() from public,anon,authenticated;
grant execute on function public.nothingsports_rugby_identity_ready() to service_role;
