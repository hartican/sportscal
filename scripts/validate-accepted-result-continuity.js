#!/usr/bin/env node
'use strict';

// Constructed contracts, not a current-data audit. Both actual CLI entrypoints
// run against disposable roots, frozen helper bytes and denied network access.
// Optional: --report=/private/report.json --label=baseline-or-fixed-snapshot
// --helper-reference=/isolated/scripts/lib/accepted-result-projection.js
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const referenceArgument = process.argv.find(arg => arg.startsWith('--helper-reference='));
const helperPath = referenceArgument ? path.resolve(referenceArgument.slice('--helper-reference='.length))
  : path.join(__dirname, 'lib/accepted-result-projection.js');
const helper = require(helperPath);

const ROOT = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const aliases = row => [...new Set([row.id, row.eventId, row.canonicalId,
  row.canonicalEventId, ...(row.sourceEventIds || [])].filter(Boolean))];
const SOURCE_CLOCKS = ['sourceCheckedAt', 'resultSourceCheckedAt', 'scoreCheckedAt',
  'statusCheckedAt', 'scoreFactObservedAt', 'statusFactObservedAt', 'firstConfirmedCompleteAt'];
const STATUS_TUPLE = ['status', 'resultStatus', 'resultLabels', 'statusFactObservedAt',
  'statusCheckedAt', 'statusSourceUrl', 'statusSourceName', 'statusSourceType'];
const SCORE_TUPLE = ['score', 'scoreDisplay', 'result', 'sets', 'homeScore', 'awayScore',
  'winnerParticipantId', 'loserParticipantId', 'eliminatedParticipantIds',
  'outcomeText', 'recapText', 'scoreFactObservedAt', 'scoreCheckedAt'];
const SOURCE_TUPLE = ['sourceUrl', 'sourceName', 'sourceType', 'sourceCheckedAt',
  'resultSourceUrl', 'resultSourceName', 'resultSourceType', 'resultSourceCheckedAt'];
const PROTECTED = ['id', 'eventId', 'canonicalEventId', 'participantIds', 'participants',
  'date', 'time', 'startTimeUtc', 'venue', 'lastReviewedAt', 'resultPublishedAt',
  'rawImportMetadata', 'selectedSentence', 'fullSpiel'];
const FILES = ['feeds/incoming/events.json', 'data/events.json',
  'data/canonical/afl-nrl-2026.json', 'data/canonical/official-card-results-2026.json',
  'data/follow-sources/coverage.v1.json', 'data/major-events.v1.json'];
const EVIDENCE = 'data/canonical/current-card-evidence-2026.json';
const results = [];

function tag(raw) {
  const row = clone(raw);
  delete row.acceptedResultProjection;
  row.acceptedResultProjection = {
    schemaVersion: 'accepted-result-projection.v1', aliases: aliases(row),
    participantIds: clone(row.participantIds), fixtureDate: row.date,
    sourceSha256: helper.hash(row), payloadSha256: helper.hash(helper.payload(row)),
  };
  return row;
}

function retag(row, mutate) {
  const next = clone(row);
  mutate(next);
  // Deliberately recompute the signed payload hash. Semantic invalidity must
  // fail independently of the ordinary unsigned-payload tampering check.
  next.acceptedResultProjection.payloadSha256 = helper.hash(helper.payload(next));
  return next;
}

const ruud = 'competitor:tennis:atp:casper-ruud';
const felix = 'competitor:tennis:atp:felix-auger-aliassime';
const retirement = tag({
  id: 'fixture-tennis-espn-atp-184948', canonicalId: 'fixture:tennis:espn:atp:184948',
  canonicalEventId: 'fixture:tennis:espn:atp:184948', name: 'Constructed retirement contract',
  key: 'tennis', date: '2026-10-14', participantIds: [ruud, felix],
  homeParticipantId: ruud, awayParticipantId: felix,
  status: 'completed', resultStatus: 'published', resultLabels: ['Retirement'],
  score: '5\u20132', scoreDisplay: '5\u20132', result: '5\u20132', sets: [{home: 5, away: 2}],
  winnerParticipantId: ruud, loserParticipantId: felix, eliminatedParticipantIds: [felix],
  outcomeText: 'Constructed retirement at 5-2.', recapText: 'Constructed contract, not a publication claim.',
  sourceUrl: 'https://www.espn.com/tennis/matchstats?gameId=184948',
  resultSourceUrl: 'https://www.espn.com/tennis/matchstats?gameId=184948',
  sourceName: 'ESPN', sourceType: 'reputable', resultSourceName: 'ESPN', resultSourceType: 'reputable',
  statusSourceUrl: 'https://www.espn.com/tennis/matchstats?gameId=184948',
  statusSourceName: 'ESPN', statusSourceType: 'reputable',
  sourceCheckedAt: '2026-10-15T11:32:02.000Z', resultSourceCheckedAt: '2026-10-15T11:32:02.000Z',
  scoreCheckedAt: '2026-10-15T23:12:01+00:00', statusCheckedAt: '2026-10-15T23:12:01+00:00',
  scoreFactObservedAt: '2026-10-14T07:38:12+00:00', statusFactObservedAt: '2026-10-14T07:42:03+00:00',
  firstConfirmedCompleteAt: '2026-10-14T07:42:04.44723+00:00',
  fixtureObservationSchema: 'fixture-observations.v1',
});
const ca = tag({
  ...helper.payload(retirement), id: 'fixture-cricket-espn-1525659',
  canonicalId: 'fixture:cricket:espn:1525659', canonicalEventId: 'fixture:cricket:espn:1525659',
  name: 'Constructed CA continuity contract', key: 'cricket', date: '2026-10-09',
  participantIds: ['team:cricket:south-africa', 'team:cricket:australia'],
  homeParticipantId: 'team:cricket:south-africa', awayParticipantId: 'team:cricket:australia',
  score: 'Australia won by 214 runs', scoreDisplay: 'Australia won by 214 runs',
  result: 'Australia won by 214 runs', resultLabels: ['Completed'], sets: [],
  winnerParticipantId: 'team:cricket:australia', loserParticipantId: 'team:cricket:south-africa',
  eliminatedParticipantIds: [], outcomeText: 'Australia won by 214 runs',
  recapText: 'Constructed CA contract; no current provider verification.',
  sourceUrl: 'https://www.cricket.com.au/matches/series/CA%3A4568/',
  resultSourceUrl: 'https://www.cricket.com.au/matches/series/CA%3A4568/',
  statusSourceUrl: 'https://www.cricket.com.au/matches/series/CA%3A4568/',
  sourceName: 'Cricket Australia', resultSourceName: 'Cricket Australia',
  statusSourceName: 'Cricket Australia', sourceType: 'trusted-reporting',
  resultSourceType: 'trusted-reporting', statusSourceType: 'trusted-reporting',
  sourceCheckedAt: '2026-10-15T16:28:01.041Z', resultSourceCheckedAt: '2026-10-15T16:28:01.041Z',
  scoreCheckedAt: '2026-10-15T22:30:00.464+00:00', statusCheckedAt: '2026-10-15T22:30:00.464+00:00',
  scoreFactObservedAt: '2026-10-13T22:02:01.52+00:00',
  statusFactObservedAt: '2026-10-13T22:02:01.52+00:00',
  firstConfirmedCompleteAt: '2026-10-13T11:28:12.334719+00:00',
});
const nbl = tag({
  id: 'evt_nbl_2026_27_3706e834_58ad_11f1_8519_a362560fc147',
  canonicalId: 'event:nbl:2026-27:3706e834-58ad-11f1-8519-a362560fc147',
  canonicalEventId: 'event:nbl:2026-27:3706e834-58ad-11f1-8519-a362560fc147',
  name: 'Constructed NBL numeric-side contract', key: 'nbl', date: '2026-10-14',
  participantIds: ['team:nbl:sydney-kings', 'team:nbl:new-zealand-breakers'],
  homeParticipantId: 'team:nbl:sydney-kings', awayParticipantId: 'team:nbl:new-zealand-breakers',
  status: 'completed', resultStatus: 'official', resultLabels: ['Completed'],
  score: '101-102', scoreDisplay: '101-102', result: '101-102', homeScore: 101, awayScore: 102,
  winnerParticipantId: 'team:nbl:new-zealand-breakers', loserParticipantId: 'team:nbl:sydney-kings',
  eliminatedParticipantIds: [], outcomeText: 'Constructed observed pair: 101-102.',
  recapText: 'Constructed numeric contract, not a current-data assertion.',
  sourceName: 'NBL official schedule', sourceType: 'official',
  sourceUrl: 'https://schedule.nbl.com.au/nbl', resultSourceUrl: 'https://schedule.nbl.com.au/nbl',
  sourceCheckedAt: '2026-10-15T23:31:08.522Z', resultSourceCheckedAt: '2026-10-15T23:31:08.522Z',
  scoreCheckedAt: '2026-10-15T23:31:08.522Z', statusCheckedAt: '2026-10-15T23:31:08.522Z',
  fixtureObservationSchema: 'fixture-observations.v1',
});

function seed(row) {
  return {id: row.id, eventId: row.id, canonicalEventId: row.canonicalId,
    sourceEventIds: aliases(row), name: row.name, key: row.key, date: row.date,
    participantIds: clone(row.participantIds), participants: row.participantIds.map(id => ({id, name: id})),
    cardKind: 'fixture', status: 'scheduled', liveWindow: 3, time: null, startTimeUtc: null,
    venue: 'Retained venue', sourceUrl: row.sourceUrl, sourceName: 'Retained source',
    sourceType: row.sourceType, sourceCheckedAt: '2026-10-01T00:00:00.000Z',
    lastReviewedAt: '2026-10-02T00:00:00.000Z', resultPublishedAt: null,
    rawImportMetadata: {retained: true, sequence: 0}, selectedSentence: 'Protected OFF copy.',
    fullSpiel: 'Protected OFF synopsis.', storyline: {arcStage: 'preview',
      hookSpoilerOff: 'Protected OFF hook.', synopsisSpoilerOff: 'Protected OFF synopsis.'}};
}

// Independent expected retained state: do not obtain the test oracle by
// invoking the helper under test, or a broken merge can certify itself.
function completed(row) {
  return {...seed(row), ...clone(helper.payload(row)), sourceTrust: row.sourceType === 'official'
    ? 'verified' : 'unverified', endTimeUtc: null};
}

function tuple(actual, expected, keys, label) {
  for (const key of keys) assert.deepEqual(actual[key], expected[key], `${label}: ${key}`);
}

function accepted(actual, before, row) {
  tuple(actual, before, PROTECTED, 'Protected retained metadata');
  tuple(actual, row, [...STATUS_TUPLE, ...SCORE_TUPLE, ...SOURCE_TUPLE]
    .filter(key => Object.hasOwn(row, key) && !['resultSourceName', 'resultSourceType'].includes(key)),
  'Exact accepted tuple');
  assert.equal(actual.status, 'completed');
  assert.equal(actual.endTimeUtc, null, 'No guessed physical finish');
  for (const key of ['actualEndTimeUtc', 'completedAt']) assert(actual[key] == null, `No invented ${key}`);
  assert.equal(actual.firstConfirmedCompleteAt, row.firstConfirmedCompleteAt, 'Exact receipt or no invented receipt');
  for (const key of ['winnerParticipantId', 'loserParticipantId', 'eliminatedParticipantIds']) {
    assert.deepEqual(actual[key], row[key], `No fabricated result role: ${key}`);
  }
  assert(!Object.hasOwn(actual, 'acceptedResultProjection'), 'Internal proof cannot leak into persisted cards');
  helper.validateAcceptedProjection(actual, row);
}

function check(label, operation) {
  try { operation(); results.push({label, passed: true}); console.log(`PASS ${label}`); }
  catch (error) {
    results.push({label, passed: false, error: error.stack || error.message});
    console.log(`FAIL ${label}: ${error.message}`);
  }
}

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ns-accepted-continuity-')));
const audit = path.join(root, 'writes.jsonl');
const preloader = path.join(root, 'isolation.cjs');
const provenance = {label: process.argv.find(arg => arg.startsWith('--label='))?.slice(8) || 'unlabelled',
  capturedAt: new Date().toISOString(), files: {}, scope: 'Constructed contracts only; no provider, DB or real 13+2 snapshot audit.'};
const write = (file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
};
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const tracked = [...FILES, EVIDENCE];
const bytes = () => tracked.map(file => fs.readFileSync(path.join(root, file)));
const equalBytes = (before, label) => tracked.forEach((file, i) =>
  assert(fs.readFileSync(path.join(root, file)).equals(before[i]), `${label}: ${file}`));

function prepare(rows, retained, seam) {
  const unrelated = {id: 'continuity-unrelated', status: 'scheduled', score: 0,
    rawImportMetadata: {retained: true}};
  for (const file of FILES.slice(0, 3)) write(file, {version: 'retained-version',
    documentMetadata: {retained: true}, events: [...clone(retained), clone(unrelated)]});
  write(FILES[3], {checkedAt: '2026-10-16T00:00:00.000Z', feedVersion: 'retained-version',
    results: seam === 'selected' ? [] : clone(rows)});
  write(FILES[4], {events: [...clone(retained), clone(unrelated)]});
  write(FILES[5], {events: [{id: 'continuity-parent', subEvents: clone(retained)},
    {id: 'continuity-unrelated-parent', status: 'scheduled'}]});
  write(EVIDENCE, {checkedAt: '2026-10-16T00:00:00.000Z', resultOverrides: clone(rows),
    fixtureOverrides: [], timingOverrides: [], broadcastOverrides: []});
}

function run(seam, rows, file = FILES[0]) {
  fs.writeFileSync(audit, '');
  const script = seam === 'selected' ? 'apply-current-card-evidence.js' : 'sync-official-card-results.js';
  const args = seam === 'selected' ? [`--ids=${rows.map(row => row.id).join(',')}`]
    : [path.join(root, file), path.join(root, file)];
  const child = spawnSync(process.execPath, ['--require', preloader,
    path.join(root, 'scripts', script), ...args], {cwd: root, encoding: 'utf8', timeout: 20000,
    maxBuffer: 2 * 1024 * 1024, env: {...process.env, NODE_OPTIONS: '',
      CONTINUITY_ROOT: root, CONTINUITY_AUDIT: audit}});
  const activity = fs.readFileSync(audit, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  assert(!child.error, child.error?.message);
  assert(!child.signal, `CLI terminated by ${child.signal}`);
  assert(!activity.some(item => item.kind === 'deny'),
    'Isolation violation, not a valid semantic rejection: ' + JSON.stringify(activity.filter(item => item.kind === 'deny')));
  return {...child, activity};
}

function persisted(seam, callback) {
  const files = seam === 'selected' ? [FILES[0], FILES[1], FILES[2], FILES[4], FILES[5]] : FILES.slice(0, 2);
  for (const file of files) {
    const doc = read(file);
    const records = file === FILES[5] ? doc.events[0].subEvents : doc.events;
    callback(records, file);
  }
}

function successCase(label, rows, retained, inspect) {
  for (const seam of ['selected', 'official']) check(`${seam}: ${label}`, () => {
    prepare(rows, retained, seam);
    // Both incoming and ordinary caches must be physically written by the
    // official CLI, not merely checked through its exported pure function.
    const invocations = seam === 'selected' ? [FILES[0]] : FILES.slice(0, 2);
    for (const file of invocations) {
      const execution = run(seam, rows, file);
      assert.equal(execution.status, 0, execution.stderr || execution.stdout);
      assert(execution.activity.some(item => item.kind === 'write'), 'CLI must exercise persistence');
    }
    persisted(seam, (records, file) => {
      rows.forEach((row, i) => inspect(records.find(record => record.id === row.id), retained[i], row, file));
      if (file !== FILES[5]) assert.deepEqual(records.find(row => row.id === 'continuity-unrelated'),
        {id: 'continuity-unrelated', status: 'scheduled', score: 0, rawImportMetadata: {retained: true}});
    });
    if (seam === 'selected') {
      const ledger = read(FILES[3]);
      for (const row of rows) assert.deepEqual(ledger.results.find(saved => saved.id === row.id)
        .acceptedResultProjection, row.acceptedResultProjection, 'Ledger retains the original proof');
    }
    const first = bytes();
    for (const file of invocations) {
      const replay = run(seam, rows, file);
      assert.equal(replay.status, 0, replay.stderr || replay.stdout);
    }
    equalBytes(first, 'Exact byte replay');
  });
}

function rejectCase(label, bad, retained = seed(bad)) {
  check(`helper: reject ${label}`, () => {
    assert.equal(bad.acceptedResultProjection.payloadSha256, helper.hash(helper.payload(bad)));
    const before = clone(retained), source = clone(bad);
    assert.throws(() => helper.mergeAcceptedResult(retained, bad), undefined, label);
    assert.deepEqual(retained, before, 'Rejected merge must not mutate retained input');
    assert.deepEqual(bad, source, 'Rejected merge must not mutate proof');
  });
  for (const seam of ['selected', 'official']) check(`${seam}: atomic rejection ${label}`, () => {
    // The first selected row is valid and would change every destination. A
    // bad second row must stop the complete pass before its first write.
    const rows = [clone(retirement), bad], beforeRows = [seed(retirement), retained];
    prepare(rows, beforeRows, seam);
    const before = bytes();
    for (const file of seam === 'selected' ? [FILES[0]] : FILES.slice(0, 2)) {
      const execution = run(seam, rows, file);
      equalBytes(before, 'Rejected packet must preserve all input/cache/ledger bytes');
      assert.deepEqual(execution.activity, [], 'Rejected packet must attempt ZERO filesystem writes');
      assert.notEqual(execution.status, 0, 'Invalid packet must exit nonzero');
      assert.match(execution.stderr + execution.stdout,
        /invalid|participant|winner|loser|eliminat|timestamp|clock|calendar|conflict|must|score|hour|offset|literal|date|final/i,
        'Reject for a contract reason, not an unrelated CLI failure');
    }
  });
}

try {
  fs.mkdirSync(path.join(root, 'scripts'), {recursive: true});
  for (const file of ['apply-current-card-evidence.js', 'sync-official-card-results.js']) {
    const source = fs.readFileSync(path.join(__dirname, file));
    provenance.files[`scripts/${file}`] = digest(source);
    fs.writeFileSync(path.join(root, 'scripts', file), source);
  }
  // Freeze the shared library once, so a concurrent helper edit cannot change
  // the implementation halfway through this red/green run.
  fs.cpSync(path.join(__dirname, 'lib'), path.join(root, 'scripts/lib'), {recursive: true});
  // The reviewed calendar exception is a source dependency of the real writer,
  // so freeze its captured input alongside the copied implementation.
  const calendarFixture='fixtures/result-calendar-20261016.json';
  fs.mkdirSync(path.join(root,'scripts/fixtures'),{recursive:true});
  fs.copyFileSync(path.join(__dirname,calendarFixture),path.join(root,'scripts',calendarFixture));
  // The exact official result is likewise an immutable writer dependency.
  for(const fixture of ['cricket-ca39991-final-20261023.json','cricket-ca39991-final-receipt-20261023.json','cricket-ca39991-retained-facts-20261023.json'])fs.copyFileSync(path.join(__dirname,'fixtures',fixture),path.join(root,'scripts/fixtures',fixture));
  for(const file of ['lib/accepted-result-calendar.js',calendarFixture])provenance.files['scripts/'+file]=digest(fs.readFileSync(path.join(root,'scripts',file)));
  if (referenceArgument) fs.copyFileSync(helperPath, path.join(root, 'scripts/lib/accepted-result-projection.js'));
  provenance.files['scripts/lib/accepted-result-projection.js'] = digest(
    fs.readFileSync(path.join(root, 'scripts/lib/accepted-result-projection.js')));
  for (const name of ['lib', 'config']) fs.symlinkSync(path.join(ROOT, name), path.join(root, name), 'dir');
  fs.writeFileSync(preloader, String.raw`
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = process.env.CONTINUITY_ROOT, audit = process.env.CONTINUITY_AUDIT;
const auditFd = fs.openSync(audit, 'a'), auditWrite = fs.writeSync.bind(fs);
const realpath = fs.realpathSync.bind(fs);
const log = item => auditWrite(auditFd, JSON.stringify(item) + '\n');
const deny = () => { log({kind: 'deny', operation: 'network-or-child'}); throw Error('Network/children forbidden in continuity regression'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) { const mod = require(name); mod.request = deny; mod.get = deny; }
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) require('node:dns')[name] = deny;
require('node:dgram').createSocket = deny;
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) require('node:child_process')[name] = deny;
function guard(operation, target) {
  if (typeof target === 'number') { log({kind: 'write', operation, target}); return; }
  const resolved = path.resolve(String(target));
  let parent = resolved;
  while (!fs.existsSync(parent)) { const next = path.dirname(parent); if (next === parent) break; parent = next; }
  const physical = path.resolve(realpath(parent), path.relative(parent, resolved));
  if (!(physical === root || physical.startsWith(root + path.sep))) {
    log({kind: 'deny', operation, target: resolved}); throw Error('Write outside disposable root');
  }
  log({kind: 'write', operation, target: resolved});
}
const operations = ['writeFile', 'appendFile', 'rename', 'unlink', 'rm', 'rmdir', 'mkdir',
  'copyFile', 'cp', 'truncate', 'symlink', 'link', 'chmod', 'chown', 'utimes'];
for (const base of operations) for (const suffix of ['', 'Sync']) {
  const name = base + suffix, original = fs[name];
  if (!original) continue;
  fs[name] = function(...args) {
    guard(name, ['copyFile', 'cp', 'symlink', 'link'].includes(base) ? args[1] : args[0]);
    if (base === 'rename') guard(name, args[1]);
    return original.apply(this, args);
  };
}
for (const name of ['open', 'openSync', 'createWriteStream']) {
  const original = fs[name];
  fs[name] = function(...args) {
    const flags = name === 'createWriteStream' ? args[1]?.flags || 'w' : args[1];
    if (typeof flags === 'number' ? (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) !== 0 : /[wa+]/.test(String(flags))) guard(name, args[0]);
    return original.apply(this, args);
  };
}
for (const name of operations) {
  const original = fs.promises[name];
  if (!original) continue;
  fs.promises[name] = function(...args) {
    guard('promises.' + name, ['copyFile', 'cp', 'symlink', 'link'].includes(name) ? args[1] : args[0]);
    if (name === 'rename') guard('promises.rename', args[1]);
    return original.apply(this, args);
  };
}
`);
  console.log(JSON.stringify({provenance}));

  const scalarZero = retag(nbl, row => {
    row.score = 0; row.scoreDisplay = row.result = '0-1'; row.homeScore = 0; row.awayScore = 1;
  });
  const noRoles = retag(nbl, row => {
    delete row.winnerParticipantId; delete row.loserParticipantId; delete row.eliminatedParticipantIds;
  });
  successCase('retirement, literal scalar zero and unknown finish survive persistence',
    [retirement, scalarZero], [seed(retirement), seed(scalarZero)], accepted);
  successCase('missing role and completion clocks are not fabricated', [noRoles], [seed(noRoles)], accepted);

  const retainedCA = completed(ca);
  Object.assign(retainedCA, {
    statusFactObservedAt: '2026-10-14T08:00:00.000Z', statusCheckedAt: '2026-10-15T23:00:00.000Z',
    statusSourceUrl: 'https://www.cricket.com.au/matches/series/CA%3A4568/?retained=status',
    statusSourceName: 'Retained later CA status',
    scoreFactObservedAt: '2026-10-14T07:00:00.000Z', scoreCheckedAt: '2026-10-15T23:00:00.000Z',
    sourceCheckedAt: '2026-10-15T23:00:00.000Z', resultSourceCheckedAt: '2026-10-15T23:00:00.000Z',
    firstConfirmedCompleteAt: '2026-10-13T22:02:10.960136+00:00',
  });
  provenance.expectedCAStatusTuple = Object.fromEntries(STATUS_TUPLE
    .map(key => [key, retainedCA[key]]));
  provenance.expectedCAFirstConfirmedCompleteAt = ca.firstConfirmedCompleteAt;
  const continuity = (actual, before, row) => {
    tuple(actual, before, [...PROTECTED, ...STATUS_TUPLE, ...SCORE_TUPLE, ...SOURCE_TUPLE], 'Retain newer independent tuple');
    assert.equal(actual.firstConfirmedCompleteAt, ca.firstConfirmedCompleteAt,
      'Min first completion must retain exact 11:28 precision, not later 22:02 receipt');
    helper.validateAcceptedProjection(actual, row);
  };
  check('helper: older CA facts still contribute earliest compatible first completion', () => {
    const saved = clone(retainedCA), row = clone(ca);
    continuity(helper.mergeAcceptedResult(saved, row), retainedCA, ca);
    assert.deepEqual(saved, retainedCA); assert.deepEqual(row, ca);
  });
  successCase('CA newer 14 Oct status/score retained and earlier 11:28 first completion merged',
    [ca], [retainedCA], continuity);

  const equalStatus = retag(ca, row => { row.statusFactObservedAt = retainedCA.statusFactObservedAt; });
  const equalRetained = {...clone(retainedCA), firstConfirmedCompleteAt: ca.firstConfirmedCompleteAt};
  check('helper: equal status cannot overwrite newer independent score or source receipts', () => {
    const actual = helper.mergeAcceptedResult(clone(equalRetained), equalStatus);
    tuple(actual, equalRetained, [...SCORE_TUPLE, ...SOURCE_TUPLE], 'Independent score/source clocks');
    helper.validateAcceptedProjection(actual, equalStatus);
  });
  successCase('equal status fact retains 14 Oct score instead of incoming 13 Oct score',
    [equalStatus], [equalRetained], (actual, before, row) => {
      tuple(actual, before, [...PROTECTED, ...SCORE_TUPLE, ...SOURCE_TUPLE], 'Independent score/source clocks');
      assert.equal(actual.statusFactObservedAt, before.statusFactObservedAt);
      assert.equal(actual.firstConfirmedCompleteAt, ca.firstConfirmedCompleteAt);
      helper.validateAcceptedProjection(actual, row);
    });
  const staleLaterPoll = retag(ca, row => {
    for (const key of ['sourceCheckedAt', 'resultSourceCheckedAt', 'scoreCheckedAt', 'statusCheckedAt']) {
      row[key] = '2026-10-15T23:59:59.000Z';
    }
  });
  successCase('later stale poll cannot freshen retained specific score/status/source checks',
    [staleLaterPoll], [retainedCA], continuity);
  const newerScore = retag(ca, row => {
    row.scoreFactObservedAt = '2026-10-15T08:00:00.000Z';
    for (const key of ['sourceCheckedAt', 'resultSourceCheckedAt', 'scoreCheckedAt']) {
      row[key] = '2026-10-15T23:59:59.000Z';
    }
  });
  successCase('newer score fact can advance independently of older incoming status fact',
    [newerScore], [retainedCA], (actual, before, row) => {
      tuple(actual, before, [...PROTECTED, ...STATUS_TUPLE], 'Retained newer status tuple');
      tuple(actual, row, SCORE_TUPLE, 'Independently advanced score tuple');
      assert.equal(actual.firstConfirmedCompleteAt, ca.firstConfirmedCompleteAt);
      helper.validateAcceptedProjection(actual, row);
    });

  // A retained tuple is authoritative as a whole, including missing keys.
  // Start from independent retained fixtures, never from a merge under test.
  // The strict old-capsule projection gate is not a writer acceptance oracle
  // for a different newer final: it must still reject that score mismatch.
  function sparseRetainedCase(label, row, retained, missing, firstComplete, rejectProjection = false,
    expected = retained) {
    const inspect = (actual, before, incoming) => {
      const keys = [...new Set([...PROTECTED, ...STATUS_TUPLE, ...SCORE_TUPLE,
        ...SOURCE_TUPLE, 'homeParticipantId', 'awayParticipantId'])];
      tuple(actual, expected, keys, 'Exact sparse chosen tuple');
      for (const key of keys) assert.equal(Object.hasOwn(actual, key), Object.hasOwn(expected, key),
        `Retained tuple own-property presence: ${key}`);
      for (const key of missing) {
        assert(!Object.hasOwn(before, key), `Sparse fixture must omit ${key}`);
        assert(!Object.hasOwn(actual, key), `Stale incoming must not fill retained ${key}`);
      }
      tuple(actual, expected, SOURCE_CLOCKS.filter(key => key !== 'firstConfirmedCompleteAt'),
        'Literal sparse tuple clocks');
      assert.equal(actual.firstConfirmedCompleteAt, firstComplete, 'Only compatible earlier completion can contribute');
      assert.equal(Object.hasOwn(actual, 'firstConfirmedCompleteAt'), firstComplete !== undefined,
        'Do not fabricate a completion receipt property');
      assert.equal(actual.status, 'completed');
      assert.equal(actual.endTimeUtc, null, 'Sparse retained result has no guessed finish');
      for (const key of ['actualEndTimeUtc', 'completedAt', 'acceptedResultProjection']) {
        assert(!Object.hasOwn(actual, key), `No invented or leaked ${key}`);
      }
      if (rejectProjection) assert.throws(() => helper.validateAcceptedProjection(actual, incoming),
        /Accepted result score drifted/, 'Strict projection must still reject the obsolete accepted score');
    };
    check(`helper: ${label}`, () => {
      helper.validateAcceptedResult(row);
      const before = clone(retained), incoming = clone(row);
      inspect(helper.mergeAcceptedResult(retained, row), before, incoming);
      assert.deepEqual(retained, before, 'Sparse merge must not mutate retained input');
      assert.deepEqual(row, incoming, 'Sparse merge must not mutate incoming proof');
    });
    successCase(label, [row], [retained], inspect);
  }

  const sparseScoreMissing = ['scoreDisplay', 'sets', 'resultLabels', 'outcomeText', 'recapText', 'resultStatus'];
  const sparseCompatible = completed(retirement);
  for (const key of sparseScoreMissing) delete sparseCompatible[key];
  Object.assign(sparseCompatible, {
    scoreFactObservedAt: '2026-10-14T08:00:00.123456+00:00',
    statusFactObservedAt: '2026-10-14T08:01:00.123456+00:00',
    scoreCheckedAt: '2026-10-15T23:50:00.123456+00:00',
    statusCheckedAt: '2026-10-15T23:51:00.123456+00:00',
    sourceCheckedAt: '2026-10-15T23:50:01.123456+00:00',
    resultSourceCheckedAt: '2026-10-15T23:50:02.123456+00:00',
    firstConfirmedCompleteAt: '2026-10-14T07:42:05.123456+00:00',
  });
  sparseRetainedCase('sparse compatible ATP 5-2 keeps missing score fields and genuine earlier completion',
    retirement, sparseCompatible, sparseScoreMissing, retirement.firstConfirmedCompleteAt);

  const sparseChanged = {...clone(sparseCompatible), score: '6\u20132', result: '6\u20132'};
  sparseRetainedCase('sparse newer ATP 6-2 never inherits stale 5-2 display, sets or retirement copy',
    retirement, sparseChanged, sparseScoreMissing, sparseChanged.firstConfirmedCompleteAt, true);

  const sparseStatusMissing = ['statusSourceUrl', 'statusSourceName', 'statusSourceType',
    'resultLabels', 'resultStatus'];
  const sparseStatus = completed(retirement);
  for (const key of sparseStatusMissing) delete sparseStatus[key];
  Object.assign(sparseStatus, {
    statusFactObservedAt: '2026-10-14T08:01:00.123456+00:00',
    statusCheckedAt: '2026-10-15T23:51:00.123456+00:00',
  });
  const freshScore = retag(retirement, row => {
    row.scoreFactObservedAt = '2026-10-14T08:30:00.123456+00:00';
    row.scoreCheckedAt = '2026-10-15T23:52:00.123456+00:00';
    row.sourceCheckedAt = '2026-10-15T23:52:01.123456+00:00';
    row.resultSourceCheckedAt = '2026-10-15T23:52:02.123456+00:00';
  });
  const expectedStatusOnly = clone(sparseStatus);
  for (const key of [...SCORE_TUPLE, ...SOURCE_TUPLE]) {
    if (Object.hasOwn(freshScore, key) && !['resultSourceName', 'resultSourceType'].includes(key)) {
      expectedStatusOnly[key] = clone(freshScore[key]);
    }
  }
  sparseRetainedCase('sparse newer status keeps absent attribution/classification while fresh score advances',
    freshScore, sparseStatus, sparseStatusMissing, retirement.firstConfirmedCompleteAt, false, expectedStatusOnly);

  const scoreOnlyMissing = ['scoreDisplay', 'sets', 'outcomeText', 'recapText'];
  const sparseScoreOnly = {...clone(sparseCompatible), resultStatus: 'published', resultLabels: ['Retirement'],
    statusFactObservedAt: retirement.statusFactObservedAt, statusCheckedAt: retirement.statusCheckedAt};
  const freshStatus = retag(retirement, row => {
    row.statusFactObservedAt = '2026-10-14T08:30:00.123456+00:00';
    row.statusCheckedAt = '2026-10-15T23:52:00.123456+00:00';
    row.resultStatus = 'official';
    row.resultLabels = ['Completed'];
  });
  const expectedScoreOnly = clone(sparseScoreOnly);
  for (const key of STATUS_TUPLE) expectedScoreOnly[key] = clone(freshStatus[key]);
  sparseRetainedCase('sparse newer score preserves absence without discarding fresh incoming status classification',
    freshStatus, sparseScoreOnly, scoreOnlyMissing, retirement.firstConfirmedCompleteAt, false, expectedScoreOnly);

  const sparseNBLMissing = ['scoreDisplay', 'homeScore', 'awayScore', 'homeParticipantId',
    'awayParticipantId', 'resultLabels', 'resultStatus', 'outcomeText', 'recapText'];
  const sparseNBL = completed(nbl);
  for (const key of sparseNBLMissing) delete sparseNBL[key];
  Object.assign(sparseNBL, {
    score: '99-98', result: '99-98', winnerParticipantId: nbl.participantIds[0],
    loserParticipantId: nbl.participantIds[1],
    scoreFactObservedAt: '2026-10-15T23:40:00.123456+00:00',
    statusFactObservedAt: '2026-10-15T23:41:00.123456+00:00',
    scoreCheckedAt: '2026-10-15T23:50:00.123456+00:00',
    statusCheckedAt: '2026-10-15T23:51:00.123456+00:00',
    sourceCheckedAt: '2026-10-15T23:50:01.123456+00:00',
    resultSourceCheckedAt: '2026-10-15T23:50:02.123456+00:00',
  });
  sparseRetainedCase('sparse newer NBL 99-98 home winner never gains stale 101-102 numeric sides or labels',
    nbl, sparseNBL, sparseNBLMissing, undefined, true);

  const calendarBase = tag({...nbl, date: '2024-02-28',
    sourceCheckedAt: '2026-10-15T23:31:08.522Z', resultSourceCheckedAt: '2026-10-15T23:31:08.522Z',
    scoreCheckedAt: '2026-10-15T23:31:08.522Z', statusCheckedAt: '2026-10-15T23:31:08.522Z',
    scoreFactObservedAt: '2024-02-28T00:00:00.000Z', statusFactObservedAt: '2024-02-28T00:00:00.000Z',
    firstConfirmedCompleteAt: '2024-02-28T00:00:00.000Z'});
  for (const key of SOURCE_CLOCKS) {
    for (const [label, value] of [
      ['February 30', '2026-02-30T12:00:00.000Z'],
      ['non-leap February 29', '2025-02-29T12:00:00.000Z'],
      ['rolled local hour 24', '2026-02-28T24:00:00.000Z'],
      ['impossible local hour 25', '2026-02-28T25:00:00.000Z'],
      ['impossible offset hour', '2026-02-28T12:00:00.000+24:00'],
      ['impossible offset minute', '2026-02-28T12:00:00.000+05:60'],
    ]) {
      const bad = retag(calendarBase, row => { row[key] = value; });
      check(`validator: reject rehashed ${key} ${label}`, () => {
        assert.equal(bad.acceptedResultProjection.payloadSha256, helper.hash(helper.payload(bad)));
        assert.throws(() => helper.validateAcceptedResult(bad));
      });
      rejectCase(`rehashed ${key}: ${label}`, bad);
    }
    const leap = retag(calendarBase, row => { row[key] = '2024-02-29T12:00:00.123456+00:00'; });
    successCase(`valid leap date in ${key} remains valid and literal`, [leap], [seed(leap)], accepted);
  }

  for (const [label, mutate] of [
    ['winner outside proof participants', row => { row.winnerParticipantId = 'team:nbl:unrelated'; }],
    ['loser outside proof participants', row => { row.loserParticipantId = 'team:nbl:unrelated'; }],
    ['eliminated outside proof participants', row => { row.eliminatedParticipantIds = ['team:nbl:unrelated']; }],
    ['winner equals loser', row => { row.loserParticipantId = row.winnerParticipantId; }],
    ['winner also eliminated', row => { row.eliminatedParticipantIds = [row.winnerParticipantId]; }],
    ['numeric NBL winner contradicts observed pair', row => {
      [row.winnerParticipantId, row.loserParticipantId] = [row.loserParticipantId, row.winnerParticipantId];
    }],
  ]) {
    const bad = retag(nbl, mutate);
    check(`validator: reject rehashed ${label}`, () => assert.throws(() => helper.validateAcceptedResult(bad)));
    rejectCase(label, bad);
  }

  // Existing equal/newer conflicting-final policy is an independent guard:
  // valid participant membership does not make a contradictory winner valid.
  for (const [label, stamp] of [['equal', ca.statusFactObservedAt], ['newer', '2026-10-14T08:00:00.000Z']]) {
    for (const kind of ['score', 'winner']) {
      const conflict = retag(ca, row => {
        row.statusFactObservedAt = row.scoreFactObservedAt = stamp;
        if (kind === 'score') row.score = row.scoreDisplay = row.result = 'Constructed conflicting final';
        else [row.winnerParticipantId, row.loserParticipantId] = [row.loserParticipantId, row.winnerParticipantId];
      });
      rejectCase(`${label}-fact conflicting ${kind} final`, conflict, completed(ca));
    }
  }
  const staleConflict = retag(ca, row => {
    row.score = row.scoreDisplay = row.result = 'Constructed stale conflicting final';
    row.statusFactObservedAt = row.scoreFactObservedAt = '2026-10-13T20:00:00.000Z';
    row.firstConfirmedCompleteAt = '2026-10-13T22:02:10.960136+00:00';
  });
  successCase('stale conflicting final cannot replace newer retained final',
    [staleConflict], [completed(ca)], (actual, before) => {
      tuple(actual, before, [...PROTECTED, ...STATUS_TUPLE, ...SCORE_TUPLE, ...SOURCE_TUPLE,
        'firstConfirmedCompleteAt'], 'Stale final continuity');
    });
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}

const failures = results.filter(result => !result.passed);
const report = {provenance, passed: results.length - failures.length, failed: failures.length,
  total: results.length, results};
const reportPath = process.argv.find(arg => arg.startsWith('--report='))?.slice(9);
if (reportPath) fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
console.log(`Accepted-result continuity: ${report.passed}/${report.total} passed; ${report.failed} failed.`);
console.log(provenance.scope);
process.exitCode = failures.length ? 1 : 0;
