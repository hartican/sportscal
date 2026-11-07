'use strict';
// A reviewed calendar correction is separate from the immutable result tuple.
// Replay the captured source through its existing parser; never infer a new day
// from a result receipt, or accept arbitrary provider calendar drift.
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const receipt=require('../fixtures/result-calendar-20261016.json');
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const aliases=row=>[row.id,row.eventId,row.canonicalId,row.canonicalEventId,...(row.sourceEventIds||[])].filter(Boolean);
let captured;
function source(){
 if(captured)return captured;
 assert.equal(sha(receipt.payload),receipt.sourceSha256,'Reviewed calendar source changed');
 assert(Number.isFinite(Date.parse(receipt.checkedAt))&&Date.parse(receipt.checkedAt)<=Date.now(),'Invalid calendar observation');
 assert.equal(receipt.sourceUrl,'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard?dates=20261016');
 const {fixtures}=require('../../lib/tennis-scoreboard').parse(receipt.payload,{tour:'wta',checkedAt:receipt.checkedAt,now:new Date(receipt.checkedAt),catalogue:receipt.catalogue,requestUrl:receipt.sourceUrl});
 assert.equal(fixtures.length,1,'Calendar review must identify one match');
 const fixture=fixtures[0];
 assert.equal(fixture.id,'fixture:tennis:espn:wta:185347');
 assert.equal(fixture.status,'completed');
 assert(fixture.actualStartTimeUtc&&fixture.actualStartEvidence?.verified,'Calendar correction requires reported played start');
 assert.notEqual(fixture.date,receipt.priorDate);
 return captured=fixture;
}
function validate(row){
 const proof=row.acceptedResultProjection,correction=proof?.fixtureDateCorrection;
 if(!correction)return null;
 assert.deepEqual(correction,{receiptId:receipt.id,sourceSha256:receipt.sourceSha256,priorDate:receipt.priorDate},'Unreviewed accepted-result calendar correction');
 const fixture=source();
 assert(aliases(row).includes(fixture.id)&&proof.aliases.includes(fixture.id),'Calendar correction fixture identity mismatch');
 assert.deepEqual(proof.participantIds,fixture.participantIds,'Calendar correction participant identity/order mismatch');
 assert.equal(proof.fixtureDate,fixture.date,'Calendar correction disagrees with captured Sydney date');
 assert.equal(row.sourceUrl,fixture.sourceUrl,'Calendar correction result provider mismatch');
 assert.equal(row.score,fixture.score,'Calendar correction result conflict');
 assert.equal(row.winnerParticipantId,fixture.winnerParticipantId,'Calendar correction winner conflict');
 return fixture;
}
function apply(record,row){
 const fixture=validate(row);if(!fixture)return record;
 assert(aliases(record).includes(fixture.id),'Calendar correction retained identity mismatch');
 assert.deepEqual(record.participantIds,fixture.participantIds,'Calendar correction retained participants changed');
 assert([receipt.priorDate,fixture.date].includes(record.date),'Calendar correction cannot overwrite an unexplained date');
 assert(!record.startTimeUtc&&!record.timingVerified&&!record.timingEvidence?.clockAssociation,'Publisher calendar correction cannot replace an official start');
 if(record.actualStartTimeUtc)assert.equal(record.actualStartTimeUtc,fixture.actualStartTimeUtc,'Calendar correction conflicts with reported start');
 if(record.actualStartEvidence){
  for(const key of ['kind','fixtureId','startsAt','sourceName','sourceUrl','participantIds','verified','meaning'])assert.deepEqual(record.actualStartEvidence[key],fixture.actualStartEvidence[key],'Calendar correction conflicts with start evidence '+key);
  const checked=Date.parse(record.actualStartEvidence.checkedAt);
  assert(Number.isFinite(checked)&&checked>=Date.parse(fixture.actualStartTimeUtc)&&checked<=Date.now(),'Invalid retained start observation');
 }
 return {...record,date:fixture.date,actualStartTimeUtc:fixture.actualStartTimeUtc,actualStartEvidence:record.actualStartEvidence||structuredClone(fixture.actualStartEvidence),sourceRefs:[...new Set([...(record.sourceRefs||[]),receipt.sourceUrl])]};
}
module.exports={validate,apply};
