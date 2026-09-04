#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const pages = ["index.html", "admin.html", "admin-comms.html", "participate.html", "privacy.html", "terms.html", "404.html"];
const stylesheet = "/assets/styles/nothingsport-foundation.css?v=230";
const html = fs.readFileSync("index.html", "utf8");
const foundation = fs.readFileSync("assets/styles/nothingsport-foundation.css", "utf8");

pages.forEach(page => {
  const source = fs.readFileSync(page, "utf8");
  assert(source.includes(`href="${stylesheet}"`), `${page} must use the shared Nothing Sport UI foundation`);
});

["--ns-accent:#ff4778", "--ns-touch-target:44px", "--ns-radius-control:12px", "--ns-radius-card:18px"].forEach(token => {
  assert(foundation.includes(token), `shared UI token ${token} must remain explicit`);
});
assert(foundation.includes("prefers-reduced-motion:reduce"), "the shared foundation must respect reduced-motion preferences");
assert(foundation.includes(".traffic-light-label") && foundation.includes(".event-card-control+.event-card-control"), "traffic-light actions must keep persistent labels and separators");

const controls = html.slice(html.indexOf("function buildEventCardControls"), html.indexOf("function eventMajorEventId"));
assert(controls.includes('visibleLabel.className = "traffic-light-label"'), "traffic controls must render visible labels rather than hover-only tooltips");
assert(controls.includes("!Boolean(getEventAction(ev).isMinimised)"), "Minimise must toggle back to the standard card");
assert(controls.includes('setCardState(viewStateEvent, opening ? "opened" : "compact")'), "Expand must toggle full detail without a second disclosure control");

const card = html.slice(html.indexOf("function buildEventCard(ev"), html.indexOf("function jointTournamentIsActive"));
assert(!card.includes("card-expand-control") && !card.includes('textContent = state === "opened" ? "Show less'), "the green Expand action must be the card's only disclosure control");
assert(card.includes('state === "opened"') && card.includes('secondaryActions.className = "event-card-secondary-actions"'), "secondary actions must appear only in the expanded card state");
assert(card.includes("buildEventWhyItMatters(ev)") && foundation.includes(".event-card:not(.is-opened) .editorial-l0-hook-copy"), "the compact card must retain its line-limited Why it matters hook");
assert(html.includes('const label = active ? "Reminder ON" : "Remind"') && html.includes("is-reminder-on"), "Reminder must change to Reminder ON with its filled-bell state");

assert(html.includes('heading.id = "calendarTodayAnchor"') && html.includes("if (todayEvents.length) appendDateGroups(todayEvents)"), "a populated Today group must use one combined date heading and anchor");
assert(html.includes('PERSONALISED_FEED_CACHE_VERSION = "server-feed.v3:first-page.v6"'), "the redesigned personalised card cache must be invalidated");

const worker = fs.readFileSync("service-worker.js", "utf8");
assert(worker.includes('nothingsport-shell-v230') && worker.includes(`"${stylesheet}"`), "the new foundation and shell must be available after installed-app cache replacement");
pages.slice(1).forEach(page => assert(worker.includes(`"/${page}"`), `${page} must bypass the generic app-shell navigation fallback`));

console.log("UI foundation valid: shared tokens, compact progressive cards, persistent traffic controls, Reminder ON and one Today heading passed.");
