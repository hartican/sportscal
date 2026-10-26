-- Source candidate only; runtime/install/benefit gates are not established.
-- One additive private metadata owner; no fact, clock, canonical writer or permission change.
BEGIN;
SET LOCAL statement_timeout='3s';
SET LOCAL lock_timeout='1s';
SET LOCAL search_path=pg_catalog,public,pg_temp;
-- The single DO statement bounds guard + rewrite + view publication together.
DO $generated_calendar$
BEGIN

 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Generated calendar: postgres owner required'; END IF;
 LOCK TABLE public.nothingsports_fixture_sources,public.nothingsports_fixture_current,public.nothingsports_live_scores,nothingsports_fixture_read_private.fixture_context,nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens,nothingsports_fixture_read_private.integrity_pending,nothingsports_fixture_read_private.near_selection IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM nothingsports_fixture_read_private.integrity_pending) THEN RAISE EXCEPTION 'Generated calendar: pending canonical work'; END IF;
 IF EXISTS(SELECT 1 FROM public.nothingsports_fixture_sources WHERE lease_token IS NOT NULL AND lease_until>clock_timestamp()) THEN RAISE EXCEPTION 'Generated calendar: active source lease'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset('[{"signature":"nothingsports_fixture_observation_time(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"13842433b7af056a35c01e8b234ae3c9"}},{"signature":"nothingsports_fixture_read_private.context_fields(jsonb,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"18dbb6a6afc42fcb7bd9462a3ddef0da"}},{"signature":"nothingsports_fixture_read_private.enforce_pending_integrity()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"6e211988e06c52d9ddfb7eee5cc5b908"}},{"signature":"nothingsports_fixture_read_private.mark_integrity_pending()","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"8038f87c533aa24c77824298149ac0ef"}},{"signature":"nothingsports_fixture_read_private.publish_compact_complete(text,uuid,jsonb,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"0a2535591819d5fc729b6214190f3484"}},{"signature":"nothingsports_fixture_read_private.publish_full_complete(text,uuid,jsonb,text,integer)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"cd48f9a1d41db6e5baac18963b6e3232"}},{"signature":"nothingsports_fixture_read_private.selection_fields(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"d9bad60ae66eb8157788e482a9fca783"}},{"signature":"nothingsports_fixture_read_private.source_index_complete(text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"85eb0ec44403c2ab6237ad76598cd2dd"}},{"signature":"nothingsports_fixture_read_private.sync_fixture(text,text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"f825a02abaf3a930e1efe75aab2eb9f0"}},{"signature":"nothingsports_fixture_read_private.sync_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"4e201329e1824a469c2b926fedb6fdba"}},{"signature":"nothingsports_fixture_read_private.token_membership_trigger()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"d0fe27069e4d294d7385cff736776ad6"}},{"signature":"nothingsports_fixture_read_private.top_match_keys(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"0b5062260f46dfeb70e1e231db8d03db"}},{"signature":"nothingsports_fixture_read_private.window_fields(jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"i","leakproof":false,"definition":"6a39d774a7309099a986a2e6068d33fb"}},{"signature":"nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamp with time zone)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"44d1edfc00ada08fad8deb987472ad54"}},{"signature":"nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"7e7128d57cbf89a17b592e1dfef0769e"}},{"signature":"nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"68993b69c5054c76ad00f8c627e20651"}},{"signature":"nothingsports_publish_fixture_source_report(text,uuid,jsonb,text,integer,jsonb)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"v","leakproof":false,"definition":"6cce2642baed98679b62e0b605396d21"}},{"signature":"nothingsports_read_current_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"ef1658b2eb58a376f368ede88730ad43"}},{"signature":"nothingsports_read_current_fixture_bundle_json(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"a91f9bc32b11190240bba20ff0870bd8"}},{"signature":"nothingsports_read_current_fixture_bundle_json_rows(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"6e6a06e0ca5a3206a138cb88a400e84b"}},{"signature":"nothingsports_read_current_fixtures(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"8f7e452c8a96f15ed11b50b4ea5cb751"}},{"signature":"nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"df1f9773b0f210c122f6c55fe8425f3c"}},{"signature":"public.nothingsports_read_match_centre_fixture_bundle(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"efc32656d8c100d80543001a2c5e6b48"}},{"signature":"nothingsports_fixture_read_private.near_fields(jsonb,jsonb,jsonb,jsonb,timestamp with time zone)","contract":{"acl":"{postgres=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"83828d2b5f42d80bf99d0ef5422064ca"}},{"signature":"nothingsports_fixture_read_private.rebuild_near_selection(text,text)","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":true,"parallel":"u","volatile":"v","leakproof":false,"definition":"f5201e809cbc9ef24fe8a6bdbe013340"}},{"signature":"nothingsports_fixture_read_private.near_index_ready()","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"98503336cb97173edfcf1129fd14673a"}},{"signature":"nothingsports_fixture_read_private.read_near_raw(text[])","contract":{"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false,"definition":"24bf763bb95dc6fdff000e9ee42efc10"}}]'::jsonb)e(signature text,contract jsonb) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) WHERE e.contract IS DISTINCT FROM jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig)) THEN RAISE EXCEPTION 'Generated calendar: current27 owner/function contract differs'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset('[{"relation":"nothingsports_fixture_read_private.fixture_context","name":"fixture_context_integrity_after_change","digest":"bf03845ba9bf5898d3f34f3053a8ed63","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_tokens_integrity_after_change","digest":"9b0c32efa6f1ed5eda212c9671c0ba7b","enabled":"O"},{"relation":"nothingsports_fixture_read_private.integrity_pending","name":"fixture_integrity_at_commit","digest":"9399bc70ad1f117e5f1e9219a0b34500","enabled":"O"},{"relation":"nothingsports_fixture_read_private.source_tokens","name":"source_tokens_integrity_after_change","digest":"37d4890aa003c3d1934270bb84d13b1e","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_current_integrity_after_change","digest":"73df0f45df51692e18c431c72027a91c","enabled":"O"},{"relation":"public.nothingsports_fixture_current","name":"fixture_read_context_after_current","digest":"3f06abe6825f9b8a4d9ce0332fa537ec","enabled":"O"},{"relation":"public.nothingsports_live_scores","name":"fixture_read_context_after_score","digest":"880b3667a7d5c466eaf9791486980429","enabled":"O"},{"relation":"nothingsports_fixture_read_private.fixture_tokens","name":"fixture_token_membership_after_change","digest":"6d907458def566339fc1d9e9a67d5652","enabled":"O"}]'::jsonb)e(relation text,name text,digest text,enabled text) LEFT JOIN pg_trigger t ON t.tgrelid=to_regclass(e.relation)AND t.tgname=e.name WHERE t.oid IS NULL OR md5(pg_get_triggerdef(t.oid))IS DISTINCT FROM e.digest OR t.tgenabled::text IS DISTINCT FROM e.enabled) THEN RAISE EXCEPTION 'Generated calendar: canonical trigger contract differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='nothingsports_fixture_read_private.fixture_context'::regclass AND c.relkind='r' AND pg_get_userbyid(c.relowner)='postgres' AND c.relrowsecurity AND NOT c.relforcerowsecurity)
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE c.oid='nothingsports_fixture_read_private.fixture_context'::regclass AND a.grantee<>c.relowner AND NOT(a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role')AND a.privilege_type=ANY(ARRAY['SELECT','INSERT','UPDATE','DELETE'])AND NOT a.is_grantable))
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE'])wanted(privilege_name) WHERE NOT has_table_privilege('service_role','nothingsports_fixture_read_private.fixture_context',privilege_name)) THEN RAISE EXCEPTION 'Generated calendar: private context rights differ'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND contype='p' AND conkey=ARRAY[1,2]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND contype='f' AND confrelid='public.nothingsports_fixture_current'::regclass AND conkey=ARRAY[1,2]::smallint[] AND confdeltype='c' AND convalidated) THEN RAISE EXCEPTION 'Generated calendar: context identity constraints differ'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.nothingsports_fixture_current'::regclass AND a.attname='global_fixture' AND a.attgenerated='s' AND md5(pg_get_expr(d.adbin,d.adrelid))='d7d2f883cba24dc54897fe44f9930365') THEN RAISE EXCEPTION 'Generated calendar: original D7 projection differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='public.nothingsports_current_global_fixture_bundle'::regclass AND c.relkind='v' AND pg_get_userbyid(c.relowner)='postgres' AND c.reloptions=ARRAY['security_invoker=true'])
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE c.oid='public.nothingsports_current_global_fixture_bundle'::regclass AND a.grantee<>c.relowner AND NOT(a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role')AND a.privilege_type='SELECT'AND NOT a.is_grantable))
 OR NOT has_table_privilege('service_role','public.nothingsports_current_global_fixture_bundle','SELECT') THEN RAISE EXCEPTION 'Generated calendar: original service-only view rights differ'; END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.nothingsports_current_global_fixture_bundle'::regclass AND attnum>0 AND NOT attisdropped)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.nothingsports_current_global_fixture_bundle'::regclass AND attname='bundle' AND atttypid='json'::regtype AND attacl IS NULL) THEN RAISE EXCEPTION 'Generated calendar: view result contract differs'; END IF;
 -- Empty TEMP parser witnesses, never mutable live-state certificates or persistent owners.
 -- Compiling the frozen expressions/view here avoids inventing a pg_get_expr/view MD5 before qualification.
 IF to_regclass('pg_temp.ns_gc_expected_context') IS NOT NULL OR to_regclass('pg_temp.ns_gc_expected_view') IS NOT NULL THEN RAISE EXCEPTION 'Generated calendar: temporary witness name already exists'; END IF;
 EXECUTE $gc_contract$CREATE TEMP TABLE ns_gc_expected_context(source_id text NOT NULL,fixture_id text NOT NULL,identity_keys text[] NOT NULL,base_key text,score_key text,has_score_key boolean,participant_ids text[] NOT NULL,sides text,base_selection jsonb NOT NULL,score_selection jsonb NOT NULL,shape_version smallint NOT NULL DEFAULT 1,global_base_window jsonb GENERATED ALWAYS AS (base_selection -> 'calendarWindow'::text) STORED,global_score_window jsonb GENERATED ALWAYS AS (score_selection -> 'calendarWindow'::text) STORED,global_window_valid boolean GENERATED ALWAYS AS (jsonb_typeof((base_selection -> 'calendarWindow'::text)) = 'object'::text AND jsonb_typeof((score_selection -> 'calendarWindow'::text)) = 'object'::text AND (base_selection -> 'calendarWindow'::text) ?& ARRAY['hasStatus'::text, 'status'::text, 'hasEndDate'::text, 'endDate'::text, 'hasDate'::text, 'date'::text, 'hasStartDate'::text, 'startDate'::text, 'hasSchedulingWindow'::text, 'schedulingWindow'::text] AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'hasStatus'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'hasEndDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'hasDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'hasStartDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'hasSchedulingWindow'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'status'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'endDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'date'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((base_selection -> 'calendarWindow'::text) -> 'startDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (score_selection -> 'calendarWindow'::text) ?& ARRAY['hasStatus'::text, 'status'::text, 'hasEndDate'::text, 'endDate'::text, 'hasDate'::text, 'date'::text, 'hasStartDate'::text, 'startDate'::text, 'hasSchedulingWindow'::text, 'schedulingWindow'::text] AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'hasStatus'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'hasEndDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'hasDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'hasStartDate'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'hasSchedulingWindow'::text) = ANY (ARRAY['boolean'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'status'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'endDate'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'date'::text) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((score_selection -> 'calendarWindow'::text) -> 'startDate'::text) = ANY (ARRAY['string'::text, 'null'::text]))) STORED)ON COMMIT DROP$gc_contract$;

 IF (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid,'typmod',a.atttypmod,'collation',a.attcollation,'notnull',a.attnotnull,'generated',a.attgenerated,'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid,'typmod',a.atttypmod,'collation',a.attcollation,'notnull',a.attnotnull,'generated',a.attgenerated,'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='pg_temp.ns_gc_expected_context'::regclass AND a.attnum>0 AND NOT a.attisdropped) THEN
  RAISE EXCEPTION 'Generated calendar: exact context column/expression/ACL preimage differs'; END IF;

 EXECUTE $gc_expected_view$CREATE TEMP VIEW ns_gc_expected_view WITH(security_invoker=true)AS
SELECT CASE WHEN current_user='service_role' AND(CASE WHEN coalesce(nullif(current_setting('request.headers',true),''),'{}') IS JSON OBJECT
 THEN nullif(current_setting('request.headers',true),'')::jsonb->>'x-ns-fixture-source-groups'='v1' ELSE false END)
 THEN(WITH calendar_windows AS MATERIALIZED (
                 SELECT ctx.source_id,
                    ctx.fixture_id,
                    ctx.global_base_window AS base_window,
                    ctx.global_score_window AS score_window
                   FROM nothingsports_fixture_read_private.fixture_context ctx
                  WHERE ctx.shape_version = 1 AND ctx.global_window_valid IS TRUE AND NOT (EXISTS ( SELECT 1
                           FROM nothingsports_fixture_read_private.integrity_pending))
                ), active_window AS (
                 SELECT (statement_timestamp() AT TIME ZONE 'Australia/Sydney'::text)::date AS today
                ), scope_keys AS (
                 SELECT c.source_id,
                    c.fixture_id
                   FROM nothingsports_fixture_current c
                     JOIN nothingsports_fixture_sources src USING (source_id)
                     LEFT JOIN nothingsports_live_scores s USING (source_id, fixture_id)
                     LEFT JOIN calendar_windows ctx ON ctx.source_id = c.source_id AND ctx.fixture_id = c.fixture_id
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
           FROM projected) global_query(value))END AS bundle$gc_expected_view$;
 IF md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) IS DISTINCT FROM md5(pg_get_viewdef('pg_temp.ns_gc_expected_view'::regclass,true)) THEN RAISE EXCEPTION 'Generated calendar: exact candidate view differs'; END IF;
 DROP VIEW pg_temp.ns_gc_expected_view;

 -- RESTRICT alone can still auto-drop same-table indexes/constraints. Refuse
 -- any column dependency except its own generated expression and our exact view.
 IF EXISTS(SELECT 1 FROM pg_depend d JOIN pg_attribute a ON d.refclassid='pg_class'::regclass AND d.refobjid=a.attrelid AND d.refobjsubid=a.attnum
  WHERE a.attrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND a.attname=ANY(ARRAY['global_base_window','global_score_window','global_window_valid'])
  AND NOT(d.classid='pg_attrdef'::regclass AND d.objid=(SELECT oid FROM pg_attrdef WHERE adrelid=a.attrelid AND adnum=a.attnum))
  AND NOT(d.classid='pg_rewrite'::regclass AND d.objid IN(SELECT oid FROM pg_rewrite WHERE ev_class='public.nothingsports_current_global_fixture_bundle'::regclass))) THEN RAISE EXCEPTION 'Generated calendar: unreviewed column dependency'; END IF;
 -- CODE first, then remove only this module's metadata; never replay source rows.
 EXECUTE $gc_restore$CREATE OR REPLACE VIEW public.nothingsports_current_global_fixture_bundle WITH(security_invoker=true)AS
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
           FROM projected) global_query(value))END AS bundle$gc_restore$;
 IF md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))<>'d3d5341fcf5dc901c3e1240145b3acd7' THEN RAISE EXCEPTION 'Generated calendar: restored D3d differs'; END IF;
 ALTER TABLE nothingsports_fixture_read_private.fixture_context
  DROP COLUMN global_base_window RESTRICT,
  DROP COLUMN global_score_window RESTRICT,
  DROP COLUMN global_window_valid RESTRICT;

 IF (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid,'typmod',a.atttypmod,'collation',a.attcollation,'notnull',a.attnotnull,'generated',a.attgenerated,'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid,'typmod',a.atttypmod,'collation',a.attcollation,'notnull',a.attnotnull,'generated',a.attgenerated,'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='pg_temp.ns_gc_expected_context'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname<>ALL(ARRAY['global_base_window','global_score_window','global_window_valid'])) THEN
  RAISE EXCEPTION 'Generated calendar: exact context column/expression/ACL preimage differs'; END IF;

 DROP TABLE pg_temp.ns_gc_expected_context;
END
$generated_calendar$;
COMMIT;
