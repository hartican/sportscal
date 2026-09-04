#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const directoryApi = require("../config/football-directory.js");

const ROOT = path.resolve(__dirname, "..");
const CANONICAL = JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical/afl-nrl-2026.json"), "utf8"));
const DIRECTORY_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/team-player-directory.schema.json"), "utf8"));

const DIRECTORY_SPECS = Object.freeze([
  { key: "nrl", label: "NRL", directory: "nrl-directory.v1.json", index: "nrl-follow-index.v1.json", schemaVersion: "nrl-directory.v1", indexVersion: "nrl-follow-index.v1", teamPrefix: "team:nrl:", playerPrefix: "competitor:nrl:", profileHost: "www.nrl.com", minimumPlayers:500 },
  { key: "afl", label: "AFL", directory: "afl-directory.v1.json", index: "afl-follow-index.v1.json", schemaVersion: "afl-directory.v1", indexVersion: "afl-follow-index.v1", teamPrefix: "team:afl:", playerPrefix: "competitor:afl:", profileHost: "www.afl.com.au", minimumPlayers:650 },
  { key: "aflw", label: "AFLW", directory: "aflw-directory.v1.json", index: "aflw-follow-index.v1.json", schemaVersion: "aflw-directory.v1", indexVersion: "aflw-follow-index.v1", teamPrefix: "team:aflw:", playerPrefix: "competitor:aflw:", profileHost: "www.afl.com.au", minimumPlayers:500 },
]);

function readJson(relative){
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function ids(records){
  return records.map(record => record.id);
}

function validateDirectory(spec){
  const directory = readJson(`data/canonical/${spec.directory}`);
  const index = readJson(`data/canonical/${spec.index}`);
  assert.equal(directory.schemaVersion, spec.schemaVersion);
  assert.equal(index.schemaVersion, spec.indexVersion);
  assert(DIRECTORY_SCHEMA.properties.schemaVersion.enum.includes(directory.schemaVersion), `${spec.label} directory must use the shared schema`);
  assert.equal(new Set(ids(directory.teams)).size, directory.teams.length, `${spec.label} team IDs must be unique`);
  assert.equal(new Set(ids(directory.players)).size, directory.players.length, `${spec.label} player IDs must be unique`);
  const generatedAgeDays = (Date.now() - Date.parse(directory.generatedAt)) / 86400000;
  assert(generatedAgeDays >= 0 && generatedAgeDays <= 45, `${spec.label} directory sources must be checked within 45 days`);
  const canonicalTeamIds = CANONICAL.participants
    .filter(participant => participant.type === "team" && participant.sportDomainId === (spec.key === "aflw" ? "sport:afl" : `sport:${spec.key}`) && (spec.key === "nrl" || participant.metadata?.competitionCode === spec.key) && participant.teamCode !== "TBD")
    .map(participant => participant.id)
    .sort();
  assert.deepEqual(ids(directory.teams).sort(), canonicalTeamIds, `${spec.label} must include every current canonical club using its existing ID`);
  assert(directory.teams.every(team => team.id.startsWith(spec.teamPrefix) && team.active), `${spec.label} team records must be active and use existing IDs`);
  assert(directory.players.every(player => player.id.startsWith(spec.playerPrefix) && player.active), `${spec.label} player IDs must be sport-scoped`);
  assert(directory.players.length >= spec.minimumPlayers, `${spec.label} must expose its complete current player directory, not a priority shortlist`);
  const teamIds = new Set(ids(directory.teams));
  const sourceIds = new Set(ids(directory.sources));
  assert(directory.sources.every(source => source.sourceType === "official" && /^https:\/\//.test(source.url)), `${spec.label} sources must be official HTTPS records`);
  directory.teams.forEach(team => team.sourceRefs.forEach(sourceId => assert(sourceIds.has(sourceId), `${team.displayName} has an unknown source`)));
  directory.players.forEach(player => {
    assert(teamIds.has(player.currentTeamId), `${player.displayName} has an unknown current team`);
    assert.equal(player.leagueId, directory.leagues[0].id, `${player.displayName} must point to its league`);
    assert.equal(new URL(player.sourceUrl).host, spec.profileHost, `${player.displayName} source must be first-party`);
    player.sourceRefs.forEach(sourceId => assert(sourceIds.has(sourceId), `${player.displayName} has an unknown source`));
    if (["afl", "aflw"].includes(spec.key)){
      assert(/^https:\/\/s\.afl\.com\.au\//.test(player.headshotUrl || ""), `${player.displayName} must retain the official portrait URL`);
      assert.equal(player.photoURL, player.headshotUrl, `${player.displayName} photoURL and headshotUrl must stay aligned`);
      assert.equal(player.competitionNumberKind, "guernsey");
      assert.equal(player.competitionNumberSeason, "2026");
      assert.equal(player.profileRef, `profile:${spec.key}:${player.id.split(":").at(-1)}`);
    }
  });
  directory.teams.forEach(team => assert(directory.players.filter(player => player.currentTeamId === team.id).length >= 2, `${team.displayName} needs two followable priority players`));
  assert.deepEqual(ids(index.teams).sort(), ids(directory.teams).sort(), `${spec.label} follow index must contain every team`);
  assert.deepEqual(ids(index.players).sort(), ids(directory.players).sort(), `${spec.label} follow index must contain every player`);
  const sample = directory.players[0];
  assert.deepEqual(
    directoryApi.expandedFollowLevels({ participantIds: [sample.currentTeamId] }, { entityFollows: [{ participantId: sample.id, followLevel: "follow" }] }, index),
    ["follow"],
    `${spec.label} player follows must expand to their current club fixture`
  );
  return { directory, index };
}

function validate(){
  const app = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "lib/server-feed-pipeline.js"), "utf8");
  const worker = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const results = DIRECTORY_SPECS.map(validateDirectory);
  assert(app.includes('session.directorySportKey === "nrl"') && app.includes('session.directorySportKey === "afl"') && app.includes('session.directorySportKey === "aflw"'), "Follow must offer NRL, AFL and AFLW directories");
  assert(app.includes("BASE_SPORT_SELECTOR_ENTITIES") && app.includes("renderTeamsAndPlayersDirectory"), "Follow must expose the broader canonical sport chooser without eagerly loading every directory");
  assert(app.includes("loadNrlDirectoryData") && app.includes("loadAflDirectoryData"), "both Australian directories must be lazy-loaded");
  assert(app.includes("profileHasNrlEntityFollow") && app.includes("profileHasAflEntityFollow"), "saved player follows must load their small follow index at startup");
  assert(server.includes("teamPlayerFollowIndex"), "server feeds must expand NRL and AFL player follows");
  assert(!worker.includes('"/data/canonical/nrl-directory.v1.json"') && !worker.includes('"/data/canonical/afl-directory.v1.json"'), "full Australian player catalogues must stay out of the critical shell");
  console.log(`Team-player directories valid: ${results.map(({ directory }) => `${directory.schemaVersion} (${directory.teams.length} clubs, ${directory.players.length} players)`).join("; ")}.`);
  return results;
}

if (require.main === module) validate();
module.exports = { validate };
