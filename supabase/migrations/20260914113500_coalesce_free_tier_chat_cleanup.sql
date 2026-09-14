-- Keep all low-volume chat cleanup in one daily database job.
do $$
declare existing_job bigint;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'nothingsports-chat-purge-hourly',
      'nothingsports-chat-anonymous-auth-cleanup-daily',
      'nothingsports-chat-maintenance-daily'
    )
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;

select cron.schedule(
  'nothingsports-chat-maintenance-daily',
  '23 3 * * *',
  $job$
    delete from public.nothingsports_chat_anonymous_signup_tickets
    where expires_at <= now();
    delete from public.nothingsports_chat_anonymous_session_limits
    where window_started_at < now() - interval '2 days';
    delete from public.nothingsports_chat_rooms
    where status = 'closed' and purge_at <= now();
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
