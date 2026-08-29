"use strict";

const footballFollowIndex = require("../data/canonical/football-follow-index.v1.json");
const nrlFollowIndex = require("../data/canonical/nrl-follow-index.v1.json");
const aflFollowIndex = require("../data/canonical/afl-follow-index.v1.json");
const f1Context = require("../data/canonical/f1-context-2026.json");
const tennisContext = require("../data/canonical/tennis-context-2026.json");
const majorEvents = require("../data/major-events.v1.json");
const compactFollowFixtures = require("../data/follow-fixtures.v1.json");
const officialFollowFixtures = require("../data/follow-sources/official.v1.json");
const FOLLOW_FIXTURE_VERSION = [compactFollowFixtures.generatedAt, officialFollowFixtures.generatedAt].filter(Boolean).sort().at(-1) || "";

const FOOTBALL_LEAGUE_FILES = Object.freeze({
  "competition:premier-league": () => require("../data/football/fixtures/premier-league.json"),
  "competition:bundesliga": () => require("../data/football/fixtures/bundesliga.json"),
  "competition:la-liga": () => require("../data/football/fixtures/la-liga.json"),
  "competition:serie-a": () => require("../data/football/fixtures/serie-a.json"),
  "competition:ligue-1": () => require("../data/football/fixtures/ligue-1.json"),
});

function clone(value){
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function unique(values){
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function eventId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function entityFollows(userState){
  const preferences = userState?.preferences || {};
  const graph = preferences.preferenceGraph || preferences.preference_graph || {};
  return (Array.isArray(graph.entityFollows) ? graph.entityFollows : Array.isArray(graph.entity_follows) ? graph.entity_follows : [])
    .filter(follow => follow && typeof follow.participantId === "string")
    .map(follow => ({ participantId:String(follow.participantId), followLevel:String(follow.followLevel || "") }));
}

function playerTeamEntries(entityIds = []){
  const f1Players = (f1Context.participants || [])
    .filter(participant => participant.type === "competitor" && participant.metadata?.teamParticipantId)
    .map(participant => ({ id:participant.id, currentTeamId:participant.metadata.teamParticipantId }));
  const needsNflPlayers = entityIds.some(entityId => entityId.startsWith("competitor:nfl:") || entityId.startsWith("athlete:nfl:"));
  const needsHockeyPlayers = entityIds.some(entityId => entityId.startsWith("competitor:nhl:") || entityId.startsWith("athlete:nhl:") || entityId.startsWith("competitor:ice-hockey:") || entityId.startsWith("athlete:ice-hockey:"));
  const nflPlayers = needsNflPlayers ? require("../data/canonical/american-football-directory.v1.json").players || [] : [];
  const hockeyPlayers = needsHockeyPlayers ? require("../data/canonical/ice-hockey-directory.v1.json").players || [] : [];
  return [
    ...(footballFollowIndex.players || []),
    ...(nrlFollowIndex.players || []),
    ...(aflFollowIndex.players || []),
    ...f1Players,
    ...nflPlayers,
    ...hockeyPlayers,
  ];
}

function expandedFollowEntityIds(userState){
  const follows = entityFollows(userState);
  const mutedIds = new Set(follows.filter(follow => follow.followLevel === "mute").map(follow => follow.participantId));
  const activeIds = new Set(follows
    .filter(follow => ["follow", "priority"].includes(follow.followLevel))
    .map(follow => follow.participantId));
  const playerTeams = new Map(playerTeamEntries([...activeIds]).map(player => [String(player.id), String(player.currentTeamId || "")]));
  [...activeIds].forEach(entityId => {
    const teamId = playerTeams.get(entityId);
    if (teamId && !mutedIds.has(teamId)) activeIds.add(teamId);
    const tennisAlias = entityId.match(/^competitor:tennis:(?:atp|wta):(.+)$/)?.[1];
    if (tennisAlias && !mutedIds.has(`athlete:tennis:${tennisAlias}`)) activeIds.add(`athlete:tennis:${tennisAlias}`);
  });
  mutedIds.forEach(entityId => activeIds.delete(entityId));
  return activeIds;
}

function eventParticipantIds(event){
  return unique([
    ...(event?.participantIds || []),
    ...(event?.participantSlots || []).map(slot => slot?.participantId),
    event?.homeParticipantId,
    event?.awayParticipantId,
  ]);
}

function eventMatchesEntities(event, entityIds){
  return eventParticipantIds(event).some(participantId => entityIds.has(participantId));
}

function semanticFixtureKey(event){
  const participantIds = eventParticipantIds(event).sort();
  const rawStart = String(event?.startTimeUtc || (event?.date && event?.time ? `${event.date}T${event.time}` : ""));
  const parsedStart = Date.parse(rawStart);
  const start = Number.isFinite(parsedStart) ? new Date(parsedStart).toISOString() : rawStart;
  if (participantIds.length < 2 || !start) return "";
  return `${start}|${participantIds.join("|")}`;
}

function normalizeTeamSportFixture(fixture, { key, sport, expected = 5 } = {}){
  const slots = Array.isArray(fixture?.participantSlots) ? fixture.participantSlots : [];
  const home = slots.find(slot => slot.homeAway === "home") || slots[0];
  const away = slots.find(slot => slot.homeAway === "away") || slots[1];
  const id = eventId(fixture);
  if (!id || !fixture?.date || !fixture?.time) return null;
  return {
    ...clone(fixture),
    id,
    eventId:id,
    canonicalEventId:id,
    key,
    sport,
    displayTitleCompact:fixture.name,
    participantIds:unique(slots.map(slot => slot.participantId)),
    homeParticipantId:home?.participantId || null,
    awayParticipantId:away?.participantId || null,
    participants:slots.map(slot => ({ name:slot.label, role:slot.homeAway || "participant" })),
    expected:Number(fixture.expected || expected),
    liveWindow:Number(fixture.liveWindow || 3),
    storyline:fixture.storyline || { stakes:3, intensity:3, scoreReasons:["Followed team fixture"] },
    sourceName:fixture.sourceName || (key === "american-football" ? "NFL schedule" : "NHL schedule"),
    sourceType:fixture.sourceType || "official-or-league",
    sourceTrust:fixture.sourceTrust || "verified",
  };
}

function footballBundlesForEntities(entityIds){
  const teamLeague = new Map((footballFollowIndex.teams || []).map(team => [team.id, team.leagueId]));
  const leagueIds = unique([...entityIds].map(entityId => teamLeague.get(entityId)));
  return leagueIds.flatMap(leagueId => clone(FOOTBALL_LEAGUE_FILES[leagueId]?.().events || []));
}

function sydneyParts(iso){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Australia/Sydney", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(new Date(iso)).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return { date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}` };
}

function normalizeTennisSubEvent(subEvent){
  const sides = Array.isArray(subEvent?.matchupSides) ? subEvent.matchupSides : [];
  const players = sides.flatMap((side, sideIndex) => (side.players || []).map(player => ({
    id:player.id,
    name:player.name,
    role:sideIndex === 0 ? "home" : "away",
  }))).filter(player => player.id);
  if (!subEvent?.id || !subEvent?.date || players.length < 2) return null;
  const timingReference = subEvent.startTimeUtc || subEvent.sessionStartTimeUtc;
  if (!timingReference) return null;
  const local = sydneyParts(timingReference);
  const exactTime = Boolean(subEvent.startTimeUtc);
  const start = new Date(timingReference);
  return {
    ...clone(subEvent),
    id:subEvent.id,
    eventId:subEvent.id,
    canonicalEventId:subEvent.id,
    key:"tennis",
    sport:"Tennis",
    sportDomainId:"sport:tennis",
    competitionId:"competition:us-open-2026",
    displayTitleCompact:subEvent.name,
    date:local.date,
    time:local.time,
    startTimeUtc:start.toISOString(),
    endTimeUtc:new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    timeTbc:!exactTime,
    participantIds:unique(players.map(player => player.id)),
    homeParticipantId:sides[0]?.id || players[0]?.id || null,
    awayParticipantId:sides[1]?.id || players.find(player => player.role === "away")?.id || null,
    participants:players.map(player => ({ name:player.name, role:player.role })),
    broadcaster:"Stan Sport",
    broadcasterIds:["stan"],
    broadcastOptions:["Stan Sport"],
    expected:Number(subEvent.previewPriority || subEvent.stakesScore || 5),
    liveWindow:3,
    storyline:{ stakes:Number(subEvent.stakesScore || 4), intensity:4, scoreReasons:["Followed US Open player fixture"] },
    sourceName:"US Open official schedule",
    sourceUrl:subEvent.sourceUrl,
    sourceType:"official",
    sourceTrust:"verified",
  };
}

function tennisBundlesForEntities(entityIds){
  if (![...entityIds].some(entityId => entityId.startsWith("athlete:tennis:"))) return [];
  const usOpen = (majorEvents.events || []).find(event => event.id === "major-event:us-open-2026");
  return (usOpen?.subEvents || []).map(normalizeTennisSubEvent).filter(Boolean);
}

function teamSportBundleForEntities(entityIds, prefix, loader, options){
  if (![...entityIds].some(entityId => entityId.startsWith(prefix))) return { events:[], participants:[] };
  const bundle = loader();
  return {
    events:(bundle.fixtures || []).map(fixture => normalizeTeamSportFixture(fixture, options)).filter(Boolean),
    participants:[...(bundle.teams || []), ...(bundle.players || [])],
  };
}

function participantRecords(entityIds){
  const football = [...(footballFollowIndex.teams || []), ...(footballFollowIndex.players || [])];
  const nrl = [...(nrlFollowIndex.teams || []), ...(nrlFollowIndex.players || [])];
  const afl = [...(aflFollowIndex.teams || []), ...(aflFollowIndex.players || [])];
  const tennis = (tennisContext.participants || []).flatMap(record => {
    const alias = String(record.id || "").match(/^competitor:tennis:(?:atp|wta):(.+)$/)?.[1];
    return alias ? [record, { ...record, id:`athlete:tennis:${alias}` }] : [record];
  });
  return [...football, ...nrl, ...afl, ...(f1Context.participants || []), ...tennis]
    .filter(record => entityIds.has(String(record.id)));
}

function resolveUserFollowFixtures({ events = [], userState, includeCompactArtifact = true } = {}){
  const entityIds = expandedFollowEntityIds(userState);

  const nfl = teamSportBundleForEntities(entityIds, "team:nfl:", () => require("../data/canonical/american-football-directory.v1.json"), {
    key:"american-football",
    sport:"American Football",
  });
  const nhl = teamSportBundleForEntities(entityIds, "team:nhl:", () => require("../data/canonical/ice-hockey-directory.v1.json"), {
    key:"ice-hockey",
    sport:"Ice Hockey",
  });
  const sourceEvents = [
    ...(officialFollowFixtures.events || []),
    ...footballBundlesForEntities(entityIds),
    ...tennisBundlesForEntities(entityIds),
    ...nfl.events,
    ...nhl.events,
    ...(includeCompactArtifact ? compactFollowFixtures.events || [] : []),
  ].filter(event => eventMatchesEntities(event, entityIds));
  const merged = new Map();
  const semanticIds = new Map();
  [...events, ...sourceEvents].forEach(event => {
    const id = eventId(event);
    if (!id) return;
    const semanticKey = semanticFixtureKey(event);
    const existingId = merged.has(id) ? id : semanticKey ? semanticIds.get(semanticKey) : null;
    if (existingId){
      merged.set(existingId, { ...clone(event), ...merged.get(existingId) });
      return;
    }
    merged.set(id, clone(event));
    if (semanticKey) semanticIds.set(semanticKey, id);
  });
  const participants = new Map();
  [...participantRecords(entityIds), ...nfl.participants, ...nhl.participants].forEach(record => {
    if (!record?.id) return;
    participants.set(String(record.id), {
      ...clone(record),
      type:record.type || record.entityType || (String(record.id).startsWith("team:") ? "team" : "competitor"),
    });
  });
  sourceEvents.forEach(event => eventParticipantIds(event).forEach((participantId, index) => {
    if (participants.has(participantId)) return;
    const label = event.participants?.[index]?.name || participantId.split(":").at(-1).replace(/-/g, " ");
    participants.set(participantId, { id:participantId, type:participantId.startsWith("team:") ? "team" : "competitor", displayName:label });
  }));
  return {
    events:Array.from(merged.values()),
    participants:Array.from(participants.values()),
    entityIds:Array.from(entityIds),
    sourceVersion:FOLLOW_FIXTURE_VERSION,
  };
}

module.exports = {
  entityFollows,
  eventMatchesEntities,
  eventParticipantIds,
  expandedFollowEntityIds,
  normalizeTeamSportFixture,
  normalizeTennisSubEvent,
  resolveUserFollowFixtures,
  semanticFixtureKey,
  FOLLOW_FIXTURE_VERSION,
};
