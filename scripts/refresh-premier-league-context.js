#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const taxonomy = require("../config/canonical-sports-taxonomy.js");

const ROOT = path.resolve(__dirname, "..");
const BUNDLE_PATH = path.join(ROOT, "data/canonical/afl-nrl-2026.json");
const DIRECTORY_PATH = path.join(ROOT, "data/canonical/football-directory.v1.json");
const COMPETITION_ID = "competition:premier-league-2026-27";
const PULSE_COMPETITION_ID = 1;
const PULSE_SEASON_ID = 841;
const EXPECTED_TEAM_COUNT = 20;
const SOURCE_URL = "https://www.premierleague.com/en/tables/premier-league/2026-27";
const STANDINGS_URL = `https://footballapi.pulselive.com/football/standings?compSeasons=${PULSE_SEASON_ID}&comps=${PULSE_COMPETITION_ID}&comp=${PULSE_COMPETITION_ID}&altIds=true&page=0&pageSize=100`;

function fetchJson(url){
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: "application/json",
        Origin: "https://www.premierleague.com",
        "User-Agent": "nothingsport-premier-league-standings/1.0",
      },
    }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) return reject(new Error(`Premier League standings service returned ${response.statusCode}.`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`Premier League standings service returned invalid JSON: ${error.message}`)); }
      });
    });
    request.setTimeout(20_000, () => request.destroy(new Error("Premier League standings service timed out.")));
    request.on("error", reject);
  });
}

function officialSource(checkedAt){
  return {
    provider: "Premier League",
    sourceUrl: SOURCE_URL,
    sourceType: "official",
    checkedAt,
  };
}

function standingsEntries(payload){
  if (Number(payload?.compSeason?.id) !== PULSE_SEASON_ID || Number(payload?.compSeason?.competition?.id) !== PULSE_COMPETITION_ID){
    throw new Error("Premier League standings refresh failed closed: unexpected competition or season identity.");
  }
  const entries = payload?.tables?.[0]?.entries;
  if (!Array.isArray(entries)) throw new Error("Premier League standings refresh failed closed: no table entries were returned.");
  const normalized = entries.map(entry => {
    const clubId = entry?.team?.club?.id || entry?.team?.id;
    const overall = entry?.overall;
    if (!Number.isInteger(clubId) || !Number.isInteger(entry?.position) || !overall){
      throw new Error("Premier League standings refresh failed closed: a club identity or position is unresolved.");
    }
    const numericFields = ["played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "goalsDifference", "points"];
    if (numericFields.some(field => !Number.isFinite(Number(overall[field])))){
      throw new Error(`Premier League standings refresh failed closed: club ${clubId} has incomplete statistics.`);
    }
    return {
      participantId: `team:football:epl:${clubId}`,
      rank: entry.position,
      played: Number(overall.played),
      won: Number(overall.won),
      drawn: Number(overall.drawn),
      lost: Number(overall.lost),
      pointsFor: Number(overall.goalsFor),
      pointsAgainst: Number(overall.goalsAgainst),
      pointsDifference: Number(overall.goalsDifference),
      ladderPoints: Number(overall.points),
    };
  });
  const expectedRanks = Array.from({ length: EXPECTED_TEAM_COUNT }, (_, index) => index + 1);
  const ranks = normalized.map(entry => entry.rank).sort((a, b) => a - b);
  const participantIds = new Set(normalized.map(entry => entry.participantId));
  if (normalized.length !== EXPECTED_TEAM_COUNT || participantIds.size !== EXPECTED_TEAM_COUNT || ranks.some((rank, index) => rank !== expectedRanks[index])){
    throw new Error(`Premier League standings refresh failed closed: expected ${EXPECTED_TEAM_COUNT} unique clubs ranked 1-${EXPECTED_TEAM_COUNT}.`);
  }
  return normalized.sort((first, second) => first.rank - second.rank);
}

function canonicalParticipants(entries, directory){
  const directoryTeams = new Map((directory?.teams || []).map(team => [team.id, team]));
  return entries.map(entry => {
    const team = directoryTeams.get(entry.participantId);
    if (!team || team.leagueId !== "competition:premier-league"){
      throw new Error(`Premier League standings refresh failed closed: ${entry.participantId} is absent from the canonical football directory.`);
    }
    return {
      id: team.id,
      type: "team",
      sportDomainId: "sport:football",
      displayName: team.displayName,
      shortName: team.shortName || team.displayName,
      canonicalName: team.displayName,
    };
  });
}

function buildSnapshot(payload, directory, checkedAt){
  const entries = standingsEntries(payload);
  const participants = canonicalParticipants(entries, directory);
  const maximumPlayed = Math.max(0, ...entries.map(entry => entry.played));
  return {
    participants,
    snapshot: {
      id: "ladder:premier-league-2026-27:current",
      competitionId: COMPETITION_ID,
      seasonLabel: "2026/27",
      roundLabel: maximumPlayed ? `After Matchweek ${maximumPlayed}` : "Pre-season",
      snapshotTimeUtc: checkedAt,
      entries,
      source: officialSource(checkedAt),
      metadata: {
        coverageStatus: "complete",
        clubCount: EXPECTED_TEAM_COUNT,
        dynamicallyGenerated: payload.dynamicallyGenerated === true,
        roundStatus: payload.live === true ? "in-progress" : "complete",
      },
    },
  };
}

function updateBundle(bundle, context, checkedAt){
  const participantIds = new Set(context.participants.map(participant => participant.id));
  const participants = [
    ...(bundle.participants || []).filter(participant => !participantIds.has(participant.id)),
    ...context.participants,
  ];
  const ladderSnapshots = [
    ...(bundle.ladderSnapshots || []).filter(snapshot => snapshot.competitionId !== COMPETITION_ID),
    context.snapshot,
  ];
  const source = officialSource(checkedAt);
  const sources = [
    ...(bundle.sources || []).filter(item => !(item.provider === source.provider && item.sourceUrl === source.sourceUrl)),
    source,
  ];
  return {
    ...bundle,
    taxonomyVersion: taxonomy.schemaVersion,
    generatedAt: checkedAt,
    sources,
    sportDomains: taxonomy.sportDomains,
    competitionFamilies: taxonomy.competitionFamilies,
    competitions: taxonomy.competitions,
    participants,
    ladderSnapshots,
  };
}

function validatePublishedContext(bundle){
  const competition = (bundle.competitions || []).find(item => item.id === COMPETITION_ID);
  if (!competition || competition.standingsType !== "leagueTable" || competition.supportsLadder !== true){
    throw new Error("Premier League canonical competition is missing its league-table contract.");
  }
  const snapshot = (bundle.ladderSnapshots || []).find(item => item.competitionId === COMPETITION_ID);
  if (!snapshot) throw new Error("Premier League canonical standings snapshot is missing.");
  const entries = snapshot.entries || [];
  const ids = new Set(entries.map(entry => entry.participantId));
  if (entries.length !== EXPECTED_TEAM_COUNT || ids.size !== EXPECTED_TEAM_COUNT){
    throw new Error("Premier League canonical standings must contain exactly 20 unique clubs.");
  }
  const expectedRanks = Array.from({ length: EXPECTED_TEAM_COUNT }, (_, index) => index + 1);
  const ranks = entries.map(entry => entry.rank).sort((first, second) => first - second);
  const requiredNumericFields = ["played", "won", "drawn", "lost", "pointsFor", "pointsAgainst", "pointsDifference", "ladderPoints"];
  if (ranks.some((rank, index) => rank !== expectedRanks[index])
    || entries.some(entry => requiredNumericFields.some(field => !Number.isFinite(entry[field])))){
    throw new Error("Premier League canonical standings contain invalid ranks or league-table statistics.");
  }
  const participants = new Set((bundle.participants || []).map(item => item.id));
  if (entries.some(entry => !participants.has(entry.participantId))){
    throw new Error("Premier League canonical standings contain an unresolved participant.");
  }
  return snapshot;
}

async function refresh({ fetcher = fetchJson, bundlePath = BUNDLE_PATH, directoryPath = DIRECTORY_PATH, now = () => new Date() } = {}){
  const checkedAt = now().toISOString();
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const directory = JSON.parse(fs.readFileSync(directoryPath, "utf8"));
  const payload = await fetcher(STANDINGS_URL);
  const context = buildSnapshot(payload, directory, checkedAt);
  const next = updateBundle(bundle, context, checkedAt);
  validatePublishedContext(next);
  const temporaryPath = `${bundlePath}.premier-league.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(temporaryPath, bundlePath);
  console.log(`Premier League standings refreshed: ${context.snapshot.entries.length} clubs from the official table.`);
  return next;
}

if (require.main === module){
  if (process.argv.includes("--check")){
    try{
      const snapshot = validatePublishedContext(JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8")));
      console.log(`Premier League canonical context valid: ${snapshot.entries.length} clubs.`);
    }catch(error){
      console.error(error.stack || error.message);
      process.exit(1);
    }
  } else {
    refresh().catch(error => {
      console.error(error.stack || error.message);
      process.exit(1);
    });
  }
}

module.exports = {
  COMPETITION_ID,
  EXPECTED_TEAM_COUNT,
  buildSnapshot,
  refresh,
  standingsEntries,
  updateBundle,
  validatePublishedContext,
};
