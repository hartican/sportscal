-- One-time score reset. Ratings, profiles and sporting follows remain intact.
create table public.nothingsports_score_epoch(id text primary key,started_at timestamptz not null default clock_timestamp());
insert into public.nothingsports_score_epoch(id) values('anticipation.v2');
create table public.nothingsports_score_archive(kind text not null,record jsonb not null);
insert into public.nothingsports_score_archive select 'points',to_jsonb(p) from public.nothingsports_nsc_points p;
insert into public.nothingsports_score_archive select 'entitlements',to_jsonb(p) from public.nothingsports_nsc_reward_entitlements p;
insert into public.nothingsports_score_archive select 'settlements',to_jsonb(p) from public.nothingsports_nsc_foresight_settlements p;
delete from public.nothingsports_nsc_points;
delete from public.nothingsports_nsc_reward_entitlements;
create table public.nothingsports_score_fixtures(event_id text primary key,sport text not null,gender text,starts_at timestamptz,ends_at timestamptz,status text);
create table public.nothingsports_predictions(user_id uuid references auth.users on delete cascade,event_id text references public.nothingsports_score_fixtures, rating integer not null check(rating between 1 and 5),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),result text not null default 'pending' check(result in('pending','success','miss','unscored','cancelled')),matched_user_id uuid references auth.users on delete set null,resolved_at timestamptz,primary key(user_id,event_id));
create table public.nothingsports_score_votes(user_id uuid references auth.users on delete cascade,event_id text references public.nothingsports_score_fixtures,phase text not null,rating integer not null check(rating between 1 and 5),recorded_at timestamptz not null default clock_timestamp(),primary key(user_id,event_id,phase,rating));
alter table public.nothingsports_nsc_points add column sport text;
alter table public.nothingsports_nsc_points drop constraint nothingsports_nsc_points_points_check;
alter table public.nothingsports_nsc_points add check(points between 1 and 25);
alter table public.nothingsports_nsc_contributions drop constraint nothingsports_nsc_contributions_maximum_points_check;
alter table public.nothingsports_nsc_contributions add check(maximum_points between 1 and 20);
create table public.nothingsports_follow_reward_history(follower_user_id uuid references auth.users on delete cascade,followed_user_id uuid references auth.users on delete cascade,primary key(follower_user_id,followed_user_id));
insert into public.nothingsports_follow_reward_history select follower_user_id,followed_user_id from public.nothingsports_user_follows;
create table public.nothingsports_pick_rewards(copier_id uuid references auth.users on delete cascade,source_id uuid references auth.users on delete cascade,sport text,primary key(copier_id,source_id,sport));
create table public.nothingsports_friend_activity(id uuid primary key default gen_random_uuid(),recipient_user_id uuid references auth.users on delete cascade,rater_user_id uuid references auth.users on delete cascade,event_id text not null,phase text not null,created_at timestamptz not null default clock_timestamp(),alert_id uuid references public.nothingsports_live_rating_alerts,unique(recipient_user_id,rater_user_id,event_id,phase));
create index on public.nothingsports_friend_activity(recipient_user_id,created_at desc);
create index on public.nothingsports_predictions(event_id) where result='pending';
create index on public.nothingsports_score_votes(event_id,phase,recorded_at);
do $$ declare t text;begin foreach t in array array['nothingsports_score_epoch','nothingsports_score_archive','nothingsports_score_fixtures','nothingsports_predictions','nothingsports_score_votes','nothingsports_follow_reward_history','nothingsports_pick_rewards','nothingsports_friend_activity'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end $$;
-- Old workers cannot settle historical predictions after the reset.
create or replace function public.nothingsports_nsc_settle_foresight(target_event_id text,confirmed_end timestamptz,final_status text)
returns integer language sql security invoker set search_path='' as $$ select 0 $$;
create or replace function public.nothingsports_nsc_lock_submitted_contribution()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.event_id<>old.event_id or new.user_id<>old.user_id or new.phase<>old.phase or new.bucket_start<>old.bucket_start) then raise exception 'immutable_contribution_identity';end if;
 if new.phase in('heat','impact') and new.submitted_at is null then new.submitted_at:=now();end if;
 return new;
end $$;
-- Bound normal participation; the specifically guaranteed rewards bypass legacy caps.
create or replace function public.nothingsports_nsc_award_points(target_user_id uuid,target_event_id text,target_action_key text,requested_points integer,awarded_time timestamptz default now()) returns integer
language plpgsql security invoker set search_path='' as $$
declare award integer;fixture_total integer;day_total integer;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 if requested_points<1 or requested_points>25 or target_event_id='' then return 0;end if;
 if awarded_time<(select started_at from public.nothingsports_score_epoch limit 1) then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended(target_user_id::text,0));
 if target_action_key in('heat_rating','foresight_bonus') and not exists(select 1 from public.nothingsports_predictions where user_id=target_user_id and event_id=target_event_id) then return 0;end if;
 award:=case target_action_key when 'heat_rating' then 1 when 'foresight_bonus' then 19 else requested_points end;
 if target_action_key not in('heat_rating','foresight_bonus','follow_person','followed_by_person') then
 select coalesce(sum(points),0) into fixture_total from public.nothingsports_nsc_points where user_id=target_user_id and event_id=target_event_id and action_key not in('foresight_bonus','picks_copied','follow_person','followed_by_person');
 select coalesce(sum(points),0) into day_total from public.nothingsports_nsc_points where user_id=target_user_id and sydney_day=(awarded_time at time zone 'Australia/Sydney')::date and action_key not in('foresight_bonus','picks_copied','follow_person','followed_by_person');
 award:=greatest(0,least(award,10-fixture_total,25-day_total));if award=0 then return 0;end if;
 end if;
 insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,awarded_at,sport)
 values(target_user_id,target_event_id,target_action_key,award,(awarded_time at time zone 'Australia/Sydney')::date,awarded_time,(select sport from public.nothingsports_score_fixtures where event_id=target_event_id)) on conflict do nothing;
 if not found then return 0;end if;return award;
end $$;
create function public.nothingsports_resolve_predictions(target_event_id text,confirmed_end timestamptz default null,final_status text default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare p record;peer uuid;has_peer boolean;total integer:=0;deadline timestamptz;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 perform pg_advisory_xact_lock(hashtextextended('fixture:'||target_event_id,0));
 if final_status in('completed','finished','final','cancelled','canceled','abandoned') and confirmed_end is not null then
 update public.nothingsports_score_fixtures set ends_at=confirmed_end,status=final_status where event_id=target_event_id;
 end if;
 select ends_at+interval '48 hours' into deadline from public.nothingsports_score_fixtures where event_id=target_event_id and status in('completed','finished','final','cancelled','canceled','abandoned');
 for p in select x.*,f.starts_at,f.status from public.nothingsports_predictions x join public.nothingsports_score_fixtures f using(event_id) where x.event_id=target_event_id and x.result='pending' and x.updated_at<f.starts_at loop
 if p.status in('cancelled','canceled','abandoned') then
 update public.nothingsports_predictions set result='cancelled',resolved_at=clock_timestamp() where user_id=p.user_id and event_id=target_event_id;continue;end if;
 select v.user_id into peer from public.nothingsports_score_votes v where v.event_id=target_event_id and v.user_id<>p.user_id and v.phase in('pulse','impact') and v.rating=p.rating and v.recorded_at>=p.starts_at and (deadline is null or v.recorded_at<=deadline)
 and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=v.user_id and m.moderation_flag) order by v.recorded_at limit 1;
 if peer is not null then
 update public.nothingsports_predictions set result='success',matched_user_id=peer,resolved_at=clock_timestamp() where user_id=p.user_id and event_id=target_event_id;
 perform public.nothingsports_nsc_award_points(p.user_id,target_event_id,'foresight_bonus',19);total:=total+1;
 elsif deadline is not null and clock_timestamp()>=deadline then
 select exists(select 1 from public.nothingsports_score_votes v where v.event_id=target_event_id and v.user_id<>p.user_id and v.phase in('pulse','impact') and v.recorded_at between p.starts_at and deadline and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=v.user_id and m.moderation_flag)) into has_peer;
 update public.nothingsports_predictions set result=case when has_peer then 'miss' else 'unscored' end,resolved_at=clock_timestamp() where user_id=p.user_id and event_id=target_event_id;
 end if;
 end loop;return total;
end $$;
create function public.nothingsports_rate_v2(target_user_id uuid,target_event_id text,target_phase text,target_rating integer,fixture_start timestamptz,fixture_end timestamptz,fixture_status text,fixture_sport text,fixture_gender text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ts timestamptz:=clock_timestamp();expected text;award integer:=0;prior integer;begin
 if target_rating not between 1 and 5 or target_phase not in('heat','pulse','impact') or target_user_id is null then raise exception 'invalid_rating';end if;
 if exists(select 1 from public.nothingsports_nsc_personas where user_id=target_user_id and moderation_flag) or exists(select 1 from auth.users where id=target_user_id and is_anonymous) then raise exception 'profile_moderated';end if;
 expected:=case when fixture_status in('cancelled','canceled','abandoned','postponed') then null when fixture_status in('completed','finished','final') then 'impact' when fixture_status in('live','inprogress','in_progress','in-progress') then 'pulse' when fixture_start is null or ts<fixture_start then 'heat' when ts<fixture_end then 'pulse' else 'impact' end;
 if expected is null or expected<>target_phase then raise exception 'phase_action_mismatch';end if;

 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 perform pg_advisory_xact_lock(hashtextextended('fixture:'||target_event_id,0));
 insert into public.nothingsports_score_fixtures values(target_event_id,fixture_sport,fixture_gender,fixture_start,fixture_end,fixture_status)
 on conflict(event_id) do update set sport=excluded.sport,gender=excluded.gender,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status;
 select rating into prior from public.nothingsports_nsc_contributions where user_id=target_user_id and event_id=target_event_id and phase=target_phase order by updated_at desc limit 1;
 -- Replaying an unchanged pre-reset rating must not mint a new award.
 if prior=target_rating and not exists(select 1 from public.nothingsports_score_votes where user_id=target_user_id and event_id=target_event_id and phase=target_phase) then
 return jsonb_build_object('eventId',target_event_id,'phase',target_phase,'rating',target_rating,'submitted',true,'pointsAwarded',0,'replayed',true);end if;
 if target_phase='heat' then
 insert into public.nothingsports_predictions(user_id,event_id,rating,created_at,updated_at,result) values(target_user_id,target_event_id,target_rating,ts,ts,case when fixture_start is null then 'unscored' else 'pending' end)
 on conflict(user_id,event_id) do update set rating=excluded.rating,updated_at=excluded.updated_at,result=excluded.result where nothingsports_predictions.result in('pending','unscored');end if;
 insert into public.nothingsports_score_votes values(target_user_id,target_event_id,target_phase,target_rating,ts) on conflict do nothing;
 insert into public.nothingsports_nsc_contributions(event_id,user_id,phase,bucket_start,rating,tags,submitted_at,updated_at,scoring_version,maximum_points)
 values(target_event_id,target_user_id,target_phase,'1970-01-01',target_rating,'{}',ts,ts,'anticipation.v2',case when target_phase='heat' then 20 else 2 end) on conflict(event_id,user_id,phase,bucket_start) do update set rating=excluded.rating,updated_at=excluded.updated_at,scoring_version=excluded.scoring_version,maximum_points=excluded.maximum_points;
 award:=public.nothingsports_nsc_award_points(target_user_id,target_event_id,case when target_phase='pulse' then 'pulse_participation' else target_phase||'_rating' end,case when target_phase='heat' then 1 else 2 end,ts);
 if target_phase<>'heat' then perform public.nothingsports_resolve_predictions(target_event_id);end if;
 return jsonb_build_object('eventId',target_event_id,'phase',target_phase,'rating',target_rating,'submitted',true,'submittedAt',ts,'pointsAwarded',award,'basePointsAwarded',award,'foresightEligible',target_phase='heat' and fixture_start is not null);
end $$;
-- Seal obsolete rating RPC while old installed clients receive the normal refresh error.
create or replace function public.nothingsports_nsc_rate_current(target_user_id uuid,target_event_id text,target_phase text,target_rating integer,fixture_start timestamptz,fixture_end timestamptz,fixture_status text,algorithm_forecast numeric default null,algorithm_version text default null) returns jsonb language plpgsql security invoker set search_path='' as $$ begin raise exception 'phase_action_mismatch';end $$;
create function public.nothingsports_follow_person(actor uuid,target_profile uuid,following boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid;fresh boolean;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select p.user_id into target from public.nothingsports_nsc_profiles p where p.profile_id=target_profile and (not following or (p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)));
 if target is null or target=actor then raise exception 'invalid_public_profile';end if;
 if following then
 insert into public.nothingsports_user_follows values(actor,target,clock_timestamp()) on conflict do nothing;
 insert into public.nothingsports_follow_reward_history values(actor,target) on conflict do nothing;fresh:=found;
 if fresh then
 perform public.nothingsports_nsc_award_points(actor,'person:'||target,'follow_person',1);
 perform public.nothingsports_nsc_award_points(target,'follower:'||actor,'followed_by_person',1);end if;
 else delete from public.nothingsports_user_follows where follower_user_id=actor and followed_user_id=target;end if;
 return jsonb_build_object('targetProfileId',target_profile,'following',following);
end $$;
-- Each recommendation remains visible even when push groups combine multiple people.
alter table public.nothingsports_live_rating_alerts drop constraint nothingsports_live_rating_alerts_recipient_user_id_event_id_key;
create or replace function public.nothingsports_enqueue_live_rating_alert() returns trigger language plpgsql security invoker set search_path='' as $$
declare f record;activity uuid;group_id uuid;begin
 if new.rating<>5 or new.scoring_version<>'anticipation.v2' then return new;end if;
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
end $$;
-- Indexed base records provide rebuildable, server-owned statistics without polling writes.
create view public.nothingsports_sport_stats with(security_invoker=true) as
with keys as(select user_id,coalesce(sport,'overall') sport from public.nothingsports_nsc_points union select p.user_id,f.sport from public.nothingsports_predictions p join public.nothingsports_score_fixtures f using(event_id)),
credits as(select user_id,coalesce(sport,'overall') sport,sum(points) points from public.nothingsports_nsc_points group by 1,2),
predictions as(select p.user_id,f.sport,count(*) filter(where result='success' and f.status not in('cancelled','canceled','abandoned')) successes,count(*) filter(where result in('success','miss') and f.status not in('cancelled','canceled','abandoned')) eligible from public.nothingsports_predictions p join public.nothingsports_score_fixtures f using(event_id) group by 1,2)
select k.*,coalesce(c.points,0) points,coalesce(p.successes,0) successes,coalesce(p.eligible,0) eligible, p.successes::numeric/nullif(p.eligible,0) efficiency from keys k left join credits c using(user_id,sport) left join predictions p using(user_id,sport);
revoke all on public.nothingsports_sport_stats from public,anon,authenticated;grant select on public.nothingsports_sport_stats to service_role;
do $$ declare fn record;begin for fn in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in('nothingsports_resolve_predictions','nothingsports_rate_v2','nothingsports_follow_person') loop execute format('revoke all on function %s from public,anon,authenticated',fn.signature);execute format('grant execute on function %s to service_role',fn.signature);end loop;end $$;
create function public.nothingsports_leaderboard_v2(viewer_user_id uuid default null,audience text default 'global',sort_by text default 'points',search_text text default '',page_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$
with people as materialized(select p.* from public.nothingsports_nsc_profiles p where p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)),
sports as(select s.*,row_number() over(partition by sport order by case when sort_by='efficiency' then efficiency else points end desc nulls last,case when sort_by='efficiency' then points else efficiency end desc nulls last,eligible desc,p.profile_id) rank from public.nothingsports_sport_stats s join people p using(user_id) where sport<>'overall'),
base as(select p.user_id,p.profile_id "profileId",p.display_name name,p.handle,p.avatar_url "avatarUrl",coalesce(sum(s.points),0) points,coalesce(sum(s.eligible),0) eligible,coalesce(sum(s.successes),0) successes,sum(s.successes)::numeric/nullif(sum(s.eligible),0) efficiency,
 (select count(distinct v.event_id) from public.nothingsports_score_votes v where v.user_id=p.user_id) fixtures,
 coalesce((select jsonb_object_agg(sport,to_jsonb(t)-'user_id'-'sport') from sports t where t.user_id=p.user_id),'{}') sports,
 exists(select 1 from public.nothingsports_user_follows f where f.follower_user_id=viewer_user_id and f.followed_user_id=p.user_id) following
 from people p left join public.nothingsports_sport_stats s using(user_id) group by p.user_id,p.profile_id,p.display_name,p.handle,p.avatar_url),
ranked as materialized(select *,row_number() over(order by case when sort_by='efficiency' then efficiency else points end desc nulls last,case when sort_by='efficiency' then points else efficiency end desc nulls last,eligible desc,"profileId") rank from base where audience<>'friends' or following),
filtered as(select * from ranked where search_text='' or position(lower(search_text) in lower(name||' '||handle))>0),
page as(select * from filtered order by rank offset greatest(0,page_offset) limit 25)
select jsonb_build_object('entries',coalesce((select jsonb_agg((to_jsonb(p)-'user_id')||jsonb_build_object('isViewer',p.user_id=viewer_user_id,'canFollow',viewer_user_id is not null and p.user_id<>viewer_user_id) order by rank) from page p),'[]'),
'viewer',(select (to_jsonb(p)-'user_id')||jsonb_build_object('isViewer',true) from ranked p where user_id=viewer_user_id),'total',(select count(*) from filtered),'nextCursor',case when (select count(*) from filtered)>page_offset+25 then page_offset+25 end,'epoch','anticipation.v2');
$$;
-- Compare-and-swap prevents a copy from replacing a simultaneous preference edit.
create function public.nothingsports_copy_picks(actor uuid,source_profile uuid,expected_preferences jsonb,expected_events jsonb,new_preferences jsonb,new_events jsonb,added_sports text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare source_user uuid;s text;bonus integer:=0;state public.nothingsports_user_state%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select user_id into source_user from public.nothingsports_nsc_profiles p where profile_id=source_profile and visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag);
 if source_user is null or source_user=actor then raise exception 'invalid_public_profile';end if;
 insert into public.nothingsports_user_state(user_id) values(actor) on conflict do nothing;
 select * into state from public.nothingsports_user_state where user_id=actor for update;
 if state.preferences<>expected_preferences or state.event_user_state<>expected_events then raise exception 'preferences_changed_retry';end if;
 update public.nothingsports_user_state set preferences=new_preferences,event_user_state=new_events,updated_at=clock_timestamp() where user_id=actor;
 foreach s in array added_sports loop
 insert into public.nothingsports_pick_rewards values(actor,source_user,s) on conflict do nothing;
 if found then
 insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,sport) values(source_user,'picks:'||actor||':'||s,'picks_copied',20,(clock_timestamp() at time zone 'Australia/Sydney')::date,s) on conflict do nothing;
 bonus:=bonus+20;end if;end loop;
 return jsonb_build_object('preferences',new_preferences,'eventUserState',new_events,'bonusAwarded',bonus);
end $$;
revoke all on function public.nothingsports_leaderboard_v2(uuid,text,text,text,integer),public.nothingsports_copy_picks(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_leaderboard_v2(uuid,text,text,text,integer),public.nothingsports_copy_picks(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text[]) to service_role;
