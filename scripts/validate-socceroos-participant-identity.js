'use strict';
const assert=require('node:assert/strict');
const identity=require('../config/fixture-identity');
const national=require('../config/national-team-identities');
const {normalizeFixture}=require('./build-code-inspector');
const {APPROVED,prepare}=require('./lib/reviewed-fixture-admission');
const evidence=require('../data/canonical/current-card-evidence-2026.json');
const clone=value=>structuredClone(value),referenceTime=new Date('2026-11-02T05:42:15.000Z');
function focused(){
  const ids=Object.keys(APPROVED);
  const peer={id:'reference:identity-peer',eventId:'reference:identity-peer',key:'football',cardKind:'fixture',name:'Unrelated retained fixture',date:'2026-11-02',time:'20:00',expected:null,liveWindow:3};
  const feed={schemaVersion:'events.v1',version:'reference-20261102',publishedAt:'2026-11-02T05:42:14.000Z',events:[peer]};
  const seeded=prepare({evidence,incoming:clone(feed),published:clone(feed),ids},{referenceTime});
  for(const id of ids){
    const source=seeded.incoming.events.find(row=>row.id===id),before=clone(source),expected=source.participantIds;
    assert.equal(national.teamForId(expected[0]),null,'Do not register an unsupported opponent to pass normalization');
    for(const input of [source,{...source,participants:[...source.participants].reverse()}]){
      const normalized=identity.normalizeCore(input);
      assert.deepEqual(normalized.participantIds,expected);
      assert.deepEqual(normalized.participants.map(p=>p.id),expected);
      assert.deepEqual(normalized.participants.map(p=>p.role),['home','away']);
      assert.deepEqual(normalized.participants[0],source.participants[0]);
      assert.equal(normalized.participants[1].countryCode,'AU');
      assert.equal(normalized.homeParticipantId,expected[0]);assert.equal(normalized.awayParticipantId,expected[1]);
      const derived=normalizeFixture(normalized,'sport:football');
      assert.deepEqual(derived.participantIds,expected);
      assert.deepEqual(derived.participantSlots.map(slot=>slot.participantId),expected);
      assert.deepEqual(derived.participantSlots.map(slot=>slot.label),source.participants.map(p=>p.displayName||p.name));
      assert.deepEqual(derived.participants.map(p=>p.role),['home','away']);
      assert.deepEqual(identity.normalizeCore(normalized),normalized,'Repeat normalization must be stable');
    }
    assert.deepEqual(source,before,'Normalization must not mutate the source');
  }
  const broken=clone(seeded.published);
  for(const row of broken.events.filter(row=>ids.includes(row.id))){
    row.participantIds=['team:football:socceroos'];
    row.participants=[{...row.participants[1],role:'home'}];
  }
  const input={evidence,incoming:seeded.incoming,published:broken,ids},before=clone(input);
  assert.throws(()=>prepare(input,{referenceTime}),/retained canonical binding/);
  const repaired=prepare(input,{referenceTime,repairIdentities:true});
  assert.deepEqual(repaired.repaired,ids);assert.deepEqual(input,before);
  assert.deepEqual(repaired.incoming,input.incoming);
  assert.deepEqual(repaired.published.events[0],peer);
  for(const id of ids){
    const prior=broken.events.find(row=>row.id===id),after=repaired.published.events.find(row=>row.id===id);
    const strip=row=>{const {participantIds,participants,...other}=row;return other;};
    assert.deepEqual(strip(after),strip(prior),'Only the two sourced participant identity arrays may change');
    assert.deepEqual(after.participants,seeded.incoming.events.find(row=>row.id===id).participants);
  }
  assert.equal(prepare({...input,published:repaired.published},{referenceTime,repairIdentities:true}).changed,false);
  const unsafe=clone(input);unsafe.published.events[1].homeParticipantId='reference:wrong-home';
  assert.throws(()=>prepare(unsafe,{referenceTime,repairIdentities:true}),/home\/away binding/);
  const wrong=clone(input);wrong.published.events[1].participantIds=['reference:unrelated-team'];
  assert.throws(()=>prepare(wrong,{referenceTime,repairIdentities:true}),/collapsed signature/);
  const ordinary={id:'reference:club-peer',key:'football',name:'Reference Home v Reference Away',participantIds:['club:home','club:away'],participants:[{id:'club:home',name:'Home',role:'home'},{id:'club:away',name:'Away',role:'away'}]};
  const normalized=identity.normalizeCore(ordinary);assert.deepEqual(normalized.participantIds,ordinary.participantIds);assert.deepEqual(normalized.participants,ordinary.participants);
  const legacy=identity.normalizeCore({id:'reference:legacy-australia',key:'football',name:'Australia v Brazil',participantIds:['team:football:national:australia','team:football:brazil'],homeParticipantId:'team:football:national:australia',awayParticipantId:'team:football:brazil',participants:[{id:'team:football:national:australia',name:'Australia',role:'home'},{id:'team:football:brazil',name:'Brazil',role:'away'}]});
  assert.deepEqual(legacy.participantIds,['team:football:socceroos','team:football:brazil']);assert.deepEqual(legacy.participants.map(p=>p.role),['home','away']);assert.equal(legacy.homeParticipantId,'team:football:socceroos');
  console.log('Socceroos identity: both real reviewed pairs retain explicit unknown-opponent IDs, objects and home/away roles through core and Code normalization; reversed metadata, repeat, safe repair, unrelated and legacy guards passed. No registry/source/account requests.');
}
if(require.main===module)focused();
module.exports={focused};
