'use strict';
const assert=require('node:assert/strict');
const officialUrl='https://www.wtatennis.com/tournaments/1075/dongfeng-voyah-wuhan-open-wuhan-chn/2026/draws';
const scope={
 'fixture:tennis:espn:wta:185344':{prior:['janice-tjen','oleksandra-oliynykova'],next:['janice-tjen','aoi-ito'],names:['Janice Tjen','Aoi Ito'],labels:['J. Tjen','A. Ito']},
 'fixture:tennis:espn:wta:185340':{prior:['belinda-bencic','zhang-shuai'],next:['anna-kalinskaya','zhang-shuai'],names:['Anna Kalinskaya','Zhang Shuai'],labels:['A. Kalinskaya','S. Zhang']},
};
const participant=slug=>'competitor:tennis:wta:'+slug;
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function validate(corrections=[],now=Date.now()){
 assert(Array.isArray(corrections)&&corrections.length<=2,'pairing correction scope');const seen=new Set();
 for(const c of corrections){
  const expected=scope[c.fixtureId];assert(expected&&!seen.has(c.fixtureId),'unknown/duplicate reviewed pairing');seen.add(c.fixtureId);
  assert.equal(c.kind,'reviewed-official-draw-update');assert.equal(c.tournamentId,'tournament:tennis:wta-wuhan-2026');assert.equal(c.roundLabel,'Round of 64');
  assert.deepEqual(c.priorParticipantIds,expected.prior.map(participant));assert.deepEqual(c.participantIds,expected.next.map(participant));
  assert.equal(c.sourceUrl,officialUrl);assert(/^[a-f0-9]{64}$/.test(c.sourceSha256));
  assert(Number.isFinite(Date.parse(c.checkedAt))&&Date.parse(c.checkedAt)<=now,'invalid/future draw receipt');
  assert.equal(c.validBefore,'2026-10-12T00:00:00+08:00');assert(Date.parse(c.checkedAt)<Date.parse(c.validBefore),'review must precede this main draw');
  assert.equal(c.participants.length,2);assert.deepEqual(c.participants.map(p=>p.id),c.participantIds);assert.deepEqual(c.participants.map(p=>p.name),expected.names);assert(c.participants.every(p=>p.displayName===p.name));
  assert.deepEqual(c.officialPlayerLabels,expected.labels);
  assert.deepEqual(c.officialPlayerLabels,c.participants.map(p=>p.officialDrawLabel));assert(c.officialPlayerLabels.every(v=>typeof v==='string'&&v.length>2));
  const proof=c.publisher;assert.equal(proof.fixtureId,c.fixtureId);assert.equal(proof.eventId,'381-2026');assert.equal(proof.roundLabel,c.roundLabel);
  assert.equal(proof.sourceUrl,'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard?dates=20261011');assert(/^[a-f0-9]{64}$/.test(proof.sourceSha256));
  assert(Number.isFinite(Date.parse(proof.checkedAt))&&Date.parse(proof.checkedAt)<=Date.parse(c.checkedAt),'invalid corroborating receipt');
  assert.deepEqual(proof.participantIds,c.participantIds);assert.equal(proof.status,'scheduled');
 }
 return corrections;
}
function project(records,corrections=[],{now=Date.now()}={}){
 validate(corrections,now);const changes=new Map();
 for(const c of corrections){
  const matches=records.filter(e=>aliases(e).includes(c.fixtureId));
  if(!matches.length&&now>=Date.parse(c.validBefore))continue; // Never resurrect an expired reviewed fixture.
  assert.equal(matches.length,1,'reviewed pairing must bind one retained fixture');const old=matches[0];
  assert.equal(old.tennisProviderMatchId,c.fixtureId.split(':').at(-1));assert.equal(old.tennisProviderEventId,'381-2026');
  assert.equal(old.tennisProviderTour,'wta');assert.equal(old.tournamentId,c.tournamentId);assert.equal(old.roundLabel,c.roundLabel);
  if(same(old.participantIds,c.participantIds))continue; // A later result/timing observation remains intact.
  assert.deepEqual(old.participantIds,c.priorParticipantIds,'unexpected later pairing cannot be overwritten');
  assert(now<Date.parse(c.validBefore),'expired participant correction requires a new review');
  assert(['scheduled','upcoming'].includes(old.status)&&!old.startTimeUtc&&!old.timingVerified&&!old.scheduleEvidence,'played or timed identity cannot be remapped');
  assert(['score','scoreDisplay','result','winnerParticipantId'].every(k=>old[k]==null||old[k]==='')&&!old.sets?.length&&(!old.resultStatus||old.resultStatus==='pending'),'any result evidence blocks a participant remap');
  assert(['sourceCheckedAt','statusCheckedAt','pairingSourceCheckedAt'].every(k=>!old[k]||Date.parse(old[k])<=Date.parse(c.checkedAt)),'older draw review cannot overwrite a newer observation');
  const people=c.participants.map(p=>{const retained=(old.participants||[]).find(x=>x.id===p.id);const {officialDrawLabel,...facts}=p;return {...retained,...facts};});
  const next={...old,name:people.map(p=>p.name).join(' v '),participantIds:[...c.participantIds],participants:people,homeParticipantId:c.participantIds[0],awayParticipantId:c.participantIds[1],pairingSourceUrl:c.sourceUrl,pairingSourceCheckedAt:c.checkedAt,pairingEvidence:{...c},sourceRefs:[...new Set([...(old.sourceRefs||[]),c.sourceUrl])],selectedSentence:'',fullSpiel:''};
  if(Object.hasOwn(old,'displayTitleCompact'))next.displayTitleCompact=next.name;
  if(Object.hasOwn(old,'displayName'))next.displayName=next.name;
  if(Object.hasOwn(old,'participantSlots'))next.participantSlots=people.map((p,i)=>({slot:i+1,participantId:p.id,label:p.name,logoUrl:(old.participantSlots||[]).find(x=>x.participantId===p.id)?.logoUrl||null}));
  for(const k of ['participantCountryCodes','representativeCountryCodes'])if(Object.hasOwn(old,k))next[k]=[...new Set(people.map(p=>p.countryCode).filter(Boolean))];
  // Copy attached to the old matchup is not a review of the new matchup.
  for(const k of ['editorialNarrative','editorialPreview','resultEditorialBranches','summary','storyline'])delete next[k];
  changes.set(old,next);
 }
 return records.map(e=>changes.get(e)||e);
}
module.exports={validate,project};
