'use strict';

// Public identity labels are independent of personalised fixture responses.
// Keep the existing index facts/date; this is a retained-data projection.
function footballIdentityIndex(index, chunk){
 if(index?.schemaVersion!=='football-follow-index.v1'||chunk?.schemaVersion!=='follow-directory-chunk.v1'||chunk.sportKey!=='football'||!Array.isArray(chunk.records)||!chunk.records.length)throw Error('Invalid Football identity projection input');
 const seen=new Set();
 const identities=chunk.records.map(({id,displayName})=>{
  if(!/^(team|player|athlete|competitor):football:/.test(id)||typeof displayName!=='string'||!displayName.trim()||seen.has(id))throw Error('Incomplete or ambiguous Football identity projection');
  seen.add(id);return {id,displayName};
 }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 return {...index,identities};
}
module.exports={footballIdentityIndex};
