"use strict";

const { renderPage, esc } = require("../../scripts/ns-dashboard/overview");
const { validateEnvelope, MAX_SNAPSHOT, timestamp, sha } = require("../../scripts/ns-dashboard/hosted-contract");
const { DashboardError, ORIGIN, header, configuration, requireOrigin, tokenOf, claimsOf, privateHeaders, sessionCookie, clearCookie, bytesHash } = require("./access");
const { createTransport } = require("./transport");
const ROUTES = { overview: ["index.html", "/admin/dashboard"], delivery: ["delivery.html", "/admin/dashboard/delivery"], queue: ["queue.html", "/admin/dashboard/queue"], evidence: ["evidence.html", "/admin/dashboard/evidence"] };
function latest(value) {
  if (!value || value.schemaVersion !== "ns-dashboard-latest.v1" || Object.keys(value).some(k => !["schemaVersion", "sha256", "publishedAt", "previous"].includes(k))) throw new DashboardError("dashboard_pointer_invalid");
  sha(value.sha256, 64); timestamp(value.publishedAt);
  if (value.previous) { if (Object.keys(value.previous).some(k => !["sha256", "publishedAt"].includes(k))) throw new DashboardError("dashboard_pointer_invalid"); sha(value.previous.sha256, 64); timestamp(value.previous.publishedAt); }
  return value;
}
async function loadSnapshot(transport, now) {
  const pointer = latest((await transport.object("latest.json", 4096)).json());
  if (Date.parse(pointer.publishedAt) > now) throw new DashboardError("dashboard_pointer_invalid");
  let value, fallback = false;
  const read = async p => {
    const result = await transport.object("snapshots/" + p.sha256 + ".json", MAX_SNAPSHOT);
    if (bytesHash(result.bytes) !== p.sha256) throw new DashboardError("dashboard_snapshot_integrity");
    const v = validateEnvelope(result.json());
    if (Date.parse(v.preparedAt) > Date.parse(p.publishedAt)) throw new DashboardError("dashboard_snapshot_integrity");
    return v;
  };
  try { value = await read(pointer); }
  catch { if (!pointer.previous || Date.parse(pointer.previous.publishedAt) > Date.parse(pointer.publishedAt)) throw new DashboardError("dashboard_snapshot_unavailable"); value = await read(pointer.previous); fallback = true; }
  let refresh;
  try {
    const status = (await transport.object("refresh/status.json", 8192)).json();
    if (!status || Object.keys(status).some(k => !["schemaVersion", "state", "attemptedAt", "errorCode"].includes(k)) || status.schemaVersion !== "ns-dashboard-refresh.v1" || !["idle", "refreshing", "error"].includes(status.state) || Date.parse(timestamp(status.attemptedAt)) > now || status.errorCode != null && !/^[a-z][a-z0-9_]{0,79}$/.test(status.errorCode)) throw new Error();
    refresh = Date.parse(status.attemptedAt) < Date.parse(fallback ? pointer.previous.publishedAt : pointer.publishedAt) ? { state: "idle" } : status;
  } catch { refresh = { state: "error", errorCode: "dashboard_refresh_status_unavailable" }; }
  const publishedAt = fallback ? pointer.previous.publishedAt : pointer.publishedAt;
  const p = value.projection;
  if (fallback || refresh.state === "error") p.freshness = { ...p.freshness, state: "error", error: { code: fallback ? "dashboard_last_good_fallback" : refresh.errorCode || "dashboard_refresh_failed" } };
  else if (refresh.state === "refreshing") p.freshness = { ...p.freshness, state: "loading" };
  return { projection: p, publishedAt, refreshState: refresh.state, fallback };
}
function hostedPage(p, view, asOf, publishedAt) {
  let html = renderPage(p, ROUTES[view][0], { asOf });
  for (const [file, route] of Object.values(ROUTES)) html = html.replaceAll('href="' + file + '"', 'href="' + route + '"');
  html = html.replaceAll("Static local copy", "Owner-refreshed snapshot").replace("Read only · Updated on request by nsDASHBOARD · Evidence contains sources and access details.", "Read only · Manually refreshed by nsDASHBOARD · Published " + esc(publishedAt));
  html = html.replace("Recorded URLs are shown as text. This offline document makes no network requests.", "Public source URLs and sanitized receipt references are shown as text.");
  // The hosted Evidence page retains technical lineage but replaces the local delivery proposal with the running access model.
  if (view === "evidence") {
    const start = html.indexOf('<section class="section access-plan">'), end = html.indexOf('<section id="production"', start);
    if (start < 0 || end < start) throw new DashboardError("dashboard_template_invalid");
    html = html.slice(0, start) + '<section class="section"><h2>Access and updates</h2><p>This read-only dashboard uses the approved NS account and a current admin session. nsDASHBOARD refreshes the snapshot on request. Opening a page reads the latest published snapshot; it does not collect new source data.</p><p>Source clocks remain separate below. A failed refresh retains the last good snapshot; source age over 24 hours is marked stale.</p></section>' + html.slice(end);
    html = html.replace(/<section class="section"><h2>Refresh state and instrumentation backlog<\/h2>[\s\S]*?<\/section>/, '<section class="section"><h2>Refresh state and instrumentation backlog</h2><p>Latest snapshot publication: ' + esc(publishedAt) + '. No recurring collection or background polling is installed. Delivered-outcome comparisons, complete incident coverage and cost attribution remain unmeasured.</p></section>');
  }
  return html;
}
function routeOf(request) {
  const params = new URL(request.url, ORIGIN).searchParams;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new DashboardError("not_found", 404);
  const query = request.query || Object.fromEntries(params);
  if (Object.keys(query).some(k => k !== "route") || typeof query.route !== "string" || ![...Object.keys(ROUTES), "data", "session"].includes(query.route)) throw new DashboardError("not_found", 404);
  return query.route;
}
function createHandler({ environment = process.env, transportFactory = createTransport, now = Date.now } = {}) {
  return async function dashboardHandler(request, response) {
    privateHeaders(response); let transport, view;
    try {
      requireOrigin(request, !["GET", "HEAD"].includes(request.method));
      view = routeOf(request);
      if ((view === "session" && !["POST", "DELETE"].includes(request.method)) || (view !== "session" && !["GET", "HEAD"].includes(request.method))) { response.setHeader("Allow", view === "session" ? "POST, DELETE" : "GET, HEAD"); throw new DashboardError("method_not_allowed", 405); }
      if (view !== "session" && (header(request, "x-ns-dashboard-transport") !== "fetch-v1" || header(request, "sec-fetch-mode") === "navigate" || ["document", "iframe", "frame"].includes(header(request, "sec-fetch-dest")))) throw new DashboardError("private_fetch_required", 409);
      const config = configuration(environment);
      const length = header(request, "content-length");
      if (view === "session" && (length && !/^0$/.test(length) || request.body && (typeof request.body !== "object" || Object.keys(request.body).length))) throw new DashboardError("invalid_session_request", 400);
      if (view === "session" && request.method === "DELETE") { response.setHeader("Set-Cookie", clearCookie()); response.status(204).end(); return; }
      const token = tokenOf(request, view === "session");
      const claims = claimsOf(token, config.owner, now());
      transport = transportFactory(config);
      await transport.authorize(token, config.owner);
      if (view === "session") { response.setHeader("Set-Cookie", sessionCookie(token, claims, now())); response.status(204).end(); return; }
      const snapshot = await loadSnapshot(transport, now());
      if (request.method === "HEAD") { response.status(200).end(); return; }
      if (view === "data") response.status(200).json({ schemaVersion: "ns-dashboard-view.v1", ...snapshot });
      else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.status(200).send(hostedPage(snapshot.projection, view, new Date(now()).toISOString(), snapshot.publishedAt)); }
    } catch (error) {
      const status = error instanceof DashboardError ? error.status : 503;
      response.status(status).json({ code: error instanceof DashboardError ? error.code : "dashboard_unavailable" });
    } finally { transport?.close(); }
  };
}
module.exports = { createHandler, loadSnapshot, hostedPage, routeOf, latest };
