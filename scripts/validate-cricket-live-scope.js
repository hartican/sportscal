#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),SOURCE='cricket-ca-current';

// Exercise the real CLI, coordinator, adapter, parsers and store. Only remote
// provider/database boundaries and the observation clock are constructed.
function prepareChild(){
 const RealDate=Date,now='2026-10-25T00:00:00.000Z',old='2026-10-22T14:04:00.721Z';
 const scenario=process.env.NS_CRICKET_SCOPE_CASE;
 global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}};
 const trace={selected:[],database:[],providers:[],publishes:[],failures:[],unexpected:[]};
 process.on('exit',()=>console.log('CRICKET_SCOPE '+JSON.stringify(trace)));
 for(const name of ['node:http','node:https'])for(const method of ['request','get'])require(name)[method]=()=>{trace.unexpected.push(name+'.'+method);throw Error('No native network allowed');};
 require('node:child_process').spawnSync=()=>{trace.unexpected.push('spawn');throw Error('No subprocess allowed');};
 const game={id:99001,competition:{id:4568,name:'Constructed international Test'},homeTeam:{id:21,name:'South Africa'},awayTeam:{id:23,name:'Australia'},startDateTime:'2026-10-18T08:00:00Z',endDateTime:'2026-10-22T12:00:00Z',gameType:'Test',numberOfDays:5,isCompleted:true,resultTypeId:'HomeWin',resultText:'South Africa win by an innings and 31 runs',innings:[]};
 const coverage=require('../lib/source-coverage'),url=require('../lib/cricket-current-results').RESULTS_URL;
 const [prior]=coverage.parseCricketFixtures([game],{sourceUrl:url,checkedAt:old});
 const [retained]=coverage.parseCricketFixtures([{...game,id:99002}],{sourceUrl:url,checkedAt:old});
 const original=JSON.stringify([prior,retained]);
 const live=require('../lib/live-fixtures'),refresh=live.refreshDueSources;
 trace.priorHash=live.contentHash(live.splitScores([prior,retained],{now:new Date(now)}).fixtures);
 live.refreshDueSources=options=>{trace.selected=options.sources.map(s=>s.id);return refresh(options);};
 global.fetch=async(input,options={})=>{
  const target=new URL(input),body=options.body?JSON.parse(options.body):null;
  if(target.origin==='https://scope-test.invalid'){
   trace.database.push({path:target.pathname,source:body?.p_source_id});
   if(target.pathname==='/rest/v1/nothingsports_fixture_sources'){
    if(scenario==='database-unavailable')return Response.json({message:'Constructed outage'},{status:503});
    return Response.json(scenario==='not-due'?trace.selected.map(source_id=>({source_id,next_due_at:'2027-01-01T00:00:00Z'})):[]);
   }
   if(target.pathname==='/rest/v1/rpc/nothingsports_claim_fixture_source'){
    assert.equal(body.p_source_id,SOURCE,'Only the allocated source may claim');
    return Response.json(scenario==='lease-refused'?[]:[{fixtures:[prior,retained],failure_count:0}]);
   }
   if(['/rest/v1/rpc/nothingsports_publish_compact_scores','/rest/v1/rpc/nothingsports_publish_fixture_source_report'].includes(target.pathname)){
    assert.equal(body.p_source_id,SOURCE);trace.publishes.push(body);
    return scenario==='publication-rejected'?Response.json({message:'Constructed refusal'},{status:409}):Response.json(null);
   }
   if(target.pathname==='/rest/v1/rpc/nothingsports_fail_fixture_source'){
    trace.failures.push(body);return Response.json(null);
   }
   trace.unexpected.push(target.pathname);throw Error('Unexpected database operation '+target.pathname);
  }
  trace.providers.push(target.href);
  if(target.href==='https://www.cricket.com.au/matches/'){
   if(scenario==='provider-http')return new Response('Constructed failure',{status:502});
   if(scenario==='provider-timeout')throw new DOMException('Constructed timeout','TimeoutError');
   return new Response("window.FIXTURES_DATA = JSON.parse('[]')");
  }
  if(target.href===url)return Response.json(scenario==='invalid-result'?{fixtures:[{...game,resultText:''}]}:scenario==='conflicting-results'?{fixtures:[game,{...game,resultText:'Contradictory result'}]}:{fixtures:[game]});
  trace.unexpected.push(target.href);throw Error('Unallocated provider');
 };
 process.on('exit',()=>assert.equal(JSON.stringify([prior,retained]),original,'Last-good input remains unchanged'));
}

function run(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-cricket-live-scope-'));
 try{
  let cases=0;
  function invoke(args,scenario='success',status=0){
   const report=path.join(directory,`${cases++}.json`);
   const child=spawnSync(process.execPath,['--require',__filename,path.join(__dirname,'update-cards.js'),...args],{cwd:root,encoding:'utf8',timeout:30000,env:{PATH:process.env.PATH,LANG:process.env.LANG,NS_CRICKET_SCOPE_TEST:'1',NS_CRICKET_SCOPE_CASE:scenario,SUPABASE_URL:'https://scope-test.invalid',SUPABASE_SECRET_KEY:'sb_secret_constructed_only',MATCH_CENTRE_SCORE_WRITES:scenario==='full-source'?'false':'true',MILESTONE_ALERTS_MODE:'off',REFRESH_REPORT:report}});
   assert.equal(child.status,status,`${scenario}: ${child.stderr||child.stdout}`);
   const trace=JSON.parse(child.stdout.match(/CRICKET_SCOPE (\{[^\n]+\})/)[1]);
   assert.deepEqual(trace.unexpected,[],'No unallocated provider, database or subprocess');
   return {trace,stdout:child.stdout,stderr:child.stderr,report};
  }
  const args=['-p','--live','--live-source=cricket-ca-current','--local-only'];
  const {trace}=invoke(args);
  assert.deepEqual(trace.selected,[SOURCE]);
  assert.equal(trace.publishes.length,1);assert.equal(trace.failures.length,0);
  assert.equal(trace.providers.length,2);assert.deepEqual(trace.unexpected,[]);
  const omitted=trace.publishes[0].p_fixtures.find(f=>f.id==='fixture:cricket:CA:99002');
  assert.equal(omitted.sourceCheckedAt,'2026-10-22T14:04:00.721Z','An omitted final keeps its original observation');
  assert.equal(trace.publishes[0].p_scores.find(f=>f.id===omitted.id).scoreObserved,false);
  assert.equal(trace.publishes[0].p_scores.find(f=>f.id===omitted.id).statusObserved,false);
  assert.equal(trace.publishes[0].p_hash,trace.priorHash,'An unchanged re-observation does not manufacture a new primary fact revision');
  assert.equal(trace.publishes[0].p_fixtures.find(f=>f.id==='fixture:cricket:CA:99001').sourceCheckedAt,'2026-10-25T00:00:00.000Z','An actual constructed provider response has its genuine observation receipt');
  const full=invoke(args,'full-source').trace;
  assert.deepEqual(full.selected,[SOURCE]);assert.equal(full.publishes.length,1);
  assert(full.database.some(call=>call.path.endsWith('/nothingsports_publish_fixture_source_report')),'Existing noncompact publication route is retained');
  assert.equal(full.publishes[0].p_fixtures.find(f=>f.id===omitted.id).sourceCheckedAt,omitted.sourceCheckedAt);
  for(const scenario of ['provider-http','provider-timeout','invalid-result','conflicting-results','publication-rejected']){
   const result=invoke(args,scenario,1),t=result.trace;
   assert.deepEqual(t.selected,[SOURCE]);assert.equal(t.failures.length,1,'Failure stays with the same lease owner');
   assert.equal(t.publishes.length,scenario==='publication-rejected'?1:0,'Rejected facts cannot publish');
   assert.equal(t.providers.length,/^provider-/.test(scenario)?1:2,'No automatic retry or duplicate ingestion');
   assert(result.stdout.includes('"sourceId":"cricket-ca-current","code":"source_refresh_failed"'),'Existing sanitised terminal failure is retained');
  }
  const unavailable=invoke(args,'database-unavailable',1).trace;
  assert.equal(unavailable.database.length,1);assert.equal(unavailable.providers.length,0);assert.equal(unavailable.failures.length,0);
  for(const scenario of ['lease-refused','not-due']){
   const result=invoke(args,scenario),t=result.trace;
   assert.deepEqual(t.selected,[SOURCE]);assert.equal(t.providers.length,0);assert.equal(t.publishes.length,0);
   assert(result.stdout.includes('"skipped":["cricket-ca-current"]'),'An unclaimed source stays an honest skip');
  }
  const tennis=invoke(['--live','--live-source=tennis','--local-only'],'not-due').trace;
  assert.deepEqual(tennis.selected,['live-tennis-atp','live-tennis-wta'],'Existing tennis scope is unchanged');
  const defaults=invoke(['--live','--local-only'],'not-due').trace;
  for(const id of [SOURCE,'live-tennis-atp','live-tennis-wta','rugby-ra-949461'])assert(defaults.selected.includes(id),'Default live route retains '+id);
  assert(defaults.selected.length>4);assert.equal(defaults.providers.length,0);
  for(const invalid of [
   ['--live-source=cricket-ca-current'],['--live','--live-source=unknown'],['--live','--live-source='],
   ['--live','--live-source','cricket-ca-current'],
   [...args,'--live-source=cricket-ca-current'],[...args,'--live-source=tennis'],[...args,'--quick'],
   [...args,'--coverage'],[...args,'--coverage-source=cricket-ca-current'],[...args,'--offline'],
   [...args,'--source=football'],
   [...args,'--resume-from','scripts/refresh-source-coverage.js'],[...args,'--live'],
  ]){
   const result=invoke(invalid,'invalid-scope',1);
   assert.match(result.stderr,/Scoped live refresh/);
   assert.deepEqual(result.trace.selected,[]);assert.deepEqual(result.trace.database,[]);assert.deepEqual(result.trace.providers,[]);
   assert(!fs.existsSync(result.report),'Invalid scopes reject before diagnostic writes');
  }
  console.log(`Cricket-only live CLI: ${cases} real-dispatch cases retain source scope, leases, last-good data, terminal failures, tennis/default routes and pre-work rejection; all remote boundaries constructed.`);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
if(process.env.NS_CRICKET_SCOPE_TEST==='1')prepareChild();
else if(require.main===module)run();
module.exports={run};
