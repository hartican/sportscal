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
const EXPECTED_PAGE_COUNT = Math.ceil(EXPECTED_FIXTURE_COUNT / PAGE_SIZE);
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
    let deadline;
    const fail = error => { clearTimeout(deadline); reject(error); };
    const request = https.get(url, { headers: { Origin: "https://www.premierleague.com" } }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("error", fail);
      response.on("aborted", () => fail(new Error("Premier League fixture page ended before completion.")));
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        clearTimeout(deadline);
        if (response.statusCode !== 200) return reject(new Error(`Premier League fixture service returned ${response.statusCode}.`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`Premier League fixture service returned invalid JSON: ${error.message}`)); }
      });
    });
    request.setTimeout(20_000, () => request.destroy(new Error("Premier League fixture service timed out.")));
    request.on("error", fail);
    // Socket inactivity alone permits an endlessly active response. Keep the
    // existing 20-second duration as a fixed network deadline for each page.
    deadline = setTimeout(() => request.destroy(new Error("Premier League fixture service exceeded its 20-second deadline.")), 20_000);
    deadline.unref?.();
  });
}

function validateFixturePage(payload, page){
  const info = payload?.pageInfo;
  const expectedSize = Math.min(PAGE_SIZE, EXPECTED_FIXTURE_COUNT - page * PAGE_SIZE);
  if (!info || info.page !== page || info.pageSize !== PAGE_SIZE || info.numPages !== EXPECTED_PAGE_COUNT || info.numEntries !== EXPECTED_FIXTURE_COUNT || !Array.isArray(payload.content) || payload.content.length !== expectedSize) {
    throw new Error(`Premier League fixture page ${page} failed validation: expected a consistent ${EXPECTED_PAGE_COUNT}-page, ${EXPECTED_FIXTURE_COUNT}-fixture collection with ${expectedSize} records on this page.`);
  }
  for (const fixture of payload.content) sourceFixtureStatus(fixture);
}

function sourceFixtureStatus(fixture){
  // C/U retain their dated review. A naturally observed L fixture and the
  // league's own C/U/L labels were captured on 10 October 2026. Other codes
  // must not acquire a fresh upcoming state while their meaning is unknown.
  if (fixture?.status === "C") return "completed";
  if (fixture?.status === "U") return "upcoming";
  const id=Number.isSafeInteger(fixture?.id)?fixture.id:'unknown';
  if (fixture?.status === "L") {
    // Actual L/H and the matching official HT display were captured on
    // 10 October. Other interruptions remain unreviewed, never inferred.
    if(!['1','2','H'].includes(fixture.phase))throw new Error(`Premier League live fixture ${id} has a missing or unreviewed playing phase; retain last-good data.`);
    const scores=fixture.teams?.map(team=>team.score);
    if(!scores||scores.length!==2||scores.some(score=>!Number.isSafeInteger(score)||score<0))throw new Error(`Premier League live fixture ${id} lacks a confirmed integer score.`);
    return fixture.phase==='H' ? 'break' : 'live';
  }
  const code=typeof fixture?.status==='string'&&fixture.status.length<=16?fixture.status:'invalid';
  throw new Error(`Premier League fixture ${id} has a missing or unreviewed source status (${code}); retain last-good data pending primary status verification.`);
}

function validateFixtureCollection(fixtures){
  const fixtureIds = new Set(), teamIds = new Set(), gameweeks = new Set(), pairs = new Set();
  for (const fixture of fixtures){
    const week = fixture?.gameweek;
    if (week?.compSeason?.id !== SEASON_ID || week.compSeason?.competition?.id !== COMPETITION_ID) throw new Error("Premier League fixture has the wrong competition or season.");
    if (!Number.isSafeInteger(week.gameweek) || week.gameweek < 1 || week.gameweek > 38) throw new Error("Premier League fixture has an invalid matchweek.");
    if (!Number.isSafeInteger(fixture.id) || fixture.id <= 0 || fixtureIds.has(fixture.id)) throw new Error("Premier League fixture identity is invalid or duplicated.");
    sourceFixtureStatus(fixture);
    if (!Array.isArray(fixture.teams) || fixture.teams.length !== 2) throw new Error("Premier League fixture requires exactly two clubs.");
    const [home, away] = fixture.teams.map(entry => entry?.team?.club?.id || entry?.team?.id);
    if (![home, away].every(id => Number.isSafeInteger(id) && id > 0) || home === away) throw new Error("Premier League fixture has an invalid club identity or self match.");
    const pair = `${home}:${away}`;
    if (pairs.has(pair)) throw new Error("Premier League fixture collection has a duplicate home/away pairing.");
    fixtureIds.add(fixture.id);teamIds.add(home);teamIds.add(away);gameweeks.add(week.gameweek);pairs.add(pair);
  }
  if (fixtures.length !== EXPECTED_FIXTURE_COUNT || fixtureIds.size !== EXPECTED_FIXTURE_COUNT || teamIds.size !== EXPECTED_TEAM_COUNT || gameweeks.size !== 38 || pairs.size !== EXPECTED_FIXTURE_COUNT) {
    throw new Error(`Premier League fixture refresh failed closed: expected ${EXPECTED_FIXTURE_COUNT} unique fixtures and directed pairings across ${EXPECTED_TEAM_COUNT} clubs and 38 matchweeks; received ${fixtures.length} fixtures, ${fixtureIds.size} identities, ${teamIds.size} clubs, ${gameweeks.size} matchweeks and ${pairs.size} pairings.`);
  }
}

async function loadFixtures(){
  const pages = [];
  for (let page = 0; page < EXPECTED_PAGE_COUNT; page += 1){
    const query = new URLSearchParams({ comps: String(COMPETITION_ID), comp: String(COMPETITION_ID), compSeasons: String(SEASON_ID), page: String(page), pageSize: String(PAGE_SIZE), altIds: "true" });
    const payload = await fetchJson(`${PULSE_FIXTURES_URL}?${query}`);
    validateFixturePage(payload, page);
    pages.push(...payload.content);
  }
  validateFixtureCollection(pages);
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
  const homeGoals = homeEntry?.score;
  const awayGoals = awayEntry?.score;
  if (!Number.isSafeInteger(homeGoals) || !Number.isSafeInteger(awayGoals) || homeGoals<0 || awayGoals<0) return null;
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
  const status = sourceFixtureStatus(fixture);
  const completed = status === "completed";
  const inProgress = status === 'live' || status === 'break';
  if(inProgress&&(!Number.isFinite(Date.parse(checkedAt))||!/Z$/.test(checkedAt)))throw new Error('Premier League live fixture requires a valid source observation.');
  const result = completed ? resultScoreline(fixture, home, away) : null;
  if(completed && !result)throw new Error("Premier League completed fixture lacks a confirmed integer score.");
  const gameweek = fixture.gameweek?.gameweek;
  const name = `${home.name} v ${away.name}`;
  return require('./lib/epl-kickoff-certainty').qualify({
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
      // Competition rights and a provider landing page do not verify that this
      // particular completed fixture is currently available as a replay.
      liveOrReplay: "live",
      replayVerified: false,
      linkScope: "sport",
      rightsScope: "competition",
      webUrl: STAN_SPORT_URL,
      sourceUrl: STAN_SPORT_URL,
      verifiedAt: STAN_RIGHTS_VERIFIED_AT,
    }],
    venue: fixture.ground?.name || null,
    scheduleStatus: fixture.provisionalKickoff?.millis === fixture.kickoff?.millis ? "confirmed" : "provisional",
    status,
    expected: 6,
    liveWindow: 3,
    round: "all",
    roundLabel: `Premier League Matchweek ${gameweek}`,
    roundNumber: gameweek,
    competitionName: "Premier League",
    season: "2026/27",
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
    ...(inProgress ? {
      statusText:status==='break'?'Half-time':null,
      participants:[{id:home.id,name:home.name,displayName:home.name,role:'home'},{id:away.id,name:away.name,displayName:away.name,role:'away'}],
      homeScore:fixture.teams[0].score,awayScore:fixture.teams[1].score,
      score:`${home.name} ${fixture.teams[0].score}-${fixture.teams[1].score} ${away.name}`,
      scoreDisplay:`${fixture.teams[0].score}–${fixture.teams[1].score}`,
      statusCheckedAt:checkedAt,scoreCheckedAt:checkedAt,
      statusSourceName:'Premier League official fixture service',statusSourceUrl:OFFICIAL_MATCHES_URL,statusSourceType:'official',
      statusEvidence:{kind:'primary-fixture-status',providerFixtureId:fixture.id,rawStatus:'L',...(status==='break'?{nonPlayingPhase:fixture.phase}:{playingPhase:fixture.phase}),sourceUrl:OFFICIAL_MATCHES_URL,checkedAt},
    } : {}),
    ...(result ? {
      ...result,
      canonicalResultScoreline: result.score,
      resultSourceUrl:OFFICIAL_MATCHES_URL,resultSourceCheckedAt:checkedAt,scoreCheckedAt:checkedAt,
      resultLabels: [`Premier League Matchweek ${gameweek}`, result.outcomeText],
    } : {}),
  });
}

async function loadCards(known,{loader=loadFixtures,checkedAt=new Date().toISOString(),backupOptions={}}={}){
  const backup=require('./lib/football-data-backup');
  try{
    const cards=(await loader()).map(f=>cardForFixture(f,checkedAt));
    const next=require('../lib/football-delayed-results').apply(cards,backup.readOverlay(backupOptions.outputPath)),byId=new Map(next.map(e=>[e.id,e]));
    for(const old of known){const card=byId.get(old.id);if(!card||old.homeParticipantId!==card.homeParticipantId||old.awayParticipantId!==card.awayParticipantId||old.status==='completed'&&card.status!=='completed')throw Error('Premier League identity/result continuity failed');}
    const result=backup.primary(cards,backupOptions);
    backup.record({code:'PL',state:'primary',newFinals:0},backupOptions);
    return result;
  }catch(error){
    const recovery=await backup.recover({code:'PL',events:known,primaryError:error,...backupOptions});
    if(!recovery.recovered)throw error;
    console.warn('Premier League primary degraded; validated delayed backup retained existing facts and identities.');
    return recovery.events;
  }
}

async function refreshPremierLeagueCards(inputPath = "feeds/incoming/events.json", outputPath = inputPath, options={}){
  const checkedAt = new Date().toISOString();
  const feed = readJson(inputPath);
  const cards = await loadCards((feed.events||[]).filter(e=>e.key==="premier-league"),{checkedAt,...options});
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

module.exports = { loadCards, cardForFixture, loadFixtures, refreshPremierLeagueCards, resultScoreline, sydneyDateAndTime, validateFixtureCollection, validateFixturePage };
