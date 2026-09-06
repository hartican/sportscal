#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  CALENDAR_URL,
  CLASSIFICATION_URLS,
  STANDINGS_URL,
  buildWrcContext,
  classificationPageMatchesUrl,
  parseFiaClassification,
  parseFiaStandings,
  parseWrcCalendar,
  isTransientSourceStatus,
  validateWrcContext,
} = require("./lib/wrc-context");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "data/canonical/wrc-context-2026.json");

class SourceError extends Error {
  constructor(message, { transient = false } = {}){
    super(message);
    this.name = "SourceError";
    this.transient = transient;
  }
}

function optionValue(args, name){
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function readExisting(){
  if (!fs.existsSync(OUTPUT)) return null;
  return JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
}

function assertValid(context, label = "WRC context"){
  const errors = validateWrcContext(context);
  if (errors.length) throw new Error(`${label} failed validation:\n- ${errors.join("\n- ")}`);
}

function preservedContextAfterCoreFailure(error, existing){
  if (!(error instanceof SourceError) || !error.transient || !existing) throw error;
  assertValid(existing, "Preserved WRC context");
  return existing;
}

async function fetchText(url){
  let response;
  try {
    response = await fetch(url, { headers: { "user-agent": "Nothingsport-WRC-Context/1.0" }, redirect: "follow" });
  } catch (error){
    throw new SourceError(`Network error fetching ${url}: ${error.message}`, { transient: true });
  }
  if (!response.ok){
    throw new SourceError(`Source returned HTTP ${response.status} for ${url}`, { transient: isTransientSourceStatus(response.status) });
  }
  return response.text();
}

function classificationFile(directory, roundNumber){
  if (!directory) return null;
  const candidates = [
    path.join(directory, `round-${String(roundNumber).padStart(2, "0")}.html`),
    path.join(directory, `${roundNumber}.html`),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

async function loadClassification(round, { directory, checkedDate }){
  if (round.endDate >= checkedDate) return null;
  const local = classificationFile(directory, round.roundNumber);
  if (directory && !local) return null;
  try {
    const html = local ? fs.readFileSync(local, "utf8") : await fetchText(CLASSIFICATION_URLS[round.roundNumber]);
    if (!classificationPageMatchesUrl(html, CLASSIFICATION_URLS[round.roundNumber])){
      console.warn(`WRC round ${round.roundNumber} result remains pending: FIA returned a classification page for a different rally.`);
      return null;
    }
    return parseFiaClassification(html);
  } catch (error){
    if (error instanceof SourceError){
      console.warn(`WRC round ${round.roundNumber} result remains pending: ${error.message}`);
      return null;
    }
    throw error;
  }
}

async function main(){
  const args = process.argv.slice(2);
  const existing = readExisting();
  if (args.includes("--check")){
    if (!existing) throw new Error(`Missing ${path.relative(ROOT, OUTPUT)}`);
    assertValid(existing, "Checked-in WRC context");
    console.log(`WRC context valid: ${existing.events.length} rounds, three senior standings tables, and official result provenance.`);
    return;
  }

  const calendarFile = optionValue(args, "--calendar-file");
  const standingsFile = optionValue(args, "--standings-file");
  const classificationDirectory = optionValue(args, "--classification-dir");
  const checkedAt = optionValue(args, "--checked-at") || new Date().toISOString();
  try {
    const calendarHtml = calendarFile ? fs.readFileSync(calendarFile, "utf8") : await fetchText(CALENDAR_URL);
    const standingsHtml = standingsFile ? fs.readFileSync(standingsFile, "utf8") : await fetchText(STANDINGS_URL);
    const rounds = parseWrcCalendar(calendarHtml);
    const standings = parseFiaStandings(standingsHtml);
    const classifications = {};
    for (const round of rounds){
      const result = await loadClassification(round, { directory: classificationDirectory, checkedDate: checkedAt.slice(0, 10) });
      if (result) classifications[round.roundNumber] = result;
    }
    const context = buildWrcContext({ rounds, standings, classifications, checkedAt });
    assertValid(context, "Refreshed WRC context");
    fs.writeFileSync(OUTPUT, `${JSON.stringify(context, null, 2)}\n`);
    console.log(`Wrote ${path.relative(ROOT, OUTPUT)} with 14 rounds, ${standings.drivers.length} drivers, ${standings.coDrivers.length} co-drivers, and ${standings.manufacturers.length} manufacturers.`);
  } catch (error){
    try {
      preservedContextAfterCoreFailure(error, existing);
      console.warn(`${error.message}; preserved the last validated WRC context.`);
      return;
    } catch (failure){
      throw failure;
    }
  }
}

if (require.main === module){
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  SourceError,
  assertValid,
  classificationFile,
  fetchText,
  main,
  preservedContextAfterCoreFailure,
};
