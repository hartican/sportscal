'use strict';
// Retained, individually reviewed organiser facts. Called by update-cards;
// rebuilding projections never advances a source observation clock.
const fs=require('node:fs'),assert=require('node:assert/strict');
const document=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json');
function validate(doc=document){
 assert.equal(doc.schemaVersion,'reviewed-participant-fixtures.v1');const seen=new Set();
 for(const e of doc.events){assert(!seen.has(e.id));seen.add(e.id);assert.equal(e.participantsConfirmed,true);assert.equal(e.contestUnit,'match');assert.equal(e.participantIds.length,2);assert(e.participantIds.every(id=>/^(athlete|competitor):tennis:/.test(id)));assert(/^https:\/\//.test(e.sourceUrl));assert(Number.isFinite(Date.parse(e.sourceCheckedAt))&&Date.parse(e.sourceCheckedAt)<=Date.now());assert(['exact','not-before','followed-by','unresolved'].includes(e.timePrecision));if(['exact','not-before'].includes(e.timePrecision))assert(Number.isFinite(Date.parse(e.startTimeUtc)));else assert(!e.startTimeUtc);assert(e.timingEvidence?.matchRow&&e.timingEvidence?.clockAssociation);}
 for(const e of doc.events.filter(e=>e.drawEvidence)){
  const proof=e.drawEvidence;
  assert(proof.kind==='official-draw-pairing'&&proof.fixtureId===e.id&&proof.sourceUrl===e.timingEvidence.drawSourceUrl&&proof.checkedAt===e.timingEvidence.drawCheckedAt&&/^[a-f0-9]{64}$/.test(proof.sourceSha256)&&proof.sourceSha256===e.timingEvidence.drawSourceSha256,'reviewed pairing requires the exact dated organiser draw receipt');
  assert(Number.isFinite(Date.parse(proof.checkedAt))&&Date.parse(proof.checkedAt)<=Date.now()&&proof.roundLabel===e.roundLabel&&proof.matchRow&&proof.winnerCell==='unpublished','reviewed pairing must identify its published round without claiming advancement');
  assert.deepEqual(proof.participantIds,[e.homeParticipantId,e.awayParticipantId],'draw pairing must bind both canonical participants in order');
  assert.deepEqual(e.participantIds,proof.participantIds);
 }
 for(const e of doc.events.filter(e=>e.status==='live'))assert(['reviewed-broadcaster-live','official-match-page-status'].includes(e.statusEvidence?.kind),'unknown live evidence cannot establish match play');
 for(const e of doc.events.filter(e=>e.status==='live'&&e.statusEvidence?.kind==='reviewed-broadcaster-live')){
  const proof=e.statusEvidence;
  assert(proof?.kind==='reviewed-broadcaster-live'&&proof.fixtureId===e.id&&proof.sourceUrl===e.statusSourceUrl&&proof.checkedAt===e.statusCheckedAt&&Number.isFinite(Date.parse(proof.checkedAt))&&Date.parse(proof.checkedAt)<=Date.now(),'reviewed live requires a dated match-bound observation');
  assert.deepEqual(proof.participantIds,e.participantIds,'live status must bind both canonical participants');
  assert(/^https:\/\//.test(proof.fixtureUrl)&&/^https:\/\//.test(proof.corroboratingUrl)&&/\bLIVE\b/.test(proof.matchLabel)&&proof.officialMatchSourceUrl===e.timingEvidence.drawSourceUrl,'live status needs the named broadcaster listing and existing official fixture');
 }
 for(const e of doc.events.filter(e=>e.resultStatus==='pending')){
  const proof=e.resultAvailabilityEvidence;
  assert(['scheduled','upcoming'].includes(e.status)&&!e.score,'unpublished results cannot establish completion or a score');
  assert(/^https:\/\//.test(e.resultSourceUrl)&&Number.isFinite(Date.parse(e.resultSourceCheckedAt))&&Date.parse(e.resultSourceCheckedAt)<=Date.now(),'pending results require a dated source observation');
  assert(proof&&proof.kind==='official-draw-result-unpublished'&&proof.fixtureId===e.id&&proof.sourceUrl===e.resultSourceUrl&&proof.checkedAt===e.resultSourceCheckedAt&&typeof proof.matchRow==='string'&&proof.matchRow.length>0&&proof.winnerCell==='unpublished'&&/^[a-f0-9]{64}$/.test(proof.sourceSha256),'pending result requires the reviewed match row and unpublished winner cell');
 }
 for(const e of doc.events.filter(e=>e.status==='live'&&e.statusEvidence?.kind==='official-match-page-status')){
  const proof=e.statusEvidence;
  assert(proof&&proof.kind==='official-match-page-status'&&proof.fixtureId===e.id&&proof.sourceUrl===e.sourceUrl&&/^[a-f0-9]{64}$/.test(proof.sourceSha256),'live review requires the exact official match receipt');
  assert(proof.providerStatus==='P'&&proof.scoreState==='in-progress','score text and generic JSON-LD scheduled status cannot establish live or final status');
  assert.deepEqual(proof.participantIds,[e.homeParticipantId,e.awayParticipantId]);
  assert.deepEqual(e.participantIds,proof.participantIds);
  assert(proof.providerParticipantIds?.length===2&&proof.providerParticipantIds.every(id=>/^\d+$/.test(id)));
  assert(e.sourceUrl===`https://www.wtatennis.com/tournaments/${proof.tournamentId}/beijing/${proof.season}/scores/${proof.matchId}`,'the receipt must identify the named match, edition and organiser');
  assert(e.statusCheckedAt===proof.checkedAt&&e.scoreCheckedAt===proof.checkedAt&&Number.isFinite(Date.parse(proof.checkedAt))&&Date.parse(proof.checkedAt)<=Date.now());
  assert(!e.winnerParticipantId&&!e.result&&!e.actualEndTimeUtc&&!e.completedAt,'live observations cannot supply a winner or finish');
  const sets=String(proof.score).split(',').map(s=>s.split('-').map(Number));
  assert(sets.length>=1&&sets.length<=3&&sets.every(s=>s.length===2&&s.every(n=>Number.isInteger(n)&&n>=0&&n<=7)));
  assert.deepEqual(e.sets,sets.map(([home,away])=>({home,away})), 'partial sets retain official participant order');
  assert(e.score===sets.map(s=>s.join('–')).join(', ')&&e.scoreDisplay===e.score);
 }
 for(const e of doc.events.filter(e=>['completed','finished','final'].includes(e.status))){
  const proof=e.resultEvidence;
  assert.equal(e.resultStatus,'official','completed reviewed matches require an official result');
  assert(/^https:\/\//.test(e.resultSourceUrl)&&Number.isFinite(Date.parse(e.resultSourceCheckedAt))&&Date.parse(e.resultSourceCheckedAt)<=Date.now(),'completed results require a dated source observation');
  assert(proof&&proof.kind==='official-draw-result'&&proof.fixtureId===e.id&&proof.sourceUrl===e.resultSourceUrl&&proof.checkedAt===e.resultSourceCheckedAt&&typeof proof.matchRow==='string'&&proof.matchRow.length>0&&/^[a-f0-9]{64}$/.test(proof.sourceSha256),'completed result requires a reviewed match row and source receipt');
  assert.deepEqual(proof.participantIds,[e.homeParticipantId,e.awayParticipantId],'result evidence must retain ordered participants');
  assert.deepEqual(e.participantIds,proof.participantIds);
  assert(e.participantIds.includes(e.winnerParticipantId)&&proof.winnerParticipantId===e.winnerParticipantId,'result winner must be a verified participant');
  assert(Array.isArray(e.sets)&&e.sets.length>=2&&e.sets.length<=5&&e.sets.every(s=>Number.isInteger(s.home)&&Number.isInteger(s.away)&&s.home>=0&&s.away>=0&&s.home!==s.away),'reviewed result requires oriented set scores');
  assert.deepEqual(proof.sets,e.sets,'result score must agree with its reviewed evidence');
  const homeWins=e.sets.filter(s=>s.home>s.away).length,awayWins=e.sets.length-homeWins;
  if(e.resultCode==='RET'){
   assert(proof.resultCode==='RET'&&proof.retiredParticipantId===e.retiredParticipantId&&e.participantIds.includes(e.retiredParticipantId)&&e.retiredParticipantId!==e.winnerParticipantId&&/\bRET\b/.test(e.score),'retirement requires the explicitly published marker and retiring opponent');
  }else{
   assert(!e.resultCode&&!e.retiredParticipantId&&!proof.resultCode,'unreviewed result codes cannot establish completion');
   assert(homeWins!==awayWins&&e.winnerParticipantId===(homeWins>awayWins?e.homeParticipantId:e.awayParticipantId),'reviewed straight result winner must agree with the set scores');
  }
  assert(e.score&&e.scoreDisplay===e.score&&e.result===e.score,'result displays must share the reviewed score');
  assert.equal(e.scoreCheckedAt,e.resultSourceCheckedAt,'score observation must use the result check, not the retained timing check');
  assert.equal(e.statusCheckedAt,e.resultSourceCheckedAt,'completion must use the result observation');
 }
 return doc;
}
const scheduleFields=['sourceUrl','sourceName','sourceCheckedAt','canonicalSourceCheckedAt','date','time','startTimeUtc','timePrecision','scheduleStatus','timeTbc','timingVerified','timingEvidence','schedulingWindow'];
function apply({root='.',doc=document}={}){validate(doc);const plans=[];for(const file of ['data/events.json','feeds/incoming/events.json']){const target=require('node:path').join(root,file),before=fs.readFileSync(target,'utf8'),data=JSON.parse(before);const identity=e=>e.canonicalEventId||e.eventId||e.id;const ids=new Set(doc.events.map(identity));const prior=data.events.filter(e=>ids.has(identity(e)));const settled=e=>['completed','finished','final','abandoned'].includes(e?.status);const updates=doc.events.filter(e=>!settled(prior.find(p=>identity(p)===identity(e)))||settled(e)).map(e=>{
  const base=prior.find(p=>identity(p)===identity(e));
  // A retained review must not replace a later publisher final or replay
  // already accepted result copy/aliases at the same observation.
  const resultObservation=row=>Math.max(...['resultSourceCheckedAt','scoreCheckedAt','statusCheckedAt'].map(key=>Date.parse(row?.[key])||0));
  const sameFinal=base&&['status','sets','winnerParticipantId','resultCode','retiredParticipantId'].every(key=>JSON.stringify(e[key])===JSON.stringify(base[key]));
  if(settled(e)&&settled(base)&&(sameFinal||resultObservation(e)<=resultObservation(base)))return base;
  // Reviewing a draw result updates result/status facts only. It cannot roll
  // back a newer fixture check or masquerade as a fresh scheduling observation.
  return settled(e)&&base?{...e,...Object.fromEntries(scheduleFields.filter(k=>base[k]!==undefined).map(k=>[k,base[k]]))}:e;
 });const reviewed=require('../config/fixture-identity').mergeOverlays(prior,updates).map(e=>{
  if(!settled(e)||!e.resultEvidence||!e.storyline||e.storyline.arcStage==='recap')return e;
  const rules=require('./lib/storyline-card-rules'),storyline=rules.storylineFor(e),safe=rules.spoilerSafeRootCopy(e,storyline);
  const {editorialPreview,...retained}=e;
  return {...retained,storyline,selectedSentence:safe.hook,fullSpiel:safe.synopsis};
 });data.events=[...data.events.filter(e=>!ids.has(identity(e))),...reviewed];plans.push({file,target,before,after:JSON.stringify(data,null,2)+'\n'});}for(const p of plans)if(p.after!==p.before)fs.writeFileSync(p.target,p.after);return plans.map(p=>({file:p.file,fixtures:doc.events.length}));}
module.exports={apply,validate};if(require.main===module)console.log(JSON.stringify(apply()));
