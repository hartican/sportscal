#!/usr/bin/env node

const {
  normalizeFeed,
  readJson,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");

const SPORT_DETAILS = Object.freeze({
  "sport:afl": Object.freeze({ key: "afl", label: "AFL" }),
  "sport:nrl": Object.freeze({ key: "nrl", label: "NRL" }),
});
const DEFAULT_LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

function fixtureTokens(value){
  return new Set(String(value || "")
    .toLowerCase()
    .replace(/\bgreater western sydney\b/g, "gws")
    .replace(/\bcanberra\b/g, "")
    .replace(/\bnewcastle\b/g, "")
    .replace(/\bsouth sydney\b/g, "")
    .replace(/\bbrisbane\b/g, "")
    .replace(/\bgold coast\b/g, "goldcoast")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 2 && !["the", "versus"].includes(token)));
}

function sharedFixtureTokens(first, second){
  const firstTokens = fixtureTokens(first);
  const secondTokens = fixtureTokens(second);
  let shared = 0;
  firstTokens.forEach(token => {
    if (secondTokens.has(token)) shared += 1;
  });
  return shared;
}

function sydneyDateTime(startTimeUtc){
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(startTimeUtc))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function isSameFixture(card, fixture){
  const sport = SPORT_DETAILS[fixture.sportDomainId];
  if (!sport || card.key !== sport.key) return false;
  if (card.canonicalEventId === fixture.id) return true;
  if (card.startTimeUtc && Math.abs(Date.parse(card.startTimeUtc) - Date.parse(fixture.startTimeUtc)) < 5 * 60 * 1000) {
    return true;
  }
  const { date } = sydneyDateTime(fixture.startTimeUtc);
  return card.date === date && sharedFixtureTokens(card.name, fixture.displayName) >= 2;
}

function participantRefs(fixture, participantsById){
  return [
    { id: fixture.homeParticipantId, role: "home" },
    { id: fixture.awayParticipantId, role: "away" },
  ].map(item => ({
    name: participantsById.get(item.id)?.displayName || participantsById.get(item.id)?.canonicalName || item.id,
    role: item.role,
  }));
}

function canonicalMetadata(fixture){
  return {
    canonicalEventId: fixture.id,
    canonicalSourceId: fixture.sourceId,
    canonicalSourceName: fixture.source?.provider,
    canonicalSourceUrl: fixture.source?.sourceUrl,
    canonicalSourceCheckedAt: fixture.source?.checkedAt || fixture.updatedAt,
    canonicalSourceType: "official",
    sportDomainId: fixture.sportDomainId,
    competitionId: fixture.competitionId,
    participantIds: fixture.participantIds,
    homeParticipantId: fixture.homeParticipantId,
    awayParticipantId: fixture.awayParticipantId,
    broadcasterIds: fixture.broadcasters.map(item => item.broadcasterId.replace(/^broadcaster:/, "")),
    scheduleStatus: fixture.scheduleStatus,
  };
}

function fixtureToCard(fixture, participantsById){
  const sport = SPORT_DETAILS[fixture.sportDomainId];
  const { date, time } = sydneyDateTime(fixture.startTimeUtc);
  const broadcastOptions = fixture.broadcasters.map(item => item.broadcasterName);
  const venue = [fixture.venueName, fixture.venueCity].filter(Boolean).join(", ") || null;
  const sourceCheckedAt = fixture.source?.checkedAt || fixture.updatedAt;
  const selectedSentence = `${fixture.displayName} is scheduled for ${fixture.roundLabel} of the 2026 ${sport.label} season.`;
  const fullSpiel = `${fixture.displayName} is an upcoming ${sport.label} fixture${venue ? ` at ${venue}` : ""}. The official fixture time is shown in Sydney time, with confirmed streaming and broadcast options attached to this card.`;
  const id = fixture.id.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();

  return {
    id,
    eventId: id,
    sport: sport.label,
    key: sport.key,
    name: fixture.displayName,
    displayTitleCompact: fixture.displayName,
    date,
    time,
    startTimeUtc: fixture.startTimeUtc,
    broadcaster: broadcastOptions.join(" / ") || "Broadcast TBC",
    broadcastOptions,
    expected: 4,
    venue,
    liveWindow: 3,
    round: "all",
    narrativeType: "regular-season-fixture",
    status: "upcoming",
    participants: participantRefs(fixture, participantsById),
    selectedSentence,
    fullSpiel,
    sourceName: fixture.source?.provider || sport.label,
    sourceUrl: fixture.source?.sourceUrl,
    sourceCheckedAt,
    sourceType: "official",
    lastReviewedAt: sourceCheckedAt,
    replayEligible: fixture.broadcasters.some(item => item.replay),
    highlightEligible: fixture.broadcasters.some(item => item.highlights),
    briefingEligible: false,
    catchupEligible: fixture.broadcasters.some(item => item.replay),
    ...canonicalMetadata(fixture),
  };
}

function syncCanonicalFixtures(feed, canonicalBundle, options = {}){
  const publishedAt = options.publishedAt || new Date().toISOString();
  const basisTime = Date.parse(publishedAt);
  const participantsById = new Map(canonicalBundle.participants.map(item => [item.id, item]));
  const fixtures = canonicalBundle.events.filter(event =>
    SPORT_DETAILS[event.sportDomainId]
    && event.status === "scheduled"
    && event.startTimeUtc
    && Date.parse(event.startTimeUtc) + DEFAULT_LIVE_WINDOW_MS >= basisTime
  );
  const activeFixtureIds = new Set(fixtures.map(event => event.id));
  const scheduledCanonicalIds = new Set(canonicalBundle.events
    .filter(event => SPORT_DETAILS[event.sportDomainId] && event.status === "scheduled")
    .map(event => event.id));
  const currentFeedEvents = feed.events.filter(card =>
    card.narrativeType !== "regular-season-fixture"
    || !scheduledCanonicalIds.has(card.canonicalEventId)
    || activeFixtureIds.has(card.canonicalEventId)
  );
  const matchedCanonicalIds = new Set();
  const preservedEvents = currentFeedEvents.map(card => {
    const fixture = fixtures.find(candidate => !matchedCanonicalIds.has(candidate.id) && isSameFixture(card, candidate));
    if (!fixture) return card;
    matchedCanonicalIds.add(fixture.id);
    return {
      ...card,
      participants: card.participants || participantRefs(fixture, participantsById),
      ...canonicalMetadata(fixture),
    };
  });
  const generatedEvents = fixtures
    .filter(fixture => !matchedCanonicalIds.has(fixture.id))
    .map(fixture => fixtureToCard(fixture, participantsById));
  const events = [...preservedEvents, ...generatedEvents]
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  const output = normalizeFeed({
    ...feed,
    version: options.version || "nothingsports-afl-nrl-fixtures-2026-v1",
    publishedAt,
    sourceNote: "Curated event cards plus official confirmed 2026 AFL and NRL regular-season fixtures. Curated cards supersede routine imports for the same event.",
    events,
  });

  return {
    output,
    summary: {
      eligible: fixtures.length,
      existingMatches: matchedCanonicalIds.size,
      generated: generatedEvents.length,
      afl: output.events.filter(event => event.key === "afl").length,
      nrl: output.events.filter(event => event.key === "nrl").length,
    },
  };
}

function main(){
  const canonicalPath = process.argv[2] || "data/canonical/afl-nrl-2026.json";
  const inputPath = process.argv[3] || "feeds/incoming/events.json";
  const outputPath = process.argv[4] || inputPath;
  const canonicalBundle = readJson(canonicalPath);
  const feed = readJson(inputPath);
  const { output, summary } = syncCanonicalFixtures(feed, canonicalBundle);
  const errors = validateFeed(output);
  if (errors.length){
    console.error("Refusing to write invalid canonical fixture cards:");
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  writeJson(outputPath, output);
  console.log(`Synced ${summary.eligible} confirmed scheduled fixtures: ${summary.existingMatches} existing cards retained, ${summary.generated} routine cards added.`);
  console.log(`Feed totals: AFL ${summary.afl}; NRL ${summary.nrl}; all sports ${output.events.length}.`);
  console.log(outputPath);
}

if (require.main === module) main();

module.exports = {
  fixtureToCard,
  isSameFixture,
  syncCanonicalFixtures,
  sydneyDateTime,
};
