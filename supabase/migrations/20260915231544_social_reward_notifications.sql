alter table public.nothingsports_push_installations
  add column if not exists social_alerts_enabled boolean not null default true;

-- The copy reward belongs to the relationship, not to each copied sport. Keep
-- this ledger forever so removing and later re-copying follows cannot mint it
-- again. Backfill the older per-sport ledger before the new uniqueness rule is
-- used so existing rewards remain honoured.
create table if not exists public.nothingsports_copy_person_rewards (
  copier_user_id uuid not null references auth.users(id) on delete cascade,
  source_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (copier_user_id, source_user_id)
);

insert into public.nothingsports_copy_person_rewards(copier_user_id,source_user_id)
select distinct copier_id,source_id from public.nothingsports_pick_rewards
on conflict do nothing;

alter table public.nothingsports_copy_person_rewards enable row level security;
alter table public.nothingsports_copy_person_rewards force row level security;
revoke all on public.nothingsports_copy_person_rewards from public, anon, authenticated;
grant select, insert, update, delete on public.nothingsports_copy_person_rewards to service_role;

drop policy if exists "deny direct copy reward access" on public.nothingsports_copy_person_rewards;
create policy "deny direct copy reward access"
  on public.nothingsports_copy_person_rewards
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.nothingsports_social_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('profile_followed','follows_copied')),
  points smallint not null default 0 check (points between 0 and 25),
  sport text,
  dedupe_key text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index if not exists nothingsports_social_notifications_pending_idx
  on public.nothingsports_social_notifications (completed_at, claimed_at, created_at);

create table if not exists public.nothingsports_social_notification_deliveries (
  notification_id uuid not null references public.nothingsports_social_notifications(id) on delete cascade,
  installation_id uuid not null references public.nothingsports_push_installations(installation_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','uncertain','failed')),
  attempts integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(notification_id,installation_id)
);

alter table public.nothingsports_social_notifications enable row level security;
alter table public.nothingsports_social_notifications force row level security;
alter table public.nothingsports_social_notification_deliveries enable row level security;
alter table public.nothingsports_social_notification_deliveries force row level security;
revoke all on public.nothingsports_social_notifications,public.nothingsports_social_notification_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.nothingsports_social_notifications,public.nothingsports_social_notification_deliveries to service_role;

drop policy if exists "deny direct social notification access" on public.nothingsports_social_notifications;
create policy "deny direct social notification access"
  on public.nothingsports_social_notifications
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny direct social notification delivery access" on public.nothingsports_social_notification_deliveries;
create policy "deny direct social notification delivery access"
  on public.nothingsports_social_notification_deliveries
  for all to anon, authenticated
  using (false)
  with check (false);

create or replace function public.nothingsports_follow_person(actor uuid,target_profile uuid,following boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid;fresh_reward boolean:=false;new_relationship boolean:=false;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select p.user_id into target from public.nothingsports_nsc_profiles p where p.profile_id=target_profile and (not following or (p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag)));
 if target is null or target=actor then raise exception 'invalid_public_profile';end if;
 if following then
  insert into public.nothingsports_user_follows values(actor,target,clock_timestamp()) on conflict do nothing;
  new_relationship:=found;
  insert into public.nothingsports_follow_reward_history values(actor,target) on conflict do nothing;
  fresh_reward:=found;
  if fresh_reward then
   perform public.nothingsports_nsc_award_points(actor,'person:'||target,'follow_person',1);
   perform public.nothingsports_nsc_award_points(target,'follower:'||actor,'followed_by_person',1);
  end if;
  if new_relationship then
   insert into public.nothingsports_social_notifications(recipient_user_id,actor_user_id,kind,points,dedupe_key)
   values(target,actor,'profile_followed',case when fresh_reward then 1 else 0 end,'profile-follow:'||actor||':'||target)
   on conflict(dedupe_key) do nothing;
  end if;
 else
  delete from public.nothingsports_user_follows where follower_user_id=actor and followed_user_id=target;
 end if;
 return jsonb_build_object('targetProfileId',target_profile,'following',following);
end $$;

create or replace function public.nothingsports_copy_picks(actor uuid,source_profile uuid,expected_preferences jsonb,expected_events jsonb,new_preferences jsonb,new_events jsonb,added_sports text[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare source_user uuid;bonus integer:=0;state public.nothingsports_user_state%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select user_id into source_user from public.nothingsports_nsc_profiles p where profile_id=source_profile and visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=p.user_id and m.moderation_flag);
 if source_user is null or source_user=actor then raise exception 'invalid_public_profile';end if;
 insert into public.nothingsports_user_state(user_id) values(actor) on conflict do nothing;
 select * into state from public.nothingsports_user_state where user_id=actor for update;
 if state.preferences<>expected_preferences or state.event_user_state<>expected_events then raise exception 'preferences_changed_retry';end if;
 update public.nothingsports_user_state set preferences=new_preferences,event_user_state=new_events,updated_at=clock_timestamp() where user_id=actor;
 if coalesce(cardinality(added_sports),0)>0 then
  insert into public.nothingsports_copy_person_rewards(copier_user_id,source_user_id)
  values(actor,source_user) on conflict do nothing;
  if found then
   insert into public.nothingsports_nsc_points(user_id,event_id,action_key,points,sydney_day,sport)
   values(source_user,'picks:'||actor,'picks_copied',20,(clock_timestamp() at time zone 'Australia/Sydney')::date,null)
   on conflict do nothing;
   if found then
    bonus:=20;
    insert into public.nothingsports_social_notifications(recipient_user_id,actor_user_id,kind,points,sport,dedupe_key)
    values(source_user,actor,'follows_copied',20,null,'follows-copied:'||actor||':'||source_user)
    on conflict(dedupe_key) do nothing;
   end if;
  end if;
 end if;
 return jsonb_build_object('preferences',new_preferences,'eventUserState',new_events,'bonusAwarded',bonus);
end $$;

create or replace function public.nothingsports_claim_social_notifications(claim_at timestamptz,stale_before timestamptz,batch_limit integer default 100)
returns setof public.nothingsports_social_notifications
language sql security invoker set search_path='' as $$
 with candidates as (
  select id from public.nothingsports_social_notifications
  where completed_at is null and (claimed_at is null or claimed_at<stale_before)
  order by created_at
  for update skip locked
  limit least(greatest(batch_limit,1),100)
 )
 update public.nothingsports_social_notifications notification
 set claimed_at=claim_at,attempts=notification.attempts+1,last_error=null
 from candidates where notification.id=candidates.id
 returning notification.*
$$;

revoke all on function public.nothingsports_claim_social_notifications(timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_social_notifications(timestamptz,timestamptz,integer) to service_role;
revoke all on function public.nothingsports_follow_person(uuid,uuid,boolean),public.nothingsports_copy_picks(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_follow_person(uuid,uuid,boolean),public.nothingsports_copy_picks(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text[]) to service_role;
