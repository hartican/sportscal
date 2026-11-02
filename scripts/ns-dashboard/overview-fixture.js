"use strict";

const { VERSION, releaseProjection } = require("./core");
const { projectBriefing } = require("./briefing");
const AS_OF = "2026-11-02T04:00:00Z";
function overviewFixture() {
  const sha = "a".repeat(40);
  const p = {
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
  p.briefing = projectBriefing(briefingFixture(), p.release, AS_OF);
  return p;
}
function briefingFixture() {
  return {
    source: "Synthetic owner briefing", observedAt: AS_OF, complete: false,
    published: [{ id: "synthetic-release", title: "Selection-saving update", summary: "The selection-saving update has been published.", deploymentId: "synthetic-activation", verificationId: "synthetic-proof" }],
    work: [{ id: "synthetic-reminder", title: "Reminder update", state: "waiting", reason: "Approved; waiting for release checks and live verification.", owner: "Fixture release owner", nextAction: "Complete the release checks", prNumbers: [3] }],
    decisions: [
      { id: "synthetic-reminder-approval", title: "Reminder update approval", action: "Review the reminder change", status: "pending", observedAt: "2026-11-02T02:00:00Z", source: "Synthetic old observation" },
      { id: "synthetic-reminder-approval", title: "Reminder update approval", action: "Approval already received; release checks remain.", status: "approved", observedAt: "2026-11-02T03:00:00Z", source: "Synthetic approval receipt" },
      { id: "synthetic-dashboard-access", title: "Choose dashboard access", action: "Review the proposed private web page on the existing services.", status: "pending", observedAt: AS_OF, source: "Synthetic access proposal" },
    ],
  };
}
module.exports = { overviewFixture, briefingFixture, AS_OF };
