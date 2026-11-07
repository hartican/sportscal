'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const deferred = fs.readFileSync(path.join(root, 'assets/js/follow-presentation-ui.js'), 'utf8');
const moved = ['standingsPinTimestamp', 'toggleStandingsPin', 'standingsFrothRank', 'orderStandingsCompetitions', 'activeStandingsCompetitions', 'buildStandingsFilter', 'buildStandingsInnerTabs'];
const coldTables = ['standingsTeamName', 'followedStandingsParticipantIds', 'standingsEntriesForVisibility', 'standingsColumnsForCompetition', 'appendStandingsTable'];
function functions(source, isHtml = false) {
  const programs = isHtml ? [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => !/\bsrc\s*=|application\/json/i.test(match[1]) && match[2].trim())
    .map(match => ({ source: match[2], offset: match.index + match[0].indexOf('>') + 1 })) : [{ source, offset: 0 }];
  const result = new Map();
  for (const program of programs) for (const node of acorn.parse(program.source, { ecmaVersion: 'latest' }).body) {
    if (node.type !== 'FunctionDeclaration') continue;
    assert(!result.has(node.id.name));
    result.set(node.id.name, { node, source: source.slice(program.offset + node.start, program.offset + node.end) });
  }
  return result;
}
const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !['start', 'end', 'loc', 'raw'].includes(key)).map(([key, child]) => [key, clean(child)])) : value;
const inline = functions(html, true), optional = functions(deferred);
for (const name of moved) { assert(!inline.has(name), name + ' is optional presentation'); assert(optional.has(name)); }
for (const name of coldTables) { assert(inline.has(name), name + ' remains available to cold event previews'); assert(!optional.has(name)); }
assert(optional.has('renderStandingsContextLoaded'));
const equivalenceReferences = [];
for (const argument of process.argv.slice(2)) {
  if (!argument.startsWith('--equivalence-base=')) throw Error('Unknown validation argument');
  const ref = argument.slice('--equivalence-base='.length); equivalenceReferences.push(ref);
  const original = functions(cp.execFileSync('git', ['show', ref + ':index.html'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }), true);
  for (const name of moved) assert.deepEqual(clean(optional.get(name).node), clean(original.get(name).node), name + ' AST unchanged');
  const before = original.get('renderStandingsContext').node, after = optional.get('renderStandingsContextLoaded').node;
  assert.deepEqual(clean(after.params), clean(before.params)); assert.deepEqual(clean(after.body), clean(before.body), 'Renderer body unchanged');
  for (const name of coldTables) assert.deepEqual(clean(inline.get(name).node), clean(original.get(name).node), name + ' cold body unchanged');
}
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.parentElement = null; this.dataset = {}; this.listeners = {}; this.attributes = {}; this.className = ''; this.id = ''; this.value = ''; }
  append(...children) { for (const child of children) { child.remove?.(); this.children.push(child); child.parentElement = this; } }
  appendChild(child) { this.append(child); return child; }
  remove() { if (this.parentElement) { const parent = this.parentElement; parent.children.splice(parent.children.indexOf(this), 1); this.parentElement = null; } }
  set textContent(value) { this.value = value; this.children = []; }
  get textContent() { return this.value + this.children.map(child => child.textContent || '').join(''); }
  set innerHTML(value) { this.value = value; this.children = []; }
  get innerHTML() { return this.value; }
  get isConnected() { return this.tagName === 'document' || Boolean(this.parentElement?.isConnected); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  querySelector(selector) { for (const child of this.children) { if (child.tagName === selector || selector.startsWith('#') && child.id === selector.slice(1)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
}
function fixture({ fail = false, stale = false, tab = 'events' } = {}) {
  const document = new Element('document'); document.baseURI = 'http://127.0.0.1/'; document.createElement = tag => new Element(tag);
  const legacy = new Element('section'); legacy.id = 'standingsContext'; document.append(legacy);
  document.getElementById = id => document.querySelector('#' + id);
  const calls = [], pending = new Map(), requests = new Map();
  const competition = { id: 'competition:tennis:qa', name: 'QA rankings', sportDomainId: 'sport:tennis' };
  const context = { document, URL, activeTab: tab, userPreferences: { showSpoilers: true, standings: {}, preferenceGraph: {} }, standingsRevealApproved: false,
    canonicalSportsData: {}, canonicalSportsDataError: null, canonicalSportsDataLoading: false, standingsCompetitionExpansion: {},
    jointTournamentRankingCompetitions: () => [competition], standingsSportKey: () => 'tennis', latestStandingsSnapshot: () => null,
    SPORT_META: { tennis: { label: 'Tennis', glyph: 'sport:tennis' } }, glyphMarkup: () => '', chooseStandingsCategory: values => values,
    renderFollowView: () => calls.push('follow-owner'), buildFollowHomeTabs: () => {},
    savePreferences: next => { context.userPreferences = next; return true; }, renderAll: () => calls.push('render-all'),
  };
  context.loadDeferredScript = url => {
    const key = new URL(url, document.baseURI).href;
    if (requests.has(key)) return requests.get(key);
    calls.push(url);
    const promise = url.startsWith('config/participant-directory.js') ? Promise.resolve() : new Promise((resolve, reject) => pending.set(url, { resolve, reject }));
    requests.set(key, promise); promise.catch(() => requests.delete(key)); return promise;
  };
  context.loadDeferredScript.requests = requests;
  vm.createContext(context);
  for (const name of ['loadFollowPresentation', 'showFollowPresentationLoading', 'renderStandingsContext', 'buildJointTournamentTablesPanel']) vm.runInContext(inline.get(name).source, context);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  let shouldFail = fail, shouldBeStale = stale;
  async function release() {
    const entries = [...pending]; pending.clear();
    for (const [, gate] of entries) {
      if (shouldFail) { shouldFail = false; gate.reject(Error('Disposable script transport failure')); }
      else if (shouldBeStale) { shouldBeStale = false; context.renderFollowViewLoaded = () => {}; context.renderTeamsAndPlayersDirectoryLoaded = () => {}; gate.resolve(); }
      else { vm.runInContext(deferred, context); gate.resolve(); }
    }
    await flush(); await flush();
  }
  return { context, document, legacy, calls, pending, requests, release, flush, competition };
}
const cases = [];
(async () => {
  const cold = fixture({ tab: 'feed' }); cold.context.renderStandingsContext();
  assert.equal(cold.calls.length, 0, 'Cold Feed callbacks do not fetch optional Follow UI'); cases.push('inactive callback');
  const follow = fixture({ tab: 'follow' }); follow.context.renderStandingsContext();
  assert.deepEqual(follow.calls, ['follow-owner'], 'Follow callbacks retain the existing view owner'); cases.push('Follow owner');
  const embedded = fixture();
  const panel = embedded.context.buildJointTournamentTablesPanel(); embedded.document.append(panel);
  assert(panel.textContent.includes('Loading Follow'));
  const body = panel.children.at(-1); embedded.context.renderStandingsContext({ container: body, competitions: [embedded.competition], sectionLabel: 'Tennis rankings' });
  assert.equal(embedded.calls.filter(url => url.startsWith('assets/js/follow-presentation-ui.js')).length, 1, 'Repeated render shares the existing script owner');
  await embedded.release(); assert(panel.textContent.includes('No valid data is available'), 'The actual embedded caller finishes through the actual moved renderer');
  assert.equal(body.dataset.followPresentation, undefined); cases.push('actual embedded caller/coalescing');
  panel.querySelector('button').listeners.click();
  assert(embedded.context.userPreferences.standings.pinTimestamps[embedded.competition.id]);
  embedded.context.toggleStandingsPin(embedded.competition.id);
  assert.equal(embedded.context.userPreferences.standings.pinTimestamps[embedded.competition.id], undefined);
  assert.equal(embedded.calls.filter(call => call === 'render-all').length, 2); cases.push('existing pin owner');
  embedded.context.userPreferences.showSpoilers = false;
  embedded.context.renderStandingsContext({ container: body, competitions: [embedded.competition], sectionLabel: 'Tennis rankings' });
  assert(body.textContent.includes('Hidden while Results is off')); cases.push('warm Results OFF');
  for (const mode of ['fail', 'stale']) {
    const test = fixture({ [mode]: true }); const container = new Element('section'); test.document.append(container);
    const options = { container, competitions: [test.competition] }; test.context.renderStandingsContext(options);
    await test.release(); assert(container.textContent.includes('Follow could not load'));
    assert.equal(container.dataset.followPresentation, undefined);
    const script = [...test.calls].find(url => url.startsWith('assets/js/follow-presentation-ui.js'));
    assert(!test.requests.has(new URL(script, test.document.baseURI).href), 'Failed or incomplete module can retry through the same request owner');
    container.querySelector('button').listeners.click(); await test.release();
    assert(container.textContent.includes('No valid data is available')); cases.push(mode + ' retry');
  }
  for (const change of ['navigation', 'disconnected']) {
    const test = fixture(), container = new Element('section'); test.document.append(container);
    test.context.renderStandingsContext({ container, competitions: [test.competition] });
    if (change === 'navigation') test.context.activeTab = 'feed'; else container.remove();
    await test.release(); assert(!container.textContent.includes('No valid data is available'), 'Late module cannot replace an inactive target'); cases.push(change + ' fence');
  }
  console.log(JSON.stringify({ passed: true, cases, movedHelpers: moved.length, equivalenceReferences, unchangedRendererBody: equivalenceReferences.length ? true : null, coldTableHelpersRetained: coldTables.length, limits: 'Actual caller/loader/renderer with disposable DOM and script transport; no browser/service/offline-device proof.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
