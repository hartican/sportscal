-- Return one JSON row so PostgREST does not extract a large scalar from its aggregate.
-- Existing readers, membership, observations and scheduling remain unchanged.
set local lock_timeout='1s';
set local statement_timeout='15s';
do $guard$
declare signature text;
begin
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='nothingsports_read_current_fixture_bundle_json_rows') then
  raise exception 'Global JSON row reader already exists; migration refused';
 end if;
 if md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle(text[])'::regprocedure)) is distinct from 'ef1658b2eb58a376f368ede88730ad43'
 or md5(pg_get_functiondef('public.nothingsports_read_current_fixture_bundle_json(text[])'::regprocedure)) is distinct from 'a15bc809eaf15601a52855cb667f7b9f'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54' then
  raise exception 'Global JSON row dependencies differ from reviewed baseline; migration refused';
 end if;
 foreach signature in array array['public.nothingsports_read_current_fixture_bundle(text[])','public.nothingsports_read_current_fixture_bundle_json(text[])','public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
  or not has_function_privilege('service_role',signature,'EXECUTE')
  or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   where p.oid=signature::regprocedure and a.privilege_type='EXECUTE'
    and a.grantee not in(p.proowner,(select oid from pg_roles where rolname='service_role'))) then
   raise exception 'Global JSON row permissions differ from service-only baseline; migration refused';
  end if;
 end loop;
end $guard$;
create function public.nothingsports_read_current_fixture_bundle_json_rows(p_fixture_ids text[] default null::text[])
returns setof json language sql stable security invoker rows 1 set search_path='' as $function$
 select public.nothingsports_read_current_fixture_bundle_json(p_fixture_ids);
$function$;
revoke all on function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_current_fixture_bundle_json_rows(text[]) to service_role;
do $verify$
begin
 if has_function_privilege('anon','public.nothingsports_read_current_fixture_bundle_json_rows(text[])','EXECUTE')
 or has_function_privilege('authenticated','public.nothingsports_read_current_fixture_bundle_json_rows(text[])','EXECUTE')
 or not has_function_privilege('service_role','public.nothingsports_read_current_fixture_bundle_json_rows(text[])','EXECUTE')
 or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='public.nothingsports_read_current_fixture_bundle_json_rows(text[])'::regprocedure
   and a.privilege_type='EXECUTE' and a.grantee not in(p.proowner,(select oid from pg_roles where rolname='service_role'))) then
  raise exception 'Global JSON row permissions differ from service-only baseline; migration refused';
 end if;
end $verify$;
