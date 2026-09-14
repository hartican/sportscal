-- RELEASE STEP ONLY, after the endpoint and snapshot migration are deployed.
-- Create fixture_refresh_url and fixture_refresh_secret in Vault first.
-- The URL must be the HTTPS production /api/fixture-refresh endpoint.
-- The secret must match server-only FIXTURE_REFRESH_SECRET (at least 32 chars).
-- Avoid issuing CREATE EXTENSION for an existing installation: Supabase's
-- extension access event trigger can otherwise reapply conflicting grants.
do $$ begin
  if not exists (select 1 from pg_extension where extname='pg_net') then
    create extension pg_net with schema extensions;
  end if;
  if not exists (select 1 from pg_extension where extname='pg_cron') then
    create extension pg_cron;
  end if;
end; $$;
do $$
declare endpoint text; token text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='fixture_refresh_url';
  select decrypted_secret into token from vault.decrypted_secrets where name='fixture_refresh_secret';
  if endpoint is null or endpoint !~ '^https://[^/]+/api/fixture-refresh$' or length(token)<32 or token is null then
    raise exception 'Configure the protected fixture endpoint in Vault before enabling Cron';
  end if;
  perform cron.schedule('nothingsport-live-fixtures','*/2 * * * *',
    $job$select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='fixture_refresh_url'),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='fixture_refresh_secret')),
      body := '{}'::jsonb,timeout_milliseconds := 25000
    );$job$);
  perform cron.schedule('nothingsport-prune-cron-history','17 4 * * *',
    $job$with expired_presence as (
      delete from public.nothingsports_nsc_presence
      where last_heartbeat_at < clock_timestamp() - interval '1 day'
      returning 1
    )
    delete from cron.job_run_details where end_time < clock_timestamp() - interval '7 days';$job$);
end;
$$;
