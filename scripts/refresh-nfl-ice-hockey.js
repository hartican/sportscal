#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const NFL_PATH = path.join(ROOT, "data/canonical/american-football-directory.v1.json");
const ICE_HOCKEY_PATH = path.join(ROOT, "data/canonical/ice-hockey-directory.v1.json");
const NHL_SEASON = "20262027";
const NFL_SEASON = 2026;

async function fetchJson(url){
  const response = await fetch(url, { headers:{ accept:"application/json", "user-agent":"nothingSport canonical refresh/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchText(url){
  const response = await fetch(url, { headers:{ accept:"text/html", "user-agent":"nothingSport canonical refresh/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function mapLimit(values, limit, mapper){
  const result = new Array(values.length);
  let cursor = 0;
  async function worker(){
    while (cursor < values.length){
      const index = cursor++;
      result[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, values.length) }, worker));
  return result;
}

function writeJson(filePath, payload){
  fs.mkdirSync(path.dirname(filePath), { recursive:true });
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) return false;
  fs.writeFileSync(filePath, content);
  return true;
}

function isoParts(value){
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date:null, time:null };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Australia/Sydney", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(date).reduce((output, part) => ({ ...output, [part.type]:part.value }), {});
  return { date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}` };
}

function nflRosterItems(payload){
  return (payload?.athletes || []).flatMap(group => group?.items || []);
}

function nflFixture(event){
  const competition = event?.competitions?.[0] || {};
  const sides = (competition.competitors || []).map(side => ({
    participantId:`team:nfl:${String(side?.team?.abbreviation || side?.team?.id || "").toLowerCase()}`,
    label:side?.team?.displayName || side?.team?.shortDisplayName || "TBC",
    homeAway:side?.homeAway || null,
    score:side?.score?.displayValue || side?.score || null,
    logoUrl:side?.team?.logos?.find(logo => logo.rel?.includes("default"))?.href || side?.team?.logo || null,
  }));
  const local = isoParts(event?.date);
  const completed = event?.status?.type?.completed === true;
  return {
    id:`fixture:nfl:${event.id}`,
    sportDomainId:"sport:american-football",
    competitionId:"competition:nfl",
    name:event?.name || event?.shortName || "NFL fixture",
    date:local.date,
    time:local.time,
    startTimeUtc:event?.date || null,
    venue:competition?.venue?.fullName || null,
    status:completed ? "completed" : "upcoming",
    scheduleStatus:event?.timeValid === false || competition?.timeValid === false ? "provisional" : "confirmed",
    roundLabel:event?.week?.text || (event?.week?.number ? `Week ${event.week.number}` : event?.seasonType?.name || null),
    roundNumber:Number.isFinite(Number(event?.week?.number)) ? Number(event.week.number) : null,
    participantSlots:sides,
    sourceUrl:event?.links?.find(link => link.rel?.includes("summary"))?.href || null,
  };
}

async function buildNfl(){
  const [teamsPayload, leagueSchedule] = await Promise.all([
    fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"),
    fetchJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${NFL_SEASON}&limit=1000`),
  ]);
  const sourceTeams = teamsPayload?.sports?.[0]?.leagues?.[0]?.teams?.map(entry => entry.team).filter(team => team?.isActive !== false) || [];
  const teamResults = await mapLimit(sourceTeams, 6, async team => {
    const abbreviation = String(team.abbreviation || "").toLowerCase();
    const roster = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbreviation}/roster`);
    const teamId = `team:nfl:${abbreviation}`;
    const logoUrl = team.logos?.find(logo => logo.rel?.includes("default") && !logo.rel?.includes("dark"))?.href || null;
    const logoDarkUrl = team.logos?.find(logo => logo.rel?.includes("dark"))?.href || logoUrl;
    return {
      team:{
        id:teamId, displayName:team.displayName, shortName:team.shortDisplayName || team.name,
        aliases:[team.abbreviation, team.location, team.name].filter(Boolean), active:true,
        entityType:"team", leagueId:"competition:nfl", countryCode:"US", countryBasis:"league-registration",
        genderCategory:"male", identityId:teamId, logoUrl, logoDarkUrl,
        sourceRefs:(team.links || []).filter(link => link.rel?.includes("roster") || link.rel?.includes("clubhouse")).map(link => link.href),
      },
      players:nflRosterItems(roster).map(player => ({
        id:`athlete:nfl:${player.id}`, displayName:player.displayName || player.fullName,
        shortName:player.shortName || null, aliases:[player.fullName, player.displayName, player.shortName].filter(Boolean),
        active:player.active !== false, entityType:"athlete", currentTeamId:teamId, leagueId:"competition:nfl",
        position:player.position?.abbreviation || player.position?.name || null,
        countryCode:String(player.citizenshipCountry || player.birthPlace?.country || "").toUpperCase() || null,
        countryBasis:player.citizenshipCountry || player.birthPlace?.country ? "published-player-record" : null,
        genderCategory:"male", identityId:`athlete:nfl:${player.id}`,
        headshotUrl:player.headshot?.href || null,
        sourceRefs:(player.links || []).filter(link => link.rel?.includes("athlete") && link.rel?.includes("desktop")).map(link => link.href).slice(0, 1),
      })),
      fixtures:[],
      freshAt:[roster.timestamp, teamsPayload.timestamp, leagueSchedule.timestamp].filter(Boolean).sort().at(-1) || null,
    };
  });
  const fixtureMap = new Map((leagueSchedule.events || []).map(nflFixture).map(fixture => [fixture.id, fixture]));
  let standings = [];
  try{
    const payload = await fetchJson(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${NFL_SEASON}`);
    standings = (payload?.children || []).flatMap(conference => (conference.children || []).flatMap(division => (division.standings?.entries || []).map(entry => ({
      participantId:`team:nfl:${String(entry.team?.abbreviation || entry.team?.slug || entry.team?.id || "").toLowerCase()}`,
      conference:conference.name || null, division:division.name || null,
      stats:Object.fromEntries((entry.stats || []).map(stat => [stat.name || stat.abbreviation, stat.value ?? stat.displayValue])),
    }))));
  }catch(error){
    console.warn(`NFL standings unavailable; preserving teams, rosters and fixtures: ${error.message}`);
  }
  const freshAt = teamResults.map(result => result.freshAt).filter(Boolean).sort().at(-1) || new Date().toISOString();
  return {
    schemaVersion:"team-sport-directory.v1", sportKey:"american-football", generatedAt:freshAt,
    season:NFL_SEASON, competitions:[{ id:"competition:nfl", name:"National Football League" }],
    sources:[
      { id:"source:nfl:teams", url:"https://www.nfl.com/teams/", publisher:"NFL", sourceType:"official-team-directory" },
      { id:"source:nfl:structured", url:"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams", publisher:"ESPN", sourceType:"current-structured-roster-and-schedule" },
    ],
    teams:teamResults.map(result => result.team),
    players:teamResults.flatMap(result => result.players).filter(player => player.active),
    fixtures:[...fixtureMap.values()].sort((a, b) => String(a.startTimeUtc || "").localeCompare(String(b.startTimeUtc || "")) || a.id.localeCompare(b.id)),
    standings,
  };
}

function nhlName(value){
  return value?.default || Object.values(value || {})[0] || "";
}

function nhlTeamName(team){
  return [nhlName(team?.placeName), nhlName(team?.commonName)].filter(Boolean).join(" ").trim() || team?.abbrev || "TBC";
}

function nhlFixture(game){
  const local = isoParts(game?.startTimeUTC);
  const state = String(game?.gameState || "").toUpperCase();
  const completed = ["FINAL", "OFF"].includes(state);
  const slots = [game?.awayTeam, game?.homeTeam].filter(Boolean).map((team, index) => ({
    participantId:`team:nhl:${String(team.abbrev || team.id || "").toLowerCase()}`,
    label:nhlTeamName(team), homeAway:index === 0 ? "away" : "home",
    score:Number.isFinite(Number(team.score)) ? Number(team.score) : null,
    logoUrl:team.logo || null,
  }));
  return {
    id:`fixture:nhl:${game.id}`, sportDomainId:"sport:ice-hockey", competitionId:"competition:nhl",
    name:`${slots[0]?.label || "TBC"} v ${slots[1]?.label || "TBC"}`,
    date:local.date || game?.gameDate || null, time:local.time, startTimeUtc:game?.startTimeUTC || null,
    venue:nhlName(game?.venue) || null, status:completed ? "completed" : "upcoming",
    scheduleStatus:game?.gameScheduleState === "OK" && game?.startTimeUTC ? "confirmed" : "provisional",
    roundLabel:Number(game?.gameType) === 3 ? "Playoffs" : Number(game?.gameType) === 1 ? "Preseason" : "Regular season",
    participantSlots:slots,
    sourceUrl:game?.gameCenterLink ? `https://www.nhl.com${game.gameCenterLink}` : null,
    ticketUrl:game?.ticketsLink || null,
  };
}

const CHL_COUNTRY_CODES = Object.freeze({
  aut:"AT", cze:"CZ", den:"DK", fin:"FI", fra:"FR", ger:"DE", nor:"NO", pol:"PL", sui:"CH", swe:"SE", gbr:"GB",
});

function chlTeamId(team){
  return `team:chl:${team?._entityId || team?.externalId || String(team?.shortName || "tbc").toLowerCase()}`;
}

function chlFixture(match){
  const local = isoParts(match?.startDate);
  const home = match?.teams?.home || {};
  const away = match?.teams?.away || {};
  const completed = ["finished", "final", "completed"].includes(String(match?.status || "").toLowerCase());
  return {
    id:`fixture:chl:${match?._entityId || match?.externalId}`,
    sportDomainId:"sport:ice-hockey", competitionId:"competition:chl",
    name:`${away.name || "TBC"} v ${home.name || "TBC"}`,
    date:local.date, time:local.time, startTimeUtc:match?.startDate || null,
    venue:match?.venue?.name || null, status:completed ? "completed" : "upcoming",
    scheduleStatus:match?.startDateNotConfirmed === true ? "provisional" : "confirmed",
    stage:match?.stage?.group?.name || null, roundLabel:match?.stage?.round?.name || null,
    participantSlots:[
      { participantId:chlTeamId(away), label:away.name || "TBC", homeAway:"away", logoUrl:away.externalId ? `https://res.cloudinary.com/chl-production/image/upload/c_fit,g_center,h_300,w_300/chl-prod/assets/teams/${away.externalId}` : null },
      { participantId:chlTeamId(home), label:home.name || "TBC", homeAway:"home", logoUrl:home.externalId ? `https://res.cloudinary.com/chl-production/image/upload/c_fit,g_center,h_300,w_300/chl-prod/assets/teams/${home.externalId}` : null },
    ],
    sourceUrl:match?.link?.url ? `https://www.chl.hockey/en${match.link.url}` : "https://www.chl.hockey/en/schedule",
    viewingOptions:[{ providerId:"iihf-tv", webUrl:"https://iihf.tv/", sportUrl:"https://iihf.tv/", linkScope:"sport", sourceUrl:"https://www.chl.hockey/en/fans/where-to-watch", verifiedAt:"2026-08-26T00:00:00.000Z", permalinkVerifiedAt:null }],
  };
}

async function buildChl(){
  const schedulePageUrl = "https://www.chl.hockey/en/schedule";
  const html = await fetchText(schedulePageUrl);
  const seasonId = html.match(/"currentSeason":\{"_entityId":"([a-f0-9]+)"/)?.[1];
  if (!seasonId) throw new Error("CHL current season ID was not published");
  const scheduleUrls = Array.from(new Set([...html.matchAll(/https:\/\/www\.chl\.hockey\/api\/s3\?q=(schedule-[^'"\\]+\.json)/g)]
    .map(match => `https://www.chl.hockey/api/s3?q=${match[1]}`)
    .filter(url => url.includes(seasonId))));
  if (!scheduleUrls.length) throw new Error("CHL current schedule feeds were not published");
  const fileName = new URL(scheduleUrls[0]).searchParams.get("q");
  const prefix = fileName.slice("schedule-".length, -`.json`.length - seasonId.length - 1);
  const teamsUrl = `https://www.chl.hockey/api/s3?q=teams-${prefix}-${seasonId}.json`;
  const standingsUrl = `https://www.chl.hockey/api/s3?q=teams-stats-${prefix}-${seasonId}.json`;
  const [teamsPayload, standingsPayload, ...schedulePayloads] = await Promise.all([
    fetchJson(teamsUrl), fetchJson(standingsUrl), ...scheduleUrls.map(fetchJson),
  ]);
  const sourceTeams = teamsPayload.data || [];
  if (sourceTeams.length < 20) throw new Error(`CHL current field is incomplete: ${sourceTeams.length} teams`);
  const rosterResults = await mapLimit(sourceTeams, 6, async team => {
    const url = `https://www.chl.hockey/api/s3?q=team-players-info-${prefix}-${seasonId}-${team._entityId}.json`;
    const payload = await fetchJson(url);
    return { team, athletes:payload?.data?.athletes || [], url };
  });
  const teams = sourceTeams.map(team => {
    const id = chlTeamId(team);
    const countryCode = CHL_COUNTRY_CODES[String(team?.country?.code || "").toLowerCase()] || String(team?.country?.code || "").toUpperCase() || null;
    return {
      id, displayName:team.name, shortName:team.shortName || null, aliases:[team.shortName].filter(Boolean),
      active:true, entityType:"team", leagueId:"competition:chl", countryCode, countryBasis:"official-chl-team-record",
      genderCategory:"male", identityId:id,
      logoUrl:`https://res.cloudinary.com/chl-production/image/upload/c_fit,g_center,h_300,w_300/chl-prod/assets/teams/${team.externalId}`,
      sourceRefs:[`https://www.chl.hockey/en${team?.link?.url || "/teams"}`, teamsUrl],
    };
  });
  const players = rosterResults.flatMap(({ team, athletes, url }) => athletes.map(player => ({
    id:`athlete:chl:${player._entityId || player.externalId}`,
    displayName:player.name || [player.firstName, player.lastName].filter(Boolean).join(" "),
    shortName:player.shortName || null, aliases:[], active:true, entityType:"athlete", currentTeamId:chlTeamId(team),
    leagueId:"competition:chl", position:player.position?.shortName || player.position?.name || null,
    countryCode:CHL_COUNTRY_CODES[String(player?.country?.code || "").toLowerCase()] || String(player?.country?.code || "").toUpperCase() || null,
    countryBasis:player?.country?.code ? "official-chl-player-record" : null, genderCategory:"male",
    identityId:`athlete:chl:${player._entityId || player.externalId}`,
    headshotUrl:player.externalId ? `https://res.cloudinary.com/chl-production/image/upload/c_fit,g_face,h_240,w_240/chl-prod/assets/players/${player.externalId}` : null,
    sourceRefs:[url],
  })).filter(player => player.id && player.displayName));
  const fixtureMap = new Map(schedulePayloads.flatMap(payload => payload.data || []).map(chlFixture).map(fixture => [fixture.id, fixture]));
  const standings = (standingsPayload.data || []).map((entry, index) => ({
    participantId:chlTeamId(entry), rank:index + 1,
    gamesPlayed:entry?.stats?.matches?.played?.total ?? 0,
    wins:entry?.stats?.matches?.won?.total ?? 0, losses:entry?.stats?.matches?.lost?.total ?? 0,
    goalsFor:entry?.stats?.goals?.scored?.total ?? 0, goalsAgainst:entry?.stats?.goals?.conceded?.total ?? 0,
  }));
  return {
    seasonId, seasonName:html.match(/"currentSeason":\{[^}]*"name":"([^"]+)"/)?.[1] || "2026/27",
    teams, players, fixtures:[...fixtureMap.values()].sort((a, b) => String(a.startTimeUtc || "").localeCompare(String(b.startTimeUtc || ""))), standings,
    sourceStatus:{ rosters:players.length ? "published" : "not-yet-published", sourceTeamCount:sourceTeams.length, scheduleFeedCount:scheduleUrls.length },
    sources:[teamsUrl, standingsUrl, ...scheduleUrls],
  };
}

async function buildNhl(){
  const [standingsPayload, chl] = await Promise.all([
    fetchJson("https://api-web.nhle.com/v1/standings/now"),
    buildChl(),
  ]);
  const currentStandings = standingsPayload?.standings || [];
  const abbreviations = Array.from(new Set(currentStandings.map(entry => nhlName(entry.teamAbbrev)).filter(Boolean))).sort();
  const clubResults = await mapLimit(abbreviations, 6, async abbreviation => {
    const [roster, schedule] = await Promise.all([
      fetchJson(`https://api-web.nhle.com/v1/roster/${abbreviation}/current`),
      fetchJson(`https://api-web.nhle.com/v1/club-schedule-season/${abbreviation}/${NHL_SEASON}`),
    ]);
    const standing = currentStandings.find(entry => nhlName(entry.teamAbbrev) === abbreviation) || {};
    const teamId = `team:nhl:${abbreviation.toLowerCase()}`;
    const teamName = nhlName(standing.teamName) || nhlTeamName(schedule?.games?.find(game => game.homeTeam?.abbrev === abbreviation)?.homeTeam || schedule?.games?.find(game => game.awayTeam?.abbrev === abbreviation)?.awayTeam);
    const logoUrl = standing.teamLogo || `https://assets.nhle.com/logos/nhl/svg/${abbreviation}_light.svg`;
    const logoDarkUrl = `https://assets.nhle.com/logos/nhl/svg/${abbreviation}_dark.svg`;
    const players = [...(roster.forwards || []), ...(roster.defensemen || []), ...(roster.goalies || [])].map(player => ({
      id:`athlete:nhl:${player.id}`, displayName:`${nhlName(player.firstName)} ${nhlName(player.lastName)}`.trim(),
      shortName:null, aliases:[], active:true, entityType:"athlete", currentTeamId:teamId, leagueId:"competition:nhl",
      position:player.positionCode || null, countryCode:String(player.birthCountry || "").toUpperCase() || null,
      countryBasis:player.birthCountry ? "official-nhl-roster" : null, genderCategory:"male",
      identityId:`athlete:nhl:${player.id}`, headshotUrl:player.headshot || null,
      sourceRefs:[`https://www.nhl.com/${abbreviation.toLowerCase()}/roster`],
    }));
    return {
      team:{ id:teamId, displayName:teamName, shortName:nhlName(standing.teamCommonName) || abbreviation,
        aliases:[abbreviation, nhlName(standing.teamCommonName), nhlName(standing.teamPlaceName)].filter(Boolean), active:true,
        entityType:"team", leagueId:"competition:nhl", countryCode:["MTL", "OTT", "TOR", "VAN", "WPG", "CGY", "EDM"].includes(abbreviation) ? "CA" : "US",
        countryBasis:"league-registration", genderCategory:"male", identityId:teamId, logoUrl, logoDarkUrl,
        sourceRefs:["https://www.nhl.com/info/teams/", `https://www.nhl.com/${abbreviation.toLowerCase()}/roster`],
      },
      players,
      fixtures:(schedule.games || []).map(nhlFixture),
    };
  });
  const fixtureMap = new Map(clubResults.flatMap(result => result.fixtures).map(fixture => [fixture.id, fixture]));
  const publishedStandingsSeason = String(currentStandings[0]?.seasonId || "");
  const currentSeasonStandingsPublished = publishedStandingsSeason === NHL_SEASON;
  const standings = (currentSeasonStandingsPublished ? currentStandings : []).map(entry => ({
    participantId:`team:nhl:${nhlName(entry.teamAbbrev).toLowerCase()}`,
    conference:entry.conferenceName || null, division:entry.divisionName || null,
    gamesPlayed:entry.gamesPlayed ?? null, wins:entry.wins ?? null, losses:entry.losses ?? null,
    otLosses:entry.otLosses ?? null, points:entry.points ?? null, goalDifferential:entry.goalDifferential ?? null,
  }));
  return {
    schemaVersion:"team-sport-directory.v1", sportKey:"ice-hockey",
    generatedAt:standingsPayload.standingsDateTimeUtc || new Date().toISOString(), season:NHL_SEASON,
    competitions:[
      { id:"competition:nhl", name:"National Hockey League", season:NHL_SEASON, rosterStatus:"current-official-unversioned", standingsStatus:currentSeasonStandingsPublished ? "published" : "not-started", standingsSeason:currentSeasonStandingsPublished ? NHL_SEASON : null },
      { id:"competition:chl", name:"Champions Hockey League", season:chl.seasonName, rosterStatus:chl.sourceStatus.rosters },
    ],
    sources:[
      { id:"source:nhl:teams", url:"https://www.nhl.com/info/teams/", publisher:"NHL", sourceType:"official-team-directory" },
      { id:"source:nhl:api", url:"https://api-web.nhle.com/", publisher:"NHL", sourceType:"official-roster-schedule-standings" },
      { id:"source:chl:gamecentre", url:"https://www.championshockeyleague.com/en/gamecentre", publisher:"Champions Hockey League", sourceType:"official-gamecentre" },
    ],
    teams:[...clubResults.map(result => result.team), ...chl.teams],
    players:[...clubResults.flatMap(result => result.players), ...chl.players],
    fixtures:[...fixtureMap.values(), ...chl.fixtures].sort((a, b) => String(a.startTimeUtc || "").localeCompare(String(b.startTimeUtc || "")) || a.id.localeCompare(b.id)),
    standings:[...standings, ...chl.standings],
    sourceStatus:{ nhl:{ rosterEndpoint:"current", rosterSeason:null, standingsStatus:currentSeasonStandingsPublished ? "published" : "not-started", latestPublishedStandingsSeason:publishedStandingsSeason || null }, chl:chl.sourceStatus },
  };
}

function validate(payload, { teamCount, minimumTeamCount = teamCount, minimumPlayers, minimumFixtures }){
  if (Number.isFinite(teamCount) && payload.teams.length !== teamCount) throw new Error(`${payload.sportKey}: expected ${teamCount} teams, found ${payload.teams.length}`);
  if (payload.teams.length < minimumTeamCount) throw new Error(`${payload.sportKey}: expected at least ${minimumTeamCount} teams, found ${payload.teams.length}`);
  if (payload.players.length < minimumPlayers) throw new Error(`${payload.sportKey}: expected at least ${minimumPlayers} current players, found ${payload.players.length}`);
  if (payload.fixtures.length < minimumFixtures) throw new Error(`${payload.sportKey}: expected at least ${minimumFixtures} fixtures, found ${payload.fixtures.length}`);
  const ids = new Set();
  for (const record of [...payload.teams, ...payload.players, ...payload.fixtures]){
    if (!record.id || ids.has(record.id)) throw new Error(`${payload.sportKey}: missing or duplicate id ${record.id}`);
    ids.add(record.id);
  }
}

async function main(){
  if (process.argv.includes("--check")){
    const nfl = JSON.parse(fs.readFileSync(NFL_PATH, "utf8"));
    const iceHockey = JSON.parse(fs.readFileSync(ICE_HOCKEY_PATH, "utf8"));
    validate(nfl, { teamCount:32, minimumPlayers:1500, minimumFixtures:250 });
    validate(iceHockey, { minimumTeamCount:52, minimumPlayers:700, minimumFixtures:1350 });
    if (iceHockey.teams.filter(team => team.leagueId === "competition:nhl").length !== 32) throw new Error("Ice Hockey: NHL club count must be 32");
    if (iceHockey.teams.filter(team => team.leagueId === "competition:chl").length < 20) throw new Error("Ice Hockey: current CHL field is incomplete");
    console.log(`NFL/Ice Hockey current snapshots valid: ${nfl.players.length + iceHockey.players.length} players, ${nfl.fixtures.length + iceHockey.fixtures.length} fixtures.`);
    return;
  }
  const [nfl, iceHockey] = await Promise.all([buildNfl(), buildNhl()]);
  validate(nfl, { teamCount:32, minimumPlayers:1500, minimumFixtures:250 });
  validate(iceHockey, { minimumTeamCount:52, minimumPlayers:700, minimumFixtures:1350 });
  writeJson(NFL_PATH, nfl);
  writeJson(ICE_HOCKEY_PATH, iceHockey);
  console.log(`Refreshed NFL and Ice Hockey: ${nfl.teams.length + iceHockey.teams.length} teams, ${nfl.players.length + iceHockey.players.length} players, ${nfl.fixtures.length + iceHockey.fixtures.length} fixtures.`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
