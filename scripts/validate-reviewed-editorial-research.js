'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const frozen = require('./fixtures/qatar-editorial-retained-20261031.json');
const files = ['data/editorial-knowledge.v1.json', 'feeds/incoming/events.json', 'data/events.json'];
const editorial = new Set(['selectedSentence', 'fullSpiel', 'editorialNarrative', 'editorialPreview', 'lastReviewedAt', 'storyline']);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const facts = event => Object.fromEntries(Object.entries(event).filter(([key]) => !editorial.has(key)));
const clone = value => structuredClone(value);
const args = ['--reviewed-fixtures', '--editorial-projections', '--local-only', '--ids=evt_43', '--reviewed-editorial=review.json'];
assert.doesNotThrow(() => require('./update-cards').parseOptions(args, {}), 'The actual canonical parser must admit the exact local-only reviewed research route.');
const {applyScopedResearch} = require('./lib/reviewed-editorial-research');
const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ns-reviewed-editorial-')));
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
const write = (relative, value) => {
  const file = path.join(sandbox, relative);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const read = file => JSON.parse(fs.readFileSync(path.join(sandbox, file), 'utf8'));
const bytes = () => files.map(file => fs.readFileSync(path.join(sandbox, file)));
const emptyKnowledge = {schemaVersion:'editorial-knowledge.v2', updatedAt:frozen.reviewedAt, subjects:[], sources:[], narrativeFacts:[], narrativeThreads:[], audienceMemories:[], eventProjections:[]};
const control = {...clone(frozen.retainedInputs['data/events.json'].events[0]), id:'control:unrelated', eventId:'control:unrelated', canonicalEventId:'control:unrelated', sourceEventIds:[], selectedSentence:'Keep unrelated approved copy exactly.', fullSpiel:'Retained unrelated writing must not be regenerated.'};
function prepare(change){
  const document = clone(frozen);
  // Exercise mechanical admission with controlled inputs; the frozen Qatar
  // draft itself is not publication-approved while source review is pending.
  document.reviewStatus='approved';
  write(files[0], emptyKnowledge);
  for (const [file, input] of Object.entries(document.retainedInputs)) write(file, input);
  for (const file of files.slice(1)) {
    const input = read(file); input.events.push(clone(control)); write(file, input);
  }
  if (change) change(document);
  write('review.json', document);
  return document;
}
function reject(change, pattern, ids=['evt_43']){
  prepare(change);
  const before = bytes();
  assert.throws(() => applyScopedResearch(ids, path.join(sandbox, 'review.json'), sandbox), pattern);
  assert.deepEqual(bytes(), before, 'Rejected research cannot partially change either Feed or knowledge.');
  checks++;
}
try {
  prepare();
  const before = files.slice(1).map(read);
  const outcome = applyScopedResearch(['evt_43'], path.join(sandbox, 'review.json'), sandbox);
  check(outcome.sourceRequests === 0 && outcome.changed === 1, 'Exactly one canonical fixture is staged without source requests.');
  for (const [index, file] of files.slice(1).entries()) {
    const output = read(file);
    assert.deepEqual(output.events[1], before[index].events[1], 'Every nonselected record is unchanged.');
    assert.deepEqual(facts(output.events[0]), facts(before[index].events[0]), 'Every fixture/result/source field and observation clock is preserved.');
    check(output.events[0].editorialNarrative.hook === frozen.entries[0].hook, 'Reviewed copy reaches both actual selected surfaces.');
  }
  const knowledge = read(files[0]);
  assert.deepEqual(knowledge.sources.map(source => source.checkedAt), frozen.sourceBindings.map(source => source.checkedAt), 'Copy assembly cannot renew retained source observations.');
  check(knowledge.narrativeFacts.slice(0,3).every(fact => fact.observedAt.startsWith('2026-10-11')), 'Dated factual observations remain dated.');
  check(knowledge.narrativeFacts[3].observedAt===frozen.sourceBindings.at(-1).checkedAt, 'The newly checked historical classification has its separate actual observation clock.');
  const once = bytes();
  check(applyScopedResearch(['evt_43'], path.join(sandbox, 'review.json'), sandbox).changed === 0, 'An unchanged review does not create a new publication.');
  assert.deepEqual(bytes(), once, 'Unchanged retry preserves exact bytes.');
  reject(doc => { doc.reviewStatus='draft'; }, /approved reviewed/i);
  reject(doc => { doc.targets[0].canonicalEventId = 'event:f1:2026:other:race'; }, /identity|binding/i);
  reject(doc => { doc.targets[0].fixtureHashes['data/events.json'] = '0'.repeat(64); }, /fixture.*binding/i);
  reject(doc => { doc.sourceBindings[0].sha256 = '0'.repeat(64); }, /source.*binding/i);
  reject(doc => { doc.sourceBindings.at(-1).sha256 = '0'.repeat(64); }, /source.*binding/i);
  reject(doc => { doc.sourceBindings[0].path = '../private.json'; }, /source.*path/i);
  reject(doc => { doc.sourceBindings[0].url = 'https://example.test/unbound'; }, /source.*binding/i);
  reject(doc => { const file='data/canonical/f1-context-2026.json'; const context=read(file); context.ladderSnapshots[0].source.sourceType='broadcaster'; write(file,context); doc.sourceBindings[0].sha256=hash(context.ladderSnapshots[0]); }, /source classification/i);
  reject(doc => { doc.entries[0].sourceObservations[0].checkedAt = frozen.reviewedAt; }, /observation|binding/i);
  reject(doc => { doc.entries.push(clone(doc.entries[0])); }, /distinct|exact|duplicate/i);
  reject(doc => { doc.entries[0].id = 'unbound:entry'; }, /entry|identity/i);
  reject(doc => { doc.entries[0].facts.pop(); }, /at least|facts|depth/i);
  reject(() => { const input = read('data/events.json'); input.events.push(clone(input.events[0])); write('data/events.json', input); }, /ambiguous/i);
  reject(() => { const input = read('data/events.json'); input.events[0].status='completed'; input.events[0].outcomeText='A newer confirmed result'; write('data/events.json', input); }, /fixture.*binding/i);
  reject(() => { const input=read('data/events.json'); input.events[0].editorialNarrative={projectionId:'retained:newer',hook:'Keep newly retained owner writing.',synopsis:'This retained writing is not owned by the new missing-projection review.'}; write('data/events.json',input); }, /retained writing/i);
  reject(doc => { doc.targets[0].id='evt_84'; doc.targets[0].canonicalEventId='major-match:nrl-finals-2026:grand-final'; doc.entries[0].id='evt_84'; for(const file of files.slice(1)){ const input=read(file); Object.assign(input.events[0], {id:'evt_84',eventId:'evt_84',canonicalEventId:'major-match:nrl-finals-2026:grand-final'});write(file,input); } }, /protected/i, ['evt_84']);
  for (const invalid of [args.filter(arg=>arg!=='--local-only'), [...args,'--quick'], [...args,args[4]], args.filter(arg=>arg!=='--editorial-projections'), ['--reviewed-editorial=review.json']]) {
    assert.throws(() => require('./update-cards').parseOptions(invalid, {}), /reviewed|editorial/i);checks++;
  }
  prepare();
  const beforeFailure = bytes();
  const rename = fs.renameSync;
  let failed = false;
  fs.renameSync = (from, to) => {
    if (!failed && to===path.join(sandbox,'data/events.json') && from.includes('.editorial-reviewed-') && from.endsWith('.tmp')) { failed=true; throw Error('controlled selected-output rename failure'); }
    return rename(from, to);
  };
  try { assert.throws(() => applyScopedResearch(['evt_43'], path.join(sandbox,'review.json'),sandbox), /rename failure/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(bytes(), beforeFailure, 'A late output failure restores all three original files byte-for-byte.');checks++;
  prepare();
  let firstFailure = false;
  fs.renameSync = (from, to) => {
    if (from.endsWith('.tmp') && to===path.join(sandbox,'data/events.json')) { firstFailure=true; throw Error('controlled commit failure'); }
    if (firstFailure && from.endsWith('.bak') && to===path.join(sandbox, files[0])) throw Error('controlled rollback failure');
    return rename(from,to);
  };
  const remove=fs.rmSync;
  fs.rmSync=(file,options)=>{if(firstFailure&&String(file).includes('.editorial-reviewed-')&&String(file).endsWith('.tmp'))throw Error('controlled cleanup failure');return remove(file,options);};
  try { assert.throws(() => applyScopedResearch(['evt_43'],path.join(sandbox,'review.json'),sandbox), error => error.rollbackFailures?.length > 0 && error.cleanupFailures?.length > 0 && /rollback incomplete/.test(error.message) && /controlled commit failure/.test(error.message) && error.recoveryFiles?.some(file => fs.existsSync(file)));checks++; }
  finally { fs.renameSync=rename;fs.rmSync=remove; }
  prepare();
  fs.rmSync=(file,options)=>{if(String(file).includes('.editorial-reviewed-')&&String(file).endsWith('.bak'))throw Error('controlled committed-backup cleanup failure');return remove(file,options);};
  try {assert.throws(()=>applyScopedResearch(['evt_43'],path.join(sandbox,'review.json'),sandbox),error=>error.committed===true && error.cleanupFailures?.length>0 && error.recoveryFiles.some(file=>fs.existsSync(file)));checks++;}
  finally {fs.rmSync=remove;}
  prepare();
  const preload=path.join(sandbox,'guard.cjs');
  fs.writeFileSync(preload, `global.fetch=()=>{throw Error('Network forbidden')};for(const name of ['node:http','node:https']){const api=require(name);api.request=api.get=()=>{throw Error('Network forbidden')}};require(${JSON.stringify(path.join(ROOT,'scripts/lib/refresh-child'))}).run=()=>{throw Error('No child builder/provider allowed in reviewed-source staging')};`);
  const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^FOLLOW_SNAPSHOT|^NS_.*(?:SNAPSHOT|CHECK_REPORT)|^REFRESH_REPORT$|TOKEN|SECRET|SERVICE_ROLE|^FOOTBALL_DATA_RUN_DIR$|^GOLF_SOURCE_/.test(key)));
  const child=spawnSync(process.execPath,['--require',preload,path.join(ROOT,'scripts/update-cards.js'),...args],{cwd:sandbox,env:environment,encoding:'utf8',timeout:30000});
  assert.equal(child.status,0,child.stderr);
  check(/reviewed-editorial-research/.test(child.stdout), 'The actual canonical CLI dispatches source staging and no provider/build/release child.');
  check(read('data/events.json').events[0].editorialNarrative.hook===frozen.entries[0].hook, 'The real canonical caller writes the selected projection.');
  console.log(`Reviewed editorial research: ${checks} controls passed; exact identity/source binding, no network, actual canonical caller, facts/clocks, rollback and protected original.`);
} finally { fs.rmSync(sandbox,{recursive:true,force:true}); }
