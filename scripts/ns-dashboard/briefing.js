"use strict";

const { instant, hash, fail } = require("./core");
function keys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail("invalid_briefing_field");
}
function text(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 4000) fail("briefing_text_required");
}
function list(value) { if (!Array.isArray(value) || value.length > 100) fail("briefing_array_required"); }
function observed(value, asOf) { instant(value); if (instant(value) > instant(asOf)) fail("briefing_from_future"); }
// Owner summaries supplement the older PR capture. They never change its cutoff or infer PR state.
function projectBriefing(records, release, asOf) {
  if (records == null) return null;
  keys(records, ["source", "observedAt", "complete", "published", "work", "decisions"]);
  text(records.source); observed(records.observedAt, asOf);
  if (typeof records.complete !== "boolean") fail("briefing_completeness_required");
  for (const name of ["published", "work", "decisions"]) list(records[name]);
  const ids = new Set();
  const published = records.published.map(row => {
    keys(row, ["id", "title", "summary", "deploymentId", "verificationId"]);
    for (const value of Object.values(row)) text(value);
    if (!["id", "title", "summary", "deploymentId", "verificationId"].every(k => row[k])) fail("publication_binding_required");
    if (ids.has(row.id)) fail("duplicate_publication"); ids.add(row.id);
    const d = release?.deployed, s = release?.verificationScopes?.find(s => s.latestObservation?.id === row.verificationId);
    const v = s?.latestObservation;
    // Publication is a dated observation, even after proof expiry. A merge, failed proof or mismatched activation cannot establish it.
    if (!d || d.id !== row.deploymentId || !v || s.state === "ambiguous" || v.result !== "passed" || v.deploymentId !== d.id || v.sha !== d.sha || v.alias !== d.alias || instant(v.verifiedAt) > instant(records.observedAt)) fail("publication_binding_required");
    return { ...row, version: v.version, sha: v.sha, verifiedAt: v.verifiedAt, scope: v.scope, source: v.sourceUrl };
  });
  ids.clear();
  const work = records.work.map(row => {
    keys(row, ["id", "title", "state", "reason", "owner", "nextAction", "prNumbers"]);
    for (const k of ["id", "title", "reason", "owner", "nextAction"]) text(row[k]);
    if (!["waiting", "blocked", "in_progress"].includes(row.state) || ids.has(row.id)) fail("invalid_briefing_work"); ids.add(row.id);
    if (!Array.isArray(row.prNumbers) || row.prNumbers.some(n => !Number.isSafeInteger(n) || n < 1) || new Set(row.prNumbers).size !== row.prNumbers.length) fail("invalid_briefing_prs");
    return { ...row };
  });
  const decisions = new Map();
  for (const row of records.decisions) {
    keys(row, ["id", "title", "action", "status", "observedAt", "source"]);
    for (const k of ["id", "title", "action", "source"]) text(row[k]); observed(row.observedAt, records.observedAt);
    if (!["pending", "approved", "declined", "resolved"].includes(row.status)) fail("invalid_decision_status");
    const prev = decisions.get(row.id);
    if (prev && instant(prev.observedAt) === instant(row.observedAt) && hash(prev) !== hash(row)) fail("conflicting_decision_observation");
    if (!prev || instant(row.observedAt) > instant(prev.observedAt)) decisions.set(row.id, { ...row });
  }
  return { source: records.source, observedAt: records.observedAt, complete: records.complete, published, work, decisions: [...decisions.values()], decisionHistory: records.decisions };
}
module.exports = { projectBriefing };
