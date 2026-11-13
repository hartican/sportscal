-- DISPOSABLE NATIVE QA DATABASE ONLY. Source preparation, never executed here.
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='1s';
DO $setup$
DECLARE original text; reference text;
BEGIN
 IF left(current_database(),16) <> 'ns_near_receipt_' THEN RAISE EXCEPTION 'Disposable native database required'; END IF;
 original := pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure);
 IF md5(original) <> 'efc32656d8c100d80543001a2c5e6b48' THEN RAISE EXCEPTION 'Original definition differs'; END IF;
 IF (length(original)-length(replace(original,'FUNCTION public.nothingsports_read_match_centre_fixture_bundle(','')))
  /length('FUNCTION public.nothingsports_read_match_centre_fixture_bundle(') <> 1 THEN RAISE EXCEPTION 'Reference boundary differs'; END IF;
 EXECUTE 'create schema qa_receipt_join';
 EXECUTE 'revoke all on schema qa_receipt_join from public,anon,authenticated';
 EXECUTE 'grant usage on schema qa_receipt_join to service_role';
 reference := replace(original,'FUNCTION public.nothingsports_read_match_centre_fixture_bundle(',
  'FUNCTION qa_receipt_join.original_reader(');
 EXECUTE reference;
 EXECUTE 'revoke all on function qa_receipt_join.original_reader(text[]) from public,anon,authenticated';
 EXECUTE 'grant execute on function qa_receipt_join.original_reader(text[]) to service_role';
 IF (select md5(p.prosrc) from pg_proc p where p.oid='qa_receipt_join.original_reader(text[])'::regprocedure)
  <> '3e1d234315b0eae31e2fc4ec491de3dd' THEN RAISE EXCEPTION 'Reference body differs'; END IF;
END
$setup$;
COMMIT;
