-- Registered accounts may rate without a public profile. Keep server-owned moderation in the API.
-- Heat and Impact are sealed; Pulse remains replaceable while live.
create or replace function public.nothingsports_nsc_lock_submitted_contribution()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and (
    new.event_id<>old.event_id or new.user_id<>old.user_id or
    new.phase<>old.phase or new.bucket_start<>old.bucket_start
  ) then raise exception 'immutable_contribution_identity'; end if;
  if tg_op='UPDATE' and old.phase in('heat','impact') and (
    new.rating is distinct from old.rating or new.tags is distinct from old.tags
  ) then raise exception 'nsc_already_submitted'; end if;
  if new.phase in('heat','impact') and new.submitted_at is null then new.submitted_at:=now(); end if;
  return new;
end $$;

create function public.nothingsports_nsc_record_unconfirmed_opinion(
  target_user_id uuid,target_event_id text,target_rating integer,submitted_time timestamptz default now()
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.nothingsports_nsc_contributions%rowtype;
begin
  if target_user_id is null or coalesce(target_event_id,'')='' or target_rating not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text,0));
  select * into existing from public.nothingsports_nsc_contributions
    where event_id=target_event_id and user_id=target_user_id and phase='heat'
      and bucket_start='1970-01-01T00:00:00Z'::timestamptz for update;
  if found then
    if existing.rating<>target_rating then raise exception 'nsc_already_submitted'; end if;
    return jsonb_build_object('eventId',target_event_id,'phase','heat','rating',existing.rating,
      'submitted',true,'submittedAt',existing.submitted_at,'pointsAwarded',0,'replayed',true,
      'foresightEligible',false,'timingUnconfirmed',true);
  end if;
  insert into public.nothingsports_nsc_contributions(
    event_id,user_id,phase,bucket_start,rating,tags,submitted_at,created_at,updated_at
  ) values(target_event_id,target_user_id,'heat','1970-01-01T00:00:00Z',target_rating,'{}',
    coalesce(submitted_time,now()),coalesce(submitted_time,now()),coalesce(submitted_time,now()));
  return jsonb_build_object('eventId',target_event_id,'phase','heat','rating',target_rating,
    'submitted',true,'submittedAt',coalesce(submitted_time,now()),'pointsAwarded',0,'replayed',false,
    'foresightEligible',false,'timingUnconfirmed',true);
end $$;
revoke all on function public.nothingsports_nsc_record_unconfirmed_opinion(uuid,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_record_unconfirmed_opinion(uuid,text,integer,timestamptz) to service_role;

create or replace function public.nothingsports_nsc_rate_current(
 target_user_id uuid,target_event_id text,target_phase text,target_rating integer,
 fixture_start timestamptz,fixture_end timestamptz,fixture_status text,
 algorithm_forecast numeric default null,algorithm_version text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_time_utc timestamptz:=clock_timestamp();bucket timestamptz;award integer:=0;
 other_average numeric;other_count integer;expected numeric;prior_rating integer;
 effective_phase text;action_name text;
begin
 if target_user_id is null or target_event_id='' or target_rating not between 1 and 5 or target_phase not in('heat','pulse','impact') then raise exception 'invalid_rating';end if;
 effective_phase:=case when fixture_status in('cancelled','canceled','abandoned','postponed') then null
 when fixture_status in('completed','finished','final') then 'impact'
 when fixture_status in('live','inprogress','in_progress','in-progress') then 'pulse'
 when fixture_start is null or current_time_utc<fixture_start then 'heat'
 when current_time_utc<fixture_end then 'pulse' else 'impact' end;
 if effective_phase is null or effective_phase<>target_phase then raise exception 'phase_action_mismatch';end if;
 if target_phase='heat' and (fixture_start is null or current_time_utc>=fixture_start) then raise exception 'prediction_time_unconfirmed_or_locked';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_user_id::text,0));
 bucket:=case when target_phase='pulse' then '1970-01-01'::timestamptz else '1970-01-01'::timestamptz end;
 select c.rating into prior_rating from public.nothingsports_nsc_contributions c where c.user_id=target_user_id and c.event_id=target_event_id and c.phase=target_phase and c.bucket_start=bucket;
 if target_phase in('heat','impact') and prior_rating is not null and prior_rating is distinct from target_rating then raise exception 'nsc_already_submitted';end if;
 if target_phase='heat' and prior_rating is null then
   select avg(v.rating),count(*) into other_average,other_count from(
     select distinct on(c.user_id) c.rating from public.nothingsports_nsc_contributions c
     where c.event_id=target_event_id and c.phase='heat' and c.user_id<>target_user_id and c.updated_at<fixture_start order by c.user_id,c.updated_at desc
   )v;
   if algorithm_forecast between 1 and 5 and algorithm_version is not null and other_count>=5 then expected:=(algorithm_forecast+other_average)/2;end if;
   insert into public.nothingsports_nsc_prediction_revisions(user_id,event_id,rating,recorded_at,starts_at,crowd_average,crowd_count,forecast,forecast_version,benchmark)
   values(target_user_id,target_event_id,target_rating,current_time_utc,fixture_start,other_average,other_count,algorithm_forecast,algorithm_version,expected);
 end if;
 insert into public.nothingsports_nsc_contributions(event_id,user_id,phase,bucket_start,rating,tags,submitted_at,updated_at)
 values(target_event_id,target_user_id,target_phase,bucket,target_rating,'{}',current_time_utc,current_time_utc)
 on conflict(event_id,user_id,phase,bucket_start) do update set rating=excluded.rating,tags='{}',updated_at=excluded.updated_at;
 action_name:=case when target_phase='pulse' then 'pulse_participation' else target_phase||'_rating' end;
 award:=public.nothingsports_nsc_award_points(target_user_id,target_event_id,action_name,2,current_time_utc);
 perform public.nothingsports_nsc_sync_rewards(target_user_id);
 return jsonb_build_object('eventId',target_event_id,'phase',target_phase,'rating',target_rating,
   'submitted',true,'submittedAt',current_time_utc,'pointsAwarded',award,
   'basePointsAwarded',award,'settlementBonusPending',target_phase='heat','replayed',prior_rating=target_rating,
   'foresightEligible',target_phase='heat');
end $$;
revoke all on function public.nothingsports_nsc_rate_current(uuid,text,text,integer,timestamptz,timestamptz,text,numeric,text) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_rate_current(uuid,text,text,integer,timestamptz,timestamptz,text,numeric,text) to service_role;
