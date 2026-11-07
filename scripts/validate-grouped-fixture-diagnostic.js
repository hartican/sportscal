'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const producer=require('./prototypes/grouped-fixture-view'),diagnostic=require('./prototypes/grouped-fixture-diagnostic');
const {sampleRows,groupWire}=require('./lib/grouped-fixture-test-wire');
function inspectingQuery(original){return `WITH candidate AS MATERIALIZED(${producer.candidate(original)})
 SELECT statement_timestamp() AS observed_at,current_user AS reader_role,
 json_build_object->>'schemaVersion' AS candidate_schema,(json_build_object->>'complete')::boolean AS candidate_complete,
 (json_build_object->>'groupCount')::integer AS groups,(json_build_object->>'edgeCount')::integer AS edges,
 octet_length(json_build_object::text) AS candidate_json_bytes,md5(json_build_object::text) AS candidate_json_md5,
 extract(epoch FROM(clock_timestamp()-statement_timestamp()))*1000 AS server_statement_elapsed_ms
 FROM candidate`;}
const extractionCount=plan=>(plan.Plan.Output||[]).reduce((n,text)=>n+(text.match(/->> '(?:schemaVersion|complete|groupCount|edgeCount)'/g)||[]).length,0);
(async()=>{
 const db=await require('./fixture-read-test-baseline').database();let checks=0;
 try{
  const major=Math.floor(Number((await db.query("select current_setting('server_version_num')v")).rows[0].v)/10000);assert.equal(major,17,'This allocation uses one existing PG17 fixture only');
  await db.exec("set timezone='UTC'");
  const original=(await db.query("select pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true)d")).rows[0].d;assert.equal(producer.md5(original),producer.ORIGINAL);checks++;
  const rows=sampleRows(),today=(await db.query("select(statement_timestamp()at time zone'Australia/Sydney')::date::text d")).rows[0].d;
  const innings=Array.from({length:2},(_,inning)=>({inning:inning+1,score:{runs:0,wickets:0,overs:'0.0'},batting:Array.from({length:3},(_,i)=>({position:i+1,playerId:'qa-batter:'+i,name:'Constructed player '+i,runs:0,balls:0,fours:0,sixes:0,strikeRate:0,dismissal:null,sourceNotes:['constructed statistic','original receipt retained']})),bowling:Array.from({length:1},(_,i)=>({position:i+1,playerId:'qa-bowler:'+i,name:'Constructed bowler '+i,overs:'0.0',maidens:0,runs:0,wickets:0,economy:0,detail:null}))}));
  for(const row of rows){row.fixture={...row.fixture,key:'cricket',date:today,scorecard:{schemaVersion:'constructed-detail.v1',innings}};}
  const constructedWireBytes=Buffer.byteLength(JSON.stringify([{bundle:groupWire(rows)}]));
  await db.query("insert into public.nothingsports_fixture_sources(source_id)select distinct r->>'source_id'from jsonb_array_elements($1::jsonb)r",[JSON.stringify(rows)]);
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select r->>'source_id',r->>'fixture_id',array(select jsonb_array_elements_text(r->'identity_keys')),r->'fixture',md5(r::text)from jsonb_array_elements($1::jsonb)r",[JSON.stringify(rows)]);
  const before=(await db.query("select md5(string_agg(content_hash,''order by source_id,fixture_id))h from public.nothingsports_fixture_current")).rows[0].h;
  const old=inspectingQuery(original),corrected=diagnostic.query(original);
  async function run(query,{plan=false}={}){
   await db.exec("BEGIN READ ONLY;SET LOCAL statement_timeout='"+(plan?'3s':'6s')+"';SET LOCAL lock_timeout='1s';SET LOCAL ROLE service_role;");
   try{const began=performance.now(),result=await db.query((plan?'EXPLAIN(VERBOSE,FORMAT JSON) ':'')+query);return{rows:result.rows,localRoundTripMs:performance.now()-began};}
   finally{await db.exec('ROLLBACK');}
  }
  const oldPlan=(await run(old,{plan:true})).rows[0]['QUERY PLAN'][0],newPlan=(await run(corrected,{plan:true})).rows[0]['QUERY PLAN'][0];
  const oldExtractions=extractionCount(oldPlan),newExtractions=extractionCount(newPlan);
  assert.equal(oldExtractions,4);assert.throws(()=>assert.equal(oldExtractions,0));checks++;
  console.log(JSON.stringify({control:'RED_OLD_DIAGNOSTIC_REPARSES_METADATA',topLevelMetadataExpressions:oldExtractions,scope:'LOCAL_PG17_EXPLAIN_NO_ANALYZE_NOT_PHYSICAL_SCAN_COUNTS'}));
  assert.equal(newExtractions,0);checks++;
  const measurements={};
  for(const[name,query]of[['inspecting',old],['corrected',corrected]]){
   try{const result=await run(query);assert.equal(result.rows.length,1);measurements[name]={...result.rows[0],localRoundTripMs:result.localRoundTripMs,statementLimitMs:6000};}
   catch(error){measurements[name]={cancelled:error.code==='57014',code:error.code||null,statementLimitMs:6000};}
  }
  const output=process.env.GROUPED_DIAGNOSTIC_OUTPUT;
  if(output){fs.mkdirSync(output,{recursive:true});for(const[name,value]of[['old-explain.json',oldPlan],['corrected-explain.json',newPlan],['measurements.json',measurements]])fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');fs.writeFileSync(path.join(output,'corrected-producer-body.sql'),corrected+';\n');}
  assert(!measurements.inspecting.cancelled&&!measurements.corrected.cancelled,'A timed-out local variant remains unqualified; do not infer producer speed');
  const value=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['observed_at','server_statement_elapsed_ms','localRoundTripMs','statementLimitMs'].includes(key)));
  assert.deepEqual(value(measurements.corrected),value(measurements.inspecting));checks++;
  assert.equal(measurements.corrected.groups,2586);assert.equal(measurements.corrected.edges,5145);assert.equal(measurements.corrected.candidate_complete,true);checks++;
  assert(measurements.corrected.candidate_json_bytes>=12_000_000&&measurements.corrected.candidate_json_bytes<=16*1024*1024,'Retain the representative bounded ~13MB frame');checks++;
  assert.equal((await db.query("select md5(string_agg(content_hash,''order by source_id,fixture_id))h from public.nothingsports_fixture_current")).rows[0].h,before);checks++;
  assert.equal((await db.query("select md5(pg_get_viewdef('public.nothingsports_current_global_fixture_bundle'::regclass,true))h")).rows[0].h,producer.ORIGINAL);checks++;
  console.log(JSON.stringify({schemaVersion:'grouped-diagnostic-work-test.v1',major,checks,fixtureInstances:1,sourceEdges:5145,storageKeys:2586,constructedWireBytes,projectedFrameBytes:measurements.corrected.candidate_json_bytes,oldMetadataExpressions:oldExtractions,correctedMetadataExpressions:newExtractions,frameHashAndMetadataEqual:true,producerSourceChanged:false,viewChanged:false,queryOrder:['inspecting-first','corrected-second'],warmingRequests:0,executionPlans:'EXPLAIN_ONLY_NO_ANALYZE',statementLimitMs:6000,timeoutOrMemorySettingsRaised:false,productionRequests:0,nativeOrHostedSpeed:'UNPROVEN'}));
 }finally{await db.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
