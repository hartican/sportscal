'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { refresh: sourceRefresh } = require('./refresh-openligadb-football');
const refresh=options=>sourceRefresh({...options,backupOptions:{directory:path.dirname(options.outputPath),outputPath:options.outputPath+'.overlay',coordinator:async()=>{throw Error('Backup disabled in primary continuity rehearsal');}}});
const { COMPETITIONS } = require('./lib/openligadb-football');
const published = require('../data/providers/openligadb/football-2026-27.json');

// Replay the retained, validated season through the actual source owner. These
// are continuity assertions, not an independent sporting accuracy comparison.
function providerMatches(league, shortcut) {
  return league.fixtures.map(fixture => ({
    matchID: Number(fixture.providerFixtureId),
    leagueId: COMPETITIONS[shortcut].leagueId,
    leagueShortcut: shortcut,
    leagueSeason: 2026,
    group: { groupOrderID: fixture.roundNumber },
    matchDateTimeUTC: fixture.startTimeUtc,
    team1: { teamId: Number(fixture.participants[0].providerId), teamName: fixture.participants[0].sourceName },
    team2: { teamId: Number(fixture.participants[1].providerId), teamName: fixture.participants[1].sourceName },
    location: { locationStadium: fixture.venue, locationCity: fixture.venueCity },
    matchIsFinished: fixture.status === 'completed',
    matchResults: fixture.status === 'completed' ? [{ resultTypeID: 2, resultTypeKind: 'After90Minutes', pointsTeam1: fixture.result.homeScore, pointsTeam2: fixture.result.awayScore }] : [],
  }));
}

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-european-continuity-'));
  const outputPath = path.join(directory, 'facts.json');
  const input = Object.fromEntries(Object.entries(COMPETITIONS).map(([shortcut, definition]) => [shortcut, providerMatches(published.leagues.find(l => l.competitionId === definition.competitionId), shortcut)]));
  const baseTime = new Date(Math.max(...published.leagues.map(l => Date.parse(l.checkedAt))) + 3600000);
  let calls = 0;
  const fetchFor = data => async url => {
    calls++;
    const shortcut = Object.keys(COMPETITIONS).find(key => url.includes(`/${key}/`));
    assert(shortcut, 'only the existing two season endpoints are requested');
    return { ok: true, json: async () => structuredClone(data[shortcut]) };
  };
  try {
    const initial = await refresh({ outputPath, now: baseTime, fetchImpl: fetchFor(input) });
    assert.equal(initial.failures.length, 0);
    assert.equal(calls, 2);
    const saved = fs.readFileSync(outputPath, 'utf8');
    const first = initial.payload.leagues.find(l => l.competitionId === COMPETITIONS.ucl.competitionId);
    const completed = input.ucl.find(m => m.matchIsFinished);
    assert(completed, 'the retained current season supplies a confirmed completed match');
    const current = first.fixtures.find(f => f.providerFixtureId === String(completed.matchID));

    async function rejectedCase(label, mutate, now = new Date(+baseTime + 60000)) {
      fs.writeFileSync(outputPath, saved);
      const altered = structuredClone(input);
      mutate(altered);
      const result = await refresh({ outputPath, now, fetchImpl: fetchFor(altered) });
      const retained = result.payload.leagues.find(l => l.competitionId === first.competitionId);
      assert.deepEqual(retained, first, `${label}: retain all last-good facts and their original observation`);
      assert.equal(result.failures.some(f => f.league === 'ucl'), true, `${label}: exception remains visible`);
      if (+now >= +baseTime) {
        assert.equal(result.failures.length, 1, `${label}: unaffected competition still refreshes`);
        assert.equal(result.payload.leagues.find(l => l.competitionId === COMPETITIONS.uel2026.competitionId).checkedAt, now.toISOString());
      }
      return result;
    }

    await rejectedCase('terminal regression', data => {
      const match = data.ucl.find(m => m.matchID === completed.matchID);
      match.matchIsFinished = false;
      match.matchResults = [];
    });
    await rejectedCase('replacement identity', data => { data.ucl[0].matchID += 1000000000; });
    await rejectedCase('ID reused for a different matchup', data => {
      [data.ucl[0].matchID, data.ucl[1].matchID] = [data.ucl[1].matchID, data.ucl[0].matchID];
    });
    const backwards = await rejectedCase('older check', () => {}, new Date(+baseTime - 1));
    assert.equal(backwards.failures.length, 2, 'both earlier observations are rejected');
    assert.equal(fs.readFileSync(outputPath, 'utf8'), saved, 'total failure is a byte-for-byte no-op');

    fs.writeFileSync(outputPath, saved);
    const correction = structuredClone(input);
    const corrected = correction.ucl.find(m => m.matchID === completed.matchID);
    corrected.matchResults[0].pointsTeam1 = current.result.homeScore + 1;
    const correctedResult = await refresh({ outputPath, now: new Date(+baseTime + 60000), fetchImpl: fetchFor(correction) });
    assert.equal(correctedResult.failures.length, 0, 'a newly checked explicit final-score correction is accepted');
    assert.equal(correctedResult.payload.events.find(e => e.id.endsWith(`:${completed.matchID}`) && e.competitionId === first.competitionId).homeScore, current.result.homeScore + 1);

    fs.writeFileSync(outputPath, saved);
    const rescheduled = structuredClone(input);
    const future = rescheduled.ucl.find(m => !m.matchIsFinished && Date.parse(m.matchDateTimeUTC) > +baseTime);
    assert(future, 'season contains an upcoming fixture');
    future.matchDateTimeUTC = new Date(Date.parse(future.matchDateTimeUTC) + 3600000).toISOString();
    const rescheduledResult = await refresh({ outputPath, now: new Date(+baseTime + 60000), fetchImpl: fetchFor(rescheduled) });
    assert.equal(rescheduledResult.failures.length, 0, 'rescheduling the same participants preserves identity');
    assert.equal(rescheduledResult.payload.events.find(e => e.id.endsWith(`:${future.matchID}`) && e.competitionId === first.competitionId).startTimeUtc, future.matchDateTimeUTC);

    fs.writeFileSync(outputPath, saved);
    const reordered = Object.fromEntries(Object.entries(input).map(([key, matches]) => [key, [...matches].reverse()]));
    const reorderedResult = await refresh({ outputPath, now: new Date(+baseTime + 60000), fetchImpl: fetchFor(reordered) });
    assert.equal(reorderedResult.failures.length, 0, 'provider ordering is not sporting identity');
    assert.deepEqual(reorderedResult.payload.events.map(e => e.id), initial.payload.events.map(e => e.id));
    assert.equal(calls, 16, 'each of eight refreshes uses only the existing two provider requests');
    console.log('European source continuity: terminal results, stable identities, matchup ownership, observation order, visible partial failures, explicit score corrections and rescheduling passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
