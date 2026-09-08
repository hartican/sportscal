-- Service-owned fixture facts. No user data and no browser writes.
create table public.nothingsports_fixture_sources (
  source_id text primary key,
  revision bigint not null default 0,
  fixtures jsonb not null default '[]'::jsonb check (jsonb_typeof(fixtures) = 'array'),
  content_hash text,
  checked_at timestamptz,
  next_due_at timestamptz not null default '-infinity',
  lease_token uuid,
  lease_until timestamptz,
  failure_count integer not null default 0
);
create table public.nothingsports_fixture_snapshots (
  revision bigint generated always as identity primary key,
  source_id text not null references public.nothingsports_fixture_sources(source_id),
  fixtures jsonb not null check (jsonb_typeof(fixtures) = 'array'),
  content_hash text not null,
  published_at timestamptz not null default clock_timestamp()
);
create index fixture_snapshot_source_revision on public.nothingsports_fixture_snapshots(source_id,revision desc);
create index fixture_snapshot_source_age on public.nothingsports_fixture_snapshots(source_id,published_at);
alter table public.nothingsports_fixture_sources enable row level security;
alter table public.nothingsports_fixture_sources force row level security;
alter table public.nothingsports_fixture_snapshots enable row level security;
alter table public.nothingsports_fixture_snapshots force row level security;
revoke all on public.nothingsports_fixture_sources,public.nothingsports_fixture_snapshots from public,anon,authenticated;
grant select,insert,update on public.nothingsports_fixture_sources to service_role;
grant select,insert,delete on public.nothingsports_fixture_snapshots to service_role;
grant usage,select on sequence public.nothingsports_fixture_snapshots_revision_seq to service_role;

create function public.nothingsports_claim_fixture_source(p_source_id text,p_token uuid)
returns setof public.nothingsports_fixture_sources language plpgsql security invoker set search_path = '' as $$
begin
  if length(p_source_id) not between 1 and 100 or p_token is null then raise exception 'Invalid lease'; end if;
  insert into public.nothingsports_fixture_sources(source_id) values(p_source_id) on conflict do nothing;
  return query update public.nothingsports_fixture_sources
    set lease_token=p_token,lease_until=clock_timestamp()+interval '90 seconds'
    where source_id=p_source_id and next_due_at<=clock_timestamp()
      and (lease_until is null or lease_until<=clock_timestamp()) returning *;
end;
$$;

create function public.nothingsports_publish_fixture_source(p_source_id text,p_token uuid,p_fixtures jsonb,p_hash text,p_interval_ms integer)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_row public.nothingsports_fixture_sources; next_revision bigint;
begin
  select * into current_row from public.nothingsports_fixture_sources where source_id=p_source_id for update;
  if p_token is null or current_row.source_id is null or current_row.lease_token is distinct from p_token or current_row.lease_until is null or current_row.lease_until<=clock_timestamp() then raise exception 'Lease expired'; end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array' or jsonb_array_length(p_fixtures)=0 or p_hash is null then raise exception 'Invalid snapshot'; end if;
  next_revision := current_row.revision;
  if current_row.content_hash is distinct from p_hash then
    insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash) values(p_source_id,p_fixtures,p_hash) returning revision into next_revision;
  end if;
  update public.nothingsports_fixture_sources set fixtures=p_fixtures,content_hash=p_hash,revision=next_revision,
    checked_at=clock_timestamp(),next_due_at=clock_timestamp()+make_interval(secs=>greatest(60,least(3600,p_interval_ms/1000))),
    lease_token=null,lease_until=null,failure_count=0 where source_id=p_source_id;
  -- Only disposable revision history expires; the full current source snapshot
  -- and season files remain intact, as do all user follows and scoring ledgers.
  delete from public.nothingsports_fixture_snapshots where source_id=p_source_id
    and revision<>next_revision and published_at<clock_timestamp()-interval '7 days';
  return next_revision;
end;
$$;

create function public.nothingsports_fail_fixture_source(p_source_id text,p_token uuid,p_retry_ms integer)
returns void language sql security invoker set search_path = '' as $$
  update public.nothingsports_fixture_sources set lease_token=null,lease_until=null,failure_count=failure_count+1,
    next_due_at=clock_timestamp()+make_interval(secs=>greatest(60,least(3600,p_retry_ms/1000)))
    where source_id=p_source_id and lease_token=p_token;
$$;
revoke all on function public.nothingsports_claim_fixture_source(text,uuid),public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer),public.nothingsports_fail_fixture_source(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_fixture_source(text,uuid),public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer),public.nothingsports_fail_fixture_source(text,uuid,integer) to service_role;
