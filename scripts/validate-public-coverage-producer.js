'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const owner=require('./sync-live-coverage'),producer=require('./lib/public-coverage-producer'),captureReader=require('./lib/public-coverage-capture');
const sample=require('./fixtures/public-candidate/coverage-service-response.json');
const at='2026-10-23T00:00:00.000Z'; // Explicit replay clock, not a new sporting observation.
async function run(){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-coverage-producer-'))),fetchBefore=global.fetch;
 let actualNetwork=0,checks=0,requests=0,caseNumber=0;
 global.fetch=async()=>{actualNetwork++;throw Error('Unexpected network at source/local test boundary');};
 const output=()=>{const folder=path.join(root,String(caseNumber++));fs.mkdirSync(folder);return path.join(folder,'public-coverage.json');};
 const make=async(rows=sample.rows,extra={})=>{let page=0;return producer.produce({clock:()=>new Date(at),request:async(resource,options)=>{requests++;assert.equal(options.method,'POST');assert.equal(options.body.p_fixture_ids,null);assert.equal(options.maxResponseBytes,2097152);assert(resource.includes('offset='+page*500));const rowsPage=rows.slice(page*500,++page*500);return structuredClone(rowsPage);},...extra});};
 try{
  // Producer and canonical service owner are real. Only the external request,
  // filesystem location and explicit clock are replaced.
  const file=path.join(root,'coverage.json'),out=output();
  const receipt=await owner.capturePublic({output:out,clock:()=>new Date(at),request:async()=>{requests++;return structuredClone(sample.rows);}});
  const saved=captureReader.read(out);assert.equal(receipt.currentSourceAcceptance,false);assert.equal(receipt.wholeSnapshotAcceptance,false);assert.equal(receipt.omissionsMayDelete,false);assert.equal(saved.provenance,'test-service-response');
  assert.deepEqual(saved.pages[0].rows,sample.rows,'Preserve every observed sporting detail/null/clock, including complete innings');checks++;
  fs.writeFileSync(file,JSON.stringify({events:[],participants:[],competitions:[],sources:[]}));
  const applied=await owner.sync({file,now:new Date(at),publicCapture:saved,request:async()=>{throw Error('Saved capture attempted managed fallback');}});
  assert.equal(applied.changed,3,'Stale historical alias row stays deferred');
  const published=JSON.parse(fs.readFileSync(file)),test=published.events.find(f=>f.id==='fixture:cricket:CA:39991');
  assert.equal(test.innings[0].runsScored,425);assert.deepEqual(test.innings[0].batting,sample.rows[0].fixture.innings[0].batting);assert.equal(test.sourceCheckedAt,'2026-10-22T17:22:00.415Z');
  assert.equal(published.events.find(f=>f.dateOnly).startTimeUtc,null);checks++;
  const bytes=fs.readFileSync(file);await owner.sync({file,now:new Date(at),publicCapture:saved});assert(fs.readFileSync(file).equals(bytes));checks++;
  const alias=saved.pages[0].rows.at(-1);assert.equal(alias.fixture.canonicalEventId,'fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8');assert.equal(require('../config/fixture-identity').canonicalFixtureId(alias.fixture_id),'rugby-australia-new-zealand-2026-10-17');checks++;
  const projected=saved.pages[0].rows[0].fixture;assert.equal(projected.scoreFactObservedAt,sample.rows[0].fixture.scoreFactObservedAt);assert.equal(projected.statusFactObservedAt,sample.rows[0].fixture.statusFactObservedAt);checks++;
  // Documented viewing shape is constructed here only; no real fixture's
  // rights/provenance claim is changed in source or production.
  const withViewing=structuredClone(sample.rows);withViewing[2].fixture.viewingOptions=[{providerId:'constructed',rightsScope:'fixture',linkScope:'sport',webUrl:'https://example.invalid/watch',sourceUrl:'https://example.invalid/rights',verifiedAt:'2026-10-22T11:00:00Z',territory:'AU',liveOrReplay:'live',accessType:'subscription'}];
  const viewing=await make(withViewing);assert.deepEqual(viewing.value.pages[0].rows[2].fixture.viewingOptions,withViewing[2].fixture.viewingOptions);checks++;
  for(const [label,edit,reason]of [
   ['private row',r=>{r[0].user_id='do-not-export';},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['unknown sporting field',r=>{r[0].fixture.unqualifiedSportingDetail={runs:123};},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private fixture',r=>{r[0].fixture.preferences={followed:['private']};},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private participant',r=>{r[0].fixture.participants[0].email='private@example.invalid';},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private batting detail',r=>{r[0].fixture.innings[0].batting[0].account_id='private';},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private bowling detail',r=>{r[0].fixture.innings[0].bowling[0].profile={};},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['private viewing',r=>{r[0].fixture.viewingOptions=[{providerId:'constructed',token:'secret'}];},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['unknown innings structure',r=>{r[0].fixture.innings[0].batsmen=[{private:true}];},'PRIVATE_OR_UNKNOWN_FIELD'],
   ['unreviewed alias',r=>{r[0].identity_keys.push('fixture:cricket:CA:99999999');},'ALIAS_UNQUALIFIED'],
   ['foreign canonical pointer',r=>{r[0].fixture.canonicalEventId='fixture:cricket:espn:1525661';},'ALIAS_UNQUALIFIED'],
   ['wrong source family',r=>{r[0].source_id='discovery-rugby-wru';},'SOURCE_SPORT'],
   ['unsupported source',r=>{r[0].source_id='discovery-cricket-future-0';},'SOURCE_OR_DUPLICATE'],
   ['contrary ordered sides',r=>{r[1].fixture.participantIds.reverse();},'SIDES'],
   ['colliding unresolved provider sides',r=>{const f=r[1].fixture;f.participantIds=['team:rugby:wr-0','team:rugby:wr-0'];f.participants.forEach(p=>{p.id='team:rugby:wr-0';});f.homeParticipantId=f.awayParticipantId='team:rugby:wr-0';},'SIDES'],
   ['partial rugby score',r=>{delete r[2].fixture.awayScore;},'SCORE'],
   ['contrary innings participant',r=>{r[0].fixture.innings[0].participantId='team:unrelated';},'SCORE'],
   ['duplicate innings',r=>{r[0].fixture.innings=[r[0].fixture.innings[0],r[0].fixture.innings[0]];},'SCORE'],
   ['future sporting receipt',r=>{r[0].fixture.scoreCheckedAt='2026-10-24T00:00:00Z';},'CLOCK'],
   ['future detail receipt',r=>{r[0].fixture.innings[0].detailCheckedAt='2026-10-24T00:00:00Z';},'CLOCK'],
   ['future viewing receipt',r=>{r[0].fixture.viewingOptions=[{providerId:'constructed',verifiedAt:'2026-10-24T00:00:00Z'}];},'CLOCK'],
   ['partial innings',r=>{delete r[0].fixture.innings[0].runsScored;},'SCORE'],
   ['invalid cricket overs',r=>{r[0].fixture.innings[0].oversBowled='12.9';},'SCORE'],
   ['query credential',r=>{r[0].fixture.sourceUrl='https://example.invalid/?token=private';},'SOURCE_URL'],
   ['unknown source URL query',r=>{r[1].fixture.sourceUrl+='&unreviewed=private';},'SOURCE_URL'],
   ['unknown start promoted exact',r=>{r[1].fixture.timePrecision='exact';},'CLOCK'],
  ]){
   const rows=structuredClone(sample.rows);edit(rows);const target=output();
   await assert.rejects(()=>make(rows,{output:target}),new RegExp('PUBLIC_COVERAGE_'+reason),label);
   assert(!fs.existsSync(target),label+': no public artifact');assert(fs.readFileSync(file).equals(bytes));checks++;
  }
  const uncertain=structuredClone(sample.rows[1]);uncertain.fixture.participants=uncertain.fixture.participants.slice(0,1);uncertain.fixture.participantIds=uncertain.fixture.participantIds.slice(0,1);delete uncertain.fixture.awayParticipantId;uncertain.fixture.participantSlots=[{slot:1,participantId:uncertain.fixture.homeParticipantId,label:uncertain.fixture.participants[0].name},{slot:2,participantId:null,label:'TBC'}];const partialSides=await make([uncertain]);assert.deepEqual(partialSides.value.pages[0].rows[0],uncertain);checks++;
  const near=structuredClone(sample.rows[1]);near.source_id='discovery-rugby-mru-near';const prefixSources=await make([sample.rows[1],near]);assert.equal(prefixSources.receipt.rows,2,'SQL source order compares source and fixture separately, including prefix sources');checks++;
  const template=sample.rows[1];
  const paged=Array.from({length:501},(_,i)=>{const row=structuredClone(template),uuid='00000000-0000-4000-8000-'+String(i).padStart(12,'0'),id='fixture:rugby:wr:'+uuid;row.fixture_id=row.fixture.id=row.fixture.eventId=row.fixture.canonicalEventId=id;row.fixture.sourceEventIds=row.identity_keys=[id];row.fixture.sourceFixtureId=uuid;return row;});
  const two=await make(paged);assert.equal(two.receipt.pages,2);assert.equal(two.receipt.rows,501);assert.equal(two.value.pages[1].request.path.includes('offset=500'),true);checks++;
  for(const [label,rows]of [['duplicate inside page',[...sample.rows,sample.rows[0]]],['page overlap',[...paged.slice(0,500),paged[499]]],['page order drift',[...paged.slice(0,500),{...paged[500],fixture_id:paged[0].fixture_id,fixture:paged[0].fixture,identity_keys:paged[0].identity_keys}]]]){
   await assert.rejects(()=>make(rows),/overlapping|SOURCE_OR_DUPLICATE/,'Reader must refuse '+label);checks++;
  }
  const reverse=structuredClone(paged);[reverse[499],reverse[500]]=[reverse[500],reverse[499]];await assert.rejects(()=>make(reverse),/PAGE_ORDER_OR_DRIFT/);checks++;
  let n=0;await assert.rejects(()=>producer.produce({clock:()=>new Date(at),request:async()=>paged.slice(0,500).map(row=>{const r=structuredClone(row),id='fixture:rugby:wr:00000000-0000-4000-8000-'+String(n++).padStart(12,'0');r.fixture_id=r.fixture.id=r.fixture.eventId=r.fixture.canonicalEventId=id;r.identity_keys=r.fixture.sourceEventIds=[id];return r;})}),/budget|PAGE_BUDGET/);checks++;
  const target=output();let calls=0;await assert.rejects(()=>producer.produce({output:target,clock:()=>new Date(at),request:async()=>{if(calls++)throw Error('simulated second-page failure');return paged.slice(0,500);}}),/PUBLIC_COVERAGE_SERVICE_READ_FAILED/);assert.equal(calls,2);assert(!fs.existsSync(target));checks++;
  const protectedOutput=output();fs.writeFileSync(protectedOutput,'last-good');await assert.rejects(()=>owner.capturePublic({output:protectedOutput,request:async()=>{throw Error('Existing output must reject before request');}}),/OUTPUT_EXISTS/);assert.equal(fs.readFileSync(protectedOutput,'utf8'),'last-good');checks++;
  const dangling=output();fs.symlinkSync(path.join(root,'missing-target'),dangling);let danglingRequests=0;await assert.rejects(()=>owner.capturePublic({output:dangling,clock:()=>new Date(at),request:async()=>{danglingRequests++;return structuredClone(sample.rows);}}),/OUTPUT_EXISTS/);assert.equal(danglingRequests,0);assert(fs.lstatSync(dangling).isSymbolicLink());checks++;
  const late=await make(sample.rows,{clock:()=>new Date('2026-10-26T00:00:00Z')});assert.equal(late.receipt.currentSourceAcceptance,false);
  await assert.rejects(()=>owner.sync({file,now:new Date(late.value.capturedAt),publicCapture:late.value}),/No recent/);assert(fs.readFileSync(file).equals(bytes));checks++;
  const mutated=structuredClone(saved),replay=captureReader.replay(mutated);mutated.pages[0].rows[0].fixture.innings[0].runsScored=999;
  const replayRows=await owner.readRows(replay.request);replay.complete();assert.equal(replayRows[0].fixture.innings[0].runsScored,425);checks++;
  for(const [label,edit,reason]of [
   ['hash',v=>{v.pages[0].sha256='0'.repeat(64);},'PAGE_HASH'],
   ['request method',v=>{v.pages[0].request.method='GET';},'REQUEST_CONTRACT'],
   ['claimed atomicity',v=>{v.consistency='atomic-snapshot';},'PRODUCER_CONTRACT'],
   ['producer drift',v=>{v.producer.expectedReaderDefinitionMd5='0'.repeat(32);},'PRODUCER_CONTRACT'],
   ['missing terminal page',v=>{v.pages=two.value.pages.slice(0,1);},'PAGE_COMPLETENESS'],
   ['receipt before request',v=>{v.pages[0].receivedAt='2026-10-22T23:59:59Z';},'CAPTURE_WINDOW'],
   ['unknown private envelope',v=>{v.privateSnapshot={};},'PRIVATE_OR_UNKNOWN_FIELD'],
  ]){const value=structuredClone(saved);edit(value);await assert.rejects(()=>owner.sync({file,now:new Date(at),publicCapture:value}),new RegExp(reason),label);assert(fs.readFileSync(file).equals(bytes));checks++;}
  const extra=structuredClone(published.events[1]);extra.id=extra.eventId=extra.canonicalEventId='fixture:rugby:unobserved-retained';extra.sourceEventIds=[extra.id];extra.protectedAnnotation={retain:true};
  fs.writeFileSync(file,JSON.stringify({...published,events:[...published.events,extra]}));await owner.sync({file,now:new Date(at),publicCapture:saved});assert.deepEqual(JSON.parse(fs.readFileSync(file)).events.find(f=>f.id===extra.id),extra);checks++;
  const aliasOnly=await make([sample.rows.at(-1)],{clock:()=>new Date('2026-10-02T15:00:00Z')});const aliasFile=path.join(root,'alias-coverage.json');fs.writeFileSync(aliasFile,JSON.stringify({events:[],participants:[],competitions:[],sources:[]}));await owner.sync({file:aliasFile,now:new Date(aliasOnly.value.capturedAt),publicCapture:aliasOnly.value});const aliasPublished=JSON.parse(fs.readFileSync(aliasFile)).events[0];assert.equal(aliasPublished.id,'fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8');assert.equal(aliasPublished.canonicalEventId,'rugby-australia-new-zealand-2026-10-17');checks++;
  // Reach the actual bounded service-client path with a trapped fetch body,
  // not a replacement parser or fixture publisher.
  const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SECRET_KEY:'sb_secret_synthetic_test_only'};
  const refusedOutput=output();let fetches=0,cancels=0;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(2097153));},cancel(){cancels++;}});
  await assert.rejects(()=>owner.capturePublic({output:refusedOutput,clock:()=>new Date(at),request:(url,options)=>require('../lib/supabase-server').supabaseServiceRequest(url,{...options,environment:env,fetchImpl:async()=>{fetches++;return new Response(stream);}})}),/PUBLIC_COVERAGE_SUPABASE_RESPONSE_TOO_LARGE/);assert.equal(fetches,1);assert.equal(cancels,1);assert(!stream.locked);assert(!fs.existsSync(refusedOutput));checks++;
  const authOutput=output();await assert.rejects(()=>owner.capturePublic({output:authOutput,clock:()=>new Date(at),request:(url,options)=>require('../lib/supabase-server').supabaseServiceRequest(url,{...options,environment:env,fetchImpl:async()=>new Response('{"message":"private backend contents"}',{status:403})})}),e=>e.status===403&&!e.message.includes('private backend contents'));assert(!fs.existsSync(authOutput));checks++;
  const update=require('./update-cards'),command=['--coverage-live','--local-only','--capture-live-coverage-public='+output()];
  const options=update.parseOptions(command,{});assert(options.publicCoverageOutput);
  for(const argv of [command.filter(x=>x!=='--local-only'),[...command,'--quick'],[...command,'--live-coverage-public=/tmp/public-coverage.json'],[...command,command[2]]])assert.throws(()=>update.parseOptions(argv,{}),/export requires/);checks++;
  const canonicalReceipt=await update.capturePublicCoverage(options,{clock:()=>new Date(at),request:async()=>structuredClone(sample.rows)});assert.equal(canonicalReceipt.rows,4);checks++;
  const capFile=path.join(path.dirname(out),'public-candidate.json'),body=fs.readFileSync(out),crypto=require('node:crypto');
  const capability={schemaVersion:'canonical-public-candidate.v1',target:'coverage:shared',sourceRevision:'0'.repeat(40),observedAt:saved.capturedAt,provenance:saved.provenance,response:{url:require('./lib/live-coverage-read-contract').RPC,path:'public-coverage.json',bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex')},processMs:5000,maxArtifactBytes:1024*1024,maxGeneratedBytes:2*1024*1024};
  fs.writeFileSync(capFile,JSON.stringify(capability));assert.equal(require('./lib/public-candidate').capability(capFile).publicCoverageReceipt.schemaVersion,'live-coverage-public-capture.v2');checks++;
  fs.writeFileSync(capFile,JSON.stringify({...capability,provenance:'service-read'}));assert.throws(()=>require('./lib/public-candidate').capability(capFile),/UNQUALIFIED_PROVENANCE/);checks++;
  fs.writeFileSync(capFile,JSON.stringify({...capability,target:'quick:nbl',provenance:'service-read'}));assert.throws(()=>require('./lib/public-candidate').capability(capFile),/UNQUALIFIED_PROVENANCE/);checks++;
  const cli=[require('./validate-public-coverage-capture').actualCli(root,saved),require('./validate-public-coverage-capture').actualCli(root,saved,true)];assert.equal(cli[0].state,'validated');assert.equal(cli[1].state,'blocked-rolled-back');checks+=2;
  assert.equal(actualNetwork,0);
  console.log(JSON.stringify({checks,sourceShapedRows:4,simulatedRequests:requests,actualNetworkRequests:actualNetwork,pagesAreAtomic:false,originalSportingDetailsAndClocksPreserved:true},null,2));
  return {checks,actualNetworkRequests:actualNetwork};
 }finally{global.fetch=fetchBefore;fs.rmSync(root,{recursive:true,force:true});}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={run};
