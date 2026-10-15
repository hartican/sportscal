'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
async function check(db,args,{original='public.ns_test_original_participant_bundle',candidate='public.nothingsports_read_participant_fixture_bundle'}={}){
 const results=[],source='discovery-local-context-check',id='lab:context:match',shared='lab:context:shared';
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stamp=new Date(Date.now()-60000).toISOString(),home='competitor:tennis:atp:lab-a',away='competitor:tennis:atp:lab-b';
 const localArgs=[args[0],args[1],[...args[2],home],[...args[3],shared]];
 async function equal(label){
  const started=performance.now(),r=(await db.query(`SELECT ${original}($1,$2,$3,$4) original,${candidate}($1,$2,$3,$4) candidate,public.nothingsports_read_fixture_bundle_part('participants',0,$1,$2,$3,$4) part0,public.nothingsports_read_fixture_bundle_part('participants',1,$1,$2,$3,$4) part1`,localArgs)).rows[0];
  let partCalls=0;const merged=await require('../lib/fixture-bundle-parts').readBundleParts(async(name,body)=>{assert.equal(body.p_part,partCalls++);return r['part'+body.p_part];},{scope:'participants',sportKeys:localArgs[0],knownSportKeys:localArgs[1],participantIds:localArgs[2],requiredIds:localArgs[3]});
  assert.equal(partCalls,2);assert.deepEqual(merged.rows,r.original.rows,label+' both complete parts agree');
  assert.deepEqual(r.candidate,r.original,label);assert.equal(r.candidate.complete,true,label+' complete');
  results.push({label,fullOutputAgreement:true,partitionedOutputAgreement:true,rows:r.candidate.rows.length,comparisonMs:Math.round(performance.now()-started)});

 }
 const fixture=(extra={})=>({id,key:'tennis',date:day,status:'upcoming',startTimeUtc:new Date(Date.now()+3600000).toISOString(),homeParticipantId:home,awayParticipantId:away,participantIds:[home,away],sourceCheckedAt:stamp,...extra});
 await db.query('INSERT INTO public.nothingsports_fixture_sources(source_id) VALUES($1)',[source]);
 async function publish(f,s,report={}){
  const token=crypto.randomUUID();await db.query('UPDATE public.nothingsports_fixture_sources SET next_due_at=clock_timestamp() WHERE source_id=$1',[source]);
  const claimed=(await db.query('SELECT * FROM public.nothingsports_claim_fixture_source($1,$2)',[source,token])).rows;assert(claimed.length);
  await db.query('SELECT public.nothingsports_publish_compact_scores($1,$2,$3,$4,$5,$6,$7)',[source,token,JSON.stringify([f]),JSON.stringify([s]),crypto.randomUUID(),120000,JSON.stringify(report)]);
 }
 await publish(fixture(),{id,status:'upcoming'});await equal('Real local canonical publisher creates indexed fixture and score context');
 await publish(fixture({status:'completed'}),{id,status:'completed',homeScore:0,awayScore:0,scoreCheckedAt:stamp,statusCheckedAt:stamp},{_fixtureObservations:{[id]:{s:stamp,t:stamp}}});await equal('Zero final scores and original observation dates');
 const before=(await db.query('SELECT ctid::text AS row_version FROM nothingsports_fixture_read_private.fixture_context WHERE source_id=$1 AND fixture_id=$2',[source,id])).rows[0];
 await db.query("UPDATE public.nothingsports_live_scores SET score=score||jsonb_build_object('scoreCheckedAt',$3::text,'homeScore',1) WHERE source_id=$1 AND fixture_id=$2",[source,id,new Date().toISOString()]);
 const after=(await db.query('SELECT ctid::text AS row_version FROM nothingsports_fixture_read_private.fixture_context WHERE source_id=$1 AND fixture_id=$2',[source,id])).rows[0];assert.deepEqual(after,before,'Score/receipt changes do not rewrite selection metadata');await equal('Ordinary score/receipt updates avoid index churn');
 for(const [label,change] of [
  ['Explicit kickoff and participant withdrawals',{startTimeUtc:null,homeParticipantId:null,participantIds:[]}],
  ['Score key clears rather than falling back',{key:null}],
  ['Participant identity changes',{homeParticipantId:'competitor:tennis:atp:lab-c',participantIds:['competitor:tennis:atp:lab-c',away]}],
  ['Future score dates remain rejected by the original projector',{scoreCheckedAt:'2099-01-01T00:00:00Z',statusCheckedAt:'2099-01-01T00:00:00Z'}]
 ]){
  await db.query('UPDATE public.nothingsports_live_scores SET score=score||$3::jsonb WHERE source_id=$1 AND fixture_id=$2',[source,id,JSON.stringify(change)]);await equal(label);
 }
 await db.query('DELETE FROM public.nothingsports_live_scores WHERE source_id=$1 AND fixture_id=$2',[source,id]);await equal('Deleting a score restores base identity context');
 await db.query('UPDATE public.nothingsports_fixture_current SET fixture=fixture||$3::jsonb,identity_keys=$4 WHERE source_id=$1 AND fixture_id=$2',[source,id,JSON.stringify({date:'2099-01-01',startTimeUtc:'2099-01-01T12:00:00Z',participantIds:{[home]:true}}),[id,shared]]);await equal('Moved protected alias and object participant-key semantics');
 const second='lab:context:second';await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) VALUES($1,$2,$3,$4,$5)',[source,second,JSON.stringify(fixture({id:second})),[second,shared],second]);
 await db.query('DELETE FROM public.nothingsports_fixture_current WHERE source_id=$1 AND fixture_id=$2',[source,id]);
 assert.equal((await db.query('SELECT count(*) n FROM nothingsports_fixture_read_private.source_tokens WHERE source_id=$1 AND kind=1 AND token=$2',[source,shared])).rows[0].n,1);await equal('Removing one match preserves a shared source token');
 await db.query('DELETE FROM public.nothingsports_fixture_current WHERE source_id=$1 AND fixture_id=$2',[source,second]);
 assert.equal((await db.query('SELECT count(*) n FROM nothingsports_fixture_read_private.source_tokens WHERE source_id=$1 AND token=$2',[source,shared])).rows[0].n,0);await equal('Removing the final token member clears only derived metadata');
 const sentinel='lab:context:sentinel';
 await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) VALUES($1,$2,$3,$4,$5)',[source,sentinel,JSON.stringify(fixture({id:sentinel})),[sentinel],sentinel]);
 const keySource='discovery-local-key-check',keyId='lab:context:key';
 await db.query('INSERT INTO public.nothingsports_fixture_sources(source_id) VALUES($1)',[keySource]);
 await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) VALUES($1,$2,$3,$4,$5)',[keySource,keyId,JSON.stringify(fixture({id:keyId,key:'nrl',homeParticipantId:'team:cricket:lab-key-a',awayParticipantId:'team:cricket:lab-key-b',participantIds:[]})),[keyId],keyId]);
 await db.query('INSERT INTO public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) VALUES($1,$2,$3,$4)',[keySource,keyId,JSON.stringify({id:keyId}),keyId]);
 const ids=async()=>((await db.query(`SELECT ${candidate}($1,$2,$3,$4) value`,localArgs)).rows[0].value.rows.map(r=>r.fixture_id));
 assert(!(await ids()).includes(keyId));
 await db.query("UPDATE public.nothingsports_live_scores SET score=score||'{\"key\":null}'::jsonb WHERE source_id=$1 AND fixture_id=$2",[keySource,keyId]);
 assert((await ids()).includes(keyId));await equal('Explicit unknown score key includes its complete source group');
 await db.query("UPDATE public.nothingsports_live_scores SET score=score-'key' WHERE source_id=$1 AND fixture_id=$2",[keySource,keyId]);
 assert(!(await ids()).includes(keyId));await equal('Absent score key restores the known base classification');
 for(const value of [null,'target',23,true,['target',23,true,{target:true}],{target:true},[],{}]){
  const r=(await db.query("SELECT coalesce($1::jsonb ?| ARRAY['target'],false) AS original,nothingsports_fixture_read_private.top_match_keys($1::jsonb)&&ARRAY['target'] AS candidate",[JSON.stringify(value)])).rows[0];assert.equal(r.candidate,r.original);
 }
 results.push({label:'Array, object, scalar and null JSON membership follows native semantics',cases:8,passed:true});
 for(const role of ['anon','authenticated']){
  await db.exec('SET ROLE '+role);await assert.rejects(db.query(`SELECT ${candidate}($1,$2,$3,$4)`,args),/permission denied/);await assert.rejects(db.query('SELECT * FROM nothingsports_fixture_read_private.fixture_context LIMIT 1'),/permission denied/);await db.exec('RESET ROLE');
 }
 await db.exec('SET ROLE service_role');assert.equal((await db.query(`SELECT ${candidate}($1,$2,$3,$4) value`,args)).rows[0].value.complete,true);
 await db.query("UPDATE public.nothingsports_fixture_current SET fixture=fixture||'{\"homeParticipantId\":null}'::jsonb WHERE source_id=$1 AND fixture_id=$2",[source,sentinel]);
 await db.exec('RESET ROLE');await equal('Canonical service role can maintain private lookup metadata');
 results.push({label:'Anonymous/authenticated cannot access the private lookup; service caller can',passed:true});
 await db.exec('BEGIN');await db.query('DELETE FROM nothingsports_fixture_read_private.fixture_context WHERE source_id=(SELECT source_id FROM public.nothingsports_fixture_current ORDER BY source_id,fixture_id LIMIT 1) AND fixture_id=(SELECT fixture_id FROM public.nothingsports_fixture_current ORDER BY source_id,fixture_id LIMIT 1)');
 assert.equal((await db.query(`SELECT ${candidate}($1,$2,$3,$4) value`,args)).rows[0].value.complete,false);await db.exec('ROLLBACK');
 results.push({label:'Missing metadata fails closed and transaction rollback restores it',passed:true});
 await db.exec('BEGIN');await db.query('UPDATE nothingsports_fixture_read_private.fixture_context SET shape_version=2 WHERE source_id=$1 AND fixture_id=$2',[source,sentinel]);
 const unsupported=(await db.query(`SELECT ${candidate}($1,$2,$3,$4) value`,args)).rows[0].value;assert.equal(unsupported.complete,false);assert.equal(unsupported.rows.length,0);await db.exec('ROLLBACK');
 results.push({label:'Unsupported metadata version reports incomplete rather than dropping matches',passed:true});
 // Exercise the memoised clocks through complete actual readers, not a mirror
 // of the patch expression. Distinct bad/offset/future/missing values retain
 // the original parser's result and source/receipt precedence.
 const clockSource='discovery-local-clock-check',clockValues=[undefined,null,'invalid','2026-02-30T00:00:00Z',new Date(Date.now()+600000).toISOString(),stamp,stamp.replace('Z','+00:00')],clockRows=[],clockReceipts={};
 for(let b=0;b<clockValues.length;b++)for(let s=0;s<clockValues.length;s++)for(let r=0;r<clockValues.length;r++)for(const complete of [false,true]){
  const fixtureId='lab:clock:'+clockRows.length;
  const base=fixture({id:fixtureId,scoreCheckedAt:clockValues[b],statusCheckedAt:clockValues[(b+1)%clockValues.length]});
  const score={id:fixtureId,homeScore:0,awayScore:0,scoreCheckedAt:clockValues[s],statusCheckedAt:clockValues[(s+2)%clockValues.length]};
  clockRows.push({fixture_id:fixtureId,fixture:base,score,first_completed_at:complete?stamp:null});
  clockReceipts[fixtureId]={s:clockValues[r],t:clockValues[(r+3)%clockValues.length]};
 }
 for(const rawClock of [null,[],[0],'text',0,false]){
  const fixtureId='lab:clock:'+clockRows.length;
  clockRows.push({fixture_id:fixtureId,fixture:fixture({id:fixtureId,scoreCheckedAt:stamp,statusCheckedAt:stamp}),score:{id:fixtureId,scoreCheckedAt:rawClock,statusCheckedAt:rawClock},first_completed_at:stamp});
  clockReceipts[fixtureId]={s:stamp,t:stamp};
 }
 await db.query('INSERT INTO public.nothingsports_fixture_sources(source_id,discovery_report) VALUES($1,$2::jsonb)',[clockSource,JSON.stringify({_fixtureObservations:clockReceipts})]);
 await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) SELECT $1,fixture_id,fixture,ARRAY[fixture_id],fixture_id FROM jsonb_to_recordset($2::jsonb) r(fixture_id text,fixture jsonb)',[clockSource,JSON.stringify(clockRows)]);
 await db.query('INSERT INTO public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) SELECT $1,fixture_id,score,fixture_id,first_completed_at FROM jsonb_to_recordset($2::jsonb) r(fixture_id text,score jsonb,first_completed_at timestamptz)',[clockSource,JSON.stringify(clockRows)]);
 await equal('All '+clockRows.length+' controlled clock combinations retain full output');
 await db.query('DELETE FROM public.nothingsports_fixture_sources WHERE source_id=$1',[clockSource]);
 const corruptions=[
  ['Missing fixture identity link',"DELETE FROM nothingsports_fixture_read_private.fixture_tokens WHERE (source_id,fixture_id,kind,token)=(SELECT source_id,fixture_id,kind,token FROM nothingsports_fixture_read_private.fixture_tokens WHERE kind=1 ORDER BY source_id,fixture_id,token LIMIT 1)"],
  ['Missing same-side fixture link',"DELETE FROM nothingsports_fixture_read_private.fixture_tokens WHERE (source_id,fixture_id,kind,token)=(SELECT source_id,fixture_id,kind,token FROM nothingsports_fixture_read_private.fixture_tokens WHERE kind=2 ORDER BY source_id,fixture_id,token LIMIT 1)"],
  ['Wrong fixture link with unchanged row count',"UPDATE nothingsports_fixture_read_private.fixture_tokens SET token='lab:context:wrong' WHERE (source_id,fixture_id,kind,token)=(SELECT source_id,fixture_id,kind,token FROM nothingsports_fixture_read_private.fixture_tokens ORDER BY source_id,fixture_id,kind,token LIMIT 1)"],
  ['Unexpected fixture link',"INSERT INTO nothingsports_fixture_read_private.fixture_tokens SELECT source_id,fixture_id,1,'lab:context:extra' FROM nothingsports_fixture_read_private.fixture_context ORDER BY source_id,fixture_id LIMIT 1"],
  ['Missing source link',"DELETE FROM nothingsports_fixture_read_private.source_tokens WHERE (source_id,kind,token)=(SELECT source_id,kind,token FROM nothingsports_fixture_read_private.source_tokens ORDER BY source_id,kind,token LIMIT 1)"],
  ['Wrong source link with unchanged row count',"UPDATE nothingsports_fixture_read_private.source_tokens SET token='lab:context:wrong' WHERE (source_id,kind,token)=(SELECT source_id,kind,token FROM nothingsports_fixture_read_private.source_tokens ORDER BY source_id,kind,token LIMIT 1)"],
  ['Unreferenced source link',"INSERT INTO nothingsports_fixture_read_private.source_tokens SELECT source_id,1,'lab:context:extra' FROM public.nothingsports_fixture_sources ORDER BY source_id LIMIT 1"]
 ];
 for(const [label,sql] of corruptions){
  await db.exec('BEGIN');const changed=await db.query(sql);assert(changed.affectedRows>0,label+' changes a populated row');
  const broken=(await db.query(`SELECT ${candidate}($1,$2,$3,$4) value`,args)).rows[0].value;
  assert.equal(broken.complete,false,label);assert.equal(broken.rows.length,0,label);
  const part=(await db.query("SELECT public.nothingsports_read_fixture_bundle_part('participants',0,$1,$2,$3,$4) value",args)).rows[0].value;
  assert.equal(part.complete,false,label+' parts fail closed');assert.equal(part.rows.length,0,label+' no partial rows');await db.exec('ROLLBACK');
  results.push({label:label+' fails closed',passed:true});
 }
 // Inject only the calendar reference into each actual reader body. The real
 // fact/observation projector and all selection rules remain unchanged.
 for(const [name,reader] of [['original',original],['candidate',candidate]]){
  const body=(await db.query('SELECT prosrc FROM pg_proc WHERE oid=($1||\'(text[],text[],text[],text[])\')::regprocedure',[reader])).rows[0].prosrc;
  const clock="(statement_timestamp() at time zone 'Australia/Sydney')::date";assert(body.includes(clock));
  await db.exec(`CREATE FUNCTION public.ns_test_${name}_at_day(p_sport_keys text[],p_known_sport_keys text[],p_participant_ids text[],p_required_ids text[],p_reference_day date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $test$${body.replace(clock,'p_reference_day')}$test$;`);
 }
 const boundarySource='discovery-local-day-boundary',boundaryId='lab:context:day-boundary';
 const lastWeek=new Date(new Date(day+'T00:00:00Z').getTime()-7*86400000).toISOString().slice(0,10);
 await db.query('INSERT INTO public.nothingsports_fixture_sources(source_id) VALUES($1)',[boundarySource]);
 await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) VALUES($1,$2,$3,$4,$5)',[boundarySource,boundaryId,JSON.stringify(fixture({id:boundaryId,date:lastWeek,status:'completed',startTimeUtc:lastWeek+'T12:00:00Z',homeParticipantId:'competitor:tennis:atp:lab-midnight-a',awayParticipantId:'competitor:tennis:atp:lab-midnight-b',participantIds:[]})),[boundaryId],boundaryId]);
 for(const reference of [day,new Date(new Date(day+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10)]){
  const r=(await db.query('SELECT public.ns_test_original_at_day($1,$2,$3,$4,$5) original,public.ns_test_candidate_at_day($1,$2,$3,$4,$5) candidate',[...localArgs,reference])).rows[0];
  assert.deepEqual(r.candidate,r.original);assert.equal(r.candidate.rows.some(row=>row.fixture_id===boundaryId),reference===day,'The seven-day boundary advances without a metadata refresh');
  results.push({label:'Calendar-window agreement at '+reference,fullOutputAgreement:true});
 }
 const sizes=(await db.query("SELECT sum(pg_total_relation_size(c.oid)) bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nothingsports_fixture_read_private' AND c.relkind='r'")).rows[0];
 return {checks:results.length,results,derivedTableAllocatedBytes:sizes.bytes,productionChanged:false,localCanonicalPublisher:true,physicalPhone:false};
}

async function run(){
 const fs=require('node:fs'),{database}=require('./validate-profile-fixture-scope'),registry=require('../config/sport-domain-registry');
 const db=await database({withReadContext:false});
 try{
  const definition=(await db.query("SELECT pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure) definition")).rows[0].definition;
  await db.exec(definition.replace('public.nothingsports_read_participant_fixture_bundle','public.ns_test_original_participant_bundle'));
  await db.exec('REVOKE ALL ON FUNCTION public.ns_test_original_participant_bundle(text[],text[],text[],text[]) FROM public,anon,authenticated;GRANT EXECUTE ON FUNCTION public.ns_test_original_participant_bundle(text[],text[],text[],text[]) TO service_role;');
  const prepared=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_prepare_participant_fixture_context.sql'));assert(prepared);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await db.exec("INSERT INTO public.nothingsports_fixture_sources(source_id) VALUES('discovery-local-preparation');");
  for(const id of ['before-one','before-two'])await db.query('INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) VALUES($1,$2,$3,$4,$2)',['discovery-local-preparation',id,JSON.stringify({id,key:'tennis',date:day,status:'upcoming',participantIds:['competitor:tennis:atp:lab-a']}),[id]]);
  await db.exec('BEGIN;\n'+fs.readFileSync('supabase/migrations/'+prepared,'utf8')+'\nCOMMIT;');
  const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_index_participant_fixture_context.sql'));assert(migration);
  await db.exec('BEGIN');await assert.rejects(db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8')),/preparation incomplete/);await db.exec('ROLLBACK');
  const unchanged=(await db.query("SELECT pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure) definition")).rows[0].definition;
  assert.equal(unchanged,definition,'Incomplete preparation leaves the original reader active');
  for(const limit of [0,129,null])await assert.rejects(db.query('SELECT nothingsports_fixture_read_private.backfill_batch($1)',[limit]),/Backfill batch/);
  for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT nothingsports_fixture_read_private.backfill_batch(1)'),/permission denied/);await db.exec('RESET ROLE');}
  const first=(await db.query('SELECT nothingsports_fixture_read_private.backfill_batch(1) value')).rows[0].value;assert.equal(first.processed,1);assert.equal(first.remaining,1);assert.equal(first.complete,false);
  await db.query("UPDATE public.nothingsports_fixture_current SET fixture=fixture||'{\"homeParticipantId\":\"competitor:tennis:atp:lab-b\"}'::jsonb WHERE fixture_id='before-two'");
  const done=(await db.query('SELECT nothingsports_fixture_read_private.backfill_batch(1) value')).rows[0].value;assert.equal(done.processed,0);assert.equal(done.complete,true,'An ordinary writer fills a still-pending row before resumption');
  await db.exec('BEGIN;\n'+fs.readFileSync('supabase/migrations/'+migration,'utf8')+'\nCOMMIT;');
  assert.equal((await db.query("SELECT to_regprocedure('nothingsports_fixture_read_private.backfill_batch(integer)') IS NULL absent")).rows[0].absent,true,'One-time preparation helper is removed after activation');
  const clocks=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_reuse_participant_observation_clocks.sql'));
  if(clocks)await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+clocks,'utf8')+'COMMIT;');
  for(const suffix of ['_restore_participant_reader_before_clock_rework.sql','_map_participant_observation_clocks.sql','_retain_indexed_participant_reader_before_parts.sql','_partition_current_fixture_bundle.sql','_reuse_fixture_part_work.sql','_serialize_fixture_part_response.sql','_stabilize_fixture_part_plan.sql','_index_required_fixture_selection.sql','_defer_fixture_payload_projection.sql']){
   const next=fs.readdirSync('supabase/migrations').find(n=>n.endsWith(suffix));
   if(next)await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+next,'utf8')+'COMMIT;');
  }
  const result=await check(db,[['tennis'],Object.keys(registry.byKey).sort(),['competitor:tennis:atp:lab-a'],[]]);
  console.log(JSON.stringify({passed:true,checks:result.checks,migration,limits:'Actual isolated schema, original/new readers and canonical publisher. Full captured-world comparison and production timing are separate.'}));
  return result;
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(JSON.stringify({message:e.message,code:e.code}));process.exitCode=1;});
module.exports={check,run};
