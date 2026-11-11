"use strict";

const { spawnSync } = require("node:child_process");
const { REPOSITORY, VERSION, fail, hash, instant, validateDataset } = require("./core");
const TYPES = "[CLOSED_EVENT,REOPENED_EVENT,MERGED_EVENT,CONVERT_TO_DRAFT_EVENT,READY_FOR_REVIEW_EVENT]";
const EVENTS = "pageInfo{hasNextPage endCursor} nodes{__typename " +
  "...on ClosedEvent{id createdAt} ...on ReopenedEvent{id createdAt} " +
  "...on MergedEvent{id createdAt commit{oid}} ...on ConvertToDraftEvent{id createdAt} ...on ReadyForReviewEvent{id createdAt}}";
const LIST = 'query($cursor:String,$order:IssueOrder!){repository(owner:"hartican",name:"sportscal"){' +
  "pullRequests(first:25,after:$cursor,orderBy:$order){totalCount pageInfo{hasNextPage endCursor} " +
  "nodes{id number createdAt updatedAt isDraft state url headRefOid mergeCommit{oid} " +
  "timelineItems(first:100,itemTypes:" + TYPES + "){" + EVENTS + "}}}}}";
const MORE = 'query($number:Int!,$cursor:String){repository(owner:"hartican",name:"sportscal"){' +
  "pullRequest(number:$number){timelineItems(first:100,after:$cursor,itemTypes:" + TYPES + "){" + EVENTS + "}}}}";
const typeMap = { ClosedEvent: "closed", ReopenedEvent: "reopened", MergedEvent: "merged", ConvertToDraftEvent: "draft", ReadyForReviewEvent: "ready" };
function connection(value) {
  if (!value || !Array.isArray(value.nodes) || typeof value.pageInfo?.hasNextPage !== "boolean" || (value.pageInfo.hasNextPage && !value.pageInfo.endCursor)) fail("invalid_page");
  return value;
}
function ghRequest({ query, variables, timeout, maxBytes }) {
  // Existing gh authentication only. No shell, token extraction, new scopes, retries or mutation query.
  const result = spawnSync("gh", ["api", "graphql", "--input", "-"], {
    input: JSON.stringify({ query, variables }), encoding: "utf8",
    timeout, maxBuffer: maxBytes, killSignal: "SIGTERM", windowsHide: true,
  });
  if (result.error) fail(result.error.code === "ETIMEDOUT" ? "time_budget" : result.error.code === "ENOBUFS" ? "byte_budget" : "github_transport_error");
  if (result.status !== 0) fail("github_request_failed");
  return { body: JSON.parse(result.stdout), bytes: Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr || "") };
}
async function collect({ previous = null, request = ghRequest, clock = Date.now, maxRequests, maxMs, maxBytes = 25_000_000 } = {}) {
  if (previous) validateDataset(previous);
  const incremental = Boolean(previous);
  const requestCeiling = incremental ? 25 : 300, timeCeiling = incremental ? 60_000 : 300_000;
  maxRequests ??= requestCeiling;
  maxMs ??= timeCeiling;
  if (![maxRequests, maxMs, maxBytes].every(n => Number.isSafeInteger(n) && n > 0) || maxRequests > requestCeiling || maxMs > timeCeiling || maxBytes > 25_000_000) fail("invalid_budget");
  const started = clock(), asOf = new Date(started).toISOString();
  const pages = [], pulls = new Map((previous?.pulls || []).map(p => [p.number, p]));
  const seenPulls = new Set(), seenNodes = new Map(), seenListCursors = new Set();
  let requests = 0, bytes = 0, expectedTotal = null;
  const since = previous ? instant(previous.asOf) - 300_000 : null;
  async function page(query, variables, kind) {
    if (requests >= maxRequests) fail("request_budget");
    const remaining = maxMs - (clock() - started);
    if (remaining <= 0) fail("time_budget");
    if (bytes >= maxBytes) fail("byte_budget");
    requests++;
    const result = await request({ query, variables, timeout: Math.min(remaining, 30_000), maxBytes: Math.min(maxBytes - bytes, 5_000_000) });
    bytes += result.bytes;
    if (!Number.isSafeInteger(result.bytes) || result.bytes < 0 || bytes > maxBytes) fail("byte_budget");
    if (clock() - started > maxMs) fail("time_budget");
    if (result.body?.errors?.length || !result.body?.data?.repository) fail("github_partial_response");
    const response = result.body.data.repository;
    pages.push({ kind, variables, queryHash: hash(query), responseHash: hash(response), ingestedAt: new Date(clock()).toISOString(), response });
    return response;
  }
  try {
    let cursor = null, done = false;
    while (!done) {
      const root = await page(LIST, { cursor, order: { field: incremental ? "UPDATED_AT" : "CREATED_AT", direction: incremental ? "DESC" : "ASC" } }, "pulls");
      const list = connection(root.pullRequests);
      if (!Number.isSafeInteger(list.totalCount) || list.totalCount < 0) fail("invalid_total_count");
      expectedTotal = list.totalCount;
      let reachedWatermark = false;
      for (const node of list.nodes) {
        instant(node.createdAt); instant(node.updatedAt);
        if (incremental && instant(node.updatedAt) < since) { reachedWatermark = true; continue; }
        if (seenPulls.has(node.number)) {
          if (seenNodes.get(node.number) !== hash(node)) fail("moving_page_duplicate");
          continue;
        }
        seenPulls.add(node.number);
        seenNodes.set(node.number, hash(node));
        let events = connection(node.timelineItems).nodes.slice();
        let eventInfo = node.timelineItems.pageInfo;
        const seenEventCursors = new Set();
        while (eventInfo.hasNextPage) {
          const after = eventInfo.endCursor;
          if (seenEventCursors.has(after)) fail("repeated_timeline_cursor");
          seenEventCursors.add(after);
          const more = await page(MORE, { number: node.number, cursor: after }, "lifecycle");
          const next = connection(more.pullRequest?.timelineItems);
          events.push(...next.nodes); eventInfo = next.pageInfo;
        }
        const unique = new Map();
        for (const event of events) {
          if (!event || !typeMap[event.__typename] || typeof event.id !== "string") fail("unexpected_lifecycle_event");
          if (unique.has(event.id) && hash(unique.get(event.id)) !== hash(event)) fail("conflicting_event_identity");
          if (!unique.has(event.id)) unique.set(event.id, event);
        }
        if (node.url !== "https://github.com/" + REPOSITORY + "/pull/" + node.number) fail("unexpected_source_url");
        pulls.set(node.number, {
          id: node.id, number: node.number, createdAt: node.createdAt, updatedAt: node.updatedAt,
          currentDraft: node.isDraft, currentState: node.state, observedAt: new Date(clock()).toISOString(),
          url: node.url, headSha: node.headRefOid, mergeSha: node.mergeCommit?.oid || null,
          events: [...unique.values()].map((e, order) => ({
            id: e.id, type: typeMap[e.__typename], at: e.createdAt, order,
            ...(e.commit?.oid ? { commit: e.commit.oid } : {}),
          })),
        });
      }
      done = !list.pageInfo.hasNextPage || reachedWatermark;
      if (!done) {
        const next = list.pageInfo.endCursor;
        if (seenListCursors.has(next) || next === cursor) fail("repeated_pull_cursor");
        seenListCursors.add(next); cursor = next;
      }
    }
    if (pulls.size !== expectedTotal) fail("enumeration_count_mismatch");
    const data = {
      schemaVersion: VERSION, repository: REPOSITORY, complete: true, asOf,
      completedAt: new Date(clock()).toISOString(), mode: incremental ? "incremental" : "initial",
      coverage: { pullCount: pulls.size, refreshedPulls: seenPulls.size, expectedTotal, requests, bytes,
        elapsedMs: clock() - started, overlapSeconds: incremental ? 300 : null, timeZone: "Australia/Sydney" },
      sourcePages: pages,
      previousExportHash: previous ? hash(previous) : null,
      pulls: [...pulls.values()].sort((a, b) => a.number - b.number),
    };
    validateDataset(data);
    return data;
  } catch (error) {
    return { schemaVersion: VERSION, repository: REPOSITORY, complete: false, asOf,
      completedAt: new Date(clock()).toISOString(), error: { code: error.code || "invalid_source_response" },
      coverage: { requests, bytes, elapsedMs: clock() - started, partialPulls: seenPulls.size, expectedTotal },
      sourcePages: pages };
  }
}
async function replayCapture(capture, previous = null) {
  const replayStarted = Date.now();
  if (!Array.isArray(capture?.sourcePages) || !capture.sourcePages.length) fail("capture_pages_required");
  let time = instant(capture.asOf), index = 0;
  const data = await collect({ previous, clock: () => time, request: async input => {
    const page = capture.sourcePages[index++];
    if (!page || hash(input.query) !== page.queryHash || hash(input.variables) !== hash(page.variables) || hash(page.response) !== page.responseHash) fail("capture_provenance_mismatch");
    time = instant(page.ingestedAt);
    return { body: { data: { repository: page.response } }, bytes: 0 };
  } });
  if (data.complete && index !== capture.sourcePages.length) fail("unused_capture_pages");
  if (data.complete) {
    data.provenance = { method: "offline_capture_replay", captureHash: hash(capture), captureComplete: capture.complete,
      captureCoverage: capture.coverage, originalObservedAt: capture.asOf, replayedAt: new Date().toISOString() };
    data.coverage.requests = 0; data.coverage.bytes = 0;
    data.coverage.elapsedMs = Date.now() - replayStarted;
  }
  return data;
}
module.exports = { collect, replayCapture, ghRequest, LIST, MORE };
