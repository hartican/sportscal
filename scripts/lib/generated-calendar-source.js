'use strict';
// Pure source preparation. No client, engine, network, process or runtime import.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const NAME='20261026204036_store_validated_fixture_calendar_windows.sql';
const ORIGINAL='20261026021111_use_lossless_global_fixture_groups.sql';
const COLUMNS=['global_base_window','global_score_window','global_window_valid'];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const originalSource=read('supabase/migrations/'+ORIGINAL);
assert.equal(sha(originalSource),'83914748997634159e5d26b186dfc41271ca92720dcca2c1168cc12a3cff38e3');
const marker='CREATE OR REPLACE VIEW public.nothingsports_current_global_fixture_bundle WITH(security_invoker=true)AS\n';
assert.equal(originalSource.split(marker).length,2);
const original=originalSource.split(marker)[1].trim().replace(/;$/,'');
const legacyAt=original.indexOf('ELSE(SELECT value AS bundle');
const payloadAt=original.indexOf(',\n group_keys AS MATERIALIZED');
assert(payloadAt>0&&legacyAt>payloadAt);
const join='LEFT JOIN calendar_windows ctx ON ctx.source_id = c.source_id AND ctx.fixture_id = c.fixture_id';
const match=original.slice(0,payloadAt).match(/LEFT JOIN calendar_windows ctx ON ctx.source_id = c.source_id AND ctx.fixture_id = c.fixture_id AND ([^\n]+)\n/);
assert(match);const predicate=match[1];
assert.equal((predicate.match(/jsonb_typeof/g)||[]).length,20);
const generatedPredicate=predicate.replaceAll('ctx.base_window',"(base_selection -> 'calendarWindow'::text)").replaceAll('ctx.score_window',"(score_selection -> 'calendarWindow'::text)");
let head=original.slice(0,payloadAt);
head=head.replace("ctx.base_selection -> 'calendarWindow'::text AS base_window",'ctx.global_base_window AS base_window');
head=head.replace("ctx.score_selection -> 'calendarWindow'::text AS score_window",'ctx.global_score_window AS score_window');
head=head.replace('WHERE ctx.shape_version = 1 AND NOT','WHERE ctx.shape_version = 1 AND ctx.global_window_valid IS TRUE AND NOT');
head=head.replace(join+' AND '+predicate,join);
assert(!head.includes('jsonb_typeof')&&!head.includes("selection -> 'calendarWindow'"));
const candidate=head+original.slice(payloadAt);
assert.equal(candidate.slice(candidate.indexOf('ELSE(SELECT value AS bundle')),original.slice(legacyAt));
const definitions=[
 "global_base_window jsonb GENERATED ALWAYS AS (base_selection -> 'calendarWindow'::text) STORED",
 "global_score_window jsonb GENERATED ALWAYS AS (score_selection -> 'calendarWindow'::text) STORED",
 'global_window_valid boolean GENERATED ALWAYS AS ('+generatedPredicate+') STORED'
];
const baseColumns='source_id text NOT NULL,fixture_id text NOT NULL,identity_keys text[] NOT NULL,base_key text,score_key text,has_score_key boolean,participant_ids text[] NOT NULL,sides text,base_selection jsonb NOT NULL,score_selection jsonb NOT NULL,shape_version smallint NOT NULL DEFAULT 1';
const fnContracts=read('scripts/fixtures/near-selection-contracts.json');
const expectedFunctions=JSON.parse(fnContracts).candidate;
assert.equal(expectedFunctions.length,27);
const expectedTriggers=JSON.parse(read('scripts/fixtures/canonical-context-batch-contracts.json')).triggers;
assert.equal(expectedTriggers.length,8);
const q=x=>"'"+x.replaceAll("'","''")+"'";
const contractSql="jsonb_build_object('definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatile',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'cost',p.procost,'leakproof',p.proleakproof,'config',p.proconfig)";
function attrs(relation,omitNew=false){return `SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid,'typmod',a.atttypmod,'collation',a.attcollation,'notnull',a.attnotnull,'generated',a.attgenerated,'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=${q(relation)}::regclass AND a.attnum>0 AND NOT a.attisdropped${omitNew?' AND a.attname<>ALL(ARRAY['+COLUMNS.map(q).join(',')+'])':''}`;}
function schemaGuard(includeGenerated){return `
 IF (${attrs('nothingsports_fixture_read_private.fixture_context')}) IS DISTINCT FROM (${attrs('pg_temp.ns_gc_expected_context',!includeGenerated)}) THEN
  RAISE EXCEPTION 'Generated calendar: exact context column/expression/ACL preimage differs'; END IF;
`;}
const common=`
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Generated calendar: postgres owner required'; END IF;
 LOCK TABLE public.nothingsports_fixture_sources,public.nothingsports_fixture_current,public.nothingsports_live_scores,nothingsports_fixture_read_private.fixture_context,nothingsports_fixture_read_private.fixture_tokens,nothingsports_fixture_read_private.source_tokens,nothingsports_fixture_read_private.integrity_pending,nothingsports_fixture_read_private.near_selection IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM nothingsports_fixture_read_private.integrity_pending) THEN RAISE EXCEPTION 'Generated calendar: pending canonical work'; END IF;
 IF EXISTS(SELECT 1 FROM public.nothingsports_fixture_sources WHERE lease_token IS NOT NULL AND lease_until>clock_timestamp()) THEN RAISE EXCEPTION 'Generated calendar: active source lease'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(${q(JSON.stringify(expectedFunctions))}::jsonb)e(signature text,contract jsonb) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) WHERE e.contract IS DISTINCT FROM ${contractSql}) THEN RAISE EXCEPTION 'Generated calendar: current27 owner/function contract differs'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(${q(JSON.stringify(expectedTriggers))}::jsonb)e(relation text,name text,digest text,enabled text) LEFT JOIN pg_trigger t ON t.tgrelid=to_regclass(e.relation)AND t.tgname=e.name WHERE t.oid IS NULL OR md5(pg_get_triggerdef(t.oid))IS DISTINCT FROM e.digest OR t.tgenabled::text IS DISTINCT FROM e.enabled) THEN RAISE EXCEPTION 'Generated calendar: canonical trigger contract differs'; END IF;
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
 EXECUTE $gc_contract$CREATE TEMP TABLE ns_gc_expected_context(${baseColumns},${definitions.join(',')})ON COMMIT DROP$gc_contract$;
`;
const header=`-- Source candidate only; runtime/install/benefit gates are not established.
-- One additive private metadata owner; no fact, clock, canonical writer or permission change.
BEGIN;
SET LOCAL statement_timeout='3s';
SET LOCAL lock_timeout='1s';
SET LOCAL search_path=pg_catalog,public,pg_temp;
-- The single DO statement bounds guard + rewrite + view publication together.
DO $generated_calendar$
BEGIN
`;
const footer=`
 DROP TABLE pg_temp.ns_gc_expected_context;
END
$generated_calendar$;
COMMIT;
`;
const viewSql=select=>'CREATE OR REPLACE VIEW public.nothingsports_current_global_fixture_bundle WITH(security_invoker=true)AS\n'+select;
function exactCandidateGuard(){return `
 EXECUTE $gc_expected_view$CREATE TEMP VIEW ns_gc_expected_view WITH(security_invoker=true)AS\n${candidate}$gc_expected_view$;
 IF md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)) IS DISTINCT FROM md5(pg_get_viewdef('pg_temp.ns_gc_expected_view'::regclass,true)) THEN RAISE EXCEPTION 'Generated calendar: exact candidate view differs'; END IF;
 DROP VIEW pg_temp.ns_gc_expected_view;
`;}
function render(){
 const install=header+common+schemaGuard(false)+`
 IF md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))<>'d3d5341fcf5dc901c3e1240145b3acd7' THEN RAISE EXCEPTION 'Generated calendar: current D3d view differs'; END IF;
 ALTER TABLE nothingsports_fixture_read_private.fixture_context\n  ADD COLUMN ${definitions.join(',\n  ADD COLUMN ')};
 ANALYZE nothingsports_fixture_read_private.fixture_context(global_window_valid);
 EXECUTE $gc_publish$${viewSql(candidate)}$gc_publish$;
`+schemaGuard(true)+exactCandidateGuard()+footer;
 const undo=header+common+schemaGuard(true)+exactCandidateGuard()+`
 -- RESTRICT alone can still auto-drop same-table indexes/constraints. Refuse
 -- any column dependency except its own generated expression and our exact view.
 IF EXISTS(SELECT 1 FROM pg_depend d JOIN pg_attribute a ON d.refclassid='pg_class'::regclass AND d.refobjid=a.attrelid AND d.refobjsubid=a.attnum
  WHERE a.attrelid='nothingsports_fixture_read_private.fixture_context'::regclass AND a.attname=ANY(ARRAY[${COLUMNS.map(q).join(',')}])
  AND NOT(d.classid='pg_attrdef'::regclass AND d.objid=(SELECT oid FROM pg_attrdef WHERE adrelid=a.attrelid AND adnum=a.attnum))
  AND NOT(d.classid='pg_rewrite'::regclass AND d.objid IN(SELECT oid FROM pg_rewrite WHERE ev_class='public.nothingsports_current_global_fixture_bundle'::regclass))) THEN RAISE EXCEPTION 'Generated calendar: unreviewed column dependency'; END IF;
 -- CODE first, then remove only this module's metadata; never replay source rows.
 EXECUTE $gc_restore$${viewSql(original)}$gc_restore$;
 IF md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))<>'d3d5341fcf5dc901c3e1240145b3acd7' THEN RAISE EXCEPTION 'Generated calendar: restored D3d differs'; END IF;
 ALTER TABLE nothingsports_fixture_read_private.fixture_context\n  ${COLUMNS.map(c=>'DROP COLUMN '+c+' RESTRICT').join(',\n  ')};
`+schemaGuard(false)+footer;
 return {install,undo};
}
module.exports={ROOT,NAME,ORIGINAL,COLUMNS,sha,read,original,candidate,predicate,generatedPredicate,definitions,baseColumns,render,viewSql};
