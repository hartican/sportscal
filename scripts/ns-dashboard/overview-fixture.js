"use strict";

const { VERSION, releaseProjection } = require("./core");
const AS_OF = "2026-11-02T04:00:00Z";
function overviewFixture() {
  const sha = "a".repeat(40);
  return {
    schemaVersion: VERSION, definitionVersion: "1.0.0", generatedAt: AS_OF, sourceExportHash: "a".repeat(64),
    freshness: { state: "fresh", lastSuccessfulRefresh: AS_OF, coverage: { pullCount: 2, expectedTotal: 2 } },
    currentBacklogAtCollection: { cutoff: AS_OF, complete: true, open: 2, drafts: 1 },
    windows: [7, 28].map(days => ({ days, start: days === 7 ? "2026-10-25T13:00:00Z" : "2026-10-04T13:00:00Z", end: "2026-11-01T13:00:00Z", flow: { openings: 5, merges: 3, unmergedClosures: 0 } })),
    queueCoverage: { complete: false, observedAt: AS_OF, source: "Synthetic fixture; no operational data." },
    queue: [{
      id: "synthetic-selection-persistence", owner: "Fixture owner", priority: 1, stage: "Review",
      nextAction: "Inspect the synthetic correction", stageAgeSeconds: 3600, stageAgeAsOf: AS_OF,
      observedAt: AS_OF, prStateAsOf: AS_OF, membershipComplete: true, dependencies: [],
      candidateEvidence: { state: "unknown", reasons: ["missing_binding"] }, source: "Synthetic owner record",
      prs: [{ number: 1, state: "OPEN", draft: true, sourceUrl: "https://example.test/pr/1" }, { number: 2, state: "OPEN", draft: false, sourceUrl: "https://example.test/pr/2" }],
    }],
    release: releaseProjection({
      alias: "private.example.test",
      merged: { sha, at: "2026-11-02T01:00:00Z", sourceUrl: "https://example.test/merge" },
      deployments: [{ id: "synthetic-activation", sha, state: "READY", activatedAt: "2026-11-02T01:30:00Z", environment: "production", alias: "private.example.test", classification: "application", sourceUrl: "https://example.test/deployment" }],
      verifications: [{ id: "synthetic-proof", deploymentId: "synthetic-activation", sha, version: "Synthetic", alias: "private.example.test", verifiedAt: "2026-11-02T02:00:00Z", expiresAt: "2026-11-03T02:00:00Z", result: "passed", scope: "Synthetic served assets", sourceUrl: "https://example.test/proof" }],
    }, AS_OF),
  };
}
module.exports = { overviewFixture, AS_OF };
