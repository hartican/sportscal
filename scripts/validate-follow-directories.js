#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/manifest.v1.json"), "utf8"));
assert.equal(manifest.schemaVersion, "follow-directory-manifest.v1");
assert.equal(manifest.sports.length, 19, "all nineteen exposed top-level sports require lazy chunks");
for (const supportKey of ["hockey", "multi-sport"]){
  const supportChunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${supportKey}.v1.json`), "utf8"));
  assert(supportChunk.records.some(record => record.teamKind === "national"), `${supportKey}: hidden national-team support data must remain current without becoming a top-level Follow category`);
}
manifest.sports.forEach(sport => {
  assert.equal(sport.status, "available", `${sport.key}: every active sport must expose a populated lazy directory`);
  assert.ok(sport.recordCount > 0, `${sport.key}: populated directory cannot be empty`);
  const chunkPath = path.join(ROOT, sport.jsonUrl);
  assert.ok(fs.existsSync(chunkPath), `${sport.key}: JSON chunk missing`);
  assert.ok(fs.existsSync(chunkPath.replace(/\.json$/, ".js")), `${sport.key}: direct-file fallback missing`);
  const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8"));
  assert.equal(chunk.sportKey, sport.key);
  assert.equal(chunk.records.length, sport.recordCount);
  chunk.records.forEach(record => {
    assert.ok(record.id && record.displayName, `${sport.key}: identity fields required`);
    assert.ok(["male", "female", "mixed", "unknown"].includes(record.genderCategory));
    if (sport.key !== "tennis" || !record.watchPoolMember){
      assert.equal(record.current, true, `${record.id}: historical or inactive records are forbidden outside the explicit Tennis watch pool`);
    }
  });
  const ordered = chunk.records.map(record => record.ranking ?? record.ladderPosition ?? Number.MAX_SAFE_INTEGER);
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b), `${sport.key}: null ranks must sort after ranked records`);
});
for (const sportKey of ["extreme", "surf", "skiing", "golf", "boxing"]){
  const chunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${sportKey}.v1.json`), "utf8"));
  assert.ok(chunk.records.every(record => record.countryCode && record.countryBasis), `${sportKey}: supplemented records require country flags and an evidence basis`);
  assert.ok(chunk.records.every(record => record.sourceRefs.some(ref => /^https:\/\//.test(ref))), `${sportKey}: supplemented records require an official source URL`);
  assert.ok(chunk.records.some(record => record.genderCategory === "male"), `${sportKey}: men's choices missing`);
  if (sportKey !== "american-football") assert.ok(chunk.records.some(record => record.genderCategory === "female"), `${sportKey}: women's choices missing`);
}
for (const sportKey of ["american-football", "ice-hockey"]){
  const chunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${sportKey}.v1.json`), "utf8"));
  const teams = chunk.records.filter(record => record.entityType === "team");
  assert.ok(teams.length >= 32, `${sportKey}: complete club directory missing`);
  assert.ok(teams.every(record => record.identityId && record.logoUrl), `${sportKey}: club teams require crests rather than flags`);
  assert.ok(teams.every(record => record.sourceRefs.some(ref => /^https:\/\//.test(ref))), `${sportKey}: teams require a current source URL`);
}
const runtime = require(path.join(ROOT, "config/football-directory.js"));
const football = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/football.v1.json"), "utf8"));
const lucas = football.records.find(record => record.displayName === "Lucas Herrington");
assert.ok(lucas, "Lucas Herrington must remain in the current Football directory");
assert.ok(Number.isFinite(runtime.searchMatchScore(lucas, "Harrington")), "one-character Football search variants must match");
const tennis = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/tennis.v1.json"), "utf8"));
assert.equal(tennis.records.filter(record => record.watchPoolMember).length, 50, "Tennis must expose exactly fifty watch-pool players");
assert.equal(tennis.collections.length, 6, "Tennis must expose the six hierarchical collections");
assert.equal(new Set(tennis.records.map(record => record.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())).size, tennis.records.length, "Tennis player rows must be deduplicated by name");
for (const collectionId of ["collection:tennis:mens-top-10", "collection:tennis:womens-top-10"]){
  assert.equal(tennis.collections.find(collection => collection.id === collectionId)?.memberIds.length, 10, `${collectionId}: current top ten must contain ten players`);
}
console.log(`Follow directory manifest valid: ${manifest.sports.length} chunks, tolerant search and current-only records.`);
