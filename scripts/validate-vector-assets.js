#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const vectorAssets = require("../config/vector-assets.js");
const sportRegistry = require("../config/sport-domain-registry.js");
const canonicalTaxonomy = require("../config/canonical-sports-taxonomy.js");

const html = fs.readFileSync("index.html", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const selectorSandbox = { globalThis: {} };
vm.runInNewContext(fs.readFileSync("config/selector-taxonomy.js", "utf8"), selectorSandbox, { filename: "config/selector-taxonomy.js" });
const selectorTaxonomy = selectorSandbox.globalThis.NOTHINGSPORTS_SELECTOR_TAXONOMY;

assert.equal(vectorAssets.schemaVersion, "vector-assets.v1");
assert.deepEqual(vectorAssets.rightsMetadataKinds, ["licensed", "user-supplied", "official", "open-use", "fallback"], "asset metadata must support every required rights origin");
assert.equal(sportRegistry.schemaVersion, "sport-domain-registry.v1");
assert.equal(sportRegistry.domains.length, 14, "all currently surfaced sport keys must be registry-driven");
assert.equal(new Set(sportRegistry.domains.map(domain => domain.key)).size, sportRegistry.domains.length, "sport keys must be unique");

const canonicalDomainIds = new Set(canonicalTaxonomy.sportDomains.map(domain => domain.id));
const canonicalSpecialEventIds = new Set(canonicalTaxonomy.specialEventDomains.map(domain => domain.id));
sportRegistry.domains.filter(domain => domain.domainId.startsWith("sport:")).forEach(domain => {
  assert(canonicalDomainIds.has(domain.domainId), `${domain.key} must map to a canonical sport domain`);
  assert(vectorAssets.openUse[domain.glyph] || vectorAssets.custom[domain.glyph], `${domain.key} must use a registered neutral glyph`);
});
sportRegistry.domains.filter(domain => domain.domainId.startsWith("special:")).forEach(domain => {
  assert(canonicalSpecialEventIds.has(domain.domainId), `${domain.key} must map to a canonical special-event domain`);
});
sportRegistry.domains.forEach(domain => {
  assert(domain.narrativeProfile?.id, `${domain.key} must select a sport-specific narrative profile`);
  assert(domain.narrativeProfile.signals.length > 0, `${domain.key} must configure at least one narrative signal`);
  domain.narrativeProfile.signals.forEach(signal => assert.doesNotThrow(() => new RegExp(signal.match, "i"), `${domain.key} narrative signals must compile`));
});

Object.values(vectorAssets.openUse).filter(entry => entry.render === "mask").forEach(entry => {
  assert.equal(entry.library, "Sporticon");
  assert.equal(entry.license, "Apache-2.0");
  assert(fs.existsSync(entry.path), `Sporticon file must exist: ${entry.path}`);
  assert.match(fs.readFileSync(entry.path, "utf8"), /<svg\b/i, `${entry.path} must be an SVG`);
  assert(serviceWorker.includes(`/${entry.path}`), `${entry.path} must be available offline`);
});
assert(serviceWorker.includes('/config/vector-assets.js') && serviceWorker.includes('/config/sport-domain-registry.js'), "the configuration-led asset system must be part of the offline shell");
assert(fs.existsSync("assets/licenses/SPORTICON-APACHE-2.0.txt"), "Sporticon Apache 2.0 notice must ship");
assert(fs.existsSync("assets/licenses/LUCIDE-ISC.txt"), "Lucide ISC notice must ship");

Object.values(vectorAssets.officialPermitted).forEach(entry => {
  assert(entry.permissionBasis, `${entry.key} must record a permission basis`);
  assert.equal(entry.owner, "nothingSports", "no third-party official mark may ship without a separately recorded permission basis");
  assert(fs.existsSync(entry.path), `permitted asset must exist: ${entry.path}`);
});
Object.values(vectorAssets.custom).forEach(entry => assert(["official", "fallback"].includes(entry.rightsStatus), `${entry.key} must declare whether it is first-party or a neutral fallback`));
assert.equal(vectorAssets.policy.protectedMarks, "neutral-fallback-unless-permission-recorded");
assert.equal(vectorAssets.policy.commercialRecordings, "not-bundled");

const editorialLabels = ["Must Watch", "Rivalry", "Record Chase", "Title Decider", "Upset Watch"];
editorialLabels.forEach(label => assert.match(vectorAssets.editorialMarkup(label), /<svg\b/, `${label} must render as a custom vector`));
[1, 2, 3, 4, 5].forEach(level => assert.match(vectorAssets.intensityMarkup(level), /<svg\b/, `intensity ${level} must render`));
["low", "medium", "high", "critical"].forEach(level => assert.match(vectorAssets.stakesMarkup(level), /<svg\b/, `${level} stakes must render`));
["live", "replay", "highlights", "free-to-air", "subscription", "geo-restricted"].forEach(state => assert.match(vectorAssets.broadcastMarkup(state), /<svg\b/, `${state} broadcast state must render`));
["off", "on", "synced", "missed"].forEach(state => assert.match(vectorAssets.reminderMarkup(state), /<svg\b/, `${state} reminder state must render`));

[...(selectorTaxonomy.categories || []), ...(selectorTaxonomy.specialEvents || [])].forEach(entity => {
  assert(entity.glyph, `${entity.id} must use a vector glyph key`);
  assert(vectorAssets.openUse[entity.glyph] || vectorAssets.custom[entity.glyph], `${entity.id} must reference a registered vector`);
});

const eventStart = html.indexOf("const EVENTS = [");
const eventEnd = html.indexOf("\n\nconst VECTOR_ASSETS", eventStart);
assert(eventStart >= 0 && eventEnd > eventStart, "inline canonical event payload must be discoverable");
const uiSource = `${html.slice(0, eventStart)}${html.slice(eventEnd)}`;
assert.doesNotMatch(uiSource, /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}/u, "visible interface graphics must not use emoji");
assert.match(uiSource, /function stripDecorativeGlyphs/, "legacy editorial glyphs must be removed before rendering or export");
assert.match(uiSource, /class="skip-link"/, "keyboard users must receive a skip link");
assert.match(uiSource, /prefers-reduced-motion/, "reduced-motion preferences must be honoured");
assert.doesNotMatch(uiSource, /setAttribute\("role", "button"\).*event-card/s, "event cards must not create nested interactive button roles");
assert.match(uiSource, /className = "card-expand-control"/, "event disclosure must have a native keyboard-operable button");

console.log(`Vector asset validation passed (${Object.keys(vectorAssets.openUse).length} open-use entries, ${sportRegistry.domains.length} configured sport keys).`);
