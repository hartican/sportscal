'use strict';
// Retained, individually reviewed organiser facts. Called by update-cards;
// rebuilding projections never advances a source observation clock.
const fs=require('node:fs'),assert=require('node:assert/strict');
const document=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json');
function validate(doc=document){
 assert.equal(doc.schemaVersion,'reviewed-participant-fixtures.v1');const seen=new Set();
 for(const e of doc.events){assert(!seen.has(e.id));seen.add(e.id);assert.equal(e.participantsConfirmed,true);assert.equal(e.contestUnit,'match');assert.equal(e.participantIds.length,2);assert(e.participantIds.every(id=>/^(athlete|competitor):tennis:/.test(id)));assert(/^https:\/\//.test(e.sourceUrl));assert(Number.isFinite(Date.parse(e.sourceCheckedAt))&&Date.parse(e.sourceCheckedAt)<=Date.now());assert(['exact','not-before','followed-by','unresolved'].includes(e.timePrecision));if(['exact','not-before'].includes(e.timePrecision))assert(Number.isFinite(Date.parse(e.startTimeUtc)));else assert(!e.startTimeUtc);assert(e.timingEvidence?.matchRow&&e.timingEvidence?.clockAssociation);}
 return doc;
}
function apply(){validate();const report=[];for(const file of ['data/events.json','feeds/incoming/events.json']){const before=fs.readFileSync(file,'utf8'),data=JSON.parse(before);const identity=e=>e.canonicalEventId||e.eventId||e.id;const ids=new Set(document.events.map(identity));const prior=data.events.filter(e=>ids.has(identity(e)));const reviewed=require('../config/fixture-identity').mergeOverlays(prior,document.events);data.events=[...data.events.filter(e=>!ids.has(identity(e))),...reviewed];const after=JSON.stringify(data,null,2)+'\n';if(after!==before)fs.writeFileSync(file,after);report.push({file,fixtures:document.events.length});}return report;}
module.exports={apply,validate};if(require.main===module)console.log(JSON.stringify(apply()));
