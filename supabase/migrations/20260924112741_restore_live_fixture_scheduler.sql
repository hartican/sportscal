-- Restore the existing external-to-Vercel scheduler owner on recovery.
-- Credentials are provisioned separately in Vault and Vercel; never in Git.
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.secrets where name='fixture_refresh_secret')
 or not exists(select 1 from vault.secrets where name='fixture_refresh_url') then
  raise exception 'Provision the fixture-refresh Vault configuration first';
 end if;
 perform cron.schedule('nothingsport-live-fixtures','*/2 * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='fixture_refresh_url'),
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='fixture_refresh_secret')),
  body := '{}'::jsonb,timeout_milliseconds := 60000
 );$job$);
 -- Activation is a release step after the matching credential is deployed.
 perform cron.alter_job((select jobid from cron.job where jobname='nothingsport-live-fixtures'),active:=false);
end $$;
