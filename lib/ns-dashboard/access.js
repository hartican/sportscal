"use strict";

const crypto = require("node:crypto");
const ORIGIN = "https://www.nothingsport.app";
const PROJECT_URL = "https://mkghopnkhcxtmfrcjdbc.supabase.co";
const COOKIE = "__Host-ns-dashboard";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class DashboardError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
function header(request, name) {
  if (request.headers?.get) return request.headers.get(name) || "";
  const value = Object.entries(request.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1];
  return typeof value === "string" ? value : "";
}
function configuration(environment = process.env) {
  if (environment.NS_DASHBOARD_ENABLED !== "1") throw new DashboardError("dashboard_not_enabled");
  const owner = environment.NS_DASHBOARD_OWNER_SUBJECT || "";
  if (!UUID.test(owner) || !/^[a-f0-9]{64}$/.test(environment.NS_DASHBOARD_READINESS_SHA256 || "")) throw new DashboardError("dashboard_prerequisites_missing");
  const url = String(environment.SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = environment.SUPABASE_PUBLISHABLE_KEY || environment.SUPABASE_ANON_KEY;
  const serviceKey = environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY;
  if (url !== PROJECT_URL || !publishableKey || !serviceKey) throw new DashboardError("dashboard_service_unavailable");
  return { owner: owner.toLowerCase(), url, publishableKey, serviceKey };
}
function requireOrigin(request, mutation = false) {
  if (header(request, "host") !== "www.nothingsport.app") throw new DashboardError("not_found", 404);
  if (header(request, "sec-fetch-site") === "cross-site" && mutation) throw new DashboardError("forbidden", 403);
  const origin = header(request, "origin");
  if ((mutation && origin !== ORIGIN) || (origin && origin !== ORIGIN)) throw new DashboardError("forbidden", 403);
}
function tokenOf(request, bearerOnly = false, paired = false) {
  const authorization = header(request, "authorization");
  const bearer = authorization.match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  const cookies = header(request, "cookie").split(";").map(x => x.trim()).filter(x => x.startsWith(COOKIE + "="));
  if (authorization && !bearer || cookies.length > 1) throw new DashboardError("sign_in_required", 401);
  if (bearerOnly) return bearer?.[1] || "";
  const cookie = cookies[0]?.slice(COOKIE.length + 1) || "";
  if (paired && (!bearer || !cookie)) throw new DashboardError("sign_in_required", 401);
  if (bearer && cookie && bearer[1] !== cookie) throw new DashboardError("ambiguous_session", 401);
  return bearer?.[1] || cookie;
}
function claimsOf(token, owner, now = Date.now()) {
  if (typeof token !== "string" || token.length > 3800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new DashboardError("sign_in_required", 401);
  let claims, meta;
  try { meta = JSON.parse(Buffer.from(token.split(".")[0], "base64url")); claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url")); }
  catch { throw new DashboardError("sign_in_required", 401); }
  if (!["HS256", "RS256", "ES256"].includes(meta.alg) || !UUID.test(claims.sub || "") || !UUID.test(claims.session_id || "") || !Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.role !== "authenticated" || claims.iss !== PROJECT_URL + "/auth/v1") throw new DashboardError("sign_in_required", 401);
  if (claims.sub.toLowerCase() !== owner) throw new DashboardError("forbidden", 403);
  // These are rejection-only hints. PostgREST must verify the JWT and the SQL gate must verify current role/session before access.
  return claims;
}
function privateHeaders(response, csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'") {
  for (const [key, value] of Object.entries({ "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", Pragma: "no-cache", Vary: "Cookie, Authorization", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Cross-Origin-Resource-Policy": "same-origin", "Content-Security-Policy": csp })) response.setHeader(key, value);
}
function sessionCookie(token, claims, now = Date.now()) {
  return COOKIE + "=" + token + "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=" + Math.min(900, Math.max(0, Math.floor(claims.exp - now / 1000)));
}
const clearCookie = () => COOKIE + "=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0";
const bytesHash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
module.exports = { DashboardError, ORIGIN, PROJECT_URL, COOKIE, UUID, header, configuration, requireOrigin, tokenOf, claimsOf, privateHeaders, sessionCookie, clearCookie, bytesHash };
