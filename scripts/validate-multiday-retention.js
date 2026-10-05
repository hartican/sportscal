"use strict";

const assert = require("node:assert/strict");
const lifecycle = require("../config/card-lifecycle");
const pipeline = require("../lib/server-feed-pipeline");
const catalogue = require("../lib/calendar-catalogue").catalogue();
const cricket = require("../data/code-inspector/cricket.json").fixtures;
const test = cricket.find(f => f.id === "fixture:cricket:espn:1528712");
assert(test);
const endDay = lifecycle.sydneyEndOfDay(test.endDate);
for (const input of [test, pipeline.normalizeEvent(test, new Date("2026-12-20T00:00Z"))]) {
  assert.equal(+lifecycle.archivesAtForEvent(input), +endDay + lifecycle.ARCHIVE_MS,
    "The actual five-day Test retains its full supplied calendar window through raw and server-normalized paths");
  assert.equal(+lifecycle.expiresAtForEvent(input), +endDay + lifecycle.RETENTION_MS);
}

const original = structuredClone(catalogue);
const exactWindows = catalogue.filter(f => f.startTimeUtc && f.endDate > (f.date || f.startDate));
assert(exactWindows.length > 0);
for (const event of exactWindows) {
  for (const copyEvents of [true, false]) {
    const normalized = pipeline.normalizeEvent(event, new Date("2026-10-05T04:00Z"), {copyEvents});
    const archive = lifecycle.archivesAtForEvent(normalized);
    assert(archive && +archive >= +lifecycle.sydneyEndOfDay(event.endDate) + lifecycle.ARCHIVE_MS,
      "A retained exact multi-day record cannot shorten its calendar-based retention: " + event.id);
    assert.equal(normalized.status, event.status);
    assert.equal(normalized.sourceCheckedAt, event.sourceCheckedAt);
  }
}
assert.deepEqual(catalogue, original, "No shared sporting record or observation is mutated");

const fourth = cricket.find(f => f.id === "evt_91");
const userState = {
  preferences: {version:25,onboardingComplete:true,showSpoilers:false,
    preferenceGraph:{entityFollows:[{participantId:fourth.participantIds[0],followLevel:"follow"}]}},
  event_user_state:{[pipeline.eventActionKey(fourth)]:{eventId:fourth.id,reminderChoice:"off",reminderSource:"manual"}},
};
const saved = structuredClone(userState);
const now = new Date("2027-01-14T01:00Z");
const feed = pipeline.buildServerFeed({events:[fourth],userId:"local-multiday-regression",userState,now,tennisProjection:{parents:[],contests:[]}});
assert.equal(feed.events.length,1);
assert.equal(feed.derivedCardCache.derivedCards.length,1,"The actual shared caller must retain the card within its supplied end-window week");
assert.equal(feed.retention.active,1);
assert.equal(feed.derivedCardCache.derivedCards[0].expiresAt,lifecycle.expiresAtForEvent(fourth).toISOString());
assert.deepEqual(userState,saved,"User choices and Remind OFF remain authoritative");

const source = {...test,status:"completed",actualEndTimeUtc:"2026-12-19T05:00:00Z"};
assert.equal(lifecycle.archivesAtForEvent(source).toISOString(),"2026-12-26T05:00:00.000Z",
  "An explicit valid actual finish on a completed record takes precedence over its planned calendar window");
const ongoing = {...source,status:"scheduled"};
assert.equal(+lifecycle.archivesAtForEvent(ongoing),+endDay+lifecycle.ARCHIVE_MS,"An unresolved phase cannot borrow completion");
for (const actualEndTimeUtc of ["2026-12-16T05:00:00Z","2026-12-19","invalid"]) {
  assert.equal(+lifecycle.archivesAtForEvent({...source,actualEndTimeUtc}),+endDay+lifecycle.ARCHIVE_MS,"Invalid, date-only or before-start observations cannot become an actual finish");
}
assert.equal(lifecycle.lifecycleState(test,{now:new Date("invalid"),saved:true}).state,"active","An invalid reference clock keeps existing fail-safe behaviour");
assert.deepEqual(lifecycle.lifecycleState({}, {now:new Date("2027-01-01T00:00Z")}),{state:"active",saved:false,archivesAt:null,expiresAt:null},"Missing dates remain active and unknown");
for (const extra of [{endDate:"2026-12-16"},{endDate:"2026-02-30"},{endDate:"garbage"},{date:"garbage"},{endDate:test.date}]) {
  const invalid={...test,...extra};
  assert.equal(+lifecycle.archivesAtForEvent(invalid),Date.parse(test.startTimeUtc)+3*3600000+lifecycle.ARCHIVE_MS,
    "Invalid, single-day or backwards calendar ranges preserve the existing exact fallback");
}
for (const key of ["watchLater","saved","archived","addedToFixtures"]) {
  assert.equal(lifecycle.lifecycleState(test,{action:{[key]:true},now:new Date("2027-03-01T00:00Z")}).state,"saved");
}
const at = lifecycle.archivesAtForEvent(test);
assert.equal(lifecycle.lifecycleState(test,{now:at}).state,"active");
assert.equal(lifecycle.lifecycleState(test,{now:new Date(+at+1)}).state,"archived");
const expiry = lifecycle.expiresAtForEvent(test);
assert.equal(lifecycle.lifecycleState(test,{now:expiry}).state,"archived");
assert.equal(lifecycle.lifecycleState(test,{now:new Date(+expiry+1)}).state,"expired");
assert.equal(lifecycle.archivesAtForEvent({...test,date:"2026-04-03",endDate:"2026-04-06",startTimeUtc:"2026-04-03T00:00Z"}).toISOString(),"2026-04-13T13:59:59.999Z","Sydney calendar window respects the winter side of a DST boundary");
assert.equal(lifecycle.archivesAtForEvent({...test,date:"2026-10-02",endDate:"2026-10-05",startTimeUtc:"2026-10-02T00:00Z"}).toISOString(),"2026-10-12T12:59:59.999Z","Sydney calendar window respects the summer side of a DST boundary");
console.log("Multi-day retention: actual raw/normalized windows, shared Feed and cache, actual completion precedence, invalid dates, DST and saved exemptions pass ("+exactWindows.length+" retained exact windows).");
