'use strict';
// The existing reviewed-calendar pattern, restricted to one captured retained
// schedule and its pre-match/final source observations. Never general drift.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const receipt=require('../fixtures/rugby-retained-start-20261030.json');
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields=['id','key','sourceName','sourceType','sourceFixtureId','sourceUrl','participantIds','homeParticipantId','awayParticipantId','startTimeUtc','status','sourceStatus','homeScore','awayScore','scoreDisplay','scoreFactObservedAt','statusFactObservedAt','scoreCheckedAt','statusCheckedAt','eventId','canonicalEventId','sourceEventIds','date','endDate','actualStartTimeUtc','actualEndTimeUtc','score','sets','games','innings','outcomeText','recapText','result','winnerParticipantId'];
const tuple=record=>Object.fromEntries(fields.filter(k=>Object.hasOwn(record,k)).map(k=>[k,record[k]]));
function apply(base,fixture){
 if(base?.id!=='fixture:rugby:wr:731beb0c-e76a-4137-a739-cbeac9e1d862'||base.startTimeUtc!=='2026-10-23T08:45:00.000Z')return base;
 assert.equal(sha(receipt.retained),receipt.sha256.retained,'Reviewed retained Rugby calendar evidence changed');
 assert.equal(sha(receipt.rows),receipt.sha256.rows,'Reviewed captured Rugby calendar evidence changed');
 const final=receipt.rows.find(r=>r.fixture.status==='completed'),near=receipt.rows.find(r=>r.fixture.status==='scheduled');
 assert(final&&near&&final.source_id==='discovery-rugby-wru'&&near.source_id==='discovery-rugby-wru-near');
 assert.equal(final.fixture.id,receipt.retained.id);assert.equal(near.fixture.id,receipt.retained.id);
 assert.equal(final.fixture.startTimeUtc,'2026-10-23T08:30:00.000Z');assert.equal(near.fixture.startTimeUtc,final.fixture.startTimeUtc);
 assert(Date.parse(near.fixture.sourceCheckedAt)<Date.parse(near.fixture.startTimeUtc),'Calendar correction needs the captured pre-match appointment');
 assert.deepEqual(near.fixture.participantIds,final.fixture.participantIds);assert.deepEqual(final.fixture.participantIds,receipt.retained.participantIds);
 assert.equal(final.fixture.sourceFixtureId,receipt.retained.sourceFixtureId);assert.equal(near.fixture.sourceFixtureId,receipt.retained.sourceFixtureId);
 // A changed provider identity, original observation, side order, start or score
 // is still a hard contradiction. Unrelated display/viewing fields stay put.
 if(sha(tuple(base))!==sha(tuple(receipt.retained))||base.sourceCheckedAt!==receipt.retained.sourceCheckedAt||sha(tuple(fixture))!==sha(tuple(final.fixture)))return base;
 return {...base,startTimeUtc:final.fixture.startTimeUtc};
}
module.exports={apply};
