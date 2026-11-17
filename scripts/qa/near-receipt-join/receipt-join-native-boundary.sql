-- UNEXECUTED: actual SQL boundary test, disposable native QA only. No table DML.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='1s';
WITH allocation AS MATERIALIZED (
 select 1/CASE WHEN left(current_database(),16)='ns_near_receipt_' THEN 1 ELSE 0 END AS allowed
), candidates(source_id,fixture_id) AS (VALUES
 ('no-receipt','x'),('no-payload','x'),('multi','x'),('cross-a','shared'),('cross-b','shared'),
 ('json-null','x'),('sql-null','x'),(NULL::text,'null-key')
), payloads(source_id,fixture_id,fixture,score,original_clock) AS (VALUES
 ('no-receipt','x','{"status":"live","sourceStale":true,"opaque":null}'::jsonb,'{"homeScore":0}'::jsonb,'2026-09-01T00:00:00Z'),
 ('multi','x','{"variant":1}'::jsonb,'{"awayScore":0}'::jsonb,'2026-09-02T00:00:00Z'),
 ('multi','x','{"variant":2}'::jsonb,NULL::jsonb,'2026-09-03T00:00:00Z'),
 ('cross-a','shared','{"source":"a"}'::jsonb,NULL::jsonb,'2026-09-04T00:00:00Z'),
 ('cross-b','shared','{"source":"b"}'::jsonb,NULL::jsonb,'2026-09-05T00:00:00Z'),
 ('json-null','x','{}'::jsonb,NULL::jsonb,'2026-09-06T00:00:00Z'),
 ('sql-null','x','{}'::jsonb,NULL::jsonb,'2026-09-07T00:00:00Z'),
 (NULL::text,'null-key','{}'::jsonb,NULL::jsonb,'2026-09-08T00:00:00Z'),
 ('unselected','x','{}'::jsonb,NULL::jsonb,'2026-09-09T00:00:00Z')
), receipts(source_id,fixture_id,receipt) AS (VALUES
 ('no-payload','x','{"s":"old"}'::jsonb),
 ('multi','x','{"r":1}'::jsonb),('multi','x','{"r":2}'::jsonb),('multi','x','{"r":2}'::jsonb),
 ('cross-a','shared','{"s":"a"}'::jsonb),('cross-b','shared','{"s":"b"}'::jsonb),
 ('json-null','x','null'::jsonb),('sql-null','x',NULL::jsonb),
 (NULL::text,'null-key','{}'::jsonb),('unselected','x','{}'::jsonb)
), original AS MATERIALIZED (
 select c.source_id,c.fixture_id,c.fixture,c.score,c.original_clock,r.receipt,r.source_id IS NOT NULL AS receipt_present
 from candidates selected
 cross join lateral (
  select base.source_id,base.fixture_id,base.fixture,base.score,base.original_clock from payloads base
  where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id offset 0
 ) c
 left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
), candidate AS MATERIALIZED (
 select c.source_id,c.fixture_id,c.fixture,c.score,c.original_clock,r.receipt,r.source_id IS NOT NULL AS receipt_present
 from candidates selected
 left join receipts r on r.source_id=selected.source_id and r.fixture_id=selected.fixture_id
 cross join lateral (
  select base.source_id,base.fixture_id,base.fixture,base.score,base.original_clock from payloads base
  where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id offset 0
 ) c
), wrong_inner_join AS MATERIALIZED (
 select c.source_id,c.fixture_id,c.fixture,c.score,c.original_clock,r.receipt,r.source_id IS NOT NULL AS receipt_present
 from candidates selected
 join receipts r on r.source_id=selected.source_id and r.fixture_id=selected.fixture_id
 cross join lateral (
  select base.source_id,base.fixture_id,base.fixture,base.score,base.original_clock from payloads base
  where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id offset 0
 ) c
), differences AS MATERIALIZED (
 (select * from original except all select * from candidate)
 union all (select * from candidate except all select * from original)
), negative_differences AS MATERIALIZED (
 (select * from original except all select * from wrong_inner_join)
 union all (select * from wrong_inner_join except all select * from original)
)
select 'LOCAL_SQL_RELATIONAL_BOUNDARY_NOT_FULL_READER_PROOF' AS scope,
 (select count(*) from original) AS original_rows,
 (select count(*) from candidate) AS candidate_rows,
 (select count(*) from differences) AS full_value_bag_differences,
 (select count(*) from negative_differences) AS unsafe_inner_join_negative_differences,
 (select count(*) from candidate where source_id='multi') AS multiple_payload_receipt_rows,
 (select count(*) from candidate where source_id='no-receipt' and not receipt_present) AS preserved_missing_receipt,
 (select count(*) from candidate where source_id='no-payload') AS missing_payload_rows,
 (select count(*) from candidate where source_id='json-null' and receipt='null'::jsonb) AS preserved_json_null,
 (select count(*) from candidate where source_id='sql-null' and receipt IS NULL and receipt_present) AS preserved_sql_null
from allocation where allowed=1;
ROLLBACK;
-- REQUIRED: original/candidate rows11, differences0, unsafe-negative1, multi6,
-- missing-receipt1, missing-payload0, JSON-null1, SQL-null1. Otherwise STOP.
-- Duplicate payload/receipt VALUES test bag semantics without weakening real PKs.
