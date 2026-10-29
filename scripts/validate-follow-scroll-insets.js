'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const navigation = fs.readFileSync(path.join(root, 'assets/js/follow-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/follow-feed-rework.css'), 'utf8');
const dom = new JSDOM('<!doctype html><main><section id="listView" class="follow-view"></section></main>', { runScripts: 'outside-only', url: 'http://localhost' });
const { window } = dom, { document } = window;
const container = document.getElementById('listView'), observers = [];
let navigationHeight = 193;
window.HTMLElement.prototype.getBoundingClientRect = function () { return { top: 0, height: this.classList.contains('follow-navigation') ? navigationHeight : 44 }; };
window.ResizeObserver = class {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe(target) { this.target = target; }
  disconnect() { this.disconnected = true; }
  deliver() { this.callback([{ target: this.target }]); }
};
window.followInspectorCode = () => null;
window.cardImageLoadingUnlocked = false;
window.scrollBy = () => {};
window.eval(navigation);
function mount(id = 'sport:tennis') {
  container.replaceChildren();
  const home = document.createElement('nav'); home.className = 'follow-home-tabs'; container.append(home);
  const follow = document.createElement('label'); follow.className = 'follow-sport-control';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; follow.append(checkbox); container.append(follow);
  window.NOTHINGSPORTS_FOLLOW_NAV.mount(container, { id, label: 'Tennis' }, { section: 'teams-players' });
  return container.querySelector('.follow-navigation');
}
try {
  const nav = mount();
  const inset = () => document.documentElement.style.getPropertyValue('--follow-navigation-height');
  assert.equal(inset(), '193px', 'Initial real navigation mount must reserve the captured sticky stack height for native scrolling');
  const observer = observers[0]; assert.equal(observer.target, nav);
  navigationHeight = 237; observer.deliver();
  assert.equal(inset(), '237px', 'Wrapping, font loading or resizing updates the occupied height');
  nav.querySelector('.follow-navigation-toggle').click(); navigationHeight = 430; observer.deliver();
  assert.equal(inset(), '430px', 'Opening the real menu updates scroll occupancy');
  nav.collapse(); navigationHeight = 193; observer.deliver();
  assert.equal(inset(), '193px', 'Collapse restores the measured compact stack without hiding the sport checkbox');
  assert.equal(nav.querySelector('.follow-sport-control input').closest('[hidden]'), null);
  const replacement = mount('sport:tennis-women');
  assert.equal(observer.disconnected, true, 'A redraw disconnects the previous size owner');
  navigationHeight = 999; observer.deliver();
  assert.equal(inset(), '193px', 'A queued callback from a superseded mount cannot overwrite current geometry');
  navigationHeight = 220; observers[1].deliver(); assert.equal(inset(), '220px');
  replacement.remove(); navigationHeight = 0; observers[1].deliver();
  assert.equal(observers[1].disconnected, true);
  assert.equal(inset(), '220px', 'Detached navigation cannot write a zero-height reservation');

  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  const rule = Array.from(style.sheet.cssRules).find(rule => rule.selectorText === 'html:has(#listView.follow-view>.follow-navigation)');
  assert(rule, 'Scroll insets must apply to the document scroll owner only while the Follow navigation is mounted');
  assert.equal(rule.style.getPropertyValue('scroll-padding-block'), 'calc(var(--sticky-top-bar-height,132px) + 58px + var(--follow-navigation-height,0px) + 8px) calc(var(--ns-nav-space,0px) + 8px)');
  assert.equal(document.documentElement.matches(rule.selectorText), false, 'Removing Follow navigation releases its root scroll padding');
  navigationHeight = 193; mount(); assert.equal(document.documentElement.matches(rule.selectorText), true);
  container.className = 'match-centre'; assert.equal(document.documentElement.matches(rule.selectorText), false, 'Other tabs do not inherit Follow scroll padding');
  console.log(JSON.stringify({ passed: true, actualOwnerMount: true, measuredResizeCollapseRedrawDetach: true, scopedDocumentPadding: true, limits: 'Source-owner lifecycle and CSS wiring only. Actual layout, native touch and RED-to-GREEN Players tap require the unchanged ROOT browser journey.' }));
} finally { window.close(); }
