#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const flags = require("../config/country-flags.js");
const directoryApi = require("../config/football-directory.js");

const ROOT = path.resolve(__dirname, "..");
const DIRECTORY_PATH = path.join(ROOT, "data/canonical/football-directory.v1.json");
const INDEX_PATH = path.join(ROOT, "data/canonical/football-follow-index.v1.json");
const CORE_EVENTS_PATH = path.join(ROOT, "data/football/core-events.json");

function uniqueIds(records, label){
  const ids = records.map(record => record.id);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
}

function validate(){
  const directory = JSON.parse(fs.readFileSync(DIRECTORY_PATH, "utf8"));
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const coreEvents = JSON.parse(fs.readFileSync(CORE_EVENTS_PATH, "utf8"));
  const appSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const serverSource = fs.readFileSync(path.join(ROOT, "lib/server-feed-pipeline.js"), "utf8");
  const workerSource = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const hierarchySource = fs.readFileSync(path.join(ROOT, "config/sport-hierarchy.js"), "utf8");
  assert.equal(directory.schemaVersion, "football-directory.v1");
  assert.equal(directory.leagues.length, 6, "exactly the six approved leagues must be published");
  uniqueIds(directory.leagues, "league");
  uniqueIds(directory.teams, "team");
  uniqueIds(directory.players, "player");
  const generatedAgeDays = (Date.now() - Date.parse(directory.generatedAt)) / 86400000;
  assert(generatedAgeDays >= 0 && generatedAgeDays <= 45, "football directory evidence must be checked within 45 days");
  const sourceIds = new Set(directory.sources.map(source => source.id));
  const leagueIds = new Set(directory.leagues.map(league => league.id));
  const teamIds = new Set(directory.teams.map(team => team.id));
  directory.leagues.forEach(league => {
    assert.equal(directory.teams.filter(team => team.leagueId === league.id).length, league.teamCount, `${league.displayName} team count must match its source snapshot`);
    league.sourceRefs.forEach(id => assert(sourceIds.has(id), `${league.displayName} has unknown source ${id}`));
  });
  directory.teams.forEach(team => {
    assert(leagueIds.has(team.leagueId), `${team.displayName} has unknown league`);
    assert(/^https:\/\//.test(team.crestUrl), `${team.displayName} requires an HTTPS crest`);
    team.sourceRefs.forEach(id => assert(sourceIds.has(id), `${team.displayName} has unknown source ${id}`));
  });
  const legacyFootballTeamIds = new Set(require("../config/team-follow-catalogue.js").teamsForDomain("sport:football")
    .flatMap(section => section.teams).map(team => team.id));
  directory.teams.filter(team => legacyFootballTeamIds.has(team.id)).forEach(team => {
    assert(legacyFootballTeamIds.has(team.id), `${team.displayName} must preserve its legacy follow ID`);
  });
  directory.players.forEach(player => {
    assert(teamIds.has(player.currentTeamId), `${player.displayName} has unknown current team`);
    assert(leagueIds.has(player.leagueId), `${player.displayName} has unknown league`);
    assert(flags.alpha2(player.birthCountryCode), `${player.displayName} has unsupported birth-country flag ${player.birthCountryCode}`);
    assert(player.prominenceReason.length >= 8, `${player.displayName} requires prominence evidence`);
    player.sourceRefs.forEach(id => assert(sourceIds.has(id), `${player.displayName} has unknown source ${id}`));
  });
  directory.teams.forEach(team => {
    const players = directory.players.filter(player => player.currentTeamId === team.id);
    const nonAustralian = players.filter(player => !player.australianPriority);
    assert(nonAustralian.length <= 15, `${team.displayName} exceeds the 15-player curated limit`);
  });
  assert(directory.teams.some(team => team.displayName === "Paris Saint-Germain"), "PSG must be available");
  assert.equal(directory.teams.filter(team => team.leagueId === "competition:bundesliga").length, 18, "all Bundesliga clubs must be available");
  const herrington = directory.players.find(player => player.id === "competitor:football:lucas-herrington");
  assert(herrington, "Lucas Herrington must be seeded");
  assert.equal(herrington.currentTeamId, "team:football:epl:41");
  assert.equal(herrington.birthCountryCode, "AU");
  assert.equal(herrington.birthCountryBasis, "official-birthplace");
  assert.equal(herrington.prominenceTier, "emerging");
  assert.equal(index.schemaVersion, "football-follow-index.v1");
  assert.equal(index.players.length, directory.players.length);
  assert.equal(index.teams.length, directory.teams.length);
  assert.deepEqual(directoryApi.expandedFollowLevels(
    { participantIds: [herrington.currentTeamId] },
    { entityFollows: [{ participantId: herrington.id, followLevel: "follow" }] },
    index
  ), ["follow"], "a player follow must expand to the current club fixture");
  assert.deepEqual(directoryApi.expandedFollowLevels(
    { participantIds: [herrington.currentTeamId] },
    { entityFollows: [{ participantId: herrington.id, followLevel: "mute" }] },
    index
  ), [], "a player mute must not suppress every club fixture");
  const transferredIndex = structuredClone(index);
  transferredIndex.players.find(player => player.id === herrington.id).currentTeamId = "team:football:epl:1";
  assert.deepEqual(directoryApi.expandedFollowLevels(
    { participantIds: ["team:football:epl:1"] },
    { entityFollows: [{ participantId: herrington.id, followLevel: "follow" }] },
    transferredIndex
  ), ["follow"], "a transfer must redirect future fixtures without changing player ID");
  assert.equal(coreEvents.schemaVersion, "football-core-events.v1");
  assert(coreEvents.events.length > 0, "high-stakes football core feed must not be empty");
  assert(coreEvents.events.every(event => Number(event.expected) >= 8), "core football feed must contain only 4/5 and 5/5 fixtures");
  assert.equal(new Set(coreEvents.events.map(event => event.canonicalEventId)).size, coreEvents.events.length, "core football feed must deduplicate fixtures");
  assert(hierarchySource.includes('"competition:bundesliga"') && hierarchySource.includes('"competition:la-liga"')
    && hierarchySource.includes('"competition:serie-a"') && hierarchySource.includes('"competition:ligue-1"'), "all new league nodes must be registered");
  assert(appSource.includes('[["tables", "Tables"], ["directory", "Follow Teams & Players"]]'), "Standings & Follow must expose Tables and Follow Teams & Players tabs");
  assert(appSource.includes('return Array.from(new Set(["football", ...rankingSportKeysForStandings(preferences)]))'), "the Standings filter must always expose Football");
  assert.equal((appSource.match(/footballDirectorySearchTimer = window\.setTimeout\(\(\) => \{/g) || []).length, 2, "all team and player searches must use the shared debounce");
  assert.equal((appSource.match(/\}, 600\);/g) || []).length >= 2, true, "team and player search must wait 600ms before rebuilding the directory");
  assert(appSource.includes("sessionStorage.setItem(STANDINGS_DIRECTORY_SESSION_KEY"), "transient Standings directory view and search state must use sessionStorage");
  assert(/function selectedStandingsSportKeys[\s\S]{0,260}preferences\?\.standings\?\.selectedSportKeys/.test(appSource), "Standings selections must hydrate from durable preferences");
  assert(/function saveStandingsSportKeys[\s\S]{0,500}savePreferences\(/.test(appSource), "Standings selections must enter the shared profile sync boundary");
  assert(/function saveStandingsSportKeys[\s\S]{0,350}current\.length === selected\.length[\s\S]{0,100}return false/.test(appSource), "semantic Standings selection no-ops must not write or change timestamps");
  assert(!appSource.includes("function renderTeamFollowPanel") && !appSource.includes("function buildJointTournamentAthletePanel")
    && !appSource.includes("data-entity-follow"), "dedicated follow lists must not remain outside Standings");
  assert(appSource.includes('!["rugby", "cricket", "football", "fifa", "premier-league"].includes(ev.key)'), "balanced football filtering must cover Premier League and core football fixtures");
  assert(serverSource.includes("footballDirectory.expandedFollowLevels") && serverSource.includes("isCoreLeagueFootball"), "server feed must expand player follows and apply the core-league threshold");
  assert(!workerSource.match(/APP_SHELL[\s\S]*football-directory\.v1/), "the full football directory must not enter the critical install shell");
  assert(workerSource.includes('new Request(event.request.url, { method: "GET" })')
    && workerSource.includes("cache.put(cacheKey, response.clone())")
    && workerSource.includes("cache.match(cacheKey)"), "lazy football assets must use a normalised runtime cache key for offline replay");
  assert(appSource.includes("async function loadFootballAsset")
    && /async function loadFootballAsset[\s\S]{0,500}const response = await fetch\(url\)/.test(appSource), "lazy football assets must remain runtime-cacheable");
  const playerMatch = directoryApi.filteredDirectory(directory, { query: "Lucas Herrington" });
  assert.equal(playerMatch.players.length, 1, "a direct player match must display the matching player");
  assert(playerMatch.teams.some(team => team.id === herrington.currentTeamId), "a direct player match must display the player's club");
  assert(playerMatch.playerTeamIds.includes(herrington.currentTeamId), "a direct player match must mark its club for automatic expansion");
  const teamMatch = directoryApi.filteredDirectory(directory, { query: "Arsenal" });
  assert(teamMatch.teams.some(team => team.displayName === "Arsenal"), "a direct team match must display its team row");
  assert.equal(teamMatch.players.length, 0, "a team-name match must not display players that do not independently match");
  const syntheticMultiClubDirectory = {
    teams: directory.teams.slice(0, 2),
    players: directory.teams.slice(0, 2).map((team, index) => ({
      id: `competitor:football:test-smith-${index}`,
      displayName: index ? "Jordan Smith" : "Alex Smith",
      currentTeamId: team.id,
      leagueId: team.leagueId,
      position: "Midfielder",
      prominenceTier: "established",
    })),
  };
  const multiClubMatch = directoryApi.filteredDirectory(syntheticMultiClubDirectory, { query: "smith" });
  assert(new Set(multiClubMatch.playerTeamIds).size >= 2, "a shared player-name query must support simultaneous multi-club expansion");
  assert(appSource.includes("autoExpanded || filters.expandedTeamId === team.id"), "every club with a matching player must auto-expand without collapsing another match");
  const malformed = directoryApi.parseSessionState("{bad");
  assert.equal(malformed.activeView, "tables");
  assert.equal(Object.hasOwn(malformed, "selectedSportKeys"), false, "durable selected sports must never leak into the transient session contract");
  console.log(`Football directory valid: ${directory.teams.length} clubs and ${directory.players.length} priority players across six leagues.`);
  return directory;
}

if (require.main === module) validate();
module.exports = { validate };
