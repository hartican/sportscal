"use strict";
const {authenticatedUser,bearerToken,supabaseServiceRequest,publicError,SupabaseRequestError}=require('./supabase-server');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(){return new SupabaseRequestError('Invalid notification request.',{status:400,payload:{code:'invalid_inbox_request'}});}
module.exports=async function inbox(request,response){
 response.setHeader('Cache-Control','private, no-store');response.setHeader('Vary','Authorization');
 try{
  const user=await authenticatedUser(bearerToken(request));
  if(user.is_anonymous)throw new SupabaseRequestError('Sign in to view notifications.',{status:403,payload:{code:'account_required'}});
  if(request.method==='POST'){
   let body;try{body=typeof request.body==='string'?JSON.parse(request.body):request.body;}catch{throw invalid();}
   if(!Array.isArray(body?.seen)||body.seen.length>25||body.seen.some(x=>!UUID.test(x.id)||!Number.isSafeInteger(x.version)||x.version<1))throw invalid();
   await supabaseServiceRequest('/rest/v1/rpc/nothingsports_inbox_read',{method:'POST',body:{target_user:user.id,seen:body.seen}});
   return response.status(200).json({ok:true});
  }
  if(request.method!=='GET'){response.setHeader('Allow','GET, POST');return response.status(405).json({error:'Method not allowed.'});}
  const q=new URL(request.url||'/api/inbox','https://nothingsport.invalid').searchParams;
  for(const key of ['cursor','summary'])if(request.query?.[key]!=null){if(Array.isArray(request.query[key]))throw invalid();q.set(key,String(request.query[key]));}
  let cursor=null;
  if(q.has('cursor')){if(q.get('cursor').length>256)throw invalid();try{cursor=JSON.parse(Buffer.from(q.get('cursor'),'base64url').toString());}catch{throw invalid();}
   if(!UUID.test(cursor?.id)||!Number.isFinite(Date.parse(cursor?.at)))throw invalid();}
  const result=await supabaseServiceRequest('/rest/v1/rpc/nothingsports_inbox_page',{method:'POST',body:{target_user:user.id,before_time:cursor?.at||null,before_id:cursor?.id||null,summary_only:q.get('summary')==='1'}});
  const items=(result?.items||[]).slice(0,25),last=items.at(-1);
  return response.status(200).json({items,unreadCount:Number(result?.unreadCount||0),nextCursor:result?.items?.length>25?Buffer.from(JSON.stringify({at:last.at,id:last.id})).toString('base64url'):null});
 }catch(error){const out=publicError(error);response.status(out.status).json(out.body);}
};
