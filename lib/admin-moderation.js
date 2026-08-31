"use strict";

const crypto = require("node:crypto");
const {
  SupabaseRequestError, authenticatedUser, bearerToken, publicError, supabaseServiceRequest,
} = require("./supabase-server");

const TABLES = Object.freeze({
  profiles:"nothingsports_nsc_profiles",
  pilots:"nothingsports_nsc_pilot_members",
  reports:"nothingsports_nsc_username_reports",
  audit:"nothingsports_nsc_admin_audit",
});
const USER_ACTIONS = Object.freeze(["approve","revoke-approval","suspend","reinstate","hide-profile","restore-profile"]);
const REPORT_ACTIONS = Object.freeze(["mark-reviewed","dismiss","mark-actioned","hide-profile","restore-profile","suspend-contributions","reinstate-contributions"]);

class AdminError extends Error{
  constructor(message,status=400,code="invalid_admin_request"){super(message);this.status=status;this.code=code;}
}
function clean(value,maximum=500){return String(value==null?"":value).trim().slice(0,maximum)}
function bodyOf(request){if(request?.body&&typeof request.body==="object")return request.body;try{return JSON.parse(request?.body||"{}")}catch(_error){return{}}}
function query(request,name){if(request?.query&&Object.hasOwn(request.query,name)){const value=request.query[name];return Array.isArray(value)?value[0]:value}try{return new URL(request?.url||"/","https://nothingsport.vercel.app").searchParams.get(name)||""}catch(_error){return""}}
function privateHeaders(response){response.setHeader("Cache-Control","private, no-store, max-age=0");response.setHeader("Vary","Authorization")}
function rowsPath(table,parameters={}){const search=new URLSearchParams(parameters);return`/rest/v1/${table}${search.size?`?${search}`:""}`}
async function rows(table,parameters={}){const payload=await supabaseServiceRequest(rowsPath(table,parameters));return Array.isArray(payload)?payload:[]}
function isAdminRole(user){return clean(user?.app_metadata?.role,40).toLowerCase()==="admin"}
async function adminUser(request){const user=await authenticatedUser(bearerToken(request));if(!isAdminRole(user))throw new AdminError("The owner console is restricted to app admins.",403,"admin_role_required");return user}
function subjectSecret(environment=process.env){const secret=clean(environment.PARTICIPATION_SECRET||environment.CHAT_GUEST_LINK_SECRET,1000);if(secret.length<32)throw new AdminError("Owner-console account references are not configured.",503,"admin_subject_secret_missing");return secret}
function subjectRef(userId,environment=process.env){return crypto.createHmac("sha256",subjectSecret(environment)).update(`nothingsport-admin-subject.v1:${clean(userId,80)}`).digest("hex").slice(0,24)}
function publicIdentity(profile){
  if(!profile)return{displayName:"Public profile not set",handle:null,visibility:"missing",profileId:null};
  const deleted=profile.visibility==="deleted";
  return{displayName:deleted?"Profile deleted":profile.display_name,handle:deleted?null:`@${profile.handle}`,visibility:profile.visibility,profileId:profile.profile_id};
}
function moderationState(profile,pilot){return{profileVisibility:profile?.visibility||"missing",pilotApproved:Boolean(pilot?.approved),contributionsSuspended:Boolean(pilot?.suspended)}}
function userSearchMatches(account,profile,search){const needle=clean(search,120).toLowerCase();if(!needle)return true;return[account?.email,profile?.display_name,profile?.handle].some(value=>clean(value,500).toLowerCase().includes(needle))}
async function listAuthUsers(){
  const payload=await supabaseServiceRequest("/auth/v1/admin/users?page=1&per_page=1000");
  return(Array.isArray(payload)?payload:Array.isArray(payload?.users)?payload.users:[]).filter(user=>Boolean(user.email_confirmed_at||user.confirmed_at));
}
async function identityMaps(){
  const[profiles,pilots,reports]=await Promise.all([
    rows(TABLES.profiles,{select:"user_id,profile_id,display_name,handle,visibility,updated_at"}),
    rows(TABLES.pilots,{select:"user_id,approved,suspended,approved_at,updated_at"}),
    rows(TABLES.reports,{status:"eq.open",select:"report_id,target_user_id"}),
  ]);
  const openReports=new Map();reports.forEach(report=>openReports.set(report.target_user_id,(openReports.get(report.target_user_id)||0)+1));
  return{profiles:new Map(profiles.map(row=>[row.user_id,row])),pilots:new Map(pilots.map(row=>[row.user_id,row])),openReports};
}
function userPayload(account,maps,environment=process.env){
  const profile=maps.profiles.get(account.id)||null,pilot=maps.pilots.get(account.id)||null;
  return{
    subjectRef:subjectRef(account.id,environment),email:clean(account.email,320),confirmedAt:account.email_confirmed_at||account.confirmed_at||null,
    publicProfile:publicIdentity(profile),pilot:{approved:Boolean(pilot?.approved),suspended:Boolean(pilot?.suspended),approvedAt:pilot?.approved_at||null},
    openReportCount:Number(maps.openReports.get(account.id)||0),lastSignInAt:account.last_sign_in_at||null,
  };
}
async function usersPayload(search="",environment=process.env){
  const[accounts,maps]=await Promise.all([listAuthUsers(),identityMaps()]);
  const users=accounts.filter(account=>userSearchMatches(account,maps.profiles.get(account.id),search)).map(account=>userPayload(account,maps,environment)).sort((a,b)=>a.email.localeCompare(b.email));
  return{schemaVersion:"admin-users.v1",users};
}
async function resolveSubject(reference,environment=process.env){const users=await listAuthUsers();const target=users.find(user=>subjectRef(user.id,environment)===clean(reference,80));if(!target)throw new AdminError("Account not found.",404,"admin_subject_not_found");return target}
async function accountRows(userId){
  const[profile,pilot]=await Promise.all([
    rows(TABLES.profiles,{user_id:`eq.${userId}`,select:"user_id,profile_id,display_name,handle,visibility,updated_at",limit:"1"}),
    rows(TABLES.pilots,{user_id:`eq.${userId}`,select:"user_id,approved,suspended,approved_by,approved_at,updated_at",limit:"1"}),
  ]);
  return{profile:profile[0]||null,pilot:pilot[0]||null};
}
async function audit({actorUserId,targetUserId,reportId=null,action,before,after}){
  await supabaseServiceRequest(rowsPath(TABLES.audit),{method:"POST",headers:{Prefer:"return=minimal"},body:{actor_user_id:actorUserId,target_user_id:targetUserId,report_id:reportId,action,before_state:before,after_state:after}});
}
async function patchPilot(userId,patch){
  const body={user_id:userId,approved:false,suspended:false,...patch,updated_at:new Date().toISOString()};
  const payload=await supabaseServiceRequest(rowsPath(TABLES.pilots,{on_conflict:"user_id"}),{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body});
  return Array.isArray(payload)?payload[0]||body:body;
}
async function patchProfile(userId,visibility){
  const current=(await accountRows(userId)).profile;if(!current)throw new AdminError("This account has no public profile to change.",409,"public_profile_missing");
  const payload=await supabaseServiceRequest(rowsPath(TABLES.profiles,{user_id:`eq.${userId}`}),{method:"PATCH",headers:{Prefer:"return=representation"},body:{visibility,updated_at:new Date().toISOString()}});
  return Array.isArray(payload)?payload[0]||{...current,visibility}:{...current,visibility};
}
async function performAccountAction({action,targetUserId,actorUserId,reportId=null}){
  const beforeRows=await accountRows(targetUserId),before=moderationState(beforeRows.profile,beforeRows.pilot);let profile=beforeRows.profile,pilot=beforeRows.pilot;
  if(action==="approve")pilot=await patchPilot(targetUserId,{approved:true,approved_by:actorUserId,approved_at:new Date().toISOString(),suspended:Boolean(pilot?.suspended)});
  else if(action==="revoke-approval")pilot=await patchPilot(targetUserId,{approved:false,approved_by:null,approved_at:null,suspended:Boolean(pilot?.suspended)});
  else if(action==="suspend"||action==="suspend-contributions")pilot=await patchPilot(targetUserId,{approved:Boolean(pilot?.approved),approved_by:pilot?.approved_by||null,approved_at:pilot?.approved_at||null,suspended:true});
  else if(action==="reinstate"||action==="reinstate-contributions")pilot=await patchPilot(targetUserId,{approved:Boolean(pilot?.approved),approved_by:pilot?.approved_by||null,approved_at:pilot?.approved_at||null,suspended:false});
  else if(action==="hide-profile")profile=await patchProfile(targetUserId,"hidden");
  else if(action==="restore-profile")profile=await patchProfile(targetUserId,"visible");
  else throw new AdminError("Unknown account action.",400,"unknown_account_action");
  const after=moderationState(profile,pilot);await audit({actorUserId,targetUserId,reportId,action,before,after});return{before,after};
}
function reportPatch(action,actorUserId,resolution="",now=new Date().toISOString()){
  const base={reviewed_by:actorUserId,reviewed_at:now};
  if(action==="mark-reviewed")return{...base,status:"reviewed",resolution:clean(resolution,1000)||"Reviewed",resolved_at:null};
  if(action==="dismiss")return{...base,status:"dismissed",resolution:clean(resolution,1000)||"Dismissed",resolved_at:now};
  if(action==="mark-actioned")return{...base,status:"actioned",resolution:clean(resolution,1000)||"Action recorded",resolved_at:now};
  throw new AdminError("Unknown report review action.",400,"unknown_report_action");
}
async function reportRows(status=""){
  const parameters={select:"report_id,reporter_user_id,target_user_id,reason,status,created_at,reviewed_at,resolution,resolved_at",order:"created_at.desc"};
  if(["open","reviewed","dismissed","actioned"].includes(status))parameters.status=`eq.${status}`;
  return rows(TABLES.reports,parameters);
}
async function reportsPayload(status="",environment=process.env){
  const[reports,profiles,pilots]=await Promise.all([reportRows(status),rows(TABLES.profiles,{select:"user_id,profile_id,display_name,handle,visibility"}),rows(TABLES.pilots,{select:"user_id,approved,suspended"})]);
  const profileMap=new Map(profiles.map(profile=>[profile.user_id,profile])),pilotMap=new Map(pilots.map(pilot=>[pilot.user_id,pilot]));
  return{schemaVersion:"admin-reports.v1",reports:reports.map(report=>({
    reportId:report.report_id,reason:report.reason,status:report.status,createdAt:report.created_at,reviewedAt:report.reviewed_at||null,resolution:report.resolution||null,resolvedAt:report.resolved_at||null,
    reporter:publicIdentity(profileMap.get(report.reporter_user_id)),target:publicIdentity(profileMap.get(report.target_user_id)),targetRef:subjectRef(report.target_user_id,environment),targetModeration:moderationState(profileMap.get(report.target_user_id),pilotMap.get(report.target_user_id)),
  }))};
}
async function reportById(reportId){return(await rows(TABLES.reports,{report_id:`eq.${clean(reportId,80)}`,select:"*",limit:"1"}))[0]||null}
async function applyReportAction(body,actor,environment=process.env){
  if(body.confirm!==true)throw new AdminError("Confirm this moderation action explicitly.",409,"admin_confirmation_required");
  const report=await reportById(body.reportId);if(!report)throw new AdminError("Report not found.",404,"report_not_found");
  const action=clean(body.action,60);
  if(["mark-reviewed","dismiss","mark-actioned"].includes(action)){
    const patch=reportPatch(action,actor.id,body.resolution),before={status:report.status,resolution:report.resolution||null};
    await supabaseServiceRequest(rowsPath(TABLES.reports,{report_id:`eq.${report.report_id}`}),{method:"PATCH",headers:{Prefer:"return=minimal"},body:patch});
    await audit({actorUserId:actor.id,targetUserId:report.target_user_id,reportId:report.report_id,action,before,after:{status:patch.status,resolution:patch.resolution}});
    return{updated:true,action};
  }
  if(!REPORT_ACTIONS.includes(action))throw new AdminError("Unknown report action.",400,"unknown_report_action");
  await performAccountAction({action,targetUserId:report.target_user_id,actorUserId:actor.id,reportId:report.report_id});return{updated:true,action};
}
function errorResponse(error,response,fallback){
  if(error instanceof AdminError){response.status(error.status).json({error:error.message,code:error.code});return}
  if(error instanceof SupabaseRequestError){const outgoing=publicError(error);response.status(outgoing.status).json(outgoing.body);return}
  response.status(500).json({error:fallback,code:"admin_unavailable"});
}

module.exports={
  AdminError,REPORT_ACTIONS,TABLES,USER_ACTIONS,adminUser,applyReportAction,audit,bodyOf,errorResponse,isAdminRole,performAccountAction,privateHeaders,publicIdentity,query,reportPatch,reportsPayload,resolveSubject,subjectRef,userSearchMatches,usersPayload,
  _test:Object.freeze({isAdminRole,moderationState,publicIdentity,reportPatch,subjectRef,userSearchMatches}),
};
