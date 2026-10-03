'use strict';

const assert = require('node:assert/strict');
const {validateSeasonReview} = require('./nrlw-season-review');
const COMPETITION = 'competition:nrlw-premiership-2026';
const SOURCE = 'https://www.nrl.com/ladder/?competition=161&season=2026';
const FIELDS = ['played','won','drawn','lost','byes','pointsFor','pointsAgainst','pointsDifference','ladderPoints'];

function regularSeasonTotals(season){
  validateSeasonReview(season);
  const totals = new Map(season.participants.map(p => [p.id, {
    participantId:p.id, displayName:p.displayName,
    played:0, won:0, drawn:0, lost:0, byes:0,
    pointsFor:0, pointsAgainst:0, pointsDifference:0, ladderPoints:0,
  }]));
  // Finals determine the champion, not the regular-season ladder.
  for(const fixture of season.fixtures.filter(f => f.roundNumber <= 11)){
    for(let side=0; side<2; side++){
      const row = totals.get(fixture.participantIds[side]);
      const scored = side === 0 ? fixture.homeScore : fixture.awayScore;
      const conceded = side === 0 ? fixture.awayScore : fixture.homeScore;
      row.played++; row.pointsFor += scored; row.pointsAgainst += conceded;
      if(scored > conceded) row.won++;
      else if(scored === conceded) row.drawn++;
      else row.lost++;
    }
  }
  for(const row of totals.values()){
    row.pointsDifference = row.pointsFor - row.pointsAgainst;
    row.ladderPoints = row.won * 2 + row.drawn;
  }
  return totals;
}

function validateLadderReview(context, season){
  const totals = regularSeasonTotals(season);
  assert.equal(context.schemaVersion, 'nrlw-ladder-context.v1');
  assert.equal(context.reviewKind, 'dated-official-final-regular-season-ladder');
  assert.equal(context.providerCompetitionId, 161);
  assert.equal(context.season, 2026); assert.equal(context.round, 11);
  const checkedAt = context.checkedAt;
  assert(typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt))
    && new Date(checkedAt).toISOString() === checkedAt && Date.parse(checkedAt) <= Date.now(), 'invalid observation');
  assert(season.fixtures.filter(f => f.roundNumber <= 11).every(f => Date.parse(f.sourceCheckedAt) <= Date.parse(checkedAt)), 'ladder observation predates comparison evidence');
  assert.equal(context.generatedAt, checkedAt, 'rebuilds do not renew the source clock');
  assert.deepEqual(context.events, [], 'ladder review cannot replace fixtures');
  assert.equal(context.sources.length, 1);
  assert.deepEqual(Object.keys(context.sources[0]).sort(), ['checkedAt','provider','sha256','sourceType','sourceUrl','status'].sort());
  assert.equal(context.sources[0].sourceUrl, SOURCE);
  assert.equal(context.sources[0].provider, 'NRL');
  assert.equal(context.sources[0].sourceType, 'official-provider');
  assert.equal(context.sources[0].status, 200);
  assert.equal(context.sources[0].checkedAt, checkedAt);
  assert(/^[a-f0-9]{64}$/.test(context.sources[0].sha256));
  assert.equal(context.competitions.length, 1);
  assert.equal(context.competitions[0].id, COMPETITION);
  assert.equal(context.competitions[0].preferenceDomainId, 'sport:nrlw');
  assert.equal(context.competitions[0].supportsLadder, true);
  assert.equal(context.participants.length, 12);
  assert.equal(new Set(context.participants.map(p => p.id)).size, 12);
  for(const participant of context.participants){
    assert.equal(participant.displayName, totals.get(participant.id)?.displayName);
    assert.equal(participant.sportDomainId, 'sport:nrlw', 'women’s teams cannot enter the men’s roster');
    assert.equal(participant.preferenceDomainId, 'sport:nrlw');
    assert.equal(participant.type, 'team');
  }
  assert.equal(context.ladderSnapshots.length, 1);
  const snapshot = context.ladderSnapshots[0];
  assert.equal(snapshot.id, 'ladder:nrlw-premiership-2026:round-11');
  assert.equal(snapshot.competitionId, COMPETITION);
  assert.equal(snapshot.seasonLabel, '2026');
  assert.equal(snapshot.roundLabel, 'Final regular-season ladder · Round 11');
  assert.equal(snapshot.snapshotTimeUtc, checkedAt);
  assert.deepEqual(snapshot.source, context.sources[0]);
  assert.equal(snapshot.metadata.rankSource, 'official-source-order');
  assert.equal(snapshot.metadata.representedThroughRound, 11);
  assert.equal(snapshot.metadata.completedMatches, 66);
  assert.equal(snapshot.metadata.finalRegularSeason, true);
  assert.equal(snapshot.entries.length, 12);
  assert.equal(new Set(snapshot.entries.map(row => row.participantId)).size, 12);
  for(const [index, row] of snapshot.entries.entries()){
    assert.deepEqual(Object.keys(row).sort(), ['participantId','displayName','rank',...FIELDS].sort(), 'unexpected or inferred ladder facts');
    assert.equal(row.rank, index + 1);
    assert.equal(row.displayName, totals.get(row.participantId)?.displayName);
    for(const field of FIELDS){
      assert(Number.isSafeInteger(row[field]), `invalid ${field}`);
      assert.equal(row[field], totals.get(row.participantId)?.[field], `${row.participantId}: ${field} disagrees with regular-season results`);
    }
    if(index){
      const previous = snapshot.entries[index-1];
      // This dated collection has no points/differential ties. Check its
      // agreement without adopting a general future tie-break rule.
      assert(previous.ladderPoints > row.ladderPoints ||
        (previous.ladderPoints === row.ladderPoints && previous.pointsDifference > row.pointsDifference), 'official order disagrees with this reviewed collection');
    }
  }
  return context;
}

function readLadderReview(){
  return validateLadderReview(require('../../data/canonical/nrlw-ladder-context-2026.json'), require('../../data/canonical/nrlw-season-review.v1.json'));
}

module.exports = {COMPETITION, SOURCE, FIELDS, regularSeasonTotals, validateLadderReview, readLadderReview};
