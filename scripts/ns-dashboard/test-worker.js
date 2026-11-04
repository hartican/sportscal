"use strict";

const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { ENV, token, response, harness } = require("./hosted-test-fixture");
const { ORIGIN, COOKIE } = require("../../lib/ns-dashboard/access");
const { createEntryHandler, entryScript } = require("../../lib/ns-dashboard/entry");
const { bootDashboard } = require("../../lib/ns-dashboard/entry-client");
const PUBLIC = '<!doctype html><title>Nothing Sport</title><main>PUBLIC_APP_SHELL</main>';
const CANARY = "SYNTHETIC_PRIVATE_CANARY";
class WorkerRequest {
  constructor(input, options = {}) { this.url = new URL(typeof input === "string" ? input : input.url, ORIGIN).href; this.method = options.method || input.method || "GET"; this.mode = options.mode || input.mode || "cors"; this.cache = options.cache || input.cache || "default"; this.headers = new Headers(options.headers || input.headers); }
  clone() { return new WorkerRequest(this); }
}
function server() {
  const options = {}, privateApi = harness(options), entry = createEntryHandler({ environment: ENV });
  const state = { offline: false, legacyCanonical: false, cookie: COOKIE + "=" + token(), options, api: privateApi };
  const urls = { "/admin/dashboard": "overview", "/admin/dashboard/delivery": "delivery", "/admin/dashboard/queue": "queue", "/admin/dashboard/evidence": "evidence" };
  state.fetch = async request => {
    if (state.offline) throw new TypeError("synthetic offline");
    const url = new URL(request.url), res = response();
    const headers = Object.fromEntries(request.headers);
    Object.assign(headers, { host: "www.nothingsport.app", cookie: state.cookie, "sec-fetch-mode": request.mode, "sec-fetch-dest": request.mode === "navigate" ? "document" : "empty" });
    if (!["GET", "HEAD"].includes(request.method)) headers.origin = ORIGIN;
    let route;
    if (urls[url.pathname]) {
      if (state.legacyCanonical) return new Response(CANARY, { headers: { "Cache-Control": "private, no-store" } });
      entry({ method: request.method, query: { route: urls[url.pathname] }, headers }, res);
    } else if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/admin/dashboard/session") route = "session";
      else if (url.pathname === "/api/admin/dashboard") route = "data";
      else route = Object.values(urls).find(v => url.pathname === "/api/admin/dashboard/view/" + v);
      if (!route) return new Response("not found", { status: 404 });
      await privateApi.handler({ url: request.url, method: request.method, query: { route }, headers }, res);
    } else return new Response(url.pathname.startsWith('/assets/') ? 'PUBLIC_ASSET' : PUBLIC, { headers: { "Content-Type": "text/html" } });
    if (res.headers['set-cookie']?.includes('Max-Age=0')) state.cookie = "";
    const body = res.body == null ? null : typeof res.body === "string" ? res.body : JSON.stringify(res.body);
    return new Response(body, { status: res.statusCode, headers: res.headers });
  };
  return state;
}
function worker(source, state = server()) {
  const listeners = new Map(), maps = new Map(), writes = [];
  const key = request => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
  const caches = {
    async open(name) {
      if (!maps.has(name)) maps.set(name, new Map()); const map = maps.get(name);
      return { async put(k, value) { writes.push(key(k)); map.set(key(k), value.clone()); }, async match(k) { return map.get(key(k))?.clone(); }, async addAll() {} };
    },
    async match(k) { for (const map of maps.values()) if (map.has(key(k))) return map.get(key(k)).clone(); }, async keys() { return [...maps.keys()]; }, async delete(k) { return maps.delete(k); },
  };
  const self = { location: new URL(ORIGIN + '/service-worker.js'), addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); }, clients: { async get() { return { id: "synthetic-client", url: ORIGIN + "/admin/dashboard" }; }, async matchAll() { return []; }, async claim() {} }, async skipWaiting() {}, registration: {} };
  const context = vm.createContext({ self, caches, fetch: state.fetch, Request: WorkerRequest, Response, Headers, URL, AbortController, setTimeout, clearTimeout, console, TextEncoder, TextDecoder });
  vm.runInContext(source, context, { timeout: 1000 });
  const cacheName = vm.runInContext('CACHE_NAME', context);
  maps.set(cacheName, new Map([[ORIGIN + '/index.html', new Response(PUBLIC)]]));
  return { state, maps, writes, async index() { return (await caches.match('/index.html')).text(); }, async request(url, options = {}) {
    const request = new WorkerRequest(url, options), tasks = []; let pending;
    const event = { request, clientId: "synthetic-client", waitUntil(p) { tasks.push(p); }, respondWith(p) { assert.equal(pending, undefined); pending = p; } };
    for (const fn of listeners.get('fetch') || []) fn(event);
    const result = await (pending || state.fetch(request)); await Promise.all(tasks); return result;
  } };
}
const next = fs.readFileSync(path.join(__dirname, '../../service-worker.js'), 'utf8');
const paths = process.env.NS_DASHBOARD_LEGACY_WORKERS ? JSON.parse(process.env.NS_DASHBOARD_LEGACY_WORKERS) : [];
let legacy;
if (paths.length) legacy = paths.map(p => ({ name: path.basename(p), source: fs.readFileSync(p, 'utf8') }));
else {
  // Self-contained CI mutation control, not a claim to have run published 606/607 bytes.
  const start = next.indexOf('  // Private dashboard entries'), end = next.indexOf('  if (event.clientId', start);
  assert.ok(start >= 0 && end > start);
  legacy = [{ name: "guard-removed-compatibility-mutant", source: next.slice(0, start) + next.slice(end) }];
}
for (const old of legacy) {
  test(old.name + ": legacy/mutant worker reproduces unsafe 200 no-store shell overwrite", async () => {
    const w = worker(old.source); w.state.legacyCanonical = true;
    const r = await w.request('/admin/dashboard', { mode: 'navigate' }); assert.equal(r.status, 200); assert.equal(await w.index(), CANARY); assert.deepEqual(w.writes, [ORIGIN + '/index.html']);
  });
  test(old.name + ": first canonical entries and private API views preserve public shell through logout/offline", async () => {
    const w = worker(old.source);
    for (const [url, view] of [['/admin/dashboard','overview'],['/admin/dashboard/delivery','delivery'],['/admin/dashboard/queue','queue'],['/admin/dashboard/evidence','evidence']]) {
      const entry = await w.request(url, { mode: 'navigate' }); assert.equal(entry.status, 401); assert.equal((await entry.text()).includes('Selection-saving update'), false);
      const data = await w.request('/api/admin/dashboard/view/' + view, { headers: { Authorization: 'Bearer ' + token(), 'X-NS-Dashboard-Transport': 'fetch-v1' } }); assert.equal(data.status, 200);
      if (view === 'overview') assert.match(await data.text(), /Selection-saving update/);
      assert.equal(await w.index(), PUBLIC); assert.equal(w.writes.length, 0);
    }
    assert.equal((await w.request('/api/admin/dashboard/session', { method: 'DELETE' })).status, 204);
    const denied = await w.request('/api/admin/dashboard/view/overview', { headers: { Authorization: 'Bearer ' + token(), 'X-NS-Dashboard-Transport': 'fetch-v1' } }); assert.equal(denied.status, 401); assert.equal((await denied.text()).includes('Selection-saving update'), false);
    w.state.offline = true;
    await assert.rejects(w.request('/api/admin/dashboard/view/overview', { headers: { Authorization: 'Bearer ' + token(), 'X-NS-Dashboard-Transport': 'fetch-v1' } }), /offline/);
    const entry = await w.request('/admin/dashboard', { mode: 'navigate' }); assert.equal(await entry.text(), PUBLIC); assert.equal(await w.index(), PUBLIC); assert.equal(w.writes.length, 0);
  });
}
test("future protected-path worker guard has no cache/fallback while public shell/assets remain normal", async () => {
  const w = worker(next); w.state.legacyCanonical = true;
  assert.equal((await w.request('/admin/dashboard', { mode: 'navigate' })).status, 200); assert.equal(await w.index(), PUBLIC); assert.equal(w.writes.length, 0);
  w.state.offline = true;
  const protectedPage = await w.request('/admin/dashboard/evidence', { mode: 'navigate' }); assert.equal(protectedPage.status, 503); assert.equal((await protectedPage.text()).includes('PUBLIC_APP_SHELL'), false); assert.equal(w.writes.length, 0);
  assert.equal(await (await w.request('/', { mode: 'navigate' })).text(), PUBLIC);
  w.state.offline = false; assert.equal(await (await w.request('/assets/synthetic.svg')).text(), 'PUBLIC_ASSET');
  w.state.offline = true; assert.equal(await (await w.request('/assets/synthetic.svg')).text(), 'PUBLIC_ASSET');
  assert.equal(await w.index(), PUBLIC);
});
test("canonical entry cannot be upgraded to private 200 by cookie/query; direct API navigation refuses private bodies", async () => {
  const entry = createEntryHandler({ environment: ENV });
  for (const route of ['overview','delivery','queue','evidence','data',['overview','data']]) {
    const r = response(); entry({ method: 'GET', query: { route }, headers: { host: 'www.nothingsport.app', cookie: COOKIE + '=' + token() } }, r);
    assert.ok(r.statusCode >= 400); assert.equal(JSON.stringify(r.body).includes('Selection-saving update'), false);
    if (typeof route === 'string' && route !== 'data') {
      const code = r.body.match(/<script>([\s\S]*)<\/script>/)[1];
      assert.equal(code, entryScript(route));
      assert.ok(r.headers['content-security-policy'].includes('sha256-' + require('node:crypto').createHash('sha256').update(code).digest('base64')));
    }
  }
  const h = harness();
  for (const route of ['overview','delivery','queue','evidence','data']) {
    const navigation = await h.run(route, { headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } }); assert.equal(navigation.statusCode, 409);
    const noContract = await h.run(route, { headers: { 'x-ns-dashboard-transport': '' } }); assert.equal(noContract.statusCode, 409);
  }
  assert.equal(h.auth.length, 0); assert.equal(h.calls.length, 0);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8'));
  const protectedRules = config.rewrites.filter(r => r.destination.startsWith('/api/dashboard?'));
  assert.equal(protectedRules.length, 6); assert.ok(protectedRules.every(r => r.source.startsWith('/api/')));
  const entries = config.rewrites.filter(r => r.destination.startsWith('/api/dashboard-entry?'));
  assert.equal(entries.length, 4); assert.ok(entries.every(r => r.source.startsWith('/admin/dashboard')));
});
function browser(w, serialized = false) {
  const callbacks = new Map(), elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { nodes: [], hidden: true, textContent: '', disabled: false, replaceChildren(...nodes) { this.nodes = nodes; }, addEventListener(type, fn) { this[type] = fn; } }); return elements.get(id); };
  const listen = (type, fn) => { if (!callbacks.has(type)) callbacks.set(type, []); callbacks.get(type).push(fn); };
  const doc = { visibilityState: 'visible', getElementById: element, importNode: node => node, addEventListener: listen };
  const root = { document: doc, navigator: { onLine: true }, addEventListener: listen, AbortController, setTimeout, clearTimeout,
    DOMParser: class { parseFromString(html) { return { body: { childNodes: [html] }, querySelector: () => /<(script|iframe|object|embed|form)\b/.test(html), querySelectorAll: () => [] }; } },
    fetch: (url, options = {}) => w.request(url, options), NOTHINGSPORTS_SERVER_SYNC: { PERSISTENT_SESSION_STORAGE_KEY: 'synthetic-persistent', SESSION_STORAGE_KEY: 'synthetic-session' },
  };
  const api = serialized ? vm.runInNewContext(entryScript('overview'), { window: root }, { timeout: 1000 }) : bootDashboard(root, '/api/admin/dashboard/view/overview');
  const storage = new Map([['synthetic-persistent', JSON.stringify({ accessToken: token() })]]);
  root.localStorage = { getItem: key => storage.get(key) || null };
  root.sessionStorage = { getItem: () => null };
  return { root, doc, api, element, storage, async emit(type, event = {}) { for (const fn of callbacks.get(type) || []) fn(event); await new Promise(setImmediate); }, content() { return element('dashboard-view').nodes.join(''); } };
}
test("serialized CSP-bound entry client mounts only through API and clears/rechecks visibility", async () => {
  const w = worker(legacy[0].source), b = browser(w, true); await b.api.load(); assert.match(b.content(), /Selection-saving update/);
  const calls = w.state.api.auth.length;
  b.doc.visibilityState = 'hidden'; await b.emit('visibilitychange'); assert.equal(b.content(), ''); assert.equal(w.state.api.auth.length, calls);
  b.doc.visibilityState = 'visible'; await b.emit('visibilitychange'); assert.match(b.content(), /Selection-saving update/); assert.ok(w.state.api.auth.length > calls);
  assert.equal(await w.index(), PUBLIC);
});
test("authorized view clears on pagehide and reauthorizes on history restore after role removal", async () => {
  const w = worker(legacy[0].source), b = browser(w); await b.api.load(); assert.match(b.content(), /Selection-saving update/);
  const calls = w.state.api.auth.length; await b.emit('pagehide'); assert.equal(b.content(), '');
  w.state.options.denied = true; await b.emit('pageshow'); assert.equal(b.content(), ''); assert.ok(w.state.api.auth.length > calls); assert.equal(await w.index(), PUBLIC);
});
test("offline/logout clear private view and late in-flight success cannot restore it", async () => {
  const w = worker(legacy[0].source), b = browser(w); await b.api.load(); assert.match(b.content(), /Selection-saving update/);
  b.root.navigator.onLine = false; w.state.offline = true; await b.emit('offline'); assert.equal(b.content(), '');
  b.root.navigator.onLine = true; w.state.offline = false; await b.api.load(); assert.match(b.content(), /Selection-saving update/);
  await b.api.closeSession(); assert.equal(b.content(), ''); assert.equal(w.state.cookie, ''); assert.match(b.element('dashboard-status').textContent, /session closed/);
  const late = browser(worker(legacy[0].source)); let resolve; late.root.fetch = () => new Promise(r => { resolve = r; });
  const loading = late.api.load(); await late.emit('pagehide'); resolve(new Response('<main>' + CANARY + '</main>', { headers: { 'Content-Type': 'text/html' } })); await loading; assert.equal(late.content(), '');
  assert.equal(await w.index(), PUBLIC);
});
test("unacknowledged logout clears view without claiming server session closed", async () => {
  const b = browser(worker(legacy[0].source)); await b.api.load(); b.root.fetch = async () => { throw new Error('offline'); };
  await b.api.closeSession(); assert.equal(b.content(), ''); assert.match(b.element('dashboard-status').textContent, /reconnect to close/);
});

test("NS account switch/logout never remounts with retained valid owner cookie", async () => {
  for (const event of ['storage', 'pageshow', 'visibilitychange', 'ns-account-change']) {
    for (const value of [null, token({ sub: require('./hosted-test-fixture').OTHER })]) {
      const w = worker(legacy[0].source), b = browser(w);
      await b.api.load(); assert.match(b.content(), /Selection-saving update/);
      if (value) b.storage.set('synthetic-persistent', JSON.stringify({ accessToken: value }));
      else b.storage.delete('synthetic-persistent');
      const reads = w.state.api.calls.length;
      await b.emit(event, { key: 'synthetic-persistent' });
      assert.equal(b.content(), ''); assert.equal(w.state.api.calls.length, reads);
      assert.ok(w.state.cookie); // The old cookie/session remains valid throughout this case.
    }
  }
});

test("account changes during a successful private response cannot mount old bytes", async () => {
  const w = worker(legacy[0].source), b = browser(w);
  const original = b.root.fetch; let release, requested;
  const ready = new Promise(resolve => { requested = resolve; });
  b.root.fetch = async (url, options) => {
    if (url.includes('/view/')) { requested(); return new Promise(resolve => { release = resolve; }); }
    return original(url, options);
  };
  const pending = b.api.load(); await ready;
  b.storage.delete('synthetic-persistent');
  release(new Response('<main>' + CANARY + '</main>', { headers: { 'Content-Type': 'text/html' } }));
  await pending; assert.equal(b.content(), '');
});
