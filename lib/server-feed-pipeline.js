"use strict";

const enrichmentEngine = require("../config/enrichment-engine");
const cardLifecycle = require("../config/card-lifecycle");
const discoveryCatalogue = require("../config/discovery-catalogue");
const footballDirectory = require("../config/football-directory");
const eventActionIdentity = require("../config/event-action-identity");
const footballFollowIndex = require("../data/canonical/football-follow-index.v1.json");
const nrlFollowIndex = require("../data/canonical/nrl-follow-index.v1.json");
const aflFollowIndex = require("../data/canonical/afl-follow-index.v1.json");

const teamPlayerFollowIndex = Object.freeze({
  players: Object.freeze([...(footballFollowIndex.players || []), ...(nrlFollowIndex.players || []), ...(aflFollowIndex.players || [])]),
  teams: Object.freeze([...(footballFollowIndex.teams || []), ...(nrlFollowIndex.teams || []), ...(aflFollowIndex.teams || [])]),
});

const SERVER_FEED_SCHEMA_VERSION = "server-feed.v2";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 1000;
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
  return eventActionIdentity.stableKey(event);
}

function eventActionFor(event, actions){
  return eventActionIdentity.actionFor(event, actions);
}

function archivedEventIds(userState){
  const state = plainObject(userState);
  const references = Array.isArray(state.archived_events)
    ? state.archived_events
    : Array.isArray(state.archivedEvents) ? state.archivedEvents : [];
  return new Set(references
    .map(reference => reference?.canonicalEventId || reference?.eventId || reference?.id)
    .filter(Boolean)
    .map(String));
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
  const direct = (Array.isArray(preferenceGraph?.entityFollows) ? preferenceGraph.entityFollows : [])
    .filter(follow => ids.has(follow.participantId))
    .map(follow => follow.followLevel);
  const expanded = footballDirectory.expandedFollowLevels(event, preferenceGraph, teamPlayerFollowIndex);
  return Array.from(new Set([...direct, ...expanded]));
}

function isCoreLeagueFootball(event){
  return [
    "competition:premier-league", "competition:premier-league-2026-27", "competition:bundesliga",
    "competition:la-liga", "competition:serie-a", "competition:ligue-1",
  ].includes(event?.competitionId) || ["premier-league", "football"].includes(event?.key);
}

function eventDomainPreferences(event, preferences){
  const graph = plainObject(preferences?.preferenceGraph);
  const discoveryNodeId = discoveryCatalogue.eventNodeId(event);
  const directIds = new Set([
    event?.sportDomainId,
    ...(Array.isArray(event?.sportDomainIds) ? event.sportDomainIds : []),
  ].filter(Boolean).map(String));
  return (Array.isArray(graph.domainPreferences) ? graph.domainPreferences : [])
    .filter(preference => {
      const preferenceId = String(preference?.sportDomainId || "");
      if (!preferenceId) return false;
      if (directIds.has(preferenceId) || preferenceId === discoveryNodeId) return true;
      return Boolean(
        discoveryNodeId
        && discoveryCatalogue.familyIds(preferenceId).includes(discoveryNodeId)
      );
    });
}

function shouldEnrichEvent(event, preferences, action){
  if (cardLifecycle.isRetentionExemptAction(action)) return true;
  const graph = plainObject(preferences.preferenceGraph);
  const domains = eventDomainPreferences(event, preferences);
  if (!domains.length) return stakesScore(event) >= MINIMUM_STAKES;
  if (domains.some(domain => domain.enabled === false)) return false;
  const enabledDomains = domains.filter(domain => domain.enabled !== false);
  const competition = (Array.isArray(graph.competitionPreferences) ? graph.competitionPreferences : [])
    .find(preference => preference.competitionId === event.competitionId);
  if (competition?.enabled === false) return false;
  const followLevels = participantFollowLevels(event, graph);
  if (followLevels.includes("mute")) return false;
  if (followLevels.some(level => level === "follow" || level === "priority")) return true;
  if (isCoreLeagueFootball(event)){
    const stakes = stakesScore(event);
    if (enabledDomains.some(domain => domain.templateId === "template:froth")) return stakes >= 4;
    if (enabledDomains.some(domain => domain.templateId === "template:like")) return stakes >= 5;
    if (!enabledDomains.some(domain => domain.templateId === "template:custom")) return false;
  }
  const includeAllFixtures = competition?.includeAllFixtures
    ?? enabledDomains.some(domain => domain.includeAllFixtures);
  const includeMajorEvents = competition?.includeMajorEvents
    ?? enabledDomains.some(domain => domain.includeMajorEvents !== false);
  if (includeAllFixtures) return true;
  if (includeMajorEvents !== false && stakesScore(event) >= MINIMUM_STAKES) return true;
  return Boolean(
    enabledDomains.some(domain => domain.includeFollowedTeams)
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
  cursor = 0,
  limit = DEFAULT_PAGE_SIZE,
} = {}){
  if (!userId) throw new Error("buildServerFeed requires a user id");
  if (!Array.isArray(events)) throw new Error("buildServerFeed requires canonical events");
  const reference = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(reference.getTime())) throw new Error("buildServerFeed requires a valid clock");
  const state = plainObject(userState);
  const preferences = discoveryCatalogue.migratePreferences(plainObject(state.preferences));
  const actions = eventActionIdentity.migrateActions(plainObject(state.event_user_state || state.eventUserState));
  const archivedIds = archivedEventIds(state);
  const actionFor = event => {
    const action = eventActionFor(event, actions);
    return archivedIds.has(eventId(event)) ? { ...action, archived: true } : action;
  };
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
    }),
  });

  const safeCursor = Math.max(0, Number.isFinite(Number(cursor)) ? Math.floor(Number(cursor)) : 0);
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : DEFAULT_PAGE_SIZE));
  const pageEvents = retainedEvents.slice(safeCursor, safeCursor + safeLimit);
  const pageEventIds = new Set(pageEvents.map(eventId));
  const pageDerivedCards = derivedCardCache.derivedCards.filter(card => pageEventIds.has(card.canonicalEventId));
  const nextCursor = safeCursor + pageEvents.length < retainedEvents.length
    ? safeCursor + pageEvents.length
    : null;

  return {
    schemaVersion: SERVER_FEED_SCHEMA_VERSION,
    generatedAt: reference.toISOString(),
    sourceVersion,
    sourcePublishedAt,
    events: pageEvents,
    derivedCardCache: {
      ...derivedCardCache,
      derivedCards: pageDerivedCards,
    },
    pagination: {
      cursor: safeCursor,
      limit: safeLimit,
      nextCursor,
      total: retainedEvents.length,
    },
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
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SERVER_FEED_SCHEMA_VERSION,
  buildServerFeed,
  archivedEventIds,
  eventActionFor,
  eventActionKey,
  eventDomainPreferences,
  normalizeEvent,
  shouldEnrichEvent,
  stakesScore,
  sydneyLocalDateToUtc,
};
