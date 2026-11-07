-- Private owner posting tasks. The existing notification dispatcher is the only scheduler.
alter table public.nothingsports_marquee_campaigns add column if not exists posted_at timestamptz;
alter table public.nothingsports_marquee_campaigns add column if not exists snoozed_until timestamptz;
create table public.nothingsports_comms_refresh_state (
  singleton boolean primary key default true check(singleton),
  source_revision text,
  refreshed_at timestamptz,
  lease_until timestamptz,
  lease_token uuid,
  last_error text
);
insert into public.nothingsports_comms_refresh_state(singleton) values(true);
create table public.nothingsports_comms_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  installation_id uuid references public.nothingsports_push_installations(installation_id) on delete cascade,
  alerts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create index nothingsports_comms_preferences_installation_idx on public.nothingsports_comms_preferences(installation_id);
create table public.nothingsports_comms_post_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.nothingsports_marquee_campaigns(campaign_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null references public.nothingsports_push_installations(installation_id) on delete cascade,
  kind text not null check(kind in ('before','due')),
  scheduled_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  outcome text not null default 'claimed' check(outcome in ('claimed','sent','failed','suppressed','uncertain')),
  finished_at timestamptz,
  unique(campaign_id,user_id,kind,scheduled_at)
);
create index nothingsports_comms_receipts_user_idx on public.nothingsports_comms_post_receipts(user_id);
create index nothingsports_comms_receipts_installation_idx on public.nothingsports_comms_post_receipts(installation_id);
create index nothingsports_comms_pending_idx on public.nothingsports_marquee_campaigns(proposed_send_at) where posted_at is null and state <> 'cancelled';
create index nothingsports_comms_heat_idx on public.nothingsports_nsc_contributions(event_id,user_id,updated_at desc) where phase='heat';
alter table public.nothingsports_comms_refresh_state enable row level security;
alter table public.nothingsports_comms_refresh_state force row level security;
alter table public.nothingsports_comms_preferences enable row level security;
alter table public.nothingsports_comms_preferences force row level security;
alter table public.nothingsports_comms_post_receipts enable row level security;
alter table public.nothingsports_comms_post_receipts force row level security;
revoke all on public.nothingsports_comms_refresh_state,public.nothingsports_comms_preferences,public.nothingsports_comms_post_receipts from public,anon,authenticated;
grant all on public.nothingsports_comms_refresh_state,public.nothingsports_comms_preferences,public.nothingsports_comms_post_receipts to service_role;
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_comms_preferences for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_comms_post_receipts for each row execute function private.nothingsports_guard_erasure_write('user_id');

create function public.nothingsports_comms_claim_refresh(target_revision text, force_refresh boolean default false)
returns uuid language plpgsql security invoker set search_path=public as $$
declare token uuid;
begin
  update nothingsports_comms_refresh_state set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
  where singleton and (lease_until is null or lease_until<now())
    and (force_refresh or source_revision is distinct from target_revision or refreshed_at is null or refreshed_at<now()-interval '6 hours')
  returning lease_token into token;
  return token;
end $$;

create function public.nothingsports_comms_heat()
returns table(event_id text,mean numeric,count bigint) language sql security invoker set search_path=public as $$
  select v.event_id,avg(v.rating)::numeric,count(*)
  from (
    select distinct on (c.event_id,c.user_id) c.event_id,c.rating
    from nothingsports_nsc_contributions c
    join nothingsports_nsc_pilot_members p on p.user_id=c.user_id and p.approved and not p.suspended
    where c.phase='heat' and c.updated_at<=now()
    order by c.event_id,c.user_id,c.updated_at desc
  ) v group by v.event_id;
$$;

-- Synchronisation and autosave share the row lock and expected revision. A stale refresh never replaces a local edit.
create function public.nothingsports_comms_sync(target_id text, expected_revision integer, target_candidate jsonb,target_copy jsonb, target_hash text,target_send timestamptz,actor_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare c nothingsports_marquee_campaigns;
begin
  select * into c from nothingsports_marquee_campaigns where campaign_id=target_id for update;
  if not found then
    insert into nothingsports_marquee_campaigns(campaign_id,event_id,source_revision,campaign_revision,content_hash,state,candidate,draft_copy,proposed_send_at)
    values(target_id,target_candidate->>'eventId',target_candidate#>>'{source,revision}',1,target_hash,'draft',target_candidate,target_copy,target_send)
    on conflict do nothing returning * into c;
    if c.campaign_id is null then return jsonb_build_object('conflict',true);end if;
  else
    if c.campaign_revision<>expected_revision then return jsonb_build_object('conflict',true);end if;
    if c.content_hash=target_hash then return jsonb_build_object('unchanged',true,'campaign',to_jsonb(c));end if;
    insert into nothingsports_marquee_campaign_versions(campaign_id,campaign_revision,snapshot,reason,created_by)
    values(c.campaign_id,c.campaign_revision,jsonb_build_object('draftCopy',c.draft_copy,'candidate',c.candidate,'proposedSendAt',c.proposed_send_at),'pre-source-sync',actor_id) on conflict do nothing;
    update nothingsports_marquee_campaigns set candidate=target_candidate,draft_copy=target_copy,content_hash=target_hash,
    source_revision=target_candidate#>>'{source,revision}',campaign_revision=c.campaign_revision+1,
    proposed_send_at=case when c.draft_copy#>>'{cms,manualPostAt}' is not null then c.proposed_send_at else target_send end,
    export_stale=export_snapshot is not null,updated_at=now() where campaign_id=target_id returning * into c;
  end if;
  insert into nothingsports_marquee_campaign_versions(campaign_id,campaign_revision,snapshot,reason,created_by)
  values(c.campaign_id,c.campaign_revision,jsonb_build_object('draftCopy',c.draft_copy,'candidate',c.candidate,'proposedSendAt',c.proposed_send_at),'candidate-source-sync',actor_id) on conflict do nothing;
  return jsonb_build_object('campaign',to_jsonb(c));
end $$;

create function public.nothingsports_comms_claim_posts(claim_at timestamptz default now())
returns table(receipt_id uuid,campaign_id text,user_id uuid,installation_id uuid,kind text,title text,scheduled_at timestamptz)
language plpgsql security invoker set search_path=public as $$
begin
  return query with due as (
    select c.campaign_id,p.user_id,p.installation_id,
      case when coalesce(c.snoozed_until,c.proposed_send_at)<=claim_at then 'due' else 'before' end as kind,
      coalesce(c.snoozed_until,c.proposed_send_at) as scheduled_at,
      coalesce(c.candidate#>>'{material,recognisableTitle}',c.event_id) as title
    from nothingsports_marquee_campaigns c
    join nothingsports_comms_preferences p on p.alerts_enabled
    join nothingsports_push_installations i on i.installation_id=p.installation_id and i.user_id=p.user_id and i.permission='granted'
    where c.posted_at is null and c.state<>'cancelled'
      and coalesce(c.snoozed_until,c.proposed_send_at)<=claim_at+interval '30 minutes'
      and (nullif(c.candidate#>>'{timing,endTimeUtc}','') is null or nullif(c.candidate#>>'{timing,endTimeUtc}','')::timestamptz>claim_at)
      and not exists(select 1 from nothingsports_comms_post_receipts r where r.campaign_id=c.campaign_id and r.user_id=p.user_id
        and r.scheduled_at=coalesce(c.snoozed_until,c.proposed_send_at) and r.kind=case when coalesce(c.snoozed_until,c.proposed_send_at)<=claim_at then 'due' else 'before' end)
    order by coalesce(c.snoozed_until,c.proposed_send_at),c.campaign_id limit 2
  ), inserted as (
    insert into nothingsports_comms_post_receipts(campaign_id,user_id,installation_id,kind,scheduled_at,claimed_at)
    select d.campaign_id,d.user_id,d.installation_id,d.kind,d.scheduled_at,claim_at from due d
    on conflict do nothing returning *
  ) select r.receipt_id,r.campaign_id,r.user_id,r.installation_id,r.kind,d.title,r.scheduled_at from inserted r join due d on d.campaign_id=r.campaign_id and d.user_id=r.user_id;
end $$;

create function public.nothingsports_comms_sync_batch(items jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb;result jsonb;updated integer:=0;conflicts integer:=0;
begin
  if jsonb_array_length(items)>100 then raise exception 'comms_batch_too_large';end if;
  for item in select value from jsonb_array_elements(items) loop
    result:=nothingsports_comms_sync(item->>'id',(item->>'revision')::integer,item->'candidate',item->'copy',item->>'hash',nullif(item->>'send','')::timestamptz,null);
    if coalesce((result->>'conflict')::boolean,false) then conflicts:=conflicts+1;
    elsif not coalesce((result->>'unchanged')::boolean,false) then updated:=updated+1;end if;
  end loop;
  return jsonb_build_object('updated',updated,'conflicts',conflicts);
end $$;
revoke all on function public.nothingsports_comms_sync_batch(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_comms_sync_batch(jsonb) to service_role;

create function public.nothingsports_comms_task(target_id text,expected_revision integer,task_action text,task_time timestamptz,actor_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare c nothingsports_marquee_campaigns;
begin
  select * into c from nothingsports_marquee_campaigns where campaign_id=target_id for update;
  if not found then return jsonb_build_object('missing',true);end if;
  if c.campaign_revision<>expected_revision then return jsonb_build_object('conflict',true,'campaign',to_jsonb(c));end if;
  if task_action not in('posted','unposted','snooze','schedule') then raise exception 'invalid task action';end if;
  insert into nothingsports_marquee_campaign_versions(campaign_id,campaign_revision,snapshot,reason,created_by)
  values(c.campaign_id,c.campaign_revision,jsonb_build_object('draftCopy',c.draft_copy,'candidate',c.candidate,'proposedSendAt',c.proposed_send_at),'pre-task-change',actor_id) on conflict do nothing;
  update nothingsports_marquee_campaigns set
    posted_at=case when task_action='posted' then now() when task_action='unposted' then null else posted_at end,
    snoozed_until=case when task_action='snooze' then task_time else null end,
    proposed_send_at=case when task_action='schedule' then task_time else proposed_send_at end,
    draft_copy=case when task_action='schedule' then jsonb_set(jsonb_set(draft_copy,'{cms}',coalesce(draft_copy->'cms','{}')), '{cms,manualPostAt}',to_jsonb(task_time)) else draft_copy end,
    campaign_revision=campaign_revision+1,export_stale=export_snapshot is not null,updated_at=now()
  where campaign_id=target_id returning * into c;
  insert into nothingsports_marquee_campaign_versions(campaign_id,campaign_revision,snapshot,reason,created_by)
  values(c.campaign_id,c.campaign_revision,jsonb_build_object('draftCopy',c.draft_copy,'candidate',c.candidate,'proposedSendAt',c.proposed_send_at),task_action,actor_id) on conflict do nothing;
  return jsonb_build_object('campaign',to_jsonb(c));
end $$;
revoke all on function public.nothingsports_comms_task(text,integer,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_comms_task(text,integer,text,timestamptz,uuid) to service_role;
revoke all on function public.nothingsports_comms_claim_refresh(text,boolean),public.nothingsports_comms_heat(),public.nothingsports_comms_sync(text,integer,jsonb,jsonb,text,timestamptz,uuid),public.nothingsports_comms_claim_posts(timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_comms_claim_refresh(text,boolean),public.nothingsports_comms_heat(),public.nothingsports_comms_sync(text,integer,jsonb,jsonb,text,timestamptz,uuid),public.nothingsports_comms_claim_posts(timestamptz) to service_role;
