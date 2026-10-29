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
              await page.evaluate(() => { setTunePromptOpen(false); suppressSessionRatingPrompt();              (() => {
                const ring = [], faults = [], identities = new WeakMap();
                let armed = false, dropped = 0, faultDropped = 0, nextId = 0, sequence = 0;
                let wheelCount = 0, firstWheelCapture = null, firstWheelBubble = null, lastWheelPoint = null;
                const selectors = ['#follow-navigation-controls', '.follow-navigation-toggle', '.follow-navigation', '.follow-home-tabs', '.follow-directory-tabs', '.follow-directory-row', '.follow-section-panel', '.follow-schedule-panel', '#listView', '#mainContent', 'header.top', '.tabs', '#settingsModal', '#tuneSheet', '#startupLaunch', 'html', 'body'];
                const finite = number => Number.isFinite(number) ? number : null;
                const identity = element => { if (!element) return null; if (!identities.has(element)) identities.set(element, ++nextId); return identities.get(element); };
                const fault = stage => { if (faults.length < 8) faults.push({ stage, atMs: performance.now() }); else faultDropped++; };
                const node = element => {
                  if (!element || element.nodeType !== 1) return null;
                  const r = element.getBoundingClientRect(), style = getComputedStyle(element);
                  return {
                    identity: identity(element), tag: element.tagName,
                    alias: selectors.find(selector => element.matches(selector)) || null,
                    connected: element.isConnected, hidden: Boolean(element.hidden), inert: Boolean(element.inert),
                    rect: Object.fromEntries(['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'].map(key => [key, finite(r[key])])),
                    scrollTop: finite(element.scrollTop), scrollLeft: finite(element.scrollLeft),
                    scrollHeight: finite(element.scrollHeight), clientHeight: finite(element.clientHeight),
                    maxScrollTop: finite(Math.max(0, element.scrollHeight - element.clientHeight)),
                    style: Object.fromEntries(['display', 'visibility', 'overflow-x', 'overflow-y', 'overscroll-behavior-y', 'scroll-snap-type', 'scroll-behavior', 'scroll-padding-top', 'scroll-padding-bottom', 'touch-action', 'position', 'z-index', 'pointer-events', 'transform'].map(key => [key, style.getPropertyValue(key)])),
                  };
                };
                const snapshot = (kind, event = null, mutation = null) => {
                  const x = finite(event?.clientX), y = finite(event?.clientY), ancestors = [];
                  for (let current = event?.target?.nodeType === 1 ? event.target : null; current && ancestors.length < 8; current = current.parentElement) ancestors.push(node(current));
                  const viewport = globalThis.visualViewport, rootStyle = getComputedStyle(document.documentElement);
                  return {
                    sequence: ++sequence, kind, atMs: performance.now(), timeOrigin: performance.timeOrigin, armed, wheelSequence: wheelCount,
                    event: event ? { type: event.type, trusted: event.isTrusted, phase: event.eventPhase,
                      cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
                      clientX: x, clientY: y, deltaX: finite(event.deltaX), deltaY: finite(event.deltaY), deltaMode: finite(event.deltaMode),
                      target: node(event.target), ancestors,
                      hitStack: Number.isFinite(x) && Number.isFinite(y) ? document.elementsFromPoint(x, y).slice(0, 8).map(node) : [] } : null,
                    mutation, scrollY, scrollX, innerWidth, innerHeight, devicePixelRatio,
                    lastObservedWheelPoint: lastWheelPoint ? { ...lastWheelPoint, hitStack: Number.isFinite(lastWheelPoint.x) && Number.isFinite(lastWheelPoint.y) ? document.elementsFromPoint(lastWheelPoint.x, lastWheelPoint.y).slice(0, 8).map(node) : [] } : null,
                    visualViewport: viewport ? Object.fromEntries(['width', 'height', 'offsetTop', 'offsetLeft', 'pageTop', 'pageLeft', 'scale'].map(key => [key, finite(viewport[key])])) : null,
                    scrollingElement: node(document.scrollingElement),
                    navigationExpanded: document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') ?? null,
                    bodyFlags: { modalOpen: document.body.classList.contains('modal-open'), settingsOpen: document.body.classList.contains('settings-open'), scoreOpen: document.body.classList.contains('nsc-open') },
                    rootVariables: Object.fromEntries(['--sticky-top-bar-height', '--follow-navigation-height', '--ns-nav-space'].map(key => [key, rootStyle.getPropertyValue(key)])),
                    nodes: selectors.map(selector => ({ selector, element: node(document.querySelector(selector)) })),
                  };
                };
                const record = (kind, event = null, mutation = null) => {
                  try { const entry = snapshot(kind, event, mutation); if (ring.length === 64) { ring.shift(); dropped++; } ring.push(entry); return entry; }
                  catch (_) { fault(kind); }
                };
                const relevant = target => target === document.documentElement || target === document.body || target?.matches?.('.follow-navigation,#follow-navigation-controls,#listView');
                const observer = new MutationObserver(batch => {
                  if (!armed) return;
                  try {
                    const selected = batch.filter(change => relevant(change.target));
                    if (selected.length) record('mutation', null, { total: selected.length, omitted: Math.max(0, selected.length - 6), items: selected.slice(0, 6).map(change => ({ type: change.type, target: node(change.target), attribute: change.attributeName, added: change.addedNodes.length, removed: change.removedNodes.length })) });
                  } catch (_) { fault('mutation'); }
                });
                document.addEventListener('wheel', event => {
                  wheelCount++; lastWheelPoint = { x: finite(event.clientX), y: finite(event.clientY) };
                  if (!armed) {
                    armed = true;
                    observer.observe(document.documentElement, { subtree: true, attributes: true, childList: true, attributeFilter: ['class', 'style', 'hidden', 'inert'] });
                  }
                  const entry = record('wheel:capture', event); if (wheelCount === 1) firstWheelCapture = entry || null;
                }, { capture: true, passive: true });
                document.addEventListener('wheel', event => { const entry = record('wheel:bubble', event); if (wheelCount === 1) firstWheelBubble = entry || null; }, { passive: true });
                addEventListener('scroll', event => { if (armed) record('scroll:window-capture', event); }, { capture: true, passive: true });
                document.addEventListener('scroll', event => { if (armed) record('scroll:document-capture', event); }, { capture: true, passive: true });
                globalThis.qaFollowWheelCapture = () => {
                  let final = null;
                  try { final = snapshot('failure-final'); } catch (_) { fault('failure-final'); }
                  return { schema: 'follow-wheel.passive.v1', armed, capacity: 64, records: [...ring], dropped, wheelCount,
                    firstWheelCapture, firstWheelBubble, final, faults: [...faults], faultDropped,
                    limits: 'Passive disposable-test observations; synchronous geometry reads may perturb timing. No text, raw classes, values, preferences, account IDs or tokens.' };
                };
              })();
 });
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
            } catch (originalError) {
              const captureStarted = performance.now(), captureDeadline = captureStarted + 5000;
              const remaining = () => Math.max(1, Math.ceil(captureDeadline - performance.now()));
              const bounded = async work => {
                let timer;
                try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Passive capture deadline')), remaining()); })]); }
                finally { clearTimeout(timer); }
              };
              const capture = { phase: 'follow-wheel-failure', engine, width, theme, scope, initialChecked, directoryReads,
                completedCases: evidence, sourceCandidate: '153123267def97386b7c1b92da9560795a73cbe8',
                diagnosticOnly: true, acceptance: false, captureBudgetMs: 5000,
                error: { name: originalError.name, message: String(originalError.message).slice(0, 16000), stack: String(originalError.stack).slice(0, 24000) },
                geometry: null, screenshot: null, captureErrors: [] };
              try { capture.geometry = await bounded(page.evaluate(() => globalThis.qaFollowWheelCapture?.() ?? null)); }
              catch (_) { capture.captureErrors.push('geometry'); }
              const output = process.env.FOLLOW_CONTROL_EVIDENCE_DIR;
              if (output) {
                const basename = `${engine}-${width}-${theme}-wheel-failure`;
                const save = () => fs.writeFileSync(path.join(output, basename + '.json'), JSON.stringify(capture, null, 2) + '\n');
                try { save(); } catch (_) { capture.captureErrors.push('initial-write'); }
                if (performance.now() < captureDeadline) {
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
