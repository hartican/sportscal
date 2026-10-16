'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const lifecycle=require('../config/editorial-lifecycle');
const {applySelectedResults}=require('./apply-current-card-evidence');
const {applyOfficialResults}=require('./sync-official-card-results');
const receipt=require('./fixtures/rlwc-opener-official-result.json');
const root=path.resolve(__dirname,'..'),id=receipt.canonicalFixtureId;
const result=require('../data/canonical/current-card-evidence-2026.json').resultOverrides.find(r=>r.id===id);
const missing={id,name:'Australia v New Zealand',status:'completed'};
for(const narrative of [{},{phase:'preview',hook:'An old preview',synopsis:'An old preview'},{phase:'recap',resultSignature:lifecycle.signature(missing),hookSpoilerOn:''}]){
 const on=lifecycle.copy(missing,narrative,true),off=lifecycle.copy(missing,narrative,false);
 assert.doesNotMatch(on.hook,/reveal results/i,'Results ON must not ask to reveal a missing result');
 assert.match(on.hook,/result.*not yet available/i,'Missing result is honest without manufacturing an outcome');
 assert.match(off.hook,/reveal results/i,'Results OFF keeps its deliberate reveal guidance');
 assert.equal(on.synopsis,'','No recap is made from an old preview');
}
assert.equal(receipt.matchId,'20261310110');assert.equal(receipt.matchState,'FullTime');assert.equal(receipt.matchMode,'Post');
assert.equal(receipt.homeTeam.teamId,500149);assert.equal(receipt.awayTeam.teamId,500150);
assert.equal(result.homeScore,receipt.homeTeam.score);assert.equal(result.awayScore,receipt.awayTeam.score);
assert.equal(result.sourceUrl,receipt.url);assert.equal(result.resultSourceCheckedAt,receipt.retrievedAt);
assert.equal(result.resultSourceUpdatedAt,receipt.updated,'Provider update remains a separately named source clock');
assert.equal(result.actualEndTimeUtc,null);assert.equal(result.completedAt,null);assert.equal(result.endTimeUtc,null);
assert.equal(result.resultPublishedAt,null,'Provider update is not a finish/publication instant');
assert.equal(result.firstConfirmedCompleteAt,receipt.retrievedAt,'Observed completion is not a guessed finish');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-rlwc-result-'));
let reviewedFixture;
const files=['feeds/incoming/events.json','data/events.json','data/canonical/official-card-results-2026.json','data/canonical/current-card-evidence-2026.json','data/canonical/afl-nrl-2026.json'];
try{
 for(const file of files){fs.mkdirSync(path.dirname(path.join(tmp,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(tmp,file));}
 const read=file=>JSON.parse(fs.readFileSync(path.join(tmp,file))),before=files.slice(0,2).map(read);
 const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
 for(const doc of before){const old=doc.events.filter(e=>aliases(e).includes(id));assert.equal(old.length,1);assert.equal(old[0].competitionId,'competition:rugby-league-world-cup:2026');assert.equal(Date.parse(old[0].startTimeUtc),Date.parse(receipt.startTime));assert.deepEqual(old[0].participantIds,['team:nrl:kangaroos','team:nrl:kiwis']);}
 applySelectedResults([id],{root:tmp});
 for(const [index,file] of files.slice(0,2).entries()){
  const next=read(file),old=before[index].events.find(e=>aliases(e).includes(id)),event=next.events.find(e=>e.id===old.id);
  assert.deepEqual(next.events.map(e=>e.id),before[index].events.map(e=>e.id));
  assert.deepEqual(next.events.filter(e=>e.id!==old.id),before[index].events.filter(e=>e.id!==old.id),'Other fixtures and observations stay exact');
  for(const k of ['id','eventId','sourceEventIds','participantIds','participants','date','time','startTimeUtc','broadcaster','viewingOptions','userActivity'])assert.deepEqual(event[k],old[k],k+' preserved');
  assert.equal(event.canonicalEventId,old.canonicalEventId||old.id,'Existing writer only fills the same canonical identity when absent');
  assert.equal(event.status,'completed');assert.equal(event.homeScore,24);assert.equal(event.awayScore,22);
  reviewedFixture=event;
  assert.equal(event.actualEndTimeUtc,null);assert.equal(event.completedAt,null);assert.equal(event.endTimeUtc,null);
  const on=lifecycle.copy(event,event.editorialNarrative,true),off=lifecycle.copy(event,event.editorialNarrative,false);
  assert.match(on.hook,/Australia defeated New Zealand 24–22/);assert.doesNotMatch(on.hook,/reveal/i);
  assert.doesNotMatch(JSON.stringify(off),/24|22|defeated/,'Results OFF must hide the score/outcome');
  const replay=applyOfficialResults([old],read(files[2])).events[0];assert.equal(replay.status,'completed');assert.equal(replay.score,result.score);assert.equal(replay.resultSourceCheckedAt,receipt.retrievedAt);assert.equal(replay.resultPublishedAt,null);
 }
 const once=files.map(file=>fs.readFileSync(path.join(tmp,file)));applySelectedResults([id],{root:tmp});
 files.forEach((file,i)=>assert(fs.readFileSync(path.join(tmp,file)).equals(once[i]),'Repeated reviewed publication is byte-stable'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
function validateScheduleSourceSelection(){
 const vm=require('node:vm'),major=require('../config/major-events');
 const frozen=require('./fixtures/rlwc-schedule-alias-20261016.json'),fixture=frozen.fixture;
 const child=major.fixtureFromSubEvent(frozen.child,frozen.parent),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end));
 const source=extract('function canonicalFeedFixtureForInspector(','function codeInspectorFixtureSnapshot(')
  +extract('function inspectorFixtureIsResult(','function inspectorFixtureMatchesTab(')
  +extract('function buildCodeInspectorFixture(','function appendSchedulePin(');
 const context={inspectorSourcePreferred:require('../assets/js/follow-schedule-panel').inspectorSourcePreferred,EVENTS:[],activeEvents:[child],MAJOR_EVENTS:major,codeInspectorFixtureSportKey:require('../config/fixture-identity').sportKey,buildEventCard:event=>event};
 vm.createContext(context);vm.runInContext(source,context);
 const before=JSON.stringify([fixture,child]),card=context.buildCodeInspectorFixture(fixture);
 assert.equal(card.canonicalEventId,fixture.canonicalEventId,'Native Schedule caller must retain the exact completed source instead of a scheduled semantic major-child copy');
 assert(['completed','finished','final'].includes(card.status));assert.equal(card.homeScore,24);assert.equal(card.awayScore,22);
 for(const key of ['id','sourceEventIds','date','startTimeUtc','statusCheckedAt','scoreCheckedAt','resultSourceCheckedAt','roundNumber','competitionId'])assert.deepEqual(card[key],fixture[key],key+' keeps the source value');
 const highlights=require('../config/fixture-highlights'),now=new Date('2026-10-16T09:00:00Z');
 assert.equal(highlights.viewing(card,now)?.providerId,'rlwc','Full source context reaches the unchanged publisher guard');
 for(const patch of [{sourceEventIds:[]},{sourceEventIds:'major-match:rlwc-2026:australia-new-zealand'},{competitionId:'competition:other:2026'},{key:'rugby'}]){
  context.activeEvents=[child];const unchanged=context.buildCodeInspectorFixture({...fixture,...patch});
  assert.equal(unchanged.id,child.id,'Unbound or conflicting source context cannot use the new alias path');
 }
 for(const key of ['roundNumber','roundLabel','stage','season','seasonLabel','gender','eventType']){
  const known=fixture[key]??'controlled-known';
  context.activeEvents=[{...child,[key]:typeof known==='number'?known+1:known+'-contradiction'}];
  assert.equal(context.buildCodeInspectorFixture({...fixture,[key]:known}).id,child.id,'A known '+key+' contradiction prevents alias hydration');
  context.activeEvents=[{...child,[key]:null}];
  assert.equal(context.buildCodeInspectorFixture({...fixture,[key]:known}).id,fixture.id,'An absent '+key+' is not a contradiction');
 }
 context.activeEvents=[{...child,status:'completed',score:'An existing final'}];assert.equal(context.buildCodeInspectorFixture(fixture).score,'An existing final','Existing completed canonical results retain precedence');
 context.activeEvents=[child];context.EVENTS=[{...fixture,eventId:fixture.id}];assert.equal(context.buildCodeInspectorFixture(fixture),context.EVENTS[0],'Loaded canonical fixture keeps its existing priority');
 context.EVENTS=[];const zero=context.buildCodeInspectorFixture({...fixture,homeScore:0});assert.equal(zero.homeScore,0,'A controlled zero score is not treated as absent');
 for(const patch of [{roundNumber:2},{season:'2025'},{gender:'women'},{date:'2026-10-16'},{startTimeUtc:'2026-10-16T09:05:00Z'},{participantIds:['team:nrl:kangaroos','team:nrl:other'],participantSlots:[]}])assert.notEqual(highlights.viewing(context.buildCodeInspectorFixture({...fixture,...patch}),now)?.providerId,'rlwc','Existing publisher fences remain unchanged for '+JSON.stringify(patch));
 // The real selected snapshot retains an exact canonical August planning row.
 // Exercise the actual Schedule caller, including when Events was never loaded.
 for(const loadedMajor of [major,null]){
  context.MAJOR_EVENTS=loadedMajor;context.EVENTS=[frozen.staleCanonical];context.activeEvents=[];
  const beforePrior=JSON.stringify(frozen.staleCanonical),retained=context.buildCodeInspectorFixture(fixture);
  assert(['completed','finished','final'].includes(retained.status),'A retained exact canonical planning row cannot reopen the sourced Schedule final');
  assert.equal(retained.homeScore,24);assert.equal(retained.awayScore,22);
  for(const key of ['id','sourceEventIds','date','startTimeUtc','statusCheckedAt','scoreCheckedAt','resultSourceCheckedAt','roundNumber','competitionId'])assert.deepEqual(retained[key],fixture[key],key+' retains exact final source provenance');
  assert.equal(JSON.stringify(frozen.staleCanonical),beforePrior,'The old retained row is not rewritten');
 }
 for(const patch of [{competitionId:'competition:other:2026'},{key:'rugby'},{date:'2026-10-16'},{startTimeUtc:'invalid'},{participantIds:['team:nrl:kangaroos','team:nrl:other']},{participantIds:'invalid'},{status:'live'},{status:'postponed'},{status:'completed'}]){
  const candidate={...frozen.staleCanonical,...patch};context.EVENTS=[candidate];context.activeEvents=[];
  assert.equal(context.buildCodeInspectorFixture(fixture),candidate,'The exact source path cannot override conflicting or active sporting evidence '+JSON.stringify(patch));
 }
 for(const key of ['roundNumber','roundLabel','stage','season','seasonLabel','gender','eventType']){
  const known=fixture[key]??'controlled-known',candidate={...frozen.staleCanonical,[key]:typeof known==='number'?known+1:known+'-contradiction'};
  context.EVENTS=[candidate];context.activeEvents=[];
  assert.equal(context.buildCodeInspectorFixture({...fixture,[key]:known}),candidate,'Exact canonical context also rejects a known '+key+' contradiction');
 }
 context.EVENTS=[frozen.staleCanonical];context.activeEvents=[];
 for(const patch of [{sourceEventIds:[]},{sourceEventIds:fixture.id},{status:'upcoming'},{competitionId:null}])assert.equal(context.buildCodeInspectorFixture({...fixture,...patch}),frozen.staleCanonical,'Missing source evidence cannot take precedence '+JSON.stringify(patch));
 context.MAJOR_EVENTS=major;context.EVENTS=[];context.activeEvents=[child];
 const actions={[child.id]:{saved:true,isMinimised:true,reminderRequested:false,showSpoilers:false}};
 const actionsBefore=JSON.stringify(actions),identity=require('../config/event-action-identity');
 assert.deepEqual(identity.resolveAction(card,actions).action,actions[child.id],'Existing major-child saved choices still resolve through the source alias');
 assert.equal(JSON.stringify(actions),actionsBefore);assert.equal(JSON.stringify([fixture,child]),before,'Selection cannot rewrite either source record');
}
validateScheduleSourceSelection();
require('./validate-rlwc-retained-schedule')();
async function validateSavedStatusOverlay(){
 const {createMatchCentreHandler}=require('../lib/match-centre-handler');
 const model=require('../config/match-centre');
 const now=Date.parse(receipt.retrievedAt)+30*60000;
 for(const compact of [false,true]){
  const prior={...reviewedFixture,status:'upcoming',sourceCheckedAt:'2026-08-29T23:56:41.761Z',statusCheckedAt:'2026-08-29T23:56:41.761Z',statusFactObservedAt:'2026-08-29T23:56:41.761Z',scoreFactObservedAt:null,firstConfirmedCompleteAt:null,scoreCheckedAt:null,homeScore:null,awayScore:null,score:null,...(compact?{fixtureObservationSchema:'fixture-observations.v1'}:{})};
  let response;
  const handler=createMatchCentreHandler({enabled:()=>true,published:()=>[reviewedFixture],clock:()=>now,request:async()=>[{fixture:prior,checked_at:new Date(now).toISOString()}]});
  await handler({method:'GET',url:'/api/match-centre?ids='+id},{setHeader(){},status(){return this;},json(value){response=value;return value;}});
  const final=response.fixtures[0];
  assert.equal(final.status,'completed','An old saved row cannot reopen the reviewed final');
  assert.deepEqual(final.score,{home:24,away:22});
  assert.equal(final.statusFactObservedAt,receipt.retrievedAt,'The retained final keeps its own status observation, not the old upcoming date');
  assert.equal(final.scoreCheckedAt,receipt.retrievedAt);
  assert(model.eligible(final,now),'A recent observed final retains its existing Match Centre window');
 }
}
validateSavedStatusOverlay().then(()=>console.log('RLWC reviewed writer, saved-status API overlay and Results ON/OFF fallback passed; no source/customer writes.')).catch(error=>{console.error(error);process.exitCode=1;});
