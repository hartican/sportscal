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
const providerId='fixture:provider:stable-alias';
const providerEvent={...original,sourceEventIds:[...(original.sourceEventIds||[]),providerId]};
const providerKnowledge=structuredClone(knowledge);
providerKnowledge.eventProjections.find(p=>p.id===published.id).targetIds=[providerId];
const competing=structuredClone(published);competing.id='projection:fixture-research:'+id;competing.targetIds=[id];
providerKnowledge.eventProjections.push(competing);
const providerRefresh=refresh(providerKnowledge,{events:[providerEvent]});
assert.equal(providerRefresh.feed.events[0].editorialNarrative.projectionId,published.id,'A known provider alias retains the established identity even after a competing canonical projection was created.');
assert.equal(providerRefresh.knowledge.eventProjections.filter(p=>p.targetIds.includes(id)||p.targetIds.includes(providerId)).length,1);
assert(providerRefresh.knowledge.eventProjections.find(p=>p.id===published.id).targetIds.includes(providerId));
assert.equal(refresh(providerRefresh.knowledge,providerRefresh.feed).feed.events[0].editorialNarrative.projectionId,published.id);
for(const [fixture,projection] of [['rugby-new-zealand-australia-2026-10-10',null],['rugby-australia-new-zealand-2026-10-17','projection:feed:bledisloe-sydney-2026']]){
  const event=feed.events.find(e=>e.id===fixture);
  const p=narrative.projectionForTarget(knowledge,'feed-event',event);
  assert(p,fixture+' has one resolved narrative');
  if(projection)assert.equal(p.id,projection);
  for(const key of ['hook','formCopy','closingCopy','synopsis'])assert(event.editorialNarrative[key]?.trim(),fixture+' missing '+key);
  assert.equal(event.editorialNarrative.projectionId,p.id);
}
// Run the actual projection command with a small, owned file fixture. The
// generator accepts canonical IDs; its final integrity check must too.
const os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-target-'));
try{
  fs.mkdirSync(path.join(temporary,'data'));fs.mkdirSync(path.join(temporary,'feeds/incoming'),{recursive:true});
  const target={...structuredClone(original),id:'test:editorial:retained',eventId:'test:editorial:event',canonicalEventId:'test:editorial:canonical',sourceEventIds:['test:editorial:provider']};
  for(const validator of ['validate-editorial-narratives.js','validate-editorial-render-coverage.js']){
    const source=fs.readFileSync(path.join(__dirname,validator),'utf8'),helpers=[source.match(/function identities\(record\)\{[\s\S]*?\n\}/)?.[0],source.match(/function byIdentity\(records\)\{[\s\S]*?\n\}/)?.[0]].filter(Boolean).join('\n');
    assert(helpers.includes('function byIdentity('),'actual editorial validator lookup');
    const context={require};require('node:vm').createContext(context);require('node:vm').runInContext(helpers,context);const index=context.byIdentity([target]);
    for(const identifier of [target.id,target.eventId,target.canonicalEventId,...target.sourceEventIds])assert.equal(index.get(identifier),target,validator+' recognises '+identifier);
    assert.equal(index.get('test:editorial:genuinely-missing'),undefined,'unknown identifiers cannot acquire a fixture');
    const first={id:'test-first',canonicalEventId:'test:second'},second={id:'test-second',canonicalEventId:'test:first'},paired=context.byIdentity([first,second]);
    assert.equal(paired.get(first.id),first,'derived alias cannot overwrite another fixture actual ID');assert.equal(paired.get(second.id),second);assert.equal(paired.get(first.canonicalEventId),first);assert.equal(paired.get(second.canonicalEventId),second);
    const duplicate={...target,name:'Existing last-record precedence'};assert.equal(context.byIdentity([target,duplicate]).get(target.id),duplicate,'existing duplicate precedence is retained within the actual-ID tier');
  }
  const fields=['id','eventId','canonicalEventId','sourceEventIds','date','endDate','time','startTimeUtc','status','participantIds','homeParticipantId','awayParticipantId','sourceCheckedAt','resultSourceCheckedAt','resultStatus','result'];
  const facts=record=>JSON.stringify(fields.map(key=>[key,record[key]??null]));
  const paths=['data/editorial-knowledge.v1.json','feeds/incoming/events.json','data/events.json','data/major-events.v1.json'];
  const write=(name,value)=>fs.writeFileSync(path.join(temporary,name),JSON.stringify(value)+'\n');
  const invoke=()=>spawnSync(process.execPath,[path.join(__dirname,'apply-editorial-narratives.js'),'--write'],{cwd:temporary,encoding:'utf8',timeout:30000});
  function prepare(targetId){
    const k=structuredClone(knowledge),p=structuredClone(published);p.targetIds=[targetId];k.eventProjections=[p];
    write(paths[0],k);write(paths[1],{events:[target]});write(paths[2],{events:[target]});write(paths[3],{events:[]});
  }
  for(const identifier of [target.id,target.eventId,target.canonicalEventId,...target.sourceEventIds]){
    prepare(identifier);const result=invoke();assert.equal(result.status,0,'actual projection command must accept '+identifier+': '+result.stderr);
    for(const name of paths.slice(1,3)){
      const event=JSON.parse(fs.readFileSync(path.join(temporary,name))).events[0];
      assert.equal(facts(event),facts(target),'applying commentary cannot change source facts or identities');
      assert.equal(event.editorialNarrative.projectionId,published.id,'the same researched projection reaches either feed');
    }
    const before=paths.map(name=>fs.readFileSync(path.join(temporary,name),'utf8'));assert.equal(invoke().status,0,'unchanged rerun stays valid');
    assert.deepEqual(paths.map(name=>fs.readFileSync(path.join(temporary,name),'utf8')),before,'unchanged projection rerun is byte-stable');
  }
  prepare('test:editorial:genuinely-missing');const before=paths.map(name=>fs.readFileSync(path.join(temporary,name),'utf8')),missing=invoke();
  assert.notEqual(missing.status,0,'genuinely absent targets still stop publication');assert.match(missing.stderr,/Editorial projections reference missing targets: test:editorial:genuinely-missing/);
  assert.deepEqual(paths.map(name=>fs.readFileSync(path.join(temporary,name),'utf8')),before,'failed validation writes no partial feed or knowledge');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
console.log('Editorial projection identity: stable refresh and aliases, repeat runs, safe shared-target split, new fixtures and both full Bledisloe previews passed.');
