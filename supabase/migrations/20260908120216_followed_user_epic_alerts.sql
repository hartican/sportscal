-- Explicit user relationships and transactional live-rating alert outbox.
create table if not exists public.nothingsports_user_follows (
 follower_user_id uuid not null references auth.users(id) on delete cascade,
 followed_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_user_id,followed_user_id),
 check(follower_user_id<>followed_user_id)
);
create index if not exists nothingsports_user_follows_target on public.nothingsports_user_follows(followed_user_id,follower_user_id);
create table if not exists public.nothingsports_live_rating_alerts (
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null,
 created_at timestamptz not null default now(),
 ready_at timestamptz not null default (now()+interval '60 seconds'),
 completed_at timestamptz,
 unique(recipient_user_id,event_id)
);
create index if not exists nothingsports_live_rating_alerts_pending on public.nothingsports_live_rating_alerts(ready_at) where completed_at is null;
create table if not exists public.nothingsports_live_rating_deliveries (
 alert_id uuid not null references public.nothingsports_live_rating_alerts(id) on delete cascade,
 installation_id uuid not null references public.nothingsports_push_installations(installation_id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent','uncertain','failed')),
 attempts integer not null default 0,
 updated_at timestamptz not null default now(),
 primary key(alert_id,installation_id)
);
alter table public.nothingsports_push_installations add column if not exists live_ratings_enabled boolean not null default true;
alter table public.nothingsports_user_follows enable row level security;
alter table public.nothingsports_live_rating_alerts enable row level security;
alter table public.nothingsports_live_rating_deliveries enable row level security;
revoke all on public.nothingsports_user_follows,public.nothingsports_live_rating_alerts,public.nothingsports_live_rating_deliveries from anon,authenticated;
grant all on public.nothingsports_user_follows,public.nothingsports_live_rating_alerts,public.nothingsports_live_rating_deliveries to service_role;
-- No browser grants: the authenticated server resolves actor identity and public profile visibility.
create or replace function public.nothingsports_enqueue_live_rating_alert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.phase='pulse' and new.rating=5 then
  insert into public.nothingsports_live_rating_alerts(recipient_user_id,event_id)
  select f.follower_user_id,new.event_id from public.nothingsports_user_follows f
  join public.nothingsports_nsc_profiles p on p.user_id=f.followed_user_id and p.visibility='visible'
  where f.followed_user_id=new.user_id
  and not exists(select 1 from public.nothingsports_nsc_personas m where m.user_id=new.user_id and m.moderation_flag)
  on conflict(recipient_user_id,event_id) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.nothingsports_enqueue_live_rating_alert() from public,anon,authenticated;
drop trigger if exists nothingsports_live_rating_alert_outbox on public.nothingsports_nsc_contributions;
create trigger nothingsports_live_rating_alert_outbox after insert or update of rating,updated_at on public.nothingsports_nsc_contributions for each row execute function public.nothingsports_enqueue_live_rating_alert();
create or replace function public.nothingsports_claim_live_rating_delivery(target_alert uuid,target_installation uuid)
returns setof public.nothingsports_live_rating_deliveries language plpgsql security definer set search_path='' as $$
begin
 insert into public.nothingsports_live_rating_deliveries(alert_id,installation_id) values(target_alert,target_installation) on conflict do nothing;
 return query update public.nothingsports_live_rating_deliveries set status='sending',attempts=attempts+1,updated_at=now()
 where alert_id=target_alert and installation_id=target_installation and status='pending' and attempts<3 returning *;
end; $$;
revoke all on function public.nothingsports_claim_live_rating_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_live_rating_delivery(uuid,uuid) to service_role;
