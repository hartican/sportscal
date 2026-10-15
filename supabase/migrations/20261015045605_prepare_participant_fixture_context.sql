set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure))<>'9c2dd2ae71123da686bb55340d7505c6' then
  raise exception 'Participant reader differs from reviewed baseline; migration refused';
 end if;
 if to_regnamespace('nothingsports_fixture_read_private') is not null then
  raise exception 'Fixture read metadata already exists; migration refused';
 end if;
end $guard$;
-- Hold the existing writers only while attaching metadata hooks.
-- Keep the original reader active during resumable, bounded preparation.
lock table public.nothingsports_fixture_current,public.nothingsports_live_scores in share row exclusive mode;

-- Prepare pure match-selection metadata through the existing canonical writers.
-- Facts, observations, customer data, schedules and reader deadlines stay in their existing owners.
create schema nothingsports_fixture_read_private;
revoke all on schema nothingsports_fixture_read_private from public,anon,authenticated;
grant usage on schema nothingsports_fixture_read_private to service_role;

create function nothingsports_fixture_read_private.top_match_keys(v jsonb) returns text[] language sql immutable security invoker set search_path='' as $$
 select array(select key from jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) key
  union select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) a(value) where jsonb_typeof(value)='string'
  union select v#>>'{}' where jsonb_typeof(v)='string');
$$;
create function nothingsports_fixture_read_private.selection_fields(v jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('key',b.key,'starts',b."startTimeUtc",'home',b."homeParticipantId",'away',b."awayParticipantId",
  'hasKey',v?'key','hasStart',v?'startTimeUtc','hasHome',v?'homeParticipantId','hasAway',v?'awayParticipantId',
  'participants',to_jsonb(array(select distinct id from unnest(array[b."homeParticipantId",b."awayParticipantId"]||
   nothingsports_fixture_read_private.top_match_keys(b."participantIds")||nothingsports_fixture_read_private.top_match_keys(jsonb_path_query_array(b.participants,'$[*].id'))||
   nothingsports_fixture_read_private.top_match_keys(jsonb_path_query_array(b."participantSlots",'$[*].participantId'))||
   nothingsports_fixture_read_private.top_match_keys(jsonb_path_query_array(b."matchupSides",'$[*].players[*].id'))) id where id is not null order by id)))
 from jsonb_to_record(v) as b(key text,"startTimeUtc" text,"homeParticipantId" text,"awayParticipantId" text,"participantIds" jsonb,participants jsonb,"participantSlots" jsonb,"matchupSides" jsonb);
$$;
create function nothingsports_fixture_read_private.context_fields(fixture jsonb,score jsonb)
returns table(base_key text,score_key text,has_score_key boolean,participant_ids text[],sides text,base_selection jsonb,score_selection jsonb)
language sql immutable security invoker set search_path='' as $$
 with descriptors as materialized(select nothingsports_fixture_read_private.selection_fields(fixture) b,nothingsports_fixture_read_private.selection_fields(score) t)
 select b->>'key',t->>'key',(t->>'hasKey')::boolean,
  array(select distinct id from jsonb_array_elements_text(b->'participants'||(t->'participants')) id order by id),
  case when nullif(f.starts_at,'') is not null and nullif(f.home_id,'') is not null and nullif(f.away_id,'') is not null and f.home_id<>f.away_id
   then least(f.home_id,f.away_id)||'|'||greatest(f.home_id,f.away_id) end,b,t
 from descriptors d
 cross join lateral(select case when (t->>'hasStart')::boolean then t->>'starts' else b->>'starts' end starts_at,
  case when (t->>'hasHome')::boolean then t->>'home' else b->>'home' end home_id,
  case when (t->>'hasAway')::boolean then t->>'away' else b->>'away' end away_id) f;
$$;

create table nothingsports_fixture_read_private.fixture_context(
 source_id text not null,fixture_id text not null,identity_keys text[] not null,base_key text,score_key text,has_score_key boolean,
 participant_ids text[] not null,sides text,base_selection jsonb not null,score_selection jsonb not null,shape_version smallint not null default 1,
 primary key(source_id,fixture_id),foreign key(source_id,fixture_id) references public.nothingsports_fixture_current(source_id,fixture_id) on delete cascade
);
create index fixture_context_identity_idx on nothingsports_fixture_read_private.fixture_context using gin(identity_keys);
create table nothingsports_fixture_read_private.fixture_tokens(
 source_id text not null,fixture_id text not null,kind smallint not null check(kind in(1,2)),token text not null,
 primary key(source_id,fixture_id,kind,token),foreign key(source_id,fixture_id) references nothingsports_fixture_read_private.fixture_context(source_id,fixture_id) on delete cascade
);
create index fixture_token_idx on nothingsports_fixture_read_private.fixture_tokens(kind,token,source_id,fixture_id);
create table nothingsports_fixture_read_private.source_tokens(
 source_id text not null references public.nothingsports_fixture_sources(source_id) on delete cascade,kind smallint not null check(kind in(1,2)),token text not null,
 primary key(source_id,kind,token)
);
create index source_token_idx on nothingsports_fixture_read_private.source_tokens(kind,token,source_id);
alter table nothingsports_fixture_read_private.fixture_context enable row level security;
alter table nothingsports_fixture_read_private.fixture_tokens enable row level security;
alter table nothingsports_fixture_read_private.source_tokens enable row level security;
revoke all on nothingsports_fixture_read_private.fixture_context,nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens from public,anon,authenticated;
grant select,insert,update,delete on nothingsports_fixture_read_private.fixture_context to service_role;
grant select,insert,delete on nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens to service_role;

create function nothingsports_fixture_read_private.sync_fixture(p_source_id text,p_fixture_id text) returns void
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
  delete from nothingsports_fixture_read_private.fixture_tokens where source_id=p_source_id and fixture_id=p_fixture_id;
  insert into nothingsports_fixture_read_private.fixture_tokens
  select distinct p_source_id,p_fixture_id,1::smallint,id from unnest(identities) id where id is not null
  union all select source_id,fixture_id,2::smallint,sides from nothingsports_fixture_read_private.fixture_context where source_id=p_source_id and fixture_id=p_fixture_id and sides is not null;
 end if;
end;
$$;
create function nothingsports_fixture_read_private.sync_trigger() returns trigger language plpgsql security invoker set search_path='' as $$
declare cached nothingsports_fixture_read_private.fixture_context;current_selection jsonb;
begin
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
$$;
revoke all on function nothingsports_fixture_read_private.top_match_keys(jsonb),nothingsports_fixture_read_private.selection_fields(jsonb),nothingsports_fixture_read_private.context_fields(jsonb,jsonb),nothingsports_fixture_read_private.sync_fixture(text,text),nothingsports_fixture_read_private.sync_trigger() from public,anon,authenticated;
grant execute on function nothingsports_fixture_read_private.top_match_keys(jsonb),nothingsports_fixture_read_private.selection_fields(jsonb),nothingsports_fixture_read_private.context_fields(jsonb,jsonb),nothingsports_fixture_read_private.sync_fixture(text,text),nothingsports_fixture_read_private.sync_trigger() to service_role;
create function nothingsports_fixture_read_private.token_membership_trigger() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform 1 from public.nothingsports_fixture_sources where source_id=new.source_id for update;
  insert into nothingsports_fixture_read_private.source_tokens values(new.source_id,new.kind,new.token) on conflict do nothing;return new;
 end if;
 perform 1 from public.nothingsports_fixture_sources where source_id=old.source_id for update;
 delete from nothingsports_fixture_read_private.source_tokens t where t.source_id=old.source_id and t.kind=old.kind and t.token=old.token and not exists(
  select 1 from nothingsports_fixture_read_private.fixture_tokens f where f.source_id=t.source_id and f.kind=t.kind and f.token=t.token);
 return old;
end;
$$;
revoke all on function nothingsports_fixture_read_private.token_membership_trigger() from public,anon,authenticated;
grant execute on function nothingsports_fixture_read_private.token_membership_trigger() to service_role;
create trigger fixture_token_membership_after_change after insert or delete on nothingsports_fixture_read_private.fixture_tokens for each row execute function nothingsports_fixture_read_private.token_membership_trigger();
create trigger fixture_read_context_after_current after insert or update or delete on public.nothingsports_fixture_current for each row execute function nothingsports_fixture_read_private.sync_trigger();
create trigger fixture_read_context_after_score after insert or update or delete on public.nothingsports_live_scores for each row execute function nothingsports_fixture_read_private.sync_trigger();
analyze nothingsports_fixture_read_private.fixture_context;
analyze nothingsports_fixture_read_private.fixture_tokens;
analyze nothingsports_fixture_read_private.source_tokens;

-- One-time migration preparation only: no facts, receipts or customer records change.
-- Lock one canonical source before reading its current rows, as the publisher does.
create function nothingsports_fixture_read_private.backfill_batch(p_limit integer default 128) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare selected_source text;processed integer:=0;remaining bigint;
begin
 if p_limit is null or p_limit<1 or p_limit>128 then raise exception 'Backfill batch must be between 1 and 128';end if;
 select c.source_id into selected_source from public.nothingsports_fixture_current c
 left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
 where ctx.fixture_id is null order by c.source_id,c.fixture_id limit 1;
 if selected_source is not null then
  perform 1 from public.nothingsports_fixture_sources where source_id=selected_source for update;
  with pending as materialized (
   select c.source_id,c.fixture_id,c.identity_keys,c.fixture,s.score from public.nothingsports_fixture_current c
   left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
   left join public.nothingsports_live_scores s using(source_id,fixture_id)
   where c.source_id=selected_source and ctx.fixture_id is null order by c.fixture_id limit p_limit
  ), added as (
   insert into nothingsports_fixture_read_private.fixture_context(source_id,fixture_id,identity_keys,base_key,score_key,has_score_key,participant_ids,sides,base_selection,score_selection)
   select p.source_id,p.fixture_id,p.identity_keys,f.* from pending p
   cross join lateral nothingsports_fixture_read_private.context_fields(p.fixture,p.score) f
   returning source_id,fixture_id,identity_keys,sides
  ), tokens as (
   insert into nothingsports_fixture_read_private.fixture_tokens
   select distinct source_id,fixture_id,1::smallint,id from added cross join lateral unnest(identity_keys) id where id is not null
   union all select source_id,fixture_id,2::smallint,sides from added where sides is not null
   returning 1
  ) select count(*) into processed from added;
 end if;
 select count(*) into remaining from public.nothingsports_fixture_current c
 left join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id) where ctx.fixture_id is null;
 return jsonb_build_object('processed',processed,'remaining',remaining,'complete',remaining=0);
end;
$$;
revoke all on function nothingsports_fixture_read_private.backfill_batch(integer) from public,anon,authenticated;
grant execute on function nothingsports_fixture_read_private.backfill_batch(integer) to service_role;
