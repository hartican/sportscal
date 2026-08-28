#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const countryFlags = require("../config/country-flags.js");

const ROOT = path.resolve(__dirname, "..");
const CATALOGUE_PATH = path.join(ROOT, "data", "major-events.v1.json");
const SNAPSHOT_PATH = path.join(ROOT, "feeds", "provider-exports", "tennis", "us-open-2026-official-schedule.json");
const SCHEDULE_DAYS_URL = "https://www.usopen.org/en_US/scores/feeds/2026/schedule/scheduleDays.json";
const US_OPEN_ID = "major-event:us-open-2026";
const AUTO_ID_PREFIX = "fixture:us-open-2026:official:";
const TOURNAMENT_YEAR = 2026;
const CHECK_ONLY = process.argv.includes("--check");

const NEUTRAL_PLAYER_COUNTRY_OVERRIDES = Object.freeze({
  wta330151: "RU", // Erika Andreeva
  wta332575: "RU", // Alevtina Ibragimova
  wta322333: "RU", // Anastasia Gasanova
  wta320759: "BY", // Iryna Shymanovich
  wta330905: "RU", // Elena Pridankina; official match feed suppresses the nation field.
  wta329250: "BY", // Aliona Falei
  wta330466: "RU", // Polina Iatcenko
  wta320760: "BY", // Aryna Sabalenka
  wta331809: "RU", // Mirra Andreeva
  atpre44: "RU", // Andrey Rublev
  wta330482: "RU", // Diana Shnaider
  wta317790: "BY", // Aliaksandra Sasnovich
  wta335303: "RU", // Kristina Liutova; official match feed suppresses the nation field.
  wta330723: "RU", // Tatiana Prozorova
  wta330102: "RU", // Julia Avdeeva
  wta328578: "RU", // Darya Astakhova
  wta332168: "RU", // Alexandra Shubladze
});

const EVENT_LABELS = Object.freeze({
  MQ: { stage: "Men's qualifying singles", matchType: "mens-qualifying-singles" },
  WQ: { stage: "Women's qualifying singles", matchType: "womens-qualifying-singles" },
  MS: { stage: "Men's singles", matchType: "mens-singles" },
  WS: { stage: "Women's singles", matchType: "womens-singles" },
  MD: { stage: "Men's doubles", matchType: "mens-doubles" },
  WD: { stage: "Women's doubles", matchType: "womens-doubles" },
  XD: { stage: "Mixed doubles", matchType: "mixed-doubles" },
  BS: { stage: "Boys' singles", matchType: "boys-singles" },
  GS: { stage: "Girls' singles", matchType: "girls-singles" },
  BD: { stage: "Boys' doubles", matchType: "boys-doubles" },
  GD: { stage: "Girls' doubles", matchType: "girls-doubles" },
  WC: { stage: "Wheelchair", matchType: "wheelchair" },
});

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stableJson(value){
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compactWhitespace(value){
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanPersonName(value){
  return compactWhitespace(value).replace(/'{2,}/g, "'");
}

function slug(value){
  return cleanPersonName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceDate(day){
  const match = String(day?.message || day?.messageShort || "").match(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+([A-Za-z]+)\s+(\d{1,2})/i);
  if (!match) throw new Error(`US Open schedule day ${day?.tournDay || "unknown"} has no parseable official date label`);
  const months = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
  const month = months[match[1].toLowerCase()];
  if (!month) throw new Error(`US Open schedule day uses unknown month ${match[1]}`);
  return `${TOURNAMENT_YEAR}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

function statusForMatch(match){
  const status = compactWhitespace(match?.status).toLowerCase();
  const hasWinner = [...(match?.team1 || []), ...(match?.team2 || [])].some(team => team?.won === true);
  if (hasWinner || /complete|final|retired|walkover/.test(status)) return "completed";
  if (/suspend|delay|rain/.test(status)) return "postponed";
  if (/cancel/.test(status)) return "cancelled";
  if (/progress|playing|live/.test(status)) return "live";
  return "scheduled";
}

function stakesPolicyForMatch(eventCode, roundLabel, courtName){
  const round = compactWhitespace(roundLabel).toLowerCase();
  const qualifying = /q$/.test(String(eventCode || "").toLowerCase()) || /qualif/.test(round);
  const marquee = /arthur ashe/i.test(courtName || "") && !qualifying;
  let stakesScore = qualifying ? 3 : 2;
  if (/\b(?:final|championship)\b/.test(round) && !/semi|quarter|qualif/.test(round)) stakesScore = 5;
  else if (/semi.?final/.test(round)) stakesScore = 5;
  else if (/quarter.?final|round of 16|fourth round/.test(round)) stakesScore = 4;
  else if (/third round|round 3/.test(round)) stakesScore = 3;
  if (marquee) stakesScore = Math.max(4, stakesScore);
  return { stakesScore, marquee };
}

function playerFromTeam(team, suffix){
  const firstName = cleanPersonName(team?.[`firstName${suffix}`]);
  const lastName = cleanPersonName(team?.[`lastName${suffix}`]);
  const name = cleanPersonName(`${firstName} ${lastName}`);
  if (!name) return null;
  const providerId = compactWhitespace(team?.[`id${suffix}`]);
  const publishedCountry = compactWhitespace(team?.[`nation${suffix}`]).toUpperCase();
  const nationalityCode = countryFlags.alpha2(publishedCountry)
    || countryFlags.alpha2(NEUTRAL_PLAYER_COUNTRY_OVERRIDES[providerId])
    || publishedCountry
    || NEUTRAL_PLAYER_COUNTRY_OVERRIDES[providerId];
  if (!nationalityCode) throw new Error(`US Open fixture has no published country identity for ${name} (${providerId || "no provider id"})`);
  return {
    id: `athlete:tennis:${slug(name)}`,
    name,
    seed: Number.isFinite(Number(team?.seed)) ? Number(team.seed) : null,
    rank: null,
    nationalityCode,
  };
}

function matchupSide(team, fallbackIndex){
  const record = Array.isArray(team) ? team[0] : team;
  const players = [playerFromTeam(record, "A"), playerFromTeam(record, "B")].filter(Boolean);
  if (!players.length) throw new Error(`US Open fixture side ${fallbackIndex} has no named players`);
  const name = players.map(player => player.name).join(" / ");
  return { id:`side:tennis:${slug(name)}`, name, players };
}

function scoreDisplay(match, sideLabels){
  const sets = Array.isArray(match?.scores?.sets) ? match.scores.sets : [];
  if (!sets.length || sideLabels.length !== 2) return null;
  const setScores = sets.map(set => {
    if (!Array.isArray(set) || set.length < 2) return null;
    const side = set.map(score => {
      const base = compactWhitespace(score?.scoreDisplay ?? score?.score);
      const tie = compactWhitespace(score?.tiebreakDisplay ?? score?.tiebreak);
      return tie ? `${base}(${tie})` : base;
    });
    return side.every(Boolean) ? `${side[0]}-${side[1]}` : null;
  }).filter(Boolean);
  return setScores.length ? `${sideLabels[0]} ${setScores.join(" ")} ${sideLabels[1]}` : null;
}

function localTime(startTimeUtc){
  if (!startTimeUtc) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-AU", {
    timeZone:"America/New_York", hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(new Date(startTimeUtc)).map(part => [part.type, part.value]));
  return `${parts.hour}:${parts.minute}`;
}

function fixtureFromMatch(match, court, day, sourceUrl, capturedAt){
  const eventCode = compactWhitespace(match?.eventCode).toUpperCase();
  const eventLabel = EVENT_LABELS[eventCode] || {
    stage:compactWhitespace(match?.eventName || match?.shortEventName || "US Open match"),
    matchType:`us-open-${slug(match?.eventName || eventCode || "match")}`,
  };
  const sourceMatchId = compactWhitespace(match?.match_id);
  if (!sourceMatchId) throw new Error("US Open official schedule exposed a match without match_id");
  const matchupSides = [matchupSide(match?.team1, 1), matchupSide(match?.team2, 2)];
  const sideLabels = matchupSides.map(side => side.name);
  const order = Math.max(1, Number(match?.order) || 1);
  const sessionStartTimeUtc = Number.isFinite(Number(court?.startEpoch))
    ? new Date(Number(court.startEpoch) * 1000).toISOString()
    : null;
  const startTimeUtc = order === 1 ? sessionStartTimeUtc : null;
  const status = statusForMatch(match);
  const score = scoreDisplay(match, sideLabels);
  const courtName = compactWhitespace(match?.courtName || court?.courtName || "USTA Billie Jean King National Tennis Center");
  const roundLabel = compactWhitespace(match?.roundName || match?.roundNameShort || "Round TBC");
  const stakesPolicy = stakesPolicyForMatch(eventCode, roundLabel, courtName);
  const date = sourceDate(day);
  const stableMatchId = `usopen-2026-${eventCode.toLowerCase()}-${sourceMatchId}`;
  return {
    id:`${AUTO_ID_PREFIX}${eventCode.toLowerCase()}:${sourceMatchId}`,
    stableMatchId,
    cardKind:"fixture",
    name:sideLabels.join(" v "),
    stage:eventLabel.stage,
    roundLabel,
    matchType:eventLabel.matchType,
    court:courtName,
    date,
    time:localTime(startTimeUtc),
    startTimeUtc,
    sessionId:`us-open-2026:day-${day.tournDay}:court-${slug(court?.courtId || courtName)}:session-${court?.session || 1}`,
    sessionStartTimeUtc,
    sequenceInSession:order,
    timePrecision:startTimeUtc ? "session-start" : "follows",
    scheduleStatus:"confirmed",
    status,
    statusUpdatedAt:capturedAt,
    ...(status === "completed" ? { resultPublishedAt:capturedAt } : {}),
    ...(score ? { scoreDisplay:score } : {}),
    ...(status === "completed" && score ? { result:score } : {}),
    previewPriority:status === "live" ? 5 : status === "postponed" ? 4 : stakesPolicy.stakesScore,
    matchupSides,
    venue:courtName,
    stakesScore:stakesPolicy.stakesScore,
    ...(stakesPolicy.marquee ? { marquee:true } : {}),
    summary:`US Open 2026 · ${eventLabel.stage} · ${roundLabel} · ${courtName}.`,
    sourceUrl,
  };
}

function validateSnapshot(snapshot){
  if (snapshot?.schemaVersion !== "us-open-official-schedule-snapshot.v1") throw new Error("US Open snapshot schema is unsupported");
  if (!Number.isFinite(new Date(snapshot?.capturedAt).getTime())) throw new Error("US Open snapshot has no valid capture time");
  if (!Array.isArray(snapshot?.scheduleDays?.eventDays)) throw new Error("US Open snapshot has no official schedule-day index");
  if (!Array.isArray(snapshot?.scheduleFeeds) || !snapshot.scheduleFeeds.length) throw new Error("US Open snapshot has no released schedule feeds");
  snapshot.scheduleFeeds.forEach(feed => {
    if (!/^https:\/\/www\.usopen\.org\//.test(feed?.sourceUrl || "")) throw new Error("US Open schedule source must remain first-party HTTPS");
    if (!Array.isArray(feed?.payload?.courts)) throw new Error(`${feed?.sourceUrl || "US Open feed"} has no court schedule`);
  });
}

function fixturesFromSnapshot(snapshot){
  validateSnapshot(snapshot);
  const dayByFeedUrl = new Map(snapshot.scheduleDays.eventDays.filter(day => day?.feedUrl).map(day => [day.feedUrl, day]));
  const imported = snapshot.scheduleFeeds.flatMap(feed => {
    const day = dayByFeedUrl.get(feed.sourceUrl);
    if (!day) throw new Error(`US Open snapshot cannot map ${feed.sourceUrl} to a released day`);
    return feed.payload.courts.flatMap(court => (court.matches || []).map(match => fixtureFromMatch(match, court, day, feed.sourceUrl, snapshot.capturedAt)));
  });
  const fixtures = [...new Map(imported.map(fixture => [fixture.id, fixture])).values()];
  if (!fixtures.length) throw new Error("US Open official fixtures are empty");
  return fixtures.sort((left, right) => {
    const leftTime = new Date(left.startTimeUtc || left.sessionStartTimeUtc).getTime();
    const rightTime = new Date(right.startTimeUtc || right.sessionStartTimeUtc).getTime();
    return leftTime - rightTime || left.sequenceInSession - right.sequenceInSession || left.id.localeCompare(right.id);
  });
}

function releasedScheduleDays(snapshot){
  const feedUrls = new Set((snapshot?.scheduleFeeds || []).map(feed => feed?.sourceUrl));
  return (snapshot?.scheduleDays?.eventDays || []).filter(day => day?.released && day?.practice !== true && feedUrls.has(day?.feedUrl));
}

function currentScheduleDays(snapshot){
  const released = releasedScheduleDays(snapshot);
  const current = released.filter(day => day.currentDay === true);
  return current.length ? current : released.slice(-1);
}

function preserveResultTimestamps(fixture, previous){
  if (!previous || previous.status !== fixture.status || previous.scoreDisplay !== fixture.scoreDisplay || previous.result !== fixture.result) return fixture;
  return {
    ...fixture,
    ...(previous.statusUpdatedAt ? { statusUpdatedAt:previous.statusUpdatedAt } : {}),
    ...(previous.resultPublishedAt ? { resultPublishedAt:previous.resultPublishedAt } : {}),
  };
}

function mergeCatalogue(catalogue, snapshot){
  const snapshotFixtures = fixturesFromSnapshot(snapshot);
  const currentFeedUrls = new Set(currentScheduleDays(snapshot).map(day => day.feedUrl));
  const currentFixtures = snapshotFixtures.filter(fixture => currentFeedUrls.has(fixture.sourceUrl));
  const events = catalogue.events.map(event => {
    if (event.id !== US_OPEN_ID) return event;
    const sourceDates = currentFixtures.map(fixture => fixture.date).filter(Boolean).sort();
    const latestSourceDate = sourceDates.at(-1);
    const previousById = new Map((event.subEvents || []).map(subEvent => [subEvent.id, subEvent]));
    const fixtures = snapshotFixtures.map(fixture => preserveResultTimestamps(fixture, previousById.get(fixture.id)));
    const fixtureIds = new Set(fixtures.map(fixture => fixture.id));
    const retainedOfficialHistory = (event.subEvents || []).filter(subEvent => subEvent.id.startsWith(AUTO_ID_PREFIX))
      .filter(subEvent => !fixtureIds.has(subEvent.id) && subEvent.date && subEvent.date < latestSourceDate);
    const handCurated = (event.subEvents || []).filter(subEvent => !subEvent.id.startsWith(AUTO_ID_PREFIX))
      .filter(subEvent => subEvent.status === "completed" || !subEvent.date || subEvent.date >= latestSourceDate);
    const officialFixtures = [...retainedOfficialHistory, ...fixtures].sort((left, right) => {
      const leftTime = new Date(left.startTimeUtc || left.sessionStartTimeUtc).getTime() + Math.max(0, Number(left.sequenceInSession) || 0) * 1000;
      const rightTime = new Date(right.startTimeUtc || right.sessionStartTimeUtc).getTime() + Math.max(0, Number(right.sequenceInSession) || 0) * 1000;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
    const isMainDraw = currentFixtures.some(fixture => !/qualifying/.test(fixture.matchType));
    const officialSource = {
      name:"US Open official released order of play",
      url:snapshot.scheduleDaysSourceUrl || SCHEDULE_DAYS_URL,
      checkedAt:snapshot.capturedAt,
    };
    return {
      ...event,
      phaseId:isMainDraw ? "main-draw" : "qualifying",
      phaseLabel:isMainDraw ? "Main draw" : "Qualifying",
      phaseStartDate:isMainDraw ? "2026-08-30" : "2026-08-23",
      phaseEndDate:isMainDraw ? "2026-09-13" : "2026-08-28",
      phaseIdentity:isMainDraw ? "main-draw" : "qualification",
      subEvents:[...handCurated, ...officialFixtures],
      sources:[officialSource, ...(event.sources || []).filter(source => source.url !== officialSource.url)],
    };
  });
  if (!events.some(event => event.id === US_OPEN_ID)) throw new Error(`Missing ${US_OPEN_ID} in major Events catalogue`);
  return { ...catalogue, events };
}

async function fetchJson(url){
  const response = await fetch(url, {
    headers:{ accept:"application/json", "user-agent":"nothingSport-static-refresh/1.0" },
    signal:AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchOfficialSnapshot(){
  const scheduleDays = await fetchJson(SCHEDULE_DAYS_URL);
  const released = (scheduleDays?.eventDays || []).filter(day => day?.released && day?.feedUrl && day?.practice !== true);
  if (!released.length) throw new Error("US Open official schedule has no released competition day");
  const payloads = await Promise.all(released.map(async day => ({ sourceUrl:day.feedUrl, payload:await fetchJson(day.feedUrl) })));
  return {
    schemaVersion:"us-open-official-schedule-snapshot.v1",
    tournament:"US Open 2026",
    capturedAt:new Date().toISOString(),
    scheduleDaysSourceUrl:SCHEDULE_DAYS_URL,
    scheduleDays,
    scheduleFeeds:payloads,
  };
}

function assertCurrent(catalogue, snapshot){
  const expected = mergeCatalogue(catalogue, snapshot);
  const actual = catalogue.events.find(event => event.id === US_OPEN_ID);
  const expectedEvent = expected.events.find(event => event.id === US_OPEN_ID);
  if (stableJson(actual) !== stableJson(expectedEvent)) throw new Error("US Open Events output is stale against the verified official snapshot");
  const officialFixtures = actual.subEvents.filter(event => event.id.startsWith(AUTO_ID_PREFIX));
  if (!officialFixtures.length) throw new Error("US Open Events output has no detailed official fixtures");
  console.log(`US Open Events valid: ${officialFixtures.length} detailed official fixtures, ${actual.phaseLabel}.`);
}

async function main(){
  const catalogue = readJson(CATALOGUE_PATH);
  const cachedSnapshot = readJson(SNAPSHOT_PATH);
  if (CHECK_ONLY){
    assertCurrent(catalogue, cachedSnapshot);
    return;
  }

  let snapshot = cachedSnapshot;
  let live = false;
  try {
    const candidate = await fetchOfficialSnapshot();
    fixturesFromSnapshot(candidate);
    snapshot = candidate;
    live = true;
  } catch (error) {
    console.warn(`US Open official refresh unavailable; retaining verified snapshot: ${error.message}`);
  }

  const nextCatalogue = mergeCatalogue(catalogue, snapshot);
  if (live) fs.writeFileSync(SNAPSHOT_PATH, stableJson(snapshot));
  if (stableJson(nextCatalogue) !== stableJson(catalogue)) fs.writeFileSync(CATALOGUE_PATH, stableJson(nextCatalogue));
  const fixtureCount = nextCatalogue.events.find(event => event.id === US_OPEN_ID).subEvents.filter(event => event.id.startsWith(AUTO_ID_PREFIX)).length;
  console.log(`US Open Events refreshed: ${fixtureCount} detailed official fixtures (${live ? "live first-party feed" : "verified cached feed"}).`);
}

if (require.main === module){
  main().catch(error => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = { AUTO_ID_PREFIX, CHECK_ONLY, SCHEDULE_DAYS_URL, currentScheduleDays, fetchOfficialSnapshot, fixtureFromMatch, fixturesFromSnapshot, mergeCatalogue, releasedScheduleDays, sourceDate, stakesPolicyForMatch, statusForMatch };
