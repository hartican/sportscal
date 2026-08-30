#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const marquee = require("../config/marquee-campaigns");
const { candidateFor, canonicalJson, sha256, wrapWords } = require("./build-marquee-candidates");
const ROOT = path.resolve(__dirname, "..");
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "data/marquee-candidates.v1.json"), "utf8"));
const now = Date.parse(artifact.generatedAt);

function fixture(overrides = {}){
  return { id:"fixture:test-1", eventId:"fixture:test-1", name:"Australia v New Zealand", displayTitleCompact:"Australia v New Zealand", narrativeType:"match", status:"upcoming", startTimeUtc:new Date(now + 8 * 86400000).toISOString(), liveWindow:3, sourceName:"Official organiser", sourceUrl:"https://example.test/fixture", sourceCheckedAt:new Date(now - 86400000).toISOString(), storyline:{ stakes:5 }, ...overrides };
}
async function main(){
  assert.equal(artifact.schemaVersion, marquee.SCHEMA_VERSION);
  assert.equal(artifact.shadowMode, true, "candidate generation must remain shadow-only");
  assert.equal(artifact.summary.eligible, artifact.candidates.length);
  assert.equal(marquee.eligibility(fixture(), now).eligible, true);
  assert.equal(marquee.eligibility(fixture({ narrativeType:"race" }), now).eligible, true);
  assert.ok(marquee.eligibility(fixture({ storyline:{ stakes:4 } }), now).reasons.includes("stakes_not_five"));
  assert.ok(marquee.eligibility(fixture({ narrativeType:"all" }), now).reasons.includes("not_explicitly_atomic"));
  assert.ok(marquee.eligibility(fixture({ time:"TBC", startTimeUtc:"" }), now).reasons.includes("unconfirmed_utc_start"));
  assert.ok(marquee.eligibility(fixture({ status:"cancelled" }), now).reasons.includes("status_cancelled"));
  assert.ok(marquee.eligibility(fixture({ sourceCheckedAt:new Date(now - 121 * 86400000).toISOString() }), now).reasons.includes("stale_source_provenance"));
  assert.equal(marquee.eligibility(fixture({ narrativeType:"legacy", marqueeEligibilityOverride:{ reviewed:true, atomicType:"fixture" } }), now).eligible, true);
  assert.equal(marquee.campaignState(new Date(now + 8 * 86400000).toISOString(), now).state, "watching");
  assert.equal(marquee.campaignState(new Date(now + 6 * 86400000).toISOString(), now).state, "draft");
  assert.equal(marquee.campaignState(new Date(now + 86400000).toISOString(), now).late, true);
  assert.equal(wrapWords("An extremely long fixture title with more words than fit safely", 16, 3).length, 3);
  assert.equal(sha256(canonicalJson({ b:2, a:1 })), sha256(canonicalJson({ a:1, b:2 })));
  const noBroadcastEvent = fixture({ broadcaster:"" });
  const noBroadcastCandidate = candidateFor(noBroadcastEvent, marquee.eligibility(noBroadcastEvent, now), { version:"test", publishedAt:new Date(now).toISOString() }, now);
  assert.equal(noBroadcastCandidate.drafts.email.broadcastLine, "", "missing broadcaster copy must be omitted without blocking a valid candidate");
  const ids = new Set();
  for (const candidate of artifact.candidates){
    assert.ok(!ids.has(candidate.campaignId)); ids.add(candidate.campaignId);
    assert.equal(candidate.material.stakes, 5);
    assert.ok(candidate.timing.startTimeUtc.endsWith("Z"));
    assert.ok(Date.parse(candidate.timing.endTimeUtc) > Date.parse(candidate.timing.startTimeUtc));
    assert.ok(candidate.source.name && candidate.source.url && candidate.source.checkedAt);
    assert.ok(candidate.drafts.instagram.caption.length <= 2200);
    assert.ok(candidate.drafts.email.subject.length <= 150);
    assert.ok(candidate.drafts.email.preheader.length <= 150);
    assert.ok(candidate.drafts.email.headline.length > 0);
    assert.ok(candidate.drafts.email.bodyParagraphs.length >= 1);
    assert.ok(candidate.drafts.email.timingLine.includes(candidate.material.title));
    assert.equal(candidate.drafts.email.suggestedSendAt.utc, candidate.proposedSendAt);
    assert.ok(candidate.drafts.email.suggestedSendAt.sydney.timezone);
    assert.match(candidate.drafts.email.primaryCta.url, /^https:\/\/nothingsport\.vercel\.app\/fixture\//);
    assert.match(candidate.drafts.email.secondaryCta.url, /intent=rate$/);
    assert.equal(candidate.channels.instagram.status, "connector_blocked");
    assert.equal(candidate.channels.email.status, "connector_blocked");
    assert.equal(candidate.drafts.instagram.image.firstPartyAssetsOnly, true);
    assert.equal(candidate.drafts.email.image.publicUrl, candidate.drafts.instagram.image.publicUrl);
    assert.equal(candidate.drafts.email.image.altText, candidate.drafts.instagram.altText);
    const metadata = await sharp(path.join(ROOT, candidate.drafts.instagram.image.path.replace(/^\//, ""))).metadata();
    assert.equal(metadata.format, "jpeg"); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350);
    assert.ok(candidate.drafts.instagram.altText.includes(candidate.material.title));
  }
  assert.ok(artifact.candidates.some(candidate => candidate.drafts.email.suggestedSendAt.sydney.timezone === "AEDT"), "fixed October candidates must prove Sydney daylight-saving output");
  console.log(`Marquee candidate validation passed (${artifact.candidates.length} eligible, ${artifact.excluded.length} safely excluded).`);
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
