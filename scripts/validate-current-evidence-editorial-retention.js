'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {mergeRecord,restorePublishedEditorial}=require('./apply-current-card-evidence');
const baseline=JSON.parse(cp.execFileSync('git',['show','11c225e3beec327853dbbfdbf993cd5864299ac9:data/events.json'],{maxBuffer:20*1024*1024}));
// Keep the actual bad-refresh inputs fixed; subsequent race/results corrections
// must not make a regression of unchanged-fact handling expire.
const evidence=JSON.parse(cp.execFileSync('git',['show','9869e32cbb5c24b4fa9330add428ec87c1203943:data/canonical/current-card-evidence-2026.json'],{maxBuffer:20*1024*1024}));
const id='supercars-bathurst-1000-2026',before=baseline.events.find(e=>e.id===id),override=evidence.fixtureOverrides.find(e=>e.id===id);
const copy=['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt'];
assert(before.editorialNarrative.formCopy&&before.editorialNarrative.closingCopy,'Actual previously published complete preview required.');
const after=mergeRecord(before,override,evidence.checkedAt);
for(const field of copy)assert.deepEqual(after[field],before[field],field+' must retain the newer approved public preview while unchanged dated facts are reapplied');
assert.equal(after.editorialNarrative.researchedAt,before.editorialNarrative.researchedAt,'copy observation is not renewed');
assert.deepEqual(mergeRecord(after,override,evidence.checkedAt),after,'unchanged override replay is idempotent');
const newer={...override,editorialNarrative:{...before.editorialNarrative,hook:'Later approved hook',researchedAt:'2026-10-02T13:36:19.426Z'},selectedSentence:'Later approved hook'};
assert.equal(mergeRecord(before,newer,evidence.checkedAt).editorialNarrative.hook,'Later approved hook','real newer copy is accepted');
for(const change of [{startTimeUtc:'2026-10-11T02:30:00Z'},{date:'2026-10-12'},{venue:'Reviewed replacement venue'},{participantIds:['new-entrant']},{participants:[{id:'new-entrant'}]},{teamMatchContext:{title:'Updated form'}},{status:'live'},{status:'postponed'},{status:'completed',homeScore:1,awayScore:0}]){
 const next=mergeRecord(before,{...override,...change},evidence.checkedAt);
 assert.equal(next.editorialNarrative.projectionId,override.editorialNarrative.projectionId,'changed underlying facts must not pin older prose');
 for(const [field,value]of Object.entries(change))assert.deepEqual(next[field],value,'sporting fact update survives');
}
const malformed={...before,editorialNarrative:{...before.editorialNarrative,researchedAt:'invalid'}};
assert.equal(mergeRecord(malformed,override,evidence.checkedAt).editorialNarrative.projectionId,override.editorialNarrative.projectionId,'invalid observation cannot win');
const withoutCopy={...before};delete withoutCopy.editorialNarrative;
assert.equal(mergeRecord(withoutCopy,override,evidence.checkedAt).editorialNarrative.projectionId,override.editorialNarrative.projectionId,'new seed copy remains available');
const os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-reviewed-editorial-'));
try{
 const files=['feeds/incoming/events.json','data/events.json'];
 for(const file of files){
  const current=JSON.parse(cp.execFileSync('git',['show','9869e32cbb5c24b4fa9330add428ec87c1203943:'+file],{maxBuffer:20*1024*1024}));
  const record=current.events.find(e=>e.id===id);assert(!record.editorialNarrative.formCopy,'Actual refresh-regressed fixture is required');
  fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
  fs.writeFileSync(path.join(root,file),JSON.stringify({events:[record,{id:'unrelated',selectedSentence:'Unchanged',sourceCheckedAt:'2026-09-01T00:00:00Z'}]},null,2)+'\n');
 }
 const originals=files.map(file=>JSON.parse(fs.readFileSync(path.join(root,file))));
 restorePublishedEditorial('11c225e3beec327853dbbfdbf993cd5864299ac9',[id],{root});
 for(const [index,file]of files.entries()){
  const restored=JSON.parse(fs.readFileSync(path.join(root,file)));
  assert(restored.events[0].editorialNarrative.formCopy,'Restored copy must persist on both real feed surfaces');
  assert.deepEqual(restored.events[1],originals[index].events[1],'Unrelated event is unchanged');
  for(const key of ['id','canonicalEventId','date','time','startTimeUtc','sourceCheckedAt','statusCheckedAt','resultSourceCheckedAt','participantIds','status'])assert.deepEqual(restored.events[0][key],originals[index].events[0][key],key+' factual state and clock are preserved');
 }
 const hashes=()=>files.map(file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'));
 const initial=hashes();restorePublishedEditorial('11c225e3beec327853dbbfdbf993cd5864299ac9',[id],{root});assert.deepEqual(hashes(),initial,'Repeat restoration has no byte churn');
 assert.throws(()=>restorePublishedEditorial('11c225e3beec327853dbbfdbf993cd5864299ac9',[id,'missing'],{root}),/exist/);assert.deepEqual(hashes(),initial,'Failed preflight writes neither surface');
 const changed=structuredClone(originals[1]);changed.events[0].venue='Actual replacement venue';fs.writeFileSync(path.join(root,files[1]),JSON.stringify(changed,null,2)+'\n');
 const conflict=hashes();assert.throws(()=>restorePublishedEditorial('11c225e3beec327853dbbfdbf993cd5864299ac9',[id],{root}),/changed sporting facts/);assert.deepEqual(hashes(),conflict,'A fact mismatch on the second surface does not partly write the first');
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('Current evidence editorial retention: real formerly live preview, original copy clock, repeat bytes, newer research, sporting changes, invalid/missing copy, actual two-surface persistence and failure preflight passed; no source or database requests.');

// Reproduce the full refresh failure at the real file writer: completed Events
// children share result normalisation with Feed, but have a stricter schema.
const child=require('../data/major-events.v1.json').events.find(e=>e.id==='major-event:us-open-2026').subEvents.find(e=>e.id==='fixture:us-open-2026:serena-alcaraz-v-routliffe-glasspool');
assert.equal(child.status,'completed');assert(child.score||child.scoreDisplay||child.outcomeText);
const childBefore={...structuredClone(child),storyline:{...child.storyline,arcStage:'preview'}};
const childRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ns-completed-child-'));
try{
 const documents={
  'data/canonical/current-card-evidence-2026.json':{checkedAt:'2026-10-04T00:00:00Z',fixtureOverrides:[],resultOverrides:[],broadcastOverrides:[],timingOverrides:[]},
  'data/canonical/afl-nrl-2026.json':{events:[]},
  'feeds/incoming/events.json':{events:[childBefore]},
  'data/follow-sources/coverage.v1.json':{events:[]},
  'data/canonical/official-card-results-2026.json':{results:[]},
  'data/major-events.v1.json':{events:[{id:'major-event:us-open-2026',subEvents:[childBefore]}]},
 };
 for(const [file,document]of Object.entries(documents)){fs.mkdirSync(path.dirname(path.join(childRoot,file)),{recursive:true});fs.writeFileSync(path.join(childRoot,file),JSON.stringify(document,null,2)+'\n');}
 const run=()=>require('./apply-current-card-evidence').applyEvidence({root:childRoot});run();
 const readChild=()=>JSON.parse(fs.readFileSync(path.join(childRoot,'data/major-events.v1.json'))).events[0].subEvents[0];
 const after=readChild(),schema=require('../schemas/major-events.schema.json').$defs.subEvent;
 assert.deepEqual(Object.keys(after).filter(key=>!Object.hasOwn(schema.properties,key)),[],'actual result writer must retain the strict child schema');
 for(const key of ['id','participantIds','matchupSides','startTimeUtc','status','score','scoreDisplay','sourceUrl','sourceCheckedAt','editorialNarrative'])assert.deepEqual(after[key],childBefore[key],key+' retains its original fact or observation');
 assert.equal(after.storyline.arcStage,'recap');assert.equal(after.storyline.hookSpoilerOff,`${after.name} is complete. Reveal results for the outcome.`);
 const feed=JSON.parse(fs.readFileSync(path.join(childRoot,'feeds/incoming/events.json'))).events[0];
 assert.equal(feed.selectedSentence,after.storyline.hookSpoilerOff,'Feed retains its supported safe root copy');assert.equal(feed.fullSpiel,after.storyline.synopsisSpoilerOff);
 const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(path.join(childRoot,'data/major-events.v1.json'))).digest('hex');const first=hash();run();assert.equal(hash(),first,'unchanged child writer reruns retain bytes');
}finally{fs.rmSync(childRoot,{recursive:true,force:true});}
console.log('Completed Events child: actual file writer preserves strict schema, spoiler-safe recap, facts, source clocks and repeat bytes while Feed keeps its supported copy fields.');
