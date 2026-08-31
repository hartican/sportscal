#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CHECKED_AT = "2026-08-23T12:00:00.000Z";
const AFL_COMPETITION_SEASONS_URL = "https://aflapi.afl.com.au/afl/v2/competitions/1/compseasons?pageSize=20";
const AFL_SQUADS_URL = "https://aflapi.afl.com.au/afl/v2/squads";
const NRL_PLAYERS_DATA_URL = "https://www.nrl.com/players/data";

const NRL_PLAYERS = Object.freeze([
  ["team:nrl:322", "Adam Reynolds", "adam-reynolds", "Halfback", "broncos"],
  ["team:nrl:322", "Reece Walsh", "reece-walsh", "Fullback", "broncos"],
  ["team:nrl:332", "Stephen Crichton", "stephen-crichton", "Centre", "bulldogs"],
  ["team:nrl:332", "Jacob Kiraz", "jacob-kiraz", "Winger", "bulldogs"],
  ["team:nrl:326", "Reuben Cotter", "reuben-cotter", "Prop", "cowboys"],
  ["team:nrl:326", "Jake Clifford", "jake-clifford", "Halfback", "cowboys"],
  ["team:nrl:9538", "Isaiya Katoa", "isaiya-katoa", "Five-Eighth", "dolphins"],
  ["team:nrl:9538", "Jamayne Isaako", "jamayne-isaako", "Winger", "dolphins"],
  ["team:nrl:330", "Clinton Gutherson", "clinton-gutherson", "Fullback", "dragons"],
  ["team:nrl:330", "Valentine Holmes", "valentine-holmes", "Centre", "dragons"],
  ["team:nrl:328", "Mitchell Moses", "mitchell-moses", "Halfback", "eels"],
  ["team:nrl:328", "Tallyn Da Silva", "tallyn-da-silva", "Hooker", "eels"],
  ["team:nrl:325", "Kalyn Ponga", "kalyn-ponga", "Fullback", "knights"],
  ["team:nrl:325", "Greg Marzhew", "greg-marzhew", "Winger", "knights"],
  ["team:nrl:329", "Isaah Yeo", "isaah-yeo", "Lock", "panthers"],
  ["team:nrl:329", "Nathan Cleary", "nathan-cleary", "Halfback", "panthers"],
  ["team:nrl:335", "Cameron Murray", "cameron-murray", "Lock", "rabbitohs"],
  ["team:nrl:335", "Latrell Mitchell", "latrell-mitchell", "Fullback", "rabbitohs"],
  ["team:nrl:323", "Joseph Tapine", "joseph-tapine", "Prop", "raiders"],
  ["team:nrl:323", "Kaeo Weekes", "kaeo-weekes", "Fullback", "raiders"],
  ["team:nrl:331", "James Tedesco", "james-tedesco", "Fullback", "roosters"],
  ["team:nrl:331", "Sam Walker", "sam-walker", "Halfback", "roosters"],
  ["team:nrl:336", "Jamal Fogarty", "jamal-fogarty", "Halfback", "sea-eagles"],
  ["team:nrl:336", "Lehi Hopoate", "lehi-hopoate", "Winger", "sea-eagles"],
  ["team:nrl:333", "Cameron McInnes", "cameron-mcinnes", "Hooker", "sharks"],
  ["team:nrl:333", "Nicho Hynes", "nicho-hynes", "Halfback", "sharks"],
  ["team:nrl:324", "Harry Grant", "harry-grant", "Hooker", "storm"],
  ["team:nrl:324", "Nick Meaney", "nick-meaney", "Fullback", "storm"],
  ["team:nrl:337", "Tino Fa'asuamaleaui", "tino-faasuamaleaui", "Prop", "titans"],
  ["team:nrl:337", "Jayden Campbell", "jayden-campbell", "Halfback", "titans"],
  ["team:nrl:321", "James Fisher-Harris", "james-fisher-harris", "Prop", "warriors"],
  ["team:nrl:321", "Tanah Boyd", "tanah-boyd", "Halfback", "warriors"],
  ["team:nrl:334", "Apisai Koroisau", "apisai-koroisau", "Hooker", "wests-tigers"],
  ["team:nrl:334", "Adam Doueihi", "adam-doueihi", "Centre", "wests-tigers"],
]);

const AFL_PLAYERS = Object.freeze([
  ["team:afl:cd_t10", "Jordan Dawson", "jordan-dawson", "Midfielder", "adelaide-crows"],
  ["team:afl:cd_t10", "Izak Rankine", "izak-rankine", "Midfielder", "adelaide-crows"],
  ["team:afl:cd_t20", "Harris Andrews", "harris-andrews", "Key Defender", "brisbane-lions"],
  ["team:afl:cd_t20", "Hugh McCluggage", "hugh-mccluggage", "Midfielder", "brisbane-lions"],
  ["team:afl:cd_t30", "Patrick Cripps", "patrick-cripps", "Midfielder", "carlton"],
  ["team:afl:cd_t30", "Sam Walsh", "sam-walsh", "Midfielder", "carlton"],
  ["team:afl:cd_t40", "Darcy Moore", "darcy-moore", "Key Defender", "collingwood"],
  ["team:afl:cd_t40", "Nick Daicos", "nick-daicos", "Midfielder", "collingwood"],
  ["team:afl:cd_t50", "Zach Merrett", "zach-merrett", "Midfielder", "essendon"],
  ["team:afl:cd_t50", "Nate Caddy", "nate-caddy", "Key Forward", "essendon"],
  ["team:afl:cd_t60", "Alex Pearce", "alex-pearce", "Key Defender", "fremantle"],
  ["team:afl:cd_t60", "Caleb Serong", "caleb-serong", "Midfielder", "fremantle"],
  ["team:afl:cd_t70", "Patrick Dangerfield", "patrick-dangerfield", "Midfielder", "geelong-cats"],
  ["team:afl:cd_t70", "Jeremy Cameron", "jeremy-cameron", "Key Forward", "geelong-cats"],
  ["team:afl:cd_t1000", "Noah Anderson", "noah-anderson", "Midfielder", "gold-coast-suns"],
  ["team:afl:cd_t1000", "Matt Rowell", "matt-rowell", "Midfielder", "gold-coast-suns"],
  ["team:afl:cd_t1010", "Toby Greene", "toby-greene", "Forward", "gws-giants"],
  ["team:afl:cd_t1010", "Tom Green", "tom-green", "Midfielder", "gws-giants"],
  ["team:afl:cd_t80", "James Sicily", "james-sicily", "Defender", "hawthorn"],
  ["team:afl:cd_t80", "Jai Newcombe", "jai-newcombe", "Midfielder", "hawthorn"],
  ["team:afl:cd_t90", "Max Gawn", "max-gawn", "Ruck", "melbourne"],
  ["team:afl:cd_t90", "Kysaiah Pickett", "kysaiah-pickett", "Midfielder", "melbourne"],
  ["team:afl:cd_t100", "Jy Simpkin", "jy-simpkin", "Midfielder", "north-melbourne"],
  ["team:afl:cd_t100", "Harry Sheezel", "harry-sheezel", "Midfielder", "north-melbourne"],
  ["team:afl:cd_t110", "Connor Rozee", "connor-rozee", "Midfielder", "port-adelaide"],
  ["team:afl:cd_t110", "Zak Butters", "zak-butters", "Midfielder", "port-adelaide"],
  ["team:afl:cd_t120", "Toby Nankervis", "toby-nankervis", "Ruck", "richmond"],
  ["team:afl:cd_t120", "Tim Taranto", "tim-taranto", "Midfielder", "richmond"],
  ["team:afl:cd_t130", "Jack Sinclair", "jack-sinclair", "Medium Defender", "st-kilda"],
  ["team:afl:cd_t130", "Callum Wilkie", "callum-wilkie", "Key Defender", "st-kilda"],
  ["team:afl:cd_t160", "Callum Mills", "callum-mills", "Midfielder", "sydney-swans"],
  ["team:afl:cd_t160", "Chad Warner", "chad-warner", "Midfielder", "sydney-swans"],
  ["team:afl:cd_t150", "Liam Duggan", "liam-duggan", "Medium Defender", "west-coast-eagles"],
  ["team:afl:cd_t150", "Harley Reid", "harley-reid", "Midfielder", "west-coast-eagles"],
  ["team:afl:cd_t140", "Marcus Bontempelli", "marcus-bontempelli", "Midfielder", "western-bulldogs"],
  ["team:afl:cd_t140", "Sam Darcy", "sam-darcy", "Key Forward", "western-bulldogs"],
]);

const AFL_PLAYER_PROFILE_IDS = Object.freeze({
  "jordan-dawson": 1080, "izak-rankine": 1815, "harris-andrews": 822, "hugh-mccluggage": 1301,
  "patrick-cripps": 270, "sam-walsh": 1896, "darcy-moore": 895, "nick-daicos": 5257,
  "zach-merrett": 170, "nate-caddy": 6608, "alex-pearce": 465, "caleb-serong": 2304,
  "patrick-dangerfield": 10, "jeremy-cameron": 223, "noah-anderson": 2783, "matt-rowell": 2790,
  "toby-greene": 657, "tom-green": 2617, "james-sicily": 514, "jai-newcombe": 4712,
  "max-gawn": 412, "kysaiah-pickett": 3727, "jy-simpkin": 1405, "harry-sheezel": 5522,
  "connor-rozee": 1848, "zak-butters": 1856, "toby-nankervis": 790, "tim-taranto": 1395,
  "jack-sinclair": 1072, "callum-wilkie": 1855, "callum-mills": 1133, "chad-warner": 3735,
  "liam-duggan": 956, "harley-reid": 5377, "marcus-bontempelli": 857, "sam-darcy": 5292,
});

function readCanonical(){
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical/afl-nrl-2026.json"), "utf8"));
}

function writeOrCheck(filePath, content, check){
  const relative = path.relative(ROOT, filePath);
  if (check){
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== content){
      throw new Error(`${relative} is stale; run node scripts/build-team-player-directories.js`);
    }
    return;
  }
  fs.writeFileSync(filePath, content);
}

function slugify(value){
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function officialJson(url, headers = {}){
  const response = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"nothingsport-directory-refresh/1.0", ...headers }, signal:AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Official directory request failed (${response.status}): ${url}`);
  return response.json();
}

async function refreshNrlPlayerRows(canonical){
  const teams = canonical.participants.filter(participant => participant.type === "team" && participant.sportDomainId === "sport:nrl");
  const first = await officialJson(`${NRL_PLAYERS_DATA_URL}?competition=111&team=0`, { Referer:"https://www.nrl.com/players/?competition=111" });
  const filters = (first.filterTeams || []).filter(team => Number(team.value) > 0);
  if (filters.length !== 17) throw new Error(`Expected 17 NRL club filters, received ${filters.length}`);
  const byNickname = new Map(teams.flatMap(team => [team.displayName, team.canonicalName, team.shortName]
    .filter(Boolean).map(name => [String(name).toLowerCase(), team.id])));
  const clubPayloads = await Promise.all(filters.map(team => officialJson(
    `${NRL_PLAYERS_DATA_URL}?competition=111&team=${encodeURIComponent(team.value)}`,
    { Referer:"https://www.nrl.com/players/?competition=111" }
  )));
  const rows = clubPayloads.flatMap(payload => payload.profileGroups?.flatMap(group => group.profiles || []) || []);
  const unique = new Map();
  rows.forEach(profile => {
    const displayName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    const sourcePath = String(profile.url || "");
    const slug = sourcePath.split("/").filter(Boolean).at(-1) || slugify(displayName);
    const currentTeamId = byNickname.get(String(profile.teamNickName || "").toLowerCase());
    if (!displayName || !slug || !currentTeamId) return;
    unique.set(`competitor:nrl:${slug}`, [currentTeamId, displayName, slug, profile.position || "Player", sourcePath]);
  });
  if (unique.size < 500) throw new Error(`Expected a complete NRL player directory, received ${unique.size} players`);
  return [...unique.values()].sort((a, b) => a[1].localeCompare(b[1]));
}

async function refreshAflPlayerRows(canonical){
  const teams = canonical.participants
    .filter(participant => participant.type === "team" && participant.sportDomainId === "sport:afl" && participant.teamCode !== "TBD");
  const seasons = await officialJson(AFL_COMPETITION_SEASONS_URL, { Origin:"https://www.afl.com.au", Referer:"https://www.afl.com.au/" });
  const season = (seasons.compSeasons || []).find(item => /^2026\b/.test(item.name));
  if (!season?.id) throw new Error("The current AFL competition season is unavailable");
  const squads = await Promise.all(teams.map(team => {
    const sourceTeamId = Number(team.metadata?.sourceTeamId);
    const url = `${AFL_SQUADS_URL}?teamId=${sourceTeamId}&compSeasonId=${season.id}&pageSize=1000`;
    return officialJson(url, { Origin:"https://www.afl.com.au", Referer:"https://www.afl.com.au/" });
  }));
  const rows = squads.flatMap(payload => {
    const canonicalTeam = teams.find(team => team.metadata?.providerId === payload.squad?.team?.providerId);
    return (payload.squad?.players || []).map(slot => {
      const player = slot.player || {};
      const displayName = `${player.firstName || ""} ${player.surname || ""}`.trim();
      const slug = slugify(displayName);
      const position = String(slot.position || "Player").toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
      return [canonicalTeam?.id || "", displayName, slug, position, player.id];
    });
  }).filter(row => row[0] && row[1] && row[2] && Number(row[4]) > 0);
  const unique = new Map(rows.map(row => [`competitor:afl:${row[2]}`, row]));
  if (unique.size < 650) throw new Error(`Expected a complete AFL player directory, received ${unique.size} players`);
  return [...unique.values()].sort((a, b) => a[1].localeCompare(b[1]));
}

function buildNrlDirectory(canonical, playerRows = NRL_PLAYERS, checkedAt = CHECKED_AT){
  const leagueId = "competition:nrl-premiership-2026";
  const teams = canonical.participants
    .filter(participant => participant.type === "team" && participant.sportDomainId === "sport:nrl")
    .map(participant => ({
      id: participant.id,
      leagueId,
      displayName: participant.canonicalName || participant.displayName,
      shortName: participant.displayName,
      aliases: Array.from(new Set([participant.displayName, participant.canonicalName].filter(Boolean))),
      sourceRefs: ["source:nrl:clubs"],
      active: true,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const teamIds = new Set(teams.map(team => team.id));
  const players = playerRows.map(([currentTeamId, displayName, slug, position, sourcePath]) => ({
    id: `competitor:nrl:${slug}`,
    displayName,
    sortName: displayName,
    currentTeamId,
    leagueId,
    position,
    sourceUrl: sourcePath?.startsWith("/") ? `https://www.nrl.com${sourcePath}` : `https://www.nrl.com/players/nrl-premiership/${sourcePath || "players"}/${slug}/`,
    sourceRefs: ["source:nrl:players", "source:nrl:signings-2026"],
    active: true,
  }));
  if (teams.length !== 17 || players.some(player => !teamIds.has(player.currentTeamId))){
    throw new Error("NRL directory inputs no longer match the canonical club set");
  }
  return {
    schemaVersion: "nrl-directory.v1",
    seasonLabel: "2026",
    generatedAt: checkedAt,
    sources: [
      { id: "source:nrl:clubs", provider: "NRL", url: "https://www.nrl.com/clubs/", sourceType: "official", checkedAt },
      { id: "source:nrl:players", provider: "NRL", url: "https://www.nrl.com/players/?competition=111", sourceType: "official", checkedAt },
      { id: "source:nrl:signings-2026", provider: "NRL", url: "https://www.nrl.com/news/2026/01/01/2026-nrl-signings-tracker-the-latest-from-all-17-clubs/", sourceType: "official", checkedAt },
    ],
    leagues: [{ id: leagueId, key: "nrl", displayName: "NRL Premiership", countryCode: "AU", seasonLabel: "2026", teamCount: teams.length, sourceRefs: ["source:nrl:clubs", "source:nrl:signings-2026"] }],
    teams,
    players,
  };
}

function buildAflDirectory(canonical, playerRows = AFL_PLAYERS, checkedAt = CHECKED_AT){
  const leagueId = "competition:afl-premiership-2026";
  const teams = canonical.participants
    .filter(participant => participant.type === "team" && participant.sportDomainId === "sport:afl" && participant.teamCode !== "TBD")
    .map(participant => ({
      id: participant.id,
      leagueId,
      displayName: participant.canonicalName || participant.displayName,
      shortName: participant.displayName,
      aliases: Array.from(new Set([participant.displayName, participant.canonicalName, participant.shortName].filter(Boolean))),
      sourceRefs: ["source:afl:teams"],
      active: true,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const teamIds = new Set(teams.map(team => team.id));
  const players = playerRows.map(([currentTeamId, displayName, slug, position, profileId]) => ({
    id: `competitor:afl:${slug}`,
    displayName,
    sortName: displayName,
    currentTeamId,
    leagueId,
    position,
    sourceUrl: `https://www.afl.com.au/players/${profileId || AFL_PLAYER_PROFILE_IDS[slug]}/${slug}`,
    sourceRefs: ["source:afl:players", "source:afl:teams"],
    active: true,
  }));
  if (teams.length !== 18 || players.some(player => !teamIds.has(player.currentTeamId)) || players.some(player => !/^https:\/\/www\.afl\.com\.au\/players\/\d+\//.test(player.sourceUrl))){
    throw new Error("AFL directory inputs no longer match the canonical club set");
  }
  return {
    schemaVersion: "afl-directory.v1",
    seasonLabel: "2026",
    generatedAt: checkedAt,
    sources: [
      { id: "source:afl:teams", provider: "AFL", url: "https://www.afl.com.au/teams", sourceType: "official", checkedAt },
      { id: "source:afl:players", provider: "AFL", url: "https://aflapi.afl.com.au/afl/v2/squads?teamId={teamId}&compSeasonId={compSeasonId}&pageSize=1000", sourceType: "official", checkedAt },
    ],
    leagues: [{ id: leagueId, key: "afl", displayName: "AFL Premiership", countryCode: "AU", seasonLabel: "2026", teamCount: teams.length, sourceRefs: ["source:afl:teams", "source:afl:players"] }],
    teams,
    players,
  };
}

function buildIndex(directory, schemaVersion){
  return {
    schemaVersion,
    generatedAt: directory.generatedAt,
    teams: directory.teams.map(({ id, leagueId }) => ({ id, leagueId })),
    players: directory.players.map(({ id, currentTeamId, leagueId }) => ({ id, currentTeamId, leagueId })),
  };
}

function publishDirectory({ filename, scriptGlobal, directory, indexFilename, indexScriptGlobal, indexSchemaVersion, check }){
  const directoryJson = `${JSON.stringify(directory, null, 2)}\n`;
  const index = buildIndex(directory, indexSchemaVersion);
  const indexJson = `${JSON.stringify(index, null, 2)}\n`;
  writeOrCheck(path.join(ROOT, "data/canonical", filename), directoryJson, check);
  writeOrCheck(path.join(ROOT, "data/canonical", filename.replace(/\.json$/, ".js")), `globalThis.${scriptGlobal} = ${JSON.stringify(directory)};\n`, check);
  writeOrCheck(path.join(ROOT, "data/canonical", indexFilename), indexJson, check);
  writeOrCheck(path.join(ROOT, "data/canonical", indexFilename.replace(/\.json$/, ".js")), `globalThis.${indexScriptGlobal} = ${JSON.stringify(index)};\n`, check);
}

function readPublishedDirectory(filename){
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical", filename), "utf8"));
}

async function main(){
  const check = process.argv.includes("--check");
  const canonical = readCanonical();
  const checkedAt = new Date().toISOString();
  const nrlDirectory = check
    ? readPublishedDirectory("nrl-directory.v1.json")
    : buildNrlDirectory(canonical, await refreshNrlPlayerRows(canonical), checkedAt);
  const aflDirectory = check
    ? readPublishedDirectory("afl-directory.v1.json")
    : buildAflDirectory(canonical, await refreshAflPlayerRows(canonical), checkedAt);
  publishDirectory({
    filename: "nrl-directory.v1.json",
    scriptGlobal: "NOTHINGSPORTS_NRL_DIRECTORY_DATA",
    directory: nrlDirectory,
    indexFilename: "nrl-follow-index.v1.json",
    indexScriptGlobal: "NOTHINGSPORTS_NRL_FOLLOW_INDEX",
    indexSchemaVersion: "nrl-follow-index.v1",
    check,
  });
  publishDirectory({
    filename: "afl-directory.v1.json",
    scriptGlobal: "NOTHINGSPORTS_AFL_DIRECTORY_DATA",
    directory: aflDirectory,
    indexFilename: "afl-follow-index.v1.json",
    indexScriptGlobal: "NOTHINGSPORTS_AFL_FOLLOW_INDEX",
    indexSchemaVersion: "afl-follow-index.v1",
    check,
  });
  console.log(`Team-player directories ${check ? "are current" : "written"}.`);
}

if (require.main === module) main().catch(error => {
  const transient = /fetch failed|abort|timed?\s*out|econn|enotfound|5\d\d\b/i.test(String(error?.stack || error?.message || error));
  const published = ["nrl-directory.v1.json", "afl-directory.v1.json"].every(filename => fs.existsSync(path.join(ROOT, "data/canonical", filename)));
  if (transient && published){
    console.warn(`Team-player source unavailable; preserving existing directories for the immediate --check validation: ${error.message}`);
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
module.exports = { buildNrlDirectory, buildAflDirectory, buildIndex, refreshNrlPlayerRows, refreshAflPlayerRows };
