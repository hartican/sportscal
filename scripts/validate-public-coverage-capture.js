'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {sync}=require('./sync-live-coverage');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixture={id:'fixture:rugby:constructed',key:'rugby',sportDomainId:'sport:rugby-union',name:'Home v Away',startTimeUtc:'2026-10-22T00:00:00.000Z',sourceCheckedAt:'2026-10-22T16:00:00.000Z',sourceUrl:'https://example.invalid/public-fixture',status:'completed',participants:[{id:'team:home',name:'Home'},{id:'team:away',name:'Away'}],participantIds:['team:home','team:away'],homeParticipantId:'team:home',awayParticipantId:'team:away',homeScore:12,awayScore:7,scoreDisplay:'12–7'};
const sources=['cricket-ca-current','cricket-ca-4710','discovery-cricket-history','discovery-cricket-near','discovery-rugby-mru','discovery-rugby-mru-near','discovery-rugby-wru','discovery-rugby-wru-near','discovery-rugby-mrs','discovery-rugby-mrs-near','discovery-rugby-wrs','discovery-rugby-wrs-near'];
function capture(){const rows=[{source_id:'discovery-rugby-mru',fixture_id:fixture.id,fixture:structuredClone(fixture),identity_keys:[fixture.id]}];return {schemaVersion:'live-coverage-public-capture.v1',provenance:'constructed-fixture',capturedAt:'2026-10-22T16:43:40.438Z',pages:[{request:{path:'/rest/v1/rpc/nothingsports_read_current_fixtures?source_id=in.('+sources.join(',')+')&order=source_id.asc,fixture_id.asc&limit=500&offset=0',method:'POST',body:{p_fixture_ids:null},timeoutMs:10000},receivedAt:'2026-10-22T16:43:40.000Z',rows,sha256:hash(rows)}]};}
async function run(){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-public-coverage-'))),file=path.join(root,'coverage.json');let managedCalls=0,checks=0;
 try{
  assert.throws(()=>require('./update-cards').parseOptions(['--live-coverage-public=/not-read','--local-only'],{}),/Public coverage capture requires/,'Saved coverage cannot fall through to an implicit/default refresh');
  const prior={events:[{...fixture,status:'scheduled',sourceCheckedAt:'2026-10-21T16:00:00.000Z',unknownProtectedAnnotation:{retain:true}}],participants:[],competitions:[],sources:[]};
  delete prior.events[0].homeScore;delete prior.events[0].awayScore;delete prior.events[0].scoreDisplay;
  fs.writeFileSync(file,JSON.stringify(prior));
  const request=async()=>{managedCalls++;throw Error('CAUSAL RED: saved public input ignored; managed reader attempted');};
  const result=await sync({file,now:new Date('2026-10-22T16:43:40.438Z'),publicCapture:capture(),request});
  assert.equal(managedCalls,0);assert.equal(result.changed,1);assert.equal(JSON.parse(fs.readFileSync(file)).events[0].awayScore,7);
  const first=fs.readFileSync(file),published=JSON.parse(first).events[0];assert.deepEqual(published.unknownProtectedAnnotation,{retain:true});assert.equal(published.sourceCheckedAt,fixture.sourceCheckedAt);assert.equal(result.publicCapture.currentSourceAcceptance,false);assert.equal(result.publicCapture.requestContract.method,'POST');checks++;
  const later=capture();later.pages[0].rows[0].fixture.sourceCheckedAt='2026-10-22T16:10:00.000Z';later.pages[0].sha256=hash(later.pages[0].rows);
  const repeated=await sync({file,now:new Date(later.capturedAt),publicCapture:later,request});assert.equal(repeated.changed,0);assert(fs.readFileSync(file).equals(first));checks++;
  for(const [name,edit,reason]of [
   ['private envelope',c=>{c.profiles=[];},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private fixture',c=>{c.pages[0].rows[0].fixture.preferences={};},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private participant',c=>{c.pages[0].rows[0].fixture.participants[0].user_id='constructed-only';},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['wrong method',c=>{c.pages[0].request.method='GET';},'REQUEST_CONTRACT'],
   ['write RPC',c=>{c.pages[0].request.path='/rest/v1/rpc/nothingsports_publish_fixture_source';},'REQUEST_CONTRACT'],
   ['private table',c=>{c.pages[0].request.path='/rest/v1/nothingsports_user_state';},'REQUEST_CONTRACT'],
   ['personal selection',c=>{c.pages[0].request.body.p_fixture_ids=['private-selection'];},'REQUEST_CONTRACT'],
   ['source filter',c=>{c.pages[0].request.path=c.pages[0].request.path.replace('cricket-ca-current','unknown-source');},'REQUEST_CONTRACT'],
   ['larger page',c=>{c.pages[0].request.path=c.pages[0].request.path.replace('limit=500','limit=501');},'REQUEST_CONTRACT'],
   ['extra header',c=>{c.pages[0].request.headers={Authorization:'synthetic-only'};},'REQUEST_CONTRACT'],
   ['wrong hash',c=>{c.pages[0].sha256='0'.repeat(64);},'PAGE_HASH'],
   ['wrong identity',c=>{c.pages[0].rows[0].fixture_id='fixture:wrong';},'IDENTITY'],
   ['unreviewed canonical alias',c=>{c.pages[0].rows[0].fixture.canonicalEventId='fixture:rugby:unrelated-protected';},'ALIAS_UNQUALIFIED'],
   ['unreviewed source alias',c=>{c.pages[0].rows[0].fixture.sourceEventIds=['fixture:rugby:unrelated-protected'];},'ALIAS_UNQUALIFIED'],
   ['unreviewed row alias',c=>{c.pages[0].rows[0].identity_keys.push('fixture:rugby:unrelated-protected');},'ALIAS_UNQUALIFIED'],
   ['TBC side',c=>{c.pages[0].rows[0].fixture.participants[0].name='TBC';},'SIDES'],
   ['draw-slot side',c=>{c.pages[0].rows[0].fixture.participants[0].name='Winner of Match 1';},'SIDES'],
   ['wrong source family',c=>{c.pages[0].rows[0].source_id='cricket-ca-current';},'SOURCE_SPORT'],
   ['duplicate row',c=>{c.pages[0].rows.push(structuredClone(c.pages[0].rows[0]));},'SOURCE_OR_DUPLICATE'],
   ['partial score',c=>{delete c.pages[0].rows[0].fixture.awayScore;},'SCORE'],
   ['contrary sides',c=>{c.pages[0].rows[0].fixture.participantIds.reverse();},'SIDES'],
   ['future fact clock',c=>{c.pages[0].rows[0].fixture.sourceCheckedAt='2026-10-23T16:00:00.000Z';},'CLOCK'],
   ['credential URL',c=>{c.pages[0].rows[0].fixture.sourceUrl='https://example.invalid/public?token=private';},'SOURCE_URL'],
   ['future capture response',c=>{c.pages[0].receivedAt='2026-10-22T16:44:00.000Z';},'CAPTURE_WINDOW'],
   ['claimed genuine export',c=>{c.provenance='operator-captured-public';},'PROVENANCE_UNQUALIFIED'],
  ]){
   const changed=capture();edit(changed);if(reason!=='PAGE_HASH')for(const page of changed.pages)page.sha256=hash(page.rows);
   await assert.rejects(()=>sync({file,now:new Date(changed.capturedAt),publicCapture:changed,request}),new RegExp('PUBLIC_COVERAGE_'+reason),name);
   assert(fs.readFileSync(file).equals(first),name+': candidate unchanged');checks++;
  }
  const stale=capture();stale.pages[0].rows[0].fixture.sourceCheckedAt='2026-10-20T00:00:00.000Z';stale.pages[0].sha256=hash(stale.pages[0].rows);
  await assert.rejects(()=>sync({file,now:new Date(stale.capturedAt),publicCapture:stale,request}),/No recent/);assert(fs.readFileSync(file).equals(first));checks++;
  await assert.rejects(()=>sync({file,now:new Date('2026-10-23T00:00:00Z'),publicCapture:capture(),request}),/REPLAY_CLOCK/);assert(fs.readFileSync(file).equals(first));checks++;
  await assert.rejects(()=>sync({file,now:new Date(capture().capturedAt),publicCapture:capture(),rows:[],request}),/AMBIGUOUS_INPUT/);checks++;
  const unknown=require('../config/fixture-identity').normalizeCore({...published,id:'fixture:rugby:unobserved',eventId:'fixture:rugby:unobserved',canonicalEventId:'fixture:rugby:unobserved',sourceEventIds:['fixture:rugby:unobserved'],startTimeUtc:'2026-10-21T00:00:00.000Z',participants:[{id:'team:other-home',name:'Other Home'},{id:'team:other-away',name:'Other Away'}],participantIds:['team:other-home','team:other-away'],homeParticipantId:'team:other-home',awayParticipantId:'team:other-away',unknownProtectedAnnotation:{retain:'unobserved'}});
  fs.writeFileSync(file,JSON.stringify({...JSON.parse(first),events:[published,unknown]}));await sync({file,now:new Date(capture().capturedAt),publicCapture:capture(),request});assert.deepEqual(JSON.parse(fs.readFileSync(file)).events.find(f=>f.id===unknown.id),unknown);checks++;
  // Exercise exact pagination through the real reader with fixture responses.
  const pages=capture(),full=Array.from({length:500},(_,i)=>{const row=structuredClone(pages.pages[0].rows[0]);row.fixture_id=row.fixture.id='fixture:rugby:page-'+i;row.identity_keys=[row.fixture.id];return row;});pages.pages[0].rows=full;pages.pages[0].sha256=hash(full);pages.pages.push({...structuredClone(pages.pages[0]),request:{...pages.pages[0].request,path:pages.pages[0].request.path.replace('offset=0','offset=500')},rows:[],sha256:hash([])});
  const replay=require('./lib/public-coverage-capture').replay(pages),rows=await require('./sync-live-coverage').readRows(replay.request);replay.complete();assert.equal(rows.length,500);checks++;
  assert.throws(()=>require('./lib/public-coverage-capture').validate({...pages,pages:[pages.pages[0]]}),/PAGE_COMPLETENESS/);checks++;
  const mutable=capture(),saved=require('./lib/public-coverage-capture').replay(mutable);mutable.pages[0].rows[0].fixture.homeScore=999;
  const frozenRows=await require('./sync-live-coverage').readRows(saved.request);saved.complete();assert.equal(frozenRows[0].fixture.homeScore,12,'Validated capture must be an immutable consumed snapshot');checks++;
  await assert.rejects(()=>require('./quick-results').refresh({coverageCapture:{profiles:[]}}),/PUBLIC_COVERAGE_PRIVATE_OR_UNKNOWN_FIELD/);checks++;
  await assert.rejects(()=>require('./quick-results').refresh({source:'nbl',now:new Date(capture().capturedAt),coverageCapture:capture()}),/REPLAY_CLOCK_OR_MODE/);checks++;
  const inputDir=path.join(root,'candidate-inputs');fs.mkdirSync(inputDir);const body=Buffer.from(JSON.stringify(capture()));fs.writeFileSync(path.join(inputDir,'public-coverage.json'),body);
  const capability={schemaVersion:'canonical-public-candidate.v1',target:'coverage:shared',sourceRevision:'0'.repeat(40),observedAt:capture().capturedAt,provenance:'constructed-fixture',response:{url:'/rest/v1/rpc/nothingsports_read_current_fixtures',path:'public-coverage.json',bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex')},processMs:5000,maxGeneratedBytes:2*1024*1024,maxArtifactBytes:1024*1024};
  const capFile=path.join(inputDir,'public-candidate.json');fs.writeFileSync(capFile,JSON.stringify(capability));
  const candidate=require('./lib/public-candidate'),accepted=candidate.capability(capFile);assert.equal(accepted.publicCoverageReceipt.rows,1);assert.equal(accepted.publicCoverageReceipt.pendingIntents.length,3);assert(candidate.frames(accepted,'/saved/public-coverage.json')[0].includes('--coverage-live'));assert(!candidate.frames(accepted,'/saved/public-coverage.json').some(f=>f.includes('--quick')));checks++;
  fs.writeFileSync(capFile,JSON.stringify({...capability,observedAt:'2026-10-23T00:00:00.000Z'}));assert.throws(()=>candidate.capability(capFile),/CANDIDATE_CAPTURE_CLOCK/);checks++;
  fs.writeFileSync(capFile,JSON.stringify({...capability,target:'quick'}));assert.throws(()=>candidate.capability(capFile),/CANDIDATE_UNQUALIFIED_TARGET/);checks++;
  const cli=[actualCli(root,capture()),actualCli(root,capture(),true)];checks+=cli.length;
  assert.equal(managedCalls,0);
  const proof={schemaVersion:'public-coverage-capture-tests.v1',checks,managedRequests:managedCalls,providerRequests:0,originalObservationPreserved:true,unknownProtectedContentPreserved:true,cli};
  console.log(JSON.stringify(proof,null,2));return proof;
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
function actualCli(root,input,forceFailure=false){
 const sourceRoot=path.resolve(__dirname,'..'),runtime=path.join(root,forceFailure?'cli-failure':'cli-success'),workspace=path.join(runtime,'workspace');fs.mkdirSync(runtime);fs.mkdirSync(path.join(workspace,'data/follow-sources'),{recursive:true});fs.mkdirSync(path.join(workspace,'feeds'));fs.symlinkSync(path.join(sourceRoot,'scripts'),path.join(workspace,'scripts'));
 const inputFile=path.join(runtime,'public-coverage.json');fs.writeFileSync(inputFile,JSON.stringify(input));
 const stable=require('./sync-live-coverage').project({events:[],participants:[],competitions:[],sources:[]},input.pages[0].rows,{now:new Date(input.capturedAt)}).document;
 if(forceFailure){stable.events[0].homeScore=3;stable.events[0].scoreDisplay='3–7';stable.events[0].sourceCheckedAt='2026-10-21T16:00:00.000Z';stable.events[0].unknownProtectedAnnotation={retain:true};}
 const coverageFile=path.join(workspace,'data/follow-sources/coverage.v1.json');fs.writeFileSync(coverageFile,JSON.stringify(stable));const before=fs.readFileSync(coverageFile);
 const sourceCoverage=fs.readFileSync(path.join(sourceRoot,'data/follow-sources/coverage.v1.json'));
 const names=cp.spawnSync('/usr/bin/git',['ls-files','-z'],{cwd:sourceRoot,encoding:'utf8'}).stdout.split('\0').filter(name=>/\.(?:cjs|mjs|js)$/.test(name));
 const modules=Object.fromEntries(names.map(name=>{const file=path.join(sourceRoot,name);return [file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')];}));
 const state=path.join(runtime,'ledger.json'),config=path.join(runtime,'capability.json');
 fs.writeFileSync(state,JSON.stringify({requests:0,frames:[],violations:[]}));
 const entry=path.join(workspace,'scripts/update-cards.js'),args=['--coverage-live','--live-coverage-public='+inputFile,'--local-only'];
 // Reuse exact source as hash-bound read-only dependencies. Only the tiny
 // runtime fixture directory is writable; no full workspace copy is needed.
 fs.writeFileSync(config,JSON.stringify({workspace,runtime,state,modules:{[entry]:modules[path.join(sourceRoot,'scripts/update-cards.js')],[path.join(workspace,'scripts/validate-source-coverage.js')]:modules[path.join(sourceRoot,'scripts/validate-source-coverage.js')]},dependencies:sourceRoot,dependencyHashes:modules,frames:[['scripts/update-cards.js',...args],['scripts/validate-source-coverage.js']],url:'denied',body:'',observedAt:input.capturedAt,deadline:Date.now()+5000}));
 const result=cp.spawnSync(process.execPath,[entry,...args],{cwd:workspace,env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',LANG:'en_AU.UTF-8',TMPDIR:runtime,NODE_OPTIONS:'--require='+JSON.stringify(path.join(sourceRoot,'scripts/lib/public-candidate-guard.cjs')),NS_PUBLIC_CANDIDATE_CONFIG:config,REFRESH_REPORT:path.join(runtime,'refresh.json')},encoding:'utf8',timeout:6000});
 const ledger=JSON.parse(fs.readFileSync(state));assert.equal(result.status,forceFailure?1:0,result.stderr+' '+JSON.stringify(ledger));assert.equal(ledger.requests,0);assert(fs.readFileSync(coverageFile).equals(before));assert(fs.readFileSync(path.join(sourceRoot,'data/follow-sources/coverage.v1.json')).equals(sourceCoverage));
 const report=JSON.parse(fs.readFileSync(path.join(runtime,'refresh.json')));assert.equal(report.mode,'public-coverage-replay');
 if(forceFailure){assert(ledger.violations.includes('CANDIDATE_COMMAND_UNQUALIFIED'));assert.equal(report.publicationState,'blocked-rolled-back');}
 else{assert.deepEqual(ledger.violations,[]);assert.equal(ledger.frames.length,2);assert.equal(report.publicCoverage.publicCapture.pages,1);assert.equal(report.publicationState,'validated');}
 return {state:report.publicationState,frames:ledger.frames.map(f=>f.file),sourceUnchanged:true,fixtureRolledBack:forceFailure,networkRequests:0};
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run,capture,fixture};
