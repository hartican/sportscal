'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
async function list({audience='following',search='',cursor=0}={},user=null,{request=supabaseServiceRequest}={}){
 const offset=Number(cursor);
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw Object.assign(new Error('Invalid directory page.'),{status:400});
 const scope=audience==='all'?'all':'following';
 if(scope==='following'&&!user)return {schemaVersion:'yurters.v1',entries:[],nextCursor:null,signedIn:false};
 const result=await request('/rest/v1/rpc/nothingsports_yurters',{method:'POST',body:{viewer_user_id:user?.id||null,audience:scope,search_text:String(search).trim().replace(/^@/,'').slice(0,80),page_offset:offset}});
 return {...result,schemaVersion:'yurters.v1',signedIn:Boolean(user)};
}
module.exports={list};
