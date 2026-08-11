#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { classifyCalendarEvent, classifyCommonwealthDiscipline } = require("./import-calendar-events");
const profileStorage = require("../config/profile-storage.js");
const brand = require("../config/brand-copy.js");
const preferenceSystem = require("../config/preference-system.js");
const sportContext = require("../config/sport-context.js");
const sportHubs = require("../config/sport-hubs.js");
const { createCanonicalSportsIndex } = require("./lib/canonical-sports");

const html = fs.readFileSync("index.html", "utf8");
const notFoundHtml = fs.readFileSync("404.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const broadcastConfigSource = fs.readFileSync("config/au-broadcast-weights.js", "utf8");
const selectorTaxonomySource = fs.readFileSync("config/selector-taxonomy.js", "utf8");
const canonicalTaxonomySource = fs.readFileSync("config/canonical-sports-taxonomy.js", "utf8");
const vectorAssetsSource = fs.readFileSync("config/vector-assets.js", "utf8");
const sportDomainRegistrySource = fs.readFileSync("config/sport-domain-registry.js", "utf8");
const sportContextSource = fs.readFileSync("config/sport-context.js", "utf8");
const sportHubsSource = fs.readFileSync("config/sport-hubs.js", "utf8");
const profileStorageSource = fs.readFileSync("config/profile-storage.js", "utf8");
const productEventsSource = fs.readFileSync("config/product-events.js", "utf8");
const serverSyncSource = fs.readFileSync("config/server-sync.js", "utf8");
const serverFeedSource = fs.readFileSync("lib/server-feed-pipeline.js", "utf8");
const serverFeedApiSource = fs.readFileSync("api/feed.js", "utf8");
const preferenceSystemSource = fs.readFileSync("config/preference-system.js", "utf8");
const enrichmentEngineSource = fs.readFileSync("config/enrichment-engine.js", "utf8");
const cardLifecycleSource = fs.readFileSync("config/card-lifecycle.js", "utf8");
const reminderEngineSource = fs.readFileSync("config/reminder-engine.js", "utf8");
const soundtrackSource = fs.readFileSync("config/soundtrack.js", "utf8");
const serviceWorkerSource = fs.readFileSync("service-worker.js", "utf8");
const cardUpdateSource = fs.readFileSync("scripts/update-cards.js", "utf8");
const australianMarqueePolicy = JSON.parse(fs.readFileSync("data/canonical/australian-marquee-events-2026.json", "utf8"));
const eventsBundlePath = "data/events.js";
assert(fs.existsSync(eventsBundlePath), "direct-file mode must have a generated published-feed fallback");
const eventsBundleSource = fs.readFileSync(eventsBundlePath, "utf8");
const canonicalContextBundlePath = "data/canonical/contexts.js";
assert(fs.existsSync(canonicalContextBundlePath), "direct-file mode must have a generated canonical context fallback");
const canonicalContextBundleSource = fs.readFileSync(canonicalContextBundlePath, "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, "index.html must contain an inline app script");
assert.doesNotThrow(() => new Function(scriptMatch[1]), "the full inline app script must parse");

const tabOrder = Array.from(html.matchAll(/class="tab-btn(?: active)?" data-tab="([^"]+)"/g), match => match[1]);
assert.deepEqual(tabOrder, ["feed", "standings"], "primary navigation must contain exactly Feed and Standings");
const requiredSlogan = "Smart sports feed. Nothing boring. Nothing spoiled. No big moments missed.";
assert.equal(brand.descriptor, requiredSlogan, "the canonical descriptor must match the supplied slogan exactly");
assert.equal(brand.metadataDescription, requiredSlogan, "metadata must use the supplied slogan exactly");
assert(html.includes(`<title data-brand-copy="title">${brand.title}</title>`), "the document title must use the canonical nothingsport title");
assert(html.includes(brand.hero), "the canonical nothingsport hero line must be present");
assert(html.includes(brand.about), "the canonical nothingsport About paragraph must be present verbatim");
assert.equal(manifest.name, brand.title, "the install manifest must use the canonical nothingsport title");
assert.equal(manifest.short_name, brand.name, "the installed app label must use the lowercase nothingsport name");
assert.equal(manifest.description, brand.metadataDescription, "manifest copy must follow the brand source of truth");
assert(html.includes(`content="${brand.metadataDescription}"`), "page metadata must follow the brand source of truth");
assert(html.includes(`class="slogan" data-brand-copy="descriptor">${requiredSlogan}</div>`), "the compact header must show the exact slogan");
assert(html.includes(`class="footer-slogan" data-brand-copy="descriptor">${requiredSlogan}</div>`), "the footer must show the exact slogan as live text");
assert(html.includes('data-brand-copy-content="metadataDescription"') && html.includes('data-brand-copy="about"'), "rendered and metadata copy must hydrate from the shared brand-copy config");
assert(html.includes(`property="og:title" content="${brand.title}"`) && html.includes(`name="twitter:title" content="${brand.title}"`), "share-card titles must use the canonical smart-feed title");
assert(!brand.about.includes(requiredSlogan), "About must expand the positioning without repeating the exact slogan");
["smarter", "low-value fixtures", "spoiler-safe", "major live moments", "Froth", "focus on one sport", "pinned filter"].forEach(phrase => {
  assert(brand.about.includes(phrase), `About must explain the refreshed product behavior: ${phrase}`);
});
assert(notFoundHtml.includes(requiredSlogan), "the not-found route must use the exact current slogan");
assert(!notFoundHtml.includes("nothingsport-logo-slogan.png"), "the not-found route must not render the stale slogan raster");
assert(!html.includes("Sports feed orchestrator") && !html.includes("Your sports, orchestrated."), "superseded slogan copy must be removed from app and share surfaces");
assert(!/right live games/i.test(html), "superseded right-live-games copy must be removed");
assert(!brand.about.includes("Sydney"), "core product copy must not be city-bound");
assert(brand.about.includes("AEST/AEDT by default"), "core product copy must describe its default timezone basis");
const brandAssets = [
  "assets/brand/source/nothingsport-logo-master.png",
  "assets/brand/source/nothingsport-hero-logo-master.png",
  "assets/brand/source/nothingsport-app-icon-master.png",
  "assets/brand/source/nothingsport-logo-slogan-master.png",
  "assets/brand/web/nothingsport-logo.png",
  "assets/brand/web/nothingsport-hero-logo.png",
  "assets/brand/web/nothingsport-app-icon.png",
  "assets/brand/web/nothingsport-logo-slogan.png",
  "assets/brand/web/nothingsport-social-preview.png",
  "icons/nothingsport-app-32.png",
  "icons/nothingsport-app-180.png",
  "icons/nothingsport-app-192.png",
  "icons/nothingsport-app-512.png",
  "icons/nothingsport-app-maskable-512.png",
];
brandAssets.forEach(asset => assert(fs.existsSync(asset), `brand asset must exist: ${asset}`));
["logo", "hero", "icon"].forEach(asset => {
  assert(html.includes(`data-brand-asset="${asset}"`), `the supplied ${asset} asset must have a visible app placement`);
});
assert(!html.includes('data-brand-asset="slogan"'), "the stale slogan raster must be replaced by live canonical text");
assert(html.includes("syncThemeBrandAssets(useDark)"), "brand assets must follow the existing day, night, and system theme selection");
assert(!html.includes('class="brand-colosseum"'), "the legacy colosseum placeholder must be removed");
assert(!/nothingsport-(?:logo|compact-icon)-(?:day|night)\.png|nothingsport-helm-\d+\.png/.test(html), "legacy centurion assets must not remain referenced");
assert.deepEqual(
  manifest.icons.map(icon => [icon.src, icon.purpose]),
  [
    ["/icons/nothingsport-app-192.png", "any"],
    ["/icons/nothingsport-app-512.png", "any"],
    ["/icons/nothingsport-app-maskable-512.png", "maskable"],
  ],
  "the install manifest must use the supplied skier app icon with normal and maskable safe zones"
);
assert(!html.includes("Weekly Briefing"), "Weekly Briefing must not exist");
assert(html.includes('<span class="tab-label">Feed</span>'), "Feed must be visible in primary navigation");
assert(html.includes('<span class="tab-label">Standings</span>'), "Standings must be visible in primary navigation");
assert(!/<span class="tab-label">(?:Calendar|Don’t Miss|Catch Up|Archived|Ladders|L&amp;S)<\/span>/.test(html), "obsolete primary tab labels must be removed");
assert(!/id="(?:neverMissView|watchLaterView|archivedView)"/.test(html), "removed navigation surfaces must not leave orphaned view routes");
assert(html.includes("ns_event_user_state_v1"), "versioned event user state must be persisted separately");
assert(html.includes("ns_event_spoiler_state_v1"), "spoiler state must be persisted separately from event user state");
assert(html.includes("ns_surface_presentation_v1"), "new and seen presentation state must be persisted separately from canonical events");
assert(html.includes('src="config/au-broadcast-weights.js"'), "the product-owned Australian broadcast config must load in hosted and direct-file modes");
assert(html.includes('src="config/selector-taxonomy.js"'), "the selector taxonomy must load as a separate preference layer in hosted and direct-file modes");
assert(html.includes('src="config/canonical-sports-taxonomy.js"'), "the canonical sports taxonomy must load as a separate versioned layer");
assert(html.includes('src="config/sport-context.js"'), "modular sport context must load before event and standings resolution");
assert(html.includes('src="config/sport-hubs.js"'), "the complete NRL/AFL hub adapter must load before app rendering");
assert(html.includes('src="config/brand-copy.js"'), "canonical brand copy must load before the app script");
assert(html.includes('src="config/vector-assets.js"'), "the licensed vector asset registry must load before app rendering");
assert(html.includes('src="config/sport-domain-registry.js"'), "surfaced sports must derive from a configuration registry");
assert(html.includes('src="config/profile-storage.js"'), "profile-scoped storage and migrations must load before app state");
assert(html.includes('src="config/product-events.js"'), "the fixed pilot-measurement contract must load before app state");
assert(html.includes('src="config/server-sync.js"'), "magic-link sessions and server-state sync must load before app state");
assert(html.includes('src="config/preference-system.js"'), "the reusable preference graph must load before app state");
assert(html.includes('src="config/enrichment-engine.js"'), "the disposable enrichment engine must load before app state");
assert(html.includes('src="config/card-lifecycle.js"'), "the 7-day archive and 14-day hide lifecycle must load before app state");
assert(html.includes('src="config/reminder-engine.js"'), "the deterministic reminder scheduler must load before app state");
assert(html.includes('src="config/soundtrack.js"'), "the top-bar soundtrack controller must load before app state");
assert(html.includes('src="data/events.js"'), "direct-file mode must load the generated published-feed fallback");
assert(
  html.includes("reloadBundledCanonicalContextsScript")
    && html.includes('scriptUrl: "data/canonical/contexts.js"')
    && html.includes('globalThis.location?.protocol === "file:"'),
  "direct-file mode must load complete canonical sport contexts without browser JSON fetch"
);
assert(html.includes("eventEnrichment(ev).mustWatchScore"), "must-watch decisions must use the derived explainable score");
assert(html.includes('`variant-${enrichment.cardVariant}`'), "cards must receive their derived plain, compact, standard, or marquee variant");
assert(html.includes("Why it ranked ·"), "opened cards must explain their ranking score");
assert(html.includes('id="refreshAndRebuildFeedBtn"') && html.includes("refreshFeedOnFirstLoad()"), "feed refresh must run automatically on first load and expose manual recovery only in Settings");
assert(html.includes("renderFeedIfPresentationChanged") && html.includes('id="refreshAndRebuildFeedStatus"'), "unchanged hydration must be render-gated while Settings reports recovery progress");
assert(
  html.includes("loadLatestBundledEvents")
    && html.includes("reloadBundledEventsScript")
    && html.includes('globalThis.location?.protocol === "file:"')
    && html.includes("FEED_CONFIG.eventsScriptUrl"),
  "direct-file refresh must re-read the generated event bundle instead of reapplying the tab's captured EVENTS snapshot"
);
assert(html.includes('id="browserAlertsEnabled"'), "browser reminders must require an explicit settings toggle");
assert(html.includes('id="soundtrackToggle"'), "background audio must use an explicit top-bar toggle");
assert(html.includes('class="soundtrack-toggle-state">OFF</span>'), "the soundtrack toggle must expose an ON/OFF state");
assert(html.includes('id="soundtrackAudio"') && html.includes("/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3"), "the supplied Skyscraper Samba recording must be the sole audio source");
assert(!html.includes('settingsMenuItem("soundtrack"') && !html.includes("renderSoundtrackSettings"), "Soundtrack must be removed from Settings");
assert(html.includes("'Skyscraper Samba' by Scott Buckley - released under CC-BY 4.0."), "the supplied CC-BY attribution must appear in About");
assert(soundtrackSource.includes("audio.volume = 1") && soundtrackSource.includes("player.volume = 1"), "soundtrack playback must use full HTML media volume");
assert(!/createOscillator|elevator|epic orchestral|heavy metal/i.test(soundtrackSource), "procedural and alternate soundtrack modes must be removed");
assert(!html.includes('join(" vs ")'), "fixture formatters must never emit the superseded vs separator");
assert(html.includes('PROFILE_STORAGE.saveSection(localStorage, activeProfileBundle'), "settings writes must target the stable profile id bundle");
assert.deepEqual(preferenceSystem.templates.map(template => template.slug), ["froth", "like", "casual", "custom"], "every selected domain must share the four canonical templates");
assert(html.includes('id="refineFiltersBtn"'), "the feed must expose an obvious Refine filters entry point");
assert(html.includes("function eventUsesFocusedSportFrothOverride(ev)") && html.includes("if (activeSportHubKey()) return false;"), "complete NRL/AFL hubs must not mutate or impersonate the saved Froth preference");
assert(html.includes("function setActiveFeedFilter(nextFilter") && html.includes("setActiveFeedFilter(key, {"), "sport filter changes must use one state transition path");
assert(html.includes('activeTab: "all-fixtures"') && html.includes("resetSportHubState(nextHubKey)"), "direct NRL/AFL filter entry must default to All Fixtures");
assert(html.includes('["worth-watching", "Worth Watching"]') && html.includes('["all-fixtures", "All Fixtures"]') && html.includes('["standings", "Standings"]') && html.includes('["results-replays", "Results/Replays"]'), "supported sport hubs must expose the four canonical internal tabs");
assert(html.includes("SPORT_HUBS.buildFixtureViews") && html.includes("feedCards: activeEvents"), "fixture rows must derive from canonical truth and merge published card enrichment only at render time");
assert(html.includes("SPORT_HUBS.partitionMutedFixtures") && html.includes('toggle.textContent = sportHubState.showHidden ? "Hide muted" : "Show hidden"'), "sport hubs must count explicit mutes and provide a temporary Show hidden control");
assert(html.includes("renderStandingsContext({") && html.includes("competitions,"), "sport hubs must reuse the existing standings renderer with a scoped competition set");
assert(html.includes("userPreferences.showSpoilers && event.canonicalResultScoreline") && html.includes("Results are off. Scores stay hidden; source-backed replay providers remain visible."), "hub results must stay spoiler-safe while naming source-backed replay providers");
assert(html.includes("restoreCuratedFeedViewport(returnState)") && html.includes("curatedFeedReturnState"), "All sports must restore the curated feed viewport after leaving a sport hub");
assert(html.includes("function sportRoundSummaryData") && html.includes("function buildSportRoundSummaryCard"), "the all-sports list must derive NRL/AFL round summaries at render time");
assert(html.includes('activeFilter !== "all" || activeView !== "list"'), "round summaries must stay out of focused feeds and Month View");
assert(html.includes("SPORT_HUBS.roundSummary") && html.includes("sportHubCuratedCanonicalIds"), "round summary counts must reuse canonical fixtures and the existing curated-feed rules");
assert(html.includes('sportHubState.activeTab = "all-fixtures"') && html.includes("sportHubState.selectedRoundNumber = roundNumber"), "summary-card entry must focus All Fixtures on the matching round and its following round");
assert(html.includes("appendSportRoundSummaries(container)"), "the all-sports List View must render its trust bridge without adding canonical events");
assert(!html.includes("summaryCardEventAction"), "derived round summaries must never enter archive, swipe, or rating state");
assert(html.includes("function focusSportHubViewport()") && html.includes("stickyFeedChromeHeight() - 12"), "sport-hub entry must bring the in-place hub heading below the pinned app chrome");
assert(html.includes("requestFeedRefreshForFilterChange()") && html.includes("await refreshRemoteFeed({ quiet: true })"), "focused sport and All filter changes must use the existing feed refresh path");
assert(html.includes("feedFilterRefreshQueued") && html.includes("feedFilterRefreshInFlight"), "rapid sport filter changes must coalesce refreshes instead of racing duplicate loads");
assert(html.includes('id="feedFilterVisibilityBtn"') && html.includes('aria-controls="sportFilters"'), "the feed must expose an always-available show-hide filter control");
assert(html.includes('let feedFilterVisible = true;') && html.includes('let activeFilter = "all";'), "each app open must start with the filter visible and All sports selected");
assert(html.includes('filterRow.hidden = isFeed && !feedFilterVisible') && html.includes('`${selectedLabel}${hubCopy} remains active`'), "hiding the filter UI must keep the selected sport or hub active and visible in status copy");
assert(html.includes('.filter-row[hidden]') && html.includes('display:none;'), "the hidden filter row must be visually collapsed despite its flex layout");
assert(html.includes('toggle.setAttribute("aria-expanded", String(feedFilterVisible))') && html.includes('btn.setAttribute("aria-pressed", String(activeFilter === key))'), "filter controls must expose expanded and selected accessibility states");
assert(html.includes("function stickyFeedChromeHeight()") && html.includes("stickyFeedChromeHeight() + 12"), "pinned filter height must be included in viewport and card-collapse offsets");
const feedFilterVisibilitySource = html.match(/function setFeedFilterVisible\(nextVisible\)\{[\s\S]*?(?=\nfunction renderFilters)/)?.[0] || "";
assert(feedFilterVisibilitySource && !/activeFilter\s*=/.test(feedFilterVisibilitySource), "showing or hiding the filter must not change the selected feed filter");
assert(/\.feed-filter-dock\{[\s\S]*?position:sticky;[\s\S]*?top:var\(--sticky-top-bar-height/.test(html), "the visible feed filter must pin directly beneath the measured top bar");
assert(/@media \(max-width: 640px\)\{[\s\S]*?\.feed-filter-visibility-btn\{[\s\S]*?min-height:44px/.test(html), "the mobile show-hide control must keep a 44px tap target");
assert(html.includes('id="quickAddModal"'), "new sports must offer Quick add versus Customise without rerunning onboarding");
assert(html.includes('const ONBOARDING_SECTIONS = ["sports", "viewing"]'), "first login must keep Sports Followed and viewing as the short setup flow");
assert(html.includes('data-sports-followed-tab="sports"') && html.includes('data-sports-followed-tab="events"'), "Sports Followed must expose Sports and Events tabs");
assert(html.includes("data-domain-froth") && html.includes("data-domain-custom"), "followed events must use a Casual-to-Froth slider with a separate Custom mode");
assert(html.includes("data-inline-froth") && html.includes("selector-choice-stack"), "selected sports must render Froth controls inline with their selector rows");
assert(!html.includes("data-domain-ls") && !html.includes("data-standings-visibility"), "standings visibility controls must be removed from Settings and Froth");
assert(!html.includes("renderStandingsSettings") && !html.includes("renderTemplateSettings"), "standalone standings visibility and Froth screens must be removed");
assert(html.includes('id="standingsSpoilerModal"'), "standings must expose a spoiler warning modal");
assert(html.includes('id="standingsContext"'), "supported table content must resolve into the dedicated Standings destination");
assert(html.includes('expander.dataset.standingsExpander = competition.id') && html.includes('standingsCompetitionExpansion[competition.id] = !expanded'), "each standings component must expose a direct expand and retract control");
assert(html.includes('input.dataset.sportFilter = key') && html.includes('input.type = "checkbox"'), "the ranking area must expose basic sport checkboxes");
assert(html.includes('standingsCompetitionExpansion[competition.id] = false'), "filtering out a sport must retract its expanded standings tables");
assert(html.includes('expanded ? "full" : "summary"'), "followed standings must default to Top 3 plus followed and expand only in direct view state");
assert(html.includes('className = "standings-freshness-note"'), "standings must expose a visible freshness and source-delay notice");
assert(html.includes("This round is ongoing, so positions may change after the next completed match."), "ongoing standings must warn that the table can still change");
assert(html.includes("Standings refresh periodically and may briefly differ from official sources due to update delays."), "standings must disclose periodic update latency against official sources");
assert(html.includes("data-entity-follow"), "entity follow levels must be editable from canonical participants");
assert(html.includes('className = "follow-context"'), "followed teams and competitors must resolve into visible card context");
assert(html.includes('"Top 3 + followed"'), "summary standings must promise to retain followed entities outside the top three");
assert(html.includes('id="viewingStartHour"') && html.includes('id="viewingEndHour"'), "viewing time windows must be optional settings");
assert(html.includes('id="viewingWindowEnabled"'), "Any time must be represented as an explicit durable viewing-window preference");
assert(html.includes("The recommended default is 7am–10pm AEST/AEDT"), "Settings must explain the recommended default viewing window");
assert(html.includes('${viewingHourLabel(viewing.startHourLocal)}–${viewingHourLabel(viewing.endHourLocal)} window'), "the Settings menu must summarise the active viewing window");
assert(html.includes("Calendar sync starts enabled for new profiles"), "Settings must explain the Calendar sync default");
assert(html.includes("asks permission only when you enable it"), "browser alert permission must remain deferred until explicit enablement");
assert.equal(preferenceSystem.DEFAULT_VIEWING_WINDOW.startHourLocal, 7, "the preference graph default must start at 7am");
assert.equal(preferenceSystem.DEFAULT_VIEWING_WINDOW.endHourLocal, 22, "the preference graph default must end at 10pm");
assert(html.includes("Every available provider starts selected"), "provider selection must be opt-out");
assert(!html.includes("loadCachedFeedEvents"), "a stale saved feed must not override the generated published-feed fallback");
assert(html.includes("--color-contrast:"), "every theme must expose a contrast token for the new-item marker");
assert(html.includes("className = \"new-dot\""), "new cards must render the compact contrast-colour dot");
assert(html.includes('id="homeSpoilerToggle"'), "the global spoiler toggle must be visible in the sticky home-screen header");
assert(html.includes("setGlobalSpoilerPreference(!userPreferences.showSpoilers"), "the home-screen spoiler toggle must update the global preference immediately");
assert(html.includes('<span class="spoiler-home-label">Show/Hide Results:</span>'), "the home-screen result control must use the canonical Show/Hide Results label");
assert(html.includes('state.textContent = shown ? "ON" : "OFF"'), "the result control must expose explicit ON and OFF pill states");
assert(html.includes(".spoiler-home-toggle.active .spoiler-home-state"), "the ON result pill must have a distinct active treatment");
assert(!html.includes("id=\"globalSpoilerSwitch\""), "Settings must not duplicate the global result-visibility control");
assert(html.includes('"Local venues", `${draftPreferences.localVenueIds.length} local venue'), "Settings must retain a Local venues entry after removing the result control");
assert(html.includes('id="settingsModal"'), "Settings must use a dedicated main screen");
assert(html.includes('data-settings-section="${section}"'), "Settings must expose exitable submenus from its main screen");
assert(html.includes('id="sportsChoiceGrid"'), "Settings must restore the sports selector");
const settingsMenuSource = html.match(/function renderSettingsMenu\(body\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(settingsMenuSource.includes('"Sports Followed"'), "Settings must use Sports Followed as the single top-level home for follow preferences");
assert(!settingsMenuSource.includes('"Froth knobs"') && !settingsMenuSource.includes('"Coverage overrides"') && !settingsMenuSource.includes('"Ladder & Standings"'), "Froth, coverage, and standings controls must not remain disconnected Settings homes");
assert(!html.includes("Events Selector") && !html.includes("L&amp;S"), "superseded Events Selector and L&S labels must be removed from visible app copy");
assert.equal(JSON.parse(fs.readFileSync("schemas/product-events.schema.json", "utf8")).properties.schemaVersion.const, "product-events.v1", "pilot measurement must expose one versioned request contract");
assert(productEventsSource.includes("const MAX_BATCH_SIZE = 20"), "product event requests must stay bounded to twenty events");
assert(productEventsSource.includes('"opportunity_exposed"') && productEventsSource.includes('"fixture_check"') && productEventsSource.includes('"watch_decision"'), "TSDR events must use a fixed allowlist");
assert(productEventsSource.includes('"weekly_pulse"') && productEventsSource.includes("crossCheck") && productEventsSource.includes("missedFixtures") && productEventsSource.includes("feedClutter"), "weekly trust pulses must use fixed-choice properties");
assert(html.includes('settingsMenuItem("pilot"') && html.includes('id="pilotMeasurementEnabled"'), "signed-in users must receive an explicit trust-pilot acknowledgement control");
assert(html.includes("The normal app works without measurement") && html.includes("if (!pilotMeasurementEligible()) return null"), "the normal app must remain usable with telemetry disabled");
assert(html.includes('eventName: "opportunity_exposed"') && html.includes('eventName: "fixture_check"'), "curated opportunities and fixture checks must be measured only after pilot opt-in");
assert(fs.readFileSync("api/product-events.js", "utf8").includes("PRODUCT_EVENTS.rowsForUser(events, user.id)"), "the product-events API must derive row ownership from the authenticated user");
const productEventsSql = fs.readFileSync("supabase/nothingsports-product-events.sql", "utf8");
assert(productEventsSql.includes("force row level security") && productEventsSql.includes("grant insert on table public.product_events to authenticated"), "the append-only pilot table must force RLS and grant authenticated insert only");
assert(productEventsSql.includes("with check ((select auth.uid()) = user_id)"), "the insert policy must enforce the signed-in owner");
assert(fs.readFileSync("supabase/nothingsports-tsdr.sql", "utf8").includes("had_opportunity and made_decision"), "the operational TSDR query must require opportunity exposure in the same user-week");
assert(cardUpdateSource.includes('["scripts/refresh-canonical-sports.js"]'), "the canonical cards update must refresh ladders and standings through the existing loader");
assert(cardUpdateSource.indexOf('["scripts/refresh-canonical-sports.js"]') < cardUpdateSource.indexOf('["scripts/apply-editorial-previews.js"]'), "ladders and standings must refresh before card derivation begins");
assert.equal((cardUpdateSource.match(/\["scripts\/sync-canonical-fixtures-to-feed\.js"/g) || []).length, 2, "the canonical cards update must sync refreshed fixtures into both incoming and published card feeds");
assert(cardUpdateSource.includes('["scripts/reconcile-australian-marquee-events.js"'), "the canonical cards update must reconcile the named Australian-marquee event list");
assert(cardUpdateSource.includes('["scripts/verify-marquee-coverage.js"'), "the canonical cards update must enforce Australian-marquee coverage");
assert(cardUpdateSource.indexOf('["scripts/verify-marquee-coverage.js"') < cardUpdateSource.indexOf('["scripts/publish-feed.js"'), "Australian-marquee coverage must pass before publication begins");
assert(cardUpdateSource.includes('["scripts/publish-feed.js"') && cardUpdateSource.indexOf('["scripts/publish-feed.js"') < cardUpdateSource.indexOf('["scripts/apply-editorial-previews.js"]'), "the canonical cards update must publish the refreshed JSON and direct-file fallback before card QA");
assert(cardUpdateSource.includes('localOnly: argv.includes("--local-only")'), "the canonical cards update must expose an explicit local-only mode");
assert(cardUpdateSource.includes('if (!localOnly) steps.push(["scripts/redeploy-and-release.sh"])'), "local-only updates must skip the release boundary without creating a second refresh path");
assert(!fs.readFileSync("scripts/redeploy-and-release.sh", "utf8").includes("VERCEL_SKIP_AUTO_UPDATE"), "production releases must not suppress Vercel CLI auto-updates");
[
  "validate-canonical-sports.js",
  "validate-f1-context.js",
  "validate-tennis-context.js",
  "validate-nba-context.js",
  "validate-cwg-context.js",
  "validate-cycling-context.js",
].forEach(script => assert(cardUpdateSource.includes(`["scripts/${script}"]`), `the canonical cards update must validate ${script}`));
assert(html.includes("orderSelectorEntitiesForDisplay"), "followed event choices must be promoted ahead of unfollowed choices");
assert(serviceWorkerSource.includes('const CACHE_NAME = "nothingsport-shell-v69"'), "interaction changes must advance the served shell cache");
assert(html.includes('<meta name="app-shell-version" content="69">'), "the served page must expose its shell version for installed-app diagnostics");
assert(serviceWorkerSource.includes('"/config/sport-hubs.js"'), "the complete sport-hub adapter must be available in the offline shell");
assert(serviceWorkerSource.includes('"/config/product-events.js"'), "the pilot event contract must be available in the offline shell");
assert(serviceWorkerSource.includes('"/config/feed-refresh-lifecycle.js"'), "the refresh render gate must be available in the offline shell");
assert(serviceWorkerSource.includes('"/data/canonical/contexts.js"'), "the generated direct-file canonical transport must ship with the app shell");
assert(serviceWorkerSource.includes("self.skipWaiting()"), "an updated home-screen app worker must activate without waiting for every old app window to close");
assert(serviceWorkerSource.includes("self.clients.claim()"), "an updated home-screen app worker must take control of existing app windows");
assert(serviceWorkerSource.includes("keys.filter(key => key !== CACHE_NAME)"), "the worker must remove superseded shell caches during activation");
assert(!serviceWorkerSource.includes("client.navigate(client.url)"), "worker activation must not navigate a live Home Screen app during startup");
assert(html.includes("controllerchange") && html.includes("registration.update()"), "the installed app must detect a new controller while checking for a worker update");
assert(html.includes('id="startupFeedLoading"') && html.includes("startupCoordinator.isHydrating()"), "the interactive framework must use a stable loading surface until card hydration completes");
assert(html.includes('lastFeedPublishedAt: "ns_last_feed_published_at_v1"'), "feed status must persist the canonical publication time separately from a browser check");
assert(html.includes("Feed generated ${publishedCopy}"), "feed status must label the actual generation time explicitly");
assert(html.includes("This is when the published feed was generated, not when this browser last checked it."), "feed status must not imply that a browser refresh contacts sporting sources");
assert(serverFeedSource.includes("sourcePublishedAt") && serverFeedApiSource.includes("sourcePublishedAt: eventFeed.publishedAt"), "signed-in feeds must retain the same canonical publication timestamp");
assert(html.includes('if (event.key !== "Enter" && event.key !== " ") return;') && html.includes("activateFilter();"), "feed filters must expose explicit Enter and Space keyboard activation");
assert(html.includes("4/5 and 5/5 editorial picks appear in Feed even when you do not follow their sport or broadcaster."), "Sports Followed must explain the editorial must-show override");
brandAssets
  .filter(asset => (asset.startsWith("assets/brand/web/") || asset.startsWith("icons/")) && !asset.endsWith("nothingsport-logo-slogan.png"))
  .forEach(asset => assert(serviceWorkerSource.includes(`"/${asset}"`), `the offline shell must cache ${asset}`));
assert(!serviceWorkerSource.includes("/assets/brand/web/nothingsport-logo-slogan.png"), "the offline shell must stop caching the stale slogan raster");
assert(serviceWorkerSource.includes('"/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3"'), "the sole soundtrack must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/data/canonical/f1-context-2026.json"'), "F1 follows and standings must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/data/canonical/tennis-context-2026.json"'), "tennis follows and ATP rankings must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/data/canonical/cycling-context-2026.json"'), "Tour rider and jersey context must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/data/canonical/nba-context-2026.json"'), "NBA follows and conference standings must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/data/canonical/cwg-context-2026.json"'), "CWG competitor follows and the medal table must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/config/sport-context.js"'), "the shared sport-context adapter must be available in the offline app shell");
assert(serviceWorkerSource.includes('"/config/server-sync.js"'), "the server-sync client must be available in the offline app shell");
assert(serviceWorkerSource.includes('requestUrl.pathname.startsWith("/api/")'), "authenticated API responses must bypass the service-worker cache");
assert(html.includes('"Account & sync"'), "Settings must expose magic-link identity and sync status");
assert(html.includes("bootstrapServerPersistence()"), "app startup must hydrate durable user state before opening the profile experience");
assert(html.includes("queueServerStateSync()"), "durable local changes must queue a server-state write");
assert(html.includes("eventUserState: eventActions"), "archive and saved-card state must be included in server truth");
assert(serverSyncSource.includes('authenticatedRequest("/api/feed")'), "signed-in Refresh must request the authenticated central feed");
assert(html.includes('payload?.schemaVersion !== "server-feed.v1"'), "the browser must reject an incompatible central feed response");
assert(html.includes('cache.buildOrigin !== "server"'), "the browser must require central card-cache provenance");
assert(html.includes("applyServerFeed(await serverSyncClient.loadFeed())"), "signed-in Refresh must apply the server-built event and card pipeline");
assert(html.includes("cachedEventEnrichment(ev) || calculateEventEnrichment(ev)"), "rendering must consume the disposable enrichment snapshot before recalculating locally");
assert(html.includes('canonicalSportsData && derivedCardCache?.buildOrigin !== "server"'), "late participant-data loading must not overwrite a central feed rebuild");
assert(serverFeedSource.includes("cardLifecycle.materialize(enrichmentCandidates"), "central feed building must use the canonical derived-card lifecycle");
assert(serverFeedSource.includes('buildOrigin: "server"'), "central feed cards must be marked as server-built");
assert(serverFeedApiSource.includes("loadUserState(user.id, accessToken)"), "central feed rebuilding must load preferences under the authenticated RLS user");
assert(serverFeedApiSource.includes('"Cache-Control", "private, no-store, max-age=0"'), "personalised feed responses must never enter a shared cache");
assert.match(serverSyncSource, /sessionStorage|SESSION_STORAGE_KEY/, "auth credentials must use session storage rather than permanent profile storage");
assert(!serverSyncSource.includes("localStorage"), "server sync must not promote browser localStorage into the long-term source of truth");
const detailedCoverageSource = html.match(/function detailedCoverageDomainIds\(preferences\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(detailedCoverageSource.includes('"template:froth"') && detailedCoverageSource.includes("supportsCompetitors"), "detailed coverage must require Froth and a supported team, competitor, or standings model");
assert(html.includes('const DEFAULT_FIRST_RUN_SELECTOR_IDS = ["sport:nrl", "sport:afl"]'), "first-time setup must seed Rugby League and AFL");
assert(!html.includes('draftPreferences.selectedSelectorEntityIds = []'), "first-time setup must preserve its seeded league choices");
assert(html.includes('id="selectorCategoryList"'), "Settings must expose top-level selector categories");
assert(html.includes('id="commonwealthFilterList"'), "Commonwealth Games must expose its discipline filters");
assert(html.includes('id="selectorOptInModal"'), "new selector entities must use one consolidated opt-in prompt");
assert.equal((html.match(/id="selectorOptInModal"/g) || []).length, 1, "new selector entities must not stack multiple prompts");
assert(html.includes('selectorNewMarkerMarkup(entity)'), "new selector entities must reuse the contrast-colour dot treatment");
assert(html.includes('setTimeout(openSelectorOptInPrompt, 250)'), "existing profiles must receive the batched opt-in prompt on the next app open");
assert(html.includes('["day", "night", "system"]'), "Settings must support Day, Night, and System themes");
assert(!html.includes('id="suggestBtn"') && !html.includes('id="feedbackModal"'), "Feedback must live inside Settings rather than a separate header action or modal");
assert(settingsMenuSource.includes('settingsMenuItem("archive"') && html.includes("function renderArchiveSettings"), "Archive must be discoverable and render inside Settings");
assert(html.includes('selectionActionsMarkup("sports"') && html.includes('selectionActionsMarkup("providers"') && html.includes('selectionActionsMarkup("venues"'), "every setup multi-select must expose Select all and Deselect all controls");
assert(html.includes("maximum-scale=1.0, user-scalable=no"), "the app viewport must suppress pinch zoom");
assert(html.includes('document.addEventListener("gesturestart"'), "native-app gesture handling must suppress Safari pinch gestures");
assert(html.includes('id="jumpTodayBtn"'), "Calendar must expose a floating Jump to Today control");
assert(html.includes('anchor.id = "calendarTodayAnchor"'), "Calendar must render a Today timeline anchor");
assert(html.includes("scheduleInitialCalendarJump()"), "Calendar must default the viewport to Today");
assert(html.includes('return "calendarTodayAnchor"'), "the persistent sports feed must retain its Today anchor");
assert(html.includes("function focusedRecentPastDateKey"), "focused sport entry must be able to anchor retained recent results before Today");
assert(html.includes("focusedRecentPastDateKey(filtered.map(event => event.date)"), "focused sport entry must inspect both new and previously seen retained cards");
assert(html.includes("jumpTodayBtn.hidden = hubActive"), "Jump to Today must remain available in curated Feed views and stay out of complete sport hubs");
assert(html.includes("nothing high stakes on today"), "Today must explain when no high-stakes card qualifies");
assert(html.includes("temporaryTodayMoreEvents"), "Today More must use temporary reveal state rather than changing preferences");
assert(html.includes('className = `date-group${dateStr < todayStr ? " is-past-date" : ""}`'), "past date groups must receive subdued styling");
assert(html.includes('window.addEventListener("scroll"'), "expanded cards must respond to viewport scrolling");
assert(html.includes('card.dataset.eventId = ev.eventId || ev.id'), "expanded cards must expose their event identity for viewport retraction");
assert(html.includes("retainCollapsedCardSpace(retractionAnchor, replacementCards)"), "above-viewport card retraction must preserve the visible feed position");
const scrollRetractionSchedulerSource = html.match(/function scheduleCardRetractionDuringScroll\(\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(scrollRetractionSchedulerSource.includes("CARD_RETRACTION_SCROLL_IDLE_MS") && scrollRetractionSchedulerSource.includes("window.setTimeout"), "cards must retract after the bounded scroll-idle delay");
assert(!scrollRetractionSchedulerSource.includes("requestAnimationFrame"), "active scrolling must not rebuild card icon DOM on animation frames");
assert(!/setInterval\(\(\) => \{[\s\S]*?renderCurrentSection\(true\);[\s\S]*?\}, 30000\)/.test(html), "the live clock must not rebuild every card and icon on a repeating timer");
const viewportRetractionSource = html.match(/function collapseCardsOutsideActiveViewport\(\)\{[\s\S]*?(?=\nfunction buildEventCard)/)?.[0] || "";
assert(viewportRetractionSource.includes("replaceCollapsedCardsInPlace(collapsingCards)") && !viewportRetractionSource.includes("renderCurrentSection()"), "scroll retraction must replace only collapsed cards instead of rebuilding the whole feed");
assert(viewportRetractionSource.includes("retainCollapsedCardSpace(retractionAnchor, replacementCards)") && !viewportRetractionSource.includes("restoreViewportRetractionAnchor(retractionAnchor)"), "active-scroll retraction must preserve lower-card geometry without a mid-gesture scroll correction");
assert(html.includes("function clearPendingCardRetractionSpace()") && html.includes("scheduleCardRetractionSpaceCleanup()"), "temporary retraction space must be removed after scrolling settles");
assert(html.includes('if (scrollDirection === "up" && pendingCardRetractionSpaceCards.size)') && html.includes("clearPendingCardRetractionSpace();"), "upward scrolling must clear temporary retraction space immediately");
assert(html.includes("function cardRetractionVisualOffset(retainedHeight)") && html.includes("card.style.transform = `translateY(${visualOffset}px)`"), "a compact card must visually occupy its retained space before upward cleanup");
assert(html.includes('card.style.transform = "";'), "temporary card translation must clear with retained retraction space");
assert(html.includes("anchor.card?.isConnected") && html.includes("card: anchorCard || null"), "viewport restoration must retain the exact anchored card when it remains connected");
assert(html.includes('const compactResult = buildCompactResult(ev)'), "compact cards must render revealed result summaries");
assert(html.includes('if (state !== "opened")'), "compact results must hand off to full result detail at the opened level");
assert(html.includes("LOCAL GAME"), "cards must support the LOCAL GAME tag");
assert(html.includes('glyphMarkup("ui:ticket", { preferImage: true })'), "local games must expose a stable vector-labelled Tickets link");
const eventCardSource = html.match(/function buildEventCard\(ev, options = \{\}\)\{[\s\S]*?\n  return card;\n\}/)?.[0] || "";
assert(eventCardSource.includes("preferImage: true"), "event cards must use stable image-backed sport glyphs instead of Safari CSS masks");
assert((eventCardSource.match(/preferImage: true/g) || []).length >= 9, "every large and small scrolling-card glyph must use the stable image-backed path");
assert(html.includes('intensityMarkup(ev.stakesScore, { className: "stakes-vector", label: `Stakes ${ev.stakesScore} out of 5`, preferImage: true })'), "the repeated card stakes meter must avoid a live inline-SVG repaint layer");
assert.equal((eventCardSource.match(/buildSpoilerOverrideControl\(ev\)/g) || []).length, 2, "selected and opened card states must each render one spoiler control");
assert(!/textContent\s*=\s*["']NEW["']/.test(eventCardSource), "the freshness treatment must not add a NEW text badge");
assert(html.includes('function spoilerOutcomeCopy(outcome)'), "empty or structured outcome data must not break revealed PAST cards");
assert(html.includes('id="calendarSyncBtn"'), "the header must expose Calendar sync as the primary calendar action");
assert(html.includes('id="calendarSyncModal"'), "Calendar sync must reveal a dedicated subscription surface");
assert(html.includes('id="calendarSyncUrl"'), "Calendar sync must reveal the customised subscription URL");
assert(html.includes('id="copyCalendarSyncBtn"') && html.includes('id="subscribeCalendarSyncBtn"'), "Calendar sync must support copy and calendar-app subscription actions");
assert(!html.includes("Export Never Miss"), "the obsolete one-off Never Miss export language must be removed");
assert(!html.includes('id="exportModal"') && !html.includes('id="exportForm"'), "the one-off batch export form must be removed");
const actionPanelSource = html.match(/function buildEventActionPanel\(ev, options = \{\}\)\{[\s\S]*?\n  return panel;\n\}/)?.[0] || "";
assert(actionPanelSource.includes('makeActionButton("Archive"'), "cards must retain the Archive action");
assert(actionPanelSource.includes('getActual(ev.id) !== null') && actionPanelSource.includes('makeActionButton("Save"'), "Save must only render after a card has been rated");
assert(!/Must Watch|Catch Up|Watch Later/.test(actionPanelSource), "obsolete card actions must be absent from every action-panel branch");
const spoilerControlSource = html.match(/function buildSpoilerOverrideControl\(ev\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(spoilerControlSource.includes('visible ? "Hide results" : "Show results"'), "per-event result controls must use Show results and Hide results");
assert(spoilerControlSource.includes('window.confirm("Show results for this event?")'), "the per-event confirmation must use result language");
assert(!/Protect event details|Reveal event details/.test(html), "obsolete event-detail protection copy must be removed everywhere");
assert(html.includes("applyFeedEvents(EVENTS.slice(), meta)"), "bundled-feed Refresh must run through the canonical lifecycle rebuild");
assert(html.includes('id="feedbackForm"'), "Feedback must use a structured SMS form");
assert(html.includes("Add a competition") && html.includes("Feature request"), "Feedback must expose the standard categories");
assert(html.includes("0437 041 326"), "Feedback UI must identify the configured SMS recipient");
assert(html.includes("b.textContent = \"Coming Up\""), "future cards must use the Coming Up status tag");
assert(html.includes("b.textContent = \"PAST\""), "completed cards must use the PAST status tag");
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
const f1Context = JSON.parse(fs.readFileSync("data/canonical/f1-context-2026.json", "utf8"));
const tennisContext = JSON.parse(fs.readFileSync("data/canonical/tennis-context-2026.json", "utf8"));
const cyclingContext = JSON.parse(fs.readFileSync("data/canonical/cycling-context-2026.json", "utf8"));
const nbaContext = JSON.parse(fs.readFileSync("data/canonical/nba-context-2026.json", "utf8"));
const cwgContext = JSON.parse(fs.readFileSync("data/canonical/cwg-context-2026.json", "utf8"));
const sportContextSchema = JSON.parse(fs.readFileSync("schemas/sport-context.schema.json", "utf8"));
const eventsBundleSandbox = { globalThis: {} };
vm.runInNewContext(eventsBundleSource, eventsBundleSandbox, { filename: eventsBundlePath });
const bundledPublishedEvents = eventsBundleSandbox.globalThis.NOTHINGSPORTS_EVENTS;
assert(Array.isArray(bundledPublishedEvents), "direct-file fallback must expose the published event list");
assert.deepEqual(
  Array.from(bundledPublishedEvents, event => event.id),
  publishedFeed.events.map(event => event.id),
  "direct-file fallback must mirror every published feed event"
);
const contextBundleSandbox = { globalThis: {} };
vm.runInNewContext(canonicalContextBundleSource, contextBundleSandbox, { filename: canonicalContextBundlePath });
const bundledContexts = JSON.parse(JSON.stringify(contextBundleSandbox.globalThis.NOTHINGSPORTS_CANONICAL_CONTEXTS));
assert.deepEqual(bundledContexts, {
  leagueSports: canonicalSports,
  f1Context,
  tennisContext,
  cyclingContext,
  nbaContext,
  cwgContext,
}, "direct-file canonical transport must mirror every authoritative context without changing truth");
assert.equal(canonicalSportsSchema.properties.schemaVersion.const, "canonical-sports.v1", "canonical sports schema must be explicitly versioned");
assert(canonicalSportsSchema.$defs.sportDomain.required.includes("supportsCompetitors"), "canonical sport domains must declare competitor support");
assert(canonicalSportsSchema.$defs.participant.properties.type.enum.includes("competitor"), "canonical participants must use the Competitor type");
assert(!/\bsupportsAthletes\b|\bathlete\b/i.test(`${canonicalTaxonomySource}\n${JSON.stringify(canonicalSportsSchema)}`), "canonical taxonomy and schemas must use Competitor as the single participant term");
assert.equal(profileStorageSchema.properties.schemaVersion.const, 2, "profile storage schema must be explicitly versioned");
assert.equal(enrichedEventSchema.properties.schemaVersion.const, "enriched-event.v1", "enrichment must use an explicitly versioned disposable schema");
assert(enrichedEventSchema.required.includes("followContext"), "derived enrichment must require resolved follow context");
assert(enrichedEventSchema.properties.followContext.items.properties.participantType.enum.includes("competitor"), "follow context must use Competitor as the canonical individual participant term");
assert.equal(sportContextSchema.properties.schemaVersion.const, "sport-context.v1", "modular sport context must be explicitly versioned");
assert.equal(f1Context.participants.filter(participant => participant.type === "team").length, 11, "F1 context must expose all 11 team follows");
assert.equal(f1Context.participants.filter(participant => participant.type === "competitor").length, 22, "F1 context must expose all 22 driver follows");
assert.equal(f1Context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:f1-drivers-2026")?.entries.length, 22, "F1 driver standings must contain the whole grid");
assert.equal(f1Context.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:f1-constructors-2026")?.entries.length, 11, "F1 constructor standings must contain every team");
const contextualF1Events = sportContext.applyContextToEvents(publishedFeed.events.filter(event => event.key === "f1"), f1Context);
assert(contextualF1Events.filter(event => /\b(?:Qualifying|Race)\b/i.test(event.name)).every(event => event.participantIds.length === 33), "F1 session cards must resolve active drivers and teams");
assert(contextualF1Events.filter(event => /watch/i.test(event.name)).every(event => !event.participantIds?.length), "F1 ticket/date watches must remain free of sporting follow context");
assert.equal(tennisContext.participants.filter(participant => participant.type === "competitor").length, 18, "Wimbledon detail settings must expose the calibrated ATP competitor set");
assert.equal(tennisContext.ladderSnapshots.find(snapshot => snapshot.competitionId === "competition:atp-singles-2026")?.entries.length, 18, "ATP ranking context must cover every surfaced men's competitor plus the official top three");
const contextualTennisEvents = sportContext.applyContextToEvents(publishedFeed.events.filter(event => event.key === "wimbledon"), tennisContext);
assert(contextualTennisEvents.filter(event => /\bMen(?:'|’)s\b/i.test(event.name)).every(event => event.participantIds?.length === 2), "Wimbledon men's cards must resolve only the two named ATP competitors");
assert(contextualTennisEvents.filter(event => /\bWomen(?:'|’)s\b/i.test(event.name)).every(event => !event.participantIds?.length), "Wimbledon women's cards must not inherit ATP context");
assert(html.includes('["tennisContext", "data/canonical/tennis-context-2026.json"]') && html.includes("loadCanonicalContextBundles()"), "the browser must load the tennis context bundle");
assert(serverFeedApiSource.includes('require("../data/canonical/tennis-context-2026.json")'), "the authenticated server feed must load the same tennis context bundle");
assert(html.includes('? "Competitor ranking context"'), "tennis settings must describe ATP data as competitor rankings rather than a generic championship table");
assert.equal(cyclingContext.participants.length, 14, "Tour detail settings must expose the calibrated rider-follow set");
assert.equal(cyclingContext.jerseySnapshots.length, 21, "every Tour stage card must have a start/close jersey snapshot");
assert(cyclingContext.jerseySnapshots.every(snapshot => snapshot.unavailableClassifications.includes("purple")), "purple must be explicitly withheld when the official Tour publishes no such classification");
assert(cyclingContext.jerseySnapshots.every(snapshot => snapshot.start.purpleParticipantId === null && snapshot.close.purpleParticipantId === null), "a green or other Tour classification must never be relabelled purple");
const contextualTourEvents = sportContext.applyContextToEvents(publishedFeed.events.filter(event => event.key === "tdf"), cyclingContext);
assert.equal(contextualTourEvents.length, 21, "the published Tour stage run must remain intact");
assert(contextualTourEvents.every(event => event.participantIds?.length === 14), "Tour cards must resolve the rider-follow field");
assert(contextualTourEvents.every(event => event.jerseySnapshot?.eventId === event.id), "Tour cards must receive their matching stage-jersey snapshot");
assert(html.includes('["cyclingContext", "data/canonical/cycling-context-2026.json"]'), "the browser must load the cycling context bundle");
assert(serverFeedApiSource.includes('require("../data/canonical/cycling-context-2026.json")'), "the authenticated server feed must load the same cycling context bundle");
assert(html.includes("function buildStageJerseyContext(ev)"), "Tour stage cards must render the calibrated jersey context");
assert(html.includes("Starting and closing holders protected while Results is off."), "Tour jersey changes must respect spoiler protection");
assert(html.includes("purple withheld because the official Tour publishes no purple classification"), "Tour settings must explain why purple is unavailable rather than silently substituting green");
assert.equal(nbaContext.participants.filter(participant => participant.type === "team").length, 30, "NBA detail settings must expose all 30 team follows");
assert.equal(nbaContext.participants.filter(participant => participant.type === "competitor").length, 15, "NBA detail settings must expose the official 15 All-NBA competitors");
assert(nbaContext.competitions.every(competition => competition.standingsType === "conferenceStandings"), "NBA context must use conference-calibrated standings");
assert(nbaContext.ladderSnapshots.every(snapshot => snapshot.entries.length === 15), "each NBA conference table must contain all 15 teams");
const contextualNbaEvents = sportContext.applyContextToEvents(publishedFeed.events.filter(event => event.key === "nba"), nbaContext);
assert.equal(contextualNbaEvents.length, 7, "the published NBA Finals card run must remain intact");
assert(contextualNbaEvents.every(event => event.participantIds?.length === 4), "NBA Finals cards must resolve the two teams and their surfaced All-NBA leaders");
assert(contextualNbaEvents.every(event => !event.participantIds.includes("team:nba:detroit-pistons")), "unrelated NBA teams must not leak onto Finals cards");
assert(html.includes('["nbaContext", "data/canonical/nba-context-2026.json"]'), "the browser must load the NBA context bundle");
assert(serverFeedApiSource.includes('require("../data/canonical/nba-context-2026.json")'), "the authenticated server feed must load the same NBA context bundle");
assert(html.includes("Conference standings · W/L, win percentage and games behind"), "NBA settings must describe the calibrated conference tables");
assert.equal(cwgContext.participants.filter(participant => participant.sportDomainId === "sport:multi-sport:cwg:competitors").length, 15, "CWG detail settings must expose the calibrated competitor-follow set");
assert.equal(cwgContext.participants.filter(participant => participant.sportDomainId === "sport:multi-sport:cwg:nations").length, 24, "CWG medal context must resolve every currently medalling nation or territory");
assert.equal(cwgContext.competitions[0]?.standingsType, "medalTable", "CWG context must use a sport-calibrated medal table");
assert.equal(cwgContext.ladderSnapshots[0]?.entries.length, 24, "the Glasgow 2026 medal table must contain the full official Day 6 field");
const contextualCwgEvents = sportContext.applyContextToEvents(publishedFeed.events.filter(event => event.key === "cwg"), cwgContext);
assert.equal(contextualCwgEvents.length, 34, "the repaired CWG card set must remain intact after competitor resolution");
assert.equal(contextualCwgEvents.find(event => event.id === "cwg-glasgow-2026-swimming-closing-finals")?.participantIds?.length, 6, "CWG swimming cards must resolve only the calibrated swimming follow field");
assert.equal(contextualCwgEvents.find(event => event.id === "cwg-glasgow-2026-netball-australia-england-bronze")?.participantIds?.[0], "competitor:cwg:liz-watson", "Australian CWG netball cards must resolve the surfaced Australian competitor");
assert(!contextualCwgEvents.find(event => event.id === "cwg-glasgow-2026-boxing-finals-one")?.participantIds?.length, "unsupported CWG disciplines must not inherit competitor follows");
assert(html.includes('["cwgContext", "data/canonical/cwg-context-2026.json"]'), "the browser must load the CWG context bundle");
assert(serverFeedApiSource.includes('require("../data/canonical/cwg-context-2026.json")'), "the authenticated server feed must load the same CWG context bundle");
assert(html.includes('"special:commonwealth-games": "sport:multi-sport"'), "Commonwealth Games settings must resolve to the multi-sport canonical domain");
assert(html.includes("Medal table · Gold, silver, bronze and total"), "CWG settings must describe the calibrated medal table");
const canonicalIndex = createCanonicalSportsIndex(canonicalSports);
assert(canonicalIndex.getFixtures({ competitionId: "competition:afl-premiership-2026" }).length >= 207, "canonical store must contain the complete 2026 AFL home-and-away fixture plus any published finals");
assert(canonicalIndex.getFixtures({ competitionId: "competition:nrl-premiership-2026" }).length >= 204, "canonical store must contain the complete 2026 NRL premiership fixture plus any published finals");
assert.equal(canonicalIndex.getLatestLadder("competition:afl-premiership-2026").entries.length, 18, "AFL ladder must be queryable by competition");
assert.equal(canonicalIndex.getLatestLadder("competition:nrl-premiership-2026").entries.length, 17, "NRL ladder must be queryable by competition");
const confirmedScheduledCanonicalFixtures = canonicalSports.events.filter(event =>
  ["sport:afl", "sport:nrl"].includes(event.sportDomainId)
  && event.status === "scheduled"
  && event.startTimeUtc
  && Date.parse(event.startTimeUtc) + 3 * 60 * 60 * 1000 >= Date.parse(publishedFeed.publishedAt)
);
[incomingFeed, publishedFeed].forEach(feed => {
  const canonicalIds = feed.events.map(event => event.canonicalEventId).filter(Boolean);
  assert.equal(new Set(canonicalIds).size, canonicalIds.length, "each canonical fixture may materialise as only one feed card");
  confirmedScheduledCanonicalFixtures.forEach(event => {
    assert(canonicalIds.includes(event.id), `${feed === incomingFeed ? "incoming" : "published"} feed must contain ${event.id}`);
  });
});
const eventKeySchema = eventFeedSchema?.$defs?.event?.properties?.key || {};
const calendarSportKeySchema = calendarEventSchema?.$defs?.sportKey || {};
if (Array.isArray(eventKeySchema.enum)) {
  assert(eventKeySchema.enum.includes("cwg"), "published feeds must accept Commonwealth Games canonical events");
} else {
  assert.equal(eventKeySchema.type, "string", "published feed sport keys must remain string-based");
  assert((eventKeySchema.pattern || "").includes("^[a-z0-9]"), "published feed sport keys must remain slug-style");
}
if (Array.isArray(calendarSportKeySchema.enum)) {
  assert(calendarSportKeySchema.enum.includes("cwg"), "calendar imports must accept Commonwealth Games canonical events");
} else {
  assert.equal(calendarSportKeySchema.type, "string", "calendar import sport keys must remain string-based");
  assert((calendarSportKeySchema.pattern || "").includes("^[a-z0-9]"), "calendar import sport keys must remain slug-style");
}
assert.equal(classifyCalendarEvent({ title: "Commonwealth Games Rugby Sevens Final" }).key, "cwg", "Commonwealth Games tagging must win before its underlying sport classification");
assert.equal(classifyCommonwealthDiscipline("Commonwealth Games Rugby Sevens Final"), "rugby-sevens", "Commonwealth discipline mapping must be deterministic");
assert.equal(classifyCommonwealthDiscipline("Commonwealth Games Badminton Final"), "miscellaneous", "unlisted Commonwealth disciplines must map to Miscellaneous");
assert.equal(new Set(publishedFeed.events.map(event => event.id)).size, publishedFeed.events.length, "selector views must not require duplicated canonical events");
const incomingCwgCards = incomingFeed.events.filter(event => event.key === "cwg");
const publishedCwgCards = publishedFeed.events.filter(event => event.key === "cwg");
assert.equal(incomingCwgCards.length, 34, "incoming feed must contain the repaired Glasgow 2026 Commonwealth Games card set");
assert.equal(publishedCwgCards.length, 34, "published feed must contain the repaired Glasgow 2026 Commonwealth Games card set");
const requiredMarqueeIds = australianMarqueePolicy.events.map(event => event.id);
[incomingFeed, publishedFeed].forEach(feed => {
  requiredMarqueeIds.forEach(id => {
    assert.equal(feed.events.filter(event => event.id === id).length, 1, `${feed === incomingFeed ? "incoming" : "published"} feed must contain exactly one ${id} card`);
  });
  australianMarqueePolicy.forbiddenEventIds.forEach(id => {
    assert(!feed.events.some(event => event.id === id), `${feed === incomingFeed ? "incoming" : "published"} feed must not retain superseded placeholder ${id}`);
  });
});
assert.deepEqual(
  publishedCwgCards.map(event => event.id).sort(),
  incomingCwgCards.map(event => event.id).sort(),
  "every incoming Commonwealth Games card must publish with the same canonical id"
);
assert(publishedCwgCards.every(event => (
  event.status === "completed"
    ? event.storyline?.arcStage === "recap"
    : event.status === "upcoming" && event.storyline?.arcStage === "preview"
)), "Commonwealth Games cards must use lifecycle-correct, spoiler-safe Storyline stages");
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
assert(!JSON.stringify(publishedFeed).includes("Preserved from the existing nothingsport card set until a newer source supersedes it."), "published cards must not contain legacy placeholder copy");
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
const calendarSyncSummarySource = scriptMatch[1].match(/function calendarSyncSummaryText\(config = calendarSyncConfigForPreferences\(\)\)\{[\s\S]*?(?=\nfunction renderCalendarSyncModal)/);
assert(calendarSyncSummarySource, "Calendar sync must expose a preference-specific subscription summary");
const storage = new Map();
storage.set("ns_feed_cache_v1", JSON.stringify({
  events: [{ id: "stale-cache-card", eventId: "stale-cache-card", key: "nrl", sport: "NRL", name: "Stale cached fixture", date: "2026-07-24", time: "19:00", broadcaster: "Kayo Sports", expected: 5 }],
}));
const sandbox = {
  console,
  structuredClone,
  URLSearchParams,
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
};
vm.createContext(sandbox);
vm.runInContext(vectorAssetsSource, sandbox, { filename: "config/vector-assets.js" });
vm.runInContext(sportDomainRegistrySource, sandbox, { filename: "config/sport-domain-registry.js" });
vm.runInContext(canonicalTaxonomySource, sandbox, { filename: "config/canonical-sports-taxonomy.js" });
vm.runInContext(sportContextSource, sandbox, { filename: "config/sport-context.js" });
vm.runInContext(sportHubsSource, sandbox, { filename: "config/sport-hubs.js" });
vm.runInContext(profileStorageSource, sandbox, { filename: "config/profile-storage.js" });
vm.runInContext(preferenceSystemSource, sandbox, { filename: "config/preference-system.js" });
vm.runInContext(enrichmentEngineSource, sandbox, { filename: "config/enrichment-engine.js" });
vm.runInContext(cardLifecycleSource, sandbox, { filename: "config/card-lifecycle.js" });
vm.runInContext(reminderEngineSource, sandbox, { filename: "config/reminder-engine.js" });
vm.runInContext(soundtrackSource, sandbox, { filename: "config/soundtrack.js" });
vm.runInContext(selectorTaxonomySource, sandbox, { filename: "config/selector-taxonomy.js" });
vm.runInContext(broadcastConfigSource, sandbox, { filename: "config/au-broadcast-weights.js" });
vm.runInContext(eventsBundleSource, sandbox, { filename: eventsBundlePath });

const expose = `
globalThis.__test = {
  SCORE_BANDS,
  SURFACE_CONFIG,
  AU_BROADCAST_CONFIG,
  SELECTOR_TAXONOMY,
  PREFERENCE_SYSTEM,
  SPORT_CONTEXT,
  SPORT_HUBS,
  ENRICHMENT_ENGINE,
  CARD_LIFECYCLE,
  REMINDER_ENGINE,
  SOUNDTRACK,
  BASE_SPORT_SELECTOR_ENTITIES,
  mergePreferences,
  getActiveEventIds(){ return activeEvents.map(event => event.id); },
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
  setArchivedEventRefs(references){ archivedEventRefs = references; },
  setSpoilerState(state){ eventSpoilerState = state; },
  setSurfacePresentation(state){ surfacePresentationState = state; },
  getSurfacePresentationSnapshot(){ return structuredClone(surfacePresentationState); },
  getSpoilerStateSnapshot(){ return structuredClone(eventSpoilerState); },
  setRatings(next){ ratings = next; },
  setPreferences(next){ userPreferences = mergePreferences({ followedSports: Object.keys(SPORTS_LIBRARY), selectedBroadcasters: Object.keys(BROADCASTER_LIBRARY), ...next }); },
  setActiveFilter(next){ activeFilter = next; },
  getActiveFilter(){ return activeFilter; },
  setCanonicalParticipants(participants){ canonicalPreferenceParticipants = structuredClone(participants); },
  migrateEventActionRecords,
  eventActionKey,
  surfacePresentationKey,
  surfacePresentationForEvent,
  markEventSeen,
  getStaticAuBroadcastWeight,
  computeAuBroadcastWeightScore,
  auBroadcastWeightScoreForEvent,
  eventEnrichment,
  eventMeetsDerivedRetention,
  eventIsEditorialMustShow,
  eventMeetsCoveragePreference,
  eventMatchesSportPreferences,
  feedFilterMatchesEvent,
  focusedRecentPastDateKey,
  eventMatchesExplicitSubfilters,
  eventMatchesBroadcasterPreferences,
  eventIsAutoArchived,
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
  cardRetractionSpaceForHeights,
  cardRetractionVisualOffset,
  cardScrollDirection,
  getFilteredEvents,
  focusedArchivedEvents,
  getPreferenceMatchedEvents,
  getEventAction,
  getEventSpoilerState,
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
  calendarSyncConfigForPreferences,
  buildCalendarSyncUrl,
  buildCalendarWebcalUrl,
  calendarSyncSummaryText,
  formatFeedbackTimestamp,
  buildFeedbackMessage,
  buildFeedbackSmsUrl,
  sortUpcomingFirst,
  calendarTimelineEvents,
  eventDateLabel,
  eventLocationLabel,
  eventTimeLabel,
  standingsEntriesForVisibility,
  standingsColumnsForCompetition,
  rankingCompetitionsForStandings,
  rankingSportKeysForStandings,
};`;
vm.runInContext(`${appPrelude}\n${calendarSyncSummarySource[0]}\n${expose}`, sandbox, { filename: "index.html" });
const icsSource = scriptMatch[1].match(/function pad2\(n\)[\s\S]*?(?=\nfunction downloadICS)/);
assert(icsSource, "calendar export functions must be present");
vm.runInContext(`${icsSource[0]}\nglobalThis.__test.generateICS = generateICS;`, sandbox, { filename: "index.html" });
const app = sandbox.__test;
const casualNrlGraph = app.PREFERENCE_SYSTEM.createPreferenceGraph({
  profileId: "profile:casual-nrl",
  domainIds: ["sport:nrl"],
  templateByDomain: { "sport:nrl": "template:casual" },
});
const casualNrlPreferences = {
  selectedSelectorEntityIds: ["sport:nrl"],
  followedSports: ["nrl"],
  preferenceGraph: casualNrlGraph,
};
assert.equal(
  app.rankingCompetitionsForStandings(casualNrlPreferences).some(competition => competition.id === "competition:nrl-premiership-2026"),
  true,
  "a followed Casual NRL sport must remain eligible for Standings without a separate visibility preference"
);
assert.deepEqual(Array.from(app.rankingSportKeysForStandings(casualNrlPreferences)), ["nrl"], "Standings sport filters must use stable product ordering");
const nbaGraph = app.PREFERENCE_SYSTEM.createPreferenceGraph({
  profileId: "profile:nba-standings",
  domainIds: ["sport:nba"],
  templateByDomain: { "sport:nba": "template:like" },
});
const nbaCompetitions = app.rankingCompetitionsForStandings({
  selectedSelectorEntityIds: ["sport:nba"],
  followedSports: ["nba"],
  preferenceGraph: nbaGraph,
});
assert.deepEqual(
  Array.from(nbaCompetitions, competition => competition.id),
  ["competition:nba-eastern-conference-2025-26", "competition:nba-western-conference-2025-26"],
  "both NBA conference tables must live in the Standings destination without duplication"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(app.migrateEventActionRecords({
    legacy: { eventId: "legacy", watchLater: true, mustWatch: true, archived: false },
  }).legacy)),
  {
    eventId: "legacy",
    watchLater: false,
    mustWatch: false,
    archived: true,
    saved: true,
    lastActionAt: null,
  },
  "legacy saved-surface actions must migrate into Archive without leaving obsolete action flags"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ sportDomainId: "sport:afl" }), column => column[0]),
  ["rank", "participant", "played", "won", "lost", "drawn", "percentage", "ladderPoints"],
  "AFL ladders must use played, win/loss/draw, percentage and premiership-point columns"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ sportDomainId: "sport:nrl" }), column => column[0]),
  ["rank", "participant", "played", "won", "lost", "pointsDifference", "ladderPoints"],
  "NRL ladders must use played, win/loss, points difference and competition-point columns"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ standingsType: "drivers", sportDomainId: "sport:motorsport" }), column => column[0]),
  ["rank", "participant", "team", "points"],
  "F1 driver standings must use rank, driver, team and points columns"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ standingsType: "constructors", sportDomainId: "sport:motorsport" }), column => column[0]),
  ["rank", "participant", "points"],
  "F1 constructor standings must use rank, team and points columns"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ standingsType: "singlesRanking", sportDomainId: "sport:tennis" }), column => column[0]),
  ["rank", "participant", "points"],
  "ATP singles rankings must use rank, competitor and points columns"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ standingsType: "conferenceStandings", sportDomainId: "sport:basketball" }), column => column[0]),
  ["rank", "participant", "won", "lost", "winPercentage", "gamesBehind"],
  "NBA conference standings must use rank, team, wins, losses, win percentage and games behind"
);
assert.deepEqual(
  Array.from(app.standingsColumnsForCompetition({ standingsType: "medalTable", sportDomainId: "sport:multi-sport" }), column => column[0]),
  ["rank", "participant", "gold", "silver", "bronze", "total"],
  "CWG medal standings must use rank, team, gold, silver, bronze and total columns"
);
const summaryStandings = app.standingsEntriesForVisibility({
  entries: [
    { participantId: "team:first", rank: 1 },
    { participantId: "team:second", rank: 2 },
    { participantId: "team:third", rank: 3 },
    { participantId: "team:fourth", rank: 4 },
    { participantId: "team:eighth", rank: 8 },
  ],
}, "summary", new Set(["team:second", "team:eighth"]));
assert.deepEqual(
  Array.from(summaryStandings, entry => entry.participantId),
  ["team:first", "team:second", "team:third", "team:eighth"],
  "summary standings must include top three plus every followed participant without duplicates"
);
let cardFollowGraph = app.PREFERENCE_SYSTEM.createPreferenceGraph({
  profileId: "profile:follow-card",
  domainIds: ["sport:afl"],
  broadcasterIds: ["kayo"],
});
cardFollowGraph = app.PREFERENCE_SYSTEM.setEntityFollow(cardFollowGraph, "team:afl:test", "priority");
app.setCanonicalParticipants([{
  id: "team:afl:test",
  type: "team",
  sportDomainId: "sport:afl",
  displayName: "Test Magpies",
  canonicalName: "Test Magpies",
}]);
app.setPreferences({
  selectedSelectorEntityIds: ["sport:afl"],
  selectedBroadcasters: ["kayo"],
  preferenceGraph: cardFollowGraph,
});
assert.deepEqual(
  Array.from(app.eventEnrichment({
    id: "follow-card",
    eventId: "follow-card",
    key: "afl",
    sport: "AFL",
    name: "Test Magpies v Test Lions",
    date: "2026-08-01",
    time: "19:30",
    broadcaster: "Kayo Sports",
    broadcasterIds: ["kayo"],
    participantIds: ["team:afl:test"],
    stakesScore: 3,
  }).followContext, item => ({ ...item })),
  [{
    participantId: "team:afl:test",
    participantType: "team",
    displayName: "Test Magpies",
    followLevel: "priority",
  }],
  "saved follow preferences and canonical participants must resolve into card enrichment"
);
app.setCanonicalParticipants([]);
app.setPreferences({});
assert.deepEqual(
  Array.from(app.getActiveEventIds()),
  publishedFeed.events.map(event => event.id),
  "a stale saved feed must not override the generated published-feed fallback at startup"
);

function memoryStorage(seed = {}){
  const values = new Map(Object.entries(seed));
  let writeCount = 0;
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value){
      writeCount += 1;
      values.set(key, String(value));
    },
    snapshot: () => Object.fromEntries(values),
    writeCount: () => writeCount,
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
const themeUpdatedProfile = profileStorage.saveSection(
  legacyProfileStorage,
  reloadedProfile,
  "preferences",
  { ...reloadedProfile.preferences, theme: "night" },
  { now: new Date("2026-07-20T00:03:00Z") }
);
const staleBundleUpdate = profileStorage.saveSection(
  legacyProfileStorage,
  reloadedProfile,
  "ratings",
  { ...reloadedProfile.ratings, "new-event": 8 },
  { now: new Date("2026-07-20T00:04:00Z") }
);
assert.equal(staleBundleUpdate.preferences.theme, "night", "a stale bundle write must preserve newer settings already committed for the profile");
assert.equal(staleBundleUpdate.profile.usernameLabel, "Changed display name", "section writes must preserve the latest profile metadata");
const writesBeforeRepeat = legacyProfileStorage.writeCount();
const repeatedProfile = profileStorage.saveSection(
  legacyProfileStorage,
  staleBundleUpdate,
  "ratings",
  staleBundleUpdate.ratings,
  { now: new Date("2026-07-20T00:05:00Z") }
);
assert.equal(repeatedProfile.profile.updatedAt, staleBundleUpdate.profile.updatedAt, "repeating the same profile update must not create a new write timestamp");
assert.equal(legacyProfileStorage.writeCount(), writesBeforeRepeat, "repeating the same profile update must be a storage no-op");
const partialBundleUpdate = profileStorage.saveBundle(legacyProfileStorage, {
  profile: { id: reloadedProfile.profile.id, usernameLabel: "Latest label" },
  preferences: themeUpdatedProfile.preferences,
}, { now: new Date("2026-07-20T00:06:00Z") });
assert.equal(partialBundleUpdate.ratings["new-event"], 8, "partial profile commits must preserve previously stored sections");
assert.equal(partialBundleUpdate.eventUserState["legacy-event"].archived, true, "partial profile commits must preserve earlier event state");
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
assert.equal(app.mergePreferences(null).version, 10, "the seeded league defaults must use the current preference migration");
assert.deepEqual(Array.from(app.mergePreferences(null).followedSports), ["nrl", "afl"], "new profiles must surface Rugby League and AFL immediately");
assert.deepEqual(Array.from(app.mergePreferences(null).selectedSelectorEntityIds), ["sport:nrl", "sport:afl"], "new profiles must seed the two complete league selectors");
const incompleteEmptyProfile = app.mergePreferences({
  version: 7,
  onboardingComplete: false,
  selectedSelectorEntityIds: [],
  followedSports: [],
});
assert.deepEqual(Array.from(incompleteEmptyProfile.followedSports), ["nrl", "afl"], "incomplete empty profiles must migrate to the seeded league defaults");
const completedEmptyProfile = app.mergePreferences({
  version: 8,
  onboardingComplete: true,
  selectedSelectorEntityIds: [],
  followedSports: [],
});
assert.deepEqual(Array.from(completedEmptyProfile.followedSports), ["nrl", "afl"], "completed empty v8 profiles must migrate to the seeded league defaults");
const currentExplicitEmptyProfile = app.mergePreferences({
  version: 10,
  onboardingComplete: true,
  selectedSelectorEntityIds: [],
  followedSports: [],
});
assert.deepEqual(Array.from(currentExplicitEmptyProfile.followedSports), [], "current-version explicit empty profiles must remain empty");
assert.deepEqual(
  Array.from(app.mergePreferences({ followedSports: ["wimbledon", "fifa"] }).selectedSelectorEntityIds),
  ["special:wimbledon", "special:fifa-world-cup"],
  "legacy event-brand preferences must migrate into Special Events without creating Sports duplicates"
);
assert(!Array.from(app.BASE_SPORT_SELECTOR_ENTITIES, entity => entity.id).some(id => ["sport:wimbledon", "sport:fifa", "sport:tdf", "sport:masters", "sport:lemans", "sport:nfl", "sport:cwg"].includes(id)), "event brands must not also appear under Sports");
assert.equal(Array.from(app.BASE_SPORT_SELECTOR_ENTITIES).find(entity => entity.id === "sport:nba")?.label, "Basketball", "Sports must use the broad Basketball label rather than an NBA Finals event label");

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
assert(publishedCwgCards.every(event => app.selectorEntityMatchesEvent("special:commonwealth-games", event)), "every Commonwealth Games card must map to the Special Events preference domain");
assert.equal(app.getPreferenceMatchedEvents(new Date("2026-07-24T00:00:00Z")).filter(event => event.key === "cwg").length, 34, "existing profiles must retain every Commonwealth Games card after the selector taxonomy updates");
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

const publishedAustraliaIreland = publishedFeed.events.find(item => item.id === "aflw-australia-ireland-2026-08-01");
assert(publishedAustraliaIreland, "the published feed must contain Australia v Ireland at North Sydney Oval");
assert.equal(publishedAustraliaIreland.key, "afl", "AFLW representative cards must inherit the AFL sport key");
app.setEvents([publishedAustraliaIreland]);
app.setActions({});
app.setPreferences({
  selectedSelectorEntityIds: ["sport:nrl"],
  followedSports: ["nrl"],
  selectedBroadcasters: ["nine"],
});
assert.equal(app.eventIsEditorialMustShow(publishedAustraliaIreland), true, "Australia v Ireland must qualify as an editorial must-show card at 4/5 stakes");
assert.deepEqual(
  Array.from(app.getPreferenceMatchedEvents(new Date("2026-08-03T05:00:00Z")), item => item.id),
  ["aflw-australia-ireland-2026-08-01"],
  "a 4/5 Australia v Ireland AFLW card must appear regardless of followed sports or selected broadcasters"
);
const lowerStakesAflwFixture = {
  ...publishedAustraliaIreland,
  id: "aflw-under-afl-preference",
  eventId: "aflw-under-afl-preference",
  date: "2026-08-04",
  status: "upcoming",
  stakesScore: 3,
  storyline: { ...publishedAustraliaIreland.storyline, stakes: 3, intensity: 3 },
};
app.setEvents([lowerStakesAflwFixture]);
app.setPreferences({
  selectedSelectorEntityIds: ["sport:afl"],
  followedSports: ["afl"],
  selectedBroadcasters: ["kayo"],
});
assert.deepEqual(
  Array.from(app.getPreferenceMatchedEvents(new Date("2026-08-03T05:00:00Z")), item => item.id),
  ["aflw-under-afl-preference"],
  "a lower-stakes AFLW fixture must inherit the ordinary AFL follow setting"
);

const recentWallabiesJapan = publishedFeed.events.find(item => item.id === "rugby-japan-australia-2026-08-08");
const recentRugbyReference = new Date("2026-08-11T02:00:00.000Z");
assert(recentWallabiesJapan, "the published feed must retain Japan v Australia from 8 August");
app.setEvents([recentWallabiesJapan]);
app.setActions({});
app.setPreferences({
  selectedSelectorEntityIds: ["sport:rugby"],
  followedSports: ["rugby"],
  selectedBroadcasters: [],
});
app.setActiveFilter("sport:rugby");
assert.equal(app.eventMeetsDerivedRetention(recentWallabiesJapan, recentRugbyReference), true, "Japan v Australia must remain inside the 14-day retained-card window on 11 August");
assert.equal(app.eventIsAutoArchived(recentWallabiesJapan, recentRugbyReference), false, "Japan v Australia must remain in the active feed until seven days after it finishes");
assert.equal(app.feedFilterMatchesEvent("sport:rugby", recentWallabiesJapan), true, "Japan v Australia must match the focused Rugby filter");
assert.equal(
  app.focusedRecentPastDateKey([recentWallabiesJapan.date, "2026-08-11", "2026-08-15"], "2026-08-11", "sport:rugby"),
  "2026-08-08",
  "focused Rugby entry must anchor the latest retained result before Today"
);
assert.equal(
  app.focusedRecentPastDateKey([recentWallabiesJapan.date, "2026-08-15"], "2026-08-11", "all"),
  null,
  "the all-sports feed must keep its existing priority-or-Today entry anchor"
);
const focusedSportFilterIds = app.allSelectorEntities()
  .filter(entity => entity.categoryType === "sport")
  .map(entity => entity.id);
assert(focusedSportFilterIds.length >= 5, "the cross-sport entry regression must cover the surfaced sport taxonomy");
focusedSportFilterIds.forEach(filterId => {
  assert.equal(
    app.focusedRecentPastDateKey([recentWallabiesJapan.date, "2026-08-15"], "2026-08-11", filterId),
    "2026-08-08",
    `${filterId} must enter at its latest retained past date when one exists`
  );
});
assert.deepEqual(
  Array.from(app.getPreferenceMatchedEvents(recentRugbyReference), item => item.id),
  ["rugby-japan-australia-2026-08-08"],
  "the focused Rugby view must retain Japan v Australia on 11 August even without a selected provider"
);
app.setArchivedEventRefs([{
  id: "archive:profile:existing:rugby-japan-australia-2026-08-08",
  profileId: "profile:existing",
  canonicalEventId: "rugby-japan-australia-2026-08-08",
  archivedAt: "2026-08-09T00:00:00.000Z",
}]);
assert.deepEqual(
  Array.from(app.focusedArchivedEvents(recentRugbyReference), item => item.id),
  ["rugby-japan-australia-2026-08-08"],
  "an existing profile archive must keep a retained Rugby result discoverable inside the focused Rugby view"
);
app.setArchivedEventRefs([]);
app.setActiveFilter("all");
app.setPreferences({});

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
const seenRecentAustralianMarquee = {
  ...eventFromReference("seen-recent-australian-marquee", rankingReference, -20, 5, "Kayo Freebies", 5),
  status: "completed",
  australianInterest: true,
  surfacePinnedUntil: new Date(rankingReference.getTime() + 24 * 3600 * 1000).toISOString(),
};
const regularNewCard = eventFromReference("regular-new-card", rankingReference, 1, 5, "SBS On Demand", 5);
app.setEvents([regularNewCard, seenRecentAustralianMarquee]);
app.setSurfacePresentation({
  [app.surfacePresentationKey(regularNewCard)]: {
    firstSurfacedAt: new Date(rankingReference.getTime() - 30 * 60 * 1000).toISOString(),
    seenAt: null,
  },
  [app.surfacePresentationKey(seenRecentAustralianMarquee)]: {
    firstSurfacedAt: new Date(rankingReference.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
    seenAt: new Date(rankingReference.getTime() - 60 * 60 * 1000).toISOString(),
  },
});
assert.deepEqual(
  Array.from(app.partitionSurfacedEvents([regularNewCard, seenRecentAustralianMarquee], { reference: rankingReference }).newItems, ev => ev.id),
  ["seen-recent-australian-marquee", "regular-new-card"],
  "a seen recent Australian marquee card must remain first above the initial Today jump until its explicit pin expires"
);
assert.deepEqual(
  Array.from(app.partitionSurfacedEvents([seenRecentAustralianMarquee], {
    reference: new Date(rankingReference.getTime() + 25 * 3600 * 1000),
  }).seenItems, ev => ev.id),
  ["seen-recent-australian-marquee"],
  "an Australian marquee card must return to its chronological date group after its explicit pin expires"
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
  { ...event("routine-afl", 4, 2), key: "afl", sport: "AFL", canonicalEventId: "event:afl:routine", sportDomainId: "sport:afl", competitionId: "competition:afl-premiership-2026" },
  { ...event("routine-nrl", 4, 2), key: "nrl", sport: "NRL", canonicalEventId: "event:nrl:routine", sportDomainId: "sport:nrl", competitionId: "competition:nrl-premiership-2026", participantIds: ["team:nrl:hidden"] },
];
app.setEvents(phaseOneEvents);
app.setActions({});

assert(!app.getFilteredEvents().some(ev => ev.id === "below-floor"), "events below stakes 3/5 must be excluded");
assert(!app.getFilteredEvents().some(ev => ev.id === "routine-afl"), "routine AFL fixtures must not clutter the selective home feed");
let allLeagueFixturesGraph = app.PREFERENCE_SYSTEM.createPreferenceGraph({
  profileId: "profile:all-league-fixtures",
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: ["kayo", "foxtel"],
});
allLeagueFixturesGraph = app.PREFERENCE_SYSTEM.setCoverageMode(allLeagueFixturesGraph, "sport:afl", "all");
allLeagueFixturesGraph = app.PREFERENCE_SYSTEM.setCoverageMode(allLeagueFixturesGraph, "sport:nrl", "all");
app.setPreferences({
  selectedSelectorEntityIds: ["sport:afl", "sport:nrl"],
  preferenceGraph: allLeagueFixturesGraph,
});
assert(app.getFilteredEvents().some(ev => ev.id === "routine-afl"), "AFL All fixtures coverage must expose routine fixtures in the feed");
assert.deepEqual(
  Array.from(app.getFilteredEvents().filter(ev => ev.id.startsWith("routine-")), ev => ev.id).sort(),
  ["routine-afl", "routine-nrl"],
  "All fixtures coverage must expose routine AFL and NRL cards in the All calendar"
);
app.setPreferences({});

let focusedSportGraph = app.PREFERENCE_SYSTEM.createPreferenceGraph({
  profileId: "profile:focused-sport-froth",
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: ["kayo", "foxtel"],
});
app.setPreferences({
  selectedSelectorEntityIds: ["sport:afl", "sport:nrl"],
  selectedBroadcasters: ["nine"],
  preferenceGraph: focusedSportGraph,
});
app.setActiveFilter("sport:nrl");
assert(!app.getFilteredEvents().some(ev => ev.id === "routine-nrl"), "the NRL Worth Watching query must remain curated while All Fixtures reads canonical truth");
app.setActiveFilter("sport:afl");
assert(!app.getFilteredEvents().some(ev => ev.id === "routine-afl"), "the AFL Worth Watching query must remain curated while All Fixtures reads canonical truth");
assert(focusedSportGraph.domainPreferences.every(preference => preference.includeAllFixtures === false), "sport-hub entry must not mutate saved coverage preferences");
let mutedFocusedSportGraph = app.PREFERENCE_SYSTEM.setEntityFollow(focusedSportGraph, "team:nrl:hidden", "mute");
app.setPreferences({
  selectedSelectorEntityIds: ["sport:afl", "sport:nrl"],
  selectedBroadcasters: ["nine"],
  preferenceGraph: mutedFocusedSportGraph,
});
app.setActiveFilter("sport:nrl");
assert(!app.getFilteredEvents().some(ev => ev.id === "routine-nrl"), "curated sport-hub events must continue to respect an explicit participant mute");
app.setActiveFilter("all");
assert.equal(app.getFilteredEvents().some(ev => ev.id.startsWith("routine-")), false, "returning to All must restore the saved selective coverage behavior");
assert.equal(new Set(app.getFilteredEvents().map(ev => ev.id)).size, app.getFilteredEvents().length, "focused sport switching must not duplicate cards");

for (const sportKey of ["nrl", "afl"]){
  const canonicalFixtures = sportHubs.canonicalFixturesForSport(canonicalSports, sportKey);
  const currentRound = sportHubs.currentRoundNumber(canonicalFixtures);
  const initialWindow = sportHubs.fixturesForRoundWindow(canonicalFixtures, currentRound, 2);
  const expectedRoundNumbers = new Set(sportHubs.roundWindow(canonicalFixtures, currentRound, 2).map(round => round.roundNumber));
  const expectedIds = canonicalFixtures.filter(event => expectedRoundNumbers.has(event.roundNumber)).map(event => event.id).sort();
  assert.deepEqual(initialWindow.map(event => event.id).sort(), expectedIds, `${sportKey.toUpperCase()} All Fixtures must contain every canonical fixture in its current and next rounds`);
  const views = sportHubs.buildFixtureViews(initialWindow, { feedCards: publishedFeed.events, participants: canonicalSports.participants });
  assert.equal(views.length, initialWindow.length, `${sportKey.toUpperCase()} fixture rendering must never depend on a published enrichment card existing`);
}
app.setPreferences({});

const calendarSyncPreferences = {
  selectedSelectorEntityIds: ["sport:afl", "sport:nrl"],
  selectedBroadcasters: ["kayo", "foxtel"],
  preferenceGraph: allLeagueFixturesGraph,
};
const calendarSyncConfig = app.calendarSyncConfigForPreferences(calendarSyncPreferences);
assert.deepEqual(Array.from(calendarSyncConfig.sports), ["afl", "nrl"], "Calendar sync must encode followed sports");
assert.deepEqual(Array.from(calendarSyncConfig.providers), ["foxtel", "kayo"], "Calendar sync must encode selected providers");
assert.deepEqual(Array.from(calendarSyncConfig.allFixtures), ["afl", "nrl"], "Calendar sync must encode Froth or All-fixtures depth");
assert.deepEqual(Array.from(calendarSyncConfig.majorFollowedSports), ["afl", "nrl"], "Calendar sync must encode domains where followed teams or competitors can add routine events");
assert.deepEqual(Array.from(calendarSyncConfig.followedParticipantIds), []);
assert.deepEqual(Array.from(calendarSyncConfig.mutedParticipantIds), []);
assert.deepEqual(Array.from(calendarSyncConfig.excludedCompetitionIds), []);
assert.deepEqual(Array.from(calendarSyncConfig.cwgDisciplines), []);
const calendarSyncUrl = app.buildCalendarSyncUrl(calendarSyncPreferences, {
  protocol: "http:",
  hostname: "127.0.0.1",
  origin: "http://127.0.0.1:8000",
});
assert.match(calendarSyncUrl, /^https:\/\/nothingsport\.vercel\.app\/api\/calendar\?/);
const calendarSyncParams = new URL(calendarSyncUrl).searchParams;
assert.equal(calendarSyncParams.get("sports"), "afl,nrl");
assert.equal(calendarSyncParams.get("providers"), "foxtel,kayo");
assert.equal(calendarSyncParams.get("all"), "afl,nrl");
assert.equal(calendarSyncParams.get("majorFollowed"), "afl,nrl");
assert.equal(calendarSyncParams.get("min"), "3");
assert.equal(app.buildCalendarWebcalUrl(calendarSyncPreferences, {
  protocol: "https:",
  hostname: "nothingsport.vercel.app",
  origin: "https://nothingsport.vercel.app",
}).startsWith("webcal://nothingsport.vercel.app/api/calendar?"), true, "calendar-app subscription must use the webcal scheme");

let followedCalendarGraph = app.PREFERENCE_SYSTEM.createPreferenceGraph({
  profileId: "profile:follow-aware-calendar",
  domainIds: ["sport:f1", "special:commonwealth-games"],
  broadcasterIds: ["kayo", "stan"],
});
followedCalendarGraph = app.PREFERENCE_SYSTEM.setCoverageMode(followedCalendarGraph, "sport:f1", "majorFollowed");
followedCalendarGraph = app.PREFERENCE_SYSTEM.setCoverageMode(followedCalendarGraph, "special:commonwealth-games", "majorFollowed");
followedCalendarGraph = app.PREFERENCE_SYSTEM.setEntityFollow(followedCalendarGraph, "competitor:f1:oscar-piastri", "priority");
followedCalendarGraph = app.PREFERENCE_SYSTEM.setEntityFollow(followedCalendarGraph, "competitor:cwg:liz-watson", "follow");
followedCalendarGraph = app.PREFERENCE_SYSTEM.setEntityFollow(followedCalendarGraph, "competitor:f1:muted-driver", "mute");
followedCalendarGraph = app.PREFERENCE_SYSTEM.upsertCompetitionPreference(
  followedCalendarGraph,
  "competition:f1:excluded",
  { enabled: false }
);
const followedCalendarPreferences = {
  selectedSelectorEntityIds: ["sport:f1", "cwg:swimming"],
  selectedBroadcasters: ["kayo"],
  preferenceGraph: followedCalendarGraph,
};
const followedCalendarConfig = app.calendarSyncConfigForPreferences(followedCalendarPreferences);
assert.deepEqual(Array.from(followedCalendarConfig.sports), ["cwg", "f1"]);
assert.deepEqual(Array.from(followedCalendarConfig.majorFollowedSports), ["cwg", "f1"]);
assert.deepEqual(Array.from(followedCalendarConfig.followedParticipantIds), [
  "competitor:cwg:liz-watson",
  "competitor:f1:oscar-piastri",
]);
assert.deepEqual(Array.from(followedCalendarConfig.mutedParticipantIds), ["competitor:f1:muted-driver"]);
assert.deepEqual(Array.from(followedCalendarConfig.excludedCompetitionIds), ["competition:f1:excluded"]);
assert.deepEqual(Array.from(followedCalendarConfig.cwgDisciplines), ["swimming"], "a CWG subdiscipline selection must narrow the live calendar feed");
const followedCalendarUrl = new URL(app.buildCalendarSyncUrl(followedCalendarPreferences, {
  protocol: "https:",
  hostname: "nothingsport.vercel.app",
  origin: "https://nothingsport.vercel.app",
}));
assert.equal(followedCalendarUrl.searchParams.get("follow"), "competitor:cwg:liz-watson,competitor:f1:oscar-piastri");
assert.equal(followedCalendarUrl.searchParams.get("mute"), "competitor:f1:muted-driver");
assert.equal(followedCalendarUrl.searchParams.get("excludeCompetition"), "competition:f1:excluded");
assert.equal(followedCalendarUrl.searchParams.get("cwg"), "swimming");
assert.match(app.calendarSyncSummaryText(followedCalendarConfig), /2 followed teams or competitors/);
assert.match(app.calendarSyncSummaryText(followedCalendarConfig), /1 muted/);
assert.match(app.calendarSyncSummaryText(followedCalendarConfig), /CWG Swimming/);

const selectedIcs = app.generateICS([phaseOneEvents[4], phaseOneEvents[5]]);
assert.equal((selectedIcs.match(/BEGIN:VEVENT/g) || []).length, 2, "calendar file must contain only the selected events");
assert.match(selectedIcs, /^BEGIN:VCALENDAR/);
assert.match(selectedIcs, /TZID:Australia\/Sydney/);
assert.match(selectedIcs, /END:VCALENDAR$/);
assert.match(selectedIcs, /UID:worth-week@sportscal/);
assert.match(selectedIcs, /UID:around@sportscal/);
assert.doesNotMatch(selectedIcs, /UID:horizon-exception@sportscal/);
assert.doesNotMatch(selectedIcs, /UID:top-week@sportscal/);
assert.match(selectedIcs, /Priority event:/);
assert.doesNotMatch(selectedIcs, /Don’t Miss:|Never Miss:/);

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

const pastA = event("past-a", -2, 4);
const pastB = event("past-b", -1, 3);
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
assert.equal(app.cardRetractionSpaceForHeights(727.25, 198.265625), 528.984375, "collapsed cards must retain their removed height while a downward scroll is active");
assert.equal(app.cardRetractionVisualOffset(528.984375), 528.984375, "the compact card must occupy the retained height before it is reclaimed");
assert.equal(app.cardScrollDirection(1200, 1100), "up", "upward reversal must be detected while temporary card space is retained");
assert.equal(app.cardScrollDirection(1100, 1200), "down", "continued downward scrolling must keep temporary card space until it settles");
assert.equal(app.cardScrollDirection(1200, 1200), "still", "unchanged scroll positions must not be treated as a direction reversal");
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
assert.equal(app.eventLocationLabel({ venue: "Optus Stadium, Perth" }), "Perth");
assert.equal(app.eventLocationLabel({ venue: "Melbourne Cricket Ground" }), "Melbourne");
assert.equal(app.eventLocationLabel({ venue: "Scottish Event Campus" }), "Glasgow");
assert.equal(app.eventLocationLabel({}), "Location TBC");
assert.equal(app.eventTimeLabel({ time: "20:00", venue: "Optus Stadium, Perth" }), "8:00pm · Perth");
assert(!app.eventTimeLabel({ time: "20:00", venue: "Optus Stadium, Perth" }).includes("Sydney"), "event cards must show the event location rather than the viewer timezone");

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
assert.equal(app.retrospectiveSignificanceForEvent(pastB).effectiveStakes, 4, "retrospective quality must raise derived significance without changing canonical stakes");
const chronologicalPast = app.sortUpcomingFirst([pastB, pastA]).filter(event => event.id.startsWith("past"));
assert.deepEqual(Array.from(chronologicalPast, event => event.id), ["past-a", "past-b"], "retrospective quality must not reorder past events");
assert.equal(app.archiveEvent(pastB, { preserve: true }), true, "a rated card must be savable to Archive");
assert.equal(app.getEventAction(pastB).saved, true, "saving a rated card must set its retention exemption");
assert.equal(app.getArchivedEventRefs().some(reference => reference.canonicalEventId === pastB.id), true, "saving must create an explicit profile-scoped archive reference");
assert.equal(app.archiveEvent(pastA, { preserve: true }), false, "an unrated card must not be savable");
assert.equal(app.getEventAction(pastA).archived, false, "a rejected unrated Save must not change archive state");
app.archiveEvent(pastA);
assert.equal(app.getEventAction(pastA).archived, true, "archive action must persist");
assert.equal(app.getEventAction(pastA).saved, false, "plain Archive must not grant indefinite retention");
assert.equal(app.isSpoilerVisible(pastA), true, "archiving a PAST event must reveal it");
assert.equal(app.getArchivedEventRefs().some(reference => reference.canonicalEventId === pastA.id), true, "archive must create an explicit profile-scoped reference");
assert(app.getDerivedCardCache().derivedCards.every(card => card.isArchived === false), "archive state must never leak into disposable cache records");
app.clearAndRebuildDerivedCardCache();
assert.equal(app.archivedEvents().some(event => event.id === pastA.id), true, "archive view must rebuild from canonical events after a full cache purge");
const olderThanRetention = { ...event("older-than-retention", -20, 4), status: "completed" };
assert.equal(app.eventMeetsDerivedRetention(olderThanRetention), false, "unarchived past cards must expire after 14 days");

const autoArchivedAfterSevenDays = { ...event("auto-archived-after-seven-days", -8, 4), status: "completed" };
const expiredAfterFourteenDays = { ...event("expired-after-fourteen-days", -15, 4), status: "completed" };
const savedPastRetention = { ...event("saved-past-retention", -20, 4), status: "completed" };
app.setEvents([autoArchivedAfterSevenDays, expiredAfterFourteenDays, savedPastRetention]);
app.setActions({});
app.setPreferences({});
app.setRatings({ [savedPastRetention.id]: 9 });
assert.equal(app.archiveEvent(savedPastRetention, { preserve: true }), true, "rated Save must preserve a card beyond normal retention");
assert.equal(app.eventIsAutoArchived(autoArchivedAfterSevenDays), true, "unsaved cards must auto-archive after seven days");
assert.equal(app.getFilteredEvents().some(event => event.id === autoArchivedAfterSevenDays.id), false, "auto-archived cards must leave active feeds");
assert.equal(app.archivedEvents().some(event => event.id === autoArchivedAfterSevenDays.id), true, "the Archived screen must rebuild automatic seven-day archive entries from canonical events");
assert.equal(app.getPreferenceMatchedEvents().some(event => event.id === expiredAfterFourteenDays.id), false, "unsaved cards must disappear after fourteen days");
assert.equal(app.getPreferenceMatchedEvents().some(event => event.id === savedPastRetention.id), true, "rated cards saved to Archive must remain available after fourteen days");
assert.equal(app.getDerivedCardCache().derivedCards.some(card => card.canonicalEventId === savedPastRetention.id && card.retentionExempt), true, "saved cards must remain explicitly exempt in the disposable cache");

const winterTimestamp = app.formatFeedbackTimestamp(new Date("2026-07-16T10:00:00Z"));
const summerTimestamp = app.formatFeedbackTimestamp(new Date("2026-12-16T10:00:00Z"));
assert.match(winterTimestamp, /AEST$/, "winter feedback timestamps must use AEST");
assert.match(summerTimestamp, /AEDT$/, "summer feedback timestamps must use AEDT");
const feedbackMessage = app.buildFeedbackMessage("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z"));
assert.match(feedbackMessage, /^nothingsport feedback/);
assert.match(feedbackMessage, /Category: Bug report/);
assert.match(feedbackMessage, /Sent from nothingsport$/);
assert.match(app.buildFeedbackSmsUrl("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z")), /^sms:0437041326\?&body=/);

console.log("nothingsport phase rules verified");
