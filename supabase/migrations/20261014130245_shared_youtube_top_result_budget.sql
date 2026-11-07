-- One durable quota authority for scheduled discovery and deliberate top-result taps.
-- No sporting/user-state writes, public grants, scheduler or browser API key.
create table public.nothingsports_youtube_api_daily (
  quota_day date primary key,
  search_calls integer not null default 0 check(search_calls between 0 and 90),
  ordinary_calls integer not null default 0 check(ordinary_calls between 0 and 500),
  scheduled_search_calls integer not null default 0 check(scheduled_search_calls between 0 and 90)
);
alter table public.nothingsports_youtube_api_daily enable row level security;
revoke all on public.nothingsports_youtube_api_daily from public,anon,authenticated;
grant select,insert,update,delete on public.nothingsports_youtube_api_daily to service_role;

create table public.nothingsports_youtube_selections (
  fixture_id text primary key check(fixture_id ~ '^[-a-zA-Z0-9_:]{1,200}$'),
  query_hash text not null check(query_hash ~ '^[a-f0-9]{64}$'),
  video_id text not null check(video_id ~ '^[A-Za-z0-9_-]{11}$'),
  selected_at timestamptz not null default clock_timestamp()
);
alter table public.nothingsports_youtube_selections enable row level security;
revoke all on public.nothingsports_youtube_selections from public,anon,authenticated;
grant select,insert,update,delete on public.nothingsports_youtube_selections to service_role;

-- Intercept abandoned older leases before the existing claim overwrites their
-- token. The released prior adapter can issue at most two searches and eight
-- ordinary API requests per pass (seven upload fallbacks + one verification).
create function public.nothingsports_account_youtube_legacy_lease()
returns boolean language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
declare
  today date:=(clock_timestamp() at time zone 'America/Los_Angeles')::date;
  owner public.nothingsports_fixture_sources%rowtype;ledger jsonb;legacy_day date;
  spent_search integer:=0;spent_ordinary integer:=0;calls public.nothingsports_youtube_api_daily%rowtype;extra_legacy integer;
begin
  select * into owner from public.nothingsports_fixture_sources where source_id='discovery-tennis-highlights' for update;
  if owner.source_id is null then return true;end if;
  if owner.lease_token is null or owner.discovery_report#>>'{_highlightBackfill,quotaProtocolToken}'=owner.lease_token::text then return true;end if;
  if owner.lease_until>clock_timestamp() then return false;end if;
  if owner.discovery_report is not null and jsonb_typeof(owner.discovery_report)<>'object' then return false;end if;
  if coalesce(owner.discovery_report,'{}'::jsonb) ? '_highlightQuota' then
    ledger:=owner.discovery_report->'_highlightQuota';
    if jsonb_typeof(ledger) is distinct from 'object' or coalesce(ledger->>'day','')!~'^\d{4}-\d{2}-\d{2}$'
       or jsonb_typeof(ledger->'search') is distinct from 'number' or coalesce(ledger->>'search','')!~'^\d+$'
       or jsonb_typeof(ledger->'ordinary') is distinct from 'number' or coalesce(ledger->>'ordinary','')!~'^\d+$' then return false;end if;
    begin legacy_day:=(ledger->>'day')::date;spent_search:=(ledger->>'search')::integer;spent_ordinary:=(ledger->>'ordinary')::integer;exception when others then return false;end;
    if legacy_day>today or spent_search not between 0 and 90 or spent_ordinary not between 0 and 500 then return false;end if;
    if legacy_day<today then spent_search:=0;spent_ordinary:=0;end if;
  end if;
  insert into public.nothingsports_youtube_api_daily(quota_day,search_calls,ordinary_calls,scheduled_search_calls) values(today,spent_search,spent_ordinary,spent_search) on conflict(quota_day) do nothing;
  select * into calls from public.nothingsports_youtube_api_daily where quota_day=today for update;
  extra_legacy:=greatest(0,spent_search-calls.search_calls);
  calls.scheduled_search_calls:=least(90,calls.scheduled_search_calls+extra_legacy+2);
  calls.search_calls:=least(90,greatest(calls.search_calls,spent_search)+2);
  calls.ordinary_calls:=least(500,greatest(calls.ordinary_calls,spent_ordinary)+8);
  update public.nothingsports_youtube_api_daily set search_calls=calls.search_calls,ordinary_calls=calls.ordinary_calls,scheduled_search_calls=calls.scheduled_search_calls where quota_day=today;
  update public.nothingsports_fixture_sources set discovery_report=jsonb_set(jsonb_set(coalesce(discovery_report,'{}'::jsonb),'{_highlightQuota}',jsonb_build_object('day',today::text,'search',calls.search_calls,'ordinary',calls.ordinary_calls)),'{_highlightBackfill}',coalesce(discovery_report->'_highlightBackfill','{}'::jsonb)||jsonb_build_object('quotaProtocolToken',owner.lease_token::text)) where source_id=owner.source_id;
  return true;
end;
$$;
revoke all on function public.nothingsports_account_youtube_legacy_lease() from public,anon,authenticated;
grant execute on function public.nothingsports_account_youtube_legacy_lease() to service_role;

-- Preserve the existing canonical implementation and its cadence/deadline
-- behaviour. All versions still call the canonical name, which now repairs a
-- regressed published diagnostic from the durable total before returning it.
create schema nothingsports_media_private;
revoke all on schema nothingsports_media_private from public,anon,authenticated;
grant usage on schema nothingsports_media_private to service_role;
alter function public.nothingsports_claim_fixture_source(text,uuid) rename to nothingsports_claim_fixture_source_before_youtube;
alter function public.nothingsports_claim_fixture_source_before_youtube(text,uuid) set schema nothingsports_media_private;
create function public.nothingsports_claim_fixture_source(p_source_id text,p_token uuid)
returns setof public.nothingsports_fixture_sources language plpgsql security invoker set search_path=''
as $$
declare
  today date:=(clock_timestamp() at time zone 'America/Los_Angeles')::date;
  owner public.nothingsports_fixture_sources%rowtype;calls public.nothingsports_youtube_api_daily%rowtype;ledger jsonb;reported_day date;reported_search integer:=0;reported_ordinary integer:=0;
begin
  if p_token is null then return;end if;
  if p_source_id='discovery-tennis-highlights' then
    if not public.nothingsports_account_youtube_legacy_lease() then return;end if;
    select * into owner from public.nothingsports_fixture_sources where source_id=p_source_id for update;
    select * into calls from public.nothingsports_youtube_api_daily where quota_day=today;
    if calls.quota_day is not null then
      if owner.source_id is null then return;end if;
      if owner.discovery_report is not null and jsonb_typeof(owner.discovery_report)<>'object' then return;end if;
      if coalesce(owner.discovery_report,'{}'::jsonb) ? '_highlightQuota' then
        ledger:=owner.discovery_report->'_highlightQuota';
        if jsonb_typeof(ledger) is distinct from 'object' or coalesce(ledger->>'day','')!~'^\d{4}-\d{2}-\d{2}$'
           or jsonb_typeof(ledger->'search') is distinct from 'number' or coalesce(ledger->>'search','')!~'^\d+$'
           or jsonb_typeof(ledger->'ordinary') is distinct from 'number' or coalesce(ledger->>'ordinary','')!~'^\d+$' then return;end if;
        begin reported_day:=(ledger->>'day')::date;reported_search:=(ledger->>'search')::integer;reported_ordinary:=(ledger->>'ordinary')::integer;exception when others then return;end;
        if reported_day>today or reported_search not between 0 and 90 or reported_ordinary not between 0 and 500 then return;end if;
        if reported_day<today then reported_search:=0;reported_ordinary:=0;end if;
      end if;
      -- Publish/fail can carry an older local copy, including yesterday after
      -- midnight. Repair from today's durable total before returning the claim.
      update public.nothingsports_fixture_sources set discovery_report=jsonb_set(coalesce(discovery_report,'{}'::jsonb),'{_highlightQuota}',jsonb_build_object('day',today::text,'search',greatest(calls.search_calls,reported_search),'ordinary',greatest(calls.ordinary_calls,reported_ordinary))) where source_id=p_source_id;
    end if;
  end if;
  return query select * from nothingsports_media_private.nothingsports_claim_fixture_source_before_youtube(p_source_id,p_token);
end;
$$;
revoke all on function public.nothingsports_claim_fixture_source(text,uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_fixture_source(text,uuid) to service_role;

create function public.nothingsports_claim_highlights_source(p_token uuid)
returns setof public.nothingsports_fixture_sources language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
begin
  if p_token is null then return;end if;
  if not public.nothingsports_account_youtube_legacy_lease() then return;end if;
  -- Delegate every due/cadence/lease rule to the existing canonical claim.
  return query select * from public.nothingsports_claim_fixture_source('discovery-tennis-highlights',p_token);
end;
$$;
revoke all on function public.nothingsports_claim_highlights_source(uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_highlights_source(uuid) to service_role;

create function public.nothingsports_reserve_youtube_quota(p_bucket text,p_source_token uuid default null)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
declare
  today date := (clock_timestamp() at time zone 'America/Los_Angeles')::date;
  owner public.nothingsports_fixture_sources%rowtype;
  ledger jsonb; legacy_day date; legacy_search integer:=0; legacy_ordinary integer:=0;
  calls public.nothingsports_youtube_api_daily%rowtype; extra_legacy integer;
begin
  if p_bucket is null or p_bucket not in('search','ordinary') then return jsonb_build_object('granted',false,'code','quota_limit');end if;
  if p_source_token is null and not public.nothingsports_account_youtube_legacy_lease() then return jsonb_build_object('granted',false,'code','source_busy');end if;
  select * into owner from public.nothingsports_fixture_sources where source_id='discovery-tennis-highlights' for update;
  if owner.source_id is null or (owner.discovery_report is not null and jsonb_typeof(owner.discovery_report)<>'object') then return jsonb_build_object('granted',false,'code','quota_unavailable');end if;
  if p_source_token is not null then
    if owner.lease_token is distinct from p_source_token or owner.lease_until is null or owner.lease_until<=clock_timestamp() then return jsonb_build_object('granted',false,'code','source_busy');end if;
  elsif owner.lease_until>clock_timestamp() and owner.lease_token is not null and (owner.discovery_report#>>'{_highlightBackfill,quotaProtocolToken}') is distinct from owner.lease_token::text then
    -- An older deployment can still be finishing its source pass. Wait until
    -- that legacy lease closes; never spend in parallel with an unbridged writer.
    return jsonb_build_object('granted',false,'code','source_busy');
  end if;
  if coalesce(owner.discovery_report,'{}'::jsonb) ? '_highlightQuota' then
    ledger:=owner.discovery_report->'_highlightQuota';
    if jsonb_typeof(ledger) is distinct from 'object' or coalesce(ledger->>'day','')!~'^\d{4}-\d{2}-\d{2}$'
       or jsonb_typeof(ledger->'search') is distinct from 'number' or coalesce(ledger->>'search','')!~'^\d+$'
       or jsonb_typeof(ledger->'ordinary') is distinct from 'number' or coalesce(ledger->>'ordinary','')!~'^\d+$' then return jsonb_build_object('granted',false,'code','quota_invalid');end if;
    begin
      legacy_day:=(ledger->>'day')::date;legacy_search:=(ledger->>'search')::integer;legacy_ordinary:=(ledger->>'ordinary')::integer;
    exception when others then return jsonb_build_object('granted',false,'code','quota_invalid');end;
    if legacy_day>today or legacy_search not between 0 and 90 or legacy_ordinary not between 0 and 500 then return jsonb_build_object('granted',false,'code','quota_invalid');end if;
    if legacy_day<today then legacy_search:=0;legacy_ordinary:=0;end if;
  end if;
  insert into public.nothingsports_youtube_api_daily(quota_day,search_calls,ordinary_calls,scheduled_search_calls) values(today,legacy_search,legacy_ordinary,legacy_search) on conflict(quota_day) do nothing;
  select * into calls from public.nothingsports_youtube_api_daily where quota_day=today for update;
  extra_legacy:=greatest(0,legacy_search-calls.search_calls);
  calls.scheduled_search_calls:=calls.scheduled_search_calls+extra_legacy;
  calls.search_calls:=greatest(calls.search_calls,legacy_search);calls.ordinary_calls:=greatest(calls.ordinary_calls,legacy_ordinary);
  if p_source_token is not null then update public.nothingsports_fixture_sources set discovery_report=jsonb_set(coalesce(discovery_report,'{}'::jsonb),'{_highlightBackfill}',coalesce(discovery_report->'_highlightBackfill','{}'::jsonb)||jsonb_build_object('quotaProtocolToken',p_source_token::text)) where source_id=owner.source_id;end if;
  if p_bucket='search' and p_source_token is not null and calls.scheduled_search_calls>=50 then return jsonb_build_object('granted',false,'code','quota_limit');end if;
  if (p_bucket='search' and calls.search_calls>=90) or (p_bucket='ordinary' and calls.ordinary_calls>=500) then return jsonb_build_object('granted',false,'code','quota_limit');end if;
  if p_bucket='search' then calls.search_calls:=calls.search_calls+1;if p_source_token is not null then calls.scheduled_search_calls:=calls.scheduled_search_calls+1;end if;else calls.ordinary_calls:=calls.ordinary_calls+1;end if;
  update public.nothingsports_youtube_api_daily set search_calls=calls.search_calls,ordinary_calls=calls.ordinary_calls,scheduled_search_calls=calls.scheduled_search_calls where quota_day=today;
  update public.nothingsports_fixture_sources set discovery_report=jsonb_set(coalesce(discovery_report,'{}'::jsonb),'{_highlightQuota}',jsonb_build_object('day',today::text,'search',calls.search_calls,'ordinary',calls.ordinary_calls)) where source_id=owner.source_id;
  delete from public.nothingsports_youtube_api_daily where quota_day<today-31;
  delete from public.nothingsports_youtube_selections where selected_at<=clock_timestamp()-interval '30 days';
  return jsonb_build_object('granted',true,'quota',jsonb_build_object('day',today::text,'search',calls.search_calls,'ordinary',calls.ordinary_calls));
end;
$$;
revoke all on function public.nothingsports_reserve_youtube_quota(text,uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_reserve_youtube_quota(text,uuid) to service_role;
