-- Discovery can legitimately find no published entries. Scores cannot use
-- an empty response to clear known fixtures. Access stays service-only.
alter table public.nothingsports_fixture_sources add column discovery_report jsonb;
create or replace function public.nothingsports_publish_fixture_source(p_source_id text,p_token uuid,p_fixtures jsonb,p_hash text,p_interval_ms integer)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_row public.nothingsports_fixture_sources; next_revision bigint;
begin
  select * into current_row from public.nothingsports_fixture_sources where source_id=p_source_id for update;
  if p_token is null or current_row.source_id is null or current_row.lease_token is distinct from p_token or current_row.lease_until is null or current_row.lease_until<=clock_timestamp() then raise exception 'Lease expired'; end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures)<>'array' or p_hash is null or
    (jsonb_array_length(p_fixtures)=0 and (p_source_id not like 'discovery-%' or jsonb_array_length(current_row.fixtures)>0)) then raise exception 'Invalid snapshot'; end if;
  next_revision := current_row.revision;
  if current_row.content_hash is distinct from p_hash then
    insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash) values(p_source_id,p_fixtures,p_hash) returning revision into next_revision;
  end if;
  update public.nothingsports_fixture_sources set fixtures=p_fixtures,content_hash=p_hash,revision=next_revision,
    checked_at=clock_timestamp(),next_due_at=clock_timestamp()+make_interval(secs=>greatest(60,least(86400,p_interval_ms/1000))),
    lease_token=null,lease_until=null,failure_count=0 where source_id=p_source_id;
  delete from public.nothingsports_fixture_snapshots where source_id=p_source_id
    and revision<>next_revision and published_at<clock_timestamp()-interval '7 days';
  return next_revision;
end;
$$;
create or replace function public.nothingsports_fail_fixture_source(p_source_id text,p_token uuid,p_retry_ms integer)
returns void language sql security invoker set search_path = '' as $$
  update public.nothingsports_fixture_sources set lease_token=null,lease_until=null,failure_count=failure_count+1,
    next_due_at=clock_timestamp()+make_interval(secs=>greatest(60,least(86400,p_retry_ms/1000)))
    where source_id=p_source_id and lease_token=p_token;
$$;
revoke all on function public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer),public.nothingsports_fail_fixture_source(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer),public.nothingsports_fail_fixture_source(text,uuid,integer) to service_role;

-- Progress and facts commit together under the same fenced lease. The original
-- RPCs remain compatible with already-running releases during deployment.
create function public.nothingsports_publish_fixture_source_report(p_source_id text,p_token uuid,p_fixtures jsonb,p_hash text,p_interval_ms integer,p_report jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if p_report is null or jsonb_typeof(p_report)<>'object' then raise exception 'Invalid report'; end if;
  next_revision := public.nothingsports_publish_fixture_source(p_source_id,p_token,p_fixtures,p_hash,p_interval_ms);
  update public.nothingsports_fixture_sources set discovery_report=p_report where source_id=p_source_id;
  return next_revision;
end;
$$;
create function public.nothingsports_fail_fixture_source_report(p_source_id text,p_token uuid,p_retry_ms integer,p_report jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_report is null or jsonb_typeof(p_report)<>'object' then raise exception 'Invalid report'; end if;
  perform 1 from public.nothingsports_fixture_sources where source_id=p_source_id and lease_token=p_token and lease_until>clock_timestamp() for update;
  if not found then raise exception 'Lease expired'; end if;
  perform public.nothingsports_fail_fixture_source(p_source_id,p_token,p_retry_ms);
  update public.nothingsports_fixture_sources set discovery_report=p_report where source_id=p_source_id;
end;
$$;
revoke all on function public.nothingsports_publish_fixture_source_report(text,uuid,jsonb,text,integer,jsonb),public.nothingsports_fail_fixture_source_report(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_publish_fixture_source_report(text,uuid,jsonb,text,integer,jsonb),public.nothingsports_fail_fixture_source_report(text,uuid,integer,jsonb) to service_role;
