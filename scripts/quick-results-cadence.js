#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const SYDNEY_RUN_HOURS = new Set([9, 15, 21]);

function sydneyClock(reference = new Date()){
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone:"Australia/Sydney",
    hour12:false,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
  }).formatToParts(reference).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = Number(part.value);
    return result;
  }, {});
  return parts;
}

function shouldRun(reference = new Date()){
  const clock = sydneyClock(reference);
  return SYDNEY_RUN_HOURS.has(clock.hour) && clock.minute < 45;
}

function main(argv = process.argv.slice(2), reference = new Date()){
  const outputIndex = argv.indexOf("--github-output");
  const outputPath = outputIndex >= 0 ? argv[outputIndex + 1] : "";
  const clock = sydneyClock(reference);
  const run = shouldRun(reference);
  const report = `Sydney ${String(clock.hour).padStart(2,"0")}:${String(clock.minute).padStart(2,"0")} · run=${run}`;
  if (outputPath){
    fs.appendFileSync(outputPath, `run=${run}\n`);
    console.log(report);
  } else {
    console.log(JSON.stringify({run,clock}));
  }
  return run;
}

if (require.main === module) main();

module.exports = { main, shouldRun, sydneyClock, SYDNEY_RUN_HOURS };
