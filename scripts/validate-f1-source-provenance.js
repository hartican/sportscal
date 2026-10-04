'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),schedule=require('../data/canonical/f1-sessions-2026.json'),published=require('../data/events.json'),overrides=require('../feeds/editorial-preview-overrides.json');
const sourceKeys=['sourceName','sourceUrl','sourceType','sourceCheckedAt'];
const ids=['evt_34','evt_35','evt_36','evt_37','evt_38','evt_39'];
const cards=ids.map(id=>published.events.find(e=>e.id===id));assert(cards.every(Boolean));
const originals=cards.map(card=>{
 const event=schedule.events.find(e=>e.id===card.canonicalEventId);assert(event);const source=schedule.sources[event.sourceId];
 return {...card,sourceName:source.name,sourceUrl:event.sourceUrl,sourceType:source.type,sourceCheckedAt:event.sourceCheckedAt};
});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-preview-source-'));
try{
 for(const dir of ['feeds/incoming','data/canonical'])fs.mkdirSync(path.join(temp,dir),{recursive:true});
 const fixtures=[...originals,{...originals[0],id:'different-editorial',eventId:'different-editorial'}, {...originals[0],id:'settled-final',eventId:'settled-final',status:'completed'}, {...originals[0],id:'reviewed-final',eventId:'reviewed-final'}];
 for(const file of ['feeds/incoming/events.json','data/events.json'])fs.writeFileSync(path.join(temp,file),JSON.stringify({events:fixtures}));
 const one=structuredClone(overrides);one.events=Object.fromEntries(ids.map(id=>[id,overrides.events[id]]));
 one.events['different-editorial']={selectedSentence:'Sourced preview',fullSpiel:'Separate editorial observation.',sourceName:'Editorial source',sourceUrl:'https://example.com/research',sourceType:'official',sourceCheckedAt:'2026-10-04T21:00:00Z',editorialPreview:{status:'journalistic',sourceName:'Editorial source',sourceUrl:'https://example.com/research',sourceCheckedAt:'2026-10-04T21:00:00Z',contextSignals:[]}};
 one.events['settled-final']={...one.events['different-editorial'],selectedSentence:'New preview'};
 one.events['reviewed-final']={status:'completed',score:'0-0',outcomeText:'Draw',recapText:'The reviewed final ended level.',sourceName:'Reviewed result publisher',sourceUrl:'https://example.com/final',sourceType:'official',sourceCheckedAt:'2026-10-04T21:00:00Z'};
 const overridePath=path.join(temp,'overrides.json');fs.writeFileSync(overridePath,JSON.stringify(one));
 cp.execFileSync(process.execPath,[path.join(root,'scripts/apply-editorial-previews.js'),overridePath],{cwd:temp,stdio:'pipe'});
 for(const file of ['feeds/incoming/events.json','data/events.json']){
  const result=JSON.parse(fs.readFileSync(path.join(temp,file))).events;
  for(const original of fixtures.filter(e=>e.id!=='reviewed-final')){const next=result.find(e=>e.id===original.id);for(const key of sourceKeys)assert.equal(next[key],original[key],`${file}/${original.id}: preview must preserve fixture ${key}`);}
  assert.equal(result.find(e=>e.id==='different-editorial').editorialPreview.sourceUrl,'https://example.com/research');
  assert.deepEqual(result.find(e=>e.id==='settled-final'),fixtures.find(e=>e.id==='settled-final'),'A completed result rejects a new preview');
  assert.equal(result.find(e=>e.id==='reviewed-final').sourceUrl,'https://example.com/final');assert.equal(result.find(e=>e.id==='reviewed-final').score,'0-0','Existing explicit reviewed-final path remains');
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const provenance=require('./lib/f1-source-provenance');
for(let i=0;i<cards.length;i++){
 const corrected=provenance.qualify(cards[i],{schedule});
 for(const key of sourceKeys)assert.equal(corrected[key],originals[i][key]);
 assert.deepEqual(Object.fromEntries(Object.entries(corrected).filter(([key])=>!sourceKeys.includes(key))),Object.fromEntries(Object.entries(cards[i]).filter(([key])=>!sourceKeys.includes(key))));
 for(const mutation of [{name:'Different fixture'},{date:'2026-11-30'},{time:'00:01'},{startTimeUtc:'2026-11-30T00:01:00Z'},{status:'live'},{status:'completed'}]){
  const newer={...cards[i],sourceUrl:'',...mutation};assert.deepEqual(provenance.qualify(newer,{schedule}),newer,'A source cannot be borrowed for changed sporting facts');
 }
 const later={...cards[i],sourceUrl:'https://example.com/corrected',sourceCheckedAt:'2026-10-04T21:00:00Z'};assert.deepEqual(provenance.qualify(later,{schedule}),later);
}
for(const mutation of [d=>d.events.push(d.events[0]),d=>d.events[0].sourceUrl='https://example.com',d=>d.events[0].sourceCheckedAt='2099-01-01T00:00:00Z']){const invalid=structuredClone(schedule);mutation(invalid);assert.throws(()=>provenance.validate(invalid));}
const store=fs.mkdtempSync(path.join(os.tmpdir(),'ns-f1-source-store-'));
try{
 for(const dir of ['feeds/incoming','data/canonical'])fs.mkdirSync(path.join(store,dir),{recursive:true});
 const unrelated={id:'unrelated',sourceUrl:'https://example.com/kept',sourceCheckedAt:'2026-09-01T00:00:00Z'};
 for(const file of ['feeds/incoming/events.json','data/events.json'])fs.writeFileSync(path.join(store,file),JSON.stringify({events:[...cards.map(e=>({...e,sourceUrl:'',sourceName:''})),unrelated]},null,2)+'\n');
 const changed=provenance.applyRetained({root:store,schedule});assert(changed.every(row=>row.changed.length===6));
 const bytes=['feeds/incoming/events.json','data/events.json'].map(file=>fs.readFileSync(path.join(store,file),'utf8'));
 assert(provenance.applyRetained({root:store,schedule}).every(row=>row.changed.length===0));assert.deepEqual(['feeds/incoming/events.json','data/events.json'].map(file=>fs.readFileSync(path.join(store,file),'utf8')),bytes);
 assert.deepEqual(JSON.parse(bytes[0]).events.at(-1),unrelated);
 fs.writeFileSync(path.join(store,'data/events.json'),'not-json');assert.throws(()=>provenance.applyRetained({root:store,schedule}));assert.equal(fs.readFileSync(path.join(store,'feeds/incoming/events.json'),'utf8'),bytes[0]);
}finally{fs.rmSync(store,{recursive:true,force:true});}
if(!process.argv.includes('--unit-only'))for(const folder of ['code-inspector','follow-schedule']){
 const fixtures=require(`../data/${folder}/f1.json`).fixtures;
 for(const original of originals){const fixture=fixtures.find(e=>e.id===original.canonicalEventId);assert(fixture);for(const key of sourceKeys)assert.equal(fixture[key],original[key],`${folder}: original fixture source ${key} must survive`);}
}
assert(require('./update-cards').buildSteps({localOnly:true}).some(args=>args[0]==='scripts/lib/f1-source-provenance.js'),'Full refresh must retain the fixture-source boundary');
assert(require('node:fs').readFileSync(path.join(root,'scripts/quick-results.js'),'utf8').includes("require('./lib/f1-source-provenance').applyRetained()"),'Existing quick owner retains the same source repair');
console.log('F1 source provenance: actual preview CLI preserves six known fixture sources and independent editorial dates on both surfaces.');
