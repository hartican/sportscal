'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const fixture=require('./fixtures/cancelled-preview-wrc-20261101.json');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-cancelled-audit-'));
const repository=path.resolve(__dirname,'..');
let controls=0;
function guardCleanupControls(){
 const api=require(path.join(repository,'scripts/lib/editorial-offline-checks')),cp=require('node:child_process');
 const previousOptions=process.env.NODE_OPTIONS;
 // A required child already has composed guards loaded. This dispatch-only
 // probe selects one authenticated existing guard; no child code is executed.
 const guardOption=(previousOptions||'').match(/^--require(?:=|\s+)(?:"[^"]+"|'[^']+'|\S+)/)?.[0]||'';
 api.admit(guardOption);
 process.env.NODE_OPTIONS=guardOption;
 try{
 for(const failPermission of [true,false]){
  const original={mkdir:fs.mkdtempSync,chmod:fs.chmodSync,write:fs.writeFileSync,spawn:cp.spawnSync};
  const failure=new Error('controlled owned guard chmod failure'),prefix=path.join(os.tmpdir(),'ns-editorial-guards-');
  let owned=null,writes=0,dispatched=0;
  try{
   fs.mkdtempSync=function(value,...args){assert.equal(value,prefix,'Only the actual helper-owned directory is instrumented');owned=original.mkdir.call(this,value,...args);return owned;};
   fs.chmodSync=function(file,...args){assert.equal(file,owned,'Permission change is limited to the just-created owned directory');if(failPermission)throw failure;return original.chmod.call(this,file,...args);};
   fs.writeFileSync=function(file,...args){assert(owned&&String(file).startsWith(owned+path.sep),'No unrelated output may be written');writes++;return original.write.call(this,file,...args);};
   cp.spawnSync=function(){dispatched++;return {status:0,stdout:'',stderr:''};};
   if(failPermission){
    assert.throws(()=>api.run(),error=>error===failure,'Preserve the original permission error');
    assert.equal(writes,0,'Permission refusal precedes all guard-byte writes');
    assert.equal(dispatched,0,'Permission refusal precedes all child dispatch');
   }else{
    assert.equal(api.run().length,api.CHECKS.length,'Normal helper still dispatches the unchanged finite child list');
    assert.equal(dispatched,api.CHECKS.length);
    assert(writes>=1,'Normal helper writes its protected guard captures');
   }
   assert(owned,'Actual helper must have created its own directory');
   assert.equal(fs.existsSync(owned),false,'Remove the just-created directory on permission failure and normal return');
   controls++;
  }finally{
   fs.mkdtempSync=original.mkdir;fs.chmodSync=original.chmod;fs.writeFileSync=original.write;cp.spawnSync=original.spawn;
   // The RED may leave this one test-owned directory behind. Never scan or
   // change permissions on any source, dependency, user or unrelated path.
   if(owned&&owned.startsWith(prefix)&&fs.existsSync(owned))fs.rmSync(owned,{recursive:true,force:true});
  }
 }
 }finally{if(previousOptions===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=previousOptions;}
}
function registrationContract(parent,owner,workflow){
 const expected=['scripts/validate-cancelled-preview-audit.js','scripts/validate-mlb-quick-editorial.js'];
 const literal=owner.match(/const CHECKS=Object\.freeze\((\[[\s\S]*?\])\);/);
 assert(literal,'Required offline editorial closure must remain explicit');
 assert.deepEqual(JSON.parse(literal[1]),expected,'Required children preserve exact occurrences and order');
 assert.equal((parent.match(/^require\('\.\/validate-postseason-editorial'\);$/gm)||[]).length,1,'Keep the original distinct historical child exactly once');
 assert.equal((parent.match(/^require\('\.\/lib\/editorial-offline-checks'\)\.run\(\);$/gm)||[]).length,1,'Required parent calls offline closure exactly once');
 assert(parent.indexOf("require('./validate-postseason-editorial');")<parent.indexOf("require('./lib/editorial-offline-checks').run();"),'Preserve old command order');
 assert(owner.includes('cp.spawnSync(process.execPath,[script],'),'Do not alter child command arguments');
 assert(owner.includes("env.NS_EDITORIAL_OFFLINE_CHILD='1';")&&owner.includes('timeout:25000'),'Offline guard and bounded children remain required');
 assert(owner.includes("const admitted=admit(process.env.NODE_OPTIONS||'');"),'Authenticate inherited guard bytes before any child dispatch');
 assert(owner.includes("env.NODE_OPTIONS=preloads.map(file=>'--require '+JSON.stringify(file)).join(' ');"),'Only captured admitted preloads compose child startup');
 const production=require('./validate-production-sql-batches').validate(workflow);
 assert.equal((workflow.match(/^\s+node scripts\/validate-editorial-sport-depth\.js$/gm)||[]).length,1);
 for(const script of expected)assert(!workflow.includes('node '+script),'Do not duplicate parent children in the workflow');
 return {production,previousEditorialChildren:1,requiredEditorialChildren:expected.length+1,addedEditorialChildren:expected.length};
}
try{
 guardCleanupControls();
 if(process.argv.includes('--guard-cleanup-only')){
  console.log(JSON.stringify({schemaVersion:'editorial-owned-guard-cleanup.v1',controls,focusedOnly:true,childChecksExecuted:0}));
 }else{
 const parent=fs.readFileSync(path.join(__dirname,'validate-editorial-sport-depth.js'),'utf8');
 const owner=fs.readFileSync(path.join(__dirname,'lib/editorial-offline-checks.js'),'utf8');
 const workflow=fs.readFileSync(path.join(repository,'.github/workflows/sportscal-production.yml'),'utf8');
 const registration=registrationContract(parent,owner,workflow);
 const literal=owner.match(/const CHECKS=Object\.freeze\((\[[\s\S]*?\])\);/)[1],checks=JSON.parse(literal);
 for(const changed of [checks.slice(1),[...checks,checks[0]],[...checks].reverse(),[checks[0],checks[1]+' --skip'],[...checks,'scripts/validate-unreviewed-editorial.js']]){
  const bad=owner.replace(literal,JSON.stringify(changed));assert.notEqual(bad,owner);assert.throws(()=>registrationContract(parent,bad,workflow));controls++;
 }
 for(const changed of [
  parent.replace("require('./lib/editorial-offline-checks').run();",''),
  parent+"\nrequire('./lib/editorial-offline-checks').run();\n",
  parent.replace("require('./validate-postseason-editorial');",'')
 ]){assert.notEqual(changed,parent);assert.throws(()=>registrationContract(changed,owner,workflow));controls++;}
 assert.throws(()=>registrationContract(parent,owner.replace('[script],',"[script,'--skip'],"),workflow));controls++;
 const workflowNegatives=require('./validate-production-sql-batches').regressions(workflow);
 const offline=require('./lib/editorial-offline-checks'),approved=path.join(root,'approved guard.cjs');
 fs.writeFileSync(approved,offline.OWNED_GUARD,{mode:0o600});
 assert(offline.admit('--require '+JSON.stringify(approved)),'Explicit owned guard bytes admit at an absolute bound path');controls++;
 if(process.env.NS_EDITORIAL_OFFLINE_CHILD==='1'){assert.equal(globalThis.NS_EDITORIAL_OFFLINE_GUARD,true,'Mandatory guard executed in this actual required child');controls++;}
 const hostile=path.join(root,'unapproved.cjs');fs.writeFileSync(hostile,"throw Error('must never execute');\n");
 const linked=path.join(root,'linked.cjs');fs.symlinkSync(approved,linked);
 for(const option of ['--require '+hostile,'--import '+require('node:url').pathToFileURL(hostile).href,'--require '+JSON.stringify(approved)+' --trace-warnings','--trace-warnings','--require relative.cjs','--require '+path.join(root,'missing.cjs'),'--require '+linked]){
  assert.throws(()=>offline.admit(option),/Unapproved/,'Unknown option/path/hash cannot authorize startup code');controls++;
 }
 fs.appendFileSync(approved,'// changed guard bytes');
 assert.throws(()=>offline.admit('--require '+JSON.stringify(approved)),/Unapproved preload hash/,'Wrong hash is refused even at the previously admitted path');controls++;
 const clock=path.join(root,'clock.cjs');
 fs.writeFileSync(clock,`const Native=Date;global.Date=class extends Native{constructor(...args){super(...(args.length?args:[${JSON.stringify(fixture.reference)}]))}static now(){return Native.parse(${JSON.stringify(fixture.reference)})}};`);
 function run(event,evidenceMode){
  const input=path.join(root,'input.json'),output=path.join(root,'audit.json'),args=['--require',clock];
  if(evidenceMode){
   const shim=path.join(root,'authority-'+evidenceMode+'.cjs');
   fs.writeFileSync(shim,`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).endsWith('/data/canonical/wrc-context-2026.json')){if(${JSON.stringify(evidenceMode)}==='missing')throw Error('controlled missing canonical authority');const value=JSON.parse(read.call(this,file,'utf8'));if(${JSON.stringify(evidenceMode)}==='notice')value.calendarCoverage.revisionSourceUrl='https://api.fia.com/news/unrelated-notice';if(${JSON.stringify(evidenceMode)}==='identity')value.calendarCoverage.retainedWithdrawals=[];if(${JSON.stringify(evidenceMode)}==='status')value.events=value.events.map(e=>e.status==='cancelled'?{...e,status:'unknown'}:e);return args[0]?JSON.stringify(value):Buffer.from(JSON.stringify(value));}return read.call(this,file,...args);};`);
   args.push('--require',shim);
  }
  fs.writeFileSync(input,JSON.stringify({events:[event]}));const before=fs.readFileSync(input);
  const result=spawnSync(process.execPath,[...args,path.join(__dirname,'audit-editorial-previews.js'),input,output],{encoding:'utf8',timeout:10000,env:process.env});
  assert.deepEqual(fs.readFileSync(input),before,'Audit cannot modify source fixture facts or notice');
  assert(fs.existsSync(output),'Actual audit must emit its verdict: '+result.stderr);
  return {...result,audit:JSON.parse(fs.readFileSync(output))};
 }
 const cancelled=run(fixture.event);
 assert.equal(cancelled.status,0,'Independent retained canonical withdrawal/notice must pass: '+cancelled.stderr);controls++;
 assert.equal(cancelled.audit.summary.due,0);controls++;
 assert.equal(run({...fixture.event,id:fixture.event.canonicalEventId,eventId:fixture.event.canonicalEventId}).status,0,'Canonical-only spelling retains the same independent cancellation authority');controls++;
 const helper=require('./lib/editorial-preview-quality');
 assert.equal(helper.editorialPreviewDue(fixture.event,4,new Date(fixture.reference)),false);controls++;
 const active={...fixture.event,id:'control:active',canonicalEventId:'control:active',status:'upcoming'};
 assert.equal(helper.editorialPreviewDue(active,4,new Date(fixture.reference)),true,'Active due positive cannot become vacuous');controls++;
 for(const status of ['upcoming','live','postponed','suspended','unknown']){const result=run({...active,status});assert.equal(result.status,1,status+' keeps actual preview obligation');assert(result.audit.cards[0].issues.includes('missing-editorial-angle'));controls++;}
 for(const patch of [
  {sourceTrust:'unverified'},{sourceType:'reputable'},{statusSourceUrl:null},{statusSourceUrl:'http://invalid.test'},
  {statusSourceUrl:'https://example.invalid/fake'},{statusSourceUrl:'https://api.fia.com/news/unrelated-official-notice'},
  {statusCheckedAt:'2999-01-01T00:00:00Z'},{statusCheckedAt:'2026-02-30T00:00:00Z'},{statusCheckedAt:null},
  {id:'copied:other',eventId:'copied:other',canonicalEventId:'copied:other'},
  {id:'copied:other'},{eventId:'copied:other'},{canonicalEventId:'copied:other'},
  {competitionId:'competition:unrelated'},{season:2027},{scheduleNote:'A different notice says something else.'}
 ]){
  const result=run({...fixture.event,...patch});assert.equal(result.status,1,'Copied flags/wrong identity or notice cannot bypass actual QA: '+JSON.stringify(patch));assert(result.audit.cards[0].issues.includes('unconfirmed-cancellation'));controls++;
 }
 for(const mode of ['missing','notice','identity','status']){const result=run(fixture.event,mode);assert.equal(result.status,1,'Missing/wrong independent authority fails closed: '+mode);assert(result.audit.cards[0].issues.includes('unconfirmed-cancellation'));controls++;}
 const good={...active,selectedSentence:'A distinct reviewed sporting matchup.',fullSpiel:'A sourced preview describes this controlled upcoming fixture without inventing its result.',editorialPreview:{status:'journalistic',angle:'Reviewed matchup',contextSignals:['matchup','form'],sourceUrl:active.sourceUrl,sourceName:active.sourceName,sourceCheckedAt:active.sourceCheckedAt}};
 assert.equal(run(good).status,0,'Valid active preview still passes');controls++;
 assert.equal(run({...active,date:'2026-11-12'}).status,0,'Original ten-day boundary remains');controls++;
 console.log(JSON.stringify({schemaVersion:'editorial-required-offline.v1',controls,workflowNegativeControls:workflowNegatives,...registration,noticeAuthority:'Retained canonical withdrawal ledger and matching official notice/identity/status/source date; no new fetch or raw-notice receipt claimed.'}));
 }
}finally{fs.rmSync(root,{recursive:true,force:true});}
