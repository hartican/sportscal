'use strict';
const assert=require('node:assert/strict');
const model=require('../config/match-centre');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const timing=require('../config/card-timing'),{refreshInterval,refreshDueSources}=require('../lib/live-fixtures');
// All interruption observations below are constructed, not captured rain proof.
// The retained published record supplies only identity and scheduled context.
const retained=require('../data/code-inspector/cricket.json').fixtures.find(e=>e.id==='fixture:cricket:espn:1525660');
assert(retained,'The agreed Second Test regression identity exists');
const now=Date.parse('2026-10-18T10:00:00Z'),stamp=new Date(now).toISOString(),old=new Date(now-60000).toISOString();
const fixture={...retained,status:'live',statusText:null,statusCheckedAt:old,scoreCheckedAt:old,sourceCheckedAt:old,startTimeUtc:'2026-10-18T07:30:00Z',actualStartTimeUtc:'2026-10-18T07:30:00Z',innings:[{participantId:retained.homeParticipantId||retained.participantIds[0],runs:0,wickets:0,overs:'0.0'}]};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function run(){
 const sandbox={Date,Intl,URL};require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../config/card-timing'),'utf8'),sandbox);
 assert.equal(sandbox.NOTHINGSPORTS_MATCH_CENTRE,undefined,'Cold Feed timing has no deferred Match Centre dependency');
 assert.equal(sandbox.NOTHINGSPORTS_CARD_TIMING.pauseReason({...fixture,status:'suspended',statusText:'Lightning'}),'Play suspended · Lightning');
 const staleBreak=timing.badgePresentation({...fixture,status:'break',statusText:'Half-time',statusCheckedAt:new Date(now-240001).toISOString()},now);
 assert.match(staleBreak.badgeClock,/HALF-TIME/);assert.match(staleBreak.badgeFreshness,/Awaiting/);assert.match(staleBreak.ariaLabel,/Half-time/);assert(Object.isFrozen(staleBreak));
 let scenarios=0;
 for(const key of ['cricket','football','nrl','afl','tennis','rugby-union'])for(const reason of ['rain','lightning','unsafe conditions','lighting failure','lighting/power failure','power outage','crowd incident','medical emergency']){
  const e={...fixture,key,status:'suspended',statusText:'Play suspended due to '+reason,statusCheckedAt:stamp};
  const before=JSON.stringify(e),fact=model.interruption(e);
  assert.equal(fact.state,'suspended');assert.equal(fact.reason,reason);assert.equal(fact.sourceText,e.statusText);
  assert.equal(fact.label,'Play suspended · '+reason);assert.equal(model.section(e,now),'live');
  assert.equal(timing.presentation(e,now).status,('Play suspended · '+reason).toUpperCase(),'Feed/Schedule use the same sourced reason');
  assert(timing.minimised(e,now).time.includes(fact.label.toUpperCase()));
  const sourced={...e,dateOnly:true,timePrecision:'date-only',restartTimeUtc:'2026-10-18T11:00:00Z',restartSourceUrl:'https://example.com/controlled-restart',restartSourceCheckedAt:stamp};
  assert.match(timing.badgePresentation(sourced,now).badgeClock,/Live again at 10:00 pm/,'A separately confirmed restart is visible across sports even when the original start was date-only');
  assert.equal(model.liveState(e,now),'paused','Live section membership never implies actively playing');
  assert.equal(model.section({...e,stale:true},now+3*86400000),'live','An interruption never expires through elapsed schedule or stale checks');
  assert.equal(JSON.stringify(e),before,'Presentation never mutates sporting facts');scenarios++;
 }
 for(const [status,text,state] of [['delayed',null,'delayed-start'],['suspended',null,'suspended'],['interrupted',null,'suspended'],['rain-delay','Delayed','suspended'],['rain-delay','Start delayed due to rain','delayed-start'],['rain-delay','Delayed start due to rain','delayed-start']]){
  const e={...fixture,status,statusText:text};assert.equal(model.interruption(e).state,state);
  if(!/rain$/.test(text||''))assert.equal(model.interruption(e).reason,null,'A legacy enum never manufactures rain');
  assert.equal(model.section(e,now),'live');scenarios++;
 }
 for(const text of ['Half-time','Lunch','Tea','Drinks','Innings break','Innings interval','Stumps','End of day','Session ended']){
  const e={...fixture,status:'break',statusText:text};assert.equal(model.interruption(e).state,'normal-break');assert.equal(model.unexpected(e),false);assert.notEqual(model.section(e,now),'live');scenarios++;
 }
 assert.equal(model.interruption({...fixture,status:'stumps',statusText:'Australia lead by 139 runs'}).label,'Stumps');
 const unknownStart=model.interruption({...fixture,status:'rain-delay',actualStartTimeUtc:null,livePlayObservedAt:null,statusText:'Rain delay'});
 assert.equal(unknownStart.state,'delayed');assert.equal(unknownStart.label,'Delayed · Rain delay','An ambiguous source pause does not prove play already started');
 assert.equal(model.interruption({...fixture,status:'rain-delay',actualStartTimeUtc:'2026-10-19T00:00:00Z'}).state,'delayed','A future actual-start value cannot establish earlier play');
 for(const label of ['Red flag','Race suspended','Session suspended'])assert.equal(model.unexpected({...fixture,status:'suspended',score:{racing:{statusText:label}}}),true,'Source-confirmed racing suspension remains an unexpected interruption');
 assert.equal(model.interruption({...fixture,status:'break',score:{racing:{statusText:'Safety car'}}}).state,'sport-pause','Safety car is not a suspended race');
 for(const text of ['Australia lead by 139 runs','<img src=x onerror=alert(1)>','Medical emergency; Australia 0/0','Unknown delay reason']){
  const fact=model.interruption({...fixture,status:'suspended',statusText:text});assert.equal(fact.reason,null);assert.equal(fact.label,'Play suspended');assert.equal(fact.sourceText,text,'Unreviewed source text remains available as provenance, not a public label');scenarios++;
 }
 const suspended={...fixture,status:'suspended',statusText:'Rain delay',statusCheckedAt:stamp};
 assert.equal(model.interruptionPresentation(suspended,now).restart,'Resume time unconfirmed');
 const restart={...suspended,restartTimeUtc:'2026-10-18T11:00:00Z'};
 assert.equal(model.interruptionPresentation(restart,now).restart,'Resume time unconfirmed','A clock alone is not confirmed resumption');
 const bareTiming=timing.presentation(restart,now),bareMinimised=timing.minimised(restart,now);
 assert(!/10:00\s*PM|22:00/i.test([bareTiming.time,bareTiming.fullSchedule,bareTiming.ariaLabel,bareMinimised.time,bareMinimised.ariaLabel].join(' ')),'Unconfirmed restart clocks stay out of visible and accessible/full-title timing');
 const confirmed={...restart,restartSourceUrl:'https://www.cricket.com.au/matches/CA%3A39990',restartSourceCheckedAt:stamp};
 assert.match(model.interruptionPresentation(confirmed,now).restart,/Live again at/);
 assert.equal(timing.pausePresentation(confirmed,now).restart,model.interruptionPresentation(confirmed,now).restart);
 assert.match(timing.minimised(confirmed,now).time,/22:00/,'A separate sourced restart may display its revised clock');
 for(const patch of [{restartSourceUrl:'javascript:alert(1)'},{restartSourceCheckedAt:null},{restartSourceCheckedAt:'2026-10-18T11:00:00Z'},{restartTimeUtc:'invalid'}])assert.equal(model.interruptionPresentation({...confirmed,...patch},now).restart,'Resume time unconfirmed');
 assert.equal(model.interruptionPresentation(confirmed,now+3600000).restart,'Awaiting resumption update');
 assert.match(model.interruptionPresentation({...confirmed,status:'delayed'},now).restart,/Starts at/);
 assert.equal(model.interruptionPresentation({...confirmed,status:'live'},now),null,'Confirmed resumption removes interruption and restart presentation');
 const original=model.compact(fixture),missing=model.compact({...suspended,innings:[],scoreCheckedAt:null}),merged=model.observation(original,missing);
 assert.deepEqual(merged.score,original.score,'An interruption-only update retains a 0/0 innings');
 assert.equal(merged.scoreCheckedAt,old);assert.equal(merged.statusCheckedAt,stamp);assert.equal(merged.stale,true,'Retaining a score never renews its clock');
 assert.deepEqual(model.observation(merged,{...missing,status:'live',statusCheckedAt:'2026-10-18T10:01:00Z'}).score,original.score,'A scoreless resumed-play update retains the last innings');
 // Match the selected-poll caller: its saved observation becomes the prior
 // for every subsequent receipt, including repeated scoreless live updates.
 const retainedSequences=[
  {home:0,away:0},
  {home:12,away:9},
  {innings:[{participantId:'controlled:home',runs:0,wickets:0,overs:'0.0'}]},
  {sets:[{home:0,away:0}],games:{home:0,away:0}}
 ];
 for(const score of retainedSequences){
  const start={id:'controlled:resumption',sport:'controlled',homeParticipantId:'controlled:home',awayParticipantId:'controlled:away',status:'suspended',score,scoreCheckedAt:old,checkedAt:old,statusCheckedAt:stamp};
  const receipt=at=>({id:start.id,sport:start.sport,homeParticipantId:start.homeParticipantId,awayParticipantId:start.awayParticipantId,status:'live',score:{home:null,away:null},scoreCheckedAt:null,checkedAt:at,statusCheckedAt:at});
  let saved=start;
  for(const at of ['2026-10-18T10:01:00Z','2026-10-18T10:02:00Z','2026-10-18T10:03:00Z']){
   saved=model.observation(saved,receipt(at));
   assert.deepEqual(saved.score,score,'Every consecutive scoreless resumption receipt retains the last score');
   assert.equal(saved.scoreCheckedAt,old);assert.equal(saved.checkedAt,old);assert.equal(saved.statusCheckedAt,at);assert.equal(saved.status,'live');assert.equal(saved.stale,true);
  }
  const older=model.observation(saved,receipt('2026-10-18T10:02:30Z'));
  assert.deepEqual(older.score,score);assert.equal(older.statusCheckedAt,saved.statusCheckedAt,'An out-of-order receipt cannot renew status or score clocks');
  const freshAt='2026-10-18T10:04:00Z',freshScore={home:1,away:0},fresh=model.observation(saved,{...receipt(freshAt),score:freshScore,scoreCheckedAt:freshAt});
  assert.deepEqual(fresh.score,freshScore);assert.equal(fresh.scoreCheckedAt,freshAt);assert.equal(fresh.interruptionScoreRetained,undefined,'Genuine new scores end the retention chain');
  const nextEmpty=receipt('2026-10-18T10:05:00Z');
  assert.deepEqual(model.observation(fresh,nextEmpty),nextEmpty,'Ordinary live receipts do not become an unconditional score union');
  const clear={...receipt(freshAt),scoreCheckedAt:freshAt};
  assert.deepEqual(model.observation(saved,clear),clear,'A newer explicit score receipt may clear the score');
  assert.deepEqual(model.observation(start,clear),clear,'Explicit clears also win directly during resumption');
  const partial={...receipt(freshAt),score:{home:0,away:null},scoreCheckedAt:freshAt};
  assert.deepEqual(model.observation(saved,partial),partial,'A supplied partial score is not combined with an older side');
  assert.equal(model.observation(saved,{...receipt(freshAt),scoreCheckedAt:old}).scoreCheckedAt,old,'An unchanged old score clock is not a new clear');
  for(const changed of [{id:'controlled:another-fixture'},{homeParticipantId:'controlled:new-home'},{awayParticipantId:'controlled:new-away'},{sport:'another-sport'}]){
   const next={...receipt(freshAt),...changed};assert.deepEqual(model.observation(saved,next),next,'Retained scores cannot cross a fixture/side/sport correction');
   assert.deepEqual(model.observation(start,next),next,'The first interruption receipt also respects identity');
  }
  for(const status of ['completed','abandoned','cancelled']){
   const terminal={...saved,status},result=model.observation(terminal,receipt(freshAt));
   assert.equal(result.status,status);assert.deepEqual(result.score,score);assert.equal(result.scoreCheckedAt,old,'Terminal observations retain their original score clock');
  }
 }
 const resumed=model.compact({...fixture,status:'live',statusText:null,statusCheckedAt:'2026-10-18T10:02:00Z',scoreCheckedAt:'2026-10-18T10:02:00Z',innings:[{...fixture.innings[0],runs:1}]});
 assert.equal(model.observation(merged,resumed).score.innings[0].runs,1);assert.equal(model.interruption(resumed),null);
 assert.deepEqual(model.observation(resumed,missing).score,resumed.score,'Older interruption receipts cannot replace newer play');
 for(const status of ['postponed','abandoned','cancelled','canceled']){
  const e={...suspended,status,statusText:'Abandoned due to rain',statusFactObservedAt:stamp};
  assert.equal(model.interruption(e).state,status==='canceled'?'cancelled':status);
  assert.equal(model.section(e,now),status==='postponed'?null:'recently-finished');
  assert.equal(model.section({...e,statusCheckedAt:new Date(now+3600001).toISOString()},now+3600001),null,'Repeated checks cannot renew the terminal window');
  assert.equal(model.section({...e,statusFactObservedAt:null},now),null,'An absent terminal fact clock cannot invent a recent finish');
  if(status!=='postponed')assert.equal(model.observation(model.compact(e),resumed).status,status,'Terminal statuses resist stale live resurrection');scenarios++;
 }
 let reads=0,readOptions;
 const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>[fixture],request:async(_path,options)=>{
  reads++;readOptions=options;
  return [{fixture:{...suspended,sourceCheckedAt:stamp,scoreCheckedAt:null,innings:[]},checked_at:stamp}];
 }});
 const r=response();await handler({url:'/api/match-centre?ids='+fixture.id},r);
 assert.equal(r.code,200);assert.equal(reads,1,'Reconciliation adds no read or retry');assert.equal(readOptions.timeoutMs,3000);assert(readOptions.body.p_fixture_ids.includes(fixture.id));assert(readOptions.body.p_fixture_ids.length<=60);
 assert.equal(r.body.fixtures[0].status,'suspended');assert.equal(r.body.fixtures[0].statusText,'Rain delay');
 assert.equal(r.body.fixtures[0].score.innings[0].runs,0);assert.equal(r.body.fixtures[0].scoreCheckedAt,old);
 assert.equal(r.body.fixtures[0].statusCheckedAt,stamp);assert.equal(r.body.fixtures[0].stale,false,'The retained score remains within its existing freshness window');
 for(const mode of ['selected','listing']){
  const cancelled={...fixture,status:'cancelled',statusText:'Cancelled due to rain',statusFactObservedAt:old};
  const staleLive={...fixture,statusCheckedAt:stamp,sourceCheckedAt:stamp};
  let selectedReads=0;
  const terminalHandler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>[cancelled],snapshotRead:async()=>({readAt:now,stale:false,sources:[{checked_at:stamp,fixtures:[staleLive]}]}),request:async()=>{selectedReads++;return [{fixture:staleLive,checked_at:stamp}];}});
  const reply=response();await terminalHandler({url:mode==='listing'?'/api/match-centre?membership=everything':'/api/match-centre?ids='+fixture.id},reply);
  assert.equal(reply.body.fixtures[0].status,'cancelled','API '+mode+' preserves cancellation against a stale live record');
  assert.equal(reply.body.fixtures[0].score.innings[0].runs,0);assert.equal(reply.body.fixtures[0].scoreCheckedAt,old);assert(selectedReads<=1);
 }
 for(const [value,interval] of [[fixture,120000],[suspended,600000],[confirmed,600000]])assert.equal(model.interval(value,now),interval,'Unexpected interruptions use ten minutes while active play remains unchanged');
 for(const e of [suspended,{...fixture,status:'delayed',actualStartTimeUtc:null},{...suspended,restartTimeUtc:new Date(now+60000).toISOString()}, {...suspended,status:'rain-delay',statusText:null}])assert.equal(refreshInterval([e],new Date(now)),600000,'A generic unexpected source is due every ten minutes, including near a proposed restart');
 assert.equal(refreshInterval([suspended,fixture],new Date(now)),120000,'Another actively playing fixture retains the existing source interval');
 assert.equal(refreshInterval([{...fixture,status:'break',statusText:'Half-time'}],new Date(now)),120000);
 assert.equal(refreshInterval([{...fixture,status:'stumps'}],new Date(now)),1800000,'Normal stumps retains its quiet interval');
 assert.equal(refreshInterval([{...fixture,status:'stumps',restartTimeUtc:new Date(now+60000).toISOString()}],new Date(now)),120000,'The existing normal-break near-restart rule is unchanged');
 for(const [index,minimum,callback,expected] of [[0,0,null,600000],[1,900000,null,900000],[2,0,()=>120000,120000],[3,0,()=>1800000,1800000]]){
  const id='controlled-interruption-interval-'+index;let moment=now,calls=0,writes=0,nextDueAt=0,lease=null;
  const store={claim:async(_id,token)=>{if(lease||moment<nextDueAt)return null;lease=token;return {fixtures:[suspended]};},publish:async(_id,token,value)=>{assert.equal(token,lease);assert.equal(value.intervalMs,expected);nextDueAt=moment+value.intervalMs;lease=null;writes++;},fail:async()=>assert.fail('Constructed healthy source must not fail')};
  const source={id,minimumIntervalMs:minimum,...(callback?{refreshInterval:callback}:{}),fetch:async()=>{calls++;return [{...suspended,sourceCheckedAt:new Date(moment).toISOString(),statusCheckedAt:new Date(moment).toISOString()}];}};
  await refreshDueSources({sources:[source],store,now:new Date(moment)});assert.equal(calls,1);assert.equal(writes,1);
  moment=now+expected-1;await refreshDueSources({sources:[source],store,now:new Date(moment)});assert.equal(calls,1,'No extra check before the existing lease/source deadline');
  moment++;await refreshDueSources({sources:[source],store,now:new Date(moment)});assert.equal(calls,2);assert.equal(writes,2,'The next existing tick can claim only when due');
 }
 console.log(JSON.stringify({constructed:true,providerRainHistory:false,retainedFixture:retained.id,enumeratedCases:scenarios,repeatedResumptionScoreShapes:retainedSequences.length,scorelessReceiptsPerShape:3,apiReads:reads,scoreClocksPreserved:true,interruptionIntervalMs:600000,activeIntervalMs:120000}));
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,fixture,now};
