#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const feed = require("../config/personalised-feed");
const controls = require("../config/feed-controls");

const fixtures = [
  { id:"late", startTimeUtc:"2026-08-24T12:00:00Z", stakesScore:5, firstSurfacedAt:"2026-08-24T00:00:00Z" },
  { id:"early", startTimeUtc:"2026-08-24T08:00:00Z", stakesScore:1, firstSurfacedAt:"2026-08-23T00:00:00Z" },
  { id:"middle", startTimeUtc:"2026-08-24T10:00:00Z", stakesScore:3, surfacePinnedUntil:"2027-01-01T00:00:00Z" },
];
for (const mutation of [
  events => events,
  events => events.map((event, index) => ({ ...event, isNew:index === 0 })),
  events => events.map((event, index) => ({ ...event, editorialLabel:index === 2 ? "Title decider" : "Top pick" })),
  events => [...events.slice(1), events[0]],
]){
  assert.deepEqual(feed.sortChronological(mutation(fixtures)).map(event => event.id), ["early", "middle", "late"], "freshness, tags, pagination and input order must never change chronology");
}
assert.equal(controls.normalize({ stakes:"must_watch" }).stakes, "top_picks", "legacy stakes choices must migrate without retaining the removed feature");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /function compareSurfacedEvents\(first, second\)\{[\s\S]{0,220}compareChronological/, "all Fixtures views must delegate to the canonical comparator");
assert.doesNotMatch(html, /appendManualMustWatchQueue|setMustWatch\(|Add to Must Watch|Remove from Must Watch/, "the Must Watch queue and controls must not remain active");
assert(!html.includes('label.className = "new-tag"') && html.includes("seenThreshold: 0.6") && html.includes("seenDelayMs: 800"), "seen-state learning must retain the durable 60%-for-800ms lifecycle without exposing a New label");
const markerSource = html.slice(html.indexOf("function buildTournamentMarker(event){"), html.indexOf("function buildEuropeanDetail("));
const majorMarkerSource = html.slice(html.indexOf("function buildMajorEventMarker(event){"), html.indexOf("function compareDismissedEventRecords("));
const element = tag => ({tagName:tag.toUpperCase(),dataset:{},children:[],classList:{add(){}},append(...children){this.children.push(...children);}});
const routes = [];
const markerContext = {
  document:{createElement:element},
  NOTHINGSPORTS_AUSTRALIAN_DATES:{date:value=>value},
  buildEventEditionToggle:()=>element("button"),
  buildEventCardControls:()=>element("div"),
  openMajorEventInEvents:(id, options)=>routes.push({id,tournament:options.tournament}),
};
vm.createContext(markerContext);
vm.runInContext(markerSource + "\n" + majorMarkerSource, markerContext);
for (const major of [true, false]){
  const event = {id:major ? "major-event:reviewed" : "tournament:reviewed",name:"Reviewed event",date:"2026-10-01",endDate:"2026-10-03",majorEventMarker:major};
  event.majorEventId = major ? event.id : null;
  const card = major ? markerContext.buildMajorEventMarker(event) : markerContext.buildTournamentMarker(event);
  const open = card.children[2].children.find(child=>child.textContent==="Open in Events");
  assert(open && open.tagName === "BUTTON" && open.type === "button", "major event and tournament markers must expose a native keyboard button into Events");
  open.onclick({stopPropagation(){}});
  assert.deepEqual(routes.at(-1), {id:event.id,tournament:!major}, "the marker must open its exact event with the appropriate route");
}
assert(html.includes('footer.className = "event-compact-footer"') && html.includes('openEvents.textContent = "View in Events"'), "linked fixture cards must expose the optional compact expanded-footer Events action");
assert(!html.includes("pruneUnavailableFootballFollows"), "directory membership changes must preserve explicit player follows");
assert.match(html, /--fixture-card-collapsed-height:248px[\s\S]{0,500}\.cards-grid > \.event-card\[data-card-state="compact"\][\s\S]{0,500}height:var\(--fixture-card-collapsed-height\)/, "all collapsed fixture variants must share one outer height");
assert(!fs.existsSync("data/football/fixtures/a-league-men.json") && !fs.existsSync("data/football/fixtures/a-league-men.js"), "A-League fixture bundles must be removed from active data");
const football = JSON.parse(fs.readFileSync("data/canonical/football-directory.v1.json", "utf8"));
assert.equal(football.leagues.length, 5);
assert(!football.leagues.some(league => league.id === "competition:a-leagues" || league.key === "a-league-men"));

console.log("Fixtures contract valid: canonical chronology, equal L0 geometry, invisible seen-state lifecycle, Events links and five-league catalogue passed.");
