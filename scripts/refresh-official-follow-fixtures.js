#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { sydneyLocalDateToUtc } = require("../lib/server-feed-pipeline");
const nbaContext = require("../data/canonical/nba-context-2026.json");

const OUTPUT_PATH = path.resolve(__dirname, "../data/follow-sources/official.v1.json");
const NBA_TEAM_IDS = Object.freeze({
  ATL:"1610612737", BOS:"1610612738", BKN:"1610612751", CHA:"1610612766", CHI:"1610612741",
  CLE:"1610612739", DAL:"1610612742", DEN:"1610612743", DET:"1610612765", GSW:"1610612744",
  HOU:"1610612745", IND:"1610612754", LAC:"1610612746", LAL:"1610612747", MEM:"1610612763",
  MIA:"1610612748", MIL:"1610612749", MIN:"1610612750", NOP:"1610612740", NYK:"1610612752",
  OKC:"1610612760", ORL:"1610612753", PHI:"1610612755", PHX:"1610612756", POR:"1610612757",
  SAC:"1610612758", SAS:"1610612759", TOR:"1610612761", UTA:"1610612762", WAS:"1610612764",
});
const NBA_TEAM_BY_CODE = new Map((nbaContext.participants || [])
  .filter(participant => participant.type === "team" && participant.teamCode)
  .map(participant => [participant.teamCode, participant]));
const MONTHS = Object.freeze({ january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 });

function unique(values){
  return Array.from(new Set((values || []).filter(Boolean)));
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

function parseNbaSchedulePage(html, sourceUrl, checkedAt = new Date().toISOString()){
  const match = String(html).match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match) throw new Error("NBA schedule page did not expose __NEXT_DATA__");
  const payload = JSON.parse(match[1]);
  const schedule = payload?.props?.pageProps?.team?.schedule;
  if (!Array.isArray(schedule) || !schedule.length) throw new Error("NBA schedule page did not contain fixtures");
  return schedule.map(game => {
    const home = NBA_TEAM_BY_CODE.get(game.homeTeam?.teamTricode);
    const away = NBA_TEAM_BY_CODE.get(game.awayTeam?.teamTricode);
    if (!home || !away || !game.gameDateTimeUTC || !game.gameId) return null;
    const local = sydneyParts(game.gameDateTimeUTC);
    const status = Number(game.gameStatus) === 3 ? "completed" : Number(game.gameStatus) === 2 ? "live" : "upcoming";
    return {
      id:`fixture:nba:${game.gameId}`,
      eventId:`fixture:nba:${game.gameId}`,
      canonicalEventId:`fixture:nba:${game.gameId}`,
      key:"nba",
      sport:"Basketball",
      sportDomainId:"sport:nba",
      competitionId:"competition:nba",
      name:`${home.displayName} v ${away.displayName}`,
      displayTitleCompact:`${home.displayName} v ${away.displayName}`,
      date:local.date,
      time:local.time,
      startTimeUtc:new Date(game.gameDateTimeUTC).toISOString(),
      endTimeUtc:new Date(new Date(game.gameDateTimeUTC).getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
      venue:[game.arenaName, game.arenaCity].filter(Boolean).join(", "),
      status,
      scheduleStatus:"confirmed",
      participantIds:[home.id, away.id],
      homeParticipantId:home.id,
      awayParticipantId:away.id,
      participants:[{ name:home.displayName, role:"home" }, { name:away.displayName, role:"away" }],
      broadcaster:"NBA League Pass",
      broadcasterIds:["nba-pass"],
      broadcastOptions:["NBA League Pass"],
      expected:5,
      liveWindow:2.5,
      storyline:{ stakes:3, intensity:3, scoreReasons:["Followed NBA team fixture"] },
      sourceName:"NBA official team schedule",
      sourceUrl,
      sourceCheckedAt:checkedAt,
      sourceType:"official",
      sourceTrust:"verified",
    };
  }).filter(Boolean);
}

function decodeFlightHtml(html){
  return String(html).replace(/\\"/g, '"').replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
}

function inferredYear(month, now){
  const current = new Date(now);
  const currentMonth = Number(new Intl.DateTimeFormat("en-CA", { timeZone:"Australia/Sydney", month:"numeric" }).format(current));
  const currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone:"Australia/Sydney", year:"numeric" }).format(current));
  return month < currentMonth - 6 ? currentYear + 1 : currentYear;
}

function parseHockeySchedulePage(html, { teamId, teamName, gender, sourceUrl, checkedAt = new Date().toISOString(), now = checkedAt } = {}){
  const decoded = decodeFlightHtml(html);
  const marker = "UpcomingTeamSchedule-module-scss-module__1lkiPW__Match";
  const events = [];
  let cursor = 0;
  while ((cursor = decoded.indexOf(marker, cursor)) >= 0){
    const next = decoded.indexOf(marker, cursor + marker.length);
    const segment = decoded.slice(cursor, next < 0 ? cursor + 16000 : next);
    cursor += marker.length;
    const dateMatch = segment.match(/__Date[^]*?"children":\["(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{1,2}) ([A-Za-z]+)"," - ","([^"]+)"\]/);
    const values = [...segment.matchAll(/"children":"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map(match => match[1]);
    const versus = values.indexOf("vs");
    if (!dateMatch || versus < 1 || !values[versus + 1]) continue;
    const firstName = values[versus - 1];
    const secondName = values[versus + 1];
    const timeLabel = values.find(value => /\d{1,2}:\d{2}(?:am|pm)\s+AE(?:S|D)T/i.test(value));
    if (!timeLabel) continue;
    const clock = timeLabel.match(/(\d{1,2}):(\d{2})(am|pm)/i);
    let hour = Number(clock[1]) % 12 + (clock[3].toLowerCase() === "pm" ? 12 : 0);
    const month = MONTHS[dateMatch[2].toLowerCase()];
    if (!month) continue;
    const date = `${inferredYear(month, now)}-${String(month).padStart(2, "0")}-${String(Number(dateMatch[1])).padStart(2, "0")}`;
    const time = `${String(hour).padStart(2, "0")}:${clock[2]}`;
    const start = sydneyLocalDateToUtc(date, time);
    const opponentName = firstName === "Australia" ? secondName : firstName;
    const opponentId = `team:hockey:${opponentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${gender === "female" ? "women" : "men"}`;
    const homeIsAustralia = firstName === "Australia";
    const participants = homeIsAustralia
      ? [{ id:teamId, name:teamName, role:"home" }, { id:opponentId, name:opponentName, role:"away" }]
      : [{ id:opponentId, name:opponentName, role:"home" }, { id:teamId, name:teamName, role:"away" }];
    const slug = `${date}:${participants.map(item => item.id).sort().join(":")}`.replace(/[^a-z0-9:.-]+/gi, "-").toLowerCase();
    events.push({
      id:`fixture:hockey:${slug}`,
      eventId:`fixture:hockey:${slug}`,
      canonicalEventId:`fixture:hockey:${slug}`,
      key:"hockey",
      sport:"Hockey",
      sportDomainId:"sport:hockey",
      competitionId:teamId === "team:hockey:hockeyroos" ? "competition:hockeyroos" : "competition:kookaburras",
      name:`${firstName} v ${secondName}`,
      displayTitleCompact:`${firstName} v ${secondName}`,
      date,
      time,
      startTimeUtc:start.toISOString(),
      endTimeUtc:new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      venue:values[versus + 3] || "Venue TBC",
      status:start > new Date(now) ? "upcoming" : "completed",
      scheduleStatus:"confirmed",
      participantIds:participants.map(item => item.id),
      homeParticipantId:participants[0].id,
      awayParticipantId:participants[1].id,
      participants:participants.map(item => ({ name:item.name, role:item.role })),
      broadcaster:"7plus",
      broadcasterIds:["seven"],
      broadcastOptions:["7plus"],
      expected:6,
      liveWindow:2,
      storyline:{ stakes:3, intensity:3, scoreReasons:["Followed Australian hockey team fixture"] },
      sourceName:"Hockey Australia official team schedule",
      sourceUrl,
      sourceCheckedAt:checkedAt,
      sourceType:"official",
      sourceTrust:"verified",
    });
  }
  return events;
}

function officialHockeyFallbackFixtures({ hockeyroosArticle, kookaburrasArticle, checkedAt = new Date().toISOString() } = {}){
  const hockeyroosText = decodeFlightHtml(hockeyroosArticle).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const kookaburrasText = decodeFlightHtml(kookaburrasArticle).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (!/face Belgium on Saturday at 9:00pm AEST/i.test(hockeyroosText)){
    throw new Error("Hockey Australia bronze-medal article no longer confirms Hockeyroos v Belgium at 9:00pm AEST");
  }
  if (!/defeating England 2-0 to secure fifth place/i.test(kookaburrasText)){
    throw new Error("Hockey Australia fifth-place article no longer confirms Kookaburras v England");
  }
  const specs = [
    {
      id:"fixture:hockey-world-cup-2026:hockeyroos-belgium-bronze",
      name:"Australia v Belgium",
      date:"2026-08-29",
      time:"21:00",
      teamId:"team:hockey:hockeyroos",
      teamName:"Hockeyroos",
      opponentId:"team:hockey:belgium-women",
      opponentName:"Belgium",
      homeAustralia:true,
      sourceUrl:"https://www.hockey.org.au/news/hockeyroos-brave-world-cup-charge-ends-in-narrow-semi-final-defeat",
      scoreReason:"Hockeyroos bronze-medal match",
    },
    {
      id:"fixture:hockey-world-cup-2026:kookaburras-england-fifth-place",
      name:"England v Australia",
      date:"2026-08-28",
      time:"23:00",
      teamId:"team:hockey:kookaburras",
      teamName:"Kookaburras",
      opponentId:"team:hockey:england-men",
      opponentName:"England",
      homeAustralia:false,
      sourceUrl:"https://www.hockey.org.au/news/kookaburras-shut-out-england-to-secure-fifth-at-world-cup",
      scoreReason:"Kookaburras fifth-place match",
    },
  ];
  return specs.map(spec => {
    const start = sydneyLocalDateToUtc(spec.date, spec.time);
    const home = spec.homeAustralia
      ? { id:spec.teamId, name:spec.teamName }
      : { id:spec.opponentId, name:spec.opponentName };
    const away = spec.homeAustralia
      ? { id:spec.opponentId, name:spec.opponentName }
      : { id:spec.teamId, name:spec.teamName };
    return {
      id:spec.id,
      eventId:spec.id,
      canonicalEventId:spec.id,
      key:"hockey",
      sport:"Hockey",
      sportDomainId:"sport:hockey",
      competitionId:"competition:fih-hockey-world-cup-2026",
      name:spec.name,
      displayTitleCompact:spec.name,
      date:spec.date,
      time:spec.time,
      startTimeUtc:start.toISOString(),
      endTimeUtc:new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      venue:"FIH Hockey World Cup, Belgium and Netherlands",
      status:"published",
      scheduleStatus:"confirmed",
      participantIds:[home.id, away.id],
      homeParticipantId:home.id,
      awayParticipantId:away.id,
      participants:[{ name:home.name, role:"home" }, { name:away.name, role:"away" }],
      broadcaster:"7plus",
      broadcasterIds:["seven"],
      broadcastOptions:["7plus"],
      expected:7,
      liveWindow:2,
      storyline:{ stakes:4, intensity:4, scoreReasons:[spec.scoreReason, "Followed Australian hockey team fixture"] },
      sourceName:"Hockey Australia official World Cup update",
      sourceUrl:spec.sourceUrl,
      sourceCheckedAt:checkedAt,
      sourceType:"official",
      sourceTrust:"verified",
    };
  });
}

function parseDiamondsArticle(html, sourceUrl, checkedAt = new Date().toISOString()){
  const decoded = String(html).replace(/&nbsp;|&#160;/g, " ").replace(/&ndash;|&#8211;/g, "–");
  const scheduleHtml = decoded.match(/2026 CONSTELLATION CUP[^]*?Match 1[^]*?Match 4:[^]*?<\/p>/i)?.[0] || "";
  const schedule = scheduleHtml.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const fixtures = [...schedule.matchAll(/Match\s*(\d)\s*:\s*(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(\d{1,2})\s+October\s*[–-]\s*(.+?)(?=\s+Match\s*\d\s*:|$)/gi)];
  if (fixtures.length !== 4) throw new Error("Netball Australia article did not contain all four Constellation Cup fixtures");
  return fixtures.map(match => {
    const number = Number(match[1]);
    const date = `2026-10-${String(Number(match[2])).padStart(2, "0")}`;
    const australiaHome = number >= 3;
    const home = australiaHome ? { id:"team:netball:diamonds", name:"Australian Diamonds" } : { id:"team:netball:silver-ferns", name:"New Zealand Silver Ferns" };
    const away = australiaHome ? { id:"team:netball:silver-ferns", name:"New Zealand Silver Ferns" } : { id:"team:netball:diamonds", name:"Australian Diamonds" };
    const start = sydneyLocalDateToUtc(date, "00:00");
    return {
      id:`fixture:netball:constellation-cup-2026-${number}`,
      eventId:`fixture:netball:constellation-cup-2026-${number}`,
      canonicalEventId:`fixture:netball:constellation-cup-2026-${number}`,
      key:"netball",
      sport:"Netball",
      sportDomainId:"sport:netball",
      competitionId:"competition:constellation-cup-2026",
      name:`${home.name} v ${away.name}`,
      displayTitleCompact:`${home.name} v ${away.name}`,
      date,
      time:"00:00",
      startTimeUtc:start.toISOString(),
      endTimeUtc:new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      venue:match[3].trim(),
      status:"upcoming",
      scheduleStatus:"time-tbc",
      timeTbc:true,
      participantIds:[home.id, away.id],
      homeParticipantId:home.id,
      awayParticipantId:away.id,
      participants:[{ name:home.name, role:"home" }, { name:away.name, role:"away" }],
      broadcaster:"Fox Sports / Foxtel / Kayo / BINGE",
      broadcasterIds:["foxtel", "kayo"],
      broadcastOptions:["Fox Sports", "Foxtel", "Kayo", "BINGE"],
      expected:7,
      liveWindow:2,
      storyline:{ stakes:4, intensity:4, scoreReasons:["Followed Diamonds fixture", "Constellation Cup"] },
      sourceName:"Netball Australia 2026 Constellation Cup announcement",
      sourceUrl,
      sourceCheckedAt:checkedAt,
      sourceType:"official",
      sourceTrust:"verified",
    };
  });
}

async function fetchText(url, fetchImpl = fetch){
  const response = await fetchImpl(url, {
    headers:{ "User-Agent":"Nothing Sport schedule refresh/1.0" },
    signal:AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Official follow source failed (${response.status}): ${url}`);
  return response.text();
}

function validateArtifact(payload){
  if (payload?.schemaVersion !== "follow-source-fixtures.v1" || !Array.isArray(payload?.events) || !payload.events.length){
    throw new Error("Official follow fixture artifact is invalid");
  }
  return payload;
}

function isTransientSourceFailure(error){
  return /fetch failed|timed?\s*out|abort|network|socket|econn|enotfound|eai_again/i.test(String(error?.message || error));
}

async function mapWithConcurrency(values, concurrency, mapper){
  const results = new Array(values.length);
  let cursor = 0;
  async function worker(){
    while (cursor < values.length){
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length:Math.min(concurrency, values.length) }, worker));
  return results;
}

async function refresh({ fetchImpl = fetch, now = new Date() } = {}){
  const checkedAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const events = [];
  const sources = [];
  const nbaTeams = (nbaContext.participants || [])
    .filter(participant => participant.type === "team" && NBA_TEAM_IDS[participant.teamCode]);
  const nbaBundles = await mapWithConcurrency(nbaTeams, 6, async team => {
    const url = `https://www.nba.com/team/${NBA_TEAM_IDS[team.teamCode]}/schedule`;
    return {
      events:parseNbaSchedulePage(await fetchText(url, fetchImpl), url, checkedAt),
      source:{ adapter:"nba-official-team-schedule.v1", sourceUrl:url, checkedAt },
    };
  });
  nbaBundles.forEach(bundle => {
    events.push(...bundle.events);
    sources.push(bundle.source);
  });
  for (const team of [
    { id:"team:hockey:hockeyroos", name:"Hockeyroos", gender:"female", slug:"hockeyroos" },
    { id:"team:hockey:kookaburras", name:"Kookaburras", gender:"male", slug:"kookaburras" },
  ]){
    const url = `https://www.hockey.org.au/teams/${team.slug}/schedule`;
    events.push(...parseHockeySchedulePage(await fetchText(url, fetchImpl), { teamId:team.id, teamName:team.name, gender:team.gender, sourceUrl:url, checkedAt, now:checkedAt }));
    sources.push({ adapter:"hockey-australia-team-schedule.v1", sourceUrl:url, checkedAt });
  }
  const hockeyroosArticleUrl = "https://www.hockey.org.au/news/hockeyroos-brave-world-cup-charge-ends-in-narrow-semi-final-defeat";
  const kookaburrasArticleUrl = "https://www.hockey.org.au/news/kookaburras-shut-out-england-to-secure-fifth-at-world-cup";
  const [hockeyroosArticle, kookaburrasArticle] = await Promise.all([
    fetchText(hockeyroosArticleUrl, fetchImpl),
    fetchText(kookaburrasArticleUrl, fetchImpl),
  ]);
  events.push(...officialHockeyFallbackFixtures({ hockeyroosArticle, kookaburrasArticle, checkedAt }));
  sources.push(
    { adapter:"hockey-australia-world-cup-update.v1", sourceUrl:hockeyroosArticleUrl, checkedAt },
    { adapter:"hockey-australia-world-cup-update.v1", sourceUrl:kookaburrasArticleUrl, checkedAt },
  );
  const netballUrl = "https://netball.com.au/news/2026-con-cup-schedule-revealed";
  events.push(...parseDiamondsArticle(await fetchText(netballUrl, fetchImpl), netballUrl, checkedAt));
  sources.push({ adapter:"netball-australia-constellation-cup.v1", sourceUrl:netballUrl, checkedAt });
  const deduped = Array.from(new Map(events.map(event => {
    const semanticId = event.key === "hockey"
      ? `hockey:${event.date}:${[...(event.participantIds || [])].sort().join(":")}`
      : event.canonicalEventId;
    return [semanticId, event];
  })).values())
    .sort((first, second) => first.startTimeUtc.localeCompare(second.startTimeUtc) || first.canonicalEventId.localeCompare(second.canonicalEventId));
  return { schemaVersion:"follow-source-fixtures.v1", generatedAt:checkedAt, sources, events:deduped };
}

async function main(){
  const checkOnly = process.argv.includes("--check");
  if (checkOnly){
    const payload = validateArtifact(JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")));
    console.log(`Official follow source artifact valid: ${payload.events.length} fixtures.`);
    return;
  }
  let payload;
  try {
    payload = await refresh();
  } catch (error){
    if (!isTransientSourceFailure(error) || !fs.existsSync(OUTPUT_PATH)) throw error;
    payload = validateArtifact(JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")));
    console.warn(`Official follow sources temporarily unavailable; preserving ${payload.events.length} validated fixtures.`);
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive:true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Official follow sources refreshed: ${payload.events.length} fixtures from ${payload.sources.length} API-selectable bundles.`);
}

if (require.main === module){
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  NBA_TEAM_IDS,
  officialHockeyFallbackFixtures,
  parseDiamondsArticle,
  parseHockeySchedulePage,
  parseNbaSchedulePage,
  mapWithConcurrency,
  refresh,
};
