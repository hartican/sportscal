'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const receipt=require('./fixtures/refresh-cricket-result-20261016.json');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-result-handoff-'));
const file=path.join(directory,'events.json'),now=new Date(receipt.checkedAt);
function check(events){
 fs.writeFileSync(file,JSON.stringify({events}));
 return spawnSync(process.execPath,['scripts/verify-result-completeness.js',file],{encoding:'utf8',env:{...process.env,RESULT_CHECK_NOW:receipt.checkedAt}});
}
(async()=>{try{
 const before=check([receipt.card]);assert.equal(before.status,1);assert.match(before.stdout,/1525659/);
 console.log('Captured scheduled failure reproduced: result gate rejects espn:1525659.');
 const diagnosticPath=path.join(directory,'diagnostic.json');
 const red=spawnSync(process.execPath,['scripts/verify-result-completeness.js',file],{encoding:'utf8',env:{...process.env,RESULT_CHECK_NOW:receipt.checkedAt,REFRESH_REPORT:diagnosticPath}});
 assert.equal(red.status,1);assert(JSON.parse(fs.readFileSync(diagnosticPath)).missingResults[0].missingFields.includes('recapText'));
 const report=require('./lib/refresh-report');const previous=process.env.NS_TEST_SECRET;process.env.NS_TEST_SECRET='controlled-secret-12345';
 try{const safe=report.update({sourceFailures:['controlled-secret-12345 https://example.com/results?token=private'],stage:'failed'},{file:diagnosticPath});assert(!JSON.stringify(safe).includes('controlled-secret-12345'));assert(!JSON.stringify(safe).includes('token='));}
 finally{if(previous===undefined)delete process.env.NS_TEST_SECRET;else process.env.NS_TEST_SECRET=previous;}
 report.failure('inner calendar rejection',{file:diagnosticPath,step:'scripts/apply-current-card-evidence.js',detail:'fixture:tennis:espn:wta:185347: Accepted result fixture date mismatch'});
 const nested=report.failure('quick-results.js failed with exit code 1',{file:diagnosticPath,step:'scripts/quick-results.js'});
 assert.equal(nested.failedStep,'scripts/apply-current-card-evidence.js');assert.match(nested.blockingError,/185347/);assert.equal(nested.failureChain.length,2);
 assert.equal(report.sanitise('https://github.com/hartican/sportscal/actions/runs/12/job/77?token=private#step:5'),'https://github.com/hartican/sportscal/actions/runs/12/job/77#step:5');
 assert(!report.sanitise('https://github.com/hartican/sportscal/actions/runs/12/job/77#secret').includes('#secret'));
 const owner=require('./lib/reconcile-fixture-results');
 const apply=(cards=[receipt.card],fixtures=[receipt.result],aliases=receipt.aliasRecords)=>owner.reconcile(cards,fixtures,{aliasRecords:aliases,now});
 const next=apply();assert.equal(next.changed.length,1);assert.equal(next.events[0].status,'completed');assert.equal(check(next.events).status,0);
 const final=next.events[0];assert.equal(final.id,receipt.card.id);assert.deepEqual(final.viewingOptions,receipt.card.viewingOptions);assert.equal(final.sourceCheckedAt,receipt.card.sourceCheckedAt,'schedule observation is not a result check');
 assert.equal(final.resultSourceCheckedAt,receipt.result.scoreFactObservedAt);assert.equal(final.scoreCheckedAt,receipt.result.scoreFactObservedAt);assert.equal(final.resultSourceUrl,receipt.result.officialScorecardUrl);
 assert.equal(final.storyline.arcStage,'recap');assert(!/214|Australia win/.test(final.selectedSentence));assert.match(final.outcomeText,/214/);
 assert.deepEqual(apply(next.events).events,next.events,'retained finals are stable');assert.deepEqual(apply(next.events).changed,[]);
 const checkedAgain={...receipt.result,sourceCheckedAt:now.toISOString(),scoreCheckedAt:now.toISOString()};assert.deepEqual(apply(next.events,[checkedAgain]).events,next.events,'new poll time does not renew result evidence');
 const legacy={...receipt.card,id:'evt_87',eventId:'evt_87'};assert.equal(apply([legacy]).events[0].id,'evt_87');
 assert.equal(apply([receipt.card],[],receipt.aliasRecords).changed.length,0);assert.equal(apply([], [receipt.result]).events.length,0,'no card admission');
 assert.equal(apply([receipt.card],[{...receipt.result,id:'unrelated',eventId:'unrelated',canonicalEventId:'unrelated',sourceEventIds:[]}],[]).changed.length,0,'names and dates never join results');
 for(const change of [{scoreDisplay:''},{sourceType:'unverified'},{officialScorecardUrl:'https://example.com/match'},{scoreFactObservedAt:'2099-01-01T00:00:00Z'},{participantIds:['team:cricket:england','team:cricket:australia']},{startTimeUtc:'2026-10-10T07:30:00Z'}])assert.throws(()=>apply([receipt.card],[{...receipt.result,...change}]),/result reconciliation/i);
 assert.throws(()=>apply(next.events,[{...receipt.result,scoreDisplay:'South Africa win by 214 runs'}]),/conflict/i);
 assert.throws(()=>apply([receipt.card],[receipt.result,{...receipt.result,scoreDisplay:'Australia win by 100 runs'}]),/conflict/i);
 const root=path.join(directory,'project');for(const name of ['feeds/incoming/events.json','data/events.json']){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),JSON.stringify({events:name.startsWith('data')?[receipt.card]:[]}));}
 const publishedOnly=owner.reconcileFiles({root,fixtures:[receipt.result],aliasRecords:receipt.aliasRecords,now});assert.equal(publishedOnly.changed.length,1);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/events.json'))).events[0].status,'completed');assert.equal(JSON.parse(fs.readFileSync(path.join(root,'feeds/incoming/events.json'))).events.length,0);
 const bytes=fs.readFileSync(path.join(root,'data/events.json'));owner.reconcileFiles({root,fixtures:[receipt.result],aliasRecords:receipt.aliasRecords,now});assert(fs.readFileSync(path.join(root,'data/events.json')).equals(bytes));
 const quick=require('./quick-results');
 fs.mkdirSync(path.join(root,'assets/js'),{recursive:true});fs.writeFileSync(path.join(root,'assets/js/app-shell-runtime.js'),'original-runtime');
 const cwd=process.cwd();process.chdir(root);try{
  const priorReport=process.env.REFRESH_REPORT;process.env.REFRESH_REPORT=path.join(directory,'child-failure.json');
  fs.mkdirSync('scripts',{recursive:true});fs.writeFileSync('scripts/apply-current-card-evidence.js',"console.error('AssertionError: fixture:tennis:espn:wta:185347: Accepted result fixture date mismatch');process.exit(1);\n");
  try{
   await assert.rejects(quick.atomicRefresh({},{refreshOperation:async()=>quick.runProjectionSteps([['scripts/apply-current-card-evidence.js']])}),/failed/);
   const childFailure=JSON.parse(fs.readFileSync(process.env.REFRESH_REPORT));
   assert.equal(childFailure.failedStep,'scripts/apply-current-card-evidence.js');assert.match(childFailure.blockingError,/185347/);
  }finally{if(priorReport===undefined)delete process.env.REFRESH_REPORT;else process.env.REFRESH_REPORT=priorReport;}
  await assert.rejects(quick.atomicRefresh({},{refreshOperation:async()=>{fs.writeFileSync('data/events.json','broken');fs.writeFileSync('data/new-candidate.json','{}');fs.writeFileSync('assets/js/app-shell-runtime.js','broken-runtime');throw Error('forced post-projection gate failure');}}),/forced/);
  assert(fs.readFileSync('data/events.json').equals(bytes));assert(!fs.existsSync('data/new-candidate.json'));assert.equal(fs.readFileSync('assets/js/app-shell-runtime.js','utf8'),'original-runtime');
 }finally{process.chdir(cwd);}
 const steps=require('./update-cards').buildSteps({localOnly:true});assert(steps.some(s=>s[0]==='scripts/reconcile-fixture-results.js'),'full owner must reconcile');
 await require('./validate-refresh-rollback-diagnostics')();
 console.log('Result hand-off: captured final, recorded aliases, retained-only cards, honest clocks, conflicts, spoiler protection and stable repeated publication passed.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
