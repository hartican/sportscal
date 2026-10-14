'use strict';
// Archive owns its schema/RPCs. Media shares the existing refresh owner and
// changes only highlights, never frozen editorial, ratings or Feed admission.
const {supabaseServiceRequest}=require('./supabase-server');
async function candidates({request=supabaseServiceRequest,after='',signal}={}){
  try{
    const rows=await request('/rest/v1/rpc/nothingsports_referenced_classics',{method:'POST',body:{after_event:after,page_limit:201},timeoutMs:3000,signal});
    if(!Array.isArray(rows)||rows.length>201)throw Error('Invalid archive highlights page');
    const page=rows.slice(0,200);return {fixtures:page.map(row=>({...row.fixture,id:row.event_id,canonicalEventId:row.event_id})),nextCursor:rows.length>200?page.at(-1).event_id:'',state:'available'};
  }catch(error){return {fixtures:[],nextCursor:after,state:[400,404].includes(error.status)?'archive-not-ready':'archive-unavailable'};}
}
async function publish(records,archives,{request=supabaseServiceRequest,signal}={}){
  const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
  const index=new Map(archives.flatMap(e=>aliases(e).map(id=>[id,e])));let changed=0,failed=0;
  for(const record of records){
    const archive=aliases(record).map(id=>index.get(id)).find(Boolean);
    if(!archive||record.highlights!==null&&!mediaContract(record.highlights)||JSON.stringify(archive.highlights)===JSON.stringify(record.highlights))continue;
    try{const result=await request('/rest/v1/rpc/nothingsports_hydrate_classic_highlights',{method:'POST',body:{p_event_id:archive.canonicalEventId||archive.id,p_record:record.highlights},timeoutMs:3000,signal});if(result===true)changed++;}catch{failed++;}
  }
  return {changed,failed};
}
function mediaContract(record){return require('../config/fixture-highlights').valid(record);}
// Read-only static fallback for older snapshots; an explicit withdrawal or a
// newer stored record always wins. This performs no provider/database work.
async function hydrate(fixtures){return fixtures.map(fixture=>Object.hasOwn(fixture,'highlights')?fixture:require('./fixture-highlights').applyCached([fixture])[0]);}
module.exports={candidates,publish,hydrate};
