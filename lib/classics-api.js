'use strict';
const db=require('./epic-classics'),{authenticatedUser,bearerToken,supabaseServiceRequest}=require('./supabase-server');
class ClassicsError extends Error{constructor(message,status=400,code='invalid_classics_request'){super(message);this.status=status;this.code=code;}}
const id=value=>{const v=String(value||'');if(!/^[A-Za-z0-9_:./-]{1,180}$/.test(v))throw new ClassicsError('Invalid fixture.');return v;};
const year=value=>{const v=Number(value);if(!Number.isInteger(v)||v<1900||v>2200)throw new ClassicsError('Invalid review year.');return v;};
function body(request){if(request.body&&typeof request.body==='object')return request.body;try{return JSON.parse(request.body||'{}');}catch{throw new ClassicsError('Invalid request.');}}
function createHandler({requestImpl=supabaseServiceRequest,authenticate=async req=>authenticatedUser(bearerToken(req)),now=()=>new Date()}={}){
 const rows=async(table,query)=>await requestImpl(db.path(table,query));
 const hydrate=async fixtures=>{try{const result=await require('./highlight-archives').hydrate(fixtures);return Array.isArray(result)&&result.length===fixtures.length?result:fixtures;}catch{return fixtures;}}; // Optional cached media cannot block owned editorial.
 return async function handle(request,response){
 response.setHeader('Cache-Control','private, no-store');response.setHeader('Vary','Authorization');
 try{
  if(!['GET','POST'].includes(request.method||'GET'))throw new ClassicsError('Use GET or POST.',405);
  const user=await authenticate(request);if(!user||user.is_anonymous)throw new ClassicsError('Sign in to keep your classics.',401,'sign_in_required');
  const url=new URL(request.url||'/api/classics','https://nothingsport.local'),q=Object.fromEntries(url.searchParams),clock=now();
  for(const key of ['cursor','year','eventId','results','removed','review','settings','years'])if(request.query?.[key]!==undefined){if(Array.isArray(request.query[key]))throw new ClassicsError('Invalid archive query.');q[key]=String(request.query[key]);}
  if((request.method||'GET')==='POST'){
   const input=body(request);if(Buffer.byteLength(JSON.stringify(input))>120000)throw new ClassicsError('This review is too large.',413);
   const action=input.action;
   if(action==='curator-assign'){
    if(typeof input.enabled!=='boolean')throw new ClassicsError('Choose whether to assign or remove the curator.');
    const handle=String(input.handle||'').replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(handle))throw new ClassicsError('Enter an existing NS handle.');
    const targets=await rows('nsc_profiles',{handle:'eq.'+handle,select:'user_id',limit:'1'});if(!targets.length)throw new ClassicsError('Account not found.',404);
    const result=await db.rpc('assign_fixture_curator',{actor:user.id,target:targets[0].user_id,enabled:input.enabled===true},requestImpl);
    response.status(200).json(result);return;
   }
   const command={action};
   if(['remove','save'].includes(action)){command.eventId=id(input.eventId);command.revision=Number(input.revision);if(!Number.isInteger(command.revision)||command.revision<0)throw new ClassicsError('Reload this classic before changing it.');}
   else if(['review-save','review-seen'].includes(action)){command.year=year(input.year);if(action==='review-save'){if(!Array.isArray(input.selection)||input.selection.length>100)throw new ClassicsError('Select up to 100 classic fixtures.');const seen=new Set();command.selection=input.selection.map(item=>{const eventId=id(item.eventId);if(seen.has(eventId))throw new ClassicsError('Each fixture can appear once.');seen.add(eventId);return{eventId,note:String(item.note||'').slice(0,1000)};});if(Buffer.byteLength(JSON.stringify(command.selection))>100000)throw new ClassicsError('This review is too large. Reduce the notes or selected fixtures.',413);command.caption=String(input.caption||'').slice(0,4000);command.revision=Number(input.revision);if(!Number.isInteger(command.revision)||command.revision<0)throw new ClassicsError('Reload this review before saving.');}}
   else if(action==='notifications'){if(typeof input.enabled!=='boolean')throw new ClassicsError('Choose on or off.');command.enabled=input.enabled;}
   else if(action==='purge'){if(!Array.isArray(input.ids)||input.ids.length>500)throw new ClassicsError('Purge at most 500 cards at a time.');command.ids=[...new Set(input.ids.map(id))];}
   else throw new ClassicsError('Unknown archive action.');
   response.status(200).json(await db.rpc('classic_mutation',{target_user:user.id,command},requestImpl));return;
  }
  if(q.years==='1'){response.status(200).json({years:await db.rpc('classic_years',{target_user:user.id},requestImpl)});return;}
  if(q.settings==='1'){
   const values=await rows('classic_settings',{user_id:'eq.'+user.id,select:'year_review_enabled',limit:'1'});response.status(200).json({yearReviewEnabled:values[0]?.year_review_enabled!==false});return;
  }
  if(q.eventId){
   const eventId=id(q.eventId),owned=await rows('personal_classics',{user_id:'eq.'+user.id,event_id:'eq.'+eventId,select:'*',limit:'1'});
   if(!owned.length)throw new ClassicsError('Classic not found.',404);
   const [fixture,editorial]=await Promise.all([rows('classic_fixtures',{event_id:'eq.'+eventId,select:'*',limit:'1'}),rows('classic_editorial',{event_id:'eq.'+eventId,select:'*',order:'captured_at.asc'})]);
   const hydrated=await hydrate([db.safeFixture(fixture[0])]);
   response.status(200).json({schemaVersion:'classics.v1',entry:owned[0],fixture:hydrated[0],editorial:db.safeEditorial(editorial,q.results==='1')});return;
  }
  const parameters={user_id:'eq.'+user.id,removed_at:q.removed==='1'?'not.is.null':'is.null',select:'event_id,qualified_at,qualified_phase,revision,removed_at,classic_fixtures:nothingsports_classic_fixtures(fixture)',order:'qualified_at.desc,event_id.asc',limit:'26'};
  if(q.review==='1'){parameters.select=parameters.select.replace('nothingsports_classic_fixtures(','nothingsports_classic_fixtures!inner(');parameters['classic_fixtures.fixture->>year']='eq.'+year(q.year);parameters['classic_fixtures.fixture->>completed']='eq.true';}
  if(q.cursor){let cursor;try{if(q.cursor.length>1024)throw Error();cursor=JSON.parse(Buffer.from(q.cursor,'base64url').toString());}catch{throw new ClassicsError('Invalid archive cursor.');}if(!/^[0-9T:.Z+-]{10,40}$/.test(cursor.at)||!Number.isFinite(Date.parse(cursor.at)))throw new ClassicsError('Invalid archive cursor.');parameters.or=`(qualified_at.lt.${cursor.at},and(qualified_at.eq.${cursor.at},event_id.gt.${id(cursor.id)}))`;}
  const [entries,roles,settings,accountState]=await Promise.all([rows('personal_classics',parameters),rows('fixture_curators',{user_id:'eq.'+user.id,select:'role',limit:'1'}),rows('classic_settings',{user_id:'eq.'+user.id,select:'year_review_enabled',limit:'1'}),rows('user_state',{user_id:'eq.'+user.id,select:'preferences',limit:'1'})]);
  const page=entries.slice(0,25),last=page.at(-1),reviewYear=q.year?year(q.year):db.policy.reviewYear(clock);
  const reviews=await rows('classic_reviews',{user_id:'eq.'+user.id,year:'eq.'+reviewYear,select:'year,selection,caption,revision,seen_at,invited_at',limit:'1'});
  const review=reviews[0]||{year:reviewYear,selection:[],caption:'',revision:0,seen_at:null};
  const hydrated=await hydrate(page.map(e=>db.safeFixture({event_id:e.event_id,fixture:e.classic_fixtures?.fixture})));
  response.status(200).json({schemaVersion:'classics.v1',entries:page.map((e,index)=>({...e,fixture:hydrated[index],classic_fixtures:undefined})),nextCursor:entries.length>25?Buffer.from(JSON.stringify({at:last.qualified_at,id:last.event_id})).toString('base64url'):null,role:roles[0]?.role||null,yearReviewEnabled:settings[0]?.year_review_enabled!==false,review,invite:accountState[0]?.preferences?.followFirst?.notifications?.enabled!==false&&reviewYear>=2026&&settings[0]?.year_review_enabled!==false&&db.policy.reviewDue(reviewYear,clock)&&!review.seen_at&&page.some(e=>e.classic_fixtures?.fixture?.completed&&e.classic_fixtures.fixture.year===reviewYear)});
 }catch(error){const message=String(error.payload?.message||error.message||''),conflict=/revision_conflict/.test(message),denied=/chief_admin_required|chief_admin_cannot_be_reassigned/.test(message);response.status(conflict?409:denied?403:error.status||503).json({error:conflict?'This archive changed on another device. Reload and retry.':denied?'Only the chief admin can manage curators.':error instanceof ClassicsError?error.message:'Classics are temporarily unavailable. Please retry.',code:conflict?'classic_revision_conflict':denied?'chief_admin_required':error.code||'classics_unavailable'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
