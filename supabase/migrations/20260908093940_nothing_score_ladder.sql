-- Record the rules for new votes. Historical, unversioned votes are deliberately
-- not assigned today's maximum retrospectively; their credited points survive.
alter table public.nothingsports_nsc_contributions add column scoring_version text;
alter table public.nothingsports_nsc_contributions add column maximum_points smallint check(maximum_points between 1 and 8);
alter table public.nothingsports_nsc_contributions alter column scoring_version set default 'votes.v1';
alter table public.nothingsports_nsc_profiles add column avatar_url text check(avatar_url is null or avatar_url ~ '^https://');
create function public.nothingsports_nsc_record_scoring_version()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.scoring_version='votes.v1' and new.maximum_points is null then
    new.maximum_points:=case new.phase when 'heat' then 8 when 'pulse' then 2 when 'impact' then 2 end;
  end if;
  return new;
end $$;
revoke all on function public.nothingsports_nsc_record_scoring_version() from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_record_scoring_version() to service_role;
create trigger nsc_vote_scoring_version before insert on public.nothingsports_nsc_contributions
for each row execute function public.nothingsports_nsc_record_scoring_version();

create view public.nothingsports_nsc_ladder_rows with (security_invoker=true) as
with votes as (
  select distinct on(user_id,event_id,phase) user_id,event_id,phase,scoring_version,maximum_points
  from public.nothingsports_nsc_contributions where rating between 1 and 5
  order by user_id,event_id,phase,updated_at desc,contribution_id
), credits as (
  select user_id,event_id,
    coalesce(sum(points) filter(where action_key in('heat_rating','foresight_bonus')),0) as heat,
    coalesce(sum(points) filter(where action_key='pulse_participation'),0) as pulse,
    coalesce(sum(points) filter(where action_key='impact_rating'),0) as impact
  from public.nothingsports_nsc_points
  where action_key in('heat_rating','pulse_participation','impact_rating','foresight_bonus') group by user_id,event_id
), efficiency_votes as (
  select v.*,case v.phase when 'heat' then c.heat when 'pulse' then c.pulse else c.impact end as earned,
    v.scoring_version is not null and v.maximum_points is not null and
      (v.phase<>'heat' or s.result in('accurate','contrarian','miss')) as eligible
  from votes v left join credits c using(user_id,event_id)
  left join public.nothingsports_nsc_foresight_settlements s using(user_id,event_id)
), totals as (
  select user_id,sum(heat+pulse+impact) as points from credits group by user_id
), vote_totals as (
  select user_id,count(distinct event_id) as fixtures,
    sum(coalesce(earned,0)) filter(where eligible) / nullif(sum(maximum_points) filter(where eligible),0)::numeric as efficiency
  from efficiency_votes group by user_id
), eligible_profiles as (
  select p.user_id,p.profile_id as "profileId",p.display_name as name,p.handle,p.avatar_url as "avatarUrl",
    coalesce(v.fixtures,0) as fixtures,coalesce(t.points,0) as points,v.efficiency
  from public.nothingsports_nsc_profiles p left join totals t using(user_id) left join vote_totals v using(user_id)
  where p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)
)
select row_number() over(order by points desc,efficiency desc nulls last,fixtures desc,"profileId") as rank,* from eligible_profiles;
revoke all on public.nothingsports_nsc_ladder_rows from public,anon,authenticated;
grant select on public.nothingsports_nsc_ladder_rows to service_role;

create function public.nothingsports_nsc_ladder(viewer_user_id uuid default null,page_offset integer default 0,page_size integer default 25)
returns jsonb language sql stable security invoker set search_path='' as $$
  with ranked as materialized(select * from public.nothingsports_nsc_ladder_rows),
  page as(select * from ranked order by rank offset greatest(0,page_offset) limit greatest(1,least(page_size,100)))
  select jsonb_build_object(
    'entries',coalesce((select jsonb_agg((to_jsonb(p)-'user_id')||jsonb_build_object('isViewer',coalesce(p.user_id=viewer_user_id,false)) order by p.rank) from page p),'[]'::jsonb),
    'viewer',(select (to_jsonb(r)-'user_id')||jsonb_build_object('isViewer',true) from ranked r where r.user_id=viewer_user_id),
    'total',(select count(*) from ranked),
    'nextCursor',case when (select count(*) from ranked)>greatest(0,page_offset)+greatest(1,least(page_size,100)) then greatest(0,page_offset)+greatest(1,least(page_size,100)) end
  );
$$;
revoke all on function public.nothingsports_nsc_ladder(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_ladder(uuid,integer,integer) to service_role;
