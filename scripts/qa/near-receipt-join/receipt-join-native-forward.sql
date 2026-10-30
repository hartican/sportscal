-- DISPOSABLE NATIVE QA DATABASES ONLY. Unexecuted preparation, not a migration.
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='1s';
DO $gate$
DECLARE
 target regprocedure := 'public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure;
 before_definition text; after_definition text; restored_definition text;
 before_state jsonb; after_state jsonb;
 expected_state constant jsonb := $contract${"acl":"{postgres=X/postgres,service_role=X/postgres}","cost":100,"owner":"postgres","config":["search_path=\"\""],"strict":false,"definer":false,"parallel":"u","volatile":"s","leakproof":false}$contract$::jsonb;
 first_old constant text := $first_old$  from candidates selected
  cross join lateral (
$first_old$;
 first_new constant text := $first_new$  from candidates selected
  left join receipts r on r.source_id=selected.source_id and r.fixture_id=selected.fixture_id
  cross join lateral (
$first_new$;
 tail_old constant text := $tail_old$  ) c
  left join receipts r on r.source_id=c.source_id and r.fixture_id=c.fixture_id
 )
 select jsonb_build_object$tail_old$;
 tail_new constant text := $tail_new$  ) c
 )
 select jsonb_build_object$tail_new$;
BEGIN
 IF left(current_database(),16) <> 'ns_near_receipt_' THEN
  RAISE EXCEPTION 'Disposable native receipt-join database required';
 END IF;
 SELECT pg_get_functiondef(target) INTO before_definition;
 IF md5(pg_get_functiondef('nothingsports_fixture_read_private.near_index_ready()'::regprocedure))
  <> '98503336cb97173edfcf1129fd14673a' THEN RAISE EXCEPTION 'Readiness helper differs'; END IF;
 SELECT p.prosrc INTO restored_definition FROM pg_proc p WHERE p.oid=target;
 IF md5(restored_definition) <> '3e1d234315b0eae31e2fc4ec491de3dd' THEN RAISE EXCEPTION 'Input body differs'; END IF;
 SELECT (select jsonb_build_object('acl',p.proacl::text,'cost',p.procost,'owner',pg_get_userbyid(p.proowner),
 'config',p.proconfig,'strict',p.proisstrict,'definer',p.prosecdef,'parallel',p.proparallel,
 'volatile',p.provolatile,'leakproof',p.proleakproof) from pg_proc p where p.oid=target) INTO before_state;
 IF before_state IS DISTINCT FROM expected_state THEN RAISE EXCEPTION 'Owner/ACL/function contract differs'; END IF;
 IF (length(before_definition)-length(replace(before_definition,first_old,'')))/length(first_old) <> 1
 OR (length(before_definition)-length(replace(before_definition,tail_old,'')))/length(tail_old) <> 1 THEN
  RAISE EXCEPTION 'Exact one-join rewrite boundaries differ';
 END IF;
 after_definition := replace(replace(before_definition,first_old,first_new),tail_old,tail_new);
 restored_definition := replace(replace(after_definition,first_new,first_old),tail_new,tail_old);
 IF restored_definition IS DISTINCT FROM before_definition THEN RAISE EXCEPTION 'Exact round trip differs'; END IF;
 IF md5(before_definition) <> 'efc32656d8c100d80543001a2c5e6b48' THEN RAISE EXCEPTION 'Original definition differs'; END IF;
 EXECUTE after_definition;
 IF md5((select p.prosrc from pg_proc p where p.oid=target)) <> '402458f178989eed547f96e2ce2995c1'
 OR pg_get_functiondef(target) IS DISTINCT FROM after_definition THEN
  RAISE EXCEPTION 'Canonical output differs';
 END IF;
 SELECT (select jsonb_build_object('acl',p.proacl::text,'cost',p.procost,'owner',pg_get_userbyid(p.proowner),
 'config',p.proconfig,'strict',p.proisstrict,'definer',p.prosecdef,'parallel',p.proparallel,
 'volatile',p.provolatile,'leakproof',p.proleakproof) from pg_proc p where p.oid=target) INTO after_state;
 IF after_state IS DISTINCT FROM before_state THEN RAISE EXCEPTION 'Function metadata/ACL changed'; END IF;
END
$gate$;
COMMIT;
-- Error: rollback this local transaction, stop; never repair guards or retry.
