#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),model=require('../config/tennis-feed'),{completeFinalEight}=require('../lib/tennis-parent-completion');
const catalogue=require('../data/canonical/tennis-catalogue-2026.json'),ties=require('../data/canonical/tennis-team-contests.v1.json').fixtures;
const parent=model.buildParents(catalogue,ties).find(p=>p.tournamentId==='tournament:tennis:bjk-cup-finals-2026');
const {teamParentCategory}=require('../lib/tennis-parent-category'),policy=require('../config/follow-feed-policy');
const categoryParent=teamParentCategory(parent);
assert.equal(categoryParent.id,parent.id);assert.equal(policy.sportKey(categoryParent),'tennis-women');
assert.equal(policy.sportKey(teamParentCategory(model.buildParents(catalogue,ties).find(p=>p.eventFamilyId==='davis-cup'))),'tennis');
for(const mutate of [p=>p.childContests=[],p=>delete p.childContests[0].gender,p=>p.childContests[0].gender='men',p=>p.tour='BOTH']){const next=structuredClone(parent);mutate(next);assert.equal(teamParentCategory(next),next,'No complete uniform team evidence means no inferred category');}
assert.equal(teamParentCategory({...parent,gender:'mixed'}).gender,'mixed','Explicit source category remains authoritative');
const completed=completeFinalEight(categoryParent);assert.equal(completed.status,'completed');assert.equal(completed.id,parent.id);assert.equal(completed.childContests.length,7);assert.match(completed.dateLabel,/Completed/);assert.equal(completed.statusEvidence.fixtureIds.length,7);assert(!completed.outcomeText&&!completed.score,'Completion does not reveal the winner');
for(const mutate of [p=>p.childContests.pop(),p=>p.childContests[0].status='upcoming',p=>delete p.childContests[0].result,p=>p.childContests[0].result.sourceUrl='',p=>p.childContests[0].winnerParticipantId='unknown',p=>p.childContests[0].bracketSlot='final',p=>p.tour='ATP']){const next=structuredClone(parent);mutate(next);assert.equal(completeFinalEight(next).status,'upcoming');}
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const visible=(date,preferences)=>buildServerFeed({events:[completed],userId:'test',userState:{preferences},now:new Date(date+'T02:00:00Z'),limit:1000}).events.some(e=>e.id===completed.id);
const followed={followFirst:{followedMajorEventIds:['billie-jean-king-cup']}};
assert(visible('2026-09-30',followed),'Explicit completed parent retains the ordinary seven-day window');assert(!visible('2026-10-06',followed),'Completed parent expires from Feed without deleting history');
assert(!visible('2026-09-30',{followFirst:{followedMajorEventIds:['billie-jean-king-cup'],excludedMajorEventIds:['billie-jean-king-cup']}}),'Explicit exclusions still win');
const build=require('./build-code-inspector');
const feed=require('../data/events.json').events;
for(const id of ['evt_81','evt_82','evt_83']){const summary=feed.find(e=>e.id===id);assert(summary);assert(build.obsoleteProgramme(summary));}
const grandFinal=require('../data/code-inspector/nrl.json').fixtures.find(e=>e.id==='evt_84'||e.sourceEventIds?.includes('evt_84'));
assert(grandFinal,'The actual NRL Grand Final retains its action alias');
assert(!build.obsoleteProgramme(grandFinal),'The actual NRL Grand Final remains a fixture');
const legacyOverviews=feed.filter(e=>e.cardType==='tournament_overview'&&catalogue.tournaments.some(t=>t.tournamentId===e.tennisTournamentId&&t.season&&t.sourceUrl));
assert(legacyOverviews.length,'Exercise a currently published legacy overview');
for(const overview of legacyOverviews)assert(build.obsoleteProgramme(overview));
assert(!build.obsoleteProgramme({cardType:'tournament_overview',tennisTournamentId:'unknown'}),'No known replacement means preserve legacy overview');
if(process.argv.includes('--published')){
 const nrl=require('../data/code-inspector/nrl.json').fixtures,tennis=require('../data/code-inspector/tennis.json').fixtures;
 for(const id of ['evt_81','evt_82','evt_83'])assert(!nrl.some(f=>f.id===id));
 assert(nrl.some(f=>f.id==='evt_84'||f.sourceEventIds?.includes('evt_84')),'Grand Final retains its legacy action alias');
 assert.equal(tennis.filter(f=>f.id.startsWith('fixture:tennis:bjk-cup:2026:finals:')).length,7);
 for(const overview of legacyOverviews)assert(!tennis.some(f=>f.id===overview.id),'Known sourced parents replace legacy daily overviews');
 for(const overview of legacyOverviews)assert(require('../data/event-overviews.v1.json').events.some(e=>e.fixtureIds.includes(overview.id)),'Events metadata survives individual Schedule reconciliation');
 assert.equal(require('../data/tennis-feed-parents.v1.json').parents.find(p=>p.id===parent.id).status,'completed');
 assert.equal(require('../config/follow-feed-policy').sportKey(require('../data/tennis-feed-parents.v1.json').parents.find(p=>p.id===parent.id)),'tennis-women','BJK parent has the same women’s category as its seven ties');
}
console.log('Programme reconciliation: complete bracket evidence, stable parent identity, retained ties and exclusion of replaced summary rows passed.');
