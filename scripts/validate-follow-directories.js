#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/manifest.v1.json"), "utf8"));
assert.equal(manifest.schemaVersion, "follow-directory-manifest.v1");
assert.equal(manifest.sports.length, 21, "all 21 active top-level sports require lazy chunks");
manifest.sports.forEach(sport => {
  const chunkPath = path.join(ROOT, sport.jsonUrl);
  assert.ok(fs.existsSync(chunkPath), `${sport.key}: JSON chunk missing`);
  assert.ok(fs.existsSync(chunkPath.replace(/\.json$/, ".js")), `${sport.key}: direct-file fallback missing`);
  const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8"));
  assert.equal(chunk.sportKey, sport.key);
  assert.equal(chunk.records.length, sport.recordCount);
  chunk.records.forEach(record => {
    assert.ok(record.id && record.displayName, `${sport.key}: identity fields required`);
    assert.ok(["male", "female", "mixed", "unknown"].includes(record.genderCategory));
    assert.equal(record.current, true, `${record.id}: historical or inactive records are forbidden`);
  });
});
const runtime = require(path.join(ROOT, "config/football-directory.js"));
const football = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/football.v1.json"), "utf8"));
const lucas = football.records.find(record => record.displayName === "Lucas Herrington");
assert.ok(lucas, "Lucas Herrington must remain in the current Football directory");
assert.ok(Number.isFinite(runtime.searchMatchScore(lucas, "Harrington")), "one-character Football search variants must match");
console.log(`Follow directory manifest valid: ${manifest.sports.length} chunks, tolerant search and current-only records.`);
