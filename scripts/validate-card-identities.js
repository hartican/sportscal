#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const identities = require("../config/card-identities.js");

const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const activeNrlTeams = canonical.participants.filter(participant => (
  participant.type === "team"
  && participant.sportDomainId === "sport:nrl"
  && participant.metadata?.active !== false
));
const activeAflTeams = canonical.participants.filter(participant => (
  participant.type === "team"
  && participant.sportDomainId === "sport:afl"
  && participant.teamCode !== "TBD"
));

assert.equal(identities.schemaVersion, "card-identities.v1");
assert.equal(activeNrlTeams.length, 17, "the current NRL competition must expose 17 active teams");
activeNrlTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing NRL team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/www\.nrl\.com\/\.theme\/.+\/badge(?:-light)?\.svg$/);
  assert.equal(mark.provenance, "official-site");
});
assert.equal(activeAflTeams.length, 18, "the current AFL competition must expose 18 active clubs");
activeAflTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing AFL team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/resources\.afl\.com\.au\/photo-resources\/.+/);
  assert.equal(mark.provenance, "official-site");
});

assert.equal(identities.markForEvent({ key: "nrl", name: "Broncos v Storm" })?.label, "NRL", "NRL cards must use the competition logo");
assert.equal(identities.markForEvent({ key: "wimbledon", name: "Roland Garros — Men's Final" })?.label, "Roland Garros", "named marquee branding must override the generic tennis identity");
assert.equal(identities.markForEvent({ key: "wimbledon", name: "Wimbledon — Men's Final" })?.label, "Wimbledon", "Wimbledon cards must retain their own event brand");

const exampleEvent = { key: "nrl", participantIds: ["team:nrl:322", "team:nrl:324"] };
const resolved = identities.participantMarksForEvent(exampleEvent, activeNrlTeams, "Broncos v Storm");
assert.deepEqual(resolved.map(item => item.participant.shortName), ["BB", "MS"]);
assert.deepEqual(resolved.map(item => identities.aliasRange("Broncos v Storm", item.participant)?.text), ["Broncos", "Storm"]);

console.log(`Card identities valid: ${activeNrlTeams.length} NRL and ${activeAflTeams.length} AFL team marks, competition marks, and Wimbledon/Roland Garros event branding.`);
