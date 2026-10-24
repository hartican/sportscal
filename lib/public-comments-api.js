'use strict';
const policy=require('../config/public-comments'),epic=require('../config/epic-classics');
const {authenticatedUser,bearerToken,supabaseServiceRequest,publicError}=require('./supabase-server');
const {normalizedGiphyReference}=require('./giphy-provider');
class CommentError extends Error{constructor(message,status=400,code='invalid_public_comment_request'){super(message);Object.assign(this,{status,code});}}
const invalid=()=>new CommentError('Invalid comment request.');
function identifier(value){if(typeof value!=='string'||!/^[A-Za-z0-9_:./-]{1,180}$/.test(value))throw invalid();return value;}
function parseCursor(value){if(!value)return undefined;try{if(value.length>1024)throw Error();const c=JSON.parse(Buffer.from(value,'base64url').toString());if(!policy.uuid(c.id)||!Number.isSafeInteger(c.score)||!Number.isSafeInteger(c.revision)||c.revision<0||typeof c.at!=='string'||!Number.isFinite(Date.parse(c.at)))throw Error();return c;}catch{throw invalid();}}
function createHandler({authenticate=req=>authenticatedUser(bearerToken(req)),requestImpl=supabaseServiceRequest,api=null,now=()=>new Date(),onWrite=null}={}){
 return async function handle(request,response){
  response.setHeader('Cache-Control','private, no-store');response.setHeader('Vary','Authorization');
  try{
   const method=request.method||'GET';if(!['GET','POST'].includes(method))throw new CommentError('Use GET or POST.',405);
   const user=await authenticate(request);if(!user?.id||user.is_anonymous===true)throw new CommentError('Sign in to read and leave public comments.',401,'account_required');
   const q=Object.fromEntries(new URL(request.url||'/api/chat','https://nothingsport.invalid').searchParams);
   for(const key of ['eventId','cursor','parentId','after','roomId','before','q'])if(request.query?.[key]!==undefined){if(Array.isArray(request.query[key]))throw invalid();q[key]=String(request.query[key]);}
   q.eventId ||= q.roomId;q.cursor ||= q.before;q.parentId ||= q.q;
   let input={};if(method==='POST'){try{input=typeof request.body==='string'?JSON.parse(request.body):request.body;}catch{throw invalid();}if(!input||typeof input!=='object'||Array.isArray(input)||Buffer.byteLength(JSON.stringify(input))>32768)throw invalid();}
   const known=new Set(['action','eventId','id','body','clientId','parentId','gif','value']);if(Object.keys(input).some(key=>!known.has(key)))throw invalid();
   if(/^public-comment-(post|vote|delete)$/.test(input.action||''))input={...input,action:input.action.slice(15)};
   const server=api||require('./nothingscore-server'),requested=identifier(method==='POST'?input.eventId:q.eventId),event=server.eventFor(requested);
   const fixturePolicy=require('../config/follow-feed-policy');
   if(!event||!fixturePolicy.sportingFixture(event)||fixturePolicy.multiDayMarker(event)||!fixturePolicy.feedEligibleSession(event))throw new CommentError('Fixture not found.',404,'fixture_not_found');
   if(epic.retired(event,now()))throw new CommentError('Comments have retired with this fixture.',410,'public_comments_retired');
   const eventId=identifier(server.canonicalEventId(event.eventId||event.id)),command={action:method==='POST'?input.action:q.after===undefined?'page':'changes'};
   if(method==='POST'){
    if(!['post','vote','delete'].includes(command.action))throw invalid();
    if(command.action==='post'){
     if(!policy.uuid(input.clientId)||input.parentId!=null&&!policy.uuid(input.parentId)||input.body!=null&&typeof input.body!=='string')throw invalid();
     command.clientId=input.clientId;command.body=policy.text(input.body||'');if(input.parentId)command.parentId=input.parentId;
     if(input.gif!=null)command.gif=normalizedGiphyReference(input.gif,(m,s,c)=>new CommentError(m,s,c));
     if(!command.body&&!command.gif)throw new CommentError('Write a comment or choose a GIF.');
     command.fixture=require('./epic-classics').recordFor(event,{now:now()}).fixture;
    }else{if(!policy.uuid(input.id))throw invalid();command.id=input.id;if(command.action==='vote')command.value=policy.vote(input.value);}
   }else{
    if(q.parentId){if(!policy.uuid(q.parentId))throw invalid();command.parentId=q.parentId;}
    if(q.after!==undefined){if(!/^\d{1,15}$/.test(q.after))throw invalid();command.after=Number(q.after);}
    const cursor=parseCursor(q.cursor);if(cursor)command.cursor=cursor;
   }
   const result=await requestImpl('/rest/v1/rpc/nothingsports_public_comments',{method:'POST',body:{target_user:user.id,target_fixture:eventId,command}});
   if(command.action==='post'&&!result.replayed){const work=()=>require('./public-comment-alerts').dispatch({api:server,request:requestImpl});try{const pending=Promise.resolve().then(work).catch(()=>{});if(onWrite)onWrite(pending);else require('@vercel/functions').waitUntil(pending);}catch{/* The durable outbox is retried by the existing dispatcher. */}}
   response.status(200).json({...result,schemaVersion:policy.SCHEMA_VERSION,eventId,...(result.nextCursor?{nextCursor:Buffer.from(JSON.stringify(result.nextCursor)).toString('base64url')}:{})});
  }catch(error){
   const message=String(error.payload?.message||error.message||''),codes={public_comment_rate_limit:[429,'Slow down and try again shortly.'],public_comment_invalid_parent:[400,'Reply to a top-level comment on this fixture.'],public_comment_id_conflict:[409,'This comment changed. Reload before retrying.'],public_comment_cursor_changed:[409,'Comments changed. Refresh the discussion.'],public_comment_not_owned:[403,'You can delete only your own comments.'],public_comment_handle_required:[409,'Create a public @handle before commenting.'],public_comment_gif_locked:[403,'GIFs unlock at 25 lifetime NSC points.'],public_comment_account_unavailable:[403,'This account cannot use comments.'],public_comment_not_found:[404,'Comment not found.'],public_comments_retired:[410,'Comments have retired with this fixture.']};
   const entry=Object.entries(codes).find(([key])=>message.includes(key));if(entry){response.status(entry[1][0]).json({error:entry[1][1],code:entry[0]});return;}
   if(error instanceof CommentError){response.status(error.status).json({error:error.message,code:error.code});return;}
   if(error instanceof Error&&/500 characters|Choose an upvote/.test(error.message)){response.status(400).json({error:error.message,code:'invalid_public_comment_request'});return;}
   const out=publicError(error);response.status(out.status||503).json(out.body);
  }
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
