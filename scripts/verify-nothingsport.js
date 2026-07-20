#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { classifyCalendarEvent, classifyCommonwealthDiscipline } = require("./import-calendar-events");
const profileStorage = require("../config/profile-storage.js");
const brand = require("../config/brand-copy.js");
const preferenceSystem = require("../config/preference-system.js");
const { createCanonicalSportsIndex } = require("./lib/canonical-sports");

const html = fs.readFileSync("index.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const broadcastConfigSource = fs.readFileSync("config/au-broadcast-weights.js", "utf8");
const selectorTaxonomySource = fs.readFileSync("config/selector-taxonomy.js", "utf8");
const canonicalTaxonomySource = fs.readFileSync("config/canonical-sports-taxonomy.js", "utf8");
const vectorAssetsSource = fs.readFileSync("config/vector-assets.js", "utf8");
const sportDomainRegistrySource = fs.readFileSync("config/sport-domain-registry.js", "utf8");
const profileStorageSource = fs.readFileSync("config/profile-storage.js", "utf8");
const preferenceSystemSource = fs.readFileSync("config/preference-system.js", "utf8");
const enrichmentEngineSource = fs.readFileSync("config/enrichment-engine.js", "utf8");
const cardLifecycleSource = fs.readFileSync("config/card-lifecycle.js", "utf8");
const reminderEngineSource = fs.readFileSync("config/reminder-engine.js", "utf8");
const soundtrackSource = fs.readFileSync("config/soundtrack.js", "utf8");
const cwgBundleSource = fs.readFileSync("data/cwg-events.js", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, "index.html must contain an inline app script");
assert.doesNotThrow(() => new Function(scriptMatch[1]), "the full inline app script must parse");

const tabOrder = Array.from(html.matchAll(/class="tab-btn(?: active)?" data-tab="([^"]+)"/g), match => match[1]);
assert.deepEqual(tabOrder, ["calendar", "nevermiss", "watchlater", "archived"], "primary tabs must match the nothingSports contract");
assert(html.includes("<title>nothingSports</title>"), "the document title must use the nothingSports brand");
assert(html.includes(brand.hero), "the canonical nothingSports hero line must be present");
assert(html.includes(brand.about), "the canonical nothingSports About paragraph must be present verbatim");
assert.equal(manifest.description, brand.metadataDescription, "manifest copy must follow the brand source of truth");
assert(html.includes(`content="${brand.metadataDescription}"`), "page metadata must follow the brand source of truth");
assert(!/right live games/i.test(html), "superseded right-live-games copy must be removed");
assert(!brand.about.includes("Sydney"), "core product copy must not be city-bound");
assert(brand.about.includes("AEST/AEDT by default"), "core product copy must describe its default timezone basis");
const brandAssets = [
  "assets/brand/web/nothingsport-logo-day.png",
  "assets/brand/web/nothingsport-logo-night.png",
  "assets/brand/web/nothingsport-compact-icon-day.png",
  "assets/brand/web/nothingsport-compact-icon-night.png",
  "icons/nothingsport-helm-32.png",
  "icons/nothingsport-helm-180.png",
  "icons/nothingsport-helm-192.png",
  "icons/nothingsport-helm-512.png",
];
brandAssets.forEach(asset => assert(fs.existsSync(asset), `brand asset must exist: ${asset}`));
assert(html.includes('data-brand-asset="logo"'), "the full centurion logo must replace the legacy text-and-colosseum lockup");
assert(html.includes('data-brand-asset="icon"'), "the compact centurion icon must appear in constrained app UI");
assert(html.includes("syncThemeBrandAssets(useDark)"), "brand assets must follow the existing day, night, and system theme selection");
assert(!html.includes('class="brand-colosseum"'), "the legacy colosseum placeholder must be removed");
assert.deepEqual(manifest.icons.map(icon => icon.src), ["/icons/nothingsport-helm-192.png", "/icons/nothingsport-helm-512.png"], "the install manifest must use the standalone centurion helm");
assert(!html.includes("Weekly Briefing"), "Weekly Briefing must not exist");
assert(!html.includes("data-tab=\"catchup\""), "Catch-up must be replaced by Watch Later");
assert(html.includes("ns_event_user_state_v1"), "versioned event user state must be persisted separately");
assert(html.includes("ns_event_spoiler_state_v1"), "spoiler state must be persisted separately from event user state");
assert(html.includes("ns_surface_presentation_v1"), "new and seen presentation state must be persisted separately from canonical events");
assert(html.includes('src="config/au-broadcast-weights.js"'), "the product-owned Australian broadcast config must load in hosted and direct-file modes");
assert(html.includes('src="config/selector-taxonomy.js"'), "the selector taxonomy must load as a separate preference layer in hosted and direct-file modes");
assert(html.includes('src="config/canonical-sports-taxonomy.js"'), "the canonical sports taxonomy must load as a separate versioned layer");
assert(html.includes('src="config/brand-copy.js"'), "canonical brand copy must load before the app script");
assert(html.includes('src="config/vector-assets.js"'), "the licensed vector asset registry must load before app rendering");
assert(html.includes('src="config/sport-domain-registry.js"'), "surfaced sports must derive from a configuration registry");
assert(html.includes('src="config/profile-storage.js"'), "profile-scoped storage and migrations must load before app state");
assert(html.includes('src="config/preference-system.js"'), "the reusable preference graph must load before app state");
assert(html.includes('src="config/enrichment-engine.js"'), "the disposable enrichment engine must load before app state");
assert(html.includes('src="config/card-lifecycle.js"'), "the 14-day derived-card lifecycle must load before app state");
assert(html.includes('src="config/reminder-engine.js"'), "the deterministic reminder scheduler must load before app state");
assert(html.includes('src="config/soundtrack.js"'), "the opt-in procedural soundtrack controller must load before app state");
assert(html.includes("eventEnrichment(ev).mustWatchScore"), "must-watch decisions must use the derived explainable score");
assert(html.includes('`variant-${enrichment.cardVariant}`'), "cards must receive their derived plain, compact, standard, or marquee variant");
assert(html.includes("Why it ranked ·"), "opened cards must explain their ranking score");
assert(html.includes('id="rebuildFeedCacheBtn"'), "settings must expose a safe cache rebuild from canonical events");
assert(html.includes('id="browserAlertsEnabled"'), "browser reminders must require an explicit settings toggle");
assert(html.includes('id="soundtrackEnabled"'), "background audio must require an explicit settings toggle");
assert(html.includes("Off by default"), "soundtrack copy must state the quiet default");
assert(!/Miley Cyrus/i.test(html), "commercial-artist soundtrack options must not ship");
assert(!html.includes('join(" vs ")'), "fixture formatters must never emit the superseded vs separator");
assert(html.includes('PROFILE_STORAGE.saveSection(localStorage, activeProfileBundle'), "settings writes must target the stable profile id bundle");
assert.deepEqual(preferenceSystem.templates.map(template => template.slug), ["froth", "like", "casual", "custom"], "every selected domain must share the four canonical templates");
assert(html.includes('id="refineFiltersBtn"'), "the feed must expose an obvious Refine filters entry point");
assert(html.includes('id="quickAddModal"'), "new sports must offer Quick add versus Customise without rerunning onboarding");
assert(html.includes('const ONBOARDING_SECTIONS = ["sports", "templates", "coverage", "viewing"]'), "first login must use the short four-step wizard");
assert(html.includes("data-domain-template"), "templates must be applied per selected domain");
assert(html.includes("data-competition-ladder"), "competition-level ladder overrides must be editable");
assert(html.includes("data-entity-follow"), "entity follow levels must be editable from canonical participants");
assert(html.includes('id="viewingStartHour"') && html.includes('id="viewingEndHour"'), "viewing time windows must be optional settings");
assert(html.includes("Every available provider starts selected"), "provider selection must be opt-out");
assert(html.includes('src="data/cwg-events.js"'), "direct-file mode must load the published Commonwealth Games fallback bundle");
assert(html.includes("withBundledCommonwealthGames(loadCachedFeedEvents() || EVENTS)"), "a stale local feed cache must receive new Commonwealth Games cards without duplicating ids");
assert(html.includes("--color-contrast:"), "every theme must expose a contrast token for the new-item marker");
assert(html.includes("className = \"new-dot\""), "new cards must render the compact contrast-colour dot");
assert(html.includes('id="homeSpoilerToggle"'), "the global spoiler toggle must be visible in the sticky home-screen header");
assert(html.includes("setGlobalSpoilerPreference(!userPreferences.showSpoilers"), "the home-screen spoiler toggle must update the global preference immediately");
assert(html.includes('>Show Results</span>'), "the home-screen control must invite users to show results when they are hidden");
assert(html.includes('shown ? "Hide Results" : "Show Results"'), "the home-screen control must switch between Show Results and Hide Results");
assert(!html.includes("id=\"globalSpoilerSwitch\""), "Settings must not duplicate the global result-visibility control");
assert(html.includes('"Local venues", `${draftPreferences.localVenueIds.length} local venue'), "Settings must retain a Local venues entry after removing the result control");
assert(html.includes('id="settingsModal"'), "Settings must use a dedicated main screen");
assert(html.includes('data-settings-section="${section}"'), "Settings must expose exitable submenus from its main screen");
assert(html.includes('id="sportsChoiceGrid"'), "Settings must restore the sports selector");
assert(html.includes('draftPreferences.selectedSelectorEntityIds = []'), "first-time setup must start with every selector entity deselected");
assert(html.includes('id="selectorCategoryList"'), "Settings must expose top-level selector categories");
assert(html.includes('id="commonwealthFilterList"'), "Commonwealth Games must expose its discipline filters");
assert(html.includes('id="selectorOptInModal"'), "new selector entities must use one consolidated opt-in prompt");
assert.equal((html.match(/id="selectorOptInModal"/g) || []).length, 1, "new selector entities must not stack multiple prompts");
assert(html.includes('selectorNewMarkerMarkup(entity)'), "new selector entities must reuse the contrast-colour dot treatment");
assert(html.includes('setTimeout(openSelectorOptInPrompt, 250)'), "existing profiles must receive the batched opt-in prompt on the next app open");
assert(html.includes('["day", "night", "system"]'), "Settings must support Day, Night, and System themes");
assert(!html.includes('id="suggestBtn"') && !html.includes('id="feedbackModal"'), "Feedback must live inside Settings rather than a separate header action or modal");
assert(html.includes('class="filing-cabinet-icon"') && !html.includes("🗄️"), "Archived must use a traced filing cabinet glyph rather than emoji");
assert(html.includes('selectionActionsMarkup("sports"') && html.includes('selectionActionsMarkup("providers"') && html.includes('selectionActionsMarkup("venues"'), "every setup multi-select must expose Select all and Deselect all controls");
assert(html.includes("maximum-scale=1.0, user-scalable=no"), "the app viewport must suppress pinch zoom");
assert(html.includes('document.addEventListener("gesturestart"'), "native-app gesture handling must suppress Safari pinch gestures");
assert(html.includes('id="jumpTodayBtn"'), "Calendar must expose a floating Jump to Today control");
assert(html.includes('anchor.id = "calendarTodayAnchor"'), "Calendar must render a Today timeline anchor");
assert(html.includes("scheduleInitialCalendarJump()"), "Calendar must default the viewport to Today");
assert(html.includes('anchor.id = "neverMissTodayAnchor"'), "Never Miss must render a Today timeline anchor");
assert(html.includes("scheduleInitialNeverMissJump()"), "Never Miss must default the viewport to Today");
assert(html.includes('activeTab !== "calendar" && activeTab !== "nevermiss"'), "Jump to Today must remain available on Calendar and Never Miss");
assert(html.includes('className = `date-group${dateStr < todayStr ? " is-past-date" : ""}`'), "past date groups must receive subdued styling");
assert(html.includes('window.addEventListener("scroll"'), "expanded cards must respond to viewport scrolling");
assert(html.includes('card.dataset.eventId = ev.eventId || ev.id'), "expanded cards must expose their event identity for viewport retraction");
assert(html.includes("restoreViewportRetractionAnchor(retractionAnchor)"), "above-viewport card retraction must preserve the visible feed position");
assert(html.includes('const compactResult = buildCompactResult(ev)'), "compact cards must render revealed result summaries");
assert(html.includes('if (state !== "opened")'), "compact results must hand off to full result detail at the opened level");
assert(html.includes("LOCAL GAME"), "cards must support the LOCAL GAME tag");
assert(html.includes('glyphMarkup("ui:ticket")'), "local games must expose a vector-labelled Tickets link");
const eventCardSource = html.match(/function buildEventCard\(ev, options = \{\}\)\{[\s\S]*?\n  return card;\n\}/)?.[0] || "";
assert.equal((eventCardSource.match(/buildSpoilerOverrideControl\(ev\)/g) || []).length, 2, "selected and opened card states must each render one spoiler control");
assert(!/textContent\s*=\s*["']NEW["']/.test(eventCardSource), "the freshness treatment must not add a NEW text badge");
assert(html.includes('function spoilerOutcomeCopy(outcome)'), "empty or structured outcome data must not break revealed PAST cards");
assert(html.includes('id="exportSectionChoices"'), "Never Miss export must expose section choices");
assert(html.includes('id="feedbackForm"'), "Feedback must use a structured SMS form");
assert(html.includes("Add a competition") && html.includes("Feature request"), "Feedback must expose the standard categories");
assert(html.includes("0437 041 326"), "Feedback UI must identify the configured SMS recipient");
assert(html.includes("b.textContent = \"Coming Up\""), "future cards must use the Coming Up status tag");
assert(html.includes("b.textContent = \"PAST\""), "completed cards must use the PAST status tag");
const spoilerControlSource = html.match(/function buildSpoilerOverrideControl\(ev\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(spoilerControlSource, "an individual spoiler control must exist");
assert(!/getEventStatus\(ev\)\s*!==\s*["']past["']/.test(spoilerControlSource), "individual spoiler controls must not be limited to past events");

const publishedFeed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const incomingFeed = JSON.parse(fs.readFileSync("feeds/incoming/events.json", "utf8"));
const eventFeedSchema = JSON.parse(fs.readFileSync("schemas/event-feed.schema.json", "utf8"));
const calendarEventSchema = JSON.parse(fs.readFileSync("schemas/calendar-events.schema.json", "utf8"));
const canonicalSportsSchema = JSON.parse(fs.readFileSync("schemas/canonical-sports.schema.json", "utf8"));
const profileStorageSchema = JSON.parse(fs.readFileSync("schemas/profile-storage.schema.json", "utf8"));
const enrichedEventSchema = JSON.parse(fs.readFileSync("schemas/enriched-event.schema.json", "utf8"));
const canonicalSports = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
assert.equal(canonicalSportsSchema.properties.schemaVersion.const, "canonical-sports.v1", "canonical sports schema must be explicitly versioned");
assert.equal(profileStorageSchema.properties.schemaVersion.const, 2, "profile storage schema must be explicitly versioned");
assert.equal(enrichedEventSchema.properties.schemaVersion.const, "enriched-event.v1", "enrichment must use an explicitly versioned disposable schema");
const canonicalIndex = createCanonicalSportsIndex(canonicalSports);
assert.equal(canonicalIndex.getFixtures({ competitionId: "competition:afl-premiership-2026" }).length, 207, "canonical store must contain the complete 2026 AFL fixture");
assert.equal(canonicalIndex.getFixtures({ competitionId: "competition:nrl-premiership-2026" }).length, 204, "canonical store must contain the complete 2026 NRL fixture");
assert.equal(canonicalIndex.getLatestLadder("competition:afl-premiership-2026").entries.length, 18, "AFL ladder must be queryable by competition");
assert.equal(canonicalIndex.getLatestLadder("competition:nrl-premiership-2026").entries.length, 17, "NRL ladder must be queryable by competition");
assert(eventFeedSchema.$defs.event.properties.key.enum.includes("cwg"), "published feeds must accept Commonwealth Games canonical events");
assert(calendarEventSchema.$defs.sportKey.enum.includes("cwg"), "calendar imports must accept Commonwealth Games canonical events");
assert.equal(classifyCalendarEvent({ title: "Commonwealth Games Rugby Sevens Final" }).key, "cwg", "Commonwealth Games tagging must win before its underlying sport classification");
assert.equal(classifyCommonwealthDiscipline("Commonwealth Games Rugby Sevens Final"), "rugby-sevens", "Commonwealth discipline mapping must be deterministic");
assert.equal(classifyCommonwealthDiscipline("Commonwealth Games Badminton Final"), "miscellaneous", "unlisted Commonwealth disciplines must map to Miscellaneous");
assert.equal(new Set(publishedFeed.events.map(event => event.id)).size, publishedFeed.events.length, "selector views must not require duplicated canonical events");
const incomingCwgCards = incomingFeed.events.filter(event => event.key === "cwg");
const publishedCwgCards = publishedFeed.events.filter(event => event.key === "cwg");
assert.equal(incomingCwgCards.length, 32, "incoming feed must contain the curated Glasgow 2026 Commonwealth Games card set");
assert.equal(publishedCwgCards.length, 32, "published feed must contain the curated Glasgow 2026 Commonwealth Games card set");
assert.deepEqual(
  publishedCwgCards.map(event => event.id).sort(),
  incomingCwgCards.map(event => event.id).sort(),
  "every incoming Commonwealth Games card must publish with the same canonical id"
);
assert(publishedCwgCards.every(event => event.status === "upcoming" && event.storyline?.arcStage === "preview"), "Commonwealth Games cards must remain pre-event and spoiler-safe");
assert(publishedCwgCards.every(event => event.expected >= 5), "Commonwealth Games cards must clear the feed's hard relevance floor");
assert(publishedCwgCards.every(event => ["final", "semifinal"].includes(event.round) || /Australia|world number one/i.test(`${event.name} ${event.selectedSentence}`)), "every surfaced Commonwealth Games card must be a final/semifinal or carry explicit Australian/top-contender relevance");
assert(!publishedCwgCards.some(event => /Rugby Sevens|Cricket|Hockey/i.test(event.commonwealthDiscipline)), "the Glasgow 2026 feed must not fabricate cards for sports outside the official programme");
const expectedCwgProgrammeDisciplines = [
  "3x3 Basketball",
  "Artistic Gymnastics",
  "Athletics",
  "Bowls and Para Bowls",
  "Boxing",
  "Judo",
  "Netball",
  "Para Powerlifting",
  "Swimming and Para Swimming",
  "Track Cycling and Para Track Cycling",
  "Weightlifting",
];
expectedCwgProgrammeDisciplines.forEach(discipline => {
  assert(publishedCwgCards.some(event => event.commonwealthDiscipline === discipline), `Commonwealth Games feed must cover ${discipline}`);
});
const cwgBundleSandbox = { globalThis: {} };
vm.runInNewContext(cwgBundleSource, cwgBundleSandbox, { filename: "data/cwg-events.js" });
const bundledCwgCards = cwgBundleSandbox.globalThis.NOTHINGSPORTS_CWG_EVENTS;
assert.equal(bundledCwgCards.length, 32, "direct-file fallback must contain every published Commonwealth Games card");
assert.deepEqual(
  Array.from(bundledCwgCards, event => event.id).sort(),
  publishedCwgCards.map(event => event.id).sort(),
  "direct-file fallback must mirror the canonical published Commonwealth Games ids"
);
assert(!JSON.stringify(publishedFeed).includes("Preserved from the existing nothingSports card set until a newer source supersedes it."), "published cards must not contain legacy placeholder copy");
publishedFeed.events.forEach(event => {
  [event.name, event.displayTitleCompact, event.spoilerSafeTitle].filter(Boolean).forEach(title => {
    assert.doesNotMatch(title, /\s(?:vs\.?|versus)\s/i, `published fixture title must use v: ${event.id}`);
  });
});
const fifaCards = publishedFeed.events.filter(event => event.key === "fifa");
assert.equal(fifaCards.length, 20, "published feed must contain all Australia matches and every Round-of-16-onward FIFA card");
assert(!fifaCards.some(event => /if advanced/i.test(event.name)), "stale conditional FIFA placeholders must be removed");
assert.equal(fifaCards.filter(event => /australia/i.test(event.name)).length, 4, "all four Australia World Cup matches must be present");
assert.equal(fifaCards.filter(event => event.id.startsWith("fifa-r16-")).length, 8, "all eight Round of 16 matches must be present");
const semifinalOne = fifaCards.find(event => event.id === "fifa-sf-1-2026");
const semifinalTwo = fifaCards.find(event => event.id === "fifa-sf-2-2026");
assert.deepEqual(semifinalOne.matchupParticipants.map(participant => participant.name), ["France", "Spain"]);
assert.deepEqual(semifinalTwo.matchupParticipants.map(participant => participant.name), ["England", "Argentina"]);
assert.equal(semifinalOne.displayTitleCompact, "World Cup Semifinal 1", "recent semifinal default title must stay spoiler-safe");
assert.equal(semifinalTwo.displayTitleCompact, "World Cup Semifinal 2", "same-day semifinal default title must stay spoiler-safe");
assert(fifaCards.every(event => ["official", "reputable"].includes(event.sourceType)), "FIFA rewrites must retain explicit source provenance");
assert.equal(fifaCards.find(event => event.id === "fifa-r32-australia-egypt-2026").time, "04:00", "Australia v Egypt must use FIFA's corrected Sydney time");
assert(fifaCards.filter(event => event.date < "2026-07-16").every(event => event.score && event.outcomeText && event.recapText), "verified past FIFA matches must carry score, outcome and analysis");
assert.equal(semifinalTwo.score, "England 1-2 Argentina", "England v Argentina must carry the consensus final score");
assert.match(semifinalTwo.recapText, /Fernandez.+Martinez/i, "England v Argentina must carry a consensus synopsis");
assert.equal(semifinalTwo.sourceType, "reputable", "the consensus result must not be mislabelled as an official FIFA update");
assert.deepEqual(fifaCards.find(event => event.id === "fifa-third-place-2026").matchupParticipants.map(participant => participant.name), ["France", "England"], "the third-place card must carry the resolved contestants");
assert.deepEqual(fifaCards.find(event => event.id === "fifa-final-2026").matchupParticipants.map(participant => participant.name), ["Spain", "Argentina"], "the final card must carry the resolved contestants");
const thirdPlace = fifaCards.find(event => event.id === "fifa-third-place-2026");
assert(thirdPlace.status === "completed" ? /6-4|finished third/i.test(`${thirdPlace.selectedSentence} ${thirdPlace.outcomeText}`) : /Golden Boot/i.test(thirdPlace.selectedSentence), "the third-place card must carry current context or its verified result");
assert.equal(thirdPlace.storyline.arcStage, "recap", "the completed third-place card must not retain preview lifecycle metadata");
assert.doesNotMatch(`${thirdPlace.selectedSentence}\n${thirdPlace.fullSpiel}`, /6-4|beat(?:ing)? France|finished third|hat-trick/i, "the third-place card's default fields must remain spoiler-safe");
assert.match(`${thirdPlace.storyline.hookSpoilerOn}\n${thirdPlace.storyline.synopsisSpoilerOn}`, /6-4|finished third|hat-trick/i, "the third-place card's spoiler-on fields must contain the result-aware recap");
const fifaFinal = fifaCards.find(event => event.id === "fifa-final-2026");
assert.equal(fifaFinal.status, "completed", "the World Cup final must convert from preview to a completed result");
assert.equal(fifaFinal.score, "Spain 1-0 Argentina (AET)", "the World Cup final must carry the media-consensus score");
assert.equal(fifaFinal.sourceType, "reputable", "a delayed official World Cup score must be labelled as media consensus");
assert.doesNotMatch(`${fifaFinal.selectedSentence}\n${fifaFinal.fullSpiel}`, /Spain 1-0|Ferran Torres|extra time/i, "the completed final's default fields must remain spoiler-safe");
assert.match(`${fifaFinal.storyline.hookSpoilerOn}\n${fifaFinal.storyline.synopsisSpoilerOn}`, /Spain.+1-0|Ferran Torres|extra time/i, "the revealed final card must contain the result-aware recap");

const belgianGrandPrix = publishedFeed.events.find(event => event.id === "evt_21");
assert.equal(`${belgianGrandPrix.date} ${belgianGrandPrix.time}`, "2026-07-19 23:00", "the Belgian Grand Prix must use the official Sydney start time");
assert.equal(belgianGrandPrix.status, "completed", "the Belgian Grand Prix must convert from preview to result");
assert.equal(belgianGrandPrix.sourceType, "official", "the FIA Belgian Grand Prix report must be treated as official");
assert.match(belgianGrandPrix.score, /Antonelli.+Leclerc.+Verstappen/i, "the Belgian Grand Prix result must retain its podium");
assert.doesNotMatch(`${belgianGrandPrix.selectedSentence}\n${belgianGrandPrix.fullSpiel}`, /Antonelli.+won|Leclerc|Verstappen/i, "the Belgian Grand Prix default fields must remain spoiler-safe");
assert.match(`${belgianGrandPrix.storyline.hookSpoilerOn}\n${belgianGrandPrix.storyline.synopsisSpoilerOn}`, /Antonelli.+won|Leclerc/i, "the revealed Belgian Grand Prix card must contain the result-aware recap");
const tourStageFifteen = publishedFeed.events.find(event => event.id === "evt_60");
assert.equal(tourStageFifteen.status, "completed", "Tour de France Stage 15 must convert from preview to result");
assert.equal(tourStageFifteen.sourceType, "reputable", "a delayed Tour score must be labelled as media consensus");
assert.match(tourStageFifteen.score, /Remco Evenepoel.+4:23:09/i, "Tour de France Stage 15 must carry the consensus winner and time");
const essendonGws = publishedFeed.events.find(event => event.id === "afl-essendon-gws-2026-07-19");
assert.equal(essendonGws.status, "completed", "Essendon v GWS must convert from fixture to result");
assert.equal(essendonGws.score, "Essendon 10.7 (67) def GWS Giants 8.16 (64)", "Essendon v GWS must carry the media-consensus score");
assert.equal(essendonGws.sourceType, "reputable", "a delayed AFL score must be labelled as media consensus");
const editorialAudit = JSON.parse(fs.readFileSync("data/editorial-preview-audit.json", "utf8"));
assert.equal(editorialAudit.summary.failed, 0, "every high-stakes card inside the editorial window must pass journalistic preview QA");

const wallabiesItaly = publishedFeed.events.find(event => event.id === "rugby-australia-italy-2026-07-18");
assert.equal(wallabiesItaly.status, "completed", "Wallabies v Italy must be converted from preview to result");
assert.equal(wallabiesItaly.score, "Australia 57-10 Italy", "Wallabies v Italy must carry the official final score");
assert.match(wallabiesItaly.storyline.hookSpoilerOn, /57.10/i, "the revealed Wallabies result must include the final score");
assert.doesNotMatch(wallabiesItaly.storyline.hookSpoilerOff, /57.10|Australia beat/i, "the protected Wallabies result must not leak the outcome");

const wimbledonCards = publishedFeed.events.filter(event => event.key === "wimbledon");
assert.equal(wimbledonCards.length, 32, "Wimbledon must contain the two retained R3 matches plus all 30 singles matches from R4 onward");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-r4-")).length, 16, "all 16 fourth-round singles matches must be present");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-qf-")).length, 8, "all eight Wimbledon quarterfinals must be present");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-sf-")).length, 4, "all four Wimbledon semifinals must be present");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-final-")).length, 2, "both Wimbledon singles finals must be present");
assert(wimbledonCards.every(event => event.score && event.outcomeText && event.recapText), "every restored Wimbledon match must carry score, outcome and analysis");
assert.equal(wimbledonCards.find(event => event.id === "wimbledon-final-noskova-muchova-2026").time, "01:00", "women's final must use its verified Sydney time");
assert.equal(wimbledonCards.find(event => event.id === "wimbledon-final-sinner-zverev-2026").date, "2026-07-13", "men's final must use the following Sydney calendar day");
assert(wimbledonCards.filter(event => event.timeTbc).every(event => /Order of play/.test(event.displayTimeLabel)), "non-exact Wimbledon starts must be labelled as order-of-play sessions");

const melbourneCards = publishedFeed.events.filter(event => event.id.startsWith("f1-australian-gp-2027-"));
assert.equal(melbourneCards.length, 2, "the 2027 Melbourne date and ticket alert cards must be present");
assert(melbourneCards.every(event => event.horizonException && event.ticketUrl), "Melbourne cards must be explicit horizon exceptions with official ticket actions");
assert(melbourneCards.every(event => event.ticketSaleStatus === "waitlist-open-date-not-announced"), "Melbourne cards must not invent an unconfirmed ticket-sale week");
assert.equal(melbourneCards.find(event => event.timeTbc)?.calendarExportEligible, false, "the date-TBC Melbourne card must not create a false calendar appointment");

const appPrelude = scriptMatch[1].split("/* ============ LIVE CLOCK ============ */")[0];
const storage = new Map();
const sandbox = {
  console,
  structuredClone,
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
};
vm.createContext(sandbox);
vm.runInContext(vectorAssetsSource, sandbox, { filename: "config/vector-assets.js" });
vm.runInContext(sportDomainRegistrySource, sandbox, { filename: "config/sport-domain-registry.js" });
vm.runInContext(canonicalTaxonomySource, sandbox, { filename: "config/canonical-sports-taxonomy.js" });
vm.runInContext(profileStorageSource, sandbox, { filename: "config/profile-storage.js" });
vm.runInContext(preferenceSystemSource, sandbox, { filename: "config/preference-system.js" });
vm.runInContext(enrichmentEngineSource, sandbox, { filename: "config/enrichment-engine.js" });
vm.runInContext(cardLifecycleSource, sandbox, { filename: "config/card-lifecycle.js" });
vm.runInContext(reminderEngineSource, sandbox, { filename: "config/reminder-engine.js" });
vm.runInContext(soundtrackSource, sandbox, { filename: "config/soundtrack.js" });
vm.runInContext(selectorTaxonomySource, sandbox, { filename: "config/selector-taxonomy.js" });
vm.runInContext(broadcastConfigSource, sandbox, { filename: "config/au-broadcast-weights.js" });

const expose = `
globalThis.__test = {
  SCORE_BANDS,
  SURFACE_CONFIG,
  AU_BROADCAST_CONFIG,
  SELECTOR_TAXONOMY,
  PREFERENCE_SYSTEM,
  ENRICHMENT_ENGINE,
  CARD_LIFECYCLE,
  REMINDER_ENGINE,
  SOUNDTRACK,
  mergePreferences,
  getActiveProfileId(){ return activeProfileBundle?.profile?.id || null; },
  getActiveProfileBundle(){ return structuredClone(activeProfileBundle); },
  allSelectorEntities,
  orderSelectorEntities,
  selectorNewPromptEntities,
  canonicalSportKeysForSelectorIds,
  selectedPreferenceDomainIds,
  selectorEntityMatchesEvent,
  commonwealthDisciplineForEvent,
  normalizeThemePreference,
  setEvents(events){ activeEvents = events; normalizeEvents(activeEvents); },
  setActions(actions){ eventActions = actions; },
  setSpoilerState(state){ eventSpoilerState = state; },
  setSurfacePresentation(state){ surfacePresentationState = state; },
  getSurfacePresentationSnapshot(){ return structuredClone(surfacePresentationState); },
  getSpoilerStateSnapshot(){ return structuredClone(eventSpoilerState); },
  setRatings(next){ ratings = next; },
  setPreferences(next){ userPreferences = mergePreferences({ followedSports: Object.keys(SPORTS_LIBRARY), selectedBroadcasters: Object.keys(BROADCASTER_LIBRARY), ...next }); },
  setFilter(filter){ activeFilter = filter; },
  eventActionKey,
  surfacePresentationKey,
  surfacePresentationForEvent,
  markEventSeen,
  getStaticAuBroadcastWeight,
  computeAuBroadcastWeightScore,
  auBroadcastWeightScoreForEvent,
  eventEnrichment,
  eventMeetsDerivedRetention,
  rebuildDerivedCardCache,
  purgeDerivedCardCache,
  clearAndRebuildDerivedCardCache,
  getDerivedCardCache(){ return structuredClone(derivedCardCache); },
  getArchivedEventRefs(){ return structuredClone(archivedEventRefs); },
  orderSurfacedEvents,
  partitionSurfacedEvents,
  topNineEvents,
  cardStateForEvent,
  setCardState,
  collapseCardStates,
  collapseAllCardStates,
  isCardActivelyViewed,
  scrollOffsetToPreserveAnchor,
  getFilteredEvents,
  getPreferenceMatchedEvents,
  getEventAction,
  getEventSpoilerState,
  neverMissBuckets,
  neverMissTimelineEvents,
  updateEventAction,
  isSpoilerVisible,
  clearHiddenSpoilerOverrides,
  clearShownSpoilerOverrides,
  applyGlobalSpoilerPolicy,
  hasSpoilerSensitiveContent,
  compactResultForEvent,
  markSpoilerRevealed,
  revealSpoilerDetails,
  hideSpoilersForEvent,
  resetSpoilerOverride,
  isLocalGame,
  matchedLocalVenue,
  preferredTicketUrlForEvent,
  setEventRating,
  getActual,
  archiveEvent,
  reinstateArchivedEvent,
  archivedEvents,
  spoilerSafeDisplayTitle,
  selectedSentenceForDisplay,
  storylineCopyForDisplay,
  eventSpielForDisplay,
  retrospectiveSignificanceForEvent,
  shouldSuggestWatchLater,
  getNeverMissExportSections,
  selectedNeverMissExportEvents,
  formatFeedbackTimestamp,
  buildFeedbackMessage,
  buildFeedbackSmsUrl,
  sortUpcomingFirst,
  calendarTimelineEvents,
  eventDateLabel,
  eventTimeLabel,
};`;
vm.runInContext(`${appPrelude}\n${expose}`, sandbox, { filename: "index.html" });
const icsSource = scriptMatch[1].match(/function pad2\(n\)[\s\S]*?(?=\nfunction downloadICS)/);
assert(icsSource, "calendar export functions must be present");
vm.runInContext(`${icsSource[0]}\nglobalThis.__test.generateICS = generateICS;`, sandbox, { filename: "index.html" });
const app = sandbox.__test;

function memoryStorage(seed = {}){
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    snapshot: () => Object.fromEntries(values),
  };
}

const legacyProfileStorage = memoryStorage({
  ns_preferences_v1: JSON.stringify({ version: 5, onboardingComplete: true, theme: "day", followedSports: ["afl"] }),
  ns_ratings_v1: JSON.stringify({ "legacy-event": 9 }),
  ns_event_user_state_v1: JSON.stringify({ "legacy-event": { archived: true } }),
});
const migratedProfile = profileStorage.loadActiveProfile(legacyProfileStorage, { now: new Date("2026-07-20T00:00:00Z") });
assert.match(migratedProfile.profile.id, /^profile:/, "legacy settings must migrate under a stable internal profile id");
assert.equal(migratedProfile.schemaVersion, 2, "profile migration must land on the current schema version");
assert.equal(migratedProfile.preferences.theme, "day", "existing preference fields must survive the profile migration");
assert.equal(migratedProfile.ratings["legacy-event"], 9, "existing ratings must survive the profile migration");
assert.equal(migratedProfile.eventUserState["legacy-event"].archived, true, "existing event state must survive the profile migration");
const renamedProfile = profileStorage.setUsernameLabel(legacyProfileStorage, migratedProfile, "Changed display name", { now: new Date("2026-07-20T00:01:00Z") });
assert.equal(renamedProfile.profile.id, migratedProfile.profile.id, "changing the username label must not change the storage identity");
const reloadedProfile = profileStorage.loadActiveProfile(legacyProfileStorage, { now: new Date("2026-07-20T00:02:00Z") });
assert.equal(reloadedProfile.profile.id, migratedProfile.profile.id, "profile id must survive a simulated app update and reload");
assert.equal(reloadedProfile.preferences.theme, "day", "settings must survive a simulated app update and reload");
assert.match(app.getActiveProfileId(), /^profile:/, "the app runtime must load state through a stable profile id");

app.setEvents([thirdPlace]);
app.setActions({});
app.setRatings({});
app.setSpoilerState({});
app.setPreferences({ showSpoilers: false });
assert.doesNotMatch(app.selectedSentenceForDisplay(thirdPlace), /6-4|beat(?:ing)? France|finished third/i, "FRA v ENG must show only protected copy with spoilers off");
assert.doesNotMatch(app.eventSpielForDisplay(thirdPlace), /6-4|hat-trick|Saka/i, "FRA v ENG opened copy must stay protected with spoilers off");
app.setPreferences({ showSpoilers: true });
assert.match(app.selectedSentenceForDisplay(thirdPlace), /6-4|finished third/i, "FRA v ENG must show the result hook with spoilers on");
assert.match(app.eventSpielForDisplay(thirdPlace), /hat-trick|Saka/i, "FRA v ENG opened copy must show the result recap with spoilers on");

assert.equal(app.SCORE_BANDS.minimumStakes, 3, "global feed floor must be stakes 3/5");
assert.equal(app.SCORE_BANDS.topStorylines.minStakes, 4, "Top Storylines must start at stakes 4/5");
assert.equal(app.SCORE_BANDS.worthCheckingOut.minStakes, 3, "Worth Checking Out must be stakes 3/5");
assert.equal(app.normalizeThemePreference("day"), "day", "Day must be a valid theme preference");
assert.equal(app.normalizeThemePreference("night"), "night", "Night must be a valid theme preference");
assert.equal(app.normalizeThemePreference("system"), "system", "System must be a valid theme preference");
assert.equal(app.normalizeThemePreference("sepia"), "system", "unknown themes must safely fall back to System");
assert.equal(app.mergePreferences({ theme: "day" }).theme, "day", "theme choice must survive preference merging");
assert.deepEqual(Array.from(app.mergePreferences(null).followedSports), [], "new profiles must start with every sport deselected");
assert.deepEqual(Array.from(app.mergePreferences(null).selectedSelectorEntityIds), [], "new profiles must start with categories, event groups, and subcategories deselected");
assert.deepEqual(
  Array.from(app.mergePreferences({ followedSports: ["wimbledon", "fifa"] }).selectedSelectorEntityIds),
  ["sport:wimbledon", "sport:fifa"],
  "legacy sport preferences must migrate into the selector layer without following new entities"
);

const existingProfileBeforeCwg = app.mergePreferences({
  version: 4,
  onboardingComplete: true,
  selectedSelectorEntityIds: Array.from(app.allSelectorEntities())
    .filter(entity => entity.id.startsWith("sport:"))
    .map(entity => entity.id),
  selectedBroadcasters: ["kayo", "stan", "sbs", "nine", "foxtel", "fis"],
});
assert(existingProfileBeforeCwg.selectedSelectorEntityIds.includes("special:commonwealth-games"), "existing profiles must receive the Commonwealth Games group when it is introduced");
assert(existingProfileBeforeCwg.selectedBroadcasters.includes("seven"), "existing profiles must receive Seven when the Commonwealth Games broadcaster is introduced");
app.setEvents(publishedCwgCards);
app.setPreferences(existingProfileBeforeCwg);
assert.equal(app.getPreferenceMatchedEvents().filter(event => event.key === "cwg").length, 32, "existing profiles must retain every Commonwealth Games card after the selector taxonomy updates");
const cwgOptOut = app.mergePreferences({
  ...existingProfileBeforeCwg,
  version: 5,
  selectedSelectorEntityIds: existingProfileBeforeCwg.selectedSelectorEntityIds.filter(id => id !== "special:commonwealth-games"),
});
assert(!cwgOptOut.selectedSelectorEntityIds.includes("special:commonwealth-games"), "a saved Commonwealth Games opt-out must not be overwritten by the migration");

const selectorCategories = Array.from(app.orderSelectorEntities(app.SELECTOR_TAXONOMY.categories));
assert.equal(selectorCategories[0].label, "Special Events", "the newly introduced Special Events category must appear before its existing sibling");
assert.equal(selectorCategories[0].level, 1, "Special Events must be a top-level selector category");
const specialEventLabels = Array.from(app.SELECTOR_TAXONOMY.specialEvents, entity => entity.label);
[
  "Super Bowl",
  "Masters Tournament",
  "FIFA World Cup",
  "Tour de France",
  "Wimbledon",
  "24 Hours of Le Mans",
  "Commonwealth Games",
].forEach(label => assert(specialEventLabels.includes(label), `Special Events must include ${label}`));
assert.equal(
  Array.from(app.orderSelectorEntities(app.SELECTOR_TAXONOMY.specialEvents))[0].label,
  "Commonwealth Games",
  "the most recently introduced event group must appear first among its siblings"
);
const commonwealthFilters = Array.from(app.SELECTOR_TAXONOMY.commonwealthDisciplines).sort((a, b) => a.lockedSlot - b.lockedSlot);
assert.deepEqual(
  commonwealthFilters.map(entity => entity.label),
  ["Athletics", "Swimming", "Rugby Sevens", "Netball", "Cricket", "Hockey", "Gymnastics", "Cycling", "Boxing", "Miscellaneous"],
  "Commonwealth Games must use the fixed Australian broadcast-priority filter list"
);
assert.equal(commonwealthFilters.at(-1).lockedSlot, 10, "Miscellaneous must remain locked at Commonwealth slot 10");
assert(commonwealthFilters.every(entity => entity.isNew), "new Commonwealth subcategories must carry selector-level new state");
const promptEntities = Array.from(app.selectorNewPromptEntities());
assert(promptEntities.length > 1, "multiple newly introduced selector entities must be batched together");
assert.equal(promptEntities.filter(entity => entity.id === "category:special-events").length, 1, "the consolidated prompt must contain each new entity once");
assert.deepEqual(Array.from(app.canonicalSportKeysForSelectorIds(["sport:wimbledon", "special:wimbledon"])), ["wimbledon"], "base-sport and Special Events selections must resolve to one canonical sport key");
app.setPreferences({});

function dateAtOffset(days){
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function event(id, days, stakes){
  return {
    id,
    eventId: id,
    sport: "F1",
    key: "f1",
    name: id,
    date: dateAtOffset(days),
    time: "12:00",
    broadcaster: "Kayo Sports",
    expected: stakes >= 4 ? 8 : stakes === 3 ? 6 : 4,
    stakesScore: stakes,
    liveWindow: 3,
  };
}

const canonicalWimbledon = { ...event("canonical-wimbledon", 2, 4), sport: "Tennis", key: "wimbledon" };
app.setEvents([canonicalWimbledon]);
app.setPreferences({ selectedSelectorEntityIds: ["sport:wimbledon", "special:wimbledon"] });
assert.equal(app.getPreferenceMatchedEvents().length, 1, "Special Events must not duplicate a canonical event selected through the base sport tree");

const commonwealthAthletics = { ...event("cwg-athletics", 2, 4), sport: "Commonwealth Games", key: "cwg", commonwealthDiscipline: "Athletics" };
const commonwealthBadminton = { ...event("cwg-badminton", 3, 4), sport: "Commonwealth Games", key: "cwg", commonwealthDiscipline: "Badminton" };
app.setEvents([commonwealthAthletics, commonwealthBadminton]);
app.setPreferences({ selectedSelectorEntityIds: ["cwg:athletics"] });
assert.deepEqual(Array.from(app.getPreferenceMatchedEvents(), item => item.id), ["cwg-athletics"], "a Commonwealth top-nine subfilter must match its mapped discipline only");
app.setPreferences({ selectedSelectorEntityIds: ["cwg:miscellaneous"] });
assert.deepEqual(Array.from(app.getPreferenceMatchedEvents(), item => item.id), ["cwg-badminton"], "Miscellaneous must be computed from Commonwealth sports outside the locked top nine");
assert.equal(app.commonwealthDisciplineForEvent(commonwealthBadminton), "miscellaneous", "unlisted Commonwealth sports must map to Miscellaneous by rule");
app.setPreferences({});

function eventFromReference(id, reference, hours, stakes, broadcaster, intensity = stakes){
  const start = new Date(reference.getTime() + hours * 3600 * 1000);
  return {
    ...event(id, 0, stakes),
    date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
    broadcaster,
    broadcastOptions: [broadcaster],
    storyline: { stakes, intensity },
  };
}

const rankingReference = new Date(2026, 6, 19, 12, 0, 0);
const newlySurfaced = eventFromReference("new-lower-importance", rankingReference, 4, 3, "Kayo Sports", 3);
const seenMarquee = eventFromReference("seen-marquee", rankingReference, 2, 5, "SBS On Demand", 5);
app.setEvents([newlySurfaced, seenMarquee]);
app.setActions({});
app.setSurfacePresentation({
  [app.surfacePresentationKey(newlySurfaced)]: { firstSurfacedAt: new Date(rankingReference.getTime() - 3600 * 1000).toISOString(), seenAt: null },
  [app.surfacePresentationKey(seenMarquee)]: { firstSurfacedAt: new Date(rankingReference.getTime() - 2 * 3600 * 1000).toISOString(), seenAt: new Date(rankingReference.getTime() - 3600 * 1000).toISOString() },
});
assert.deepEqual(
  Array.from(app.orderSurfacedEvents([seenMarquee, newlySurfaced], { reference: rankingReference }), ev => ev.id),
  ["new-lower-importance", "seen-marquee"],
  "a new eligible item must sort above a higher-importance seen item"
);
app.markEventSeen(newlySurfaced, rankingReference);
assert.equal(app.surfacePresentationForEvent(newlySurfaced, rankingReference).isNew, false, "marking a surfaced item seen must clear its new state");
assert.deepEqual(
  Array.from(app.orderSurfacedEvents([newlySurfaced, seenMarquee], { reference: rankingReference }), ev => ev.id),
  ["seen-marquee", "new-lower-importance"],
  "seen items must return to importance ordering"
);
const tieBreakEvents = [
  eventFromReference("later-high-intensity", rankingReference, 6, 4, "Stan Sport", 5),
  eventFromReference("earlier-low-intensity", rankingReference, 5, 4, "Stan Sport", 3),
  eventFromReference("same-time-low-intensity", rankingReference, 7, 4, "Stan Sport", 3),
  eventFromReference("same-time-high-intensity", rankingReference, 7, 4, "Stan Sport", 5),
  eventFromReference("stable-b", rankingReference, 8, 4, "Stan Sport", 4),
  eventFromReference("stable-a", rankingReference, 8, 4, "Stan Sport", 4),
];
app.setEvents(tieBreakEvents);
app.setSurfacePresentation(Object.fromEntries(tieBreakEvents.map(ev => [
  app.surfacePresentationKey(ev),
  { firstSurfacedAt: new Date(rankingReference.getTime() - 2 * 3600 * 1000).toISOString(), seenAt: rankingReference.toISOString() },
])));
const tieBreakOrder = Array.from(app.orderSurfacedEvents(tieBreakEvents, { reference: rankingReference }), ev => ev.id);
assert(tieBreakOrder.indexOf("earlier-low-intensity") < tieBreakOrder.indexOf("later-high-intensity"), "earlier start must break an importance tie before storyline intensity");
assert(tieBreakOrder.indexOf("same-time-high-intensity") < tieBreakOrder.indexOf("same-time-low-intensity"), "stronger storyline intensity must break an equal-time tie");
assert(tieBreakOrder.indexOf("stable-a") < tieBreakOrder.indexOf("stable-b"), "stable event ID must provide the final deterministic tie-break");
app.setSurfacePresentation({
  [app.surfacePresentationKey(newlySurfaced)]: { firstSurfacedAt: new Date(rankingReference.getTime() - 8 * 24 * 3600 * 1000).toISOString(), seenAt: null },
});
assert.equal(app.surfacePresentationForEvent(newlySurfaced, rankingReference).isNew, false, "new state must expire after the configured freshness window");

assert(app.getStaticAuBroadcastWeight("SBS On Demand") > app.getStaticAuBroadcastWeight("Kayo Sports"), "free Australian broadcast access must carry more weight than subscription-only access");
assert.equal(
  app.computeAuBroadcastWeightScore({ broadcasters: ["SBS On Demand"], competitionImportance: 4, storylineIntensity: 3, userInterestScore: 2 }),
  4.15,
  "the Top 9 score must use the documented static weighted formula"
);

const topNineCandidates = [
  eventFromReference("top-sbs", rankingReference, 1, 4, "SBS On Demand", 4),
  ...Array.from({ length: 8 }, (_, index) => eventFromReference(`top-stan-${index + 1}`, rankingReference, index + 2, 4, "Stan Sport", 4)),
  eventFromReference("lower-broadcast-weight", rankingReference, 11, 4, "Broadcaster TBC", 4),
  eventFromReference("below-top-nine-floor", rankingReference, 12, 3, "SBS On Demand", 3),
];
app.setEvents(topNineCandidates);
app.setSurfacePresentation(Object.fromEntries(topNineCandidates.map(ev => [
  app.surfacePresentationKey(ev),
  { firstSurfacedAt: new Date(rankingReference.getTime() - 2 * 3600 * 1000).toISOString(), seenAt: new Date(rankingReference.getTime() - 3600 * 1000).toISOString() },
])));
const rankedTopNine = app.topNineEvents(rankingReference);
assert.equal(rankedTopNine.length, 9, "Top 9 must cap an eligible set at nine items");
assert.equal(rankedTopNine[0].id, "top-sbs", "Top 9 must put the highest Australian broadcast-weight score first");
assert(!rankedTopNine.some(ev => ev.id === "lower-broadcast-weight" || ev.id === "below-top-nine-floor"), "Top 9 must not use lower-priority fixtures as filler");
assert.deepEqual(Array.from(app.topNineEvents(rankingReference).slice(0, 2), ev => ev.id), ["top-sbs", "top-stan-1"]);

app.setEvents(topNineCandidates.slice(0, 2));
assert.equal(app.topNineEvents(rankingReference).length, 2, "Top 9 must show fewer items when fewer than nine are eligible");

const phaseOneEvents = [
  event("recent-top", -6, 5),
  event("recent-worth", -2, 3),
  event("expired-top", -8, 5),
  event("top-week", 2, 4),
  event("worth-week", 3, 3),
  event("around", 10, 5),
  { ...event("horizon-exception", 200, 5), horizonException: true, calendarExportEligible: false },
  event("too-far", 31, 5),
  event("below-floor", 4, 2),
];
app.setEvents(phaseOneEvents);
app.setActions({});
app.setFilter("all");

const buckets = app.neverMissBuckets();
assert.deepEqual(Array.from(buckets.topStorylines, ev => ev.id), ["top-week"]);
assert.deepEqual(Array.from(buckets.worthCheckingOut, ev => ev.id), ["worth-week"]);
assert.deepEqual(Array.from(buckets.aroundTheCorner, ev => ev.id), ["around", "horizon-exception"]);
const neverMissTimeline = app.neverMissTimelineEvents();
assert.deepEqual(Array.from(neverMissTimeline, ev => ev.id), ["recent-top", "recent-worth", "top-week", "worth-week"], "Never Miss must combine Top Storylines and Worth Checking Out across the seven days around Today");
assert(!neverMissTimeline.some(ev => ev.id === "expired-top"), "Never Miss must exclude events more than seven days in the past");
assert(!app.getFilteredEvents().some(ev => ev.id === "below-floor"), "events below stakes 3/5 must be excluded");

const exportedTopOnly = app.selectedNeverMissExportEvents({
  topStorylines: true,
  worthCheckingOut: false,
  aroundTheCorner: false,
});
assert.deepEqual(Array.from(exportedTopOnly, ev => ev.id), ["top-week"], "export must include only selected Never Miss sections");
const exportedWorthAndAround = app.selectedNeverMissExportEvents({
  topStorylines: false,
  worthCheckingOut: true,
  aroundTheCorner: true,
});
assert.deepEqual(Array.from(exportedWorthAndAround, ev => ev.id), ["worth-week", "around"], "calendar export must omit a date-TBC horizon exception");
const globallyChronologicalExport = app.selectedNeverMissExportEvents(
  { topStorylines: true, worthCheckingOut: true, aroundTheCorner: false },
  {
    topStorylines: [event("late-top", 5, 5)],
    worthCheckingOut: [event("early-worth", 1, 3)],
    aroundTheCorner: [],
  }
);
assert.deepEqual(Array.from(globallyChronologicalExport, ev => ev.id), ["early-worth", "late-top"], "selected export events must be globally chronological");
const selectedIcs = app.generateICS(exportedWorthAndAround);
assert.equal((selectedIcs.match(/BEGIN:VEVENT/g) || []).length, 2, "calendar file must contain only the selected events");
assert.match(selectedIcs, /^BEGIN:VCALENDAR/);
assert.match(selectedIcs, /TZID:Australia\/Sydney/);
assert.match(selectedIcs, /END:VCALENDAR$/);
assert.match(selectedIcs, /UID:worth-week@sportscal/);
assert.match(selectedIcs, /UID:around@sportscal/);
assert.doesNotMatch(selectedIcs, /UID:horizon-exception@sportscal/);
assert.doesNotMatch(selectedIcs, /UID:top-week@sportscal/);

const archived = phaseOneEvents[0];
app.updateEventAction(archived, { archived: true });
assert(!app.getFilteredEvents().some(ev => ev.id === archived.id), "archived events must leave active feeds");
assert.equal(app.getEventAction(archived).archived, true, "archive state must persist");

const localGame = {
  ...event("local-nrl", 2, 3),
  key: "nrl",
  sport: "NRL",
  venue: "GIO Stadium Canberra",
};
app.setPreferences({ showSpoilers: false });
assert.equal(app.isLocalGame(localGame), true, "GIO Stadium must be local by default");
assert.equal(app.matchedLocalVenue(localGame).label, "GIO Stadium");
assert.equal(app.preferredTicketUrlForEvent(localGame), "https://www.nrl.com/tickets");

const manukaGame = {
  ...event("local-cricket", 3, 3),
  key: "cricket",
  sport: "Cricket",
  venue: "Corroboree Group Oval, Manuka",
};
assert.equal(app.isLocalGame(manukaGame), true, "Manuka venue aliases must match the default local venue");
assert.equal(app.preferredTicketUrlForEvent(manukaGame), "https://www.cricket.com.au/tickets");

const pastA = event("past-a", -3, 4);
const pastB = event("past-b", -2, 3);
const nextRound = {
  ...event("next-round", 5, 5),
  matchupParticipants: [
    { name: "Winner A", sourceEventId: "past-a" },
    { name: "Winner B", sourceEventId: "past-b" },
  ],
};
app.setEvents([pastA, pastB, nextRound, localGame, manukaGame]);
app.setActions({});
app.setRatings({});
app.setSpoilerState({});
app.setPreferences({ showSpoilers: false });
const picturedWimbledonFinal = wimbledonCards.find(event => event.id === "wimbledon-final-sinner-zverev-2026");
app.setSpoilerState({
  [app.eventActionKey(semifinalOne)]: { override: "show" },
  [app.eventActionKey(semifinalTwo)]: { override: "show" },
  [app.eventActionKey(picturedWimbledonFinal)]: { override: "show" },
});
assert.equal(app.eventSpielForDisplay(semifinalOne), semifinalOne.recapText, "revealed France v Spain must use its actual match spiel rather than spoiler-policy boilerplate");
assert.equal(app.eventSpielForDisplay(picturedWimbledonFinal), picturedWimbledonFinal.recapText, "revealed Wimbledon final must use its actual match spiel rather than spoiler-policy boilerplate");
assert.equal(app.spoilerSafeDisplayTitle(semifinalOne), "France v Spain — World Cup Semi Final 1", "revealing semifinal 1 must show its teams and fixture label");
assert.equal(app.spoilerSafeDisplayTitle(semifinalTwo), "England v Argentina — World Cup Semi Final 2", "revealing semifinal 2 must show both teams and fixture label");
app.setSpoilerState({});
assert.deepEqual(Array.from(app.calendarTimelineEvents([nextRound, pastB, pastA]), event => event.id), ["past-a", "past-b", "next-round"], "Calendar timeline must place past events above Today and future events below it");
const scoredPast = { ...event("compact-result", -1, 4), score: "Home 2-1 Away", outcomeText: "Home advanced to the final." };
assert.equal(app.compactResultForEvent(scoredPast), null, "compact cards must not leak results while spoilers are protected");
app.setPreferences({ showSpoilers: true });
assert.equal(app.compactResultForEvent(scoredPast).score, "Home 2-1 Away", "compact cards must show scores when spoilers are enabled");
assert.equal(app.compactResultForEvent(scoredPast).outcome, "Home advanced to the final.", "compact cards must show a short outcome when spoilers are enabled");
app.setPreferences({ showSpoilers: false });
app.setCardState(pastA, "opened");
assert.equal(app.cardStateForEvent(pastA), "opened", "the actively viewed card must retain its expanded state");
app.setCardState(pastB, "selected");
assert.equal(app.cardStateForEvent(pastA), "compact", "opening a new card must retract the previous card");
assert.equal(app.cardStateForEvent(pastB), "selected", "the new active card must remain selected");
assert.equal(app.isCardActivelyViewed({ top: 120, bottom: 520, height: 400 }, 100, 700), true, "a meaningfully visible card must stay expanded");
assert.equal(app.isCardActivelyViewed({ top: -400, bottom: 101, height: 501 }, 100, 700), true, "a card must stay expanded while its final pixel remains visible above");
assert.equal(app.isCardActivelyViewed({ top: -400, bottom: 100, height: 500 }, 100, 700), false, "a card may retract once it has completely left above the active viewport");
assert.equal(app.isCardActivelyViewed({ top: 699, bottom: 900, height: 201 }, 100, 700), true, "a card must stay expanded while its first pixel remains visible below");
assert.equal(app.isCardActivelyViewed({ top: 700, bottom: 900, height: 200 }, 100, 700), false, "a card may retract once it has completely left below the active viewport");
assert.equal(app.isCardActivelyViewed({ top: -400, bottom: 30, height: 430 }, 100, 700), false, "a card scrolled above the active viewport must retract");
assert.equal(app.scrollOffsetToPreserveAnchor(330, -210), -540, "retraction above the viewport must offset the removed height rather than jump the feed");
assert.equal(app.collapseCardStates([pastB.eventId]), true, "scroll retraction must clear the expanded card state");
assert.equal(app.cardStateForEvent(pastB), "compact", "a retracted card must return to compact");
assert.equal(app.isSpoilerVisible(pastA), false, "PAST events must be spoiler-protected by default");
assert.equal(app.isSpoilerVisible(nextRound), false, "future events must inherit global spoiler protection");
nextRound.spoilerSafeTitle = "World Cup Semifinal";
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "World Cup Semifinal", "unrevealed knockout branches must retain a useful generic title");

app.markSpoilerRevealed(pastA);
assert.equal(app.isSpoilerVisible(pastA), true, "per-event reveal must override global protection");
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "Winner A v Opponent hidden", "only a legitimately revealed knockout side may be named");
app.setCardState(pastA, "selected");
app.revealSpoilerDetails(pastA);
assert.equal(app.cardStateForEvent(pastA), "opened", "revealing an individual event must immediately open its additional spoiler details");
app.markSpoilerRevealed(nextRound);
assert.equal(app.isSpoilerVisible(nextRound), true, "per-event reveal must work before an event starts");
app.hideSpoilersForEvent(nextRound);
assert.equal(app.isSpoilerVisible(nextRound), false, "per-event protection must work before an event starts");

assert.equal(app.eventDateLabel({ date: "2027-03-07", displayDateLabel: "Date TBC - 2027" }), "Date TBC - 2027");
assert.equal(app.eventTimeLabel({ time: "15:00", timeTbc: true }), "Time TBC");
assert.equal(app.eventTimeLabel({ time: "20:00", displayTimeLabel: "Order of play; session from 8:00pm AEST" }), "Order of play; session from 8:00pm AEST");

app.setPreferences({ showSpoilers: true });
assert.equal(app.isSpoilerVisible(pastB), true, "global spoiler-on must reveal inherited events");
app.hideSpoilersForEvent(pastB);
assert.equal(app.isSpoilerVisible(pastB), false, "per-event hide must override global spoiler-on");
app.resetSpoilerOverride(pastB);
assert.equal(app.isSpoilerVisible(pastB), true, "reset must restore the global spoiler policy");

app.setSpoilerState({
  [app.eventActionKey(pastA)]: { override: "hide" },
  [app.eventActionKey(pastB)]: { override: "hide" },
});
assert.equal(app.clearHiddenSpoilerOverrides(), 2, "turning spoilers on must clear stale per-event protections");
assert.equal(Object.keys(app.getSpoilerStateSnapshot()).length, 0, "cleared protections must not remain in saved spoiler state");
assert.equal(app.compactResultForEvent(scoredPast).score, "Home 2-1 Away", "global spoiler-on must restore compact results after clearing stale protections");
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "Winner A v Winner B", "global spoiler-on must restore next-round contestants");
assert.equal(app.hasSpoilerSensitiveContent({ ...pastA, fullSpiel: "A decisive post-event review." }), true, "post-event spiels must participate in spoiler protection and reveal logic");

app.setSpoilerState({
  [app.eventActionKey(pastA)]: { override: "show" },
  [app.eventActionKey(pastB)]: { override: "hide" },
});
assert.equal(app.applyGlobalSpoilerPolicy(false, true), 1, "changing the global setting to OFF must clear every earlier per-event reveal");
assert.equal(app.getSpoilerStateSnapshot()[app.eventActionKey(pastA)], undefined, "global OFF must return previously revealed events to inherited protection");
assert.equal(app.getSpoilerStateSnapshot()[app.eventActionKey(pastB)].override, "hide", "global OFF may retain already-protected events");
app.setPreferences({ showSpoilers: false });
assert.equal(app.isSpoilerVisible(pastA), false, "a global OFF reset must hide spoiler-bearing events immediately");
app.markSpoilerRevealed(pastA);
assert.equal(app.isSpoilerVisible(pastA), true, "an event may be deliberately revealed after the global OFF reset");
assert.equal(app.applyGlobalSpoilerPolicy(false, false), 0, "saving unrelated settings must not erase a later individual reveal");
assert.equal(app.isSpoilerVisible(pastA), true, "an individual reveal must persist until the global spoiler setting changes again");

app.setPreferences({ showSpoilers: false });
app.setEventRating(pastB, 9);
assert.equal(app.getActual("past-b"), 9, "rating must be stored");
assert.equal(app.isSpoilerVisible(pastB), true, "rating a PAST event must reveal it");
assert.equal(app.shouldSuggestWatchLater(pastB), true, "a completed event rated above 8/10 must be suggested for Watch Later");
assert.equal(app.retrospectiveSignificanceForEvent(pastB).effectiveStakes, 4, "retrospective quality must raise derived significance without changing canonical stakes");
const chronologicalPast = app.sortUpcomingFirst([pastB, pastA]).filter(event => event.id.startsWith("past"));
assert.deepEqual(Array.from(chronologicalPast, event => event.id), ["past-a", "past-b"], "retrospective quality must not reorder past events");
app.updateEventAction(pastB, { watchLater: true });
assert.equal(app.shouldSuggestWatchLater(pastB), false, "the retrospective prompt must clear after saving to Watch Later");
app.archiveEvent(pastA);
assert.equal(app.getEventAction(pastA).archived, true, "archive action must persist");
assert.equal(app.isSpoilerVisible(pastA), true, "archiving a PAST event must reveal it");
assert.equal(app.getArchivedEventRefs().some(reference => reference.canonicalEventId === pastA.id), true, "archive must create an explicit profile-scoped reference");
assert(app.getDerivedCardCache().derivedCards.every(card => card.isArchived === false), "archive state must never leak into disposable cache records");
app.clearAndRebuildDerivedCardCache();
assert.equal(app.archivedEvents().some(event => event.id === pastA.id), true, "archive view must rebuild from canonical events after a full cache purge");
const olderThanRetention = { ...event("older-than-retention", -20, 4), status: "completed" };
assert.equal(app.eventMeetsDerivedRetention(olderThanRetention), false, "unarchived past cards must expire after 14 days");

const winterTimestamp = app.formatFeedbackTimestamp(new Date("2026-07-16T10:00:00Z"));
const summerTimestamp = app.formatFeedbackTimestamp(new Date("2026-12-16T10:00:00Z"));
assert.match(winterTimestamp, /AEST$/, "winter feedback timestamps must use AEST");
assert.match(summerTimestamp, /AEDT$/, "summer feedback timestamps must use AEDT");
const feedbackMessage = app.buildFeedbackMessage("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z"));
assert.match(feedbackMessage, /^NOTHINGSPORTS FEEDBACK/);
assert.match(feedbackMessage, /Category: Bug report/);
assert.match(feedbackMessage, /Sent from nothingSports$/);
assert.match(app.buildFeedbackSmsUrl("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z")), /^sms:0437041326\?&body=/);

console.log("nothingSports phase rules verified");
