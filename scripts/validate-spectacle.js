#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const nsc = require("../config/nothingscore");
const epic = require("../config/epic-classics");
const vectors = require("../config/vector-assets");

function browserModule(file){
  const context = { globalThis:{} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"), context);
  return context.globalThis.NOTHINGSPORTS_NOTHINGSCORE;
}

const labels = ["Routine","Promising","Compelling","Must-watch","EPIC spectacle"];
const pulseLabels = ["Flat","A spark","Buzzing","Electric","EPIC electricity"];
const impactLabels = ["A ripple","A tremor","A shock","An aftershock","EPIC magnitude"];
const fallback = browserModule("config/enrichment-engine.js");
const browser = browserModule("config/nothingscore.js");

assert.deepEqual(epic.phaseCopy("heat"), {
  name:"Anticipation", detail:"Spectacle", submissionLabel:"Pre-fixture",
  tip:nsc.HEAT_PROMPT, glyph:"ui:spotlight", labels,
});
assert.deepEqual(epic.phaseCopy("pulse"), {
  name:"Ongoing", detail:"Electricity", tip:"During play: rate how electric it feels right now.",
  glyph:"ui:zap", labels:pulseLabels,
});
assert.deepEqual(epic.phaseCopy("impact"), {
  name:"Impact", detail:"Magnitude", tip:"Afterwards: rate its lasting sporting impact.",
  glyph:"ui:shockwave", labels:impactLabels,
});
assert.equal(vectors.custom["ui:spotlight"].provenance, "first-party");
assert.match(vectors.glyphMarkup("ui:spotlight", {label:"Expected Spectacle"}), /<svg\b[^>]*aria-label="Expected Spectacle"/);
assert.doesNotMatch(vectors.glyphMarkup("ui:spotlight"), /<(?:image|img)\b|https?:/,
  "the pre-match spotlight must render without an external artwork request");
// Exercise the active resolver: a catalogue override previously replaced this
// original megaphone while the legacy fallback and phase key stayed correct.
const originalMegaphone = '<path d="M3 5h8v7H3zM11 6l10-3v12l-10-4M7 12v6m-4 3 4-3 4 3" stroke-width="2"/>';
assert(vectors.glyphMarkup("ui:spotlight").includes(originalMegaphone),
  "the active spectacle glyph must retain the original megaphone and stroke");
const megaphoneImage = vectors.glyphMarkup("ui:spotlight", {preferImage:true});
assert(decodeURIComponent(megaphoneImage.match(/src="data:image\/svg\+xml,([^"]+)"/)?.[1] || "").includes(originalMegaphone),
  "the scrolling-card image path must resolve the same original megaphone");

for (const api of [nsc, browser, fallback]){
  assert.equal(api.HEAT_PROMPT, "How good a spectacle do you expect?");
  assert.deepEqual(Array.from(api.HEAT_LABELS), labels);
  assert(Object.isFrozen(api.HEAT_LABELS), "labels cannot drift through a caller mutation");
  for (let score=1; score<=5; score++){
    assert.equal(api.labelFor("heat", score), labels[score-1]);
    assert.equal(api.labelFor("pulse", score), pulseLabels[score-1]);
    assert.equal(api.labelFor("impact", score), impactLabels[score-1]);
  }
  assert.equal(api.labelFor("heat", 3.49), "Compelling");
  assert.equal(api.labelFor("heat", 3.5), "Must-watch");
  assert.equal(api.labelFor("heat", 5.5), "EPIC spectacle");
  assert.equal(api.labelFor("heat", 0), "Routine");
  assert(api.HEAT_TAGS.includes("Big stakes"), "stakes remains one optional viewing reason");
  assert.deepEqual(Array.from(api.HEAT_TAGS), ["Box office","Big stakes","Rivalry","Star power","National interest","Great storyline"]);
  assert.deepEqual({...api.blendHeatWithStakes(1,5,25)}, {score:4,heatWeight:.75,stakesWeight:.25});
}

// Existing stored phases, numerical votes and rewards retain their meaning.
assert.deepEqual(nsc.PHASES, ["heat","pulse","impact"]);
assert.deepEqual(nsc.PERSONA_WEIGHTS, {general:1,pundit:1,rising:1,influencer:1,curator:8,editorial:8,admin:8});
assert.deepEqual(nsc.POINT_RULES, {heat:1,first_like:1,watching:1,pulse:1,pulse_15m:1,impact:3,valid_tags:1});
assert.equal(nsc.SCHEMA_VERSION, "nothingscore.v1");
const historicalVotes = [
  {userId:"one",persona:"general",rating:1,tags:["Hard to care"]},
  {userId:"two",persona:"general",rating:5,tags:["Star power"]},
  {userId:"curator",persona:"curator",rating:4,tags:["Rivalry"]},
];
const originalVotes = JSON.stringify(historicalVotes);
assert.equal(nsc.aggregateRatings(historicalVotes).score, 3.8);
assert.equal(nsc.aggregateRatings(historicalVotes).ratingCount, 3);
assert.equal(nsc.aggregateRatings([{userId:"fan",rating:5,tags:["Star power"]}]).score, 5,
  "a top expectation does not require a Big stakes tag");
assert.equal(nsc.aggregateRatings([{userId:"fan",rating:1,tags:["Big stakes"]}]).score, 1,
  "a stakes reason must not silently raise a stored vote");
assert.equal(JSON.stringify(historicalVotes), originalVotes, "presentation changes cannot rewrite historical votes");
assert.deepEqual(nsc.validTags("heat", 5, ["Rivalry","Star power","Big stakes"]), ["Rivalry","Star power","Big stakes"]);
assert.deepEqual(nsc.validTags("heat", 2, ["Big stakes","Hard to care"]), ["Hard to care"]);
assert.equal(nsc.pointValue("heat"), 1);
assert.equal(nsc.pointValue("impact"), 3);
assert.equal(nsc.capPointAwards(9,24,3), 1);

const fixture = {startTimeUtc:"2026-10-19T02:00:00Z",endTimeUtc:"2026-10-19T04:00:00Z"};
assert.equal(nsc.phaseFor(fixture,"2026-10-19T01:00:00Z"), "heat");
assert.equal(nsc.phaseFor({...fixture,session:{status:"active",effectiveStartAt:fixture.startTimeUtc}},"2026-10-19T03:00:00Z"), "pulse");
assert.equal(nsc.phaseFor(fixture,"2026-10-19T04:00:00Z"), "impact");

console.log("Spectacle contract passed: server/browser/fallback wording, phase-owned artwork, phase boundaries, historical votes, weights, reasons and rewards. Native rendering and release integration remain separate gates.");
