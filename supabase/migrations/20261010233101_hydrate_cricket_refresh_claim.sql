-- Return persisted Cricket score facts to the existing refresh owner in its
-- existing leased claim. No extra RPC, scheduler, table or stored duplication.
create or replace function public.nothingsports_claim_fixture_source(p_source_id text,p_token uuid)
returns setof public.nothingsports_fixture_sources
language plpgsql security invoker set search_path='' as $$
declare claimed public.nothingsports_fixture_sources;
begin
 if length(p_source_id) not between 1 and 100 or p_token is null then raise exception 'Invalid lease'; end if;
 insert into public.nothingsports_fixture_sources(source_id) values(p_source_id) on conflict do nothing;
 update public.nothingsports_fixture_sources
 set lease_token=p_token,lease_until=clock_timestamp()+interval '90 seconds'
 where source_id=p_source_id and next_due_at<=clock_timestamp()
 and (lease_until is null or lease_until<=clock_timestamp()) returning * into claimed;
 if not found then return; end if;
 if p_source_id='cricket-ca-current' then
  if jsonb_array_length(claimed.fixtures)>5000 then raise exception 'Invalid fixture budget'; end if;
  select coalesce(jsonb_agg(case when s.fixture_id is null then f.value else
   public.nothingsports_project_fixture_observations(f.value,s.score,
    claimed.discovery_report->'_fixtureObservations'->coalesce(f.value->>'id',f.value->>'eventId',f.value->>'canonicalEventId'),s.first_completed_at)
   end order by f.ordinality),'[]'::jsonb) into claimed.fixtures
  from jsonb_array_elements(claimed.fixtures) with ordinality f(value,ordinality)
  left join public.nothingsports_live_scores s on s.source_id=p_source_id
   and s.fixture_id=coalesce(f.value->>'id',f.value->>'eventId',f.value->>'canonicalEventId');
 end if;
 return next claimed;
end $$;
revoke all on function public.nothingsports_claim_fixture_source(text,uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_fixture_source(text,uuid) to service_role;
