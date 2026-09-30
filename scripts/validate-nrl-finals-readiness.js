'use strict';
const assert = require('node:assert/strict');
const {readFinalsEvidence, assessFinals} = require('./lib/pilot-finals-readiness');
const {applyOfficialResults} = require('./sync-official-card-results');
const {buildReadinessReport} = require('./verify-pilot-readiness');
const evidence = readFinalsEvidence();
const now = new Date('2026-09-30T03:00:00Z');
const report = assessFinals(evidence, now, 6);
assert.deepEqual(report.issues, []);
assert.equal(report.fixtureCount, 9);
assert.equal(report.dueCount, 8);
const weekOne = evidence.published.find(event => event.id.endsWith('elimination-final-2'));
assert.equal(weekOne.status, 'completed');
assert.equal(weekOne.homeScore, 10);
assert.equal(weekOne.awayScore, 20);
for (const mutate of [
  e => {e.published.find(x => x.id === weekOne.id).status = 'scheduled';},
  e => {e.published.find(x => x.id === weekOne.id).homeScore++;},
  e => {e.published.find(x => x.id === weekOne.id).sourceUrl = 'https://example.com';},
  e => {e.published = e.published.filter(x => x.id !== weekOne.id);},
  e => {e.published.push({...weekOne});},
  e => {e.published.find(x => x.id === weekOne.id).participantIds.reverse();},
  e => {e.published.find(x => x.id === weekOne.id).startTimeUtc = '2026-09-10T00:00:00Z';},
  e => {e.schedules = [];},
  e => {e.results = [];},
]){
  const changed = structuredClone(evidence); mutate(changed);
  assert(assessFinals(changed, now, 6).issues.length, 'bad finals evidence cannot pass');
}
assert(assessFinals(undefined, now, 6).issues.length, 'absent scope must fail closed');
const unresolvedFinal = structuredClone(evidence);
unresolvedFinal.published.find(event => (event.sourceEventIds || []).includes('major-match:nrl-finals-2026:grand-final')).status = 'scheduled';
unresolvedFinal.results = unresolvedFinal.results.filter(event => !/grand-final|evt_84/.test(event.id));
assert.equal(assessFinals(unresolvedFinal, new Date('2026-10-05T00:00:00Z'), 6).overdueResults.length, 1, 'Grand Final becomes due without inventing a result');
const result = evidence.results.find(event => event.id.endsWith('elimination-final-2'));
for (const event of [{id:weekOne.id}, {id:'preserved-user-action-id', sourceEventIds:[result.id]}, {id:result.id}]){
  const applied = applyOfficialResults([{...event, status:'scheduled'}], {checkedAt:'2026-09-15T00:00:00Z', results:[result]}).events[0];
  assert.equal(applied.id, event.id, 'retain action identity');
  assert.equal(applied.status, 'completed');
  assert.equal(applied.awayScore, 20);
}
assert.equal(applyOfficialResults([{id:'unrelated', name:weekOne.name, status:'scheduled'}], {results:[result]}).events[0].status,'scheduled','names alone never join results');
const canonical = require('../data/canonical/afl-nrl-2026.json');
const feedMeta = require('../data/feed-meta.json');
const stale = structuredClone(evidence);
stale.published.find(x => x.id === weekOne.id).status = 'scheduled';
const readiness = buildReadinessReport({canonical, feedMeta, finals:stale, now:new Date(feedMeta.publishedAt)});
assert.equal(readiness.ready, false, 'completed regular season cannot hide stale finals');
assert.equal(readiness.overdueResultCount, 1);
console.log('NRL finals: nine slots, eight sourced results, identity-preserving joins and missing/stale/corrupt evidence rejection passed.');
