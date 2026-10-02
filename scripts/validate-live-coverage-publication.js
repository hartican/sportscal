'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {project,readRows,sync,PAGE_SIZE,MAX_PAGES}=require('./sync-live-coverage');
const identity=require('../config/fixture-identity');
const now=new Date('2026-09-30T04:00:00Z');
const base={id:'fixture:rugby:wr:test',key:'rugby',sportDomainId:'sport:rugby-union',name:'Home v Away',startTimeUtc:'2026-09-26T12:00:00Z',sourceCheckedAt:'2026-09-27T00:00:00Z',status:'scheduled',participants:[{id:'home',name:'Home'},{id:'away',name:'Away'}],participantIds:['home','away'],homeParticipantId:'home',awayParticipantId:'away',viewingOptions:[{providerId:'stan'}]};
const row=(f,source_id='discovery-rugby-mru')=>({source_id,fixture_id:f.id,fixture:f});
const result={...base,status:'completed',homeScore:33,awayScore:52,scoreDisplay:'33–52',sourceCheckedAt:'2026-09-30T00:16:00Z',viewingOptions:[]};
const prior={events:[base],sources:[{id:'discovery-rugby-mru',checkedAt:base.sourceCheckedAt}],participants:[],competitions:[]};
(async()=>{
 const p=project(prior,[row(result),row({...base,sourceCheckedAt:'2026-09-27T20:58:00Z'},'discovery-rugby-mru-near')],{now});
 assert.equal(p.document.events[0].status,'completed');assert.equal(p.document.events[0].awayScore,52);assert.equal(p.document.events[0].viewingOptions[0].providerId,'stan');assert.equal(p.document.sources[0].checkedAt,base.sourceCheckedAt,'publication is not a new provider observation');assert.deepEqual(p.report.codes,['rugby-union']);
 const next=project(p.document,[row({...result,sourceCheckedAt:'2026-09-30T03:00:00Z'})],{now});assert.equal(next.report.changed,0,'poll timestamps alone do not republish');assert.equal(next.document,p.document);
 const added=project({...prior,events:[]},[row(result)],{now});assert.equal(project(added.document,[row(result)],{now}).report.changed,0,'new fixtures are also stable on a second pass');
 const older=project(p.document,[row({...result,startTimeUtc:'2026-09-28T12:00:00Z',sourceCheckedAt:'2026-09-29T23:00:00Z'})],{now});assert.equal(older.report.changed,0,'older source must not shift kickoff');
 for(const f of [{...result,sourceCheckedAt:'nonsense'},{...result,key:'football'},null])assert.throws(()=>project(prior,[row(f||{},'discovery-rugby-mru')],{now}));
 assert.throws(()=>project(prior,[row({...result,sourceCheckedAt:'2026-10-01T00:00:00Z'})],{now}),/No recent/);
 assert.throws(()=>project(prior,[],{now}),/No recent/);
 const calls=[];const rows=await readRows(async(url,opt)=>{calls.push({url,opt});return calls.length===1?Array.from({length:PAGE_SIZE},(_,i)=>row({...result,id:'fixture:'+i})):[];});assert.equal(rows.length,PAGE_SIZE);assert.equal(calls.length,2);assert(calls[1].url.includes('offset=500'));assert.equal(calls[0].opt.body.p_fixture_ids,null);assert(calls[0].url.includes('order=source_id.asc,fixture_id.asc'));
 await assert.rejects(()=>readRows(async()=>[row(result,'not-allowed')]),/Invalid/);
 await assert.rejects(()=>readRows(async()=>Array.from({length:PAGE_SIZE},()=>row(result))),/overlapping/);
 let n=0;await assert.rejects(()=>readRows(async()=>Array.from({length:PAGE_SIZE},()=>row({...result,id:'fixture:'+n++}))),/budget/);assert.equal(n,PAGE_SIZE*MAX_PAGES);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-live-coverage-'));try{const file=path.join(dir,'coverage.json');fs.writeFileSync(file,JSON.stringify(prior));const before=fs.readFileSync(file);await assert.rejects(()=>sync({file,now,request:async()=>{throw Error('unavailable')}}));assert(fs.readFileSync(file).equals(before));await sync({file,now,rows:[row(result)]});const changed=fs.readFileSync(file);await sync({file,now,rows:[row({...result,sourceCheckedAt:'2026-09-30T03:00:00Z'})]});assert(fs.readFileSync(file).equals(changed));}finally{fs.rmSync(dir,{recursive:true,force:true});}
 const sample=require('./fixtures/source-coverage/cricket-australia-abandoned.json');
 const [abandoned]=require('../lib/source-coverage').parseCricketFixtures([sample.fixture],sample);
 const cricketNow=new Date('2026-10-02T02:00:00Z');
 const cricketPrior={...prior,events:[{...abandoned,status:'completed',sourceCheckedAt:'2026-09-30T03:36:03.593Z',viewingOptions:[{providerId:'reviewed-test'}]}]};
 const cricketRows=[row(abandoned,'cricket-ca-current')];
 const corrected=project(cricketPrior,cricketRows,{now:cricketNow});
 assert.equal(corrected.report.changed,1);assert.deepEqual(corrected.report.codes,['cricket']);
 assert.equal(corrected.document.events[0].id,cricketPrior.events[0].id);assert.equal(corrected.document.events[0].status,'abandoned');
 assert.equal(corrected.document.events[0].statusCheckedAt,sample.checkedAt);assert.equal(corrected.document.events[0].viewingOptions[0].providerId,'reviewed-test');
 const cricketDir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-abandoned-publication-'));try{
  const file=path.join(cricketDir,'coverage.json');fs.writeFileSync(file,JSON.stringify(cricketPrior));
  await sync({file,now:cricketNow,rows:cricketRows});
  const published=fs.readFileSync(file);assert.equal(JSON.parse(published).events[0].status,'abandoned');
  await sync({file,now:cricketNow,rows:[row({...abandoned,sourceCheckedAt:'2026-10-02T01:50:00Z'},'cricket-ca-current')]});
  assert(fs.readFileSync(file).equals(published),'rechecking the same abandoned facts preserves published bytes and observation');
 }finally{fs.rmSync(cricketDir,{recursive:true,force:true});}
 const reviewed=require('./fixtures/bledisloe-reviewed-provider-pair.json').worldRugby;
 const reviewedNow=new Date('2026-10-02T15:00:00Z'),reviewedFresh={...reviewed,sourceName:'World Rugby',sourceFixtureId:reviewed.id.slice('fixture:rugby:wr:'.length),sourceCheckedAt:'2026-10-02T12:36:00.784Z'};
 const normalized=identity.normalizeCore(reviewedFresh),sourcePrior={events:[reviewedFresh],participants:[],competitions:[],sources:[]};
 const sourceResult=project(sourcePrior,[row(normalized)],{now:reviewedNow});
 assert.equal(sourceResult.document.events.length,1);assert.equal(sourceResult.document.events[0].id,reviewed.id,'shared normalized observations retain the original provider key');
 assert.equal(sourceResult.document.events[0].canonicalEventId,reviewedFresh.id===normalized.id?reviewedFresh.id:normalized.id);
 assert.equal(identity.normalizeCore(sourceResult.document.events[0]).id,'rugby-australia-new-zealand-2026-10-17','consumer action identity stays canonical');
 assert.equal(sourceResult.document.events[0].startTimeUtc,'2026-10-17T05:00:00.000Z');assert.equal(sourceResult.document.events[0].sourceCheckedAt,reviewedFresh.sourceCheckedAt);
 const damaged={...sourcePrior,events:[normalized]},recovered=project(damaged,[row(normalized)],{now:reviewedNow});assert.equal(recovered.document.events[0].id,reviewed.id,'existing canonicalized raw key is recoverable only from reviewed provider equivalence');assert.equal(project(recovered.document,[row(normalized)],{now:reviewedNow}).report.changed,0);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-provider-key-'));try{const file=path.join(temp,'coverage.json');fs.writeFileSync(file,JSON.stringify(damaged));await sync({file,now:reviewedNow,rows:[row(normalized)]});assert.equal(JSON.parse(fs.readFileSync(file)).events[0].id,reviewed.id);const bytes=fs.readFileSync(file);await sync({file,now:reviewedNow,rows:[row(normalized)]});assert(fs.readFileSync(file).equals(bytes));const full=await require('./refresh-source-coverage').refreshCoverage({outputPath:file,now:reviewedNow,sources:[{id:'test-reviewed-provider',fetch:async()=>[normalized]}]});assert.equal(full.events.find(f=>f.sourceFixtureId===reviewedFresh.sourceFixtureId).id,reviewed.id,'full owner also retains reviewed provider keys');assert.equal(identity.normalizeCore(full.events.find(f=>f.id===reviewed.id)).startTimeUtc,'2026-10-17T05:00:00.000Z');}finally{fs.rmSync(temp,{recursive:true,force:true});}
 const unknown={...normalized,sourceFixtureId:'00000000-0000-0000-0000-000000000000'};assert.equal(require('../lib/source-observation-identity').normalize(unknown).id,normalized.id,'unreviewed provider key cannot change a fixture identity');
 const {projectionSteps}=require('./quick-results');const steps=projectionSteps(['Live coverage cricket','Live coverage rugby-union']);assert(steps.some(s=>s.includes('--codes=cricket,rugby-union')));assert(!steps.some(s=>s[0]==='scripts/publish-feed.js'));assert(fs.readFileSync(path.join(__dirname,'quick-results.js'),'utf8').includes("require('./sync-live-coverage').sync({now})"));
 if(process.argv.includes('--live-read')){
  if(new URL(process.env.SUPABASE_URL).hostname!=='mkghopnkhcxtmfrcjdbc.supabase.co')throw Error('Unexpected live fixture project');
  const live=await readRows();if(!live.length)throw Error('No shared live coverage observations');
  const proof=project(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/follow-sources/coverage.v1.json'))),live);
  console.log(JSON.stringify({mode:'read-only-live-validation',...proof.report}));
 }
 console.log('Live coverage publication: result vs stale near-source, original provenance, viewing preservation, no-op bytes, older/future rejection, pagination ceiling, failure retention and quick projection scope passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
