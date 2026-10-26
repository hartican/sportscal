'use strict';
// SQL source builder only. The sole publisher owns application to the database.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const prior=require('../prototypes/grouped-fixture-view');
const STAGED='d3d5341fcf5dc901c3e1240145b3acd7';
const REFINED='5d0feacdb947642b6b3f9f8d762a5887';
const BODY_SHA256='dec055471e30c29cb1f15565f467b9ce497ace2c790870f495ae36e88096e43c';
const EMITTED_BODY_SHA256='d564d441cd8556ace8b5465b829d7b67e9293884ffff984ac1ec665a7a02756c';
const migrationNames=fs.readdirSync(path.join(__dirname,'../../supabase/migrations')).filter(name=>name.endsWith('_refine_global_fixture_admission.sql'));
assert.equal(migrationNames.length,1,'Exactly one prepared admission migration');
const VERSION=migrationNames[0];
const TARGET='public.nothingsports_current_global_fixture_bundle';
const boundary=',\n group_keys AS MATERIALIZED(';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function once(source,from,to){assert.equal(source.split(from).length,2,'Admission source boundary differs');return source.replace(from,()=>to);}
function qualify(source){return source.replace(/\b(FROM|JOIN) (nothingsports_fixture_current|nothingsports_live_scores|nothingsports_fixture_sources)\b/gi,(_m,verb,table)=>verb+' public.'+table).replace(/(?<![.\w])nothingsports_fixture_observation_time\(/g,()=> 'public.nothingsports_fixture_observation_time(');}
function seal(original,refined){
 const cut=s=>{assert.equal(s.split(boundary).length,2,'Admission boundary must be unique');const at=s.indexOf(boundary);return{prefix:s.slice(0,at),tail:s.slice(at)};};
 const a=cut(original),b=cut(refined);assert.equal(b.tail,a.tail,'Changed downstream caps/order/count/clock/payload expression');
 const ah=a.prefix.indexOf('scope_keys AS ('),bh=b.prefix.indexOf('current_keys AS MATERIALIZED(');assert(ah>0&&bh>0);
 assert.equal(b.prefix.slice(0,bh),a.prefix.slice(0,ah),'Changed shared calendar/statement-clock head');
 assert(!/\b(clock_timestamp|random|nextval|currval|setval|timeofday)\s*\(/i.test(a.tail),'Volatile downstream call');
 return{originalPrefix:a.prefix,refinedPrefix:b.prefix,tailSha256:sha(a.tail),headSha256:sha(a.prefix.slice(0,ah))};
}
function candidate(original){
 const initial=prior.candidate(original),marker='scope_keys AS (',start=initial.indexOf(marker),end=initial.indexOf('),\n group_keys AS MATERIALIZED',start);assert(start>0&&end>start);
 const scope=initial.slice(start+marker.length,end),joinStart=scope.indexOf('LEFT JOIN calendar_windows ctx ON '),joinEnd=scope.indexOf('\n                     CROSS JOIN active_window w',joinStart);assert(joinStart>0&&joinEnd>joinStart);
 const join=scope.slice(joinStart,joinEnd),valid=join.slice(join.indexOf(' AND jsonb_typeof(')+' AND '.length);assert(valid.startsWith('jsonb_typeof(ctx.base_window)'));assert.equal((valid.match(/jsonb_typeof/g)||[]).length,20);
 const expressions=/CASE\s+WHEN ctx\.source_id IS NOT NULL THEN\s+(CASE[\s\S]*?END)\s+ELSE\s+(CASE\s+WHEN s\.score \? '[^']*'::text THEN[\s\S]*?END)\s+END AS (\w+)/g;assert.equal([...scope.matchAll(expressions)].length,5);
 let trusted=once(scope,'LEFT JOIN nothingsports_live_scores s USING (source_id, fixture_id)\n                     ','');
 trusted=once(trusted,join,'JOIN valid_calendar_windows ctx ON ctx.source_id=c.source_id AND ctx.fixture_id=c.fixture_id');
 trusted=trusted.replace(expressions,(_all,kept,_raw,name)=>kept+' AS '+name);assert(!trusted.includes('global_fixture')&&!trusted.includes('s.score'));
 const raw=scope.slice(scope.indexOf('CROSS JOIN active_window w')).replace(expressions,(_all,_kept,fallback,name)=>fallback+' AS '+name).replaceAll('s.score','raw.score').replaceAll('c.global_fixture','raw.global_fixture');assert(!raw.includes('ctx.'));
 const fallback=`SELECT c.source_id,c.fixture_id FROM raw_fallback_keys c
 CROSS JOIN LATERAL(SELECT base.global_fixture,s.score
 FROM public.nothingsports_fixture_current base LEFT JOIN public.nothingsports_live_scores s USING(source_id,fixture_id)
 WHERE base.source_id=c.source_id AND base.fixture_id=c.fixture_id OFFSET 0)raw
 ${raw}`;
 const stages=`valid_calendar_windows AS MATERIALIZED(SELECT ctx.* FROM calendar_windows ctx WHERE ${valid}),
 raw_fallback_keys AS MATERIALIZED(SELECT c.source_id,c.fixture_id
 FROM public.nothingsports_fixture_current c JOIN public.nothingsports_fixture_sources src USING(source_id)
 WHERE NOT EXISTS(SELECT 1 FROM valid_calendar_windows ctx WHERE ctx.source_id=c.source_id AND ctx.fixture_id=c.fixture_id)),
 scope_keys AS (${trusted}\n UNION ALL\n ${fallback}`;
 let body=qualify(initial.slice(0,start)+stages+initial.slice(end));
 body=once(body,'valid_calendar_windows AS MATERIALIZED(',`current_keys AS MATERIALIZED(SELECT c.source_id,c.fixture_id
 FROM public.nothingsports_fixture_current c JOIN public.nothingsports_fixture_sources src USING(source_id)),
 valid_calendar_windows AS NOT MATERIALIZED(`);
 body=once(body,'FROM public.nothingsports_fixture_current c JOIN public.nothingsports_fixture_sources src USING(source_id)\n WHERE NOT EXISTS','FROM current_keys c\n WHERE NOT EXISTS');
 body=once(body,'FROM public.nothingsports_fixture_current c\n                     JOIN public.nothingsports_fixture_sources src USING (source_id)\n                     JOIN valid_calendar_windows ctx','FROM current_keys c\n                     JOIN valid_calendar_windows ctx');
 seal(qualify(initial),body);assert.equal(sha(body),BODY_SHA256,'Qualified admission candidate differs');return body;
}
function stagedForward(original){
 const source=prior.forward(original);assert.equal(fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261026021111_use_lossless_global_fixture_groups.sql'),'utf8'),source+'\n','Staged migration differs');return source;
}
function emittedCandidate(original){
 const archived=candidate(original);
 // The qualified input stays exact. Emission deletes this sole whitespace-only
 // line outside SQL literals; no general SQL formatting or token change.
 const marker='\n                \n UNION ALL\n SELECT c.source_id,c.fixture_id FROM raw_fallback_keys c';
 const clean=once(archived,marker,marker.replace('\n                \n','\n'));
 assert.equal(archived.length-clean.length,17,'Only the qualified whitespace line may be deleted');
 assert.equal(sha(clean),EMITTED_BODY_SHA256,'Formatting-clean admission emission differs');
 seal(qualify(prior.candidate(original)),clean);return clean;
}
function metadataGuard(original,expected){
 assert(/^[a-f0-9]{32}$/.test(expected));
 return once(stagedForward(original).split('\nCREATE OR REPLACE VIEW ')[0],prior.ORIGINAL,expected);
}
function lookupGuard(){
 return `DO $admission_guard$ BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_collation c ON c.oid=a.attcollation
 WHERE a.attrelid='public.nothingsports_fixture_current'::regclass AND a.attname IN('source_id','fixture_id')
 AND a.atttypid='text'::regtype AND a.attnotnull AND NOT a.attisdropped AND c.collisdeterministic)<>2
 THEN RAISE EXCEPTION 'Admission requires nonnull text keys with deterministic ordering';END IF;
 ${[['public.nothingsports_fixture_current',['source_id','fixture_id']],['public.nothingsports_fixture_sources',['source_id']],['public.nothingsports_live_scores',['source_id','fixture_id']],['nothingsports_fixture_read_private.fixture_context',['source_id','fixture_id']]].map(([relation,columns])=>`IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
 WHERE c.conrelid='${relation}'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable
 AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indpred IS NULL AND i.indexprs IS NULL
 AND c.conkey=ARRAY[${columns.map(name=>`(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=c.conrelid AND attname='${name}')`).join(',')}]::smallint[])
 THEN RAISE EXCEPTION 'Admission unique lookup contract differs: ${relation}';END IF;`).join('\n ')}
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.nothingsports_fixture_observation_time(text)'::regprocedure AND p.provolatile='s' AND NOT p.prosecdef)
 THEN RAISE EXCEPTION 'Admission clock stability differs';END IF;
 END $admission_guard$;`;
}
function forward(original){
 const source=stagedForward(original),statement='CREATE OR REPLACE VIEW '+source.split('\nCREATE OR REPLACE VIEW ')[1];
 return `BEGIN;\nSET LOCAL search_path=public;\n${metadataGuard(original,STAGED)}\n${lookupGuard()}\n${once(statement,prior.candidate(original),emittedCandidate(original))}\n${metadataGuard(original,REFINED)}\nCOMMIT;\n`;
}
function inverse(original,staged,refinedMd5){
 assert.equal(prior.md5(staged),STAGED,'Inverse staged view differs');
 assert.equal(refinedMd5,REFINED,'Inverse refined view differs');
 return `BEGIN;\nSET LOCAL search_path=public;\n${metadataGuard(original,refinedMd5)}\n${lookupGuard()}\nCREATE OR REPLACE VIEW ${TARGET} WITH(security_invoker=true)AS ${staged.trim().replace(/;$/,'')};\n${metadataGuard(original,STAGED)}\nCOMMIT;\n`;
}
module.exports={STAGED,REFINED,BODY_SHA256,EMITTED_BODY_SHA256,VERSION,candidate,emittedCandidate,qualify,seal,forward,inverse,lookupGuard};
