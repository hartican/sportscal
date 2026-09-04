#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const majorEvents = require(path.join(ROOT, "config/major-events.js"));
const followFirst = require(path.join(ROOT, "config/follow-first.js"));
const usOpenRefresh = require(path.join(ROOT, "scripts/refresh-us-open-events.js"));
const { fixtureIdentityKey } = require(path.join(ROOT, "scripts/lib/major-event-fixture-identity.js"));

const usOpen = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major-events.v1.json"), "utf8"))
  .events.find(record => record.id === "major-event:us-open-2026");
const usOpenSnapshot = JSON.parse(fs.readFileSync(path.join(ROOT, "feeds/provider-exports/tennis/us-open-2026-official-schedule.json"), "utf8"));
const reference = new Date(usOpenSnapshot.capturedAt);
const neutralPlayerFixture = usOpenRefresh.fixtureFromMatch({
  order:1,
  match_id:"neutral-country-regression",
  eventCode:"MS",
  roundName:"Round 1",
  courtName:"Arthur Ashe Stadium",
  team1:[{ firstNameA:"Daniil", lastNameA:"Medvedev", idA:"atpmm58", nationA:null }],
  team2:[{ firstNameA:"Novak", lastNameA:"Djokovic", idA:"atpd643", nationA:"SRB" }],
}, { courtName:"Arthur Ashe Stadium", courtId:"AA", session:1, startEpoch:1788130800 }, { tournDay:8, message:"Day 1: Sunday, August 30" }, "https://www.usopen.org/en_US/scores/feeds/2026/schedule/schedule8.json", "2026-08-31T00:00:00.000Z");
assert.equal(neutralPlayerFixture.matchupSides[0].players[0].nationalityCode, "RU", "neutral-status players must fall back to the verified ATP/WTA country context rather than blocking the official refresh");
assert.equal(usOpenRefresh.isPublishedMatch({ match_id:"0", eventCode:null, comment:"Intentionally Blank", team1:[], team2:[] }), false, "official schedule spacer rows must not block a released-day refresh");
assert(usOpen, "US Open phase record is required");
assert.equal(usOpen.eventFamilyId, "us-open");
assert.equal(usOpen.editionId, "us-open-2026");
assert.equal(usOpen.phaseId, "main-draw");
assert.equal(usOpen.phaseIdentity, "main-draw");

const timeline = majorEvents.phaseTimeline(usOpen, reference, { level:"L1", timeZone:"Australia/Sydney" });
assert.doesNotThrow(() => majorEvents.phaseTimeline({ subEvents:[{ id:"fixture:tbc", date:null, startTimeUtc:null, sessionStartTimeUtc:null }] }, reference), "unpublished Event dates must render an honest TBC state rather than crash Events");
const officialFixtures = usOpen.subEvents.filter(event => event.id.startsWith("fixture:us-open-2026:official:"));
assert(usOpenSnapshot.scheduleFeeds.length > 1, "the US Open snapshot must retain every released competition day rather than only the current schedule");
assert.deepEqual(
  usOpen.subEvents.map(fixtureIdentityKey).filter(Boolean).sort(),
  usOpenRefresh.fixturesFromSnapshot(usOpenSnapshot).map(fixtureIdentityKey).filter(Boolean).sort(),
  "the current US Open edition must retain every unique released official fixture"
);
const currentOfficialSourceUrls = new Set(usOpenRefresh.currentScheduleDays(usOpenSnapshot).map(day => day.feedUrl));
const currentOfficialFixtures = officialFixtures.filter(event => currentOfficialSourceUrls.has(event.sourceUrl));
assert(currentOfficialFixtures.length, "the current released US Open day must retain detailed fixtures");
assert.equal(timeline.upcoming.length, 3, "L1 must preview the next three released US Open fixtures below Now");
assert(timeline.upcoming.every(item => item.subEvent.id.startsWith("fixture:us-open-2026:official:")), "L1 upcoming rows must come from the current official order of play");
assert(officialFixtures.some(event => event.timePrecision === "follows" && !event.startTimeUtc), "later court matches must retain follows timing rather than an invented start");
assert(officialFixtures.some(event => event.timePrecision === "session-start" && event.startTimeUtc), "first court matches must retain the published session start");
const compactUpcoming = majorEvents.compactPhaseTimelineItems(
  majorEvents.phaseTimeline(usOpen, reference, { level:"L0", timeZone:"Australia/Sydney" })
);
assert.equal(compactUpcoming[0]?.marker, "now", "a compact Event with a future fixture must place Now before that fixture");
assert.equal(compactUpcoming[1]?.subEvent?.id, timeline.upcoming[0]?.subEvent?.id, "a compact Event must show the nearest upcoming fixture rather than source-file order or old completed history");
assert(!compactUpcoming.some(item => item.subEvent?.id === "fixture:us-open-2026:serena-alcaraz-v-routliffe-glasspool"), "the completed Williams / Alcaraz fixture must not be moved below Now while a future fixture exists");
const compactCompleted = majorEvents.compactPhaseTimelineItems(majorEvents.phaseTimeline({
  subEvents:usOpen.subEvents.filter(event => event.status === "completed"),
}, reference, { level:"L0", timeZone:"Australia/Sydney", includeOlder:true }));
assert.equal(compactCompleted[0]?.subEvent?.status, "completed", "a compact completed-only Event must retain its latest result");
assert.equal(compactCompleted[1]?.marker, "now", "a completed fixture must remain above Now");
const andreevaMixed = officialFixtures.find(event => /Mirra Andreeva/i.test(event.name));
assert(andreevaMixed, "released US Open history must retain Mirra Andreeva's mixed doubles match");
const andreevaFeedFixture = majorEvents.fixtureFromSubEvent(andreevaMixed, usOpen);
assert(andreevaFeedFixture, "Mirra Andreeva's passed mixed doubles match must be pinnable to Feed");
if (andreevaMixed.timePrecision === "follows"){
  assert.equal(andreevaFeedFixture.startTimeUtc, null, "a pinned Follows match must not invent an exact UTC start");
  assert.match(andreevaFeedFixture.displayTimeLabel, /^Follows · /, "a pinned Follows match must retain its honest display label");
}
const completeTimeline = majorEvents.phaseTimeline(usOpen, reference, { level:"L2", timeZone:"Australia/Sydney", includeOlder:true });
assert([...completeTimeline.recent, ...completeTimeline.upcoming].some(item => currentOfficialSourceUrls.has(item.subEvent.sourceUrl)), "L2 must expose the current released US Open order of play even when the live source has already completed that court day");
const releasedLaterDayExists = officialFixtures.some(event => (
  !currentOfficialSourceUrls.has(event.sourceUrl)
  && (Date.parse(event.startTimeUtc || "") > reference.getTime() || String(event.date || "") > reference.toISOString().slice(0, 10))
));
if (releasedLaterDayExists){
  assert(completeTimeline.upcoming.some(item => !currentOfficialSourceUrls.has(item.subEvent.sourceUrl)), "L2 must retain already released next-day fixtures instead of only the current New York day");
}
assert(completeTimeline.recent.some(item => item.subEvent.id === "fixture:us-open-2026:federer-v-roddick" && item.effectiveStatus === "completed"), "completed exhibition history must remain above Now after the main draw begins");

const familyOnly = majorEvents.visibleRecords(
  { events:[{ ...usOpen, sportKeys:["tennis"] }] },
  { followedSports:[], followedEventFamilyIds:["us-open"] },
  reference
);
assert.equal(familyOnly.events.length, 1, "an Event family follow must surface its edition independently of a sport follow");

const collectionIndex = {
  "collection:tennis:all-time-greats": { memberIds:["athlete:tennis:roger-federer"] },
  "collection:tennis:mens-top-10": { memberIds:["competitor:tennis:atp:carlos-alcaraz"] },
};
let preferences = followFirst.migratePreferences({ preferenceGraph:{ profileId:"profile:test", entityFollows:[] } });
assert.deepEqual(preferences.followFirst.collectionFollows, []);
assert.deepEqual(preferences.followFirst.codeInteractions, []);
preferences = followFirst.setCollectionFollow(preferences, "collection:tennis:all-time-greats", true);
assert.equal(
  followFirst.effectiveParticipantFollow("athlete:tennis:roger-federer", preferences, collectionIndex).source,
  "collection"
);
preferences = followFirst.setCollectionFollow(preferences, "collection:tennis:mens-top-10", true);
assert.equal(
  followFirst.effectiveParticipantFollow("athlete:tennis:carlos-alcaraz", preferences, collectionIndex).source,
  "collection",
  "an ATP/WTA collection identity must follow the matching official athlete fixture identity"
);
assert.equal(
  followFirst.reasonForEvent({ participantIds:["athlete:tennis:roman-safiullin", "athlete:tennis:carlos-alcaraz"] }, preferences, { collectionsById:collectionIndex })?.type,
  "collection",
  "Events must recognise inherited top-10 follows across the official athlete identity alias"
);
preferences.preferenceGraph.entityFollows.push({ profileId:"profile:test", participantId:"athlete:tennis:roger-federer", followLevel:"mute" });
assert.equal(
  followFirst.effectiveParticipantFollow("athlete:tennis:roger-federer", preferences, collectionIndex).followed,
  false,
  "an explicit mute must override inherited collection membership"
);

let affinity = followFirst.migratePreferences({});
affinity = followFirst.recordCodeInteraction(affinity, { codeId:"sport:tennis", type:"open", occurredAt:"2026-08-26T00:00:00.000Z" });
affinity = followFirst.recordCodeInteraction(affinity, { codeId:"sport:tennis", type:"watch", occurredAt:"2026-08-26T00:01:00.000Z" });
affinity = followFirst.recordCodeInteraction(affinity, { codeId:"sport:nrl", type:"expand", occurredAt:"2026-08-26T00:02:00.000Z" });
const orderedCodes = followFirst.sortCodesByAffinity([
  { id:"sport:nrl", label:"NRL", fixtureCount:200 },
  { id:"sport:tennis", label:"Tennis", fixtureCount:20 },
  { id:"sport:football", label:"Football", fixtureCount:400 },
], affinity, reference);
assert.deepEqual(orderedCodes.map(code => code.id), ["sport:tennis", "sport:nrl", "sport:football"]);
const seededSportOrder = followFirst.sortCodesByAffinity([
  { id:"sport:ice-hockey", label:"Ice Hockey", fixtureCount:1493 },
  { id:"sport:afl", label:"AFL", fixtureCount:247 },
], followFirst.migratePreferences({ followedSports:["afl"], selectedSelectorEntityIds:["sport:afl"] }), reference);
assert.deepEqual(seededSportOrder.map(code => code.id), ["sport:afl", "sport:ice-hockey"], "a current related-sport follow contributes its three-point affinity even without a historic gesture");

const watchPool = JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical/tennis-watch-pool-2026.json"), "utf8"));
assert.equal(watchPool.players.length, 50, "Tennis must publish exactly fifty additional watch-pool players");
assert.equal(new Set(watchPool.players.map(player => player.id)).size, 50, "watch-pool identities must be unique");
for (const name of ["Roger Federer", "Serena Williams", "Nick Kyrgios", "Alex de Minaur", "Bernard Tomic", "Cruz Hewitt"]){
  assert(watchPool.players.some(player => player.displayName === name), `${name} must be discoverable`);
}
assert(watchPool.players.every(player => player.countryCode && player.genderCategory && player.sourceUrl && player.sourceCheckedAt));
assert.equal(watchPool.collections.length, 6);
assert(!Number.isNaN(Date.parse(watchPool.sourceReviewAfter)), "watch-pool evidence requires a dated review boundary");
assert(watchPool.collections.every(collection => collection.parentId === "sport:tennis" && collection.memberIds.length));

const tennisDirectory = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/tennis.v1.json"), "utf8"));
assert.equal(tennisDirectory.collections.length, 6, "the lazy Tennis directory must publish six hierarchical collections");
assert.equal(tennisDirectory.collections.find(item => item.id === "collection:tennis:mens-top-10").memberIds.length, 10);
assert.equal(tennisDirectory.collections.find(item => item.id === "collection:tennis:womens-top-10").memberIds.length, 10);

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
assert(html.includes('config/follow-first.js?v=218') && worker.includes('"/config/follow-first.js?v=218"'), "the hierarchical follow runtime must use the current app-shell URL so installed updates cannot retain stale collection identity rules");
assert(/ensureFollowCollectionDirectories\(userPreferences\)\.then\(\(\) => \{[\s\S]{0,500}renderAll\(\{ preserveViewport:true \}\)/.test(html), "saved collection follows must automatically re-render Feed and Events when their lazy directory becomes available");
assert(html.includes("activeMajorEventNowId") && html.includes("events-now-marker"), "Events must keep one active card-local Now marker");
assert(html.includes("Follow Event") && html.includes("Unfollow Event"), "Event cards must expose family follow controls");
assert(html.includes("renderTennisFollowCollections"), "Sports & Australia must expose expandable Tennis collections");
assert(html.includes("sortCodesByAffinity"), "Standings & Fixtures must use the saved per-user affinity order");

console.log("Event Now, hierarchical Tennis follows and personalised Standings contracts passed.");
