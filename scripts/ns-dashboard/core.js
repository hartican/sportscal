"use strict";

const crypto = require("node:crypto");
const REPOSITORY = "hartican/sportscal";
const VERSION = "ns-dashboard-local.v1";
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function instant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) fail("invalid_timestamp");
  const parts = value.match(/^(\d{4})-(\d\d)-(\d\d)/).slice(1).map(Number);
  const time = value.match(/T(\d\d):(\d\d):(\d\d)/).slice(1).map(Number);
  const offset = value.match(/[+-](\d\d):(\d\d)$/);
  if (time[0] > 23 || time[1] > 59 || time[2] > 59 || (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59))) fail("invalid_timestamp");
  const calendar = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (calendar.getUTCFullYear() !== parts[0] || calendar.getUTCMonth() + 1 !== parts[1] || calendar.getUTCDate() !== parts[2] || !Number.isFinite(Date.parse(value))) fail("invalid_timestamp");
  return Date.parse(value);
}
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
function localParts(ms) {
  return Object.fromEntries(formatter.formatToParts(ms).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
}
function sydneyInstant(date, hour = 12, minute = 0) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) fail("invalid_local_time");
  const [year, month, day] = date.split("-").map(Number);
  instant(date + "T00:00:00Z");
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const p = localParts(wall + delta);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - wall - delta;
  }));
  const matches = [...offsets].map(offset => wall - offset).filter(ms => {
    const p = localParts(ms);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
  });
  if (matches.length !== 1) fail(matches.length ? "ambiguous_local_time" : "nonexistent_local_time");
  return new Date(matches[0]).toISOString();
}
function completeWindows(asOf) {
  const p = localParts(instant(asOf));
  const date = [p.year, p.month, p.day].map((x, i) => String(x).padStart(i ? 2 : 4, "0")).join("-");
  return [7, 28].map(days => ({
    days,
    start: sydneyInstant(new Date(Date.UTC(p.year, p.month - 1, p.day - days)).toISOString().slice(0, 10), 0),
    end: sydneyInstant(date, 0),
    interval: "[start,end)", timeZone: "Australia/Sydney",
  }));
}
const transitions = new Set(["closed", "reopened", "merged", "draft", "ready"]);
function validatePull(pull) {
  if (!pull || typeof pull.id !== "string" || !Number.isSafeInteger(pull.number) || pull.number < 1 || typeof pull.currentDraft !== "boolean" || !["OPEN", "CLOSED", "MERGED"].includes(pull.currentState) || !Array.isArray(pull.events)) fail("invalid_pull");
  instant(pull.createdAt); instant(pull.observedAt);
  const seen = new Map();
  for (const event of pull.events) {
    if (typeof event.id !== "string" || !transitions.has(event.type) || !Number.isSafeInteger(event.order) || event.order < 0) fail("invalid_event");
    if (instant(event.at) < instant(pull.createdAt) || instant(event.at) > instant(pull.observedAt)) fail("event_outside_observation");
    if (seen.has(event.id) && hash(seen.get(event.id)) !== hash(event)) fail("conflicting_event_identity");
    seen.set(event.id, event);
  }
  const events = [...seen.values()].sort((a, b) => instant(a.at) - instant(b.at) || a.order - b.order);
  if (new Set(events.map(e => e.order)).size !== events.length) fail("ambiguous_event_order");
  return events;
}
function mergeClosure(event, events) {
  // Provider close receipts can arrive a second after merge. Once merged, a PR is terminal.
  return event.type === "closed" && events.some(e => e.type === "merged" && instant(e.at) <= instant(event.at));
}
function pullState(pull, cutoff, checkCurrent = false) {
  const events = validatePull(pull);
  const draftEvents = events.filter(e => ["draft", "ready"].includes(e.type));
  let draft = draftEvents.length ? draftEvents[0].type === "ready" : pull.currentDraft;
  let state = "OPEN";
  if (instant(pull.createdAt) > instant(cutoff)) return null;
  for (const event of events) {
    if (instant(event.at) > instant(cutoff)) break;
    if (event.type === "draft" || event.type === "ready") {
      const next = event.type === "draft";
      if (draft === next) fail("contradictory_draft_history");
      draft = next;
    } else if (mergeClosure(event, events)) {
      // GitHub emits a separate ClosedEvent for the same merge. Retain it, count it once.
    } else if (event.type === "reopened") {
      if (state !== "CLOSED") fail("contradictory_reopen");
      state = "OPEN";
    } else {
      if (state !== "OPEN") fail("contradictory_terminal_event");
      state = event.type === "merged" ? "MERGED" : "CLOSED";
    }
  }
  if (checkCurrent && (state !== pull.currentState || draft !== pull.currentDraft)) fail("metadata_lifecycle_mismatch");
  return { number: pull.number, state, draft, sourceId: pull.id, sourceUrl: pull.url };
}
function validateDataset(data) {
  if (data?.schemaVersion !== VERSION || data.repository !== REPOSITORY || data.complete !== true || !Array.isArray(data.pulls)) fail("incomplete_dataset");
  instant(data.asOf);
  const ids = new Set(), numbers = new Set();
  for (const pull of data.pulls) {
    if (ids.has(pull.id) || numbers.has(pull.number)) fail("duplicate_pull");
    ids.add(pull.id); numbers.add(pull.number);
    pullState(pull, pull.observedAt, true);
  }
  return data;
}
function snapshot(data, cutoff) {
  validateDataset(data);
  if (instant(cutoff) > instant(data.asOf)) fail("cutoff_after_collection");
  const prs = data.pulls.map(p => pullState(p, cutoff)).filter(Boolean);
  const open = prs.filter(p => p.state === "OPEN");
  return { cutoff, open: open.length, drafts: open.filter(p => p.draft).length, openPrs: open, definition: "F3/v1", complete: true };
}
function flow(data, start, end, inclusiveEnd = true, includeStart = false) {
  validateDataset(data);
  if (instant(start) >= instant(end) || instant(end) > instant(data.asOf)) fail("invalid_window");
  const inside = at => (includeStart ? instant(at) >= instant(start) : instant(at) > instant(start)) && (inclusiveEnd ? instant(at) <= instant(end) : instant(at) < instant(end));
  let openings = 0, reopenings = 0, merges = 0, unmergedClosures = 0;
  for (const pull of data.pulls) {
    if (inside(pull.createdAt)) openings++;
    const events = validatePull(pull);
    for (const e of events.filter(e => inside(e.at))) {
      if (e.type === "reopened") reopenings++;
      if (e.type === "merged") merges++;
      if (e.type === "closed" && !mergeClosure(e, events)) unmergedClosures++;
    }
  }
  const before = snapshot(data, start).open, after = snapshot(data, end).open;
  return { start, end, interval: (includeStart ? "[" : "(") + "start,end" + (inclusiveEnd ? "]" : ")"), openings, reopenings, merges, unmergedClosures,
    net: openings + reopenings - merges - unmergedClosures,
    reconciliation: inclusiveEnd && !includeStart ? { before, after, matches: before + openings + reopenings - merges - unmergedClosures === after } : null };
}
function boundedText(value, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail("invalid_operator_text");
  return value;
}
function binding(value) {
  if (!value || !["sha", "tree", "dependencies", "toolchain", "scope", "generatedAssets"].every(k => typeof value[k] === "string" && value[k])) fail("incomplete_evidence_binding");
  return Object.fromEntries(["sha", "tree", "dependencies", "toolchain", "scope", "generatedAssets"].map(k => [k, value[k]]));
}
function onlyKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail("unknown_operator_field");
}
function shaOrUnknown(value) {
  if (value !== null && !/^[a-f0-9]{40}$/.test(value)) fail("invalid_sha");
}
function evidenceValidity(proof, candidate, asOf) {
  if (!proof || !candidate) return { state: "unknown", reasons: ["missing_binding"] };
  const actual = binding(proof.binding), expected = binding(candidate);
  const reasons = Object.keys(expected).filter(k => actual[k] !== expected[k]).map(k => "changed_" + k);
  if (instant(proof.expiresAt) <= instant(asOf)) reasons.push("expired");
  return { state: reasons.length ? "invalid" : "valid", reasons };
}
function releaseProjection(records = {}, asOf) {
  instant(asOf);
  onlyKeys(records, ["alias", "merged", "deployments", "verifications"]);
  if (records.alias) boundedText(records.alias);
  if (records.merged) {
    onlyKeys(records.merged, ["sha", "at", "sourceUrl"]); shaOrUnknown(records.merged.sha);
    boundedText(records.merged.sourceUrl);
    if (instant(records.merged.at) > instant(asOf)) fail("merge_from_future");
  }
  const deployments = records.deployments || [], verifications = records.verifications || [];
  if (!Array.isArray(deployments) || !Array.isArray(verifications)) fail("invalid_release_records");
  const attempts = new Map();
  for (const d of deployments) {
    onlyKeys(d, ["id", "sha", "sourceUrl", "state", "environment", "alias", "activatedAt", "classification", "rollbackOf"]);
    boundedText(d.id); shaOrUnknown(d.sha); boundedText(d.sourceUrl);
    if (!["READY", "FAILED", "SKIPPED", "CANCELED", "BUILDING"].includes(d.state)) fail("invalid_deployment_state");
    if (d.activatedAt) { instant(d.activatedAt); boundedText(d.alias); }
    if (attempts.has(d.id) && hash(attempts.get(d.id)) !== hash(d)) fail("conflicting_deployment_identity");
    attempts.set(d.id, d);
  }
  const activations = [...attempts.values()].filter(d => d.state === "READY" && d.environment === "production" && d.alias === records.alias && d.activatedAt && instant(d.activatedAt) <= instant(asOf)).sort((a, b) => instant(a.activatedAt) - instant(b.activatedAt));
  const deployed = activations.at(-1) || null;
  if (deployed && activations.some(d => d.id !== deployed.id && d.activatedAt === deployed.activatedAt)) fail("ambiguous_activation_order");
  const matched = verifications.filter(v => {
    onlyKeys(v, ["id", "deploymentId", "sha", "version", "alias", "verifiedAt", "expiresAt", "result", "scope", "sourceUrl"]);
    boundedText(v.id); boundedText(v.scope); boundedText(v.sourceUrl); shaOrUnknown(v.sha);
    boundedText(v.alias); boundedText(v.deploymentId);
    if (v.version !== null) boundedText(v.version);
    if (!["passed", "failed"].includes(v.result)) fail("invalid_verification_result");
    instant(v.verifiedAt); instant(v.expiresAt);
    if (instant(v.expiresAt) <= instant(v.verifiedAt)) fail("invalid_verification_expiry");
    return deployed && deployed.sha && v.sha && v.deploymentId === deployed.id && v.sha === deployed.sha && v.result === "passed" && v.alias === records.alias && instant(v.verifiedAt) >= instant(deployed.activatedAt) && instant(v.verifiedAt) <= instant(asOf);
  }).sort((a, b) => instant(a.verifiedAt) - instant(b.verifiedAt)).at(-1);
  return {
    merged: records.merged || null,
    deployed,
    verifiedLive: matched && instant(matched.expiresAt) > instant(asOf) ? matched : null,
    liveEvidenceState: matched ? (instant(matched.expiresAt) > instant(asOf) ? "fresh" : "stale") : "unknown",
    observedRecordCount: attempts.size,
    attemptCount: [...attempts.values()].filter(d => d.state !== "SKIPPED").length,
    successfulActivations: activations.length,
    applicationActivations: activations.filter(d => d.classification === "application" || d.classification === "mixed").length,
    unknownCosts: { status: "not_measured", tokens: null, billedMinutes: null, cashPerOutcome: null },
  };
}
function groupQueue(data, records = {}, asOf) {
  validateDataset(data); instant(asOf);
  onlyKeys(records, ["source", "observedAt", "complete", "deliverables"]);
  if (!records.source || !records.observedAt) fail("queue_provenance_required");
  boundedText(records.source, 1000);
  instant(records.observedAt);
  if (instant(records.observedAt) > instant(asOf)) fail("queue_from_future");
  const seen = new Set(), membership = new Set(), known = new Map(data.pulls.map(p => [p.number, p]));
  return (records.deliverables || []).map(d => {
    onlyKeys(d, ["id", "owner", "stage", "nextAction", "type", "priority", "prNumbers", "stageEnteredAt", "dependencies", "membershipComplete", "proof", "candidate"]);
    boundedText(d.id); boundedText(d.owner); boundedText(d.stage); boundedText(d.nextAction);
    if (seen.has(d.id) || !Array.isArray(d.prNumbers) || !d.prNumbers.length || new Set(d.prNumbers).size !== d.prNumbers.length) fail("duplicate_deliverable_or_member");
    seen.add(d.id);
    for (const number of d.prNumbers) {
      if (!known.has(number) || membership.has(number)) fail("unknown_or_multiply_grouped_pr");
      membership.add(number);
    }
    if (d.stageEnteredAt && instant(d.stageEnteredAt) > instant(records.observedAt)) fail("stage_from_future");
    if (d.priority != null && (!Number.isSafeInteger(d.priority) || d.priority < 0)) fail("invalid_priority");
    if (d.type && !["feature", "fix", "maintenance", "test-only", "superseded", "groundwork", "unclassified"].includes(d.type)) fail("invalid_work_type");
    if (d.dependencies && (!Array.isArray(d.dependencies) || d.dependencies.some(x => typeof x !== "string" || !x))) fail("invalid_dependencies");
    return {
      id: d.id, owner: d.owner, type: d.type || "unclassified", priority: d.priority ?? null,
      stage: d.stage, stageAgeSeconds: d.stageEnteredAt ? (instant(records.observedAt) - instant(d.stageEnteredAt)) / 1000 : null,
      stageAgeAsOf: records.observedAt,
      dependencies: d.dependencies || [], nextAction: d.nextAction, membershipComplete: d.membershipComplete === true,
      prs: d.prNumbers.map(n => pullState(known.get(n), instant(asOf) < instant(data.asOf) ? asOf : data.asOf)),
      prStateAsOf: instant(asOf) < instant(data.asOf) ? asOf : data.asOf,
      candidateEvidence: d.proof || d.candidate ? evidenceValidity(d.proof, d.candidate, asOf) : { state: "unknown", reasons: ["missing_binding"] },
      // Grouping cannot create a delivered outcome. Acceptance ingestion is outside this slice.
      deliveredOutcome: { status: "not_measured", value: null },
      source: records.source, observedAt: records.observedAt,
    };
  });
}
module.exports = { REPOSITORY, VERSION, fail, hash, instant, sydneyInstant, completeWindows, validatePull, validateDataset, pullState, snapshot, flow, evidenceValidity, releaseProjection, groupQueue };
