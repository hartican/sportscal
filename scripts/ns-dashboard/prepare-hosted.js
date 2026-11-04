#!/usr/bin/env node
"use strict";

const path = require("node:path");
const local = require("./local");
const { serialize } = require("./hosted-contract");
const { fail } = require("./core");
function prepare(input, output, preparedAt = new Date().toISOString()) {
  const projection = local.readJson(path.resolve(input), 1_000_000);
  const snapshot = serialize(projection, preparedAt), directory = local.privateDirectory(output);
  // Preparation is offline. No upload adapter, credentials, bucket creation or pointer advance is invoked here.
  local.atomicText(directory, "snapshot-" + snapshot.sha256 + ".json", snapshot.bytes.toString("utf8"));
  local.atomic(directory, "publication-candidate.json", {
    schemaVersion: "ns-dashboard-publication-candidate.v1", sha256: snapshot.sha256, bytes: snapshot.bytes.length,
    snapshotObject: "snapshots/" + snapshot.sha256 + ".json", preparedAt,
    bucket: "ns-dashboard-private", project: "mkghopnkhcxtmfrcjdbc",
    prerequisites: "Verified Jack subject, current role/live-session gate, accepted quota/spend facts, reviewed schema/access tests and sole PUBLISH allocation before any private write or access enablement.",
  });
  return { directory, sha256: snapshot.sha256, bytes: snapshot.bytes.length, networkRequests: 0, uploaded: false };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2), options = {};
    while (args.length) { const flag = args.shift(), value = args.shift(); if (!["--input", "--output", "--prepared-at"].includes(flag) || !value || options[flag]) fail("invalid_cli_option"); options[flag] = value; }
    if (!options["--input"] || !options["--output"]) fail("input_and_output_required");
    console.log(JSON.stringify(prepare(options["--input"], options["--output"], options["--prepared-at"])));
  } catch (error) { console.error(JSON.stringify({ error: error.code || "dashboard_preparation_failed" })); process.exitCode = 1; }
}
module.exports = { prepare };
