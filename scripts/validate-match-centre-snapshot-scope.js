'use strict';
const assert=require('node:assert/strict');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
(async()=>{
 const calls=[],fixture={id:'fixture:scope-test',key:'nrl',status:'live'},store=createSnapshotStore({request:async(route,options)=>{
  calls.push({route,...options});
  if(route.endsWith('source_health'))return [{source_id:'scope-test',revision:1}];
  return {schemaVersion:'current-fixture-bundle.v1',scope:route.endsWith('nothingsports_read_match_centre_fixture_bundle')?'match-centre':'global',complete:true,rows:[{source_id:'scope-test',fixture}]};
 }});
 await store.read({scope:'match-centre',preserveIds:['fixture:kept','alias:kept','fixture:kept']});
 assert.equal(calls.length,2,'Keep two parallel membership reads');
 const near=calls.find(c=>!c.route.endsWith('source_health'));
 assert(near.route.endsWith('nothingsports_read_match_centre_fixture_bundle'),'Match Centre does not fetch the full future timeline');
 assert.deepEqual(near.body,{p_membership_ids:['alias:kept','fixture:kept']},'Keep all known member IDs and aliases for corrective updates');
 assert(calls.every(c=>c.timeoutMs===3000));
 const wrongScope=createSnapshotStore({request:async route=>route.endsWith('source_health')?[]:{schemaVersion:'current-fixture-bundle.v1',scope:'global',complete:true,rows:[]}});await assert.rejects(()=>wrongScope.read({scope:'match-centre'}),/Wrong membership snapshot scope/,'A mismatched complete snapshot cannot certify membership');
 calls.length=0;await store.read();assert(calls.some(c=>c.route.endsWith('nothingsports_read_current_fixture_bundle')),'Other readers retain their original future timeline');
 for(const options of [{scope:'unknown'},{scope:'match-centre',preserveIds:Array.from({length:5001},(_,i)=>'fixture:'+i)},{scope:'match-centre',preserveIds:['invalid id']}]){
  calls.length=0;await assert.rejects(()=>store.read(options));assert.equal(calls.length,0,'Invalid scope input fails before a database read');
 }
 let reads=0;const observed=Date.now()+100000,cacheStore={read:async options=>{reads++;return [{source_id:options.scope||'global',revision:1,fixtures:[{...fixture,id:options.preserveIds?.[0]||'fixture:global'}]}];}};
 const global=await readLiveSnapshots({store:cacheStore,now:observed}),scoped=await readLiveSnapshots({store:cacheStore,now:observed,scope:'match-centre',preserveIds:['fixture:one']});
 assert.notEqual(scoped.sources[0].source_id,global.sources[0].source_id,'A scoped snapshot cannot replace the full shared snapshot');
 const same=await readLiveSnapshots({store:cacheStore,now:observed+1,scope:'match-centre',preserveIds:['fixture:one']});assert.equal(reads,2);assert.strictEqual(same,scoped,'Same member scope retains the existing thirty-second cache');
 const changed=await readLiveSnapshots({store:cacheStore,now:observed+2,scope:'match-centre',preserveIds:['fixture:two']});assert.equal(reads,3);assert.equal(changed.sources[0].fixtures[0].id,'fixture:two','Changed known membership cannot reuse a scope that omitted its corrective update');
 const failed=await readLiveSnapshots({store:{read:async()=>{throw Error('unavailable');}},now:observed+30001,maxAgeMs:0,scope:'match-centre',preserveIds:['fixture:one']});assert(failed.stale);assert.equal(failed.revision,scoped.revision,'Failure retains last-good data only from the matching scope');
 console.log('Match Centre read scope, correction identities, existing budgets, cache isolation and last-good retention passed.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
