#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const compat = require("../config/event-taxonomy-compat.js");

function parseOptions(argv = process.argv.slice(2)){
  const options = {
    inputPath: "data/events.json",
    outputPath: null,
    write: false,
    catalogue: false,
  };
  argv.forEach(argument => {
    if (argument === "--write") options.write = true;
    else if (argument === "--catalogue") options.catalogue = true;
    else if (argument.startsWith("--input=")) options.inputPath = argument.slice("--input=".length);
    else if (argument.startsWith("--output=")) options.outputPath = argument.slice("--output=".length);
    else throw new Error(`Unknown option: ${argument}`);
  });
  if (options.write && !options.outputPath){
    throw new Error("--write requires an explicit --output path; source feeds are never overwritten implicitly.");
  }
  if (options.write && path.resolve(options.outputPath) === path.resolve(options.inputPath)){
    throw new Error("Migration output must differ from the input path; source feeds are never overwritten in place.");
  }
  return options;
}

function readEvents(filePath){
  const payload = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  const events = Array.isArray(payload) ? payload : payload?.events;
  if (!Array.isArray(events)) throw new Error(`${filePath} does not contain an event array.`);
  return { payload, events };
}

function migrateEvents(events, { catalogue = false, participants = [] } = {}){
  const participantIndex = new Map((Array.isArray(participants) ? participants : []).map(participant => [participant.id, participant]));
  return events.map(event => catalogue ? compat.toCatalogEvent(event, { participantIndex }) : compat.enrichEvent(event));
}

function summarize(events){
  const counts = { sport: {}, discipline: {}, competition: {}, eventSeries: {}, unresolved: 0 };
  events.forEach(event => {
    const resolved = compat.resolveEvent(event);
    if (!resolved.taxonomyNodeId) counts.unresolved += 1;
    [["sport", resolved.sportId], ["discipline", resolved.disciplineId], ["competition", resolved.competitionId], ["eventSeries", resolved.eventSeriesId]]
      .forEach(([group, id]) => {
        if (id) counts[group][id] = (counts[group][id] || 0) + 1;
      });
  });
  return counts;
}

function main(){
  const options = parseOptions();
  const { payload, events } = readEvents(options.inputPath);
  const migrated = migrateEvents(events, { ...options, participants: payload?.participants });
  const summary = summarize(events);
  const report = {
    schemaVersion: "taxonomy-migration-report.v1",
    mode: options.catalogue ? "catalogue" : "compatibility",
    inputPath: options.inputPath,
    eventCount: events.length,
    resolvedEventCount: events.length - summary.unresolved,
    unresolvedEventCount: summary.unresolved,
    groups: summary,
  };

  if (!options.write){
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  }

  const outputPath = path.resolve(options.outputPath);
  const output = options.catalogue
    ? { schemaVersion: "catalogue.v1", generatedAt: new Date().toISOString(), events: migrated }
    : Array.isArray(payload) ? migrated : { ...payload, events: migrated };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...report, outputPath: path.relative(process.cwd(), outputPath) }, null, 2)}\n`);
  return report;
}

if (require.main === module) main();

module.exports = { migrateEvents, parseOptions, readEvents, summarize };
