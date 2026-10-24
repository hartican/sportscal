-- LOCAL CANDIDATE. Requires exact current coalesced writer profile; DEPLOY owns adoption/backfill.
-- Exact current22 preimage; current source owners retain publication and transaction ownership.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='3s';
lock table public.nothingsports_fixture_sources,public.nothingsports_fixture_current,public.nothingsports_live_scores,nothingsports_fixture_read_private.fixture_context,nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens,nothingsports_fixture_read_private.integrity_pending in share row exclusive mode;
set constraints all immediate;
do $guard$begin
 if current_user<>'postgres' then raise exception 'Expected postgres owner';end if;
 if exists(select 1 from public.nothingsports_fixture_sources where lease_until>clock_timestamp())then raise exception 'Active source lease';end if;
 if to_regclass('nothingsports_fixture_read_private.near_selection')is not null or to_regprocedure('nothingsports_fixture_read_private.read_near_raw(text[])')is not null or to_regprocedure('nothingsports_fixture_read_private.near_index_ready()')is not null or to_regprocedure('nothingsports_fixture_read_private.rebuild_near_selection(text,text)')is not null or to_regprocedure('nothingsports_fixture_read_private.near_fields(jsonb,jsonb,jsonb,jsonb,timestamptz)')is not null then raise exception 'Near artifacts already exist';end if;
 if md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure))<>'d9b49086166c24b3a10b4dc1f7279b7c'then raise exception 'Original D9 reader differs';end if;
 if exists(select 1 from jsonb_to_recordset('[{"signature":"nothingsports_fixture_observation_time(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"13842433b7af056a35c01e8b234ae3c9"}},{"signature":"nothingsports_fixture_read_private.context_fields(jsonb,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"18dbb6a6afc42fcb7bd9462a3ddef0da"}},{"signature":"nothingsports_fixture_read_private.enforce_pending_integrity()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"6e211988e06c52d9ddfb7eee5cc5b908"}},{"signature":"nothingsports_fixture_read_private.mark_integrity_pending()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"7ea78bfefb71f46ede7d35d7d656e14e"}},{"signature":"nothingsports_fixture_read_private.publish_compact_complete(text,uuid,jsonb,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"0a2535591819d5fc729b6214190f3484"}},{"signature":"nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"cd48f9a1d41db6e5baac18963b6e3232"}},{"signature":"nothingsports_fixture_read_private.selection_fields(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"d9bad60ae66eb8157788e482a9fca783"}},{"signature":"nothingsports_fixture_read_private.source_index_complete(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"85eb0ec44403c2ab6237ad76598cd2dd"}},{"signature":"nothingsports_fixture_read_private.sync_fixture(text,text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"d122b4829f5505e9d394e26133c61e32"}},{"signature":"nothingsports_fixture_read_private.sync_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6d37c27454bbb9fb7b111a98574507a8"}},{"signature":"nothingsports_fixture_read_private.token_membership_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"d0fe27069e4d294d7385cff736776ad6"}},{"signature":"nothingsports_fixture_read_private.top_match_keys(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"0b5062260f46dfeb70e1e231db8d03db"}},{"signature":"nothingsports_fixture_read_private.window_fields(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"6a39d774a7309099a986a2e6068d33fb"}},{"signature":"nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamp with time zone)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"44d1edfc00ada08fad8deb987472ad54"}},{"signature":"nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"7e7128d57cbf89a17b592e1dfef0769e"}},{"signature":"nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"68993b69c5054c76ad00f8c627e20651"}},{"signature":"nothingsports_publish_fixture_source_report(text,uuid,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6cce2642baed98679b62e0b605396d21"}},{"signature":"nothingsports_read_current_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"ef1658b2eb58a376f368ede88730ad43"}},{"signature":"nothingsports_read_current_fixture_bundle_json(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"a91f9bc32b11190240bba20ff0870bd8"}},{"signature":"nothingsports_read_current_fixture_bundle_json_rows(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"6e6a06e0ca5a3206a138cb88a400e84b"}},{"signature":"nothingsports_read_current_fixtures(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"8f7e452c8a96f15ed11b50b4ea5cb751"}},{"signature":"nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"df1f9773b0f210c122f6c55fe8425f3c"}},{"signature":"public.nothingsports_read_match_centre_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"d9b49086166c24b3a10b4dc1f7279b7c"}}]'::jsonb)e(signature text,contract jsonb)left join pg_proc p on p.oid=to_regprocedure(e.signature)where e.contract is distinct from jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig))then raise exception 'Current coalesced22 contract differs';end if;
 if exists(select 1 from jsonb_to_recordset('[{"relation":"nothingsports_fixture_read_private.fixture_context","name":"fixture_context_integrity_after_change","digest":"bf03845ba9bf5898d3f34f3053a8ed63","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_tokens_integrity_after_change","digest":"9b0c32efa6f1ed5eda212c9671c0ba7b","enabled":"O"},{"relation":"nothingsports_fixture_read_private.integrity_pending","name":"fixture_integrity_at_commit","digest":"9399bc70ad1f117e5f1e9219a0b34500","enabled":"O"},{"relation":"nothingsports_fixture_read_private.source_tokens","name":"source_tokens_integrity_after_change","digest":"37d4890aa003c3d1934270bb84d13b1e","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_current_integrity_after_change","digest":"73df0f45df51692e18c431c72027a91c","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_read_context_after_current","digest":"3f06abe6825f9b8a4d9ce0332fa537ec","enabled":"O"},{"relation":"public.nothingsports_live_scores","name":"fixture_read_context_after_score","digest":"880b3667a7d5c466eaf9791486980429","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_token_membership_after_change","digest":"6d907458def566339fc1d9e9a67d5652","enabled":"O"}]'::jsonb)e(relation text,name text,digest text,enabled text)left join pg_trigger t on t.tgrelid=to_regclass(e.relation)and t.tgname=e.name where md5(pg_get_triggerdef(t.oid))is distinct from e.digest or t.tgenabled::text is distinct from e.enabled)then raise exception 'Current trigger contract differs';end if;
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))<>'fbc28299a5bf25428b286adc5ee2e0da' or not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture'and a.attgenerated='s'and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365')then raise exception 'Current generated/view contract differs';end if;
 if exists(select 1 from nothingsports_fixture_read_private.integrity_pending)then raise exception 'Unclosed pending work';end if;
 if exists(select 1 from (values
 ('fixture_context','{postgres=arwdDxtm/postgres,service_role=arwd/postgres}'),
 ('fixture_tokens','{postgres=arwdDxtm/postgres,service_role=ard/postgres}'),
 ('source_tokens','{postgres=arwdDxtm/postgres,service_role=ard/postgres}'),
 ('integrity_pending','{postgres=arwdDxtm/postgres,service_role=r/postgres}'))expected(name,acl)
 left join pg_class c on c.relnamespace='nothingsports_fixture_read_private'::regnamespace and c.relname=expected.name
 where row(pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity,c.relacl::text)is distinct from row('postgres'::name,true,false,expected.acl))then raise exception 'Original private table rights/RLS differ';end if;
 if(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.atthasdef)order by a.attnum)from pg_attribute a where a.attrelid='nothingsports_fixture_read_private.integrity_pending'::regclass and a.attnum>0 and not a.attisdropped)is distinct from '[["source_id","text",true,false],["batch_xid","bigint",false,false],["batch_pid","integer",false,false]]'::jsonb then raise exception 'Current pending marker schema differs';end if;
 if has_table_privilege('service_role','nothingsports_fixture_read_private.integrity_pending','INSERT,UPDATE,DELETE,TRUNCATE')or has_schema_privilege('anon','nothingsports_fixture_read_private','USAGE')or has_schema_privilege('authenticated','nothingsports_fixture_read_private','USAGE')then raise exception 'Private boundary differs';end if;
end $guard$;

create table nothingsports_fixture_read_private.near_selection(
 source_id text not null,fixture_id text not null,shape_version smallint not null,
 status text,start_kind smallint not null,start_at timestamptz,completion_at timestamptz,
 completion_unqualified boolean not null,lookup_uncertain boolean not null,
 primary key(source_id,fixture_id),
 foreign key(source_id,fixture_id) references public.nothingsports_fixture_current(source_id,fixture_id) on update cascade on delete cascade,
 check(shape_version in(0,1)),check(start_kind in(0,1,2)),check((start_kind=1)=(start_at is not null))
);
alter table nothingsports_fixture_read_private.near_selection enable row level security;
alter table nothingsports_fixture_read_private.near_selection force row level security;
revoke all on nothingsports_fixture_read_private.near_selection from public,anon,authenticated,service_role;
grant select on nothingsports_fixture_read_private.near_selection to service_role;
create index near_selection_start_idx on nothingsports_fixture_read_private.near_selection(status,start_at,source_id,fixture_id);
create index near_selection_completion_idx on nothingsports_fixture_read_private.near_selection(status,completion_at,source_id,fixture_id) where completion_at is not null;
create index near_selection_exception_idx on nothingsports_fixture_read_private.near_selection(source_id,fixture_id)
 include(shape_version,status,start_kind,completion_unqualified,lookup_uncertain)
 where shape_version<>1 or start_kind=2 or completion_unqualified or lookup_uncertain;

-- Timeless admission facts only. Original source fields/precision remain untouched.
create function nothingsports_fixture_read_private.near_fields(base jsonb,score jsonb,b jsonb,t jsonb,first_complete timestamptz)
returns table(status text,start_kind smallint,start_at timestamptz,completion_at timestamptz,completion_unqualified boolean,lookup_uncertain boolean,complete boolean)
language plpgsql stable security invoker set search_path='' as $near$
declare starts text;mark text;field text;marks text[]:='{}';parsed timestamptz;
begin
 complete:=true;start_kind:=0;start_at:=null;completion_at:=null;completion_unqualified:=false;lookup_uncertain:=false;
 if b?'calendarWindow' and t?'calendarWindow' then
  status:=case when(t->'calendarWindow'->>'hasStatus')::boolean then t->'calendarWindow'->>'status' else b->'calendarWindow'->>'status' end;
 else status:=case when score?'status' then score->>'status' else base->>'status' end;end if;
 starts:=case when(t->>'hasStart')::boolean then t->>'starts' else b->>'starts' end;
 if nullif(starts,'') is not null then
  if starts~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
   and pg_catalog.pg_input_is_valid(starts,'timestamptz') then start_kind:=1;start_at:=starts::timestamptz;
  else start_kind:=2;end if;
  -- This intentionally differs from the stricter seed grammar above.
  lookup_uncertain:=not coalesce(starts~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$'
   and pg_catalog.pg_input_is_valid(starts,'timestamptz'),false);
 end if;
 if status in('completed','finished','final','cancelled','canceled','abandoned') then
  completion_at:=first_complete;
  foreach field in array array['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt'] loop
   marks:=array_append(marks,case when score?field then score->>field else base->>field end);
  end loop;
  marks:=marks||array[score->>'statusCheckedAt',base->>'statusCheckedAt'];
  foreach mark in array marks loop
   if nullif(mark,'') is not null then
    if mark~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
     and pg_catalog.pg_input_is_valid(mark,'timestamptz') then parsed:=mark::timestamptz;completion_at:=greatest(completion_at,parsed);
    else completion_unqualified:=true;end if;
   end if;
  end loop;
 end if;
 return next;
exception when invalid_text_representation or invalid_parameter_value or datatype_mismatch then
 -- Do not make a previously accepted canonical write fail on a malformed descriptor.
 -- Keep the original reader/error behavior through the unready fallback.
 status:=null;start_kind:=0;start_at:=null;completion_at:=null;completion_unqualified:=false;lookup_uncertain:=false;complete:=false;return next;
end $near$;
revoke all on function nothingsports_fixture_read_private.near_fields(jsonb,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;

create function nothingsports_fixture_read_private.rebuild_near_selection(p_source_id text,p_fixture_id text) returns void
language plpgsql security definer set search_path='' as $rebuild$
declare raw jsonb;base jsonb;score jsonb;identities text[];first_complete timestamptz;
 cached nothingsports_fixture_read_private.fixture_context;expected record;facts record;version smallint:=0;
begin
 perform 1 from public.nothingsports_fixture_sources where source_id=p_source_id for update;
 select c.fixture,c.global_fixture,c.identity_keys,s.score,s.first_completed_at into raw,base,identities,score,first_complete
 from public.nothingsports_fixture_current c left join public.nothingsports_live_scores s using(source_id,fixture_id)
 where c.source_id=p_source_id and c.fixture_id=p_fixture_id;
 if not found then delete from nothingsports_fixture_read_private.near_selection where source_id=p_source_id and fixture_id=p_fixture_id;return;end if;
 select * into cached from nothingsports_fixture_read_private.fixture_context where source_id=p_source_id and fixture_id=p_fixture_id;
 if found and cached.shape_version=1 and cached.identity_keys is not distinct from identities then
  select * into expected from nothingsports_fixture_read_private.context_fields(raw,score);
  -- A direct contrary context mutation cannot be blessed by calling this helper.
  if row(cached.base_key,cached.score_key,cached.has_score_key,cached.participant_ids,cached.sides,cached.base_selection,cached.score_selection)
   is not distinct from row(expected.base_key,expected.score_key,expected.has_score_key,expected.participant_ids,expected.sides,expected.base_selection,expected.score_selection) then version:=1;end if;
 end if;
 select * into facts from nothingsports_fixture_read_private.near_fields(base,score,coalesce(cached.base_selection,'{}'),coalesce(cached.score_selection,'{}'),first_complete);
 if not facts.complete then version:=0;end if;
 insert into nothingsports_fixture_read_private.near_selection values(p_source_id,p_fixture_id,version,facts.status,facts.start_kind,facts.start_at,facts.completion_at,facts.completion_unqualified,facts.lookup_uncertain)
 on conflict(source_id,fixture_id) do update set shape_version=excluded.shape_version,status=excluded.status,start_kind=excluded.start_kind,start_at=excluded.start_at,
  completion_at=excluded.completion_at,completion_unqualified=excluded.completion_unqualified,lookup_uncertain=excluded.lookup_uncertain
 where row(near_selection.shape_version,near_selection.status,near_selection.start_kind,near_selection.start_at,near_selection.completion_at,near_selection.completion_unqualified,near_selection.lookup_uncertain)
  is distinct from row(excluded.shape_version,excluded.status,excluded.start_kind,excluded.start_at,excluded.completion_at,excluded.completion_unqualified,excluded.lookup_uncertain);
end $rebuild$;
revoke all on function nothingsports_fixture_read_private.rebuild_near_selection(text,text) from public,anon,authenticated,service_role;
grant execute on function nothingsports_fixture_read_private.rebuild_near_selection(text,text) to service_role;

create function nothingsports_fixture_read_private.near_index_ready() returns boolean
language sql stable security invoker set search_path='' as $ready$
 select not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
 and not exists(select 1 from nothingsports_fixture_read_private.near_selection where shape_version<>1)
 and not exists(select 1 from public.nothingsports_fixture_current c
  left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
  left join nothingsports_fixture_read_private.near_selection n using(source_id,fixture_id)
  where ctx.source_id is null or n.source_id is null);
$ready$;
revoke all on function nothingsports_fixture_read_private.near_index_ready() from public,anon,authenticated,service_role;
grant execute on function nothingsports_fixture_read_private.near_index_ready() to service_role;

CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.read_near_raw(p_membership_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with recursive index_state as materialized (
  select not exists(select 1 from nothingsports_fixture_read_private.integrity_pending) and not exists(
   select 1 from public.nothingsports_fixture_current c left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id) where ctx.source_id is null) as ready
 ), active_window as (
  select statement_timestamp() as observed_at,
   statement_timestamp()+interval '31 minutes' as through,
   statement_timestamp()-interval '65 minutes' as since
 ), seed_inputs as materialized (
  select c.source_id,c.fixture_id,c.identity_keys,s.first_completed_at,f.status,f.starts_at,
   case when f.status in('completed','finished','final','cancelled','canceled','abandoned') and
    (s.first_completed_at>=statement_timestamp()-interval '65 minutes') is not true then
    array[case when s.score ? 'actualEndTimeUtc' then s.score->>'actualEndTimeUtc' else b."actualEndTimeUtc" end,
     case when s.score ? 'completedAt' then s.score->>'completedAt' else b."completedAt" end,
     case when s.score ? 'firstConfirmedCompleteAt' then s.score->>'firstConfirmedCompleteAt' else b."firstConfirmedCompleteAt" end,
     case when s.score ? 'resultPublishedAt' then s.score->>'resultPublishedAt' else b."resultPublishedAt" end,
     s.score->>'statusCheckedAt',b."statusCheckedAt"] else null end as completion_marks
  from public.nothingsports_fixture_current c
  join public.nothingsports_fixture_sources src using(source_id)
  left join public.nothingsports_live_scores s on s.source_id=c.source_id and s.fixture_id=c.fixture_id
  left join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
  cross join lateral (
   select
    case when ctx.base_selection?'calendarWindow' and ctx.score_selection?'calendarWindow' then case when (ctx.score_selection->'calendarWindow'->>'hasStatus')::boolean then ctx.score_selection->'calendarWindow'->>'status' else ctx.base_selection->'calendarWindow'->>'status' end else case when s.score ? 'status' then s.score->>'status' else c.global_fixture->>'status' end end as status,
    case when ctx.source_id is not null then case when (ctx.score_selection->>'hasStart')::boolean then ctx.score_selection->>'starts' else ctx.base_selection->>'starts' end else case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.global_fixture->>'startTimeUtc' end end as starts_at
  ) f
  cross join lateral jsonb_to_record(case when f.status in('completed','finished','final','cancelled','canceled','abandoned') and
   (s.first_completed_at>=statement_timestamp()-interval '65 minutes') is not true and jsonb_typeof(c.global_fixture)='object'
   then c.global_fixture else '{}'::jsonb end) b("actualEndTimeUtc" text,"completedAt" text,"firstConfirmedCompleteAt" text,"resultPublishedAt" text,"statusCheckedAt" text)
 ), seeds as materialized (
  select c.source_id,c.fixture_id from seed_inputs c cross join active_window w
  where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and (
   c.identity_keys && coalesce(p_membership_ids,'{}'::text[]) or
   c.status in('live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing') or
   (c.status in('scheduled','upcoming') and
    nullif(c.starts_at,'') is not null and
    case when c.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(c.starts_at,'timestamptz')
    then c.starts_at::timestamptz between w.observed_at and w.through else true end) or
   (c.status in('completed','finished','final','cancelled','canceled','abandoned') and (
    c.first_completed_at>=w.since or
    exists (
     select 1 from unnest(c.completion_marks) mark(value)
     where nullif(value,'') is not null and
      case when value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(value,'timestamptz')
       then value::timestamptz>=w.since else true end
    )
   ))
  )
  order by c.source_id,c.fixture_id limit 5001
 ), lookup as materialized (
  -- Keep this lookup small: no source receipt or fixture payload is decoded.
  -- Same-sided timed records may carry metadata joined by the JS model.
  -- Preserve possible context without duplicating its date/identity rules.
  select c.source_id,c.fixture_id,c.identity_keys,
   case when nullif(f.starts_at,'') is not null and nullif(f.home_id,'') is not null and nullif(f.away_id,'') is not null and f.home_id<>f.away_id
    then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)] else null end as sides,
   nullif(f.starts_at,'') is not null and not coalesce(f.starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$' and pg_catalog.pg_input_is_valid(f.starts_at,'timestamptz'),false) as uncertain_clock
  from public.nothingsports_fixture_current c
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
  left join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=c.source_id and ctx.fixture_id=c.fixture_id and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
  cross join lateral (select case when ctx.source_id is not null then case when (ctx.score_selection->>'hasStart')::boolean then ctx.score_selection->>'starts' else ctx.base_selection->>'starts' end else case when s.score ? 'startTimeUtc' then s.score->>'startTimeUtc' else c.fixture->>'startTimeUtc' end end as starts_at,
   case when ctx.source_id is not null then case when (ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home' else ctx.base_selection->>'home' end else case when s.score ? 'homeParticipantId' then s.score->>'homeParticipantId' else c.fixture->>'homeParticipantId' end end as home_id,
   case when ctx.source_id is not null then case when (ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away' else ctx.base_selection->>'away' end else case when s.score ? 'awayParticipantId' then s.score->>'awayParticipantId' else c.fixture->>'awayParticipantId' end end as away_id) f
 ), related_rows(source_id,fixture_id,identity_keys,sides) as (
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from lookup l
  where exists(select 1 from seeds seed where seed.source_id=l.source_id and seed.fixture_id=l.fixture_id)
   or (l.uncertain_clock and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000)
  union
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from related_rows r
  cross join index_state idx
  cross join lateral (
   select ctx.source_id,ctx.fixture_id,ctx.identity_keys,
    case when ctx.sides is not null then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)] else null end as sides
   from nothingsports_fixture_read_private.fixture_tokens seed
   join nothingsports_fixture_read_private.fixture_tokens other on other.kind=seed.kind and other.token=seed.token
   join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=other.source_id and ctx.fixture_id=other.fixture_id
   cross join lateral(select
    case when (ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home' else ctx.base_selection->>'home' end home_id,
    case when (ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away' else ctx.base_selection->>'away' end away_id) f
   where idx.ready and seed.source_id=r.source_id and seed.fixture_id=r.fixture_id
   union
   select raw.source_id,raw.fixture_id,raw.identity_keys,raw.sides from lookup raw where not idx.ready and (raw.identity_keys && r.identity_keys or raw.sides=r.sides)
  ) l
  where l.identity_keys && r.identity_keys or l.sides=r.sides
 ), candidates as materialized (
  -- Keep complete context selection and its sentinel, but sort/store keys only.
  select c.source_id,c.fixture_id
  from related_rows r
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join public.nothingsports_fixture_sources src using(source_id)
  order by c.source_id,c.fixture_id limit 5001
 ), receipts as materialized (
  select src.source_id,r.key as fixture_id,r.value as receipt
  from public.nothingsports_fixture_sources src
  join (select distinct source_id from candidates) needed using(source_id)
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), projected as (
  select c.source_id,c.fixture_id,c.identity_keys,
   public.nothingsports_project_fixture_observations(
    ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
     case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
     case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
      (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end,
    score,r.receipt,first_completed_at) as fixture
  from candidates selected
  cross join lateral (
   -- Parameterised primary-key projection prevents a recursive row estimate
   -- from hashing every wide fixture. OFFSET0 preserves the lookup boundary.
   select base.source_id,base.fixture_id,base.fixture,base.identity_keys,s.score,s.first_completed_at
   from public.nothingsports_fixture_current base
   left join public.nothingsports_live_scores s using(source_id,fixture_id)
   where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id
   offset 0
  ) c
  left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','match-centre',
  'complete',count(*)<=5000 and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected;
$function$;
revoke all on function nothingsports_fixture_read_private.read_near_raw(text[]) from public,anon,authenticated,service_role;
grant execute on function nothingsports_fixture_read_private.read_near_raw(text[]) to service_role;

CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.sync_fixture(p_source_id text, p_fixture_id text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  get diagnostics affected=row_count;
  perform nothingsports_fixture_read_private.rebuild_near_selection(p_source_id,p_fixture_id);
  if affected=0 then return;end if;
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
$function$;
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
   if cached.identity_keys is not distinct from new.identity_keys and cached.base_selection is not distinct from current_selection then perform nothingsports_fixture_read_private.rebuild_near_selection(new.source_id,new.fixture_id);return new;end if;
  else
   current_selection:=nothingsports_fixture_read_private.selection_fields(new.score);
   if cached.score_selection is not distinct from current_selection then perform nothingsports_fixture_read_private.rebuild_near_selection(new.source_id,new.fixture_id);return new;end if;
  end if;
 end if;
 perform nothingsports_fixture_read_private.sync_fixture(new.source_id,new.fixture_id);return new;
end;
$function$;
CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.mark_integrity_pending()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_op<>'INSERT' then
  insert into nothingsports_fixture_read_private.integrity_pending(source_id) values(old.source_id) on conflict do nothing;
 end if;
 if tg_op<>'DELETE' then
  insert into nothingsports_fixture_read_private.integrity_pending(source_id) values(new.source_id) on conflict do nothing;
 end if;
 -- Invalidate the original composite identities without rewriting unready rows.
 if tg_table_name='fixture_context' then
  if tg_op<>'INSERT' then update nothingsports_fixture_read_private.near_selection set shape_version=0 where source_id=old.source_id and fixture_id=old.fixture_id and shape_version<>0;end if;
  if tg_op<>'DELETE' then update nothingsports_fixture_read_private.near_selection set shape_version=0 where source_id=new.source_id and fixture_id=new.fixture_id and shape_version<>0;end if;
 end if;
 return null;
end;
$function$;
CREATE OR REPLACE FUNCTION public.nothingsports_read_match_centre_fixture_bundle(p_membership_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select case when nothingsports_fixture_read_private.near_index_ready()then(
with recursive index_state as materialized(select true as ready),near_seed_keys as materialized(
 select ctx.source_id,ctx.fixture_id from nothingsports_fixture_read_private.fixture_context ctx where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and ctx.identity_keys&&coalesce(p_membership_ids,'{}'::text[])
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing')
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('scheduled','upcoming')and n.start_at between statement_timestamp() and statement_timestamp()+interval '31 minutes'
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('scheduled','upcoming')and n.start_kind=2
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('completed','finished','final','cancelled','canceled','abandoned')and n.completion_at>=statement_timestamp()-interval '65 minutes'
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('completed','finished','final','cancelled','canceled','abandoned')and n.completion_unqualified
),seeds as materialized(
 select k.source_id,k.fixture_id from near_seed_keys k join public.nothingsports_fixture_sources src using(source_id)
 order by k.source_id,k.fixture_id limit 5001
),initial_keys as materialized(
 select source_id,fixture_id from seeds union
 select source_id,fixture_id from nothingsports_fixture_read_private.near_selection where lookup_uncertain and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000
),lookup as materialized(
 select ctx.source_id,ctx.fixture_id,ctx.identity_keys,
 case when ctx.sides is not null then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)]else null end as sides,n.lookup_uncertain as uncertain_clock
 from initial_keys k join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
 join nothingsports_fixture_read_private.near_selection n using(source_id,fixture_id)
 cross join lateral(select case when(ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home'else ctx.base_selection->>'home'end home_id,
 case when(ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away'else ctx.base_selection->>'away'end away_id)f
),related_rows(source_id,fixture_id,identity_keys,sides) as (
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from lookup l
  where exists(select 1 from seeds seed where seed.source_id=l.source_id and seed.fixture_id=l.fixture_id)
   or (l.uncertain_clock and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000)
  union
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from related_rows r
  cross join index_state idx
  cross join lateral (
   select ctx.source_id,ctx.fixture_id,ctx.identity_keys,
    case when ctx.sides is not null then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)] else null end as sides
   from nothingsports_fixture_read_private.fixture_tokens seed
   join nothingsports_fixture_read_private.fixture_tokens other on other.kind=seed.kind and other.token=seed.token
   join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=other.source_id and ctx.fixture_id=other.fixture_id
   cross join lateral(select
    case when (ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home' else ctx.base_selection->>'home' end home_id,
    case when (ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away' else ctx.base_selection->>'away' end away_id) f
   where idx.ready and seed.source_id=r.source_id and seed.fixture_id=r.fixture_id
   union
   select raw.source_id,raw.fixture_id,raw.identity_keys,raw.sides from lookup raw where not idx.ready and (raw.identity_keys && r.identity_keys or raw.sides=r.sides)
  ) l
  where l.identity_keys && r.identity_keys or l.sides=r.sides
 ), candidates as materialized (
  -- Keep complete context selection and its sentinel, but sort/store keys only.
  select c.source_id,c.fixture_id
  from related_rows r
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join public.nothingsports_fixture_sources src using(source_id)
  order by c.source_id,c.fixture_id limit 5001
 ), receipts as materialized (
  select src.source_id,r.key as fixture_id,r.value as receipt
  from public.nothingsports_fixture_sources src
  join (select distinct source_id from candidates) needed using(source_id)
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), projected as (
  select c.source_id,c.fixture_id,c.identity_keys,
   public.nothingsports_project_fixture_observations(
    ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
     case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
     case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
      (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end,
    score,r.receipt,first_completed_at) as fixture
  from candidates selected
  cross join lateral (
   -- Parameterised primary-key projection prevents a recursive row estimate
   -- from hashing every wide fixture. OFFSET0 preserves the lookup boundary.
   select base.source_id,base.fixture_id,base.fixture,base.identity_keys,s.score,s.first_completed_at
   from public.nothingsports_fixture_current base
   left join public.nothingsports_live_scores s using(source_id,fixture_id)
   where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id
   offset 0
  ) c
  left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','match-centre',
  'complete',count(*)<=5000 and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected
)else nothingsports_fixture_read_private.read_near_raw(p_membership_ids)end;
$function$;
COMMIT;
