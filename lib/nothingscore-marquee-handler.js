"use strict";

const {SupabaseRequestError,authenticatedUser,bearerToken,publicError,supabaseServiceRequest}=require("./supabase-server");
const server=require("./nothingscore-server");

class MarqueeModeError extends Error{constructor(message,status=400,code="invalid_marquee_mode_request"){super(message);this.status=status;this.code=code}}
function clean(value,maximum=180){return String(value==null?"":value).trim().slice(0,maximum)}
function bodyOf(request){if(request?.body&&typeof request.body==="object")return request.body;try{return JSON.parse(request?.body||"{}")}catch(_error){return{}}}
async function admin(request){const user=await authenticatedUser(bearerToken(request));if(String(user?.app_metadata?.role||"").toLowerCase()!=="admin")throw new MarqueeModeError("Marquee Mode requires the server-owned admin role.",403,"nsc_admin_required");return user}
async function sessionFor(eventId){return(await server.rows(server.TABLES.sessions,{event_id:`eq.${eventId}`,select:"*",limit:"1"}))[0]||null}
function canonicalWindow(event){
  const start=Date.parse(event?.startTimeUtc||"");if(!Number.isFinite(start))throw new MarqueeModeError("That fixture has no confirmed UTC start.",409,"unconfirmed_start");
  const explicit=Date.parse(event?.endTimeUtc||""),hours=Number(event?.liveWindow||3),end=Number.isFinite(explicit)?explicit:start+Math.max(.25,Math.min(24,hours))*3600000;
  return{startTimeUtc:new Date(start).toISOString(),endTimeUtc:new Date(end).toISOString()};
}

module.exports=async function marqueeModeHandler(request,response){
  response.setHeader("Cache-Control","private, no-store, max-age=0");response.setHeader("Vary","Authorization");
  try{
    if(request.method!=="POST"){response.setHeader("Allow","POST");response.status(405).json({error:"Marquee Mode accepts POST only.",code:"method_not_allowed"});return}
    const user=await admin(request),body=bodyOf(request),eventId=clean(body.eventId),event=server.eventFor(eventId);
    if(!event)throw new MarqueeModeError("Canonical fixture not found.",404,"fixture_not_found");
    const action=clean(body.action,20),now=new Date().toISOString();let existing=await sessionFor(eventId),session;
    if(existing?.status==="active"&&Date.parse(existing.effective_end_at)<=Date.parse(now))existing=await server.freezeSession(eventId,now);
    if(action==="status")session=existing;
    else if(action==="start"){
      if(existing?.status==="stopped")throw new MarqueeModeError("This one-shot Marquee session has already been stopped and frozen.",409,"marquee_already_frozen");
      if(existing?.status==="active")session=existing;
      else{
        const window=canonicalWindow(event);
        await supabaseServiceRequest(server.rowsPath(server.TABLES.sessions,{on_conflict:"event_id"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{event_id:eventId,status:"active",effective_start_at:window.startTimeUtc,effective_end_at:window.endTimeUtc,activated_by:user.id,activated_at:now,updated_at:now}});
        session=await sessionFor(eventId);
      }
    }else if(action==="extend"){
      if(existing?.status!=="active")throw new MarqueeModeError("Only an active Marquee session can be extended.",409,"marquee_not_active");
      const minutes=Math.floor(Number(body.minutes));if(!Number.isFinite(minutes)||minutes<1||minutes>360)throw new MarqueeModeError("Extend by 1–360 minutes.",400,"invalid_extension");
      const end=new Date(Date.parse(existing.effective_end_at)+minutes*60000).toISOString();
      await supabaseServiceRequest(server.rowsPath(server.TABLES.sessions,{event_id:`eq.${eventId}`,status:"eq.active"}),{method:"PATCH",headers:{Prefer:"return=minimal"},body:{effective_end_at:end,updated_at:now}});session=await sessionFor(eventId);
    }else if(action==="stop")session=existing?await server.freezeSession(eventId,now):null;
    else throw new MarqueeModeError("Choose start, extend, stop or status.",400,"unknown_marquee_action");
    response.status(200).json({schemaVersion:"nothingscore-marquee.v1",eventId,session:session?{status:session.status,effectiveStartAt:session.effective_start_at,effectiveEndAt:session.effective_end_at,stoppedAt:session.stopped_at||null,frozenPulseMean:session.frozen_pulse_mean==null?null:Number(session.frozen_pulse_mean),frozenPulseContributors:session.frozen_pulse_contributors,impactSeed:session.impact_seed==null?null:Number(session.impact_seed),impactSeedWeight:session.impact_seed_weight==null?null:Number(session.impact_seed_weight)}:null});
  }catch(error){
    if(error instanceof MarqueeModeError){response.status(error.status).json({error:error.message,code:error.code});return}
    if(error instanceof SupabaseRequestError){const outgoing=publicError(error);response.status(outgoing.status).json(outgoing.body);return}
    response.status(500).json({error:"Marquee Mode is temporarily unavailable.",code:"marquee_mode_unavailable"});
  }
};
module.exports._test=Object.freeze({MarqueeModeError,canonicalWindow});
