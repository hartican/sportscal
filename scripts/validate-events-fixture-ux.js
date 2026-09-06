#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
assert.doesNotThrow(() => new Function(inlineScript), "the Events and Fixtures browser script must parse");

assert(html.includes('let eventsViewTab = "major-events"'), "fresh visits must default Events to Major Events");
assert(html.includes('[["major-events", "Major Events"], ["ticket-alerts", "Tickets"]]'), "Events tabs must place Major Events before Ticket alerts");
assert(html.includes('tabs.setAttribute("role", "tablist")') && html.includes('tab.setAttribute("role", "tab")') && html.includes('panel.setAttribute("role", "tabpanel")'), "Events tabs must expose the accessible tab pattern");
assert(html.includes('eventsDeepLinkHash("major"') && html.includes('eventsDeepLinkHash("alert"') && html.includes('/^#events\\/(major|alert)\\/(.+)$/'), "Major Events and Ticket alerts must support deterministic deep links");
assert(html.includes("pendingMajorEventFocusId") && html.includes("pendingTicketAlertFocusId") && html.includes("focusTicketAlertCard"), "deep links must select and focus either card collection");
assert(/function focusMajorEventCard[\s\S]{0,900}requestAnimationFrame\(restoreTargetFocus\)[\s\S]{0,500}setTimeout/.test(html), "major-event deep links must restore focus after late Events rerenders");

assert(html.includes('card.dataset.cardState = isMinimised ? "minimised" : state') && html.includes('state === "opened" ? "is-opened"'), "Events cards must distinguish minimised identity from expanded detail");
assert(html.includes("refreshExpandableCard(eventCard,")&&html.includes("buildMajorEventCard)(record"), "Events expansion patches its stable card");
const anchoredMutationSource = html.slice(html.indexOf("function mutateWithScrollContinuity"), html.indexOf("let scrollMomentumActive"));
assert(anchoredMutationSource.includes("getBoundingClientRect().top") && anchoredMutationSource.includes("lastCorrectionAt < 40") && anchoredMutationSource.includes("window.scrollTo"), "the shared transaction must restore the selected anchor with one coalesced measured correction");
assert(/function refreshExpandableCard[\s\S]{0,700}anchorStrategy:"target"/.test(html), "user-driven expansion must anchor the card being expanded even when it becomes taller than the viewport");
assert(html.includes('card.dataset.scrollKey = `major-event:${record.id}`'), "canonical Events and Tickets share one scroll identity");
assert(html.includes('.major-event-logo{ display:grid; place-items:center; width:88px; height:90px;') && html.includes('.major-event-logo{ width:74px; height:70px;'), "Events identities must share the compact desktop and mobile fixture frames");
assert(html.includes("renderEventIdentityMark(logo, majorEventIdentityEvent(record), meta)"), "both Events card types must use the shared official identity renderer");
assert(html.includes("(primaryItem ? majorEventFixtureSnapshot(primaryItem.subEvent, record) : null) || majorEventActionEvent(record)"), "Events with TBC or follows-only starts must retain safe card actions without passing a null fixture");
assert(html.includes('level: cardLevelForState(state)') && html.includes('headingText: state === "opened" ? "Published timeline" : state === "selected" ? "Around now" : "Next match or line-up"'), "Events cards must expose one immediate matchup at L0 and expand progressively around Now");
assert(html.includes("majorEventMatchupLineup") && html.includes('"Match-up TBC"'), "Events cards must use grouped published matchups with flags or an explicit TBC state");
assert(!html.includes('aboutHeading.textContent = "Event detail"'), "the generic Event detail preamble must be removed");
assert(html.includes('className = "major-event-ticket-link event-quick-action"'), "Buy tickets must share the Remind me and provider viewing-action pill geometry");
assert(html.includes('primaryActions.className = "event-card-primary-actions"') && html.includes('tickets.innerHTML = `${glyphMarkup("ui:ticket", { preferImage: true })}<span>Buy tickets</span>`'), "regular cards must group Buy tickets with Remind and Chat");
assert(html.includes('navigationRow.className = "major-event-navigation-row"') && html.includes('major-event-timetable'), "major cards must group Follow Event, viewing and Timetable");

assert(html.includes('.matchup-team-logo-slot{ width:74px; height:70px;') && html.includes('width:min(100%, 88px);') && html.includes('height:90px;'), "fixture matchups must use the approximately 35 percent smaller logo frames");
assert(html.includes('.event-card.is-logo-led-matchup{ min-height:0;') && html.includes('.event-card.is-logo-led-matchup .event-meta-row{ gap:5px; margin-top:4px;'), "compact fixtures must remove oversized minimum heights and tighten metadata spacing");
const eventCardSource = html.slice(html.indexOf("function buildEventCard(ev"), html.indexOf("function jointTournamentIsActive"));
assert(eventCardSource.includes('displayLabel:displayTitle'), "regular fixture traffic controls must receive the renderer's spoiler-safe display title");
assert(eventCardSource.includes("buildNothingscoreSummary") && !eventCardSource.includes("buildNothingscorePanel"), "Feed cards show peer summaries; detailed results belong in the drawer");
assert(!eventCardSource.includes("follow-reason-tag") && !eventCardSource.includes("new-tag") && !eventCardSource.includes("event-meta-row") && !eventCardSource.includes("Independent context"), "Feed cards must omit meta labels and duplicate metadata rails");
assert(html.includes("buildInlineCrowdRating(ev,snapshot)"), "standard Feed cards expose one-tap ratings");
assert(!eventCardSource.includes("buildPostEventRatingPrompt"), "Feed cards must keep the separate impact rating prompt hidden behind the contribution action");
assert(!/Less of this|More of this/.test(html) && html.includes("eventIsHighStakesSuggestion"), "Feed must remove duplicate feedback controls and gate Like to suggestions");
assert(/function buildStakesMeter[\s\S]{0,1200}stakes-flame[\s\S]{0,800}STAKES/.test(html), "Stakes must use five filled or hollow white flame glyphs with the numeric label below");
const majorCardSource = html.slice(html.indexOf("function buildMajorEventCard"), html.indexOf("function buildTicketSaleCard"));
assert(!majorCardSource.includes('expand.className = "major-event-expand-control"'), "major cards must not duplicate Timetable with a chevron control");
assert(!majorCardSource.includes("buildEventFeedbackButtons"), "Events cards must not show thumbs controls");
assert(!majorCardSource.includes("buildEventNothingscoreAction")&&!html.includes("row.appendChild(buildNothingscoreSummary(crowdEvent))"), "Events excludes all rating inputs");
const cardControlSource = html.slice(html.indexOf("function buildEventCardControls"), html.indexOf("function eventMajorEventId"));
assert(majorCardSource.includes("buildEventCardControls(actionEvent") && html.includes("buildDismissedEventStub") && html.includes("compareDismissedEventRecords"), "Events cards must expose traffic-light controls with bottom-sorted Restore stubs");
const ticketCardSource = html.slice(html.indexOf("function buildTicketSaleCard"), html.indexOf("function buildMajorEventMarker"));
assert(ticketCardSource.includes("buildMajorEventCard(record"), "Tickets use the canonical event card");
assert(!ticketCardSource.includes('expand.className = "major-event-expand-control"'), "ticket alerts must not duplicate the green Expand traffic light with a chevron control");
assert(html.includes('.event-card-control.restore{') && html.includes('min-width:88px;'), "dismissed-card Restore must retain its labelled button treatment outside the traffic-light cluster");
assert(!html.includes("while (badges.firstChild) metaRow.appendChild(badges.firstChild)") && !html.includes("sessionDismissedEventIds"), "card tags must be removed while dismissal remains durable");
assert(html.includes('cardRetained: direction === "positive"') && html.includes("dismissEventCard") && html.includes("}, 1400);"), "likes must retain cards with feedback while dislikes dismiss exact editions");
assert(html.includes('"Liked — future feed suggestions will adapt."') && html.includes('"Like removed — future feed suggestions will no longer use it."') && html.includes('actionLabel:"Undo"'), "feedback must explain reversible learning and keep dismissal recoverable");

assert(cardControlSource.includes("card-dismiss")&&cardControlSource.includes("aria-label")&&!cardControlSource.includes("traffic-light"), "overlay dismiss is accessible and traffic lights are retired");
console.log("Events and fixture UX valid: accessible tabs, deep links, keyed expansion, compact identities, stable viewport and recoverable button dismissal passed.");
