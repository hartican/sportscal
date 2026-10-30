'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const requestedEngines = (process.env.FOLLOW_CONTROL_ENGINES || 'chromium,webkit').split(',');
assert(requestedEngines.length && new Set(requestedEngines).size === requestedEngines.length && requestedEngines.every(engine => ['chromium', 'webkit'].includes(engine)), 'Choose each supported Follow browser at most once');
if (process.argv.includes('--preflight')) {
  assert(fs.readFileSync(path.join(root, 'assets/js/follow-navigation.js'), 'utf8').includes("const followControl=controls.querySelector('.follow-sport-control')"));
  assert(fs.readFileSync(path.join(root, 'assets/js/follow-presentation-ui.js'), 'utf8').includes('follow.checked=followed'));
  require('./validate-follow-sport-control');
  console.log(JSON.stringify({ preflight: true, cases: requestedEngines.length * 4, browsersStarted: 0, externalRequests: 0 }));
} else {
  const engines = require(modulePath);
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  function prepareFollowDocumentWheel() {
    const main = document.getElementById('mainContent'), list = document.getElementById('listView'), root = document.scrollingElement;
    if (!main?.isConnected || !list?.isConnected || !root || root === main) throw new Error('Document wheel needs mounted MAIN and a separate document scroll owner');
    const m = main.getBoundingClientRect(), l = list.getBoundingClientRect();
    const left = Math.max(0, m.left), right = Math.min(innerWidth, m.right, l.left);
    const point = { x: (left + right) / 2, y: innerHeight / 2 };
    if (!(right > left && point.x > 0 && point.x < innerWidth && point.y > Math.max(0, m.top) && point.y < Math.min(innerHeight, m.bottom))) throw new Error('Document wheel needs a visible MAIN gutter point');
    const style = getComputedStyle(main), rootStyle = getComputedStyle(root), bodyStyle = getComputedStyle(document.body);
    if (document.elementFromPoint(point.x, point.y) !== main || main.closest('[inert]') || style.display === 'none' || style.visibility !== 'visible' || style.pointerEvents === 'none' || ['fixed', 'sticky'].includes(style.position)) throw new Error('Document wheel point must hit the visible non-overlay MAIN itself');
    if (root.scrollHeight - root.clientHeight <= 100 || [rootStyle, bodyStyle].some(style => ['hidden', 'clip'].includes(style.overflowY)) || (['auto', 'scroll'].includes(style.overflowY) && main.scrollHeight > main.clientHeight + 1)) throw new Error('Document wheel needs an unlocked scrollable document, not a nested MAIN scroller');
    globalThis.qaFollowDocumentWheel = null;
    document.addEventListener('wheel', event => {
      globalThis.qaFollowDocumentWheel = { trusted: event.isTrusted, targetMain: event.target === main, mainConnected: main.isConnected,
        clientX: event.clientX, clientY: event.clientY, deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, defaultPrevented: event.defaultPrevented };
    }, { passive: true, once: true });
    return { ...point, rootMaxScroll: root.scrollHeight - root.clientHeight, target: 'MAIN#mainContent' };
  }
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
    assert(await label.evaluate(function followLabelHasTouchTarget(element) {
      const rect = element.getBoundingClientRect();
      if (rect.height >= 44) return true;
      // Failure only: retain the exact measured node before a later remount.
      try {
        const describe = (node, measuredRect) => {
          if (!node) return null;
          const box = measuredRect || node.getBoundingClientRect(), style = getComputedStyle(node);
          return { connected: node.isConnected, hidden: Boolean(node.hidden), inert: Boolean(node.inert),
            hiddenAncestor: Boolean(node.closest('[hidden]')), current: node === document.querySelector('.follow-sport-control'),
            rect: Object.fromEntries(['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'].map(key => [key, box[key]])),
            style: Object.fromEntries(['display', 'visibility', 'min-height', 'height', 'max-height', 'box-sizing', 'font-family', 'font-size', 'line-height', 'padding-top', 'padding-bottom', 'border-top-width', 'border-bottom-width', 'transform', 'zoom', 'content-visibility'].map(key => [key, style.getPropertyValue(key)])) };
        };
        const current = document.querySelector('.follow-sport-control');
        globalThis.qaFollowLabelFailure = { measuredHeight: rect.height,
          measured: describe(element, rect), current: describe(current, current === element ? rect : null),
          sameNode: current === element, currentCount: document.querySelectorAll('.follow-sport-control').length,
          fontStatus: document.fonts?.status ?? null };
      } catch (_) {
        try { globalThis.qaFollowLabelFailure = { measuredHeight: rect.height, captureError: true }; } catch (_) {}
      }
      return false;
    }), 'The native label has a44px touch target');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
    return label;
  }
  (async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    const evidence = [];
    try {
      for (const engine of requestedEngines) {
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
              const wheelOrigin = await page.evaluate(prepareFollowDocumentWheel);
              await page.mouse.move(wheelOrigin.x, wheelOrigin.y);
              await page.mouse.wheel(0, 350);
              await page.waitForFunction(() => scrollY > 100);
              await page.waitForFunction(() => document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') === 'false');
              const wheelGesture = await page.evaluate(() => globalThis.qaFollowDocumentWheel);
              assert.deepEqual(wheelGesture, { trusted: true, targetMain: true, mainConnected: true,
                clientX: wheelOrigin.x, clientY: wheelOrigin.y, deltaX: 0, deltaY: 350, deltaMode: 0, defaultPrevented: false },
              'The unchanged wheel must be a trusted gesture over the guarded MAIN document point');
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
              const receipt = { engine, width, theme, scope, initialChecked, directoryReads, delayedDirectory: width === 320, initialOpenCollapseRedraw: true, realTapAndKeyboard: true, realSaveRefusal: true, globalOffAndSiblingScope: true, wheelOrigin, wheelGesture, errors: [] };
              evidence.push(receipt); console.log(JSON.stringify(receipt));
            } catch (originalError) {
              const captureStarted = performance.now(), deadline = captureStarted + 5000;
              const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()));
              const bounded = async work => { let timer; try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Failure capture deadline')), remaining()); })]); } finally { clearTimeout(timer); } };
              const capture = { phase: 'follow-control-failure', engine, width, theme, scope, initialChecked,
                acceptance: false,
                completedCases: evidence, captureBudgetMs: 5000,
                error: { name: originalError.name, message: String(originalError.message).slice(0, 16000), stack: String(originalError.stack).slice(0, 24000) },
                state: null, screenshot: null, captureErrors: [] };
              try {
                capture.state = await bounded(page.evaluate(() => {
                  const selectors = ['html', 'body', '#mainContent', '#listView', 'header.top', '.tabs', '.follow-home-tabs', '.follow-navigation', '.follow-navigation-toggle', '.follow-sport-control', '.follow-sport-control input', '#follow-navigation-controls', '.follow-section-panel', '.follow-schedule-panel', '#settingsModal', '#tuneSheet', '#startupLaunch'];
                  const describe = element => {
                    if (!element || element.nodeType !== 1) return null;
                    const r = element.getBoundingClientRect(), style = getComputedStyle(element);
                    return { tag: element.tagName, alias: selectors.find(selector => element.matches(selector)) || null,
                      connected: element.isConnected, hidden: Boolean(element.hidden), inert: Boolean(element.inert),
                      rect: Object.fromEntries(['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'].map(key => [key, r[key]])),
                      scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
                      maxScrollTop: Math.max(0, element.scrollHeight - element.clientHeight),
                      style: Object.fromEntries(['display', 'visibility', 'overflow-x', 'overflow-y', 'overscroll-behavior-y', 'touch-action', 'scroll-padding-top', 'scroll-padding-bottom', 'position', 'z-index', 'pointer-events', 'transform', 'min-height', 'height', 'max-height', 'box-sizing', 'font-family', 'font-size', 'line-height', 'zoom', 'content-visibility'].map(key => [key, style.getPropertyValue(key)])) };
                  };
                  const wheel = globalThis.qaFollowDocumentWheel ?? null, viewport = globalThis.visualViewport;
                  return { shellVersion: document.querySelector('meta[name="app-shell-version"]')?.content ?? null,
                    hasFocus: document.hasFocus(), visibilityState: document.visibilityState,
                    activeElement: document.activeElement ? { tag: document.activeElement.tagName, alias: selectors.find(selector => document.activeElement.matches(selector)) || null } : null,
                    wheelRecorderPresent: Object.hasOwn(globalThis, 'qaFollowDocumentWheel'), wheel,
                    failedLabelMeasurement: globalThis.qaFollowLabelFailure ?? null,
                    scrollY, scrollX, innerWidth, innerHeight, scrollingElement: describe(document.scrollingElement),
                    visualViewport: viewport ? Object.fromEntries(['width', 'height', 'offsetTop', 'offsetLeft', 'pageTop', 'pageLeft', 'scale'].map(key => [key, viewport[key]])) : null,
                    navigationExpanded: document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') ?? null,
                    modalFlags: { modal: document.body.classList.contains('modal-open'), settings: document.body.classList.contains('settings-open'), score: document.body.classList.contains('nsc-open') },
                    nodes: selectors.map(selector => ({ selector, element: describe(document.querySelector(selector)) })),
                    postFailureHitStackAtRecordedWheel: wheel && Number.isFinite(wheel.clientX) && Number.isFinite(wheel.clientY) ? document.elementsFromPoint(wheel.clientX, wheel.clientY).slice(0, 8).map(describe) : null,
                    limits: 'Current failure state; a null receipt does not prove no event, and current hit stack is not historical target proof. No new pre-input observation.' };
                }));
              } catch (_) { capture.captureErrors.push('state'); }
              const output = process.env.FOLLOW_CONTROL_EVIDENCE_DIR;
              if (output) {
                const basename = `${engine}-${width}-${theme}-failure`;
                const save = () => fs.writeFileSync(path.join(output, basename + '.json'), JSON.stringify(capture, null, 2) + '\n');
                try { save(); } catch (_) { capture.captureErrors.push('initial-write'); }
                if (performance.now() < deadline) {
                  try { await bounded(page.screenshot({ path: path.join(output, basename + '.png'), timeout: remaining() })); capture.screenshot = basename + '.png'; }
                  catch (_) { capture.captureErrors.push('screenshot'); }
                } else { capture.captureErrors.push('capture-deadline'); }
                capture.elapsedMs = performance.now() - captureStarted;
                try { save(); } catch (_) { capture.captureErrors.push('final-write'); }
              } else { capture.captureErrors.push('missing-output-directory'); }
              console.error(JSON.stringify(capture));
              throw originalError;
            } finally { release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
          }
        } finally { await browser.close(); }
      }
      assert.equal(evidence.length, requestedEngines.length * 4, 'Every requested browser must finish all four original Follow cases');
    } finally { await new Promise(resolve => server.close(resolve)); }
    if (process.env.FOLLOW_CONTROL_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.FOLLOW_CONTROL_EVIDENCE_DIR, 'browser-receipts.json'), JSON.stringify({ cases: evidence, limits: 'Actual local app with disposable preferences and controlled network; service workers blocked. No hosted account, real delivery or physical-device claim.' }, null, 2) + '\n');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
