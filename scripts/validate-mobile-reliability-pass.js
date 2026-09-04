#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const identities = require("../config/card-identities.js");
const vectors = require("../config/vector-assets.js");
const sportDomains = require("../config/sport-domain-registry.js");

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const incoming = JSON.parse(fs.readFileSync("feeds/incoming/events.json", "utf8"));
const published = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert(html.includes('className = "follow-context-list"'), "Following chips must render inside one dedicated horizontal rail");
assert(html.includes("overflow-x:auto") && html.includes("scrollbar-width:none"), "the Following rail must scroll horizontally without wrapping the page");

const f1Profile = sportDomains.narrativeProfiles.f1;
assert(f1Profile, "Formula One must retain a narrative profile");
assert(!f1Profile.signals.some(signal => signal.label === "Record Chase" && /qualifying|pole/.test(signal.match)), "ordinary qualifying and pole sessions must not imply a record chase");
assert(f1Profile.signals.some(signal => signal.label === "Record Chase" && /record|milestone/.test(signal.match)), "explicit record or milestone language must still support Record Chase");

const f1Mark = identities.markForEvent({ key:"f1", name:"Azerbaijan GP Qualifying" });
assert.equal(f1Mark.url, "assets/identities/f1/formula-one-red-512.png", "Formula One cards must use the supplied local red mark");
assert.equal(f1Mark.logo.icon, "assets/identities/f1/formula-one-red-256.png", "compact Formula One cards must use the smaller local derivative");
assert.match(vectors.glyphMarkup("ui:tv"), /<svg|<img/, "provider actions must retain a local TV fallback");
assert.match(vectors.glyphMarkup("semantic:nrl-finals-trophy"), /<svg|<img/, "NRL finals must have a local trophy glyph");

assert(html.includes('prefix.textContent = `${viewingLink.liveOrReplay === "replay" ? "Replay" : "Watch"} on`;'), "Feed and Events viewing actions must put the provider mark after Watch on or Replay on");
const providerMarkSource = html.match(/function buildViewingProviderMark\(viewing\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(providerMarkSource.includes('className = "provider-action-logo"') && providerMarkSource.includes("mark.appendChild(image)"), "providers with bundled marks must render the logo only");
assert(providerMarkSource.includes('fallback.textContent = viewing.actionLabel || viewing.label') && providerMarkSource.includes("mark.replaceChildren(fallback)") && !providerMarkSource.includes("mark.append(fallback, image)"), "provider text must appear only when a logo is unavailable or fails");
assert(html.includes("flex-wrap:nowrap") && html.includes('const label = active ? "Reminder ON" : "Remind"') && html.includes('chat.textContent = "Chat"'), "fixture quick actions must remain on one compact row with approved labels");
assert(html.includes('return "Submitted ✓"') && html.includes("button.disabled = submitted"), "submitted prediction controls must remain visibly sealed on mobile");
assert(fs.existsSync("assets/providers/kayo-sports-negative.svg") && fs.existsSync("assets/providers/stan-sport.jpg"), "Kayo and Stan Sport provider marks must be committed locally");
assert(worker.includes("/assets/providers/kayo-sports-negative.svg") && worker.includes("/assets/providers/stan-sport.jpg"), "provider marks must be available in the installed offline shell");
assert(html.includes('function eventMajorEventId('), "all event routing must share one major-event ID resolver");
assert(html.includes('footer.className = "event-compact-footer"'), "expanded Feed cards must use one compact action footer");
assert(/buildEventCompactFooter[\s\S]{0,2200}buildSpoilerOverrideButton[\s\S]{0,2200}View in Events/.test(html) && !/buildEventCompactFooter[\s\S]{0,2200}buildEventFeedbackButtons/.test(html), "the compact footer must keep result and Events actions concise while feedback stays beside Feed stakes");

assert(html.includes('card.dataset.cardLevel = isMinimised ? "L0" : cardLevelForState(state)'), "Events cards must expose L0, L1 and L2 levels while respecting Minimise");
assert(html.includes('level: cardLevelForState(state)') && html.includes('MAJOR_EVENTS.phaseTimeline({ ...record, subEvents:visibleMajorEventSubEvents(record) }, nowAEST()'), "Events L0/L1/L2 must show the profile-filtered bounded around-Now timeline and complete two-day L2 window");
assert(/inspect\.addEventListener\("click"[\s\S]{0,500}setCardState\(record, "opened"\)[\s\S]{0,500}focusMajorEventTimetable/.test(html), "Timetable must open the corresponding Event at L2 instead of routing by sport");
assert(html.includes('className = "code-inspector-status-stamp"'), "Finished and Time TBC must render as inline status stamps");

assert(/headers\.has\("range"\)[\s\S]{0,450}fetch\(event\.request\)/i.test(worker), "service worker byte-range requests must bypass Cache Storage");
assert(/pathname\.startsWith\("\/assets\/audio\/"\)[\s\S]{0,450}fetch\(event\.request\)/.test(worker), "audio requests must bypass the whole-file asset cache");
assert(html.includes("function repairBrokenIdentityImages") && html.includes("naturalWidth === 0"), "startup and tab renders must repair only broken identity images");
assert(html.includes("function scheduleIdentityImageRecovery"), "broken-image recovery must be scheduled without rebuilding a screen");
assert(/function scheduleIdentityImageRecovery[\s\S]{0,180}observeDeferredCardImages/.test(html), "tab renders must observe deferred identity images after their cards are connected");
assert(/loadingController\.complete\("first-viewport"\)[\s\S]{0,240}unlockDeferredCardImageLoading\(\)[\s\S]{0,240}scheduleIdentityImageRecovery/.test(html), "first-viewport completion must activate visible deferred identity images without waiting for user interaction");
assert(/typeof IntersectionObserver !== "function"[\s\S]{0,420}getBoundingClientRect\(\)[\s\S]{0,420}activateImage/.test(html), "browsers without IntersectionObserver must still activate visible deferred logos without a rerender");
const deferredImageSource = html.match(/function assignCardImageSource\(image, source\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(!deferredImageSource.includes("image.hidden = true"), "deferred identity images must remain observable behind their fixed fallback frame");
assert(!/\.toast\.show\{[\s\S]{0,120}translate/i.test(html), "toast visibility must not animate its geometry");

for (const payload of [incoming, published]){
  const copy = (payload.events || []).flatMap(event => [event.fullSpiel, event.storyline?.synopsisSpoilerOff, event.storyline?.synopsisSpoilerOn]).filter(Boolean).join("\n");
  assert.doesNotMatch(copy, /belongs in the calendar because/i, "generated Feed copy must not expose internal inclusion justification");
  assert.doesNotMatch(copy, /Exact matchup, venue and kickoff will be refreshed when the finals bracket is confirmed\./, "explicit uncertainty notes belong in editorial standards, not card copy");
}

console.log("Mobile reliability pass valid: compact Feed and Events controls, local routing, stable viewport surfaces, range-safe audio, and targeted identity recovery passed.");
