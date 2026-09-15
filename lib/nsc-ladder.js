'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
async function ladder({cursor=0,audience='global',sort='points',search=''}={},user=null,{request=supabaseServiceRequest}={}){
 const offset=Math.max(0,Math.min(1000000,Number.parseInt(cursor,10)||0));
 const payload=await request('/rest/v1/rpc/nothingsports_leaderboard_v2',{method:'POST',body:{viewer_user_id:user?.id||null,audience:audience==='friends'?'friends':'global',sort_by:sort==='efficiency'?'efficiency':'points',search_text:String(search).trim().replace(/^@/,'').slice(0,80),page_offset:offset}});
 return {...payload,schemaVersion:'nothinger-leaderboard.v2',signedIn:Boolean(user),cursor:offset};
}
module.exports={ladder};
