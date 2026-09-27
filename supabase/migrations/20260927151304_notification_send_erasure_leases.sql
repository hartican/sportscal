set local lock_timeout='2s';
set local statement_timeout='15s';
-- No endpoint, payload, credential or recipient name is retained. UUID lineage
-- deliberately survives Auth deletion until reconciliation or bounded retention.
create table public.nothingsports_notification_send_leases (
 lease_id uuid primary key default gen_random_uuid(),
 account_ids uuid[] not null,
 created_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 outcome text not null default 'in_flight' check(outcome in ('in_flight','accepted','rejected','uncertain'))
);
create index on public.nothingsports_notification_send_leases using gin(account_ids);
create index on public.nothingsports_notification_send_leases(created_at);
alter table public.nothingsports_notification_send_leases enable row level security;
alter table public.nothingsports_notification_send_leases force row level security;
revoke all on public.nothingsports_notification_send_leases from public,anon,authenticated;
grant select,insert,update,delete on public.nothingsports_notification_send_leases to service_role;
create function public.nothingsports_begin_notification_send(target_installation uuid,expected_user uuid,related_users uuid[] default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare installation public.nothingsports_push_installations;actors uuid[];actor uuid;lease uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'notification_send_requires_read_committed';end if;
 if cardinality(related_users)>100 then raise exception 'too_many_related_accounts';end if;
 select * into installation from public.nothingsports_push_installations where installation_id=target_installation;
 if not found or installation.user_id is distinct from expected_user or installation.permission<>'granted' then return null;end if;
 select coalesce(array_agg(distinct a order by a),'{}'::uuid[]) into actors
 from unnest(array_append(coalesce(related_users,'{}'),installation.user_id)) a where a is not null;
 foreach actor in array actors loop
  perform pg_advisory_xact_lock_shared(hashtextextended('account-erasure:'||actor::text,0));
  if exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=actor) then return null;end if;
 end loop;
 -- Recheck after waiting for locks, and return current keys only to this service RPC.
 select * into installation from public.nothingsports_push_installations where installation_id=target_installation for share;
 if not found or installation.user_id is distinct from expected_user or installation.permission<>'granted' then return null;end if;
 insert into public.nothingsports_notification_send_leases(account_ids) values(actors) returning lease_id into lease;
 -- Prune only finished receipts; a crashed/in-flight attempt requires reconciliation.
 delete from public.nothingsports_notification_send_leases where lease_id in (
  select lease_id from public.nothingsports_notification_send_leases where finished_at<clock_timestamp()-interval '7 days' order by finished_at limit 100
 );
 return jsonb_build_object('leaseId',lease,'subscription',jsonb_build_object('endpoint',installation.endpoint,'keys',jsonb_build_object('p256dh',installation.p256dh,'auth',installation.auth_key)));
end $$;
revoke all on function public.nothingsports_begin_notification_send(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.nothingsports_begin_notification_send(uuid,uuid,uuid[]) to service_role;

create or replace function public.nothingsports_claim_due_reminders(
  claim_at timestamptz,
  oldest_due timestamptz,
  stale_before timestamptz,
  batch_limit integer default 100
)
returns setof public.nothingsports_reminders
language sql security invoker set search_path = '' as $$
  with candidates as (
    select reminder.id
    from public.nothingsports_reminders reminder
    where reminder.dispatched_at is null
      and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=reminder.user_id)
      and not exists(select 1 from public.nothingsports_push_installations i join public.nothingsports_account_erasure_blocks b on b.user_id=i.user_id where i.installation_id=reminder.installation_id)
      and reminder.remind_at <= claim_at
      and reminder.remind_at >= oldest_due
      and (reminder.claimed_at is null or reminder.claimed_at < stale_before)
    order by reminder.remind_at
    for update skip locked
    limit greatest(1,least(batch_limit,100))
  )
  update public.nothingsports_reminders reminder
     set claimed_at=claim_at,updated_at=claim_at
    from candidates
   where reminder.id=candidates.id
  returning reminder.*;
$$;

create or replace function public.nothingsports_claim_social_notifications(claim_at timestamptz,stale_before timestamptz,batch_limit integer default 100)
returns setof public.nothingsports_social_notifications
language sql security invoker set search_path='' as $$
 with candidates as (
  select id from public.nothingsports_social_notifications
  where not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=recipient_user_id or b.user_id=actor_user_id)
  and completed_at is null and (claimed_at is null or claimed_at<stale_before)
  order by created_at
  for update skip locked
  limit least(greatest(batch_limit,1),100)
 )
 update public.nothingsports_social_notifications notification
 set claimed_at=claim_at,attempts=notification.attempts+1,last_error=null
 from candidates where notification.id=candidates.id
 returning notification.*
$$;
