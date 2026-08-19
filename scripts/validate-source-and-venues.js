#!/usr/bin/env node
const assert = require("node:assert/strict");
const sourceTrust = require("../config/source-trust.js");
const venues = require("../config/venue-registry.js");
const feed = require("../data/events.json");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.equal(sourceTrust.sourceTrustForEvent({ sourceType: "official" }).trust, "verified");
assert.equal(sourceTrust.sourceTrustForEvent({ sourceType: "reputable" }).label, "Unverified source");
assert.deepEqual(
  sourceTrust.mergeClaims(
    { date: "2026-08-22", score: "20-10", sourceType: "official" },
    { date: "2026-08-23", score: "25-10", sourceType: "scraped", selectedSentence: "New reporting" },
  ),
  { date: "2026-08-22", score: "20-10", sourceType: "official", selectedSentence: "New reporting", sourceTrust: "verified" },
  "unverified reporting must not overwrite verified fixture or result facts"
);
assert.equal(venues.resolve("Ocean Protect Stadium").displayName, "Shark Park");
assert.equal(venues.resolve("Accor Stadium, Sydney").displayName, "Stadium Australia");
assert.equal(venues.resolve("Marvel Stadium").displayName, "Docklands Stadium");
assert(html.includes('src="config/source-trust.js"') && html.includes('src="config/venue-registry.js"'), "the source trust and venue models must load before the app state");
assert(worker.includes('"/config/source-trust.js"') && worker.includes('"/config/venue-registry.js"'), "the source trust and venue models must remain available in the offline shell");
const audit = venues.audit(feed.events);
assert.equal(audit.total, new Set(feed.events.map(event => event.venue).filter(Boolean)).size, "the venue audit must inspect every currently published venue");
assert(audit.audited >= 25, "the registry must contain reviewed colloquial aliases rather than only a fallback");

console.log(`Source trust and venue registry valid: ${audit.total} current venues scanned; ${audit.audited} reviewed aliases, ${audit.pending.length} queued for editorial venue review.`);
