'use strict';
const assert=require('node:assert/strict');
const model=require('../config/match-centre');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
// All interruption observations below are constructed, not captured rain proof.
// The retained published record supplies only identity and scheduled context.
const retained=require('../data/code-inspector/cricket.json').fixtures.find(e=>e.id==='fixture:cricket:espn:1525660');
assert(retained,'The agreed Second Test regression identity exists');
const now=Date.parse('2026-10-18T10:00:00Z'),stamp=new Date(now).toISOString(),old=new Date(now-60000).toISOString();
const fixture={...retained,status:'live',statusText:null,statusCheckedAt:old,scoreCheckedAt:old,sourceCheckedAt:old,startTimeUtc:'2026-10-18T07:30:00Z',actualStartTimeUtc:'2026-10-18T07:30:00Z',innings:[{participantId:retained.homeParticipantId||retained.participantIds[0],runs:0,wickets:0,overs:'0.0'}]};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function run(){
 let scenarios=0;
 for(const key of ['cricket','football','nrl','afl','tennis','rugby-union'])for(const reason of ['rain','lightning','unsafe conditions','lighting failure','lighting/power failure','power outage','crowd incident','medical emergency']){
  const e={...fixture,key,status:'suspended',statusText:'Play suspended due to '+reason,statusCheckedAt:stamp};
  const before=JSON.stringify(e),fact=model.interruption(e);
  assert.equal(fact.state,'suspended');assert.equal(fact.reason,reason);assert.equal(fact.sourceText,e.statusText);
  assert.equal(fact.label,'Play suspended · '+reason);assert.equal(model.section(e,now),'live');
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
 const confirmed={...restart,restartSourceUrl:'https://www.cricket.com.au/matches/CA%3A39990',restartSourceCheckedAt:stamp};
 assert.match(model.interruptionPresentation(confirmed,now).restart,/Live again at/);
 for(const patch of [{restartSourceUrl:'javascript:alert(1)'},{restartSourceCheckedAt:null},{restartSourceCheckedAt:'2026-10-18T11:00:00Z'},{restartTimeUtc:'invalid'}])assert.equal(model.interruptionPresentation({...confirmed,...patch},now).restart,'Resume time unconfirmed');
 assert.equal(model.interruptionPresentation(confirmed,now+3600000).restart,'Awaiting resumption update');
 assert.match(model.interruptionPresentation({...confirmed,status:'delayed'},now).restart,/Starts at/);
 assert.equal(model.interruptionPresentation({...confirmed,status:'live'},now),null,'Confirmed resumption removes interruption and restart presentation');
 const original=model.compact(fixture),missing=model.compact({...suspended,innings:[],scoreCheckedAt:null}),merged=model.observation(original,missing);
 assert.deepEqual(merged.score,original.score,'An interruption-only update retains a 0/0 innings');
 assert.equal(merged.scoreCheckedAt,old);assert.equal(merged.statusCheckedAt,stamp);assert.equal(merged.stale,true,'Retaining a score never renews its clock');
 assert.deepEqual(model.observation(merged,{...missing,status:'live',statusCheckedAt:'2026-10-18T10:01:00Z'}).score,original.score,'A scoreless resumed-play update retains the last innings');
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
 for(const [value,interval] of [[fixture,120000],[suspended,1800000],[confirmed,1800000]])assert.equal(model.interval(value,now),interval,'Cadence remains unchanged in the allocated first pass');
 console.log(JSON.stringify({constructed:true,providerRainHistory:false,retainedFixture:retained.id,enumeratedCases:scenarios,apiReads:reads,scoreClocksPreserved:true,cadenceUnchanged:true}));
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run,fixture,now};
