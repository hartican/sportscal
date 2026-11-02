"use strict";

const { VERSION, instant, fail } = require("./core");
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const count = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("en-AU") : "Not measured";
const knownCount = value => Number.isSafeInteger(value) && value >= 0;
const short = value => value ? String(value).slice(0, 12) : "Not measured";
function epoch(value) { try { return instant(value); } catch { return null; } }
function stamp(value) {
  const ms = epoch(value);
  if (ms === null) return '<span class="muted">Not measured</span>';
  const local = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "long" }).format(ms);
  return '<time datetime="' + esc(value) + '">' + esc(local) + '</time><small class="utc">' + esc(new Date(ms).toISOString()) + "</small>";
}
const statusLabels = { fresh: "Captured", stale: "Stale", error: "Refresh error", partial: "Partial", empty: "No snapshot", loading: "Loading", failed: "Failed evidence", ambiguous: "Ambiguous", unknown: "Not measured", not_measured: "Not measured" };
function badge(state, label) {
  const safe = Object.hasOwn(statusLabels, state) ? state : "unknown";
  return '<span class="status ' + safe + '">' + esc(label || statusLabels[safe]) + "</span>";
}
function sourceState(p, asOf) {
  const sourceAsOf = p.currentBacklogAtCollection?.cutoff || p.freshness?.lastSuccessfulRefresh;
  const ms = epoch(sourceAsOf), age = ms === null ? null : (instant(asOf) - ms) / 1000;
  const supplied = p.freshness?.state;
  const state = supplied === "error" ? "error" : supplied === "loading" ? "loading" : age === null || age < 0 ? "unknown"
    : supplied === "stale" || age > 86400 ? "stale" : supplied === "partial" ? "partial"
      : supplied === "empty" ? "empty" : supplied === "fresh" ? "fresh" : "unknown";
  return { state, sourceAsOf, age };
}
function liveState(release, asOf) {
  const scopes = Array.isArray(release.verificationScopes) ? release.verificationScopes.map(s => {
    const v = s.latestObservation, expired = epoch(v?.expiresAt) === null || epoch(v.expiresAt) <= instant(asOf);
    return { ...s, state: s.state === "fresh" && expired ? "stale" : s.state };
  }) : [];
  const v = release.verifiedLive, d = release.deployed;
  const valid = v && d && v.result === "passed" && v.deploymentId === d.id && v.sha === d.sha && v.alias === d.alias
    && epoch(v.expiresAt) !== null && epoch(v.expiresAt) > instant(asOf)
    && scopes.some(s => s.state === "fresh" && s.scope === v.scope && s.latestObservation?.id === v.id);
  const state = valid ? scopes.every(s => s.state === "fresh") ? "fresh" : "partial"
    : scopes.some(s => s.state === "failed") ? "failed" : scopes.some(s => s.state === "ambiguous") ? "ambiguous" : scopes.length ? "stale" : "unknown";
  return { proof: valid ? v : null, state, scopes };
}
const CSS = [
  ":root{color-scheme:light;--paper:#f4f5f1;--surface:#fff;--ink:#172724;--muted:#52615b;--line:#cdd5ce;--accent:#165c47;--warn:#80520b;--error:#a12525}",
  "*{box-sizing:border-box}html{scroll-padding-top:24px}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
  "a{color:var(--accent);text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:3px solid #a44d12;outline-offset:5px}.skip{position:absolute;left:16px;top:-80px;background:white;padding:12px;z-index:3}.skip:focus{top:12px}",
  ".masthead{background:#142923;color:#fff;padding:22px max(24px,calc((100vw - 1200px)/2));display:flex;justify-content:space-between;align-items:center;gap:20px}.brand{font-size:22px;font-weight:750;letter-spacing:-.6px}.brand small{display:block;font-size:12px;font-weight:450;color:#d2e0d8;letter-spacing:.04em}",
  "nav{display:flex;gap:24px;flex-wrap:wrap}nav a{color:#e3eee7;text-decoration:none;font-size:13px;padding:5px 0;border-bottom:1px solid transparent;transition:border-color .12s}nav a:hover{border-color:#e3eee7}",
  "main{max-width:1248px;margin:auto;padding:30px 24px 54px}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}h1{font-size:32px;line-height:1.15;letter-spacing:-1px;margin:0 0 6px}h2{font-size:19px;line-height:1.25;margin:0 0 8px;letter-spacing:-.25px}h3{font-size:14px;margin:0 0 8px}p{margin:6px 0 12px}.muted,small{color:var(--muted)}small{font-size:12px}.utc{display:block;font-size:11px;overflow-wrap:anywhere}.asof{text-align:right;font-size:12px;max-width:430px}",
  ".status{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.02em;padding:3px 7px;background:#e7ece6;color:#43544b;border-radius:3px}.fresh{color:#10513c;background:#e0eee4}.stale,.partial,.ambiguous{color:var(--warn);background:#f8edd5}.error,.failed{color:var(--error);background:#f8e7e4}.empty,.unknown,.not_measured,.loading{background:#e9ece7;color:#46574e}",
  ".source-banner{display:flex;align-items:flex-start;gap:12px;border-block:1px solid var(--line);padding:12px 0;margin-bottom:26px}.source-banner p{margin:0;font-size:13px}.source-banner .status{flex-shrink:0}",
  ".production{display:grid;grid-template-columns:1fr 1fr 1fr;background:var(--surface);border-block:1px solid var(--line);margin:18px 0 12px}.production>div{padding:18px 20px 20px;border-right:1px solid var(--line);min-width:0}.production>div:last-child{border:0}.label{display:block;text-transform:uppercase;letter-spacing:.09em;font-size:10px;font-weight:700;color:var(--muted)}.value{display:block;font-size:24px;font-weight:650;letter-spacing:-.5px;margin:6px 0}.production p{font-size:12px;margin:8px 0 0}.production code{font-size:12px}.scope-note{font-size:12px;color:var(--muted)}",
  ".section{padding:26px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin-bottom:14px}.section-head p{font-size:12px;margin:0}.columns{display:grid;grid-template-columns:1.45fr 1fr;gap:34px}.backlog{display:flex;align-items:baseline;gap:12px;padding:13px 0}.backlog strong{font-size:27px;letter-spacing:-.5px}.backlog span{font-size:12px}",
  "table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px 8px;text-align:right;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}th{font-size:11px;color:var(--muted);font-weight:600}th:first-child,td:first-child{text-align:left;padding-left:0}td:first-child strong{display:block}td .utc{font-size:10px}caption{text-align:left;font-size:12px;color:var(--muted);padding:10px 0}.table-scroll{overflow-x:auto}",
  ".queue{list-style:none;padding:0;margin:0}.queue>li{padding:18px 0;border-top:1px solid var(--line)}.queue-row{display:grid;grid-template-columns:1.3fr .8fr 1fr 1.6fr;gap:22px;align-items:start}.queue-title{font-weight:650;overflow-wrap:anywhere}.queue dl{margin:0}.queue dt{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}.queue dd{margin:4px 0 0;font-size:13px;overflow-wrap:anywhere}.queue .next{font-size:14px}.queue details{margin-top:12px}.queue .recorded{font-size:11px;color:var(--muted)}",
  ".measure-list{margin:0}.measure-list>div{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid var(--line)}.measure-list dt{font-size:13px}.measure-list dd{margin:0;font-size:12px;font-weight:600;text-align:right}.measure-list .muted{font-weight:400}.evidence-list{padding-left:18px;font-size:13px}.evidence-list li{margin:9px 0}details{font-size:12px}summary{cursor:pointer;min-height:30px;display:list-item;padding:4px 0;color:var(--accent)}summary:hover{color:var(--ink)}details[open]>summary{margin-bottom:10px}.trace{display:grid;grid-template-columns:180px 1fr;gap:8px 20px;margin:10px 0}.trace dt{color:var(--muted)}.trace dd{margin:0;overflow-wrap:anywhere}code{font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}.empty-state{padding:18px 0;color:var(--muted)}footer{padding-top:20px;font-size:11px;color:var(--muted)}",
  "@media(max-width:800px){.masthead{padding:18px 20px;align-items:flex-start;flex-direction:column;gap:14px}nav{gap:20px}main{padding:24px 18px 40px}.page-heading{display:block}.asof{text-align:left;margin-top:14px}.production{grid-template-columns:1fr}.production>div{border-right:0;border-bottom:1px solid var(--line);padding:16px}.production>div:last-child{border-bottom:0}.columns{grid-template-columns:1fr;gap:24px}.queue-row{grid-template-columns:1fr 1fr;gap:16px}.queue-row>div:first-child,.queue-row>.next{grid-column:1/-1}.trace{grid-template-columns:1fr;gap:3px}.trace dd{margin-bottom:10px}.section-head{align-items:flex-start;flex-wrap:wrap}.value{font-size:23px}.table-scroll{margin-right:-4px}th,td{padding:8px 5px}}",
  "@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}@media print{body{background:white}.masthead{background:white;color:#172724;padding:0 0 18px}.brand small,nav a{color:#52615b}nav{display:none}main{padding:0}.section{break-inside:avoid}details{break-inside:avoid}.production{background:white}a{color:inherit}}",
].join("\n");
function production(p, asOf) {
  const r = p.release || {}, live = liveState(r, asOf), merged = r.merged, deployed = r.deployed;
  return '<section id="production" aria-labelledby="production-title"><div class="section-head"><h2 id="production-title">Production evidence</h2><p class="muted">Recorded merge, activation and live proof are separate.</p></div><div class="production">' +
    '<div><span class="label">Merged commit</span><strong class="value">' + esc(short(merged?.sha)) + "</strong>" + badge(merged ? "fresh" : "unknown", merged ? "Recorded merge" : null) + "<p>" + stamp(merged?.at) + "</p></div>" +
    '<div><span class="label">Deployed to production</span><strong class="value">' + esc(short(deployed?.sha)) + "</strong>" + badge(deployed ? "fresh" : "unknown", deployed ? "Activation recorded" : null) + "<p>" + (deployed ? stamp(deployed.activatedAt) : "No supported activation is present in this projection.") + "</p></div>" +
    '<div><span class="label">Verified-live evidence</span><strong class="value">' + esc(live.proof?.version || (live.proof ? short(live.proof.sha) : "Not measured")) + "</strong>" + badge(live.state, live.proof ? live.state === "partial" ? "Scoped pass · partial" : "Scoped pass" : null) + "<p>" + (live.proof ? esc(live.proof.scope) + "<br>" + stamp(live.proof.verifiedAt) : "No current supported pass is established.") + "</p></div></div>" +
    '<p class="scope-note">Source proof has a defined scope. Asset verification does not establish account, browser or installed-device acceptance.</p>' +
    (live.scopes.length ? '<details><summary>Verification scopes</summary><ul class="evidence-list">' + live.scopes.map(s => "<li>" + badge(s.state) + " <strong>" + esc(s.scope) + "</strong> · " + esc(s.latestObservation?.result) + " · " + stamp(s.latestObservation?.verifiedAt) + "</li>").join("") + "</ul></details>" : "") + "</section>";
}
function delivery(p) {
  const rows = [7, 28].map(days => {
    const w = Array.isArray(p.windows) ? p.windows.find(w => w.days === days) : null, f = w?.flow;
    return "<tr><td><strong>" + days + " complete days</strong>" + (w ? '<small>Ended ' + stamp(w.end) + "</small>" : '<small class="muted">No source window</small>') + "</td><td>" + count(f?.openings) + "</td><td>" + count(f?.merges) + "</td><td>" + count(f?.unmergedClosures) + '</td><td class="muted">Not measured</td></tr>';
  }).join("");
  const backlog = p.currentBacklogAtCollection;
  return '<div class="section columns"><section id="delivery" aria-labelledby="delivery-title"><div class="section-head"><h2 id="delivery-title">Delivery trend</h2><p class="muted">PR activity and delivered outcomes</p></div><div class="table-scroll" tabindex="0" role="region" aria-label="Delivery counts"><table><caption>Complete Sydney dates at the source cutoff. Counts include drafts.</caption><thead><tr><th scope="col">Window</th><th scope="col">New PRs</th><th scope="col">Merged</th><th scope="col">Closed unmerged</th><th scope="col">Delivered outcomes</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="backlog"><strong>' + (backlog?.complete === true ? count(backlog.open) : "Not measured") + '</strong><span>open PRs at collection · ' + (backlog?.complete === true ? count(backlog.drafts) : "Not measured") + ' drafts</span></div><p class="scope-note">Closures can be housekeeping. PR merges do not establish usable delivery.</p></section><section aria-labelledby="decisions-title"><h2 id="decisions-title">Decisions needed</h2>' + badge("not_measured") + '<p class="muted">No supported decisions feed is supplied. Queue actions below are the owners’ recorded next steps.</p><h3>Measurement coverage</h3><dl class="measure-list"><div><dt>Deliverable acceptance</dt><dd>Not measured</dd></div><div><dt>DORA measures</dt><dd>Not measured</dd></div><div><dt>Account / device journeys</dt><dd>Not measured</dd></div></dl></section></div>';
}
function queue(p) {
  const observed = Array.isArray(p.queue), coverage = p.queueCoverage || {};
  const state = !observed ? "not_measured" : coverage.complete === true ? "fresh" : "partial";
  const rows = !observed ? '<p class="empty-state">Queue classification is not measured. No complete queue has been inferred.</p>'
    : p.queue.length === 0 ? '<p class="empty-state">An empty queue was explicitly observed' + (coverage.complete === true ? "." : " within partial coverage.") + "</p>"
      : '<ol class="queue">' + p.queue.map(d => '<li><article><div class="queue-row"><div><span class="label">Deliverable' + (knownCount(d.priority) ? " · priority " + esc(d.priority) : " · unranked") + '</span><div class="queue-title">' + esc(d.id) + '</div><small>' + (d.membershipComplete === true ? "Membership recorded" : "Membership partial") + '</small></div><dl><dt>Accountable owner</dt><dd>' + esc(d.owner || "Not measured") + '</dd></dl><dl><dt>Recorded stage</dt><dd>' + esc(d.stage || "Not measured") + '<br><small>Stage age: ' + (Number.isFinite(d.stageAgeSeconds) && d.stageAgeSeconds >= 0 ? esc(Math.floor(d.stageAgeSeconds / 60)) + " min at record" : "Not measured") + '</small></dd></dl><div class="next"><span class="label">Next action</span>' + esc(d.nextAction || "Not measured") + '</div></div><details><summary>Related PRs and evidence</summary><p class="recorded">PR state as of ' + stamp(d.prStateAsOf) + '</p><ul class="evidence-list">' + (Array.isArray(d.prs) ? d.prs.map(pr => "<li><strong>PR #" + esc(pr?.number ?? "Unknown") + "</strong> · " + esc(pr?.state || "Not measured") + (pr?.draft ? " · draft" : "") + "<br><code>" + esc(pr?.sourceUrl || "No source URL") + "</code></li>").join("") : "<li>Not measured</li>") + "</ul><p>Dependency: " + esc(Array.isArray(d.dependencies) && d.dependencies.length ? d.dependencies.join(", ") : "None recorded") + "</p><p>Candidate evidence: " + esc(d.candidateEvidence?.state || "unknown") + ". " + esc((d.candidateEvidence?.reasons || []).join(", ")) + '</p><p class="recorded">Stage observation: ' + stamp(d.stageAgeAsOf || d.observedAt) + "</p><p>Source: " + esc(d.source || coverage.source || "Not measured") + "</p></details></article></li>").join("") + "</ol>";
  return '<section id="queue" class="section" aria-labelledby="queue-title"><div class="section-head"><h2 id="queue-title">Release queue</h2>' + badge(state, observed ? (coverage.complete === true ? "Observed" : "Partial") + " · " + p.queue.length + " grouped deliverables" : null) + '</div><p class="scope-note">Ownership, order and priority come from the supplied queue record. Stage ages stop at that record’s observation time.</p>' + rows + '<p class="recorded">Queue observed: ' + stamp(coverage.observedAt) + "</p></section>";
}
function evidence(p, state) {
  const r = p.release || {}, coverage = p.freshness?.coverage || {};
  return '<div class="section columns"><section aria-labelledby="efficiency-title"><h2 id="efficiency-title">Efficiency</h2><dl class="measure-list"><div><dt>Local / cloud execution share</dt><dd>Not measured</dd></div><div><dt>Attributable cost per delivered outcome</dt><dd>Not measured</dd></div><div><dt>Model tokens / billed minutes</dt><dd>Not measured</dd></div><div><dt>Waiting and rework</dt><dd>Not measured</dd></div></dl><p class="scope-note">Raw job-minutes are not billed usage. Subscription allowance consumption is not cash spending.</p></section><section aria-labelledby="quality-title"><h2 id="quality-title">Product health</h2>' + badge("not_measured") + '<p class="muted">No complete incident or user-journey observations are supplied. Missing reports do not establish zero regressions.</p><p class="scope-note">Competitor trials, field performance and accessibility findings are not imported into this view.</p></section></div>' +
    '<section id="evidence" class="section" aria-labelledby="evidence-title"><h2 id="evidence-title">Sources and definitions</h2><p class="scope-note">Recorded URLs are shown as text. This offline document makes no network requests.</p><details><summary>Inspect source coverage and exact identities</summary><dl class="trace">' +
    '<dt>Source cutoff</dt><dd>' + stamp(state.sourceAsOf) + '</dd><dt>Last successful refresh</dt><dd>' + stamp(p.freshness?.lastSuccessfulRefresh) + '</dd><dt>Projection generated</dt><dd>' + stamp(p.generatedAt) + '</dd><dt>PR records covered / expected</dt><dd>' + count(coverage.pullCount) + " / " + count(coverage.expectedTotal) + '</dd><dt>Source export hash</dt><dd><code>' + esc(p.sourceExportHash || "Not measured") + '</code></dd><dt>Metric definition version</dt><dd>' + esc(p.definitionVersion || "Not measured") + '</dd><dt>Merged source</dt><dd><code>' + esc(r.merged?.sourceUrl || "Not measured") + '</code></dd><dt>Activation source</dt><dd><code>' + esc(r.deployed?.sourceUrl || "Not measured") + '</code></dd><dt>Live proof source</dt><dd><code>' + esc(r.verifiedLive?.sourceUrl || "Not measured") + '</code></dd><dt>Queue source</dt><dd>' + esc(p.queueCoverage?.source || "Not measured") + '</dd></dl></details><details><summary>Read the measure definitions and limits</summary><ul class="evidence-list"><li>New PRs: creation events within the displayed complete-day window, including drafts.</li><li>Merged and closed unmerged: separate lifecycle event counts; a merge-related close receipt is counted once.</li><li>Open PRs: lifecycle reconstruction through the collection cutoff, including older open work and drafts.</li><li>Delivered outcomes, DORA, costs and product health: not measured by this view. Grouping does not certify delivery.</li><li>Stage age: recorded stage entry to the owner record’s observation time; missing entry is unknown.</li><li>Seven/28-day windows use complete Australia/Sydney dates, [start midnight, end midnight). Historical noon comparisons use their own explicit cutoffs.</li></ul></details></section>';
}
function renderOverview(projection, { asOf = new Date().toISOString() } = {}) {
  instant(asOf);
  if (projection !== null && (typeof projection !== "object" || Array.isArray(projection) || projection.schemaVersion !== VERSION)) fail("invalid_overview_projection");
  const p = projection || {}, state = sourceState(p, asOf);
  const empty = !p.currentBacklogAtCollection;
  const banner = state.state === "error"
    ? empty ? "Refresh failed. No retained snapshot is available." : "Refresh failed. The retained snapshot is shown; counts have not been reset." : empty
      ? "No retained snapshot. Measurements remain unavailable." : state.state === "stale"
      ? "This source snapshot is stale. Recorded facts remain available." : state.state === "loading"
        ? "A loading state was supplied. Any retained facts remain dated observations." : "Local snapshot only. No live refresh or task execution is inferred.";
  const csp = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="' + esc(csp) + '"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">',
    "<title>Nothing Sport · Private local Overview</title><style>" + CSS + "</style></head><body>",
    '<a class="skip" href="#overview">Skip to Overview</a><header class="masthead"><div class="brand">Nothing Sport<small>Administration · private local view</small></div><nav aria-label="Overview sections"><a href="#overview">Overview</a><a href="#delivery">Delivery</a><a href="#queue">Queue</a><a href="#evidence">Evidence</a></nav></header>',
    '<main id="overview" tabindex="-1"><div class="page-heading"><div><h1>Overview</h1><p class="muted">Delivery, production evidence and the next recorded action.</p></div><div class="asof">View rendered ' + stamp(asOf) + "</div></div>",
    '<div class="source-banner" role="status">' + badge(state.state === "error" ? "error" : empty ? "empty" : state.state) + "<div><p>" + esc(banner) + "</p><small>Source as of " + stamp(state.sourceAsOf) + "</small>" + (p.freshness?.error?.code ? "<p>Refresh code: <code>" + esc(p.freshness.error.code) + "</code></p>" : "") + "</div></div>",
    production(p, asOf),
    '<div class="source-banner"><span class="label">Next recorded action</span><div>' + (Array.isArray(p.queue) && p.queue.length
      ? '<p><strong>' + esc(p.queue[0].owner || "Not measured") + '</strong> · ' + esc(p.queue[0].nextAction || "Not measured") + '</p><small>From supplied queue order · ' + (p.queueCoverage?.complete === true ? "observed coverage" : "partial coverage") + ' · ' + stamp(p.queueCoverage?.observedAt) + '</small>'
      : '<p class="muted">Not measured. No next action has been inferred.</p>') + '</div></div>',
    delivery(p), queue(p), evidence(p, state),
    "<footer>Read only · owner-local file · no external resources or automatic refresh. This view does not authorise a merge or release. Hosted identity binding and permanent services remain deferred.</footer></main></body></html>",
  ].join("\n");
}
module.exports = { renderOverview, esc, sourceState, liveState };
