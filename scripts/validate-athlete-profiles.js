#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const manifest = read("data/athlete-profiles/manifest.v1.json");
assert.equal(manifest.schemaVersion, "athlete-profile-manifest.v1");
assert.deepEqual(manifest.sports.map(sport => sport.key), ["afl", "aflw", "f1"]);
const chunks = Object.fromEntries(manifest.sports.map(sport => [sport.key, read(sport.jsonUrl)]));
assert.equal(chunks.afl.profiles.length, 10);
assert.equal(chunks.f1.profiles.length, 10);
assert.ok(chunks.aflw.profiles.length >= 31);
for (const chunk of Object.values(chunks)){
  const ids = new Set();
  for (const profile of chunk.profiles){
    assert.equal(profile.schemaVersion, "athlete-profile.v1");
    assert.ok(profile.id && !ids.has(profile.id)); ids.add(profile.id);
    assert.match(profile.headshotUrl, /^https:\/\//);
    assert.ok(Number(profile.competitionNumber) > 0);
    assert.ok(profile.biography.length >= 140);
    assert.ok(profile.keyFacts.length >= 2);
    assert.ok(profile.seasonStats.length >= 2);
    assert.ok(profile.careerStats.length >= 2);
    assert.ok(profile.sourceLinks.length >= 1);
  }
  assert.equal(chunk.profiles.filter(profile => profile.selection?.topTen).length, 10);
}
assert.ok(chunks.f1.profiles.every(profile => profile.recentFive.length === 5), "F1 top-ten profiles require the latest five official results");
const aflwDirectory = read("data/canonical/aflw-directory.v1.json");
const gws = aflwDirectory.players.filter(player => player.currentTeamId === "team:aflw:cd_t7889");
assert.equal(gws.length, 31);
assert.ok(gws.every(player => player.headshotUrl && Number(player.competitionNumber) > 0 && player.profileRef));
const aflwProfileIds = new Set(chunks.aflw.profiles.map(profile => profile.participantId));
assert.ok(gws.every(player => aflwProfileIds.has(player.id)));
const f1 = read("data/canonical/f1-context-2026.json");
const grid = f1.participants.filter(item => item.type === "competitor" && item.metadata?.active !== false);
assert.equal(grid.length, 22);
assert.equal(new Set(grid.map(driver => driver.competitionNumber)).size, 22);
assert.ok(grid.every(driver => driver.headshotUrl && driver.profileRef && Number(driver.competitionNumber) > 0));
console.log(`Athlete profiles valid: AFL 10, AFLW ${chunks.aflw.profiles.length} including 31 GWS players, F1 10 from a 22-driver grid.`);
