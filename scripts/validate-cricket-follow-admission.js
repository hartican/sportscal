'use strict';
// Exercise the production Match Centre profile and Events controls. Only DOM,
// optional profile details and the local preference storage boundary are fake.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const follow = require('../config/follow-first');
const policy = require('../config/follow-feed-policy');
const cricket = require('../config/cricket-coverage');
const preferenceSystem = require('../config/preference-system');
const identity = require('../config/fixture-identity');
const lifecycle = require('../config/card-lifecycle');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'config/athlete-profile-ui.js'), 'utf8');
function visit(node, callback){
  if(!node || typeof node!=='object')return;
  callback(node);
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>visit(child,callback));else if(value&&typeof value==='object')visit(value,callback);
}
function declarations(source, isHtml = false) {
  const map = new Map();
  const scripts = isHtml ? [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(m => !/\bsrc\s*=|application\/json/i.test(m[1])).map(m => m[2]) : [source];
  for (const script of scripts) {
    visit(acorn.parse(script, { ecmaVersion: 'latest' }), node=>{
      if (node.type === 'FunctionDeclaration') map.set(node.id.name, script.slice(node.start, node.end));
    });
  }
  return map;
}
function initializer(source,name){
  let expression;
  visit(acorn.parse(source,{ecmaVersion:'latest'}),node=>{if(node.type==='VariableDeclarator'&&node.id.name===name)expression=source.slice(node.init.start,node.init.end);});
  assert(expression,name+' is an actual production initializer');return expression;
}
const inline = declarations(html, true), profiles = declarations(profileSource);
const venueFunctions = declarations(fs.readFileSync(path.join(root, 'config/venue-panel-ui.js'), 'utf8'));
const directoryFunctions = declarations(fs.readFileSync(path.join(root, 'assets/js/follow-presentation-ui.js'), 'utf8'));
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.className = ''; this.classList = { toggle() {} }; }
  append(...children) { for (const child of children) { this.children.push(child); child.parentElement = this; } }
  appendChild(child) { this.append(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  removeEventListener() {}
  focus() {}
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
  get isConnected() { return this.tagName === 'document' || Boolean(this.parentElement?.isConnected); }
  closest(selector) { return selector === '[data-event-id]' ? this.parentElement : null; }
  getBoundingClientRect() { return { top: 0 }; }
  querySelectorAll(selector) { return this.children.flatMap(c => [...(selector.startsWith('.') && c.className.split(' ').includes(selector.slice(1)) ? [c] : []), ...c.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { const e = { stopPropagation() {} }; this.listeners.click?.(e); this.onclick?.(e); }
}
const retainedSource = require('./fixtures/cricket-follow-admission-20261027.json');
const publishedSchedule = { schemaVersion: 'code-inspector-chunk.v1', code: retainedSource.code, fixtures: retainedSource.fixtures };
const overviewModel = require('../lib/event-overviews');
const publishedOverviews = retainedSource.overviews;
const schedule = { ...publishedSchedule, fixtures: overviewModel.withCricketEditions(publishedSchedule.fixtures, publishedOverviews) };
const fixture = schedule.fixtures.find(e => e.id === 'fixture:cricket:espn:1539434');
const overview = publishedOverviews.find(e => e.id === 'overview:cricket:competition:cricket:espn:24469:2026');
assert(fixture && overview, 'reported published fixture and tour must be present');
// Compile the unchanged server module against the retained public overview
// input. Do not replace its admission, normalization, resolver or API logic, or
// pollute the process's ordinary module cache when this joins an existing gate.
const Module = require('node:module'), serverPath = require.resolve('../lib/server-feed-pipeline');
const serverModule = new Module(serverPath, module); serverModule.filename = serverPath; serverModule.paths = Module._nodeModulePaths(path.dirname(serverPath));
const serverRequire = serverModule.require.bind(serverModule);
serverModule.require = name => name === '../data/event-overviews.v1.json' ? { events: publishedOverviews } : serverRequire(name);
serverModule._compile(fs.readFileSync(serverPath, 'utf8'), serverPath);
const { buildServerFeed } = serverModule.exports;
function context(preferences = {}, actions = {}) {
  const document = new Element('document'); document.body = new Element('body'); document.append(document.body);
  document.createElement = tag => new Element(tag); document.removeEventListener = () => {};
  const saved = [], browse = { filtersBySport: {} }, reads = [], warnings = [], faults = {};
  const ctx = { document, console: {...console,warn:(...args)=>warnings.push(args)}, structuredClone, Date, Map, Set, userPreferences: follow.migratePreferences(preferences), actions,
    FOLLOW_FIRST: follow, FOLLOW_FEED_POLICY: policy, NOTHINGSPORTS_CRICKET_COVERAGE: cricket, PREFERENCE_SYSTEM: preferenceSystem,
    NOTHINGSPORTS_SURFACE_CATEGORY: require('../config/surface-category'),
    NOTHINGSPORTS_TENNIS_FEED: require('../config/tennis-feed'), tennisFeedParentDocument: null,
    clonePreferences: structuredClone, readStandingsDirectorySession: () => browse, followCollectionsById: () => ({}),
    recordPreferenceChange() {}, showToast() {}, renderTabCounts() {}, renderAll() {},
    savePreferences(next, options) { assert(options.deliberate); ctx.userPreferences = follow.migratePreferences(next); saved.push(JSON.stringify(ctx.userPreferences)); return true; },
    activeTab: 'match-centre', activeInspectorCodeId: null, scrollY: 0, followBrowseState: () => ({}), saveFollowBrowse() {},
    profileFixtureEvents: new Map([[fixture.id, fixture]]), codeIdForEvent: () => 'sport:cricket', cardIdentityParticipants: () => [],
    loadFollowDirectoryChunk: async () => ({ records: fixture.participantIds.map(id => ({ id, displayName: id.endsWith('india') ? 'India' : 'Black Caps' })) }),
    populateProfile: async () => {}, appendProfileFixtureContext: async () => {},
    location: { href: 'https://example.invalid/#match-centre' }, history: { state: {}, pushState() {} }, nowAEST: () => new Date('2026-10-27T04:00:00Z'),
    CARD_LIFECYCLE: lifecycle, TEAM_FOLLOW_CATALOGUE: null, footballDirectoryApi: null, directoryFollowIndex: () => ({}),
    getEventAction: e => actions[e.id] || {}, followedParticipantLabel: id => id,
    activeEvents: [], liveFixtureRevision: 'disposable', disposableStore: null, followedScheduleFixtures: new Map(), followedScheduleLoads: new Map(), startupFunnelFinished: false,
    codeInspectorManifest: null, codeInspectorManifestLoading: null, CODE_INSPECTOR_MANIFEST_URL: 'disposable-manifest',
    fetchJson: async url => { reads.push(url); if(url!=='disposable-manifest'&&faults.schedule)throw Error('Controlled schedule transport failure'); return url === 'disposable-manifest' ? { schemaVersion: 'code-inspector.v1', codes: [{ ...schedule.code, eventEditionIds: publishedOverviews.map(e=>e.id), ...(faults.membership?{}:{eventEditions: publishedOverviews}), followSchedulePath: 'disposable-cricket' }] } : schedule; },
    mergeCanonicalEventPages: (a, b) => [...new Map([...a, ...b].map(e => [e.id, e])).values()], mergeFootballFixtureEvents: x => x,
    eventMeetsDerivedRetention: e => identity.retainedInActiveTimeline(e, new Date('2026-10-27T04:00:00Z')), normalizeEvents() {}, rebuildDerivedCardCache() {},
    tennisFeedParentCandidates: events => events, majorEventsDocument: null, activeFilter: 'all', eventIsAutoArchived: () => false,
    discoveryEventIncludedForSession: () => true, matchesFeedViewFilters: () => true,
    requestAnimationFrame() {}, addEventListener() {}, removeEventListener() {}, saved, browse, reads, warnings, faults,
  };
  ctx.NOTHINGSPORTS_FIXTURE_IDENTITY = { ...identity, retainedInActiveTimeline: e => identity.retainedInActiveTimeline(e, ctx.nowAEST()) };
  ctx.buildFollowEligibilityContext = () => ({ playerTeams: new Map(), participantsById: new Map(), collectionsById: {}, preparedPreferences: follow.migratePreferences(ctx.userPreferences) });
  ctx.root = ctx; ctx.window = ctx; vm.createContext(ctx);
  for (const name of ['normalizeExpandedTeamIds', 'directoryFilters', 'syncDirectoryFollowButton', 'buildDirectoryFollowButton', 'setDirectoryEntityFollow', 'eventEditionFollowed', 'buildEventEditionToggle', 'automaticEventFollowReason', 'followFeedPolicySource', 'eventFollowReason', 'loadFollowedScheduleFixtures', 'loadCodeInspectorManifest', 'getPreferenceMatchedEvents', 'getFilteredEvents']) {
    assert(inline.has(name), name); vm.runInContext(inline.get(name), ctx);
  }
  vm.runInContext(venueFunctions.get('eventParticipantFollowLevels'), ctx);
  for (const name of ['open', 'openFromFixture']) vm.runInContext(profiles.get(name), ctx);
  return ctx;
}
async function profileFollow(ctx, id) {
  const card = new Element('article'); card.dataset.eventId = fixture.id;
  const trigger = new Element('button'); card.append(trigger); ctx.document.body.append(card);
  await ctx.openFromFixture(id, id.endsWith('india') ? 'India' : 'Black Caps', 'cricket', trigger);
  const button = ctx.document.querySelector('.football-follow-toggle'); assert(button, 'actual profile route mounts the team Follow control'); button.click();
  return button;
}
async function assertFeed(ctx, expected, label, event = fixture) {
  assert.equal(Boolean(ctx.eventFollowReason(event)), expected, 'actual client Feed predicate: ' + label);
  const server = buildServerFeed({ events: [event], userId: 'disposable-follow-route', userState: { preferences: ctx.userPreferences, event_user_state: ctx.actions }, now: ctx.nowAEST() });
  assert.equal(server.events.some(e => e.id === event.id), expected, 'actual server Feed: ' + label);
  await ctx.loadFollowedScheduleFixtures();
  assert.equal(ctx.activeEvents.some(e => e.id === event.id), expected, 'actual cold followed schedule composition: ' + label);
  ctx.activeTab = 'feed';
  assert.equal(ctx.getFilteredEvents().some(e=>e.id===event.id), expected, 'actual visible Feed selection: ' + label);
}
const tourPreferences = state => ({ followFirst: { eventEditionDecisions: { schemaVersion: 'event-edition-decisions.v1', states: { [overview.id]: state } } } });
const teamPreferences = (formats, level = 'follow') => ({ preferenceGraph: { entityFollows: [{ participantId: 'team:cricket:india', followLevel: level, ...(formats === undefined ? {} : { cricketFormats: formats }) }] } });
const plain = value => JSON.parse(JSON.stringify(value));
function directoryFollow(ctx, format) {
  // Execute the actual format-filtered directory call site, with its captured
  // record and filters. Profile tests above execute the full production route.
  const source = directoryFunctions.get('renderLegacyParticipantDirectory');
  ctx.record = { id: 'team:cricket:india', displayName: 'India' }; ctx.sportKey = 'cricket'; ctx.filters = { cricketFormat: format };
  return vm.runInContext(initializer(source,'follow'), ctx);
}
(async () => {
  const failures = []; let passed = 0;
  async function check(label, run) { try { await run(); passed++; console.log('PASS ' + label); } catch (error) { failures.push(label); console.error('FAIL ' + label + ': ' + error.message); } }
  for (const id of fixture.participantIds) await check('Match Centre generic team Follow admits T20I: ' + id, async () => {
    const ctx = context(); await profileFollow(ctx, id);
    assert(follow.effectiveParticipantFollow(id, ctx.userPreferences).followed, 'team registers as followed');
    assert(!Object.hasOwn(ctx.userPreferences.preferenceGraph.entityFollows[0], 'cricketFormats'), 'generic route writes whole-team intent');
    await assertFeed(ctx, true, 'reported T20I must enter Feed without a separate Add');
    const restarted = context(JSON.parse(ctx.saved.at(-1))); await assertFeed(restarted, true, 'serialized local reload');
  });
  await check('Events tour Follow admits its T20I', async () => {
    const ctx = context(), button = ctx.buildEventEditionToggle(overview); ctx.document.body.append(button); button.click();
    assert.equal(policy.editionDecision(overview, ctx.userPreferences), 'followed', 'tour registers as followed');
    await assertFeed(ctx, true, 'reported tour child must enter Feed without a separate Add');
    assert.deepEqual(ctx.reads, ['disposable-manifest', 'disposable-cricket'], 'cold entry fetches manifest then exactly its selected schedule');
    assert.deepEqual(ctx.userPreferences.selectedSelectorEntityIds, [], 'tour load does not create sport consent');
    assert(ctx.activeEvents.every(e => overview.fixtureIds.includes(e.id)), 'tour-only admission does not include its same-team sibling tour');
    await assertFeed(context(JSON.parse(ctx.saved.at(-1))), true, 'tour decision survives serialized local reload');
  });
  for (const [formats, level, expected] of [[['Tests'], 'follow', false], [['ODIs'], 'follow', false], [['T20Is'], 'follow', true], [[], 'follow', false], [undefined, 'unfollow', false], [['T20Is', 'Tests'], 'priority', true]]) await check('existing explicit team intent stays exact: ' + JSON.stringify([formats, level]), async () => {
    const ctx = context(teamPreferences(formats, level)), before = plain(ctx.userPreferences.preferenceGraph.entityFollows);
    await assertFeed(ctx, expected, 'deliberate format/level');
    assert.deepEqual(plain(ctx.userPreferences.preferenceGraph.entityFollows), before);
  });
  await check('format directory call site retains captured explicit Tests intent', async () => {
    const ctx = context(), button = directoryFollow(ctx, 'Tests');
    ctx.browse.filtersBySport.cricket = { cricketFormat: 'T20Is' }; button.click();
    assert.deepEqual(plain(ctx.userPreferences.preferenceGraph.entityFollows[0].cricketFormats), ['Tests']);
    await assertFeed(ctx, false, 'explicit Tests is not a generic Follow');
  });
  await check('format directory T20I choice and generic deliberate re-follow', async () => {
    const explicit = context(); directoryFollow(explicit, 'T20Is').click(); await assertFeed(explicit, true, 'explicit T20Is');
    const ctx = context(teamPreferences(['Tests'])), before = plain(ctx.userPreferences.preferenceGraph.entityFollows);
    const button = await profileFollow(ctx, 'team:cricket:india'); // explicit user Unfollow
    assert.equal(ctx.userPreferences.preferenceGraph.entityFollows[0].followLevel, 'unfollow');
    button.click(); assert(!Object.hasOwn(ctx.userPreferences.preferenceGraph.entityFollows[0], 'cricketFormats'));
    await assertFeed(ctx, true, 'a new deliberate whole-team Follow removes the old format restriction');
    assert.deepEqual(before[0].cricketFormats, ['Tests'], 'merely opening/browsing never widened old data');
  });
  await check('generic team Unfollow removes automatic admission', async () => {
    const ctx = context(); const button = await profileFollow(ctx, 'team:cricket:india'); button.click(); await assertFeed(ctx, false, 'Unfollow');
  });
  await check('independent tour and participant precedence', async () => {
    const tour = context(tourPreferences('followed')); tour.userPreferences.preferenceGraph.entityFollows = teamPreferences(['Tests']).preferenceGraph.entityFollows;
    await assertFeed(tour, true, 'explicit tour has its own consent');
    const team = context({ ...tourPreferences('excluded'), ...teamPreferences(undefined) }); await assertFeed(team, true, 'event exclusion retains independent team follow');
    await assertFeed(context(tourPreferences('excluded')), false, 'event exclusion without an independent follow');
  });
  await check('competition exclusion and exact child event choice survive', async () => {
    const excluded = context(tourPreferences('followed')); excluded.userPreferences.preferenceGraph.competitionPreferences = [{ competitionId: fixture.competitionId, enabled: false }];
    await assertFeed(excluded, false, 'explicit competition exclusion');
    const child = context(tourPreferences('followed')); child.userPreferences.followFirst.eventEditionDecisions.states[fixture.id] = 'excluded';
    await assertFeed(child, false, 'existing exact child edition decision retains its precedence');
  });
  await check('manual pin and dismissed action survive preference writes and reload', async () => {
    const pin = { addedToFixtures: true, addedToFixturesAt: '2026-10-27T03:00:00Z', manualPin: true, addedFixture: { ...fixture, manualPin: true } };
    const actions = { [fixture.id]: pin }, original = JSON.stringify(actions), ctx = context({}, actions);
    const button = await profileFollow(ctx, 'team:cricket:india'); button.click(); ctx.buildEventEditionToggle(overview).click();
    assert.equal(JSON.stringify(actions), original, 'follow writers do not modify accepted fixture actions');
    const restarted = context(plain(ctx.userPreferences), plain(actions)); assert.deepEqual(restarted.actions[fixture.id], plain(pin));
    const response = buildServerFeed({ events: [fixture], userId: 'disposable-pinned', userState: { preferences: restarted.userPreferences, event_user_state: restarted.actions }, now: restarted.nowAEST() });
    assert(response.events.some(e => e.id === fixture.id));
    restarted.activeTab='feed'; restarted.activeEvents=response.events;
    assert(restarted.getFilteredEvents().some(e=>e.id===fixture.id));
    restarted.actions[fixture.id].dismissed = true;
    assert(!restarted.getFilteredEvents().some(e=>e.id===fixture.id), 'existing visible Feed filter respects a dismissed retained pin');
    assert.equal(restarted.actions[fixture.id].addedToFixtures, true, 'dismissal retains accepted pin history');
  });
  await check('exact published membership, foreign context and source facts', () => {
    const raw = publishedSchedule.fixtures.find(e => e.id === fixture.id), source = JSON.stringify(publishedSchedule.fixtures);
    const bound = overviewModel.withCricketEditions(publishedSchedule.fixtures, publishedOverviews);
    for (let i = 0; i < bound.length; i++) { const { editionId, ...rest } = bound[i]; assert.deepEqual(rest, publishedSchedule.fixtures[i]); }
    assert.equal(JSON.stringify(publishedSchedule.fixtures), source, 'every source field and original observation remains unchanged');
    for (const fields of [{ id: 'fixture:unpublished:same-competition' }, { key: 'cricket-women', sportKey: 'cricket-women', sportDomainId: 'sport:cricket-women' }, {gender:'women'}, { competitionId: 'competition:cricket:foreign' }, { date: '2027-10-27', endDate: '2027-10-27' }]) {
      const event = { ...raw, ...fields }, [result] = overviewModel.withCricketEditions([event], [overview]);
      assert(!result.editionId, 'unknown ID/sport/gender/competition/season cannot inherit membership: '+JSON.stringify(fields));
      assert(!follow.reasonForEvent(result, tourPreferences('followed')));
    }
    const existing = { ...raw, editionId: 'retained-explicit-edition' }; assert.strictEqual(overviewModel.withCricketEditions([existing], [overview])[0], existing);
    assert.strictEqual(overviewModel.withCricketEditions([raw], [])[0], raw, 'missing membership stays unresolved');
    for(const fields of [{date:null},{competitionId:null},{fixtureIds:null}])assert.strictEqual(overviewModel.withCricketEditions([raw],[{...overview,...fields}])[0],raw,'incomplete published context stays unresolved');
    assert.throws(() => overviewModel.withCricketEditions([raw], [overview, { ...overview, id: overview.id + '-ambiguous' }]), /Ambiguous/);
    assert.throws(() => overviewModel.withCricketEditions([raw], [overview, { ...overview, competitionId: 'conflict' }]), /Ambiguous/);
    assert.strictEqual(identity.cricketEditionResolver(publishedOverviews),identity.cricketEditionResolver(publishedOverviews),'one membership index per loaded metadata array');
  });
  await check('unknown/excluded tour cannot request a schedule or create consent', async () => {
    for (const [id, state] of [[overview.id, 'excluded'], ['overview:cricket:unknown:2026', 'followed'], ['overview:rugby:unknown:2026', 'followed'], [overview.id, true]]) {
      const ctx = context({ followFirst: { eventEditionDecisions: { states: { [id]: state } } } }); await ctx.loadFollowedScheduleFixtures();
      assert.deepEqual(ctx.reads, ['disposable-manifest']); assert.equal(ctx.activeEvents.length, 0); assert.deepEqual(ctx.userPreferences.selectedSelectorEntityIds, []);
    }
  });
  await check('older stored row and actual live overlay preserve exact edition and observations', () => {
    const raw = publishedSchedule.fixtures.find(e => e.id === fixture.id), now = new Date('2026-10-27T04:00:00Z');
    const merged = require('../lib/live-fixtures').overlaySnapshots([fixture], [{ source_id: 'controlled-retained', fixtures: [raw], checked_at: raw.sourceCheckedAt }], { now });
    assert.equal(merged[0].editionId, overview.id); assert.equal(merged[0].id, fixture.id); assert.equal(merged[0].startTimeUtc, fixture.startTimeUtc);
    const check = e => { for(const copyEvents of [true,false]){const result = buildServerFeed({ events: [e], userId: 'disposable-older', userState: { preferences: tourPreferences('followed') }, now,copyEvents }); assert(result.events.some(row => row.id === fixture.id));} };
    check(raw); check(merged[0]);
    const input = JSON.stringify(raw); check(raw); assert.equal(JSON.stringify(raw), input, 'server normalization cannot rewrite an older source row');
  });
  await check('actual old saved-schedule fallback keeps verified tour membership after fetch failure', async () => {
    const ctx=context(tourPreferences('followed'));ctx.faults.schedule=true;
    ctx.disposableStore={hydrate:async()=>({events:publishedSchedule.fixtures}),set(){throw Error('A failed read must not invent a cache observation');}};
    await ctx.loadFollowedScheduleFixtures();ctx.activeTab='feed';
    assert(ctx.getFilteredEvents().some(e=>e.id===fixture.id),'tour-only old cached child remains in visible Feed');
    assert(ctx.getFilteredEvents().every(e=>overview.fixtureIds.includes(e.id)),'cached sibling tours stay out');
    assert.deepEqual(ctx.reads,['disposable-manifest','disposable-cricket']);assert.equal(ctx.warnings.length,1);
    assert(!publishedSchedule.fixtures.some(e=>e.editionId),'cached source input stays unchanged');
    ctx.userPreferences.preferenceGraph.competitionPreferences=[{competitionId:fixture.competitionId,enabled:false}];
    assert(!ctx.getFilteredEvents().some(e=>e.id===fixture.id),'a verified cached link cannot override an explicit exclusion');
  });
  await check('old saved-schedule fallback without exact published evidence stays unresolved', async () => {
    const ctx=context(tourPreferences('followed'));ctx.faults.schedule=true;ctx.faults.membership=true;
    ctx.disposableStore={hydrate:async()=>({events:publishedSchedule.fixtures}),set(){throw Error('No new cache write');}};
    await ctx.loadFollowedScheduleFixtures();ctx.activeTab='feed';
    assert(!ctx.getFilteredEvents().some(e=>e.id===fixture.id),'an edition label alone cannot invent child membership');
  });
  await check('actual Code producer preserves existing edition metadata', () => {
    const producer=require('./build-code-inspector'), raw=publishedSchedule.fixtures.find(e=>e.id===fixture.id);
    assert.equal(producer.normalizeFixture({...raw,editionId:'retained-explicit-edition'},'sport:cricket').editionId,'retained-explicit-edition');
    const produced=producer.codeFixtures({id:'sport:cricket',slug:'cricket',name:'Cricket'}), parents=overviewModel.build(produced);
    assert(produced.length);
    for(const event of produced.filter(f=>f.editionId))assert(parents.some(p=>p.id===event.editionId&&p.fixtureIds.includes(event.id)), 'actual producer binds only a published parent child');
  });
  await check('actual manifest publisher retains normalized women context without changing the raw fixture key',()=>{
    const builderPath=require.resolve('./build-code-inspector'),source=declarations(fs.readFileSync(builderPath,'utf8')).get('build');
    const raw=publishedSchedule.fixtures.find(e=>e.id===fixture.id),women={...raw,id:'fixture:controlled:women-context',gender:'women'};
    const metadata=vm.runInNewContext(initializer(source,'eventEditions'),{code:{id:'sport:cricket'},fixtures:[women],require:Module.createRequire(builderPath)});
    assert.equal(women.key,'cricket');assert.equal(metadata[0].key,'cricket-women');assert.equal(metadata[0].gender,'women');
    const bind=identity.cricketEditionResolver(metadata);
    assert.equal(bind(women).editionId,metadata[0].id);
    assert(!bind({...women,gender:'men'}).editionId,'gender-only contradiction cannot acquire a women edition');
  });
  assert.equal(failures.length, 0, failures.join('; '));
  console.log('Cricket Follow admission: ' + passed + ' source-route, client/server, cold-load and preservation checks passed.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
