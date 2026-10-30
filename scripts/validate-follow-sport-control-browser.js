'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const diagnoseFollowScrollSequence = process.argv.includes('--diagnose-follow-scroll-sequence');
const diagnoseRootScrollCSS = process.argv.includes('--diagnose-root-scroll-css');
assert(!(diagnoseFollowScrollSequence && (diagnoseRootScrollCSS || process.argv.includes('--diagnose-default-scroll'))), 'Choose one explicit diagnostic mode');
assert(!(diagnoseRootScrollCSS && process.argv.includes('--diagnose-default-scroll')), 'Choose one explicit diagnostic mode');
const diagnoseDefaultScroll = process.argv.includes('--diagnose-default-scroll') || diagnoseRootScrollCSS || diagnoseFollowScrollSequence;
const requestedEngines = (process.env.FOLLOW_CONTROL_ENGINES || 'chromium,webkit').split(',');
assert(requestedEngines.length && new Set(requestedEngines).size === requestedEngines.length && requestedEngines.every(engine => ['chromium', 'webkit'].includes(engine)), 'Choose each supported Follow browser at most once');
if (diagnoseDefaultScroll) assert.deepEqual(requestedEngines, ['webkit'], 'Default-scroll diagnostic requires only WebKit');
if (process.argv.includes('--preflight')) {
  assert(fs.readFileSync(path.join(root, 'assets/js/follow-navigation.js'), 'utf8').includes("const followControl=controls.querySelector('.follow-sport-control')"));
  assert(fs.readFileSync(path.join(root, 'assets/js/follow-presentation-ui.js'), 'utf8').includes('follow.checked=followed'));
  require('./validate-follow-sport-control');
  console.log(JSON.stringify({ preflight: true, diagnosticOnly: diagnoseDefaultScroll, releaseAcceptance: false, cases: diagnoseRootScrollCSS ? 4 : diagnoseDefaultScroll ? 1 : requestedEngines.length * 4, browsersStarted: 0, externalRequests: 0 }));
} else {
  const engines = require(modulePath);
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  function prepareFollowDocumentWheel(observeWheel = true) {
    const armSequence = observeWheel === 'follow-scroll-sequence';
    if (armSequence) observeWheel = false;
    const main = document.getElementById('mainContent'), list = document.getElementById('listView'), root = document.scrollingElement;
    if (!main?.isConnected || !list?.isConnected || !root || root === main) throw new Error('Document wheel needs mounted MAIN and a separate document scroll owner');
    const m = main.getBoundingClientRect(), l = list.getBoundingClientRect();
    const left = Math.max(0, m.left), right = Math.min(innerWidth, m.right, l.left);
    const point = { x: (left + right) / 2, y: innerHeight / 2 };
    if (!(right > left && point.x > 0 && point.x < innerWidth && point.y > Math.max(0, m.top) && point.y < Math.min(innerHeight, m.bottom))) throw new Error('Document wheel needs a visible MAIN gutter point');
    const style = getComputedStyle(main), rootStyle = getComputedStyle(root), bodyStyle = getComputedStyle(document.body);
    if (document.elementFromPoint(point.x, point.y) !== main || main.closest('[inert]') || style.display === 'none' || style.visibility !== 'visible' || style.pointerEvents === 'none' || ['fixed', 'sticky'].includes(style.position)) throw new Error('Document wheel point must hit the visible non-overlay MAIN itself');
    if (root.scrollHeight - root.clientHeight <= 100 || [rootStyle, bodyStyle].some(style => ['hidden', 'clip'].includes(style.overflowY)) || (['auto', 'scroll'].includes(style.overflowY) && main.scrollHeight > main.clientHeight + 1)) throw new Error('Document wheel needs an unlocked scrollable document, not a nested MAIN scroller');
    if (armSequence) {
      globalThis.NOTHINGSPORTS_FOLLOW_SCROLL_SEQUENCE = { flag: 'follow-scroll-sequence-v1', armed: true, records: [], sequence: 0, overflow: 0, observerFailures: 0 };
      globalThis.NOTHINGSPORTS_FOLLOW_SCROLL_SEQUENCE_FAULT = false;
    }
    if (observeWheel) {
      globalThis.qaFollowDocumentWheel = null;
      document.addEventListener('wheel', event => {
        globalThis.qaFollowDocumentWheel = { trusted: event.isTrusted, targetMain: event.target === main, mainConnected: main.isConnected,
          clientX: event.clientX, clientY: event.clientY, deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, defaultPrevented: event.defaultPrevented };
      }, { passive: false });
    }
    return { ...point, rootMaxScroll: root.scrollHeight - root.clientHeight, target: 'MAIN#mainContent' };
  }
  function newDefaultScrollDiagnostic(engine, width, theme) {
    return { diagnosticOnly: true, releaseAcceptance: false, controlPassed: false, engine, width, theme,
      testWheelObserver: 'absent-by-selected-source-path', eventReceipt: null, eventProperties: 'unobserved',
      gestureCommand: { deltaX: 0, deltaY: 350, awaited: false }, originMatched: false,
      phase: 'setup', phases: { setup: 'running', pointMatch: 'notReached', wheelCommand: 'notReached',
        scroll: 'notReached', navigation: 'notReached', postScrollChecks: 'notReached', readOnly: 'notReached' },
      finalState: null, captureErrors: [], cleanupOwnerReceipt: 'supervisor.json',
      limits: 'Command completion is not event delivery/trust/target/prevention proof. This one-case diagnostic cannot qualify the four observed cases.' };
  }
  function defaultScrollIdentity() {
    const output = process.env.FOLLOW_CONTROL_EVIDENCE_DIR;
    assert(output, 'Default-scroll diagnostic requires its existing owned evidence directory');
    const owner = JSON.parse(fs.readFileSync(path.join(output, 'supervisor.json'), 'utf8'));
    const harnessSha256 = require('node:crypto').createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
    assert.equal(owner.harnessSha256, harnessSha256, 'Bind the diagnostic to this exact supervised leaf');
    assert.equal(owner.engine, 'webkit');
    assert.equal(owner.releaseAcceptance, false);
    assert.equal(owner.attempts, 1); assert.equal(owner.retries, 0);
    assert.equal(owner.nativeLimitSeconds, 90); assert.equal(owner.wholeLimitSeconds, 110);
    assert.match(owner.head, /^[a-f0-9]{40}$/); assert.match(owner.tree, /^[a-f0-9]{40}$/);
    assert.equal(process.version, 'v24.21.0');
    const playwrightVersion = JSON.parse(fs.readFileSync(require.resolve(path.join(modulePath, 'package.json')), 'utf8')).version;
    assert.equal(playwrightVersion, '1.64.1');
    for (const key of ['nodeSha256', 'playwrightPackageSha256', 'browserRegistrySha256', 'browserLauncherSha256']) assert.match(owner.runtime?.[key] || '', /^[a-f0-9]{64}$/);
    return { testedHead: owner.head, testedTree: owner.tree, harnessSha256,
      runtime: { ...owner.runtime, nodeVersion: process.version, playwrightVersion },
      sourceBinding: 'Existing supervisor pins runtime and checks source/cleanup after this leaf exits' };
  }
  function defaultScrollPhase(diagnostic, phase) {
    diagnostic.phases[diagnostic.phase] = 'passed';
    diagnostic.phase = phase; diagnostic.phases[phase] = 'running';
  }
  function defaultScrollFailure(diagnostic) {
    diagnostic.phases[diagnostic.phase] = 'failed';
    diagnostic.controlPassed = false;
  }
  function defaultScrollVerdict(diagnostic) {
    return { scroll: diagnostic.phases.scroll, navigation: diagnostic.phases.navigation,
      gestureCommandAwaited: diagnostic.gestureCommand.awaited, originMatched: diagnostic.originMatched,
      limits: 'An unexecuted assertion is not a failed wheel or navigation assertion.' };
  }
  const ROOT_SCROLL_CSS_CELLS = Object.freeze([
    Object.freeze({ id: 'baseline', html: null, body: null }),
    Object.freeze({ id: 'both-auto', html: 'auto', body: 'auto' }),
    Object.freeze({ id: 'html-auto', html: 'auto', body: null }),
    Object.freeze({ id: 'body-auto', html: null, body: 'auto' }),
  ]);
  function rootScrollCSSIntervention(variant) {
    const html = document.documentElement, body = document.body;
    const describe = element => ({ computed: getComputedStyle(element).getPropertyValue('overscroll-behavior-y'),
      inline: element.style.getPropertyValue('overscroll-behavior-y'), priority: element.style.getPropertyPriority('overscroll-behavior-y') });
    const before = { html: describe(html), body: describe(body) }, writes = [];
    const baselineMatches = before.html.computed === 'none' && before.body.computed === 'none';
    if (baselineMatches) for (const [name, element] of [['html', html], ['body', body]]) {
      if (variant[name] === 'auto') { element.style.setProperty('overscroll-behavior-y', 'auto'); writes.push(name); }
    }
    return { variant: variant.id, baselineMatches, before, after: { html: describe(html), body: describe(body) }, writes };
  }
  function newRootScrollMatrix() {
    return { diagnosticOnly: true, releaseAcceptance: false, firstError: null, stopReason: null,
      internalStopUptimeMs: 85000, admissionReserveMs: 40000,
      cells: ROOT_SCROLL_CSS_CELLS.map(variant => ({ variant, status: 'NOT_RUN', reason: 'not-started', diagnostic: null, cleanup: null })) };
  }
  function rootScrollMatrixRemaining(matrix) { return matrix.internalStopUptimeMs - process.uptime() * 1000; }
  function rootScrollMatrixSnapshot(matrix) {
    const cells = matrix.cells.map(({ errorObject, ...cell }) => cell);
    const baseline = cells[0], reproducedBaseline = baseline?.diagnostic?.verdict?.scroll === 'failed' && baseline.diagnostic.finalState?.scrollY === 0 && baseline.diagnostic.finalState?.navigationExpanded === 'true';
    const localComparability = !matrix.stopReason && reproducedBaseline && cells.length === 4 && cells.every(cell => {
      const d = cell.diagnostic;
      return ['PASS', 'FAIL'].includes(cell.status) && cell.cleanup?.natural === true && !cell.cleanupError &&
        (cell.status === 'PASS' || ['scroll', 'navigation'].includes(d?.phase)) &&
        d?.cssIntervention?.baselineMatches && d.originMatched && d.gestureCommand.awaited &&
        ['passed', 'failed'].includes(d.verdict?.scroll) &&
        (['passed', 'failed'].includes(d.verdict?.navigation) || (d.verdict.scroll === 'failed' && d.verdict.navigation === 'notReached')) &&
        d.choicesUnchanged === true && d.notificationsOff === true && d.siblingAbsent === true && !d.captureErrors.length && !cell.captureErrors?.length;
    });
    return { diagnosticOnly: true, releaseAcceptance: false, mode: 'no-test-wheel-observer-root-body-overscroll-factorial',
      expectedCells: 4, cells, stopReason: matrix.stopReason, overall: matrix.firstError ? 'FAILED' : cells.every(cell => cell.status === 'PASS') ? 'PASSED' : 'INCOMPLETE',
      internalStopUptimeMs: matrix.internalStopUptimeMs, admissionReserveMs: matrix.admissionReserveMs,
      baselineReproduced: reproducedBaseline, localComparability, attributionEligible: false,
      ownerProofRequired: 'Unforced owned process cleanup, unchanged app/source/runtime, complete matching baseline and all four cells; ROOT interprets only then',
      eventReceipt: null, eventProperties: 'unobserved', cleanupOwnerReceipt: 'supervisor.json' };
  }
  function saveRootScrollMatrix(matrix) {
    try {
      const output = process.env.FOLLOW_CONTROL_EVIDENCE_DIR;
      assert(output, 'Root-scroll matrix requires the existing owned evidence directory');
      fs.writeFileSync(path.join(output, 'root-scroll-css-matrix.json'), JSON.stringify(rootScrollMatrixSnapshot(matrix), null, 2) + '\n');
    } catch (error) { matrix.firstError ||= error; matrix.stopReason ||= 'artifact-write'; }
  }
  function rootScrollMatrixBudgetError(matrix) {
    const error = new Error('Insufficient unchanged native budget for both 15s waits, 5s capture and 5s context cleanup');
    error.name = 'MatrixBudgetStop'; matrix.firstError ||= error; matrix.stopReason ||= 'time-budget'; return error;
  }
  function admitRootScrollCell(matrix, variant) {
    const cell = matrix.cells.find(cell => cell.variant.id === variant.id);
    if (matrix.stopReason || rootScrollMatrixRemaining(matrix) < matrix.admissionReserveMs) {
      if (!matrix.stopReason) rootScrollMatrixBudgetError(matrix);
      cell.reason = matrix.stopReason; saveRootScrollMatrix(matrix); return false;
    }
    cell.status = 'RUNNING'; cell.reason = null; cell.remainingAtStartMs = rootScrollMatrixRemaining(matrix);
    saveRootScrollMatrix(matrix);
    if (matrix.stopReason) { cell.status = 'NOT_RUN'; cell.reason = matrix.stopReason; return false; }
    return true;
  }
  function ensureRootScrollCellBudget(matrix) {
    if (rootScrollMatrixRemaining(matrix) < matrix.admissionReserveMs) throw rootScrollMatrixBudgetError(matrix);
  }
  function recordRootScrollCellError(matrix, variant, error, original) {
    const cell = matrix.cells.find(cell => cell.variant.id === variant.id);
    matrix.firstError ||= error;
    const summary = { name: error.name, message: String(error.message).slice(0, 16000), stack: String(error.stack).slice(0, 24000) };
    const cleanupFailure = !original && ((cell.errorObject && error !== cell.errorObject) || (!cell.errorObject && cell.diagnostic?.phase === 'complete'));
    if (cleanupFailure) { cell.cleanupError = summary; matrix.stopReason ||= 'context-cleanup'; }
    if (original || !cell.errorObject) { cell.errorObject = error; cell.error = summary; }
    if (error.name === 'MatrixBudgetStop') { cell.status = 'NOT_RUN'; cell.reason = 'time-budget-before-gesture'; }
  }
  function finishRootScrollCell(matrix, variant, context, page) {
    const cell = matrix.cells.find(cell => cell.variant.id === variant.id);
    let pageClosed = false, pagesEmpty = false;
    try { pageClosed = Boolean(page?.isClosed()); pagesEmpty = Boolean(context && context.pages().length === 0); }
    catch (error) { cell.cleanupError = { name: error.name, message: String(error.message).slice(0, 16000) }; matrix.firstError ||= error; }
    cell.cleanup = { pageClosed, pagesEmpty, natural: pageClosed && pagesEmpty && !cell.cleanupError };
    if (!cell.cleanup.natural) { matrix.stopReason ||= 'context-cleanup'; matrix.firstError ||= new Error('Matrix context cleanup was not naturally verified'); }
    if (cell.status !== 'NOT_RUN') cell.status = cell.errorObject ? 'FAIL' : 'PASS';
    cell.remainingAfterCloseMs = rootScrollMatrixRemaining(matrix);
    if (cell.remainingAfterCloseMs < 0) { matrix.stopReason ||= 'time-budget'; matrix.firstError ||= new Error('Matrix exceeded its conservative native budget'); }
    saveRootScrollMatrix(matrix);
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
    const evidence = [], defaultScrollEvidence = [];
    const rootScrollMatrix = diagnoseRootScrollCSS ? newRootScrollMatrix() : null;
    try {
      if (rootScrollMatrix) saveRootScrollMatrix(rootScrollMatrix);
      for (const engine of requestedEngines) {
        const browser = await engines[engine].launch({ headless: true });
        try {
          for (const width of (diagnoseDefaultScroll ? [320] : [320, 390])) for (const theme of (diagnoseDefaultScroll ? ['day'] : ['day', 'night'])) {
            for (const cssVariant of (rootScrollMatrix ? ROOT_SCROLL_CSS_CELLS : [null])) {
            if (rootScrollMatrix && !admitRootScrollCell(rootScrollMatrix, cssVariant)) continue;
            let matrixContext = null, matrixPage = null;
            try {
            const scope = theme === 'night' ? 'sport:tennis-women' : 'sport:tennis';
            const directory = scope.slice(6), initialChecked = width === 390;
            const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, hasTouch: true, serviceWorkers: 'block' });
            if (rootScrollMatrix) matrixContext = context;
            const page = await context.newPage(), errors = [];
            if (rootScrollMatrix) matrixPage = page;
            page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
            let release; const directoryGate = new Promise(resolve => { release = resolve; });
            let directoryReads = 0;
            const diagnostic = diagnoseDefaultScroll ? newDefaultScrollDiagnostic(engine, width, theme) : null;
            if (rootScrollMatrix) { diagnostic.cssVariant = cssVariant; diagnostic.phases.cssIntervention = 'notReached'; rootScrollMatrix.cells.find(cell => cell.variant.id === cssVariant.id).diagnostic = diagnostic; }
            if (diagnoseFollowScrollSequence) diagnostic.sequenceProbe = true;
            let diagnosticBeforeBrowse;
            try {
              if (diagnostic) Object.assign(diagnostic, defaultScrollIdentity());
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
              if (diagnostic) diagnosticBeforeBrowse = beforeBrowse;
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
              if (diagnostic?.cssVariant) {
                ensureRootScrollCellBudget(rootScrollMatrix);
                defaultScrollPhase(diagnostic, 'cssIntervention');
                diagnostic.cssIntervention = await page.evaluate(rootScrollCSSIntervention, cssVariant);
                assert.equal(diagnostic.cssIntervention.baselineMatches, true, 'Every fresh cell must start at computed html/body none/none');
                assert.deepEqual({ html: diagnostic.cssIntervention.after.html.computed, body: diagnostic.cssIntervention.after.body.computed }, { html: cssVariant.html || 'none', body: cssVariant.body || 'none' }, 'Only the named root/body overscroll change is allowed');
              }
              if (diagnoseFollowScrollSequence) {
                diagnostic.cssIntervention = await page.evaluate(rootScrollCSSIntervention, ROOT_SCROLL_CSS_CELLS.find(cell => cell.id === 'html-auto'));
                assert.equal(diagnostic.cssIntervention.baselineMatches, true, 'Sequence cell must start at computed none/none');
                assert.deepEqual({ html: diagnostic.cssIntervention.after.html.computed, body: diagnostic.cssIntervention.after.body.computed }, { html: 'auto', body: 'none' }, 'Sequence cell matches G html-auto/body-none');
              }
              const wheelOrigin = diagnoseDefaultScroll
                ? await page.evaluate(prepareFollowDocumentWheel, diagnoseFollowScrollSequence ? 'follow-scroll-sequence' : false)
                : await page.evaluate(prepareFollowDocumentWheel);
              if (diagnostic) {
                defaultScrollPhase(diagnostic, 'pointMatch'); diagnostic.wheelOrigin = wheelOrigin;
                assert.deepEqual(wheelOrigin, { x: 6, y: 284, rootMaxScroll: 4386, target: 'MAIN#mainContent' }, 'Default-scroll control must match D/E origin and range');
                diagnostic.originMatched = true; defaultScrollPhase(diagnostic, 'wheelCommand');
              }
              if (diagnostic?.cssVariant) ensureRootScrollCellBudget(rootScrollMatrix);
              await page.mouse.move(wheelOrigin.x, wheelOrigin.y);
              await page.mouse.wheel(0, 350);
              if (diagnostic) { diagnostic.gestureCommand.awaited = true; defaultScrollPhase(diagnostic, 'scroll'); }
              await page.waitForFunction(() => scrollY > 100);
              if (diagnostic) defaultScrollPhase(diagnostic, 'navigation');
              await page.waitForFunction(() => document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') === 'false');
              if (diagnostic) {
                defaultScrollPhase(diagnostic, 'postScrollChecks');
                diagnostic.finalState = await page.evaluate(sequenceProbe => ({ scrollY, rootMaxScroll: Math.max(0, document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight), navigationExpanded: document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') ?? null, ...(sequenceProbe ? { followScrollSequence: (() => { try { const read = globalThis.NOTHINGSPORTS_FOLLOW_SCROLL_SEQUENCE_SNAPSHOT; return typeof read === 'function' ? read() : { available: false, observerFailures: 1, complete: false, records: [] }; } catch (_) { return { available: false, observerFailures: 1, complete: false, records: [] }; } })() } : {}) }), Boolean(diagnostic.sequenceProbe));
              }
              let wheelGesture;
              if (!diagnoseDefaultScroll) {
              wheelGesture = await page.evaluate(() => globalThis.qaFollowDocumentWheel);
              assert.deepEqual(wheelGesture, { trusted: true, targetMain: true, mainConnected: true,
                clientX: wheelOrigin.x, clientY: wheelOrigin.y, deltaX: 0, deltaY: 350, deltaMode: 0, defaultPrevented: false },
              'The unchanged wheel must be a trusted gesture over the guarded MAIN document point');
              }
              await assertAvailable(page);
              await page.evaluate(() => renderAll({ preserveViewport: true }));
              control = await assertAvailable(page);
              assert.equal(await choiceSnapshot(page), beforeBrowse, 'Browsing, late loads and redraw preserve choices and notification OFF');
              if (diagnostic) {
                defaultScrollPhase(diagnostic, 'readOnly');
                diagnostic.choicesUnchanged = true;
                diagnostic.notificationsOff = await page.evaluate(() => userPreferences.followFirst.notifications.enabled === false);
                assert.equal(diagnostic.notificationsOff, true);
                diagnostic.siblingAbsent = await page.evaluate(({ scope }) => !userPreferences.selectedSelectorEntityIds.includes(scope === 'sport:tennis' ? 'sport:tennis-women' : 'sport:tennis'), { scope });
                assert.equal(diagnostic.siblingAbsent, true, 'No sibling gender follow is created');
                assert.deepEqual(errors, []);
                diagnostic.phases.readOnly = 'passed'; diagnostic.phase = 'complete'; diagnostic.controlPassed = true;
                diagnostic.verdict = defaultScrollVerdict(diagnostic);
                defaultScrollEvidence.push(diagnostic); console.log(JSON.stringify(diagnostic));
                continue;
              }
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
              if (diagnostic) { defaultScrollFailure(diagnostic); diagnostic.verdict = defaultScrollVerdict(diagnostic); }
              if (diagnostic?.cssVariant) recordRootScrollCellError(rootScrollMatrix, cssVariant, originalError, true);
              const captureStarted = performance.now(), deadline = captureStarted + 5000;
              const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()));
              const bounded = async work => { let timer; try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Failure capture deadline')), remaining()); })]); } finally { clearTimeout(timer); } };
              const capture = { phase: 'follow-control-failure', engine, width, theme, scope, initialChecked,
                acceptance: false,
                ...(diagnostic ? { diagnosticDefaultScroll: diagnostic } : {}),
                completedCases: evidence, captureBudgetMs: 5000,
                error: { name: originalError.name, message: String(originalError.message).slice(0, 16000), stack: String(originalError.stack).slice(0, 24000) },
                state: null, screenshot: null, captureErrors: [] };
              try {
                capture.state = await bounded(page.evaluate(sequenceProbe => {
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
                    ...(sequenceProbe ? { followScrollSequence: (() => { try { const read = globalThis.NOTHINGSPORTS_FOLLOW_SCROLL_SEQUENCE_SNAPSHOT; return typeof read === 'function' ? read() : { available: false, observerFailures: 1, complete: false, records: [] }; } catch (_) { return { available: false, observerFailures: 1, complete: false, records: [] }; } })() } : {}),
                    scrollY, scrollX, innerWidth, innerHeight, scrollingElement: describe(document.scrollingElement),
                    visualViewport: viewport ? Object.fromEntries(['width', 'height', 'offsetTop', 'offsetLeft', 'pageTop', 'pageLeft', 'scale'].map(key => [key, viewport[key]])) : null,
                    navigationExpanded: document.querySelector('.follow-navigation-toggle')?.getAttribute('aria-expanded') ?? null,
                    modalFlags: { modal: document.body.classList.contains('modal-open'), settings: document.body.classList.contains('settings-open'), score: document.body.classList.contains('nsc-open') },
                    nodes: selectors.map(selector => ({ selector, element: describe(document.querySelector(selector)) })),
                    postFailureHitStackAtRecordedWheel: wheel && Number.isFinite(wheel.clientX) && Number.isFinite(wheel.clientY) ? document.elementsFromPoint(wheel.clientX, wheel.clientY).slice(0, 8).map(describe) : null,
                    limits: 'Current failure state; a null receipt does not prove no event, and current hit stack is not historical target proof. No new pre-input observation.' };
                }, Boolean(diagnostic?.sequenceProbe)));
              } catch (_) { capture.captureErrors.push('state'); }
              if (diagnostic) {
                if (capture.state) diagnostic.finalState = { scrollY: capture.state.scrollY, rootMaxScroll: capture.state.scrollingElement?.maxScrollTop ?? null, navigationExpanded: capture.state.navigationExpanded };
                if (diagnosticBeforeBrowse !== undefined && performance.now() < deadline) {
                  try { diagnostic.choicesUnchanged = (await bounded(choiceSnapshot(page))) === diagnosticBeforeBrowse; }
                  catch (_) { diagnostic.captureErrors.push('choices-equality'); }
                }
                if (performance.now() < deadline) {
                  try { Object.assign(diagnostic, await bounded(page.evaluate(({ scope }) => ({ notificationsOff: userPreferences.followFirst.notifications.enabled === false, siblingAbsent: !userPreferences.selectedSelectorEntityIds.includes(scope === 'sport:tennis' ? 'sport:tennis-women' : 'sport:tennis') }), { scope }))); }
                  catch (_) { diagnostic.captureErrors.push('off-sibling'); }
                }
              }
              const output = process.env.FOLLOW_CONTROL_EVIDENCE_DIR;
              if (output) {
                const basename = `${diagnostic?.sequenceProbe ? 'follow-scroll-sequence-' : diagnostic?.cssVariant ? 'root-scroll-css-' + diagnostic.cssVariant.id + '-' : diagnoseDefaultScroll ? 'default-scroll-control-' : ''}${engine}-${width}-${theme}-failure`;
                const save = () => fs.writeFileSync(path.join(output, basename + '.json'), JSON.stringify(capture, null, 2) + '\n');
                try { save(); } catch (_) { capture.captureErrors.push('initial-write'); }
                if (performance.now() < deadline) {
                  try { await bounded(page.screenshot({ path: path.join(output, basename + '.png'), timeout: remaining() })); capture.screenshot = basename + '.png'; }
                  catch (_) { capture.captureErrors.push('screenshot'); }
                } else { capture.captureErrors.push('capture-deadline'); }
                capture.elapsedMs = performance.now() - captureStarted;
                try { save(); } catch (_) { capture.captureErrors.push('final-write'); }
              } else { capture.captureErrors.push('missing-output-directory'); }
              if (diagnostic?.cssVariant) rootScrollMatrix.cells.find(cell => cell.variant.id === cssVariant.id).captureErrors = [...capture.captureErrors, ...diagnostic.captureErrors];
              console.error(JSON.stringify(capture));
              throw originalError;
            } finally { release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
            } catch (cellError) {
              if (!rootScrollMatrix) throw cellError;
              recordRootScrollCellError(rootScrollMatrix, cssVariant, cellError, false);
            } finally { if (rootScrollMatrix) finishRootScrollCell(rootScrollMatrix, cssVariant, matrixContext, matrixPage); }
            }
          }
        } finally {
          if (!rootScrollMatrix) await browser.close();
          else try { await browser.close(); } catch (error) { rootScrollMatrix.firstError ||= error; rootScrollMatrix.stopReason ||= 'browser-cleanup'; saveRootScrollMatrix(rootScrollMatrix); }
        }
      }
      if (rootScrollMatrix) saveRootScrollMatrix(rootScrollMatrix);
      else if (diagnoseDefaultScroll) assert.equal(defaultScrollEvidence.length, 1, 'Exactly one nonacceptance default-scroll control');
      else assert.equal(evidence.length, requestedEngines.length * 4, 'Every requested browser must finish all four original Follow cases');
    } finally {
      if (!rootScrollMatrix) await new Promise(resolve => server.close(resolve));
      else try { await new Promise(resolve => server.close(resolve)); } catch (error) { rootScrollMatrix.firstError ||= error; rootScrollMatrix.stopReason ||= 'server-cleanup'; }
    }
    if (rootScrollMatrix) {
      saveRootScrollMatrix(rootScrollMatrix);
      if (rootScrollMatrix.firstError) throw rootScrollMatrix.firstError;
      return;
    }
    if (diagnoseDefaultScroll) fs.writeFileSync(path.join(process.env.FOLLOW_CONTROL_EVIDENCE_DIR, diagnoseFollowScrollSequence ? 'follow-scroll-sequence.json' : 'default-scroll-control.json'), JSON.stringify({ diagnosticOnly: true, releaseAcceptance: false, cases: defaultScrollEvidence, cleanupOwnerReceipt: 'supervisor.json' }, null, 2) + '\n');
    else if (process.env.FOLLOW_CONTROL_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.FOLLOW_CONTROL_EVIDENCE_DIR, 'browser-receipts.json'), JSON.stringify({ cases: evidence, limits: 'Actual local app with disposable preferences and controlled network; service workers blocked. No hosted account, real delivery or physical-device claim.' }, null, 2) + '\n');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
