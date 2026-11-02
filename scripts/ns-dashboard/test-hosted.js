"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { overviewFixture, AS_OF } = require("./overview-fixture");
const { normalizeProjection, serialize, validateEnvelope } = require("./hosted-contract");
const { createHandler, BRIDGE } = require("../../lib/ns-dashboard/handler");
const { DashboardError, PROJECT_URL, COOKIE, bytesHash } = require("../../lib/ns-dashboard/access");
const { createTransport } = require("../../lib/ns-dashboard/transport");
const { prepare } = require("./prepare-hosted");
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
  return { s, set, calls, auth, handler, async run(route = "overview", changes = {}) { const res = response(); await handler({ method: "GET", url: "/api/dashboard", query: { route }, headers: { host: "www.nothingsport.app", cookie: COOKIE + "=" + token(), ...changes.headers }, ...Object.fromEntries(Object.entries(changes).filter(([k]) => k !== "headers")) }, res); return res; } };
}
test("hosted sanitizer excludes raw records and paths; canonical envelope rejects unknown payload", () => {
  const p = overviewFixture(); p.privateRawExport = { secret: "must not travel" }; p.briefing.source = "/Users/synthetic/private/receipt.json";
  const s = serialize(p, AS_OF); validateEnvelope(s.value);
  const text = s.bytes.toString(); assert.equal(/privateRawExport|must not travel|\/Users\//.test(text), false); assert.match(text, /receipt:[a-f0-9]{64}/);
  assert.equal(s.value.projection.windows[0].flow.reopenings, null);
  const bad = structuredClone(s.value); bad.projection.customerRows = []; assert.throws(() => validateEnvelope(bad), /dashboard_payload_invalid/);
  for (const value of ["owner@example.test", "/private/fixture", "sb_secret_SYNTHETIC", OWNER]) { const bad = overviewFixture(); bad.briefing.work[0].nextAction = value; assert.throws(() => serialize(bad, AS_OF), /dashboard_payload_invalid/); }
});
test("publication and approval semantics survive normalization without invented trend", () => {
  const p = normalizeProjection(overviewFixture()); assert.equal(p.briefing.published.length, 1); assert.equal(p.briefing.decisions.find(d => d.id === "synthetic-reminder-approval").status, "approved");
  const bad = overviewFixture(); bad.release.verifiedLive.sha = "b".repeat(40); assert.throws(() => normalizeProjection(bad), /dashboard_payload_invalid/);
  const future = overviewFixture(); future.currentBacklogAtCollection.cutoff = "2026-11-03T04:00:00Z"; assert.throws(() => normalizeProjection(future), /dashboard_payload_invalid/);
});
test("disabled, missing identity/readiness or wrong project config never reaches storage", async () => {
  for (const environment of [{ NS_DASHBOARD_ENABLED: "0" }, { NS_DASHBOARD_OWNER_SUBJECT: "" }, { NS_DASHBOARD_READINESS_SHA256: "" }, { SUPABASE_URL: "https://other.example.test" }]) {
    const h = harness({ environment }), r = await h.run(); assert.equal(r.statusCode, 503); assert.equal(h.calls.length, 0); assert.equal(h.auth.length, 0);
  }
});
test("anonymous pages show a nonsensitive sign-in bridge; data and HEAD deny without reads", async () => {
  for (const route of ["overview", "delivery", "queue", "evidence", "data"]) {
    const h = harness(), r = await h.run(route, { headers: { cookie: "" } }); assert.equal(r.statusCode, 401); assert.equal(h.calls.length, 0); assert.equal(h.auth.length, 0);
    assert.equal(JSON.stringify(r.body).includes("Selection-saving update"), false);
    if (route !== "data") { assert.match(r.body, /Use my Nothing Sport sign-in/); assert.match(r.headers["content-security-policy"], /sha256-/); }
    const head = await h.run(route, { method: "HEAD", headers: { cookie: "" } }); assert.equal(head.statusCode, 401); assert.equal(h.calls.length, 0);
  }
});
test("non-owner, expired, malformed and ambiguous tokens cannot use storage", async () => {
  for (const t of [token({ sub: OTHER }), token({ exp: NOW / 1000 }), token({ session_id: "bad" }), token({}, { alg: "none" }), "not-a-token"]) {
    const h = harness(), r = await h.run("data", { headers: { cookie: COOKIE + "=" + t } }); assert.ok([401, 403].includes(r.statusCode)); assert.equal(h.auth.length, 0); assert.equal(h.calls.length, 0);
  }
  const h = harness(); assert.equal((await h.run("data", { headers: { authorization: "Bearer " + token({ exp: NOW / 1000 + 50 }) } })).statusCode, 401); assert.equal(h.calls.length, 0);
});
test("current admin removal, revoked session and authorization faults deny every response", async () => {
  for (const route of ["overview", "delivery", "queue", "evidence", "data"]) {
    const h = harness({ denied: true }), r = await h.run(route); assert.equal(r.statusCode, 403); assert.equal(h.auth.length, 1); assert.equal(h.calls.length, 0);
    const fault = harness({ authError: new Error("private raw failure must not leak") }), failed = await fault.run(route); assert.equal(failed.statusCode, 503); assert.equal(JSON.stringify(failed.body).includes("private raw"), false); assert.equal(fault.calls.length, 0);
  }
});
test("every successful page/data/HEAD reauthorizes; four pages use real canonical routes", async () => {
  const h = harness();
  for (const route of ["overview", "delivery", "queue", "evidence", "data"]) {
    const before = h.auth.length, r = await h.run(route); assert.equal(r.statusCode, 200); assert.equal(h.auth.length, before + 1);
    assert.equal(r.headers["cache-control"], "private, no-store, max-age=0"); assert.equal(r.headers["vercel-cdn-cache-control"], "no-store"); assert.equal(r.headers["access-control-allow-origin"], undefined);
    if (route !== "data") {
      for (const url of ["/admin/dashboard", "/admin/dashboard/delivery", "/admin/dashboard/queue", "/admin/dashboard/evidence"]) assert.ok(r.body.includes('href="' + url + '"'));
      assert.equal(r.body.includes("Static local copy"), false); assert.match(r.headers["content-type"], /text\/html/); assert.equal(/href="(?:index|delivery|queue|evidence)\.html"/.test(r.body), false);
    }
    const head = await h.run(route, { method: "HEAD" }); assert.equal(head.statusCode, 200); assert.equal(h.auth.length, before + 2); assert.equal(head.body, undefined);
  }
});
test("direct aliases, forwarded host spoofing, unexpected methods and route overrides deny", async () => {
  const h = harness();
  for (const host of ["nothingsport.app", "preview.vercel.app", "localhost:1234"]) assert.equal((await h.run("data", { headers: { host, "x-forwarded-host": "www.nothingsport.app" } })).statusCode, 404);
  assert.equal((await h.run("data", { method: "POST", headers: { origin: "https://www.nothingsport.app" } })).statusCode, 405);
  assert.equal((await h.run("data", { query: { route: ["data", "overview"] } })).statusCode, 404);
  assert.equal((await h.run("data", { query: { route: "data", bucket: "other" } })).statusCode, 404); assert.equal(h.calls.length, 0);
});
test("session exchange requires same-origin verified bearer and sets only bounded secure cookie", async () => {
  const h = harness();
  for (const origin of [undefined, "https://attacker.example.test"]) { const r = await h.run("session", { method: "POST", headers: { origin, authorization: "Bearer " + token() } }); assert.equal(r.statusCode, 403); }
  const r = await h.run("session", { method: "POST", headers: { origin: "https://www.nothingsport.app", authorization: "Bearer " + token() } });
  assert.equal(r.statusCode, 204); assert.equal(h.auth.length, 1); assert.equal(h.calls.length, 0);
  assert.match(r.headers["set-cookie"], /^__Host-ns-dashboard=/); assert.match(r.headers["set-cookie"], /Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=900$/); assert.equal(r.body, undefined);
  const body = await h.run("session", { method: "POST", headers: { origin: "https://www.nothingsport.app", authorization: "Bearer " + token(), "content-length": "2" } }); assert.equal(body.statusCode, 400);
  const end = await h.run("session", { method: "DELETE", headers: { origin: "https://www.nothingsport.app" } }); assert.equal(end.statusCode, 204); assert.match(end.headers["set-cookie"], /Max-Age=0/);
  assert.equal(/refresh_token|password|localStorage|sessionStorage/.test(BRIDGE), false);
});
test("refreshing/error/stale facts retain last-good counts and separate source clock", async () => {
  for (const state of ["refreshing", "error"]) { const h = harness(); h.set("refresh/status.json", { schemaVersion: "ns-dashboard-refresh.v1", state, attemptedAt: AS_OF, errorCode: state === "error" ? "refresh_failed" : null }); const r = await h.run("data"); assert.equal(r.statusCode, 200); assert.equal(r.body.projection.currentBacklogAtCollection.open, 2); assert.equal(r.body.projection.freshness.state, state === "error" ? "error" : "loading"); assert.equal(r.body.projection.currentBacklogAtCollection.cutoff, AS_OF); }
  const h = harness({ now: NOW + 2 * 86400000 }); const r = await h.run("overview", { headers: { cookie: COOKIE + "=" + token({ exp: NOW / 1000 + 2 * 86400 + 3600 }) } }); assert.equal(r.statusCode, 200); assert.match(r.body, /Stale snapshot/);
});
test("bad current hash falls back only to explicit previous valid snapshot; missing data is not zero", async () => {
  const h = harness(); h.set("latest.json", { schemaVersion: "ns-dashboard-latest.v1", sha256: "b".repeat(64), publishedAt: AS_OF, previous: { sha256: h.s.sha256, publishedAt: AS_OF } }); h.set("snapshots/" + "b".repeat(64) + ".json", Buffer.from('not the recorded hash'));
  const r = await h.run("data"); assert.equal(r.statusCode, 200); assert.equal(r.body.fallback, true); assert.equal(r.body.projection.freshness.state, "error"); assert.equal(r.body.projection.currentBacklogAtCollection.open, 2);
  h.set("latest.json", { schemaVersion: "ns-dashboard-latest.v1", sha256: "c".repeat(64), publishedAt: AS_OF, previous: null }); const missing = await h.run("data"); assert.equal(missing.statusCode, 503); assert.equal(JSON.stringify(missing.body).includes('"open":0'), false);
});
test("transport verifies via caller JWT before fixed-bucket service reads; redirects/body bounds fail", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return new Response(url.includes('/rpc/') ? 'true' : '{"synthetic":true}'); };
  const t = createTransport({ url: PROJECT_URL, publishableKey: "public", serviceKey: "sb_secret_SYNTHETIC" }, { fetchImpl });
  await t.authorize(token(), OWNER); const r = await t.object("latest.json", 4096); assert.equal(r.json().synthetic, true); t.close();
  assert.equal(calls[0].options.headers.Authorization, "Bearer " + token()); assert.deepEqual(JSON.parse(calls[0].options.body), { expected_owner: OWNER });
  assert.equal(calls[1].options.headers.apikey, "sb_secret_SYNTHETIC"); assert.equal(calls[1].options.headers.Authorization, undefined); assert.match(calls[1].url, /\/object\/authenticated\/ns-dashboard-private\/latest.json$/); assert.equal(calls[1].options.redirect, "error");
  const bounded = createTransport({ url: PROJECT_URL }, { fetchImpl: async () => new Response('x'.repeat(70)) }); await assert.rejects(bounded.authorize(token(), OWNER), /dashboard_response_limit/); bounded.close();
});
test("offline preparer writes only private sanitized candidate and never advances a live pointer", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-dashboard-hosted-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.chmodSync(dir, 0o700); const input = path.join(dir, "projection.json"); fs.writeFileSync(input, JSON.stringify(overviewFixture()), { mode: 0o600 });
  const out = prepare(input, path.join(dir, "out"), AS_OF); assert.equal(out.uploaded, false); assert.equal(out.networkRequests, 0); assert.equal(fs.existsSync(path.join(out.directory, "latest.json")), false);
  for (const name of fs.readdirSync(out.directory)) assert.equal(fs.statSync(path.join(out.directory, name)).mode & 0o777, 0o600);
  assert.equal(bytesHash(fs.readFileSync(path.join(out.directory, "snapshot-" + out.sha256 + ".json"))), out.sha256);
});
test("transport whole-operation deadline covers stalled fetch/body and its fixed request ceiling", async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    const t = createTransport({ url: PROJECT_URL }, { timeoutMs: 20, fetchImpl });
    const start = performance.now(); await assert.rejects(t.authorize(token(), OWNER), /dashboard_timeout/); assert.ok(performance.now() - start < 1000); t.close();
  }
  const t = createTransport({ url: PROJECT_URL, serviceKey: "sb_secret_SYNTHETIC" }, { fetchImpl: async () => new Response('{}') });
  for (let i = 0; i < 5; i++) await t.object("latest.json", 4096);
  await assert.rejects(t.object("latest.json", 4096), /dashboard_request_limit/); t.close();
});
test("SQL candidate keeps definer private, checks current role/live session and excludes all client storage", () => {
  const sql = fs.readFileSync(path.join(__dirname, "hosted-storage.sql"), "utf8");
  assert.match(sql, /ns_dashboard_private\.authorize_session[\s\S]*security definer/); assert.match(sql, /public\.ns_dashboard_authorize_session[\s\S]*security invoker/);
  assert.match(sql, /auth\.sessions/); assert.match(sql, /raw_app_meta_data ->> 'role' = 'admin'/); assert.match(sql, /auth\.uid\(\) = expected_owner/); assert.match(sql, /s\.not_after/);
  assert.match(sql, /as restrictive for all to anon, authenticated/); assert.match(sql, /bucket_id <> 'ns-dashboard-private'/); assert.equal(sql.includes(OWNER), false);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8")); assert.equal(config.functions["api/dashboard.js"].maxDuration, 10); assert.equal(config.rewrites.filter(r => r.destination.startsWith('/api/dashboard?route=')).length, 6);
});
