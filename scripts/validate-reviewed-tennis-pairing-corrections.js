'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const correction=require('../lib/reviewed-tennis-pairing-corrections'),writer=require('./apply-reviewed-participant-fixtures'),owner=require('../lib/tennis-scoreboard');
const baseline=require('./fixtures/wuhan-pairings-before-review-20261011.json'),source=require('./fixtures/wuhan-pairings-after-review-20261011.json');
const whole=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json');
const files=Object.keys(baseline.records),clock=Date.parse(whole.pairingCorrections[0].checkedAt)+5000;
const templates=Object.fromEntries(files.map(f=>[f,JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',f)))]));
async function run(){
 const realNow=Date.now,root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-wuhan-pairing-'));
 const doc={...structuredClone(whole),events:[],wuhanPairingUpdates:[]};
 const reset=()=>{for(const file of files){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify({...templates[file],events:file.includes('scoreboard')?undefined:structuredClone(baseline.records[file]),fixtures:file.includes('scoreboard')?structuredClone(baseline.records[file]):undefined})+'\n');}};
 const bytes=()=>files.map(f=>fs.readFileSync(path.join(root,f)));
 try{
  Date.now=()=>clock;reset();const original=bytes();writer.apply({root,doc});const corrected=bytes();
  for(const file of files){const rows=JSON.parse(fs.readFileSync(path.join(root,file))),records=rows.events||rows.fixtures;
   assert.deepEqual(records.map(e=>e.id),baseline.records[file].map(e=>e.id),'existing action identities/order remain');
   for(const [i,old]of baseline.records[file].entries()){
    const next=records[i],c=doc.pairingCorrections.find(c=>c.fixtureId===old.canonicalEventId||c.fixtureId===old.id);assert(c);
    assert.deepEqual(next.participantIds,c.participantIds);assert.equal(next.name,c.participants.map(p=>p.name).join(' v '));
    for(const key of ['id','eventId','canonicalEventId','sourceEventIds','date','time','startTimeUtc','timePrecision','scheduleStatus','sourceCheckedAt','statusCheckedAt','scoreCheckedAt','resultSourceCheckedAt','viewingOptions','status'])assert.deepEqual(next[key],old[key],key+' must remain independent of the pairing review');
    assert.equal(require('../config/fixture-reminder-policy').timing(next,clock),null,'Draw evidence cannot create a reminder clock');
    assert.equal(require('../config/fixture-reminder-policy').intent(next,{}, {[old.id]:{reminderChoice:'off'}},{},clock).enabled,false,'Original saved Remind OFF still resolves');
   }
  }
  writer.apply({root,doc});assert(bytes().every((b,i)=>b.equals(corrected[i])),'unchanged review is byte-stable');
  const payload=source.payload,catalogue=require('../data/canonical/tennis-catalogue-2026.json');let requests=0;
  const fetchImpl=async url=>{requests++;return {ok:true,status:200,headers:new Headers({date:source.checkedAt}),json:async()=>url.includes('/wta/')?payload:{leagues:[{slug:'atp'}],events:[]}};};
  const report=await owner.refresh({root,now:new Date(clock),fetchImpl,catalogue});assert.equal(requests,4);assert.equal(report.failures.length,0,'Actual four-resource owner accepts the reviewed pairings');
  for(const file of files){const j=JSON.parse(fs.readFileSync(path.join(root,file)));for(const next of j.events||j.fixtures){assert.equal(next.startTimeUtc,null);assert.equal(next.timePrecision,'unresolved');assert.equal(next.status,'scheduled');assert.equal(next.pairingSourceCheckedAt,doc.pairingCorrections[0].checkedAt);assert.equal(require('../config/fixture-reminder-policy').timing(next,clock),null);}}
  const known=JSON.parse(fs.readFileSync(path.join(root,files[0]))).events,model=require('../config/athletes');
  assert.equal(model.next(known,'competitor:tennis:wta:belinda-bencic',clock),null,'Replaced player cannot inherit the current pairing');
  assert(model.next(known,'competitor:tennis:wta:anna-kalinskaya',clock),'Current player receives the actual upcoming fixture');
  assert(model.next(known,'competitor:tennis:wta:janice-tjen',clock),'Unchanged player retains the same fixture');
  let liveRequests=0;const previous=structuredClone(baseline.records[files[2]]),originalLive=structuredClone(previous);
  const live=require('../lib/live-tennis-scoreboard').sources({published:previous,fetchImpl:async()=>{liveRequests++;return {ok:true,status:200,headers:new Headers({date:source.checkedAt}),json:async()=>payload};}}).find(s=>s.id==='live-tennis-wta');
  const updated=await live.fetch({now:new Date(clock),previous});assert.equal(liveRequests,1,'Existing live source keeps one request');assert.deepEqual(previous,originalLive,'Live correction does not mutate its retained input');
  for(const c of doc.pairingCorrections){const next=updated.find(e=>e.id===c.fixtureId);assert(next);assert.deepEqual(next.participantIds,c.participantIds);assert.equal(next.pairingSourceCheckedAt,c.checkedAt);assert.equal(next.startTimeUtc,null);}
  const fresh=owner.parse(payload,{tour:'wta',checkedAt:source.checkedAt,now:new Date(clock),catalogue}).fixtures;
  for(const change of [e=>e.participantIds=['unreviewed','opponent'],e=>e.statusCheckedAt='2100-01-01T00:00:00Z',e=>e.statusCheckedAt=new Date(clock-7*3600000).toISOString()]){const bad=structuredClone(fresh);change(bad[0]);assert.throws(()=>owner.merge(originalLive,bad,{now:new Date(clock)}),/retained participant identity changed/,'Unapproved/future/stale incoming facts cannot authorize a live remap');}
  // The actual third-surface failure must leave both earlier surfaces untouched.
  reset();const missing=JSON.parse(fs.readFileSync(path.join(root,files[2])));missing.fixtures.pop();fs.writeFileSync(path.join(root,files[2]),JSON.stringify(missing));const beforeFailure=bytes();assert.throws(()=>writer.apply({root,doc}),/one retained fixture/);assert(bytes().every((b,i)=>b.equals(beforeFailure[i])),'All three surfaces preflight before any write');
  for(const change of [e=>e.status='live',e=>e.status='completed',e=>e.startTimeUtc='2026-10-12T04:00:00Z',e=>e.timingVerified=true,e=>e.score=0,e=>e.sets=[{home:0,away:0}],e=>e.participantIds=['someone','else'],e=>e.sourceCheckedAt=new Date(clock+1).toISOString(),e=>e.tennisProviderEventId='another-edition']){
   const records=structuredClone(baseline.records[files[0]]);change(records[0]);assert.throws(()=>correction.project(records,doc.pairingCorrections,{now:clock}),'Unsafe identity changes reject');
  }
  for(const change of [c=>c.sourceUrl='https://example.org',c=>c.checkedAt='2100-01-01T00:00:00Z',c=>c.publisher.participantIds.reverse(),c=>c.publisher.status='completed',c=>c.sourceSha256='missing',c=>c.participants[1].name='Invented opponent',c=>c.fixtureId='fixture:tennis:espn:wta:other']){const bad=structuredClone(doc.pairingCorrections);change(bad[0]);assert.throws(()=>correction.validate(bad,clock));}
  assert.throws(()=>correction.project(baseline.records[files[0]],doc.pairingCorrections,{now:Date.parse(doc.pairingCorrections[0].validBefore)}),/expired/,'An expired review cannot remap an old fixture');
  const accepted=correction.project(baseline.records[files[0]],doc.pairingCorrections,{now:clock});const final={...accepted[0],status:'completed',score:'Synthetic final',scoreCheckedAt:new Date(clock+86400000).toISOString()};
  assert.deepEqual(correction.project([final,accepted[1]],doc.pairingCorrections,{now:clock+86400000}),[final,accepted[1]],'Replaying old pairing evidence cannot alter later results or their clocks');
  assert.deepEqual(correction.project([],doc.pairingCorrections,{now:clock+86400000}),[],'Expired missing fixtures are not recreated');
  assert(original.every((b,i)=>!b.equals(corrected[i])),'Both reviewed pairs were actually persisted on all three surfaces');
 }finally{Date.now=realNow;fs.rmSync(root,{recursive:true,force:true});}
 console.log('Reviewed upcoming pairings: three-surface persistence, four-resource integration, stable actions/clocks, correct participant routing, unknown timing and unsafe remap rejection passed.');
}
module.exports={run};if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
