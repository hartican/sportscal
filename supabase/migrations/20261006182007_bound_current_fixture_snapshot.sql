-- One JSON value avoids PostgREST's row ceiling without additional reads.
-- Read the existing seven-day/one-year active timeline; keep season history stored.
create function public.nothingsports_read_current_fixture_bundle(p_fixture_ids text[] default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
 with active_window as (
  select (statement_timestamp() at time zone 'Australia/Sydney')::date as today
 ), candidates as (
  select r.* from public.nothingsports_read_current_fixtures(p_fixture_ids) r, active_window w
  where p_fixture_ids is not null or r.fixture->>'status'='live' or (
   (coalesce(nullif(r.fixture->>'endDate',''),nullif(r.fixture->>'date',''),nullif(r.fixture->>'startDate',''),r.fixture->'schedulingWindow'->>'endsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(nullif(r.fixture->>'endDate',''),nullif(r.fixture->>'date',''),nullif(r.fixture->>'startDate',''),r.fixture->'schedulingWindow'->>'endsOn') >= (w.today-7)::text)
   and (coalesce(nullif(r.fixture->>'date',''),nullif(r.fixture->>'startDate',''),r.fixture->'schedulingWindow'->>'startsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(nullif(r.fixture->>'date',''),nullif(r.fixture->>'startDate',''),r.fixture->'schedulingWindow'->>'startsOn') <= (w.today+interval '1 year')::date::text)
  ) order by r.source_id,r.fixture_id limit 5001
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','complete',count(*)<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(candidates)), '[]'::jsonb)) from candidates;
$$;
revoke all on function public.nothingsports_read_current_fixture_bundle(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_current_fixture_bundle(text[]) to service_role;
