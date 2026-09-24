"use strict";

const crypto=require("node:crypto");

const {
  SupabaseRequestError, authenticatedUser, bearerToken, publicError, supabaseConfig, supabaseServiceRoleConfig, supabaseServiceRequest,
} = require("./supabase-server");
const nsc = require("../config/nothingscore");
const server = require("./nothingscore-server");

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class NscError extends Error{constructor(message,status=400,code="invalid_nothingscore_request"){super(message);this.status=status;this.code=code;}}
function clean(value,maximum=500){return String(value==null?"":value).trim().slice(0,maximum)}
function fullDisplayName(value){const parts=clean(value,80).split(/\s+/u).filter(Boolean);return parts.length>=2&&parts.every(part=>[...part].length>=2)}
function bodyOf(request){if(request?.body&&typeof request.body==="object")return request.body;try{return JSON.parse(request?.body||"{}")}catch(_error){return{}}}
function query(request,name){if(request?.query&&Object.hasOwn(request.query,name)){const value=request.query[name];return Array.isArray(value)?value[0]:value}try{return new URL(request?.url||"/api/nothingscore","https://nothingsport.vercel.app").searchParams.get(name)||""}catch(_error){return""}}
function privateHeaders(response){response.setHeader("Cache-Control","private, no-store, max-age=0");response.setHeader("Vary","Authorization")}
async function optionalUser(request){const token=bearerToken(request);return token?authenticatedUser(token):null}
function accountUser(user){return user&&user.is_anonymous!==true?user:null}
async function requireContributor(user){
  const profile=await server.profileFor(user.id);
  const persona=await server.personaFor(user.id);
  if(persona.moderation_flag)throw new NscError("This profile is paused from contributing.",403,"profile_moderated");
  return {profile,persona};
}
function requireEvent(eventId){const requestedId=clean(eventId,180),event=server.eventFor(requestedId);if(!event)throw new NscError("Canonical fixture not found.",404,"fixture_not_found");return{id:server.canonicalEventId(requestedId),event}}
async function currentSession(eventId){return(await server.rows(server.TABLES.sessions,{event_id:`eq.${eventId}`,select:"*",limit:"1"}))[0]||null}
async function currentPhase(eventId,event,now=new Date()){
  let session=await currentSession(eventId);
  if(session?.status==="active"&&Date.parse(session.effective_end_at)<=now.getTime())session=await server.freezeSession(eventId,now.toISOString());
  return {phase:require('./nsc-crowd').phaseFor(event,now),session};
}
async function postProfile(body,user){
  const handle=nsc.normaliseHandle(body.handle),displayName=clean(body.displayName,80);
  if(!handle||!fullDisplayName(displayName))throw new NscError("Choose a 3–24 character lowercase handle and a full display name.",400,"invalid_public_profile");
  try{
    await supabaseServiceRequest(server.rowsPath(server.TABLES.profiles,{on_conflict:"user_id"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{user_id:user.id,handle,display_name:displayName,visibility:"visible",updated_at:new Date().toISOString()}});
  }catch(error){if(error instanceof SupabaseRequestError&&error.payload?.code==="23505")throw new NscError("That handle is already in use.",409,"handle_taken");throw error}
  return{profile:{displayName,handle:`@${handle}`,visibility:"visible"}};
}
async function uploadAvatar(body,user){
  // Compatibility for installed clients from before the direct-upload release.
  const match=String(body.dataUrl||"").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)throw new NscError("Choose a JPEG, PNG or WebP picture, or refresh for more formats.",400,"invalid_profile_avatar");
  const bytes=Buffer.from(match[2],"base64");
  if(!bytes.length||bytes.length>1024*1024)throw new NscError("Refresh the app to upload pictures up to 6 MB.",413,"profile_avatar_too_large");
  const avatars=require('./profile-avatars');
  const upload=await avatars.prepare({byteSize:bytes.length},user);
  await avatars.storage(avatars.ORIGINAL,`${user.id}/${upload.uploadId}`,{method:'POST',headers:{'Content-Type':`image/${match[1]}`},body:bytes});
  return avatars.complete(upload,user);
}

async function setVisibility(body,user){
  const visibility=clean(body.visibility,20);if(!["visible","hidden","deleted"].includes(visibility))throw new NscError("Choose visible, hidden or deleted.",400,"invalid_profile_visibility");
  const patch={visibility,updated_at:new Date().toISOString()};
  if(visibility==="deleted")Object.assign(patch,{display_name:"Deleted contributor",handle:`deleted_${user.id.replaceAll("-","").slice(0,16)}`});
  await supabaseServiceRequest(server.rowsPath(server.TABLES.profiles,{user_id:`eq.${user.id}`}),{method:"PATCH",headers:{Prefer:"return=minimal"},body:patch});
  if(visibility==="deleted")await require("./profile-avatars").cleanup({limit:8}).catch(()=>{});
  return{visibility};
}
async function ratingAction(body,user,_access,now){
  const{id,event}=requireEvent(body.eventId),state=await currentPhase(id,event,now);
  const requestedPhase=clean(body.phase,20);
  if(!["heat","impact"].includes(requestedPhase))throw new NscError("Choose a pre-fixture view or Impact before submitting.",400,"invalid_nsc_phase");
  const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw new NscError("Choose a rating from 1 to 5.",400,"invalid_rating");
  const tags=nsc.validTags(requestedPhase,rating,body.tags);
  if(requestedPhase!==state.phase){
    const existing=(await server.rows(server.TABLES.contributions,{event_id:`eq.${id}`,user_id:`eq.${user.id}`,phase:`eq.${requestedPhase}`,bucket_start:"eq.1970-01-01T00:00:00.000Z",select:"*",limit:"1"}))[0]||null;
    if(existing&&Number(existing.rating)===rating)return{eventId:id,phase:requestedPhase,rating,tags:existing.tags||tags,submitted:true,submittedAt:existing.submitted_at||existing.updated_at||null,pointsAwarded:0,basePointsAwarded:0,replayed:true};
    if(existing)throw new NscError("A pre-fixture view or Impact has already been submitted for this fixture.",409,"nsc_already_submitted");
    throw new NscError('That scoring phase has ended. Refresh before submitting.',409,'phase_action_mismatch');
  }

  try{return await require('./nsc-rewards').submit(user.id,id,requestedPhase,rating,event,now)}
  catch(error){
    if(error instanceof SupabaseRequestError&&[error.message,error.payload?.message,error.payload?.details].some(value=>String(value||"").includes("nsc_already_submitted")))throw new NscError("A pre-fixture view or Impact has already been submitted for this fixture.",409,"nsc_already_submitted");
    if(error instanceof SupabaseRequestError&&String(error.payload?.code||"")==="42501")throw new NscError("Ratings are temporarily unavailable. Please retry.",503,"rating_temporarily_unavailable");
    throw error;
  }
}
async function pulseAction(body,user,access,now){
  const{id,event}=requireEvent(body.eventId),state=await currentPhase(id,event,now);
  if(state.phase!=='pulse')throw new NscError('Live rating is available while the fixture is live.',409,'pulse_not_active');
  const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw new NscError('Choose a rating from 1 to 5.',400,'invalid_rating');
  try{return await require('./nsc-rewards').submit(user.id,id,'pulse',rating,event,now)}
  catch(error){
    if(error instanceof SupabaseRequestError&&String(error.payload?.code||"")==="42501")throw new NscError("Ratings are temporarily unavailable. Please retry.",503,"rating_temporarily_unavailable");
    throw error;
  }
}

async function likeAction(body,user,access,now){
  const{id,event}=requireEvent(body.eventId),state=await currentPhase(id,event,now),active=body.active!==false;
  await supabaseServiceRequest(server.rowsPath(server.TABLES.likes,{on_conflict:"event_id,user_id,phase"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{event_id:id,user_id:user.id,phase:state.phase,active,updated_at:now.toISOString()}});
  const points=active?await server.awardPoints(user.id,id,"first_fixture_like",nsc.pointValue("first_like"),now.toISOString()):0;
  return{eventId:id,phase:state.phase,liked:active,pointsAwarded:points};
}
async function watchingAction(body,user,access,now){
  const{id,event}=requireEvent(body.eventId),state=await currentPhase(id,event,now);
  if(state.phase!=="pulse"||state.session?.status!=="active")throw new NscError("Watching Now is available only during an activated live window.",409,"watching_not_active");
  let count=0;
  try{
    const recorded=await supabaseServiceRequest('/rest/v1/rpc/nothingsports_record_watching_heartbeat',{method:'POST',body:{target_event_id:id,target_user_id:user.id,heartbeat_at:now.toISOString()}});
    count=Number(recorded?.[0]?.heartbeat_count||0);
  }catch(error){
    if(!(error instanceof SupabaseRequestError)||![400,404].includes(Number(error.status)))throw error;
    // Compatibility path while the additive efficiency migration rolls out.
    const existing=(await server.rows(server.TABLES.presence,{event_id:`eq.${id}`,user_id:`eq.${user.id}`,select:"*",limit:"1"}))[0]||null;
    count=Number(existing?.heartbeat_count||0)+1;
    await supabaseServiceRequest(server.rowsPath(server.TABLES.presence,{on_conflict:"event_id,user_id"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{event_id:id,user_id:user.id,watching_started_at:existing?.watching_started_at||now.toISOString(),last_heartbeat_at:now.toISOString(),heartbeat_count:count}});
  }
  const points=count>=2?await server.awardPoints(user.id,id,"watching_two_heartbeats",nsc.pointValue("watching"),now.toISOString()):0;
  return{eventId:id,watching:true,heartbeatCount:count,expiresAt:new Date(now.getTime()+nsc.PRESENCE_TTL_MS).toISOString(),pointsAwarded:points};
}
async function reportAction(body,user){
  const targetProfileId=clean(body.targetProfileId,40),reason=clean(body.reason,30);
  const targetProfile=UUID.test(targetProfileId)?(await server.rows(server.TABLES.profiles,{profile_id:`eq.${targetProfileId}`,select:"user_id",limit:"1"}))[0]:null;
  if(!targetProfile||targetProfile.user_id===user.id||!["impersonation","offensive","misleading","privacy","other_fixed"].includes(reason))throw new NscError("Choose a valid contributor and report reason.",400,"invalid_username_report");
  await supabaseServiceRequest(server.rowsPath(server.TABLES.reports,{on_conflict:"reporter_user_id,target_user_id,reason"}),{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:{reporter_user_id:user.id,target_user_id:targetProfile.user_id,reason}});
  return{reported:true};
}

module.exports=async function nothingscoreHandler(request,response){
  privateHeaders(response);
  try{
    if(!["GET","POST"].includes(request.method||"GET")){response.setHeader("Allow","GET, POST");response.status(405).json({error:"Nothingscore supports GET and POST only.",code:"method_not_allowed"});return}
    const user=accountUser(await optionalUser(request));
    if((request.method||"GET")==="GET"){
      if(query(request,'avatarExpanded')){
        const bytes=await require('./profile-avatars').expanded(query(request,'avatarExpanded'),user);
        response.setHeader('Content-Type','image/webp');response.setHeader('X-Content-Type-Options','nosniff');
        response.status(200).send(bytes);return;
      }
      if(query(request,'ladder')){response.status(200).json(await require('./nsc-ladder').ladder(Object.fromEntries(['cursor','audience','sort','search'].map(k=>[k,query(request,k)])),user));return;}
      if(query(request,'fixture')){const id=clean(query(request,'fixture'),180);await server.refreshEventSnapshots([id]);response.status(200).json({event:requireEvent(id).event});return;}
      if(query(request,'picks')){response.status(200).json(await require('./nsc-social').preview(query(request,'picks'),user));return;}
      if(query(request,'activity')){response.status(200).json(await require('./nsc-social').activity(user,query(request,'cursor')));return;}
      if(query(request,'ratingAffinity')){response.status(200).json(await require('./nsc-social').ratingAffinity(user));return;}
      if(query(request,'handle')){const p=await require('./nsc-social').publicProfile(null,String(query(request,'handle')).toLowerCase());response.status(200).json({profileId:p.profile_id,name:p.display_name,handle:p.handle,isViewer:p.user_id===user?.id});return;}
      if(query(request,'rankings')){const options=Object.fromEntries(['tab','scope','sport','days','cursor','preferences'].map(key=>[key,query(request,key)]));response.status(200).json(await require('./nsc-rankings').rankings(options,user));return;}
      if(query(request,'rewards')){if(!user)throw new NscError('Sign in to view rewards.',401);response.status(200).json(await require('./nsc-rewards').rewardsFor(user.id));return;}
      const board=clean(query(request,"leaderboard"),20);
      if(board){if(!["weekly","all-time"].includes(board))throw new NscError("Choose weekly or all-time.",400,"invalid_leaderboard");response.status(200).json({schemaVersion:nsc.SCHEMA_VERSION,period:board,entries:await server.leaderboard(board==="weekly"?"weekly":"all",new Date())});return}
      const detailId=clean(query(request,"eventId"),180);
      const ids=detailId?[detailId]:clean(query(request,"ids"),9000).split(",").map(id=>id.trim()).filter(Boolean);
      if(!ids.length||ids.length>50)throw new NscError("Request between 1 and 50 canonical event IDs.",400,"invalid_event_batch");
      const [snapshots,myProfile,persona]=await Promise.all([
        server.refreshEventSnapshots(ids).then(()=>server.snapshots(ids,{userId:user?.id||null,detailId:detailId||null,now:new Date()})),
        user?server.profileFor(user.id):Promise.resolve(null),
        user?server.personaFor(user.id):Promise.resolve(null),
      ]);
      response.status(200).json({schemaVersion:nsc.SCHEMA_VERSION,snapshots,...(detailId?{detail:snapshots[0]||null}:{}),viewer:user?{signedIn:true,ratingEligible:!persona?.moderation_flag,profile:server.ownerProfile(myProfile)}:{signedIn:false,ratingEligible:false,profile:null}});return;
    }
    if(!user)throw new NscError("Sign in is required to contribute.",401,"sign_in_required");
    const body=bodyOf(request),now=new Date();let result;
    if(body.action==="profile")result=await postProfile(body,user);
    else if(body.action==="profile-avatar-prepare")result=await require('./profile-avatars').prepare(body,user);
    else if(body.action==="profile-avatar-complete")result=await require('./profile-avatars').complete(body,user);
    else if(body.action==="profile-avatar-access")result=await require('./profile-avatars').access(body,user);
    else if(body.action==="profile-avatar")result=await uploadAvatar(body,user);
    else if(body.action==="copy-picks"){await requireContributor(user);result=await require("./nsc-social").copy(body,user);}
    else if(body.action==="follow-user"){if(body.following!==false)await requireContributor(user);result=await require("./user-follows").setFollow(body,user);}
    else if(body.action==="profile-visibility")result=await setVisibility(body,user);
    else{
      if(["submit","rate","pulse","like","watching"].includes(body.action))await server.refreshEventSnapshots([clean(body.eventId,180)]);
      const access=await requireContributor(user);
      if(body.action==="submit")result=await ratingAction(body,user,access,now);
      else if(body.action==="rate")throw new NscError("Refresh the app to review and submit this score.",409,"nsc_submit_required");
      else if(body.action==="pulse")result=await pulseAction(body,user,access,now);
      else if(body.action==="like")result=await likeAction(body,user,access,now);
      else if(body.action==="watching")result=await watchingAction(body,user,access,now);
      else if(body.action==="report")result=await reportAction(body,user);
      else throw new NscError("Unknown Nothingscore action.",400,"unknown_nothingscore_action");
    }
    response.status(200).json({schemaVersion:nsc.SCHEMA_VERSION,...result});
  }catch(error){
    if(error instanceof NscError || /^profile_avatar_|^invalid_profile_avatar$/.test(error.code||"") || [400,401,403,404,409].includes(error.status)){response.status(error.status).json({error:error.message,code:error.code});return}
    if(error instanceof SupabaseRequestError&&/preferences_changed_retry/.test(String(error.payload?.message||error.message))){response.status(409).json({error:'Your follows changed in another session. Reload the picks and retry.',code:'preferences_changed_retry'});return;}
    if(error instanceof SupabaseRequestError&&/phase_action_mismatch|prediction_time_unconfirmed_or_locked/.test(String(error.payload?.message||error.message))){response.status(409).json({error:'This rating phase has closed or the start time is unconfirmed. Refresh the fixture.',code:'rating_phase_closed'});return}
    if(error instanceof SupabaseRequestError){const outgoing=publicError(error);response.status(outgoing.status).json(outgoing.body);return}
    response.status(500).json({error:"Nothingscore is temporarily unavailable.",code:"nothingscore_unavailable"});
  }
};

module.exports._test=Object.freeze({NscError,fullDisplayName,requireEvent,requireContributor});
