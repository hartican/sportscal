"use strict";

const { DashboardError } = require("./access");
const BUCKET = "ns-dashboard-private";
function serviceHeaders(config) {
  return { apikey: config.serviceKey, ...(config.serviceKey.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + config.serviceKey }) };
}
async function boundedBody(response, maximum, signal) {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) { await response.body?.cancel(); throw new DashboardError("dashboard_response_limit"); }
  if (!response.body?.getReader) throw new DashboardError("dashboard_response_invalid");
  const reader = response.body.getReader(), chunks = []; let total = 0;
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new DashboardError("dashboard_timeout");
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maximum) throw new DashboardError("dashboard_response_limit");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { signal.removeEventListener("abort", cancel); await reader.cancel().catch(() => {}); }
}
function createTransport(config, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  let rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  deadline.catch(() => {});
  const timer = setTimeout(() => { controller.abort(); rejectDeadline(new DashboardError("dashboard_timeout")); }, Math.max(1, Math.min(timeoutMs, 5000)));
  let calls = 0;
  async function request(route, { headers, method = "GET", body, maxBytes }) {
    if (controller.signal.aborted || ++calls > 5) throw new DashboardError("dashboard_request_limit");
    try {
      const response = await Promise.race([fetchImpl(config.url + route, { method, headers: { Accept: "application/json", ...headers }, body, redirect: "error", cache: "no-store", signal: controller.signal }), deadline]);
      if (!response.ok) { await response.body?.cancel(); throw new DashboardError(response.status === 401 ? "sign_in_required" : response.status === 403 ? "forbidden" : "dashboard_source_unavailable", response.status === 401 || response.status === 403 ? response.status : 503); }
      const bytes = await Promise.race([boundedBody(response, maxBytes, controller.signal), deadline]);
      return { bytes, json: () => { try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new DashboardError("dashboard_source_invalid"); } } };
    } catch (error) { if (error instanceof DashboardError) throw error; throw new DashboardError(controller.signal.aborted ? "dashboard_timeout" : "dashboard_source_unavailable"); }
  }
  return {
    async authorize(token, owner) {
      const result = await request("/rest/v1/rpc/ns_dashboard_authorize_session", { method: "POST", headers: { apikey: config.publishableKey, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ expected_owner: owner }), maxBytes: 64 });
      if (result.json() !== true) throw new DashboardError("forbidden", 403);
    },
    async object(name, maxBytes) {
      if (!["latest.json", "refresh/status.json"].includes(name) && !/^snapshots\/[a-f0-9]{64}\.json$/.test(name)) throw new DashboardError("dashboard_object_invalid");
      return request("/storage/v1/object/authenticated/" + BUCKET + "/" + name, { headers: serviceHeaders(config), maxBytes });
    },
    close() { clearTimeout(timer); controller.abort(); },
  };
}
module.exports = { BUCKET, boundedBody, createTransport };
