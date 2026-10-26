'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {parseWorldRugby}=require('../lib/coverage-discovery'),identity=require('../config/fixture-identity');
const samples=require('./fixtures/world-rugby-unresolved-sides-20261026.json').samples;
const json=value=>JSON.parse(JSON.stringify(value));
const row=(fixture,sport)=>({source_id:sport==='WRU'?'discovery-rugby-wru':'discovery-rugby-mru',fixture_id:fixture.id,fixture,identity_keys:fixture.sourceEventIds});
async function run(){let checks=0;const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-rugby-unknown-'))),fetchBefore=global.fetch;
 global.fetch=async()=>{throw Error('No provider/service allocated');};
 try{
  const incoming=[];
  for(const sample of samples){
   const [fixture]=parseWorldRugby({content:[sample.game]},sample);
   assert(fixture,'Unresolved fixture retained');assert.deepEqual(fixture.participantIds,[]);assert.deepEqual(fixture.participants,[]);assert.equal(fixture.homeParticipantId,undefined);assert.equal(fixture.awayParticipantId,undefined);
   assert.equal(fixture.id,sample.expectedId);assert.equal(fixture.name,sample.expectedName);assert.equal(fixture.date,sample.expectedDate);assert.equal(fixture.startTimeUtc,sample.expectedStartTimeUtc);assert.equal(fixture.sourceCheckedAt,sample.checkedAt);
   assert.deepEqual(fixture.participantSlots.map(p=>p.label),sample.game.teams.map(t=>t.name));assert(fixture.participantSlots.every(p=>p.participantId===''));checks++;
   // Exact retained-error pattern, represented as JSON from a service/file.
   // No real retained source, customer state or sporting file is changed.
   const sentinel=sample.game.sport==='WRU'?'team:rugby:wr-0-women':'team:rugby:wr-0';
   const previous={...json(fixture),participantSlots:[],participantIds:[sentinel,sentinel],participants:sample.game.teams.map((t,i)=>({id:sentinel,name:t.name,role:i?'away':'home',sourceIds:{worldRugby:'0'}})),homeParticipantId:sentinel,awayParticipantId:sentinel};
   const next=json(fixture),[merged]=identity.mergeOverlays([previous],[next]);
   assert.deepEqual(merged.participantIds,[],'Continuity fallback must not restore legacy zero identity');assert.deepEqual(merged.participants,[]);assert(!merged.homeParticipantId);assert(!merged.awayParticipantId);assert.equal(merged.id,previous.id);assert.equal(merged.sourceCheckedAt,previous.sourceCheckedAt);assert.equal(identity.canonicalFixtureId(merged.id),identity.canonicalFixtureId(previous.id));checks++;
   incoming.push(row(json(identity.normalizeCore(merged)),sample.game.sport));
  }
  for(const knownSlot of [1,2]){
   const sample=samples[0],[unknown]=parseWorldRugby({content:[sample.game]},sample),sentinel='team:rugby:wr-0';
   const prior={...json(unknown),participantSlots:[],participants:[{id:sentinel,name:'Unresolved home',role:'home',sourceIds:{worldRugby:'0'}},{id:sentinel,name:'Unresolved away',role:'away',sourceIds:{worldRugby:'0'}}],participantIds:[sentinel,sentinel],homeParticipantId:sentinel,awayParticipantId:sentinel};
   prior.participants[knownSlot-1]={id:'team:rugby:wallabies',name:'Australia',role:knownSlot===1?'home':'away',sourceIds:{worldRugby:'38'}};prior.participantIds[knownSlot-1]='team:rugby:wallabies';prior[knownSlot===1?'homeParticipantId':'awayParticipantId']='team:rugby:wallabies';
   const [mixed]=identity.mergeOverlays([prior],[json(unknown)]);assert.deepEqual(mixed.participantIds,['team:rugby:wallabies'],'Real side retained independently of sentinel');assert.equal(mixed.participants[0].id,'team:rugby:wallabies');assert.equal(mixed[knownSlot===1?'homeParticipantId':'awayParticipantId'],'team:rugby:wallabies');assert(!mixed[knownSlot===1?'awayParticipantId':'homeParticipantId']);assert.equal(mixed.participantSlots[knownSlot-1].participantId,'team:rugby:wallabies');assert(!mixed.participantSlots[knownSlot===1?1:0].participantId);assert.equal(mixed.sourceCheckedAt,prior.sourceCheckedAt);
   await require('./lib/public-coverage-producer').produce({clock:()=>new Date(Date.parse(sample.checkedAt)+1000),request:async()=>[row(json(mixed),'MRU')]});checks++;
  }
  const at=new Date(Math.max(...samples.map(s=>Date.parse(s.checkedAt)))+1000),sorted=incoming.sort((a,b)=>a.source_id.localeCompare(b.source_id)||a.fixture_id.localeCompare(b.fixture_id));
  const output=path.join(root,'public-coverage.json');await require('./sync-live-coverage').capturePublic({output,clock:()=>at,request:async()=>structuredClone(sorted)});
  const capture=require('./lib/public-coverage-capture').read(output);assert.equal(capture.pages[0].rows.length,7);assert(capture.pages[0].rows.every(r=>r.fixture.participantSlots.every(s=>s.participantId==='')));checks++;
  const game=json(samples[0].game);game.teams=[{id:'38',name:'Australia'},{id:'37',name:'New Zealand'}];game.matchId='e3cbae12-66b3-4835-b1ce-4014b63055c8';game.time={millis:Date.parse('2026-10-17T05:00:00Z'),gmtOffset:10,label:'2026-10-17'};
  const [known]=parseWorldRugby({content:[game]},samples[0]);assert.deepEqual(known.participantIds,['team:rugby:wallabies','team:rugby:all-blacks']);assert.equal(known.id,'rugby-australia-new-zealand-2026-10-17');assert(known.sourceEventIds.includes('fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8'));assert.deepEqual(known.participantSlots,[]);checks++;
  const [retainedKnown]=identity.mergeOverlays([known],[{...json(known),participants:[],participantIds:[],participantSlots:[{slot:1,label:'TBC',participantId:''},{slot:2,label:'TBC',participantId:''}],homeParticipantId:undefined,awayParticipantId:undefined}]);assert.deepEqual(retainedKnown.participantIds,known.participantIds);assert.equal(retainedKnown.homeParticipantId,known.homeParticipantId);checks++;
  const partial=json(samples[0].game);partial.teams[1]={id:'38',name:'Australia'};const [one]=parseWorldRugby({content:[partial]},samples[0]);assert.deepEqual(one.participantIds,['team:rugby:wallabies']);assert(!one.homeParticipantId);assert.equal(one.awayParticipantId,'team:rugby:wallabies');assert.deepEqual(one.participantSlots.map(p=>p.participantId),['','team:rugby:wallabies']);checks++;
  const numeric=json(samples[0].game);numeric.teams.forEach(t=>{t.id=0;});const [zero]=parseWorldRugby({content:[numeric]},samples[0]);assert.deepEqual(zero.participantIds,[]);assert.equal(zero.id,samples[0].expectedId);checks++;
  const duplicate=json(samples[0].game);duplicate.teams=[{id:'42',name:'North Club'},{id:'42',name:'South Club'}];const [duplicateKnown]=parseWorldRugby({content:[duplicate]},samples[0]);await assert.rejects(()=>require('./lib/public-coverage-producer').produce({clock:()=>at,request:async()=>[row(json(duplicateKnown),'MRU')]}),/SIDES/);checks++;
  const nonzero=json(samples[0].game);nonzero.teams=[{id:'10',name:'North Club'},{id:'20',name:'South Club'}];const [validClubs]=parseWorldRugby({content:[nonzero]},samples[0]);assert.deepEqual(validClubs.participantIds,['team:rugby:wr-10','team:rugby:wr-20']);assert.deepEqual(validClubs.participantSlots,[]);checks++;
  const scored=json(samples[0].game);scored.status='L1';scored.scores=[12,7];const [unresolvedScore]=parseWorldRugby({content:[scored]},samples[0]);assert.equal(unresolvedScore.homeScore,12);assert.equal(unresolvedScore.awayScore,7,'Observed source numbers retained, never assigned invented team IDs');
  const refused=path.join(root,'score');fs.mkdirSync(refused);const failedOutput=path.join(refused,'public-coverage.json');await assert.rejects(()=>require('./sync-live-coverage').capturePublic({output:failedOutput,clock:()=>at,request:async()=>[row(json(unresolvedScore),'MRU')]}),/PUBLIC_COVERAGE_SIDES/);assert(!fs.existsSync(failedOutput));checks++;
  const file=path.join(root,'last-good.json');fs.writeFileSync(file,JSON.stringify({events:[known],sources:[],participants:[],competitions:[]}));const before=fs.readFileSync(file);const damaged=json(capture);damaged.pages[0].rows[0].fixture.homeParticipantId='team:rugby:wr-0';const crypto=require('node:crypto');damaged.pages[0].sha256=crypto.createHash('sha256').update(JSON.stringify(damaged.pages[0].rows)).digest('hex');await assert.rejects(()=>require('./sync-live-coverage').sync({file,now:at,publicCapture:damaged}),/SIDES/);assert(fs.readFileSync(file).equals(before));checks++;
  console.log(JSON.stringify({checks,actualParserAndContinuity:true,inputs:'reconstructed raw-shaped tests; no literal/current provider claim',networkRequests:0,generatedSportingDataWrites:0},null,2));return {checks};
 }finally{global.fetch=fetchBefore;fs.rmSync(root,{recursive:true,force:true});}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={run};
