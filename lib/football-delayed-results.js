'use strict';
// Facts from the delayed backup are never written into the ODbL provider dataset.
const document = require('../data/canonical/football-delayed-results.v1.json');
const ATTRIBUTION = 'Football data provided by the Football-Data.org API';
const PROVIDER = 'Football-Data.org';
function key(f) { return `${f.homeParticipantId}|${f.awayParticipantId}|${f.roundNumber}`; }
function apply(events, overlay = document) {
  const results = new Map((overlay.results || []).map(r => [r.fixtureId, r]));
  return events.map(event => {
    const r = results.get(String(event.id || event.eventId));
    if (!r || event.status === 'completed' || r.competitionId !== event.competitionId || key(r) !== key(event)
      || !Number.isSafeInteger(r.homeScore) || r.homeScore < 0 || !Number.isSafeInteger(r.awayScore) || r.awayScore < 0) return event;
    const participants = event.participants || [];
    const home = participants.find(p => p.role === 'home')?.name || participants[0]?.name;
    const away = participants.find(p => p.role === 'away')?.name || participants[1]?.name;
    const score = `${home} ${r.homeScore}-${r.awayScore} ${away}`;
    const updated={...event, status:'completed', homeScore:r.homeScore, awayScore:r.awayScore,
      result:{homeScore:r.homeScore,awayScore:r.awayScore},score,canonicalResultScoreline:score,
      outcomeText:`${home} ${r.homeScore}-${r.awayScore} ${away}.`,
      recapText:`Confirmed final result from a delayed backup: ${score}.`,
      resultSourceUrl:r.sourceUrl,resultSourceCheckedAt:r.sourceCheckedAt,scoreCheckedAt:r.sourceUpdatedAt,
      delayedResultSource:{provider:PROVIDER,attribution:ATTRIBUTION,sourceUrl:r.sourceUrl,checkedAt:r.sourceCheckedAt,updatedAt:r.sourceUpdatedAt},
      ...(event.sourceAttribution ? {} : {sourceAttribution:{provider:PROVIDER}}),
      replayEligible:true,highlightEligible:true,catchupEligible:true};
    if(updated.storyline){const rules=require('../scripts/lib/storyline-card-rules');updated.storyline=rules.storylineFor(updated);const safe=rules.spoilerSafeRootCopy(updated,updated.storyline);updated.selectedSentence=safe.hook;updated.fullSpiel=safe.synopsis;delete updated.editorialPreview;}
    return updated;
  });
}
function standings(rows, events, overlay = document) {
  const affected = new Set(apply(events,overlay).filter(e => e.delayedResultSource).map(e => e.competitionId));
  return rows.map(row => affected.has(row.competitionId) ? {...row,stale:true,staleNote:'Table awaits primary-source confirmation of delayed backup results.'} : row);
}
module.exports = {apply,standings,key,ATTRIBUTION,PROVIDER};
