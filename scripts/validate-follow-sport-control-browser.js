'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
if (process.argv.includes('--preflight')) {
  assert(fs.readFileSync(path.join(root, 'assets/js/follow-navigation.js'), 'utf8').includes("const followControl=controls.querySelector('.follow-sport-control')"));
  assert(fs.readFileSync(path.join(root, 'assets/js/follow-presentation-ui.js'), 'utf8').includes('follow.checked=followed'));
  require('./validate-follow-sport-control');
  console.log(JSON.stringify({ preflight: true, cases: 8, browsersStarted: 0, externalRequests: 0 }));
} else {
  const engines = require(modulePath);
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  const choiceSnapshot = page => page.evaluate(() => JSON.stringify({
    selected: userPreferences.selectedSelectorEntityIds,
    sports: userPreferences.followedSports,
    entities: userPreferences.preferenceGraph.entityFollows.map(({ profileId, ...choice }) => choice),
    excludedEvents: userPreferences.followFirst.excludedMajorEventIds,
    eventDecisions: userPreferences.followFirst.eventFamilyDecisions,
    notifications: userPreferences.followFirst.notifications,
    showSpoilers: userPreferences.showSpoilers,
    actions: eventActions,
  }));
  async function assertAvailable(page) {
    const label = page.locator('.follow-sport-control');
    assert.equal(await label.count(), 1, 'Exactly one selected-sport Follow control');
    assert(await label.isVisible(), 'Follow remains visible while the sports menu is collapsed');
    assert(await label.locator('input').isEnabled());
    assert(await label.evaluate(element => element.getBoundingClientRect().height >= 44), 'The native label has a44px touch target');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
    return label;
  }
  (async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    const evidence = [];
    try {
      for (const engine of ['chromium', 'webkit']) {
        const browser = await engines[engine].launch({ headless: true });
        try {
          for (const width of [320, 390]) for (const theme of ['day', 'night']) {
            const scope = theme === 'night' ? 'sport:tennis-women' : 'sport:tennis';
            const directory = scope.slice(6), initialChecked = width === 390;
            const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, hasTouch: true, serviceWorkers: 'block' });
            const page = await context.newPage(), errors = [];
            page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
            let release; const directoryGate = new Promise(resolve => { release = resolve; });
            let directoryReads = 0;
            try {
              await page.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.fulfill({ status: 503, body: 'Disposable local test: external network disabled' }));
              await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Disposable local test' } }));
              await page.addInitScript(({ scope, initialChecked, theme }) => localStorage.setItem('ns_preferences_v1', JSON.stringify({
                version: 26, onboardingComplete: true, selectedSelectorEntityIds: initialChecked ? [scope] : [], followedSports: initialChecked ? [scope.slice(6)] : [],
                theme, showSpoilers: false, followBrowse: { sportId: scope, categoryId: scope, section: 'teams-players', gender: scope.endsWith('-women') ? 'women' : 'men' },
                followFirst: { excludedMajorEventIds: ['us-open'], notifications: { userChoice: false, enabled: false, sportingRemindersEnabled: false, autoRemindersEnabled: false } },
              })), { scope, initialChecked, theme });
              await page.goto(url, { waitUntil: 'domcontentloaded' });
              await page.waitForFunction(() => startupFunnelFinished && !startupCoordinator.isHydrating(), null, { timeout: 60000 });
              await page.locator('#startupLaunch').waitFor({ state: 'hidden' });
              await page.evaluate(() => { setTunePromptOpen(false); suppressSessionRatingPrompt(); });
              await page.route('**/data/follow-directory/' + directory + '.v1.*', async route => { directoryReads++; if (width === 320) await directoryGate; await route.continue(); });
              await page.locator('.tabs [data-tab="follow"]').tap();
              await page.locator('.follow-navigation').waitFor();
              assert.equal(await page.evaluate(() => followSelectedEntity().id), scope);
              let control = await assertAvailable(page);
              assert.equal(await control.locator('input').isChecked(), initialChecked);
              const beforeBrowse = await choiceSnapshot(page);
              await page.evaluate(() => renderFollowView());
              await assertAvailable(page);
              release();
              await page.waitForFunction(key => followDirectoryChunks.has(key), directory);
              await page.locator('.follow-directory-tabs').getByRole('button', { name: 'Players', exact: true }).tap();
              await page.locator('.follow-directory-row').first().waitFor();
              const toggle = page.locator('.follow-navigation-toggle');
              if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.tap();
              await assertAvailable(page);
              await page.evaluate(() => scrollTo(0, 0));
              await page.waitForTimeout(180); // Beyond the existing navigation owner's150ms scroll lock.
              await page.mouse.wheel(0, 350);
              await page.waitForFunction(() => scrollY > 100);
              await page.waitForFunction(() => document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') === 'false');
              await assertAvailable(page);
              await page.evaluate(() => renderAll({ preserveViewport: true }));
              control = await assertAvailable(page);
              assert.equal(await choiceSnapshot(page), beforeBrowse, 'Browsing, late loads and redraw preserve choices and notification OFF');
              await control.tap();
              await page.waitForFunction(({ scope, expected }) => userPreferences.selectedSelectorEntityIds.includes(scope) === expected, { scope, expected: !initialChecked });
              control = await assertAvailable(page);
              assert.equal(await control.locator('input').isChecked(), !initialChecked);
              await control.locator('input').focus(); await page.keyboard.press('Space');
              await page.waitForFunction(({ scope, expected }) => userPreferences.selectedSelectorEntityIds.includes(scope) === expected, { scope, expected: initialChecked });
              control = await assertAvailable(page); assert.equal(await control.locator('input').isChecked(), initialChecked);
              const beforeRefusal = await choiceSnapshot(page);
              await page.evaluate(() => { globalThis.qaFollowPersistence = serverPersistence; globalThis.qaFollowBaseline = serverStateBaseline; serverPersistence = { ...serverPersistence, user: { id: '11111111-1111-4111-8111-111111111111' } }; serverStateBaseline = null; });
              await control.tap();
              assert.equal(await choiceSnapshot(page), beforeRefusal, 'Existing unhydrated-account save refusal preserves previous choices');
              assert.equal(await page.locator('.follow-sport-control input').isChecked(), initialChecked, 'A refused save restores the displayed checked state');
              await page.evaluate(() => { serverPersistence = qaFollowPersistence; serverStateBaseline = qaFollowBaseline; });
              assert.equal(await page.evaluate(() => userPreferences.followFirst.notifications.enabled), false);
              assert.equal(await page.evaluate(({ scope }) => userPreferences.selectedSelectorEntityIds.includes(scope === 'sport:tennis' ? 'sport:tennis-women' : 'sport:tennis'), { scope }), false, 'No sibling gender follow is created');
              assert.deepEqual(errors, []);
              if (process.env.FOLLOW_CONTROL_EVIDENCE_DIR) await page.screenshot({ path: path.join(process.env.FOLLOW_CONTROL_EVIDENCE_DIR, `${engine}-${width}-${theme}.png`) });
              const receipt = { engine, width, theme, scope, initialChecked, directoryReads, delayedDirectory: width === 320, initialOpenCollapseRedraw: true, realTapAndKeyboard: true, realSaveRefusal: true, globalOffAndSiblingScope: true, errors: [] };
              evidence.push(receipt); console.log(JSON.stringify(receipt));
            } finally { release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
          }
        } finally { await browser.close(); }
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
    if (process.env.FOLLOW_CONTROL_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.FOLLOW_CONTROL_EVIDENCE_DIR, 'browser-receipts.json'), JSON.stringify({ cases: evidence, limits: 'Actual local app with disposable preferences and controlled network; service workers blocked. No hosted account, real delivery or physical-device claim.' }, null, 2) + '\n');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
