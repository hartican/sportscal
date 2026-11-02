-- SOURCE CANDIDATE ONLY. Not applied. Identity/quota acceptance and RELEASE/PUBLISH allocation precede any execution.
-- No customer data, user grant, credential, scheduler or identity value is supplied by this template.
begin;
create schema if not exists ns_dashboard_private;
revoke all on schema ns_dashboard_private from public, anon, authenticated;

create or replace function ns_dashboard_private.authorize_session(expected_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select expected_owner is not null
    and auth.uid() = expected_owner
    and exists (
      select 1 from auth.users u join auth.sessions s on s.user_id = u.id
      where u.id = expected_owner
        and u.raw_app_meta_data ->> 'role' = 'admin'
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= pg_catalog.now())
        and not (u.raw_app_meta_data ? 'nothingsport_erasure_started_at')
        and s.id::text = auth.jwt() ->> 'session_id'
        and (s.not_after is null or s.not_after > pg_catalog.now())
    );
$$;
revoke all on function ns_dashboard_private.authorize_session(uuid) from public, anon, authenticated;
grant usage on schema ns_dashboard_private to authenticated;
grant execute on function ns_dashboard_private.authorize_session(uuid) to authenticated;

create or replace function public.ns_dashboard_authorize_session(expected_owner uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select ns_dashboard_private.authorize_session(expected_owner);
$$;
revoke all on function public.ns_dashboard_authorize_session(uuid) from public, anon, authenticated;
grant execute on function public.ns_dashboard_authorize_session(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ns-dashboard-private', 'ns-dashboard-private', false, 262144, array['application/json'])
on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'ns-dashboard-private' and name = 'ns-dashboard-private' and public is false and file_size_limit = 262144 and allowed_mime_types = array['application/json']) then
    raise exception 'Existing dashboard bucket differs; inspect before any retry';
  end if;
end $$;
-- Restrictive exclusion prevents existing broad permissive object policies from exposing this bucket.
-- Browser access (including the owner) is through the gated server only; existing service credentials stay server-side.
create policy ns_dashboard_no_client_objects on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'ns-dashboard-private') with check (bucket_id <> 'ns-dashboard-private');
commit;
