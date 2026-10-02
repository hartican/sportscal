'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {apply}=require('./apply-fixture-research');
const narrative=require('./lib/editorial-narrative');
const id='rlwc-australia-new-zealand-2026';
const feed=JSON.parse(fs.readFileSync('data/events.json'));
const knowledge=JSON.parse(fs.readFileSync('data/editorial-knowledge.v1.json'));
const original=feed.events.find(e=>e.id===id);
const published=narrative.projectionForTarget(knowledge,'feed-event',original);
assert.equal(published.id,'projection:feed:rlwc-australia-new-zealand-2026');
const entry=JSON.parse(fs.readFileSync('data/editorial-adaptive-2026-10-03.json')).entries.find(e=>e.id===id);
const research={entries:[{...entry,hook:'Australia must reset its attack before New Zealand tests the champions on World Cup opening night.'}]};
const alias={...original,id:'major-match:rlwc-2026:australia-new-zealand',sourceEventIds:[id]};
function refresh(k,f){return apply(structuredClone(k),structuredClone(f),{events:[]},research);}
const first=refresh(knowledge,{events:[original,alias]});
for(const event of first.feed.events){assert.equal(event.editorialNarrative.projectionId,published.id);assert.equal(event.editorialNarrative.hook,research.entries[0].hook);for(const key of ['formCopy','closingCopy','synopsis'])assert.equal(event.editorialNarrative[key],entry[key]);}
assert.equal(first.knowledge.eventProjections.filter(p=>p.targetType==='feed-event'&&p.targetIds.includes(id)).length,1);
const again=refresh(first.knowledge,first.feed);
assert.equal(again.feed.events[0].editorialNarrative.projectionId,published.id,'Repeated refresh retains identity');
const shared=structuredClone(knowledge);
const prior=shared.eventProjections.find(p=>p.id===published.id);
prior.id='projection:fixture-research:'+id;
prior.targetIds.push('fixture:unrelated');
const split=refresh(shared,{events:[original,alias]});
const retained=split.knowledge.eventProjections.find(p=>p.id===prior.id);
assert.deepEqual(retained.targetIds,['fixture:unrelated']);
assert.equal(retained.hook,prior.hook,'Shared sibling retains its own copy');
assert.notEqual(split.feed.events[0].editorialNarrative.projectionId,prior.id);
assert.equal(refresh(split.knowledge,split.feed).feed.events[0].editorialNarrative.projectionId,split.feed.events[0].editorialNarrative.projectionId);
const newKnowledge=structuredClone(knowledge);
newKnowledge.eventProjections=newKnowledge.eventProjections.filter(p=>p.id!==published.id);
assert.equal(refresh(newKnowledge,{events:[original]}).feed.events[0].editorialNarrative.projectionId,'projection:fixture-research:'+id);
for(const [fixture,projection] of [['rugby-new-zealand-australia-2026-10-10',null],['rugby-australia-new-zealand-2026-10-17','projection:feed:bledisloe-sydney-2026']]){
  const event=feed.events.find(e=>e.id===fixture);
  const p=narrative.projectionForTarget(knowledge,'feed-event',event);
  assert(p,fixture+' has one resolved narrative');
  if(projection)assert.equal(p.id,projection);
  for(const key of ['hook','formCopy','closingCopy','synopsis'])assert(event.editorialNarrative[key]?.trim(),fixture+' missing '+key);
  assert.equal(event.editorialNarrative.projectionId,p.id);
}
console.log('Editorial projection identity: stable refresh and aliases, repeat runs, safe shared-target split, new fixtures and both full Bledisloe previews passed.');
