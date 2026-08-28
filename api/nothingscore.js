"use strict";

const {
  SupabaseRequestError, authenticatedUser, bearerToken, publicError, supabaseServiceRequest,
} = require("../lib/supabase-server");
const nsc = require("../config/nothingscore");
const server = require("../lib/nothingscore-server");

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class NscError extends Error{constructor(message,status=400,code="invalid_nothingscore_request"){super(message);this.status=status;this.code=code;}}
function clean(value,maximum=500){return String(value==null?"":value).trim().slice(0,maximum)}
function fullDisplayName(value){const parts=clean(value,80).split(/\s+/u).filter(Boolean);return parts.length>=2&&parts.every(part=>[...part].length>=2)}
function bodyOf(request){if(request?.body&&typeof request.body==="object")return request.body;try{return JSON.parse(request?.body||"{}")}catch(_error){return{}}}
function query(request,name){if(request?.query&&Object.hasOwn(request.query,name)){const value=request.query[name];return Array.isArray(value)?value[0]:value}try{return new URL(request?.url||"/api/nothingscore","https://nothingsport.vercel.app").searchParams.get(name)||""}catch(_error){return""}}
function privateHeaders(response){response.setHeader("Cache-Control","private, no-store, max-age=0");response.setHeader("Vary","Authorization")}
async function optionalUser(request){const token=bearerToken(request);return token?authenticatedUser(token):null}
async function requirePilot(user){
  const pilot=await server.pilotFor(user.id);
  if(!pilot?.approved||pilot.suspended)throw new NscError("Nothingscore participation is currently limited to approved pilot members.",403,"pilot_access_required");
  const profile=await server.profileFor(user.id);
  const persona=await server.personaFor(user.id);
  if(persona.moderation_flag)throw new NscError("This profile is paused from contributing.",403,"profile_moderated");
  return {pilot,profile,persona};
}
function requireEvent(eventId){const id=clean(eventId,180),event=server.eventFor(id);if(!event)throw new NscError("Canonical fixture not found.",404,"fixture_not_found");return{id,event}}
async function currentSession(eventId){return(await server.rows(server.TABLES.sessions,{event_id:`eq.${eventId}`,select:"*",limit:"1"}))[0]||null}
async function currentPhase(eventId,event,now=new Date()){
  let session=await currentSession(eventId);
  if(session?.status==="active"&&Date.parse(session.effective_end_at)<=now.getTime())session=await server.freezeSession(eventId,now.toISOString());
  return {phase:nsc.phaseFor({...server.eventTiming(event),session:session?{status:session.status,effectiveStartAt:session.effective_start_at,effectiveEndAt:session.effective_end_at}:null},now),session};
}
async function postProfile(body,user){
  const pilot=await server.pilotFor(user.id);if(!pilot?.approved||pilot.suspended)throw new NscError("Nothingscore participation is currently limited to approved pilot members.",403,"pilot_access_required");
  const handle=nsc.normaliseHandle(body.handle),displayName=clean(body.displayName,80);
  if(!handle||!fullDisplayName(displayName))throw new NscError("Choose a 3–24 character lowercase handle and a full display name.",400,"invalid_public_profile");
  try{
    await supabaseServiceRequest(server.rowsPath(server.TABLES.profiles,{on_conflict:"user_id"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{user_id:user.id,handle,display_name:displayName,visibility:"visible",updated_at:new Date().toISOString()}});
  }catch(error){if(error instanceof SupabaseRequestError&&error.payload?.code==="23505")throw new NscError("That handle is already in use.",409,"handle_taken");throw error}
  return{profile:{displayName,handle:`@${handle}`,visibility:"visible"}};
}
async function setVisibility(body,user){
  const visibility=clean(body.visibility,20);if(!["visible","hidden","deleted"].includes(visibility))throw new NscError("Choose visible, hidden or deleted.",400,"invalid_profile_visibility");
  const patch={visibility,updated_at:new Date().toISOString()};
  if(visibility==="deleted")Object.assign(patch,{display_name:"Deleted contributor",handle:`deleted_${user.id.replaceAll("-","").slice(0,16)}`});
  await supabaseServiceRequest(server.rowsPath(server.TABLES.profiles,{user_id:`eq.${user.id}`}),{method:"PATCH",headers:{Prefer:"return=minimal"},body:patch});
  return{visibility};
}
async function ratingAction(body,user,access,now){
  const{id,event}=requireEvent(body.eventId),state=await currentPhase(id,event,now);
  if(!["heat","impact"].includes(state.phase))throw new NscError("Use Pulse while this fixture is live.",409,"phase_action_mismatch");
  const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw new NscError("Choose a rating from 1 to 5.",400,"invalid_rating");
  const tags=nsc.validTags(state.phase,rating,body.tags),epoch="1970-01-01T00:00:00.000Z";
  await supabaseServiceRequest(server.rowsPath(server.TABLES.contributions,{on_conflict:"event_id,user_id,phase,bucket_start"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{event_id:id,user_id:user.id,phase:state.phase,bucket_start:epoch,rating,tags,updated_at:now.toISOString()}});
  const points=await server.awardPoints(user.id,id,`${state.phase}_rating`,nsc.pointValue(state.phase),now.toISOString());
  if(tags.length)await server.awardPoints(user.id,id,`${state.phase}_valid_tags`,nsc.pointValue("valid_tags"),now.toISOString());
  return{eventId:id,phase:state.phase,rating,tags,pointsAwarded:points};
}
async function pulseAction(body,user,access,now){
  const{id,event}=requireEvent(body.eventId),state=await currentPhase(id,event,now);
  if(state.phase!=="pulse"||state.session?.status!=="active")throw new NscError("Pulse is available only during an activated live window.",409,"pulse_not_active");
  const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw new NscError("Choose a Pulse from 1 to 5.",400,"invalid_rating");
  const bucket=nsc.pulseBucket(now);
  await supabaseServiceRequest(server.rowsPath(server.TABLES.contributions,{on_conflict:"event_id,user_id,phase,bucket_start"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{event_id:id,user_id:user.id,phase:"pulse",bucket_start:bucket,rating,tags:[],updated_at:now.toISOString()}});
  const first=await server.awardPoints(user.id,id,"pulse_participation",nsc.pointValue("pulse"),now.toISOString());
  const presence=(await server.rows(server.TABLES.presence,{event_id:`eq.${id}`,user_id:`eq.${user.id}`,select:"watching_started_at",limit:"1"}))[0];
  if(presence&&now-Date.parse(presence.watching_started_at)>=15*60000)await server.awardPoints(user.id,id,"pulse_15m",nsc.pointValue("pulse_15m"),now.toISOString());
  return{eventId:id,phase:"pulse",rating,bucketStart:bucket,pointsAwarded:first};
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
  const existing=(await server.rows(server.TABLES.presence,{event_id:`eq.${id}`,user_id:`eq.${user.id}`,select:"*",limit:"1"}))[0]||null;
  const count=Number(existing?.heartbeat_count||0)+1;
  await supabaseServiceRequest(server.rowsPath(server.TABLES.presence,{on_conflict:"event_id,user_id"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{event_id:id,user_id:user.id,watching_started_at:existing?.watching_started_at||now.toISOString(),last_heartbeat_at:now.toISOString(),heartbeat_count:count}});
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
    const user=await optionalUser(request);
    if((request.method||"GET")==="GET"){
      const board=clean(query(request,"leaderboard"),20);
      if(board){if(!["weekly","all-time"].includes(board))throw new NscError("Choose weekly or all-time.",400,"invalid_leaderboard");response.status(200).json({schemaVersion:nsc.SCHEMA_VERSION,period:board,entries:await server.leaderboard(board==="weekly"?"weekly":"all",new Date())});return}
      const detailId=clean(query(request,"eventId"),180);
      const ids=detailId?[detailId]:clean(query(request,"ids"),9000).split(",").map(id=>id.trim()).filter(Boolean);
      if(!ids.length||ids.length>50)throw new NscError("Request between 1 and 50 canonical event IDs.",400,"invalid_event_batch");
      const snapshots=await server.snapshots(ids,{userId:user?.id||null,detailId:detailId||null,now:new Date()});
      const myProfile=user?await server.profileFor(user.id):null,pilot=user?await server.pilotFor(user.id):null;
      response.status(200).json({schemaVersion:nsc.SCHEMA_VERSION,snapshots,...(detailId?{detail:snapshots[0]||null}:{}),viewer:user?{signedIn:true,pilot:Boolean(pilot?.approved&&!pilot.suspended),profile:myProfile?{...server.publicProfile(myProfile),visibility:myProfile.visibility}:null}:{signedIn:false,pilot:false,profile:null}});return;
    }
    if(!user)throw new NscError("Sign in is required to contribute.",401,"sign_in_required");
    const body=bodyOf(request),now=new Date();let result;
    if(body.action==="profile")result=await postProfile(body,user);
    else if(body.action==="profile-visibility")result=await setVisibility(body,user);
    else{
      const access=await requirePilot(user);if(!access.profile||access.profile.visibility==="deleted")throw new NscError("Create a public display name and handle before contributing.",409,"profile_required");
      if(body.action==="rate")result=await ratingAction(body,user,access,now);
      else if(body.action==="pulse")result=await pulseAction(body,user,access,now);
      else if(body.action==="like")result=await likeAction(body,user,access,now);
      else if(body.action==="watching")result=await watchingAction(body,user,access,now);
      else if(body.action==="report")result=await reportAction(body,user);
      else throw new NscError("Unknown Nothingscore action.",400,"unknown_nothingscore_action");
    }
    response.status(200).json({schemaVersion:nsc.SCHEMA_VERSION,...result});
  }catch(error){
    if(error instanceof NscError){response.status(error.status).json({error:error.message,code:error.code});return}
    if(error instanceof SupabaseRequestError){const outgoing=publicError(error);response.status(outgoing.status).json(outgoing.body);return}
    response.status(500).json({error:"Nothingscore is temporarily unavailable.",code:"nothingscore_unavailable"});
  }
};

module.exports._test=Object.freeze({NscError,fullDisplayName,requireEvent});
