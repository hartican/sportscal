create function public.nothingsports_build_global_generation(p_budget_ms integer default 6000)returns jsonb
language plpgsql volatile security invoker set search_path='' set statement_timeout='6s' set lock_timeout='1s'as $fn$
declare payload json;tokens jsonb;day date;until_at timestamptz;began timestamptz:=clock_timestamp();
 current_policy text;reference_clock timestamptz:=statement_timestamp();parser text;tz text:=current_setting('TimeZone');ds text:=current_setting('DateStyle');next_slot smallint;installed integer;gid uuid:=gen_random_uuid();
begin
 if p_budget_ms is null or p_budget_ms<1 or p_budget_ms>6000 then raise exception 'Invalid global generation budget';end if;
 if current_setting('nothingsports.global_read_mutation_xid',true)=txid_current()::text or exists(select 1 from nothingsports_fixture_read_private.global_read_epochs where last_xid=txid_current())then return jsonb_build_object('state','deferred','reason','source_transaction');end if;
 current_policy:=nothingsports_fixture_read_private.global_generation_policy();
 parser:=md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure));
 if current_policy is null or parser<>'13842433b7af056a35c01e8b234ae3c9'or exists(select 1 from nothingsports_fixture_read_private.integrity_pending)then return jsonb_build_object('state','deferred','reason','parser_or_pending');end if;
 if nothingsports_fixture_read_private.read_global_generation()is not null then return jsonb_build_object('state','unchanged');end if;
 -- ONE coherent statement snapshot for payload, full epoch vector and expiry.
 with built as materialized(select bundle from nothingsports_fixture_read_private.global_read_original),
 bound_keys as materialized(
  select r->>'source_id' source_id,r->>'fixture_id' fixture_id
  from built b cross join lateral json_array_elements(b.bundle->'rows')r
 ),
 source_receipts as materialized(
  select src.source_id,src.discovery_report->'_fixtureObservations' receipts
  from public.nothingsports_fixture_sources src
  where exists(select 1 from bound_keys k where k.source_id=src.source_id)
 ),
 raw_values as materialized(
  select unnest(array[s.score->>'scoreCheckedAt',c.global_fixture->>'scoreCheckedAt',s.score->>'statusCheckedAt',c.global_fixture->>'statusCheckedAt',
    (r.receipts->c.fixture_id)->>'s',(r.receipts->c.fixture_id)->>'t'])value
  from bound_keys k
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join source_receipts r using(source_id)
  left join public.nothingsports_live_scores s using(source_id,fixture_id)
 )
 select b.bundle,nothingsports_fixture_read_private.global_read_vector(),(statement_timestamp()at time zone 'Australia/Sydney')::date,
 least((((statement_timestamp()at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney'),
  (select min(nothingsports_fixture_read_private.global_read_clock_transition(value))from(select distinct value from raw_values)d))
 into payload,tokens,day,until_at from built b;
 if tokens is null or payload->>'schemaVersion'<>'current-fixture-bundle.v1'or(payload->>'complete')::boolean is not true then return jsonb_build_object('state','deferred','reason','incomplete');end if;
 if octet_length(payload::text)>16777216 then return jsonb_build_object('state','deferred','reason','payload_cap');end if;
 if clock_timestamp()>=began+p_budget_ms*interval '1 millisecond'then return jsonb_build_object('state','deferred','reason','budget');end if;
 -- A fresh SPI statement snapshot checks tokens after construction. No epoch
 -- lock during the build. A later racing commit is caught by EVERY read fence.
 select coalesce(1-slot,0)into next_slot from nothingsports_fixture_read_private.global_read_generations order by installed_at desc,generation_id desc limit 1;
 next_slot:=coalesce(next_slot,0);
 perform set_config('nothingsports.generation_install',txid_current()::text||':'||gid::text,true);
 insert into nothingsports_fixture_read_private.global_read_generations(slot,generation_id,payload,source_vector,sydney_day,policy,parser_md5,session_timezone,session_datestyle,reference_clock,valid_until,installed_at)
 select next_slot,gid,payload,tokens,day,current_policy,parser,tz,ds,reference_clock,until_at,clock_timestamp()
 where current_policy=nothingsports_fixture_read_private.global_generation_policy()and tokens=nothingsports_fixture_read_private.global_read_vector()and day=(clock_timestamp()at time zone 'Australia/Sydney')::date
 and clock_timestamp()<until_at and clock_timestamp()<began+p_budget_ms*interval '1 millisecond'
 and parser=md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure))
 and not exists(select 1 from nothingsports_fixture_read_private.integrity_pending)
 on conflict(slot)do update set generation_id=excluded.generation_id,payload=excluded.payload,source_vector=excluded.source_vector,sydney_day=excluded.sydney_day,policy=excluded.policy,parser_md5=excluded.parser_md5,session_timezone=excluded.session_timezone,session_datestyle=excluded.session_datestyle,reference_clock=excluded.reference_clock,valid_until=excluded.valid_until,installed_at=excluded.installed_at,witness=excluded.witness
 where excluded.installed_at>global_read_generations.installed_at;
 get diagnostics installed=row_count;
 perform set_config('nothingsports.generation_install','',true);
 if installed=1 and(clock_timestamp()>=until_at or clock_timestamp()>=began+p_budget_ms*interval '1 millisecond' or tokens is distinct from nothingsports_fixture_read_private.global_read_vector()or current_policy is distinct from nothingsports_fixture_read_private.global_generation_policy())then return jsonb_build_object('state','deferred','reason','invalidated_after_install');end if;
 return jsonb_build_object('state',case when installed=1 then 'installed'else'deferred'end,'reason',case when installed=0 then 'fence_changed'else null end,'generationId',case when installed=1 then gid else null end,'payloadBytes',octet_length(payload::text));
end $fn$;