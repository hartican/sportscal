'use strict';
// Constructed protocol producer for local tests only; no source/data collection.
function groupWire(rows,{complete=true}={}){
 const groups=new Map();
 rows.forEach((row,ordinal)=>{
  if(!groups.has(row.fixture_id))groups.set(row.fixture_id,{fixture_id:row.fixture_id,edges:[]});
  groups.get(row.fixture_id).edges.push({source_id:row.source_id,ordinal,identity_keys:row.identity_keys,fixture:row.fixture});
 });
 return {schemaVersion:'fixture-source-groups.v1',complete,groupCount:groups.size,edgeCount:rows.length,groups:[...groups.values()]};
}
function sampleRows({keys=2586,edges=5145}={}){
 const rows=[];
 for(let i=0;i<edges;i++){
  const key='qa:'+String(i%keys).padStart(5,'0'),source='source:'+String(Math.floor(i/keys)).padStart(3,'0');
  rows.push({source_id:source,fixture_id:key,identity_keys:[key,'alias:'+key,null],fixture:{id:key,eventId:key,sourceEventIds:['alias:'+key],key:'nrl',date:'2026-10-26',status:'live',homeScore:i%3,awayScore:0,scoreCheckedAt:i%2?'2026-10-26T00:00:00.123456+00:00':null,statusCheckedAt:'2026-10-26T00:00:01.654321+00:00',sourceName:source,extra:{presentNull:null,zero:0,list:[false,null,'']}}});
 }
 return rows;
}
module.exports={groupWire,sampleRows};
