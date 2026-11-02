"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const c = require("./core"), { collect, replayCapture } = require("./github"), local = require("./local");
const { main: projectMain } = require("./cli");
const { renderOverview, renderPages, esc, liveState, sourceState } = require("./overview");
const { overviewFixture, briefingFixture, AS_OF } = require("./overview-fixture");
const { projectBriefing } = require("./briefing");
const { writeBundle } = require("./bundle");
const ASOF = "2026-11-02T04:00:00Z", clock = () => Date.parse(ASOF);
const at = day => "2026-10-" + String(day).padStart(2, "0") + "T01:00:00Z";
function event(type, day, order) { return { id: type + ":" + order, type, at: at(day), order }; }
function pull(number, changes = {}) {
  return { id: "PR" + number, number, createdAt: at(1), updatedAt: ASOF, observedAt: ASOF,
    currentDraft: true, currentState: "OPEN", url: "https://github.com/hartican/sportscal/pull/" + number,
    events: [], ...changes };
}
function data(pulls) { return { schemaVersion: c.VERSION, repository: c.REPOSITORY, complete: true, asOf: ASOF, completedAt: ASOF, pulls }; }
function conn(nodes, next = null, totalCount) {
  return { nodes, pageInfo: { hasNextPage: next !== null, endCursor: next }, ...(totalCount === undefined ? {} : { totalCount }) };
}
function node(number, changes = {}) {
  return { id: "PR" + number, number, createdAt: at(1), updatedAt: ASOF, isDraft: true, state: "OPEN",
    url: "https://github.com/hartican/sportscal/pull/" + number, headRefOid: "a".repeat(40), mergeCommit: null, timelineItems: conn([]), ...changes };
}
function response(repository) { return { body: { data: { repository } }, bytes: 100 }; }
const BINDING = { sha: "a".repeat(40), tree: "tree", dependencies: "dep", toolchain: "node", scope: "combined", generatedAssets: "hash" };
function activation(id, sha, when, changes = {}) {
  return { id, sha, state: "READY", activatedAt: when, environment: "production", alias: "private.example.test", classification: "application", sourceUrl: "https://example.test/" + id, ...changes };
}
function verification(deploymentId, sha, changes = {}) {
  return { id: "proof", deploymentId, sha, version: "synthetic", alias: "private.example.test", verifiedAt: "2026-11-02T02:00:00Z",
    expiresAt: "2026-11-03T02:00:00Z", result: "passed", scope: "served asset hashes only", sourceUrl: "https://example.test/proof", ...changes };
}
test("older open PRs and creation boundaries include drafts without current-state shortcuts", () => {
  const d = data([pull(1), pull(2, { createdAt: at(27), currentDraft: false }), pull(3, { createdAt: at(28) })]);
  assert.equal(c.snapshot(d, at(26)).open, 1);
  assert.equal(c.snapshot(d, at(27)).open, 2);
  assert.equal(c.snapshot(d, at(27)).drafts, 1);
});
test("draft creation inferred from complete transitions, not today's draft flag", () => {
  const p = pull(1, { events: [event("ready", 25, 0), event("draft", 28, 1)] });
  assert.equal(c.snapshot(data([p]), at(24)).drafts, 1);
  assert.equal(c.snapshot(data([p]), at(26)).drafts, 0);
  assert.equal(c.snapshot(data([p]), at(28)).drafts, 1);
});
test("reopen cycles and inclusive noon boundaries reconcile; merge-close counted once", () => {
  const d = data([
    pull(1, { currentState: "MERGED", events: [event("closed", 26, 0), event("reopened", 27, 1), event("merged", 28, 2), event("closed", 28, 3)] }),
    pull(2, { createdAt: at(27), currentState: "CLOSED", events: [event("closed", 29, 0)] }),
    pull(3),
  ]);
  const result = c.flow(d, at(26), at(29));
  assert.deepEqual([result.openings, result.reopenings, result.merges, result.unmergedClosures, result.net], [1, 1, 1, 1, 0]);
  assert.equal(result.reconciliation.matches, true);
  assert.equal(c.snapshot(d, at(28)).open, 2);
});
test("complete-day flow includes start and excludes end, independently of noon reconciliation", () => {
  const d = data([pull(1, { createdAt: at(26) }), pull(2, { createdAt: at(27) })]);
  assert.equal(c.flow(d, at(26), at(27), false, true).openings, 1);
  assert.equal(c.flow(d, at(26), at(27), false, true).interval, "[start,end)");
});
test("a provider close receipt one second after merge never becomes an unmerged closure", () => {
  const d = data([pull(1, { currentState: "MERGED", events: [event("merged", 28, 0), { ...event("closed", 28, 1), at: "2026-10-28T01:00:01Z" }] })]);
  assert.equal(c.snapshot(d, at(28)).open, 0);
  assert.equal(c.flow(d, at(27), at(29)).unmergedClosures, 0);
});
test("identical events deduplicate; conflicting identity/order/state is rejected", () => {
  const e = event("closed", 28, 0);
  assert.equal(c.snapshot(data([pull(1, { currentState: "CLOSED", events: [e, e] })]), at(29)).open, 0);
  assert.throws(() => c.validateDataset(data([pull(1, { events: [e, { ...e, type: "ready" }] })])), /conflicting_event_identity/);
  assert.throws(() => c.validateDataset(data([pull(1, { events: [event("reopened", 28, 0)] })])), /contradictory_reopen/);
  assert.throws(() => c.validateDataset(data([pull(1), pull(1)])), /duplicate_pull/);
});
test("Sydney daylight saving, invalid dates and ambiguous/nonexistent wall times", () => {
  assert.equal(c.sydneyInstant("2026-10-26"), "2026-10-26T01:00:00.000Z");
  assert.equal(Date.parse(c.sydneyInstant("2026-10-04")) - Date.parse(c.sydneyInstant("2026-10-03")), 23 * 3600000);
  assert.equal(Date.parse(c.sydneyInstant("2026-04-05")) - Date.parse(c.sydneyInstant("2026-04-04")), 25 * 3600000);
  assert.throws(() => c.sydneyInstant("2026-10-04", 2, 30), /nonexistent/);
  assert.throws(() => c.sydneyInstant("2026-04-05", 2, 30), /ambiguous/);
  assert.throws(() => c.sydneyInstant("2026-02-30"), /invalid_timestamp/);
  assert.equal(c.completeWindows(ASOF)[0].end, "2026-11-01T13:00:00.000Z");
});
test("collector follows independent PR and timeline cursors; keeps source-page hashes", async () => {
  const calls = [];
  const result = await collect({ clock, request: async input => {
    calls.push(input.variables);
    if (input.variables.number) return response({ pullRequest: { timelineItems: conn([{ __typename: "ReopenedEvent", id: "reopen", createdAt: at(29) }]) } });
    if (input.variables.cursor) return response({ pullRequests: conn([node(2)], null, 2) });
    return response({ pullRequests: conn([node(1, { timelineItems: conn([{ __typename: "ClosedEvent", id: "close", createdAt: at(28) }], "timeline2") })], "prs2", 2) });
  } });
  assert.equal(result.complete, true);
  assert.deepEqual(calls.map(x => x.cursor), [null, "timeline2", "prs2"]);
  assert.equal(result.sourcePages.length, 3);
  assert.equal(result.sourcePages.every(p => c.hash(p.response) === p.responseHash), true);
  assert.equal(c.snapshot(result, at(28)).open, 1);
  assert.equal(c.snapshot(result, at(29)).open, 2);
  const replayed = await replayCapture(result);
  assert.equal(replayed.complete, true);
  assert.deepEqual(c.snapshot(replayed, at(29)), c.snapshot(result, at(29)));
  assert.equal(replayed.coverage.requests, 0);
  const broken = structuredClone(result); broken.sourcePages[0].responseHash = "wrong";
  assert.equal((await replayCapture(broken)).error.code, "capture_provenance_mismatch");
});
test("bounded requests, time, bytes, API partial data and repeated cursors fail closed", async () => {
  const source = async () => response({ pullRequests: conn([node(1)], "again", 2) });
  const partial = await collect({ clock, request: source, maxRequests: 1 });
  assert.equal(partial.complete, false); assert.equal(partial.error.code, "request_budget");
  const bytes = await collect({ clock, request: source, maxBytes: 50 });
  assert.equal(bytes.error.code, "byte_budget");
  let now = Date.parse(ASOF);
  const time = await collect({ clock: () => now, maxMs: 1, request: async () => { now += 2; return response({ pullRequests: conn([], null, 0) }); } });
  assert.equal(time.error.code, "time_budget");
  const api = await collect({ clock, request: async () => ({ body: { errors: [{ message: "never persist this" }], data: {} }, bytes: 10 }) });
  assert.equal(api.error.code, "github_partial_response"); assert.equal(JSON.stringify(api).includes("never persist"), false);
  const repeated = await collect({ clock, request: async ({ variables }) => response({ pullRequests: conn([], "again", 2) }) });
  assert.equal(repeated.error.code, "repeated_pull_cursor");
  assert.throws(() => c.snapshot(partial, at(29)), /incomplete_dataset/);
});
test("overlapping identical PR pages deduplicate; changed duplicates remain partial", async () => {
  const request = changed => async ({ variables }) => response({ pullRequests: variables.cursor
    ? conn([node(1, changed ? { isDraft: false } : {}), node(2)], null, 2)
    : conn([node(1)], "page2", 2) });
  const good = await collect({ clock, request: request(false) });
  assert.equal(good.complete, true); assert.equal(good.pulls.length, 2);
  const bad = await collect({ clock, request: request(true) });
  assert.equal(bad.complete, false); assert.equal(bad.error.code, "moving_page_duplicate");
});
test("incremental overrides only reduce the selected mode's request and time ceilings", async () => {
  const previous = data([]);
  let calls = 0;
  const request = async () => { calls++; return response({ pullRequests: conn([], null, 0) }); };
  for (const options of [{ maxRequests: 26 }, { maxMs: 60001 }, { maxRequests: 300, maxMs: 300000 }]) {
    await assert.rejects(collect({ previous, clock, request, ...options }), /invalid_budget/);
  }
  assert.equal(calls, 0);
  assert.equal((await collect({ previous, clock, request, maxRequests: 25, maxMs: 60000 })).complete, true);
  assert.equal((await collect({ previous, clock, request, maxRequests: 1, maxMs: 1 })).complete, true);
  assert.equal((await collect({ clock, request, maxRequests: 300, maxMs: 300000 })).complete, true);
});
test("incremental collection retains older PRs and refreshes changed lifecycle with overlap", async () => {
  const old = { ...data([pull(1, { observedAt: "2026-11-01T04:00:00Z", updatedAt: "2026-11-01T04:00:00Z" })]), asOf: "2026-11-01T04:00:00Z" };
  const updated = node(1, { state: "CLOSED", timelineItems: conn([{ __typename: "ClosedEvent", id: "late", createdAt: "2026-11-02T03:00:00Z" }]) });
  let mode;
  const result = await collect({ previous: old, clock, request: async ({ variables }) => {
    mode = variables.order;
    return response({ pullRequests: conn([updated, node(2), node(3, { updatedAt: "2026-10-01T01:00:00Z" })], null, 3) });
  } });
  assert.equal(result.complete, false); // An unknown old PR cannot be silently skipped from an allegedly complete previous export.
  assert.equal(result.error.code, "enumeration_count_mismatch");
  const good = await collect({ previous: old, clock, request: async () => response({ pullRequests: conn([updated, node(2)], null, 2) }) });
  assert.equal(good.complete, true); assert.equal(good.mode, "incremental");
  assert.equal(good.pulls[0].currentState, "CLOSED");
  assert.deepEqual(mode, { field: "UPDATED_AT", direction: "DESC" });
  assert.deepEqual(c.snapshot(good, at(29)), c.snapshot(good, at(29)));
});
test("partial/error and invalid complete attempts preserve last good bytes with error status", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await local.refresh(dir, async () => data([pull(1)]));
  const before = fs.readFileSync(path.join(dir, "latest.json"), "utf8");
  await local.refresh(dir, async () => ({ complete: false, completedAt: ASOF, error: { code: "request_budget" } }));
  assert.equal(fs.readFileSync(path.join(dir, "latest.json"), "utf8"), before);
  assert.equal(local.readView(dir, ASOF).freshness.state, "error");
  assert.equal(local.readView(dir, ASOF).data.pulls.length, 1);
  await local.refresh(dir, async () => data([pull(1), pull(1)]));
  assert.equal(local.readView(dir, ASOF).freshness.state, "error");
  assert.equal(fs.readFileSync(path.join(dir, "latest.json"), "utf8"), before);
});
test("private local export rejects public permissions, symlinks and Git directories", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  const loose = path.join(dir, "loose"); fs.mkdirSync(loose, { mode: 0o755 });
  fs.chmodSync(loose, 0o755);
  assert.equal(fs.statSync(loose).mode & 0o777, 0o755);
  assert.throws(() => local.privateDirectory(loose), /owner_only_directory/);
  const repo = path.join(dir, "repo"); fs.mkdirSync(repo); fs.mkdirSync(path.join(repo, ".git"));
  assert.throws(() => local.privateDirectory(path.join(repo, "output")), /output_inside_git/);
  const link = path.join(dir, "link"); fs.symlinkSync(dir, link);
  assert.throws(() => local.privateDirectory(link), /symlink_output/);
});
test("one local writer, immutable integrity, stale display and older-snapshot refusal", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let release;
  const first = local.refresh(dir, () => new Promise(resolve => { release = resolve; }));
  await assert.rejects(local.refresh(dir, async () => data([])), /collector_busy/);
  release(data([pull(1)])); await first;
  assert.equal(local.readView(dir, "2026-11-04T04:00:00Z").freshness.state, "stale");
  assert.throws(() => local.readView(dir, "2026-11-01T04:00:00Z"), /view_before_collection/);
  await local.refresh(dir, async () => ({ ...data([]), asOf: "2026-11-01T00:00:00Z" }));
  assert.equal(local.readView(dir, ASOF).freshness.error.code, "older_export_cannot_replace_last_good");
  const pointer = JSON.parse(fs.readFileSync(path.join(dir, "latest.json")));
  fs.writeFileSync(path.join(dir, "export-" + pointer.exportHash + ".json"), JSON.stringify(data([])), { mode: 0o600 });
  assert.throws(() => local.latest(dir), /snapshot_integrity_error/);
});
test("merged, READY without activation, skipped, rollback and stale live evidence remain separate", () => {
  const a = "a".repeat(40), b = "b".repeat(40), when = "2026-11-02T01:00:00Z";
  const merged = { sha: b, at: when, sourceUrl: "https://example.test/merge" };
  assert.equal(c.releaseProjection({ merged }, ASOF).deployed, null);
  const base = { alias: "private.example.test", merged, deployments: [
    activation("good", a, when), activation("good", a, when), activation("skipped", b, "2026-11-02T03:00:00Z", { state: "SKIPPED" }),
    activation("ready-only", b, null),
  ], verifications: [verification("good", a)] };
  assert.equal(c.releaseProjection(base, ASOF).verifiedLive.sha, a);
  assert.equal(c.releaseProjection(base, ASOF).attemptCount, 2);
  assert.equal(c.releaseProjection(base, ASOF).successfulActivations, 1);
  assert.equal(c.releaseProjection({ ...base, alias: "different.example.test" }, ASOF).deployed, null);
  const rollback = { ...base, deployments: [...base.deployments, activation("new", b, "2026-11-02T02:30:00Z"), activation("rollback", a, "2026-11-02T03:00:00Z", { rollbackOf: "new" })] };
  assert.equal(c.releaseProjection(rollback, ASOF).deployed.id, "rollback");
  assert.equal(c.releaseProjection(rollback, ASOF).verifiedLive, null); // Old artifact proof is not proof of this rollback activation.
  const stale = c.releaseProjection({ ...base, verifications: [verification("good", a, { expiresAt: "2026-11-02T03:00:00Z" })] }, ASOF);
  assert.equal(stale.liveEvidenceState, "stale"); assert.equal(stale.verifiedLive, null);
  assert.equal(stale.unknownCosts.cashPerOutcome, null); assert.equal(stale.unknownCosts.status, "not_measured");
});
test("deliverable grouping preserves owner priority, missing stage age and invalidation without inventing throughput", () => {
  const d = data([pull(1), pull(2)]);
  const records = { source: "owner receipt", observedAt: ASOF, complete: false, deliverables: [
    { id: "one", owner: "existing-owner", priority: 1, stage: "waiting", nextAction: "owner review", prNumbers: [1, 2],
      candidate: BINDING, proof: { binding: { ...BINDING, tree: "changed" }, expiresAt: "2026-11-03T00:00:00Z" } },
  ] };
  const grouped = c.groupQueue(d, records, ASOF);
  assert.equal(grouped.length, 1); assert.equal(grouped[0].prs.length, 2);
  assert.equal(grouped[0].stageAgeSeconds, null); assert.equal(grouped[0].deliveredOutcome.value, null);
  assert.deepEqual(grouped[0].candidateEvidence.reasons, ["changed_tree"]);
  assert.throws(() => c.groupQueue(d, { ...records, deliverables: [...records.deliverables, { ...records.deliverables[0], id: "two" }] }, ASOF), /multiply_grouped/);
  assert.throws(() => c.releaseProjection({ credential: "must not be accepted" }, ASOF), /unknown_operator_field/);
  assert.equal(c.evidenceValidity(null, BINDING, ASOF).state, "unknown");
  assert.deepEqual(c.evidenceValidity({ binding: BINDING, expiresAt: "2026-11-01T00:00:00Z" }, BINDING, ASOF).reasons, ["expired"]);
});
test("newer failures supersede passes per scope while distinct valid proof stays visible", () => {
  const sha = "a".repeat(40), when = "2026-11-02T01:00:00Z";
  const pass = verification("good", sha, { id: "pass" });
  const failure = verification("good", sha, { id: "failure", verifiedAt: "2026-11-02T03:00:00Z", result: "failed" });
  const base = { alias: "private.example.test", deployments: [activation("good", sha, when)] };
  const failed = c.releaseProjection({ ...base, verifications: [failure, pass, pass] }, ASOF);
  assert.equal(failed.verifiedLive, null); assert.equal(failed.liveEvidenceState, "failed");
  assert.equal(failed.verificationScopes[0].latestObservation.id, "failure");
  const unrelated = c.releaseProjection({ ...base, verifications: [pass, { ...failure, scope: "different journey" }] }, ASOF);
  assert.equal(unrelated.verifiedLive.id, "pass"); assert.equal(unrelated.liveEvidenceState, "partial");
  assert.equal(unrelated.verificationScopes.find(s => s.scope === "different journey").state, "failed");
  const expiredFailure = c.releaseProjection({ ...base, verifications: [pass, { ...failure, expiresAt: "2026-11-02T03:30:00Z" }] }, ASOF);
  assert.equal(expiredFailure.verifiedLive, null); assert.equal(expiredFailure.verificationScopes[0].freshness, "stale");
  const renewed = verification("good", sha, { id: "renewed", verifiedAt: "2026-11-02T03:30:00Z" });
  assert.equal(c.releaseProjection({ ...base, verifications: [pass, failure, renewed] }, ASOF).verifiedLive.id, "renewed");
  const tie = c.releaseProjection({ ...base, verifications: [pass, { ...failure, verifiedAt: pass.verifiedAt }] }, ASOF);
  assert.equal(tie.verifiedLive, null); assert.equal(tie.liveEvidenceState, "ambiguous");
  assert.throws(() => c.releaseProjection({ ...base, verifications: [pass, { ...failure, id: pass.id }] }, ASOF), /conflicting_verification_identity/);
});
test("queue observations require explicit array and completeness; invalid input preserves projection", async t => {
  const d = data([]), source = { source: "owner receipt", observedAt: ASOF, complete: true };
  for (const deliverables of [undefined, null, {}, "missing"]) {
    assert.throws(() => c.groupQueue(d, { ...source, deliverables }, ASOF), /queue_observation_required/);
  }
  for (const complete of [undefined, null, "true", 1]) {
    assert.throws(() => c.groupQueue(d, { ...source, complete, deliverables: [] }, ASOF), /queue_completeness_required/);
  }
  assert.deepEqual(c.groupQueue(d, { ...source, deliverables: [] }, ASOF), []);
  assert.deepEqual(c.groupQueue(d, { ...source, complete: false, deliverables: [] }, ASOF), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await local.refresh(dir, async () => d);
  local.atomic(dir, "projection.json", { sentinel: "last-good" });
  local.atomic(dir, "records.json", { queue: source });
  await assert.rejects(projectMain(["project", "--output", dir, "--records", path.join(dir, "records.json"), "--as-of", ASOF]), /queue_observation_required/);
  assert.deepEqual(local.readJson(path.join(dir, "projection.json")), { sentinel: "last-good" });
});

test("four offline pages escape source text and cannot load external resources", () => {
  const p = overviewFixture(), attack = '\"><script>alert(1)</script><img src="https://example.test/leak">';
  p.briefing.work[0].owner = attack; p.briefing.source = attack; p.release.merged.sourceUrl = attack;
  const pages = renderPages(p, { asOf: AS_OF });
  assert.deepEqual(Object.keys(pages), ["index.html", "delivery.html", "queue.html", "evidence.html"]);
  for (const html of Object.values(pages)) {
    assert.equal(/<(script|img|iframe|link)\b/i.test(html), false);
    assert.equal(/(?:href|src)\s*=\s*["'](?:https?:|javascript:|data:)/i.test(html), false);
    assert.equal(/@import|url\s*\(/i.test(html), false);
    assert.match(html, /connect-src &#39;none&#39;/);
    for (const name of Object.keys(pages)) assert.ok(html.includes('href="' + name + '"'));
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /href="#main"/);
  }
  assert.match(pages["index.html"], new RegExp(esc(attack).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(pages["evidence.html"].includes(esc(attack)));
  assert.equal(pages["index.html"].includes('<h1>Delivery</h1>'), false);
  assert.equal(pages["index.html"].includes('href="#delivery"'), false);
});
test("Overview answers four decisions and excludes unmeasured metrics and stale approval requests", () => {
  const pages = renderPages(overviewFixture(), { asOf: AS_OF }), html = pages["index.html"];
  for (const label of ["What shipped", "What is stuck and why", "Is delivery improving?", "What you need to do"]) assert.ok(html.includes(label));
  assert.equal((html.match(/class="answer"/g) || []).length, 4);
  assert.equal(html.includes("Review the reminder change"), false);
  assert.equal(html.includes("Reminder update approval"), false);
  assert.equal(html.includes("Choose dashboard access"), true);
  assert.equal(/Not measured|DORA measures|Model tokens|PR activity|Scoped pass/.test(html), false);
  assert.match(html, /not enough comparable delivery history/);
  assert.match(pages["queue.html"], /Decisions already made/);
  assert.match(pages["queue.html"], /Approval already received/);
  assert.match(pages["evidence.html"], /Synthetic old observation/);
});
test("missing, explicit empty, partial, refreshing and error observations remain distinct", () => {
  assert.match(renderOverview(null, { asOf: AS_OF }), /No retained snapshot/);
  const p = overviewFixture(); p.queue = null;
  assert.match(renderPages(p, { asOf: AS_OF })["queue.html"], /Queue classification is not measured/);
  p.queue = []; p.queueCoverage.complete = true;
  assert.match(renderPages(p, { asOf: AS_OF })["queue.html"], /empty queue was explicitly observed/);
  p.freshness.state = "loading";
  assert.match(renderOverview(p, { asOf: AS_OF }), /Refreshing; previous snapshot retained/);
  p.freshness.state = "error"; p.freshness.error = { code: "fixture_error" };
  const pages = renderPages(p, { asOf: AS_OF });
  assert.match(pages["index.html"], /Refresh failed; last good snapshot retained/);
  assert.match(pages["index.html"], /2 Nov 2026.*AEDT/);
  assert.match(pages["delivery.html"], /<strong>2<\/strong><span>open PRs at collection/);
  assert.match(pages["evidence.html"], /fixture_error/);
  assert.match(pages["evidence.html"], /no background polling/);
  assert.match(renderOverview({ schemaVersion: c.VERSION, freshness: { state: "error" } }, { asOf: AS_OF }), /Refresh failed. No retained snapshot/);
});
test("stale current proof never becomes current live truth; dated publication stays historical", () => {
  const p = overviewFixture(), later = "2026-11-04T04:00:00Z";
  assert.equal(liveState(p.release, AS_OF).proof.version, "Synthetic");
  assert.equal(sourceState(p, later).state, "stale"); assert.equal(liveState(p.release, later).proof, null);
  const pages = renderPages(p, { asOf: later });
  assert.match(pages["index.html"], /Stale snapshot/);
  assert.match(pages["delivery.html"], /publication verified/);
  assert.equal(pages["evidence.html"].includes('<strong class="value">Synthetic</strong>'), false);
  const failed = verification("synthetic-activation", "a".repeat(40), { id: "other", scope: "Different synthetic journey", result: "failed", verifiedAt: "2026-11-02T03:00:00Z" });
  p.release.verificationScopes.push({ scope: failed.scope, state: "failed", latestObservation: failed });
  assert.equal(liveState(p.release, AS_OF).state, "partial");
  assert.match(renderPages(p, { asOf: AS_OF })["evidence.html"], /Scoped pass · partial/);
});
test("activity and missing data never manufacture delivery improvement or zero outcomes", () => {
  const p = overviewFixture(); p.windows = []; p.currentBacklogAtCollection.complete = false;
  const pages = renderPages(p, { asOf: AS_OF });
  assert.match(pages["delivery.html"], /No source window/);
  assert.match(pages["delivery.html"], /Not measured<\/strong><span>open PRs/);
  assert.match(pages["evidence.html"], /Model tokens \/ billed minutes/);
  assert.match(pages["evidence.html"], /No complete incident/);
  assert.equal(pages["delivery.html"].includes("<strong>0</strong><span>open PRs"), false);
  p.briefing = null;
  assert.match(renderOverview(p, { asOf: AS_OF }), /No verified shipment/);
  assert.match(renderOverview(p, { asOf: AS_OF }), /No current decision summary/);
});
test("publication requires an exact deployment and scoped pass rather than a merge", () => {
  const p = overviewFixture();
  const invalid = change => { const b = briefingFixture(); change(b); return b; };
  assert.throws(() => projectBriefing(briefingFixture(), { merged: p.release.merged }, AS_OF), /publication_binding_required/);
  assert.throws(() => projectBriefing(invalid(b => b.published[0].deploymentId = "other"), p.release, AS_OF), /publication_binding_required/);
  assert.throws(() => projectBriefing(invalid(b => b.published[0].verificationId = "other"), p.release, AS_OF), /publication_binding_required/);
  const failed = structuredClone(p.release); failed.verificationScopes[0].latestObservation.result = "failed";
  assert.throws(() => projectBriefing(briefingFixture(), failed, AS_OF), /publication_binding_required/);
  assert.throws(() => projectBriefing(invalid(b => b.complete = "true"), p.release, AS_OF), /briefing_completeness_required/);
  assert.throws(() => projectBriefing(invalid(b => b.work = null), p.release, AS_OF), /briefing_array_required/);
  assert.throws(() => projectBriefing(invalid(b => b.observedAt = "2026-11-03T04:00:00Z"), p.release, AS_OF), /briefing_from_future/);
});
test("decision resolution follows dated evidence independent of input order and rejects conflicting ties", () => {
  const p = overviewFixture(), b = briefingFixture(); b.decisions.reverse();
  const r = projectBriefing(b, p.release, AS_OF);
  assert.equal(r.decisions.find(d => d.id === "synthetic-reminder-approval").status, "approved");
  b.decisions.push({ ...b.decisions.find(d => d.status === "approved"), status: "pending" });
  assert.throws(() => projectBriefing(b, p.release, AS_OF), /conflicting_decision_observation/);
});
test("bundle publishes a stable entry after complete private generation and retains it on failure", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const p = overviewFixture(), first = writeBundle(dir, p, { asOf: AS_OF });
  const before = fs.readFileSync(first.entry, "utf8"), snapshot = path.join(dir, first.generation);
  assert.ok(before.includes('href="' + first.generation + '/delivery.html"'));
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  for (const file of fs.readdirSync(snapshot)) assert.equal(fs.statSync(path.join(snapshot, file)).mode & 0o777, 0o600);
  assert.equal(fs.statSync(snapshot).mode & 0o777, 0o700);
  const manifest = local.readJson(path.join(snapshot, "manifest.json"));
  for (const row of manifest.pages) {
    const bytes = fs.readFileSync(path.join(snapshot, row.name));
    assert.equal(row.sha256, require("node:crypto").createHash("sha256").update(bytes).digest("hex"));
    assert.equal(row.bytes, bytes.length);
  }
  assert.throws(() => writeBundle(dir, { schemaVersion: "invalid" }, { asOf: AS_OF }), /invalid_overview_projection/);
  assert.equal(fs.readFileSync(first.entry, "utf8"), before);
  fs.writeFileSync(path.join(dir, ".dashboard.lock"), "busy", { mode: 0o600 });
  assert.throws(() => writeBundle(dir, p, { asOf: AS_OF }), /dashboard_busy/);
  fs.unlinkSync(path.join(dir, ".dashboard.lock"));
  const oldDelivery = fs.readFileSync(path.join(snapshot, "delivery.html"), "utf8");
  p.generatedAt = "2026-11-02T04:10:00Z";
  const next = writeBundle(dir, p, { asOf: p.generatedAt });
  assert.notEqual(first.generation, next.generation);
  assert.equal(fs.readFileSync(path.join(snapshot, "delivery.html"), "utf8"), oldDelivery);
  assert.equal(fs.existsSync(path.join(dir, ".dashboard.lock")), false);
  assert.throws(() => local.atomicText(dir, "../outside.html", "unsafe"), /invalid_export_name/);
  fs.symlinkSync(first.entry, path.join(dir, "linked.html"));
  assert.throws(() => local.atomicText(dir, "linked.html", "unsafe"), /symlink_output_denied/);
});
test("dashboard CLI reuses retained captures without changing source or last good output on bad records", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = local.privateDirectory(path.join(dir, "source")), output = path.join(dir, "dashboard");
  await projectMain(["dashboard", "--input", source, "--output", output, "--as-of", ASOF]);
  assert.match(fs.readFileSync(path.join(output, "index.html"), "utf8"), /No retained snapshot/);
  await local.refresh(source, async () => data([pull(1)]));
  local.atomic(source, "projection.json", { sentinel: "prior-projection" });
  const raw = fs.readFileSync(path.join(source, "latest.json"), "utf8");
  await projectMain(["dashboard", "--input", source, "--output", output, "--as-of", ASOF]);
  const before = fs.readFileSync(path.join(output, "index.html"), "utf8");
  local.atomic(dir, "records.json", { briefing: {} });
  await assert.rejects(projectMain(["dashboard", "--input", source, "--output", output, "--as-of", ASOF, "--records", path.join(dir, "records.json")]), /briefing_text_required/);
  assert.equal(fs.readFileSync(path.join(output, "index.html"), "utf8"), before);
  assert.equal(fs.readFileSync(path.join(source, "latest.json"), "utf8"), raw);
  assert.deepEqual(local.readJson(path.join(source, "projection.json")), { sentinel: "prior-projection" });
});
