'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const identity=require('../config/fixture-identity'),actions=require('../config/event-action-identity'),follow=require('../config/follow-first');
const {curated,worldRugby}=require('./fixtures/bledisloe-reviewed-provider-pair.json');
const canonical=curated.id,aliases=[worldRugby.id,worldRugby.id.replace(/:/g,'-'),'fixture:rugby:ra:949627','fixture-rugby-ra-949627'];
for(const id of [canonical,...aliases])assert.equal(identity.canonicalFixtureId(id),canonical);
for(const rows of [[curated,worldRugby],[worldRugby,curated]]){
 const fixtures=identity.mergeOverlays(rows,[]);assert.equal(fixtures.length,1);const f=fixtures[0];
 assert.equal(f.id,canonical);assert.equal(f.startTimeUtc,'2026-10-17T05:00:00.000Z');assert.equal(f.time,'16:00');assert.equal(f.date,'2026-10-17');
 assert.deepEqual(f.participantIds,['team:rugby:wallabies','team:rugby:all-blacks']);assert(f.participants.every(p=>p.id));
 assert(['upcoming','scheduled'].includes(f.status));assert.equal(f.timingProvenance.checkedAt,'2026-10-02T08:24:46.814Z');assert.equal(f.timingProvenance.sourceUrl,'https://www.rugby.com.au/match-centre/3/2026/949627');
 assert([curated.sourceCheckedAt,worldRugby.sourceCheckedAt].includes(f.sourceCheckedAt));if(worldRugby.statusCheckedAt)assert.equal(f.statusCheckedAt,worldRugby.statusCheckedAt);
 for(const alias of aliases){assert(f.sourceEventIds.includes(alias));assert.equal(actions.resolveAction(f,{[alias]:{reminderRequested:true}}).action.reminderRequested,true);}
 assert(follow.reasonForEvent(f,{preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'follow'}]}}));assert(!follow.reasonForEvent(f,{preferenceGraph:{entityFollows:[{participantId:'team:rugby:wallabies',followLevel:'mute'}]}}));
 assert.deepEqual(follow.viewingOptions(f),[],'Archived unbound reviewed metadata cannot restore viewing claims');
 const viewing=require('../lib/reviewed-au-viewing').reviewedAuViewing(f);
 assert.deepEqual(follow.viewingOptions(viewing).map(o=>o.providerId),['nine-tv','nine','stan'],'Current post-identity review retains the exact supported destinations');
 assert.deepEqual(viewing.viewingOptions.map(o=>o.verifiedAt),f.viewingOptions.map(o=>o.verifiedAt),'Rebinding context preserves original rights observation dates');
 const other={...worldRugby,id:'another-rugby-match',eventId:'another-rugby-match',canonicalEventId:'another-rugby-match',sourceEventIds:[],startTimeUtc:'2026-11-17T05:45:00.000Z'};assert.equal(identity.mergeOverlays([f],[other]).length,2);
 const confirmed=identity.normalizeCore({...worldRugby,status:'completed',homeScore:0,awayScore:10,endTimeUtc:'2026-10-17T06:45:00.000Z',endTimeBasis:'confirmed',actualEndTimeUtc:'2026-10-17T06:45:00.000Z'});assert.equal(confirmed.endTimeUtc,'2026-10-17T06:45:00.000Z');assert.equal(confirmed.homeScore,0);
}
if(process.argv.includes('--published')){
 for(const file of ['data/code-inspector/rugby-union.json','data/follow-schedule/rugby-union.json']){
  const d=JSON.parse(fs.readFileSync(file)),matches=(d.fixtures||d.events||[]).filter(f=>[canonical,...aliases].includes(f.id));assert.equal(matches.length,1,file);assert.equal(matches[0].id,canonical);assert.equal(matches[0].startTimeUtc,'2026-10-17T05:00:00.000Z');assert.equal(matches[0].timingProvenance.checkedAt,'2026-10-02T08:24:46.814Z');
 }
 const f=require('../data/events.json').events.find(f=>f.id===canonical);assert.equal(f.startTimeUtc,'2026-10-17T05:00:00.000Z');
 const accepted=require('../data/canonical/current-card-evidence-2026.json').resultOverrides.find(row=>row.id===canonical);
 if(f.status==='completed'){
  const projection=require('./lib/accepted-result-projection');assert(projection.isAcceptedResult(accepted),'A published final requires its reviewed result capsule');
  projection.validateAcceptedProjection(f,accepted);assert.equal(f.sourceCheckedAt,accepted.sourceCheckedAt,'A genuine reviewed final keeps its own source observation');
 }else assert.equal(f.sourceCheckedAt,curated.sourceCheckedAt,'the reviewed host clock does not redate primary facts');
 const raw=require('../data/follow-sources/coverage.v1.json').events.find(f=>f.id===worldRugby.id);assert(raw,'original provider source identity retained');assert.equal(raw.startTimeUtc,'2026-10-17T05:00:00.000Z');assert(Date.parse(raw.sourceCheckedAt)>=Date.parse(worldRugby.sourceCheckedAt)&&Date.parse(raw.sourceCheckedAt)<=Date.now(),'genuine later primary observations are allowed, never stale/future dates');
}
console.log('Bledisloe identity: one reviewed fixture, five keys, host/DST time, original source observations, viewing/consent/actions and confirmed-end/zero-score continuity passed.');
