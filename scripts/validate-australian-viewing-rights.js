#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const followFirst = require("../config/follow-first.js");
const rightsAudit = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "coverage", "australian-viewing-rights.v1.json"), "utf8"));

function assert(condition, message){
  if (!condition) throw new Error(message);
}

const expectedSportKeys = [
  "afl", "nrl", "motorsport", "extreme", "surf", "skiing", "rugby", "tennis", "football", "cycling",
  "cricket", "nba", "golf", "american-football", "ice-hockey", "athletics", "swimming", "netball", "boxing",
];

assert(
  rightsAudit.schemaVersion === "australian-viewing-rights.v1"
    && rightsAudit.territory === "AU"
    && JSON.stringify(rightsAudit.sports.map(sport => sport.key)) === JSON.stringify(expectedSportKeys),
  "Australian viewing-rights audit must cover the nineteen exposed Follow sport domains in manifest order",
);

for (const audit of rightsAudit.sports){
  const sportKey = audit.key;
  assert(audit.label && audit.resolution, `${sportKey} audit entry needs a label and resolution basis`);
  assert(audit.providerIds.length > 0 || sportKey === "ice-hockey", `${sportKey} audit entry needs a provider or an explicit competition-level unverified state`);
  for (const providerId of audit.providerIds){
    assert(followFirst.VIEWING_PROVIDERS[providerId], `${sportKey} references unknown provider ${providerId}`);
  }
}

for (const [rightsId, rights] of Object.entries(followFirst.COMPETITION_VIEWING_RIGHTS)){
  const evidence = rightsAudit.rules[rightsId];
  assert(rights.competitionAliases.length > 0, `${rightsId} needs matching aliases`);
  assert(rights.providerIds.length > 0 || rights.coverageStatus === "unverified", `${rightsId} needs provider IDs or an explicit unverified coverage state`);
  assert(/^https:\/\//.test(evidence?.sourceUrl), `${rightsId} needs a primary-source HTTPS URL in the non-critical audit`);
  assert(!Number.isNaN(Date.parse(rights.verifiedAt)), `${rightsId} needs a verification timestamp`);
  for (const providerId of [...rights.providerIds, ...(rights.grandFinalProviderIds || [])]){
    assert(followFirst.VIEWING_PROVIDERS[providerId], `${rightsId} references unknown provider ${providerId}`);
  }
}

const scenarios = [
  ["Rugby Union", { sport:"Rugby Union", key:"rugby", name:"Argentina v Australia" }, ["stan"]],
  ["NRL", { sportDomainId:"sport:nrl", competitionId:"competition:nrl-premiership-2026", key:"nrl", name:"Broncos v Storm" }, ["kayo", "foxtel"]],
  ["NRL Grand Final", { sportDomainId:"sport:nrl", competitionId:"competition:nrl-premiership-2026", key:"nrl", name:"NRL Grand Final", stage:"Grand Final" }, ["nine"]],
  ["Rugby League World Cup", { key:"nrl", majorEventId:"rugby-league-world-cup", name:"Australia v New Zealand — Rugby League World Cup" }, ["seven"]],
  ["Formula 1", { key:"f1", name:"Australian Grand Prix" }, ["kayo", "foxtel"]],
  ["Premier League", { sportDomainId:"sport:football", competitionId:"competition:premier-league-2026-27", key:"premier-league" }, ["stan"]],
  ["Champions League", { sportDomainId:"sport:football", competitionId:"competition:uefa-champions-league-2026-27" }, ["stan"]],
  ["FIFA World Cup", { competitionId:"competition:fifa-world-cup-2026" }, ["sbs"]],
  ["Australian football", { competitionId:"competition:afc-womens-asian-cup-2026", name:"Matildas v Japan" }, ["paramount"]],
  ["Cricket Australia", { key:"cricket", competitionId:"competition:cricket-australia", name:"Australia v England" }, ["kayo", "foxtel", "seven"]],
  ["ICC cricket", { key:"cricket", competitionId:"competition:icc-world-cup", name:"Australia v India" }, ["prime-video"]],
  ["NBA", { key:"nba", competitionId:"competition:nba", name:"NBA Finals" }, ["nba-pass"]],
  ["NBL", { key:"basketball", competitionId:"competition:nbl-2026", name:"Sydney Kings v Perth Wildcats" }, ["kayo", "foxtel"]],
  ["NFL", { key:"american-football", competitionId:"competition:nfl", name:"Super Bowl" }, ["dazn"]],
  ["NHL", { key:"ice-hockey", competitionId:"competition:nhl", name:"NHL regular season" }, []],
  ["Champions Hockey League", { key:"ice-hockey", competitionId:"competition:chl", name:"CHL Game Day" }, ["iihf-tv"]],
  ["Golf majors", { key:"masters", competitionId:"competition:masters", name:"Masters final round" }, ["kayo", "foxtel"]],
  ["LIV Golf", { key:"golf", competitionId:"competition:liv-golf", name:"LIV Golf Adelaide" }, ["seven"]],
  ["Netball 2026", { key:"netball", competitionId:"competition:netball", startsAt:"2026-09-01T00:00:00.000Z" }, ["kayo", "foxtel"]],
  ["Netball 2027", { key:"netball", competitionId:"competition:netball", startsAt:"2027-09-01T00:00:00.000Z" }, ["stan", "nine"]],
  ["WRC", { key:"rally", name:"WRC Safari Rally 2027" }, ["stan"]],
  ["Dakar", { key:"rally", name:"Paris-Dakar Rally 2027" }, ["sbs"]],
  ["Goodwood", { key:"goodwood", name:"Goodwood Festival of Speed" }, ["goodwood"]],
  ["X Games", { key:"skateboard", name:"X Games Skateboarding Finals" }, ["youtube"]],
  ["Commonwealth Games", { key:"cwg", competitionId:"competition:commonwealth-games-2026" }, ["seven"]],
  ["Olympic Games", { competitionId:"competition:olympic-games-2028" }, ["stan", "nine"]],
  ["Swimming Australia", { competitionId:"competition:swimming-australia-2026" }, ["nine"]],
];

for (const [label, event, expectedProviders] of scenarios){
  const actual = followFirst.viewingOptions(event).map(option => option.providerId);
  assert(JSON.stringify(actual) === JSON.stringify(expectedProviders), `${label} should resolve ${expectedProviders.join(", ")}; received ${actual.join(", ") || "none"}`);
}

const fixtureOverride = followFirst.viewingOptions({
  key:"rugby",
  name:"Rights exception",
  viewingOptions:[{ providerId:"seven", rightsScope:"fixture", sourceUrl:"https://example.test/official-fixture-rights", verifiedAt:"2026-08-25T00:00:00.000Z" }],
}).map(option => option.providerId);
assert(JSON.stringify(fixtureOverride) === JSON.stringify(["seven"]), "a verified fixture-specific option must override a broad sport rule");

const feedDir = path.join(__dirname, "..", "data", "feed");
const events = fs.readdirSync(feedDir)
  .filter(name => /^page-\d+\.json$/.test(name))
  .sort()
  .flatMap(name => JSON.parse(fs.readFileSync(path.join(feedDir, name), "utf8")).events || []);

const permittedViewingTbcNames = new Set([
  "WSL Margaret River Pro", "UCI Downhill MTB World Cup", "Telemark World Cup Finals",
  "Kvitfjell — Men's Downhill World Cup", "Kvitfjell — Men's Super-G World Cup",
  "Shahdag — Moguls World Cup Finals", "Sun Valley — Men's Alpine Finals Downhill", "Pipe Masters Big Wave Championship",
]);
const unresolvedPublishedCards = events.filter(event => !followFirst.viewingLink(event));
assert(unresolvedPublishedCards.every(event => permittedViewingTbcNames.has(event.name)), `unreviewed cards cannot silently lose viewing metadata: ${unresolvedPublishedCards.map(event => event.name).join(", ")}`);
assert(unresolvedPublishedCards.length === permittedViewingTbcNames.size, "known event-specific rights gaps must remain explicit Viewing TBC states");
for (const event of unresolvedPublishedCards) assert(followFirst.viewingOptions(event).length === 0, `${event.name} must not inherit a foreign or ambiguous provider`);

const rugbyCards = events.filter(event => /rugby union|\brugby\b/i.test(`${event.sport || ""} ${event.key || ""}`) && !/rugby league/i.test(event.sport || ""));
assert(rugbyCards.length > 0, "published Feed must include Rugby Union coverage for the Stan rule check");
for (const event of rugbyCards){
  assert(followFirst.viewingLink(event)?.providerId === "stan", `${event.name} must render Watch on Stan Sport`);
}

const eplCards = events.filter(event => String(event.competitionId || "").startsWith("competition:premier-league"));
assert(eplCards.length > 0, "published Feed must include Premier League coverage");
for (const event of eplCards){
  assert(followFirst.viewingLink(event)?.providerId === "stan", `${event.name} must render Watch on Stan Sport`);
}

console.log(`Australian viewing-rights validation passed (${rightsAudit.sports.length} sports, ${scenarios.length} resolver scenarios, ${events.length} published cards, ${rugbyCards.length} rugby cards, ${eplCards.length} EPL cards).`);
