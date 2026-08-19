#!/usr/bin/env node
const assert = require("node:assert/strict");
const catalogue = require("../config/team-follow-catalogue.js");

assert.deepEqual(catalogue.teamsForDomain("sport:rugby").map(section => section.label), ["International", "Domestic"]);
assert(catalogue.allTeams.some(team => team.id === "team:rugby:all-blacks"));
assert(catalogue.allTeams.some(team => team.id === "team:rugby:brumbies"));
assert(catalogue.allTeams.some(team => team.id === "team:cricket:australia"));
assert(catalogue.allTeams.some(team => team.id === "team:football:socceroos"));
assert.deepEqual(
  catalogue.participantIdsForEvent({ key: "rugby", name: "South Africa v All Blacks", participants: [{ name: "South Africa" }, { name: "All Blacks" }] }).sort(),
  ["team:rugby:all-blacks", "team:rugby:springboks"],
  "the All Blacks v Springboks fixture must resolve both follow identities"
);
assert.deepEqual(catalogue.participantIdsForEvent({ key: "tennis", name: "Australia Open" }), [], "team aliases must not leak across sports");
console.log("Team follow catalogue valid: Rugby, Cricket and Football international and domestic teams resolve reliably.");
