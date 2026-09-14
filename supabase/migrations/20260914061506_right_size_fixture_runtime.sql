-- Keep current fixture rows addressable so visible-card reads do not download
-- every source's season-sized JSON document. The legacy source JSON remains as
-- a rollback path while releases transition to this table.
create table if not exists public.nothingsports_fixture_current (
  source_id text not null references public.nothingsports_fixture_sources(source_id) on delete cascade,
  fixture_id text not null,
  identity_keys text[] not null default '{}',
  fixture jsonb not null check (jsonb_typeof(fixture) = 'object'),
  content_hash text not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (source_id, fixture_id)
);

create index if not exists nothingsports_fixture_current_identity_idx
  on public.nothingsports_fixture_current using gin(identity_keys);
create index if not exists nothingsports_fixture_current_updated_idx
  on public.nothingsports_fixture_current(updated_at desc);

alter table public.nothingsports_fixture_current enable row level security;
alter table public.nothingsports_fixture_current force row level security;
revoke all on public.nothingsports_fixture_current from public, anon, authenticated;
grant select, insert, update, delete on public.nothingsports_fixture_current to service_role;

-- One bounded backfill. Re-running the migration body is safe during recovery.
insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash,updated_at)
select source.source_id,
       expanded.fixture_id,
       expanded.identity_keys,
       expanded.fixture,
       md5(expanded.fixture::text),
       coalesce(source.checked_at,clock_timestamp())
from public.nothingsports_fixture_sources source
cross join lateral (
  select fixture,
         coalesce(fixture->>'id',fixture->>'eventId',fixture->>'canonicalEventId') as fixture_id,
         array(
           select distinct identity_key
           from unnest(array_remove(array[
             fixture->>'id', fixture->>'eventId', fixture->>'canonicalEventId'
           ],null) || case
             when jsonb_typeof(fixture->'sourceEventIds')='array'
             then array(select jsonb_array_elements_text(fixture->'sourceEventIds'))
             else '{}'::text[]
           end) as keys(identity_key)
           where identity_key <> ''
         ) as identity_keys
  from jsonb_array_elements(source.fixtures) fixture
) expanded
where expanded.fixture_id is not null and expanded.fixture_id <> ''
on conflict(source_id,fixture_id) do update
set identity_keys=excluded.identity_keys,
    fixture=excluded.fixture,
    content_hash=excluded.content_hash,
    updated_at=excluded.updated_at
where public.nothingsports_fixture_current.content_hash is distinct from excluded.content_hash;

create or replace function public.nothingsports_read_current_fixtures(p_fixture_ids text[] default null)
returns table(source_id text,fixture_id text,fixture jsonb,identity_keys text[])
language sql stable security invoker set search_path = '' as $$
  select current.source_id,current.fixture_id,current.fixture,current.identity_keys
  from public.nothingsports_fixture_current current
  where p_fixture_ids is null or current.identity_keys && p_fixture_ids
  order by current.source_id,current.fixture_id;
$$;
revoke all on function public.nothingsports_read_current_fixtures(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_read_current_fixtures(text[]) to service_role;

-- Unchanged refreshes advance only the small lease/check metadata. Changed
-- sources retain the prior snapshot contract and update per-fixture rows.
create or replace function public.nothingsports_publish_fixture_source(p_source_id text,p_token uuid,p_fixtures jsonb,p_hash text,p_interval_ms integer)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_row public.nothingsports_fixture_sources; next_revision bigint;
begin
  select * into current_row from public.nothingsports_fixture_sources where source_id=p_source_id for update;
  if p_token is null or current_row.source_id is null or current_row.lease_token is distinct from p_token or current_row.lease_until is null or current_row.lease_until<=clock_timestamp() then raise exception 'Lease expired'; end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures)<>'array' or p_hash is null or
    (jsonb_array_length(p_fixtures)=0 and (p_source_id not like 'discovery-%' or jsonb_array_length(current_row.fixtures)>0)) then raise exception 'Invalid snapshot'; end if;

  next_revision := current_row.revision;
  if current_row.content_hash is not distinct from p_hash then
    update public.nothingsports_fixture_sources
       set checked_at=clock_timestamp(),
           next_due_at=clock_timestamp()+make_interval(secs=>greatest(120,least(86400,p_interval_ms/1000))),
           lease_token=null,lease_until=null,failure_count=0
     where source_id=p_source_id;
    return next_revision;
  end if;

  insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash)
  values(p_source_id,p_fixtures,p_hash) returning revision into next_revision;

  insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash,updated_at)
  select p_source_id,
         expanded.fixture_id,
         expanded.identity_keys,
         expanded.fixture,
         md5(expanded.fixture::text),
         clock_timestamp()
  from (
    select fixture,
           coalesce(fixture->>'id',fixture->>'eventId',fixture->>'canonicalEventId') as fixture_id,
           array(
             select distinct identity_key
             from unnest(array_remove(array[
               fixture->>'id', fixture->>'eventId', fixture->>'canonicalEventId'
             ],null) || case
               when jsonb_typeof(fixture->'sourceEventIds')='array'
               then array(select jsonb_array_elements_text(fixture->'sourceEventIds'))
               else '{}'::text[]
             end) as keys(identity_key)
             where identity_key <> ''
           ) as identity_keys
    from jsonb_array_elements(p_fixtures) fixture
  ) expanded
  where expanded.fixture_id is not null and expanded.fixture_id <> ''
  on conflict(source_id,fixture_id) do update
  set identity_keys=excluded.identity_keys,
      fixture=excluded.fixture,
      content_hash=excluded.content_hash,
      updated_at=excluded.updated_at
  where public.nothingsports_fixture_current.content_hash is distinct from excluded.content_hash;

  delete from public.nothingsports_fixture_current current
   where current.source_id=p_source_id
     and not exists (
       select 1 from jsonb_array_elements(p_fixtures) fixture
       where coalesce(fixture->>'id',fixture->>'eventId',fixture->>'canonicalEventId')=current.fixture_id
     );

  update public.nothingsports_fixture_sources
     set fixtures=p_fixtures,content_hash=p_hash,revision=next_revision,
         checked_at=clock_timestamp(),
         next_due_at=clock_timestamp()+make_interval(secs=>greatest(120,least(86400,p_interval_ms/1000))),
         lease_token=null,lease_until=null,failure_count=0
   where source_id=p_source_id;

  delete from public.nothingsports_fixture_snapshots
   where source_id=p_source_id and revision<>next_revision
     and published_at<clock_timestamp()-interval '7 days';
  return next_revision;
end;
$$;

revoke all on function public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer) to service_role;

comment on table public.nothingsports_fixture_current is
  'Service-owned current fixture projection for bounded visible-card reads; legacy source JSON is retained for rollback.';

-- One write replaces the prior presence SELECT followed by an upsert. A stale
-- viewer starts a new watching session; the points ledger remains the
-- authoritative idempotency boundary for the one-minute bonus.
create or replace function public.nothingsports_record_watching_heartbeat(
  target_event_id text,
  target_user_id uuid,
  heartbeat_at timestamptz default clock_timestamp()
)
returns table(heartbeat_count integer,watching_started_at timestamptz,last_heartbeat_at timestamptz)
language sql security invoker set search_path = '' as $$
  insert into public.nothingsports_nsc_presence as presence(
    event_id,user_id,watching_started_at,last_heartbeat_at,heartbeat_count
  ) values(target_event_id,target_user_id,heartbeat_at,heartbeat_at,1)
  on conflict(event_id,user_id) do update
  set watching_started_at=case
        when presence.last_heartbeat_at < heartbeat_at-interval '10 minutes' then heartbeat_at
        else presence.watching_started_at
      end,
      last_heartbeat_at=heartbeat_at,
      heartbeat_count=case
        when presence.last_heartbeat_at < heartbeat_at-interval '10 minutes' then 1
        else presence.heartbeat_count+1
      end
  returning presence.heartbeat_count,presence.watching_started_at,presence.last_heartbeat_at;
$$;
grant select,insert,update on public.nothingsports_nsc_presence to service_role;
revoke all on function public.nothingsports_record_watching_heartbeat(text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_record_watching_heartbeat(text,uuid,timestamptz) to service_role;

-- Group followed-user EPIC activity into a five-minute window.
alter table public.nothingsports_live_rating_alerts
  alter column ready_at set default (now()+interval '5 minutes');

-- Claim a due reminder batch in one transaction instead of one REST
-- round-trip per reminder.
create or replace function public.nothingsports_claim_due_reminders(
  claim_at timestamptz,
  oldest_due timestamptz,
  stale_before timestamptz,
  batch_limit integer default 100
)
returns setof public.nothingsports_reminders
language sql security invoker set search_path = '' as $$
  with candidates as (
    select reminder.id
    from public.nothingsports_reminders reminder
    where reminder.dispatched_at is null
      and reminder.remind_at <= claim_at
      and reminder.remind_at >= oldest_due
      and (reminder.claimed_at is null or reminder.claimed_at < stale_before)
    order by reminder.remind_at
    for update skip locked
    limit greatest(1,least(batch_limit,100))
  )
  update public.nothingsports_reminders reminder
     set claimed_at=claim_at,updated_at=claim_at
    from candidates
   where reminder.id=candidates.id
  returning reminder.*;
$$;
grant select,insert,update on public.nothingsports_reminders to service_role;
revoke all on function public.nothingsports_claim_due_reminders(timestamptz,timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_due_reminders(timestamptz,timestamptz,timestamptz,integer) to service_role;
