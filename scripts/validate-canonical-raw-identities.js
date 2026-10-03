'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-canonical-identities-'));
try{for(const file of ['feeds/incoming/events.json','data/events.json']){
 const doc=JSON.parse(fs.readFileSync(path.join(root,file))),raw=structuredClone(doc.events.find(e=>e.key==='tennis'));raw.id=raw.eventId='qa:tennis:retained-provider-identity';delete raw.canonicalEventId;delete raw.sourceEventIds;doc.events.push(raw);const target=path.join(temp,'events.json');fs.writeFileSync(target,JSON.stringify(doc));
 for(let i=0;i<2;i++)execFileSync(process.execPath,[path.join(root,'scripts/sync-canonical-fixtures-to-feed.js'),path.join(root,'data/canonical/afl-nrl-2026.json'),target,target],{cwd:root,stdio:'pipe'});
 const written=JSON.parse(fs.readFileSync(target));assert.equal(written.events.filter(e=>e.id===raw.id).length,1,'unrelated provider ID survives the real canonical writer');const kept=written.events.find(e=>e.id===raw.id);assert.equal(kept.eventId,raw.eventId);assert.equal(kept.sourceCheckedAt,raw.sourceCheckedAt);assert.equal(kept.status,raw.status);
}}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Canonical identity retention: both real writer surfaces/reruns retain unrelated raw provider ID, event ID, source clock and state.');
