#!/usr/bin/env node

const assert = require("node:assert/strict");
const selector = require("../config/selector-taxonomy.js");
const catalogue = require("../config/discovery-catalogue.js");

assert.equal(selector.schemaVersion, "sports-discovery-hierarchy.v1");
assert.equal(selector.version, "selector-taxonomy.v2");
assert.equal(new Set(selector.nodes.map(node => node.id)).size, selector.nodes.length, "hierarchy node IDs must be unique");
assert(selector.nodes.some(node => node.nodeType === "parent"), "the hierarchy must expose parent nodes");
assert(selector.nodes.some(node => node.nodeType === "child"), "the hierarchy must expose child nodes");
assert(selector.nodes.some(node => node.nodeType === "internal-event-tag"), "named events must survive only as internal tags");
assert(selector.internalEventTags.every(node => node.exposed === false && node.selectable === false), "event brands must never be filter or follow choices");

const hierarchyExpectations = {
  "sport:motorsport": [["sport:f1", "F1"], ["sport:rally", "Rally"]],
  "sport:extreme": [["sport:downhill-mtb", "MTB"]],
  "sport:surf": [["sport:big-wave", "Big-wave"]],
  "sport:skiing": [["sport:alpine", "Alpine"], ["sport:freestyle", "Freestyle"]],
};
Object.entries(hierarchyExpectations).forEach(([parentId, expectedChildren]) => {
  const parent = selector.byId[parentId];
  assert(parent, `${parentId} must exist`);
  assert.deepEqual(
    parent.childIds.map(id => [id, selector.byId[id]?.label]),
    expectedChildren,
    `${parent.label} must expose the approved children in order`
  );
  parent.childIds.forEach(childId => assert.equal(selector.byId[childId].parentId, parentId));
});
assert.equal(selector.byId["sport:skiing"].label, "Snow");

const eventMigration = catalogue.migrateEventBrandFollows([
  "special:wimbledon",
  "special:le-mans-24-hours",
  "sport:goodwood",
  "special:super-bowl",
]);
assert.deepEqual(eventMigration.sportIds, [
  "sport:motorsport",
  "sport:tennis",
  "sport:american-football",
]);
assert.deepEqual(eventMigration.migratedEventFollowIds.slice().sort(), [
  "special:le-mans-24-hours",
  "special:super-bowl",
  "special:wimbledon",
]);

const selectedGamesMigration = catalogue.migrateEventBrandFollows([
  "special:commonwealth-games",
  "cwg:swimming",
  "cwg:netball",
]);
assert.deepEqual(selectedGamesMigration.sportIds, ["sport:swimming", "sport:netball"], "a Games umbrella must honour selected disciplines");
const allGamesMigration = catalogue.migrateEventBrandFollows(["special:commonwealth-games"]);
assert.deepEqual(
  allGamesMigration.sportIds,
  catalogue.commonwealthSportIds([]),
  "a Games umbrella without disciplines must include every supported Games sport"
);
assert(allGamesMigration.sportIds.length >= 10, "the full Games migration must not collapse to a generic umbrella follow");

const migratedPreferences = catalogue.migratePreferences({
  version: 12,
  theme: "night",
  selectedSelectorEntityIds: ["special:wimbledon", "special:le-mans-24-hours"],
  followedSports: ["goodwood"],
  discoverySessionInclusion: ["sport:tennis"],
  preferenceGraph: {
    schemaVersion: "preference-graph.v7",
    learning: { tuningInteractionCount: 9 },
    entityFollows: [{ participantId: "competitor:tennis:ash-barty", followLevel: "follow" }],
    domainPreferences: [
      { sportDomainId: "special:wimbledon", templateId: "template:froth", enabled: true },
      { sportDomainId: "sport:tennis", templateId: "template:casual", enabled: true },
      { sportDomainId: "special:le-mans-24-hours", templateId: "template:like", enabled: true },
    ],
  },
});
assert.equal(migratedPreferences.version, catalogue.PREFERENCE_VERSION);
assert.equal(migratedPreferences.theme, "night", "unrelated user settings must survive migration");
assert.deepEqual(migratedPreferences.selectedSelectorEntityIds, ["sport:motorsport", "sport:tennis"]);
assert.equal(migratedPreferences.discoverySessionInclusion, undefined, "session inclusion must never be persisted across visits");
assert.equal(migratedPreferences.preferenceGraph.learning.tuningInteractionCount, 9);
assert.equal(migratedPreferences.preferenceGraph.entityFollows.length, 1);
assert.equal(
  migratedPreferences.preferenceGraph.domainPreferences.find(item => item.sportDomainId === "sport:tennis").templateId,
  "template:casual",
  "an existing sport preference must win over a migrated event-brand preference"
);
assert(migratedPreferences.preferenceGraph.domainPreferences.some(item => item.sportDomainId === "sport:motorsport"));
assert.deepEqual(
  catalogue.migratePreferences(migratedPreferences),
  migratedPreferences,
  "preference migration must be idempotent"
);
const migratedParentRoundTrip = catalogue.migratePreferences({
  version: catalogue.PREFERENCE_VERSION,
  discoveryCatalogueVersion: catalogue.SCHEMA_VERSION,
  selectedSelectorEntityIds: ["sport:motorsport"],
  followedSports: ["motorsport", "f1", "rally"],
});
assert.deepEqual(
  migratedParentRoundTrip.selectedSelectorEntityIds,
  ["sport:motorsport"],
  "derived descendant sport keys must not become explicit child selections on reload"
);
const legacyParentMigration = catalogue.migratePreferences({
  version: 12,
  selectedSelectorEntityIds: ["sport:motorsport"],
  followedSports: ["motorsport", "f1", "rally"],
});
assert.deepEqual(
  legacyParentMigration.selectedSelectorEntityIds,
  ["sport:motorsport"],
  "the one-time v12 migration must not expand a selected parent through its derived legacy keys"
);

const initialSession = catalogue.createSessionInclusion(["sport:motorsport", "sport:tennis"]);
assert.deepEqual(initialSession, ["sport:motorsport", "sport:f1", "sport:rally", "sport:tennis"]);
assert.deepEqual(catalogue.selectionState("sport:motorsport", initialSession), {
  checked: true,
  mixed: false,
  selectedCount: 3,
  totalCount: 3,
});
const withoutRally = catalogue.setSessionNodeIncluded(initialSession, "sport:rally", false);
assert.deepEqual(catalogue.selectionState("sport:motorsport", withoutRally), {
  checked: false,
  mixed: true,
  selectedCount: 2,
  totalCount: 3,
});
const withoutMotorsport = catalogue.setSessionNodeIncluded(withoutRally, "sport:motorsport", false);
assert(!withoutMotorsport.some(id => catalogue.familyIds("sport:motorsport").includes(id)));
const rallyOnly = catalogue.setSessionNodeIncluded(withoutMotorsport, "sport:rally", true);
assert.deepEqual(catalogue.selectionState("sport:motorsport", rallyOnly), {
  checked: false,
  mixed: true,
  selectedCount: 1,
  totalCount: 3,
});
assert.deepEqual(catalogue.resetSessionInclusion(["sport:motorsport"]), ["sport:motorsport", "sport:f1", "sport:rally"]);

const now = new Date("2026-08-14T00:15:00Z"); // 10:15 on 14 August in Sydney.
const fixtures = [
  {
    eventId: "group:f1",
    key: "f1",
    date: "2026-08-15",
    fixtures: [
      { fixtureId: "fixture:f1:one", date: "2026-08-15" },
      { fixtureId: "fixture:f1:two", date: "2026-08-16" },
    ],
  },
  { eventId: "fixture:f1:two", key: "motorsport", date: "2026-08-16" },
  { sessionId: "session:motorsport:one", key: "motorsport", date: "2026-08-17", status: "scheduled" },
  { raceId: "race:rally:one", key: "rally", date: "2026-08-18" },
  { raceId: "race:rally:two", key: "rally", date: "2026-09-12" },
  { eventId: "event:f1:finished", key: "f1", date: "2026-08-19", status: "completed" },
  { eventId: "event:f1:old", key: "f1", date: "2026-08-13" },
  { eventId: "event:f1:day-thirty", key: "f1", date: "2026-09-13" },
  { eventId: "event:nrl:sparse", key: "nrl", date: "2026-08-20" },
  { matchId: "match:tennis:one", internalEventTagId: "special:wimbledon", startTimeUtc: "2026-08-21T23:30:00Z" },
];
const counts = catalogue.countUnderlyingEvents(fixtures, { now });
assert.equal(counts.uniqueEventCount, 7, "stable IDs, status and the Sydney date window must govern event counts");
assert.equal(counts.exactCounts["sport:f1"], 2, "grouped F1 cards must count their actual fixtures");
assert.equal(counts.exactCounts["sport:motorsport"], 1, "an independently identified Motorsport session must count once");
assert.equal(counts.exactCounts["sport:rally"], 2);
assert.equal(counts.aggregateCounts["sport:motorsport"], 5, "parent visibility must aggregate its own events and descendants without duplicates");
assert.equal(counts.exactCounts["sport:nrl"], 1);
assert.equal(counts.exactCounts["sport:tennis"], 1, "internal event tags must resolve to their underlying sport");

const visibility = catalogue.catalogueVisibility(fixtures, {
  now,
  followedSportIds: ["sport:f1", "sport:nrl", "sport:tennis"],
});
assert(visibility.mainIds.includes("sport:motorsport"), "a family with five combined events must be visible");
assert(!visibility.mainIds.includes("sport:f1"), "children must expand beneath their family instead of appearing as competing top-level filters");
assert(!visibility.moreIds.includes("sport:f1"), "a followed child already covered by a visible family must not be duplicated under More");
assert.deepEqual(visibility.moreIds, ["sport:nrl", "sport:tennis"], "followed sports below five events must remain available under More");

assert.equal(catalogue.sydneyDateKey("2026-08-13T14:30:00Z"), "2026-08-14", "UTC timestamps must use the Sydney calendar date");
assert.equal(catalogue.addCalendarDays("2026-10-04", 1), "2026-10-05", "calendar windows must remain stable over Sydney daylight-saving changes");
assert.equal(catalogue.eventNodeId({ taxonomySportId: "sport:australian-football" }), "sport:afl-premiership");
assert.equal(catalogue.eventNodeId({ competitionId: "competition:aflw-2026", taxonomySportId: "sport:australian-football" }), "sport:aflw");
const legacyAfl = catalogue.migratePreferences({ version:17, selectedSelectorEntityIds:["sport:afl"], followedSports:["afl"] });
assert.deepEqual(legacyAfl.selectedSelectorEntityIds, ["sport:afl-premiership"], "legacy AFL follows must remain men's Premiership-only until the user chooses");
assert.equal(legacyAfl.aflFamilyMigration?.status, "pending", "legacy AFL follows must receive the one-time AFL family choice");
assert.equal(catalogue.eventNodeId({ key: "cwg", discipline: "Rugby Sevens" }), "sport:rugby");
assert.deepEqual(
  catalogue.oneOffMotorsportFrothIds({ key: "lemans", name: "24 Hours of Le Mans" }),
  ["sport:f1"],
  "Le Mans must stay an internal one-off unlocked by F1 Froth"
);
assert.deepEqual(
  catalogue.oneOffMotorsportFrothIds({ key: "motorsport", name: "Bathurst 1000" }),
  ["sport:f1"],
  "future Bathurst inputs must resolve without becoming a follow choice"
);
assert.deepEqual(
  catalogue.oneOffMotorsportFrothIds({ key: "rally", name: "Paris-Dakar Rally" }),
  ["sport:rally"],
  "Dakar must be unlocked by Rally Froth"
);
assert.deepEqual(catalogue.oneOffMotorsportFrothIds({ key: "f1", name: "Australian Grand Prix" }), []);

console.log("Discovery catalogue valid: v1 hierarchy, event-follow migration, Sydney-window counts, family visibility and session-only mixed states passed.");
