'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const navigation = fs.readFileSync(path.join(__dirname, '../assets/js/follow-navigation.js'), 'utf8');
// I/41008854825 recorded panel tops 364.046875 -> 239 at scrollY165.
// Only geometry and input positions are replayed; the real mounted owner,
// scroll listener, dialog/focus guards and toggle handlers execute unchanged.
function fixture() {
  const dom = new JSDOM('<!doctype html><section id="listView"><input class="browse-search"><select><option>Sport</option></select><textarea></textarea><label class="follow-sport-control"><input type="checkbox"></label></section>', { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom, { document } = window;
  let y = 0, now = 0;
  const writes = [], container = document.getElementById('listView');
  Object.defineProperty(window, 'scrollY', { get: () => y });
  window.performance.now = () => now;
  window.scrollBy = (x, delta) => { writes.push({ x, delta }); y += delta; };
  window.followInspectorCode = () => null;
  window.cardImageLoadingUnlocked = false;
  window.eval(navigation);
  window.NOTHINGSPORTS_FOLLOW_NAV.mount(container, { id: 'sport:tennis', label: 'Tennis' }, { section: 'teams-players' });
  const panel = document.createElement('section'); panel.className = 'follow-section-panel'; container.append(panel);
  const nav = container.querySelector('.follow-navigation'), toggle = nav.querySelector('.follow-navigation-toggle');
  panel.getBoundingClientRect = () => ({ top: (nav.classList.contains('is-collapsed') ? 404 : 529.046875) - y });
  const advance = (position, time = now + 200) => { y = position; now = time; window.dispatchEvent(new window.Event('scroll')); };
  return { dom, document, container, nav, toggle, panel, writes, advance, y: () => y, open: () => toggle.click() };
}
const results = [];
function check(name, run) {
  const f = fixture();
  try { run(f); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
  finally { f.dom.window.close(); }
}
check('Recorded forward scroll must not receive a backwards anchor write', f => {
  f.open(); f.writes.length = 0;
  f.advance(20, 1209); f.advance(68, 1225); f.advance(165, 1250);
  assert(f.nav.classList.contains('is-collapsed'), 'The actual scroll listener must still collapse the menu');
  assert.equal(f.y(), 165, 'Auto-collapse must leave the native scroll position at 165 instead of writing it back by 125.046875');
  assert.deepEqual(f.writes, [], 'Auto-collapse must not issue even a zero scroll correction during native movement');
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(f.nav.querySelector('.follow-sport-control input').closest('[hidden]'), null);
});
check('Explicit close and reopen preserve the visible panel anchor', f => {
  f.open(); f.advance(300, 10); // Existing 150ms lock prevents auto-collapse here.
  const top = f.panel.getBoundingClientRect().top;
  f.writes.length = 0; f.toggle.click();
  assert.deepEqual(f.writes, [{ x: 0, delta: -125.046875 }]);
  assert.equal(f.panel.getBoundingClientRect().top, top);
  f.toggle.click();
  assert.deepEqual(f.writes[1], { x: 0, delta: 125.046875 });
  assert.equal(f.panel.getBoundingClientRect().top, top);
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'true');
});
check('Existing explicit collapse API keeps anchor preservation', f => {
  f.open(); f.writes.length = 0; const top = f.panel.getBoundingClientRect().top;
  f.nav.collapse(); assert.equal(f.panel.getBoundingClientRect().top, top);
  assert.deepEqual(f.writes, [{ x: 0, delta: -125.046875 }]);
});
for (const selector of ['.browse-search', 'select', 'textarea']) check('Focused ' + selector + ' retains the open menu', f => {
  f.open(); f.nav.querySelector(selector).focus(); f.writes.length = 0; f.advance(165, 1250);
  assert(!f.nav.classList.contains('is-collapsed')); assert.deepEqual(f.writes, []);
});
check('Focused selected-sport checkbox permits automatic collapse and stays visible', f => {
  f.open(); const input = f.nav.querySelector('.follow-sport-control input'); input.focus(); f.writes.length = 0; f.advance(165, 1250);
  assert(f.nav.classList.contains('is-collapsed')); assert.equal(input.closest('[hidden]'), null);
  assert.equal(f.document.activeElement, input); assert.deepEqual(f.writes, []);
});
check('Open dialog retains the menu without an anchor write', f => {
  f.open(); const dialog = f.document.createElement('dialog'); dialog.setAttribute('open', '');
  f.nav.querySelector('#follow-navigation-controls').append(dialog); f.writes.length = 0; f.advance(165, 1250);
  assert(!f.nav.classList.contains('is-collapsed')); assert.deepEqual(f.writes, []);
});
check('Existing direction, distance, position and time guards remain', f => {
  f.open(); f.writes.length = 0;
  f.advance(165, 10); assert(!f.nav.classList.contains('is-collapsed'), 'Manual anchor lock remains');
  f.advance(100, 1200); f.advance(106, 1220); f.advance(104, 1240);
  assert(!f.nav.classList.contains('is-collapsed'), 'No collapse below threshold, at six pixels, or upwards');
  assert.deepEqual(f.writes, []);
});
// The mounted module's private clock has no public readback. Execute its exact
// setter declaration at a lexical unit seam; never copy its timer logic or add
// a production export. This proves assignment conditions, not browser timing.
const setterStart = navigation.indexOf('  const set=');
const setterEnd = navigation.indexOf('\n  toggle.onclick=', setterStart);
assert(setterStart >= 0 && setterEnd > setterStart, 'Use the actual navigation setter declaration');
const setterSource = navigation.slice(setterStart, setterEnd);
for (const mode of ['automatic', 'missing-panel', 'open-dialog']) check('Setter clock preservation: ' + mode, f => {
  f.open(); f.writes.length = 0;
  if (mode === 'missing-panel') f.panel.remove();
  const controls = f.nav.querySelector('#follow-navigation-controls');
  if (mode === 'open-dialog') {
    const dialog = f.document.createElement('dialog'); dialog.setAttribute('open', ''); controls.append(dialog);
  }
  const context = {
    controls, container: f.container, nav: f.nav, toggle: f.toggle,
    spacer: f.container.querySelector('.follow-navigation-spacer'),
    collapsed: false, floating: false, lockedUntil: 71,
    performance: { now: () => 1250 }, scrollBy: (...args) => f.dom.window.scrollBy(...args),
  };
  vm.runInNewContext(setterSource + '\nset(true,false);', context);
  assert.equal(context.lockedUntil, mode === 'automatic' ? 1400 : 71,
    'Automatic collapse keeps the original now+150 assignment only when a panel exists and no dialog blocks it');
  assert.deepEqual(f.writes, [], 'Preserving the clock must not restore the competing scroll write');
});
console.log(JSON.stringify({ passed: results.every(r => r.passed), cases: results, limits: 'Actual mounted source and handlers with recorded synthetic geometry. No browser layout, trusted gesture, momentum, navigation tap or device acceptance is established.' }));
if (results.some(r => !r.passed)) process.exitCode = 1;
