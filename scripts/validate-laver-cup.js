'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),adapter=require('./refresh-laver-cup'),follow=require('../config/follow-first'),timeline=require('../config/feed-timeline');
const html=fs.readFileSync(process.argv[2]||'scripts/fixtures/laver-cup-2026.html','utf8');
const fixtures=adapter.parse(html,{participants:require('../data/canonical/tennis-context-2026.json').participants,checkedAt:'2026-09-27T00:00:00Z'});
assert.equal(fixtures.length,8);assert.equal(adapter.parse(html+html).length,8);
const e=fixtures.find(e=>e.id.endsWith('ms202'));assert(e);assert.equal(e.status,'completed');assert.equal(e.timePrecision,'follows');assert.equal(e.startTimeUtc,null);assert.equal(e.sessionStartTimeUtc,'2026-09-26T12:00:00.000Z');
assert.equal(e.name,'Alexander Zverev v Alex de Minaur');
assert(fixtures.every(f=>f.participants.every(p=>p.name.trim().split(/\s+/).length>=2&&!/^View\b/.test(p.name))));
assert.equal(e.sets[2].home,9);assert.equal(e.sets[2].away,11);assert.equal(e.sets[2].matchTiebreak,true);
assert(e.score.includes('[9-11]'));
assert(e.score.includes('6(5)-7(7)'),'retain both source-side tiebreak point totals');
assert.equal(require('../config/card-results').tennisSets(e,e.name,{score:e.score}).sets.at(-1).label,'Match TB');
assert(e.participantIds.includes('competitor:tennis:atp:alex-de-minaur'));assert(e.participantIds.includes('competitor:tennis:atp:alexander-zverev'));
assert.equal(timeline.status(e,new Date('2026-09-27T00:00:00Z')),'past');
for(let i=0;i<3;i++){e.status=timeline.normalizedStatus(e,new Date('2026-09-27T00:00:00Z'));assert.equal(e.status,'completed');assert.equal(timeline.status(e),'past');}
for(const participantId of e.participantIds){const prefs={followedSports:[],preferenceGraph:{entityFollows:[{participantId,followLevel:'follow'}]}};assert(follow.reasonForEvent(e,prefs));assert(!follow.reasonForEvent(e,{...prefs,followFirst:{excludedMajorEventIds:['laver-cup']}}));}
assert(!follow.reasonForEvent(e,{followedSports:['tennis']}));assert(!follow.reasonForEvent(e,{}));
for(const participantId of e.participantIds){
 const preferences={preferenceGraph:{entityFollows:[{participantId,followLevel:'follow'}]}};
 const resolved=require('../lib/follow-fixture-resolver').resolveUserFollowFixtures({events:[],userState:{preferences}});
 assert(resolved.events.some(f=>f.id===e.id),'server resolver includes canonical Laver fixtures');
 const page=require('../lib/server-feed-pipeline').buildServerFeed({events:resolved.events,userId:'synthetic-laver',userState:{preferences},now:new Date('2026-09-27T06:00:00Z'),limit:1000});
 assert(page.events.some(f=>f.id===e.id),'either player admits the completed match on the server');
}
const doubles=fixtures.find(f=>f.eventType==='doubles');assert.equal(doubles.participantIds.length,4);assert.equal(doubles.matchupSides.length,2);assert(doubles.date==='2026-09-27'||doubles.date==='2026-09-26');
assert.throws(()=>adapter.parse('<html>unavailable</html>'),/no published/);
console.log('Laver Cup: eight fixtures, deduplication, canonical identities, follows/exclusions, source-side sets and Sydney sessions passed.');
