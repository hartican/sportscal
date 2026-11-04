"use strict";

const crypto = require("node:crypto");
const { privateHeaders, requireOrigin, DashboardError } = require("./access");
const { bootDashboard } = require("./entry-client");
const VIEWS = new Set(["overview", "delivery", "queue", "evidence"]);
function entryScript(view) {
  return "(" + bootDashboard.toString() + ")(window," + JSON.stringify("/api/admin/dashboard/view/" + view) + ");";
}
function createEntryHandler({ environment = process.env } = {}) {
  return function dashboardEntry(request, response) {
    privateHeaders(response);
    try {
      requireOrigin(request);
      if (!["GET", "HEAD"].includes(request.method)) throw new DashboardError("method_not_allowed", 405);
      const query = request.query || {};
      if (Object.keys(query).some(k => k !== "route") || !VIEWS.has(query.route)) throw new DashboardError("not_found", 404);
      if (environment.NS_DASHBOARD_ENABLED !== "1") throw new DashboardError("dashboard_not_enabled");
      // 606/607 cache all successful navigations as /index.html, ignoring no-store.
      // NEVER return a 2xx or redirect here, even with a valid owner cookie. This function has no private reader.
      const script = entryScript(query.route), digest = crypto.createHash("sha256").update(script).digest("base64");
      privateHeaders(response, "default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'sha256-" + digest + "'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.status(401);
      if (request.method === "HEAD") { response.end(); return; }
      response.send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nothing Sport dashboard</title><style>body{margin:0;font:16px/1.6 system-ui;color:#173127}#dashboard-status,#dashboard-login,#dashboard-end{margin:20px}button{font:inherit;padding:9px 14px}a{color:#165c47}</style><style id="dashboard-view-styles"></style><p id="dashboard-status" role="status">Checking private access…</p><section id="dashboard-login" hidden><h1>Private dashboard</h1><button id="dashboard-sign-in" type="button">Use my Nothing Sport sign-in</button><p><a href="/">Open Nothing Sport to sign in</a>, then return here.</p></section><button id="dashboard-end" type="button" hidden>Close dashboard session</button><div id="dashboard-view" hidden></div><script src="/config/server-sync.js"></script><script>' + script + '</script></html>');
    } catch (error) { response.status(error instanceof DashboardError ? error.status : 503).json({ code: error instanceof DashboardError ? error.code : "dashboard_unavailable" }); }
  };
}
module.exports = { createEntryHandler, entryScript };
