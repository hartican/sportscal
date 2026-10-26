'use strict';

// PROPOSED, trusted service-only prototype. No production caller opts in.
const SCHEMA='fixture-source-groups.v1';
const CANDIDATE=Object.freeze({name:SCHEMA});
const HEADERS=Object.freeze({'x-ns-fixture-source-groups':'v1'});
const LIMITS=Object.freeze({groups:5000,edges:10000,perKey:16,bytes:16*1024*1024});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const textArray=value=>value===null||Array.isArray(value)&&value.every(item=>typeof item==='string'||textArray(item));
const exactKeys=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

function byteBudget(){
 const seen=new Map();let invalid=false;
 return {
  observe(leg,entry){
   if(entry?.phase!=='text-ready')return;
   if(!['source-health','fixture-bundle'].includes(leg)||seen.has(leg)||!integer(entry.bytes))invalid=true;
   else seen.set(leg,entry.bytes);
  },
  check(){
   if(invalid||seen.size!==2||[...seen.values()].reduce((sum,n)=>sum+n,0)>LIMITS.bytes)throw Error('Invalid grouped fixture transport byte budget');
  }
 };
}

function decode(bundle){
 if(!exactKeys(bundle,['schemaVersion','complete','groupCount','edgeCount','groups'])||bundle.schemaVersion!==SCHEMA||bundle.complete!==true||!integer(bundle.groupCount)||bundle.groupCount>LIMITS.groups||!integer(bundle.edgeCount)||bundle.edgeCount>LIMITS.edges||!Array.isArray(bundle.groups)||bundle.groups.length!==bundle.groupCount)throw Error('Incomplete grouped fixture bundle');
 const groupIds=new Set(),ordinals=new Set();let edges=0;
 // Validate every edge and every capacity before allocating reconstructed rows.
 for(const group of bundle.groups){
  if(!exactKeys(group,['fixture_id','edges'])||typeof group.fixture_id!=='string'||!group.fixture_id||groupIds.has(group.fixture_id)||!Array.isArray(group.edges)||!group.edges.length||group.edges.length>LIMITS.perKey)throw Error('Invalid grouped fixture key');
  groupIds.add(group.fixture_id);const sources=new Set();
  for(const edge of group.edges){
   if(!exactKeys(edge,['source_id','ordinal','identity_keys','fixture'])||typeof edge.source_id!=='string'||!edge.source_id||sources.has(edge.source_id)||!integer(edge.ordinal)||edge.ordinal>=bundle.edgeCount||ordinals.has(edge.ordinal)||!textArray(edge.identity_keys)||!object(edge.fixture))throw Error('Invalid grouped fixture edge');
   sources.add(edge.source_id);ordinals.add(edge.ordinal);edges++;
  }
 }
 if(edges!==bundle.edgeCount||ordinals.size!==edges)throw Error('Invalid grouped fixture edge count');
 const rows=new Array(edges);
 for(const group of bundle.groups)for(const edge of group.edges)rows[edge.ordinal]={source_id:edge.source_id,fixture_id:group.fixture_id,identity_keys:edge.identity_keys,fixture:edge.fixture};
 return {schemaVersion:'current-fixture-bundle.v1',complete:true,rows};
}

module.exports={SCHEMA,CANDIDATE,HEADERS,LIMITS,byteBudget,decode};
