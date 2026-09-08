'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
async function ladder({cursor=0}={},user=null,{request=supabaseServiceRequest}={}){
  const offset=Math.max(0,Math.min(1000000,Number.parseInt(cursor,10)||0));
  const payload=await request('/rest/v1/rpc/nothingsports_nsc_ladder',{method:'POST',body:{viewer_user_id:user?.id||null,page_offset:offset,page_size:25}});
  return {...payload,schemaVersion:'nothing-score-ladder.v1',signedIn:Boolean(user),cursor:offset};
}
module.exports={ladder};
