#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const taxonomy=require('../config/canonical-sports-taxonomy'),{repair,apply}=require('./lib/canonical-family-repair');
const bundle=require('../data/canonical/afl-nrl-2026.json');
const missing={...structuredClone(bundle),competitionFamilies:bundle.competitionFamilies.filter(f=>f.id!=='family:dakar')};
const result=repair(missing);
assert.deepEqual(result.added,['family:dakar']);
assert.deepEqual(result.bundle.competitionFamilies.at(-1),taxonomy.competitionFamilies.find(f=>f.id==='family:dakar'));
assert.deepEqual({...result.bundle,competitionFamilies:missing.competitionFamilies},missing,'only the missing family metadata changes');
assert.deepEqual(repair(result.bundle).added,[],'identical replay is stable');
for(const mutate of [
 b=>b.competitions.push({...b.competitions[0],id:'competition:unreviewed'}),
 b=>b.competitions[0].competitionFamilyId='family:unreviewed',
 b=>b.competitions[0].sportDomainId='sport:wrong',
 b=>b.competitionFamilies[0].sportDomainId='sport:wrong',
 b=>b.competitionFamilies.push(b.competitionFamilies[0]),
 b=>b.taxonomyVersion='other'
]){const bad=structuredClone(missing);mutate(bad);assert.throws(()=>repair(bad),'unknown/conflicting metadata fails before a write');}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-family-repair-'));
try{
 const file=path.join(root,'bundle.json');fs.writeFileSync(file,JSON.stringify(missing,null,2)+'\n');
 const receipt=apply({file});assert.deepEqual(receipt.added,['family:dakar']);
 assert.deepEqual(JSON.parse(fs.readFileSync(file)),result.bundle);
 const bytes=fs.readFileSync(file);assert.equal(apply({file}).changed,false);assert(bytes.equals(fs.readFileSync(file)),'real writer leaves unchanged bytes');
 const broken={...structuredClone(missing),competitions:[{...missing.competitions[0],competitionFamilyId:'unknown'}]};
 fs.writeFileSync(file,JSON.stringify(broken));const prior=fs.readFileSync(file);assert.throws(()=>apply({file}));assert(prior.equals(fs.readFileSync(file)),'invalid metadata retains the original file');
}finally{fs.rmSync(root,{recursive:true,force:true});}
const families=new Map(taxonomy.competitionFamilies.map(f=>[f.id,f]));
for(const c of taxonomy.competitions)assert.equal(families.get(c.competitionFamilyId)?.sportDomainId,c.sportDomainId,`shared taxonomy has a resolved family for ${c.id}`);
const owner=fs.readFileSync(path.join(__dirname,'update-cards.js'),'utf8');assert(owner.includes('--canonical-family-repair')&&owner.includes("require('./lib/canonical-family-repair').apply()"),'repair remains behind the canonical owner');
console.log('Canonical families: all shared competition references resolve; bounded real writer adds only missing reviewed metadata, preserves facts/clocks and fails closed.');
