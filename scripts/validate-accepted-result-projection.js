#!/usr/bin/env node
'use strict';

// Local contract regression only. CLI runs use an isolated temporary root.
// Optionally require compiled evidence with --evidence=/absolute/file.json.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const api = require('./lib/accepted-result-projection');
const {mergeRecord} = require('./apply-current-card-evidence');
const {applyOfficialResults} = require('./sync-official-card-results');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'accepted-result-projection.v1';
const clone = value => structuredClone(value);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const same = (a, b, message) => assert.deepEqual(a, b, message);
const aliases = row => [...new Set([row.id, row.eventId, row.canonicalId,
  row.canonicalEventId, ...(row.sourceEventIds || [])].filter(Boolean))];
const expectedIds = [
  'fixture-cricket-espn-1525659', 'fixture:mlb:849813',
  'fixture-tennis-espn-wta-185349', 'fixture-tennis-espn-wta-185352',
  'fixture-tennis-espn-wta-185355', 'fixture-tennis-espn-wta-185358',
  'fixture:tennis:espn:wta:185354',
  'evt_nbl_2026_27_3706e834_58ad_11f1_8519_a362560fc147',
  'fixture:tennis:espn:wta:185357', 'fixture-tennis-espn-wta-185347',
  'fixture:mlb:849811',
  'evt_nbl_2026_27_36fd506c_58ad_11f1_a57f_6d6fb61b331b',
  'fixture-tennis-espn-atp-184953', 'fixture-tennis-espn-atp-184948',
  'fixture-tennis-espn-atp-184949',
];
const protectedKeys = ['id', 'eventId', 'canonicalEventId', 'date', 'time',
  'startTimeUtc', 'participantIds', 'participants', 'venue', 'lastReviewedAt',
  'resultPublishedAt', 'editorialNarrative', 'rawImportMetadata', 'stakesScore'];
const physicalClocks = ['endTimeUtc', 'actualEndTimeUtc', 'completedAt'];

for (const name of ['isAcceptedResult', 'validateAcceptedResult',
  'mergeAcceptedResult', 'validateAcceptedProjection', 'payload']) {
  assert.equal(typeof api[name], 'function', `Missing projection API: ${name}`);
}
const fields = api.fields || api.FIELDS;
assert(Array.isArray(fields) && fields.length, 'Export the payload fields list');
assert(fields.every(field => typeof field === 'string'));
assert.equal(new Set(fields).size, fields.length, 'Payload fields are unique');

function tag(raw) {
  const row = clone(raw);
  delete row.acceptedResultProjection;
  // This is the original constructed evidence, not a later exported payload.
  const sourceSha256 = hash(JSON.stringify(row));
  row.acceptedResultProjection = {
    schemaVersion: SCHEMA, aliases: aliases(row),
    participantIds: clone(row.participantIds), fixtureDate: row.date,
    sourceSha256, payloadSha256: hash(JSON.stringify(api.payload(row))),
  };
  return row;
}

function seed(row) {
  const canonical = row.canonicalId || row.canonicalEventId || row.id;
  const participantIds = row.participantIds || row.acceptedResultProjection.participantIds;
  return {
    id: row.id, eventId: row.id, canonicalEventId: canonical,
    sourceEventIds: aliases(row), name: row.name || 'Constructed fixture',
    key: row.key || (/nbl/.test(canonical) ? 'nbl' : /cricket/.test(canonical)
      ? 'cricket' : /mlb/.test(canonical) ? 'mlb' : 'tennis'),
    date: row.date || row.acceptedResultProjection.fixtureDate,
    time: null, startTimeUtc: null, status: 'scheduled', cardKind: 'fixture', liveWindow: 3,
    participantIds: clone(participantIds),
    participants: participantIds.map(id => ({id, name: id})),
    venue: 'Retained fixture venue', stakesScore: 0,
    sourceUrl: row.sourceUrl, sourceName: 'Retained schedule attribution',
    sourceType: row.sourceType, sourceCheckedAt: '2026-10-01T00:00:00.000Z',
    lastReviewedAt: '2026-10-02T00:00:00.000Z', resultPublishedAt: null,
    editorialNarrative: {researchedAt: '2026-10-02T00:00:00.000Z', sourceIds: ['retained-review']},
    selectedSentence: 'Retained results-OFF writing.', fullSpiel: 'Retained results-OFF synopsis.',
    storyline: {arcStage: 'preview', hookSpoilerOff: 'Retained OFF hook.',
      synopsisSpoilerOff: 'Retained OFF synopsis.', lastReviewedAt: '2026-10-02T00:00:00.000Z'},
    rawImportMetadata: {fixture: row.id, sequence: 0, retained: true},
  };
}

function protectedMetadata(before, after) {
  for (const key of protectedKeys) same(after[key], before[key], `${before.id}: retain ${key}`);
}

function projected(before, row, after) {
  api.validateAcceptedProjection(after, row);
  protectedMetadata(before, after);
  assert.equal(after.status, 'completed');
  assert.equal(after.resultStatus, row.resultStatus);
  assert.equal(after.sourceTrust, row.sourceType === 'official' ? 'verified' : 'unverified',
    'Accepted reputable/trusted-reporting is not blanket official verification');
  for (const key of ['selectedSentence', 'fullSpiel']) same(after[key], before[key], `Retain OFF ${key}`);
  if (before.storyline) {
    for (const key of ['hookSpoilerOff', 'synopsisSpoilerOff', 'lastReviewedAt']) {
      same(after.storyline[key], before.storyline[key], `Retain storyline ${key}`);
    }
    assert.equal(after.storyline.hookSpoilerOn, row.outcomeText);
    assert.equal(after.storyline.synopsisSpoilerOn, row.recapText);
    assert(!Object.hasOwn(after.storyline, 'on'), 'No invented nested ON representation');
  }
  assert.equal(after.endTimeUtc, null, `${row.id}: unknown physical finish is explicit null`);
  for (const key of physicalClocks.slice(1)) {
    assert(after[key] == null, `${row.id}: never infer ${key}`);
  }
  for (const key of ['score', 'scoreDisplay', 'homeScore', 'awayScore', 'sets',
    'resultLabels', 'winnerParticipantId', 'scoreFactObservedAt', 'statusFactObservedAt',
    'scoreCheckedAt', 'statusCheckedAt', 'resultSourceCheckedAt', 'firstConfirmedCompleteAt',
    'sourceUrl', 'sourceName', 'sourceType', 'sourceCheckedAt']) {
    if (Object.hasOwn(row, key)) same(after[key], row[key], `${row.id}: exact ${key}`);
  }
  if (!row.firstConfirmedCompleteAt) assert(!after.firstConfirmedCompleteAt,
    `${row.id}: no fabricated first-completion clock`);
  if (Object.hasOwn(row, 'homeScore') && Object.hasOwn(row, 'awayScore')) {
    assert.equal(after.homeParticipantId, row.acceptedResultProjection.participantIds[0]);
    assert.equal(after.awayParticipantId, row.acceptedResultProjection.participantIds[1]);
  }
}

function checkRow(row) {
  const original = JSON.stringify(row), before = seed(row), saved = clone(before);
  assert.equal(api.isAcceptedResult(row), true);
  api.validateAcceptedResult(row);
  assert.equal(row.acceptedResultProjection.payloadSha256, hash(JSON.stringify(api.payload(row))),
    `${row.id}: exact exported-payload hash`);
  assert.equal(api.hash(api.payload(row)), row.acceptedResultProjection.payloadSha256);
  assert(/^[a-f0-9]{64}$/i.test(row.acceptedResultProjection.sourceSha256));
  const merged = api.mergeAcceptedResult(before, row);
  projected(saved, row, merged);
  same(api.mergeAcceptedResult(merged, row), merged, `${row.id}: pure replay is unchanged`);
  const selected = mergeRecord(clone(saved), clone(row), '2026-10-16T00:00:00.000Z');
  projected(saved, row, selected);
  const official = applyOfficialResults([clone(saved)], {
    checkedAt: '2026-10-16T00:00:00.000Z', results: [clone(row)],
  }).events[0];
  projected(saved, row, official);
  same(before, saved, 'Pure merge must not mutate the retained record');
  assert.equal(JSON.stringify(row), original, 'Validation/dispatch must not mutate source proof');
  return merged;
}

const ruud = 'competitor:tennis:atp:casper-ruud';
const felix = 'competitor:tennis:atp:felix-auger-aliassime';
const retirement = tag({
  id: 'fixture-tennis-espn-atp-184948', canonicalId: 'fixture:tennis:espn:atp:184948',
  canonicalEventId: 'fixture:tennis:espn:atp:184948',
  sourceEventIds: ['fixture-tennis-espn-atp-184948', 'fixture:tennis:espn:atp:184948'],
  name: 'Casper Ruud v Felix Auger Aliassime', key: 'tennis', date: '2026-10-14',
  participantIds: [ruud, felix], homeParticipantId: ruud, awayParticipantId: felix,
  status: 'completed', resultStatus: 'published', resultLabels: ['Retirement'],
  score: '5\u20132', scoreDisplay: '5\u20132', result: '5\u20132', sets: [{home: 5, away: 2}],
  winnerParticipantId: ruud, loserParticipantId: felix, eliminatedParticipantIds: [felix],
  outcomeText: 'Casper Ruud won. 5\u20132', recapText: 'ESPN reports a retirement at 5\u20132.',
  sourceName: 'ESPN', sourceType: 'reputable',
  sourceUrl: 'https://www.espn.com/tennis/matchstats?gameId=184948',
  resultSourceUrl: 'https://www.espn.com/tennis/matchstats?gameId=184948',
  resultSourceName: 'ESPN', resultSourceType: 'reputable',
  sourceCheckedAt: '2026-10-15T11:32:02.000Z',
  resultSourceCheckedAt: '2026-10-15T11:32:02.000Z',
  scoreCheckedAt: '2026-10-15T23:12:01+00:00', statusCheckedAt: '2026-10-15T23:12:01+00:00',
  scoreFactObservedAt: '2026-10-14T07:38:12+00:00',
  statusFactObservedAt: '2026-10-14T07:42:03+00:00',
  firstConfirmedCompleteAt: '2026-10-14T07:42:04.44723+00:00',
  fixtureObservationSchema: 'fixture-observations.v1',
});
const cricket = tag({
  ...api.payload(retirement), id: 'fixture-cricket-espn-1525659',
  canonicalId: 'fixture:cricket:espn:1525659', canonicalEventId: 'fixture:cricket:espn:1525659',
  sourceEventIds: ['fixture-cricket-espn-1525659', 'fixture:cricket:espn:1525659', 'evt_87'],
  name: 'South Africa v Australia', key: 'cricket', date: '2026-10-09',
  participantIds: ['team:cricket:south-africa', 'team:cricket:australia'],
  homeParticipantId: 'team:cricket:south-africa', awayParticipantId: 'team:cricket:australia',
  status: 'completed', resultStatus: 'published', resultLabels: ['Completed'],
  score: 'Australia won by 214 runs', scoreDisplay: 'Australia won by 214 runs',
  result: 'Australia won by 214 runs', sets: [],
  winnerParticipantId: 'team:cricket:australia', loserParticipantId: 'team:cricket:south-africa',
  eliminatedParticipantIds: [], outcomeText: 'Australia won by 214 runs',
  recapText: 'Cricket Australia reports Australia won by 214 runs.',
  sourceName: 'Cricket Australia', sourceType: 'trusted-reporting',
  sourceUrl: 'https://www.cricket.com.au/matches/series/CA%3A4568/',
  resultSourceUrl: 'https://www.cricket.com.au/matches/series/CA%3A4568/',
  resultSourceName: 'Cricket Australia', resultSourceType: 'trusted-reporting',
  sourceCheckedAt: '2026-10-15T16:28:01.041Z', resultSourceCheckedAt: '2026-10-15T16:28:01.041Z',
  scoreCheckedAt: '2026-10-15T22:30:00.464+00:00', statusCheckedAt: '2026-10-15T22:30:00.464+00:00',
  scoreFactObservedAt: '2026-10-13T22:02:01.52+00:00',
  statusFactObservedAt: '2026-10-13T22:02:01.52+00:00',
  firstConfirmedCompleteAt: '2026-10-13T11:28:12.334719+00:00',
});
const nblRaw = {
  id: 'evt_nbl_2026_27_3706e834_58ad_11f1_8519_a362560fc147',
  canonicalId: 'event:nbl:2026-27:3706e834-58ad-11f1-8519-a362560fc147',
  canonicalEventId: 'event:nbl:2026-27:3706e834-58ad-11f1-8519-a362560fc147',
  name: 'Sydney Kings v New Zealand Breakers', key: 'nbl', date: '2026-10-14',
  participantIds: ['team:nbl:sydney-kings', 'team:nbl:new-zealand-breakers'],
  homeParticipantId: 'team:nbl:sydney-kings', awayParticipantId: 'team:nbl:new-zealand-breakers',
  status: 'completed', resultStatus: 'official', score: '101-102', scoreDisplay: '101-102',
  homeScore: 101, awayScore: 102, winnerParticipantId: 'team:nbl:new-zealand-breakers',
  outcomeText: 'Sydney Kings 101, New Zealand Breakers 102', recapText: 'Official NBL result.',
  sourceName: 'NBL official schedule', sourceType: 'official',
  sourceUrl: 'https://schedule.nbl.com.au/nbl', resultSourceUrl: 'https://schedule.nbl.com.au/nbl',
  resultSourceName: 'NBL official schedule', resultSourceType: 'official',
  sourceCheckedAt: '2026-10-15T23:31:08.522Z', resultSourceCheckedAt: '2026-10-15T23:31:08.522Z',
  scoreCheckedAt: '2026-10-15T23:31:08.522Z', statusCheckedAt: '2026-10-15T23:31:08.522Z',
  fixtureObservationSchema: 'fixture-observations.v1',
};
const nbl = tag(nblRaw);
const zero = tag({...nblRaw, id: 'fixture:mlb:849813', canonicalId: 'fixture:mlb:849813',
  canonicalEventId: 'fixture:mlb:849813', key: 'mlb', name: 'Constructed zero-score fixture',
  participantIds: ['team:mlb:139', 'team:mlb:114'], homeParticipantId: 'team:mlb:139',
  awayParticipantId: 'team:mlb:114', homeScore: 0, awayScore: 1, score: '0-1', scoreDisplay: '0-1',
  winnerParticipantId: 'team:mlb:114', outcomeText: 'Constructed zero-score result: 0-1',
  recapText: 'Constructed regression evidence, not a published sporting claim.',
  sourceName: 'MLB', resultSourceName: 'MLB', sourceUrl: 'https://www.mlb.com/gameday/849813',
  resultSourceUrl: 'https://www.mlb.com/gameday/849813'});

for (const row of [retirement, cricket, nbl, zero]) checkRow(row);
assert.equal(checkRow(zero).homeScore, 0, 'Zero is an observed score, not missing data');
const scalarZero = tag({...zero, score: 0});
assert.equal(checkRow(scalarZero).score, 0, 'A literal zero payload score is valid');
assert.equal(scalarZero.acceptedResultProjection.aliases.length, 1,
  'Identical canonical/retained spelling needs only one exact alias');
for (const side of ['homeParticipantId', 'awayParticipantId']) {
  const wrong = seed(nbl); wrong[side] = 'team:nbl:unrelated';
  for (const merge of [record => api.mergeAcceptedResult(record, nbl),
    record => mergeRecord(record, nbl, nbl.sourceCheckedAt),
    record => applyOfficialResults([record], {results: [nbl]}).events[0]]) {
    assert.throws(() => merge(clone(wrong)), `Reject conflicting existing numeric ${side}`);
  }
}
const withoutStatus = clone(zero); delete withoutStatus.resultStatus;
const noStatus = tag(withoutStatus), pending = {...seed(noStatus), resultStatus: 'pending',
  resultAvailabilityEvidence: {reason: 'retained pending receipt'}};
const cleared = api.mergeAcceptedResult(pending, noStatus);
assert(!Object.hasOwn(cleared, 'resultStatus'), 'Missing accepted status must not invent official/published');
assert(!Object.hasOwn(cleared, 'resultAvailabilityEvidence'), 'Clear pending availability evidence');
assert.equal(api.mergeAcceptedResult({...seed(noStatus), resultStatus: 'published'}, noStatus).resultStatus,
  'published', 'An absent accepted status preserves a non-pending existing status');

const {validateFeed} = require('./lib/feed-utils');
const typedCA = {schemaVersion: 'events.v1', version: 'accepted-result-projection-regression',
  publishedAt: '2026-10-16T00:00:00.000Z', events: [{id: cricket.id, eventId: cricket.id,
    cardKind: 'fixture', key: 'cricket', name: 'Typed CA regression fixture', date: '2026-10-09',
    time: null, timePrecision: 'unresolved', expected: null, liveWindow: 3,
    sourceUrl: cricket.sourceUrl, sourceName: cricket.sourceName, sourceCheckedAt: cricket.sourceCheckedAt,
    sourceType: 'trusted-reporting', sourceTrust: 'unverified', status: 'completed'}]};
same(validateFeed(typedCA), [], 'Typed CA trusted-reporting passes the real feed schema');
assert(validateFeed({...typedCA, events: [{...typedCA.events[0], sourceType: 'unknown-regression-source'}]})
  .some(issue => issue.includes('.sourceType')), 'Feed schema still rejects arbitrary source classes');
const untagged = clone(retirement);
delete untagged.acceptedResultProjection;
assert.equal(api.isAcceptedResult(untagged), false);
assert.throws(() => api.validateAcceptedResult(untagged));

for (const [label, mutate] of [
  ['schema', row => { row.acceptedResultProjection.schemaVersion = 'accepted-result-projection.v0'; }],
  ['original source hash', row => { row.acceptedResultProjection.sourceSha256 = 'not-a-sha256'; }],
  ['payload hash', row => { row.acceptedResultProjection.payloadSha256 = '0'.repeat(64); }],
  ['unsigned payload mutation', row => { row.score = '6-0'; }],
  ['proof identity', row => { row.acceptedResultProjection.aliases = ['fixture:unrelated']; }],
]) {
  const bad = clone(retirement); mutate(bad);
  assert.throws(() => api.validateAcceptedResult(bad), undefined, label);
  assert.throws(() => api.mergeAcceptedResult(seed(retirement), bad), undefined, label);
}
for (const mutate of [row => { row.acceptedResultProjection.fixtureDate = '2026-10-15'; },
  row => { row.acceptedResultProjection.participantIds.reverse(); }]) {
  const bad = clone(retirement); mutate(bad);
  assert.throws(() => api.mergeAcceptedResult(seed(retirement), bad), 'Proof must bind the retained date/ordered participants');
}
for (const [label, change] of [
  ['untrusted class', {sourceType: 'untrusted', resultSourceType: 'untrusted'}],
  ['untrusted host', {sourceUrl: 'https://untrusted.invalid/result', resultSourceUrl: 'https://untrusted.invalid/result'}],
  ['trusted suffix spoof', {sourceUrl: 'https://www.espn.com.untrusted.invalid/result', resultSourceUrl: 'https://www.espn.com.untrusted.invalid/result'}],
  ['non-HTTPS source', {sourceUrl: 'http://www.espn.com/tennis/matchstats?gameId=184948', resultSourceUrl: 'http://www.espn.com/tennis/matchstats?gameId=184948'}],
]) {
  assert.throws(() => api.validateAcceptedResult(tag({...untagged, ...change})), undefined, label);
}

const final = api.mergeAcceptedResult(seed(retirement), retirement);
for (const mutate of [record => { record.date = '2026-10-15'; },
  record => { record.participantIds.reverse(); },
  record => { record.id = record.eventId = record.canonicalEventId = 'fixture:unrelated'; record.sourceEventIds = []; }]) {
  const wrong = seed(retirement); mutate(wrong);
  assert.throws(() => api.mergeAcceptedResult(wrong, retirement), 'Record binding must be exact');
  const wrongProjection = clone(final); mutate(wrongProjection);
  assert.throws(() => api.validateAcceptedProjection(wrongProjection, retirement));
}
const conflicting = {...untagged, score: '5\u20133', scoreDisplay: '5\u20133', result: '5\u20133',
  sets: [{home: 5, away: 3}], outcomeText: 'Constructed conflicting final.', recapText: 'Conflicting final.'};
for (const stamp of [retirement.statusFactObservedAt, '2026-10-14T07:43:00.000Z']) {
  const row = tag({...conflicting,
    scoreFactObservedAt: stamp, statusFactObservedAt: stamp});
  for (const merge of [record => api.mergeAcceptedResult(record, row),
    record => mergeRecord(record, row, stamp),
    record => applyOfficialResults([record], {checkedAt: stamp, results: [row]}).events[0]]) {
    assert.throws(() => merge(clone(final)), 'Same-time/newer conflicting final must fail closed');
  }
}
const stale = tag({...conflicting, sourceCheckedAt: '2026-10-14T07:43:00.000Z',
  resultSourceCheckedAt: '2026-10-14T07:43:00.000Z', scoreCheckedAt: '2026-10-14T07:43:00.000Z',
  statusCheckedAt: '2026-10-14T07:43:00.000Z', scoreFactObservedAt: '2026-10-14T07:38:00.000Z',
  statusFactObservedAt: '2026-10-14T07:42:00.000Z'});
same(api.mergeAcceptedResult(clone(final), stale), final, 'Stale final retains all newer final bytes');
same(mergeRecord(clone(final), stale, '2026-10-16T00:00:00.000Z'), final,
  'Selected dispatch cannot freshen a stale final with its poll clock');
same(applyOfficialResults([clone(final)], {checkedAt: '2026-10-16T00:00:00.000Z', results: [stale]}).events[0],
  final, 'Official dispatch cannot replace a newer final with a stale packet');

// A root field outside the signed payload must never smuggle new physical,
// editorial-review or publication clocks through an otherwise valid packet.
for (const key of [...physicalClocks, 'lastReviewedAt', 'resultPublishedAt']) {
  const bad = clone(retirement); bad[key] = '2026-10-15T23:30:00.000Z';
  let rejected = false;
  try { api.validateAcceptedResult(bad); } catch { rejected = true; }
  if (!rejected) {
    const merged = api.mergeAcceptedResult(seed(retirement), bad);
    same(merged[key], key === 'endTimeUtc' ? null : seed(retirement)[key], `No clock smuggling: ${key}`);
  }
}

const projectionFailures = [];
function checkContract(label, operation) {
  try { operation(); } catch (error) { projectionFailures.push(`${label}: ${error.message}`); }
}
checkContract('Independent retirement projection validation', () => {
  const drift = clone(final);
  drift.statusFactObservedAt = '2026-10-15T23:30:00.000Z';
  drift.resultLabels = ['Completed'];
  assert.throws(() => api.validateAcceptedProjection(drift, retirement),
    'A newer persisted clock cannot make lost Retirement validate against itself');
});
for (const [label, change] of [
  ['missing CA first completion', record => { delete record.firstConfirmedCompleteAt; }],
  ['late CA first completion', record => {
    record.firstConfirmedCompleteAt = '2026-10-13T22:02:10.960136+00:00';
  }],
]) {
  checkContract(label, () => {
    const drift = api.mergeAcceptedResult(seed(cricket), cricket); change(drift);
    assert.throws(() => api.validateAcceptedProjection(drift, cricket),
      'A missing/later persisted receipt cannot replace the accepted earliest CA receipt');
  });
}
checkContract('Earlier compatible completion survives every writer and validates', () => {
  const existing = api.mergeAcceptedResult(seed(cricket), cricket);
  // Controlled pre-existing compatible receipt, not a guessed physical finish.
  existing.firstConfirmedCompleteAt = '2026-10-13T11:28:10.000000+00:00';
  for (const merge of [record => api.mergeAcceptedResult(record, cricket),
    record => mergeRecord(record, cricket, '2026-10-16T00:00:00.000Z'),
    record => applyOfficialResults([record], {results: [cricket]}).events[0]]) {
    const saved = clone(existing), merged = merge(saved);
    assert.equal(merged.firstConfirmedCompleteAt, existing.firstConfirmedCompleteAt,
      'Keep the exact genuinely earlier compatible receipt, including precision');
    api.validateAcceptedProjection(merged, cricket);
    same(saved, existing, 'Earlier-receipt writer must not mutate its input');
  }
});
for (const reversed of [false, true]) {
  checkContract(`Official mixed legacy/accepted alias collision (${reversed ? 'legacy first' : 'accepted first'})`, () => {
    const legacy = {...api.payload(retirement), id: 'legacy-regression-retirement',
      canonicalEventId: retirement.canonicalId};
    const results = reversed ? [legacy, clone(retirement)] : [clone(retirement), legacy];
    const before = seed(retirement), saved = clone(before), source = JSON.stringify(results);
    assert.throws(() => applyOfficialResults([before], {results}),
      'Mixed legacy/accepted aliases must not be resolved by Map insertion order');
    same(before, saved); assert.equal(JSON.stringify(results), source);
  });
}

const evidenceArgument = process.argv.find(arg => arg.startsWith('--evidence='));
const evidenceFile = evidenceArgument ? path.resolve(evidenceArgument.slice('--evidence='.length))
  : path.join(ROOT, 'data/canonical/current-card-evidence-2026.json');
let actualRows = [];
if (evidenceArgument || fs.existsSync(evidenceFile)) {
  const document = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  const rows = Array.isArray(document) ? document : document.resultOverrides || document.results;
  assert(Array.isArray(rows), 'Evidence must contain resultOverrides/results or be a row array');
  actualRows = rows.filter(row => Object.hasOwn(row, 'acceptedResultProjection'));
}
if (evidenceArgument || actualRows.length) {
  assert.equal(actualRows.length, 15, 'The accepted publication packet must contain exactly 15 tagged rows');
  same(actualRows.map(row => row.id).sort(), [...expectedIds].sort(), 'Exact retained 15-ID membership');
  for (const row of actualRows) checkRow(row);
  const find = suffix => actualRows.find(row => aliases(row).some(id => id.endsWith(suffix)));
  // The canonical publisher normalises an accepted result after either writer.
  // A new result source must not replace the unchanged court-order evidence
  // behind an already published structural tag.
  const resultRow = find('184953');
  const scheduleTag = {label:'Knockout',confidence:.9,sourceUrls:['https://www.protennislive.com/posting/2026/5014/op.pdf'],method:'published-schedule.v1'};
  const retainedTagFixture = {...seed(resultRow),roundLabel:'Round of 16',sourceUrl:scheduleTag.sourceUrls[0],consensusTags:[scheduleTag]};
  const identity = require('../config/fixture-identity');
  for (const result of [mergeRecord(clone(retainedTagFixture),resultRow,'2026-10-16T00:00:00Z'),applyOfficialResults([clone(retainedTagFixture)],{results:[resultRow]}).events[0]]) {
    const normalized = identity.normalizeCore(result);
    same(normalized.consensusTags,[scheduleTag],'Canonical normalisation must retain original structural schedule evidence after either result writer');
    same(identity.normalizeCore(normalized).consensusTags,[scheduleTag],'Unchanged publisher reruns cannot renew tag evidence');
    const expired = identity.normalizeCore({...result,consensusTags:[{...scheduleTag,expiresAt:'2026-01-01T00:00:00Z'}]});
    same(expired.consensusTags[0].sourceUrls,[resultRow.sourceUrl],'Expired schedule evidence cannot be retained');
    const changedRound = identity.normalizeCore({...result,roundLabel:'Final'});
    same(changedRound.consensusTags.find(tag=>tag.label==='Final').sourceUrls,[resultRow.sourceUrl],'A changed structural category still needs its current source');
  }
  const atp = find('184948');
  same(atp.resultLabels, ['Retirement']); same(atp.sets, [{home: 5, away: 2}]);
  assert.equal(atp.resultStatus, 'published'); assert.equal(atp.score, '5\u20132');
  assert.equal(find('1525659').firstConfirmedCompleteAt, '2026-10-13T11:28:12.334719+00:00',
    'CA earliest genuine first-completion receipt, not history/poll time');
  for (const row of actualRows.filter(row => row.id.startsWith('evt_nbl_2026_27_'))) {
    assert(!row.firstConfirmedCompleteAt, 'NBL result receipt is not a historical first completion');
  }
}

function persistentCli(rows) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-accepted-result-projection-'));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
  };
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const files = ['feeds/incoming/events.json', 'data/events.json',
    'data/canonical/afl-nrl-2026.json', 'data/canonical/official-card-results-2026.json',
    'data/follow-sources/coverage.v1.json', 'data/major-events.v1.json'];
  try {
    fs.mkdirSync(path.join(root, 'scripts'), {recursive: true});
    for (const file of ['apply-current-card-evidence.js', 'sync-official-card-results.js']) {
      fs.copyFileSync(path.join(__dirname, file), path.join(root, 'scripts', file));
    }
    for (const [target, link] of [[path.join(ROOT, 'lib'), 'lib'],
      [path.join(ROOT, 'config'), 'config'], [path.join(__dirname, 'lib'), 'scripts/lib']]) {
      fs.symlinkSync(target, path.join(root, link), 'dir');
    }
    // Prevent accidental provider calls even if a CLI seam later gains one.
    fs.writeFileSync(path.join(root, 'no-network.cjs'), [
      "const deny=()=>{throw Error('Network forbidden in accepted-result regression');};",
      "globalThis.fetch=deny;",
      "for(const name of ['node:http','node:https']){const m=require(name);m.request=deny;m.get=deny;}",
      "require('node:net').Socket.prototype.connect=deny;",
      "require('node:tls').connect=deny;",
    ].join('\n'));
    const retained = rows.map(seed), unrelated = {id: 'regression-unrelated', status: 'scheduled',
      rawImportMetadata: {retained: true}, score: 0, lastReviewedAt: null};
    for (const file of files.slice(0, 3)) write(file, {version: 'retained-version',
      documentMetadata: {retained: true}, events: [...clone(retained), clone(unrelated)]});
    write(files[4], {events: [...clone(retained), clone(unrelated)]});
    const parentWithoutChildren = {id: 'regression-unrelated-parent', status: 'scheduled'};
    write(files[5], {events: [{id: 'regression-parent', subEvents: clone(retained)},
      clone(parentWithoutChildren)]});
    write('data/canonical/current-card-evidence-2026.json', {
      checkedAt: '2026-10-16T00:00:00.000Z', resultOverrides: rows,
      fixtureOverrides: [], broadcastOverrides: [], timingOverrides: [],
    });
    write(files[3], {checkedAt: '2026-10-16T00:00:00.000Z',
      feedVersion: 'retained-version', results: []});
    const run = (file, args) => execFileSync(process.execPath,
      ['--require', path.join(root, 'no-network.cjs'), path.join(root, 'scripts', file), ...args],
      {cwd: root, env: {...process.env, NODE_OPTIONS: ''}, encoding: 'utf8', stdio: 'pipe', timeout: 20000});
    const selected = () => run('apply-current-card-evidence.js', [`--ids=${rows.map(row => row.id).join(',')}`]);
    const official = file => run('sync-official-card-results.js', [path.join(root, file), path.join(root, file)]);
    const bytes = () => files.map(file => fs.readFileSync(path.join(root, file)));
    const equalBytes = (saved, label) => files.forEach((file, i) =>
      assert(fs.readFileSync(path.join(root, file)).equals(saved[i]), `${label}: ${file}`));
    selected();
    for (const file of files.slice(0, 3)) {
      const doc = read(file);
      same(doc.documentMetadata, {retained: true});
      same(doc.events.find(row => row.id === unrelated.id), unrelated, 'Unrelated fixture is untouched');
      rows.forEach((row, i) => {
        const before = clone(retained[i]);
        if (file === files[2]) delete before.storyline;
        projected(before, row, doc.events.find(record => record.id === row.id));
      });
    }
    for (const row of rows) {
      const saved = read(files[3]).results.find(record => record.id === row.id);
      api.validateAcceptedResult(saved);
      same(saved.acceptedResultProjection, row.acceptedResultProjection, 'Ledger retains original proof/hash');
    }
    const coverage = read(files[4]);
    same(coverage.events.find(row => row.id === unrelated.id), unrelated, 'No unrelated coverage normalization');
    rows.forEach((row, i) => projected(retained[i], row, coverage.events.find(record => record.id === row.id)));
    const major = read(files[5]);
    same(major.events[1], parentWithoutChildren, 'No unrelated parent normalization or empty subEvents insertion');
    rows.forEach((row, i) => projected(retained[i], row,
      major.events[0].subEvents.find(record => record.id === row.id)));
    const first = bytes(); selected(); equalBytes(first, 'Selected CLI exact-byte replay');
    for (const file of files.slice(0, 2)) official(file);
    const synced = bytes();
    for (const file of files.slice(0, 2)) {
      const doc = read(file);
      same(doc.events.find(row => row.id === unrelated.id), unrelated);
      rows.forEach((row, i) => projected(retained[i], row, doc.events.find(record => record.id === row.id)));
      official(file);
    }
    equalBytes(synced, 'Official CLI exact-byte replay');
    selected(); equalBytes(synced, 'Selected/official cross-seam exact-byte replay');
    const evidenceFile = 'data/canonical/current-card-evidence-2026.json';
    const evidence = read(evidenceFile);
    const legacy = {...api.payload(rows[0]), id: 'legacy-regression-selected',
      canonicalId: rows[0].canonicalId || rows[0].canonicalEventId || rows[0].id,
      canonicalEventId: rows[0].canonicalId || rows[0].canonicalEventId || rows[0].id};
    for (const reversed of [false, true]) {
      write(evidenceFile, {...evidence, resultOverrides: reversed
        ? [legacy, ...clone(rows)] : [...clone(rows), legacy]});
      const beforeCollision = bytes();
      checkContract(`Selected current-set mixed alias collision (${rows.length} rows, ${reversed ? 'legacy first' : 'accepted first'})`, () => {
        assert.throws(selected, 'Mixed current-set aliases must fail preflight, not silently pick a row');
        equalBytes(beforeCollision, 'Mixed alias collision must write none of the six files');
      });
      // Continue independent cases even when a broken writer changed temp bytes.
      files.forEach((file, i) => fs.writeFileSync(path.join(root, file), beforeCollision[i]));
    }
    write(evidenceFile, evidence);
    const broken = read(files[5]); broken.events[0].subEvents[0].participantIds.reverse();
    write(files[5], broken);
    const beforeRejected = bytes();
    assert.throws(selected, 'A conflicting selected child must fail preflight');
    equalBytes(beforeRejected, 'Rejected child preflight writes none of the six files');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
}
persistentCli([retirement, cricket, nbl, scalarZero]);
if (actualRows.length) persistentCli(actualRows);
const winnerConflictFailures = [];
for (const stamp of [retirement.statusFactObservedAt, '2026-10-14T07:43:00.000Z']) {
  const row = tag({...untagged, winnerParticipantId: felix, loserParticipantId: ruud,
    eliminatedParticipantIds: [ruud], outcomeText: 'Constructed contradictory retirement winner.',
    recapText: 'Same score text does not make a contradictory winner the same final.',
    scoreFactObservedAt: stamp, statusFactObservedAt: stamp});
  for (const [name, merge] of [
    ['helper', record => api.mergeAcceptedResult(record, row)],
    ['selected', record => mergeRecord(record, row, row.sourceCheckedAt)],
    ['official', record => applyOfficialResults([record], {results: [row]}).events[0]],
  ]) {
    let rejected = false;
    try { merge(clone(final)); } catch { rejected = true; }
    if (!rejected) winnerConflictFailures.push(`${name}: contradictory winner at ${stamp}`);
  }
}
same([...projectionFailures, ...winnerConflictFailures], [],
  'Independent projection validation, completion receipts and alias/final conflicts must fail closed');
console.log('Accepted-result projection: proof/source/binding rejection, retirement, zero, raw metadata, exact clocks, stale/conflicting finals and isolated selected/official CLI byte replay passed.');
console.log(actualRows.length ? 'Actual tagged 15-ID evidence covered.'
  : 'Compiled tagged 15-ID evidence not present; constructed contract cases covered only.');
