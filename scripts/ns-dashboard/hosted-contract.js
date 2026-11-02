"use strict";

const { isDeepStrictEqual } = require("node:util");
const { VERSION, REPOSITORY, instant, hash } = require("./core");
const { projectBriefing } = require("./briefing");
const { DashboardError, bytesHash } = require("../../lib/ns-dashboard/access");
const MAX_SNAPSHOT = 256 * 1024;
const privateText = /(?:\/Users\/|\/private\/|\/tmp\/|file:\/\/|[A-Z]:\\|Bearer\s|sb_secret_|sbp_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{12,}\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
function bad() { throw new DashboardError("dashboard_payload_invalid"); }
function text(value, max = 2000) { if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value) || privateText.test(value)) bad(); return value; }
function timestamp(value) { try { instant(value); return value; } catch { bad(); } }
function count(value) { if (!Number.isSafeInteger(value) || value < 0) bad(); return value; }
function nullable(value, check) { return value == null ? null : check(value); }
function list(value, check, max = 100) { if (!Array.isArray(value) || value.length > max) bad(); return value.map(check); }
function choice(value, choices) { if (!choices.includes(value)) bad(); return value; }
function boolean(value) { if (typeof value !== "boolean") bad(); return value; }
function sha(value, length) { if (typeof value !== "string" || !new RegExp("^[a-f0-9]{" + length + "}$").test(value)) bad(); return value; }
function ref(value) {
  if (typeof value !== "string" || !value || value.length > 4000) bad();
  if (/^receipt:[a-f0-9]{64}$/.test(value)) return value;
  try { const u = new URL(value); if (u.protocol === "https:" && u.hostname === "github.com" && /^\/hartican\/sportscal\/(pull\/\d+|actions\/runs\/\d+|commit\/[a-f0-9]{40})$/.test(u.pathname) && !u.username && !u.password && !u.search && !u.hash) return u.href; } catch {}
  return "receipt:" + hash(value);
}
function verification(v) {
  return { id: text(v.id, 120), deploymentId: text(v.deploymentId, 120), sha: sha(v.sha, 40), version: nullable(v.version, x => text(x, 80)), alias: text(v.alias, 200), verifiedAt: timestamp(v.verifiedAt), expiresAt: timestamp(v.expiresAt), result: choice(v.result, ["passed", "failed"]), scope: text(v.scope), sourceUrl: ref(v.sourceUrl) };
}
function release(r = {}) {
  const d = r.deployed;
  return {
    merged: r.merged ? { sha: sha(r.merged.sha, 40), at: timestamp(r.merged.at), sourceUrl: ref(r.merged.sourceUrl) } : null,
    deployed: d ? { id: text(d.id, 120), sha: sha(d.sha, 40), state: choice(d.state, ["READY"]), environment: choice(d.environment, ["production"]), alias: text(d.alias, 200), activatedAt: timestamp(d.activatedAt), classification: choice(d.classification, ["application", "mixed", "data-only", "unknown"]), sourceUrl: ref(d.sourceUrl) } : null,
    verifiedLive: nullable(r.verifiedLive, verification),
    verificationScopes: list(r.verificationScopes || [], s => ({ scope: text(s.scope), state: choice(s.state, ["fresh", "stale", "failed", "ambiguous"]), latestObservation: verification(s.latestObservation) }), 30),
  };
}
function decision(d) {
  return { id: text(d.id, 120), title: text(d.title, 240), action: text(d.action), status: choice(d.status, ["pending", "approved", "declined", "resolved"]), observedAt: timestamp(d.observedAt), source: ref(d.source) };
}
function normalizeProjection(p) {
  if (!p || p.schemaVersion !== VERSION) bad();
  const asOf = timestamp(p.generatedAt), r = release(p.release), f = p.freshness || {}, backlog = p.currentBacklogAtCollection;
  const out = {
    schemaVersion: VERSION, definitionVersion: text(p.definitionVersion, 40), repository: REPOSITORY, generatedAt: asOf,
    sourceExportHash: sha(p.sourceExportHash, 64),
    freshness: { state: choice(f.state, ["fresh", "stale", "error", "loading", "empty", "partial"]), lastSuccessfulRefresh: nullable(f.lastSuccessfulRefresh, timestamp), lastAttempt: nullable(f.lastAttempt, timestamp), error: f.error ? { code: text(f.error.code, 80) } : null, coverage: { pullCount: nullable(f.coverage?.pullCount, count), expectedTotal: nullable(f.coverage?.expectedTotal, count) } },
    currentBacklogAtCollection: backlog ? { cutoff: timestamp(backlog.cutoff), complete: boolean(backlog.complete), open: nullable(backlog.open, count), drafts: nullable(backlog.drafts, count) } : null,
    windows: list(p.windows || [], w => ({ days: choice(w.days, [7, 28]), start: timestamp(w.start), end: timestamp(w.end), flow: { openings: count(w.flow.openings), reopenings: nullable(w.flow.reopenings, count), merges: count(w.flow.merges), unmergedClosures: count(w.flow.unmergedClosures) } }), 2),
    queue: null, queueCoverage: { status: "not_measured" }, release: r, briefing: null,
  };
  const times = [out.freshness.lastSuccessfulRefresh, out.freshness.lastAttempt, backlog?.cutoff, r.merged?.at, r.deployed?.activatedAt, ...r.verificationScopes.map(s => s.latestObservation.verifiedAt)].filter(Boolean);
  if (times.some(t => instant(t) > instant(asOf))) bad();
  for (const w of out.windows) if (instant(w.start) >= instant(w.end) || !backlog || instant(w.end) > instant(backlog.cutoff)) bad();
  for (const s of r.verificationScopes) {
    const v = s.latestObservation, d = r.deployed;
    if (!d || s.scope !== v.scope || v.deploymentId !== d.id || v.sha !== d.sha || v.alias !== d.alias || instant(v.verifiedAt) < instant(d.activatedAt) || instant(v.expiresAt) <= instant(v.verifiedAt)) bad();
    if (s.state === "fresh" && (v.result !== "passed" || instant(v.expiresAt) <= instant(asOf)) || s.state === "stale" && (v.result !== "passed" || instant(v.expiresAt) > instant(asOf)) || s.state === "failed" && v.result !== "failed") bad();
  }
  if (r.verifiedLive && !r.verificationScopes.some(s => s.state === "fresh" && isDeepStrictEqual(s.latestObservation, r.verifiedLive))) bad();
  if (p.briefing) {
    const b = p.briefing;
    out.briefing = projectBriefing({ source: ref(b.source), observedAt: timestamp(b.observedAt), complete: boolean(b.complete),
      published: list(b.published, x => ({ id: text(x.id, 120), title: text(x.title, 240), summary: text(x.summary), deploymentId: text(x.deploymentId, 120), verificationId: text(x.verificationId, 120) })),
      work: list(b.work, x => ({ id: text(x.id, 120), title: text(x.title, 240), state: choice(x.state, ["waiting", "blocked", "in_progress"]), reason: text(x.reason), owner: text(x.owner, 80), nextAction: text(x.nextAction), prNumbers: list(x.prNumbers, count, 30) })),
      decisions: list(b.decisionHistory || b.decisions, decision),
    }, r, asOf);
  }
  return out;
}
function envelope(projection, preparedAt) {
  const p = normalizeProjection(projection); timestamp(preparedAt);
  if (instant(preparedAt) < instant(p.generatedAt)) bad();
  const result = { schemaVersion: "ns-dashboard-hosted.v1", preparedAt, projection: p };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_SNAPSHOT) bad();
  return result;
}
function validateEnvelope(value) {
  if (!value || value.schemaVersion !== "ns-dashboard-hosted.v1") bad();
  const normalized = envelope(value.projection, value.preparedAt);
  if (!isDeepStrictEqual(value, normalized)) bad();
  return value;
}
function serialize(projection, preparedAt) {
  const value = envelope(projection, preparedAt), bytes = Buffer.from(JSON.stringify(value) + "\n");
  if (bytes.length > MAX_SNAPSHOT) bad();
  return { value, bytes, sha256: bytesHash(bytes) };
}
module.exports = { MAX_SNAPSHOT, normalizeProjection, validateEnvelope, serialize, timestamp, sha };
