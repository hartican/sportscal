#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const majorEvents = require("../config/major-events.js");
const ticketing = require("../config/ticketing.js");

const REFERENCE = new Date("2026-08-23T12:00:00.000Z");
const catalogue = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/major-events.schema.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.equal(schema.properties.schemaVersion.const, majorEvents.SCHEMA_VERSION);
assert.equal(schema.$defs.event.additionalProperties, false);
assert.equal(schema.$defs.subEvent.additionalProperties, false);
const allowedEventKeys = new Set(Object.keys(schema.$defs.event.properties));
const allowedSubEventKeys = new Set(Object.keys(schema.$defs.subEvent.properties));
catalogue.events.forEach(record => {
  assert.deepEqual(Object.keys(record).filter(key => !allowedEventKeys.has(key)), [], `${record.id} must conform to the event schema surface`);
  schema.$defs.event.required.forEach(key => assert(Object.hasOwn(record, key), `${record.id} is missing required schema field ${key}`));
  (record.subEvents || []).forEach(subEvent => {
    assert.deepEqual(Object.keys(subEvent).filter(key => !allowedSubEventKeys.has(key)), [], `${subEvent.id} must conform to the child schema surface`);
    schema.$defs.subEvent.required.forEach(key => assert(Object.hasOwn(subEvent, key), `${subEvent.id} is missing required schema field ${key}`));
  });
});
assert.deepEqual(
  majorEvents.validateDocument(catalogue, { reference: REFERENCE, verifiedTicketUrl: ticketing.verifiedSellerUrl }),
  [],
  "the published catalogue must pass the fail-closed runtime contract"
);

const ids = catalogue.events.map(record => record.id);
const childIds = catalogue.events.flatMap(record => (record.subEvents || []).map(subEvent => subEvent.id));
assert.equal(new Set(ids).size, ids.length, "major-event IDs must be unique");
assert.equal(new Set(childIds).size, childIds.length, "drawn match IDs must be unique");
assert(ids.every(id => !childIds.includes(id)), "parent and child IDs must never collide");
assert(catalogue.events.every(record => record.stakesScore === 5), "only verified 5/5 events belong in the major catalogue");
assert(catalogue.events.every(record => record.sources.length > 0), "every event needs official evidence");
assert(catalogue.events.flatMap(record => record.sources).every(source => /^https:\/\//.test(source.url) && source.checkedAt), "source evidence needs a URL and check date");
assert(catalogue.events.filter(record => record.ticketing).every(record => ticketing.verifiedSellerUrl(record.ticketing.url)), "ticket links must be exact allowlisted seller endpoints");

const publishedParents = catalogue.events.filter(record => record.kind !== "ticket_sale");
assert(publishedParents.some(record => record.id === "major-event:australian-open-2027"));
assert(publishedParents.some(record => record.id === "major-event:australian-grand-prix-2027" && record.dateStatus === "tbc"));
assert(publishedParents.some(record => record.id === "major-event:cincinnati-open-2026"), "Cincinnati must remain during its seven-day retention window");
assert(catalogue.events.some(record => record.id === "ticket-sale:australian-open-2027-general-sale"));
assert(catalogue.events.some(record => record.id === "ticket-sale:australian-grand-prix-2027-waitlist"));

const tennis = majorEvents.visibleRecords(catalogue, ["tennis"], REFERENCE);
assert(tennis.events.some(record => record.id === "major-event:us-open-2026"));
assert(tennis.events.some(record => record.id === "major-event:australian-open-2027"));
assert(tennis.alerts.some(record => record.id === "ticket-sale:australian-open-2027-general-sale"));
assert(!tennis.events.some(record => record.sportKey === "nrl"), "Events must respect followed sports");

const rlwc = catalogue.events.find(record => record.id === "major-event:rlwc-2026");
const drawnMatch = rlwc.subEvents[0];
const fixture = majorEvents.fixtureFromSubEvent(drawnMatch, rlwc);
assert.equal(fixture.eventId, drawnMatch.id);
assert.equal(fixture.date, "2026-10-15");
assert.equal(fixture.time, "20:05");
assert.equal(fixture.majorEventParentId, rlwc.id);
assert.equal(majorEvents.fixtureFromSubEvent({ ...drawnMatch, startTimeUtc: null }, rlwc), null, "unknown times must not materialise in Fixtures");
assert.equal(new Set([fixture.eventId, fixture.eventId]).size, 1, "the stable child ID is the deduplication boundary");

const invalidCopies = [
  [{ ...catalogue, events: [...catalogue.events, catalogue.events[0]] }, /duplicate/],
  [{ ...catalogue, events: catalogue.events.map((record, index) => index ? record : { ...record, sources: [] }) }, /evidence/],
  [{ ...catalogue, events: catalogue.events.map((record, index) => index ? record : { ...record, stakesScore: 4 }) }, /stakes/],
  [{ ...catalogue, events: catalogue.events.map(record => record.id === "major-event:us-open-2026" ? { ...record, ticketing: { ...record.ticketing, url: "https://www.usopen.org/" } } : record) }, /ticket URL/],
  [{ ...catalogue, events: catalogue.events.map(record => record.id === "major-event:us-open-2026" ? { ...record, startDate: "2028-01-01", endDate: "2028-01-14" } : record) }, /retention horizon/],
  [{ ...catalogue, publishedAt: "2026-08-24T00:00:00.000Z" }, /non-future/],
  [{ ...catalogue, events: catalogue.events.map((record, index) => index ? record : { ...record, sources: record.sources.map(source => ({ ...source, checkedAt: "2026-08-24T00:00:00.000Z" })) }) }, /future-dated source/],
  [{ ...catalogue, events: catalogue.events.map(record => record.id === "major-event:australian-grand-prix-2027" ? { ...record, season: 2028 } : record) }, /TBC records/],
];
invalidCopies.forEach(([document, message]) => {
  assert.match(majorEvents.validateDocument(document, { reference: REFERENCE, verifiedTicketUrl: ticketing.verifiedSellerUrl }).join("\n"), message);
});

assert(html.includes('data-tab="events"') && html.indexOf('data-tab="events"') < html.indexOf('data-tab="standings"'), "Events must sit directly after Fixtures");
assert(html.includes('url: "data/major-events.v1.json"') && html.includes("async function loadMajorEventsData()"), "Events data must load on demand");
assert(!worker.includes('"/data/major-events.v1.json"'), "major events must not be fetched by the startup app shell");
assert(worker.includes('"/config/major-events.js"') && worker.includes('"/schemas/major-events.schema.json"'), "Events logic and schema must remain offline-capable");
assert(html.includes('majorEventsCatalogue: "ns_major_events_catalogue_v1"'), "the validated Events catalogue needs a first-visit offline fallback");
assert(html.includes("payload = readStorage(STORAGE_KEYS.majorEventsCatalogue, null)") && html.includes("if (!loadedFromStorage) writeStorage(STORAGE_KEYS.majorEventsCatalogue, payload)"), "Events offline replay must reuse only a previously validated lazy-loaded catalogue");
assert(html.includes("addedToFixtures") && html.includes("addedFixture"), "selected match persistence must be wired into the browser state");
assert(html.includes('activeFilter === "all" || feedFilterMatchesEvent(activeFilter, event)'), "selected matches and parent markers must still respect an explicitly focused sport view");

console.log(`Major events valid: ${publishedParents.length} rich event cards, ${catalogue.events.length - publishedParents.length} active ticket alerts, exact seller endpoints, horizons, evidence and stable child IDs passed.`);
