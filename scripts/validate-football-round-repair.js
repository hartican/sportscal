'use strict';
const assert=require('node:assert/strict'),{footballRoundPlan}=require('../assets/js/follow-schedule-panel');
const fixtures=require('../data/code-inspector/football.json').fixtures;
const plan=footballRoundPlan(fixtures,'2026-10-06');
assert(plan.currentKey);const selected=plan.groups.find(g=>g.key===plan.currentKey);
assert(selected.fixtures.some(f=>f.date>='2026-10-06'&&!['completed','cancelled'].includes(f.status)));
assert(plan.groups.every(g=>new Set(g.fixtures.map(f=>[f.competitionId,f.season,f.stage,f.roundLabel].join('|'))).size===1),'competitions, editions and stages cannot merge under the same round name');
const [f]=fixtures;const sample=[{...f,competitionId:'a',competitionName:'A',roundLabel:'Matchday 1',date:'2026-10-06',status:'completed'},{...f,competitionId:'b',competitionName:'B',roundLabel:'Matchday 1',date:'2026-10-07',status:'upcoming'},{...f,competitionId:'a',competitionName:'A',roundLabel:'Matchday 10',date:'2026-10-05',status:'completed'}];
const controlled=footballRoundPlan(sample,'2026-10-06');assert.equal(controlled.groups.length,3);assert.equal(controlled.groups[0].fixtures[0].roundLabel,'Matchday 10','source chronology precedes numeric round order across seasons/competitions');assert.equal(controlled.groups.find(g=>g.key===controlled.currentKey).fixtures[0].competitionId,'b','today completed fixture is not current');
assert.equal(footballRoundPlan(sample.map(f=>({...f,status:'completed'})),'2026-10-10').currentKey,null,'no invented current round after completed calendar');
console.log('Football rounds: exact competition/season/stage grouping, source chronology, ongoing/next default and completed exclusion passed.');

const follow=require('../config/follow-first'),{buildServerFeed}=require('../lib/server-feed-pipeline'),policy=require('../config/follow-feed-policy');
for(const competitionId of ['competition:uefa-champions-league','competition:uefa-europa-league']){const fixture=fixtures.find(f=>f.competitionId===competitionId&&f.status==='upcoming'&&f.date>='2026-10-06');assert(fixture);const preferences={version:26,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'follow'}]}};assert(follow.reasonForEvent(fixture,preferences),'followed UEFA club admitted on client');assert(buildServerFeed({events:[fixture],userId:'qa',userState:{preferences},now:new Date('2026-10-06T07:00Z')}).events.some(f=>f.id===fixture.id),'same club admitted by shared server Feed');assert.equal(policy.eligibleForFollow(fixture,{competitionFollow:true}),false,'competition follow does not admit all league phase fixtures');assert.equal(policy.eligibleForFollow({...fixture,stage:'Final',roundLabel:'Final'},{competitionFollow:true}),true,'competition follow keeps championship highlights');}
console.log('UEFA actual source fixtures: followed clubs surface on both Feed owners; ordinary league-phase competition-only follows remain excluded.');
