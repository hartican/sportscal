'use strict';
// Retained, individually reviewed organiser facts. Called by update-cards;
// rebuilding projections never advances a source observation clock.
const fs=require('node:fs'),assert=require('node:assert/strict');
const document=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json');
function validate(doc=document){
 assert.equal(doc.schemaVersion,'reviewed-participant-fixtures.v1');const seen=new Set();
 for(const e of doc.events){assert(!seen.has(e.id));seen.add(e.id);assert.equal(e.participantsConfirmed,true);assert.equal(e.contestUnit,'match');assert.equal(e.participantIds.length,2);assert(e.participantIds.every(id=>/^(athlete|competitor):tennis:/.test(id)));assert(/^https:\/\//.test(e.sourceUrl));assert(Number.isFinite(Date.parse(e.sourceCheckedAt))&&Date.parse(e.sourceCheckedAt)<=Date.now());assert(['exact','not-before','followed-by','unresolved'].includes(e.timePrecision));if(['exact','not-before'].includes(e.timePrecision))assert(Number.isFinite(Date.parse(e.startTimeUtc)));else assert(!e.startTimeUtc);assert(e.timingEvidence?.matchRow&&e.timingEvidence?.clockAssociation);}
 for(const e of doc.events.filter(e=>e.resultStatus==='pending')){
  const proof=e.resultAvailabilityEvidence;
  assert(['scheduled','upcoming'].includes(e.status)&&!e.score,'unpublished results cannot establish completion or a score');
  assert(/^https:\/\//.test(e.resultSourceUrl)&&Number.isFinite(Date.parse(e.resultSourceCheckedAt))&&Date.parse(e.resultSourceCheckedAt)<=Date.now(),'pending results require a dated source observation');
  assert(proof&&proof.kind==='official-draw-result-unpublished'&&proof.fixtureId===e.id&&proof.sourceUrl===e.resultSourceUrl&&proof.checkedAt===e.resultSourceCheckedAt&&typeof proof.matchRow==='string'&&proof.matchRow.length>0&&proof.winnerCell==='unpublished'&&/^[a-f0-9]{64}$/.test(proof.sourceSha256),'pending result requires the reviewed match row and unpublished winner cell');
 }
 return doc;
}
function apply({root='.'}={}){validate();const report=[];for(const file of ['data/events.json','feeds/incoming/events.json']){const target=require('node:path').join(root,file),before=fs.readFileSync(target,'utf8'),data=JSON.parse(before);const identity=e=>e.canonicalEventId||e.eventId||e.id;const ids=new Set(document.events.map(identity));const prior=data.events.filter(e=>ids.has(identity(e)));const settled=e=>['completed','finished','final','abandoned'].includes(e?.status);const updates=document.events.filter(e=>!settled(prior.find(p=>identity(p)===identity(e)))||settled(e));const reviewed=require('../config/fixture-identity').mergeOverlays(prior,updates);data.events=[...data.events.filter(e=>!ids.has(identity(e))),...reviewed];const after=JSON.stringify(data,null,2)+'\n';if(after!==before)fs.writeFileSync(target,after);report.push({file,fixtures:document.events.length});}return report;}
module.exports={apply,validate};if(require.main===module)console.log(JSON.stringify(apply()));
