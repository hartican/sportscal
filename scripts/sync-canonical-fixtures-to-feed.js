#!/usr/bin/env node

const {
  normalizeFeed,
  readJson,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");
const {
  spoilerSafeRootCopy,
  storylineFor,
} = require("./lib/storyline-card-rules");
const canonicalSportsTaxonomy = require("../config/canonical-sports-taxonomy.js");

const DEFAULT_LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function sanitizeSportKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveSportDomainLabel(value, fallback) {
  return String(value || fallback || "").trim() || fallback || "Sport";
}

function buildTaxonomySportDetails() {
  const details = new Map();
  (canonicalSportsTaxonomy?.sportDomains || []).forEach(domain => {
    if (!domain?.id) return;
    details.set(domain.id, {
      key: sanitizeSportKey(domain.slug || domain.id),
      label: deriveSportDomainLabel(domain.name, domain.slug || domain.id),
    });
  });
  (canonicalSportsTaxonomy?.specialEventDomains || []).forEach(domain => {
    if (!domain?.id) return;
    const label = deriveSportDomainLabel(domain.name, domain.id);
    const key = sanitizeSportKey((domain.canonicalSportKeys || [])[0] || domain.slug || label);
    details.set(domain.id, { key, label });
  });
  return details;
}

const TAXONOMY_SPORT_DETAILS = buildTaxonomySportDetails();

function buildSportDetails(canonicalBundle) {
  const details = new Map();
  (canonicalBundle?.sportDomains || []).forEach(domain => {
    if (!domain?.id) return;
    const key = sanitizeSportKey(domain.slug || domain.id);
    details.set(domain.id, {
      key,
      label: deriveSportDomainLabel(domain.name, domain.slug || key),
    });
  });
  TAXONOMY_SPORT_DETAILS.forEach((item, domainId) => {
    if (!details.has(domainId)) details.set(domainId, item);
  });
  return details;
}

function getSportDetailsForFixture(fixture, sportDetailsByDomainId) {
  return sportDetailsByDomainId.get(fixture.sportDomainId)
    || {
      key: sanitizeSportKey(fixture.sportDomainId),
      label: deriveSportDomainLabel(fixture.sportDomainId, "Sport"),
    };
}

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

function canonicalFixtureCardPriority(card){
  let score = 0;
  if (card.status === "completed") score += 12;
  if (card.sourceType === "official") score += 6;
  if (card.sourceType === "reputable") score += 3;
  if (card.sourceCheckedAt && Number.isFinite(Date.parse(card.sourceCheckedAt))) score += 2;
  if (card.canonicalSourceCheckedAt && Number.isFinite(Date.parse(card.canonicalSourceCheckedAt))) score += 2;
  if (card.score) score += 2;
  if (card.outcomeText) score += 1;
  if (card.recapText) score += 1;
  if (card.sourceName) score += 1;
  if (card.sourceUrl) score += 1;
  return score;
}

function betterCanonicalFixtureCard(left, right){
  const leftScore = canonicalFixtureCardPriority(left);
  const rightScore = canonicalFixtureCardPriority(right);
  if (leftScore !== rightScore) return leftScore >= rightScore ? left : right;

  const leftChecked = Date.parse(left.lastReviewedAt || left.sourceCheckedAt || left.canonicalSourceCheckedAt || "");
  const rightChecked = Date.parse(right.lastReviewedAt || right.sourceCheckedAt || right.canonicalSourceCheckedAt || "");
  if (Number.isFinite(rightChecked) && Number.isFinite(leftChecked) && rightChecked !== leftChecked) {
    return rightChecked > leftChecked ? right : left;
  }

  return `${left.id}`.localeCompare(`${right.id}`) <= 0 ? left : right;
}

function routineFixtureIdentity(card){
  const venue = String(card.venue || "").toLowerCase().replace(/\s+/g, " ").trim();
  const fallbackParticipants = Array.isArray(card.participants)
    ? card.participants.map(participant => String(participant.name || "").toLowerCase().replace(/\s+/g, " ").trim())
    : [];
  const participants = Array.isArray(card.matchupParticipants)
    ? card.matchupParticipants.map(participant => String(participant.name || "").toLowerCase().replace(/\s+/g, " ").trim())
    : fallbackParticipants;
  const normalizedName = String(card.name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const cleanedName = normalizedName
    .split(/\s+/)
    .filter(token => token && token.length <= 35)
    .join(" ");
  return [
    card.key || "",
    card.date || "",
    card.time || "",
    venue,
    participants.filter(Boolean).sort().join("|"),
    cleanedName,
  ].join("|");
}

function dedupeRegularSeasonFixtureCards(events){
  const retained = new Map();
  const removed = [];
  const noMatchOrder = [];

  events.forEach(card => {
    if (!card || card.narrativeType !== "regular-season-fixture") {
      noMatchOrder.push(card);
      return;
    }

    const key = card.canonicalEventId
      ? `canonical:${card.canonicalEventId}`
      : `signature:${routineFixtureIdentity(card)}`;

    const existing = retained.get(key);
    if (!existing) {
      retained.set(key, card);
      return;
    }

    const next = betterCanonicalFixtureCard(existing, card);
    if (next === existing) {
      removed.push({ retained: existing.id, removed: card.id, key: card.canonicalEventId || key });
      return;
    }

    retained.set(key, card);
    removed.push({ retained: card.id, removed: existing.id, key: card.canonicalEventId || key });
  });

  const dedupedRoutineCards = new Map();
  retained.forEach((event, key) => {
    if (!key.startsWith("canonical:")) {
      const signature = key.replace(/^signature:/, "");
      dedupedRoutineCards.set(signature, event);
      return;
    }
    dedupedRoutineCards.set(key, event);
  });

  const deduped = [...noMatchOrder];
  events.forEach(card => {
    if (!card || card.narrativeType !== "regular-season-fixture") return;
    if (card.canonicalEventId) {
      if (dedupedRoutineCards.get(`canonical:${card.canonicalEventId}`) === card) deduped.push(card);
      return;
    }
    const signature = routineFixtureIdentity(card);
    if (dedupedRoutineCards.get(signature) === card) deduped.push(card);
  });

  return { events: deduped, removed };
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

function isSameFixture(card, fixture, sportDetailsByDomainId){
  const sport = getSportDetailsForFixture(fixture, sportDetailsByDomainId);
  if (card.key && card.key !== sport.key) return false;
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
    id: item.id,
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
    roundLabel: fixture.roundLabel || null,
    stage: fixture.stage || null,
    isInternational: fixture.competitionScope === "international" || fixture.isInternational === true,
    competitionScope: fixture.competitionScope || (fixture.isInternational === true ? "international" : "domestic"),
    representativeCountryCodes: Array.from(new Set([
      ...(Array.isArray(fixture.representativeCountryCodes) ? fixture.representativeCountryCodes : []),
      fixture.homeRepresentingCountryCode,
      fixture.awayRepresentingCountryCode,
    ].filter(Boolean))),
    broadcasterIds: fixture.broadcasters.map(item => item.broadcasterId.replace(/^broadcaster:/, "")),
    scheduleStatus: fixture.scheduleStatus,
    ...(fixture.status === "completed" && fixture.result?.scorelineText
      ? { canonicalResultScoreline: fixture.result.scorelineText }
      : {}),
  };
}

function completedCanonicalResult(fixture, participantsById){
  if (fixture.status !== "completed" || !fixture.result?.scorelineText) return null;
  const scoreMatch = fixture.result.scorelineText.match(/—\s*(\d+)-(\d+)$/);
  if (!scoreMatch) return null;
  const homeScore = Number(scoreMatch[1]);
  const awayScore = Number(scoreMatch[2]);
  const homeName = participantsById.get(fixture.homeParticipantId)?.displayName
    || participantsById.get(fixture.homeParticipantId)?.canonicalName
    || fixture.homeParticipantId;
  const awayName = participantsById.get(fixture.awayParticipantId)?.displayName
    || participantsById.get(fixture.awayParticipantId)?.canonicalName
    || fixture.awayParticipantId;
  const draw = homeScore === awayScore;
  const homeWon = homeScore > awayScore;
  const winner = draw ? null : homeWon ? homeName : awayName;
  const loser = draw ? null : homeWon ? awayName : homeName;
  const winnerScore = homeWon ? homeScore : awayScore;
  const loserScore = homeWon ? awayScore : homeScore;
  const margin = Math.abs(homeScore - awayScore);
  const source = fixture.result.source || fixture.source || {};
  const sourceCheckedAt = source.checkedAt || fixture.updatedAt;
  const outcomeText = draw
    ? `${homeName} and ${awayName} drew ${homeScore}-${awayScore}.`
    : `${winner} defeated ${loser} ${winnerScore}-${loserScore}.`;
  const recapText = draw
    ? `${fixture.displayName} finished level at ${homeScore}-${awayScore} in ${fixture.roundLabel}.`
    : `${fixture.displayName} finished ${homeScore}-${awayScore} in ${fixture.roundLabel}, with ${winner} winning by ${margin} points.`;
  const consensusResult = draw
    ? { summary: outcomeText, marginText: "Draw" }
    : { winner, loser, summary: outcomeText, marginText: `${winner} by ${margin}` };
  return {
    status: "completed",
    homeScore,
    awayScore,
    selectedSentence: `${fixture.displayName} is complete; the key moments are protected until you choose to reveal them.`,
    fullSpiel: `${fixture.displayName} is complete. The defining moments and result-aware recap are ready when you are, without giving anything away here.`,
    score: fixture.result.scorelineText,
    outcomeText,
    recapText,
    resultLabels: [fixture.roundLabel, draw ? "Draw" : `${winner} by ${margin}`, "Verified result"],
    consensusResult,
    sourceName: source.provider || fixture.source?.provider || "Official match centre",
    sourceUrl: source.sourceUrl || fixture.source?.sourceUrl,
    sourceCheckedAt,
    sourceType: source.sourceType === "reputable" ? "reputable" : "official",
    lastReviewedAt: sourceCheckedAt,
  };
}

function normalizeCompletedStoryline(card){
  if (!card.storyline) return card;
  const storyline = storylineFor(card);
  const rootCopy = spoilerSafeRootCopy(card, storyline);
  return {
    ...card,
    selectedSentence: rootCopy.hook,
    fullSpiel: rootCopy.synopsis,
    storyline,
  };
}

function applyCompletedCanonicalResult(card, fixture, participantsById){
  const result = completedCanonicalResult(fixture, participantsById);
  if (!result) return { ...card, ...canonicalMetadata(fixture) };
  const cardHasResult = card.status === "completed"
    && card.score
    && card.outcomeText
    && card.recapText
    && card.sourceName
    && card.sourceUrl
    && card.sourceCheckedAt;
  const canonicalResultChanged = card.canonicalResultScoreline
    && card.canonicalResultScoreline !== fixture.result.scorelineText;
  if (cardHasResult && !canonicalResultChanged){
    return normalizeCompletedStoryline({ ...card, ...canonicalMetadata(fixture) });
  }
  const next = {
    ...card,
    ...result,
    ...canonicalMetadata(fixture),
  };
  delete next.editorialPreview;
  return normalizeCompletedStoryline(next);
}

function fixtureToCard(fixture, participantsById, sportDetailsByDomainId){
  const sport = getSportDetailsForFixture(fixture, sportDetailsByDomainId);
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
  const sportDetailsByDomainId = buildSportDetails(canonicalBundle);
  const publishedAt = options.publishedAt || new Date().toISOString();
  const basisTime = Date.parse(publishedAt);
  const participantsById = new Map(canonicalBundle.participants.map(item => [item.id, item]));
  const canonicalById = new Map(canonicalBundle.events.map(event => [event.id, event]));
  const fixtures = canonicalBundle.events.filter(event =>
    sportDetailsByDomainId.has(event.sportDomainId)
    && event.status === "scheduled"
    && event.startTimeUtc
    && Date.parse(event.startTimeUtc) + DEFAULT_LIVE_WINDOW_MS >= basisTime
  );
  const completedFixtures = canonicalBundle.events.filter(event =>
    sportDetailsByDomainId.has(event.sportDomainId)
    && event.status === "completed"
    && event.startTimeUtc
    && Date.parse(event.startTimeUtc) + COMPLETED_RETENTION_MS >= basisTime
  );
  const activeFixtureIds = new Set(fixtures.map(event => event.id));
  const scheduledCanonicalIds = new Set(canonicalBundle.events
    .filter(event => sportDetailsByDomainId.has(event.sportDomainId) && event.status === "scheduled")
    .map(event => event.id));
  const currentFeedEvents = feed.events.filter(card =>
    card.narrativeType !== "regular-season-fixture"
    || !scheduledCanonicalIds.has(card.canonicalEventId)
    || activeFixtureIds.has(card.canonicalEventId)
  );
  const matchedCanonicalIds = new Set();
  let completedResultsUpdated = 0;
  const preservedEvents = currentFeedEvents.map(card => {
    const exactFixture = canonicalById.get(card.canonicalEventId);
    if (exactFixture?.status === "completed"){
      matchedCanonicalIds.add(exactFixture.id);
      const next = applyCompletedCanonicalResult(card, exactFixture, participantsById);
      if (next.status === "completed" && card.status !== "completed") completedResultsUpdated += 1;
      return next;
    }
    const fixture = fixtures.find(candidate => {
      if (matchedCanonicalIds.has(candidate.id)) return false;
      return isSameFixture(card, candidate, sportDetailsByDomainId);
    });
    if (fixture){
      matchedCanonicalIds.add(fixture.id);
      const sport = getSportDetailsForFixture(fixture, sportDetailsByDomainId);
      const local = sydneyDateTime(fixture.startTimeUtc);
      return {
        ...card,
        name:fixture.displayName,
        displayTitleCompact:fixture.displayName,
        participants:participantRefs(fixture, participantsById),
        date:local.date,
        time:local.time,
        startTimeUtc:fixture.startTimeUtc,
        venue:[fixture.venueName, fixture.venueCity].filter(Boolean).join(", ") || card.venue || null,
        sport: sport.label,
        key: sport.key,
        ...canonicalMetadata(fixture),
      };
    }
    const completedFixture = completedFixtures.find(candidate => {
      if (matchedCanonicalIds.has(candidate.id)) return false;
      return isSameFixture(card, candidate, sportDetailsByDomainId);
    });
    if (!completedFixture) return card;
    matchedCanonicalIds.add(completedFixture.id);
    const next = applyCompletedCanonicalResult(card, completedFixture, participantsById);
    if (next.status === "completed" && card.status !== "completed") completedResultsUpdated += 1;
    return next;
  });
  const generatedEvents = fixtures
    .filter(fixture => !matchedCanonicalIds.has(fixture.id))
    .map(fixture => fixtureToCard(fixture, participantsById, sportDetailsByDomainId));
  const generatedCompletedEvents = completedFixtures
    .filter(fixture => !matchedCanonicalIds.has(fixture.id))
    .map(fixture => applyCompletedCanonicalResult(
      fixtureToCard(fixture, participantsById, sportDetailsByDomainId),
      fixture,
      participantsById
    ));
  const { events: rawEvents, removed: duplicateRemoved } = dedupeRegularSeasonFixtureCards([
    ...preservedEvents,
    ...generatedEvents,
    ...generatedCompletedEvents,
  ]);
  const events = rawEvents
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  const output = normalizeFeed({
    ...feed,
    version: options.version || feed.version || "nothingsport-afl-nrl-fixtures-2026-v1",
    publishedAt,
    sourceNote: options.sourceNote || feed.sourceNote || "Curated event cards plus official confirmed 2026 routine fixtures. Curated cards supersede routine imports for the same event.",
    events,
  });

  return {
    output,
    duplicateRemoved,
    summary: {
      eligible: fixtures.length,
      existingMatches: fixtures.length - generatedEvents.length,
      generated: generatedEvents.length,
      duplicateRemoved: duplicateRemoved.length,
      byKey: output.events.reduce((acc, event) => {
        if (event.key) acc[event.key] = (acc[event.key] || 0) + 1;
        return acc;
      }, {}),
      completedResultsUpdated,
      completedResultsGenerated: generatedCompletedEvents.length,
      supportedSportDomains: Array.from(sportDetailsByDomainId.keys()),
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
  if (summary.duplicateRemoved > 0) {
    console.log(`Deduped ${summary.duplicateRemoved} routine fixture duplicates while syncing ${canonicalPath}.`);
  }
  const errors = validateFeed(output);
  if (errors.length){
    console.error("Refusing to write invalid canonical fixture cards:");
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  writeJson(outputPath, output);
  console.log(`Synced ${summary.eligible} confirmed scheduled fixtures: ${summary.existingMatches} existing cards retained, ${summary.generated} routine cards added.`);
  console.log(`Projected ${summary.completedResultsUpdated} newly completed canonical results into existing cards.`);
  console.log(`Restored ${summary.completedResultsGenerated} recent completed canonical results inside the seven-day window.`);
  const keyTotals = Object.entries(summary.byKey)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
  console.log(`Feed totals: ${keyTotals || "none"}; all sports ${output.events.length}.`);
  console.log(outputPath);
}

if (require.main === module) main();

module.exports = {
  applyCompletedCanonicalResult,
  completedCanonicalResult,
  fixtureToCard,
  isSameFixture,
  normalizeCompletedStoryline,
  syncCanonicalFixtures,
  sydneyDateTime,
};
