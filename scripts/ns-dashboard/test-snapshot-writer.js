"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {publishSnapshot}=require('../../lib/ns-dashboard/snapshot-writer');
const {serialize}=require('./hosted-contract');
const {overviewFixture,AS_OF}=require('./overview-fixture');
function fixture(options={}) {
 const snapshot=serialize(overviewFixture(),AS_OF),calls=[];let advanced=false;
 const store={protocol:'ns-dashboard-fenced-publication.v1',async acquire(){calls.push('acquire');return options.busy?null:'opaque-fence';},async readPointer(){return {revision:'one',pointer:options.unchanged?{schemaVersion:'ns-dashboard-latest.v1',sha256:snapshot.sha256,publishedAt:AS_OF,previous:null}:null};},async putImmutable(lease,key,bytes){assert.equal(lease,'opaque-fence');assert.equal(key,'snapshots/'+snapshot.sha256+'.json');assert.deepEqual(bytes,snapshot.bytes);calls.push('put');if(options.failPut)throw new Error('synthetic uncertain put');},async readImmutable(){calls.push('readback');return options.badRead?Buffer.from('{}'):snapshot.bytes;},async commit(lease,input){calls.push('commit');assert.equal(lease,'opaque-fence');assert.equal(input.expectedRevision,'one');if(options.conflict)return null;advanced=true;return {schemaVersion:'ns-dashboard-latest.v1',sha256:input.sha256,publishedAt:AS_OF,previous:input.previous};},async release(lease){assert.equal(lease,'opaque-fence');calls.push('release');}};
 return {snapshot,store,calls,expected:{expectedCurrentSHA:options.unchanged?snapshot.sha256:null},advanced:()=>advanced};
}
test('immutable snapshot readback precedes fenced pointer publication',async()=>{const f=fixture();assert.equal((await publishSnapshot(f.snapshot,f.store,f.expected)).published,true);assert.deepEqual(f.calls,['acquire','put','readback','commit','release']);});
test('busy or unavailable writer cannot start publication',async()=>{const f=fixture({busy:true});await assert.rejects(publishSnapshot(f.snapshot,f.store,f.expected),/busy/);assert.deepEqual(f.calls,['acquire']);await assert.rejects(publishSnapshot(f.snapshot,{},f.expected),/unavailable/);});
test('failed or uncertain snapshot upload/readback leaves pointer untouched',async()=>{for(const options of [{failPut:true},{badRead:true}]){const f=fixture(options);await assert.rejects(publishSnapshot(f.snapshot,f.store,f.expected));assert.equal(f.advanced(),false);assert.equal(f.calls.includes('commit'),false);assert.equal(f.calls.at(-1),'release');}});
test('lease or revision conflict does not retry or replace pointer',async()=>{const f=fixture({conflict:true});await assert.rejects(publishSnapshot(f.snapshot,f.store,f.expected),/conflict/);assert.equal(f.advanced(),false);assert.equal(f.calls.filter(x=>x==='commit').length,1);assert.equal(f.calls.at(-1),'release');});
test('unchanged generation does not renew publication time or upload again',async()=>{const f=fixture({unchanged:true});const r=await publishSnapshot(f.snapshot,f.store,f.expected);assert.equal(r.published,false);assert.equal(r.pointer.publishedAt,AS_OF);assert.deepEqual(f.calls,['acquire','release']);});

test('stale preparation cannot replace a newer source generation',async()=>{const f=fixture({unchanged:true});await assert.rejects(publishSnapshot(f.snapshot,f.store,{expectedCurrentSHA:'b'.repeat(64)}),/source_generation_conflict/);assert.deepEqual(f.calls,['acquire','release']);});
