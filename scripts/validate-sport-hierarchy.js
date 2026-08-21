#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const hierarchy = require("../config/sport-hierarchy.js");
const compat = require("../config/event-taxonomy-compat.js");
const registry = require("../config/sport-domain-registry.js");
const { migrateEvents, parseOptions } = require("./migrate-event-taxonomy.js");

assert.equal(hierarchy.schemaVersion, "sport-hierarchy.v1");
assert.deepEqual(hierarchy.levels, ["sport", "discipline", "competition", "event_series"]);
assert.equal(new Set(hierarchy.nodes.map(node => node.id)).size, hierarchy.nodes.length, "taxonomy node IDs must be unique");

const nodesById = new Map(hierarchy.nodes.map(node => [node.id, node]));
const levelOrder = new Map(hierarchy.levels.map((level, index) => [level, index]));
hierarchy.nodes.forEach(node => {
  assert(levelOrder.has(node.level), `${node.id} must use a canonical hierarchy level`);
  if (node.level === "sport") assert.equal(node.parentId, undefined, `${node.id} must be a root sport`);
  else {
    assert(node.parentId, `${node.id} must have a parent`);
    const parent = nodesById.get(node.parentId);
    assert(parent, `${node.id} must reference a known parent`);
    assert(levelOrder.get(parent.level) < levelOrder.get(node.level), `${node.id} must descend from a higher hierarchy level`);
  }
});

Object.entries({ ...hierarchy.legacyIds, ...hierarchy.legacySportKeys }).forEach(([legacyId, canonicalId]) => {
  assert(nodesById.has(canonicalId), `${legacyId} must map to a canonical taxonomy node`);
});
registry.domains.forEach(domain => {
  assert(hierarchy.canonicalNodeId(domain.key), `${domain.key} must have a legacy sport-key mapping`);
  assert(hierarchy.canonicalNodeId(domain.domainId), `${domain.domainId} must have a canonical or legacy ID mapping`);
});

const goodwoodLineage = hierarchy.lineageFor("goodwood");
assert.deepEqual(
  goodwoodLineage.map(node => node.id),
  ["sport:motorsport", "discipline:motorsport:culture", "competition:motorsport-culture", "event-series:goodwood-festival-of-speed"],
  "Goodwood must be an event series beneath Motorsport, not a root category"
);
assert.equal(compat.resolveEvent({ key: "nrl", name: "State of Origin Game I" }).competitionId, "competition:state-of-origin");
assert.equal(compat.resolveEvent({ key: "nrl", name: "RLWC — Australia v Fiji" }).competitionId, "competition:rugby-league-world-cup");
assert.equal(
  compat.resolveEvent({ eventSeriesId: "event-series:wimbledon", key: "nrl", name: "State of Origin Game I" }).eventSeriesId,
  "event-series:wimbledon",
  "explicit canonical classifications must take precedence over legacy title heuristics"
);
assert.deepEqual(
  compat.toCatalogEvent({ id: "ticket-alert", key: "f1", name: "Ticket alert", broadcaster: "Official ticket alert" }).broadcasts,
  [],
  "ticketing and unknown labels must not be fabricated into typed broadcasts"
);

const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const migrated = migrateEvents(feed.events);
assert.equal(migrated.length, feed.events.length, "the compatibility backfill must preserve every feed row");
assert(migrated.every(event => event.taxonomyNodeId), "every published card must resolve to the hierarchy");
assert(migrated.every(event => event.taxonomySportId && event.disciplineId && event.taxonomyCompetitionId), "every published card must group by sport, discipline and competition");
assert(migrated.every(event => event.auViewing), "every published card must derive AU viewing metadata");
assert(migrated.every((event, index) => event.id === feed.events[index].id && event.key === feed.events[index].key), "compatibility mapping must retain card identity and legacy sport keys");
assert(migrated.every((event, index) => event.sportId === (feed.events[index].sportId || feed.events[index].key)), "compatibility mapping must retain the legacy sportId used by ranking and filters");

const catalogue = migrateEvents(feed.events, { catalogue: true });
assert.equal(catalogue.length, feed.events.length);
assert(catalogue.every(event => event.schemaVersion === "catalog-event.v1"));
assert(catalogue.every(event => !Object.prototype.hasOwnProperty.call(event.auViewing, "startTimeAest")), "Sydney local time must be derived at read time, not persisted as AEST");
assert(catalogue.every(event => /T/.test(event.updatedAt)), "catalogue timestamps must normalize to ISO date-time values");
assert(catalogue.every((event, index) => event.startTimeUtc === (feed.events[index].startTimeUtc || null)), "catalogue migration must preserve authoritative UTC and never infer it from ambiguous legacy local fields");
assert(catalogue.every(event => new Set(event.broadcasts.map(option => `${option.platform}:${option.type}:${option.region}`)).size === event.broadcasts.length), "catalogue broadcasts must be deduplicated");
assert(catalogue.every(event => !event.storyline || typeof event.storyline === "object"), "storyline must remain nested optional enrichment");

assert.deepEqual(parseOptions([]), {
  inputPath: "data/events.json",
  outputPath: null,
  write: false,
  catalogue: false,
});
assert.throws(() => parseOptions(["--write"]), /explicit --output/, "migration must not overwrite source data implicitly");
assert.throws(
  () => parseOptions(["--write", "--input=data/events.json", "--output=data/events.json"]),
  /must differ from the input path/,
  "migration must never overwrite a source feed in place"
);

const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const canonicalCatalogue = migrateEvents(canonical.events, { catalogue: true, participants: canonical.participants });
assert.equal(canonicalCatalogue.length, canonical.events.length, "every canonical AFL/NRL fixture must backfill");
assert(canonicalCatalogue.every(event => event.participants.length === 2), "canonical participant references must resolve without losing teams");

const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const shellVersion = html.match(/<meta name="app-shell-version" content="(\d+)">/)?.[1];
const workerVersion = serviceWorker.match(/const CACHE_NAME = "nothingsport-shell-v(\d+)"/)?.[1];
assert.equal(shellVersion, workerVersion, "HTML and service-worker shell versions must stay synchronized");
[
  "/config/sport-hierarchy.js",
  "/config/event-taxonomy-compat.js",
  "/config/preference-taxonomy.js",
  "/config/tennis-coverage.js",
  "/schemas/sport-hierarchy.schema.json",
  "/schemas/catalog-event.schema.json",
  "/schemas/preference-taxonomy.schema.json",
  "/schemas/tennis-ranking-export.schema.json",
  "/schemas/tennis-tournament-export.schema.json",
  "/schemas/tennis-catalogue.schema.json",
].forEach(asset => assert(serviceWorker.includes(`"${asset}"`), `${asset} must ship in the offline shell`));
assert(!serviceWorker.includes('"/data/canonical/tennis-catalogue-2026.json"'), "large optional catalogue data must not delay the offline shell installation");

console.log(`Sport hierarchy valid: ${hierarchy.nodes.length} nodes; ${feed.events.length} published cards resolve without identity changes.`);
