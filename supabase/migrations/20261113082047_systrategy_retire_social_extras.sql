-- sySTRATEGY: disable retired writers without deleting feature data.
-- The irreversible purge is a separate, production-acceptance-gated operation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
drop trigger if exists consensus_vote on public.nothingsports_nsc_contributions;
drop trigger if exists nsc_vote_scoring_version on public.nothingsports_nsc_contributions;
CREATE OR REPLACE FUNCTION public.nothingsports_rate_v2(target_user_id uuid, target_event_id text, target_phase text, target_rating integer, fixture_start timestamp with time zone, fixture_end timestamp with time zone, fixture_status text, fixture_sport text, fixture_gender text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare ts timestamptz:=clock_timestamp();expected text;award integer:=0;prior integer;reviewed_clock jsonb;begin
 -- bledisloe-host-timing-v1
 if nothingsports_recovery.fixture_alias_v1(target_event_id)='rugby-australia-new-zealand-2026-10-17' then
 fixture_start:='2026-10-17T05:00:00Z'::timestamptz;
 if fixture_status in('scheduled','upcoming') then fixture_end:='2026-10-17T08:00:00Z'::timestamptz;end if;
 end if;
 -- reviewed-fixture-rpc-identity-v1
 target_event_id:=nothingsports_recovery.fixture_alias_v1(target_event_id);
 if target_event_id='rugby-australia-south-africa-2026-09-27' then fixture_start:='2026-09-27T09:45:00Z'::timestamptz;end if;

 if target_rating not between 1 and 5 or target_phase not in('heat','pulse','impact') or target_user_id is null then raise exception 'invalid_rating';end if;
 if exists(select 1 from public.nothingsports_nsc_personas where user_id=target_user_id and moderation_flag) then raise exception 'profile_moderated';end if;
 -- Serialize the retained rating write per fixture, independently of rewards.
 perform pg_advisory_xact_lock(hashtextextended('fixture:'||target_event_id,0));
 reviewed_clock:=nothingsports_recovery.epl_reward_clock_v1(target_event_id,fixture_status,fixture_end);
 if reviewed_clock is not null then
  fixture_start:=(reviewed_clock->>'starts_at')::timestamptz;
  fixture_end:=(reviewed_clock->>'ends_at')::timestamptz;
  fixture_status:=reviewed_clock->>'status';fixture_sport:='football';
 end if;
 expected:=case when fixture_status in('cancelled','canceled','abandoned','postponed') then null when fixture_status in('completed','finished','final') then 'impact' when fixture_status in('live','inprogress','in_progress','in-progress') then 'pulse' when fixture_start is null or ts<fixture_start then 'heat' when ts<fixture_end then 'pulse' else 'impact' end;
 if expected is null or expected<>target_phase then raise exception 'phase_action_mismatch';end if;


 select rating into prior from public.nothingsports_nsc_contributions
 where user_id=target_user_id and event_id=any(nothingsports_recovery.epl_operating_ids_v1(target_event_id))
 and phase=target_phase order by greatest(updated_at,submitted_at) desc nulls last,(event_id=target_event_id) desc,contribution_id limit 1;
 if prior=target_rating then
 return jsonb_build_object('eventId',target_event_id,'phase',target_phase,'rating',target_rating,'submitted',true,'pointsAwarded',0,'replayed',true);end if;
 insert into public.nothingsports_nsc_contributions(event_id,user_id,phase,bucket_start,rating,tags,submitted_at,updated_at,scoring_version,maximum_points)
 values(target_event_id,target_user_id,target_phase,'1970-01-01T00:00:00Z'::timestamptz,target_rating,'{}',ts,ts,'ratings.v1',null)
 on conflict(event_id,user_id,phase,bucket_start) do update set rating=excluded.rating,updated_at=excluded.updated_at,scoring_version=excluded.scoring_version,maximum_points=null;
 return jsonb_build_object('eventId',target_event_id,'phase',target_phase,'rating',target_rating,'submitted',true,'submittedAt',ts,'pointsAwarded',0,'basePointsAwarded',0);
end $function$;
;
CREATE OR REPLACE FUNCTION public.nothingsports_follow_person(actor uuid, target_profile uuid, following boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target uuid;new_relationship boolean:=false;begin
 perform pg_advisory_xact_lock(hashtextextended('follow:'||actor||':'||target_profile,0));
 select p.user_id into target from public.nothingsports_nsc_profiles p where p.profile_id=target_profile and (not following or (p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)));
 if target is null or target=actor then raise exception 'invalid_public_profile';end if;
 if following then
  insert into public.nothingsports_user_follows values(actor,target,clock_timestamp()) on conflict do nothing;
  new_relationship:=found;
  if new_relationship then
   insert into public.nothingsports_social_notifications(recipient_user_id,actor_user_id,kind,points,dedupe_key)
   values(target,actor,'profile_followed',0,'profile-follow:'||actor||':'||target)
   on conflict(dedupe_key) do nothing;
  end if;
 else
  delete from public.nothingsports_user_follows where follower_user_id=actor and followed_user_id=target;
 end if;
 return jsonb_build_object('targetProfileId',target_profile,'following',following);
end $function$
;
CREATE OR REPLACE FUNCTION public.nothingsports_copy_picks(actor uuid, source_profile uuid, expected_preferences jsonb, expected_events jsonb, new_preferences jsonb, new_events jsonb, added_sports text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare source_user uuid;state public.nothingsports_user_state%rowtype;begin

 select user_id into source_user from public.nothingsports_nsc_profiles p where profile_id=source_profile and visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag);
 if source_user is null or source_user=actor then raise exception 'invalid_public_profile';end if;
 insert into public.nothingsports_user_state(user_id) values(actor) on conflict do nothing;
 select * into state from public.nothingsports_user_state where user_id=actor for update;
 if state.preferences<>expected_preferences or state.event_user_state<>expected_events then raise exception 'preferences_changed_retry';end if;
 update public.nothingsports_user_state set preferences=new_preferences,event_user_state=new_events,updated_at=clock_timestamp() where user_id=actor;
 if coalesce(cardinality(added_sports),0)>0 then
 insert into public.nothingsports_social_notifications(recipient_user_id,actor_user_id,kind,points,dedupe_key)
 values(source_user,actor,'follows_copied',0,'follows-copied:'||actor||':'||source_user)
 on conflict(dedupe_key) do nothing;
 end if;
 return jsonb_build_object('preferences',new_preferences,'eventUserState',new_events,'bonusAwarded',0);
end $function$;

CREATE OR REPLACE FUNCTION public.nothingsports_enqueue_live_rating_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare f record;activity uuid;group_id uuid;begin
 if tg_op='UPDATE' and new.rating is not distinct from old.rating then return new;end if;
 if new.rating<>5 or new.phase not in('heat','pulse','impact') or new.submitted_at is null then return new;end if;
 if not exists(select 1 from public.nothingsports_nsc_profiles where user_id=new.user_id and visibility='visible') or exists(select 1 from public.nothingsports_nsc_personas where user_id=new.user_id and moderation_flag) then return new;end if;
 for f in select follower_user_id from public.nothingsports_user_follows where followed_user_id=new.user_id loop
 perform pg_advisory_xact_lock(hashtextextended('alert:'||f.follower_user_id||new.event_id,0));
 activity:=null;
 insert into public.nothingsports_friend_activity(recipient_user_id,rater_user_id,event_id,phase) values(f.follower_user_id,new.user_id,new.event_id,new.phase) on conflict do nothing returning id into activity;
 if activity is not null then
 select id into group_id from public.nothingsports_live_rating_alerts where recipient_user_id=f.follower_user_id and event_id=new.event_id and completed_at is null and ready_at>clock_timestamp() order by created_at desc limit 1;
 if group_id is null then insert into public.nothingsports_live_rating_alerts(recipient_user_id,event_id,ready_at) values(f.follower_user_id,new.event_id,clock_timestamp()+interval '5 minutes') returning id into group_id;end if;
 update public.nothingsports_friend_activity set alert_id=group_id where id=activity;
 end if;end loop;return new;
end $function$
;
create or replace function public.nothingsports_yurters(viewer_user_id uuid default null,audience text default 'all',search_text text default '',page_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$
 with visible as (
 select p.*,p.user_id=viewer_user_id is_viewer,
 exists(select 1 from public.nothingsports_user_follows f where f.follower_user_id=viewer_user_id and f.followed_user_id=p.user_id) following
 from public.nothingsports_nsc_profiles p
 where p.visibility='visible'
 and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)
 and (coalesce(search_text,'')='' or strpos(lower(p.display_name),lower(search_text))>0 or strpos(lower(p.handle),lower(search_text))>0)
 ), page as (
 select * from visible where audience='all' or following
 order by lower(display_name) collate "C",handle collate "C",profile_id
 limit 26 offset least(greatest(page_offset,0),1000000)
 ), entries as (
 select *,row_number() over(order by lower(display_name) collate "C",handle collate "C",profile_id) position from page
 )
 select jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object(
 'profileId',profile_id,'name',display_name,'handle',handle,'avatarUrl',avatar_url,
 'isViewer',coalesce(is_viewer,false),'canFollow',not coalesce(is_viewer,false),'following',following)
 order by position) from entries where position<=25),'[]'::jsonb),
 'nextCursor',case when (select count(*) from page)>25 then to_jsonb(page_offset+25) else 'null'::jsonb end)
$$;
revoke all on function public.nothingsports_yurters(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_yurters(uuid,text,text,integer) to service_role;
-- Existing installed clients can read their receipt without earning anything.
create or replace function public.nothingsports_nsc_award_points(target_user_id uuid,target_event_id text,target_action_key text,requested_points integer,awarded_time timestamptz default now())
returns integer language sql security invoker set search_path='' as $$ select 0 $$;
do $$ declare f record;t text;j record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'nothingsports_chat_%' or p.proname in(
 'nothingsports_leaderboard_v2'))
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
 foreach t in array array['nothingsports_nsc_points','nothingsports_nsc_likes','nothingsports_nsc_reward_entitlements','nothingsports_predictions','nothingsports_consensus_votes'] loop
 if to_regclass('public.'||t) is not null then execute format('revoke insert,update,delete on public.%I from anon,authenticated,service_role',t);end if;
 end loop;
 if to_regclass('cron.job') is not null then
 for j in select jobid from cron.job where jobname='nothingsports-chat-maintenance-daily'
 loop perform cron.unschedule(j.jobid);end loop;
 end if;
end $$;

create schema if not exists private;
create or replace function public.nothingsports_retire_feedback(preferences jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=preferences;record jsonb;item jsonb;path text[];fields text[];begin
 if jsonb_typeof(result)<>'object' then return result;end if;
 for item in select value from jsonb_array_elements('[
 {"path":["preferenceGraph","learning"],"fields":["signals","dislikeCount","tuningPromptCount","lastTunePromptDislikeCount","calibrationSkippedTargetIds","calibrationCompletedAt","calibrationSkippedAt","tuningInteractionCount","tuningDomainIds","completedTuningSessionCount","lastTuningSessionCompletedAt","meaningfulTuningAt","meaningfulTuningDislikeCount","negativeContextCounts"]},
 {"path":["followFirst","feedback"],"fields":["schemaVersion","sequence","entries"]},
 {"path":["followFirst","refinement"],"fields":["distinctOpenCount","lastOpenId","firstSwipeAt","promptedAt","completedAt","deferred"]},
 {"path":["swipeCoaching"],"fields":["dismissedAt"]}
 ]'::jsonb) loop
 select array_agg(value) into path from jsonb_array_elements_text(item->'path');
 select array_agg(value) into fields from jsonb_array_elements_text(item->'fields');
 record:=result#>path;
 if jsonb_typeof(record)='object' then
 record:=record-fields;
 if record='{}'::jsonb then result:=result#-path;else result:=jsonb_set(result,path,record);end if;
 end if;
 end loop;
 return result;
end $$;
revoke all on function public.nothingsports_retire_feedback(jsonb) from public,anon;
grant execute on function public.nothingsports_retire_feedback(jsonb) to authenticated,service_role;
create or replace function private.nothingsports_retire_feedback_write()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.preferences:=public.nothingsports_retire_feedback(new.preferences);return new;end $$;
drop trigger if exists systrategy_feedback on public.nothingsports_user_state;
create trigger systrategy_feedback before insert or update of preferences on public.nothingsports_user_state
for each row execute function private.nothingsports_retire_feedback_write();
do $$ declare t record;begin
 for t in select tablename from pg_tables where schemaname='public' and (tablename like 'nothingsports_chat_%' or tablename='nothingsports_saved_game_media') loop
 execute format('revoke insert,update on public.%I from anon,authenticated,service_role',t.tablename);
 end loop;
end $$;
CREATE OR REPLACE FUNCTION public.nothingsports_inbox_page(target_user uuid, before_time timestamp with time zone DEFAULT NULL::timestamp with time zone, before_id uuid DEFAULT NULL::uuid, summary_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 with eligible as (
  select i.* from public.nothingsports_inbox i
  where i.recipient_user_id=target_user and i.activity_at>clock_timestamp()-interval '90 days'
  and i.kind not in('chat','added','invitation','points')
  and (i.kind<>'impact_request' or private.impact_inbox_eligible(i.recipient_user_id,i.event_id))
  and (i.kind<>'rating' or exists(select 1 from public.nothingsports_nsc_profiles p where p.user_id=i.actor_user_id and p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas n where n.user_id=p.user_id and n.moderation_flag)))
 ), page as (
  select * from eligible where not summary_only and (before_time is null or (activity_at,id)<(before_time,before_id)) order by activity_at desc,id desc limit 26
 ), projected as (
 select i.activity_at,i.id,jsonb_build_object(
  'id',i.id,'kind',i.kind,'version',i.version,'read',i.read_at is not null,'at',i.activity_at,
  'eventId',i.event_id,'phase',i.phase,
  'actor',case when p.visibility='visible' and not coalesce(n.moderation_flag,false) then p.display_name else 'A Yurter' end,
  'profileId',case when p.visibility='visible' and not coalesce(n.moderation_flag,false) then p.profile_id end,
  'title',i.title,'detail',i.detail,'available',true
 ) item
 from page i
 left join public.nothingsports_nsc_profiles p on p.user_id=i.actor_user_id
 left join public.nothingsports_nsc_personas n on n.user_id=p.user_id
 ) select jsonb_build_object('unreadCount',(select count(*) from eligible where read_at is null),'items',coalesce((select jsonb_agg(item order by activity_at desc,id desc) from projected),'[]'::jsonb));
$function$
;

-- Harmless compatibility calls keep an older live-refresh owner running during cutover.
create or replace function public.nothingsports_settle_consensus_batch() returns integer language plpgsql security invoker set search_path='' as $$begin return 0;end $$;
revoke all on function public.nothingsports_settle_consensus_batch() from public,anon,authenticated;
grant execute on function public.nothingsports_settle_consensus_batch() to service_role;
create or replace function public.nothingsports_nsc_sync_rewards(target_user_id uuid default null) returns void language plpgsql security invoker set search_path='' as $$begin return;end $$;
revoke all on function public.nothingsports_nsc_sync_rewards(uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_sync_rewards(uuid) to service_role;
create or replace function public.nothingsports_nsc_settle_foresight(target_event_id text,confirmed_end timestamptz,final_status text) returns integer language plpgsql security invoker set search_path='' as $$begin return 0;end $$;
revoke all on function public.nothingsports_nsc_settle_foresight(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_settle_foresight(text,timestamptz,text) to service_role;
create or replace function public.nothingsports_resolve_predictions(target_event_id text,confirmed_end timestamptz default null,final_status text default null) returns integer language plpgsql security invoker set search_path='' as $$begin return 0;end $$;
revoke all on function public.nothingsports_resolve_predictions(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.nothingsports_resolve_predictions(text,timestamptz,text) to service_role;
create or replace function public.nothingsports_resolve_predictions_legacy(target_event_id text,confirmed_end timestamptz default null,final_status text default null) returns integer language plpgsql security invoker set search_path='' as $$begin return 0;end $$;
revoke all on function public.nothingsports_resolve_predictions_legacy(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.nothingsports_resolve_predictions_legacy(text,timestamptz,text) to service_role;

-- Row-locked metadata updates preserve the latest visibility, including a
-- concurrent Hide action. Explicit recreation retains the existing deleted-profile rule.
create or replace function public.nothingsports_save_public_profile(actor uuid,target_name text,target_handle text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 insert into public.nothingsports_nsc_profiles as p(user_id,display_name,handle)
 values(actor,target_name,target_handle)
 on conflict(user_id) do update set display_name=excluded.display_name,handle=excluded.handle,updated_at=clock_timestamp(),
 visibility=case when p.visibility='deleted' then 'visible' else p.visibility end
 returning jsonb_build_object('visibility',p.visibility) into result;
 return result;
end $$;
revoke all on function public.nothingsports_save_public_profile(uuid,text,text) from public,anon,authenticated;
grant execute on function public.nothingsports_save_public_profile(uuid,text,text) to service_role;

commit;
