#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
assert.doesNotThrow(() => new Function(inlineScript), "the Events and Fixtures browser script must parse");

assert(html.includes('let eventsViewTab = "major-events"'), "fresh visits must default Events to Major Events");
assert(html.includes('[["major-events", "Major Events"], ["ticket-alerts", "Ticket alerts"]]'), "Events tabs must place Major Events before Ticket alerts");
assert(html.includes('tabs.setAttribute("role", "tablist")') && html.includes('tab.setAttribute("role", "tab")') && html.includes('panel.setAttribute("role", "tabpanel")'), "Events tabs must expose the accessible tab pattern");
assert(html.includes('eventsDeepLinkHash("major"') && html.includes('eventsDeepLinkHash("alert"') && html.includes('/^#events\\/(major|alert)\\/(.+)$/'), "Major Events and Ticket alerts must support deterministic deep links");
assert(html.includes("pendingMajorEventFocusId") && html.includes("pendingTicketAlertFocusId") && html.includes("focusTicketAlertCard"), "deep links must select and focus either card collection");
assert(/function focusMajorEventCard[\s\S]{0,900}requestAnimationFrame\(restoreTargetFocus\)[\s\S]{0,500}setTimeout/.test(html), "major-event deep links must restore focus after late Events rerenders");

assert(html.includes('card.dataset.cardState = state') && html.includes('state === "selected" ? "is-selected"') && html.includes('state === "opened" ? "is-opened"'), "both Events card types must expose compact, selected and opened states");
assert(html.includes("replaceCardPreservingViewport(card, buildMajorEventCard(record)") && html.includes("replaceCardPreservingViewport(card, buildTicketSaleCard(record)"), "Events card interactions must replace only the keyed card");
assert(/function replaceCardPreservingViewport[\s\S]{0,1200}getBoundingClientRect\(\)\.top[\s\S]{0,500}window\.scrollTo/.test(html), "keyed card replacement must restore the tapped card's viewport top");
assert(html.includes('.major-event-logo{ display:grid; place-items:center; width:88px; height:90px;') && html.includes('.major-event-logo{ width:74px; height:70px;'), "Events identities must share the compact desktop and mobile fixture frames");
assert(html.includes("renderEventIdentityMark(logo, majorEventIdentityEvent(record), meta)"), "both Events card types must use the shared official identity renderer");
assert(html.includes('headingText: state === "opened" ? "Published timetable" : "Next matches and line-ups"'), "Events cards must expose the immediate timetable above the fold");
assert(html.includes('lineup.textContent = lineupNames.length >= 2') && html.includes('"Line-up TBC"'), "Events cards must use published line-ups or an explicit TBC state");
assert(!html.includes('aboutHeading.textContent = "Event detail"'), "the generic Event detail preamble must be removed");
assert(html.includes('className = "major-event-ticket-link event-quick-action"'), "Buy tickets must share the Remind me and View pill geometry");

assert(html.includes('.matchup-team-logo-slot{ width:74px; height:70px;') && html.includes('width:min(100%, 88px);') && html.includes('height:90px;'), "fixture matchups must use the approximately 35 percent smaller logo frames");
assert(html.includes('.event-card.is-logo-led-matchup{ min-height:0;') && html.includes('.event-card.is-logo-led-matchup .event-meta-row{ gap:5px; margin-top:4px;'), "compact fixtures must remove oversized minimum heights and tighten metadata spacing");
assert(html.includes("metaRow.appendChild(expectedBlock)") && html.includes("while (badges.firstChild) metaRow.appendChild(badges.firstChild)") && !html.includes("sessionDismissedEventIds"), "stakes, tags and status must share the metadata rail while swipes retain the visible list");
assert(html.includes("cardRetained: true") && html.includes("}, 1400);"), "swipes must retain cards and show their feedback for 1.4 seconds");
assert(html.includes('copy.textContent = `${direction === "positive" ? "Liked" : "Not for me"} — future feed suggestions will adapt.`'), "both swipe directions must explain that future suggestions will adapt");

console.log("Events and fixture UX valid: accessible tabs, deep links, keyed expansion, compact identities, stable viewport and retained-card swipe feedback passed.");
