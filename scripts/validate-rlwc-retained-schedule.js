'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function validateRetainedSchedule(){
 const root=path.resolve(__dirname,'..'),frozen=require('./fixtures/rlwc-retained-live-merge-20261016.json');
 const identity=require('../config/fixture-identity'),schedule=require('../assets/js/follow-schedule-panel'),highlights=require('../config/fixture-highlights');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const extract=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,'Real function seam exists: '+start);return html.slice(a,b);};
 const context={NOTHINGSPORTS_FIXTURE_IDENTITY:identity,liveFixtureEvents:frozen.overlays,codeInspectorChunk:null,
  EVENTS:[frozen.candidate],activeEvents:[],MAJOR_EVENTS:null,inspectorSourcePreferred:schedule.inspectorSourcePreferred,
  codeInspectorFixtureSportKey:identity.sportKey,buildEventCard:event=>event};
 vm.createContext(context);
 vm.runInContext(extract('function liveScheduleFixtures(','let feedScoreUiLoading=')
  +extract('function inspectorFixtureIsResult(','function inspectorFixtureMatchesTab(')
  +extract('function canonicalFeedFixtureForInspector(','function codeInspectorFixtureSnapshot(')
  +extract('function buildCodeInspectorFixture(','function appendSchedulePin('),context);
 const now=new Date('2026-10-16T12:26:03Z'),expected='https://www.rlwc2026.com/videos/australia-v-new-zealand---round-1-2026';
 assert.equal(highlights.viewing(frozen.source,now)?.webUrl,expected,'Captured public final is eligible before the live merge');
 const before=JSON.stringify(frozen);
 for(const major of [null,require('../config/major-events')]){
  context.MAJOR_EVENTS=major;context.EVENTS=[frozen.candidate];
  const merged=context.liveScheduleFixtures([frozen.source],{id:'sport:nrl',slug:'nrl'}).find(f=>f.id===frozen.source.id);
  const selected=context.buildCodeInspectorFixture(merged);
  assert.equal(highlights.viewing(selected,now)?.webUrl,expected,'The actual retained Schedule chain must keep the verified highlights action, including without Events');
  for(const key of ['roundNumber','roundLabel','competitionId','sourceCheckedAt','statusCheckedAt'])assert.equal(merged[key],frozen.source[key],key+' keeps its published final context and observation');
  for(const patch of [{status:'live'},{status:'postponed'},{status:'completed'},{competitionId:'competition:other:2026'},{competitionId:'competition:rugby-league-world-cup:2025'},{date:'2026-10-16'},{startTimeUtc:'2026-10-15T10:05:00Z'},{participantIds:['team:nrl:kangaroos','team:nrl:other'],participantSlots:[]},{roundNumber:2},{roundLabel:'Round 2'},{stage:'quarterfinals'},{season:'2025'},{seasonLabel:'2025'},{gender:'women'},{eventType:'women'},{drawType:'mixed'},{matchType:'women'},{sportKey:'football'},{codeId:'sport:football'},{sportDomainId:'sport:football'},{sport:'Football'},{actualStartTimeUtc:'2026-10-16T00:00:00Z'},{actualStartTimeUtc:'invalid'},{canonicalEventId:'another-fixture'},{eventId:'another-fixture'}]){
   const candidate={...frozen.candidate,...patch};context.EVENTS=[candidate];
   assert.equal(context.buildCodeInspectorFixture(merged),candidate,'Active or contradictory retained evidence cannot borrow the published final: '+JSON.stringify(patch));
  }
  // Controlled result-bearing copies represent an accepted correction/withdrawal,
  // never a claim that this real match acquired a different result.
  for(const patch of [{homeScore:0,awayScore:0,scoreFactObservedAt:'2026-10-16T12:00:00Z'},{score:{home:0,away:0},scoreFactObservedAt:'2026-10-16T12:00:00Z'},{resultScore:'0–0'},{winnerParticipantId:'team:nrl:kangaroos'},{outcomeText:'A retained official outcome'},{resultStatus:'official'},{scoreFactObservedAt:'2026-10-16T12:00:00Z'},{score:null,homeScore:null,awayScore:null,scoreFactObservedAt:'2026-10-16T12:00:00Z'},{score:null,scoreCheckedAt:'2026-10-16T12:00:00Z'},{completedAt:'2026-10-15T12:00:00Z'},{resultSourceCheckedAt:'2026-10-16T12:00:00Z'}]){
   const candidate={...frozen.candidate,...patch};context.EVENTS=[candidate];
   assert.equal(context.buildCodeInspectorFixture(merged),candidate,'A past display copy with result evidence keeps that evidence, including zero scores and explicit withdrawal receipts: '+JSON.stringify(patch));
  }
  context.EVENTS=[{...frozen.candidate,sourceCheckedAt:'2026-10-16T12:00:00Z',statusCheckedAt:'2026-10-16T12:00:00Z'}];
  assert.equal(highlights.viewing(context.buildCodeInspectorFixture(merged),now)?.webUrl,expected,'A newer generic check alone is not a sporting result');
  context.EVENTS=[frozen.candidate];
  for(const status of ['scheduled','upcoming','past'])assert.equal(context.buildCodeInspectorFixture({...merged,status}),frozen.candidate,'A '+status+' source never establishes completion');
  for(const patch of [{roundNumber:2},{season:'2025'},{gender:'women'},{eventType:'women'}])assert.notEqual(highlights.viewing(context.buildCodeInspectorFixture({...merged,...patch}),now)?.providerId,'rlwc','The immutable publisher context rejects '+JSON.stringify(patch));
 }
 context.liveFixtureEvents=frozen.overlays.map(event=>event.id.startsWith('major-match:')?{...event,roundNumber:2,roundLabel:'Rugby League World Cup Round 2'}:event);
 const conflicting=context.liveScheduleFixtures([frozen.source],{id:'sport:nrl',slug:'nrl'})[0];
 assert.equal(conflicting.roundNumber,2,'An explicit different numbered round is not converted into Round 1');
 assert.notEqual(highlights.viewing(conflicting,now)?.providerId,'rlwc','Conflicting round evidence cannot receive the reviewed Round 1 clip');
 const mergePlanning=(patch,sourceFixture=frozen.source)=>{
  context.liveFixtureEvents=frozen.overlays.map(event=>event.id.startsWith('major-match:')?{...event,...patch}:event);
  return context.liveScheduleFixtures([sourceFixture],{id:'sport:nrl',slug:'nrl'}).find(event=>event.id===sourceFixture.id);
 };
 for(const label of ['Round 2','Grand Final']){
  const contrary=mergePlanning({roundNumber:null,roundLabel:label});
  assert.equal(contrary.roundLabel,label,'A populated round label remains contrary even without a round number');
  assert.notEqual(highlights.viewing(contrary,now)?.providerId,'rlwc','A contrary unnumbered round cannot borrow a reviewed clip');
 }
 for(const label of [null,'','Australia v New Zealand',frozen.source.roundLabel]){
  const recovered=mergePlanning({roundNumber:null,roundLabel:label});
  assert.equal(recovered.roundNumber,frozen.source.roundNumber);
  assert.equal(recovered.roundLabel,frozen.source.roundLabel,'Only missing or exact source matchup context recovers the published round');
 }
 assert.equal(mergePlanning({roundNumber:null,roundLabel:'Grand Final'},{...frozen.source,name:'Grand Final'}).roundLabel,'Grand Final','An event title without a matchup is not a planning round placeholder');
 const oldApi={NOTHINGSPORTS_FIXTURE_IDENTITY:{...identity,hasScore:undefined,hasScoreFields:undefined}};
 vm.createContext(oldApi);vm.runInContext(fs.readFileSync(path.join(root,'assets/js/follow-schedule-panel.js'),'utf8'),oldApi);
 assert.equal(oldApi.inspectorSourcePreferred(frozen.source,frozen.candidate),false,'A newly fetched Schedule module fails closed against an older identity API');
 const later='2026-10-16T12:00:00Z';
 for(const patch of [
  {sourceUrl:'https://example.invalid/changed-provider',sourceName:'Different provider',venue:'Different venue',sourceCheckedAt:later},
  {venue:'Different venue',sourceCheckedAt:later},
  ...['venueName','venueCity','venueOfficialName','venueDisplayName','city','location','court','courtId','displayDateLabel'].map(key=>({[key]:'Controlled contrary '+key,sourceCheckedAt:later})),
  ...['scheduleEvidence','timingEvidence','actualStartEvidence','schedulingWindow'].map(key=>({[key]:{kind:'controlled-contrary-context'},sourceCheckedAt:later})),
  ...['actualStartTimeUtc','estimatedStartTimeUtc','estimatedEarliestStartTimeUtc','estimatedLatestStartTimeUtc','sessionStartTimeUtc'].map(key=>({[key]:'2026-10-15T10:05:00.000Z',sourceCheckedAt:later})),
  {endDate:'2026-10-16',sourceCheckedAt:later},{timingVerified:true,sourceCheckedAt:later},
  {startTimeUtc:'2026-10-15T10:05:00.000Z',sourceCheckedAt:later},
  {timingProvenance:{kind:'controlled-contrary-source'},sourceCheckedAt:later},
  {sourceUrl:'https://example.invalid/unknown-receipt',sourceCheckedAt:null},
  {sourceName:'Different provider',sourceCheckedAt:undefined}
 ]){
  const changed=mergePlanning(patch);
  for(const [key,value] of Object.entries(patch))assert.deepEqual(changed[key],value??null,'Contrary context keeps its own values and receipt: '+key);
  for(const key of ['sourceUrl','sourceName','sourceType'])assert.equal(changed[key],patch[key]??null,'A new context cannot inherit a different provider tuple: '+key);
  assert.equal(changed.status,frozen.source.status);assert.equal(changed.scoreCheckedAt,frozen.source.scoreCheckedAt,'The protected result still keeps its own fact clock');
 }
 const unchanged=mergePlanning({sourceCheckedAt:later});
 for(const key of ['roundNumber','roundLabel','sourceUrl','sourceName','sourceType','venue','date','time','startTimeUtc','sourceCheckedAt','scoreCheckedAt','statusCheckedAt'])assert.deepEqual(unchanged[key],frozen.source[key],key+' cannot be renewed by a generic check');
 const accepted=identity.mergeOverlays([frozen.source],[{...frozen.source,status:'completed',homeScore:0,awayScore:0,sourceUrl:'https://example.invalid/controlled-final-correction',sourceCheckedAt:later,scoreCheckedAt:later,statusCheckedAt:later}])[0];
 assert.equal(accepted.homeScore,0);assert.equal(accepted.awayScore,0);assert.equal(accepted.scoreCheckedAt,later);assert.equal(accepted.sourceCheckedAt,later,'A genuine accepted completed correction still advances through the existing owner');
 assert.equal(JSON.stringify(frozen),before,'Neither published facts nor retained fixture inputs are rewritten');
 console.log('Captured retained Schedule merge/caller/highlights chain and contradictory-context fences passed.');
}
if(require.main===module)validateRetainedSchedule();
module.exports=validateRetainedSchedule;
