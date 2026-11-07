#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const lifecycle=require('../config/editorial-lifecycle');
// Individually reconciled with UEFA's 26 August qualifying-results article.
const expected={
 'sabah-hapoel-second-leg':[5,2,true], 'lask-celtic-second-leg':[5,1,true],
 'bodo-nec-second-leg':[3,0,false], 'aek-levski-second-leg':[4,0,false],
 'viking-dinamo-second-leg':[3,1,false], 'celje-slovan-second-leg':[1,2,true],
 'lyon-fenerbahce-second-leg':[1,2,false],
};
const canonical=require('../data/canonical/uefa-champions-league-2026-27.json').phases[0].fixtures;
for(const [label,records] of [['canonical',canonical],['Inspector',require('../data/code-inspector/champions-league.json').fixtures],['Schedule',require('../data/follow-schedule/champions-league.json').fixtures]]){
 for(const [suffix,[home,away,aet]] of Object.entries(expected)){
  const id=`major-match:ucl-2026-27:${suffix}`;
  const matches=records.filter(f=>f.id===id);assert.equal(matches.length,1,`${label}: preserve exact identity ${id}`);
  const f=matches[0];assert.equal(f.status,'completed');assert.equal(f.homeScore,home);assert.equal(f.awayScore,away);
  assert.equal(f.outcomeText.includes('after extra time'),aet);
  assert.match(f.outcomeText,/aggregate \d+–\d+\./);
  assert.match(f.resultSourceUrl,/uefa\.com\/uefachampionsleague\/news\//);
  assert(Number.isFinite(Date.parse(f.resultSourceCheckedAt)));
  if(label==='Schedule')continue; // Lightweight schedule deliberately omits editorial fields.
  assert.equal(f.storyline.arcStage,'recap');
  assert.equal(f.storyline.hookSpoilerOff,`${f.name} is complete. Reveal results for the outcome.`);
  assert.equal(f.storyline.synopsisSpoilerOff,'','never inherit another match result');
  assert.equal(f.editorialNarrative.resultSignature,lifecycle.signature(f));
  assert.equal(lifecycle.copy(f,f.editorialNarrative,false).hook,f.storyline.hookSpoilerOff);
  assert.equal(lifecycle.copy(f,f.editorialNarrative,true).hook,f.outcomeText);
 }
}
console.log('Seven UCL qualifiers: sourced results, extra time, stable IDs and protected match-specific copy passed.');
