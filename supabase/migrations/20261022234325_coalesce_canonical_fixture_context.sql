-- OFFLINE FROZEN CANDIDATE FOR REVIEW, NOT ADOPTED. B/C semantics are unshipped prerequisites.
BEGIN;SET LOCAL lock_timeout='1s';SET LOCAL statement_timeout='3s';
lock table public.nothingsports_fixture_sources,public.nothingsports_fixture_current,public.nothingsports_live_scores,nothingsports_fixture_read_private.fixture_context,nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens,nothingsports_fixture_read_private.integrity_pending in share row exclusive mode;
do $guard$begin if not(current_user='postgres' and md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))='fbc28299a5bf25428b286adc5ee2e0da' and exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture'and a.attgenerated='s'and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365')and not exists(select 1 from jsonb_to_recordset('[{"signature":"nothingsports_fixture_read_private.sync_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6ad06f6cdab54b2eea83c993d094c160"}},{"signature":"nothingsports_fixture_read_private.sync_fixture(text,text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"3c20e52d95ebda90af1bb15369939738"}},{"signature":"nothingsports_fixture_read_private.mark_integrity_pending()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"7ea78bfefb71f46ede7d35d7d656e14e"}},{"signature":"nothingsports_fixture_read_private.enforce_pending_integrity()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"6b69919a197cf6abafef6040d5a41e60"}},{"signature":"nothingsports_fixture_read_private.source_index_complete(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"85eb0ec44403c2ab6237ad76598cd2dd"}},{"signature":"public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"974299abc8841e1cfc35b95332e10eaa"}},{"signature":"public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"7c001ceae18809a75401ba0c308a8603"}},{"signature":"public.nothingsports_publish_fixture_source_report(text,uuid,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6cce2642baed98679b62e0b605396d21"}},{"signature":"public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"44d1edfc00ada08fad8deb987472ad54"}},{"signature":"public.nothingsports_fixture_observation_time(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"13842433b7af056a35c01e8b234ae3c9"}},{"signature":"public.nothingsports_read_current_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"ef1658b2eb58a376f368ede88730ad43"}},{"signature":"public.nothingsports_read_current_fixtures(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"8f7e452c8a96f15ed11b50b4ea5cb751"}},{"signature":"public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"df1f9773b0f210c122f6c55fe8425f3c"}},{"signature":"public.nothingsports_read_current_fixture_bundle_json(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"a91f9bc32b11190240bba20ff0870bd8"}},{"signature":"public.nothingsports_read_current_fixture_bundle_json_rows(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"6e6a06e0ca5a3206a138cb88a400e84b"}},{"signature":"nothingsports_fixture_read_private.context_fields(jsonb,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"18dbb6a6afc42fcb7bd9462a3ddef0da"}},{"signature":"nothingsports_fixture_read_private.selection_fields(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"d9bad60ae66eb8157788e482a9fca783"}},{"signature":"nothingsports_fixture_read_private.token_membership_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"d0fe27069e4d294d7385cff736776ad6"}},{"signature":"nothingsports_fixture_read_private.top_match_keys(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"0b5062260f46dfeb70e1e231db8d03db"}},{"signature":"nothingsports_fixture_read_private.window_fields(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"6a39d774a7309099a986a2e6068d33fb"}}]'::jsonb)e(signature text,contract jsonb)left join pg_proc p on p.oid=to_regprocedure(e.signature)where e.contract is distinct from jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig))and not exists(select 1 from jsonb_to_recordset('[{"relation":"nothingsports_fixture_read_private.fixture_context","name":"fixture_context_integrity_after_change","digest":"bf03845ba9bf5898d3f34f3053a8ed63","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_tokens_integrity_after_change","digest":"9b0c32efa6f1ed5eda212c9671c0ba7b","enabled":"O"},{"relation":"nothingsports_fixture_read_private.integrity_pending","name":"fixture_integrity_at_commit","digest":"9399bc70ad1f117e5f1e9219a0b34500","enabled":"O"},{"relation":"nothingsports_fixture_read_private.source_tokens","name":"source_tokens_integrity_after_change","digest":"37d4890aa003c3d1934270bb84d13b1e","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_current_integrity_after_change","digest":"73df0f45df51692e18c431c72027a91c","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_read_context_after_current","digest":"3f06abe6825f9b8a4d9ce0332fa537ec","enabled":"O"},{"relation":"public.nothingsports_live_scores","name":"fixture_read_context_after_score","digest":"880b3667a7d5c466eaf9791486980429","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_token_membership_after_change","digest":"6d907458def566339fc1d9e9a67d5652","enabled":"O"}]'::jsonb)e(relation text,name text,digest text,enabled text)left join pg_trigger t on t.tgrelid=to_regclass(e.relation)and t.tgname=e.name where t.oid is null or md5(pg_get_triggerdef(t.oid))is distinct from e.digest or t.tgenabled::text is distinct from e.enabled or t.tgenabled<>'O'))then raise exception 'Current5fb original function/ACL/trigger/view preimage differs';end if;
 if exists(select 1 from nothingsports_fixture_read_private.integrity_pending)then raise exception 'Settled pending state required';end if;
 if exists(select 1 from public.nothingsports_fixture_sources where lease_token is not null and lease_until>clock_timestamp())then raise exception 'Active source lease prevents installation';end if;
 if exists(select 1 from pg_attribute where attrelid='nothingsports_fixture_read_private.integrity_pending'::regclass and attname in('batch_xid','batch_pid')and not attisdropped)or to_regprocedure('nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer)')is not null or to_regprocedure('nothingsports_fixture_read_private.publish_compact_complete(text,uuid,jsonb,jsonb,text,integer,jsonb)')is not null then raise exception 'Kernel artifacts already exist';end if;
 if has_table_privilege('service_role','nothingsports_fixture_read_private.integrity_pending','INSERT,UPDATE,DELETE,TRUNCATE')or has_table_privilege('anon','nothingsports_fixture_read_private.integrity_pending','SELECT')or has_table_privilege('authenticated','nothingsports_fixture_read_private.integrity_pending','SELECT')then raise exception 'Protected pending ACL differs';end if;end$guard$;
alter table nothingsports_fixture_read_private.integrity_pending add column batch_xid bigint,add column batch_pid integer;
CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.publish_full_complete(p_source_id text, p_token uuid, p_fixtures jsonb, p_hash text, p_interval_ms integer)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_row public.nothingsports_fixture_sources; next_revision bigint; retention_cutoff timestamptz; last_snapshot_revision bigint; changed_ids text[]:='{}'; deleted_ids text[]:='{}';
begin
  select * into current_row from public.nothingsports_fixture_sources where source_id=p_source_id for update;
  if p_token is null or current_row.source_id is null or current_row.lease_token is distinct from p_token or current_row.lease_until is null or current_row.lease_until<=clock_timestamp() then raise exception 'Lease expired'; end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures)<>'array' or p_hash is null or
    (jsonb_array_length(p_fixtures)=0 and (p_source_id not like 'discovery-%' or jsonb_array_length(current_row.fixtures)>0)) then raise exception 'Invalid snapshot'; end if;

  -- Validate the complete caller-merged collection before any fact or history write.
  -- Provider omissions are merged upstream; they are never deletion permission here.
  if exists (
    select 1 from jsonb_array_elements(p_fixtures) as payload(element)
    where jsonb_typeof(element) is distinct from 'object'
      or jsonb_typeof(coalesce(nullif(element->'id','null'::jsonb),
           nullif(element->'eventId','null'::jsonb),nullif(element->'canonicalEventId','null'::jsonb))) is distinct from 'string'
      or coalesce(btrim(coalesce(element->>'id',element->>'eventId',element->>'canonicalEventId')),'')=''
  ) then raise exception 'Invalid snapshot identity'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_fixtures) as payload(element)
    group by coalesce(element->>'id',element->>'eventId',element->>'canonicalEventId')
    having count(*)>1
  ) then raise exception 'Ambiguous snapshot identity'; end if;

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

  WITH changed AS (  insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash,updated_at)
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
  where public.nothingsports_fixture_current.content_hash is distinct from excluded.content_hash RETURNING fixture_id) SELECT coalesce(array_agg(fixture_id),'{}'::text[]) INTO changed_ids FROM changed;

  WITH deleted AS (  delete from public.nothingsports_fixture_current current
   where current.source_id=p_source_id
     and not exists (
       select 1 from jsonb_array_elements(p_fixtures) as payload(element)
       where coalesce(payload.element->>'id',payload.element->>'eventId',payload.element->>'canonicalEventId')=current.fixture_id
     ) RETURNING current.fixture_id) SELECT coalesce(array_agg(fixture_id),'{}'::text[]) INTO deleted_ids FROM deleted;

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
  return jsonb_build_object('revision',next_revision,'changed',to_jsonb(changed_ids||deleted_ids));
end;
$function$;
create or replace function nothingsports_fixture_read_private.publish_compact_complete(p_source_id text,p_token uuid,p_fixtures jsonb,p_scores jsonb,p_hash text,p_interval_ms integer,p_report jsonb default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare
 current_row public.nothingsports_fixture_sources; revision bigint; published jsonb; changed_ids text[]; score_changed_ids text[]; sync_id text; pending_preexisted boolean;
 score_keys text[]:=array['homeScore','awayScore','scoreDisplay','score','sets','games','innings','rubbers','canonicalResultScoreline'];
 controls text[]:=array['observationSchema','scoreObserved','statusObserved'];
 incoming jsonb; prior jsonb; next_score jsonb; score_facts jsonb; prior_facts jsonb; base jsonb; bases jsonb; previous_scores jsonb;
 receipts jsonb; receipt jsonb; report jsonb; accepted jsonb[]:='{}'::jsonb[]; receipt_updates jsonb[]:='{}'::jsonb[];
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
  accepted:=array_append(accepted,next_score);
  if receipt<>'{}'::jsonb then receipt_updates:=array_append(receipt_updates,jsonb_build_object('id',fid,'receipt',receipt)); end if;
 end loop;
 -- Each incoming identity is unique. Assemble once instead of copying the growing JSON per fixture.
 select receipts||coalesce(jsonb_object_agg(item->>'id',item->'receipt'),'{}'::jsonb) into receipts from unnest(receipt_updates) item;
 -- Bound receipts to retained fixtures. This does not delete sporting/user data.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into receipts from jsonb_each(receipts) where key in(select coalesce(value->>'id',value->>'eventId',value->>'canonicalEventId') from jsonb_array_elements(p_fixtures));
 if octet_length(receipts::text)>1048576 then raise exception 'Compact receipt byte budget exceeded'; end if;
 report:=coalesce(p_report,current_row.discovery_report,'{}'::jsonb)-'_fixtureObservations';
 report:=report||jsonb_build_object('_fixtureObservations',receipts);
 -- Original publisher owns lease consumption, fact revision, current IDs and retention.
 if report is null or jsonb_typeof(report)<>'object' then raise exception 'Invalid report';end if;
 if exists(select 1 from nothingsports_fixture_read_private.integrity_pending where source_id=p_source_id and batch_xid is not null)then raise exception 'Nested canonical batch refused';end if;
 select exists(select 1 from nothingsports_fixture_read_private.integrity_pending where source_id=p_source_id)into pending_preexisted;
 insert into nothingsports_fixture_read_private.integrity_pending(source_id,batch_xid,batch_pid)values(p_source_id,txid_current(),pg_backend_pid())on conflict(source_id)do update set batch_xid=excluded.batch_xid,batch_pid=excluded.batch_pid;
 published:=nothingsports_fixture_read_private.publish_full_complete(p_source_id,p_token,p_fixtures,p_hash,p_interval_ms);
 revision:=(published->>'revision')::bigint;select coalesce(array_agg(value),'{}'::text[])into changed_ids from jsonb_array_elements_text(published->'changed')v(value);
 update public.nothingsports_fixture_sources set discovery_report=report where source_id=p_source_id;
 WITH changed AS ( insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at)
 select p_source_id,s->>'id',s,md5(s::text),case when s->>'status' in('completed','finished','final') then clock_timestamp() end from unnest(accepted) s
 on conflict(source_id,fixture_id) do update set score=excluded.score,content_hash=excluded.content_hash,first_completed_at=coalesce(nothingsports_live_scores.first_completed_at,excluded.first_completed_at)
 where nothingsports_live_scores.score is distinct from excluded.score RETURNING fixture_id)SELECT coalesce(array_agg(fixture_id),'{}'::text[]) INTO score_changed_ids FROM changed;
 -- FINAL_BATCH_FLUSH: actual DML identities, no persistent ID queue.
 for sync_id in select distinct value from unnest(changed_ids||score_changed_ids)v(value) order by value loop
  perform nothingsports_fixture_read_private.sync_fixture(p_source_id,sync_id);
 end loop;
 if not nothingsports_fixture_read_private.source_index_complete(p_source_id)then raise exception using errcode='23514',message='Canonical batch final index incomplete';end if;
 if not pending_preexisted and cardinality(changed_ids||score_changed_ids)=0 then
  delete from nothingsports_fixture_read_private.integrity_pending where source_id=p_source_id and batch_xid=txid_current()and batch_pid=pg_backend_pid();
 else
  update nothingsports_fixture_read_private.integrity_pending set batch_xid=null,batch_pid=null where source_id=p_source_id and batch_xid=txid_current()and batch_pid=pg_backend_pid();
 end if;
 return revision;
end $$;
revoke all on function nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer),nothingsports_fixture_read_private.publish_compact_complete(text,uuid,jsonb,jsonb,text,integer,jsonb)from public,anon,authenticated;grant execute on function nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer),nothingsports_fixture_read_private.publish_compact_complete(text,uuid,jsonb,jsonb,text,integer,jsonb)to service_role;
create or replace function public.nothingsports_publish_fixture_source(p_source_id text,p_token uuid,p_fixtures jsonb,p_hash text,p_interval_ms integer)returns bigint language plpgsql security invoker set search_path=''as $$begin return(nothingsports_fixture_read_private.publish_full_complete(p_source_id,p_token,p_fixtures,p_hash,p_interval_ms)->>'revision')::bigint;end$$;
create or replace function public.nothingsports_publish_compact_scores(p_source_id text,p_token uuid,p_fixtures jsonb,p_scores jsonb,p_hash text,p_interval_ms integer,p_report jsonb default null)returns bigint language plpgsql security invoker set search_path=''as $$begin return nothingsports_fixture_read_private.publish_compact_complete(p_source_id,p_token,p_fixtures,p_scores,p_hash,p_interval_ms,p_report);end$$;
create or replace function nothingsports_fixture_read_private.sync_fixture(p_source_id text,p_fixture_id text) returns void
language plpgsql security invoker set search_path='' as $$
declare raw_fixture jsonb;raw_score jsonb;identities text[];affected integer;
begin
 -- Canonical publishers already hold this source lock before fixture writes.
 perform 1 from public.nothingsports_fixture_sources where source_id=p_source_id for update;
 select c.fixture,c.identity_keys,s.score into raw_fixture,identities,raw_score
 from public.nothingsports_fixture_current c left join public.nothingsports_live_scores s using(source_id,fixture_id)
 where c.source_id=p_source_id and c.fixture_id=p_fixture_id;
 if not found then
  delete from nothingsports_fixture_read_private.fixture_context where source_id=p_source_id and fixture_id=p_fixture_id;
 else
  insert into nothingsports_fixture_read_private.fixture_context(source_id,fixture_id,identity_keys,base_key,score_key,has_score_key,participant_ids,sides,base_selection,score_selection)
  select p_source_id,p_fixture_id,identities,f.* from nothingsports_fixture_read_private.context_fields(raw_fixture,raw_score) f
  on conflict(source_id,fixture_id) do update set identity_keys=excluded.identity_keys,base_key=excluded.base_key,score_key=excluded.score_key,
   has_score_key=excluded.has_score_key,participant_ids=excluded.participant_ids,sides=excluded.sides,base_selection=excluded.base_selection,score_selection=excluded.score_selection,shape_version=1
  where row(fixture_context.identity_keys,fixture_context.base_selection,fixture_context.score_selection,fixture_context.shape_version)
   is distinct from row(excluded.identity_keys,excluded.base_selection,excluded.score_selection,1::smallint);
  get diagnostics affected=row_count;if affected=0 then return;end if;
  -- Reconcile the exact set. A score-only context change must not rewrite identical tokens.
  delete from nothingsports_fixture_read_private.fixture_tokens actual
  where actual.source_id=p_source_id and actual.fixture_id=p_fixture_id
    and not exists (
      select 1 from (
        select distinct 1::smallint kind,id token from unnest(identities) id where id is not null
        union all select 2::smallint,sides from nothingsports_fixture_read_private.fixture_context
          where source_id=p_source_id and fixture_id=p_fixture_id and sides is not null
      ) expected where expected.kind=actual.kind and expected.token=actual.token
    );
  insert into nothingsports_fixture_read_private.fixture_tokens
  select distinct p_source_id,p_fixture_id,1::smallint,id from unnest(identities) id where id is not null
  union all select source_id,fixture_id,2::smallint,sides from nothingsports_fixture_read_private.fixture_context where source_id=p_source_id and fixture_id=p_fixture_id and sides is not null
  on conflict(source_id,fixture_id,kind,token) do nothing;
  -- Preserve the old rebuild's repair of missing source membership too.
  insert into nothingsports_fixture_read_private.source_tokens(source_id,kind,token)
  select distinct desired.source_id,desired.kind,desired.token
  from nothingsports_fixture_read_private.fixture_tokens desired
  where desired.source_id=p_source_id and desired.fixture_id=p_fixture_id
    and not exists(select 1 from nothingsports_fixture_read_private.source_tokens actual
      where actual.source_id=desired.source_id and actual.kind=desired.kind and actual.token=desired.token)
  on conflict(source_id,kind,token) do nothing;
 end if;
end;
$$;
CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cached nothingsports_fixture_read_private.fixture_context;current_selection jsonb;
begin

 if exists(select 1 from nothingsports_fixture_read_private.integrity_pending p where p.source_id=case when tg_op='DELETE'then old.source_id else new.source_id end and p.batch_xid=txid_current()and p.batch_pid=pg_backend_pid())then
  if tg_op='UPDATE'and row(old.source_id,old.fixture_id)is distinct from row(new.source_id,new.fixture_id)then raise exception 'Composite identity change inside batch refused';end if;
  if tg_op='DELETE'then return old;else return new;end if;
 end if;
 if tg_op='DELETE' then perform nothingsports_fixture_read_private.sync_fixture(old.source_id,old.fixture_id);return old;end if;
 if tg_op='UPDATE' and row(old.source_id,old.fixture_id) is distinct from row(new.source_id,new.fixture_id) then
  perform nothingsports_fixture_read_private.sync_fixture(old.source_id,old.fixture_id);
 end if;
 select * into cached from nothingsports_fixture_read_private.fixture_context where source_id=new.source_id and fixture_id=new.fixture_id;
 if found and cached.shape_version=1 then
  if tg_table_name='nothingsports_fixture_current' then
   current_selection:=nothingsports_fixture_read_private.selection_fields(new.fixture);
   if cached.identity_keys is not distinct from new.identity_keys and cached.base_selection is not distinct from current_selection then return new;end if;
  else
   current_selection:=nothingsports_fixture_read_private.selection_fields(new.score);
   if cached.score_selection is not distinct from current_selection then return new;end if;
  end if;
 end if;
 perform nothingsports_fixture_read_private.sync_fixture(new.source_id,new.fixture_id);return new;
end;
$function$;
CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.enforce_pending_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id and batch_xid is not null)then raise exception using errcode='23514',message='Unclosed canonical batch';end if;
 if not exists(select 1 from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id) then return null;end if;
 if not nothingsports_fixture_read_private.source_index_complete(new.source_id) then
  raise exception using errcode='23514',message='Fixture index integrity is incomplete; canonical transaction refused';
 end if;
 delete from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id;
 return null;
end;
$function$;
COMMIT;
