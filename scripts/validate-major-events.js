#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const majorEvents = require("../config/major-events.js");
const competitionClassification = require("../config/competition-classification.js");
const countryFlags = require("../config/country-flags.js");
const { AUTO_ID_PREFIX, fixturesFromSnapshot } = require("./refresh-us-open-events.js");
const { fixtureIdentityKey } = require("./lib/major-event-fixture-identity.js");
const ticketing = require("../config/ticketing.js");
const aflNrlCanonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const finalsCodePhases = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-finals-2026.json", "utf8"));
const championsLeague = JSON.parse(fs.readFileSync("data/canonical/uefa-champions-league-2026-27.json", "utf8"));
const usOpenScheduleSnapshot = JSON.parse(fs.readFileSync("feeds/provider-exports/tennis/us-open-2026-official-schedule.json", "utf8"));

const REFERENCE = new Date(usOpenScheduleSnapshot.capturedAt);
const FUTURE_REFERENCE = new Date(REFERENCE.getTime() + 24 * 60 * 60 * 1000).toISOString();
const catalogue = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("schemas/major-events.schema.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.equal(schema.properties.schemaVersion.const, majorEvents.SCHEMA_VERSION);
assert.equal(schema.$defs.event.additionalProperties, false);
assert.equal(schema.$defs.subEvent.additionalProperties, false);
assert(schema.$defs.subEvent.properties.editorialNarrative, "Events children must publish the baked editorial projection contract");
assert(schema.$defs.subEvent.properties.storyline, "Events children must publish the browser-ready storyline projection contract");
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
const retiredCincinnati = publishedParents.find(record => record.id === "major-event:cincinnati-open-2026");
assert(retiredCincinnati?.lifecycleStatus === "retired" && retiredCincinnati.retiredDeepLinkBehaviour === "safe-tombstone", "Cincinnati must remain only as a safe historical deep-link tombstone");
assert(!majorEvents.visibleRecords(catalogue, ["tennis"], REFERENCE).events.some(record => record.id === retiredCincinnati.id), "retired Cincinnati must not surface in Events");
const forbiddenEventIds = [
  "major-event:afl-finals-series-2026",
  "major-event:nrl-finals-series-2026",
  "major-event:uefa-champions-league-2026-27:qualification",
  "major-event:uefa-champions-league-2026-27:league-phase",
  "major-event:uefa-champions-league-2026-27:knockout",
];
assert(forbiddenEventIds.every(id => !catalogue.events.some(record => record.id === id)), "single-code competitions and domestic finals must never be stored under Events");
assert(catalogue.events.every(record => competitionClassification.belongsInEvents(record)), "the Events catalogue must contain Event-classified records only");
const canonicalAflFinals = aflNrlCanonical.events.filter(event => event.sportDomainId === "sport:afl" && /final/i.test(event.roundLabel || ""));
assert.equal(canonicalAflFinals.length, 11, "AFL must retain both Wildcard Finals, four first-week finals, two Semis, two Prelims and the Grand Final under its Code");
const aflPhase = finalsCodePhases.phases.find(phase => phase.codeId === "sport:afl");
const nrlPhase = finalsCodePhases.phases.find(phase => phase.codeId === "sport:nrl");
assert.deepEqual(aflPhase.fixtures.map(event => event.id).sort(), canonicalAflFinals.map(event => event.id).sort(), "AFL Code phase data must preserve every canonical finals fixture");
assert.equal(nrlPhase.fixtures.length, 9, "NRL Code phase data must retain four first-week finals, two Semis, two Prelims and the Grand Final");
assert(nrlPhase.fixtures.every(event => event.startTimeUtc === null), "unpublished NRL slots must not receive invented start times");
assert.equal(nrlPhase.bracketProgression?.schemaVersion, "bracket-progression.v1", "NRL Code progression must remain structured instead of parsed from slot labels");
const nrlFinalIds = new Set(nrlPhase.fixtures.map(event => event.id));
assert.deepEqual(new Set(nrlPhase.bracketProgression.matches.map(match => match.matchId)), nrlFinalIds, "every NRL finals slot must publish winner and loser progression");
nrlPhase.bracketProgression.matches.forEach(match => [match.winner, match.loser].forEach(destination => {
  if (destination.status === "advances") assert(nrlFinalIds.has(destination.nextMatchId), `${match.matchId} must advance to a canonical finals slot`);
  else assert.equal(destination.nextMatchId, undefined, `${match.matchId} terminal outcomes must not have a destination slot`);
}));
assert(nrlPhase.sources.some(source => source.url === nrlPhase.bracketProgression.sourceUrl), "NRL bracket progression must retain official source evidence");
assert(feed.events.some(event => event.key === "afl" && /final/i.test(event.roundLabel || event.name || "")), "AFL finals must remain ordinary Feed fixtures");
assert(feed.events.some(event => event.key === "nrl" && /final/i.test(event.name || "")), "NRL finals must remain ordinary Feed cards");

const rugbyFinals = catalogue.events.find(record => record.id === "major-event:nations-championship-finals-2026");
assert(rugbyFinals && rugbyFinals.subEvents.length === 6, "Rugby must retain all six Nations Championship Finals Weekend placements");
assert.equal(rugbyFinals.competitionScope, "international");
assert(rugbyFinals.representativeCountryCodes.includes("AU"), "Australian national representation must be explicit metadata, not a title heuristic");
assert(rugbyFinals.subEvents.every(event => event.dateLabel && event.startTimeUtc === null), "Rugby placement sessions require a published label but no invented drawn fixture");

assert.equal(championsLeague.id, "competition:uefa-champions-league");
assert.deepEqual(championsLeague.phases.map(record => record.phaseIdentity), ["qualification", "league", "knockout"], "Champions League Code coverage must retain chronological phases");
assert.equal(championsLeague.phases.flatMap(record => record.fixtures).length, 13, "Champions League must retain seven qualification deciders plus its league and knockout pathway under the Code");
assert.equal(championsLeague.phases.at(-1).endDate, "2027-06-05");
assert(championsLeague.phases[0].fixtures.every(event => event.startTimeUtc && event.participantSlots?.length === 2), "published Champions League qualification deciders must expose concrete times and clubs");
assert(championsLeague.phases.slice(1).flatMap(record => record.fixtures).every(event => event.dateLabel && event.startTimeUtc === null), "future undrawn Champions League stages require source-published phase dates without fictional fixtures");

const markerIds = majorEvents.markerEvents(["afl", "nrl", "rugby", "football"], REFERENCE).map(event => event.id);
assert(markerIds.includes(rugbyFinals.id), "genuine special Events may retain compact Fixtures markers");
assert(forbiddenEventIds.every(id => !markerIds.includes(id)), "Code competitions and domestic finals must not create Event markers");
assert.deepEqual(majorEvents.markerReplacementFixtureIds(), [], "ordinary AFL/NRL finals cards must never be replaced by Event parents");
assert(catalogue.events.some(record => record.id === "ticket-sale:australian-open-2027-general-sale"));
assert(catalogue.events.some(record => record.id === "ticket-sale:australian-grand-prix-2027-waitlist"));

const tennis = majorEvents.visibleRecords(catalogue, ["tennis"], REFERENCE);
assert(tennis.events.some(record => record.id === "major-event:us-open-2026"));
assert(tennis.events.some(record => record.id === "major-event:australian-open-2027"));
assert(tennis.alerts.some(record => record.id === "ticket-sale:australian-open-2027-general-sale"));
assert(!tennis.events.some(record => record.sportKey === "nrl"), "Events must respect followed sports");

const followedSportVisibilityCases = [
  ["tennis", "major-event:us-open-2026"],
  ["rugby", "major-event:nations-championship-finals-2026"],
  ["motorsport", "major-event:australian-grand-prix-2027"],
];
followedSportVisibilityCases.forEach(([sportKey, eventId]) => {
  const equivalentPreferenceShapes = [
    { label:"canonical followedSports", value:{ followedSports:[sportKey] } },
    { label:"domain followedSports", value:{ followedSports:[`sport:${sportKey}`] } },
    { label:"selector-only follow", value:{ selectedSelectorEntityIds:[`sport:${sportKey}`] } },
    { label:"preference-graph follow", value:{ preferenceGraph:{ domainPreferences:[{ sportDomainId:`sport:${sportKey}`, enabled:true }] } } },
  ];
  equivalentPreferenceShapes.forEach(({ label, value }) => {
    assert(
      majorEvents.visibleRecords(catalogue, value, REFERENCE).events.some(record => record.id === eventId),
      `${eventId} must surface from its ${sportKey} ${label}`,
    );
  });
});
assert.equal(
  majorEvents.visibleRecords(catalogue, { preferenceGraph:{ domainPreferences:[{ sportDomainId:"sport:tennis", enabled:false }] } }, REFERENCE).events.length,
  0,
  "a disabled domain preference must not surface its major events",
);
assert(
  followedSportVisibilityCases.every(([, eventId]) => majorEvents.visibleRecords(catalogue, { selectedSelectorEntityIds:["category:sports"] }, REFERENCE).events.some(record => record.id === eventId)),
  "the explicit all-sports selector must surface every in-window major-event family",
);
assert.match(
  html,
  /function majorEventVisibilityPreferences\(\)[^]*selectedSelectorEntityIds:userPreferences\.selectedSelectorEntityIds[^]*preferenceGraph:userPreferences\.preferenceGraph/,
  "Events must pass canonical, selector and preference-graph sport follows through the shared visibility contract",
);
const everyInWindowEdition = catalogue.events.filter(record => (
  record.kind !== "ticket_sale"
  && record.lifecycleStatus !== "retired"
  && record.stakesScore === 5
  && majorEvents.inWindow(record, REFERENCE)
));
everyInWindowEdition.forEach(record => {
  const sportKey = record.sportKey;
  [
    { followedSports:[sportKey] },
    { followedSports:[`sport:${sportKey}`] },
    { selectedSelectorEntityIds:[`sport:${sportKey}`] },
    { preferenceGraph:{ domainPreferences:[{ sportDomainId:`sport:${sportKey}`, enabled:true }] } },
  ].forEach(preferences => assert(
    majorEvents.visibleRecords(catalogue, preferences, REFERENCE).events.some(candidate => candidate.id === record.id),
    `${record.id} must surface from every equivalent ${sportKey} follow representation`,
  ));
});
assert(everyInWindowEdition.length >= 5, "the sport-follow visibility audit must cover every current major-event edition");

const usOpen = catalogue.events.find(record => record.id === "major-event:us-open-2026");
const expectedOfficialUsOpenFixtures = fixturesFromSnapshot(usOpenScheduleSnapshot);
const officialUsOpenFixtures = usOpen.subEvents.filter(event => event.id.startsWith(AUTO_ID_PREFIX));
const expectedOfficialUsOpenIdentities = expectedOfficialUsOpenFixtures.map(fixtureIdentityKey).filter(Boolean).sort();
const actualUsOpenIdentities = usOpen.subEvents.map(fixtureIdentityKey).filter(Boolean).sort();
assert.deepEqual(actualUsOpenIdentities, expectedOfficialUsOpenIdentities, "US Open Events must include every unique fixture from every released official competition day");
const expectedOfficialUsOpenIds = new Set(expectedOfficialUsOpenFixtures.map(event => event.id));
assert(officialUsOpenFixtures.every(event => expectedOfficialUsOpenIds.has(event.id)), "non-overlapping US Open Events IDs must remain stable against official match IDs");
assert.equal(usOpen.competitionId, "competition:tennis:us-open:2026", "US Open parent and child fixtures must inherit the tournament graphic identity");
assert.equal(usOpen.phaseIdentity, "main-draw", "the current US Open card must identify the released main draw once official matchups are published");
assert(officialUsOpenFixtures.every(event => event.name.includes(" v ") && !/\b(?:TBC|Qualifier)\b/i.test(event.name)), "released US Open fixtures must use full published player-v-player names");
assert(officialUsOpenFixtures.every(event => event.stage && event.roundLabel && event.court), "released US Open fixtures must retain event, round and court naming");
assert(officialUsOpenFixtures.every(event => event.matchupSides.length === 2), "released US Open fixtures must retain exactly two matchup sides");
assert(officialUsOpenFixtures.flatMap(event => event.matchupSides).flatMap(side => side.players).every(player => player.nationalityCode), "every released US Open player must retain the official country identity when available");
assert(officialUsOpenFixtures.filter(event => event.sequenceInSession === 1).every(event => event.startTimeUtc && event.timePrecision === "session-start"), "first matches on each US Open court must use the published session start");
assert(officialUsOpenFixtures.filter(event => event.sequenceInSession > 1).every(event => !event.startTimeUtc && event.timePrecision === "follows"), "later US Open court matches must say follows rather than inventing a start time");
officialUsOpenFixtures.forEach(event => {
  const fixture = majorEvents.fixtureFromSubEvent(event, usOpen);
  assert(fixture, `${event.id} must be pinnable from Events even when completed or published as Follows`);
  assert.equal(fixture.name, majorEvents.matchupSideLabels(event).join(" v "), `${event.id} must materialise as a fully named Feed fixture`);
  assert.equal(fixture.competitionId, usOpen.competitionId, `${event.id} must inherit the US Open logo identity`);
  if (event.timePrecision === "follows") assert.equal(fixture.startTimeUtc, null, `${event.id} must not invent an exact start when pinned`);
});

const eventFixtureAudit = catalogue.events.filter(record => record.kind !== "ticket_sale").flatMap(parent => (parent.subEvents || []).map(subEvent => ({ parent, subEvent })));
eventFixtureAudit.forEach(({ subEvent }) => {
  assert(Number.isInteger(subEvent.stakesScore) && subEvent.stakesScore >= 1 && subEvent.stakesScore <= 5, `${subEvent.id} must declare 1-5 stakes for the shared Event fixture filter`);
  const baselineVisible = majorEvents.subEventMeetsDisplayPolicy(subEvent);
  assert.equal(baselineVisible, subEvent.stakesScore >= 4 || majorEvents.subEventIsMarquee(subEvent), `${subEvent.id} must be hidden when unfollowed and below 4/5 unless explicitly marquee`);
  const identity = majorEvents.subEventParticipantIdentity(subEvent);
  if (identity.ids[0] || identity.names[0]) assert(majorEvents.subEventMeetsDisplayPolicy(subEvent, { followedParticipantIds:identity.ids.slice(0, 1), followedParticipantNames:identity.names.slice(0, 1) }), `${subEvent.id} must surface for a followed participant at any stakes level`);
});
assert(eventFixtureAudit.some(({ subEvent }) => subEvent.stakesScore < 4), "the Event audit must exercise hidden early-round or low-stakes fixtures");
const surfacedEventFixtureAudit = eventFixtureAudit.filter(({ subEvent }) => majorEvents.subEventMeetsDisplayPolicy(subEvent));
surfacedEventFixtureAudit.forEach(({ parent, subEvent }) => {
  const resolvedEditorial = majorEvents.editorialRecordForSubEvent(subEvent, parent, feed.events)?.editorialNarrative;
  assert(
    resolvedEditorial,
    `${subEvent.id} must resolve researched editorial before it can surface under Events`
  );
  if (resolvedEditorial.generationMode === "verified-parent-child-projection"){
    assert.notEqual(resolvedEditorial.hook, parent.editorialNarrative?.hook, `${subEvent.id} must receive an event-specific development instead of repeating its parent hook`);
  }
  assert(resolvedEditorial.dimensions?.some(dimension => ["path", "form", "matchup", "history", "consequence"].includes(dimension)), `${subEvent.id} editorial must retain a substantive dimension`);
});
assert(surfacedEventFixtureAudit.length >= 40, "the Events editorial gate must cover the comprehensive surfaced fixture catalogue without counting Code fixtures");
const unsupportedFutureChild = majorEvents.editorialRecordForSubEvent(
  { id:"major-match:future-family:unknown", name:"Team A v Team B", stakesScore:5, status:"scheduled" },
  { id:"major-event:future-family", name:"Future family", sportKey:"football", sportLabel:"Football", editorialNarrative:rugbyFinals.editorialNarrative },
  []
);
assert.equal(unsupportedFutureChild.editorialNarrative, undefined, "an unrecognised future Event family must fail the editorial gate instead of receiving generic filler");

catalogue.events.forEach(parent => (parent.subEvents || []).forEach(subEvent => {
  const sideLabels = majorEvents.matchupSideLabels(subEvent);
  if (!sideLabels.length) return;
  assert.equal(sideLabels.length, 2, `${subEvent.id} must expose exactly two matchup sides when contestants are published`);
  const fixture = majorEvents.fixtureFromSubEvent(subEvent, parent);
  if (!fixture) return;
  if (subEvent.matchupSides?.length === 2){
    assert.equal(fixture.name, sideLabels.join(" v "), `${subEvent.id} must preserve its published matchup when pinned to Feed`);
  } else {
    assert.match(fixture.name, new RegExp(sideLabels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*v.*"), "i"), `${subEvent.id} must retain both published sides in its Feed title`);
  }
}));

const rlwc = catalogue.events.find(record => record.id === "major-event:rlwc-2026");
const drawnMatch = rlwc.subEvents[0];
const fixture = majorEvents.fixtureFromSubEvent(drawnMatch, rlwc);
const curatedOpener = feed.events.find(event => event.id === "rlwc-australia-new-zealand-2026");
assert.equal(typeof majorEvents.editorialRecordForSubEvent, "function", "every rendered Events child card needs a shared editorial resolver");
const aflEditorialFeedCard = feed.events.find(event => event.canonicalEventId === "event:afl:cd_m20260142601");
assert(aflEditorialFeedCard?.editorialNarrative?.projectionId, "an AFL final must retain its researched projection as an ordinary Feed card");
const unresolvedUsOpenChild = catalogue.events.find(record => record.id === "major-event:us-open-2026").subEvents[0];
const resolvedUsOpenEditorialChild = majorEvents.editorialRecordForSubEvent(unresolvedUsOpenChild, catalogue.events.find(record => record.id === "major-event:us-open-2026"), feed.events);
assert.match(resolvedUsOpenEditorialChild?.editorialNarrative?.projectionId, /projection:major:us-open-2026:child:/, "an Events fixture without its own projection must receive a traceable child projection from validated parent research");
assert.match(resolvedUsOpenEditorialChild?.editorialNarrative?.hook, /Serena Williams \/ Carlos Alcaraz and Erin Routliffe \/ Lloyd Glasspool/, "an inherited Events projection must develop the narrative around its actual participants");
assert.notEqual(resolvedUsOpenEditorialChild?.editorialNarrative?.hook, catalogue.events.find(record => record.id === "major-event:us-open-2026").editorialNarrative.hook, "an Events fixture must not repeat its generic parent hook");
const pinnedUsOpenEditorialChild = majorEvents.editorialFixtureFromSubEvent(unresolvedUsOpenChild, catalogue.events.find(record => record.id === "major-event:us-open-2026"), feed.events);
assert.equal(pinnedUsOpenEditorialChild?.editorialNarrative?.projectionId, resolvedUsOpenEditorialChild?.editorialNarrative?.projectionId, "an Events fixture added to Feed must retain its resolved child editorial projection");
assert.equal(fixture.eventId, drawnMatch.id);
assert.equal(fixture.date, "2026-10-15");
assert.equal(fixture.time, "20:05");
assert.equal(fixture.majorEventParentId, rlwc.id);
assert.equal(fixture.cardKind, "fixture", "a pinned Event child must materialise as a normal fixture card");
assert.equal(fixture.majorEventMarker, undefined, "a pinned child must not inherit its parent Event marker flags");
assert(curatedOpener?.editorialNarrative, "the curated World Cup opener must retain its researched projection");
const resolvedRlwcEditorialChild = majorEvents.editorialRecordForSubEvent(drawnMatch, rlwc, []);
assert.equal(resolvedRlwcEditorialChild.editorialNarrative.hook, curatedOpener.editorialNarrative.hook, "an Events-only World Cup child must retain the latest researched fixture stakes even before its matching Feed card is loaded");
assert.equal(majorEvents.fixtureSemanticKey(fixture), majorEvents.fixtureSemanticKey(curatedOpener), "the pinned child and curated opener must share one semantic fixture identity despite different IDs and ISO precision");
assert(html.includes("const canonicalFixtures = [...EVENTS, ...activeEvents]") && html.includes("repairSavedFixture?.(event, canonicalFixtures)") && html.includes("const current = repaired?.fixture || event"), "a pinned Events child must adopt the canonical fixture and its curated projection on the first Feed render without waiting for the lazy Events runtime");
assert(html.includes(`"${fixture.id}":Object.freeze({`) && html.includes(`projectionId:"${curatedOpener.editorialNarrative.projectionId}"`) && html.includes(`hook:"${curatedOpener.editorialNarrative.hook}"`), "the one pre-canonical device-local pin must retain the exact validated projection without another startup request");
assert.equal(majorEvents.fixtureFromSubEvent({ ...drawnMatch, startTimeUtc: null }, rlwc), null, "unknown times must not materialise in Fixtures");
assert.equal(new Set([fixture.eventId, fixture.eventId]).size, 1, "the stable child ID is the deduplication boundary");

const invalidCopies = [
  [{ ...catalogue, events: [...catalogue.events, catalogue.events[0]] }, /duplicate/],
  [{ ...catalogue, events: catalogue.events.map((record, index) => index ? record : { ...record, sources: [] }) }, /evidence/],
  [{ ...catalogue, events: catalogue.events.map((record, index) => index ? record : { ...record, stakesScore: 4 }) }, /stakes/],
  [{ ...catalogue, events: catalogue.events.map(record => record.id === "major-event:us-open-2026" ? { ...record, ticketing: { ...record.ticketing, url: "https://www.usopen.org/" } } : record) }, /ticket URL/],
  [{ ...catalogue, events: catalogue.events.map(record => record.id === "major-event:us-open-2026" ? { ...record, startDate: "2028-01-01", endDate: "2028-01-14" } : record) }, /retention horizon/],
  [{ ...catalogue, publishedAt: FUTURE_REFERENCE }, /non-future/],
  [{ ...catalogue, events: catalogue.events.map((record, index) => index ? record : { ...record, sources: record.sources.map(source => ({ ...source, checkedAt: FUTURE_REFERENCE })) }) }, /future-dated source/],
  [{ ...catalogue, events: catalogue.events.map(record => record.id === "major-event:australian-grand-prix-2027" ? { ...record, season: 2028 } : record) }, /TBC records/],
];
invalidCopies.forEach(([document, message]) => {
  assert.match(majorEvents.validateDocument(document, { reference: REFERENCE, verifiedTicketUrl: ticketing.verifiedSellerUrl }).join("\n"), message);
});

assert(html.includes('data-tab="feed"') && html.indexOf('data-tab="feed"') < html.indexOf('data-tab="events"') && html.indexOf('data-tab="events"') < html.indexOf('data-tab="follow"'), "Events must sit directly after Feed");
assert(html.includes('url: "data/major-events.v1.json"') && html.includes("async function loadMajorEventsData()"), "Events data must load on demand");
assert(!html.includes('<script src="config/major-events.js"></script>') && html.includes('moduleScriptUrl: "config/major-events.js?v=223"'), "the Events runtime must stay off the critical startup path and load with its catalogue");
assert(html.indexOf("const networkRequest = fetchJson(MAJOR_EVENTS_CONFIG.url)") < html.indexOf("renderAll({ preserveViewport: true })", html.indexOf("async function loadMajorEventsData()")), "Events must start its lazy request before rendering the loading state");
assert(html.includes("if (shouldLoadEvents) void loadMajorEventsData();"), "opening Events must not serialise a separate render before its lazy request");
assert(!worker.includes('"/data/major-events.v1.json"'), "major events must not be fetched by the startup app shell");
assert(worker.includes('"/config/major-events.js?v=223"') && worker.includes('"/config/follow-feed-policy.js?v=230"') && worker.includes('"/schemas/major-events.schema.json"'), "Events logic, followed-fixture policy and schema must remain offline-capable");
assert.match(html, /const date = ev\.date \|\| ev\.startDate;/, "major-event editorial display must resolve startDate records without crashing Events rendering");
assert.match(html, /const crowdEvent = majorSubEventNothingscoreEvent\(subEvent, record, fixture\);[\s\S]*const editorialHook = buildEditorialL0Hook\(editorialNarrativeHookForDisplay\(editorialRecord\), editorialConsequenceForDisplay\(editorialRecord\)\);[\s\S]*if \(editorialHook\) row\.appendChild\(editorialHook\);[\s\S]*row\.appendChild\(buildEventNothingscoreAction\(crowdEvent\)\);/, "every Events timetable card must keep Why it matters and the contribution action together");
assert.match(html, /row\.appendChild\(buildNothingscoreSummary\(crowdEvent\)\)/, "Events timetable cards must expose the real peer summary for that match");
assert.match(html, /function majorEventFixtureSnapshot\(subEvent, parent\)\{\s+return MAJOR_EVENTS\?\.editorialFixtureFromSubEvent\?\.\(subEvent, parent, \[\.\.\.EVENTS, \.\.\.activeEvents\]\) \|\| null;/, "Events fixtures added to Feed must be persisted with resolved editorial rather than structural copy");
assert(html.includes('majorEventsCatalogue: "ns_major_events_catalogue_v1"'), "the validated Events catalogue needs a first-visit offline fallback");
assert(html.includes("payload = readStorage(STORAGE_KEYS.majorEventsCatalogue, null)") && html.includes("if (!loadedFromStorage && !quarantinedIds.length) writeStorage(STORAGE_KEYS.majorEventsCatalogue, payload)"), "Events offline replay must reuse only a previously validated lazy-loaded catalogue");
assert(html.includes("addedToFixtures") && html.includes("addedFixture"), "selected match persistence must be wired into the browser state");
assert(html.includes('activeFilter === "all" || feedFilterMatchesEvent(activeFilter, event)'), "selected child fixtures must still respect an explicitly focused sport view");
const feedMerger = html.match(/function mergeMainFeedSpecialEvents\(events\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(feedMerger.includes("selectedMajorEventFixtures()"), "Feed must include independently pinned Event children");
assert(!feedMerger.includes("markerEvents") && !feedMerger.includes("mainFeedMajorEventMarkers") && feedMerger.includes('event?.majorEventMarker !== true'), "parent Event and tournament markers must never enter Feed");
assert(html.includes("visibleMajorEventSubEvents") && html.includes("subEventMeetsDisplayPolicy"), "every Event timetable must apply the followed-or-4-plus-or-marquee fixture rule");
assert(html.includes("const pinEligible = Boolean(fixture);") && html.includes('added ? "Remove from Feed" : "Add to Feed"'), "past and session-relative published matches must support an explicit Feed pin");

console.log(`Major events valid: ${publishedParents.length} rich event cards, ${catalogue.events.length - publishedParents.length} active ticket alerts, exact seller endpoints, horizons, evidence and stable child IDs passed.`);
