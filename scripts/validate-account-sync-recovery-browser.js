#!/usr/bin/env node
'use strict';
// The mounted application, real auth transport and disposable loopback responses.
// No customer accounts, production requests or server-side data changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sync = require('../config/user-state-sync');
const root = path.resolve(__dirname, '..');
const engineName = process.env.ACCOUNT_RECOVERY_BROWSER || 'chromium';
const scenario = process.env.ACCOUNT_RECOVERY_CASE || 'retry-error';
if (scenario === 'all') {
  let failed = false;
  for (const engine of (process.env.ACCOUNT_RECOVERY_BROWSER ? [engineName] : ['chromium', 'webkit'])) {
    for (const testCase of ['retry-error', 'pending-receipt', 'resume', 'cold-retry', 'offline', 'terminal', 'refresh-failure', 'follow-roundtrip', 'origin-isolation', 'timeout', 'overlap']) {
      const result = spawnSync(process.execPath, [__filename], { stdio: 'inherit', env: {
        ...process.env, ACCOUNT_RECOVERY_BROWSER: engine, ACCOUNT_RECOVERY_CASE: testCase } });
      failed ||= result.status !== 0;
    }
  }
  process.exit(failed ? 1 : 0);
}
const owner = 'disposable-account-a';
const token = id => 'e30.' + Buffer.from(JSON.stringify({ sub: id })).toString('base64url') + '.disposable';
const clone = value => JSON.parse(JSON.stringify(value));
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
  if (process.env.ACCOUNT_RECOVERY_BASELINE) {
    try { const data = execFileSync('git', ['show', process.env.ACCOUNT_RECOVERY_BASELINE + ':' + path.relative(root, file)], { cwd: root, maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
    catch { res.writeHead(404).end(); }
    return;
  }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? 'Not found' : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const origins = new Set([url]);
  const browser = await (engineName === 'webkit' ? webkit : chromium).launch({ headless: true,
    ...(engineName === 'chromium' ? { channel: process.env.QA_BROWSER_CHANNEL || 'chrome' } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  let row = null, readMode = 'success', refreshMode = 'success', reads = 0, writes = 0, refreshes = 0;
  let beforeAck = null, page;
  const heldReads = [];
  const statePayload = () => ({ user: { id: owner, email: 'disposable@example.invalid' }, state: row && {
    schema_version: row.schemaVersion, preferences: row.preferences, profile: row.profile,
    event_user_state: row.eventUserState, event_spoiler_state: row.eventSpoilerState,
    archived_events: row.archivedEvents, ratings: row.ratings, updated_at: row.updatedAt } });
  const errors = [], blocked = [], statuses = [];
  try {
    await context.addInitScript(() => {
      if ('serviceWorker' in navigator) Object.defineProperty(navigator.serviceWorker, 'ready', {
        configurable: true, value: Promise.resolve({ pushManager: { getSubscription: async () => null } }) });
    });
    const routeHandler = async route => {
      const request = route.request(), u = new URL(request.url());
      if (!origins.has(u.origin)) { blocked.push(u.origin); return route.abort('blockedbyclient'); }
      if (!u.pathname.startsWith('/api/')) return route.continue();
      const body = request.postDataJSON() || {}, method = request.method();
      if (u.pathname === '/api/auth') {
        if (method === 'GET') return route.fulfill({ json: { configured: true } });
        if (body.action === 'refresh') {
          refreshes++;
          if (refreshMode === 'terminal') return route.fulfill({ status: 401, json: { code: 'refresh_token_revoked', error: 'Disposable revoked session' } });
          if (refreshMode === 'failure') return route.fulfill({ status: 503, json: { error: 'Disposable offline refresh' } });
        }
        if (['password-sign-in', 'refresh'].includes(body.action)) return route.fulfill({ json: {
          session: { access_token: token(owner), refresh_token: 'disposable-' + refreshes, expires_in: 3600 } } });
        return route.fulfill({ json: { ok: true } });
      }
      if (u.pathname === '/api/user-state') {
        reads++;
        if (readMode === 'hold') { heldReads.push(route); return; }
        if (readMode === 'failure') return route.fulfill({ status: 503, json: { error: 'Disposable state unavailable' } });
        if (method === 'PUT') {
          writes++; row = { ...sync.applyPatch(row || {}, body.patch), updatedAt: new Date(Date.now() + writes * 1000).toISOString() };
          if (beforeAck) { const callback = beforeAck; beforeAck = null; await callback(); }
        }
        return route.fulfill({ json: statePayload() });
      }
      if (u.pathname === '/api/user-meta') return route.fulfill({ json: { meta: { sports: [] } } });
      if (u.pathname === '/api/nothingscore' && u.searchParams.has('viewer')) return route.fulfill({ json: {
        viewer: { signedIn: true, profile: { handle: 'test_account', displayName: 'Test account', visibility: 'visible' } } } });
      if (u.pathname === '/api/fixtures') return route.fulfill({ status: 503, json: { error: 'Disposable optional fixtures unavailable' } });
      return route.fulfill({ status: 503, json: { error: 'Disposable optional service unavailable' } });
    };
    await context.route('**/*', routeHandler);
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
    row = await page.evaluate(() => {
      const p = clonePreferences(userPreferences); p.onboardingComplete = true;
      savePreferences(p); writeStorage(STORAGE_KEYS.selectorReleaseAcknowledgement, SELECTOR_TAXONOMY.version);
      closeSelectorOptInPrompt();
      return { ...currentServerStatePayload(), updatedAt: '2026-10-23T01:00:00Z' };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !startupCoordinator.isHydrating());
    await page.locator('#startupLaunch').waitFor({ state: 'hidden' });
    await page.evaluate(() => { closeSettings(); openSettings({ section: 'account' }); });
    await page.locator('#accountEmail').fill('disposable@example.invalid');
    await page.locator('#accountPassword').fill('test-only-password');
    await page.locator('#accountSignInForm button[type="submit"]').click();
    await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    await page.waitForFunction(() => Boolean(accountIndicatorController));
    await page.waitForFunction(() => nothingscoreViewerScope?.owner === serverPersistence.user?.id);
    await page.waitForTimeout(1200); // Drain optional sign-in/profile/Follow effects before isolating resume.
    await page.evaluate(() => serverSyncSequence);
    await page.evaluate(() => {
      const original = setServerPersistence;
      globalThis.qaSyncStates = [];
      setServerPersistence = patch => { qaSyncStates.push(patch.state); return original(patch); };
    });
    if (scenario === 'retry-error') {
      readMode = 'failure';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'error');
      const detail = await page.locator('#accountSyncDetail').innerText();
      assert.match(detail, /unavailable|retry|saved on this device|local copy/i,
        'failed manual sync must expose its failure rather than only Not synced yet / Last synced');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true, 'failed sync must release its button');
      readMode = 'success';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    } else if (scenario === 'timeout') {
      const localBefore = await page.evaluate(() => JSON.stringify(userPreferences));
      const writeCount = writes, started = Date.now();
      readMode = 'hold';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'syncing');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), false, 'active network request owns the pending state');
      await page.waitForFunction(() => serverPersistence.state === 'error', null, { timeout: 25000 });
      assert(Date.now() - started >= 14000, 'exercise the real 15-second transport deadline, not an injected HTTP error');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true, 'transport timeout releases retry');
      assert.equal(await page.evaluate(() => serverSyncClient.accountSnapshot().hasSession), true);
      assert.equal(await page.evaluate(() => JSON.stringify(userPreferences)), localBefore);
      assert.equal(writes, writeCount, 'timed-out read sends no save');
      readMode = 'success';
      for (const held of heldReads.splice(0)) await held.abort().catch(() => {}); // Already cancelled by the client's deadline.
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    } else if (scenario === 'overlap') {
      await page.clock.install();
      await page.clock.setFixedTime(new Date(Date.now() + 16000));
      const beforeReads = reads, beforeWrites = writes;
      readMode = 'hold';
      await page.evaluate(() => dispatchEvent(new Event('pageshow')));
      await page.waitForFunction(() => serverPersistence.state === 'syncing');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), false);
      await page.evaluate(() => {
        document.getElementById('syncAccountNowBtn').click(); // Disabled UI cannot dispatch another request.
        globalThis.qaQueuedRetry = syncCurrentServerState({ notify: true }); // A manual intent already queued before redraw.
        dispatchEvent(new Event('pageshow')); dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(100);
      assert.equal(reads - beforeReads, 1, 'manual/foreground overlap never starts a concurrent state request');
      assert.equal(heldReads.length, 1);
      readMode = 'success';
      await heldReads.shift().fulfill({ json: statePayload() });
      await page.evaluate(() => qaQueuedRetry);
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      assert.equal(reads - beforeReads, 2, 'one automatic read and the serialised manual retry finish');
      assert.equal(writes, beforeWrites, 'overlap creates no duplicate saves');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true);
    } else if (scenario === 'pending-receipt') {
      await page.evaluate(() => {
        const p = clonePreferences(userPreferences); p.theme = 'night';
        savePreferences(p, { deliberate: true, deferFollowEffects: true });
      });
      beforeAck = () => page.evaluate(() => {
        const p = clonePreferences(userPreferences); p.theme = 'day';
        savePreferences(p, { deliberate: true, deferFollowEffects: true });
        clearTimeout(serverSyncTimer);
      });
      await page.evaluate(() => syncCurrentServerState({ notify: true }));
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true,
        'a completed request with a newer durable receipt must leave a usable retry button');
      assert.match(await page.locator('#accountSyncDetail').innerText(), /waiting|saved on this device|retry/i);
    } else if (scenario === 'offline') {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        dispatchEvent(new Event('offline'));
      });
      readMode = 'failure';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'error');
      assert.equal(await page.evaluate(() => serverSyncClient.accountSnapshot().hasSession), true);
      const before = reads;
      readMode = 'success';
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        dispatchEvent(new Event('online')); dispatchEvent(new Event('pageshow'));
      });
      await page.waitForTimeout(100);
      assert.equal(reads, before, 'hidden app does not start recovery reads');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        dispatchEvent(new Event('online')); dispatchEvent(new Event('pageshow'));
      });
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      assert.equal(reads - before, 1, 'foreground event burst coalesces to one existing sync read');
    } else if (scenario === 'cold-retry') {
      readMode = 'failure';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => serverPersistence.state === 'error' && Boolean(accountIndicatorController));
      await page.locator('#startupLaunch').waitFor({ state: 'hidden' });
      await page.waitForTimeout(300);
      for (const id of ['dismissTunePromptBtn', 'skipSelectorOptInBtn']) {
        const button = page.locator('#' + id); if (await button.isVisible()) await button.click();
      }
      await page.evaluate(() => openSettings({ section: 'account' }));
      await page.getByRole('button', { name: 'Retry account', exact: true }).waitFor();
      assert.equal(await page.locator('#accountEmail').count(), 0, 'a temporary restore failure does not require a new password');
      readMode = 'success';
      await page.getByRole('button', { name: 'Retry account', exact: true }).click();
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    } else if (scenario === 'origin-isolation') {
      const oldServer = http.createServer(server.listeners('request')[0]);
      await new Promise(resolve => oldServer.listen(0, '127.0.0.1', resolve));
      const oldUrl = `http://127.0.0.1:${oldServer.address().port}`;
      origins.add(oldUrl);
      const oldPage = await context.newPage(), before = writes;
      const newChoices = await page.evaluate(() => JSON.stringify(userPreferences.preferenceGraph.entityFollows));
      try {
        await oldPage.goto(oldUrl, { waitUntil: 'domcontentloaded' });
        await oldPage.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
        assert.equal(await oldPage.evaluate(() => serverSyncClient.accountSnapshot().hasSession), false, 'another origin cannot inherit the new origin session');
        await oldPage.evaluate(() => {
          const p = clonePreferences(userPreferences); p.onboardingComplete = true;
          p.preferenceGraph = PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph, 'team:football:australian-championship:11255', 'follow');
          savePreferences(p, { deferFollowEffects: true });
        });
        await oldPage.reload({ waitUntil: 'domcontentloaded' });
        await oldPage.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
        assert(await oldPage.evaluate(() => userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === 'team:football:australian-championship:11255')));
        assert.equal(await page.evaluate(() => JSON.stringify(userPreferences.preferenceGraph.entityFollows)), newChoices, 'old-origin local follows are retained, never silently imported into the new account');
        assert.equal(writes, before, 'origin-isolation check sends no extra account writes');
      } finally { await oldPage.close(); await new Promise(resolve => oldServer.close(resolve)); }
    } else if (scenario === 'follow-roundtrip') {
      const participant = 'team:football:australian-championship:11255';
      const saveFollow = async level => {
        await page.evaluate(({ participant, level }) => {
          const p = clonePreferences(userPreferences);
          p.preferenceGraph = PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph, participant, level);
          if (!savePreferences(p, { deliberate: true, deferFollowEffects: true })) throw new Error('Disposable Follow was not saved');
        }, { participant, level });
        await page.evaluate(() => syncCurrentServerState());
      };
      await saveFollow('follow');
      assert(row.preferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'follow'));
      const session = await page.evaluate(() => serverSyncClient.getSession());
      const other = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      try {
        await other.route('**/*', routeHandler);
        await other.addInitScript(session => localStorage.setItem('ns_auth_persistent_session_v1', JSON.stringify(session)), session);
        const second = await other.newPage();
        await second.goto(url, { waitUntil: 'domcontentloaded' });
        await second.waitForFunction(participant => serverPersistence.state === 'signedIn' && userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'follow'), participant);
        const collection = require('../data/football/fixtures/australian-championship.json');
        const fixtures = Object.values(collection).find(value => Array.isArray(value) && value.some(item => item?.id === 'football-australian-championship-2026-22278878'));
        const fixture = fixtures?.find(item => item.id === 'football-australian-championship-2026-22278878');
        assert(fixture, 'retain the exact Canberra v Sutherland fixture, not the different Sydney match');
        const { buildServerFeed } = require('../lib/server-feed-pipeline');
        const feed = () => buildServerFeed({ events: [fixture], userId: owner, userState: row, now: new Date('2026-10-23T04:00:00Z') });
        assert(feed().events.some(item => item.id === fixture.id), 'the saved explicit Canberra follow admits the retained fixture');
        await second.waitForTimeout(1200);
        await second.waitForFunction(() => Boolean(accountIndicatorController));
        await second.evaluate(() => serverSyncSequence);
        await page.evaluate(() => syncCurrentServerState()); // Establish the newer device baseline before a new edit.
        await saveFollow('unfollow');
        assert.equal(feed().events.some(item => item.id === fixture.id), false, 'explicit unfollow excludes the same fixture');
        await second.clock.install();
        await second.clock.setFixedTime(new Date(Date.now() + 16000)); // A later foreground, outside the event-burst throttle.
        await second.evaluate(() => dispatchEvent(new Event('pageshow')));
        await second.waitForFunction(participant => userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'unfollow'), participant, { timeout: 5000 }).catch(async error => {
          console.error(JSON.stringify({ second: await second.evaluate(() => ({ state: serverPersistence, follows: userPreferences.preferenceGraph.entityFollows, baseline: serverStateBaseline?.updatedAt, life: serverSyncClient.accountSnapshot(), hidden:document.hidden })), remote: row.preferences.preferenceGraph.entityFollows, remoteAt:row.updatedAt }));
          throw error;
        });
        await second.reload({ waitUntil: 'domcontentloaded' });
        await second.waitForFunction(participant => serverPersistence.state === 'signedIn' && userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'unfollow'), participant);
      } finally { await other.close(); }
    } else if (['resume', 'terminal', 'refresh-failure'].includes(scenario)) {
      const localBefore = await page.evaluate(() => JSON.stringify(userPreferences));
      if (scenario === 'terminal') refreshMode = 'terminal';
      if (scenario === 'refresh-failure') refreshMode = 'failure';
      await page.clock.install();
      await page.clock.setFixedTime(new Date(Date.now() + 2 * 3600000));
      await page.evaluate(() => dispatchEvent(new Event('pageshow')));
      if (scenario === 'terminal') {
        await page.waitForFunction(() => serverPersistence.state === 'signedOut' && !serverSyncClient.accountSnapshot().hasSession);
        assert.equal(await page.evaluate(() => JSON.stringify(userPreferences)), localBefore, 'terminal auth preserves local choices');
        assert.equal(await page.locator('#accountIndicator .account-awareness-label').innerText(), 'Not signed in');
      } else if (scenario === 'refresh-failure') {
        await page.waitForFunction(() => serverPersistence.state === 'error');
        assert.equal(await page.evaluate(() => serverSyncClient.accountSnapshot().hasSession), true, 'temporary refresh failure retains saved session');
        assert.match(await page.locator('#accountSyncControls').innerText(), /Saved account:/, 'expired saved identity is not labelled signed in');
        assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true);
        refreshMode = 'success';
        await page.locator('#syncAccountNowBtn').click();
        await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      } else await page.waitForFunction(() => serverSyncClient.accountSnapshot().expiresAt > Date.now()).catch(async error => {
        console.error({ scenario, refreshes, expiredSession: await page.evaluate(() => serverSyncClient.accountSnapshot().expiresAt <= Date.now()) });
        throw error;
      });
      assert(refreshes > 0, 'foreground return must refresh an expired access token automatically');
      if (scenario !== 'terminal') await page.waitForFunction(() => document.querySelector('#accountIndicator [data-account-status]')?.dataset.accountStatus === 'signedIn');
    } else throw new Error('Unknown recovery scenario ' + scenario);
    statuses.push(...await page.evaluate(() => globalThis.qaSyncStates || []));
    assert.deepEqual(errors, [], 'no uncaught application errors');
    console.log(JSON.stringify({ scenario, engine: engineName, passed: true, reads, writes, refreshes, statuses,
      blockedOrigins: [...new Set(blocked)], limits: 'Loopback mocked transport; no hosted or physical iPhone proof' }));
  } finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
