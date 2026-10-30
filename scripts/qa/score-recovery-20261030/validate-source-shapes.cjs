'use strict';
// Constructed public inputs only. The original failed live body is unavailable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const P=require('./protocol.cjs'),{Transport}=require('./transport.cjs');
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'public-fixture-shape.json'),'utf8'));
const marker=process.env.NS_SOURCE_SHAPE_TEST_KEY||'sb_secret_'+crypto.randomBytes(36).toString('base64url'),secret=P.privacy([marker]);
const index=key=>Object.keys(schema.paths).sort().indexOf(key),checks=[],rejections=[];
function check(name,run){run();checks.push(name);}
function refusal(fixture,code='POST_GUARD_FIXTURE_SHAPE'){
 let error;try{P.validatePublic([{source_id:'cricket-ca-current',fixture_id:fixture.id,fixture}],schema,secret);}catch(e){error=e;}
 assert.equal(error?.code,code);return error;
}
function base(){return{id:'fixture:cricket:CA:50000',key:'cricket',status:'scheduled',name:'Constructed public fixture',sourceCheckedAt:'2026-10-13T11:30:00Z'};}
function descriptors(){
 check('unknown-name-never-exported',()=>{
  const e=refusal({...base(),['unapproved-'+marker]:{note:'private value withheld'}}),d=P.shapeFailure(e);
  assert.deepEqual(d,{reason:'UNKNOWN_PATH',parentIndex:index(''),actualType:'object'});assert(!secret.contains(JSON.stringify(d)));assert.equal(e.message,'POST_GUARD_FIXTURE_SHAPE');
 });
 check('known-path-wrong-type',()=>{const e=refusal({...base(),name:{private:marker}});assert.deepEqual(P.shapeFailure(e),{reason:'TYPE_NOT_ALLOWED',pathIndex:index('.name'),actualType:'object'});});
 check('nonfinite-known-number',()=>{const e=refusal({...base(),homeScore:Infinity});assert.deepEqual(P.shapeFailure(e),{reason:'NON_FINITE_NUMBER',pathIndex:index('.homeScore'),actualType:'number'});});
 check('nearest-parent-only',()=>{const e=refusal({...base(),participants:[{id:'home',name:'Home',['unknown-'+marker]:false}]});assert.deepEqual(P.shapeFailure(e),{reason:'UNKNOWN_PATH',parentIndex:index('.participants[]'),actualType:'boolean'});});
 check('path-delimiter-cannot-impersonate-known-child',()=>{const e=refusal({...base(),'participants[].id':'not a participant object'});assert.deepEqual(P.shapeFailure(e),{reason:'UNKNOWN_PATH',parentIndex:index(''),actualType:'string'});});
 check('forged-diagnostic-not-exportable',()=>{
  const e=Object.assign(Error(marker),{code:'POST_GUARD_FIXTURE_SHAPE',shapeFailure:{reason:marker,pathIndex:0,actualType:'string'},shapeFailures:{descriptors:[marker]}});assert.equal(P.shapeFailure(e),undefined);assert.equal(P.shapeFailures(e),undefined);
 });
 check('private-key-remains-private-rejection',()=>assert.equal(P.shapeFailure(refusal({...base(),preferences:{note:marker}},'POST_GUARD_PRIVATE_PAYLOAD')),undefined));
 check('summary-deduplicates-without-unknown-subtree-traversal',()=>{
  const fixture=base();for(let n=0;n<6;n++){const value={};Object.defineProperty(value,'mustNotTraverse',{enumerable:true,get(){throw Error('UNKNOWN_SUBTREE_VISITED');}});fixture['unknown-'+n+'-'+marker]=value;}
  const summary=P.shapeFailures(refusal(fixture));assert.equal(summary.totalRefusals,6);assert.equal(summary.overflowCount,0);assert.equal(summary.knownScanComplete,true);assert.deepEqual(summary.descriptors,[{reason:'UNKNOWN_PATH',parentIndex:index(''),actualType:'object',count:6}]);assert(!secret.contains(JSON.stringify(summary)));
 });
 check('summary-bounded-to-sixteen-descriptors',()=>{
  const fixture=base(),keys=Object.keys(schema.paths).filter(k=>/^\.[a-zA-Z][a-zA-Z0-9]*$/.test(k)&&k!=='.id'&&!schema.paths[k].includes('object')).slice(0,20);assert.equal(keys.length,20);for(const key of keys)fixture[key.slice(1)]={};
  const summary=P.shapeFailures(refusal(fixture));assert.equal(summary.totalRefusals,20);assert.equal(summary.descriptors.length,16);assert.equal(summary.overflowCount,4);assert.equal(summary.knownScanComplete,true);
 });
 check('summary-keeps-first-refusal-and-stops-at-private-field',()=>{
  const e=refusal({...base(),unapprovedFirst:{},preferences:{private:'not admitted'}}),s=P.shapeFailures(e);assert.equal(e.code,'POST_GUARD_FIXTURE_SHAPE');assert.equal(s.totalRefusals,1);assert.equal(s.knownScanComplete,false);
 });
 check('summary-delimiter-children-retain-node-budget',()=>{
  const fixture={id:base().id,'unknown.first':{},'unknown.second':{},'unknown.third':{}},limited={...schema,maxNodes:4};let e;
  try{P.validatePublic([{source_id:'cricket-ca-current',fixture_id:fixture.id,fixture}],limited,secret);}catch(error){e=error;}
  assert.equal(e?.code,'POST_GUARD_FIXTURE_SHAPE');const s=P.shapeFailures(e);assert.equal(s.totalRefusals,2);assert.equal(s.knownScanComplete,false);
 });
 check('summary-stops-at-existing-request-deadline',()=>{
  const fixture={id:base().id,unknownFirst:{},unknownSecond:{}},row={source_id:'cricket-ca-current',fixture_id:fixture.id,fixture};let visits=0,e;
  try{P.validatePublic([row],schema,secret,()=>{if(++visits===5)throw P.error('POST_GUARD_BODY_DEADLINE');});}catch(error){e=error;}
  assert.equal(e?.code,'POST_GUARD_FIXTURE_SHAPE');assert.equal(visits,5);assert.equal(P.shapeFailures(e).totalRefusals,1);assert.equal(P.shapeFailures(e).knownScanComplete,false);
 });
 check('pause-object-typed-only',()=>{
  const f={...base(),pauseObservation:{status:'break',reason:'lunch',observedAt:'2026-10-13T11:30:00Z'}};
  P.validatePublic([{source_id:'cricket-ca-current',fixture_id:f.id,fixture:f}],schema,secret);
  const e=refusal({...f,pauseObservation:{...f.pauseObservation,['unknown-'+marker]:1}});assert.deepEqual(P.shapeFailure(e),{reason:'UNKNOWN_PATH',parentIndex:index('.pauseObservation'),actualType:'number'});
 });
}
async function main(){
 descriptors();
 if(!process.argv.includes('--descriptor-only'))await producerModels();
 report({status:'PASS',scope:process.argv.includes('--descriptor-only')?'synthetic value-free descriptor controls only':'actual source producers, in-memory checked-in SQL RPC, actual SDK/readRows/project caller and guard; constructed inputs only',checks:checks.length,names:checks,rejections,realServiceRequests:0,realKeys:0});
}
function report(value){const body=JSON.stringify(value);assert(!secret.contains(body));const at=process.argv.indexOf('--report');if(at>=0)fs.writeFileSync(process.argv[at+1],body+'\n',{mode:0o600});console.log(body);}
async function producerModels(){
 for(const key of ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])assert(!process.env[key]);
 const at=process.argv.indexOf('--source-root');assert(at>=0);const root=path.resolve(process.argv[at+1]);
 const code=rel=>path.join(root,rel),read=rel=>JSON.parse(fs.readFileSync(code(rel),'utf8'));
 // The local database is WASM/in-memory. No service, provider or native HTTP
 // path is admitted, even if a producer accidentally gains a network call.
 const deny=()=>{throw Error('CONSTRUCTED_SOURCE_NETWORK_FORBIDDEN');};global.fetch=deny;
 for(const name of ['http','https'])for(const key of ['request','get'])require('node:'+name)[key]=deny;
 for(const [name,keys]of [['net',['connect','createConnection']],['tls',['connect']],['dns',['lookup','resolve','resolve4','resolve6']]])for(const key of keys)require('node:'+name)[key]=deny;
 require('node:net').Socket.prototype.connect=deny;
 const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[root,...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]})),db=new PGlite();
 try{
  await db.exec("set timezone='UTC';create table public.nothingsports_fixture_current(source_id text,fixture_id text,fixture jsonb,identity_keys text[]);create table public.nothingsports_fixture_sources(source_id text,discovery_report jsonb);create table public.nothingsports_live_scores(source_id text,fixture_id text,score jsonb,first_completed_at timestamptz);");
  const sql=fs.readFileSync(code('supabase/migrations/20261002171936_preserve_compact_fixture_observations.sql'),'utf8');
  for(const name of ['nothingsports_fixture_observation_time','nothingsports_project_fixture_observations','nothingsports_read_current_fixtures']){
   const start=sql.indexOf('create or replace function public.'+name+'('),end=sql.indexOf('$$;',start)+3;assert(start>=0&&end>start);await db.exec(sql.slice(start,end));
  }
  const source=require(code('lib/source-coverage')),pause=require(code('lib/fixture-pause-observations')),compact=require(code('lib/compact-fixture-observations'));
  const caller=require(code('scripts/sync-live-coverage')),sdk=require(code('lib/supabase-server'));
  const sample=read('scripts/fixtures/source-coverage/cricket-australia-abandoned.json'),models=[];
  for(const phase of ['scheduled','live','paused','final','abandoned']){
   const game={...structuredClone(sample.fixture),isCompleted:['final','abandoned'].includes(phase),isLive:phase==='live',isInProgress:['live','paused'].includes(phase),gameStatus:phase==='paused'?'Lunch':phase==='live'?'Live':phase==='scheduled'?'Scheduled':'Completed',resultType:phase==='abandoned'?'Abandoned':phase==='final'?'Won':null,resultTypeId:phase==='abandoned'?'Abandoned':phase==='final'?'Won':null};
   let fixture=source.parseCricketFixtures([game],{sourceUrl:sample.sourceUrl,checkedAt:sample.checkedAt})[0];
   if(phase==='paused'){
    fixture=pause.pauseObservations([fixture],{observedFixtures:[fixture],now:new Date(sample.checkedAt)}).fixtures[0];
    assert.deepEqual(Object.keys(fixture.pauseObservation).sort(),['observedAt','reason','status']);
    const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'public-fixture-shape.baseline.json'),'utf8'));let rejected;
    try{P.validatePublic([{source_id:'cricket-ca-current',fixture_id:fixture.id,fixture:JSON.parse(JSON.stringify(fixture))}],baseline,secret);}catch(e){rejected=e;}
    assert.equal(rejected?.code,'POST_GUARD_FIXTURE_SHAPE');assert.deepEqual(P.shapeFailure(rejected),{reason:'TYPE_NOT_ALLOWED',pathIndex:Object.keys(baseline.paths).sort().indexOf('.pauseObservation'),actualType:'object'});checks.push('actual-pause-writer-baseline-schema-red');
    const later=new Date(Date.parse(sample.checkedAt)+60000).toISOString(),rechecked={...fixture,statusCheckedAt:later,sourceCheckedAt:later};
    const again=pause.pauseObservations([rechecked],{previous:[fixture],observedFixtures:[rechecked],receipts:{[fixture.id]:{t:sample.checkedAt}},now:new Date(later)}).fixtures[0];
    assert.equal(again.pauseObservation.observedAt,fixture.pauseObservation.observedAt);checks.push('actual-pause-writer-retains-original-clock');
   }
   assert.equal(fixture.status,{scheduled:'scheduled',live:'live',paused:'break',final:'completed',abandoned:'abandoned'}[phase]);
   models.push({name:'cricket-'+phase,sourceId:'cricket-ca-current',fixture});
  }
  const captured=read('scripts/fixtures/rugby-reviewed-provider-pair.json').worldRugby;
  for(const [name,status]of [['scheduled','U'],['live','L1'],['final','C']]){
   const game={matchId:captured.sourceFixtureId,sport:'mru',status,time:structuredClone(captured.sourceTime),competition:captured.competitionName,events:[{id:captured.competitionId.split(':').at(-1),label:captured.competitionName}],teams:captured.participants.map(t=>({id:t.sourceIds.worldRugby,name:t.displayName||t.name})),scores:[0,0],venue:{name:captured.venue}};
   const fixture=require(code('lib/coverage-discovery')).parseWorldRugby({content:[game]},{sourceUrl:captured.sourceUrl,checkedAt:captured.sourceCheckedAt})[0];assert(fixture);if(status!=='U'){assert.equal(fixture.homeScore,0);assert.equal(fixture.awayScore,0);}
   models.push({name:'rugby-'+name,sourceId:'discovery-rugby-mru',fixture});
  }
  for(const model of models){
   const fixture=JSON.parse(JSON.stringify(model.fixture)),stamp=fixture.sourceCheckedAt;
   const split=compact.split([fixture],{observedFixtures:[fixture],now:new Date(stamp)}),score=split.scores[0];
   const verified=new Date(Date.parse(stamp)+60000).toISOString(),factScore=score.scoreCheckedAt||null,factStatus=score.statusCheckedAt||null;
   await db.exec('truncate public.nothingsports_fixture_current,public.nothingsports_fixture_sources,public.nothingsports_live_scores;');
   await db.query('insert into public.nothingsports_fixture_current values($1,$2,$3,$4)',[model.sourceId,fixture.id,JSON.stringify(split.fixtures[0]),[fixture.id]]);
   await db.query('insert into public.nothingsports_fixture_sources values($1,$2)',[model.sourceId,JSON.stringify({_fixtureObservations:{[fixture.id]:{s:verified,t:verified}}})]);
   await db.query('insert into public.nothingsports_live_scores values($1,$2,$3,null)',[model.sourceId,fixture.id,JSON.stringify(score)]);
   const rows=(await db.query('select * from public.nothingsports_read_current_fixtures(null) order by source_id,fixture_id')).rows;
   assert.equal(rows.length,1);const projected=rows[0].fixture;
   assert.equal(projected.fixtureObservationSchema,'fixture-observations.v1');assert.equal(Date.parse(projected.scoreCheckedAt),Date.parse(verified));assert.equal(Date.parse(projected.statusCheckedAt),Date.parse(verified));
   assert.equal(projected.scoreFactObservedAt===null?null:Date.parse(projected.scoreFactObservedAt),factScore===null?null:Date.parse(factScore));assert.equal(projected.statusFactObservedAt===null?null:Date.parse(projected.statusFactObservedAt),factStatus===null?null:Date.parse(factStatus));
   const accepted=await guardedRead(rows,sdk,caller);assert.deepEqual(accepted,rows);
   const result=caller.project({events:[],participants:[],competitions:[],sources:[]},accepted,{now:new Date(Date.parse(verified)+1000),strictSourceEvidence:true});assert.equal(result.report.rowsRead,1);
   if(fixture.pauseObservation)assert.deepEqual(projected.pauseObservation,fixture.pauseObservation);
   checks.push('actual-producer-sql-sdk-caller-guard-'+model.name);
  }
  await rejectedTransportNames(sdk,caller);
 }finally{await db.close();global.fetch=deny;}
}
async function guardedRead(rows,sdk,caller,{expectCode,expectDescriptor}={}){
 const records=[],bodies=[],tx=new Transport({schema,values:[marker],capture:{start(){},commit(_n,b){bodies.push(Buffer.from(b));return true;},finish:r=>records.push(r)}});
 global.fetch=(url,options)=>tx.fetch(url,options,async()=>new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}}));
 const request=(url,options)=>tx.service(url,options,()=>sdk.supabaseServiceRequest(url,{...options,environment:{SUPABASE_URL:P.ORIGIN,SUPABASE_SECRET_KEY:marker}}));
 if(expectCode){
  await assert.rejects(()=>caller.readRows(request),e=>e.code===expectCode);assert.equal(bodies.length,0);assert.equal(tx.summary().capturedBytes,0);assert.equal(records.length,1);assert.equal(records[0].consumerParsed,false);
  assert.equal(Boolean(records[0].shapeFailure),expectDescriptor);assert(!secret.contains(JSON.stringify(records)));rejections.push(records[0]);return records[0];
 }
 const result=await caller.readRows(request);assert.equal(bodies.length,1);assert.equal(records[0].consumerParsed,true);assert.equal(records[0].readerReleased,true);return result;
}
async function rejectedTransportNames(sdk,caller){
 const row=fixture=>({source_id:'cricket-ca-current',fixture_id:fixture.id,fixture});
 let record=await guardedRead([row({...base(),unknownObject:{note:'unapproved'}})],sdk,caller,{expectCode:'POST_GUARD_FIXTURE_SHAPE',expectDescriptor:true});assert.deepEqual(record.shapeFailure,{reason:'UNKNOWN_PATH',parentIndex:index(''),actualType:'object'});checks.push('actual-transport-shape-descriptor-no-capture');
 for(const [encoding,key]of [['raw','unknown-'+marker],['hex','unknown-'+Buffer.from(marker).toString('hex').toUpperCase()]]){
  record=await guardedRead([row({...base(),[key]:true})],sdk,caller,{expectCode:'POST_GUARD_PRIVATE_PAYLOAD',expectDescriptor:false});assert.equal(record.captureFileOpened,false);checks.push('actual-transport-secret-bearing-'+encoding+'-name-rejected-no-echo');
 }
}
if(require.main===module)main().catch(error=>{const diagnostic=P.shapeFailure(error);report({status:'FAIL',scope:'source-shape controls',completed:checks.length,code:'SOURCE_SHAPE_CONTROL_FAILED',...(diagnostic?{shapeFailure:diagnostic}:{}),realServiceRequests:0,realKeys:0});process.exitCode=1;});
module.exports={descriptors};
