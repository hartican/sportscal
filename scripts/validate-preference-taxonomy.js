#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const hierarchy = require("../config/sport-hierarchy.js");
const preferenceTaxonomy = require("../config/preference-taxonomy.js");
const preferenceSystem = require("../config/preference-system.js");
const eventTaxonomy = require("../config/event-taxonomy-compat.js");

const schema = JSON.parse(fs.readFileSync("schemas/preference-taxonomy.schema.json", "utf8"));
assert.equal(preferenceTaxonomy.SCHEMA_VERSION, schema.properties.schemaVersion.const);
assert.equal(preferenceTaxonomy.TAXONOMY_VERSION, hierarchy.schemaVersion);

const translated = preferenceTaxonomy.translateSelection({
  sourceSelectorEntityIds: ["sport:nrl", "special:wimbledon", "cwg:athletics"],
  effectiveSelectors: [
    { id: "sport:nrl", canonicalSportKeys: ["nrl"] },
    { id: "special:wimbledon", canonicalSportKeys: ["wimbledon"] },
    {
      id: "special:commonwealth-games",
      canonicalSportKeys: ["cwg"],
      qualifier: { type: "commonwealth_discipline", value: "athletics" },
    },
  ],
});

assert.deepEqual(translated.sourceSelectorEntityIds, ["sport:nrl", "special:wimbledon", "cwg:athletics"]);
assert.deepEqual(
  translated.mappings.map(mapping => [mapping.selectorEntityId, mapping.taxonomyNodeId, mapping.hierarchyLevel]),
  [
    ["sport:nrl", "sport:rugby-league", "sport"],
    ["special:wimbledon", "event-series:wimbledon", "event_series"],
    ["special:commonwealth-games", "event-series:commonwealth-games", "event_series"],
  ],
  "legacy choices must translate to exact reusable hierarchy nodes"
);
assert.deepEqual(translated.mappings[2].qualifier, {
  type: "commonwealth_discipline",
  value: "athletics",
}, "a discipline-only Commonwealth follow must not expand into every Games card");
assert.deepEqual(
  preferenceTaxonomy.translateSelection({
    sourceSelectorEntityIds: translated.sourceSelectorEntityIds,
    effectiveSelectors: [
      { id: "sport:nrl", canonicalSportKeys: ["nrl"] },
      { id: "special:wimbledon", canonicalSportKeys: ["wimbledon"] },
      {
        id: "special:commonwealth-games",
        canonicalSportKeys: ["cwg"],
        qualifier: { type: "commonwealth_discipline", value: "athletics" },
      },
    ],
  }),
  translated,
  "translation must be idempotent"
);

const nrlMapping = translated.mappings[0];
assert(preferenceTaxonomy.mappingMatchesResolvedEvent(
  nrlMapping,
  eventTaxonomy.resolveEvent({ key: "nrl", name: "State of Origin Game I" })
), "a translated NRL follow must retain representative rugby league cards");
assert(!preferenceTaxonomy.mappingMatchesResolvedEvent(
  nrlMapping,
  eventTaxonomy.resolveEvent({ key: "rugby", name: "Australia v New Zealand" })
), "a translated NRL follow must not expand into rugby union");

const wimbledonMapping = translated.mappings[1];
assert(preferenceTaxonomy.mappingMatchesResolvedEvent(
  wimbledonMapping,
  eventTaxonomy.resolveEvent({ eventSeriesId: "event-series:wimbledon", name: "Women's final" })
), "canonical-only Wimbledon events must match the translated legacy choice");
assert(!preferenceTaxonomy.mappingMatchesResolvedEvent(
  wimbledonMapping,
  eventTaxonomy.resolveEvent({ eventSeriesId: "event-series:national-bank-open", name: "Toronto final" })
), "a Wimbledon follow must not silently become an all-Tennis follow");

const legacyGraph = preferenceSystem.createPreferenceGraph({
  profileId: "profile:taxonomy-migration",
  domainIds: ["sport:nrl", "special:wimbledon"],
  broadcasterIds: ["kayo", "nine"],
});
const migratedGraph = preferenceSystem.migratePreferenceGraph(legacyGraph, {
  profileId: "profile:taxonomy-migration",
  domainIds: ["sport:nrl", "special:wimbledon"],
  broadcasterIds: ["kayo", "nine"],
});
assert.equal(migratedGraph.domainPreferences.find(item => item.sportDomainId === "sport:nrl").taxonomyNodeId, "sport:rugby-league");
assert.equal(migratedGraph.domainPreferences.find(item => item.sportDomainId === "special:wimbledon").taxonomyNodeId, "event-series:wimbledon");
assert.deepEqual(
  preferenceSystem.migratePreferenceGraph(migratedGraph, {
    profileId: "profile:taxonomy-migration",
    domainIds: ["sport:nrl", "special:wimbledon"],
    broadcasterIds: ["kayo", "nine"],
  }),
  migratedGraph,
  "profile-graph taxonomy migration must be a no-op after its first application"
);

console.log("Preference taxonomy valid: legacy choices translate exactly, retain event meaning, and migrate idempotently.");
