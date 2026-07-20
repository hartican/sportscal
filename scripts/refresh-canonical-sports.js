#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const taxonomy = require("../config/canonical-sports-taxonomy.js");

const SEASON = 2026;
const OUTPUT_PATH = path.resolve(__dirname, "../data/canonical/afl-nrl-2026.json");
const AFL_API = "https://aflapi.afl.com.au/afl/v2";
const NRL_FIXTURE_URL = "https://mc.championdata.com/data/12999/fixture.json";

const AU_BROADCASTERS = Object.freeze({
  afl: [
    {
      broadcasterId: "broadcaster:kayo",
      broadcasterName: "Kayo Sports",
      platformType: "streaming",
      regionCode: "AU",
      live: true,
      replay: true,
      highlights: true,
      deeplinkUrl: "https://kayosports.com.au/",
    },
    {
      broadcasterId: "broadcaster:foxtel",
      broadcasterName: "Foxtel",
      platformType: "subscription",
      regionCode: "AU",
      live: true,
      replay: true,
      highlights: true,
      deeplinkUrl: "https://www.foxtel.com.au/",
    },
  ],
  nrl: [
    {
      broadcasterId: "broadcaster:kayo",
      broadcasterName: "Kayo Sports",
      platformType: "streaming",
      regionCode: "AU",
      live: true,
      replay: true,
      highlights: true,
      deeplinkUrl: "https://kayosports.com.au/",
    },
    {
      broadcasterId: "broadcaster:foxtel",
      broadcasterName: "Foxtel",
      platformType: "subscription",
      regionCode: "AU",
      live: true,
      replay: true,
      highlights: true,
      deeplinkUrl: "https://www.foxtel.com.au/",
    },
  ],
});

function normalizeIso(value){
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchJson(url, headers = {}){
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "nothingSports-canonical-refresh/1.0",
      ...headers,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function mapWithConcurrency(values, limit, worker){
  const results = new Array(values.length);
  let nextIndex = 0;
  async function run(){
    while (nextIndex < values.length){
      const index = nextIndex++;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return results;
}

function existingCreatedAtById(){
  try{
    const current = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    return new Map((current.events || []).map(event => [event.id, event.createdAt]));
  }catch(_error){
    return new Map();
  }
}

function aflParticipantId(team){
  return `team:afl:${String(team.providerId || team.id).toLowerCase()}`;
}

function nrlParticipantId(squadId){
  return `team:nrl:${squadId}`;
}

function aflParticipant(team){
  return {
    id: aflParticipantId(team),
    type: "team",
    sportDomainId: "sport:afl",
    displayName: team.name,
    shortName: team.nickname || team.abbreviation,
    canonicalName: team.name,
    teamCode: team.abbreviation,
    countryCode: "AU",
    metadata: {
      providerId: team.providerId,
      sourceTeamId: team.id,
    },
  };
}

function nrlParticipant(match, side){
  const prefix = side === "home" ? "home" : "away";
  const squadId = match[`${prefix}SquadId`];
  return {
    id: nrlParticipantId(squadId),
    type: "team",
    sportDomainId: "sport:nrl",
    displayName: match[`${prefix}SquadNickname`],
    shortName: match[`${prefix}SquadShortCode`] || match[`${prefix}SquadCode`],
    canonicalName: match[`${prefix}SquadName`],
    teamCode: match[`${prefix}SquadCode`],
    countryCode: match[`${prefix}SquadCode`] === "NZW" ? "NZ" : "AU",
    metadata: { sourceTeamId: squadId },
  };
}

function aflStatus(sourceStatus){
  const status = String(sourceStatus || "").toUpperCase();
  if (["CONCLUDED", "COMPLETED", "FINAL"].includes(status)) return "completed";
  if (["LIVE", "IN_PROGRESS"].includes(status)) return "live";
  if (status === "POSTPONED") return "postponed";
  if (status === "CANCELLED") return "cancelled";
  return "scheduled";
}

function nrlStatus(sourceStatus){
  const status = String(sourceStatus || "").toLowerCase();
  if (["complete", "completed", "final", "full time"].includes(status)) return "completed";
  if (["live", "in progress", "playing"].includes(status)) return "live";
  if (status.includes("postpon")) return "postponed";
  if (status.includes("cancel")) return "cancelled";
  return "scheduled";
}

function resultSummary(event, homeScore, awayScore){
  if (event.status !== "completed" || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return undefined;
  const winnerParticipantId = homeScore === awayScore
    ? undefined
    : homeScore > awayScore ? event.homeParticipantId : event.awayParticipantId;
  return {
    status: "completed",
    ...(winnerParticipantId ? { winnerParticipantId } : {}),
    scorelineText: `${event.displayName} — ${homeScore}-${awayScore}`,
    spoilerLevel: "sensitive",
  };
}

function eventSource(provider, sourceUrl, sourceType, checkedAt){
  return { provider, sourceUrl, sourceType, checkedAt };
}

function buildAflEvent(match, checkedAt, createdAtById){
  const home = aflParticipant(match.home.team);
  const away = aflParticipant(match.away.team);
  const id = `event:afl:${String(match.providerId || match.id).toLowerCase()}`;
  const placeholder = String(match.status || "").toUpperCase() === "PLACEHOLDER";
  const status = aflStatus(match.status);
  const source = eventSource(
    "AFL",
    `https://www.afl.com.au/afl/matches/${match.id}`,
    "official",
    checkedAt
  );
  const event = {
    id,
    sourceId: String(match.providerId || match.id),
    sportDomainId: "sport:afl",
    competitionId: "competition:afl-premiership-2026",
    seasonLabel: String(SEASON),
    roundLabel: match.round?.name || `Round ${match.round?.roundNumber}`,
    roundNumber: Number(match.round?.roundNumber || 0),
    eventType: "match",
    startTimeUtc: placeholder ? null : normalizeIso(match.utcStartTime),
    scheduleStatus: placeholder ? "tbc" : "confirmed",
    localTimezone: match.venue?.timezone || "Australia/Sydney",
    venueName: match.venue?.name || "",
    venueCity: match.venue?.location || "",
    venueCountryCode: "AU",
    homeParticipantId: home.id,
    awayParticipantId: away.id,
    participantIds: [home.id, away.id],
    displayName: `${home.displayName} v ${away.displayName}`,
    status,
    broadcasters: AU_BROADCASTERS.afl,
    hasLadderImplications: true,
    hasFinalsImplications: true,
    tags: ["afl", "all-fixtures", placeholder ? "time-tbc" : "time-confirmed"],
    createdAt: createdAtById.get(id) || checkedAt,
    updatedAt: checkedAt,
    source,
  };
  const result = resultSummary(event, match.home?.score?.totalScore, match.away?.score?.totalScore);
  if (result) event.result = result;
  return { event, participants: [home, away] };
}

function nrlVenueTimezone(match){
  const venue = String(match.venueName || "").toLowerCase();
  if (/go media|one nz|sky stadium/.test(venue)) return "Pacific/Auckland";
  if (/allegiant/.test(venue)) return "America/Los_Angeles";
  if (/optus|perth/.test(venue)) return "Australia/Perth";
  if (/tio stadium|darwin/.test(venue)) return "Australia/Darwin";
  if (/suncorp|cbus|queensland country|qld country|kayo stadium/.test(venue)) return "Australia/Brisbane";
  if (/aami park/.test(venue)) return "Australia/Melbourne";
  return "Australia/Sydney";
}

function nrlVenueCountryCode(match){
  const timezone = nrlVenueTimezone(match);
  if (timezone === "Pacific/Auckland") return "NZ";
  if (timezone === "America/Los_Angeles") return "US";
  return "AU";
}

function buildNrlEvent(match, checkedAt, createdAtById){
  const home = nrlParticipant(match, "home");
  const away = nrlParticipant(match, "away");
  const id = `event:nrl:${match.matchId}`;
  const status = nrlStatus(match.matchStatus);
  const event = {
    id,
    sourceId: String(match.matchId),
    sportDomainId: "sport:nrl",
    competitionId: "competition:nrl-premiership-2026",
    seasonLabel: String(SEASON),
    roundLabel: `Round ${match.roundNumber}`,
    roundNumber: Number(match.roundNumber),
    eventType: "match",
    startTimeUtc: normalizeIso(match.utcStartTime),
    scheduleStatus: "confirmed",
    localTimezone: nrlVenueTimezone(match),
    venueName: match.venueName || "",
    venueCity: "",
    venueCountryCode: nrlVenueCountryCode(match),
    homeParticipantId: home.id,
    awayParticipantId: away.id,
    participantIds: [home.id, away.id],
    displayName: `${home.displayName} v ${away.displayName}`,
    status,
    broadcasters: AU_BROADCASTERS.nrl,
    hasLadderImplications: true,
    hasFinalsImplications: true,
    tags: ["nrl", "all-fixtures", "time-confirmed"],
    createdAt: createdAtById.get(id) || checkedAt,
    updatedAt: checkedAt,
    source: eventSource(
      "NRL Match Centre / Champion Data",
      "https://www.nrl.com/draw",
      "official-provider",
      checkedAt
    ),
  };
  const result = resultSummary(event, Number(match.homeSquadScore), Number(match.awaySquadScore));
  if (result) event.result = result;
  return { event, participants: [home, away] };
}

function buildAflLadder(raw, checkedAt){
  const entries = raw.ladders?.[0]?.entries || [];
  const completedRound = Math.max(0, Number(raw.compSeason?.currentRoundNumber || 1) - 1);
  return {
    id: `ladder:afl-premiership-2026:round-${completedRound}`,
    competitionId: "competition:afl-premiership-2026",
    seasonLabel: String(SEASON),
    roundLabel: `After Round ${completedRound}`,
    snapshotTimeUtc: normalizeIso(raw.lastUpdated) || checkedAt,
    entries: entries.map(entry => ({
      participantId: aflParticipantId(entry.team),
      rank: Number(entry.position),
      played: Number(entry.played),
      won: Number(entry.thisSeasonRecord?.winLossRecord?.wins || 0),
      lost: Number(entry.thisSeasonRecord?.winLossRecord?.losses || 0),
      drawn: Number(entry.thisSeasonRecord?.winLossRecord?.draws || 0),
      pointsFor: Number(entry.pointsFor || 0),
      pointsAgainst: Number(entry.pointsAgainst || 0),
      pointsDifference: Number(entry.pointsFor || 0) - Number(entry.pointsAgainst || 0),
      percentage: Number(entry.thisSeasonRecord?.percentage || 0),
      ladderPoints: Number(entry.thisSeasonRecord?.aggregatePoints || 0),
      streak: String(entry.form || ""),
      movement: entry.positionChange === "UP" ? "up" : entry.positionChange === "DOWN" ? "down" : "same",
    })),
    source: eventSource(
      "AFL",
      "https://www.afl.com.au/ladder",
      "official",
      normalizeIso(raw.lastUpdated) || checkedAt
    ),
    metadata: { finalsCutOff: Number(raw.ladders?.[0]?.finalsCutOff || 10) },
  };
}

function buildNrlLadder(events, participants, checkedAt){
  const completedRounds = new Map();
  events.forEach(event => {
    const list = completedRounds.get(event.roundNumber) || [];
    list.push(event);
    completedRounds.set(event.roundNumber, list);
  });
  const completedRound = Math.max(0, ...Array.from(completedRounds.entries())
    .filter(([, matches]) => matches.length && matches.every(match => match.status === "completed"))
    .map(([round]) => round));
  const nrlParticipants = participants.filter(participant => participant.sportDomainId === "sport:nrl");
  const rows = new Map(nrlParticipants.map(participant => [participant.id, {
    participantId: participant.id,
    rank: 0,
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    byes: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDifference: 0,
    ladderPoints: 0,
  }]));

  for (let round = 1; round <= completedRound; round += 1){
    const matches = completedRounds.get(round) || [];
    const playedIds = new Set();
    matches.filter(match => match.status === "completed").forEach(match => {
      const home = rows.get(match.homeParticipantId);
      const away = rows.get(match.awayParticipantId);
      const scoreMatch = match.result?.scorelineText?.match(/—\s*(\d+)-(\d+)$/);
      if (!home || !away || !scoreMatch) return;
      const homeScore = Number(scoreMatch[1]);
      const awayScore = Number(scoreMatch[2]);
      playedIds.add(home.participantId);
      playedIds.add(away.participantId);
      home.played += 1;
      away.played += 1;
      home.pointsFor += homeScore;
      home.pointsAgainst += awayScore;
      away.pointsFor += awayScore;
      away.pointsAgainst += homeScore;
      if (homeScore === awayScore){
        home.drawn += 1;
        away.drawn += 1;
        home.ladderPoints += 1;
        away.ladderPoints += 1;
      } else if (homeScore > awayScore){
        home.won += 1;
        away.lost += 1;
        home.ladderPoints += 2;
      } else {
        away.won += 1;
        home.lost += 1;
        away.ladderPoints += 2;
      }
    });
    rows.forEach(row => {
      if (playedIds.has(row.participantId)) return;
      row.byes += 1;
      row.ladderPoints += 2;
    });
  }

  const entries = Array.from(rows.values())
    .map(row => ({ ...row, pointsDifference: row.pointsFor - row.pointsAgainst }))
    .sort((first, second) =>
      second.ladderPoints - first.ladderPoints
      || second.pointsDifference - first.pointsDifference
      || second.pointsFor - first.pointsFor
      || first.participantId.localeCompare(second.participantId)
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    id: `ladder:nrl-premiership-2026:round-${completedRound}`,
    competitionId: "competition:nrl-premiership-2026",
    seasonLabel: String(SEASON),
    roundLabel: `After Round ${completedRound}`,
    snapshotTimeUtc: checkedAt,
    entries,
    source: eventSource(
      "NRL Match Centre / Champion Data",
      "https://www.nrl.com/ladder",
      "official-provider",
      checkedAt
    ),
    metadata: { calculation: "Official match results plus scheduled byes; ranked by points then differential" },
  };
}

function uniqueParticipants(items){
  const byId = new Map();
  items.flat().forEach(participant => byId.set(participant.id, participant));
  return Array.from(byId.values()).sort((a, b) =>
    a.sportDomainId.localeCompare(b.sportDomainId) || a.displayName.localeCompare(b.displayName)
  );
}

function sortedEvents(events){
  return events.slice().sort((first, second) => {
    const sportOrder = first.sportDomainId.localeCompare(second.sportDomainId);
    if (sportOrder) return sportOrder;
    if (first.roundNumber !== second.roundNumber) return first.roundNumber - second.roundNumber;
    const firstTime = first.startTimeUtc ? Date.parse(first.startTimeUtc) : Number.MAX_SAFE_INTEGER;
    const secondTime = second.startTimeUtc ? Date.parse(second.startTimeUtc) : Number.MAX_SAFE_INTEGER;
    return firstTime - secondTime || first.displayName.localeCompare(second.displayName);
  });
}

async function main(){
  const checkedAt = new Date().toISOString();
  const createdAtById = existingCreatedAtById();
  const aflHeaders = { Origin: "https://www.afl.com.au", Referer: "https://www.afl.com.au/" };
  const compSeasons = await fetchJson(`${AFL_API}/competitions/1/compseasons?pageSize=20`, aflHeaders);
  const aflSeason = (compSeasons.compSeasons || []).find(item => item.name.startsWith(String(SEASON)));
  if (!aflSeason) throw new Error(`AFL ${SEASON} competition season was not found`);
  const seasonDetail = await fetchJson(`${AFL_API}/compseasons/${aflSeason.id}`, aflHeaders);
  const rounds = seasonDetail.compSeasons?.[0]?.rounds || [];
  if (!rounds.length) throw new Error(`AFL ${SEASON} rounds were not found`);
  const roundPayloads = await mapWithConcurrency(rounds, 6, round =>
    fetchJson(`${AFL_API}/matches?compSeasonId=${aflSeason.id}&roundNumber=${round.roundNumber}&pageSize=50`, aflHeaders)
  );
  const aflMatches = roundPayloads.flatMap(payload => payload.matches || []);
  const aflLadderRaw = await fetchJson(
    `${AFL_API}/compseasons/${aflSeason.id}/ladders?roundNumber=${aflSeason.currentRoundNumber}`,
    aflHeaders
  );
  const nrlFixture = await fetchJson(NRL_FIXTURE_URL);
  const nrlMatches = nrlFixture.fixture?.match || [];

  const aflRecords = aflMatches.map(match => buildAflEvent(match, checkedAt, createdAtById));
  const nrlRecords = nrlMatches.map(match => buildNrlEvent(match, checkedAt, createdAtById));
  const participants = uniqueParticipants([...aflRecords, ...nrlRecords].map(record => record.participants));
  const events = sortedEvents([...aflRecords, ...nrlRecords].map(record => record.event));
  const ladderSnapshots = [
    buildAflLadder(aflLadderRaw, checkedAt),
    buildNrlLadder(nrlRecords.map(record => record.event), participants, checkedAt),
  ];
  const bundle = {
    schemaVersion: "canonical-sports.v1",
    taxonomyVersion: taxonomy.schemaVersion,
    season: SEASON,
    generatedAt: checkedAt,
    sources: [
      eventSource("AFL", "https://www.afl.com.au/fixture", "official", checkedAt),
      eventSource("NRL Match Centre / Champion Data", "https://www.nrl.com/draw", "official-provider", checkedAt),
    ],
    sportDomains: taxonomy.sportDomains,
    competitionFamilies: taxonomy.competitionFamilies,
    competitions: taxonomy.competitions,
    participants,
    events,
    ladderSnapshots,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(`Canonical sports refreshed: ${aflMatches.length} AFL fixtures, ${nrlMatches.length} NRL fixtures, ${participants.length} teams.`);
  console.log(`Ladders: ${ladderSnapshots.map(snapshot => `${snapshot.competitionId} (${snapshot.entries.length})`).join(", ")}.`);
  console.log(path.relative(process.cwd(), OUTPUT_PATH));
}

if (require.main === module){
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildAflEvent,
  buildNrlEvent,
  buildAflLadder,
  buildNrlLadder,
  nrlVenueTimezone,
};
