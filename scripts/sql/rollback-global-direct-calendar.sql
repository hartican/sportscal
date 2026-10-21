-- Exact undo of the view-only direct calendar repair. Canonical facts remain.
set local lock_timeout='1s';set local statement_timeout='3s';
do $guard$ begin
 if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) is distinct from '100c4a82c569e5455e801a4c413a7cea' then raise exception 'Direct calendar undo refused: active view differs';end if;
end;$guard$;
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
