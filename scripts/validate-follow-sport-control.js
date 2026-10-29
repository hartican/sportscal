'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const navigationSource = fs.readFileSync(path.join(root, 'assets/js/follow-navigation.js'), 'utf8');
const presentationSource = fs.readFileSync(path.join(root, 'assets/js/follow-presentation-ui.js'), 'utf8');
const start = presentationSource.indexOf("  const commonControls=document.createElement('div');");
const end = presentationSource.indexOf('  container.appendChild(commonControls);', start);
assert(start >= 0 && end > start, 'Use the actual selected-sport Follow render block');
const controlSource = presentationSource.slice(start, end + '  container.appendChild(commonControls);'.length);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const writerStart = html.indexOf('function saveFollowSport(sport, followed){');
const writerEnd = html.indexOf('\nfunction toggleAustraliaInternationals()', writerStart);
assert(writerStart >= 0 && writerEnd > writerStart, 'Use the actual sport Follow writer');
const writerSource = html.slice(writerStart, writerEnd);
class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.parentElement = null;
    this.attributes = {}; this.listeners = {}; this.className = ''; this.hidden = false;
    this.classList = { toggle: (name, on) => {
      const names = new Set(this.className.split(' ').filter(Boolean));
      on ? names.add(name) : names.delete(name); this.className = [...names].join(' ');
    }};
  }
  get firstChild() { return this.children[0] || null; }
  append(...children) { for (const child of children) { child.remove?.(); this.children.push(child); child.parentElement = this; } }
  appendChild(child) { this.append(child); return child; }
  prepend(...children) { for (const child of children.reverse()) { child.remove?.(); this.children.unshift(child); child.parentElement = this; } }
  remove() { const parent = this.parentElement; if (parent) { parent.children.splice(parent.children.indexOf(this), 1); this.parentElement = null; } }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part));
    if (selector === 'dialog[open]') return this.tagName === 'dialog' && this.attributes.open !== undefined;
    if (selector.includes(':not(')) { const [positive, negative] = selector.split(':not('); return this.matches(positive) && !this.matches(negative.slice(0, -1)); }
    return selector.startsWith('.') ? this.className.split(' ').includes(selector.slice(1)) : this.tagName === selector;
  }
  querySelector(selector) {
    if (selector.startsWith(':scope > ')) return this.children.find(child => child.matches?.(selector.slice(9))) || null;
    for (const child of this.children) { if (child.matches?.(selector)) return child; const nested = child.querySelector?.(selector); if (nested) return nested; }
    return null;
  }
  getBoundingClientRect() { return { top: 0, height: 44 }; }
}
function visible(element) { for (let node = element; node; node = node.parentElement) if (node.hidden) return false; return true; }
const proofs = [];
for (const id of ['sport:tennis', 'sport:tennis-women', 'sport:football', 'sport:horse-racing']) {
  for (const checked of [false, true]) for (const rejected of [false, true]) {
    const document = new Element('document');
    document.documentElement = { style: { setProperty: () => {} } };
    document.createElement = tag => new Element(tag);
    document.createTextNode = text => Object.assign(new Element('#text'), { textContent: text });
    const container = new Element('section'); document.append(container);
    const bar = new Element('nav'); bar.className = 'follow-sport-bar'; container.append(bar);
    const handlers = {}, requests = [];
    const preferences = { selectedSelectorEntityIds: checked ? [id] : [], preferenceGraph: { competitionPreferences: [] }, followFirst: { australiansOnlySportIds: [], notifications: { enabled: false, userChoice: false } } };
    const before = JSON.stringify(preferences);
    const entity = { id, label: id.slice(6), canonicalSportKeys: [id.slice(6)] };
    const context = {
      document, container, entity, userPreferences: preferences,
      selectorEntityIsEffectivelySelected: () => checked, followDirectoryKey: selected => selected.id.slice(6),
      FOLLOW_FEED_POLICY: { australiansFilterUseful: () => false },
      clonePreferences: value => JSON.parse(JSON.stringify(value)),
      selectorEntityById: () => entity, BASE_SPORT_SELECTOR_ENTITIES: [],
      canonicalSportKeysForSelectorIds: ids => ids.map(id => id.slice(6)),
      savePreferences: next => { requests.push(JSON.parse(JSON.stringify(next))); if (rejected) return false; context.userPreferences = next; return true; },
      renderAll: () => {},
      localStorage: { getItem: () => null, setItem: () => {} },
      scrollY: 0, performance: { now: () => 2000 },
      addEventListener: (name, listener) => { handlers[name] = listener; },
      scrollBy: () => {}, followInspectorCode: () => null, cardImageLoadingUnlocked: false,
    };
    vm.createContext(context); vm.runInContext(writerSource, context); vm.runInContext(controlSource, context);
    const label = container.querySelector('.follow-sport-control') || container.querySelector('.follow-checkbox');
    const input = label.querySelector('input'); assert.equal(input.checked, checked);
    vm.runInContext(navigationSource, context);
    context.NOTHINGSPORTS_FOLLOW_NAV.mount(container, entity, { section: 'teams-players' });
    const nav = container.querySelector('.follow-navigation');
    const initial = visible(input); nav.querySelector('.follow-navigation-toggle').onclick();
    const opened = visible(input); context.scrollY = 150; handlers.scroll();
    const collapsed = visible(input);
    assert(initial && opened && collapsed, id + ': the selected sport checkbox stays visible when the menu is closed/open/scroll-collapsed');
    assert.equal(JSON.stringify(preferences), before, 'Mount and menu state never change choices or notification OFF');
    input.checked = !checked; input.listeners.change();
    assert.equal(requests.length, 1); assert.equal(requests[0].selectedSelectorEntityIds.includes(id), !checked);
    assert.equal(input.checked, rejected ? checked : !checked, 'A refused save restores the last saved checkbox value');
    if (rejected) assert.equal(JSON.stringify(context.userPreferences), before, 'Rejected choices preserve previous preferences');
    if (id === 'sport:football') assert(!visible(container.querySelector('.follow-common-controls').querySelector('input')), 'Separate competition control keeps its collapsed-menu scope');
    proofs.push({ id, checked, rejected, initial, opened, collapsed, exactScopeDispatched: true, choicesUnchangedByBrowse: true });
  }
}
console.log(JSON.stringify({ passed: true, cases: proofs, limits: 'Real render block, sport writer and navigation owner with disposable DOM; controlled persistence acceptance/refusal. Browser geometry, actual persistence/API, touch and installed-device behaviour require separate checks.' }));
