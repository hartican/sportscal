"use strict";
// ISOLATED DRAFT. Not imported/selected by any production caller.
const v1=require('./fixture-source-groups');
const SCHEMA='fixture-source-groups.v2',CANDIDATE=Object.freeze({name:'fixture-source-groups.v2'}),HEADERS=Object.freeze({'x-ns-fixture-source-groups':'v2'});
const own=(v,k)=>Object.hasOwn(v,k),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>own(v,k));
const fail=()=>{throw Error('Invalid dictionary fixture transport');};
function encode(bundle){
 v1.decode(bundle); // Exact existing v1 structural validation; no input mutation.
 const fixtureKeys=[...new Set(bundle.groups.flatMap(g=>g.edges.flatMap(e=>Object.keys(e.fixture))))].sort();
 const keyIndex=new Map(fixtureKeys.map((key,i)=>[key,i]));
 return {schemaVersion:SCHEMA,complete:bundle.complete,groupCount:bundle.groupCount,edgeCount:bundle.edgeCount,fixtureKeys,groups:bundle.groups.map(g=>({fixture_id:g.fixture_id,edges:g.edges.map(e=>({source_id:e.source_id,ordinal:e.ordinal,identity_keys:e.identity_keys,fixture:[Object.keys(e.fixture).map(k=>keyIndex.get(k)),Object.values(e.fixture)]}))}))};
}
function decodeValidated(bundle,{textBytes}={},rowsOnly=false){
 // textBytes is from the trusted SDK's actual complete decoded UTF8 text receipt,
 // never a client/body field. This draft does not wire a caller or change caps.
 if(!Number.isSafeInteger(textBytes)||textBytes<=0||textBytes>v1.LIMITS.bytes||!exact(bundle,['schemaVersion','complete','groupCount','edgeCount','fixtureKeys','groups'])||bundle.schemaVersion!==SCHEMA||bundle.complete!==true||!Array.isArray(bundle.fixtureKeys)||!Array.isArray(bundle.groups)||!Number.isSafeInteger(bundle.edgeCount)||bundle.edgeCount<0||bundle.edgeCount>v1.LIMITS.edges||!Number.isSafeInteger(bundle.groupCount)||bundle.groupCount<0||bundle.groupCount>v1.LIMITS.groups||bundle.groups.length!==bundle.groupCount)fail();
 // Every index/value pair costs at least four text bytes (index, value and
 // separators). Bound property-slot allocation by existing input/capacity, not
 // dictionaryLength * edgeCount expansion. Nested JSON values remain shared.
 const pairLimit=Math.floor(textBytes/4);
 if(bundle.fixtureKeys.length>pairLimit)fail();
 const unique=new Set(),serializedKeyBytes=[];let keyBytes=0;
 for(const key of bundle.fixtureKeys){if(typeof key!=='string'||unique.has(key))fail();unique.add(key);keyBytes+=Buffer.byteLength(key);serializedKeyBytes.push(Buffer.byteLength(JSON.stringify(key))+1);if(keyBytes>textBytes)fail();}
 // Metadata validation uses the ORIGINAL v1 validator, with bounded empty
 // fixtures. This checks all source/group/edge/order/identity limits first.
 const metadata={schemaVersion:v1.SCHEMA,complete:true,groupCount:bundle.groupCount,edgeCount:bundle.edgeCount,groups:[]};
 for(const group of bundle.groups){
  if(!exact(group,['fixture_id','edges'])||!Array.isArray(group.edges)||group.edges.length>v1.LIMITS.perKey)fail();
  const edges=[];
  for(const edge of group.edges){if(!exact(edge,['source_id','ordinal','identity_keys','fixture']))fail();edges.push({...edge,fixture:{}});}
  metadata.groups.push({fixture_id:group.fixture_id,edges});
 }
 const validatedRows=v1.decode(metadata);
 let pairs=0,expandedKeyBytes=0;const used=new Set();
 for(const group of bundle.groups)for(const edge of group.edges){
  const packed=edge.fixture;if(!Array.isArray(packed)||packed.length!==2||!Array.isArray(packed[0])||!Array.isArray(packed[1])||packed[0].length!==packed[1].length)fail();
  pairs+=packed[0].length;if(pairs>pairLimit)fail();const indices=new Set();
  for(const i of packed[0]){if(!Number.isSafeInteger(i)||i<0||i>=bundle.fixtureKeys.length||indices.has(i))fail();indices.add(i);used.add(i);expandedKeyBytes+=serializedKeyBytes[i];if(expandedKeyBytes>v1.LIMITS.bytes)fail();}
 }
 if(used.size!==bundle.fixtureKeys.length)fail(); // Producer emits no unused keys.
 // Allocate actual fixture properties only AFTER all edge/pair limits validate.
 const restore=edge=>Object.fromEntries(edge.fixture[0].map((index,i)=>[bundle.fixtureKeys[index],edge.fixture[1][i]]));
 if(rowsOnly){
  for(const group of bundle.groups)for(const edge of group.edges)validatedRows.rows[edge.ordinal].fixture=restore(edge);
  return validatedRows;
 }
 return {schemaVersion:v1.SCHEMA,complete:true,groupCount:bundle.groupCount,edgeCount:bundle.edgeCount,groups:bundle.groups.map(group=>({fixture_id:group.fixture_id,edges:group.edges.map(edge=>{
  const fixture=restore(edge);
  return {source_id:edge.source_id,ordinal:edge.ordinal,identity_keys:edge.identity_keys,fixture};
 })}))};
}
const decode=(bundle,options)=>decodeValidated(bundle,options);
const decodeRows=(bundle,options)=>decodeValidated(bundle,options,true);
module.exports={SCHEMA,CANDIDATE,HEADERS,LIMITS:v1.LIMITS,byteBudget:v1.byteBudget,encode,decode,decodeRows};
