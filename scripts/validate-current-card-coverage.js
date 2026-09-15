#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const evidence = read("data/canonical/current-card-evidence-2026.json");
const published = read("data/events.json").events || [];
const cricket = read("data/follow-schedule/cricket.json").fixtures || [];
const tennis = read("data/follow-schedule/tennis.json").fixtures || [];
const identity = record => record?.id || record?.eventId || record?.canonicalEventId;
const matches = (record, expected) => [record?.id, record?.eventId, record?.canonicalEventId, ...(record?.sourceEventIds || [])]
  .filter(Boolean).some(id => [expected.id, expected.canonicalId].includes(id));

for(const expected of evidence.fixtureOverrides){
  const record = published.find(item => matches(item, expected));
  assert(record, `${expected.name} is missing from the published Feed`);
  assert.equal(record.startTimeUtc, expected.startTimeUtc, `${expected.name} start time drifted`);
  assert.equal(record.venue, expected.venue, `${expected.name} venue drifted`);
  assert.equal(record.broadcaster, expected.broadcaster, `${expected.name} broadcaster drifted`);
  assert.deepEqual(record.participantIds, expected.participantIds, `${expected.name} participants drifted`);
}
for(const expected of evidence.resultOverrides){
  const record = published.find(item => matches(item, expected)) || tennis.find(item => matches(item, expected));
  assert(record, `${expected.id} is missing from published or followed fixtures`);
  assert.equal(record.status, "completed", `${expected.id} must be completed`);
  if(expected.canonicalId?.startsWith("fixture:us-open")){
    const names = expected.outcomeText.match(/(?:Alexander Zverev|Ben Shelton|Elena Rybakina|Aryna Sabalenka)/g) || [];
    assert(names.length >= 2 && names.every(name => String(record.score).includes(name.split(" ").at(-1))), `${expected.id} must retain both finalists in its official score`);
  }else{
    assert.equal(record.score, expected.score, `${expected.id} result drifted`);
  }
  if(record.startTimeUtc) assert(Number.isFinite(Date.parse(record.endTimeUtc)), `${expected.id} completion boundary is missing`);
}
for(const group of evidence.broadcastOverrides) for(const id of group.ids){
  const record = cricket.find(item => identity(item) === id);
  assert(record, `${id} is missing from cricket fixtures`);
  assert.equal(record.broadcaster, group.broadcaster, `${id} broadcaster drifted`);
}
const shell = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert.match(shell, /score:\s*\["score",\s*"scoreDisplay"/, "scoreDisplay must remain a spoiler-aware result field");
const quick = fs.readFileSync(path.join(ROOT, "scripts/quick-results.js"), "utf8");
assert.match(quick, /run\('scripts\/refresh-canonical-sports\.js'\)/, "quick updates must refresh complete official fixture inventory");
console.log("Current finals, results, broadcaster and projection coverage valid.");
