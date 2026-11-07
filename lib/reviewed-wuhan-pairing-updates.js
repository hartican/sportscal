'use strict';
const assert=require('node:assert/strict');
const sourceUrl='https://www.wtatennis.com/tournaments/1075/dongfeng-voyah-wuhan-open-wuhan-chn/2026/draws';
const scope={
 'fixture:tennis:espn:wta:185333':{prior:['Iva Jovic','Mia Pohankova'],next:['Anna Bondar','Mia Pohankova'],labels:['A. Bondar','M. Pohankova'],sets:[{home:1,away:6},{home:3,away:6}],matchRow:'A. Bondar 1 3 / M. Pohankova 6 6; winner-b'},
 'fixture:tennis:espn:wta:185343':{prior:['Ann Li','Zheng Qinwen'],next:['Ann Li','Camila Osorio'],labels:['A. Li','C. Osorio']},
 'fixture:tennis:espn:wta:185340':{prior:['Anna Kalinskaya','Zhang Shuai'],next:['Ashlyn Krueger','Zhang Shuai'],labels:['A. Krueger','S. Zhang']},
 'fixture:tennis:espn:wta:185341':{prior:['Diane Parry','Anna Kalinskaya'],next:['Diane Parry','Lanlana Tararudee'],labels:['D. Parry','L. Tararudee'],sets:[{home:4,away:6},{home:1,away:6}],matchRow:'D. Parry 4 1 / L. Tararudee 6 6; winner-b'},
};
const id=name=>'competitor:tennis:wta:'+name.toLowerCase().replace(/ /g,'-');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
function validate(reviews=[],now=Date.now()){
 assert(Array.isArray(reviews)&&reviews.length<=4,'Wuhan correction scope');const seen=new Set();
 for(const c of reviews){
  const expected=scope[c.fixtureId];assert(expected&&!seen.has(c.fixtureId),'Unknown/duplicate Wuhan correction');seen.add(c.fixtureId);
  assert.equal(c.kind,'reviewed-official-draw-correction');assert.equal(c.tournamentId,'tournament:tennis:wta-wuhan-2026');assert.equal(c.roundLabel,'Round of 64');
  assert.deepEqual(c.priorParticipantIds,expected.prior.map(id));assert.deepEqual(c.participantIds,expected.next.map(id));assert.deepEqual(c.participants.map(p=>p.name),expected.next);assert.deepEqual(c.participants.map(p=>p.id),c.participantIds);assert.deepEqual(c.officialPlayerLabels,expected.labels);
  assert.equal(c.sourceUrl,sourceUrl);assert.equal(c.sourceSha256,'3f70f1b7c00399068798a602b16dfc4490b439d0d6d0a7bc3de3184bb740e941');assert.equal(c.checkedAt,'2026-10-13T07:18:05.511537+00:00');assert(Number.isFinite(Date.parse(c.checkedAt))&&Date.parse(c.checkedAt)<=now,'Invalid/future organiser receipt');
  const p=c.publisher;assert.equal(p.fixtureId,c.fixtureId);assert.equal(p.eventId,'381-2026');assert.equal(p.roundLabel,c.roundLabel);assert.equal(p.sourceUrl,'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard?dates=20261013');assert.equal(p.sourceSha256,'e758d8a3f55f2f9cfa9fe080e4b2895c9c75b092242791fb010d21a06ae92964');assert.equal(p.checkedAt,'2026-10-13T06:59:40.000Z');
  assert.deepEqual([...p.participantIds].sort(),[...c.participantIds].sort());assert(Number.isFinite(Date.parse(p.checkedAt))&&Date.parse(p.checkedAt)<=Date.parse(c.checkedAt),'Invalid corroborating receipt');assert.equal(Date.parse(c.validUntil),Date.parse(p.checkedAt)+6*3600000,'Correction freshness uses the existing six-hour receipt budget');
  if(expected.sets){
   assert.equal(p.status,'completed');assert.deepEqual(p.sets,expected.sets);assert.equal(p.winnerParticipantId,c.participantIds[1]);
   const r=c.result;assert.equal(r.kind,'official-draw-result');assert.equal(r.fixtureId,c.fixtureId);assert.deepEqual(r.participantIds,c.participantIds);assert.deepEqual(r.sets,p.sets);assert.equal(r.winnerParticipantId,p.winnerParticipantId);assert.equal(r.sourceUrl,c.sourceUrl);assert.equal(r.checkedAt,c.checkedAt);assert.equal(r.sourceSha256,c.sourceSha256);assert.equal(r.matchRow,expected.matchRow);
  }else{assert.equal(p.status,'scheduled');assert(!c.result,'No result was reviewed for this pairing');}
 }
 return reviews;
}
function project(records,reviews=[],{now=Date.now()}={}){
 validate(reviews,now);const changes=new Map();
 for(const c of reviews){
  const matches=records.filter(e=>aliases(e).includes(c.fixtureId));
  if(!matches.length&&now>=Date.parse(c.validUntil))continue;
  assert.equal(matches.length,1,'Correction must bind exactly one retained fixture');const old=matches[0];
  assert.equal(old.tennisProviderMatchId,c.fixtureId.split(':').at(-1));assert.equal(old.tennisProviderEventId,'381-2026');assert.equal(old.tennisProviderTour,'wta');assert.equal(old.tournamentId,c.tournamentId);assert.equal(old.roundLabel,c.roundLabel);
  if(same(old.participantIds,c.participantIds))continue;
  assert.deepEqual(old.participantIds,c.priorParticipantIds,'Unexpected later pairing cannot be overwritten');assert(now<Date.parse(c.validUntil),'Expired correction requires another review');
  assert(['scheduled','upcoming'].includes(old.status)&&!old.startTimeUtc&&!old.timingVerified&&!old.scheduleEvidence,'Timed or played identities cannot be remapped');
  assert(['score','scoreDisplay','result','winnerParticipantId','actualEndTimeUtc','completedAt'].every(k=>old[k]==null||old[k]==='')&&!old.sets?.length&&(!old.resultStatus||old.resultStatus==='pending'),'Existing result evidence blocks remapping');
  assert(['sourceCheckedAt','statusCheckedAt','pairingSourceCheckedAt'].every(k=>!old[k]||Number.isFinite(Date.parse(old[k]))&&Date.parse(old[k])<=Date.parse(c.checkedAt)),'Review cannot overwrite newer or invalid observations');
  const people=c.participants.map(p=>({...old.participants?.find(v=>v.id===p.id),...p,sourceName:'WTA',sourceType:'official',sourceUrl:c.sourceUrl,sourceCheckedAt:c.checkedAt}));
  const next={...old,name:people.map(p=>p.name).join(' v '),participants:people,participantIds:[...c.participantIds],homeParticipantId:c.participantIds[0],awayParticipantId:c.participantIds[1],pairingSourceUrl:c.sourceUrl,pairingSourceCheckedAt:c.checkedAt,pairingEvidence:c,sourceRefs:[...new Set([...(old.sourceRefs||[]),c.sourceUrl])],selectedSentence:'',fullSpiel:''};
  for(const k of ['editorialNarrative','editorialPreview','resultEditorialBranches','summary','storyline'])delete next[k];
  for(const k of ['displayTitleCompact','displayName'])if(Object.hasOwn(old,k))next[k]=next.name;
  for(const k of ['participantCountryCodes','representativeCountryCodes'])if(Object.hasOwn(old,k))next[k]=[...new Set(people.map(p=>p.countryCode).filter(Boolean))];
  if(Object.hasOwn(old,'participantSlots'))next.participantSlots=people.map((p,i)=>({slot:i+1,participantId:p.id,label:p.name,logoUrl:old.participantSlots?.find(v=>v.participantId===p.id)?.logoUrl||null}));
  if(c.result){
   const r=c.result,score=r.sets.map(s=>`${s.home}–${s.away}`).join(', '),winner=people.find(p=>p.id===r.winnerParticipantId),copy=`${winner.name} won. ${next.name}: ${score}.`;
   Object.assign(next,{status:'completed',sets:r.sets,score,scoreDisplay:score,result:score,resultStatus:'official',winnerParticipantId:winner.id,loserParticipantId:people.find(p=>p.id!==winner.id).id,eliminatedParticipantIds:[people.find(p=>p.id!==winner.id).id],resultEvidence:r,resultSourceUrl:r.sourceUrl,resultSourceCheckedAt:r.checkedAt,scoreCheckedAt:r.checkedAt,statusCheckedAt:r.checkedAt,statusSourceUrl:r.sourceUrl,statusSourceName:'WTA',statusSourceType:'official',resultLabels:['Completed'],outcomeText:copy,recapText:copy});
   delete next.resultAvailabilityEvidence;delete next.statusEvidence;
  }
  changes.set(old,next);
 }
 return records.map(e=>changes.get(e)||e);
}
module.exports={validate,project};
