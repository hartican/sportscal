#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const {COMPETITION,SOURCE,validateLadderReview,readLadderReview} = require('./lib/nrlw-ladder-review');
const context = readLadderReview(), season = read('data/canonical/nrlw-season-review.v1.json');
for(const [label,mutate] of [
  ['wrong competition',c=>c.providerCompetitionId=111],
  ['wrong season',c=>c.season=2027], ['finals round',c=>c.round=14],
  ['partial table',c=>c.ladderSnapshots[0].entries.pop()],
  ['duplicate team',c=>c.ladderSnapshots[0].entries[1]=c.ladderSnapshots[0].entries[0]],
  ['men’s identity',c=>c.ladderSnapshots[0].entries[0].participantId='team:nrl:331'],
  ['changed score totals',c=>c.ladderSnapshots[0].entries[0].pointsFor++],
  ['string points',c=>c.ladderSnapshots[0].entries[0].ladderPoints='22'],
  ['invalid rank',c=>c.ladderSnapshots[0].entries[0].rank=0],
  ['inferred qualification',c=>c.ladderSnapshots[0].entries[0].qualified=true],
  ['wrong source',c=>c.sources[0].sourceUrl='https://example.test/ladder'],
  ['invalid clock',c=>c.checkedAt='2026-02-30T00:00:00.000Z'],
  ['future clock',c=>c.checkedAt='2099-01-01T00:00:00.000Z'],
  ['renewed rebuild clock',c=>c.generatedAt='2026-10-03T19:00:00.000Z'],
  ['renewed snapshot clock',c=>c.ladderSnapshots[0].snapshotTimeUtc='2026-10-03T19:00:00.000Z'],
  ['men’s roster contamination',c=>c.participants[0].sportDomainId='sport:nrl'],
  ['fixture replacement',c=>c.events=[season.fixtures.at(-1)]],
]){
  const changed=structuredClone(context);mutate(changed);
  assert.throws(()=>validateLadderReview(changed,season),undefined,label);
}
const snapshot=context.ladderSnapshots[0], chunk=read('data/code-inspector/nrlw.json');
assert.equal(chunk.fixtures.length,71);assert.equal(chunk.coverageStatus,'partial');
assert.equal(chunk.standings.length,12);
for(const [index,row] of chunk.standings.entries()){
  const {competitionId,competitionName,asOf,roundLabel,tableNote,sourceUrl,...facts}=row;
  assert.deepEqual(facts,snapshot.entries[index]);assert.equal(competitionId,COMPETITION);
  assert.equal(asOf,context.checkedAt);assert.equal(roundLabel,snapshot.roundLabel);
  assert.equal(tableNote,snapshot.metadata.tableNote);assert.equal(sourceUrl,SOURCE);
}
assert.equal(read('data/code-inspector/manifest.json').codes.find(c=>c.id==='sport:nrlw').hasStandings,true);
const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'data/canonical/contexts.js'),'utf8'),sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.NOTHINGSPORTS_CANONICAL_CONTEXTS.nrlwContext)),context);
const merged=require('../config/sport-context').mergeCanonicalBundles(...Object.values(sandbox.NOTHINGSPORTS_CANONICAL_CONTEXTS));
assert.deepEqual(merged.ladderSnapshots.find(s=>s.competitionId===COMPETITION),snapshot);
assert.equal(merged.participants.filter(p=>p.sportDomainId==='sport:nrl'&&p.type==='team'&&p.metadata?.active!==false).length,
  read('data/canonical/afl-nrl-2026.json').participants.filter(p=>p.sportDomainId==='sport:nrl'&&p.type==='team'&&p.metadata?.active!==false).length,'men’s canonical roster remains separate');
const packed=require('./build-app-shell-runtime').cardStandings().find(s=>s.competitionId===COMPETITION);
assert.deepEqual(packed.entries,snapshot.entries.map(({participantId,rank})=>({participantId,rank})));
assert.equal(packed.snapshotTimeUtc,context.checkedAt);
const html=require('./app-shell-test-utils').readFollowApplicationSource();
assert(html.includes('["nrlwContext", "data/canonical/nrlw-ladder-context-2026.json"]'),'hosted fallback and direct-file context sources agree');
assert(require('../config/canonical-sports-taxonomy').competitions.find(c=>c.id===COMPETITION).supportsLadder);
console.log('NRLW ladder: all 12 official rows / 66 regular-season matches agree; 17 rejected corruptions, published Code/context/card parity, fixed clocks, separate identities and partial coverage pass.');
