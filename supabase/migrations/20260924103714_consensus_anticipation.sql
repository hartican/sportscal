-- Additive rollout. No epoch reset, historical award rewrite or automatic activation.
create table public.nothingsports_consensus_settings(id boolean primary key default true check(id), activated_at timestamptz);
insert into public.nothingsports_consensus_settings values(true,null);
create table public.nothingsports_prediction_rules(
 event_id text primary key references public.nothingsports_score_fixtures,
 version text not null check(version in('anticipation.v2','consensus.v1')),
 completed_at timestamptz, cutoff timestamptz, settled_at timestamptz
);
insert into public.nothingsports_prediction_rules(event_id,version)
 select distinct event_id,'anticipation.v2' from public.nothingsports_predictions;
create index consensus_due on public.nothingsports_prediction_rules(cutoff,event_id) where version='consensus.v1' and settled_at is null;
create table public.nothingsports_consensus_votes(
 event_id text references public.nothingsports_score_fixtures,user_id uuid references auth.users on delete cascade,
 rating integer not null check(rating between 1 and 5),recorded_at timestamptz not null,
 primary key(event_id,user_id)
);
create table public.nothingsports_consensus_receipts(
 event_id text,user_id uuid,version text not null,cutoff timestamptz,mean numeric,benchmark integer,voter_count integer not null,result text not null,
 primary key(event_id,user_id),foreign key(user_id,event_id) references public.nothingsports_predictions on delete cascade
);
do $$ declare t text;begin foreach t in array array['nothingsports_consensus_settings','nothingsports_prediction_rules','nothingsports_consensus_votes','nothingsports_consensus_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end $$;

create function public.nothingsports_assign_prediction_rule() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.nothingsports_consensus_settings where activated_at<=clock_timestamp()) then return new;end if;
 insert into public.nothingsports_prediction_rules(event_id,version)
 values(new.event_id,case when new.starts_at>clock_timestamp() and exists(select 1 from public.nothingsports_consensus_settings where activated_at<=clock_timestamp())
 and not exists(select 1 from public.nothingsports_predictions where event_id=new.event_id)
 then 'consensus.v1' else 'anticipation.v2' end) on conflict do nothing;
 if new.status in('completed','finished','final','cancelled','canceled','abandoned') then
  update public.nothingsports_prediction_rules set completed_at=coalesce(new.ends_at,clock_timestamp()),cutoff=coalesce(new.ends_at,clock_timestamp())+interval '48 hours'
  where event_id=new.event_id and completed_at is null and version='consensus.v1';
 end if;
 return new;
end $$;
create trigger prediction_rule after insert or update on public.nothingsports_score_fixtures for each row execute function public.nothingsports_assign_prediction_rule();

create function public.nothingsports_capture_consensus_vote() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.nothingsports_prediction_rules;ts timestamptz:=clock_timestamp();begin
 if new.phase<>'impact' then return new;end if;
 select * into r from public.nothingsports_prediction_rules where event_id=new.event_id;
 if r.version='consensus.v1' and r.completed_at is not null and ts between r.completed_at and r.cutoff and r.settled_at is null then
  insert into public.nothingsports_consensus_votes values(new.event_id,new.user_id,new.rating,ts)
  on conflict(event_id,user_id) do update set rating=excluded.rating,recorded_at=excluded.recorded_at;
 end if;
 return new;
end $$;
create trigger consensus_vote after insert or update on public.nothingsports_nsc_contributions for each row execute function public.nothingsports_capture_consensus_vote();

-- Preserve the original function OID so cached callers cannot bypass dispatch.
do $$ begin execute replace(pg_get_functiondef('public.nothingsports_resolve_predictions(text,timestamptz,text)'::regprocedure),
 'FUNCTION public.nothingsports_resolve_predictions(', 'FUNCTION public.nothingsports_resolve_predictions_legacy(');end $$;
revoke all on function public.nothingsports_resolve_predictions_legacy(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.nothingsports_resolve_predictions_legacy(text,timestamptz,text) to service_role;
create or replace function public.nothingsports_resolve_predictions(target_event_id text,confirmed_end timestamptz default null,final_status text default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare r public.nothingsports_prediction_rules;p record;n integer;avg_rating numeric;answer integer;outcome text;total integer:=0;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 perform pg_advisory_xact_lock(hashtextextended('fixture:'||target_event_id,0));
 select * into r from public.nothingsports_prediction_rules where event_id=target_event_id;
 if r.version is distinct from 'consensus.v1' then return public.nothingsports_resolve_predictions_legacy(target_event_id,confirmed_end,final_status);end if;
 if final_status in('completed','finished','final','cancelled','canceled','abandoned') then
  update public.nothingsports_score_fixtures set status=final_status,ends_at=coalesce(r.completed_at,confirmed_end,clock_timestamp()) where event_id=target_event_id;
  select * into r from public.nothingsports_prediction_rules where event_id=target_event_id;
 end if;
 if r.settled_at is not null then return 0;end if;
 if r.cutoff is null or clock_timestamp()<r.cutoff then return 0;end if;
 for p in select x.*,f.starts_at,f.status from public.nothingsports_predictions x join public.nothingsports_score_fixtures f using(event_id) where x.event_id=target_event_id and x.result='pending' loop
  select count(*),avg(v.rating) into n,avg_rating from public.nothingsports_consensus_votes v where v.event_id=target_event_id and v.user_id<>p.user_id
   and v.recorded_at between r.completed_at and r.cutoff and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=v.user_id and m.moderation_flag);
  answer:=round(avg_rating)::integer;
  outcome:=case when p.status in('cancelled','canceled','abandoned') then 'cancelled' when p.starts_at is null or p.updated_at>=p.starts_at or n=0 then 'unscored' when answer=p.rating then 'success' else 'miss' end;
  update public.nothingsports_predictions set result=outcome,resolved_at=clock_timestamp() where user_id=p.user_id and event_id=target_event_id;
  insert into public.nothingsports_consensus_receipts values(target_event_id,p.user_id,r.version,r.cutoff,avg_rating,answer,n,outcome) on conflict do nothing;
  -- Existing points -> inbox trigger creates the successful reward receipt atomically.
  if outcome='success' then perform public.nothingsports_nsc_award_points(p.user_id,target_event_id,'foresight_bonus',19);total:=total+1;
  else insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,event_id,title,detail)
   values(p.user_id,'system','consensus:'||target_event_id,target_event_id,'Anticipation rating settled','Open your rewards for the outcome. Participation points are retained.') on conflict(recipient_user_id,source_key) do nothing;
  end if;
 end loop;
 update public.nothingsports_prediction_rules set settled_at=clock_timestamp() where event_id=target_event_id;
 return total;
end $$;

create function public.nothingsports_settle_consensus_batch() returns integer language plpgsql security invoker set search_path='' as $$
declare r record;total integer:=0;begin
 -- Match the award lock ordering used by rating mutations; serialize the small MVP batch.
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 -- Observe confirmed current facts without requiring a successful canonical release.
 for r in select distinct on (x.event_id) x.event_id,c.fixture from public.nothingsports_prediction_rules x
 join public.nothingsports_fixture_current c on c.identity_keys @> array[x.event_id]
 where x.version='consensus.v1' and x.cutoff is null and c.fixture->>'status' in('completed','finished','final','cancelled','canceled','abandoned')
 order by x.event_id,c.updated_at desc limit 50 loop
  update public.nothingsports_score_fixtures set ends_at=coalesce(nullif(r.fixture->>'actualEndTimeUtc','')::timestamptz,nullif(r.fixture->>'completedAt','')::timestamptz,nullif(r.fixture->>'resultPublishedAt','')::timestamptz,clock_timestamp()),status=r.fixture->>'status' where event_id=r.event_id;
 end loop;
 for r in select event_id from public.nothingsports_prediction_rules where version='consensus.v1' and settled_at is null and cutoff<=clock_timestamp() order by cutoff,event_id limit 50 loop
  total:=total+public.nothingsports_resolve_predictions(r.event_id);
 end loop;return total;
end $$;
revoke all on function public.nothingsports_assign_prediction_rule(),public.nothingsports_capture_consensus_vote(),public.nothingsports_resolve_predictions(text,timestamptz,text),public.nothingsports_settle_consensus_batch() from public,anon,authenticated;
grant execute on function public.nothingsports_assign_prediction_rule(),public.nothingsports_capture_consensus_vote(),public.nothingsports_resolve_predictions(text,timestamptz,text),public.nothingsports_settle_consensus_batch() to service_role;
