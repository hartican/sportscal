set local lock_timeout='1s';set local statement_timeout='3s';do $guard$ begin if md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))<>'3d1b17f398f0eb7c2b1db22379fc422a' or not(not exists(select 1 from jsonb_to_recordset('[{"signature":"nothingsports_fixture_read_private.sync_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6ad06f6cdab54b2eea83c993d094c160"}},{"signature":"nothingsports_fixture_read_private.sync_fixture(text,text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"3c20e52d95ebda90af1bb15369939738"}},{"signature":"nothingsports_fixture_read_private.mark_integrity_pending()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"8e07a884b100dd09a7727d9d42395ba3"}},{"signature":"nothingsports_fixture_read_private.enforce_pending_integrity()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"780d885e547c6cc2f2f97241c14df225"}},{"signature":"nothingsports_fixture_read_private.source_index_complete(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"85eb0ec44403c2ab6237ad76598cd2dd"}},{"signature":"public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"974299abc8841e1cfc35b95332e10eaa"}},{"signature":"public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"7c001ceae18809a75401ba0c308a8603"}},{"signature":"public.nothingsports_publish_fixture_source_report(text,uuid,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6cce2642baed98679b62e0b605396d21"}},{"signature":"public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"44d1edfc00ada08fad8deb987472ad54"}},{"signature":"public.nothingsports_fixture_observation_time(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"13842433b7af056a35c01e8b234ae3c9"}},{"signature":"public.nothingsports_read_match_centre_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"d9b49086166c24b3a10b4dc1f7279b7c"}},{"signature":"public.nothingsports_read_current_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"ef1658b2eb58a376f368ede88730ad43"}},{"signature":"public.nothingsports_read_current_fixtures(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"8f7e452c8a96f15ed11b50b4ea5cb751"}},{"signature":"public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"df1f9773b0f210c122f6c55fe8425f3c"}},{"signature":"public.nothingsports_read_current_fixture_bundle_json(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"a91f9bc32b11190240bba20ff0870bd8"}},{"signature":"public.nothingsports_read_current_fixture_bundle_json_rows(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"6e6a06e0ca5a3206a138cb88a400e84b"}}]'::jsonb) e(signature text,contract jsonb) left join pg_proc p on p.oid=to_regprocedure(e.signature) where e.contract is distinct from jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig)) and not exists(select 1 from jsonb_to_recordset('[{"relation":"nothingsports_fixture_read_private.fixture_context","name":"fixture_context_integrity_after_change","digest":"bf03845ba9bf5898d3f34f3053a8ed63","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_tokens_integrity_after_change","digest":"9b0c32efa6f1ed5eda212c9671c0ba7b","enabled":"O"},{"relation":"nothingsports_fixture_read_private.integrity_pending","name":"fixture_integrity_at_commit","digest":"9399bc70ad1f117e5f1e9219a0b34500","enabled":"O"},{"relation":"nothingsports_fixture_read_private.source_tokens","name":"source_tokens_integrity_after_change","digest":"37d4890aa003c3d1934270bb84d13b1e","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_current_integrity_after_change","digest":"73df0f45df51692e18c431c72027a91c","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_read_context_after_current","digest":"3f06abe6825f9b8a4d9ce0332fa537ec","enabled":"O"},{"relation":"public.nothingsports_fixture_sources","name":"encoded_row_receipt_pending","digest":"9da73c714811e6056fe5cec398e4cd81","enabled":"O"},{"relation":"public.nothingsports_live_scores","name":"encoded_row_score_pending","digest":"688cda6d09ae7f52b75a7daad17732b3","enabled":"O"},{"relation":"public.nothingsports_live_scores","name":"fixture_read_context_after_score","digest":"880b3667a7d5c466eaf9791486980429","enabled":"O"}]'::jsonb) e(relation text,name text,digest text,enabled text) left join pg_trigger tr on tr.tgrelid=to_regclass(e.relation) and tr.tgname=e.name where tr.oid is null or md5(pg_get_triggerdef(tr.oid)) is distinct from e.digest or tr.tgenabled::text is distinct from e.enabled or tr.tgenabled<>'O')) then raise exception 'Encoded undo contracts differ';end if;end;$guard$;
create or replace view public.nothingsports_current_global_fixture_bundle with(security_invoker=true) as  SELECT value AS bundle
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
drop trigger encoded_row_score_pending on public.nothingsports_live_scores;drop trigger encoded_row_receipt_pending on public.nothingsports_fixture_sources;
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
 return null;
end;
$function$;
CREATE OR REPLACE FUNCTION nothingsports_fixture_read_private.enforce_pending_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id) then return null;end if;
 if not nothingsports_fixture_read_private.source_index_complete(new.source_id) then
  raise exception using errcode='23514',message='Fixture index integrity is incomplete; canonical transaction refused';
 end if;
 delete from nothingsports_fixture_read_private.integrity_pending where source_id=new.source_id;
 return null;
end;
$function$;
drop table nothingsports_fixture_read_private.global_encoded_rows;