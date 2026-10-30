'use strict';
// Exercise the real quick owner, shared reader, merger and Feed reconciliation.
// Only the public HTTP response, filesystem, clock and native child boundary are
// controlled. No canonical CLI, network, database or native child is executed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const ROOT=path.resolve(__dirname,'..'),AT='2026-10-14T03:00:00.000Z';
const ASSETS=['assets/js/app-shell-runtime.js','assets/js/calendar-sync-ui.js',...Object.keys(require('./build-deferred-sports-ui').modules)];
const original={...Object.fromEntries(['readFileSync','existsSync','readdirSync','openSync','closeSync','fstatSync','readSync'].map(k=>[k,fs[k]])),Date:global.Date};
const receipt=JSON.parse(original.readFileSync(path.join(__dirname,'fixtures/refresh-cricket-result-20261016.json')));
const other={id:'unrelated-epl',key:'premier-league',status:'completed',score:'2–1',sourceCheckedAt:'2026-10-01T06:00:00Z',selectedSentence:'Retained reviewed writing',unknown:{keep:true}};
const rugby={id:'fixture:rugby:wr:11111111-1111-4111-8111-111111111111',key:'rugby',sportDomainId:'sport:rugby-union',name:'Controlled Home v Controlled Away',status:'completed',sourceStatus:'C',startTimeUtc:'2026-10-13T20:00:00.000Z',participantIds:['team:rugby:controlled-home','team:rugby:controlled-away'],homeParticipantId:'team:rugby:controlled-home',awayParticipantId:'team:rugby:controlled-away',homeScore:0,awayScore:0,scoreDisplay:'0–0',sourceName:'World Rugby',sourceType:'official',sourceFixtureId:'11111111-1111-4111-8111-111111111111',sourceUrl:'https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=2026-10-12&endDate=2027-01-12&sport=mru&states=U,UP,L,CC,C&pageSize=100&sort=asc&page=0',sourceCheckedAt:'2026-10-14T02:00:00.000Z',scoreFactObservedAt:'2026-10-13T22:00:00.000Z',statusFactObservedAt:'2026-10-13T23:00:00.000Z'};
let files,children,calls,pages,failedChild,fds,sequence;
const resolve=p=>path.resolve(String(p));
function reset(){
 files=new Map([
  ['data/events.json',JSON.stringify({events:[receipt.card,other]})],
  ['feeds/incoming/events.json',JSON.stringify({events:[receipt.card,other]})],
  ['data/follow-sources/coverage.v1.json',JSON.stringify({events:[],participants:[],competitions:[],sources:[]})],
  ['data/code-inspector/cricket.json',JSON.stringify({fixtures:receipt.aliasRecords})],
  ...ASSETS.map(file=>[file,'retained-'+file]),
 ].map(([p,b])=>[path.join(ROOT,p),Buffer.from(b)]));
 children=[];calls=[];pages=[[{source_id:'cricket-ca-current',fixture_id:receipt.result.id,fixture:structuredClone(receipt.result)}]];failedChild=null;fds=new Map();sequence=0;
}
fs.readFileSync=function(p,encoding){const b=files?.get(resolve(p));return b?(typeof encoding==='string'?b.toString(encoding):Buffer.from(b)):original.readFileSync.apply(this,arguments);};
fs.writeFileSync=(p,b)=>{p=resolve(p);assert(p.startsWith(ROOT+'/data/')||p.startsWith(ROOT+'/feeds/')||ASSETS.some(f=>p===ROOT+'/'+f)||p.startsWith('/tmp/ns-live-noio/'),'Unexpected write '+p);files.set(p,Buffer.from(b));};
fs.existsSync=p=>ASSETS.some(f=>resolve(p)===ROOT+'/'+f)?files.has(resolve(p)):files?.has(resolve(p))||original.existsSync(p);
fs.readdirSync=(p,options)=>{p=resolve(p);if(p===ROOT+'/data'||p.startsWith(ROOT+'/data/')||p===ROOT+'/feeds'||p.startsWith(ROOT+'/feeds/')){const names=[...new Set([...files.keys()].filter(f=>f.startsWith(p+'/')).map(f=>f.slice(p.length+1).split('/')[0]))];return options?.withFileTypes?names.map(name=>({name,isDirectory:()=>[...files.keys()].some(f=>f.startsWith(p+'/'+name+'/'))})):names;}return original.readdirSync(p,options);};
fs.unlinkSync=p=>{assert(files.delete(resolve(p)));};
fs.mkdirSync=p=>{assert(resolve(p).startsWith('/tmp/ns-live-noio'));};
os.tmpdir=()=>'/tmp/ns-live-noio';
fs.mkdtempSync=()=>'/tmp/ns-live-noio/child-'+(++sequence);
fs.openSync=(p,flags,...args)=>{if(flags==='r')return original.openSync(p,flags,...args);p=resolve(p);assert(p.startsWith('/tmp/ns-live-noio/'));files.set(p,Buffer.alloc(0));const fd=10000+(++sequence);fds.set(fd,p);return fd;};
fs.fstatSync=fd=>fds.has(fd)?{size:files.get(fds.get(fd)).length}:original.fstatSync(fd);
fs.readSync=(fd,...args)=>fds.has(fd)?0:original.readSync(fd,...args);
fs.closeSync=fd=>{if(fds.has(fd))fds.delete(fd);else original.closeSync(fd);};
fs.rmSync=p=>{p=resolve(p);assert(p.startsWith('/tmp/ns-live-noio/'));for(const file of files.keys())if(file===p||file.startsWith(p+'/'))files.delete(file);};
cp.spawnSync=(_command,args)=>{assert(!/refresh-|redeploy|settle-|update-cards/.test(args[0]),'Unexpected source/publisher child '+args[0]);children.push(args);if(args[0]==='scripts/build-app-shell-runtime.js')for(const file of ASSETS)files.set(ROOT+'/'+file,Buffer.from('candidate-'+file));if(failedChild===args[0]){files.set(ROOT+'/data/new-candidate.json',Buffer.from('{}'));return{status:1};}return{status:0};};
for(const name of ['spawn','exec','execSync','execFile','execFileSync','fork'])cp[name]=()=>assert.fail('Unexpected native child');
for(const name of ['http','https','net','tls'])for(const key of ['get','request','connect','createConnection'])if(require('node:'+name)[key])require('node:'+name)[key]=()=>assert.fail('Unexpected native network');
process.env.SUPABASE_URL='https://public-fixture-test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='constructed-test-key';delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_MAINTENANCE_MODE;
process.env.QUICK_RESULTS_REPORT='/tmp/ns-live-noio/quick.json';delete process.env.REFRESH_REPORT;
global.fetch=async(url,options)=>{const u=new URL(url);assert.equal(u.origin,'https://public-fixture-test.invalid');assert.equal(u.pathname,'/rest/v1/rpc/nothingsports_read_current_fixtures');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{p_fixture_ids:null});assert.equal(u.searchParams.get('limit'),'500');assert.equal(u.searchParams.get('offset'),String(calls.length*500));calls.push(u.href);const body=pages[calls.length-1];assert.notEqual(body,undefined,'Unexpected extra request');return {ok:true,status:200,text:async()=>JSON.stringify(body)};};
class Clock extends original.Date{constructor(...args){super(...(args.length?args:[AT]));}static now(){return original.Date.parse(AT);}}
global.Date=Clock;
const quick=require('./quick-results'),rules=require('./lib/storyline-card-rules');
const document=file=>JSON.parse(files.get(ROOT+'/'+file)),records=[];
const put=(file,doc)=>files.set(ROOT+'/'+file,Buffer.from(JSON.stringify(doc)));
function addRugby(edit=()=>{}){
 const fixture=structuredClone(rugby);edit(fixture);
 pages[0].push({source_id:'discovery-rugby-mru',fixture_id:fixture.id,fixture});
 const card={...rugby,status:'upcoming',sourceCheckedAt:'2026-10-01T00:00:00.000Z',viewingOptions:[{providerId:'stan'}]};
 for(const key of ['sourceStatus','homeScore','awayScore','scoreDisplay','scoreFactObservedAt','statusFactObservedAt'])delete card[key];
 for(const file of ['feeds/incoming/events.json','data/events.json']){const doc=document(file);doc.events.push(card);put(file,doc);}
 return fixture;
}
const snapshot=()=>new Map([...files].filter(([p])=>p.startsWith(ROOT+'/')));
function restored(before){for(const [p,b]of before)assert.deepEqual(files.get(p),b,'Not restored: '+p);for(const p of files.keys())if(p.startsWith(ROOT+'/'))assert(before.has(p),'Candidate file retained: '+p);}
async function check(name,fn){reset();await fn();records.push(name);}
async function run(){
 await check('verified completed Cricket reaches both retained Feed surfaces through the actual quick owner',async()=>{
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.equal(report.source,'live-coverage');assert.equal(calls.length,1);
  for(const file of ['data/events.json','feeds/incoming/events.json']){
   const [card,retained]=document(file).events;assert.equal(card.id,receipt.card.id);assert.equal(card.status,'completed');assert.equal(card.score,'Australia win by 214 runs');assert.equal(card.scoreCheckedAt,receipt.result.scoreFactObservedAt);assert.equal(card.sourceCheckedAt,receipt.card.sourceCheckedAt);assert.deepEqual(card.viewingOptions,receipt.card.viewingOptions);assert.equal(rules.spoilerContractIssues(card).length,0);assert.deepEqual(retained,other);
  }
  assert(children.some(args=>args[0]==='scripts/publish-feed.js'&&args[1]==='data/events.json'),'publication starts from retained published facts');
  assert(!children.some(args=>/enrich-storyline|select-result-editorial/.test(args[0])),'scores do not start editorial work');
 });
 await check('source report separates score and completed status from schedule-only changes',async()=>{
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.deepEqual(report.liveCoverage.scoreChangedFixtureIds,[receipt.result.id]);
  assert.deepEqual(report.liveCoverage.finalResultChangedFixtureIds,[receipt.result.id]);
  assert.deepEqual(report.liveCoverage.scheduleOnlyChangedFixtureIds,[]);
 });
 await check('strict canonical flags refuse mixed, missing, duplicated and offline routes before I/O',async()=>{
  const {parseOptions}=require('./update-cards');
  assert.equal(parseOptions(['--quick','--source=live-coverage','--local-only'],{}).localOnly,true);
  for(const args of [[],['--quick'],['--local-only'],['--quick','--local-only','--offline'],['--quick','--local-only','--rebuild'],['--quick','--local-only','--live'],['--quick','--local-only','--source=nbl'],['--quick','--local-only','--source=live-coverage'],['--quick','--local-only','--unknown']])assert.throws(()=>parseOptions(['--source=live-coverage',...args],{}),/requires only/);
  await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',offline:true,now:new Date(AT)}));assert.equal(calls.length,0);assert.equal(children.length,0);
 });
 await check('unchanged final polls retain source/result clocks and all candidate bytes',async()=>{
  await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});const before=snapshot();
  calls=[];children=[];pages[0][0].fixture.sourceCheckedAt='2026-10-14T02:00:00.000Z';
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.equal(report.liveCoverage.changed,0);assert.deepEqual(report.reconciledResults,[]);assert.equal(children.length,0);restored(before);
 });
 await check('a final present only in published Feed is repaired without adding an incoming card',async()=>{
  put('feeds/incoming/events.json',{events:[other]});
  await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.equal(document('data/events.json').events[0].status,'completed');assert.deepEqual(document('feeds/incoming/events.json').events,[other]);
 });
 await check('an overdue schedule never becomes a manufactured final',async()=>{
  pages[0][0].fixture={...receipt.result,status:'scheduled'};for(const field of ['score','scoreDisplay','homeScore','awayScore','result','resultStatus','outcomeText','recapText','innings'])delete pages[0][0].fixture[field];
  const before=Buffer.from(files.get(ROOT+'/data/events.json'));
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.deepEqual(report.reconciledResults,[]);assert.deepEqual(report.liveCoverage.scoreChangedFixtureIds,[]);assert.equal(children.some(a=>a[0]==='scripts/publish-feed.js'),false);
 });
 for(const [name,edit]of [
  ['malformed collection',()=>{pages=[{}];}],
  ['overlapping source rows',()=>{pages[0].push(structuredClone(pages[0][0]));}],
  ['unapproved source',()=>{pages[0][0].source_id='private-account';}],
  ['wrong fixture key',()=>{pages[0][0].fixture_id='wrong';}],
  ['wrong sport',()=>{pages[0][0].fixture.key='football';}],
  ['missing observation',()=>{delete pages[0][0].fixture.sourceCheckedAt;}],
  ['conflicting recorded participants',()=>{pages[0][0].fixture.participantIds=['team:cricket:england','team:cricket:australia'];}],
  ['conflicting retained final',()=>{const d=document('data/events.json');d.events[0]={...d.events[0],status:'completed',score:'Different official result',outcomeText:'Different official result',recapText:'An existing accepted final.'};put('data/events.json',d);}],
 ])await check(name+' preserves the entire candidate',async()=>{edit();const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}));restored(before);assert.equal(children.length,0);});
 for(const stamp of ['2026-10-12T00:00:00.000Z','2026-10-14T03:05:00.001Z'])await check('stale/future observation '+stamp+' is retained as unavailable',async()=>{
  pages[0][0].fixture.sourceCheckedAt=stamp;const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/No recent/);restored(before);assert.equal(children.length,0);
 });
 await check('a valid result proceeds beside a stale independent observation',async()=>{
  pages[0].push({source_id:'discovery-rugby-wrs',fixture_id:'stale-women-sevens',fixture:{id:'stale-women-sevens',key:'rugby',status:'scheduled',sourceCheckedAt:'2026-10-10T00:00:00Z'}});
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});assert.equal(document('data/events.json').events[0].status,'completed');assert.deepEqual(report.liveCoverage.staleFixtureIds,['stale-women-sevens']);assert(!document('data/follow-sources/coverage.v1.json').events.some(e=>e.id==='stale-women-sevens'));
 });
 await check('page ceiling rejects after eight requests with complete rollback',async()=>{
  pages=Array.from({length:8},(_,p)=>Array.from({length:500},(_,i)=>{const fixture={...receipt.result,id:'bounded-'+(p*500+i)};return{source_id:'cricket-ca-current',fixture_id:fixture.id,fixture};}));
  const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/budget/);assert.equal(calls.length,8);restored(before);assert.equal(children.length,0);
 });
 await check('failed later page cannot publish a partial observation',async()=>{
  const first=Array.from({length:500},(_,i)=>{const fixture={...receipt.result,id:'bounded-'+i};return{source_id:'cricket-ca-current',fixture_id:fixture.id,fixture};});pages=[first,{error:'partial source unavailable'}];
  const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}));assert.equal(calls.length,2);restored(before);assert.equal(children.length,0);
 });
 await check('failed projection restores Feed, coverage, runtime and removes new candidate files',async()=>{
  const before=snapshot();failedChild='scripts/build-app-shell-runtime.js';
  await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/failed/);restored(before);assert.equal(fds.size,0);
  assert.equal(JSON.parse(files.get('/tmp/ns-live-noio/quick.json')).publicationState,'blocked-rolled-back');
 });
 await check('raw official Rugby drawn final reaches both Feed copies with zero scores and independent original clocks',async()=>{
  addRugby();await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  for(const file of ['feeds/incoming/events.json','data/events.json']){
   const card=document(file).events.find(e=>e.id===rugby.id);assert.equal(card.status,'completed');assert.equal(card.homeScore,0);assert.equal(card.awayScore,0);assert.equal(card.score,'0–0');assert.equal(card.scoreCheckedAt,rugby.scoreFactObservedAt);assert.equal(card.statusCheckedAt,rugby.statusFactObservedAt);assert.equal(card.resultSourceCheckedAt,rugby.scoreFactObservedAt);assert.equal(card.sourceCheckedAt,'2026-10-01T00:00:00.000Z');assert.deepEqual(card.viewingOptions,[{providerId:'stan'}]);assert.equal(card.winnerParticipantId,undefined);assert.equal(rules.spoilerContractIssues(card).length,0);
  }
 });
 await check('a Rugby final without its original score clock is deferred on Schedule and Feed beside a valid Cricket result',async()=>{
  addRugby(f=>{delete f.scoreFactObservedAt;});
  const old=document('data/events.json').events.find(e=>e.id===rugby.id),coverage=document('data/follow-sources/coverage.v1.json');coverage.events.push(old);put('data/follow-sources/coverage.v1.json',coverage);
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.equal(document('data/events.json').events[0].status,'completed');
  assert.equal(document('data/events.json').events.find(e=>e.id===rugby.id).status,'upcoming');
  assert.equal(document('data/follow-sources/coverage.v1.json').events.find(e=>e.id===rugby.id).status,'upcoming');
  assert(report.deferredResults.some(r=>r.fixtureId===rugby.id&&/observations/.test(r.reason)));
 });
 for(const [name,edit]of [
  ['unofficial source',f=>{f.sourceType='unverified';}],
  ['unrecognised provider name',f=>{f.sourceName='Unknown reporter';}],
  ['wrong official endpoint',f=>{f.sourceUrl='https://example.com/rugby/v3/match';}],
  ['typed tuple cannot bypass the allocated World Rugby source',f=>{f.sourceUrl='https://example.com/rugby/v3/match';f.score='0–0';f.outcomeText='0–0';f.recapText='Controlled result tuple';f.resultSourceUrl=f.sourceUrl;f.resultSourceCheckedAt=f.scoreFactObservedAt;}],
  ['wrong provider fixture ID',f=>{f.sourceFixtureId='22222222-2222-4222-8222-222222222222';}],
  ['unconfirmed terminal phase',f=>{f.sourceStatus='L';}],
  ['duplicate ordered sides',f=>{f.awayParticipantId=f.homeParticipantId;}],
  ['incomplete numeric score',f=>{f.awayScore=null;}],
  ['negative score',f=>{f.homeScore=-1;}],
  ['untyped numeric string',f=>{f.homeScore='0';}],
  ['contradictory score display',f=>{f.scoreDisplay='1–0';}],
  ['contradictory retained score field',f=>{f.score='1–0';}],
  ['explicit unknown score fact despite later poll',f=>{f.scoreFactObservedAt=null;f.scoreCheckedAt=AT;}],
  ['future score observation',f=>{f.scoreFactObservedAt='2026-10-14T04:00:00Z';}],
  ['missing original completion clock',f=>{delete f.statusFactObservedAt;}],
  ['future first completion',f=>{f.firstConfirmedCompleteAt='2026-10-14T04:00:00Z';}],
  ['result observed before match start',f=>{f.startTimeUtc='2026-10-14T04:00:00Z';}],
 ])await check(name+' defers Rugby facts while valid Cricket proceeds',async()=>{
  addRugby(edit);const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  for(const file of ['feeds/incoming/events.json','data/events.json']){assert.equal(document(file).events[0].status,'completed');assert.equal(document(file).events.find(e=>e.id===rugby.id).status,'upcoming');}
  assert(!document('data/follow-sources/coverage.v1.json').events.some(e=>e.id===rugby.id));assert(report.deferredResults.some(r=>r.fixtureId===rugby.id));
 });
 await check('same Rugby final rechecked retains all original independent clocks and bytes',async()=>{
  addRugby();await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});const before=snapshot();
  pages[0].forEach(r=>{r.fixture.sourceCheckedAt='2026-10-14T02:30:00Z';});calls=[];children=[];
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});restored(before);assert.equal(report.liveCoverage.changed,0);assert.equal(children.length,0);
 });
 await check('a conflicting retained Rugby final blocks and rolls back the whole candidate',async()=>{
  addRugby();await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});const before=snapshot();
  const f=pages[0][1].fixture;f.homeScore=1;f.scoreDisplay='1–0';f.scoreFactObservedAt='2026-10-14T02:30:00Z';f.sourceCheckedAt='2026-10-14T02:30:00Z';calls=[];children=[];
  await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/conflict/);restored(before);assert.equal(children.length,0);
 });
 await check('reversed home/away identities cannot transplant a Rugby final',async()=>{
  addRugby(f=>{f.participantIds.reverse();[f.homeParticipantId,f.awayParticipantId]=[f.awayParticipantId,f.homeParticipantId];});
  const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/sides/);restored(before);
 });
 await check('source/sport identity mismatch blocks before candidate publication',async()=>{
  addRugby();pages[0][1].source_id='cricket-ca-current';const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/source\/sport identity/);restored(before);
 });
 for(const variant of ['mru','wru','mrs','wrs'])await check('existing '+variant+' source variant retains its exact coverage and verified zero draw',async()=>{
  addRugby(f=>{f.sourceUrl=f.sourceUrl.replace('sport=mru','sport='+variant);f.gender=variant.startsWith('w')?'women':'men';f.discipline=variant.endsWith('rs')?'rugby-sevens':'rugby-union';});pages[0][1].source_id='discovery-rugby-'+variant;
  await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});const card=document('data/events.json').events.find(e=>e.id===rugby.id);assert.equal(card.score,'0–0');assert.equal(card.scoreCheckedAt,rugby.scoreFactObservedAt);
 });
 await check('missing Cricket result text defers that card beside independent verified Rugby',async()=>{
  pages[0][0].fixture.scoreDisplay='';addRugby();
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.equal(document('data/events.json').events[0].status,'upcoming');assert.equal(document('data/events.json').events.find(e=>e.id===rugby.id).status,'completed');assert(report.deferredResults.some(r=>r.fixtureId===receipt.result.id));
 });
 await check('conflicting final retained only in Schedule still rolls back the entire candidate',async()=>{
  addRugby(f=>{f.homeScore=1;f.scoreDisplay='1–0';f.scoreFactObservedAt='2026-10-14T02:30:00Z';f.sourceCheckedAt='2026-10-14T02:30:00Z';});
  for(const file of ['data/events.json','feeds/incoming/events.json'])put(file,{events:document(file).events.filter(e=>e.id!==rugby.id)});
  const coverage=document('data/follow-sources/coverage.v1.json');coverage.events.push(structuredClone(rugby));put('data/follow-sources/coverage.v1.json',coverage);
  const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/conflict/);restored(before);assert.equal(children.length,0);
 });
 for(const key of ['scoreFactObservedAt','statusFactObservedAt'])await check('explicit unknown Cricket '+key+' cannot borrow a later poll',async()=>{
  pages[0][0].fixture[key]=null;pages[0][0].fixture.sourceCheckedAt='2026-10-14T02:00:00Z';addRugby();
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.equal(document('data/events.json').events[0].status,'upcoming');assert.equal(document('data/events.json').events.find(e=>e.id===rugby.id).status,'completed');assert(report.deferredResults.some(r=>r.fixtureId===receipt.result.id));
 });
 await check('later required failure restores all eight generated assets and removes a newly created one',async()=>{
  files.delete(ROOT+'/assets/js/calendar-sync-ui.js');const before=snapshot();failedChild='scripts/validate-current-card-coverage.js';
  await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/failed/);restored(before);assert.equal(fds.size,0);
 });
 await check('Schedule-only recorded side reversal cannot replace accepted result identities',async()=>{
  addRugby(f=>{f.participantIds.reverse();[f.homeParticipantId,f.awayParticipantId]=[f.awayParticipantId,f.homeParticipantId];});
  for(const file of ['data/events.json','feeds/incoming/events.json'])put(file,{events:document(file).events.filter(e=>e.id!==rugby.id)});
  const coverage=document('data/follow-sources/coverage.v1.json');coverage.events.push({...structuredClone(rugby),status:'scheduled'});put('data/follow-sources/coverage.v1.json',coverage);
  const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date(AT)}),/sides/);restored(before);
 });
 await check('Schedule-only reviewed canonical alias cannot hide a conflicting final',async()=>{
  const uuid='e3cbae12-66b3-4835-b1ce-4014b63055c8',fixture={...structuredClone(rugby),id:'fixture:rugby:wr:'+uuid,sourceFixtureId:uuid,startTimeUtc:'2026-10-17T05:00:00Z',sourceCheckedAt:'2026-10-18T02:00:00Z',scoreFactObservedAt:'2026-10-18T01:00:00Z',statusFactObservedAt:'2026-10-18T00:00:00Z'};
  pages=[[{source_id:'discovery-rugby-mru',fixture_id:fixture.id,fixture}]];
  const base={...fixture,id:'rugby-australia-new-zealand-2026-10-17',homeScore:1,scoreDisplay:'1–0'};put('data/follow-sources/coverage.v1.json',{events:[base],participants:[],competitions:[],sources:[]});
  const before=snapshot();await assert.rejects(()=>quick.atomicRefresh({source:'live-coverage',now:new Date('2026-10-18T03:00:00Z')}),/conflict/);restored(before);
 });
 await check('five-minute general observation tolerance never renews original Rugby fact clocks',async()=>{
  addRugby(f=>{f.sourceCheckedAt='2026-10-14T03:05:00.000Z';});const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});
  assert.deepEqual(report.deferredResults,[]);const card=document('data/events.json').events.find(e=>e.id===rugby.id);assert.equal(card.status,'completed');assert.equal(card.scoreCheckedAt,rugby.scoreFactObservedAt);
 });
 await check('source phase metadata does not pretend an unchanged final is a new result',async()=>{
  addRugby();pages[0].shift();const base=structuredClone(rugby);delete base.sourceStatus;put('data/follow-sources/coverage.v1.json',{events:[base],participants:[],competitions:[],sources:[]});
  const report=await quick.atomicRefresh({source:'live-coverage',now:new Date(AT)});assert.deepEqual(report.liveCoverage.scoreChangedFixtureIds,[]);assert.deepEqual(report.liveCoverage.finalResultChangedFixtureIds,[]);assert(report.liveCoverage.statusChangedFixtureIds.includes(rugby.id));
 });
 console.log(JSON.stringify({checks:records.length,passed:records,networkAttempts:0,canonicalCliInvocations:0,nativeChildren:0}));
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports=run;
