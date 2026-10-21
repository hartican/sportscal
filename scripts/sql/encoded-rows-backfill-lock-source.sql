-- Operator transaction already has SET LOCAL lock_timeout='1s', statement_timeout='3s'.
-- Execute separately, bind ONE source ID. Require exactly one locked row before enqueue.
select source_id from public.nothingsports_fixture_sources where source_id=$1 for update;
