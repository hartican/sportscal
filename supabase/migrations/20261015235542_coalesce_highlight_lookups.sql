-- Extend the existing service-only media cache. A null video is an observed
-- unsuccessful lookup, never a synthetic video or sporting fact.
alter table public.nothingsports_youtube_selections
  alter column video_id drop not null,
  add column lookup_query_hash text check (lookup_query_hash ~ '^[a-f0-9]{64}$'),
  add column lookup_token uuid,
  add column lookup_until timestamptz,
  add column lookup_after timestamptz,
  add column lookup_outcome text,
  add column lookup_checked_at timestamptz,
  add column lookup_quota_day date,
  add column lookup_search_calls integer not null default 0 check (lookup_search_calls >= 0),
  add column lookup_ordinary_calls integer not null default 0 check (lookup_ordinary_calls >= 0);

create function public.nothingsports_claim_youtube_lookup(p_fixture_id text,p_query_hash text,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
declare r public.nothingsports_youtube_selections%rowtype; t timestamptz:=clock_timestamp();
begin
  if p_token is null or length(p_fixture_id)>200 or p_fixture_id !~ '^[-a-zA-Z0-9_:]+$' or p_query_hash !~ '^[a-f0-9]{64}$' or p_fixture_id is null or p_query_hash is null then return jsonb_build_object('state','invalid');end if;
  insert into public.nothingsports_youtube_selections(fixture_id,query_hash,video_id) values(p_fixture_id,p_query_hash,null) on conflict(fixture_id) do nothing;
  select * into r from public.nothingsports_youtube_selections where fixture_id=p_fixture_id for update;
  if r.lookup_until>t then return jsonb_build_object('state','busy');end if;
  if r.lookup_query_hash=p_query_hash and r.lookup_after>t then return jsonb_build_object('state','cooldown','retryAt',r.lookup_after,'outcome',r.lookup_outcome);end if;
  -- Expired media must not be renewed merely to retain its lookup lease.
  if r.selected_at<=t-interval '30 days' then
    update public.nothingsports_youtube_selections set video_id=null,published_at=null,duration_seconds=null,selected_at=t,query_hash=p_query_hash where fixture_id=p_fixture_id;
  end if;
  update public.nothingsports_youtube_selections set lookup_query_hash=p_query_hash,lookup_token=p_token,lookup_until=t+interval '30 seconds',lookup_after=null,lookup_outcome='pending',lookup_checked_at=t where fixture_id=p_fixture_id;
  return jsonb_build_object('state','claimed');
end;
$$;

create function public.nothingsports_reserve_youtube_lookup_quota(p_fixture_id text,p_query_hash text,p_token uuid,p_bucket text)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
declare budget jsonb; changed integer; today date;
begin
  if not exists(select 1 from public.nothingsports_youtube_selections where fixture_id=p_fixture_id and lookup_query_hash=p_query_hash and lookup_token=p_token and lookup_until>clock_timestamp()) then return jsonb_build_object('granted',false,'code','lookup_busy');end if;
  -- Acquire the existing quota/source locks before the cache-row lock, in the
  -- same order as the existing expiry cleanup. No second quota authority.
  budget:=public.nothingsports_reserve_youtube_quota(p_bucket,null);
  if not coalesce((budget->>'granted')::boolean,false) then return budget;end if;
  today:=(budget#>>'{quota,day}')::date;
  update public.nothingsports_youtube_selections set
    lookup_search_calls=case when lookup_quota_day=today then lookup_search_calls else 0 end+case when p_bucket='search' then 1 else 0 end,
    lookup_ordinary_calls=case when lookup_quota_day=today then lookup_ordinary_calls else 0 end+case when p_bucket='ordinary' then 1 else 0 end,
    lookup_quota_day=today,lookup_checked_at=clock_timestamp(),lookup_after=clock_timestamp()+interval '30 minutes'
    where fixture_id=p_fixture_id and lookup_query_hash=p_query_hash and lookup_token=p_token and lookup_until>clock_timestamp();
  get diagnostics changed=row_count;
  if changed<>1 then raise exception using errcode='P0002',message='lookup ownership changed';end if;
  return budget;
exception when no_data_found then
  -- Roll back a reservation if ownership expired while waiting for the global
  -- quota lock. A stale worker cannot spend under somebody else's lease.
  return jsonb_build_object('granted',false,'code','lookup_busy');
end;
$$;

create function public.nothingsports_withdraw_youtube_lookup(p_fixture_id text,p_query_hash text,p_token uuid,p_video_id text)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
declare changed integer;
begin
  update public.nothingsports_youtube_selections set video_id=null,published_at=null,duration_seconds=null
    where fixture_id=p_fixture_id and lookup_query_hash=p_query_hash and lookup_token=p_token and lookup_until>clock_timestamp() and video_id=p_video_id;
  get diagnostics changed=row_count;
  return jsonb_build_object('applied',changed=1);
end;
$$;

create function public.nothingsports_finish_youtube_lookup(p_fixture_id text,p_query_hash text,p_token uuid,p_outcome text,p_selection jsonb default null,p_invalid_video_id text default null)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='3s'
as $$
declare changed integer;t timestamptz:=clock_timestamp();v text;published timestamptz;selected timestamptz;seconds integer;retry_at timestamptz;
begin
  if p_outcome is null or p_outcome not in('selected','no_results','invalid_result','provider_http','quota_denied','deadline','lookup_failed') then return jsonb_build_object('applied',false);end if;
  if p_outcome='selected' then
    begin
      v:=p_selection->>'video_id';published:=(p_selection->>'published_at')::timestamptz;selected:=(p_selection->>'selected_at')::timestamptz;seconds:=(p_selection->>'duration_seconds')::integer;
      if v is null or v !~ '^[A-Za-z0-9_-]{11}$' or published is null or published>t or published<t-interval '7 days' or selected is null or selected>t+interval '5 minutes' or selected<=t-interval '30 days' or seconds is null or seconds not between 1 and 1200 then return jsonb_build_object('applied',false);end if;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('applied',false);end;
  end if;
  retry_at:=t+interval '30 minutes';
  if p_outcome='quota_denied' then retry_at:=least(retry_at,(((t at time zone 'America/Los_Angeles')::date+1)::timestamp at time zone 'America/Los_Angeles'));end if;
  update public.nothingsports_youtube_selections set
    query_hash=case when p_outcome='selected' then p_query_hash else query_hash end,
    video_id=case when p_outcome='selected' then v when video_id=p_invalid_video_id then null else video_id end,
    published_at=case when p_outcome='selected' then published when video_id=p_invalid_video_id then null else published_at end,
    duration_seconds=case when p_outcome='selected' then seconds when video_id=p_invalid_video_id then null else duration_seconds end,
    selected_at=case when p_outcome='selected' then selected else selected_at end,
    lookup_outcome=p_outcome,lookup_after=case when p_outcome='selected' then null else retry_at end,
    lookup_checked_at=t,lookup_token=null,lookup_until=null
    where fixture_id=p_fixture_id and lookup_query_hash=p_query_hash and lookup_token=p_token and lookup_until>t;
  get diagnostics changed=row_count;
  return jsonb_build_object('applied',changed=1);
end;
$$;

revoke all on function public.nothingsports_claim_youtube_lookup(text,text,uuid) from public,anon,authenticated;
revoke all on function public.nothingsports_reserve_youtube_lookup_quota(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.nothingsports_withdraw_youtube_lookup(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.nothingsports_finish_youtube_lookup(text,text,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_youtube_lookup(text,text,uuid) to service_role;
grant execute on function public.nothingsports_reserve_youtube_lookup_quota(text,text,uuid,text) to service_role;
grant execute on function public.nothingsports_withdraw_youtube_lookup(text,text,uuid,text) to service_role;
grant execute on function public.nothingsports_finish_youtube_lookup(text,text,uuid,text,jsonb,text) to service_role;
