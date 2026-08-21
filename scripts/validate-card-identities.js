#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const identities = require("../config/card-identities.js");

const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const eventPayload = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const activeEventKeys = [...new Set((eventPayload.events || eventPayload).map(event => event.key).filter(Boolean))].sort();
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

assert.equal(identities.schemaVersion, "card-identities.v2");
assert.equal(activeNrlTeams.length, 17, "the current NRL competition must expose 17 active teams");
activeNrlTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing NRL team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/www\.nrl\.com\/\.theme\/.+\/badge(?:-light)?\.svg$/);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\//, `${team.id} must expose the ${asset} logo asset`));
});
assert.equal(activeAflTeams.length, 18, "the current AFL competition must expose 18 active clubs");
activeAflTeams.forEach(team => {
  const mark = identities.participantMarks[team.id];
  assert(mark, `missing AFL team identity for ${team.id}`);
  assert.match(mark.url, /^https:\/\/resources\.afl\.com\.au\/photo-resources\/.+/);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\//, `${team.id} must expose the ${asset} logo asset`));
});

assert.equal(identities.markForEvent({ key: "nrl", name: "Broncos v Storm" })?.label, "NRL", "NRL cards must use the competition logo");
assert.equal(identities.markForEvent({ key: "wimbledon", name: "Roland Garros — Men's Final" })?.label, "Roland Garros", "named marquee branding must override the generic tennis identity");
assert.equal(identities.markForEvent({ key: "wimbledon", name: "Wimbledon — Men's Final" })?.label, "Wimbledon", "Wimbledon cards must retain their own event brand");
assert.equal(identities.markForEvent({ key: "cricket", name: "Australia v Bangladesh — First Test" })?.label, "International Cricket Council", "cricket cards must use the ICC match logo");
assert.equal(identities.markForEvent({ key: "rugby", name: "Australia v Ireland" })?.label, "Rugby Australia", "rugby cards must use the Rugby Australia competition logo");
assert.match(identities.markForEvent({ key: "rugby", name: "Australia v Ireland" })?.url || "", /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, "rugby cards must use a visible Rugby Australia vector mark");
assert.equal(identities.markForEvent({ key: "f1", name: "British Grand Prix" })?.wordmark, "F1", "Formula One cards must carry a visible F1 wordmark");
assert.match(identities.markForEvent({ key: "cricket", name: "Australia v Bangladesh — First Test" })?.url || "", /^https:\/\/images\.icc-cricket\.com\//, "cricket cards must use the official ICC image source");
activeEventKeys.forEach(key => {
  const mark = identities.markForEvent({ key, name: "Coverage check" });
  assert(mark, `missing a card identity for active ${key} coverage`);
});

const exampleEvent = { key: "nrl", participantIds: ["team:nrl:322", "team:nrl:324"] };
const resolved = identities.participantMarksForEvent(exampleEvent, activeNrlTeams, "Broncos v Storm");
assert.deepEqual(resolved.map(item => item.participant.shortName), ["BB", "MS"]);
assert.deepEqual(resolved.map(item => identities.aliasRange("Broncos v Storm", item.participant)?.text), ["Broncos", "Storm"]);

const cricketResolved = identities.participantMarksForEvent({ key: "cricket" }, [], "Australia v Bangladesh — First Test");
assert.deepEqual(cricketResolved.map(item => identities.aliasRange("Australia v Bangladesh — First Test", item.participant)?.text), ["Australia", "Bangladesh"]);
assert.equal(cricketResolved[0].mark.label, "Cricket Australia");
assert.equal(cricketResolved[1].mark.label, "Bangladesh Cricket Board");
assert.match(cricketResolved[0].mark.url, /^https:\/\/resources\.cricket-australia\.pulselive\.com\//);
assert.match(cricketResolved[1].mark.url, /^https:\/\/www\.tigercricket\.com\.bd\//);

const rugbyCases = [
  ["Australia v Ireland", ["Wallabies", "Ireland"]],
  ["Australia v France", ["Wallabies", "France"]],
  ["Australia v Italy", ["Wallabies", "Italy"]],
  ["Japan v Australia", ["Japan", "Wallabies"]],
  ["South Africa v All Blacks", ["Springboks", "All Blacks"]],
  ["Argentina v Australia", ["Argentina", "Wallabies"]],
  ["England v Australia", ["England", "Wallabies"]],
  ["Scotland v Australia", ["Scotland", "Wallabies"]],
  ["Wales v Australia", ["Wales", "Wallabies"]],
  ["ACT Brumbies v NSW Waratahs", ["ACT Brumbies", "NSW Waratahs"]],
  ["Queensland Reds v Western Force", ["Queensland Reds", "Western Force"]],
  ["Fijian Drua v Moana Pasifika", ["Fijian Drua", "Moana Pasifika"]],
  ["Blues v Chiefs", ["Blues", "Chiefs"]],
  ["Crusaders v Highlanders", ["Crusaders", "Highlanders"]],
  ["Hurricanes v ACT Brumbies", ["Hurricanes", "ACT Brumbies"]],
];
rugbyCases.forEach(([title, labels]) => {
  const resolved = identities.participantMarksForEvent({ key: "rugby" }, [], title);
  const labelsInTitleOrder = resolved
    .map(item => ({ label: item.mark.label, start: identities.aliasRange(title, item.participant)?.start ?? Infinity }))
    .sort((left, right) => left.start - right.start)
    .map(item => item.label);
  assert.deepEqual(labelsInTitleOrder, labels, `rugby identities must resolve ${title}`);
});
const rugbyMarks = Object.values(identities.participantMarks).filter(mark => mark.id.startsWith("team:rugby:"));
assert.equal(rugbyMarks.length, 22, "the rugby registry must cover current internationals and all Super Rugby Pacific clubs");
rugbyMarks.forEach(mark => {
  assert.match(mark.url, /^https:\/\/(?:d26phqdbpt0w91\.cloudfront\.net|images\.allblacks\.com|super\.rugby)\//, `rugby mark must have a vetted official asset: ${mark.label}`);
  assert.equal(mark.provenance, "official-site");
  ["primary", "light", "dark", "icon", "iconLight", "iconDark"].forEach(asset => assert.match(mark.logo?.[asset] || "", /^https:\/\//, `${mark.label} must expose the ${asset} logo asset`));
});
const nrlBroncos = identities.participantMarks["team:nrl:322"];
assert.notEqual(identities.logoForTheme(nrlBroncos, { context: "primary", useDark: false }), identities.logoForTheme(nrlBroncos, { context: "primary", useDark: true }), "NRL primary logos must use the league's official light and dark assets");
assert.equal(identities.logoForTheme(identities.participantMarks["team:football:epl:1"], { context: "icon", useDark: false }), identities.participantMarks["team:football:epl:1"].logo.iconLight, "small-format contexts must select an explicit icon asset rather than resize the primary reference");

console.log(`Card identities valid: ${activeNrlTeams.length} NRL and ${activeAflTeams.length} AFL team marks, ${activeEventKeys.length} active sport/event identities, and Wimbledon/Roland Garros event branding.`);
