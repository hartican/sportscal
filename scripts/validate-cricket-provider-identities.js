'use strict';
const assert=require('node:assert/strict');
const identity=require('../config/fixture-identity'),follow=require('../config/follow-first'),preferences=require('../config/preference-system');
const actions=require('../config/event-action-identity');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const source=require('./fixtures/source-coverage/lancashire-durham-identities.json');
const caId='fixture:cricket:CA:39484',espnId='fixture:cricket:espn:1513451';
const ca=source.find(f=>f.id===caId),espn=source.find(f=>f.id===espnId);
const caTeam='team:cricket:ca-50',espnTeam='team:cricket:espn-1116';
assert(ca&&espn,'test requires retained source records');
for(const order of [[ca,espn],[espn,ca]]){
 const merged=identity.mergeOverlays([],order.map(identity.normalizeCore));assert.equal(merged.length,1);
 const f=merged[0];assert.equal(f.canonicalEventId,caId);assert.equal(f.status,'completed');assert.match(f.scoreDisplay,/draw/i);assert.deepEqual(new Set(f.participantIds),new Set([caTeam,'team:cricket:ca-40']));assert(f.sourceEventIds.includes(caId)&&f.sourceEventIds.includes(espnId));
 for(const id of [caTeam,espnTeam]){
  const prefs={preferenceGraph:{entityFollows:[{participantId:id,followLevel:'follow'}]}};
  for(const excluded of [caTeam,espnTeam]){const withdrawn={...f,excludedParticipantIds:[excluded]};assert.equal(follow.reasonForEvent(withdrawn,prefs),null);assert.equal(buildServerFeed({events:[withdrawn],userId:'fixture-alias-test',userState:{preferences:prefs},now:new Date('2026-09-30T00:00:00Z')}).events.length,0);}
  assert.equal(follow.effectiveParticipantFollow(caTeam,prefs).followed,false,'retired county follow removed');assert.equal(follow.reasonForEvent(f,prefs),null);
  assert(buildServerFeed({events:[f],userId:'fixture-alias-test',userState:{preferences:prefs},now:new Date('2026-09-30T00:00:00Z')}).events.length===0);
 }
 for(const id of [caId,espnId]){const action={dismissed:true,lastActionAt:'2026-09-29T00:00:00Z'};assert.equal(actions.resolveAction(f,{[id]:action}).action,action);}
 const old={dismissed:false,lastActionAt:'2026-09-28T00:00:00Z'},recent={dismissed:true,lastActionAt:'2026-09-29T00:00:00Z'};assert.equal(actions.resolveAction(f,{[caId]:old,[espnId]:recent}).action,recent);
}
const mixed={preferenceGraph:{entityFollows:[{participantId:espnTeam,followLevel:'unfollow'},{participantId:caTeam,followLevel:'follow'}]}};
assert.equal(follow.effectiveParticipantFollow(caTeam,mixed).followed,false);
const refollow=preferences.setEntityFollow(mixed.preferenceGraph,caTeam,'follow');assert.equal(refollow.entityFollows.length,1);assert.equal(follow.effectiveParticipantFollow(espnTeam,{preferenceGraph:refollow}).followed,false,'offline retired county refollow is pruned');
const removed=preferences.setEntityFollow(refollow,espnTeam,'unfollow');assert(!follow.effectiveParticipantFollow(caTeam,{preferenceGraph:removed}).followed);
for(const id of ['team:cricket:espn-1116-women','team:cricket:espn-1116-u19','team:cricket:espn-99999'])assert.equal(identity.canonicalParticipantId(id),id);
assert.equal(identity.canonicalFixtureId('fixture:cricket:espn:1513452'),'fixture:cricket:espn:1513452');
const nsc=require('../lib/nothingscore-server');assert.equal(nsc.canonicalEventId(espnId),caId);
if(process.argv.includes('--published')){assert.equal(nsc.eventFor(espnId).canonicalEventId,caId);assert.equal(nsc.eventFor(espnId).status,'completed');const map=require('../api/chat')._test.loadFixtureMap();assert.equal(map.get(espnId),map.get(caId));assert.equal(map.get(caId).status,'completed');}
const baseMerged=identity.mergeOverlays([ca,espn],[]);assert.equal(baseMerged.length,1);assert.equal(baseMerged[0].status,'completed');
if(process.argv.includes('--published'))for(const file of ['../data/code-inspector/cricket.json','../data/follow-schedule/cricket.json','../data/chat-fixtures.v1.json']){const d=require(file);const matching=(d.fixtures||d.events).filter(f=>[f.id,...(f.sourceEventIds||[])].some(id=>[caId,espnId].includes(id)));assert.equal(matching.length,1,file);assert.equal(matching[0].canonicalEventId||matching[0].eventId||matching[0].id,caId);assert.equal(matching[0].status,'completed');}
console.log('Cricket provider identities: one reviewed result in either source order; both Follow identities, refollow/unfollow, action history, rating request alias and distinct women/youth/other fixtures passed.');
