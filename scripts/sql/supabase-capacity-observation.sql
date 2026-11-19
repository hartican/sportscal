-- ROOT-only read-only metadata. One5s attempt; no account rows or operations.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='1s';
WITH functions AS (
 SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS identity,
 md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||coalesce(p.proconfig::text,'')) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND ((n.nspname='public' AND p.proname LIKE 'nothingsports_%') OR n.nspname LIKE 'nothingsports_%')
), columns AS (
 SELECT n.nspname||'.'||c.relname||'.'||a.attname AS identity,
 concat_ws('|',format_type(a.atttypid,a.atttypmod),a.attgenerated,a.attnotnull::text,pg_get_expr(d.adbin,d.adrelid),a.attacl::text) AS definition
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attnum>0 AND NOT a.attisdropped AND (n.nspname LIKE 'nothingsports_%' OR n.nspname='public' AND c.relname IN ('nothingsports_fixture_current','nothingsports_live_scores','nothingsports_fixture_sources'))
), code AS (
 SELECT 'function:'||identity AS identity,definition FROM functions
 UNION ALL SELECT 'column:'||identity,definition FROM columns
 UNION ALL SELECT 'global-view',pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)
), facts AS (
 SELECT 'base:'||source_id||':'||fixture_id AS identity,content_hash AS digest FROM public.nothingsports_fixture_current
 UNION ALL SELECT 'score:'||source_id||':'||fixture_id,content_hash FROM public.nothingsports_live_scores
)
SELECT jsonb_build_object(
 'schemaVersion','supabase-capacity-database.v1','observedAt',clock_timestamp(),
 'databaseBytes',pg_database_size(current_database()),'serverVersion',current_setting('server_version'),
 'defaultReadOnly',current_setting('default_transaction_read_only'),
 'settings',(SELECT jsonb_object_agg(name,setting||coalesce(unit,'')) FROM pg_settings WHERE name IN ('work_mem','shared_buffers','max_connections','effective_cache_size')),
 'codeFingerprint',(SELECT md5(string_agg(identity||':'||definition,E'\n' ORDER BY identity COLLATE "C")) FROM code),
 'factFingerprint',(SELECT md5(string_agg(identity||':'||digest,E'\n' ORDER BY identity COLLATE "C")) FROM facts),
 'counts',jsonb_build_object('current',(SELECT count(*) FROM public.nothingsports_fixture_current),'scores',(SELECT count(*) FROM public.nothingsports_live_scores),'sources',(SELECT count(*) FROM public.nothingsports_fixture_sources)),
 'sourceObservationFingerprint',(SELECT md5(string_agg(source_id||':'||checked_at::text,E'\n' ORDER BY source_id COLLATE "C")) FROM public.nothingsports_fixture_sources),
 'otherClientBackends',(SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()),
 'otherActiveClientBackends',(SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid() AND state='active'),
 'otherWaitingClientBackends',(SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid() AND wait_event_type IS NOT NULL),
 'cumulativeDatabaseStats',(SELECT jsonb_build_object('statsReset',stats_reset,'blocksRead',blks_read,'blocksHit',blks_hit,'tempBytes',temp_bytes,'tempFiles',temp_files,'deadlocks',deadlocks) FROM pg_stat_database WHERE datname=current_database()),
 'cpuUtilisation',NULL,'memoryPressure',NULL,'diskQuotaEnforced',NULL,
 'limits','Point-in-time metadata, not failure-correlated CPU/memory/IO telemetry. Hashes detect selected schema/fact changes; no full ACL/security or account-state certification.'
) AS observation;
ROLLBACK;
