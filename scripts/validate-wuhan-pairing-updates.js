'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const updates=require('../lib/reviewed-wuhan-pairing-updates'),writer=require('./apply-reviewed-participant-fixtures'),owner=require('../lib/tennis-scoreboard');
const fixture=require('./fixtures/wuhan-pairing-updates-20261013.json'),doc=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json');
const clock=Date.parse(doc.wuhanPairingUpdates[0].checkedAt)+1000,files=Object.keys(fixture.records);
async function run(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-wuhan-update-')),realNow=Date.now;Date.now=()=>clock;
 try{
  const reset=()=>{for(const file of files){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(fixture.records[file]));}};
  const bytes=()=>files.map(f=>fs.readFileSync(path.join(root,f)));
  const scoped={...structuredClone(doc),events:[],pairingCorrections:[]};reset();const before=bytes();writer.apply({root,doc:scoped});const corrected=bytes();
  for(const file of files){
   const previous=fixture.records[file].events||fixture.records[file].fixtures,next=JSON.parse(fs.readFileSync(path.join(root,file))),records=next.events||next.fixtures;
   assert.deepEqual(records.map(e=>e.id),previous.map(e=>e.id),'All retained activity IDs and order survive');
   for(const [i,old]of previous.entries()){
    const c=scoped.wuhanPairingUpdates.find(c=>c.fixtureId===(old.canonicalEventId||old.id)),n=records[i];if(!c){assert.deepEqual(n,old,'Unrelated fixtures are byte-equivalent');continue;}
    assert.deepEqual(n.participantIds,c.participantIds);assert.equal(n.name,c.participants.map(p=>p.name).join(' v '));
    for(const k of ['id','eventId','canonicalEventId','sourceEventIds','date','time','startTimeUtc','timePrecision','scheduleStatus','sourceCheckedAt','viewingOptions','broadcaster'])assert.deepEqual(n[k],old[k],'Original identity/timing/viewing '+k);
    assert.equal(require('../config/fixture-reminder-policy').timing(n,clock),null);assert.equal(require('../config/fixture-reminder-policy').intent(n,{}, {[old.id]:{reminderChoice:'off'}},{},clock).enabled,false);
    assert(n.participants.every(p=>p.sourceCheckedAt===c.checkedAt),'New names retain their actual identity receipt');assert(!n.participants.some(p=>p.name==='Anna Kalinskaya'));
    if(c.result){assert.equal(n.status,'completed');assert.equal(n.resultEvidence.kind,'official-draw-result');assert.equal(n.winnerParticipantId,c.participantIds[1]);assert.deepEqual(n.sets,c.result.sets);assert.equal(n.scoreCheckedAt,c.checkedAt);assert(!n.actualEndTimeUtc&&!n.completedAt,'No sporting finish instant is invented');}
    else assert.equal(n.status,old.status,'No result is invented for Krueger/Zhang');
   }
  }
  writer.apply({root,doc:scoped});assert(bytes().every((b,i)=>b.equals(corrected[i])),'Unchanged reruns preserve bytes');
  let requests=0;const catalogue=require('../data/canonical/tennis-catalogue-2026.json');
  const fetchImpl=async url=>{requests++;return {ok:true,status:200,headers:new Headers({date:fixture.providerCheckedAt}),json:async()=>url.includes('/wta/')?structuredClone(fixture.payload):{leagues:[{slug:'atp'}],events:[]}};};
  const result=await owner.refresh({root,now:new Date(clock),fetchImpl,catalogue});assert.equal(requests,4);assert.equal(result.failures.length,0);
  const parsed=owner.parse(fixture.payload,{tour:'wta',checkedAt:fixture.providerCheckedAt,now:new Date(clock),catalogue}).fixtures;
  const merged=owner.merge(fixture.records[files[2]].fixtures,parsed,{now:new Date(clock)});assert(merged.some(e=>e.name==='Diane Parry v Lanlana Tararudee'&&e.resultEvidence?.kind==='official-draw-result'),'Actual merger binds the reviewed official final');
  let liveRequests=0;const previous=fixture.records[files[2]].fixtures;
  const live=require('../lib/live-tennis-scoreboard').sources({published:previous,fetchImpl:async()=>{liveRequests++;return {ok:true,status:200,headers:new Headers({date:fixture.providerCheckedAt}),json:async()=>structuredClone(fixture.payload)};}}).find(s=>s.id==='live-tennis-wta');
  const liveRows=await live.fetch({now:new Date(clock),previous,signal:AbortSignal.timeout(15000)});assert.equal(liveRequests,1,'Existing live owner uses one resource');
  for(const c of scoped.wuhanPairingUpdates){const n=liveRows.find(e=>(e.canonicalEventId||e.id)===c.fixtureId);assert.deepEqual(n.participantIds,c.participantIds);assert.equal(n.fixtureObservationSchema,'fixture-observations.v1');if(c.result)assert.equal(n.resultEvidence.kind,'official-draw-result');}
  const official=merged.find(e=>(e.canonicalEventId||e.id).endsWith('185341')),primary=parsed.find(e=>e.id.endsWith('185341'));
  const conflicting={...primary,sets:[{home:6,away:4},{home:6,away:1}],score:'6–4, 6–1',scoreDisplay:'6–4, 6–1',winnerParticipantId:primary.homeParticipantId,outcomeText:'Conflicting publisher winner',recapText:'Conflicting publisher score'};
  const retained=owner.merge([official],[conflicting],{now:new Date(clock)})[0];assert.equal(retained.score,official.score);assert.equal(retained.winnerParticipantId,official.winnerParticipantId);assert.equal(retained.outcomeText,official.outcomeText,'A provider disagreement cannot replace official result copy');assert.equal(retained.recapText,official.recapText);
  for(const change of [e=>e.status='live',e=>e.status='completed',e=>e.startTimeUtc='2026-10-12T03:00:00Z',e=>e.timingVerified=true,e=>e.score=0,e=>e.sourceCheckedAt='2100-01-01',e=>e.sourceCheckedAt=new Date(clock+1000).toISOString(),e=>e.participantIds=['unknown','other']]){const records=structuredClone(fixture.records[files[0]].events);change(records[0]);assert.throws(()=>updates.project(records,scoped.wuhanPairingUpdates,{now:clock}),'Unsafe identity changes reject');}
  for(const change of [c=>c.sourceSha256='0'.repeat(64),c=>c.checkedAt=new Date(clock).toISOString(),c=>c.publisher.checkedAt=new Date(clock).toISOString(),c=>c.result.sets[0].home=6]){const review=structuredClone(scoped.wuhanPairingUpdates);change(review.find(c=>c.result));assert.throws(()=>updates.validate(review,clock),'Changed observations or result proof reject');}
  assert.throws(()=>updates.project(fixture.records[files[0]].events,scoped.wuhanPairingUpdates,{now:Date.parse(scoped.wuhanPairingUpdates[0].validUntil)}),/Expired/);
  const after=JSON.parse(corrected[0]).events;assert.deepEqual(updates.project(after,scoped.wuhanPairingUpdates,{now:Date.parse(scoped.wuhanPairingUpdates[0].validUntil)+1000}),after,'Expired review cannot alter later accepted fixtures');
  reset();const missing=JSON.parse(fs.readFileSync(path.join(root,files[2])));missing.fixtures=missing.fixtures.filter(e=>!(e.canonicalEventId||e.id).endsWith('185341'));fs.writeFileSync(path.join(root,files[2]),JSON.stringify(missing));const noPartial=bytes();assert.throws(()=>writer.apply({root,doc:scoped}));assert(bytes().every((b,i)=>b.equals(noPartial[i])),'All three surfaces preflight before any write');
  assert(before.some((b,i)=>!b.equals(corrected[i])),'The actual writer persisted the corrections');
 }finally{Date.now=realNow;fs.rmSync(root,{recursive:true,force:true});}
 console.log('Reviewed Wuhan pairs and official final: three-surface persistence, IDs, source clocks, OFF, four-resource/live merger, unchanged reruns and unsafe changes passed. Captured match subset regression; full-response replay is separate evidence.');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={run};
