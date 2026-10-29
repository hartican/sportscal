'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const variants = ['baseline', 'padding', 'clip', 'overscroll', 'combined'];
function outcome(row) {
  if (row.status !== 'COMPLETE' || row.eventsDropped !== 0 || !row.before?.originMain || row.before.rootMax <= 100) return 'INCOMPLETE';
  const wheel = row.after?.wheel;
  if (wheel?.phase !== 'once-passive-bubble' || !wheel.trusted || !wheel.targetMain || wheel.x !== 6 || wheel.y !== 284 || wheel.deltaX !== 0 || wheel.deltaY !== 350 || wheel.deltaMode !== 0 || wheel.defaultPrevented) return 'WHEEL_UNOBSERVED_OR_INVALID';
  return row.after.scrollY > 100 ? 'DOCUMENT_SCROLLED' : 'WHEEL_OBSERVED_BELOW_THRESHOLD';
}
function propertyAttributionEligible(rows) {
  return [true, false].every(hasTouch => rows.some(row => row.hasTouch === hasTouch && row.variant === 'baseline' && outcome(row) === 'DOCUMENT_SCROLLED'));
}
async function run() {
  assert.equal(process.platform, 'linux'); assert.equal(process.versions.node, '24.21.0');
  const modulePath = process.env.PLAYWRIGHT_MODULE, output = process.env.CALIBRATION_EVIDENCE_DIR;
  assert(modulePath && path.isAbsolute(modulePath)); assert(output && path.isAbsolute(output));
  assert(fs.existsSync(output) && fs.statSync(output).isDirectory());
  assert.equal(JSON.parse(fs.readFileSync(path.join(modulePath, 'package.json'), 'utf8')).version, '1.64.1');
  const filename = path.join(output, 'bare-root-calibration.json'); assert(!fs.existsSync(filename));
  const started = performance.now(), hardDeadline = started + 25000;
  const report = { schema: 'bare-root-calibration.v2', diagnosticOnly: true, acceptance: false,
    viewport: { width: 320, height: 568 }, point: { x: 6, y: 284 }, wheel: { x: 0, y: 350 },
    perCellLimitMs: 1500, observationLimitMs: 900, wholeLimitMs: 25000, complete: false,
    rows: [true, false].flatMap(hasTouch => variants.map(variant => ({ hasTouch, variant, status: 'NOT_RUN', outcome: 'INCOMPLETE' }))) };
  const save = () => fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
  const watchdog = setTimeout(() => {
    report.termination = 'COMPONENT_25S_CAP_REQUIRES_ROOT_OWNED_GROUP_CLEANUP';
    report.propertyAttributionEligible = false; report.elapsedMs = performance.now() - started; save(); process.exit(1);
  }, 25000);
  let browser;
  try {
    save(); browser = await require(modulePath).webkit.launch({ headless: true, timeout: 5000 });
    for (const row of report.rows) {
      if (performance.now() > hardDeadline - 1800) { report.incomplete = 'Insufficient component budget'; break; }
      const cellStarted = performance.now(), deadline = cellStarted + 1500;
      row.status = 'RUNNING'; save(); let context, cancelled = false, timer;
      const check = () => { if (cancelled || performance.now() >= deadline) throw new Error('Cell deadline'); };
      const step = async work => { check(); const result = await work(); check(); return result; };
      const work = (async () => {
        context = await step(() => browser.newContext({ viewport: report.viewport, hasTouch: row.hasTouch, serviceWorkers: 'block' }));
        const page = await step(() => context.newPage()); page.setDefaultTimeout(900);
        await step(() => page.route('**/*', route => route.abort('blockedbyclient')));
        const css = ['html{touch-action:manipulation}body{margin:0}main{height:5000px}'];
        if (['padding', 'combined'].includes(row.variant)) css.push('html{scroll-padding-top:499px;scroll-padding-bottom:86px}');
        if (['clip', 'combined'].includes(row.variant)) css.push('html,body{overflow-x:clip;overflow-y:visible}');
        if (['overscroll', 'combined'].includes(row.variant)) css.push('html,body{overscroll-behavior-y:none}');
        await step(() => page.setContent('<!doctype html><style>' + css.join('') + '</style><main id="mainContent"></main>', { waitUntil: 'domcontentloaded', timeout: 900 }));
        row.before = await step(() => page.evaluate(() => {
          const main = document.getElementById('mainContent'), root = document.scrollingElement;
          const focus = () => ({ hasFocus: document.hasFocus(), visibilityState: document.visibilityState,
            activeElement: document.activeElement ? { tag: document.activeElement.tagName, alias: document.activeElement === main ? '#mainContent' : document.activeElement === document.body ? 'body' : document.activeElement === document.documentElement ? 'html' : null } : null });
          const state = () => ({ scrollY, rootMax: root.scrollHeight - root.clientHeight, focus: focus(),
            css: ['html', 'body'].map(selector => { const style = getComputedStyle(document.querySelector(selector)); return { selector, values: Object.fromEntries(['overflow-x', 'overflow-y', 'overscroll-behavior-y', 'scroll-padding-top', 'scroll-padding-bottom', 'touch-action'].map(key => [key, style.getPropertyValue(key)])) }; }) });
          const data = { events: [], eventsDropped: 0, wheel: null };
          const wheel = event => ({ phase: 'once-passive-bubble', trusted: event.isTrusted, targetMain: event.target === main, x: event.clientX, y: event.clientY,
            deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, defaultPrevented: event.defaultPrevented, focus: focus() });
          const append = item => { if (data.events.length < 16) data.events.push(item); else data.eventsDropped++; };
          document.addEventListener('wheel', event => { data.wheel = wheel(event); append({ kind: 'wheel:once-passive-bubble', atMs: performance.now(), ...data.wheel }); }, { passive: true, once: true });
          addEventListener('scroll', () => append({ kind: 'scroll', atMs: performance.now(), scrollY }), { capture: true, passive: true });
          globalThis.qaBareRootCapture = () => ({ ...state(), ...data });
          return { ...state(), originMain: document.elementFromPoint(6, 284) === main };
        }));
        assert(row.before.originMain && row.before.scrollY === 0 && row.before.rootMax > 100, 'Fresh bare MAIN/root origin precondition');
        await step(() => page.mouse.move(6, 284)); await step(() => page.mouse.wheel(0, 350));
        try { await step(() => page.waitForFunction(() => scrollY > 100, null, { timeout: 900 })); row.observation = 'THRESHOLD_SEEN'; }
        catch (error) { check(); if (error.name !== 'TimeoutError') throw error; row.observation = '900MS_WINDOW_ENDED'; }
        row.after = await step(() => page.evaluate(() => qaBareRootCapture())); row.eventsDropped = row.after.eventsDropped;
        await step(() => context.close()); context = null; row.status = 'COMPLETE';
      })();
      try {
        await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => { cancelled = true; reject(new Error('Cell deadline')); }, Math.max(1, deadline - performance.now())); })]);
      } catch (error) { cancelled = true; row.status = 'INCOMPLETE'; row.error = error.name; report.incomplete = 'Cell setup/action/capture/cleanup did not complete within its budget'; }
      finally { clearTimeout(timer); row.elapsedMs = performance.now() - cellStarted; if (row.elapsedMs > 1500) { row.status = 'INCOMPLETE'; report.incomplete = 'Cell budget overrun'; } row.outcome = outcome(row); save(); }
      if (row.status !== 'COMPLETE') break; // No overlapping unfinished cell or hidden retry.
    }
    report.complete = report.rows.every(row => row.status === 'COMPLETE' && row.outcome !== 'INCOMPLETE');
    report.baselinesPositive = propertyAttributionEligible(report.rows);
    report.propertyAttributionEligible = report.complete && report.baselinesPositive;
  } catch (error) { report.error = error.name; report.propertyAttributionEligible = false; }
  finally {
    if (browser) {
      let timer;
      try { await Promise.race([browser.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Component close deadline')), Math.max(1, Math.min(1500, hardDeadline - performance.now() - 25))); })]); report.browserClosed = true; }
      catch (_) { report.browserClosed = false; report.complete = false; report.propertyAttributionEligible = false; }
      finally { clearTimeout(timer); }
    }
    report.elapsedMs = performance.now() - started; report.withinWholeLimit = report.elapsedMs <= 25000;
    report.interpretation = report.propertyAttributionEligible ? 'Both bare baselines positive; component results still do not prove app cause or acceptance.' : 'NO_PROPERTY_ATTRIBUTION: positive bare baselines missing or incomplete.';
    save(); clearTimeout(watchdog); console.log(JSON.stringify(report));
  }
  return report.complete && report.browserClosed && report.withinWholeLimit ? 0 : 1;
}
module.exports = { variants, outcome, propertyAttributionEligible };
if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== '--run') console.log('INERT: ROOT allocation and --run required; component is not acceptance');
  else run().then(code => { process.exitCode = code; }).catch(error => { console.error(error.name); process.exitCode = 1; });
}
