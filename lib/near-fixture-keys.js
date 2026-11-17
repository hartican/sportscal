'use strict';
// Trusted near RPC wire only. Does not select, deduplicate or trim fixtures.
const SCHEMA='near-fixture-keys.v1';
const LEGACY='current-fixture-bundle.v1';
const CANDIDATE=Object.freeze({name:SCHEMA});
const HEADERS=Object.freeze({'x-ns-near-fixture-keys':'v1'});
const LIMITS=Object.freeze({bytes:4194304,rows:5000});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,k)=>Object.hasOwn(v,k);
const fail=()=>{throw Error('Invalid near fixture key transport');};
function legacy(bundle){
 if(!object(bundle)||bundle.schemaVersion!==LEGACY||bundle.scope!=='match-centre'||bundle.complete!==true||!Array.isArray(bundle.rows)||bundle.rows.length>LIMITS.rows)fail();
 for(const row of bundle.rows)if(!object(row)||typeof row.source_id!=='string'||!row.source_id||!object(row.fixture))fail();
}
function encode(bundle){
 legacy(bundle);
 const fixtureKeys=[...new Set(bundle.rows.flatMap(row=>Object.keys(row.fixture)))];
 const index=new Map(fixtureKeys.map((key,i)=>[key,i]));
 return {schemaVersion:SCHEMA,fixtureKeys,bundleKeys:Object.keys(bundle),metadata:Object.fromEntries(Object.entries(bundle).filter(([key])=>key!=='rows')),rows:bundle.rows.map(row=>({...row,fixture:[Object.keys(row.fixture).map(key=>index.get(key)),Object.values(row.fixture)]}))};
}
function decode(bundle,{textBytes}={}){
 if(!Number.isSafeInteger(textBytes)||textBytes<1||textBytes>LIMITS.bytes||!object(bundle)||bundle.schemaVersion!==SCHEMA||Object.keys(bundle).length!==5||!['schemaVersion','fixtureKeys','bundleKeys','metadata','rows'].every(k=>own(bundle,k))||!object(bundle.metadata)||bundle.metadata.schemaVersion!==LEGACY||bundle.metadata.scope!=='match-centre'||bundle.metadata.complete!==true||own(bundle.metadata,'rows')||!Array.isArray(bundle.bundleKeys)||!Array.isArray(bundle.rows)||bundle.rows.length>LIMITS.rows||!Array.isArray(bundle.fixtureKeys))fail();
 const pairLimit=Math.floor(textBytes/4),names=new Set(),keyCosts=[];
 if(bundle.bundleKeys.length>pairLimit||bundle.bundleKeys.length!==Object.keys(bundle.metadata).length+1||new Set(bundle.bundleKeys).size!==bundle.bundleKeys.length||!bundle.bundleKeys.includes('rows')||bundle.bundleKeys.some(key=>typeof key!=='string'||(key!=='rows'&&!own(bundle.metadata,key))))fail();
 if(bundle.fixtureKeys.length>pairLimit)fail();
 let nameBytes=0;
 for(const key of bundle.fixtureKeys){
  if(typeof key!=='string'||names.has(key))fail();
  names.add(key);nameBytes+=Buffer.byteLength(key);keyCosts.push(Buffer.byteLength(JSON.stringify(key))+1);
  if(nameBytes>textBytes)fail();
 }
 let pairs=0,expandedKeyBytes=0;const used=new Set();
 for(const row of bundle.rows){
  if(!object(row)||typeof row.source_id!=='string'||!row.source_id||!own(row,'fixture'))fail();
  const packed=row.fixture;
  if(!Array.isArray(packed)||packed.length!==2||!Array.isArray(packed[0])||!Array.isArray(packed[1])||packed[0].length!==packed[1].length)fail();
  pairs+=packed[0].length;if(pairs>pairLimit)fail();
  const seen=new Set();
  for(const i of packed[0]){
   if(!Number.isSafeInteger(i)||i<0||i>=bundle.fixtureKeys.length||seen.has(i))fail();
   seen.add(i);used.add(i);expandedKeyBytes+=keyCosts[i];if(expandedKeyBytes>LIMITS.bytes)fail();
  }
 }
 if(used.size!==bundle.fixtureKeys.length)fail();
 // Validate the complete allocation before constructing any fixture properties.
 // Object.fromEntries creates own data properties safely for __proto__/constructor.
 const rows=bundle.rows.map(row=>{
  const result=Object.fromEntries(Object.entries(row));
  result.fixture=Object.fromEntries(row.fixture[0].map((index,i)=>[bundle.fixtureKeys[index],row.fixture[1][i]]));
  return result;
 });
 const result=Object.fromEntries(bundle.bundleKeys.map(key=>[key,key==='rows'?rows:bundle.metadata[key]]));
 legacy(result);return result;
}
module.exports={SCHEMA,LEGACY,CANDIDATE,HEADERS,LIMITS,encode,decode};
