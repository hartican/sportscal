#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const results = require("../config/card-results.js");
const ticketing = require("../config/ticketing.js");
const venues = require("../config/venue-registry.js");

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const userStateSchema = JSON.parse(fs.readFileSync("schemas/user-state.schema.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(results.scoreLine({ homeScore: 30, awayScore: 34 }, "Raiders v Broncos", {}), "30-34");
assert.equal(results.scoreLine({ name: "Raiders v Broncos" }, "Raiders v Broncos", { score: "v — 30-34" }), "30-34");
assert.equal(results.scoreLine({ scoreDisplay: "21-18" }, "Raiders v Broncos", { score: "Raiders v Broncos — 21-18" }), "21-18");
const raidersBroncos = feed.events.find(event => event.id === "nrl-raiders-broncos-2026-08-21");
assert(raidersBroncos, "the 21 August Raiders v Broncos regression fixture must remain published");
assert.equal(results.scoreLine(raidersBroncos, raidersBroncos.displayTitleCompact, { score: raidersBroncos.score }), "30-34");
assert.equal(venues.resolve("GIO Stadium").displayName, "Bruce stadium");
assert.equal(venues.resolve("Canberra Stadium").displayName, "Bruce stadium");
assert.equal(venues.resolve("Bruce Stadium").id, "gio-stadium");

const verifiedFixture = {
  venue: "Bruce stadium",
  ticketing: {
    provider: "Ticketmaster",
    status: "on_sale",
    url: "https://www.ticketmaster.com.au/direct-event/event/123",
    verifiedAt: "2026-08-23T00:00:00.000Z",
  },
};
assert.equal(ticketing.resolve(verifiedFixture, { surface: "fixture", localVenueMatched: false, reference: new Date("2026-08-23T12:00:00Z") }), null, "ordinary away fixtures must not show ticket links");
assert.equal(ticketing.resolve(verifiedFixture, { surface: "fixture", localVenueMatched: true, reference: new Date("2026-08-23T12:00:00Z") }).provider, "Ticketmaster", "ordinary local fixtures may use an exact verified endpoint");
assert.equal(ticketing.resolve({ ...verifiedFixture, majorEventId: "major:test" }, { surface: "fixture", localVenueMatched: false, reference: new Date("2026-08-23T12:00:00Z") }).provider, "Ticketmaster", "selected major-event matches may bypass local venue gating");
assert.equal(ticketing.resolve(verifiedFixture, { surface: "events", localVenueMatched: false, reference: new Date("2026-08-23T12:00:00Z") }).provider, "Ticketmaster", "Events ticket links do not depend on local venues");
assert.equal(ticketing.verifiedSellerUrl("https://www.ticketmaster.com.au/"), false, "seller homepages are not ticket endpoints");
assert.equal(ticketing.verifiedSellerUrl("https://www.ticketmaster.com.au/search?q=nrl"), false, "seller search pages are not ticket endpoints");
assert.equal(ticketing.verifiedSellerUrl("https://www.nrl.com/tickets"), false, "governing-body websites are not ticket endpoints");
assert.equal(ticketing.resolve({ ...verifiedFixture, ticketing: { ...verifiedFixture.ticketing, verifiedAt: "2026-08-24T00:00:00.000Z" } }, { surface: "events", reference: new Date("2026-08-23T12:00:00Z") }), null, "future-dated seller verification must fail closed");
assert.equal(ticketing.resolve({ eventId: "event-nrl-129992601" }, { surface: "fixture", localVenueMatched: false, reference: new Date("2026-08-24T00:00:00Z") }), null, "verified ordinary fixture endpoints remain local-venue gated");
assert.equal(ticketing.resolve({ eventId: "event-nrl-129992601" }, { surface: "fixture", localVenueMatched: true, reference: new Date("2026-08-24T00:00:00Z") }).provider, "Ticketek", "verified local fixtures must retain direct seller CTAs");
assert(html.includes("ev.venueSourceName") && html.includes("ev.venueOfficialName") && html.includes("option?.label"), "local-venue matching must survive canonical display-name normalisation");

assert(html.includes('className = soloIdentity ? "event-hero-mark" : "event-icon"'), "non-matchup cards must use the centred logo-led treatment");
assert(html.includes("width:min(100%, 133.2px)") && html.includes("138.6px"), "desktop large identities must be exactly 10% smaller than 148x154");
assert(html.includes("width:113.4px") && html.includes("height:106.2px"), "mobile large identities must be exactly 10% smaller than 126x118");
assert(html.includes(".event-card.is-logo-led-event .event-top-row{ display:block; position:relative; }") && html.includes("margin:0 auto 28px"), "single-logo cards must centre their full text stack and reserve safe clearance below square logos");
assert(html.includes(".major-event-logo{ display:grid; place-items:center; width:133.2px; height:99px; margin:0 auto 28px; padding:6px; }") && html.includes(".major-event-logo{ width:113.4px; height:89px; margin-bottom:24px; }") && html.includes(".event-hero-mark{ width:113.4px; height:89px; margin-bottom:24px; padding:5px; }"), "Fixtures and Events must reserve matched desktop and mobile clearance below square tournament logos");
assert(html.includes(".event-card.is-logo-led-event .event-name-line .card-expand-control") && html.includes("position:absolute;\n  right:0;"), "single-logo titles must stay centred independently of their expand control");
assert(html.includes("-webkit-line-clamp:2") && html.includes("white-space:normal"), "long names must wrap to two lines");
assert(html.includes('return cardViewStates[ev.eventId || ev.id] || "compact";'), "the three-level card state must support both fixture and major-event IDs");
assert(html.includes('state === "selected" ? "is-selected"') && html.includes('state === "opened" ? "is-opened"') && html.includes("setCardState(record, nextCardState(state))"), "full Events cards must cycle through compact, summary and full-detail levels");
assert(html.includes('if (state !== "compact") identity.appendChild(summary);') && html.includes('if (state === "opened"){'), "compact Events cards must defer rich details until the second and third levels");
assert(html.includes("--ticket-action-bg: #00677b") && html.includes("--ticket-action-text: #ffffff") && html.includes("background:var(--ticket-action-bg); color:var(--ticket-action-text)"), "day-mode Events ticket actions must use the high-contrast action palette");
assert(html.includes("--events-text-accent: #006f85") && html.includes("color:var(--events-text-accent)"), "day-mode Events editorial links must use the dedicated high-contrast text accent");
assert(html.indexOf('${selectionActionsMarkup("sports-global", "Sports")}') < html.indexOf('id="selectorCategoryList"'), "Select all and Deselect all must precede startup sport categories");
assert(html.includes('bindSelectionActions(\n    body,\n    "sports-global"'), "global sports actions must retain keyboard-native buttons and labelled controls");
assert.equal(userStateSchema.$defs.eventAction.properties.addedToFixtures.type, "boolean");
assert.deepEqual(userStateSchema.$defs.eventAction.properties.addedToFixturesAt.type, ["string", "null"]);
assert(userStateSchema.$defs.eventAction.properties.addedFixture.anyOf.some(branch => branch.required?.includes("startTimeUtc")), "persisted child fixtures must require a confirmed UTC start");
assert(worker.includes('"/config/card-results.js"') && worker.includes('"/config/ticketing.js"'), "score and ticket policy must work offline");
assert(html.includes('name="app-shell-version" content="121"') && worker.includes('nothingsport-shell-v121'), "the polished card UI must ship in a matching offline shell version");

console.log("Card polish valid: three-level cards, centred logo layouts, WCAG ticket contrast, score-only results, Bruce stadium aliases, exact 10% identity reduction, two-line names, top selection controls and surface-aware ticket gating passed.");
