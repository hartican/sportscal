-- Reapply the existing seven-day history policy on accepted unchanged checks.
-- One publisher; current facts/keepers, caller rights and scheduling remain unchanged.
-- At most 64 expired copies and 4 MiB of stored payload per accepted check.
-- No live data deletion is executed by this migration; the ordinary owner prunes later.
set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)'::regprocedure)) <> '4e6cd3c84f8a2211d04e1f271540451f' then
  raise exception 'Fixture publisher differs from reviewed baseline; migration refused';
 end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.nothingsports_publish_fixture_source(p_source_id text, p_token uuid, p_fixtures jsonb, p_hash text, p_interval_ms integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare current_row public.nothingsports_fixture_sources; next_revision bigint; retention_cutoff timestamptz; last_snapshot_revision bigint;
begin
  select * into current_row from public.nothingsports_fixture_sources where source_id=p_source_id for update;
  if p_token is null or current_row.source_id is null or current_row.lease_token is distinct from p_token or current_row.lease_until is null or current_row.lease_until<=clock_timestamp() then raise exception 'Lease expired'; end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures)<>'array' or p_hash is null or
    (jsonb_array_length(p_fixtures)=0 and (p_source_id not like 'discovery-%' or jsonb_array_length(current_row.fixtures)>0)) then raise exception 'Invalid snapshot'; end if;

  next_revision := current_row.revision;
  if current_row.content_hash is not distinct from p_hash then
    update public.nothingsports_fixture_sources
       set checked_at=clock_timestamp(),
           next_due_at=case when p_interval_ms=120000 then current_row.lease_until+interval '30 seconds'
           else clock_timestamp()+make_interval(secs=>greatest(120,least(86400,p_interval_ms/1000))) end,
           lease_token=null,lease_until=null,failure_count=0
     where source_id=p_source_id;
  else

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
         next_due_at=case when p_interval_ms=120000 then current_row.lease_until+interval '30 seconds'
           else clock_timestamp()+make_interval(secs=>greatest(120,least(86400,p_interval_ms/1000))) end,
         lease_token=null,lease_until=null,failure_count=0
   where source_id=p_source_id;

  end if;

  retention_cutoff := clock_timestamp()-interval '7 days';
  select max(revision) into last_snapshot_revision
    from public.nothingsports_fixture_snapshots where source_id=p_source_id;
  delete from public.nothingsports_fixture_snapshots target
  using (
    select revision from (
      select revision,sum(stored_bytes) over(order by published_at,revision) as batch_bytes
      from (
        select revision,published_at,pg_column_size(fixtures) as stored_bytes
        from public.nothingsports_fixture_snapshots
        where source_id=p_source_id and revision<>next_revision
          and revision<>last_snapshot_revision and published_at<retention_cutoff
        order by published_at,revision limit 64
      ) candidates
    ) budgeted where batch_bytes<=4194304
  ) expired
  where target.source_id=p_source_id and target.revision=expired.revision;
  return next_revision;
end;
$function$;
