#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const flags = require("../config/country-flags.js");
const teamCatalogue = require("../config/team-follow-catalogue.js");

const ROOT = path.resolve(__dirname, "..");
const DIRECTORY_PATH = path.join(ROOT, "data/canonical/football-directory.v1.json");
const DIRECTORY_SCRIPT_PATH = path.join(ROOT, "data/canonical/football-directory.v1.js");
const INDEX_PATH = path.join(ROOT, "data/canonical/football-follow-index.v1.json");
const INDEX_SCRIPT_PATH = path.join(ROOT, "data/canonical/football-follow-index.v1.js");
const FIXTURE_DIR = path.join(ROOT, "data/football/fixtures");
const CORE_FIXTURE_PATH = path.join(ROOT, "data/football/core-events.json");
const CORE_FIXTURE_SCRIPT_PATH = path.join(ROOT, "data/football/core-events.js");
const SEASON_YEAR = 2026;
const SEASON_LABEL = "2026/27";

const LEAGUES = Object.freeze([
  { key: "premier-league", id: "competition:premier-league", eventCompetitionId: "competition:premier-league-2026-27", name: "Premier League", countryCode: "GB", espn: "eng.1", footballData: "PL", teams: 20, fixtures: 380, official: "https://www.premierleague.com/en/clubs" },
  { key: "bundesliga", id: "competition:bundesliga", name: "Bundesliga", countryCode: "DE", espn: "ger.1", footballData: "BL1", teams: 18, fixtures: 306, official: "https://www.bundesliga.com/en/bundesliga/clubs" },
  { key: "la-liga", id: "competition:la-liga", name: "La Liga", countryCode: "ES", espn: "esp.1", footballData: "PD", teams: 20, fixtures: 380, official: "https://www.laliga.com/en-GB/laliga-easports/clubs" },
  { key: "serie-a", id: "competition:serie-a", name: "Serie A", countryCode: "IT", espn: "ita.1", footballData: "SA", teams: 20, fixtures: 380, official: "https://www.legaseriea.it/en/team" },
  { key: "ligue-1", id: "competition:ligue-1", name: "Ligue 1", countryCode: "FR", espn: "fra.1", footballData: "FL1", teams: 18, fixtures: 306, official: "https://ligue1.com/fr/articles/l1_article_5293-les-dates-de-reprise-des-clubs-de-l1-2627" },
  { key: "a-league-men", id: "competition:a-leagues", name: "A-League Men", countryCode: "AU", espn: "aus.1", teams: 12, fixtures: 156, official: "https://aleagues.com.au/news/aleague-men-2026-2027-fixture-list-revealed-key-dates-fixture-information/" },
]);

const ALPHA3_TO_ALPHA2 = Object.freeze({
  ALB:"AL", ALG:"DZ", ANG:"AO", ARG:"AR", ARM:"AM", AUS:"AU", AUT:"AT", BEL:"BE", BEN:"BJ", BFA:"BF", BOL:"BO", BIH:"BA", BRA:"BR", BUL:"BG", CAN:"CA", CHI:"CL", CHN:"CN", CIV:"CI", CMR:"CM", COD:"CD", COL:"CO", COM:"KM", CPV:"CV", CRC:"CR", CRO:"HR", CZE:"CZ", DEN:"DK", DOM:"DO", ECU:"EC", EGY:"EG", ENG:"GB", ESP:"ES", EST:"EE", FIN:"FI", FRA:"FR", GAB:"GA", GAM:"GM", GEO:"GE", GER:"DE", GHA:"GH", GRE:"GR", GUI:"GN", HAI:"HT", HON:"HN", HUN:"HU", IDN:"ID", INA:"ID", IRL:"IE", ISL:"IS", ISR:"IL", ITA:"IT", JAM:"JM", JPN:"JP", KOR:"KR", KVX:"XK", MAR:"MA", MEX:"MX", MKD:"MK", MLI:"ML", MNE:"ME", MOZ:"MZ", NED:"NL", NIR:"GB", NGA:"NG", NOR:"NO", NZL:"NZ", PAN:"PA", PAR:"PY", PER:"PE", PHI:"PH", POL:"PL", POR:"PT", ROU:"RO", RSA:"ZA", SCO:"GB", SEN:"SN", SRB:"RS", SUI:"CH", SVK:"SK", SVN:"SI", SWE:"SE", TOG:"TG", TUN:"TN", TUR:"TR", UAE:"AE", UKR:"UA", URU:"UY", USA:"US", VEN:"VE", WAL:"GB", ZAM:"ZM", ZIM:"ZW",
  GBR:"GB", NZE:"NZ"
});

const MARQUEE_PLAYERS = new Set([
  "Kylian Mbappé", "Vinícius Júnior", "Jude Bellingham", "Lamine Yamal", "Robert Lewandowski", "Mohamed Salah", "Erling Haaland", "Harry Kane", "Jamal Musiala", "Florian Wirtz", "Ousmane Dembélé", "Khvicha Kvaratskhelia", "Lautaro Martínez", "Kevin De Bruyne", "Bukayo Saka", "Bruno Fernandes", "Virgil van Dijk", "Pedri", "Rodri", "Achraf Hakimi"
]);

const MARQUEE_TEAMS = new Set([
  "Arsenal", "Chelsea", "Liverpool", "Manchester City", "Manchester United", "Tottenham Hotspur",
  "Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "Real Madrid", "Barcelona", "Atletico Madrid",
  "Inter Milan", "Juventus", "AC Milan", "Napoli", "Paris Saint-Germain", "Marseille", "Monaco",
  "Sydney FC", "Melbourne Victory", "Melbourne City"
].map(normalizeName));

const DERBY_PAIRS = new Set([
  "arsenal|tottenham hotspur", "liverpool|manchester united", "manchester city|manchester united",
  "bayern munich|borussia dortmund", "barcelona|real madrid", "atletico madrid|real madrid",
  "ac milan|inter milan", "inter milan|juventus", "marseille|paris saint germain",
  "melbourne city|melbourne victory", "sydney fc|western sydney wanderers"
].map(pair => pair.split("|").map(normalizeName).sort().join("|")));

function normalizeName(value){
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function slugify(value){
  return normalizeName(value).replace(/\s+/g, "-") || "unknown";
}

function countryCode(value, fallback){
  const raw = String(value || "").toUpperCase();
  return flags.alpha2(raw) || ALPHA3_TO_ALPHA2[raw] || fallback;
}

function writeAtomic(filePath, body){
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, body);
  fs.renameSync(tempPath, filePath);
}

function writeJson(filePath, value){
  writeAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchJson(url, options = {}){
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), ...options });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function legacyTeamId(displayName){
  const normalized = normalizeName(displayName);
  return teamCatalogue.allTeams.find(team => [team.displayName, ...(team.aliases || [])]
    .some(name => normalizeName(name) === normalized))?.id || null;
}

function officialSourceId(league){
  return `source:football:${league.key}:official`;
}

function bootstrapSourceId(league){
  return `source:football:${league.key}:bootstrap`;
}

function teamRecord(league, raw){
  const displayName = raw.displayName || raw.name;
  const legacyId = legacyTeamId(displayName);
  return {
    id: legacyId || `team:football:club:${slugify(displayName)}`,
    leagueId: league.id,
    displayName,
    shortName: raw.shortDisplayName || raw.name || displayName,
    aliases: Array.from(new Set([displayName, raw.shortDisplayName, raw.name, raw.location].filter(Boolean))),
    crestUrl: raw.logos?.find(logo => logo.rel?.includes("default"))?.href || raw.logos?.[0]?.href,
    crestSourceUrl: raw.links?.find(link => link.rel?.includes("clubhouse"))?.href || league.official,
    externalIds: { espn: String(raw.id) },
    sourceRefs: [officialSourceId(league), bootstrapSourceId(league)],
    active: raw.isActive !== false,
  };
}

function athletePosition(athlete){
  const raw = String(athlete.position?.displayName || athlete.position?.name || "").toLowerCase();
  if (raw.includes("goal")) return "Goalkeeper";
  if (raw.includes("def")) return "Defender";
  if (raw.includes("mid")) return "Midfielder";
  if (raw.includes("forward") || raw.includes("attack") || raw.includes("striker")) return "Forward";
  return "Unknown";
}

function choosePriorityAthletes(athletes){
  const active = (athletes || []).filter(athlete => athlete.status?.type !== "inactive");
  const mandatory = active.filter(athlete => countryCode(athlete.citizenshipCountry?.abbreviation, "") === "AU" || athlete.displayName === "Lucas Herrington");
  const selected = [];
  const seen = new Set();
  const add = athlete => {
    if (!athlete?.id || seen.has(String(athlete.id))) return;
    seen.add(String(athlete.id));
    selected.push(athlete);
  };
  mandatory.forEach(add);
  const quotas = { Goalkeeper: 2, Defender: 5, Midfielder: 5, Forward: 3, Unknown: 1 };
  Object.entries(quotas).forEach(([position, limit]) => active
    .filter(athlete => athletePosition(athlete) === position)
    .sort((left, right) => Number(Boolean(MARQUEE_PLAYERS.has(right.displayName))) - Number(Boolean(MARQUEE_PLAYERS.has(left.displayName)))
      || Number(left.jersey || 999) - Number(right.jersey || 999))
    .slice(0, limit).forEach(add));
  active.filter(athlete => MARQUEE_PLAYERS.has(athlete.displayName)).forEach(add);
  active.forEach(athlete => { if (selected.filter(item => !mandatory.includes(item)).length < 15) add(athlete); });
  const mandatoryIds = new Set(mandatory.map(item => String(item.id)));
  const capped = selected.filter(item => mandatoryIds.has(String(item.id)))
    .concat(selected.filter(item => !mandatoryIds.has(String(item.id))).slice(0, 15));
  return Array.from(new Map(capped.map(item => [String(item.id), item])).values());
}

function playerRecord(league, team, athlete){
  const isHerrington = athlete.displayName === "Lucas Herrington" && team.id === "team:football:epl:41";
  const marquee = MARQUEE_PLAYERS.has(athlete.displayName);
  const emerging = isHerrington;
  const code = isHerrington ? "AU" : countryCode(athlete.citizenshipCountry?.abbreviation, league.countryCode);
  return {
    id: isHerrington ? "competitor:football:lucas-herrington" : `competitor:football:espn:${athlete.id}`,
    displayName: athlete.displayName,
    sortName: [athlete.lastName, athlete.firstName].filter(Boolean).join(", ") || athlete.displayName,
    currentTeamId: team.id,
    leagueId: league.id,
    position: athletePosition(athlete),
    birthCountryCode: code,
    birthCountryBasis: isHerrington ? "official-birthplace" : "provider-country-fallback",
    prominenceTier: marquee ? "marquee" : emerging ? "emerging" : "established",
    prominenceReason: marquee
      ? "Recognised current global or club marquee player."
      : emerging
        ? "Under 23 with an evidenced senior international and club debut."
        : "Listed in the current senior first-team squad as an established player.",
    dateOfBirth: athlete.dateOfBirth ? String(athlete.dateOfBirth).slice(0, 10) : null,
    externalIds: { espn: String(athlete.id) },
    sourceRefs: isHerrington ? ["source:football:herrington:socceroos", bootstrapSourceId(league)] : [bootstrapSourceId(league)],
    active: true,
    australianPriority: code === "AU",
  };
}

function sydneyDateAndTime(startTimeUtc){
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(startTimeUtc)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function fixtureExpected(homeName, awayName){
  const pair = [homeName, awayName].map(normalizeName).sort().join("|");
  if (DERBY_PAIRS.has(pair)) return 10;
  if (MARQUEE_TEAMS.has(normalizeName(homeName)) && MARQUEE_TEAMS.has(normalizeName(awayName))) return 8;
  return 4;
}

function espnFixtureRecord(league, teamByExternalId, event, checkedAt){
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const homeRaw = competitors.find(item => item.homeAway === "home");
  const awayRaw = competitors.find(item => item.homeAway === "away");
  const home = teamByExternalId.get(String(homeRaw?.team?.id));
  const away = teamByExternalId.get(String(awayRaw?.team?.id));
  if (!home || !away || !event.date) throw new Error(`${league.name} fixture ${event.id} has unresolved teams or time`);
  const startTimeUtc = new Date(event.date).toISOString();
  const local = sydneyDateAndTime(startTimeUtc);
  const completed = Boolean(event.status?.type?.completed);
  const homeScore = Number(homeRaw?.score);
  const awayScore = Number(awayRaw?.score);
  const hasScore = completed && Number.isInteger(homeScore) && Number.isInteger(awayScore);
  const name = `${home.displayName} v ${away.displayName}`;
  const expected = fixtureExpected(home.displayName, away.displayName);
  return {
    id: `football-${league.key}-2026-27-${event.id}`,
    eventId: `football-${league.key}-2026-27-${event.id}`,
    canonicalEventId: `event:football:${league.key}:${event.id}`,
    canonicalSourceId: String(event.id),
    canonicalSourceName: "ESPN public football schedule snapshot",
    canonicalSourceUrl: `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/scoreboard`,
    canonicalSourceCheckedAt: checkedAt,
    canonicalSourceType: "reputable",
    sport: "Football",
    key: league.key === "premier-league" ? "premier-league" : "football",
    sportDomainId: "sport:football",
    competitionId: league.eventCompetitionId || league.id,
    name,
    displayTitleCompact: name,
    participants: [{ name: home.displayName, role: "home" }, { name: away.displayName, role: "away" }],
    participantIds: [home.id, away.id],
    homeParticipantId: home.id,
    awayParticipantId: away.id,
    date: local.date,
    time: local.time,
    startTimeUtc,
    endTimeUtc: new Date(Date.parse(startTimeUtc) + 2 * 60 * 60 * 1000).toISOString(),
    broadcaster: "Broadcast details TBC",
    broadcastOptions: [],
    venue: competition?.venue?.fullName || null,
    scheduleStatus: "confirmed",
    status: completed ? "completed" : "upcoming",
    expected,
    liveWindow: 3,
    round: "all",
    narrativeType: "regular-season-fixture",
    selectedSentence: `${league.name} fixture sourced from the current 2026/27 schedule.`,
    fullSpiel: `${name} is listed in the current ${league.name} schedule. Kick-off details refresh when the source publishes changes.`,
    sourceName: "ESPN public football schedule snapshot",
    sourceUrl: `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/scoreboard`,
    sourceCheckedAt: checkedAt,
    sourceType: "reputable",
    sourceTrust: "unverified",
    lastReviewedAt: checkedAt,
    replayEligible: completed,
    highlightEligible: completed,
    briefingEligible: false,
    catchupEligible: completed,
    resultLabels: [event.status?.type?.shortDetail || league.name],
    ...(hasScore ? {
      homeScore, awayScore,
      score: `${home.displayName} ${homeScore}-${awayScore} ${away.displayName}`,
      canonicalResultScoreline: `${home.displayName} ${homeScore}-${awayScore} ${away.displayName}`,
    } : {}),
  };
}

function providerTeam(directoryTeams, providerTeam){
  const names = [providerTeam?.name, providerTeam?.shortName, providerTeam?.tla].filter(Boolean).map(normalizeName);
  return directoryTeams.find(team => [team.displayName, team.shortName, ...(team.aliases || [])]
    .some(name => names.includes(normalizeName(name))));
}

function footballDataFixtureRecord(league, directoryTeams, match, checkedAt){
  const home = providerTeam(directoryTeams, match.homeTeam);
  const away = providerTeam(directoryTeams, match.awayTeam);
  if (!home || !away || !match.utcDate) throw new Error(`${league.name} football-data match ${match.id} has unresolved teams or time`);
  const startTimeUtc = new Date(match.utcDate).toISOString();
  const local = sydneyDateAndTime(startTimeUtc);
  const completed = match.status === "FINISHED";
  const homeScore = Number(match.score?.fullTime?.home);
  const awayScore = Number(match.score?.fullTime?.away);
  const hasScore = completed && Number.isInteger(homeScore) && Number.isInteger(awayScore);
  const name = `${home.displayName} v ${away.displayName}`;
  const expected = fixtureExpected(home.displayName, away.displayName);
  return {
    id: `football-${league.key}-2026-27-${match.id}`,
    eventId: `football-${league.key}-2026-27-${match.id}`,
    canonicalEventId: `event:football:${league.key}:${match.id}`,
    canonicalSourceId: String(match.id),
    canonicalSourceName: "football-data.org competition API",
    canonicalSourceUrl: `https://api.football-data.org/v4/competitions/${league.footballData}/matches?season=${SEASON_YEAR}`,
    canonicalSourceCheckedAt: checkedAt,
    canonicalSourceType: "reputable",
    sport: "Football",
    key: "football",
    sportDomainId: "sport:football",
    competitionId: league.id,
    name,
    displayTitleCompact: name,
    participants: [{ name: home.displayName, role: "home" }, { name: away.displayName, role: "away" }],
    participantIds: [home.id, away.id],
    homeParticipantId: home.id,
    awayParticipantId: away.id,
    date: local.date,
    time: local.time,
    startTimeUtc,
    endTimeUtc: new Date(Date.parse(startTimeUtc) + 2 * 60 * 60 * 1000).toISOString(),
    broadcaster: "Broadcast details TBC",
    broadcastOptions: [],
    venue: match.venue || null,
    scheduleStatus: "confirmed",
    status: completed ? "completed" : "upcoming",
    expected,
    liveWindow: 3,
    round: "all",
    narrativeType: "regular-season-fixture",
    selectedSentence: `${league.name} fixture sourced from the current 2026/27 provider schedule.`,
    fullSpiel: `${name} is listed in the current ${league.name} schedule. Kick-off details refresh when the provider publishes changes.`,
    sourceName: "football-data.org competition API",
    sourceUrl: `https://api.football-data.org/v4/competitions/${league.footballData}/matches?season=${SEASON_YEAR}`,
    sourceCheckedAt: checkedAt,
    sourceType: "reputable",
    sourceTrust: "unverified",
    lastReviewedAt: checkedAt,
    replayEligible: completed,
    highlightEligible: completed,
    briefingEligible: false,
    catchupEligible: completed,
    resultLabels: [`${league.name} Matchday ${match.matchday || "TBC"}`],
    ...(hasScore ? {
      homeScore, awayScore,
      score: `${home.displayName} ${homeScore}-${awayScore} ${away.displayName}`,
      canonicalResultScoreline: `${home.displayName} ${homeScore}-${awayScore} ${away.displayName}`,
    } : {}),
  };
}

async function bootstrapLeague(league, checkedAt){
  const teamsPayload = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/teams?limit=100`);
  const rawTeams = teamsPayload.sports?.[0]?.leagues?.[0]?.teams?.map(item => item.team) || [];
  if (rawTeams.length !== league.teams) throw new Error(`${league.name} expected ${league.teams} teams, received ${rawTeams.length}`);
  const teams = rawTeams.map(raw => teamRecord(league, raw));
  const players = [];
  for (let offset = 0; offset < teams.length; offset += 6){
    const batch = teams.slice(offset, offset + 6);
    const rosters = await Promise.all(batch.map(team => fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/teams/${team.externalIds.espn}/roster`)));
    rosters.forEach((roster, index) => choosePriorityAthletes(roster.athletes).forEach(athlete => players.push(playerRecord(league, batch[index], athlete))));
  }
  const scoreboards = await Promise.all([2026, 2027].map(year => fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/scoreboard?limit=1000&dates=${year}`)));
  const rawFixtures = Array.from(new Map(scoreboards.flatMap(payload => payload.events || [])
    .filter(event => Number(event.season?.year) === SEASON_YEAR)
    .map(event => [String(event.id), event])).values());
  if (rawFixtures.length !== league.fixtures) throw new Error(`${league.name} expected ${league.fixtures} fixtures, received ${rawFixtures.length}`);
  const teamByExternalId = new Map(teams.map(team => [team.externalIds.espn, team]));
  return { teams, players, fixtures: rawFixtures.map(event => espnFixtureRecord(league, teamByExternalId, event, checkedAt)) };
}

function sourceRecords(checkedAt){
  return LEAGUES.flatMap(league => [
    { id: officialSourceId(league), provider: league.name, url: league.official, sourceType: "official", checkedAt },
    { id: bootstrapSourceId(league), provider: "ESPN public football data", url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/teams`, sourceType: "reputable", checkedAt },
  ]).concat({
    id: "source:football:herrington:socceroos",
    provider: "Football Australia / Socceroos",
    url: "https://socceroos.com.au/player/lucas-herrington",
    sourceType: "official",
    checkedAt,
  });
}

function fixtureDocument(league, fixtures, checkedAt){
  return {
    schemaVersion: "football-fixtures.v1",
    leagueId: league.id,
    leagueKey: league.key,
    seasonLabel: SEASON_LABEL,
    checkedAt,
    sourceUrl: league.official,
    events: fixtures.sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc)),
  };
}

function coreFixtureDocument(snapshots, checkedAt){
  return {
    schemaVersion: "football-core-events.v1",
    generatedAt: checkedAt,
    events: snapshots.flatMap((snapshot, index) => LEAGUES[index].key === "premier-league" ? [] : snapshot.fixtures)
      .filter(event => Number(event.expected) >= 8)
      .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc)),
  };
}

async function bootstrapAndWrite(){
  const checkedAt = new Date().toISOString();
  const snapshots = [];
  for (const league of LEAGUES){
    console.log(`Fetching ${league.name} clubs, priority players and fixtures...`);
    snapshots.push(await bootstrapLeague(league, checkedAt));
  }
  const directory = {
    schemaVersion: "football-directory.v1",
    seasonLabel: SEASON_LABEL,
    generatedAt: checkedAt,
    sources: sourceRecords(checkedAt),
    leagues: LEAGUES.map(league => ({
      id: league.id, key: league.key, displayName: league.name, countryCode: league.countryCode,
      seasonLabel: SEASON_LABEL, teamCount: league.teams, sourceRefs: [officialSourceId(league), bootstrapSourceId(league)],
    })),
    teams: snapshots.flatMap(snapshot => snapshot.teams),
    players: snapshots.flatMap(snapshot => snapshot.players),
  };
  const index = {
    schemaVersion: "football-follow-index.v1",
    generatedAt: checkedAt,
    teams: directory.teams.map(team => ({ id: team.id, leagueId: team.leagueId })),
    players: directory.players.map(player => ({ id: player.id, currentTeamId: player.currentTeamId, leagueId: player.leagueId })),
  };
  const staged = [];
  const stage = (target, body) => {
    const temp = `${target}.candidate-${process.pid}`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temp, body);
    staged.push([temp, target]);
  };
  stage(DIRECTORY_PATH, `${JSON.stringify(directory, null, 2)}\n`);
  stage(DIRECTORY_SCRIPT_PATH, `globalThis.NOTHINGSPORTS_FOOTBALL_DIRECTORY_DATA = ${JSON.stringify(directory)};\n`);
  stage(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
  stage(INDEX_SCRIPT_PATH, `globalThis.NOTHINGSPORTS_FOOTBALL_FOLLOW_INDEX = ${JSON.stringify(index)};\n`);
  const coreFixtures = coreFixtureDocument(snapshots, checkedAt);
  stage(CORE_FIXTURE_PATH, `${JSON.stringify(coreFixtures, null, 2)}\n`);
  stage(CORE_FIXTURE_SCRIPT_PATH, `globalThis.NOTHINGSPORTS_FOOTBALL_CORE_EVENTS = ${JSON.stringify(coreFixtures)};\n`);
  LEAGUES.forEach((league, indexPosition) => {
    const document = fixtureDocument(league, snapshots[indexPosition].fixtures, checkedAt);
    stage(path.join(FIXTURE_DIR, `${league.key}.json`), `${JSON.stringify(document, null, 2)}\n`);
    stage(path.join(FIXTURE_DIR, `${league.key}.js`), `globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES[${JSON.stringify(league.key)}] = ${JSON.stringify(document)};\n`);
  });
  staged.forEach(([temp, target]) => fs.renameSync(temp, target));
  require("./validate-football-directory.js").validate();
  console.log(`Wrote ${directory.teams.length} clubs, ${directory.players.length} players and ${snapshots.reduce((sum, snapshot) => sum + snapshot.fixtures.length, 0)} fixtures.`);
}

async function refreshEuropeanFixtures(){
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_API_TOKEN is required to replace European fixture snapshots. Existing validated snapshots were left untouched.");
  checkExisting();
  const directory = JSON.parse(fs.readFileSync(DIRECTORY_PATH, "utf8"));
  const checkedAt = new Date().toISOString();
  const documents = new Map(LEAGUES.map(league => [league.key, JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${league.key}.json`), "utf8"))]));
  for (const league of LEAGUES.filter(item => item.footballData && item.key !== "premier-league")){
    const payload = await fetchJson(`https://api.football-data.org/v4/competitions/${league.footballData}/matches?season=${SEASON_YEAR}`, {
      headers: { "X-Auth-Token": token },
    });
    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    if (matches.length !== league.fixtures) throw new Error(`${league.name} refresh expected ${league.fixtures} fixtures, received ${matches.length}`);
    const teams = directory.teams.filter(team => team.leagueId === league.id);
    const events = matches.map(match => footballDataFixtureRecord(league, teams, match, checkedAt));
    if (new Set(events.map(event => event.canonicalEventId)).size !== league.fixtures) throw new Error(`${league.name} refresh contains duplicate fixtures`);
    documents.set(league.key, fixtureDocument(league, events, checkedAt));
  }
  const core = {
    schemaVersion: "football-core-events.v1",
    generatedAt: checkedAt,
    events: Array.from(documents.entries()).flatMap(([leagueKey, document]) => leagueKey === "premier-league" ? [] : document.events)
      .filter(event => Number(event.expected) >= 8)
      .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc)),
  };
  documents.forEach((document, leagueKey) => {
    writeJson(path.join(FIXTURE_DIR, `${leagueKey}.json`), document);
    writeAtomic(path.join(FIXTURE_DIR, `${leagueKey}.js`), `globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES[${JSON.stringify(leagueKey)}] = ${JSON.stringify(document)};\n`);
  });
  writeJson(CORE_FIXTURE_PATH, core);
  writeAtomic(CORE_FIXTURE_SCRIPT_PATH, `globalThis.NOTHINGSPORTS_FOOTBALL_CORE_EVENTS = ${JSON.stringify(core)};\n`);
  checkExisting();
  console.log("Refreshed Bundesliga, La Liga, Serie A and Ligue 1 from football-data.org; retained first-party Premier League and official A-League paths.");
}

function checkExisting(){
  require("./validate-football-directory.js").validate();
  LEAGUES.forEach(league => {
    const document = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${league.key}.json`), "utf8"));
    if (document.schemaVersion !== "football-fixtures.v1") throw new Error(`${league.name} fixture schema is invalid`);
    if (document.events.length !== league.fixtures) throw new Error(`${league.name} fixture snapshot expected ${league.fixtures}, received ${document.events.length}`);
    if (new Set(document.events.map(event => event.id)).size !== document.events.length) throw new Error(`${league.name} fixture IDs must be unique`);
  });
  const core = JSON.parse(fs.readFileSync(CORE_FIXTURE_PATH, "utf8"));
  if (core.schemaVersion !== "football-core-events.v1") throw new Error("Football core fixture schema is invalid");
  if (!core.events.length || core.events.some(event => Number(event.expected) < 8)) throw new Error("Football core fixtures must contain only 4/5 and 5/5 events");
  if (new Set(core.events.map(event => event.canonicalEventId)).size !== core.events.length) throw new Error("Football core fixtures must be deduplicated");
  console.log("Football fixture snapshots valid: all six league schedules are complete and deduplicated.");
}

async function main(){
  if (process.argv.includes("--bootstrap-public")) return bootstrapAndWrite();
  if (process.argv.includes("--refresh-fixtures")) return refreshEuropeanFixtures();
  return checkExisting();
}

if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = { LEAGUES, bootstrapAndWrite, checkExisting, choosePriorityAthletes, footballDataFixtureRecord, playerRecord, refreshEuropeanFixtures, teamRecord };
