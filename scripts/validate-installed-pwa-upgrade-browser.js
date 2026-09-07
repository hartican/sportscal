"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const projectRoot = path.resolve(__dirname, "..");
const baselineSha = process.env.PWA_BASELINE_SHA || "7ae4d93c3bcae95bcec7d2c3549f8b07c9ade3b7";
const baselineRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-pwa-baseline-"));
const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-pwa-profile-"));
const candidateHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const candidateVersion = candidateHtml.match(/name="app-shell-version" content="(\d+)"/)?.[1];
const candidateWorker = fs.readFileSync(path.join(projectRoot, "service-worker.js"), "utf8");
assert.match(candidateWorker, /nothingsport-activate-update[\s\S]*event\.waitUntil\(self\.skipWaiting\(\)\)/, "an installed worker must accept the page activation handshake");
assert.match(candidateHtml, /watchServiceWorkerUpdate\(registration\)[\s\S]*registration\.update\(\)/, "the installed page must watch an update before requesting it");
assert.match(candidateHtml, /detectWaitingWorker[\s\S]*attempts >= 240[\s\S]*setTimeout\(detectWaitingWorker, 250\)/, "the page must cover a missed installed transition with one bounded waiting-worker check");
assert.match(candidateHtml, /document\.readyState === "complete"[\s\S]*window\.addEventListener\("load", registerInstalledServiceWorker, \{ once:true \}\)/, "late app-shell parsing must not miss service-worker registration");

function contentType(filePath){
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".css":"text/css; charset=utf-8",
    ".html":"text/html; charset=utf-8",
    ".ico":"image/x-icon",
    ".jpeg":"image/jpeg",
    ".jpg":"image/jpeg",
    ".js":"text/javascript; charset=utf-8",
    ".json":"application/json; charset=utf-8",
    ".png":"image/png",
    ".svg":"image/svg+xml",
    ".webmanifest":"application/manifest+json; charset=utf-8",
  })[extension] || "application/octet-stream";
}

function fileForRequest(root, requestUrl){
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(root, relativePath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

(async () => {
  let activeRoot = baselineRoot;
  let browser;
  let server;
  try{
    execFileSync(process.execPath, ["scripts/materialize-git-tree.js", baselineSha, baselineRoot], {
      cwd:projectRoot,
      stdio:"ignore",
    });
    // Use the actual previous release. Do not substitute candidate code and
    // merely relabel it as an older shell: that masks upgrade regressions.
    const baselineHtml = fs.readFileSync(path.join(baselineRoot, "index.html"), "utf8");
    const baselineVersion = baselineHtml.match(/name="app-shell-version" content="(\d+)"/)?.[1];
    assert(baselineVersion, "baseline shell version");
    assert(candidateVersion, "candidate shell version");
    assert(Number(candidateVersion) > Number(baselineVersion), "candidate shell must advance the baseline version");

    server = http.createServer((request, response) => {
      const filePath = fileForRequest(activeRoot, request.url || "/");
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()){
        response.writeHead(404, { "content-type":"text/plain; charset=utf-8", "cache-control":"no-store" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type":contentType(filePath),
        "cache-control":path.basename(filePath) === "service-worker.js" ? "no-cache, no-store, must-revalidate" : "no-store",
        ...(path.basename(filePath) === "service-worker.js" ? { "service-worker-allowed":"/" } : {}),
      });
      fs.createReadStream(filePath).pipe(response);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;

    browser = await chromium.launchPersistentContext(profileRoot, {
      headless:true,
      viewport:{ width:390, height:844 },
    });
    const page = browser.pages()[0] || await browser.newPage();
    const url = `${origin}/?installed-pwa-upgrade=1`;
    await page.goto(url, { waitUntil:"domcontentloaded" });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout:45_000 });

    // Relaunch the baseline under its installed controller, then close it as a
    // user would close an installed PWA before the next production release.
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.waitForFunction(expected => document.querySelector('meta[name="app-shell-version"]')?.content === expected, baselineVersion);
    assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true, "baseline relaunch must be controlled by the installed worker");
    await page.close();

    // The previous release worker is still installed. Its navigation must
    // fetch the candidate on the first launch after release, before any manual reload.
    activeRoot = projectRoot;
    const freshPage = await browser.newPage();
    await freshPage.goto(`${origin}/?first-navigation-after-release=1`, { waitUntil:"domcontentloaded" });
    const freshVersion = await freshPage.locator('meta[name="app-shell-version"]').getAttribute("content");
    assert.equal(freshVersion, candidateVersion, "first navigation after release must receive the current shell");
    assert.equal(new URL(freshPage.url()).searchParams.get("first-navigation-after-release"), "1", "the current-shell launch must preserve its route");

    console.log(JSON.stringify({
      baselineVersion,
      candidateVersion,
      installedBaselineController:true,
      firstNavigationCurrent:true,
      routePreserved:true,
    }, null, 2));
  }finally{
    await browser?.close();
    await new Promise(resolve => server?.close(resolve) || resolve());
    fs.rmSync(baselineRoot, { recursive:true, force:true });
    fs.rmSync(profileRoot, { recursive:true, force:true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
