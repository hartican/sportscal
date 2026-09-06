-- All mutation RPCs are service-only, SECURITY INVOKER; no client can award points.
create table public.nothingsports_nsc_prediction_revisions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null, rating smallint not null check(rating between 1 and 5),
 recorded_at timestamptz not null default now(), starts_at timestamptz not null,
 crowd_average numeric, crowd_count integer not null default 0,
 forecast numeric check(forecast between 1 and 5), forecast_version text,
 benchmark numeric check(benchmark between 1 and 5)
);
create index on public.nothingsports_nsc_prediction_revisions(event_id,user_id,recorded_at desc,id desc);
create table public.nothingsports_nsc_foresight_settlements (
 user_id uuid not null references auth.users(id) on delete cascade,event_id text not null,
 revision_id bigint not null references public.nothingsports_nsc_prediction_revisions(id),
 prediction smallint not null,outcome numeric,outcome_count integer not null,
 benchmark numeric,error numeric,improvement numeric,bonus integer not null check(bonus in(0,2,6)),
 result text not null check(result in('accurate','contrarian','miss','unscored','cancelled')),
 settled_at timestamptz not null default now(),primary key(user_id,event_id)
);
create table public.nothingsports_nsc_reward_campaigns (
 id text primary key,label text not null,kind text not null check(kind in('privilege','prize')),
 active boolean not null default false,starts_at timestamptz not null,ends_at timestamptz,
 points_per_entry integer not null check(points_per_entry>0),max_entries integer not null default 1 check(max_entries>0),
 eligibility text not null default 'allowlist' check(eligibility in('allowlist','registered')),
 eligible_user_ids uuid[] not null default '{}',terms_url text not null,
 created_at timestamptz not null default now(),check(ends_at is null or ends_at>starts_at)
);
create table public.nothingsports_nsc_reward_entitlements (
 user_id uuid not null references auth.users(id) on delete cascade,
 campaign_id text not null references public.nothingsports_nsc_reward_campaigns(id),
 entries integer not null check(entries>0),updated_at timestamptz not null default now(),
 primary key(user_id,campaign_id)
);
do $$ declare t text;begin
 foreach t in array array['nothingsports_nsc_prediction_revisions','nothingsports_nsc_foresight_settlements','nothingsports_nsc_reward_campaigns','nothingsports_nsc_reward_entitlements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.nothingsports_nsc_prediction_revisions_id_seq to service_role;

-- Retain identity immutability, allow service-owned corrections through the new RPC.
create or replace function public.nothingsports_nsc_lock_submitted_contribution()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.event_id<>old.event_id or new.user_id<>old.user_id or new.phase<>old.phase or new.bucket_start<>old.bucket_start) then raise exception 'immutable_contribution_identity';end if;
 if new.phase in('heat','impact') and new.submitted_at is null then new.submitted_at:=now();end if;
 return new;
end $$;

create function public.nothingsports_nsc_rate_current(
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
 bucket:=case when target_phase='pulse' then date_bin('5 minutes',current_time_utc,'1970-01-01'::timestamptz) else '1970-01-01'::timestamptz end;
 select c.rating into prior_rating from public.nothingsports_nsc_contributions c where c.user_id=target_user_id and c.event_id=target_event_id and c.phase=target_phase and c.bucket_start=bucket;
 if target_phase='heat' and prior_rating is distinct from target_rating then
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
 award:=public.nothingsports_nsc_award_points(target_user_id,target_event_id,action_name,case target_phase when 'heat' then 2 when 'pulse' then 1 else 3 end,current_time_utc);
 return jsonb_build_object('eventId',target_event_id,'phase',target_phase,'rating',target_rating,'submitted',true,'submittedAt',current_time_utc,'pointsAwarded',award,'replayed',prior_rating=target_rating);
end $$;
revoke all on function public.nothingsports_nsc_rate_current(uuid,text,text,integer,timestamptz,timestamptz,text,numeric,text) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_rate_current(uuid,text,text,integer,timestamptz,timestamptz,text,numeric,text) to service_role;

create function public.nothingsports_nsc_settle_foresight(target_event_id text,confirmed_end timestamptz,final_status text)
returns integer language plpgsql security invoker set search_path='' as $$
declare p record;mean numeric;n integer;err numeric;improvement numeric;bonus integer;outcome_label text;settled integer:=0;deadline timestamptz;
begin
 if confirmed_end is null or clock_timestamp()<confirmed_end+interval '48 hours' or final_status not in('completed','finished','final','cancelled','canceled','abandoned') then return 0;end if;
 deadline:=least(clock_timestamp(),confirmed_end+interval '7 days');
 perform pg_advisory_xact_lock(hashtextextended('foresight:'||target_event_id,0));
 for p in select distinct on(user_id) * from public.nothingsports_nsc_prediction_revisions where event_id=target_event_id and recorded_at<starts_at order by user_id,recorded_at desc,id desc loop
 if exists(select 1 from public.nothingsports_nsc_foresight_settlements s where s.user_id=p.user_id and s.event_id=target_event_id) then continue;end if;
 select avg(v.rating),count(*) into mean,n from(select distinct on(c.user_id) c.rating from public.nothingsports_nsc_contributions c where c.event_id=target_event_id and c.phase='impact' and c.user_id<>p.user_id and c.updated_at<=deadline order by c.user_id,c.updated_at desc)v;
 if n<5 and clock_timestamp()<confirmed_end+interval '7 days' and final_status not in('cancelled','canceled','abandoned') then continue;end if;
 err:=case when mean is not null then abs(p.rating-mean) end;improvement:=case when p.benchmark is not null then abs(p.benchmark-mean)-err end;bonus:=0;
 outcome_label:=case when final_status in('cancelled','canceled','abandoned') then 'cancelled' when n<5 then 'unscored' when err<=.5 then 'accurate' else 'miss' end;
 if outcome_label='accurate' then bonus:=2;if p.crowd_count>=5 and p.forecast is not null and abs(p.rating-p.benchmark)>=1 and improvement>=.5 then bonus:=6;outcome_label:='contrarian';end if;end if;
 insert into public.nothingsports_nsc_foresight_settlements(user_id,event_id,revision_id,prediction,outcome,outcome_count,benchmark,error,improvement,bonus,result)
 values(p.user_id,target_event_id,p.id,p.rating,mean,n,p.benchmark,err,improvement,bonus,outcome_label);
 if bonus>0 then insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day)
 values(p.user_id,target_event_id,'foresight_bonus',bonus,(clock_timestamp() at time zone 'Australia/Sydney')::date) on conflict do nothing;end if;
 settled:=settled+1;
 end loop;return settled;
end $$;
revoke all on function public.nothingsports_nsc_settle_foresight(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_settle_foresight(text,timestamptz,text) to service_role;

create function public.nothingsports_nsc_sync_rewards(target_user_id uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.nothingsports_nsc_reward_entitlements(user_id,campaign_id,entries)
 select u.id,c.id,least(c.max_entries,floor(sum(p.points)::numeric/c.points_per_entry)::integer)
 from public.nothingsports_nsc_reward_campaigns c cross join auth.users u
 join public.nothingsports_nsc_points p on p.user_id=u.id
 where c.active and length(c.terms_url)>0 and c.starts_at<=clock_timestamp() and (c.ends_at is null or c.ends_at>clock_timestamp())
 and (target_user_id is null or u.id=target_user_id) and not coalesce(u.is_anonymous,false)
 and (c.eligibility='registered' or u.id=any(c.eligible_user_ids))
 and (c.kind='privilege' or p.awarded_at>=c.starts_at)
 group by u.id,c.id having sum(p.points)>=c.points_per_entry
 on conflict(user_id,campaign_id) do update set entries=greatest(public.nothingsports_nsc_reward_entitlements.entries,excluded.entries),updated_at=clock_timestamp();
end $$;
revoke all on function public.nothingsports_nsc_sync_rewards(uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_sync_rewards(uuid) to service_role;

create or replace function public.nothingsports_nsc_award_points(
  target_user_id uuid, target_event_id text, target_action_key text, requested_points integer, awarded_time timestamptz default now()
) returns integer
language plpgsql security invoker set search_path=''
as $$
declare fixture_total integer; day_total integer; award integer; target_day date;
begin
  if requested_points < 1 or requested_points > 10 or target_event_id = '' or target_action_key = '' then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));
  if exists(select 1 from public.nothingsports_nsc_points where user_id=target_user_id and event_id=target_event_id and action_key=target_action_key) then return 0; end if;
  target_day := (awarded_time at time zone 'Australia/Sydney')::date;
  select coalesce(sum(points),0) into fixture_total from public.nothingsports_nsc_points where user_id=target_user_id and event_id=target_event_id and action_key<>'foresight_bonus';
  select coalesce(sum(points),0) into day_total from public.nothingsports_nsc_points where user_id=target_user_id and sydney_day=target_day and action_key<>'foresight_bonus';
  award := greatest(0, least(requested_points,10-fixture_total,25-day_total));
  if award > 0 then insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,awarded_at) values(target_user_id,target_event_id,target_action_key,award,target_day,awarded_time); end if;
  return award;
end;
$$;

revoke all on function public.nothingsports_nsc_award_points(uuid,text,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_award_points(uuid,text,text,integer,timestamptz) to service_role;
