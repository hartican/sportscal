-- SOURCE ONLY. ROOT separately allocates execution through its existing SQL
-- operator. Replace the sole quoted source marker with the reviewed
-- 40-character lowercase Git SHA, then bind the rendered query hash in receipt.
-- One snapshot-bound SELECT; no function/schema/writer/provider invocation.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL timezone = 'UTC';
SET LOCAL datestyle = 'ISO, YMD';
WITH inventory AS MATERIALIZED (
  SELECT (SELECT count(*) FROM public.nothingsports_fixture_current) AS current_count,
    (SELECT count(*) FROM public.nothingsports_live_scores) AS score_count,
    (SELECT count(*) FROM public.nothingsports_fixture_sources) AS source_count
), permitted AS MATERIALIZED (
  SELECT *, current_count <= 10000 AND score_count <= 10000 AND source_count <= 128
    AND current_setting('transaction_read_only') = 'on'
    AND current_setting('server_encoding') = 'UTF8' AS ok FROM inventory
), records AS MATERIALIZED (
  SELECT 0 AS kind_order, 'current'::text AS kind, c.source_id, c.fixture_id,
    jsonb_build_object('source_id', c.source_id, 'fixture_id', c.fixture_id,
      'identity_keys', c.identity_keys, 'identity_keys_is_sql_null', c.identity_keys IS NULL,
      'fixture', c.fixture, 'fixture_is_sql_null', c.fixture IS NULL,
      'content_hash', c.content_hash, 'updated_at', c.updated_at) AS value
  FROM public.nothingsports_fixture_current c CROSS JOIN permitted p WHERE p.ok
  UNION ALL
  SELECT 1, 'scores', s.source_id, s.fixture_id,
    jsonb_build_object('source_id', s.source_id, 'fixture_id', s.fixture_id,
      'score', s.score, 'score_is_sql_null', s.score IS NULL,
      'content_hash', s.content_hash, 'first_completed_at', s.first_completed_at)
  FROM public.nothingsports_live_scores s CROSS JOIN permitted p WHERE p.ok
  UNION ALL
  SELECT 2, 'sources', s.source_id, ''::text,
    jsonb_build_object('source_id', s.source_id, 'revision', s.revision,
      'checked_at', s.checked_at, 'next_due_at', s.next_due_at, 'failure_count', s.failure_count,
      'receipt_key_present', coalesce(s.discovery_report ? '_fixtureObservations', false),
      'fixture_observations', s.discovery_report -> '_fixtureObservations')
  FROM public.nothingsports_fixture_sources s CROSS JOIN permitted p WHERE p.ok
), framed AS MATERIALIZED (
  SELECT *, jsonb_build_object('kind', kind, 'row', value)::text || E'\n' AS line,
    get_byte(decode(md5(kind || E'\n' || source_id || E'\n' || fixture_id), 'hex'), 0) % 16 AS bucket
  FROM records
), row_bounds AS MATERIALIZED (
  SELECT coalesce(sum(octet_length(line)), 0) AS bytes,
    coalesce(max(octet_length(line)), 0) AS largest,
    md5(coalesce(string_agg(md5(line), '' ORDER BY kind_order, source_id COLLATE "C", fixture_id COLLATE "C"), '')) AS graph_md5
  FROM framed
), parts AS MATERIALIZED (
  -- Fixed deterministic buckets, whole rows. A skewed/oversized bucket refuses;
  -- there is no implicit repartition, sampling, truncation or byte-limit change.
  SELECT bucket, 'part-' || lpad(bucket::text, 2, '0') || '.ndjson' AS name,
    count(*) AS rows,
    string_agg(line, '' ORDER BY kind_order, source_id COLLATE "C", fixture_id COLLATE "C") AS body
  FROM framed CROSS JOIN row_bounds b WHERE b.bytes <= 41943040 AND b.largest <= 4194304
  GROUP BY bucket
), descriptors AS MATERIALIZED (
  SELECT bucket, name, rows, body, octet_length(body) AS bytes, md5(body) AS checksum FROM parts
), manifest AS MATERIALIZED (
  SELECT jsonb_build_object(
    'schemaVersion', 'accepted-public-state.v1', 'sourceGitSha', '__CAPTURE_SOURCE_SHA__',
    'snapshotAt', statement_timestamp(), 'readOnly', current_setting('transaction_read_only') = 'on',
    'coherence', 'one-select-mvcc-snapshot', 'databaseEncoding', current_setting('server_encoding'),
    'reportErrorPresence', 'UNVERIFIED', 'readerContextAccepted', false,
    'counts', jsonb_build_object('current', p.current_count, 'scores', p.score_count, 'sources', p.source_count,
      'currentFactSources', (SELECT count(DISTINCT source_id) FROM framed WHERE kind = 'current'),
      'scoreFactSources', (SELECT count(DISTINCT source_id) FROM framed WHERE kind = 'scores'),
      'receiptKeys', (SELECT count(*) FROM framed WHERE kind = 'sources' AND value -> 'receipt_key_present' = 'true'::jsonb)),
    'partBytes', b.bytes, 'orderedRowsMd5', b.graph_md5,
    'parts', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'bytes', bytes, 'rows', rows, 'md5', checksum) ORDER BY bucket), '[]'::jsonb) FROM descriptors)
  )::text || E'\n' AS body, p.ok, b.bytes, b.largest
  FROM permitted p CROSS JOIN row_bounds b
), approved AS MATERIALIZED (
  SELECT *, ok AND largest <= 4194304 AND octet_length(body) <= 65536
    AND bytes + octet_length(body) <= 41943040
    AND NOT EXISTS (SELECT 1 FROM descriptors WHERE bytes > 4194304) AS fits FROM manifest
)
SELECT CASE WHEN fits THEN jsonb_build_object(
  'status', 'ready', 'manifest_text', body, 'manifest_md5', md5(body),
  'parts', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'bytes', bytes, 'rows', rows,
    'md5', checksum, 'data_base64', replace(encode(convert_to(body, 'UTF8'), 'base64'), E'\n', ''))
    ORDER BY bucket), '[]'::jsonb) FROM descriptors)
) ELSE jsonb_build_object('status', 'refused', 'manifest_text', '', 'manifest_md5', md5(''), 'parts', '[]'::jsonb) END AS capture_packet
FROM approved;
ROLLBACK;
