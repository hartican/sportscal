"use strict";

const tennisFeed = require('../config/tennis-feed');
const tennisParents = require('../data/tennis-feed-parents.v1.json');
const enrichmentEngine = require("../config/enrichment-engine");
const cardLifecycle = require("../config/card-lifecycle");
const discoveryCatalogue = require("../config/discovery-catalogue");
const footballDirectory = require("../config/football-directory");
const eventActionIdentity = require("../config/event-action-identity");
const { expandedFollowEntityIds, semanticFixtureKey } = require("./follow-fixture-resolver");
const followFeedPolicy = require("../config/follow-feed-policy");
const followFirst = require("../config/follow-first");
const preferenceSystem = require("../config/preference-system");
const selectorTaxonomy = require("../config/selector-taxonomy");
const fixtureIdentity = require("../config/fixture-identity");
const feedFixtureReconciliation = require("../config/feed-fixture-reconciliation");
const footballFollowIndex = require("../data/canonical/football-follow-index.v1.json");
const nrlFollowIndex = require("../data/canonical/nrl-follow-index.v1.json");
const aflFollowIndex = require("../data/canonical/afl-follow-index.v1.json");
const aflwFollowIndex = require("../data/canonical/aflw-follow-index.v1.json");

const teamPlayerFollowIndex = Object.freeze({
  players: Object.freeze([...(footballFollowIndex.players || []), ...(nrlFollowIndex.players || []), ...(aflFollowIndex.players || []), ...(aflwFollowIndex.players || [])]),
  teams: Object.freeze([...(footballFollowIndex.teams || []), ...(nrlFollowIndex.teams || []), ...(aflFollowIndex.teams || []), ...(aflwFollowIndex.teams || [])]),
});

const SERVER_FEED_SCHEMA_VERSION = "server-feed.v3";
const SERVER_FEED_BUILD_VERSION = "follow-policy.v13:" + require("node:crypto").createHash("sha256").update(JSON.stringify(tennisParents)).digest("hex").slice(0,12);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 1000;
const SYDNEY_TIME_ZONE = "Australia/Sydney";
const SYDNEY_DATE = new Intl.DateTimeFormat('en-CA', {timeZone:SYDNEY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const SYDNEY_PARTS = new Intl.DateTimeFormat('en-CA', {timeZone:SYDNEY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
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

function normalizeUserFollowState(userState){
  const state = plainObject(userState);
  const migrated = followFirst.migratePreferences(discoveryCatalogue.migratePreferences(plainObject(state.preferences)));
  const selectedIds = Array.isArray(migrated.selectedSelectorEntityIds)
    ? migrated.selectedSelectorEntityIds.filter(id => typeof id === "string")
    : [];
  const existingDomains = Array.isArray(migrated.preferenceGraph?.domainPreferences)
    ? migrated.preferenceGraph.domainPreferences.filter(item => item?.enabled !== false).map(item => item.sportDomainId)
    : [];
  const selectedSportIds = selectedIds.filter(id => id.startsWith("sport:"));
  const selectedParentIds = new Set(selectedSportIds.map(id => selectorTaxonomy.byId[id]?.parentId).filter(id => id?.startsWith("sport:")));
  const domainIds = selectedIds.length
    ? [...selectedSportIds, ...existingDomains.filter(id => selectedParentIds.has(id))]
    : existingDomains;
  const rawGraph = plainObject(migrated.preferenceGraph);
  const stableGraph = rawGraph.updatedAt ? rawGraph : {
    ...rawGraph,
    updatedAt:state.updated_at || state.updatedAt || "1970-01-01T00:00:00.000Z",
  };
  return {
    ...state,
    preferences:{
      ...migrated,
      preferenceGraph:preferenceSystem.migratePreferenceGraph(stableGraph, {
        profileId:stableGraph.profileId,
        domainIds,
        broadcasterIds:migrated.selectedBroadcasters || migrated.preferenceGraph?.viewing?.selectedBroadcasterIds || [],
      }),
    },
  };
}

function eventId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function eventActionKey(event){
  return eventActionIdentity.stableKey(event);
}

function eventActionFor(event, actions){
  const direct = eventActionIdentity.actionFor(event, actions);
  if (Object.keys(direct).length) return direct;
  const fixtureKey = semanticFixtureKey(event);
  if (!fixtureKey) return direct;
  return Object.values(plainObject(actions)).find(action => (
    action?.addedToFixtures
    && semanticFixtureKey(action.addedFixture) === fixtureKey
  )) || direct;
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
  const formatter = SYDNEY_PARTS;
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
  if(event?.timePrecision && !["exact","session-start"].includes(event.timePrecision))return null;
  const parsed = new Date(event?.startTimeUtc || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventTimelineStart(event){
  const explicit=eventStart(event);
  if(explicit)return explicit;
  for(const value of [event?.timelineSortTimeUtc,event?.sessionStartTimeUtc]){
    const parsed=new Date(value || "");
    if(!Number.isNaN(parsed.getTime()))return parsed;
  }
  return sydneyLocalDateToUtc(event?.date,event?.time || "00:00");
}

function inferredDurationHours(event){
  const explicit=Number(event?.publishedDurationHours || event?.liveWindow || event?.calendarTemplate?.durationHours);
  if(Number.isFinite(explicit)&&explicit>0)return explicit;
  const identity=`${event?.competitionId || ""} ${event?.key || ""} ${event?.sportId || ""} ${event?.name || ""}`.toLowerCase();
  if(/le mans|endurance|fia wec/.test(identity))return 24;
  if(/tennis|us open|wimbledon|roland garros|australian open/.test(identity))return 5;
  if(/formula 1|\bf1\b|motorsport/.test(identity))return 4;
  return 3;
}

function eventEnd(event){
  if (event?.endTimeUtc){
    const parsed = new Date(event.endTimeUtc);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const start = eventStart(event);
  if (!start) return null;
  return new Date(start.getTime() + inferredDurationHours(event) * 60 * 60 * 1000);
}

function sydneyDateKey(value){
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return SYDNEY_DATE.format(date);
}

function chronologicalBucket(event, now){
  if(tennisFeed.isParent(event) && event.date && event.date<=sydneyDateKey(now) && event.endDate>=sydneyDateKey(now))return 0;
  const start = eventTimelineStart(event);
  if (!start) return 4;
  const eventDate = sydneyDateKey(start);
  const today = sydneyDateKey(now);
  if (eventDate === today) return 0;
  if (start < now){
    const yesterday = new Date(now.getTime());
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    if (eventDate === sydneyDateKey(yesterday)) return 1;
    return 3;
  }
  return 2;
}

function comparePersonalisedChronology(first, second, now = new Date()){
  const firstBucket = chronologicalBucket(first, now);
  const secondBucket = chronologicalBucket(second, now);
  if (firstBucket !== secondBucket) return firstBucket - secondBucket;
  const firstStart = eventTimelineStart(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const secondStart = eventTimelineStart(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const chronology = firstBucket === 1 || firstBucket === 3
    ? secondStart - firstStart
    : firstStart - secondStart;
  return chronology || eventId(first).localeCompare(eventId(second));
}

function statusForEvent(event, now){
  const status = String(event?.status || "").toLowerCase();
  if (["cancelled", "canceled", "abandoned", "postponed"].includes(status)) return status;
  if (event?.dateOnly === true || event?.timePrecision === "date-only"){
    const today = sydneyDateKey(now);
    const startsOn = String(event?.date || "");
    const endsOn = String(event?.endDate || startsOn);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startsOn) && /^\d{4}-\d{2}-\d{2}$/.test(endsOn)){
      if (today < startsOn) return "upcoming";
      if (today <= endsOn) return "live";
      return "past";
    }
  }
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

const immutableCoreEvents = new WeakMap();
function normalizeEvent(event, now, {copyEvents=true} = {}){
  if(!copyEvents){
    let core=immutableCoreEvents.get(event);
    if(!core){core=fixtureIdentity.normalizeCore(event);immutableCoreEvents.set(event,core);}
    event=core;
  }else event = fixtureIdentity.normalizeCore(event);
  const start = eventStart(event);
  const timelineStart=eventTimelineStart(event);
  const end = eventEnd(event);
  return {
    ...(copyEvents ? clone(event) : event),
    eventId: eventId(event),
    id: event.id || eventId(event),
    sportId: event.sportId || event.key,
    sportDomainId: event.sportDomainId || (event.key ? `sport:${event.key}` : null),
    competitionId: event.competitionId || event.key,
    recommendationScore: Number(event.recommendationScore || event.expected || 0),
    broadcasterIds: broadcasterIds(event),
    startTimeUtc: event.startTimeUtc || null,
    timelineSortTimeUtc:event.timelineSortTimeUtc || event.sessionStartTimeUtc || timelineStart?.toISOString() || null,
    timePrecision:event.timePrecision || (event.startTimeUtc ? "exact" : event.timelineSortTimeUtc || event.sessionStartTimeUtc ? "follows" : event.date ? "date-only" : "tbc"),
    endTimeUtc: event.endTimeUtc || end?.toISOString() || null,
    status: statusForEvent(event, now),
  };
}

function participantFollowLevels(event, preferenceGraph, expandedEntityIds = new Set()){
  const ids = new Set(followFeedPolicy.participantIds(event));
  const optedOut=new Set((preferenceGraph?.entityFollows||[]).filter(f=>["unfollow","mute"].includes(f.followLevel)).map(f=>followFirst.participantFollowIdentityKey(f.participantId)));
  const activeGraph={...preferenceGraph,entityFollows:(preferenceGraph?.entityFollows||[]).filter(f=>!optedOut.has(followFirst.participantFollowIdentityKey(f.participantId)))};
  const direct = (Array.isArray(activeGraph?.entityFollows) ? activeGraph.entityFollows : [])
    .filter(follow => ids.has(follow.participantId))
    .map(follow => follow.followLevel);
  const expanded = footballDirectory.expandedFollowLevels(event, activeGraph, teamPlayerFollowIndex);
  const resolverExpanded = [...ids].some(participantId => expandedEntityIds.has(participantId))
    ? ["follow"]
    : [];
  return Array.from(new Set([...direct, ...expanded, ...resolverExpanded]));
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

function shouldEnrichEvent(event, preferences, action, expandedEntityIds = new Set(), now = new Date(), preparedPreferences = null){
  if (!fixtureIdentity.retainedInActiveTimeline(event,now))return false;
  if(tennisFeed.isParent(event))return !action.dismissed && !action.archived && Boolean(tennisFeed.reason(event,preferences,{preparedPreferences,expandedParticipantIds:expandedEntityIds,now}));
  if(tennisFeed.isRubber(event))return false;
  if (!followFeedPolicy.sportingFixture(event) || !followFeedPolicy.feedEligibleSession(event) || followFeedPolicy.explicitlyExcluded(event,preferences)) return false;
  if (cardLifecycle.isRetentionExemptAction(action)) return true;
  const graph = plainObject(preferences.preferenceGraph);
  const applicableIds=event.participantsConfirmed===true || event.excludedParticipantIds?.length
    ? expandedFollowEntityIds({preferences},{event}) : expandedEntityIds;
  const followLevels = participantFollowLevels(event, graph, applicableIds);
  const followed = followLevels.some(level => level === "follow" || level === "priority");
  if (followed) return followFeedPolicy.followedFixtureDecision(event, { followed:true, followSource:"entity", now }).include;
  return Boolean(followFirst.reasonForEvent(event, preferences, {preparedPreferences}));
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
  onTiming = () => {},
  copyEvents = true,
} = {}){
  const began = performance.now();
  if (!userId) throw new Error("buildServerFeed requires a user id");
  if (!Array.isArray(events)) throw new Error("buildServerFeed requires canonical events");
  const reference = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(reference.getTime())) throw new Error("buildServerFeed requires a valid clock");
  const state = normalizeUserFollowState(userState);
  const preferences = state.preferences;
  const preparedPreferences = followFirst.migratePreferences(preferences);
  const expandedEntityIds = expandedFollowEntityIds({ preferences });
  const actions = eventActionIdentity.migrateActions(plainObject(state.event_user_state || state.eventUserState));
  const archivedIds = archivedEventIds(state);
  const actionCache = new WeakMap();
  const actionFor = event => {
    if(actionCache.has(event))return actionCache.get(event);
    const action = eventActionFor(event, actions);
    const result = archivedIds.has(eventId(event)) ? { ...action, archived: true } : action;
    actionCache.set(event,result);return result;
  };
  const knownIds=new Set(events.map(eventId));
  events=[...events,...(tennisParents.contests||[]).filter(e=>!knownIds.has(eventId(e)))];
  const parents = tennisParents.parents.map(parent=>tennisFeed.reconcile(parent,events));
  const existingParentIds=new Set(events.filter(tennisFeed.isParent).map(eventId));
  events=[...events.map(event=>tennisFeed.isParent(event)?tennisFeed.reconcile(event,events):event),...parents.filter(parent=>!existingParentIds.has(eventId(parent)))];
  const normalizedEvents = [];
  const normalizedIdentityIndexes = new Map();
  events.map(event => normalizeEvent(event, reference, {copyEvents})).filter(event => event.eventId).forEach(event => {
    const identity = feedFixtureReconciliation.feedFixtureIdentity(event);
    if (identity && normalizedIdentityIndexes.has(identity)) return;
    if (identity) normalizedIdentityIndexes.set(identity,normalizedEvents.length);
    normalizedEvents.push(event);
  });
  const counts={active:0,archived:0,saved:0,expired:0};
  const retainedEvents=[],eligibleRetainedEvents=[],enrichmentCandidates=[];
  for(const event of normalizedEvents){
    const state=cardLifecycle.lifecycleState(event,{action:actionFor(event),now:reference}).state;
    counts[state]++;
    if(state==='expired')continue;
    retainedEvents.push(event);
    if(!shouldEnrichEvent(event,preferences,actionFor(event),expandedEntityIds,reference,preparedPreferences))continue;
    eligibleRetainedEvents.push(event);
    if(state==='active'||state==='saved')enrichmentCandidates.push(event);
  }
  onTiming('eligibility',performance.now()-began);
  const selectedBroadcasterIds = preferences.selectedBroadcasters
    || preferences.preferenceGraph?.viewing?.selectedBroadcasterIds
    || [];
  const safeCursor = Math.max(0, Number.isFinite(Number(cursor)) ? Math.floor(Number(cursor)) : 0);
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : DEFAULT_PAGE_SIZE));
  const sortStart=performance.now();
  const personalisedEvents = eligibleRetainedEvents
    .map(event=>({event,bucket:chronologicalBucket(event,reference),start:eventTimelineStart(event)?.getTime()??Number.MAX_SAFE_INTEGER,id:eventId(event)}))
    .sort((a,b)=>a.bucket-b.bucket || (a.bucket===1||a.bucket===3?b.start-a.start:a.start-b.start) || a.id.localeCompare(b.id))
    .map(row=>row.event);
  onTiming('sort',performance.now()-sortStart);
  const pageEvents = personalisedEvents.slice(safeCursor, safeCursor + safeLimit);
  const enrichStart=performance.now();
  const materializedPage = cardLifecycle.materialize(pageEvents, {
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
  onTiming('enrichment',performance.now()-enrichStart);
  const cardsByEventId = new Map(materializedPage.derivedCards.map(card => [card.canonicalEventId, card]));
  const pageDerivedCards = pageEvents.map((event, index) => ({
    ...cardsByEventId.get(eventId(event)),
    rank: safeCursor + index + 1,
  })).filter(card => card.canonicalEventId);
  const nextCursor = safeCursor + pageEvents.length < personalisedEvents.length
    ? safeCursor + pageEvents.length
    : null;

  return {
    schemaVersion: SERVER_FEED_SCHEMA_VERSION,
    generatedAt: reference.toISOString(),
    sourceVersion,
    sourcePublishedAt,
    events: pageEvents,
    derivedCardCache: {
      ...materializedPage,
      derivedCards: pageDerivedCards,
    },
    pagination: {
      cursor: safeCursor,
      limit: safeLimit,
      nextCursor,
      total: personalisedEvents.length,
    },
    retention: {
      archiveDays: cardLifecycle.ARCHIVE_DAYS,
      retentionDays: cardLifecycle.RETENTION_DAYS,
      inputEvents: normalizedEvents.length,
      retainedEvents: retainedEvents.length,
      enrichedEvents: enrichmentCandidates.length,
      derivedCards: enrichmentCandidates.length,
      ...counts,
    },
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SERVER_FEED_BUILD_VERSION,
  SERVER_FEED_SCHEMA_VERSION,
  buildServerFeed,
  archivedEventIds,
  eventActionFor,
  eventActionKey,
  eventDomainPreferences,
  comparePersonalisedChronology,
  normalizeEvent,
  normalizeUserFollowState,
  eventEnd,
  shouldEnrichEvent,
  stakesScore,
  sydneyLocalDateToUtc,
  sydneyDateKey,
};
