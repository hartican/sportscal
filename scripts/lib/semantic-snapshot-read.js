'use strict';
const assert=require('node:assert/strict');
const {createSnapshotStore}=require('../../lib/live-fixtures');

// SQL/output equivalence only: PGlite/WASM execution is not HTTP latency.
// Materialize the same SQL resources before starting the real store's budget.
// Keep route/body binding, two-resource cardinality and store validation intact.
// Deadline, cancellation, SQL-work and hosted latency tests remain separate.
module.exports=async function semanticSnapshotRead({load,resources,options={},inspect=()=>{},timer}){
 assert.equal(resources.length,2,'Semantic snapshot still requires exactly two SQL resources');
 assert.equal(new Set(resources.map(r=>r.route)).size,2,'Resources must have distinct routes');
 const packets=await Promise.all(resources.map(async resource=>({...resource,value:await load(resource.route,{body:resource.body})})));
 const seen=new Set();
 const result=await createSnapshotStore({...(timer?{timer}:{}),request:async(route,requestOptions)=>{
  inspect(route,requestOptions);
  const packet=packets.find(p=>p.route===route);
  assert(packet,'Actual store requested an unprepared SQL route: '+route);
  assert(!seen.has(route),'Actual store cannot repeat a prepared SQL read');
  seen.add(route);
  assert.deepEqual(requestOptions.body,packet.body,'Actual store must retain the SQL selection and alias parameters');
  return packet.value;
 }}).read(options);
 assert.equal(seen.size,2,'Actual store must consume both prepared SQL resources');
 return result;
};
