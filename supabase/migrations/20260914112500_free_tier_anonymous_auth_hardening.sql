-- Free-plan guest chat hardening.
-- Supabase's Before User Created hook is not available on the Free plan, so
-- anonymous identities are admitted by Auth but can only become chat members
-- through the server's signed-capability, rate-limit and attestation flow.

drop policy if exists "nothingSports users can create their own state" on public.nothingsports_user_state;
create policy "nothingSports users can create their own state"
  on public.nothingsports_user_state
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

drop policy if exists "nothingSports users can read their own state" on public.nothingsports_user_state;
create policy "nothingSports users can read their own state"
  on public.nothingsports_user_state
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

drop policy if exists "nothingSports users can update their own state" on public.nothingsports_user_state;
create policy "nothingSports users can update their own state"
  on public.nothingsports_user_state
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  )
  with check (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

drop policy if exists "nothingsport users create own metadata" on public.nothingsports_user_meta;
create policy "nothingsport users create own metadata"
  on public.nothingsports_user_meta
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

drop policy if exists "nothingsport users read own metadata" on public.nothingsports_user_meta;
create policy "nothingsport users read own metadata"
  on public.nothingsports_user_meta
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

drop policy if exists "nothingsport users update own metadata" on public.nothingsports_user_meta;
create policy "nothingsport users update own metadata"
  on public.nothingsports_user_meta
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  )
  with check (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

drop policy if exists "nothingSports pilot users can append their own product events" on public.product_events;
create policy "nothingSports pilot users can append their own product events"
  on public.product_events
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  );

do $$
declare existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'nothingsports-chat-anonymous-auth-cleanup-daily'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;

select cron.schedule(
  'nothingsports-chat-anonymous-auth-cleanup-daily',
  '23 3 * * *',
  $job$
    delete from public.nothingsports_chat_anonymous_signup_tickets
    where expires_at <= now();
    delete from public.nothingsports_chat_anonymous_session_limits
    where window_started_at < now() - interval '2 days';
    with orphaned_anonymous as materialized (
      select anonymous_user.id
      from auth.users anonymous_user
      where anonymous_user.is_anonymous is true
        and anonymous_user.created_at < now() - interval '1 day'
        and not exists (
          select 1 from public.nothingsports_chat_members member
          where member.user_id = anonymous_user.id
        )
        and not exists (
          select 1 from public.nothingsports_chat_messages message
          where message.sender_id = anonymous_user.id
        )
    ), removed_installations as (
      delete from public.nothingsports_push_installations installation
      using orphaned_anonymous orphan
      where installation.user_id = orphan.id
      returning installation.installation_id
    )
    delete from auth.users anonymous_user
    using orphaned_anonymous orphan
    where anonymous_user.id = orphan.id
$job$
);
