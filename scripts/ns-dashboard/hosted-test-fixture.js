"use strict";
const { overviewFixture, AS_OF } = require("./overview-fixture");
const { serialize } = require("./hosted-contract");
const { createHandler } = require("../../lib/ns-dashboard/handler");
const { DashboardError, PROJECT_URL, COOKIE } = require("../../lib/ns-dashboard/access");
const OWNER = "11111111-1111-4111-8111-111111111111", SESSION = "22222222-2222-4222-8222-222222222222", OTHER = "33333333-3333-4333-8333-333333333333";
const NOW = Date.parse(AS_OF), ENV = { NS_DASHBOARD_ENABLED: "1", NS_DASHBOARD_OWNER_SUBJECT: OWNER, NS_DASHBOARD_READINESS_SHA256: "a".repeat(64), SUPABASE_URL: PROJECT_URL, SUPABASE_PUBLISHABLE_KEY: "synthetic-public", SUPABASE_SECRET_KEY: "sb_secret_SYNTHETIC" };
function token(changes = {}, meta = {}) {
  return [Buffer.from(JSON.stringify({ alg: "HS256", ...meta })).toString("base64url"), Buffer.from(JSON.stringify({ sub: OWNER, session_id: SESSION, role: "authenticated", iss: PROJECT_URL + "/auth/v1", exp: NOW / 1000 + 3600, ...changes })).toString("base64url"), "syntheticSignature"].join(".");
}
function response() {
  return { headers: {}, statusCode: null, body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(s) { this.statusCode = s; return this; },
    json(v) { this.body = v; this.headers["content-type"] = "application/json"; return this; }, send(v) { this.body = v; return this; }, end() { return this; },
  };
}
function harness(options = {}) {
  const s = serialize(overviewFixture(), AS_OF), objects = new Map();
  const set = (key, value) => objects.set(key, Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value)));
  set("latest.json", { schemaVersion: "ns-dashboard-latest.v1", sha256: s.sha256, publishedAt: AS_OF, previous: null });
  set("snapshots/" + s.sha256 + ".json", s.bytes);
  set("refresh/status.json", { schemaVersion: "ns-dashboard-refresh.v1", state: "idle", attemptedAt: AS_OF, errorCode: null });
  const calls = [], auth = [];
  const factory = () => ({ async authorize(t, owner) { auth.push({ token: t, owner }); if (options.authError) throw options.authError; if (options.denied) throw new DashboardError("forbidden", 403); }, async object(name) { calls.push(name); const bytes = objects.get(name); if (!bytes) throw new DashboardError("dashboard_source_unavailable"); return { bytes, json: () => JSON.parse(bytes) }; }, close() {} });
  const handler = createHandler({ environment: { ...ENV, ...options.environment }, now: () => options.now || NOW, transportFactory: factory });
  return { s, set, calls, auth, handler, async run(route = "overview", changes = {}) { const res = response(); await handler({ method: "GET", url: "/api/dashboard", query: { route }, headers: { host: "www.nothingsport.app", cookie: COOKIE + "=" + token(), authorization: "Bearer " + token(), "x-ns-dashboard-transport": "fetch-v1", ...changes.headers }, ...Object.fromEntries(Object.entries(changes).filter(([k]) => k !== "headers")) }, res); return res; } };
}
module.exports = { OWNER, SESSION, OTHER, NOW, ENV, token, response, harness };
