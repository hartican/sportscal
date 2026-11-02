'use strict';
const assert=require('node:assert/strict');
const canonicalId='major-match:rlwc-2026:tonga-samoa';
const publishedId='major-match-rlwc-2026-tonga-samoa';
const ids=['team:nrl:national:tonga','team:nrl:national:samoa'];
const labels=['Tonga','Samoa'];

function applies(event){return [canonicalId,publishedId].includes(event?.id);}

function assertEligible(event,sides){
  assert(applies(event),'Text-only artwork allowance is limited to the reviewed Tonga/Samoa fixture');
  assert.equal(event.canonicalEventId||event.id,canonicalId,'Exact canonical fixture identity required');
  assert.equal(event.key,'nrl','Rugby league identity required');
  assert.equal(event.sportDomainId,'sport:nrl');
  assert.equal(event.competitionId,'competition:rugby-league-world-cup:2026');
  assert.equal(event.competitionScope,'international');
  assert.equal(event.isInternational,true);
  assert.equal(event.participantsConfirmed,true);
  assert.equal(event.name,'Tonga v Samoa');
  assert.equal(event.sourceName,'International Rugby League');
  assert.equal(event.sourceUrl,'https://www.intrl.sport/match-details/2578');
  assert.equal(event.sourceType,'official');
  assert(Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now(),'Genuine original source observation required');
  assert.deepEqual(event.participantIds,ids,'Exact distinct league-specific participant IDs and order required');
  assert.deepEqual((event.participants||[]).map(p=>p.id),ids);
  assert.deepEqual(event.participants.map(p=>p.name||p.displayName),labels);
  assert.deepEqual(event.participants.map(p=>p.role),['home','away'],'Sourced home/away roles required');
  assert.equal(sides.length,2);
  assert.deepEqual(sides.map(s=>s.participant?.id),ids);
  assert.deepEqual(sides.map(s=>s.label),labels);
  for(const side of sides)assert.equal(side.mark,null,'An absent optional crest cannot conceal a referenced/broken image or assert fabricated artwork');
  for(const participant of [...event.participants,...(event.participantSlots||[])]){
    for(const field of ['logoUrl','logoDarkUrl','crestUrl','imageUrl','logo','crest'])assert(!participant[field],'Referenced artwork must pass normal image checks, not the text-only allowance');
  }
  return true;
}
module.exports={applies,assertEligible};
