#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const countryFlags = require("../config/country-flags.js");

const html = fs.readFileSync("index.html", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const tournament = JSON.parse(fs.readFileSync("data/canonical/joint-tennis-tournament-2026.json", "utf8"));
const tennisContext = JSON.parse(fs.readFileSync("data/canonical/tennis-context-2026.json", "utf8"));

assert.equal(countryFlags.SCHEMA_VERSION, "country-flags.v1");
assert.equal(countryFlags.ASSET_SOURCE.library, "flag-icons");
assert.equal(countryFlags.ASSET_SOURCE.version, "7.3.2");
assert.equal(countryFlags.ASSET_SOURCE.license, "MIT");
assert(fs.existsSync(countryFlags.ASSET_SOURCE.noticePath), "the bundled flag library must retain its MIT notice");
assert(html.includes('<script src="config/country-flags.js"></script>'), "country flags must load before the app renders athlete names");
assert(html.includes("buildAthleteName(player") && html.includes("COUNTRY_FLAGS.flagMarkup(player.birthCountryCode"), "tournament matches and the central player directory must both render country flags");
assert(html.includes('buildAthleteName(participant, { className: "standings-athlete" })'), "competitor ranking tables must render country flags");
assert(serviceWorker.includes('"/config/country-flags.js"'), "the flag mapping must be available offline");
assert(serviceWorker.includes(`"/${countryFlags.ASSET_SOURCE.noticePath}"`), "the flag licence notice must be available offline");
assert(!serviceWorker.includes('"/assets/flags/4x3/au.svg"'), "the app shell must not eagerly download every flag before it is needed");

countryFlags.SUPPORTED_ALPHA2.forEach(code => {
  const path = countryFlags.assetPath(code);
  assert(path, `${code} must resolve to a flag asset`);
  assert(fs.existsSync(path), `${path} must exist`);
  assert.match(fs.readFileSync(path, "utf8"), /<svg\b/i, `${path} must be an SVG`);
  assert(!serviceWorker.includes(`"/${path}"`), `${path} must be fetched and runtime-cached only when it is displayed`);
});

const tournamentPlayers = [...(tournament.schedule?.matches || []), ...(tournament.matchHistory || [])]
  .flatMap(match => match.players || []);
tournamentPlayers.forEach(player => {
  assert(countryFlags.alpha2(player.nationalityCode), `${player.name} must map ${player.nationalityCode} to an ISO alpha-2 flag`);
  assert(fs.existsSync(countryFlags.assetPath(player.nationalityCode)), `${player.name} must have a bundled flag asset`);
});

tennisContext.participants
  .filter(participant => ["competitor", "pair"].includes(participant.type))
  .forEach(participant => {
    assert(countryFlags.alpha2(participant.countryCode), `${participant.displayName} must retain a supported country flag`);
    assert(fs.existsSync(countryFlags.assetPath(participant.countryCode)), `${participant.displayName} must have a bundled flag asset`);
  });

assert.match(countryFlags.flagMarkup("AUS"), /assets\/flags\/4x3\/au\.svg/);
assert.match(countryFlags.flagMarkup("GB"), /United Kingdom flag/);
assert.equal(countryFlags.flagMarkup("unknown"), "");

console.log(`Country flags valid: ${countryFlags.SUPPORTED_ALPHA2.length} local SVGs cover every Cincinnati player and canonical Tennis competitor.`);
