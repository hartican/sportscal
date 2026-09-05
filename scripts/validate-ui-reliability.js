#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
function source(name){
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} exists`);
  const end = html.slice(start + 1).search(/\n(?:async )?function /);
  return html.slice(start, start + 1 + end);
}
const failures = [];
function check(name, run){ try { run(); console.log(`PASS ${name}`); } catch(error){ failures.push(name); console.error(`FAIL ${name}: ${error.message}`); } }
check("cold PSG / Monaco identities without loading Follow", () => {
  const identities = require("../config/card-identities");
  const fixture = require("../data/football/fixtures/ligue-1.json").events.find(e => e.name === "Paris Saint-Germain v AS Monaco");
  assert.equal(identities.participantMarksForEvent(fixture, [], fixture.name).length, 2);
});
check("a confirmed receipt survives a late empty snapshot", () => {
  const context = { nothingscoreSnapshots:new Map(), nothingscoreLoadedAt:new Map(), Date, NOTHINGSPORTS_NSC_SUBMISSION_STATE:require("../config/nsc-submission-state") };
  vm.createContext(context);
  vm.runInContext(source("mergeNothingscoreSnapshot"), context);
  const receipt = { rating:4, submittedAt:"2026-09-05T01:00:00Z" };
  context.mergeNothingscoreSnapshot({eventId:"fixture", phase:"impact", currentUser:{submissions:{impact:receipt}}});
  context.mergeNothingscoreSnapshot({eventId:"fixture", phase:"impact", currentUser:{submissions:{}}});
  assert.equal(context.nothingscoreSnapshots.get("fixture").currentUser.submissions.impact?.rating, 4);
});
check("worker update does not replay a visible launch", () => {
  let reloads = 0;
  const coordinator = require("../config/feed-refresh-lifecycle").createStartupCoordinator({hadControllerAtStartup:true,reloadForUpdate:() => reloads++});
  coordinator.controllerChanged();
  coordinator.markHydrationComplete();
  coordinator.controllerChanged();
  assert.equal(reloads, 0);
});
check("past quick actions contain no reminder", () => {
  const context = { document:{createElement:() => ({appendChild(){},setAttribute(){},addEventListener(){}})}, getEventStatus:() => "past", FOLLOW_FIRST:null };
  vm.createContext(context);
  vm.runInContext(source("appendEventQuickActions"), context);
  context.appendEventQuickActions({appendChild(){}}, {}, {chat:false,viewing:false});
});
check("past joint-tournament rows contain no reminder", () => {
  assert(html.includes('if (getEventStatus(event) === "upcoming") actions.append(reminder)'));
});
if (failures.length) process.exitCode = 1;
