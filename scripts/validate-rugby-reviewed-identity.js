'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const identity=require('../config/fixture-identity'),actions=require('../config/event-action-identity'),follow=require('../config/follow-first');
const {curated,worldRugby}=require('./fixtures/rugby-reviewed-provider-pair.json');
const canonical=curated.id,aliases=[worldRugby.id,worldRugby.id.replace(/:/g,'-'),'fixture:rugby:ra:949625','fixture-rugby-ra-949625'];
const normalizeObservation=require('../lib/source-observation-identity').normalize;
const relabelled={...worldRugby,id:canonical,eventId:canonical,canonicalEventId:canonical,sourceName:'Rugby Australia official match centre'};
const recovered=normalizeObservation(relabelled);
assert.equal(recovered.id,worldRugby.id,'Reviewed source labels cannot erase the original discovery key');
assert.equal(recovered.canonicalEventId,canonical,'Restoring the raw key preserves canonical actions');
assert.equal(normalizeObservation({...relabelled,discoverySourceId:undefined}).id,canonical,'A different source without provider provenance cannot acquire a provider key');
assert.equal(normalizeObservation({...relabelled,sourceFixtureId:'00000000-0000-0000-0000-000000000000'}).id,canonical,'Unknown provider equivalence cannot be guessed');
for(const id of [canonical,...aliases])assert.equal(identity.canonicalFixtureId(id),canonical);
for(const collection of [[curated,worldRugby],[worldRugby,curated]]){
 const merged=identity.mergeOverlays(collection,[]);assert.equal(merged.length,1,'one exact fixture, either source order');
 const f=merged[0];assert.equal(f.id,canonical);assert.equal(f.startTimeUtc,'2026-09-27T09:45:00.000Z');assert.equal(f.time,'19:45');
 assert.equal(f.status,'completed');assert.equal(f.homeScore,42);assert.equal(f.awayScore,38);
 assert.deepEqual(f.participantIds,curated.participantIds);assert(f.participants.every(p=>p.id),'identified participants');
 assert.equal(f.endTimeUtc,'2026-09-27T12:45:00.000Z','estimated window follows reviewed host schedule');
 assert.equal(f.timingProvenance.sourceUrl,'https://www.rugby.com.au/match-centre/3/2026/949625');
 assert.equal(f.timingProvenance.checkedAt,'2026-10-02T01:36:47.809Z');
 assert.equal(f.scoreCheckedAt,worldRugby.scoreCheckedAt,'host time evidence does not refresh score observation');
 assert.equal(f.statusCheckedAt,worldRugby.statusCheckedAt,'status keeps its original source observation');
 assert([curated.sourceCheckedAt,worldRugby.sourceCheckedAt].includes(f.sourceCheckedAt),'collection date is an original observation');
 for(const alias of aliases){assert(f.sourceEventIds.includes(alias));assert.equal(actions.resolveAction(f,{[alias]:{reminderRequested:true}}).action.reminderRequested,true);}
 assert(follow.reasonForEvent(f,{preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'follow'}]}}));
 const muted={preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'mute'}]}};
 assert(!follow.reasonForEvent(f,muted),'no new Follow admission');
 const other={...worldRugby,id:'another-provider-fixture',eventId:'another-provider-fixture',canonicalEventId:'another-provider-fixture',sourceEventIds:[],startTimeUtc:'2026-11-15T09:30:00.000Z'};
 assert.equal(identity.mergeOverlays([f],[other]).length,2,'another match is distinct');
 const newEnd=identity.normalizeCore({...worldRugby,endTimeUtc:'2026-09-27T11:46:00.000Z',endTimeBasis:'confirmed',actualEndTimeUtc:'2026-09-27T11:46:00.000Z'});
 assert.equal(newEnd.endTimeUtc,'2026-09-27T11:46:00.000Z','confirmed end is never shifted');
}
const html=fs.readFileSync('index.html','utf8'),getter=html.slice(html.indexOf('function getActual('),html.indexOf('function actualStarValue(')),setter=html.slice(html.indexOf('function setEventRating('),html.indexOf('function archiveEvent('));
for(const legacy of aliases){
 const ctx={ratings:{[legacy]:5},NOTHINGSPORTS_FIXTURE_IDENTITY:identity,saveRatings(){},markSpoilerRevealed(){}};vm.createContext(ctx);vm.runInContext(getter+setter,ctx);
 assert.equal(ctx.getActual(canonical),5);ctx.setEventRating({id:canonical},4,{revealSpoilers:false});assert.equal(ctx.getActual(canonical),4);assert.equal(ctx.ratings[legacy],undefined);
}
if(process.argv.includes('--published')){
 for(const file of ['data/code-inspector/rugby-union.json','data/follow-schedule/rugby-union.json']){
  const data=JSON.parse(fs.readFileSync(file)),fixtures=data.fixtures||data.events||[];
  const matches=fixtures.filter(f=>[canonical,...aliases].includes(f.id));assert.equal(matches.length,1,file);
  assert.equal(matches[0].id,canonical);assert.equal(matches[0].startTimeUtc,'2026-09-27T09:45:00.000Z');
 }
 const records=require('../data/follow-sources/coverage.v1.json').events;
 const raw=records.find(f=>f.id===worldRugby.id);
 assert(raw,'coverage retains the original reviewed provider key');
 assert.equal(raw.canonicalEventId,canonical,'raw observations link to the reviewed action identity');
 const matches=records.filter(f=>identity.canonicalFixtureId(f.id)===canonical);
 const coverage=identity.mergeOverlays(matches,[]);
 assert.equal(coverage.length,1,'provider observations resolve to one canonical coverage fixture');
 assert.equal(coverage[0].id,canonical);
 assert.equal(coverage[0].startTimeUtc,'2026-09-27T09:45:00.000Z');
 for(const alias of aliases)assert(coverage[0].sourceEventIds.includes(alias),'reviewed alias retained: '+alias);
}
console.log('Rugby identity: exact source orders/IDs, host scheduling and separate original observations, no duplicate fixture, saved ratings/actions, Follow consent and confirmed-end preservation passed.');
