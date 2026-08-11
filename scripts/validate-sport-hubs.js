#!/usr/bin/env node

const assert = require("node:assert/strict");
const hub = require("../config/sport-hubs");
const canonical = require("../data/canonical/afl-nrl-2026.json");
const published = require("../data/events.json");

const feedEvents = Array.isArray(published) ? published : published.events;
const aflFixtures = hub.canonicalFixturesForSport(canonical, "afl");
const nrlFixtures = hub.canonicalFixturesForSport(canonical, "sport:nrl");

assert.equal(aflFixtures.length, canonical.events.filter(event => event.sportDomainId === "sport:afl").length, "AFL hub truth must come from every canonical AFL fixture");
assert.equal(nrlFixtures.length, canonical.events.filter(event => event.sportDomainId === "sport:nrl").length, "NRL hub truth must come from every canonical NRL fixture");

const syntheticRounds = [
  { id: "round-1-a", roundNumber: 1, roundLabel: "Round 1", status: "completed", startTimeUtc: "2026-03-01T01:00:00Z", displayName: "A v B" },
  { id: "round-2-a", roundNumber: 2, roundLabel: "Round 2", status: "completed", startTimeUtc: "2026-03-08T01:00:00Z", displayName: "C v D" },
  { id: "round-2-b", roundNumber: 2, roundLabel: "Round 2", status: "scheduled", startTimeUtc: "2026-03-09T01:00:00Z", displayName: "E v F" },
  { id: "round-3-a", roundNumber: 3, roundLabel: "Round 3", status: "scheduled", startTimeUtc: "2026-03-15T01:00:00Z", displayName: "G v H" },
];
assert.equal(hub.currentRoundNumber(syntheticRounds), 2, "current round must be the earliest round containing an unfinished fixture");
assert.equal(hub.currentRoundNumber(syntheticRounds.map(event => ({ ...event, status: "completed" }))), 3, "a completed season must use its latest completed round");
const openingRoundRegression = [
  { id: "opening", roundNumber: 0, roundLabel: "Opening Round", status: "completed" },
  { id: "round-1", roundNumber: 1, roundLabel: "Round 1", status: "scheduled" },
];
assert.equal(hub.normalizeSelectedRound(openingRoundRegression, null), 1, "a null hub selection must not coerce to AFL Opening Round zero");
assert.deepEqual(hub.roundWindow(syntheticRounds, 2).map(round => round.roundNumber), [2, 3], "All Fixtures must initially present a two-round window");
assert.deepEqual(hub.fixturesForRoundWindow(syntheticRounds, 2).map(event => event.id), ["round-2-a", "round-2-b", "round-3-a"], "the selected and following round must be returned together");
assert.equal(hub.moveRoundNumber(syntheticRounds, 2, -1), 1, "previous-round navigation must move within the supported season");
assert.equal(hub.moveRoundNumber(syntheticRounds, 2, 1), 3, "next-round navigation must move within the supported season");
assert.equal(hub.latestCompletedRoundNumber(syntheticRounds), 2, "results must default to the latest round containing a completed fixture");

const summaryFixtures = [
  { id: "summary-completed", roundNumber: 1, roundLabel: "Round 1", status: "completed", startTimeUtc: "2026-03-01T01:00:00Z", participantIds: ["team:one"] },
  { id: "summary-curated", roundNumber: 2, roundLabel: "Round 2", status: "scheduled", startTimeUtc: "2026-03-15T01:00:00Z", participantIds: ["team:two"] },
  { id: "summary-other", roundNumber: 2, roundLabel: "Round 2", status: "scheduled", startTimeUtc: "2026-03-15T03:00:00Z", participantIds: ["team:three"] },
  { id: "summary-muted", roundNumber: 2, roundLabel: "Round 2", status: "scheduled", startTimeUtc: "2026-03-16T01:00:00Z", participantIds: ["team:muted"] },
];
const offWeekSummary = hub.roundSummary(summaryFixtures, {
  curatedCanonicalIds: ["summary-curated", "summary-muted"],
  mutedParticipantIds: ["team:muted"],
  now: new Date("2026-03-10T01:00:00Z"),
});
assert.deepEqual(offWeekSummary, {
  roundNumber: 2,
  roundLabel: "Round 2",
  timingLabel: "next round",
  totalFixtureCount: 3,
  worthWatchingCount: 1,
  otherVisibleCount: 1,
  hiddenCount: 1,
}, "off-week round summaries must count curated, other visible, and explicitly muted fixtures separately");
assert.equal(
  hub.roundSummary(summaryFixtures, {
    curatedCanonicalIds: ["summary-curated"],
    now: new Date("2026-03-15T00:30:00Z"),
  }).timingLabel,
  "this round",
  "a round becomes this round on its first Sydney calendar day"
);

for (const [sportKey, fixtures] of [["afl", aflFixtures], ["nrl", nrlFixtures]]){
  const currentRound = hub.currentRoundNumber(fixtures);
  const initialWindow = hub.fixturesForRoundWindow(fixtures, currentRound);
  const expectedWindowIds = new Set(fixtures
    .filter(event => hub.roundWindow(fixtures, currentRound).some(round => round.roundNumber === event.roundNumber))
    .map(event => event.id));
  assert.equal(initialWindow.length, expectedWindowIds.size, `${sportKey.toUpperCase()} initial hub window must contain every canonical fixture in both rounds`);
  assert(initialWindow.every(event => expectedWindowIds.has(event.id)), `${sportKey.toUpperCase()} initial hub window cannot contain a non-canonical fixture`);
  const publishedIds = feedEvents
    .filter(event => event.key === sportKey)
    .map(event => event.canonicalEventId)
    .filter(Boolean);
  const summary = hub.roundSummary(fixtures, {
    curatedCanonicalIds: publishedIds,
    now: new Date("2026-08-11T02:00:00Z"),
  });
  const expectedSummaryCount = fixtures.filter(event => Number(event.roundNumber) === currentRound).length;
  assert.equal(summary.totalFixtureCount, expectedSummaryCount, `${sportKey.toUpperCase()} summary must count every canonical current-round fixture`);
  assert.equal(
    summary.worthWatchingCount + summary.otherVisibleCount + summary.hiddenCount,
    summary.totalFixtureCount,
    `${sportKey.toUpperCase()} summary buckets must account for the complete current round`
  );
}

const canonicalFixture = nrlFixtures.find(event => feedEvents.some(card => card.canonicalEventId === event.id));
assert(canonicalFixture, "a published NRL fixture must match canonical truth for merge testing");
const staleCard = {
  ...feedEvents.find(card => card.canonicalEventId === canonicalFixture.id),
  name: "Stale title",
  startTimeUtc: "2000-01-01T00:00:00Z",
  score: "Stale score",
  selectedSentence: "Editorial context survives.",
};
const merged = hub.canonicalFixtureView(canonicalFixture, {
  feedCards: [staleCard],
  participants: canonical.participants,
});
assert.equal(merged.event.name, canonicalFixture.displayName, "canonical fixture titles must override stale card facts");
assert.equal(merged.event.startTimeUtc, canonicalFixture.startTimeUtc, "canonical start times must override stale card facts");
assert.equal(merged.event.score, canonicalFixture.result?.scorelineText || null, "canonical results must override stale card results");
assert.equal(merged.event.selectedSentence, "Editorial context survives.", "published editorial enrichment must merge into the runtime fixture view");
assert.equal(merged.canonicalEvent.id, canonicalFixture.id, "fixture views must retain their canonical identity");

const mutedParticipantId = canonicalFixture.participantIds[0];
const partitioned = hub.partitionMutedFixtures([merged], [mutedParticipantId]);
assert.equal(partitioned.visible.length, 0, "explicitly muted participant fixtures must be hidden by default");
assert.equal(partitioned.hiddenCount, 1, "hidden fixture counts must remain visible to the hub");
assert.equal(hub.partitionMutedFixtures([merged], [mutedParticipantId], { showHidden: true }).visible.length, 1, "Show hidden must reveal muted fixtures temporarily");
assert.deepEqual(merged.replayProviders, hub.broadcasterNames(canonicalFixture, "replay"), "replay availability must name only source-backed canonical providers");

console.log(`Sport hubs valid: ${aflFixtures.length} AFL fixtures, ${nrlFixtures.length} NRL fixtures, deterministic round windows, mutes, enrichment merge, and replay providers.`);
