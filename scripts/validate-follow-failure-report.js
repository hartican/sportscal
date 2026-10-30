'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'validate-follow-sport-control-browser.js'), 'utf8');
const start = source.indexOf('            } catch (originalError) {');
const end = source.indexOf("            } finally { release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }", start);
assert(start >= 0 && end > start, 'Use the actual per-case failure reporter');
const reporter = source.slice(start, end);
async function check(mode) {
  const original = new Error('Retained original RED'), logs = [], writes = [], qa = { original, cleaned: false };
  let now = 0, screenshots = 0;
  const context = {
    qa, engine: 'webkit', width: 320, theme: 'day', scope: 'sport:tennis', initialChecked: false, evidence: [], path,
    performance: { now: () => now },
    process: { env: mode === 'missing-output' ? {} : { FOLLOW_CONTROL_EVIDENCE_DIR: '/disposable-test' } },
    fs: { writeFileSync: (_file, value) => { if (mode === 'write-failure') throw new Error('Disposable write refused'); writes.push(JSON.parse(value)); } },
    console: { error: value => logs.push(JSON.parse(value)) },
    page: {
      evaluate: () => mode === 'deadline' ? new Promise(() => {}) : mode === 'state-failure' ? Promise.reject(new Error('State capture refused')) : Promise.resolve({ wheel: null }),
      screenshot: () => { screenshots++; return mode === 'screenshot-failure' ? Promise.reject(new Error('Screenshot refused')) : Promise.resolve(); },
    },
    setTimeout: mode === 'deadline' ? callback => { queueMicrotask(() => { now = 6000; callback(); }); return 1; } : setTimeout,
    clearTimeout: mode === 'deadline' ? () => {} : clearTimeout,
  };
  vm.createContext(context);
  const promise = vm.runInContext('(async()=>{try{throw qa.original;\n' + reporter + '}finally{qa.cleaned=true;}})()', context);
  await assert.rejects(promise, error => error === original, mode + ': observation must rethrow the exact original error');
  assert.equal(qa.cleaned, true, mode + ': original finally remains reachable');
  assert.equal(logs.length, 1);
  const capture = logs[0]; assert.equal(capture.acceptance, false); assert.equal(capture.captureBudgetMs, 5000);
  if (mode === 'state-failure') assert(capture.captureErrors.includes('state'));
  if (mode === 'screenshot-failure') assert(capture.captureErrors.includes('screenshot'));
  if (mode === 'write-failure') assert(capture.captureErrors.includes('initial-write') && capture.captureErrors.includes('final-write'));
  if (mode === 'missing-output') { assert(capture.captureErrors.includes('missing-output-directory')); assert.equal(screenshots, 0); }
  if (mode === 'deadline') { assert(capture.captureErrors.includes('state') && capture.captureErrors.includes('capture-deadline')); assert.equal(screenshots, 0); }
  if (mode === 'success') { assert.equal(capture.state.wheel, null); assert.equal(capture.screenshot, 'webkit-320-day-failure.png'); assert.equal(writes.length, 2); }
}
module.exports = (async () => {
  for (const mode of ['success', 'state-failure', 'screenshot-failure', 'write-failure', 'missing-output', 'deadline']) await check(mode);
  console.log(JSON.stringify({ passed: true, cases: 6, actualReporter: true, originalErrorAndFinallyPreserved: true, noBrowserOrNative: true }));
})().catch(error => { console.error(error); process.exitCode = 1; throw error; });
