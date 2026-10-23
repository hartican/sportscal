-- Exact view-only recovery. No mutable capacity/pending/source-fact guard.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from 'e453630735051c7a199b717289e17218' then
  raise exception 'Generation global view differs from reviewed rollback baseline';
 end if;

 if not exists(select 1 from pg_class c where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass
    and c.relkind='v' and pg_get_userbyid(c.relowner)='postgres' and c.reloptions=array['security_invoker=true'])
 or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.oid='public.nothingsports_current_global_fixture_bundle'::regclass and a.grantee<>c.relowner
      and not(a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='SELECT' and not a.is_grantable))
 or not has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','SELECT')
 or (select count(*) from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attnum>0 and not attisdropped)<>1
 or not exists(select 1 from pg_attribute where attrelid='public.nothingsports_current_global_fixture_bundle'::regclass and attname='bundle' and atttypid='json'::regtype and attacl is null and not attisdropped) then
  raise exception 'Global component view contract or permissions differ from service-only baseline';
 end if;
end $guard$;

do $storage$begin
 if not exists(select 1 from pg_attribute where attrelid='nothingsports_fixture_read_private.global_read_generations'::regclass
  and attname='payload'and atttypid='json'::regtype and attstorage='x'and attcompression='l'and not attisdropped)then
  raise exception 'Generation payload storage differs from rollback preimage';
 end if;
end $storage$;
do $helpers$begin
 if md5(pg_get_functiondef('nothingsports_build_global_generation(integer)'::regprocedure))is distinct from '769f0499ac6f53002c1cfb675964b849'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.global_generation_policy()'::regprocedure))is distinct from '9b439b7d99dfce367629db2d3b8c5ba2'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.global_generation_witness(json,jsonb,date,text,text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,smallint)'::regprocedure))is distinct from 'f45ebe22e2302d5b9c2b0925ff2903b6'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.global_read_clock_transition(text)'::regprocedure))is distinct from '088402cb9bb52556dc4c869d50b0ca58'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.global_read_epoch_changed()'::regprocedure))is distinct from 'fd9f65c43bda452ede089f21a8cfbad7'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.global_read_vector()'::regprocedure))is distinct from 'dfdb854ef4f17edb8e632aeefa27a1ff'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.guard_global_generation_write()'::regprocedure))is distinct from 'fd95a81a7e4786fd345b1ff23948deaf'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.read_global_generation()'::regprocedure))is distinct from '225a7f9a17662425031701aefaed2f8c'then raise exception 'Generation helper differs from rollback preimage';end if;
 if md5(pg_get_functiondef('nothingsports_fixture_read_private.touch_global_read_epoch(text,boolean)'::regprocedure))is distinct from '60123e5f9dc941ac6460ecc65e38bd65'then raise exception 'Generation helper differs from rollback preimage';end if;
end $helpers$;
create or replace view public.nothingsports_current_global_fixture_bundle with(security_invoker=true) as
 SELECT value AS bundle
   FROM ( WITH calendar_windows AS MATERIALIZED (
                 SELECT ctx.source_id,
                    ctx.fixture_id,
                    ctx.base_selection -> 'calendarWindow'::text AS base_window,
                    ctx.score_selection -> 'calendarWindow'::text AS score_window
                   FROM nothingsports_fixture_read_private.fixture_context ctx
                  WHERE ctx.shape_version = 1 AND NOT (EXISTS ( SELECT 1
                           FROM nothingsports_fixture_read_private.integrity_pending))
                ), active_window AS (
                 SELECT (statement_timestamp() AT TIME ZONE 'Australia/Sydney'::text)::date AS today
                ), scope_keys AS (
                 SELECT c.source_id,
                    c.fixture_id
                   FROM nothingsports_fixture_current c
                     JOIN nothingsports_fixture_sources src USING (source_id)
                     LEFT JOIN nothingsports_live_scores s USING (source_id, fixture_id)
                     LEFT JOIN calendar_windows ctx ON ctx.source_id = c.source_id AND ctx.fixture_id = c.fixture_id AND jsonb_typeof(ctx.base_window) = 'object'::text AND jsonb_typeof(ctx.score_window) = 'object'::text AND ctx.base_window ?& ARRAY['hasStatus'::text, 'status'::text, 'hasEndDate'::text, 'endDate'::text, 'hasDate'::text, 'date'::text, 'hasStartDate'::text, 'startDate'::text, 'hasSchedulingWindow'::text, 'schedulingWindow'::text] AND (jsonb_typeof(ctx.base_window -> 'hasStatus'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasEndDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasStartDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasSchedulingWindow'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'status'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'endDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'date'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'startDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND ctx.score_window ?& ARRAY['hasStatus'::text, 'status'::text, 'hasEndDate'::text, 'endDate'::text, 'hasDate'::text, 'date'::text, 'hasStartDate'::text, 'startDate'::text, 'hasSchedulingWindow'::text, 'schedulingWindow'::text] AND (jsonb_typeof(ctx.score_window -> 'hasStatus'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasEndDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasStartDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasSchedulingWindow'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'status'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'endDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'date'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'startDate'::text) = ANY (ARRAY['string'::text, 'null'::text]))
                     CROSS JOIN active_window w
                     CROSS JOIN LATERAL ( SELECT
                                CASE
                                    WHEN ctx.source_id IS NOT NULL THEN
                                    CASE
WHEN (ctx.score_window ->> 'hasStatus'::text)::boolean THEN ctx.score_window ->> 'status'::text
ELSE ctx.base_window ->> 'status'::text
                                    END
                                    ELSE
                                    CASE
WHEN s.score ? 'status'::text THEN s.score ->> 'status'::text
ELSE c.global_fixture ->> 'status'::text
                                    END
                                END AS status,
                                CASE
                                    WHEN ctx.source_id IS NOT NULL THEN
                                    CASE
WHEN (ctx.score_window ->> 'hasEndDate'::text)::boolean THEN ctx.score_window ->> 'endDate'::text
ELSE ctx.base_window ->> 'endDate'::text
                                    END
                                    ELSE
                                    CASE
WHEN s.score ? 'endDate'::text THEN s.score ->> 'endDate'::text
ELSE c.global_fixture ->> 'endDate'::text
                                    END
                                END AS end_date,
                                CASE
                                    WHEN ctx.source_id IS NOT NULL THEN
                                    CASE
WHEN (ctx.score_window ->> 'hasDate'::text)::boolean THEN ctx.score_window ->> 'date'::text
ELSE ctx.base_window ->> 'date'::text
                                    END
                                    ELSE
                                    CASE
WHEN s.score ? 'date'::text THEN s.score ->> 'date'::text
ELSE c.global_fixture ->> 'date'::text
                                    END
                                END AS date,
                                CASE
                                    WHEN ctx.source_id IS NOT NULL THEN
                                    CASE
WHEN (ctx.score_window ->> 'hasStartDate'::text)::boolean THEN ctx.score_window ->> 'startDate'::text
ELSE ctx.base_window ->> 'startDate'::text
                                    END
                                    ELSE
                                    CASE
WHEN s.score ? 'startDate'::text THEN s.score ->> 'startDate'::text
ELSE c.global_fixture ->> 'startDate'::text
                                    END
                                END AS start_date,
                                CASE
                                    WHEN ctx.source_id IS NOT NULL THEN
                                    CASE
WHEN (ctx.score_window ->> 'hasSchedulingWindow'::text)::boolean THEN ctx.score_window -> 'schedulingWindow'::text
ELSE ctx.base_window -> 'schedulingWindow'::text
                                    END
                                    ELSE
                                    CASE
WHEN s.score ? 'schedulingWindow'::text THEN s.score -> 'schedulingWindow'::text
ELSE c.global_fixture -> 'schedulingWindow'::text
                                    END
                                END AS scheduling_window) f
                     CROSS JOIN LATERAL ( SELECT COALESCE(NULLIF(f.end_date, ''::text), NULLIF(f.date, ''::text), NULLIF(f.start_date, ''::text), f.scheduling_window ->> 'endsOn'::text, ''::text) AS ends_on,
                            COALESCE(NULLIF(f.date, ''::text), NULLIF(f.start_date, ''::text), f.scheduling_window ->> 'startsOn'::text, ''::text) AS starts_on) dates
                  WHERE NULL::text[] IS NULL AND (f.status = 'live'::text OR (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text OR dates.ends_on >= ((w.today - 7)::text)) AND (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text OR dates.starts_on <= (w.today + '1 year'::interval)::date::text))
                UNION ALL
                 SELECT c.source_id,
                    c.fixture_id
                   FROM nothingsports_fixture_current c
                     JOIN nothingsports_fixture_sources src USING (source_id)
                  WHERE NULL::text[] IS NOT NULL AND c.identity_keys && NULL::text[]
                ), candidates AS MATERIALIZED (
                 SELECT scope_keys.source_id,
                    scope_keys.fixture_id
                   FROM scope_keys
                  ORDER BY scope_keys.source_id, scope_keys.fixture_id
                 LIMIT 5001
                ), source_receipts AS MATERIALIZED (
                 SELECT src.source_id,
                    src.discovery_report -> '_fixtureObservations'::text AS receipts
                   FROM nothingsports_fixture_sources src
                  WHERE (EXISTS ( SELECT 1
                           FROM candidates k
                          WHERE k.source_id = src.source_id))
                ), clock_inputs AS MATERIALIZED (
                 SELECT k.source_id,
                    k.fixture_id,
                    ARRAY[s.score ->> 'scoreCheckedAt'::text, c.global_fixture ->> 'scoreCheckedAt'::text, s.score ->> 'statusCheckedAt'::text, c.global_fixture ->> 'statusCheckedAt'::text, (r.receipts -> c.fixture_id) ->> 's'::text, (r.receipts -> c.fixture_id) ->> 't'::text] AS raw
                   FROM candidates k
                     JOIN nothingsports_fixture_current c USING (source_id, fixture_id)
                     LEFT JOIN nothingsports_live_scores s USING (source_id, fixture_id)
                     JOIN source_receipts r USING (source_id)
                ), parsed_clocks AS MATERIALIZED (
                 SELECT distinct_values.value,
                    nothingsports_fixture_observation_time(distinct_values.value) AS stamp
                   FROM ( SELECT DISTINCT unnest(clock_inputs.raw) AS value
                           FROM clock_inputs) distinct_values
                  WHERE distinct_values.value IS NOT NULL
                ), patches AS MATERIALIZED (
                 SELECT i.source_id,
                    i.fixture_id,
                    jsonb_build_object('fixtureObservationSchema', 'fixture-observations.v1', 'scoreFactObservedAt', COALESCE(score_fact.stamp, base_score_fact.stamp), 'statusFactObservedAt', COALESCE(status_fact.stamp, base_status_fact.stamp), 'scoreCheckedAt', COALESCE(score_receipt.stamp, score_fact.stamp, base_score_fact.stamp), 'statusCheckedAt', COALESCE(status_receipt.stamp, status_fact.stamp, base_status_fact.stamp)) AS patch
                   FROM clock_inputs i
                     LEFT JOIN parsed_clocks score_fact ON score_fact.value = i.raw[1]
                     LEFT JOIN parsed_clocks base_score_fact ON base_score_fact.value = i.raw[2]
                     LEFT JOIN parsed_clocks status_fact ON status_fact.value = i.raw[3]
                     LEFT JOIN parsed_clocks base_status_fact ON base_status_fact.value = i.raw[4]
                     LEFT JOIN parsed_clocks score_receipt ON score_receipt.value = i.raw[5]
                     LEFT JOIN parsed_clocks status_receipt ON status_receipt.value = i.raw[6]
                ), projected AS NOT MATERIALIZED (
                 SELECT c.source_id,
                    c.fixture_id,
                    c.identity_keys,
                        CASE
                            WHEN jsonb_typeof(cleaned.base) = 'object'::text AND (s.score IS NULL OR jsonb_typeof(s.score) = 'object'::text) THEN cleaned.base || ((COALESCE(s.score, '{}'::jsonb) || p.patch) ||
                            CASE
                                WHEN s.first_completed_at IS NULL THEN '{}'::jsonb
                                ELSE jsonb_build_object('firstConfirmedCompleteAt', s.first_completed_at)
                            END)
                            ELSE ((cleaned.base || COALESCE(s.score, '{}'::jsonb)) || p.patch) ||
                            CASE
                                WHEN s.first_completed_at IS NULL THEN '{}'::jsonb
                                ELSE jsonb_build_object('firstConfirmedCompleteAt', s.first_completed_at)
                            END
                        END AS fixture
                   FROM candidates k
                     JOIN nothingsports_fixture_current c USING (source_id, fixture_id)
                     LEFT JOIN nothingsports_live_scores s USING (source_id, fixture_id)
                     JOIN patches p USING (source_id, fixture_id)
                     CROSS JOIN LATERAL ( SELECT
                                CASE
                                    WHEN NULL::text[] IS NOT NULL THEN c.fixture
                                    ELSE c.global_fixture
                                END AS base
                         OFFSET 0) cleaned
                )
         SELECT json_build_object('schemaVersion', 'current-fixture-bundle.v1', 'complete', count(*) <= 5000, 'rows', COALESCE(json_agg(row_to_json(projected.*) ORDER BY projected.source_id, projected.fixture_id), '[]'::json)) AS json_build_object
           FROM projected) global_query(value);
do $restored$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from 'fbc28299a5bf25428b286adc5ee2e0da' then
  raise exception 'Original global view was not exactly restored';
 end if;
end $restored$;

do $remove_hooks$declare relation text;begin
 foreach relation in array array['public.nothingsports_fixture_sources','public.nothingsports_fixture_current','public.nothingsports_live_scores','nothingsports_fixture_read_private.fixture_context','nothingsports_fixture_read_private.integrity_pending']loop
  execute format('drop trigger global_read_epoch_after_change on %s',relation);
  execute format('drop trigger global_read_epoch_after_truncate on %s',relation);
 end loop;
end $remove_hooks$;
drop trigger global_generation_install_only on nothingsports_fixture_read_private.global_read_generations;
drop trigger global_generation_no_truncate on nothingsports_fixture_read_private.global_read_generations;
drop function public.nothingsports_build_global_generation(integer);
drop function nothingsports_fixture_read_private.read_global_generation();
drop function nothingsports_fixture_read_private.global_generation_policy();
drop function nothingsports_fixture_read_private.guard_global_generation_write();
drop function nothingsports_fixture_read_private.global_generation_witness(json,jsonb,date,text,text,text,text,timestamptz,timestamptz,timestamptz,uuid,smallint);
drop function nothingsports_fixture_read_private.global_read_clock_transition(text);
drop function nothingsports_fixture_read_private.global_read_vector();
drop function nothingsports_fixture_read_private.global_read_epoch_changed();
drop function nothingsports_fixture_read_private.touch_global_read_epoch(text,boolean);
drop view nothingsports_fixture_read_private.global_read_original;
drop table nothingsports_fixture_read_private.global_read_generations;
drop table nothingsports_fixture_read_private.global_read_epochs;
