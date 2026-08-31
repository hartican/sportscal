#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const taxonomy = require("../config/canonical-sports-taxonomy.js");

const SEASON = 2026;
const OUTPUT_PATH = path.resolve(__dirname, "../data/canonical/afl-nrl-2026.json");
const AFL_API = "https://aflapi.afl.com.au/afl/v2";
const NRL_FIXTURE_URL = "https://mc.championdata.com/data/12999/fixture.json";
const ESPN_NRL_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/rugby-league/3/scoreboard";
const ESPN_NRL_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/rugby-league/3/standings?season=2026";
const NRL_RESULT_GRACE_MS = 4 * 60 * 60 * 1000;
const NRL_MATCH_TIME_TOLERANCE_MS = 12 * 60 * 60 * 1000;
const CANONICAL_FETCH_RETRIES = Math.max(2, Number.parseInt(process.env.CANONICAL_FETCH_RETRIES || "3", 10));
const CANONICAL_FETCH_RETRY_DELAY_MS = Math.max(250, Number.parseInt(process.env.CANONICAL_FETCH_RETRY_DELAY_MS || "1000", 10));
const CANONICAL_FETCH_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CANONICAL_FETCH_TIMEOUT_MS || "15000", 10));
const NRL_OFFICIAL_RESULT_CORRECTIONS = Object.freeze({
  // Champion Data still reports 44-18. The NRL match centre and play-by-play both confirm 44-16.
  "129991007": Object.freeze({
    roundNumber: 10,
    homeTeam: "Storm",
    awayTeam: "Wests Tigers",
    homeScore: 44,
    awayScore: 16,
    sourceUrl: "https://www.nrl.com/draw/nrl-premiership/2026/round-10/storm-v-wests-tigers/",
  }),
});

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
  const requestHeaders = {
    Accept: "application/json",
    "User-Agent": "nothingsport-canonical-refresh/1.0",
    ...headers,
  };
  let lastError = null;

  for (let attempt = 1; attempt <= CANONICAL_FETCH_RETRIES; attempt += 1){
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), CANONICAL_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: requestHeaders,
        signal: abortController.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
      return response.json();
    } catch (error){
      clearTimeout(timeout);
      lastError = error;
      if (attempt >= CANONICAL_FETCH_RETRIES) break;
      const backoffMs = CANONICAL_FETCH_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.error(`Fetch failed for ${url} (${attempt}/${CANONICAL_FETCH_RETRIES}); retrying in ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
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

function readExistingCanonicalBundle(){
  try{
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  }catch(_error){
    return null;
  }
}

function existingCreatedAtById(bundle = readExistingCanonicalBundle()){
  return new Map((bundle?.events || []).map(event => [event.id, event.createdAt]));
}

function ladderRoundNumber(snapshot){
  const match = String(snapshot?.id || "").match(/:round-(\d+)$/);
  return match ? Number(match[1]) : NaN;
}

function selectFreshestLadderSnapshot(candidate, stored){
  if (!stored || stored.competitionId !== candidate.competitionId) return candidate;
  const candidateRound = ladderRoundNumber(candidate);
  const storedRound = ladderRoundNumber(stored);
  if (Number.isFinite(candidateRound) && Number.isFinite(storedRound)){
    if (candidateRound > storedRound) return candidate;
    if (candidateRound < storedRound) return stored;
  }
  const candidateTime = Date.parse(candidate.snapshotTimeUtc || "");
  const storedTime = Date.parse(stored.snapshotTimeUtc || "");
  if (!Number.isFinite(candidateTime)) return Number.isFinite(storedTime) ? stored : candidate;
  if (Number.isFinite(storedTime) && candidateTime < storedTime) return stored;
  return candidate;
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

function nrlTeamKey(value){
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function parseEspnNrlResults(payload, checkedAt){
  return (payload?.events || []).flatMap(scoreboardEvent => {
    const competition = scoreboardEvent.competitions?.[0];
    const status = scoreboardEvent.status?.type || competition?.status?.type || {};
    if (status.completed !== true || status.state !== "post") return [];
    const home = competition?.competitors?.find(competitor => competitor.homeAway === "home");
    const away = competition?.competitors?.find(competitor => competitor.homeAway === "away");
    const homeScore = Number(home?.score);
    const awayScore = Number(away?.score);
    const homeName = home?.team?.displayName || home?.team?.shortDisplayName || home?.team?.name;
    const awayName = away?.team?.displayName || away?.team?.shortDisplayName || away?.team?.name;
    const startTimeUtc = normalizeIso(scoreboardEvent.date || competition?.date);
    if (
      !homeName
      || !awayName
      || !startTimeUtc
      || !Number.isFinite(homeScore)
      || !Number.isFinite(awayScore)
      || homeScore < 0
      || awayScore < 0
      || homeScore > 200
      || awayScore > 200
    ) return [];
    const sourceId = String(scoreboardEvent.id || competition?.id || "");
    return [{
      sourceId,
      homeName,
      awayName,
      homeTeamKey: nrlTeamKey(homeName),
      awayTeamKey: nrlTeamKey(awayName),
      homeScore,
      awayScore,
      startTimeUtc,
      source: eventSource(
        "ESPN",
        sourceId ? `https://www.espn.com.au/nrl/match/_/gameId/${sourceId}/league/3` : "https://www.espn.com.au/nrl/",
        "reputable",
        checkedAt
      ),
    }];
  });
}

function applyOfficialNrlResultCorrections(matches, checkedAt){
  const correctedMatchIds = [];
  const correctedMatches = matches.map(match => {
    const correction = NRL_OFFICIAL_RESULT_CORRECTIONS[String(match.matchId)];
    if (!correction) return match;
    if (
      Number(match.roundNumber) !== correction.roundNumber
      || nrlTeamKey(match.homeSquadNickname || match.homeSquadName) !== nrlTeamKey(correction.homeTeam)
      || nrlTeamKey(match.awaySquadNickname || match.awaySquadName) !== nrlTeamKey(correction.awayTeam)
    ){
      throw new Error(`NRL official result correction identity mismatch for match ${match.matchId}`);
    }
    correctedMatchIds.push(match.matchId);
    return {
      ...match,
      matchStatus: "complete",
      homeSquadScore: correction.homeScore,
      awaySquadScore: correction.awayScore,
      resultSource: eventSource("NRL", correction.sourceUrl, "official", checkedAt),
    };
  });
  return { matches: correctedMatches, correctedMatchIds };
}

function nrlSupplementalMatchCandidates(match, supplementalResults){
  const homeTeamKey = nrlTeamKey(match.homeSquadNickname || match.homeSquadName);
  const awayTeamKey = nrlTeamKey(match.awaySquadNickname || match.awaySquadName);
  const startTime = Date.parse(match.utcStartTime || match.localStartTime || "");
  if (!homeTeamKey || !awayTeamKey || !Number.isFinite(startTime)) return [];
  return supplementalResults.filter(result =>
    result.homeTeamKey === homeTeamKey
    && result.awayTeamKey === awayTeamKey
    && Math.abs(Date.parse(result.startTimeUtc) - startTime) <= NRL_MATCH_TIME_TOLERANCE_MS
  );
}

function reconcileNrlResults(matches, supplementalResults, checkedAt){
  const promotedMatchIds = [];
  const verifiedMatchIds = [];
  const usedSupplementalSourceIds = new Set();
  const reconciledMatches = matches.map(match => {
    const candidates = nrlSupplementalMatchCandidates(match, supplementalResults);
    if (candidates.length > 1){
      throw new Error(`NRL supplemental result is ambiguous for match ${match.matchId}`);
    }
    if (!candidates.length) return match;
    const candidate = candidates[0];
    if (usedSupplementalSourceIds.has(candidate.sourceId)){
      throw new Error(`NRL supplemental result ${candidate.sourceId} matched more than one official-provider fixture`);
    }
    usedSupplementalSourceIds.add(candidate.sourceId);
    const officialStatus = nrlStatus(match.matchStatus);
    if (["postponed", "cancelled"].includes(officialStatus)){
      throw new Error(`NRL supplemental final conflicts with official-provider ${officialStatus} status for match ${match.matchId}`);
    }
    if (officialStatus === "completed"){
      const officialHomeScore = Number(match.homeSquadScore);
      const officialAwayScore = Number(match.awaySquadScore);
      if (officialHomeScore !== candidate.homeScore || officialAwayScore !== candidate.awayScore){
        throw new Error(
          `NRL supplemental result ${candidate.homeScore}-${candidate.awayScore} conflicts with official-provider score ${officialHomeScore}-${officialAwayScore} for match ${match.matchId}`
        );
      }
      verifiedMatchIds.push(match.matchId);
      return match;
    }
    promotedMatchIds.push(match.matchId);
    return {
      ...match,
      matchStatus: "complete",
      homeSquadScore: candidate.homeScore,
      awaySquadScore: candidate.awayScore,
      resultSource: { ...candidate.source, checkedAt },
    };
  });
  return { matches: reconciledMatches, promotedMatchIds, verifiedMatchIds };
}

function espnStatValue(entry, name){
  const stat = (entry?.stats || []).find(item => item.name === name);
  return stat ? Number(stat.value) : NaN;
}

function parseEspnNrlStandings(payload, checkedAt){
  const entries = (payload?.children || []).flatMap(child => child?.standings?.entries || []).map(entry => ({
    teamName: entry.team?.displayName || entry.team?.shortDisplayName || entry.team?.name,
    teamKey: nrlTeamKey(entry.team?.displayName || entry.team?.shortDisplayName || entry.team?.name),
    rank: espnStatValue(entry, "rank"),
    played: espnStatValue(entry, "gamesPlayed"),
    won: espnStatValue(entry, "gamesWon"),
    drawn: espnStatValue(entry, "gamesDrawn"),
    lost: espnStatValue(entry, "gamesLost"),
    byes: espnStatValue(entry, "gamesBye"),
    pointsFor: espnStatValue(entry, "pointsFor"),
    pointsAgainst: espnStatValue(entry, "pointsAgainst"),
    pointsDifference: espnStatValue(entry, "pointsDifference"),
    ladderPoints: espnStatValue(entry, "points"),
  })).filter(entry => entry.teamName && [
    entry.rank,
    entry.played,
    entry.won,
    entry.drawn,
    entry.lost,
    entry.byes,
    entry.pointsFor,
    entry.pointsAgainst,
    entry.pointsDifference,
    entry.ladderPoints,
  ].every(Number.isFinite));
  return {
    entries,
    source: eventSource("ESPN", "https://www.espn.com.au/rugby-league/table", "reputable", checkedAt),
  };
}

function validateNrlLadderAgainstIndependentTable(ladder, participants, independentTable){
  if (independentTable.entries.length < 17){
    throw new Error(`Independent NRL standings returned ${independentTable.entries.length} complete rows; expected at least 17`);
  }
  const participantsById = new Map(participants.map(participant => [participant.id, participant]));
  const localByTeam = new Map(ladder.entries.map(entry => {
    const participant = participantsById.get(entry.participantId);
    return [nrlTeamKey(participant?.displayName || participant?.canonicalName), entry];
  }));
  const independentCompletedMatches = independentTable.entries.reduce((total, entry) => total + entry.played, 0) / 2;
  const localCompletedMatches = Number(ladder.metadata?.completedMatches || 0);
  if (independentCompletedMatches < localCompletedMatches){
    return {
      status: "independent-source-lagging",
      localCompletedMatches,
      independentCompletedMatches,
      checkedAt: independentTable.source.checkedAt,
    };
  }
  if (independentCompletedMatches > localCompletedMatches){
    throw new Error(
      `Independent NRL standings include ${independentCompletedMatches} matches but the reconciled official fixture includes ${localCompletedMatches}`
    );
  }
  const fields = ["rank", "played", "won", "drawn", "lost", "byes", "pointsFor", "pointsAgainst", "pointsDifference", "ladderPoints"];
  const differences = [];
  independentTable.entries.forEach(independentEntry => {
    const localEntry = localByTeam.get(independentEntry.teamKey);
    if (!localEntry){
      differences.push(`${independentEntry.teamName}: missing local team`);
      return;
    }
    const mismatches = fields
      .filter(field => localEntry[field] !== independentEntry[field])
      .map(field => `${field} ${localEntry[field]} != ${independentEntry[field]}`);
    if (mismatches.length) differences.push(`${independentEntry.teamName}: ${mismatches.join(", ")}`);
  });
  if (differences.length){
    throw new Error(`Recalculated NRL ladder differs from the independent standings: ${differences.join("; ")}`);
  }
  return {
    status: "matched",
    localCompletedMatches,
    independentCompletedMatches,
    checkedAt: independentTable.source.checkedAt,
  };
}

function nrlScoreboardDate(match){
  const localDate = String(match.localStartTime || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (localDate) return `${localDate[1]}${localDate[2]}${localDate[3]}`;
  const start = new Date(match.utcStartTime || "");
  if (Number.isNaN(start.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(start).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

async function fetchNrlSupplementalResults(matches, checkedAt){
  const checkedTime = Date.parse(checkedAt);
  const startedMatches = matches.filter(match => {
    const startTime = Date.parse(match.utcStartTime || match.localStartTime || "");
    return Number.isFinite(startTime) && startTime <= checkedTime;
  });
  const activeRound = Math.max(0, ...startedMatches.map(match => Number(match.roundNumber || 0)));
  const dates = Array.from(new Set(startedMatches
    .filter(match => Number(match.roundNumber) === activeRound)
    .map(nrlScoreboardDate)
    .filter(Boolean)))
    .sort();
  const responses = await Promise.allSettled(dates.map(date => fetchJson(`${ESPN_NRL_SCOREBOARD_URL}?dates=${date}`)));
  const failedDates = [];
  const results = [];
  responses.forEach((response, index) => {
    if (response.status === "rejected"){
      failedDates.push(dates[index]);
      return;
    }
    results.push(...parseEspnNrlResults(response.value, checkedAt));
  });
  const uniqueResults = Array.from(new Map(results.map(result => [
    result.sourceId || `${result.homeTeamKey}:${result.awayTeamKey}:${result.startTimeUtc}`,
    result,
  ])).values());
  return { activeRound, dates, failedDates, results: uniqueResults };
}

function overdueUnresolvedNrlMatches(matches, checkedAt){
  const checkedTime = Date.parse(checkedAt);
  return matches.filter(match => {
    if (["completed", "postponed", "cancelled"].includes(nrlStatus(match.matchStatus))) return false;
    const startTime = Date.parse(match.utcStartTime || match.localStartTime || "");
    return Number.isFinite(startTime) && startTime + NRL_RESULT_GRACE_MS <= checkedTime;
  });
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
  if (result){
    if (match.resultSource) result.source = match.resultSource;
    event.result = result;
  }
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
  const rounds = new Map();
  events.forEach(event => {
    const list = rounds.get(event.roundNumber) || [];
    list.push(event);
    rounds.set(event.roundNumber, list);
  });
  const latestResultRound = Math.max(0, ...Array.from(rounds.entries())
    .filter(([, matches]) => matches.some(match => match.status === "completed"))
    .map(([round]) => round));
  const checkedTime = Date.parse(checkedAt);
  const latestStartedRound = Math.max(latestResultRound, ...Array.from(rounds.entries())
    .filter(([, matches]) => matches.some(match =>
      match.status === "live"
      || match.status === "completed"
      || (Number.isFinite(Date.parse(match.startTimeUtc || "")) && Date.parse(match.startTimeUtc) <= checkedTime)
    ))
    .map(([round]) => round));
  const completedRound = Math.max(0, ...Array.from(rounds.entries())
    .filter(([, matches]) => matches.length > 0 && matches.every(match => match.status === "completed"))
    .map(([round]) => round));
  const roundInProgress = latestStartedRound > completedRound;
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

  for (let round = 1; round <= latestResultRound; round += 1){
    const matches = rounds.get(round) || [];
    const completedMatches = matches.filter(match => match.status === "completed");
    if (!matches.length || !completedMatches.length) continue;
    const scheduledIds = new Set();
    matches.forEach(match => {
      scheduledIds.add(match.homeParticipantId);
      scheduledIds.add(match.awayParticipantId);
    });
    completedMatches.forEach(match => {
      const home = rows.get(match.homeParticipantId);
      const away = rows.get(match.awayParticipantId);
      const scoreMatch = match.result?.scorelineText?.match(/—\s*(\d+)-(\d+)$/);
      if (!home || !away || !scoreMatch) return;
      const homeScore = Number(scoreMatch[1]);
      const awayScore = Number(scoreMatch[2]);
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
      if (scheduledIds.has(row.participantId)) return;
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

  const partialResultRound = latestResultRound > completedRound;
  const representedCompletedMatches = events.filter(event =>
    event.roundNumber <= latestResultRound && event.status === "completed"
  );
  const pendingCompletedMatches = events.filter(event =>
    event.roundNumber > latestResultRound && event.status === "completed"
  );
  const supplementedMatches = representedCompletedMatches.filter(event => event.result?.source?.provider === "ESPN").length;

  return {
    id: `ladder:nrl-premiership-2026:round-${latestResultRound}`,
    competitionId: "competition:nrl-premiership-2026",
    seasonLabel: String(SEASON),
    roundLabel: partialResultRound
      ? `Updated through completed matches in Round ${latestResultRound}`
      : `Up to date through completed Round ${completedRound}`,
    snapshotTimeUtc: checkedAt,
    entries,
    source: eventSource(
      "NRL Match Centre / Champion Data",
      "https://www.nrl.com/ladder",
      "official-provider",
      checkedAt
    ),
    metadata: {
      calculation: "Every confirmed completed match through the latest result-bearing round, with independently verified finals used only when the official-provider status lags; byes come from the full fixture and ranking uses points then differential",
      roundStatus: roundInProgress ? "in-progress" : "completed",
      activeRound: latestStartedRound,
      lastFullyCompletedRound: completedRound,
      representedThroughRound: latestResultRound,
      completedMatches: representedCompletedMatches.length,
      pendingCompletedMatches: pendingCompletedMatches.length,
      ongoingRoundCompletedMatches: partialResultRound
        ? representedCompletedMatches.filter(event => event.roundNumber === latestResultRound).length
        : 0,
      supplementedMatches,
    },
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

function validatedExistingBundleForTransientFailure(){
  const payload = readExistingCanonicalBundle();
  if (payload?.schemaVersion !== "canonical-sports.v1"
    || !Array.isArray(payload?.events) || !payload.events.length
    || !Array.isArray(payload?.participants) || !payload.participants.length
    || !Array.isArray(payload?.ladderSnapshots) || payload.ladderSnapshots.length < 2){
    throw new Error("Existing canonical AFL/NRL bundle is not safe to preserve");
  }
  return payload;
}

function isTransientSourceFailure(error){
  return /fetch failed|timed?\s*out|abort|network|socket|econn|enotfound|eai_again/i.test(String(error?.message || error));
}

async function main(){
  const checkedAt = new Date().toISOString();
  const existingBundle = readExistingCanonicalBundle();
  const createdAtById = existingCreatedAtById(existingBundle);
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
  const officialNrlMatches = nrlFixture.fixture?.match || [];
  const officialNrlCorrections = applyOfficialNrlResultCorrections(officialNrlMatches, checkedAt);
  const supplementalNrl = await fetchNrlSupplementalResults(officialNrlCorrections.matches, checkedAt);
  const nrlReconciliation = reconcileNrlResults(officialNrlCorrections.matches, supplementalNrl.results, checkedAt);
  const nrlMatches = nrlReconciliation.matches;
  const unresolvedNrlMatches = overdueUnresolvedNrlMatches(nrlMatches, checkedAt);
  if (unresolvedNrlMatches.length){
    const failures = supplementalNrl.failedDates.length
      ? `; supplemental fetch failed for ${supplementalNrl.failedDates.join(", ")}`
      : "";
    throw new Error(
      `NRL result reconciliation could not confirm overdue match(es): ${unresolvedNrlMatches.map(match => match.matchId).join(", ")}${failures}`
    );
  }

  const aflRecords = aflMatches.map(match => buildAflEvent(match, checkedAt, createdAtById));
  const nrlRecords = nrlMatches.map(match => buildNrlEvent(match, checkedAt, createdAtById));
  const preservedParticipants = (existingBundle?.participants || []).filter(participant => (
    !["sport:afl", "sport:nrl"].includes(participant.sportDomainId)
  ));
  const participants = uniqueParticipants([
    ...[...aflRecords, ...nrlRecords].map(record => record.participants),
    preservedParticipants,
  ]);
  const events = sortedEvents([...aflRecords, ...nrlRecords].map(record => record.event));
  const nrlLadder = buildNrlLadder(nrlRecords.map(record => record.event), participants, checkedAt);
  const independentNrlStandings = parseEspnNrlStandings(
    await fetchJson(ESPN_NRL_STANDINGS_URL),
    checkedAt
  );
  nrlLadder.metadata.independentValidation = validateNrlLadderAgainstIndependentTable(
    nrlLadder,
    participants,
    independentNrlStandings
  );
  const fetchedAflLadder = buildAflLadder(aflLadderRaw, checkedAt);
  const storedAflLadder = existingBundle?.ladderSnapshots?.find(snapshot =>
    snapshot.competitionId === fetchedAflLadder.competitionId
  );
  const aflLadder = selectFreshestLadderSnapshot(fetchedAflLadder, storedAflLadder);
  const preservedLadderSnapshots = (existingBundle?.ladderSnapshots || []).filter(snapshot => (
    ![aflLadder.competitionId, nrlLadder.competitionId].includes(snapshot.competitionId)
  ));
  const ladderSnapshots = [aflLadder, nrlLadder, ...preservedLadderSnapshots];
  const preservedSources = (existingBundle?.sources || []).filter(source => (
    source.provider === "Premier League"
  ));
  const bundle = {
    schemaVersion: "canonical-sports.v1",
    taxonomyVersion: taxonomy.schemaVersion,
    season: SEASON,
    generatedAt: checkedAt,
    sources: [
      eventSource("AFL", "https://www.afl.com.au/fixture", "official", checkedAt),
      eventSource("NRL Match Centre / Champion Data", "https://www.nrl.com/draw", "official-provider", checkedAt),
      independentNrlStandings.source,
      ...preservedSources,
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
  console.log(`Canonical sports refreshed: ${aflMatches.length} AFL fixtures, ${nrlMatches.length} NRL fixtures, ${participants.length} preserved/current teams.`);
  console.log(`NRL result reconciliation: ${officialNrlCorrections.correctedMatchIds.length} direct-official corrections, ${nrlReconciliation.verifiedMatchIds.length} independently verified, ${nrlReconciliation.promotedMatchIds.length} supplemented, ${supplementalNrl.failedDates.length} scoreboard fetch failures.`);
  console.log(`NRL independent standings check: ${nrlLadder.metadata.independentValidation.status}.`);
  if (aflLadder === storedAflLadder){
    console.log(`AFL ladder freshness guard: retained newer stored ${storedAflLadder.roundLabel} snapshot from ${storedAflLadder.snapshotTimeUtc}.`);
  }
  console.log(`Ladders: ${ladderSnapshots.map(snapshot => `${snapshot.competitionId} (${snapshot.entries.length})`).join(", ")}.`);
  console.log(path.relative(process.cwd(), OUTPUT_PATH));
}

if (require.main === module){
  main().catch(error => {
    if (isTransientSourceFailure(error)){
      try {
        const existing = validatedExistingBundleForTransientFailure();
        console.warn(`Canonical AFL/NRL sources temporarily unavailable; preserving ${existing.events.length} validated fixtures for immediate canonical checks.`);
        return;
      } catch (validationError){
        console.error(validationError.stack || validationError.message);
      }
    }
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildAflEvent,
  buildNrlEvent,
  buildAflLadder,
  buildNrlLadder,
  applyOfficialNrlResultCorrections,
  parseEspnNrlResults,
  parseEspnNrlStandings,
  reconcileNrlResults,
  selectFreshestLadderSnapshot,
  validateNrlLadderAgainstIndependentTable,
  nrlVenueTimezone,
};
