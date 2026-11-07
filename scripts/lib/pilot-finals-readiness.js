'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const aliases = event => [event?.id, event?.eventId, event?.canonicalEventId, ...(event?.sourceEventIds || [])].filter(Boolean);
const STAGES = ['qualifying-final-1','qualifying-final-2','elimination-final-1','elimination-final-2','semi-final-1','semi-final-2','preliminary-final-1','preliminary-final-2','grand-final'];

function readFinalsEvidence(){
  const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const schedules = read('data/canonical/nrl-finals-published-2026.json').events;
  const supplemental = read('data/canonical/current-card-evidence-2026.json').fixtureOverrides
    .filter(event => /^major-match:nrl-finals-2026:/.test(event.canonicalId || '') && !schedules.some(schedule => aliases(schedule).includes(event.canonicalId)))
    .map(event => ({...event, id:event.canonicalId}));
  return {
    schedules: [...schedules, ...supplemental],
    published: read('data/code-inspector/nrl.json').fixtures,
    results: read('data/canonical/official-card-results-2026.json').results,
  };
}

function assessFinals(evidence, now, graceHours){
  const issues = [], fixtures = [], overdueResults = [];
  let dueCount = 0;
  for (const stage of STAGES){
    const id = `major-match:nrl-finals-2026:${stage}`;
    const problems = [];
    const schedules = (evidence?.schedules || []).filter(event => aliases(event).includes(id));
    const published = (evidence?.published || []).filter(event => aliases(event).includes(id));
    const expected = schedules[0], fixture = published[0];
    if (schedules.length !== 1) problems.push('missing or duplicate reviewed finals schedule');
    if (published.length !== 1) problems.push('missing or duplicate published finals card');
    if (expected && fixture){
      const start = Date.parse(fixture.startTimeUtc);
      if (!Number.isFinite(start) || start !== Date.parse(expected.startTimeUtc)) problems.push('kickoff differs from reviewed schedule');
      const participantIds = expected.participantIds || [];
      if (participantIds.length !== 2 || new Set(participantIds).size !== 2 || JSON.stringify(fixture.participantIds) !== JSON.stringify(participantIds)) problems.push('participants differ from reviewed schedule');
      if (fixture.scheduleStatus !== 'confirmed') problems.push('published schedule is not confirmed');
      // Require the result separately from the schedule: a new check timestamp
      // must never turn an old preview into evidence of a completed match.
      if (Number.isFinite(start) && start <= now.getTime() - graceHours * 3_600_000){
        dueCount++;
        const result = (evidence?.results || []).find(event => aliases(event).some(alias => alias === id || alias === id.replace(/^major-match:(nrl-finals-\d{4}):/, 'major-match-$1-')));
        const scoresPresent = result && [result.homeScore, result.awayScore].every(value => Number.isInteger(value) && value >= 0);
        const resultUrl=result?.resultSourceUrl||result?.sourceUrl,fixtureResultUrl=fixture.resultSourceUrl||fixture.sourceUrl;
        const observed=Date.parse(fixture.scoreCheckedAt||fixture.resultSourceCheckedAt||'');
        const independentDateValid=!result?.fixtureObservationSchema||(Number.isFinite(observed)&&observed>=start&&observed<=+now);
        const complete = fixture.status === 'completed' && result?.status === 'completed' && scoresPresent && independentDateValid
          && fixture.homeScore === result.homeScore && fixture.awayScore === result.awayScore
          && (fixture.resultSourceType||fixture.sourceType) === 'official' && fixtureResultUrl === resultUrl && /^https:\/\/www\.nrl\.com\//.test(resultUrl || '');
        if (!complete){
          problems.push('result is overdue or differs from reviewed official result');
          overdueResults.push({id, sport:'nrl', startTimeUtc:fixture.startTimeUtc, status:fixture.status || null});
        }
      }
    }
    issues.push(...problems.map(problem => `NRL ${id}: ${problem}.`));
    fixtures.push({id, complete:problems.length === 0, issues:problems});
  }
  return {fixtureCount:STAGES.length, completeFixtureCount:fixtures.filter(fixture => fixture.complete).length, dueCount, overdueResults, fixtures, issues};
}
module.exports = {readFinalsEvidence, assessFinals};
