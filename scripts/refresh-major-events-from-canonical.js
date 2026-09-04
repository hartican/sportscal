#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CATALOGUE_PATH = path.resolve(__dirname, "../data/major-events.v1.json");
const CANONICAL_PATH = path.resolve(__dirname, "../data/canonical/afl-nrl-2026.json");
const majorEvents = require("../config/major-events.js");
const competitionClassification = require("../config/competition-classification.js");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function reconcileCatalogue(catalogue, _canonical, reference = new Date()){
  const withoutCodeCompetitions = {
    ...catalogue,
    classificationVersion:competitionClassification.schemaVersion,
    events:(catalogue.events || []).filter(record => competitionClassification.belongsInEvents(record)),
  };
  return majorEvents.reconcileLifecycle(withoutCodeCompetitions, { reference });
}

function main(){
  const checkOnly = process.argv.slice(2).includes("--check");
  const original = fs.readFileSync(CATALOGUE_PATH, "utf8");
  const reconciled = reconcileCatalogue(readJson(CATALOGUE_PATH), readJson(CANONICAL_PATH), new Date());
  const next = `${JSON.stringify(reconciled, null, 2)}\n`;
  if (checkOnly){
    if (original !== next) throw new Error("Major Events catalogue still contains a Code-classified competition or stale lifecycle state.");
    console.log("Major Events catalogue contains Events only.");
    return;
  }
  if (original !== next) fs.writeFileSync(CATALOGUE_PATH, next);
  console.log("Major Events catalogue reconciled to Event-only classification.");
}

if (require.main === module) main();

module.exports = { reconcileCatalogue };
