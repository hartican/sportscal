-- Server-only additive state; production application belongs to the coordinated
-- release owner. Live delivery requires separately evidenced shadow/device gates.
create schema if not exists private;
create table public.nothingsports_milestone_rollout(
 id boolean primary key default true check(id),enabled boolean not null default false,
 shadow_verified_at timestamptz,device_verified_at timestamptz,
 shadow_evidence text,device_evidence text,
 check(not enabled or shadow_verified_at is not null and device_verified_at is not null and shadow_evidence is not null and device_evidence is not null and length(shadow_evidence)>0 and length(device_evidence)>0)
);
insert into public.nothingsports_milestone_rollout(id) values(true);
create table public.nothingsports_milestone_states(
 fixture_id text primary key,source_id text not null,state jsonb not null,state_hash text not null,updated_at timestamptz not null
);
create table public.nothingsports_milestone_shadow_runs(
 observed_at timestamptz primary key default clock_timestamp(),stats jsonb not null
);
create table public.nothingsports_moments(
 moment_id text primary key check(moment_id~'^[a-f0-9]{64}$'),fixture_id text not null,sport text not null,
 payload jsonb not null,expires_at timestamptz not null,updated_at timestamptz not null
);
create index nothingsports_moments_due on public.nothingsports_moments(expires_at,fixture_id);
create index nothingsports_moments_recent on public.nothingsports_moments(updated_at desc);
create table public.nothingsports_milestone_groups(
 group_id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 fixture_id text not null,score_hash text not null,status text not null default 'sending' check(status in('sending','sent','uncertain','failed','suppressed')),
 created_at timestamptz not null,expires_at timestamptz not null
);
create index nothingsports_milestone_budget on public.nothingsports_milestone_groups(user_id,created_at desc) include(fixture_id,status);
create table public.nothingsports_milestone_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,moment_id text not null references public.nothingsports_moments(moment_id) on delete cascade,
 group_id uuid references public.nothingsports_milestone_groups(group_id) on delete cascade,disposition text not null,created_at timestamptz not null,
 primary key(user_id,moment_id)
);
create index nothingsports_milestone_receipts_moment on public.nothingsports_milestone_receipts(moment_id);
create index nothingsports_milestone_receipts_group on public.nothingsports_milestone_receipts(group_id);
create table public.nothingsports_milestone_installations(
 group_id uuid not null references public.nothingsports_milestone_groups(group_id) on delete cascade,
 installation_id uuid not null references public.nothingsports_push_installations(installation_id) on delete cascade,
 status text not null check(status in('sending','sent','pending','uncertain','failed','suppressed')),attempts integer not null default 1,
 started_at timestamptz not null,primary key(group_id,installation_id)
);
create index nothingsports_milestone_installations_device on public.nothingsports_milestone_installations(installation_id);
do $$ declare t text;begin
 foreach t in array array['milestone_rollout','milestone_states','milestone_shadow_runs','moments','milestone_groups','milestone_receipts','milestone_installations'] loop
  execute format('alter table public.nothingsports_%I enable row level security',t);
  execute format('revoke all on public.nothingsports_%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.nothingsports_%I to service_role',t);
 end loop;
end $$;
create function public.nothingsports_milestone_maintenance()
returns void language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$begin
 delete from public.nothingsports_milestone_groups where created_at<clock_timestamp()-interval '30 days';
 delete from public.nothingsports_moments where updated_at<clock_timestamp()-interval '30 days';
 delete from public.nothingsports_milestone_states where updated_at<clock_timestamp()-interval '30 days';
 delete from public.nothingsports_milestone_shadow_runs where observed_at<clock_timestamp()-interval '30 days';
end $$;
revoke all on function public.nothingsports_milestone_maintenance() from public,anon,authenticated;
grant execute on function public.nothingsports_milestone_maintenance() to service_role;
-- Preserve the deployed inbox maintenance body and call it through its
-- existing public RPC. Retention also runs when milestone mode is off.
alter function public.nothingsports_inbox_maintenance() rename to nothingsports_inbox_maintenance_before_milestones;
alter function public.nothingsports_inbox_maintenance_before_milestones() set schema private;
revoke all on function private.nothingsports_inbox_maintenance_before_milestones() from public,anon,authenticated;
grant execute on function private.nothingsports_inbox_maintenance_before_milestones() to service_role;
create function public.nothingsports_inbox_maintenance()
returns void language plpgsql security invoker set search_path='' as $$begin
 perform private.nothingsports_inbox_maintenance_before_milestones();
 perform public.nothingsports_milestone_maintenance();
end $$;
revoke all on function public.nothingsports_inbox_maintenance() from public,anon,authenticated;
grant execute on function public.nothingsports_inbox_maintenance() to service_role;
create function public.nothingsports_record_milestone_shadow(stats jsonb)
returns void language plpgsql security invoker set search_path='' as $$begin
 if stats->>'mode'<>'shadow' or length(stats::text)>1000 then raise exception 'Invalid shadow receipt';end if;
 insert into public.nothingsports_milestone_shadow_runs(stats) values(stats);
 delete from public.nothingsports_milestone_shadow_runs where observed_at<clock_timestamp()-interval '30 days';
end $$;
revoke all on function public.nothingsports_record_milestone_shadow(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_record_milestone_shadow(jsonb) to service_role;

create function public.nothingsports_milestone_observations(p_source_id text,p_fixture_ids text[])
returns table(fixture_id text,fixture jsonb,previous jsonb,previous_hash text,score_hash text)
language sql security invoker set search_path='' set statement_timeout='3s' as $$
 select c.fixture_id,public.nothingsports_project_fixture_observations(c.fixture,s.score,src.discovery_report->'_fixtureObservations'->c.fixture_id,s.first_completed_at),old.state,old.state_hash,s.content_hash
 from public.nothingsports_fixture_current c join public.nothingsports_live_scores s using(source_id,fixture_id)
 join public.nothingsports_fixture_sources src using(source_id)
 left join public.nothingsports_milestone_states old on old.fixture_id=c.fixture_id
 where cardinality(p_fixture_ids) between 1 and 2 and c.source_id=p_source_id and c.fixture_id=any(p_fixture_ids)
$$;
create function public.nothingsports_commit_milestone_observations(p_source_id text,packets jsonb)
returns integer language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare p jsonb;m jsonb;old_hash text;written integer:=0;stamp timestamptz:=clock_timestamp();begin
 if jsonb_typeof(packets)<>'array' or jsonb_array_length(packets)>2 then raise exception 'Invalid milestone observation batch';end if;
 for p in select value from jsonb_array_elements(packets) loop
  perform pg_advisory_xact_lock(hashtextextended('milestone-fixture:'||(p->>'fixture_id'),0));
  select state_hash into old_hash from public.nothingsports_milestone_states where fixture_id=p->>'fixture_id';
  if old_hash is distinct from p->>'previous_hash' or not exists(select 1 from public.nothingsports_live_scores s where s.source_id=p_source_id and s.fixture_id=p->>'fixture_id' and s.content_hash=p->>'score_hash') then continue;end if;
  if jsonb_typeof(p->'moments')<>'array' or jsonb_array_length(p->'moments')>20 or p#>>'{state,id}'<>p->>'fixture_id' then raise exception 'Invalid milestone state';end if;
  insert into public.nothingsports_milestone_states(fixture_id,source_id,state,state_hash,updated_at) values(p->>'fixture_id',p_source_id,p->'state',md5((p->'state')::text),stamp)
  on conflict(fixture_id) do update set state=excluded.state,state_hash=excluded.state_hash,updated_at=excluded.updated_at;
  for m in select value from jsonb_array_elements(p->'moments') loop
   if m->>'schemaVersion'<>'sport-moment.v1' or m->>'eventId'<>p->>'fixture_id' or m->>'stage' not in('approaching','achieved') or m->>'family' not in('records','finishes','bowling','centuries','extraBatting') then raise exception 'Invalid sport moment';end if;
   insert into public.nothingsports_moments(moment_id,fixture_id,sport,payload,expires_at,updated_at)
   values(m->>'momentId',p->>'fixture_id','cricket',m,(m->>'observedAt')::timestamptz+case when m->>'stage'='achieved' then interval '5 minutes' else interval '4 minutes' end,stamp)
   on conflict(moment_id) do update set payload=case when nothingsports_moments.payload->>'stage'='achieved' then nothingsports_moments.payload else excluded.payload end,
    expires_at=case when nothingsports_moments.payload->>'stage'='achieved' then nothingsports_moments.expires_at else excluded.expires_at end,updated_at=excluded.updated_at;
   written:=written+1;
  end loop;
 end loop;
 delete from public.nothingsports_milestone_groups where created_at<stamp-interval '30 days';
 delete from public.nothingsports_moments where updated_at<stamp-interval '30 days';
 delete from public.nothingsports_milestone_states where updated_at<stamp-interval '30 days';
 return written;
end $$;
create function public.nothingsports_discard_milestone_moments(target_user uuid,moment_ids text[],discard_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$begin
 if cardinality(moment_ids)>20 then raise exception 'Invalid milestone discard batch';end if;
 insert into public.nothingsports_milestone_receipts(user_id,moment_id,disposition,created_at)
 select target_user,moment_id,'choice',discard_at from public.nothingsports_moments where moment_id=any(moment_ids)
 on conflict do nothing;
end $$;
revoke all on function public.nothingsports_discard_milestone_moments(uuid,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_discard_milestone_moments(uuid,text[],timestamptz) to service_role;

-- A cron has no account JWT. Only this private, tightly scoped reader checks
-- registered-account eligibility; service_role is not granted Auth table access.
create function private.nothingsports_milestone_accounts(p_moment_ids text[])
returns table(user_id uuid,preferences jsonb,actions jsonb,spoilers jsonb,updated_at timestamptz)
language sql security definer set search_path='' set statement_timeout='3s' as $$
 select s.user_id,s.preferences,s.event_user_state,s.event_spoiler_state,s.updated_at
 from public.nothingsports_user_state s join auth.users u on u.id=s.user_id
 where cardinality(p_moment_ids) between 1 and 20 and u.is_anonymous=false and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=s.user_id)
 and exists(select 1 from public.nothingsports_push_installations i where i.user_id=s.user_id and i.permission='granted')
 and exists(select 1 from public.nothingsports_moments m where m.moment_id=any(p_moment_ids) and m.expires_at>clock_timestamp() and not exists(select 1 from public.nothingsports_milestone_receipts r where r.user_id=s.user_id and r.moment_id=m.moment_id))
 order by s.user_id limit 100
$$;
revoke all on function private.nothingsports_milestone_accounts(text[]) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.nothingsports_milestone_accounts(text[]) to service_role;
create function public.nothingsports_milestone_accounts(p_moment_ids text[])
returns table(user_id uuid,preferences jsonb,actions jsonb,spoilers jsonb,updated_at timestamptz)
language sql security invoker set search_path='' as $$ select * from private.nothingsports_milestone_accounts(p_moment_ids) $$;

create function public.nothingsports_claim_milestone_group(target_user uuid,expected_updated timestamptz,target_fixture text,moment_ids text[],expected_score_hash text,coverage text,claim_at timestamptz)
returns uuid language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare account public.nothingsports_user_state;ids text[];g uuid;per_match integer;total integer;gap interval;begin
 if not exists(select 1 from public.nothingsports_milestone_rollout where enabled and shadow_verified_at is not null and device_verified_at is not null and length(shadow_evidence)>0 and length(device_evidence)>0) then return null;end if;
 if coverage not in('low','medium','high') or cardinality(moment_ids) not between 1 and 5 or abs(extract(epoch from clock_timestamp()-claim_at))>30 then raise exception 'Invalid milestone claim';end if;
 perform pg_advisory_xact_lock(hashtextextended('milestone-user:'||target_user::text,0));
 if not exists(select 1 from public.nothingsports_live_scores s join public.nothingsports_fixture_sources src using(source_id) where s.source_id='cricket-ca-current' and s.fixture_id=target_fixture and s.content_hash=expected_score_hash and src.failure_count=0) then return null;end if;
 select * into account from public.nothingsports_user_state where user_id=target_user and updated_at=expected_updated for update;
 if not found or coalesce(account.preferences#>>'{followFirst,notifications,enabled}','true')='false' or coalesce(account.preferences#>>'{followFirst,notifications,milestones,enabled}','true')='false' or account.preferences#>'{followFirst,notifications,milestones}'='false'::jsonb or coalesce(account.preferences#>>'{followFirst,notifications,milestones,sports,cricket,coverage}','medium')='off'
 or exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=target_user) then return null;end if;
 if coverage<>coalesce(account.preferences#>>'{followFirst,notifications,milestones,sports,cricket,coverage}','medium') then return null;end if;
 select array_agg(m.moment_id) into ids from public.nothingsports_moments m where m.moment_id=any(moment_ids) and m.fixture_id=target_fixture and m.expires_at>claim_at and not exists(select 1 from public.nothingsports_milestone_receipts r where r.user_id=target_user and r.moment_id=m.moment_id);
 if ids is null then return null;end if;
 per_match:=case coverage when 'low' then 1 when 'medium' then 3 else 6 end;total:=case coverage when 'low' then 3 when 'medium' then 6 else 12 end;gap:=case coverage when 'low' then interval '60 minutes' when 'medium' then interval '20 minutes' else interval '10 minutes' end;
 if (select count(*) from public.nothingsports_milestone_groups where user_id=target_user and status in('sending','sent','uncertain') and created_at>claim_at-interval '24 hours')>=total
 or (select count(*) from public.nothingsports_milestone_groups where user_id=target_user and fixture_id=target_fixture and status in('sending','sent','uncertain') and created_at>claim_at-interval '24 hours')>=per_match
 or exists(select 1 from public.nothingsports_milestone_groups where user_id=target_user and status in('sending','sent','uncertain') and created_at>claim_at-gap) then
  insert into public.nothingsports_milestone_receipts(user_id,moment_id,disposition,created_at) select target_user,unnest(ids),'budget',claim_at on conflict do nothing;return null;
 end if;
 insert into public.nothingsports_milestone_groups(user_id,fixture_id,score_hash,created_at,expires_at) values(target_user,target_fixture,expected_score_hash,claim_at,claim_at+interval '2 minutes') returning group_id into g;
 insert into public.nothingsports_milestone_receipts(user_id,moment_id,group_id,disposition,created_at) select target_user,unnest(ids),g,'claimed',claim_at;
 return g;
end $$;

create function public.nothingsports_claim_milestone_installation(target_group uuid,target_installation uuid,expected_updated timestamptz,claim_at timestamptz)
returns integer language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare attempts integer;begin
 if not exists(select 1 from public.nothingsports_milestone_groups g join public.nothingsports_user_state s on s.user_id=g.user_id join public.nothingsports_push_installations i on i.user_id=g.user_id join public.nothingsports_live_scores live on live.fixture_id=g.fixture_id and live.source_id='cricket-ca-current' join public.nothingsports_fixture_sources src on src.source_id=live.source_id
 where g.group_id=target_group and g.expires_at>claim_at and live.content_hash=g.score_hash and src.failure_count=0 and i.installation_id=target_installation and i.permission='granted' and s.updated_at=expected_updated
 and coalesce(s.preferences#>>'{followFirst,notifications,enabled}','true')<>'false' and coalesce(s.preferences#>>'{followFirst,notifications,milestones,enabled}','true')<>'false' and coalesce(s.preferences#>'{followFirst,notifications,milestones}','{}')<>'false'::jsonb
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=g.user_id)) then return 0;end if;
 insert into public.nothingsports_milestone_installations(group_id,installation_id,status,started_at) values(target_group,target_installation,'sending',claim_at)
 on conflict(group_id,installation_id) do update set status='sending',attempts=nothingsports_milestone_installations.attempts+1,started_at=excluded.started_at
 where nothingsports_milestone_installations.status='pending' and nothingsports_milestone_installations.attempts<3 returning nothingsports_milestone_installations.attempts into attempts;
 return coalesce(attempts,0);
end $$;
revoke all on function public.nothingsports_milestone_observations(text,text[]),public.nothingsports_commit_milestone_observations(text,jsonb),public.nothingsports_milestone_accounts(text[]),public.nothingsports_claim_milestone_group(uuid,timestamptz,text,text[],text,text,timestamptz),public.nothingsports_claim_milestone_installation(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_milestone_observations(text,text[]),public.nothingsports_commit_milestone_observations(text,jsonb),public.nothingsports_milestone_accounts(text[]),public.nothingsports_claim_milestone_group(uuid,timestamptz,text,text[],text,text,timestamptz),public.nothingsports_claim_milestone_installation(uuid,uuid,timestamptz,timestamptz) to service_role;
