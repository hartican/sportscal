-- Independent fixture observations, under the existing fenced refresh owner.
-- Fact-change clocks live in changed-only score rows. Genuine verification
-- receipts live in the existing source-health document, never revision history.
create or replace function public.nothingsports_fixture_observation_time(value text)
returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare stamp timestamptz;
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then return null; end if;
 begin stamp:=value::timestamptz; exception when others then return null; end;
 if stamp>statement_timestamp()+interval '5 minutes' then return null; end if;
 return stamp;
end $$;

create or replace function public.nothingsports_publish_compact_scores(p_source_id text,p_token uuid,p_fixtures jsonb,p_scores jsonb,p_hash text,p_interval_ms integer,p_report jsonb default null)
returns bigint language plpgsql security invoker set search_path='' as $$
declare
 current_row public.nothingsports_fixture_sources; revision bigint;
 score_keys text[]:=array['homeScore','awayScore','scoreDisplay','score','sets','games','innings','rubbers','canonicalResultScoreline'];
 controls text[]:=array['observationSchema','scoreObserved','statusObserved'];
 incoming jsonb; prior jsonb; next_score jsonb; score_facts jsonb; prior_facts jsonb; base jsonb; bases jsonb; previous_scores jsonb;
 receipts jsonb; receipt jsonb; report jsonb; accepted jsonb:='[]'::jsonb;
 score_at timestamptz; status_at timestamptz; prior_score_at timestamptz; prior_status_at timestamptz;
 score_ok boolean; status_ok boolean; legacy boolean; fid text;
begin
 select * into current_row from public.nothingsports_fixture_sources where source_id=p_source_id for update;
 if p_token is null or current_row.source_id is null or current_row.lease_token is distinct from p_token or current_row.lease_until is null or current_row.lease_until<=clock_timestamp() then raise exception 'Lease expired'; end if;
 if p_scores is null or jsonb_typeof(p_scores)<>'array' or jsonb_array_length(p_scores)>5000 or
    p_fixtures is null or jsonb_typeof(p_fixtures)<>'array' or jsonb_array_length(p_fixtures)>5000 then raise exception 'Invalid compact observation budget'; end if;
 if p_report is not null and jsonb_typeof(p_report)<>'object' then raise exception 'Invalid report'; end if;
 if exists(select 1 from jsonb_array_elements(p_scores) s group by s->>'id' having count(*)>1) then raise exception 'Ambiguous compact identity'; end if;
 receipts:=coalesce(current_row.discovery_report->'_fixtureObservations','{}'::jsonb);
 select jsonb_object_agg(coalesce(value->>'id',value->>'eventId',value->>'canonicalEventId'),value) into bases from jsonb_array_elements(p_fixtures);
 select coalesce(jsonb_object_agg(fixture_id,score),'{}'::jsonb) into previous_scores from public.nothingsports_live_scores where source_id=p_source_id;
 for incoming in select value from jsonb_array_elements(p_scores) loop
  fid:=incoming->>'id';
  base:=bases->fid;
  if fid is null or fid='' or base is null then raise exception 'Unmatched compact identity'; end if;
  prior:=previous_scores->fid;
  prior:=coalesce(prior,'{}'::jsonb); next_score:=prior;
  receipt:=coalesce(receipts->fid,'{}'::jsonb);
  legacy:=incoming->>'observationSchema' is distinct from 'fixture-observations.v1';
  score_at:=public.nothingsports_fixture_observation_time(case when legacy then coalesce(incoming->>'scoreCheckedAt',base->>'scoreCheckedAt',base->>'sourceCheckedAt',base->>'canonicalSourceCheckedAt') when incoming->>'scoreObserved'='true' then incoming->>'scoreCheckedAt' end);
  status_at:=public.nothingsports_fixture_observation_time(case when legacy then coalesce(incoming->>'statusCheckedAt',base->>'statusCheckedAt',base->>'sourceCheckedAt',base->>'canonicalSourceCheckedAt') when incoming->>'statusObserved'='true' then incoming->>'statusCheckedAt' end);
  prior_score_at:=public.nothingsports_fixture_observation_time(coalesce(receipt->>'s',prior->>'scoreCheckedAt'));
  prior_status_at:=public.nothingsports_fixture_observation_time(coalesce(receipt->>'t',prior->>'statusCheckedAt'));
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into score_facts from jsonb_each(incoming) where key=any(score_keys) and value<>'null'::jsonb and value<>'[]'::jsonb and value<>'{}'::jsonb and value<>'""'::jsonb;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into prior_facts from jsonb_each(prior) where key=any(score_keys) and value<>'null'::jsonb and value<>'[]'::jsonb and value<>'{}'::jsonb and value<>'""'::jsonb;
  -- Unknown-clock data can initialise legacy rows, but cannot replace known facts.
  -- Equal clocks verify the same facts; contradictory equal-clock facts are rejected.
  score_ok:=score_facts<>'{}'::jsonb and (prior='{}'::jsonb or
    (score_at is not null and (prior_score_at is null or score_at>prior_score_at or score_at=prior_score_at and score_facts=prior_facts)) or
    (legacy and score_at is null and prior_score_at is null));
  status_ok:=nullif(incoming->>'status','') is not null and (prior='{}'::jsonb or
    (status_at is not null and (prior_status_at is null or status_at>prior_status_at or status_at=prior_status_at and incoming->>'status'=prior->>'status')) or
    (legacy and status_at is null and prior_status_at is null));
  if prior->>'status' in('completed','finished','final','abandoned') and coalesce(incoming->>'status','') not in('completed','finished','final','abandoned') then score_ok:=false; status_ok:=false; end if;
  if score_ok then
   if score_facts is distinct from prior_facts or prior->>'scoreCheckedAt' is null and score_at is not null then
    next_score:=(next_score-score_keys)||score_facts||jsonb_build_object('scoreCheckedAt',score_at);
   end if;
   if score_at is not null then receipt:=receipt||jsonb_build_object('s',score_at); end if;
  end if;
  if status_ok then
   if incoming->>'status' is distinct from prior->>'status' or prior->>'statusCheckedAt' is null and status_at is not null then
    next_score:=next_score||jsonb_build_object('status',incoming->>'status','statusCheckedAt',status_at);
   end if;
   if status_at is not null then receipt:=receipt||jsonb_build_object('t',status_at); end if;
  end if;
  next_score:=(next_score-controls)||jsonb_build_object('id',fid);
  accepted:=accepted||jsonb_build_array(next_score);
  if receipt<>'{}'::jsonb then receipts:=jsonb_set(receipts,array[fid],receipt); end if;
 end loop;
 -- Bound receipts to retained fixtures. This does not delete sporting/user data.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into receipts from jsonb_each(receipts) where key in(select coalesce(value->>'id',value->>'eventId',value->>'canonicalEventId') from jsonb_array_elements(p_fixtures));
 if octet_length(receipts::text)>1048576 then raise exception 'Compact receipt byte budget exceeded'; end if;
 report:=coalesce(p_report,current_row.discovery_report,'{}'::jsonb)-'_fixtureObservations';
 report:=report||jsonb_build_object('_fixtureObservations',receipts);
 -- Original publisher owns lease consumption, fact revision, current IDs and retention.
 revision:=public.nothingsports_publish_fixture_source_report(p_source_id,p_token,p_fixtures,p_hash,p_interval_ms,report);
 insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at)
 select p_source_id,s->>'id',s,md5(s::text),case when s->>'status' in('completed','finished','final') then clock_timestamp() end from jsonb_array_elements(accepted) s
 on conflict(source_id,fixture_id) do update set score=excluded.score,content_hash=excluded.content_hash,first_completed_at=coalesce(nothingsports_live_scores.first_completed_at,excluded.first_completed_at)
 where nothingsports_live_scores.score is distinct from excluded.score;
 return revision;
end $$;

create or replace function public.nothingsports_project_fixture_observations(base jsonb,score jsonb,receipt jsonb,first_complete timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
 select base||coalesce(score,'{}'::jsonb)||jsonb_build_object(
  'fixtureObservationSchema','fixture-observations.v1',
  'scoreFactObservedAt',coalesce(public.nothingsports_fixture_observation_time(score->>'scoreCheckedAt'),public.nothingsports_fixture_observation_time(base->>'scoreCheckedAt')),
  'statusFactObservedAt',coalesce(public.nothingsports_fixture_observation_time(score->>'statusCheckedAt'),public.nothingsports_fixture_observation_time(base->>'statusCheckedAt')),
  'scoreCheckedAt',coalesce(public.nothingsports_fixture_observation_time(receipt->>'s'),public.nothingsports_fixture_observation_time(score->>'scoreCheckedAt'),public.nothingsports_fixture_observation_time(base->>'scoreCheckedAt')),
  'statusCheckedAt',coalesce(public.nothingsports_fixture_observation_time(receipt->>'t'),public.nothingsports_fixture_observation_time(score->>'statusCheckedAt'),public.nothingsports_fixture_observation_time(base->>'statusCheckedAt')))||
  case when first_complete is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',first_complete) end;
$$;
create or replace function public.nothingsports_read_match_scores(p_fixture_ids text[])
returns table(source_id text,fixture jsonb,checked_at timestamptz) language sql stable security invoker set search_path='' as $$
 select c.source_id,public.nothingsports_project_fixture_observations(c.fixture,s.score,src.discovery_report->'_fixtureObservations'->c.fixture_id,s.first_completed_at),src.checked_at
 from public.nothingsports_fixture_current c join public.nothingsports_fixture_sources src using(source_id)
 left join public.nothingsports_live_scores s using(source_id,fixture_id)
 where cardinality(p_fixture_ids) between 1 and 60 and c.identity_keys && p_fixture_ids order by src.checked_at,c.fixture_id;
$$;
create or replace function public.nothingsports_read_current_fixtures(p_fixture_ids text[] default null)
returns table(source_id text,fixture_id text,fixture jsonb,identity_keys text[])
language sql stable security invoker set search_path='' as $$
 select c.source_id,c.fixture_id,public.nothingsports_project_fixture_observations(c.fixture,s.score,src.discovery_report->'_fixtureObservations'->c.fixture_id,s.first_completed_at),c.identity_keys
 from public.nothingsports_fixture_current c join public.nothingsports_fixture_sources src using(source_id)
 left join public.nothingsports_live_scores s using(source_id,fixture_id)
 where p_fixture_ids is null or c.identity_keys && p_fixture_ids order by c.source_id,c.fixture_id;
$$;
-- Strip private verification maps before transfer: same two bounded Feed reads.
create or replace function public.nothingsports_read_fixture_source_health()
returns table(source_id text,revision bigint,checked_at timestamptz,next_due_at timestamptz,discovery_report jsonb)
language sql stable security invoker set search_path='' as $$
 select source_id,revision,checked_at,next_due_at,nullif(discovery_report-'_fixtureObservations','{}'::jsonb) from public.nothingsports_fixture_sources order by source_id;
$$;
revoke all on function public.nothingsports_fixture_observation_time(text),public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz),public.nothingsports_read_fixture_source_health(),public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb),public.nothingsports_read_match_scores(text[]),public.nothingsports_read_current_fixtures(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_fixture_observation_time(text),public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz),public.nothingsports_read_fixture_source_health(),public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb),public.nothingsports_read_match_scores(text[]),public.nothingsports_read_current_fixtures(text[]) to service_role;

create or replace function public.nothingsports_fail_fixture_source_report(p_source_id text,p_token uuid,p_retry_ms integer,p_report jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare receipts jsonb;
begin
 if p_report is null or jsonb_typeof(p_report)<>'object' then raise exception 'Invalid report'; end if;
 select discovery_report->'_fixtureObservations' into receipts from public.nothingsports_fixture_sources where source_id=p_source_id and lease_token=p_token and lease_until>clock_timestamp() for update;
 if not found then raise exception 'Lease expired'; end if;
 perform public.nothingsports_fail_fixture_source(p_source_id,p_token,p_retry_ms);
 update public.nothingsports_fixture_sources set discovery_report=(p_report-'_fixtureObservations')||case when receipts is null then '{}'::jsonb else jsonb_build_object('_fixtureObservations',receipts) end where source_id=p_source_id;
end $$;
revoke all on function public.nothingsports_fail_fixture_source_report(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_fail_fixture_source_report(text,uuid,integer,jsonb) to service_role;
