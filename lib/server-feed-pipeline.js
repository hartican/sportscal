"use strict";

const enrichmentEngine = require("../config/enrichment-engine");
const cardLifecycle = require("../config/card-lifecycle");

const SERVER_FEED_SCHEMA_VERSION = "server-feed.v1";
const SYDNEY_TIME_ZONE = "Australia/Sydney";
const MINIMUM_STAKES = 3;
const BROADCASTER_ALIASES = Object.freeze({
  kayo: ["kayo", "espn"],
  stan: ["stan sport"],
  sbs: ["sbs", "sbs on demand"],
  nine: ["nine", "9now"],
  foxtel: ["foxtel"],
  abc: ["abc"],
  seven: ["seven", "7plus"],
  ten: ["network 10", "10 play", "10 "],
  fis: ["fis broadcast"],
});

function clone(value){
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function plainObject(value, fallback = {}){
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function eventId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function eventActionKey(event){
  return `${eventId(event)}:${event.date}T${event.time}`;
}

function actionsByEventId(actions){
  return Object.values(plainObject(actions))
    .filter(action => action && typeof action === "object" && action.eventId)
    .reduce((index, action) => {
      index.set(String(action.eventId), action);
      return index;
    }, new Map());
}

function eventActionFor(event, actions, fallbackIndex = actionsByEventId(actions)){
  return plainObject(actions)[eventActionKey(event)]
    || fallbackIndex.get(eventId(event))
    || {};
}

function sydneyLocalDateToUtc(date, time){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !/^\d{2}:\d{2}$/.test(String(time || ""))) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let candidate = desiredUtc;
  for (let pass = 0; pass < 2; pass += 1){
    const parts = formatter.formatToParts(new Date(candidate)).reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = Number(part.value);
      return result;
    }, {});
    const representedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate += desiredUtc - representedUtc;
  }
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventStart(event){
  if (event?.startTimeUtc){
    const parsed = new Date(event.startTimeUtc);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return sydneyLocalDateToUtc(event?.date, event?.time || "00:00");
}

function eventEnd(event){
  if (event?.endTimeUtc){
    const parsed = new Date(event.endTimeUtc);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const start = eventStart(event);
  if (!start) return null;
  const hours = Number(event.liveWindow || event.calendarTemplate?.durationHours || 3);
  return new Date(start.getTime() + (Number.isFinite(hours) && hours > 0 ? hours : 3) * 60 * 60 * 1000);
}

function statusForEvent(event, now){
  const status = String(event?.status || "").toLowerCase();
  if (["cancelled", "abandoned"].includes(status)) return status;
  const start = eventStart(event);
  const end = eventEnd(event);
  if (!start || !end) return status || "scheduled";
  if (now < start) return "upcoming";
  if (now <= end) return "live";
  return "past";
}

function stakesScore(event){
  const storyline = Number(event?.storyline?.stakes);
  if (Number.isInteger(storyline) && storyline >= 1 && storyline <= 5) return storyline;
  const explicit = Number(event?.stakesScore);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const expected = Number(event?.expected ?? event?.recommendationScore ?? 0);
  if (expected >= 10) return 5;
  if (expected >= 8) return 4;
  if (expected >= 6) return 3;
  if (expected >= 4) return 2;
  return 1;
}

function broadcasterIds(event){
  if (Array.isArray(event?.broadcasterIds) && event.broadcasterIds.length) return event.broadcasterIds.slice();
  const text = [
    event?.broadcaster,
    ...(Array.isArray(event?.broadcastOptions) ? event.broadcastOptions : []),
  ].join(" ").toLowerCase();
  return Object.entries(BROADCASTER_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => text.includes(alias)))
    .map(([id]) => id);
}

function normalizeEvent(event, now){
  const start = eventStart(event);
  const end = eventEnd(event);
  return {
    ...clone(event),
    eventId: eventId(event),
    id: event.id || eventId(event),
    sportId: event.sportId || event.key,
    sportDomainId: event.sportDomainId || (event.key ? `sport:${event.key}` : null),
    competitionId: event.competitionId || event.key,
    stakesScore: stakesScore(event),
    recommendationScore: Number(event.recommendationScore || event.expected || 0),
    broadcasterIds: broadcasterIds(event),
    startTimeUtc: event.startTimeUtc || start?.toISOString() || null,
    endTimeUtc: event.endTimeUtc || end?.toISOString() || null,
    status: statusForEvent(event, now),
  };
}

function participantFollowLevels(event, preferenceGraph){
  const ids = new Set([
    ...(Array.isArray(event.participantIds) ? event.participantIds : []),
    event.homeParticipantId,
    event.awayParticipantId,
  ].filter(Boolean));
  return (Array.isArray(preferenceGraph?.entityFollows) ? preferenceGraph.entityFollows : [])
    .filter(follow => ids.has(follow.participantId))
    .map(follow => follow.followLevel);
}

function shouldEnrichEvent(event, preferences, action){
  if (cardLifecycle.isSavedAction(action)) return true;
  const graph = plainObject(preferences.preferenceGraph);
  const domain = (Array.isArray(graph.domainPreferences) ? graph.domainPreferences : [])
    .find(preference => preference.sportDomainId === event.sportDomainId);
  if (!domain) return stakesScore(event) >= MINIMUM_STAKES;
  if (domain.enabled === false) return false;
  const competition = (Array.isArray(graph.competitionPreferences) ? graph.competitionPreferences : [])
    .find(preference => preference.competitionId === event.competitionId);
  if (competition?.enabled === false) return false;
  const followLevels = participantFollowLevels(event, graph);
  if (followLevels.includes("mute")) return false;
  const includeAllFixtures = competition?.includeAllFixtures ?? domain.includeAllFixtures;
  const includeMajorEvents = competition?.includeMajorEvents ?? domain.includeMajorEvents;
  if (includeAllFixtures) return true;
  if (includeMajorEvents !== false && stakesScore(event) >= MINIMUM_STAKES) return true;
  return Boolean(
    domain.includeFollowedTeams
    && followLevels.some(level => level === "follow" || level === "priority")
  );
}

function stateCounts(events, actionFor, now){
  return events.reduce((counts, event) => {
    const state = cardLifecycle.lifecycleState(event, {
      action: actionFor(event),
      now,
    }).state;
    counts[state] += 1;
    return counts;
  }, { active: 0, archived: 0, saved: 0, expired: 0 });
}

function buildServerFeed({
  events,
  userId,
  userState,
  participants = [],
  sourceVersion = "",
  sourcePublishedAt = null,
  now = new Date(),
} = {}){
  if (!userId) throw new Error("buildServerFeed requires a user id");
  if (!Array.isArray(events)) throw new Error("buildServerFeed requires canonical events");
  const reference = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(reference.getTime())) throw new Error("buildServerFeed requires a valid clock");
  const state = plainObject(userState);
  const preferences = plainObject(state.preferences);
  const actions = plainObject(state.event_user_state || state.eventUserState);
  const actionIndex = actionsByEventId(actions);
  const actionFor = event => eventActionFor(event, actions, actionIndex);
  const normalizedEvents = events.map(event => normalizeEvent(event, reference)).filter(event => event.eventId);
  const counts = stateCounts(normalizedEvents, actionFor, reference);
  const retainedEvents = normalizedEvents.filter(event => (
    cardLifecycle.lifecycleState(event, { action: actionFor(event), now: reference }).state !== "expired"
  ));
  const enrichmentCandidates = retainedEvents.filter(event => {
    const lifecycleState = cardLifecycle.lifecycleState(event, {
      action: actionFor(event),
      now: reference,
    }).state;
    return (
      (lifecycleState === "active" || lifecycleState === "saved")
      && shouldEnrichEvent(event, preferences, actionFor(event))
    );
  });
  const selectedBroadcasterIds = preferences.selectedBroadcasters
    || preferences.preferenceGraph?.viewing?.selectedBroadcasterIds
    || [];
  const derivedCardCache = cardLifecycle.materialize(enrichmentCandidates, {
    profileId: `profile:${userId}`,
    actionFor,
    now: reference,
    buildOrigin: "server",
    sourceVersion,
    enrich: event => enrichmentEngine.enrichEvent(event, {
      preferenceGraph: preferences.preferenceGraph,
      followedSports: preferences.followedSports || [],
      selectedBroadcasterIds,
      participants,
      explicitMustWatch: Boolean(actionFor(event).mustWatch),
    }),
  });

  return {
    schemaVersion: SERVER_FEED_SCHEMA_VERSION,
    generatedAt: reference.toISOString(),
    sourceVersion,
    sourcePublishedAt,
    events: retainedEvents,
    derivedCardCache,
    retention: {
      archiveDays: cardLifecycle.ARCHIVE_DAYS,
      retentionDays: cardLifecycle.RETENTION_DAYS,
      inputEvents: normalizedEvents.length,
      retainedEvents: retainedEvents.length,
      enrichedEvents: enrichmentCandidates.length,
      derivedCards: derivedCardCache.derivedCards.length,
      ...counts,
    },
  };
}

module.exports = {
  MINIMUM_STAKES,
  SERVER_FEED_SCHEMA_VERSION,
  buildServerFeed,
  eventActionFor,
  eventActionKey,
  normalizeEvent,
  shouldEnrichEvent,
  stakesScore,
  sydneyLocalDateToUtc,
};
