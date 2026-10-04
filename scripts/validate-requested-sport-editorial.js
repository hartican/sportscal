#!/usr/bin/env node
"use strict";
// Exercise the real rolling builder with the producer shapes that broke the
// full refresh: optional broadcast IDs, later calendars and repeated clubs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { build } = require("./update-rolling-editorial-projections");
const { validateKnowledge } = require("./lib/editorial-narrative");
const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const incoming = read("feeds/incoming/events.json");
const requested = read("data/canonical/fiba-women-sailgp-motogp-2026.json");
const baseline = read("data/editorial-knowledge.v1.json");
const reference = new Date("2026-10-04T00:00:00Z");
const picks = [
  "event:motogp:2026:japan:qualifying",
  "event:motogp:2027:thailand:qualifying",
  "event:sailgp:2026:abu-dhabi:day-1",
  "event:sailgp:2027:hong-kong:day-1",
  "event:nrlw:2026:preliminary-final-titans-broncos",
  "event:nrlw:2026:round-8-titans-broncos",
];
// The later SailGP IDs use the producer's calendar namespace; resolve by
// season/location rather than substituting a fabricated calendar record.
const selected = picks.map(id => requested.events.find(event => event.id === id)
  || (id.includes("sailgp:2026") ? requested.events.find(event => event.sportKey === "sailgp" && event.season === "2026" && /abu.dhabi/i.test(event.id) && /day.1$/.test(event.id)) : null)
  || (id.includes("sailgp:2027") ? requested.events.find(event => event.sportKey === "sailgp" && event.season === "2027" && /hong.kong/i.test(event.id) && /day.1$/.test(event.id)) : null));
assert(selected.every(Boolean), "the captured producer acceptance fixtures must still exist");
const cards = selected.map(fixture => incoming.events.find(event => event.canonicalEventId === fixture.id));
assert(cards.every(Boolean), "the actual consumer cards must exist");
// Replay all source shapes inside a fixed consumer window. Their actual calendar
// dates, seasons and observation clocks remain unchanged; no provider is called.
const replayCards = cards.map(card => ({ ...card, startTimeUtc:"2026-10-03T00:00:00Z" }));
function run({ sources = requested.sources, retained = baseline.sources, generatedAt = requested.generatedAt } = {}){
  const knowledge = structuredClone(baseline);
  for (const [field, value] of Object.entries(knowledge)) if (Array.isArray(value)) knowledge[field] = [];
  knowledge.sources = structuredClone(retained);
  build({ knowledge, feed:{events:replayCards}, context:{ladderSnapshots:[]}, f1:{}, wrc:{}, requestedSports:{ ...requested, sources, events:selected, generatedAt }, reference });
  assert.deepEqual(validateKnowledge(knowledge), [], "actual requested-sport producer inputs must produce valid editorial");
  return knowledge;
}
const knowledge = run();
const projection = fixture => knowledge.eventProjections.find(item => item.targetIds.includes(cards[selected.indexOf(fixture)].id));
const facts = fixture => projection(fixture).factIds.map(id => knowledge.narrativeFacts.find(item => item.id === id));
for (const fixture of selected.slice(0,4)) {
  const calendarOnly = fixture.sourceSessionIds || (fixture.calendarProvenance && fixture.sourceId !== "sailgp-calendar");
  if (calendarOnly) {
    assert(!projection(fixture), "a timetable/calendar and a pending result do not establish substantive researched editorial");
    assert.deepEqual(cards[selected.indexOf(fixture)], incoming.events.find(event => event.canonicalEventId === fixture.id), "withholding invented editorial does not remove or rewrite useful original card facts");
    continue;
  }
  assert(projection(fixture), "reviewed substantive same-season context retains its projection");
  const schedule = facts(fixture).find(fact => fact.dimension === "schedule");
  assert.equal(schedule.observedAt, fixture.sourceCheckedAt || fixture.calendarProvenance?.checkedAt, "assembly cannot redate an actual calendar observation");
  const viewing = facts(fixture).find(fact => fact.id.endsWith(":viewing"));
  assert(viewing, "reviewed same-season viewing remains usable without a new assembly observation");
  assert.equal(viewing.observedAt, baseline.sources.find(source => source.id === viewing.sourceIds[0]).checkedAt, "an unchanged viewing guide retains its original dated observation");
  if (fixture.result) assert.equal(facts(fixture).find(fact => fact.id.endsWith(":result")).observedAt, fixture.result.checkedAt, "a later timetable check must not redate an earlier result observation");
}

const repeated = selected.slice(4).map(projection);
assert.notEqual(repeated[0].hook, repeated[1].hook, "different rounds between the same clubs need distinct spoiler-safe copy");
assert(repeated[0].hook.includes("Preliminary Final") && repeated[1].hook.includes("Round 8"), "actual round context disambiguates repeated matchups");
const laterAssembly = run({generatedAt:"2026-10-04T00:00:00Z"});
assert.deepEqual(laterAssembly.narrativeFacts, knowledge.narrativeFacts, "unrelated bundle refreshes do not redate or rewrite unchanged facts");
const unknownStaticDates = run({retained:[]});
assert(!unknownStaticDates.narrativeFacts.some(fact => /:(field|viewing)$/.test(fact.id)), "undated static evidence is withheld instead of borrowing an assembly date");
const invalidSources = structuredClone(requested.sources);
invalidSources["motogp-broadcast-au"].url = "https://user:password@www.motogp.com.au/";
const unsafeViewing = run({sources:invalidSources});
assert(!unsafeViewing.narrativeFacts.some(fact => fact.id.endsWith(":viewing") && /motogp/.test(fact.id)), "unsafe source destinations are withheld despite a retained observation");
const absentViewing = run({sources:Object.fromEntries(Object.entries(requested.sources).filter(([id]) => !/broadcast-au/.test(id)))});
assert(!absentViewing.narrativeFacts.some(fact => fact.id.endsWith(":viewing") && /motogp|sailgp/.test(fact.id)), "missing optional sources degrade cleanly without undefined references");
// A real pending MotoGP result has its own older observation. Replaying a
// retained substantive season context alongside it must keep that result date.
const resultFixture = structuredClone(selected[0]);
resultFixture.sourceSessionIds = undefined;
resultFixture.context = "The reviewed season context remains unchanged.";
const resultKnowledge = structuredClone(baseline);
for (const [field, value] of Object.entries(resultKnowledge)) if (Array.isArray(value)) resultKnowledge[field] = [];
resultKnowledge.sources = structuredClone(baseline.sources);
build({knowledge:resultKnowledge, feed:{events:[replayCards[0]]}, context:{ladderSnapshots:[]}, f1:{}, wrc:{}, requestedSports:{...requested, events:[resultFixture]}, reference});
assert.deepEqual(validateKnowledge(resultKnowledge), []);
assert.equal(resultKnowledge.narrativeFacts.find(fact => fact.id.endsWith(":result")).observedAt, resultFixture.result.checkedAt, "a later calendar observation cannot redate a supplied pending-result check");
console.log("Requested-sport editorial: six real producer shapes, calendar-only withholding, source-specific clocks, later-season isolation, missing/unsafe optional evidence and repeated rounds passed.");
