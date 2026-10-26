BEGIN;
SET LOCAL search_path=public;
-- Explicit server-only transport opt-in; the default expression remains original.
-- No fact, admission, clock parser, stored column, writer or permission change.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from 'd3d5341fcf5dc901c3e1240145b3acd7' then
  raise exception 'Original global view differs from reviewed baseline';
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

 if md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54' then
  raise exception 'Original observation helpers differ from reviewed baseline';
 end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid in('public.nothingsports_fixture_observation_time(text)'::regprocedure,
                  'public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)
      and (pg_get_userbyid(p.proowner)<>'postgres' or (a.grantee<>p.proowner and not(
        a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='EXECUTE' and not a.is_grantable))))
 or not has_function_privilege('service_role','public.nothingsports_fixture_observation_time(text)','EXECUTE')
 or not has_function_privilege('service_role','public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)','EXECUTE') then
  raise exception 'Observation helper permissions differ from service-only baseline';
 end if;
 if not exists(select 1 from pg_class where oid='public.nothingsports_fixture_current'::regclass and relrowsecurity and relforcerowsecurity)
 or has_table_privilege('anon','public.nothingsports_fixture_current','SELECT')
 or has_table_privilege('authenticated','public.nothingsports_fixture_current','SELECT')
 or not has_table_privilege('service_role','public.nothingsports_fixture_current','SELECT') then
  raise exception 'Current fixture permissions differ from private baseline';
 end if;
 if not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture' and a.attgenerated='s'
      and a.atttypid='jsonb'::regtype and a.attacl is null and not a.attisdropped
      and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365') then
  raise exception 'Original compact projection differs from reviewed baseline';
 end if;
end $guard$;

DO $admission_guard$ BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_collation c ON c.oid=a.attcollation
 WHERE a.attrelid='public.nothingsports_fixture_current'::regclass AND a.attname IN('source_id','fixture_id')
 AND a.atttypid='text'::regtype AND a.attnotnull AND NOT a.attisdropped AND c.collisdeterministic)<>2
 THEN RAISE EXCEPTION 'Admission requires nonnull text keys with deterministic ordering';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
 WHERE c.conrelid='public.nothingsports_fixture_current'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable
 AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indpred IS NULL AND i.indexprs IS NULL
 AND c.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='source_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='fixture_id')]::smallint[])
 THEN RAISE EXCEPTION 'Admission unique lookup contract differs: public.nothingsports_fixture_current';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
 WHERE c.conrelid='public.nothingsports_fixture_sources'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable
 AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indpred IS NULL AND i.indexprs IS NULL
 AND c.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='source_id')]::smallint[])
 THEN RAISE EXCEPTION 'Admission unique lookup contract differs: public.nothingsports_fixture_sources';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
 WHERE c.conrelid='public.nothingsports_live_scores'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable
 AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indpred IS NULL AND i.indexprs IS NULL
 AND c.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='source_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='fixture_id')]::smallint[])
 THEN RAISE EXCEPTION 'Admission unique lookup contract differs: public.nothingsports_live_scores';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
 WHERE c.conrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable
 AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indpred IS NULL AND i.indexprs IS NULL
 AND c.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='source_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='fixture_id')]::smallint[])
 THEN RAISE EXCEPTION 'Admission unique lookup contract differs: nothingsports_fixture_read_private.fixture_context';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.nothingsports_fixture_observation_time(text)'::regprocedure AND p.provolatile='s' AND NOT p.prosecdef)
 THEN RAISE EXCEPTION 'Admission clock stability differs';END IF;
 END $admission_guard$;
CREATE OR REPLACE VIEW public.nothingsports_current_global_fixture_bundle WITH(security_invoker=true)AS
SELECT CASE WHEN current_user='service_role' AND(CASE WHEN coalesce(nullif(current_setting('request.headers',true),''),'{}') IS JSON OBJECT
 THEN nullif(current_setting('request.headers',true),'')::jsonb->>'x-ns-fixture-source-groups'='v1' ELSE false END)
 THEN(WITH calendar_windows AS MATERIALIZED (
                 SELECT ctx.source_id,
                    ctx.fixture_id,
                    ctx.base_selection -> 'calendarWindow'::text AS base_window,
                    ctx.score_selection -> 'calendarWindow'::text AS score_window
                   FROM nothingsports_fixture_read_private.fixture_context ctx
                  WHERE ctx.shape_version = 1 AND NOT (EXISTS ( SELECT 1
                           FROM nothingsports_fixture_read_private.integrity_pending))
                ), active_window AS (
                 SELECT (statement_timestamp() AT TIME ZONE 'Australia/Sydney'::text)::date AS today
                ), current_keys AS MATERIALIZED(SELECT c.source_id,c.fixture_id
 FROM public.nothingsports_fixture_current c JOIN public.nothingsports_fixture_sources src USING(source_id)),
 valid_calendar_windows AS NOT MATERIALIZED(SELECT ctx.* FROM calendar_windows ctx WHERE jsonb_typeof(ctx.base_window) = 'object'::text AND jsonb_typeof(ctx.score_window) = 'object'::text AND ctx.base_window ?& ARRAY['hasStatus'::text, 'status'::text, 'hasEndDate'::text, 'endDate'::text, 'hasDate'::text, 'date'::text, 'hasStartDate'::text, 'startDate'::text, 'hasSchedulingWindow'::text, 'schedulingWindow'::text] AND (jsonb_typeof(ctx.base_window -> 'hasStatus'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasEndDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasStartDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'hasSchedulingWindow'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'status'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'endDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'date'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.base_window -> 'startDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND ctx.score_window ?& ARRAY['hasStatus'::text, 'status'::text, 'hasEndDate'::text, 'endDate'::text, 'hasDate'::text, 'date'::text, 'hasStartDate'::text, 'startDate'::text, 'hasSchedulingWindow'::text, 'schedulingWindow'::text] AND (jsonb_typeof(ctx.score_window -> 'hasStatus'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasEndDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasStartDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'hasSchedulingWindow'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'status'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'endDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'date'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(ctx.score_window -> 'startDate'::text) = ANY (ARRAY['string'::text, 'null'::text]))),
 raw_fallback_keys AS MATERIALIZED(SELECT c.source_id,c.fixture_id
 FROM current_keys c
 WHERE NOT EXISTS(SELECT 1 FROM valid_calendar_windows ctx WHERE ctx.source_id=c.source_id AND ctx.fixture_id=c.fixture_id)),
 scope_keys AS (
                 SELECT c.source_id,
                    c.fixture_id
                   FROM current_keys c
                     JOIN valid_calendar_windows ctx ON ctx.source_id=c.source_id AND ctx.fixture_id=c.fixture_id
                     CROSS JOIN active_window w
                     CROSS JOIN LATERAL ( SELECT
                                CASE
WHEN (ctx.score_window ->> 'hasStatus'::text)::boolean THEN ctx.score_window ->> 'status'::text
ELSE ctx.base_window ->> 'status'::text
                                    END AS status,
                                CASE
WHEN (ctx.score_window ->> 'hasEndDate'::text)::boolean THEN ctx.score_window ->> 'endDate'::text
ELSE ctx.base_window ->> 'endDate'::text
                                    END AS end_date,
                                CASE
WHEN (ctx.score_window ->> 'hasDate'::text)::boolean THEN ctx.score_window ->> 'date'::text
ELSE ctx.base_window ->> 'date'::text
                                    END AS date,
                                CASE
WHEN (ctx.score_window ->> 'hasStartDate'::text)::boolean THEN ctx.score_window ->> 'startDate'::text
ELSE ctx.base_window ->> 'startDate'::text
                                    END AS start_date,
                                CASE
WHEN (ctx.score_window ->> 'hasSchedulingWindow'::text)::boolean THEN ctx.score_window -> 'schedulingWindow'::text
ELSE ctx.base_window -> 'schedulingWindow'::text
                                    END AS scheduling_window) f
                     CROSS JOIN LATERAL ( SELECT COALESCE(NULLIF(f.end_date, ''::text), NULLIF(f.date, ''::text), NULLIF(f.start_date, ''::text), f.scheduling_window ->> 'endsOn'::text, ''::text) AS ends_on,
                            COALESCE(NULLIF(f.date, ''::text), NULLIF(f.start_date, ''::text), f.scheduling_window ->> 'startsOn'::text, ''::text) AS starts_on) dates
                  WHERE NULL::text[] IS NULL AND (f.status = 'live'::text OR (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text OR dates.ends_on >= ((w.today - 7)::text)) AND (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text OR dates.starts_on <= (w.today + '1 year'::interval)::date::text))
                UNION ALL
                 SELECT c.source_id,
                    c.fixture_id
                   FROM public.nothingsports_fixture_current c
                     JOIN public.nothingsports_fixture_sources src USING (source_id)
                  WHERE NULL::text[] IS NOT NULL AND c.identity_keys && NULL::text[]
                
 UNION ALL
 SELECT c.source_id,c.fixture_id FROM raw_fallback_keys c
 CROSS JOIN LATERAL(SELECT base.global_fixture,s.score
 FROM public.nothingsports_fixture_current base LEFT JOIN public.nothingsports_live_scores s USING(source_id,fixture_id)
 WHERE base.source_id=c.source_id AND base.fixture_id=c.fixture_id OFFSET 0)raw
 CROSS JOIN active_window w
                     CROSS JOIN LATERAL ( SELECT
                                CASE
WHEN raw.score ? 'status'::text THEN raw.score ->> 'status'::text
ELSE raw.global_fixture ->> 'status'::text
                                    END AS status,
                                CASE
WHEN raw.score ? 'endDate'::text THEN raw.score ->> 'endDate'::text
ELSE raw.global_fixture ->> 'endDate'::text
                                    END AS end_date,
                                CASE
WHEN raw.score ? 'date'::text THEN raw.score ->> 'date'::text
ELSE raw.global_fixture ->> 'date'::text
                                    END AS date,
                                CASE
WHEN raw.score ? 'startDate'::text THEN raw.score ->> 'startDate'::text
ELSE raw.global_fixture ->> 'startDate'::text
                                    END AS start_date,
                                CASE
WHEN raw.score ? 'schedulingWindow'::text THEN raw.score -> 'schedulingWindow'::text
ELSE raw.global_fixture -> 'schedulingWindow'::text
                                    END AS scheduling_window) f
                     CROSS JOIN LATERAL ( SELECT COALESCE(NULLIF(f.end_date, ''::text), NULLIF(f.date, ''::text), NULLIF(f.start_date, ''::text), f.scheduling_window ->> 'endsOn'::text, ''::text) AS ends_on,
                            COALESCE(NULLIF(f.date, ''::text), NULLIF(f.start_date, ''::text), f.scheduling_window ->> 'startsOn'::text, ''::text) AS starts_on) dates
                  WHERE NULL::text[] IS NULL AND (f.status = 'live'::text OR (dates.ends_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text OR dates.ends_on >= ((w.today - 7)::text)) AND (dates.starts_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text OR dates.starts_on <= (w.today + '1 year'::interval)::date::text))
                UNION ALL
                 SELECT c.source_id,
                    c.fixture_id
                   FROM public.nothingsports_fixture_current c
                     JOIN public.nothingsports_fixture_sources src USING (source_id)
                  WHERE NULL::text[] IS NOT NULL AND c.identity_keys && NULL::text[]
                ),
 group_keys AS MATERIALIZED(SELECT DISTINCT fixture_id FROM scope_keys ORDER BY fixture_id LIMIT 5001),
 limited_edges AS MATERIALIZED(SELECT source_id,fixture_id FROM scope_keys ORDER BY source_id,fixture_id LIMIT 10001),
 edge_keys AS MATERIALIZED(SELECT source_id,fixture_id,row_number()OVER(ORDER BY source_id,fixture_id)-1 AS ordinal FROM limited_edges),
 counts AS MATERIALIZED(SELECT(SELECT count(*)FROM group_keys)group_count,(SELECT count(*)FROM edge_keys)edge_count),
 limits AS MATERIALIZED(SELECT *,group_count<=5000 AND edge_count<=10000 AND NOT EXISTS(SELECT 1 FROM edge_keys GROUP BY fixture_id HAVING count(*)>16)AS complete FROM counts),
 candidates AS MATERIALIZED(SELECT e.source_id,e.fixture_id FROM edge_keys e WHERE(SELECT complete FROM limits)),
 source_receipts AS MATERIALIZED (
                 SELECT src.source_id,
                    src.discovery_report -> '_fixtureObservations'::text AS receipts
                   FROM public.nothingsports_fixture_sources src
                  WHERE (EXISTS ( SELECT 1
                           FROM candidates k
                          WHERE k.source_id = src.source_id))
                ), clock_inputs AS MATERIALIZED (
                 SELECT k.source_id,
                    k.fixture_id,
                    ARRAY[s.score ->> 'scoreCheckedAt'::text, c.global_fixture ->> 'scoreCheckedAt'::text, s.score ->> 'statusCheckedAt'::text, c.global_fixture ->> 'statusCheckedAt'::text, (r.receipts -> c.fixture_id) ->> 's'::text, (r.receipts -> c.fixture_id) ->> 't'::text] AS raw
                   FROM candidates k
                     JOIN public.nothingsports_fixture_current c USING (source_id, fixture_id)
                     LEFT JOIN public.nothingsports_live_scores s USING (source_id, fixture_id)
                     JOIN source_receipts r USING (source_id)
                ), parsed_clocks AS MATERIALIZED (
                 SELECT distinct_values.value,
                    public.nothingsports_fixture_observation_time(distinct_values.value) AS stamp
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
                     JOIN public.nothingsports_fixture_current c USING (source_id, fixture_id)
                     LEFT JOIN public.nothingsports_live_scores s USING (source_id, fixture_id)
                     JOIN patches p USING (source_id, fixture_id)
                     CROSS JOIN LATERAL ( SELECT
                                CASE
                                    WHEN NULL::text[] IS NOT NULL THEN c.fixture
                                    ELSE c.global_fixture
                                END AS base
                         OFFSET 0) cleaned
                )
 SELECT json_build_object('schemaVersion','fixture-source-groups.v1','complete',l.complete,'groupCount',l.group_count,'edgeCount',l.edge_count,'groups',coalesce((
 SELECT json_agg(json_build_object('fixture_id',g.fixture_id,'edges',g.edges)ORDER BY g.fixture_id)FROM(
 SELECT p.fixture_id,json_agg(json_build_object('source_id',p.source_id,'ordinal',e.ordinal,'identity_keys',p.identity_keys,'fixture',p.fixture)ORDER BY e.ordinal)edges
 FROM projected p JOIN edge_keys e USING(source_id,fixture_id)GROUP BY p.fixture_id)g),'[]'::json))FROM limits l)ELSE(SELECT value AS bundle
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
           FROM projected) global_query(value))END AS bundle;
-- Explicit server-only transport opt-in; the default expression remains original.
-- No fact, admission, clock parser, stored column, writer or permission change.
set local lock_timeout='1s';
set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from '5d0feacdb947642b6b3f9f8d762a5887' then
  raise exception 'Original global view differs from reviewed baseline';
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

 if md5(pg_get_functiondef('public.nothingsports_fixture_observation_time(text)'::regprocedure)) is distinct from '13842433b7af056a35c01e8b234ae3c9'
 or md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)) is distinct from '44d1edfc00ada08fad8deb987472ad54' then
  raise exception 'Original observation helpers differ from reviewed baseline';
 end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid in('public.nothingsports_fixture_observation_time(text)'::regprocedure,
                  'public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure)
      and (pg_get_userbyid(p.proowner)<>'postgres' or (a.grantee<>p.proowner and not(
        a.grantee=(select oid from pg_roles where rolname='service_role') and a.privilege_type='EXECUTE' and not a.is_grantable))))
 or not has_function_privilege('service_role','public.nothingsports_fixture_observation_time(text)','EXECUTE')
 or not has_function_privilege('service_role','public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)','EXECUTE') then
  raise exception 'Observation helper permissions differ from service-only baseline';
 end if;
 if not exists(select 1 from pg_class where oid='public.nothingsports_fixture_current'::regclass and relrowsecurity and relforcerowsecurity)
 or has_table_privilege('anon','public.nothingsports_fixture_current','SELECT')
 or has_table_privilege('authenticated','public.nothingsports_fixture_current','SELECT')
 or not has_table_privilege('service_role','public.nothingsports_fixture_current','SELECT') then
  raise exception 'Current fixture permissions differ from private baseline';
 end if;
 if not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.nothingsports_fixture_current'::regclass and a.attname='global_fixture' and a.attgenerated='s'
      and a.atttypid='jsonb'::regtype and a.attacl is null and not a.attisdropped
      and md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365') then
  raise exception 'Original compact projection differs from reviewed baseline';
 end if;
end $guard$;

COMMIT;
