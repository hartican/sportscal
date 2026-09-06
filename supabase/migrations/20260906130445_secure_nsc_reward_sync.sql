-- Keep the privileged auth.users lookup outside the exposed public schema.
-- PostgREST calls the public invoker wrapper as service_role; the private
-- definer performs only the fixed reward entitlement reconciliation.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.nothingsports_nsc_sync_rewards(
  target_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.nothingsports_nsc_reward_entitlements(user_id,campaign_id,entries)
  select
    u.id,
    c.id,
    least(c.max_entries,floor(sum(p.points)::numeric/c.points_per_entry)::integer)
  from public.nothingsports_nsc_reward_campaigns c
  cross join auth.users u
  join public.nothingsports_nsc_points p on p.user_id=u.id
  where c.active
    and length(c.terms_url)>0
    and c.starts_at<=clock_timestamp()
    and (c.ends_at is null or c.ends_at>clock_timestamp())
    and (target_user_id is null or u.id=target_user_id)
    and not coalesce(u.is_anonymous,false)
    and (c.eligibility='registered' or u.id=any(c.eligible_user_ids))
    and (c.kind='privilege' or p.awarded_at>=c.starts_at)
  group by u.id,c.id
  having sum(p.points)>=c.points_per_entry
  on conflict(user_id,campaign_id) do update
    set entries=greatest(
      public.nothingsports_nsc_reward_entitlements.entries,
      excluded.entries
    ),updated_at=clock_timestamp();
end
$$;

revoke all on function private.nothingsports_nsc_sync_rewards(uuid)
  from public, anon, authenticated;
grant execute on function private.nothingsports_nsc_sync_rewards(uuid)
  to service_role;

create or replace function public.nothingsports_nsc_sync_rewards(
  target_user_id uuid default null
) returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  perform private.nothingsports_nsc_sync_rewards(target_user_id);
end
$$;

revoke all on function public.nothingsports_nsc_sync_rewards(uuid)
  from public, anon, authenticated;
grant execute on function public.nothingsports_nsc_sync_rewards(uuid)
  to service_role;
