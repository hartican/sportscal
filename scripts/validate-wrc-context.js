#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const calendar = require("../config/calendar-export");
const cardLifecycle = require("../config/card-lifecycle");
const discovery = require("../config/discovery-catalogue");
const feedTimeline = require("../config/feed-timeline");
const hubs = require("../config/sport-hubs");
const preferenceSystem = require("../config/preference-system");
const profileStorage = require("../config/profile-storage");
const registry = require("../config/sport-domain-registry");
const selector = require("../config/selector-taxonomy");
const sportContext = require("../config/sport-context");
const serverFeed = require("../lib/server-feed-pipeline");
const taxonomy = require("../config/canonical-sports-taxonomy");
const { classifyCalendarEvent } = require("./import-calendar-events");
const { SourceError, preservedContextAfterCoreFailure } = require("./refresh-wrc-context");
const { WRC_SOURCE_NOTE, syncWrcToFeed } = require("./sync-wrc-to-feed");
const {
  CALENDAR_URL,
  CLASSIFICATION_URLS,
  STANDINGS_URL,
  STAN_URL,
  classificationPageMatchesUrl,
  isTransientSourceStatus,
  parseFiaClassification,
  parseFiaStandings,
  parseWrcCalendar,
  validateWrcContext,
} = require("./lib/wrc-context");

const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const context = JSON.parse(read("data/canonical/wrc-context-2026.json"));
const feed = JSON.parse(read("data/events.json"));
const incoming = JSON.parse(read("feeds/incoming/events.json"));
const schema = JSON.parse(read("schemas/sport-context.schema.json"));
const appSource = read("index.html");
const serverFeedSource = read("api/feed.js");

assert.deepEqual(validateWrcContext(context), [], "checked-in WRC context must satisfy the strict domain contract");
assert.equal(context.events.length, 14);
assert.deepEqual(context.events.map(event => event.roundNumber), Array.from({ length: 14 }, (_, index) => index + 1));
assert(context.events.every(event => event.endDate >= event.date && event.dateOnly === true));
assert(context.events.every(event => event.broadcasters.some(provider => provider.broadcasterName === "Stan Sport" && provider.live && provider.replay && provider.sourceUrl === STAN_URL)));
assert.equal(context.ladderSnapshots.length, 3);
assert.deepEqual(new Set(context.ladderSnapshots.map(snapshot => snapshot.competitionId)), new Set([
  "competition:wrc-drivers-2026", "competition:wrc-co-drivers-2026", "competition:wrc-manufacturers-2026",
]));
assert.equal(context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:wrc-drivers-2026").entries.length, 36);
assert.equal(context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:wrc-co-drivers-2026").entries.length, 37);
assert.equal(context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:wrc-manufacturers-2026").entries.length, 4);
assert(context.participants.every(participant => participant.type === "team" || participant.type === "competitor"));
assert(context.participants.every(participant => /^[A-Z]{2}$/.test(participant.countryCode)));
assert(context.participants.every(participant => participant.metadata?.preferenceDomainId === "sport:wrc"));
assert.equal(context.eventParticipantScopes.length, 1);
assert.deepEqual(new Set(context.eventParticipantScopes[0].participantIds), new Set(context.participants.map(participant => participant.id)));
assert(!context.competitions.some(competition => /junior|wrc2|wrc3|support/i.test(`${competition.id} ${competition.name}`)));
assert(schema.$defs.competition.properties.standingsType.enum.includes("coDrivers"));
assert(schema.$defs.competition.properties.standingsType.enum.includes("manufacturers"));
assert(schema.properties.events, "shared context schema must admit canonical multi-day events");

const calendarFixture = fs.readFileSync(path.join(FIXTURES, "wrc-calendar.html"), "utf8");
const standingsFixture = fs.readFileSync(path.join(FIXTURES, "wrc-standings.html"), "utf8");
const parsedRounds = parseWrcCalendar(calendarFixture);
const parsedStandings = parseFiaStandings(standingsFixture);
assert.equal(parsedRounds.length, 14);
assert.deepEqual(parsedRounds[9], {
  roundNumber:10, name:"WRC Secto Rally Finland", startDate:"2026-07-30", endDate:"2026-08-02",
  countryCode:"FI", country:"Finland", region:"Europe",
});
assert.deepEqual(Object.fromEntries(Object.entries(parsedStandings).map(([key, value]) => [key, value.length])), { drivers:2, coDrivers:2, manufacturers:2 });
assert.equal(parsedStandings.drivers[0].name, "Elfyn Evans");
assert.equal(parsedStandings.coDrivers[0].name, "Scott Martin");
assert.equal(parsedStandings.manufacturers[0].name, "TOYOTA GAZOO RACING WRT");
assert.throws(() => parseWrcCalendar(calendarFixture.replace(/\[\[\{\"text\":\"14\"\}\][\s\S]*?\]\]\}\}<\/script>/, "]}}</script>")), /14 rounds|valid JSON|sequence/);
assert.throws(() => parseFiaStandings(standingsFixture.replace("2026 FIA World Rally Championship for Co-Drivers", "Removed table")), /Co-Drivers/);
const official = parseFiaClassification(fs.readFileSync(path.join(FIXTURES, "wrc-classification-official.html"), "utf8"));
assert.deepEqual(official, {
  status:"official", driver:{name:"Oliver Solberg", countryCode:"SWE"}, coDriver:{name:"Elliott Edmondson", countryCode:"SWE"},
  vehicle:"Toyota GR Yaris Rally1", totalTime:"4:24:59.0",
});
assert(classificationPageMatchesUrl(fs.readFileSync(path.join(FIXTURES, "wrc-classification-official.html"), "utf8"), CLASSIFICATION_URLS[1]));
assert(!classificationPageMatchesUrl(fs.readFileSync(path.join(FIXTURES, "wrc-classification-official.html"), "utf8"), CLASSIFICATION_URLS[4]), "a structurally valid classification from a different rally must fail closed");
assert.equal(parseFiaClassification(fs.readFileSync(path.join(FIXTURES, "wrc-classification-pending.html"), "utf8")), null);
assert(isTransientSourceStatus(429) && isTransientSourceStatus(503));
assert(!isTransientSourceStatus(403) && !isTransientSourceStatus(404));
assert.equal(preservedContextAfterCoreFailure(new SourceError("HTTP 503", { transient:true }), context), context);
assert.throws(() => preservedContextAfterCoreFailure(new SourceError("HTTP 403"), context), /HTTP 403/);
assert.throws(() => preservedContextAfterCoreFailure(new Error("structural drift"), context), /structural drift/);
assert.throws(
  () => preservedContextAfterCoreFailure(new SourceError("HTTP 429", { transient:true }), { ...context, events:[] }),
  /expected exactly 14 WRC rounds/,
  "a transient outage must never preserve a structurally invalid fallback"
);

const motorsport = selector.byId["sport:motorsport"];
const wrc = selector.byId["sport:wrc"];
assert.deepEqual(Array.from(motorsport.childIds), ["sport:f1", "sport:motogp", "sport:wrc"]);
assert.equal(wrc.label, "WRC");
assert(!selector.exposedSportNodes.some(node => node.id === "sport:rally"));
assert.equal(taxonomy.competitionFamilies.find(family => family.id === "family:world-rally-championship")?.name, "FIA World Rally Championship");
assert.equal(taxonomy.competitions.filter(competition => competition.preferenceDomainId === "sport:wrc").length, 4);
assert.equal(registry.byKey.wrc.label, "WRC");
assert.equal(registry.byKey.rally, registry.byKey.wrc, "rally must survive only as a compatibility alias");
assert(!registry.domains.some(domain => domain.key === "rally"));

const migrated = discovery.migratePreferences({
  version:18,
  selectedSelectorEntityIds:["sport:rally"],
  followedSports:["rally"],
  standings:{selectedSportKeys:["rally"],pinTimestamps:{"competition:world-rally":"2026-01-01T00:00:00.000Z"}},
  preferenceGraph:{domainPreferences:[{sportDomainId:"sport:rally",templateId:"template:froth",enabled:true}]},
});
assert.deepEqual(Array.from(migrated.selectedSelectorEntityIds), ["sport:wrc"]);
assert.deepEqual(Array.from(migrated.followedSports), ["wrc"]);
assert.equal(migrated.preferenceGraph.domainPreferences[0].sportDomainId, "sport:wrc");
assert.deepEqual(Array.from(migrated.standings.selectedSportKeys), ["wrc"]);
assert.deepEqual(Object.keys(migrated.standings.pinTimestamps), ["competition:wrc-2026"]);
const graph = preferenceSystem.migratePreferenceGraph({
  profileId:"profile:wrc-test",
  domainPreferences:[{profileId:"profile:wrc-test",sportDomainId:"sport:rally",templateId:"template:froth",enabled:true}],
  competitionPreferences:[{profileId:"profile:wrc-test",competitionId:"competition:world-rally"}],
}, { profileId:"profile:wrc-test", domainIds:["sport:wrc"], broadcasterIds:["stan"] });
assert.equal(graph.domainPreferences[0].sportDomainId, "sport:wrc");
assert.equal(graph.competitionPreferences[0].competitionId, "competition:wrc-2026");

class MemoryStorage {
  constructor(entries){ this.map = new Map(entries || []); }
  getItem(key){ return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value){ this.map.set(key, String(value)); }
  removeItem(key){ this.map.delete(key); }
}
const profileId = "profile:wrc-migration";
const storedBundle = {
  schemaVersion:5,
  profile:{id:profileId,createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z"},
  preferences:{selectedSelectorEntityIds:["sport:rally"],followedSports:["rally"],standings:{selectedSportKeys:["rally"]},preferenceGraph:{domainPreferences:[{sportDomainId:"sport:rally"},{sportDomainId:"sport:wrc"}],competitionPreferences:[{competitionId:"competition:world-rally"},{competitionId:"competition:wrc-2026"}]}},
  domainPreferences:[{sportDomainId:"sport:rally"},{sportDomainId:"sport:wrc"}],competitionPreferences:[{competitionId:"competition:world-rally"},{competitionId:"competition:wrc-2026"}],
};
const storage = new MemoryStorage([
  [profileStorage.KEYS.install, JSON.stringify({installId:"install:test",activeProfileId:profileId,createdAt:"2026-01-01T00:00:00.000Z"})],
  [profileStorage.KEYS.activeProfileId, JSON.stringify(profileId)],
  [`${profileStorage.KEYS.profilePrefix}${profileId}`, JSON.stringify(storedBundle)],
]);
const migratedProfile = profileStorage.loadActiveProfile(storage, { now:new Date("2026-09-06T00:00:00.000Z") });
assert.deepEqual(migratedProfile.preferences.selectedSelectorEntityIds, ["sport:wrc"]);
assert.deepEqual(migratedProfile.preferences.followedSports, ["wrc"]);
assert.deepEqual(migratedProfile.preferences.standings.selectedSportKeys, ["wrc"]);
assert.equal(migratedProfile.preferences.preferenceGraph.domainPreferences.length, 1);
assert.equal(migratedProfile.preferences.preferenceGraph.competitionPreferences.length, 1);
assert.equal(migratedProfile.domainPreferences[0].sportDomainId, "sport:wrc");
assert.equal(migratedProfile.competitionPreferences[0].competitionId, "competition:wrc-2026");
assert.equal(migratedProfile.domainPreferences.length, 1);
assert.equal(migratedProfile.competitionPreferences.length, 1);

assert.equal(classifyCalendarEvent({title:"FIA WRC Rally Sweden"}).key, "wrc");
assert.equal(classifyCalendarEvent({title:"Dakar Rally"}).key, "motorsport");
assert.equal(classifyCalendarEvent({title:"Regional forest rally"}).key, "motorsport");
assert.deepEqual(discovery.oneOffMotorsportFrothIds({key:"motorsport",name:"Dakar Rally"}), ["sport:motorsport"]);

const feedWrc = feed.events.filter(event => event.key === "wrc");
const incomingWrc = incoming.events.filter(event => event.key === "wrc");
assert.equal(feedWrc.length, 14);
assert.equal(incomingWrc.length, 14);
assert(feedWrc.every(event => event.endDate >= event.date && event.displayTime === "Multiple live stages"));
assert(feedWrc.every(event => event.broadcaster === "Stan Sport" && event.watchUrl === STAN_URL && event.replayUrl === STAN_URL));
assert(feedWrc.every(event => !event.majorEventMarker && !event.majorEventId && !event.eventFamilyId));
const hydratedWrc = sportContext.applyContextToEvents(feedWrc, context);
assert(hydratedWrc.every(event => event.participantIds.length === context.participants.length), "all senior WRC participants must remain followable without duplicating them in every stored card");
const chileServerCard = hydratedWrc.find(event => event.roundNumber === 12);
const legacyWrcState = {
  preferences:{
    version:18,
    selectedSelectorEntityIds:["sport:rally"],
    followedSports:["rally"],
    preferenceGraph:{
      domainPreferences:[{ sportDomainId:"sport:rally", enabled:true, includeAllFixtures:false, includeMajorEvents:true, includeFollowedTeams:true }],
      competitionPreferences:[],
      entityFollows:[],
    },
  },
};
const upcomingServerFeed = serverFeed.buildServerFeed({
  events:[chileServerCard], userId:"wrc-domain-follow", userState:legacyWrcState,
  participants:context.participants, now:new Date("2026-09-06T02:00:00.000Z"),
});
assert.equal(upcomingServerFeed.events[0]?.status, "upcoming", "legacy Rally follows must migrate into a personalised WRC server feed");
assert.equal(upcomingServerFeed.derivedCardCache.derivedCards.length, 1, "a WRC competition follow must enrich the four-stakes round card");
const liveServerFeed = serverFeed.buildServerFeed({
  events:[chileServerCard], userId:"wrc-live", userState:legacyWrcState,
  participants:context.participants, now:new Date("2026-09-11T02:00:00.000Z"),
});
assert.equal(liveServerFeed.events[0]?.status, "live", "a date-only rally must remain live through its inclusive end date");
assert.equal(cardLifecycle.lifecycleState(chileServerCard, { now:new Date("2026-09-27T12:00:00.000Z") }).state, "archived", "WRC retention must start at the end of the multi-day rally rather than its first day");
assert.equal(cardLifecycle.lifecycleState(chileServerCard, { now:new Date("2026-09-28T12:00:00.000Z") }).state, "expired", "WRC retention must expire fourteen days after the rally end date");
assert(!feed.events.some(event => event.key === "rally"));
assert(!feed.events.some(event => /Paris-Dakar Rally 2026 Stage 11|WRC Safari Rally 2027/.test(event.name)));
const resynced = syncWrcToFeed(feed, context);
assert.equal(resynced.events.filter(event => event.key === "wrc").length, 14, "WRC projection must be idempotent");
assert.equal(resynced.sourceNote.split(WRC_SOURCE_NOTE).length - 1, 1, "WRC source disclosure must remain idempotent");

assert.equal(hubs.canonicalFixturesForSport(context, "wrc").length, 14);
const officialView = hubs.canonicalFixtureView(context.events[0], { participants:context.participants, feedCards:feed.events });
assert.equal(officialView.event.canonicalResultText, "Oliver Solberg / Elliott Edmondson · 4:24:59.0");
assert.equal(officialView.event.sportDomainId, "sport:wrc");
assert.equal(officialView.event.canonicalSportDomainId, "sport:motorsport");
const scheduledView = hubs.canonicalFixtureView(context.events.find(event => event.status === "scheduled"), { participants:context.participants, feedCards:feed.events });
assert.equal(scheduledView.event.resultStatus, null, "a scheduled WRC round must not invent a result state");
assert.equal(hubs.supportedRounds(hubs.canonicalFixturesForSport(context, "wrc")).length, 14);
assert.equal(feedTimeline.status({date:"2026-09-10",endDate:"2026-09-13",dateOnly:true,status:"upcoming"}, new Date("2026-09-11T02:00:00.000Z")), "live");

const chile = feedWrc.find(event => event.roundNumber === 12);
const ics = calendar.buildIcs([chile], { now:new Date("2026-09-06T00:00:00.000Z") });
assert.match(ics, /UID:event-wrc-2026-round-12@nothingsport\.app/);
assert.match(ics, /DTSTART;VALUE=DATE:20260910/);
assert.match(ics, /DTEND;VALUE=DATE:20260914/);
assert.deepEqual(calendar.migrateSelectionIds([
  "calendar-nothingsport-manual-seed-rally-wrc-safari-2027",
  "calendar-nothingsport-manual-seed-rally-paris-dakar-stage-11-2026",
]), ["event-wrc-2026-round-03"]);

const pendingCard = {
  ...feedWrc.find(event => event.roundNumber === 12),
  status:"completed",
  resultStatus:"pending",
  resultSourceUrl:CLASSIFICATION_URLS[12],
  resultSourceCheckedAt:"2026-09-14T12:00:00.000Z",
};
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wrc-result-pending-"));
try {
  const pendingPath = path.join(tempDirectory, "events.json");
  fs.writeFileSync(pendingPath, JSON.stringify({ events:[pendingCard] }));
  const check = spawnSync(process.execPath, ["scripts/verify-result-completeness.js", pendingPath], {
    cwd:ROOT, env:{...process.env,RESULT_CHECK_NOW:"2026-09-14T14:30:00.000Z"}, encoding:"utf8",
  });
  assert.equal(check.status, 0, `source-backed pending WRC result must fail closed without breaking refresh: ${check.stderr}`);
} finally {
  fs.rmSync(tempDirectory, { recursive:true, force:true });
}

assert(appSource.includes('"sport:rally": "sport:wrc"'));
assert(appSource.includes('sportKey === "wrc" ? "Results / Replays" : "Results"'));
assert(appSource.includes('code.slug === "wrc" ? [["results", "Results / Replays"]] : []'));
assert(appSource.includes('function renderCodeInspectorResults(panel, code)'));
assert(appSource.includes('pending.textContent = "Official FIA classification pending."'));
assert(appSource.includes('ev.displayTime || "Multiple live stages"'));
assert(appSource.includes('SPORT_CONTEXT.mergeCanonicalBundles(...contextBundles)'));
assert(appSource.includes('participant?.metadata?.preferenceDomainId === domainId'));
assert(serverFeedSource.includes('require("../data/canonical/wrc-context-2026.json")'), "the authenticated feed must merge the WRC participant scope");
assert(new Set(context.sources.map(source => source.sourceUrl)).has(CALENDAR_URL));
assert(new Set(context.sources.map(source => source.sourceUrl)).has(STANDINGS_URL));

console.log("WRC context valid: official 14-round calendar, three senior tables, date-only Feed and ICS semantics, Stan live/replay metadata, hub results, and rally migration coverage.");
