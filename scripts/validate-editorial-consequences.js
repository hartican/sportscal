#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { buildQueue } = require("./build-editorial-research-queue.js");
const { build:buildRollingEditorial } = require("./update-rolling-editorial-projections.js");
const {
  editorialNarrativeFor,
  indexesFor,
  projectionForTarget,
  validateKnowledge,
} = require("./lib/editorial-narrative.js");
const {
  consequenceBody,
  enrich,
  ensureResultProvenance,
  eventStart,
  resultAwareConsequence,
  validateSnapshotRecord,
} = require("./enrich-editorial-consequences.js");
const { completedCanonicalResult } = require("./sync-canonical-fixtures-to-feed.js");
const {
  editorialConsequenceReadyForCard,
  editorialNarrativeReadyForCard,
} = require("../config/enrichment-engine.js");
const finalsCodePhases = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-finals-2026.json", "utf8"));

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }

const knowledge = readJson("data/editorial-knowledge.v1.json");
const consequences = readJson("data/editorial-consequences.v1.json");
const canonical = readJson("data/canonical/afl-nrl-2026.json");
const incoming = readJson("feeds/incoming/events.json");
const published = readJson("data/events.json");
const majorEvents = readJson("data/major-events.v1.json");
const signals = readJson("data/editorial-nothingscore-snapshot.v1.json");
const eventSchema = readJson("schemas/event-feed.schema.json");
const consequenceSchema = readJson("schemas/editorial-consequences.schema.json");
const majorSchema = readJson("schemas/major-events.schema.json");
const html = fs.readFileSync("index.html", "utf8");

assert.equal(consequences.schemaVersion, "editorial-consequences.v1", "consequence snapshots need a versioned canonical document");
assert.equal(consequenceSchema.properties.schemaVersion.const, consequences.schemaVersion, "the consequence data and schema versions must agree");
assert.deepEqual(validateKnowledge(knowledge), [], "consequence-enriched editorial knowledge must retain complete provenance");
assert.deepEqual(eventSchema.$defs.editorialNarrative.properties.schemaVersion.enum, ["editorial-narrative.v1", "editorial-narrative.v2", "editorial-narrative.v3"], "readers must retain v1/v2 compatibility while accepting v3");
assert(eventSchema.$defs.editorialNarrative.properties.consequence, "v3 must expose the editorial consequence contract");

const warriorsEvent = incoming.events.find(event => event.name === "Warriors v Knights");
const publishedWarriors = published.events.find(event => event.name === "Warriors v Knights");
const canonicalWarriors = canonical.events.find(event => event.id === "event:nrl:129992607");
const warriorsRecord = consequences.consequences.find(record => record.targetIds.includes("event-nrl-129992607"));
const warriorsProjection = projectionForTarget(knowledge, "feed-event", warriorsEvent);
assert(canonicalWarriors && warriorsEvent && publishedWarriors && warriorsRecord && warriorsProjection, "Warriors v Knights needs a complete canonical source, snapshot, projection and publication path");
assert.equal(canonicalWarriors.status, "completed", "the release cannot retain the verified Warriors v Knights result as scheduled");
assert.equal(canonicalWarriors.result?.scorelineText, "Warriors v Knights — 46-32", "the canonical acceptance case must retain the verified 46-32 result");
assert.equal(warriorsEvent.status, "completed", "the incoming Warriors card must publish the completed result");
assert.equal(publishedWarriors.status, "completed", "the released Warriors card must publish the completed result");
assert.deepEqual([warriorsEvent.homeScore, warriorsEvent.awayScore], [46, 32], "the incoming result must retain both canonical scores");
assert.deepEqual([publishedWarriors.homeScore, publishedWarriors.awayScore], [46, 32], "the published result must retain both canonical scores");
assert.equal(warriorsEvent.outcomeText, "Warriors defeated Knights 46-32.", "the incoming result must name the verified winner and score");
assert.equal(publishedWarriors.outcomeText, warriorsEvent.outcomeText, "publication must retain the exact result sentence");
assert.match(warriorsRecord.spoilerOnSentence || "", /^Warriors defeated Knights 46-32\./, "spoilers on must begin with the verified result");
assert.match(warriorsRecord.spoilerOnSentence || "", /For Warriors,[\s\S]*for Knights,/i, "the acceptance result must explain the effect on both teams");
assert.match(warriorsRecord.spoilerOnSentence || "", /Warriors needed[\s\S]*Knights needed/i, "the acceptance result must preserve why both teams needed to win");
assert(warriorsRecord.resultFactIds?.length && warriorsRecord.resultSourceIds?.length, "the acceptance result needs result-specific fact and source provenance");
assert.deepEqual(validateSnapshotRecord(warriorsRecord, { knowledge, event:warriorsEvent }), [], "the first consequence snapshot must be fully sourced");
assert(Date.parse(warriorsRecord.capturedAt) <= eventStart(warriorsEvent), "pre-match needs must be frozen before kickoff");
assert.match(warriorsRecord.previewSentence, /^If Warriors win,/i, "the preview must lead with the clearest verified consequence");
assert.doesNotMatch(warriorsRecord.previewSentence, /if Knights win/i, "the preview sentence must stay led by the one clearest verified consequence");
assert.equal(warriorsRecord.participants.length, 2, "the frozen structured needs must still cover both teams");
assert.match(warriorsRecord.previewSentence, /chance/i, "unsettled seeding must remain conditional");
assert.doesNotMatch(warriorsRecord.previewSentence, /Roosters/i, "no unverified semi-final opponent may be asserted");
warriorsRecord.participants.forEach(participant => {
  ["win", "draw", "loss"].forEach(outcome => {
    const state = participant.outcomes[outcome];
    assert(state.factIds.length && state.sourceIds.length, `${participant.name} ${outcome} needs fact and source provenance`);
    if (state.certainty === "conditional") assert(state.dependsOn, `${participant.name} ${outcome} must name its unresolved dependency`);
  });
});

assert.equal(warriorsEvent.editorialNarrative.schemaVersion, "editorial-narrative.v3", "the incoming Warriors card must emit v3");
assert.equal(publishedWarriors.editorialNarrative.schemaVersion, "editorial-narrative.v3", "the published Warriors card must emit v3");
assert.deepEqual(warriorsEvent.editorialNarrative.consequence, consequenceBody(warriorsRecord), "the feed must publish the immutable snapshot without recomputing it");
assert.deepEqual(publishedWarriors.editorialNarrative.consequence, consequenceBody(warriorsRecord), "publication must retain the exact immutable snapshot");

const indexes = indexesFor(knowledge);
const legacyProjection = knowledge.eventProjections.find(projection => !projection.consequence);
assert.equal(editorialNarrativeFor(legacyProjection, indexes).schemaVersion, "editorial-narrative.v2", "unenriched projections must remain readable v2 during migration");
assert.equal(editorialNarrativeFor(warriorsProjection, indexes).schemaVersion, "editorial-narrative.v3", "enriched projections must emit v3");
assert(editorialNarrativeReadyForCard(published.events.find(event => event.editorialNarrative?.schemaVersion === "editorial-narrative.v2")?.editorialNarrative), "validated researched v2 editorial must remain visible while consequences are backfilled");
assert(editorialNarrativeReadyForCard(publishedWarriors.editorialNarrative), "v3 editorial must remain visible independently of its consequence sentence");
assert(editorialConsequenceReadyForCard(publishedWarriors.editorialNarrative), "the fully sourced v3 consequence must remain visible");
assert.match(html, /ENRICHMENT_ENGINE\?\.editorialNarrativeReadyForCard\?\.\(narrative\)/, "the UI must use the shared compatibility predicate");
assert.match(html, /ENRICHMENT_ENGINE\?\.editorialConsequenceReadyForCard\?\.\(narrative\)/, "the UI must gate only the optional consequence through the shared predicate");

const refreshedKnowledge = JSON.parse(JSON.stringify(knowledge));
const refreshedFeed = JSON.parse(JSON.stringify(incoming));
buildRollingEditorial({
  knowledge:refreshedKnowledge,
  feed:refreshedFeed,
  context:canonical,
  f1:readJson("data/canonical/f1-context-2026.json"),
  reference:new Date("2026-08-30T00:08:03.244Z"),
});
assert.equal(projectionForTarget(refreshedKnowledge, "feed-event", warriorsEvent).consequence, undefined, "the generated rolling stage should not pretend to reconstruct the frozen snapshot");
enrich({ knowledge:refreshedKnowledge, consequences:JSON.parse(JSON.stringify(consequences)), feed:refreshedFeed, majorEvents:JSON.parse(JSON.stringify(majorEvents)) });
assert.equal(projectionForTarget(refreshedKnowledge, "feed-event", warriorsEvent).consequence.capturedAt, warriorsRecord.capturedAt, "the post-depth consequence stage must restore the original pre-kickoff capture unchanged");

const completedBase = {
  ...warriorsEvent,
  status:"completed",
  sourceCheckedAt:"2026-08-30T07:00:00.000Z",
  canonicalSourceCheckedAt:"2026-08-30T07:00:00.000Z",
};
const canonicalParticipants = new Map([
  ["team:nrl:321", { displayName:"Warriors" }],
  ["team:nrl:325", { displayName:"Knights" }],
]);
function projectedCompletedEvent(homeScore, awayScore){
  const result = completedCanonicalResult({
    status:"completed",
    displayName:"Warriors v Knights",
    roundLabel:"Round 26",
    homeParticipantId:"team:nrl:321",
    awayParticipantId:"team:nrl:325",
    updatedAt:"2026-08-30T07:00:00.000Z",
    source:{
      provider:"NRL Match Centre / Champion Data",
      sourceUrl:"https://www.nrl.com/draw",
      sourceType:"official-provider",
      checkedAt:"2026-08-30T07:00:00.000Z",
    },
    result:{
      status:"completed",
      scorelineText:`Warriors v Knights — ${homeScore}-${awayScore}`,
      spoilerLevel:"sensitive",
    },
  }, canonicalParticipants);
  return { ...completedBase, ...result };
}

const {
  spoilerOnSentence:_storedSpoilerOnSentence,
  resultCapturedAt:_storedResultCapturedAt,
  resultFactIds:_storedResultFactIds,
  resultSourceIds:_storedResultSourceIds,
  ...pregameConsequence
} = consequenceBody(warriorsRecord);

const projectedHomeWin = projectedCompletedEvent(24, 18);
assert.equal(projectedHomeWin.homeScore, 24, "canonical completion must project the home score for consequence enrichment");
assert.equal(projectedHomeWin.awayScore, 18, "canonical completion must project the away score for consequence enrichment");
const homeWin = resultAwareConsequence(projectedHomeWin, pregameConsequence);
assert.equal(homeWin.capturedAt, warriorsRecord.capturedAt, "a result refresh must never rewrite the pre-kickoff snapshot time");
assert.equal(homeWin.previewSentence, warriorsRecord.previewSentence, "a result refresh must never rewrite the spoiler-off If sentence");
assert.match(homeWin.spoilerOnSentence, /^Warriors defeated Knights 24-18\./, "spoilers on must begin with the verified result");
assert.match(homeWin.spoilerOnSentence, /For Warriors,[\s\S]*for Knights,/i, "result copy must explain the effect on both teams");
assert.match(homeWin.spoilerOnSentence, /Warriors needed[\s\S]*Knights needed/i, "result copy must retain why both teams needed to win");
const resultKnowledge = JSON.parse(JSON.stringify(knowledge));
const sourcedHomeWin = ensureResultProvenance(projectedHomeWin, homeWin, resultKnowledge);
assert(sourcedHomeWin.resultFactIds.length && sourcedHomeWin.resultSourceIds.length, "spoiler-on consequences must add result-specific fact and source provenance");
assert(resultKnowledge.narrativeFacts.some(fact => sourcedHomeWin.resultFactIds.includes(fact.id)), "the verified result must become a traceable consequence fact");
assert(resultKnowledge.sources.some(source => sourcedHomeWin.resultSourceIds.includes(source.id)), "the verified result must retain its canonical source");

const awayWin = resultAwareConsequence(projectedCompletedEvent(12, 18), pregameConsequence);
assert.match(awayWin.spoilerOnSentence, /For Warriors,[\s\S]*for Knights,/i, "an away win must still cover both teams");
const draw = resultAwareConsequence(projectedCompletedEvent(18, 18), pregameConsequence);
assert.match(draw.spoilerOnSentence, /dependent on other results[\s\S]*dependent on the remaining results/i, "a draw must use each team's draw consequence without inventing a winner");

const queue = buildQueue({ knowledge, feed:incoming, majorEvents, signals, reference:new Date("2026-08-30T00:00:00.000Z") });
const warriorsQueue = queue.entries.find(entry => entry.title === "Warriors v Knights");
assert.equal(warriorsQueue?.consequenceCoverage, "covered", "Warriors v Knights must leave the consequence research queue");
assert(queue.entries.some(entry => entry.consequenceResearchRequired), "unresearched consequences must remain visibly queued instead of receiving filler");
assert.equal(queue.consequenceMigration.covered + queue.consequenceMigration.queued, queue.entries.length, "the consequence migration summary must account for every researched target");

const nrlFinals = finalsCodePhases.phases.find(phase => phase.codeId === "sport:nrl");
const bracket = nrlFinals?.bracketProgression;
assert.equal(bracket?.schemaVersion, "bracket-progression.v1", "the NRL finals need structured progression");
assert.equal(majorSchema.$defs.event.properties.bracketProgression.$ref, "#/$defs/bracketProgression", "the major-event schema must publish bracket progression");
assert(nrlFinals.sources.some(source => source.url === bracket.sourceUrl), "bracket progression must retain its official source in the parent audit data");
const subEventIds = new Set(nrlFinals.fixtures.map(event => event.id));
assert.deepEqual(new Set(bracket.matches.map(match => match.matchId)), subEventIds, "every NRL finals match must have one structured progression record");
bracket.matches.forEach(match => {
  [match.winner, match.loser].forEach(destination => {
    if (destination.status === "advances") assert(subEventIds.has(destination.nextMatchId), `${match.matchId} must advance to a canonical match id`);
    else assert.equal(destination.nextMatchId, undefined, `${match.matchId} terminal outcomes must not invent a destination`);
  });
});
const qf1 = bracket.matches.find(match => match.matchId.endsWith(":qualifying-final-1"));
assert(qf1.winner.nextMatchId.endsWith(":preliminary-final-1") && qf1.loser.nextMatchId.endsWith(":semi-final-1"), "QF1 progression must be data, not parsed from its display label");
const ef1 = bracket.matches.find(match => match.matchId.endsWith(":elimination-final-1"));
assert.equal(ef1.loser.status, "eliminated", "elimination-final losses must be structurally terminal");

console.log(`Editorial consequences valid: ${consequences.consequences.length} immutable v3 backfill, ${queue.consequenceMigration.queued} source-research items queued, and ${bracket.matches.length} NRL bracket outcomes structured.`);
