'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');
const narrative = require('./editorial-narrative');
const {apply:applyResearch} = require('../apply-fixture-research');
const {applyScopedFeed} = require('../apply-editorial-narratives');
const files = ['data/editorial-knowledge.v1.json', 'feeds/incoming/events.json', 'data/events.json'];
const editorial = new Set(['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline']);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])])) : value;
const facts = event => Object.fromEntries(Object.entries(event).filter(([key]) => !editorial.has(key)));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));

function cleanup(file,error){
  try { fs.rmSync(file,{force:true}); }
  catch (failure) {
    error.cleanupFailures ||= [];
    error.recoveryFiles ||= [];
    error.cleanupFailures.push(failure.message);
    if (!error.recoveryFiles.includes(file)) error.recoveryFiles.push(file);
    error.message += '; cleanup failed; retain '+file+': '+failure.message;
  }
}

// All files are planned before replacement. Keep original bytes in adjacent
// backups until every rename succeeds; a failed rollback retains its recovery
// file and is reported explicitly, never as an ordinary completed rollback.
function commit(plans){
  const staged = [];
  try {
    for (const plan of plans) {
      const stem = plan.file + '.editorial-reviewed-' + crypto.randomUUID();
      const item = {...plan, backup:stem+'.bak', temporary:stem+'.tmp', attempted:false};
      staged.push(item);
      fs.writeFileSync(item.backup,item.before,{flag:'wx',mode:0o600});
      fs.writeFileSync(item.temporary,JSON.stringify(item.document,null,2)+'\n',{flag:'wx',mode:0o600});
    }
    for (const item of staged) { item.attempted=true; fs.renameSync(item.temporary,item.file); }
  } catch (error) {
    error.rollbackFailures=[];
    error.recoveryFiles=[];
    for (const item of [...staged].reverse()) if (item.attempted) {
      try { fs.renameSync(item.backup,item.file); }
      catch (failure) { error.rollbackFailures.push(failure.message); error.recoveryFiles.push(item.backup); }
    }
    if (error.rollbackFailures.length) error.message += '; rollback incomplete; retain recovery files: '+error.recoveryFiles.join(', ');
    for (const item of staged) {
      cleanup(item.temporary,error);
      if (!error.recoveryFiles.includes(item.backup)) cleanup(item.backup,error);
    }
    throw error;
  }
  const cleanupError=Object.assign(new Error('Reviewed outputs committed; backup cleanup incomplete.'),{committed:true,recoveryFiles:[]});
  for (const item of staged) cleanup(item.backup,cleanupError);
  if (cleanupError.cleanupFailures?.length) throw cleanupError;
}

function applyScopedResearch(ids, input, root=process.cwd()){
  assert(Array.isArray(ids) && ids.length && ids.length<=60 && new Set(ids).size===ids.length && ids.every(id=>typeof id==='string' && /^[A-Za-z0-9_:./-]+$/.test(id)), 'Provide distinct exact reviewed fixture IDs.');
  root=fs.realpathSync(root);
  const research=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
  assert(research.schemaVersion==='sportscal.reviewed-editorial-research.v1' && research.evidenceMode==='retained-dated' && research.reviewStatus==='approved' && iso(research.reviewedAt), 'An explicitly dated approved reviewed editorial input is required.');
  assert(Array.isArray(research.targets) && Array.isArray(research.entries) && research.targets.length===ids.length && research.entries.length===ids.length, 'Exactly one target and entry are required for each selected identity.');
  assert(new Set(research.targets.map(target=>target.id)).size===ids.length && new Set(research.entries.map(entry=>entry.id)).size===ids.length, 'Reviewed targets and entries must be distinct.');
  const originals=new Map(files.map(relative=>[relative,fs.readFileSync(path.join(root,relative))]));
  const documents=new Map([...originals].map(([relative,body])=>[relative,JSON.parse(body)]));
  const knowledge=documents.get(files[0]);
  assert.deepEqual(narrative.validateKnowledge(knowledge),[], 'Existing knowledge must retain all provenance guards.');
  const selected=[];
  const aliases=new Set();
  for (const id of ids) {
    const target=research.targets.find(target=>target.id===id);
    assert(target && research.entries.some(entry=>entry.id===id), 'Reviewed entry identity is not bound to selected target '+id);
    for (const relative of files.slice(1)) {
      const matches=documents.get(relative).events.filter(event=>narrative.projectionTargetIds(event).includes(id));
      assert(matches.length===1, 'Unknown or ambiguous reviewed fixture identity '+id);
      const event=matches[0];
      assert(!require('../../config/editorial-maintenance').protectedFixture(event), 'Protected editorial fixture '+id);
      assert(!require('../../config/editorial-locks').activeFor(event), 'Locked editorial fixture '+id);
      assert(event.canonicalEventId===target.canonicalEventId, 'Canonical identity binding differs for '+id);
      assert(target.fixtureHashes?.[relative]===hash(facts(event)), 'Retained fixture binding differs for '+relative+' '+id);
      const retainedProjection=narrative.projectionForTarget(knowledge,'feed-event',event);
      assert(!event.editorialNarrative || retainedProjection && ['projectionId','hook','synopsis','formCopy','closingCopy','sourceIds','factIds','threadIds','researchedAt'].every(key=>isDeepStrictEqual(event.editorialNarrative[key],key==='projectionId'?retainedProjection.id:retainedProjection[key])), 'Existing retained writing cannot be replaced by missing-projection staging.');
      narrative.projectionTargetIds(event).forEach(alias=>aliases.add(alias));
      selected.push(event);
    }
  }
  assert(new Set(research.targets.map(target=>target.canonicalEventId)).size===ids.length, 'Distinct IDs cannot alias the same reviewed fixture.');
  assert(Array.isArray(research.sourceBindings) && research.sourceBindings.length, 'Complete retained source bindings are required.');
  const bindings=new Map();
  for (const binding of research.sourceBindings) {
    assert(typeof binding.path==='string' && /^(?:data\/canonical\/[a-z0-9-]+\.json|data\/events\.json|feeds\/incoming\/events\.json|scripts\/fixtures\/f1-qatar-2025-official-evidence\.json)$/.test(binding.path), 'Invalid retained source path.');
    assert(['events','ladderSnapshots','sourceRecords'].includes(binding.collection) && ['canonicalEventId','competitionId','id'].includes(binding.identityField), 'Invalid retained source collection/identity binding.');
    const file=fs.realpathSync(path.join(root,binding.path));
    assert(file.startsWith(root+path.sep), 'Retained source path escapes the owned checkout.');
    if (!documents.has(binding.path)) documents.set(binding.path,JSON.parse(fs.readFileSync(file,'utf8')));
    const matches=documents.get(binding.path)[binding.collection]?.filter(record=>record[binding.identityField]===binding.id);
    assert(matches?.length===1, 'Missing or ambiguous retained source binding.');
    const record=matches[0];
    const observed=binding.collection==='events'?facts(record):record;
    const url=record.source?.sourceUrl || record.sourceUrl;
    const checkedAt=record.snapshotTimeUtc || record.source?.checkedAt || record.sourceCheckedAt;
    assert(binding.sha256===hash(observed) && binding.url===url && binding.checkedAt===checkedAt && iso(checkedAt) && Date.parse(checkedAt)<=Date.parse(research.reviewedAt), 'Retained source hash/URL/observation binding differs.');
    assert((record.source?.sourceType || record.sourceType)==='official', 'Retained source classification must be official, not relabelled by the review.');
    assert(!bindings.has(url), 'Duplicate retained source binding.');
    bindings.set(url,binding);
  }
  const usedSources=new Set();
  for (const entry of research.entries) {
    assert(entry.researchedAt===research.reviewedAt, 'Entry assembly/review date must match the reviewed input.');
    assert(Array.isArray(entry.sources) && Array.isArray(entry.sourceObservations) && entry.sources.length===entry.sourceObservations.length, 'Complete dated source observations are required.');
    for (const [index,url] of entry.sources.entries()) {
      const binding=bindings.get(url),observation=entry.sourceObservations[index];
      assert(binding && observation.url===url && observation.checkedAt===binding.checkedAt && observation.sourceType==='official', 'Reviewed source observation is not bound to retained evidence.');
      usedSources.add(url);
    }
  }
  assert(usedSources.size===bindings.size, 'Unused/unbound retained source observations are not admitted.');
  require('./cricket-editorial-evidence').assertPublicationApproved(research.entries);
  const scopedKnowledge=structuredClone(knowledge);
  scopedKnowledge.eventProjections=knowledge.eventProjections.filter(projection=>projection.targetType==='feed-event' && projection.targetIds.some(id=>aliases.has(id))).map(projection=>{
    assert(projection.targetIds.every(id=>aliases.has(id)), 'Shared unrelated editorial projection cannot be replaced.');
    return structuredClone(projection);
  });
  const result=applyResearch(scopedKnowledge,{events:structuredClone(selected)},{events:[]},{entries:research.entries});
  const previous=knowledge.eventProjections.filter(projection=>projection.targetType==='feed-event' && projection.targetIds.some(id=>aliases.has(id)));
  if (previous.length) assert(isDeepStrictEqual(previous,result.knowledge.eventProjections), 'Existing reviewed narrative cannot be replaced by missing-projection staging.');
  result.knowledge.eventProjections=[...knowledge.eventProjections,...result.knowledge.eventProjections.filter(projection=>!previous.some(old=>old.id===projection.id))];
  for (const key of ['subjects','sources','narrativeFacts','narrativeThreads','audienceMemories']) for (const old of knowledge[key]) {
    assert(isDeepStrictEqual(result.knowledge[key].find(record=>record.id===old.id),old), 'Unrelated immutable editorial evidence changed: '+old.id);
  }
  assert.deepEqual(narrative.validateKnowledge(result.knowledge),[], 'Reviewed projection must satisfy the unchanged whole-knowledge depth/provenance bar.');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-reviewed-copy-stage-'));
  let failure;
  let committed=false;
  try {
    for (const relative of files) {
      const file=path.join(temporary,relative);fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,JSON.stringify(relative===files[0]?result.knowledge:documents.get(relative),null,2)+'\n');
    }
    const repaired=applyScopedFeed(ids,temporary);
    const plans=files.map(relative=>({file:path.join(root,relative),before:originals.get(relative),document:JSON.parse(fs.readFileSync(path.join(temporary,relative),'utf8'))})).filter((plan,index)=>!isDeepStrictEqual(plan.document,documents.get(files[index])));
    commit(plans);
    committed=plans.length>0;
    return {changed:repaired.changed ? research.targets.length : 0,updatedIds:repaired.changed ? ids : [],sourceRequests:0,scope:'reviewed-editorial-research',derivedPublication:false};
  } catch (error) { failure=error; throw error; }
  finally {
    try { fs.rmSync(temporary,{recursive:true,force:true}); }
    catch (error) {
      if (!failure) throw Object.assign(new Error((committed?'Reviewed outputs committed':'No reviewed outputs committed')+'; staging cleanup failed; retain '+temporary+': '+error.message),{cause:error,committed,recoveryFiles:[temporary]});
      failure.cleanupFailures ||= [];
      failure.recoveryFiles ||= [];
      failure.cleanupFailures.push(error.message);
      failure.recoveryFiles.push(temporary);
      failure.message += '; staging cleanup failed; retain '+temporary;
    }
  }
}

module.exports={applyScopedResearch};
