#!/usr/bin/env node

const https = require("node:https");
const { readJson, validateFeed, writeJson } = require("./lib/feed-utils");

const OFFICIAL_MATCHES_URL = "https://www.premierleague.com/en/matches/premier-league/2026-27";
const PULSE_FIXTURES_URL = "https://footballapi.pulselive.com/football/fixtures";
const COMPETITION_ID = 1;
const SEASON_ID = 841;
const PAGE_SIZE = 100;
const EXPECTED_FIXTURE_COUNT = 380;
const EXPECTED_TEAM_COUNT = 20;
const STAN_SPORT_URL = "https://www.stan.com.au/watch/sport/football/premier-league";
const STAN_RIGHTS_VERIFIED_AT = "2026-08-25T00:00:00.000Z";
const SYDNEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fetchJson(url){
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { Origin: "https://www.premierleague.com" } }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) return reject(new Error(`Premier League fixture service returned ${response.statusCode}.`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`Premier League fixture service returned invalid JSON: ${error.message}`)); }
      });
    });
    request.setTimeout(20_000, () => request.destroy(new Error("Premier League fixture service timed out.")));
    request.on("error", reject);
  });
}

async function loadFixtures(){
  const pages = [];
  for (let page = 0; ; page += 1){
    const query = new URLSearchParams({ comps: String(COMPETITION_ID), comp: String(COMPETITION_ID), compSeasons: String(SEASON_ID), page: String(page), pageSize: String(PAGE_SIZE), altIds: "true" });
    const payload = await fetchJson(`${PULSE_FIXTURES_URL}?${query}`);
    if (!Array.isArray(payload.content)) throw new Error("Premier League fixture service returned no fixture collection.");
    pages.push(...payload.content);
    if (page + 1 >= Number(payload.pageInfo?.numPages || 0)) break;
  }
  const fixtureIds = new Set(pages.map(fixture => fixture?.id).filter(Boolean));
  const teamIds = new Set(pages.flatMap(fixture => fixture?.teams || []).map(entry => entry?.team?.club?.id || entry?.team?.id).filter(Boolean));
  const gameweeks = new Set(pages.map(fixture => fixture?.gameweek?.gameweek).filter(Number.isInteger));
  if (pages.length !== EXPECTED_FIXTURE_COUNT || fixtureIds.size !== EXPECTED_FIXTURE_COUNT || teamIds.size !== EXPECTED_TEAM_COUNT || gameweeks.size !== 38) {
    throw new Error(`Premier League fixture refresh failed closed: expected ${EXPECTED_FIXTURE_COUNT} unique fixtures across ${EXPECTED_TEAM_COUNT} clubs and 38 gameweeks; received ${pages.length} fixtures, ${fixtureIds.size} unique fixtures, ${teamIds.size} clubs and ${gameweeks.size} gameweeks.`);
  }
  return pages;
}

function sydneyDateAndTime(utcMillis){
  const parts = Object.fromEntries(SYDNEY_FORMATTER.formatToParts(new Date(utcMillis)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function teamFromEntry(entry){
  const team = entry?.team;
  const name = String(team?.name || team?.club?.name || "").trim();
  const id = team?.club?.id || team?.id;
  if (!name || !id) throw new Error("Premier League fixture has an unresolved club identity.");
  return { id: `team:football:epl:${id}`, name };
}

function resultScoreline(fixture, home, away){
  const [homeEntry, awayEntry] = fixture.teams || [];
  const homeGoals = Number(homeEntry?.score);
  const awayGoals = Number(awayEntry?.score);
  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals)) return null;
  const outcomeText = homeGoals === awayGoals
    ? `${home.name} drew ${away.name} ${homeGoals}-${awayGoals}.`
    : homeGoals > awayGoals
      ? `${home.name} defeated ${away.name} ${homeGoals}-${awayGoals}.`
      : `${away.name} defeated ${home.name} ${awayGoals}-${homeGoals}.`;
  const margin = Math.abs(homeGoals - awayGoals);
  return {
    homeScore: homeGoals,
    awayScore: awayGoals,
    score: `${home.name} ${homeGoals}-${awayGoals} ${away.name}`,
    outcomeText,
    recapText: homeGoals === awayGoals
      ? `${home.name} and ${away.name} shared the points after a ${homeGoals}-${awayGoals} draw.`
      : `${homeGoals > awayGoals ? home.name : away.name} completed a ${margin}-goal win in Premier League Matchweek ${fixture.gameweek?.gameweek}.`,
  };
}

function cardForFixture(fixture, checkedAt){
  const [home, away] = (fixture.teams || []).map(teamFromEntry);
  if (!home || !away || !Number.isFinite(fixture?.kickoff?.millis)) throw new Error(`Premier League fixture ${fixture?.id || "unknown"} is missing teams or a confirmed kickoff.`);
  const startTimeUtc = new Date(fixture.kickoff.millis).toISOString();
  const { date, time } = sydneyDateAndTime(fixture.kickoff.millis);
  const completed = fixture.status === "C";
  const result = completed ? resultScoreline(fixture, home, away) : null;
  const gameweek = fixture.gameweek?.gameweek;
  const name = `${home.name} v ${away.name}`;
  return {
    id: `epl-2026-27-${fixture.id}`,
    eventId: `epl-2026-27-${fixture.id}`,
    canonicalEventId: `event:premier-league:${fixture.id}`,
    canonicalSourceId: String(fixture.id),
    canonicalSourceName: "Premier League official fixture service",
    canonicalSourceUrl: OFFICIAL_MATCHES_URL,
    canonicalSourceCheckedAt: checkedAt,
    canonicalSourceType: "official",
    sport: "Football",
    key: "premier-league",
    sportDomainId: "sport:football",
    competitionId: "competition:premier-league-2026-27",
    name,
    displayTitleCompact: name,
    participants: [{ name: home.name, role: "home" }, { name: away.name, role: "away" }],
    participantIds: [home.id, away.id],
    homeParticipantId: home.id,
    awayParticipantId: away.id,
    date,
    time,
    startTimeUtc,
    endTimeUtc: new Date(fixture.kickoff.millis + 2 * 60 * 60 * 1000).toISOString(),
    broadcaster: "Stan Sport",
    broadcasterIds: ["stan"],
    broadcastOptions: ["Stan Sport"],
    viewingOptions: [{
      providerId: "stan",
      serviceId: "stan",
      serviceLabel: "Stan Sport",
      territory: "AU",
      accessType: "subscription",
      liveOrReplay: completed ? "replay" : "live",
      rightsScope: "competition",
      webUrl: STAN_SPORT_URL,
      sourceUrl: STAN_SPORT_URL,
      verifiedAt: STAN_RIGHTS_VERIFIED_AT,
    }],
    venue: fixture.ground?.name || null,
    scheduleStatus: fixture.provisionalKickoff?.millis === fixture.kickoff?.millis ? "confirmed" : "provisional",
    status: completed ? "completed" : "upcoming",
    expected: 6,
    liveWindow: 3,
    round: "all",
    narrativeType: "regular-season-fixture",
    selectedSentence: `Premier League Matchweek ${gameweek} fixture, with the confirmed kick-off sourced from the official schedule.`,
    fullSpiel: `${name} is listed in the Premier League's official 2026/27 schedule. Kick-off and venue details will refresh from the league if the fixture moves.`,
    sourceName: "Premier League official fixture schedule",
    sourceUrl: OFFICIAL_MATCHES_URL,
    sourceCheckedAt: checkedAt,
    sourceType: "official",
    sourceTrust: "verified",
    lastReviewedAt: checkedAt,
    replayEligible: completed,
    highlightEligible: completed,
    briefingEligible: false,
    catchupEligible: completed,
    resultLabels: [`Premier League Matchweek ${gameweek}`],
    ...(result ? {
      ...result,
      canonicalResultScoreline: result.score,
      resultLabels: [`Premier League Matchweek ${gameweek}`, result.outcomeText],
    } : {}),
  };
}

async function refreshPremierLeagueCards(inputPath = "feeds/incoming/events.json", outputPath = inputPath){
  const checkedAt = new Date().toISOString();
  const fixtures = await loadFixtures();
  const cards = fixtures.map(fixture => cardForFixture(fixture, checkedAt));
  const feed = readJson(inputPath);
  const retained = (feed.events || []).filter(event => event.key !== "premier-league");
  const next = { ...feed, events: [...retained, ...cards].sort((left, right) => String(left.startTimeUtc || "").localeCompare(String(right.startTimeUtc || ""))) };
  const errors = validateFeed(next);
  if (errors.length) throw new Error(`Premier League cards failed feed validation:\n${errors.join("\n")}`);
  writeJson(outputPath, next);
  console.log(`Refreshed ${cards.length} Premier League 2026/27 fixtures in ${outputPath}.`);
  return next;
}

if (require.main === module){
  refreshPremierLeagueCards(process.argv[2], process.argv[3]).catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { cardForFixture, loadFixtures, refreshPremierLeagueCards, resultScoreline, sydneyDateAndTime };
