-- The authenticated API rejects anonymous sessions before this service-role-only
-- RPC is called. Keep the database function invoker-scoped and avoid reading the
-- protected auth schema from PostgREST's service_role.
create or replace function public.nothingsports_rate_v2(target_user_id uuid,target_event_id text,target_phase text,target_rating integer,fixture_start timestamptz,fixture_end timestamptz,fixture_status text,fixture_sport text,fixture_gender text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ts timestamptz:=clock_timestamp();expected text;award integer:=0;prior integer;begin
 if target_rating not between 1 and 5 or target_phase not in('heat','pulse','impact') or target_user_id is null then raise exception 'invalid_rating';end if;
 if exists(select 1 from public.nothingsports_nsc_personas where user_id=target_user_id and moderation_flag) then raise exception 'profile_moderated';end if;
 expected:=case when fixture_status in('cancelled','canceled','abandoned','postponed') then null when fixture_status in('completed','finished','final') then 'impact' when fixture_status in('live','inprogress','in_progress','in-progress') then 'pulse' when fixture_start is null or ts<fixture_start then 'heat' when ts<fixture_end then 'pulse' else 'impact' end;
 if expected is null or expected<>target_phase then raise exception 'phase_action_mismatch';end if;

 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 perform pg_advisory_xact_lock(hashtextextended('fixture:'||target_event_id,0));
 insert into public.nothingsports_score_fixtures values(target_event_id,fixture_sport,fixture_gender,fixture_start,fixture_end,fixture_status)
 on conflict(event_id) do update set sport=excluded.sport,gender=excluded.gender,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status;
 select rating into prior from public.nothingsports_nsc_contributions where user_id=target_user_id and event_id=target_event_id and phase=target_phase order by updated_at desc limit 1;
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

-- Friends ranks remain relative to followed accounts. The separately returned
-- viewer row always carries the viewer's Global rank, even though self-follow is
-- forbidden and the viewer therefore cannot be in the Friends result set.
create or replace function public.nothingsports_leaderboard_v2(viewer_user_id uuid default null,audience text default 'global',sort_by text default 'points',search_text text default '',page_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$
with people as materialized(select p.* from public.nothingsports_nsc_profiles p where p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)),
sports as(select s.*,row_number() over(partition by sport order by case when sort_by='efficiency' then efficiency else points end desc nulls last,case when sort_by='efficiency' then points else efficiency end desc nulls last,eligible desc,p.profile_id) rank from public.nothingsports_sport_stats s join people p using(user_id) where sport<>'overall'),
base as(select p.user_id,p.profile_id "profileId",p.display_name name,p.handle,p.avatar_url "avatarUrl",coalesce(sum(s.points),0) points,coalesce(sum(s.eligible),0) eligible,coalesce(sum(s.successes),0) successes,sum(s.successes)::numeric/nullif(sum(s.eligible),0) efficiency,
 (select count(distinct v.event_id) from public.nothingsports_score_votes v where v.user_id=p.user_id) fixtures,
 coalesce((select jsonb_object_agg(sport,to_jsonb(t)-'user_id'-'sport') from sports t where t.user_id=p.user_id),'{}') sports,
 exists(select 1 from public.nothingsports_user_follows f where f.follower_user_id=viewer_user_id and f.followed_user_id=p.user_id) following
 from people p left join public.nothingsports_sport_stats s using(user_id) group by p.user_id,p.profile_id,p.display_name,p.handle,p.avatar_url),
global_ranked as materialized(select *,row_number() over(order by case when sort_by='efficiency' then efficiency else points end desc nulls last,case when sort_by='efficiency' then points else efficiency end desc nulls last,eligible desc,"profileId") rank from base),
audience_base as(select * from base where audience<>'friends' or following),
ranked as materialized(select *,row_number() over(order by case when sort_by='efficiency' then efficiency else points end desc nulls last,case when sort_by='efficiency' then points else efficiency end desc nulls last,eligible desc,"profileId") rank from audience_base),
filtered as(select * from ranked where search_text='' or position(lower(search_text) in lower(name||' '||handle))>0),
page as(select * from filtered order by rank offset greatest(0,page_offset) limit 25)
select jsonb_build_object('entries',coalesce((select jsonb_agg((to_jsonb(p)-'user_id')||jsonb_build_object('isViewer',p.user_id=viewer_user_id,'canFollow',viewer_user_id is not null and p.user_id<>viewer_user_id) order by rank) from page p),'[]'),
'viewer',(select (to_jsonb(p)-'user_id')||jsonb_build_object('isViewer',true,'canFollow',false) from global_ranked p where user_id=viewer_user_id),'total',(select count(*) from filtered),'nextCursor',case when (select count(*) from filtered)>page_offset+25 then page_offset+25 end,'epoch','anticipation.v2');
$$;

revoke all on function public.nothingsports_rate_v2(uuid,text,text,integer,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.nothingsports_rate_v2(uuid,text,text,integer,timestamptz,timestamptz,text,text,text) to service_role;
revoke all on function public.nothingsports_leaderboard_v2(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_leaderboard_v2(uuid,text,text,text,integer) to service_role;
