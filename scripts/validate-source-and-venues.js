#!/usr/bin/env node
const assert = require("node:assert/strict");
const sourceTrust = require("../config/source-trust.js");
const venues = require("../config/venue-registry.js");
const feed = require("../data/events.json");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const feedUtils = require("./lib/feed-utils.js");
assert.equal(venues.VERSION, "venue-registry.v3", "the context-aware venue identity migration must be versioned");

assert.equal(sourceTrust.sourceTrustForEvent({ sourceType: "official" }).trust, "verified");
assert.equal(sourceTrust.sourceTrustForEvent({ sourceType: "reputable" }).label, "Unverified source");
assert.deepEqual(
  sourceTrust.mergeClaims(
    { date: "2026-08-22", score: "20-10", sourceType: "official" },
    { date: "2026-08-23", score: "25-10", sourceType: "scraped", selectedSentence: "New reporting" },
  ),
  {
    date: "2026-08-22",
    score: "20-10",
    sourceType: "scraped",
    selectedSentence: "New reporting",
    sourceTrust: "unverified",
    verifiedFactSource: {
      sourceType: "official",
      sourceName: null,
      sourceUrl: null,
      sourceCheckedAt: null,
      protectedFields: ["date", "score"],
    },
  },
  "unverified reporting must not overwrite verified fixture or result facts"
);
const protectedFeedEvent = feedUtils.protectVerifiedEventFacts(
  [{ eventId: "test", id: "test", key: "rugby", name: "All Blacks v South Africa", date: "2026-08-23", time: "19:00", score: "30-20", sourceType: "scraped", sourceName: "Public report", sourceUrl: "https://example.com/report", sourceCheckedAt: "2026-08-23T10:00:00Z" }],
  [{ eventId: "test", id: "test", key: "rugby", name: "All Blacks v South Africa", date: "2026-08-22", time: "17:00", score: "", sourceType: "official", sourceName: "Competition", sourceUrl: "https://example.com/fixture", sourceCheckedAt: "2026-08-20T10:00:00Z" }],
)[0];
assert.equal(protectedFeedEvent.date, "2026-08-22", "the publish boundary must retain the verified fixture date");
assert.equal(protectedFeedEvent.time, "17:00", "the publish boundary must retain the verified fixture time");
assert.equal(protectedFeedEvent.score, "", "the publish boundary must not accept a conflicting unverified result");
assert.equal(protectedFeedEvent.sourceTrust, "unverified", "mixed reporting must remain visibly unverified");
assert.equal(protectedFeedEvent.sourceName, "Public report", "the visible source must describe the unverified reporting actually shown");
const unrelatedNearbyFixture = feedUtils.protectVerifiedEventFacts(
  [{ eventId: "essendon-gws", id: "essendon-gws", key: "afl", name: "Essendon v Greater Western Sydney Giants", date: "2026-07-19", time: "16:40", sourceType: "reputable" }],
  [{ eventId: "gws-sydney", id: "gws-sydney", canonicalEventId: "event:afl:gws-sydney", key: "afl", name: "GWS GIANTS v Sydney Swans", date: "2026-07-25", time: "16:35", sourceType: "official" }],
)[0];
assert.equal(unrelatedNearbyFixture.date, "2026-07-19", "shared team tokens across different rounds must not import verified facts from another fixture");
assert.equal(unrelatedNearbyFixture.canonicalEventId, undefined, "a nearby but distinct fixture must never inherit another canonical event identity");
assert.equal(feedUtils.validateFeed(feedUtils.normalizeFeed({ schemaVersion: "events.v1", version: "source-test", publishedAt: "2026-08-20T10:00:00Z", events: [{ ...feed.events[0], sourceType: "scraped" }] })).length, 0, "scraped MVP sources must be accepted by the canonical feed contract");
assert.equal(venues.resolve("Ocean Protect Stadium").displayName, "Shark Park");
assert.equal(venues.resolve("Accor Stadium, Sydney").displayName, "Stadium Australia");
assert.equal(venues.resolve("Marvel Stadium").displayName, "Docklands Stadium");
assert.equal(venues.resolve("ENGIE Stadium, Sydney").id, "sydney-showground-stadium", "Sydney Showground must retain its own canonical venue identity");
assert.equal(venues.resolve("Netstrata Jubilee Stadium").id, "jubilee-oval", "Kogarah must retain its own canonical venue identity");
assert.notEqual(venues.resolve("ENGIE Stadium, Sydney").id, venues.resolve("Netstrata Jubilee Stadium").id, "ENGIE Stadium and Netstrata Jubilee Stadium must never be merged");
assert.equal(venues.resolve("Go Media Stadium").displayName, "Mt Smart");
assert.equal(venues.resolve("GIO Stadium").displayName, "Bruce stadium");
assert.equal(venues.resolve("Canberra Stadium").id, "gio-stadium");
assert.equal(venues.resolve("UTAS Stadium, Launceston").displayName, "York Park");
assert.equal(venues.resolve("Cincinnati, USA", { key: "tennis" }).displayName, "Cincinnati Open", "broad location aliases must resolve only with event context");
assert.equal(venues.resolve("Cincinnati, USA").audited, false, "a city must not globally collapse to one venue");
assert.equal(venues.resolve("New York, USA", { key: "tennis" }).officialName, "USTA Billie Jean King National Tennis Center", "the US Open tournament overview must resolve its broad city label through tennis context");
assert.equal(venues.resolve("New York, USA").audited, false, "New York must not globally collapse to the US Open grounds");
assert.equal(venues.resolve("Etihad Stadium", { key: "premier-league" }).id, "etihad-stadium-manchester", "the EPL context must resolve Manchester's Etihad without introducing a global venue collision");
assert.equal(venues.resolve("Etihad Stadium").audited, false, "Etihad Stadium must not globally collapse to Manchester");
assert.equal(venues.resolve("Berlin, Germany", { key: "fiba-women" }).id, "uber-arena-berlin", "the FIBA Women finals host must resolve to the tournament arena only in its sport context");
assert.equal(venues.resolve("Berlin, Germany").audited, false, "Berlin must not globally collapse to one arena");
assert.equal(venues.resolve("Phillip Island Grand Prix Circuit").id, "phillip-island-grand-prix-circuit");
assert.equal(venues.resolve("Geneva, Switzerland").id, "geneva-sailgp");
const sharedCourtContexts = [
  { venue: "Court 6", key: "tennis", eventSeriesId: "event-series:us-open" },
  { venue: "Court 6", key: "tennis", tennisTournamentId: "tournament:tennis:wta-beijing-2026" },
];
assert(venues.audit(sharedCourtContexts).pending.includes("Court 6"), "one reviewed court context must not hide another unresolved use of the same name");
assert.deepEqual(venues.audit(sharedCourtContexts), venues.audit([...sharedCourtContexts].reverse()), "venue audit must not depend on fixture order");
const beijingCourt = venues.resolve("Court 4", { key: "tennis", tennisTournamentId: "tournament:tennis:wta-beijing-2026" });
const shanghaiCourt = venues.resolve("Court 4", { key: "tennis", tournamentId: "tournament:tennis:atp-shanghai-2026" });
assert.notEqual(beijingCourt.id, shanghaiCourt.id, "identically labelled courts at different sites must retain distinct identities");
assert.equal(shanghaiCourt.audited, true, "the official 2026 Shanghai order of play names Court 4");
assert.equal(beijingCourt.audited, false, "unconfirmed current court identities remain unresolved");
assert.equal(beijingCourt.reviewDisposition, "court_identity_pending_review");
assert.equal(beijingCourt.displayName, "Court 4", "retain the source-listed court label");
assert.equal(venues.resolve("Shanghai", { key: "tennis", tournamentId: "tournament:tennis:atp-shanghai-2026" }).id, "qizhong-tennis-center");
assert.equal(venues.resolve("Shanghai, CHN", {key:"tennis",tournamentId:"tournament:tennis:atp-shanghai-2026"}).id,"qizhong-tennis-center","The observed country-code label uses the same reviewed tournament, never a global city alias");
for(const context of [{},{key:'baseball',tournamentId:'tournament:tennis:atp-shanghai-2026'},{key:'tennis',tournamentId:'tournament:tennis:atp-shanghai-2027'},{key:'tennis',tournamentId:'tournament:tennis:wta-shanghai-2026'},{key:'tennis',tennisTournamentId:'tournament:tennis:atp-shanghai-2026',tournamentId:'tournament:tennis:wta-beijing-2026'}])assert.equal(venues.resolve('Shanghai, CHN',context).audited,false);
for(const [value,id] of [['Caulfield','caulfield-racecourse'],['Flemington','flemington-racecourse']]){
  assert.equal(venues.resolve(value,{key:'horse-racing'}).id,id);
  for(const context of [{},{key:'football'},{key:'tennis'}])assert.equal(venues.resolve(value,context).audited,false,'A suburb cannot globally select a racecourse');
}
assert.equal(venues.resolve('Royal Randwick').officialName,'Royal Randwick Racecourse');
assert.equal(venues.resolve('Rosehill Gardens').officialName,'Rosehill Gardens Racecourse');
assert.equal(venues.resolve('Randwick').audited,false);assert.equal(venues.resolve('Rosehill').audited,false);
for (const context of [{}, { key: "baseball", tournamentId: "tournament:tennis:atp-shanghai-2026" }, { key: "tennis", tournamentId: "tournament:tennis:atp-shanghai-2027" }, { key: "tennis", tennisTournamentId: "tournament:tennis:atp-shanghai-2026", tournamentId: "tournament:tennis:wta-beijing-2026" }]) {
  assert.equal(venues.resolve("Shanghai", context).audited, false, "a city must not resolve without a consistent reviewed tournament context");
  assert.equal(venues.resolve("Court 4", context).reviewDisposition, "unclassified", "unsupported court contexts must fail closed despite a familiar label");
}
assert.equal(venues.resolve("Court 99", { key: "tennis", tournamentId: "tournament:tennis:atp-shanghai-2026" }).reviewDisposition, "unclassified", "a known site cannot validate an invented court");
const courtAudit = venues.audit([{ venue: "Court 4", key: "tennis", tournamentId: "tournament:tennis:atp-shanghai-2026" }, { venue: "Court 4", key: "tennis" }]);
assert(courtAudit.unclassified.includes("Court 4"), "a validated first fixture cannot mask an unsupported later context");
assert.equal(courtAudit.contexts.length, 2);
const shanghaiCourt7 = venues.resolve("Court 7", { key: "tennis", tournamentId: "tournament:tennis:atp-shanghai-2026" });
assert.equal(shanghaiCourt7.reviewDisposition, "court_identity_pending_review", "the formerly hidden Shanghai outer-court context stays unresolved");
assert.notEqual(shanghaiCourt7.id, venues.resolve("Court 7", { key: "tennis", eventSeriesId: "event-series:us-open" }).id, "Shanghai and New York courts must not share identity");
const wuhanCourt3=feed.events.find(event=>[event.id,event.canonicalEventId,...(event.sourceEventIds||[])].includes('fixture:tennis:espn:wta:185358'));
assert.equal(wuhanCourt3?.venue,'Court 3','Retain the actual published court label without attesting its physical identity');
const wuhanVenueInputs = [...require('./fixtures/wuhan-venue-contexts-20261011.json').records,wuhanCourt3];
for (const event of wuhanVenueInputs) {
  const court = venues.resolve(event.venue, event);
  assert.equal(court.audited, false, 'A publisher label cannot attest a physical court');
  assert.equal(court.reviewDisposition, 'court_identity_pending_review');
  assert.equal(court.displayName, event.venue);
  assert(!court.latitude && !court.longitude && !court.geometry, 'Pending courts cannot invent a location');
  for (const context of [{}, {key:'baseball',tournamentId:event.tournamentId}, {key:'tennis',tournamentId:'tournament:tennis:wta-wuhan-2027'}, {key:'tennis',tournamentId:'tournament:tennis:atp-wuhan-2026'}, {...event,tennisTournamentId:'tournament:tennis:wta-beijing-2026'}]) {
    assert.equal(venues.resolve(event.venue, context).reviewDisposition, 'unclassified', 'A reviewed edition cannot approve another court context');
  }
}
const wuhanVenueAudit = venues.audit(wuhanVenueInputs);
assert.deepEqual(wuhanVenueAudit.unclassified, []);
assert.equal(wuhanVenueAudit.audited, 0);
assert.equal(wuhanVenueAudit.pending.length, 4);
const retainedWuhanCourts=require('./fixtures/wuhan-venue-contexts-20261016.json');
assert.equal(retainedWuhanCourts.sourceGitSha,'4e7bc82e5f2c333efbca06c28c866b3258847d82');
assert.match(retainedWuhanCourts.sourceFeedSha256,/^[a-f0-9]{64}$/);
assert.equal(retainedWuhanCourts.records.length,4,'four retained publisher observations establish this exact pending label only');
for(const event of retainedWuhanCourts.records){
 assert.equal(event.venue,'Court 3');assert.equal(event.tournamentId,'tournament:tennis:wta-wuhan-2026');assert.equal(event.tennisTournamentId,event.tournamentId);
 assert.match(event.sourceUrl,/^https:\/\/www\.espn\.com\/tennis\/matchstats\?gameId=\d+$/);assert(['2026-10-14T01:09:46.000Z','2026-10-13T21:00:17.000Z'].includes(event.sourceCheckedAt),'retain original provider receipts, not a new observation clock');
 const pending=venues.resolve(event.venue,event);assert.equal(pending.audited,false);assert.equal(pending.reviewDisposition,'court_identity_pending_review');assert.equal(pending.displayName,event.venue);assert(!pending.latitude&&!pending.longitude&&!pending.geometry,'pending publisher labels establish no physical location');
 for(const wrong of [{},{...event,key:'baseball'},{...event,tournamentId:'tournament:tennis:wta-wuhan-2027',tennisTournamentId:'tournament:tennis:wta-wuhan-2027'},{...event,tournamentId:'tournament:tennis:atp-wuhan-2026',tennisTournamentId:'tournament:tennis:atp-wuhan-2026'},{...event,tennisTournamentId:'tournament:tennis:wta-beijing-2026'}])assert.equal(venues.resolve('Court 3',wrong).reviewDisposition,'unclassified','pending Wuhan Court 3 cannot approve another edition, sport or conflicting identity');
 assert.equal(venues.resolve('Court 99',event).reviewDisposition,'unclassified','the exact observed label cannot approve another court');
 assert.notEqual(pending.id,venues.resolve('Court 3',{key:'tennis',tournamentId:'tournament:tennis:wta-beijing-2026'}).id,'identically labelled courts retain separate tournament identities');
}
assert.deepEqual(venues.audit(retainedWuhanCourts.records).unclassified,[]);assert.equal(venues.audit(retainedWuhanCourts.records).audited,0);
assert.equal(venues.resolve('Court 99', wuhanVenueInputs[0]).reviewDisposition, 'unclassified');
assert.notEqual(venues.resolve('Court 1', wuhanVenueInputs[0]).id, venues.resolve('Court 1', {key:'tennis',tournamentId:'tournament:tennis:atp-tokyo-2026'}).id);
assert(venues.audit([wuhanVenueInputs[0], {...wuhanVenueInputs[0],tournamentId:'tournament:tennis:wta-wuhan-2027',tennisTournamentId:'tournament:tennis:wta-wuhan-2027'}]).unclassified.includes('Court 1'), 'One pending context cannot hide another unknown use');
["config/source-trust.js","config/venue-registry.js"].forEach(file => require("./app-shell-test-utils").assertShellModule(html,file));
assert(require("./offline-shell-module")("config/source-trust.js") && require("./offline-shell-module")("config/venue-registry.js"), "the source trust and venue models must remain available in the offline shell");
const audit = venues.audit(feed.events);
assert.equal(audit.total, new Set(feed.events.map(event => event.venue).filter(Boolean)).size, "the venue audit must inspect every currently published venue");
assert(audit.audited >= 87, "the registry must contain the researched venue aliases and context-specific identities");
const sourceVenueLabels=feed.events.filter(e=>e.venueSourceLabel===e.venue&&e.venueReviewDisposition==='source_name_pending_review').map(e=>e.venue);
assert.deepEqual(audit.unclassified, [], "every current venue input must be resolved or carry an explicit editorial disposition");
const allowedPending = [
  "Beijing, CHN",
  "2026 NBA Finals",
  "Adelaide Entertainment Centre",
  "Afterpay Arena",
  "AIS Arena",
  "Augusta National Golf Club, Georgia",
  "Belfort",
  "Brisbane Entertainment Centre",
  "Cairns Convention Centre",
  "Chalon-sur-Saône",
  "Chile",
  "Croatia",
  "Estonia",
  "Finland",
  "Gippsland Regional Indoor Sports Stadium",
  "Greece",
  "Italy",
  "Japan",
  "John Cain Arena",
  "Kenya",
  "Le Markstein",
  "Monaco",
  "MyState Bank Arena",
  "Nissan Arena",
  "Paraguay",
  "Pat Rafter Arena *subject to change",
  "Pebble Beach Golf Links, California",
  "PGA Frisco, Texas",
  "Portugal",
  "RAC Arena",
  "Red Energy Arena (Bendigo)",
  "Saudi Arabia",
  "Shenzhen, CHN",
  "Silverdome",
  "Spain",
  "Spark Arena",
  "State Basketball Centre",
  "Sweden",
  "TBC",
  "The Old Course, St Andrews",
  "Tour de France 2026",
  "Venue TBC",
  "WIN Entertainment Centre"
];
allowedPending.push(...["Ariake Colosseum, Tokyo","Auckland","Belmore Sports Ground","Bermuda","Campbelltown Sports Stadium","Concepción","Encarnación","Eric Tweedale Stadium","Exponor service park","FMG Stadium Waikato","Gap / Monaco","Geneva","Geohex Park","Gran Canaria Stadium service park","Grobnik Circuit service park","Halifax","Jyväskylä","Loutraki","Lungomare Barcellona service park","Monaco / French Alps","Naivasha","National Tennis Center, Beijing","New York","Polytec Stadium","Portsmouth","Rio","San Francisco","Sassnitz","St George Venues Jubilee Stadium","Sydney","Tartu","Toyota Stadium service park","Umeå","Valencia"]);
const reviewedCourtPending = ["Court 1", "Court 2", "Court 3", "Court 4", "Court 5", "Court 7", "HSBC Moon", "Kinoshita Group Show Court"];
allowedPending.push(...reviewedCourtPending);
allowedPending.push('Dongfeng Voyah Center Court');
for (const name of reviewedCourtPending) {
  const unresolved = audit.contexts.filter(context => context.input === name && !context.audited);
  assert(unresolved.length, "retain each explicit current court-review exception");
  assert(unresolved.every(context => context.reviewDisposition === "court_identity_pending_review"), "pending court exceptions require a reviewed tournament context, not a blanket name waiver");
}
for(const name of ["Ariake Colosseum, Tokyo","Auckland","Belmore Sports Ground","Bermuda","Campbelltown Sports Stadium","Concepción","Encarnación","Eric Tweedale Stadium","Exponor service park","FMG Stadium Waikato","Gap / Monaco","Geneva","Geohex Park","Gran Canaria Stadium service park","Grobnik Circuit service park","Halifax","Jyväskylä","Loutraki","Lungomare Barcellona service park","Monaco / French Alps","Naivasha","National Tennis Center, Beijing","New York","Polytec Stadium","Portsmouth","Rio","San Francisco","Sassnitz","St George Venues Jubilee Stadium","Sydney","Tartu","Toyota Stadium service park","Umeå","Valencia"]){const record=venues.resolve(name);assert.equal(record.audited,false,"queued source names must not pretend to be canonical venues");assert.equal(record.reviewDisposition,"source_name_pending_review");}
assert.equal(venues.resolve("Never reviewed invented ground").reviewDisposition,"unclassified","future unknown labels still fail closed");
assert(audit.pending.every(name=>[...allowedPending,...sourceVenueLabels].includes(name)), "only explicitly queued source labels, routes and placeholders may remain unresolved");

console.log(`Source trust and venue registry valid: ${audit.total} current venues scanned; ${audit.audited} reviewed aliases, ${audit.pending.length} queued for editorial venue review.`);
