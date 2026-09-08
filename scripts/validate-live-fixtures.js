#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {refreshDueSources,refreshInterval,contentHash,overlaySnapshots}=require("../lib/live-fixtures");
const now=new Date("2026-09-08T00:00:00Z");
const event={id:"match",key:"rugby",name:"Test",startTimeUtc:"2026-09-08T00:10:00Z",status:"scheduled"};
assert.equal(refreshInterval([event],now),300000);
assert.equal(refreshInterval([{...event,status:"live"}],now),60000);
assert.equal(refreshInterval([{...event,startTimeUtc:"2026-10-01T00:00:00Z"}],now),3600000);
assert.equal(contentHash([event]),contentHash([{...event,sourceCheckedAt:now.toISOString()}]),"checking unchanged facts must not create a new revision");
assert.equal(overlaySnapshots([event],[{fixtures:[{...event,status:"postponed",time:null,startTimeUtc:null}]}])[0].status,"postponed");
async function main(){
  // The store is the external database boundary. Real SQL lease/RLS tests run separately.
  const rows=new Map([["rugby",{fixtures:[event,{...event,id:"retained"}],revision:1,nextDueAt:0}]]);
  const store={
    async claim(id,token){const row=rows.get(id);if(row.token||row.nextDueAt>+now)return null;row.token=token;return {...row};},
    async publish(id,token,value){const row=rows.get(id);assert.equal(row.token,token);Object.assign(row,value,{token:null,revision:row.revision+1});},
    async fail(id,token,value){const row=rows.get(id);assert.equal(row.token,token);Object.assign(row,value,{token:null});},
  };
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const source={id:"rugby",fetch:async()=>{await pending;return [{...event,status:"live",homeScore:7}];}};
  const first=refreshDueSources({sources:[source],store,now});
  const second=await refreshDueSources({sources:[source],store,now});
  assert.deepEqual(second.refreshed,[],"an in-flight source is coalesced");
  release();await first;
  assert.equal(rows.get("rugby").fixtures.length,2,"partial successful responses retain omitted fixtures");
  assert.equal(rows.get("rugby").fixtures[0].homeScore,7,"scores are published without an editorial rebuild");
  rows.get("rugby").nextDueAt=0;
  const failed=await refreshDueSources({sources:[{id:"rugby",fetch:async()=>{throw new Error("upstream unavailable");}}],store,now});
  assert.equal(failed.failed.length,1);
  assert.equal(rows.get("rugby").fixtures[0].homeScore,7,"a failed refresh keeps the last good score");
  rows.get("rugby").nextDueAt=0;
  await refreshDueSources({sources:[{id:"rugby",fetch:async()=>({invalid:true})}],store,now});
  assert.equal(rows.get("rugby").fixtures.length,2,"malformed responses cannot clear the snapshot");
  rows.get('rugby').nextDueAt=0;
  const mixed=await refreshDueSources({sources:[{id:'rugby',fetch:async()=>[null,{...event,id:'new-fixture',status:'live'}]}],store,now});
  assert.deepEqual(mixed.refreshed,['rugby'],'one invalid record must not suppress another new followed fixture');
  assert(rows.get('rugby').fixtures.some(row=>row.id==='new-fixture'));
  console.log("Live fixtures: due cadence, coalescing, revisions and last-good preservation passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
