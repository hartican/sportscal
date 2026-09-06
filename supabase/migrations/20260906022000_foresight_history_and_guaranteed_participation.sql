-- Preserve an as-of history so later Impact corrections cannot erase the settlement window.
create table public.nothingsports_nsc_rating_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null,phase text not null,rating smallint not null check(rating between 1 and 5),
 recorded_at timestamptz not null
);
create index on public.nothingsports_nsc_rating_history(event_id,phase,user_id,recorded_at desc,id desc);
alter table public.nothingsports_nsc_rating_history enable row level security;
revoke all on public.nothingsports_nsc_rating_history from public,anon,authenticated;
grant all on public.nothingsports_nsc_rating_history to service_role;
grant usage,select on sequence public.nothingsports_nsc_rating_history_id_seq to service_role;
insert into public.nothingsports_nsc_rating_history(user_id,event_id,phase,rating,recorded_at)
 select user_id,event_id,phase,rating,updated_at from public.nothingsports_nsc_contributions;
create function public.nothingsports_nsc_record_rating_history()
 returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' or new.rating is distinct from old.rating or new.updated_at is distinct from old.updated_at then
 insert into public.nothingsports_nsc_rating_history(user_id,event_id,phase,rating,recorded_at) values(new.user_id,new.event_id,new.phase,new.rating,new.updated_at);
 end if;return new;
end $$;
revoke all on function public.nothingsports_nsc_record_rating_history() from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_record_rating_history() to service_role;
create trigger nsc_rating_history after insert or update on public.nothingsports_nsc_contributions for each row execute function public.nothingsports_nsc_record_rating_history();
create table public.nothingsports_nsc_completed_fixtures(event_id text primary key,confirmed_end timestamptz not null);
alter table public.nothingsports_nsc_completed_fixtures enable row level security;
revoke all on public.nothingsports_nsc_completed_fixtures from public,anon,authenticated;
grant all on public.nothingsports_nsc_completed_fixtures to service_role;

create or replace function public.nothingsports_nsc_settle_foresight(target_event_id text,confirmed_end timestamptz,final_status text)
returns integer language plpgsql security invoker set search_path='' as $$
declare p record;mean numeric;n integer;err numeric;improvement numeric;bonus integer;outcome_label text;settled integer:=0;deadline timestamptz;
begin
 if confirmed_end is null or clock_timestamp()<confirmed_end+interval '48 hours' or final_status not in('completed','finished','final','cancelled','canceled','abandoned') then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended('foresight:'||target_event_id,0));
 insert into public.nothingsports_nsc_completed_fixtures(event_id,confirmed_end) values(target_event_id,confirmed_end) on conflict do nothing;
 select c.confirmed_end into confirmed_end from public.nothingsports_nsc_completed_fixtures c where c.event_id=target_event_id;
 deadline:=least(clock_timestamp(),confirmed_end+interval '7 days');
 for p in select distinct on(user_id) * from public.nothingsports_nsc_prediction_revisions where event_id=target_event_id and recorded_at<starts_at order by user_id,recorded_at desc,id desc loop
 if exists(select 1 from public.nothingsports_nsc_foresight_settlements s where s.user_id=p.user_id and s.event_id=target_event_id) then continue;end if;
 select avg(v.rating),count(*) into mean,n from(select distinct on(c.user_id) c.rating from public.nothingsports_nsc_rating_history c where c.event_id=target_event_id and c.phase='impact' and c.user_id<>p.user_id and c.recorded_at<=deadline order by c.user_id,c.recorded_at desc,c.id desc)v;
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
  award := case when target_action_key='heat_rating' and requested_points=2 then 2 else greatest(0, least(requested_points,10-fixture_total,25-day_total)) end;
  if award > 0 then insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,awarded_at) values(target_user_id,target_event_id,target_action_key,award,target_day,awarded_time); end if;
  return award;
end;
$$;

revoke all on function public.nothingsports_nsc_award_points(uuid,text,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_nsc_award_points(uuid,text,text,integer,timestamptz) to service_role;
