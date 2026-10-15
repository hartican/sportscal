'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const narrative=require('./lib/editorial-narrative');
const {projectionConforms,reconcileFeedEvent}=require('./apply-editorial-narratives');
const knowledge=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/editorial-knowledge.v1.json')));
const feed=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/events.json')));
const indexes=narrative.indexesFor(knowledge);
const fixture=feed.events.find(event=>event.status==='completed' && !require('../config/editorial-maintenance').protectedFixture(event) && narrative.projectionForTarget(knowledge,'feed-event',event));
assert(fixture,'A retained researched result supplies the actual reconciliation seam.');
const projection=narrative.projectionForTarget(knowledge,'feed-event',fixture);
const valid=narrative.applyToFeedEvent(structuredClone(fixture),projection,indexes);
const reviewed=new Date(Math.max(Date.parse(valid.lastReviewedAt),Date.now())+86400000).toISOString();
valid.lastReviewedAt=reviewed;valid.storyline.lastReviewedAt=reviewed;
assert(projectionConforms(valid,projection,indexes));
assert.equal(reconcileFeedEvent(valid,projection,indexes),valid,'Unchanged commentary retains the exact record and both genuine review dates.');
const preserved=JSON.stringify(valid),missing={...structuredClone(valid),editorialNarrative:undefined};
const repaired=reconcileFeedEvent(missing,projection,indexes);
assert.equal(repaired.editorialNarrative.projectionId,projection.id);
assert.equal(repaired.lastReviewedAt,reviewed);
assert.equal(repaired.storyline.lastReviewedAt,reviewed);
assert.equal(reconcileFeedEvent(repaired,projection,indexes),repaired,'Repair is idempotent.');
const editorial=new Set(['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline']);
for(const key of Object.keys(missing))if(!editorial.has(key))assert.deepEqual(repaired[key],missing[key],key+' sporting/source/user field retained');
assert.deepEqual(require('./lib/storyline-card-rules').spoilerContractIssues(repaired),[],'Completed repair remains Results OFF safe.');
assert.equal(JSON.stringify(valid),preserved,'Inputs are never mutated.');
const corrected={...structuredClone(valid),outcomeText:'Synthetic corrected winner.'};
assert(!projectionConforms(corrected,projection,indexes),'A changed result cannot be treated as unchanged commentary.');
const correctedCopy=reconcileFeedEvent(corrected,projection,indexes);
assert.equal(correctedCopy.outcomeText,corrected.outcomeText);
assert.equal(correctedCopy.editorialNarrative.resultSignature,require('../config/editorial-lifecycle').signature(corrected));
assert.deepEqual(require('./lib/storyline-card-rules').spoilerContractIssues(correctedCopy),[]);
const protectedOriginal=feed.events.find(event=>require('../config/editorial-maintenance').protectedFixture(event));
assert(protectedOriginal);
assert.equal(reconcileFeedEvent(protectedOriginal,projection,indexes),protectedOriginal,'Original NRL Grand Final is untouched, even with a competing candidate.');
const changedProjection={...projection,hook:projection.hook+' A new sourced angle.'};
assert(!projectionConforms(valid,changedProjection,indexes),'Material copy changes are not suppressed by a recent review date.');

// Exercise the actual file writer with one valid record and one broken alias.
// The control is byte-identical, while only the broken projection is repaired.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-reconcile-'));
try{
  fs.mkdirSync(path.join(temporary,'feeds/incoming'),{recursive:true});fs.mkdirSync(path.join(temporary,'data'));
  const broken={...structuredClone(valid),id:'test:reconcile:alias',eventId:'test:reconcile:event',canonicalEventId:'test:reconcile:canonical',sourceEventIds:['test:reconcile:provider']};
  delete broken.editorialNarrative;
  const other={...structuredClone(projection),id:'projection:test:reconcile',targetIds:['test:reconcile:provider'],hook:('Distinct fixture: '+projection.hook).slice(0,175),synopsis:('Separate fixture context. '+projection.synopsis).slice(0,690)};
  const k={...structuredClone(knowledge),eventProjections:[structuredClone(projection),other]};
  k.eventProjections[0].targetIds=[valid.id];
  const files=['data/editorial-knowledge.v1.json','feeds/incoming/events.json','data/events.json','data/major-events.v1.json'];
  for(const [index,value] of [k,{events:[valid,broken]},{events:[valid,broken]},{events:[]}].entries())fs.writeFileSync(path.join(temporary,files[index]),JSON.stringify(value)+'\n');
  const invoke=()=>spawnSync(process.execPath,[path.join(__dirname,'apply-editorial-narratives.js'),'--write'],{cwd:temporary,encoding:'utf8',timeout:30000});
  const result=invoke();assert.equal(result.status,0,result.stderr);
  for(const file of files.slice(1,3)){
    const output=JSON.parse(fs.readFileSync(path.join(temporary,file)));
    assert.deepEqual(output.events[0],valid,'Unrelated conformant file record is byte-equivalent.');
    assert.equal(output.events[1].editorialNarrative.projectionId,other.id,'Canonical/provider alias acquires its declared projection.');
    for(const key of Object.keys(broken))if(!editorial.has(key))assert.deepEqual(output.events[1][key],broken[key],file+':'+key);
  }
  const first=files.map(file=>fs.readFileSync(path.join(temporary,file),'utf8'));
  assert.equal(invoke().status,0);
  assert.deepEqual(files.map(file=>fs.readFileSync(path.join(temporary,file),'utf8')),first,'Unchanged CLI rerun preserves all bytes.');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
console.log('Editorial reconciliation: unchanged record/review bytes, real writer alias repair, sporting/source preservation, corrected result, Results OFF, idempotence and protected NRL passed.');
