"use strict";

const nsc = require("../config/nothingscore");
const eventDocument = require("../data/events.json");
const majorEventDocument = require("../data/major-events.v1.json");
const { supabaseServiceRequest } = require("./supabase-server");

const TABLES = Object.freeze({
  profiles:"nothingsports_nsc_profiles", personas:"nothingsports_nsc_personas", pilots:"nothingsports_nsc_pilot_members",
  contributions:"nothingsports_nsc_contributions", likes:"nothingsports_nsc_likes", presence:"nothingsports_nsc_presence",
  sessions:"nothingsports_nsc_marquee_sessions", points:"nothingsports_nsc_points", reports:"nothingsports_nsc_username_reports",
});
let eventCache = null;
let eventAliasCache = null;

function rowsPath(table, parameters = {}){ const query=new URLSearchParams(parameters); return `/rest/v1/${table}${query.size?`?${query}`:""}`; }
async function rows(table, parameters = {}){ const payload=await supabaseServiceRequest(rowsPath(table,parameters)); return Array.isArray(payload)?payload:[]; }
function eventMap(){
  if (eventCache) return eventCache;
  eventCache=new Map();
  (eventDocument.events||[]).forEach(event=>[event.canonicalEventId,event.eventId,event.id].filter(Boolean).forEach(id=>eventCache.set(String(id),event)));
  return eventCache;
}
function fixtureKey(value){return String(value||"").toLowerCase().replace(/\b(?:versus|vs\.?)\b/gu," v ").replace(/[^a-z0-9]+/gu," ").trim()}
function eventAliasMap(){
  if(eventAliasCache)return eventAliasCache;
  eventAliasCache=new Map();
  const canonicalByFixture=new Map();
  (eventDocument.events||[]).forEach(event=>{
    const canonical=String(event.canonicalEventId||event.eventId||event.id||"");
    const start=Date.parse(event.startTimeUtc||"");
    const title=fixtureKey(event.displayTitleCompact||event.name);
    if(canonical&&Number.isFinite(start)&&title)canonicalByFixture.set(`${start}|${title}`,canonical);
  });
  (majorEventDocument.events||[]).forEach(major=>{
    (major.subEvents||[]).forEach(subEvent=>{
      const start=Date.parse(subEvent.startTimeUtc||"");
      const title=fixtureKey(subEvent.displayTitleCompact||subEvent.name);
      const canonical=canonicalByFixture.get(`${start}|${title}`);
      if(!canonical)return;
      [subEvent.id,subEvent.eventId,subEvent.canonicalEventId,...(Array.isArray(subEvent.legacyEventIds)?subEvent.legacyEventIds:[])].filter(Boolean).forEach(id=>eventAliasCache.set(String(id),canonical));
    });
  });
  return eventAliasCache;
}
function canonicalEventId(id){const incoming=String(id||"");return eventAliasMap().get(incoming)||incoming}
function eventFor(id){ return eventMap().get(canonicalEventId(id))||null; }
function publicProfile(profile){
  if (!profile || profile.visibility!=="visible") return { displayName:"Hidden contributor", handle:null, hidden:true };
  return { profileId:profile.profile_id, displayName:profile.display_name, handle:`@${profile.handle}`, hidden:false };
}
function ownerProfile(profile){
  if(!profile)return null;
  if(profile.visibility==="deleted")return{profileId:profile.profile_id,displayName:null,handle:null,visibility:"deleted",hidden:true,deleted:true};
  return{
    profileId:profile.profile_id,
    displayName:profile.display_name,
    handle:`@${profile.handle}`,
    visibility:profile.visibility,
    hidden:profile.visibility!=="visible",
    deleted:false,
  };
}
async function identityMaps(userIds){
  const ids=[...new Set((userIds||[]).filter(Boolean))];
  if (!ids.length) return { profiles:new Map(),personas:new Map() };
  const list=`in.(${ids.join(",")})`;
  const [profiles,personas]=await Promise.all([
    rows(TABLES.profiles,{user_id:list,select:"user_id,profile_id,handle,display_name,visibility"}),
    rows(TABLES.personas,{user_id:list,select:"user_id,persona,moderation_flag"}),
  ]);
  return { profiles:new Map(profiles.map(row=>[row.user_id,row])),personas:new Map(personas.map(row=>[row.user_id,row])) };
}
function decorated(row,identities){ return { ...row,userId:row.user_id,rating:Number(row.rating),tags:row.tags||[],submittedAt:row.submitted_at||null,updatedAt:row.updated_at,persona:identities.personas.get(row.user_id)?.persona||"general" }; }
function submissionReceipt(row,pointRows=[]){
  if(!row||!["heat","impact"].includes(row.phase))return null;
  const actionKeys=new Set([`${row.phase}_rating`,`${row.phase}_valid_tags`]);
  return{
    phase:row.phase,rating:Number(row.rating),tags:row.tags||[],bucketStart:row.bucket_start,
    submitted:Boolean(row.submitted_at||row.submittedAt),submittedAt:row.submitted_at||row.submittedAt||null,
    pointsAwarded:pointRows.filter(point=>actionKeys.has(point.action_key)).reduce((total,point)=>total+(Number(point.points)||0),0),
  };
}
function eventTiming(event){ return { startTimeUtc:event?.startTimeUtc,endTimeUtc:event?.endTimeUtc,liveWindowHours:Number(event?.liveWindow||3) }; }
async function snapshots(eventIds,{userId=null,detailId=null,now=new Date()}={}){
  const requestedIds=[...new Set(eventIds.map(String).filter(id=>eventFor(id)))].slice(0,50);
  if (!requestedIds.length) return [];
  const requests=requestedIds.map(requestedId=>({requestedId,eventId:canonicalEventId(requestedId)}));
  const ids=[...new Set(requests.map(request=>request.eventId))];
  const filter=`in.(${ids.join(",")})`,freshCutoff=new Date(now.getTime()-nsc.PRESENCE_TTL_MS).toISOString();
  const [contributions,likes,presence,sessions,viewerPoints]=await Promise.all([
    rows(TABLES.contributions,{event_id:filter,select:"event_id,user_id,phase,bucket_start,rating,tags,submitted_at,created_at,updated_at"}),
    rows(TABLES.likes,{event_id:filter,active:"eq.true",select:"event_id,user_id,phase,active,updated_at"}),
    rows(TABLES.presence,{event_id:filter,last_heartbeat_at:`gte.${freshCutoff}`,select:"event_id,user_id,watching_started_at,last_heartbeat_at,heartbeat_count"}),
    rows(TABLES.sessions,{event_id:filter,select:"event_id,status,effective_start_at,effective_end_at,frozen_pulse_mean,frozen_pulse_contributors,impact_seed,impact_seed_weight,pulse_frozen_at"}),
    userId?rows(TABLES.points,{event_id:filter,user_id:`eq.${userId}`,action_key:"in.(heat_rating,heat_valid_tags,impact_rating,impact_valid_tags)",select:"event_id,action_key,points"}):Promise.resolve([]),
  ]);
  for(let index=0;index<sessions.length;index+=1){
    if(sessions[index].status==="active"&&Date.parse(sessions[index].effective_end_at)<=now.getTime())sessions[index]=await freezeSession(sessions[index].event_id,now.toISOString());
  }
  const identities=await identityMaps([...contributions.map(row=>row.user_id),...likes.map(row=>row.user_id),...presence.map(row=>row.user_id)]);
  const sessionMap=new Map(sessions.map(row=>[row.event_id,{...row,effectiveStartAt:row.effective_start_at,effectiveEndAt:row.effective_end_at}]));
  const detailCanonicalId=canonicalEventId(detailId);
  return requests.map(({requestedId,eventId})=>{
    const event=eventFor(eventId),session=sessionMap.get(eventId)||null;
    const phase=nsc.phaseFor({...eventTiming(event),session},now);
    const eventRows=contributions.filter(row=>row.event_id===eventId).map(row=>decorated(row,identities));
    const eventLikes=likes.filter(row=>row.event_id===eventId);
    const heatRows=eventRows.filter(row=>row.phase==="heat"),impactRows=eventRows.filter(row=>row.phase==="impact"),pulseRows=eventRows.filter(row=>row.phase==="pulse");
    const heatLikes=eventLikes.filter(row=>row.phase==="heat").length,pulseLikes=eventLikes.filter(row=>row.phase==="pulse").length,impactLikes=eventLikes.filter(row=>row.phase==="impact").length;
    const pulse={...nsc.pulseAggregate(pulseRows,now),likeCount:pulseLikes};
    const seed=session?.impact_seed?{rating:Number(session.impact_seed),weight:Number(session.impact_seed_weight)}:null;
    const aggregates={ heat:nsc.aggregateRatings(heatRows,heatLikes), pulse, impact:nsc.aggregateRatings(impactRows,impactLikes,{seed}) };
    const activeRows=phase==="heat"?heatRows:phase==="pulse"?pulseRows:impactRows;
    const contributorRows=eventId===detailCanonicalId?(()=>{
      const grouped=new Map();
      activeRows.forEach(row=>{const item=grouped.get(row.user_id)||{profile:identities.profiles.get(row.user_id),ratings:[],tags:new Set(),phase:row.phase,updatedAt:row.updated_at||row.updatedAt};item.ratings.push(Number(row.rating));(row.tags||[]).forEach(tag=>item.tags.add(tag));if(Date.parse(row.updated_at||row.updatedAt)>Date.parse(item.updatedAt))item.updatedAt=row.updated_at||row.updatedAt;grouped.set(row.user_id,item)});
      return [...grouped.values()].map(item=>({ ...publicProfile(item.profile),rating:Math.round(item.ratings.reduce((sum,value)=>sum+value,0)/item.ratings.length*10)/10,tags:[...item.tags],phase:item.phase,updatedAt:item.updatedAt })).sort((a,b)=>String(a.displayName).localeCompare(String(b.displayName)));
    })():undefined;
    const viewerRows=eventRows.filter(row=>row.user_id===userId),eventViewerPoints=viewerPoints.filter(row=>row.event_id===eventId);
    const submissions=Object.fromEntries(viewerRows.filter(row=>["heat","impact"].includes(row.phase)).map(row=>[row.phase,submissionReceipt(row,eventViewerPoints)]));
    const current=activeRows.filter(row=>row.user_id===userId).sort((a,b)=>Date.parse(b.updated_at||b.updatedAt||0)-Date.parse(a.updated_at||a.updatedAt||0))[0]||null;
    const currentContribution=current?(["heat","impact"].includes(current.phase)?submissionReceipt(current,eventViewerPoints):{rating:current.rating,tags:current.tags||[],bucketStart:current.bucket_start}):null;
    const currentLike=eventLikes.find(row=>row.user_id===userId&&row.phase===phase);
    return {
      schemaVersion:nsc.SCHEMA_VERSION,eventId:requestedId,canonicalEventId:eventId,phase,aggregate:aggregates[phase],aggregates,
      watchingCount:nsc.activePresence(presence.filter(row=>row.event_id===eventId).map(row=>({lastHeartbeatAt:row.last_heartbeat_at})),now).length,
      contributors:contributorRows,
      currentUser:userId?{contribution:currentContribution,submissions,liked:Boolean(currentLike),watching:presence.some(row=>row.event_id===eventId&&row.user_id===userId)}:null,
      timing:{startTimeUtc:session?.effective_start_at||event.startTimeUtc,endTimeUtc:session?.effective_end_at||event.endTimeUtc||new Date(Date.parse(event.startTimeUtc)+Number(event.liveWindow||3)*3600000).toISOString()},
    };
  });
}
async function pilotFor(userId){ return (await rows(TABLES.pilots,{user_id:`eq.${userId}`,select:"user_id,approved,suspended",limit:"1"}))[0]||null; }
async function profileFor(userId){ return (await rows(TABLES.profiles,{user_id:`eq.${userId}`,select:"*",limit:"1"}))[0]||null; }
async function personaFor(userId){ return (await rows(TABLES.personas,{user_id:`eq.${userId}`,select:"persona,moderation_flag",limit:"1"}))[0]||{persona:"general",moderation_flag:false}; }
async function awardPoints(userId,eventId,actionKey,points,when=new Date().toISOString()){
  eventId=canonicalEventId(eventId);
  const result=await supabaseServiceRequest("/rest/v1/rpc/nothingsports_nsc_award_points",{method:"POST",body:{target_user_id:userId,target_event_id:eventId,target_action_key:actionKey,requested_points:points,awarded_time:when}});
  return Number(result)||0;
}
async function submitRating(userId,eventId,phase,rating,tags=[],when=new Date().toISOString()){
  eventId=canonicalEventId(eventId);
  const payload=await supabaseServiceRequest("/rest/v1/rpc/nothingsports_nsc_submit_rating",{method:"POST",body:{target_user_id:userId,target_event_id:eventId,target_phase:phase,target_rating:rating,target_tags:tags,submitted_time:when}});
  const row=Array.isArray(payload)?payload[0]:payload;
  if(!row)throw new Error("Nothingscore submission returned no receipt.");
  return{eventId:row.event_id||eventId,phase:row.phase||phase,rating:Number(row.rating),tags:row.tags||[],submitted:true,submittedAt:row.submitted_at||when,pointsAwarded:Number(row.points_awarded)||0,replayed:Boolean(row.replayed)};
}
async function pulseSeedForEvent(eventId){
  eventId=canonicalEventId(eventId);
  const contributions=await rows(TABLES.contributions,{event_id:`eq.${eventId}`,phase:"eq.pulse",select:"user_id,rating,updated_at"});
  const identities=await identityMaps(contributions.map(row=>row.user_id));
  const grouped=new Map();
  contributions.forEach(row=>{const item=grouped.get(row.user_id)||{userId:row.user_id,persona:identities.personas.get(row.user_id)?.persona||"general",ratings:[]};item.ratings.push(Number(row.rating));grouped.set(row.user_id,item)});
  const userMeans=[...grouped.values()].map(item=>({persona:item.persona,rating:item.ratings.reduce((sum,value)=>sum+value,0)/item.ratings.length}));
  const pulseMean=nsc.weightedMean(userMeans)||3,seed=nsc.impactSeed(pulseMean,userMeans.length);
  return {pulseMean,contributors:userMeans.length,seed};
}
async function freezeSession(eventId,stoppedAt=new Date().toISOString()){
  eventId=canonicalEventId(eventId);
  const session=(await rows(TABLES.sessions,{event_id:`eq.${eventId}`,select:"*",limit:"1"}))[0]||null;
  if(!session) return null;
  if(session.pulse_frozen_at) return session;
  const frozen=await pulseSeedForEvent(eventId);
  const stoppedMs=Date.parse(stoppedAt),startMs=Date.parse(session.effective_start_at),endMs=Date.parse(session.effective_end_at);
  const effectiveEndAt=Number.isFinite(stoppedMs)&&stoppedMs>startMs&&stoppedMs<endMs?stoppedAt:session.effective_end_at;
  const patch={status:"stopped",stopped_at:stoppedAt,effective_end_at:effectiveEndAt,frozen_pulse_mean:frozen.pulseMean,frozen_pulse_contributors:frozen.contributors,impact_seed:frozen.seed.rating,impact_seed_weight:frozen.seed.weight,pulse_frozen_at:stoppedAt,updated_at:stoppedAt};
  const result=await supabaseServiceRequest(rowsPath(TABLES.sessions,{event_id:`eq.${eventId}`,pulse_frozen_at:"is.null"}),{method:"PATCH",headers:{Prefer:"return=representation"},body:patch});
  if(Array.isArray(result)&&result[0])return result[0];
  return (await rows(TABLES.sessions,{event_id:`eq.${eventId}`,select:"*",limit:"1"}))[0]||session;
}
function sydneyMonday(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(now).map(part=>[part.type,part.value]));
  const date=new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`),weekday=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday);
  date.setUTCDate(date.getUTCDate()-((weekday+6)%7)); return date.toISOString().slice(0,10);
}
async function leaderboard(period="weekly",now=new Date()){
  const parameters={select:"user_id,event_id,points,awarded_at,sydney_day",order:"awarded_at.asc"};
  if(period==="weekly")parameters.sydney_day=`gte.${sydneyMonday(now)}`;
  const ledger=await rows(TABLES.points,parameters),lifetimeLedger=period==="weekly"?await rows(TABLES.points,{select:"user_id,event_id,points"}):ledger,identities=await identityMaps([...ledger,...lifetimeLedger].map(row=>row.user_id));
  const grouped=new Map();
  ledger.forEach(row=>{const item=grouped.get(row.user_id)||{userId:row.user_id,points:0,fixtures:new Set(),attainedAt:row.awarded_at};item.points+=Number(row.points)||0;item.fixtures.add(row.event_id);item.attainedAt=row.awarded_at;grouped.set(row.user_id,item)});
  const lifetime=new Map();
  lifetimeLedger.forEach(row=>{const item=lifetime.get(row.user_id)||{points:0,fixtures:new Set()};item.points+=Number(row.points)||0;item.fixtures.add(row.event_id);lifetime.set(row.user_id,item)});
  return nsc.leaderboardSort([...grouped.values()].map(item=>{const fixtures=item.fixtures.size,lifetimeItem=lifetime.get(item.userId)||{points:0,fixtures:new Set()},persona=identities.personas.get(item.userId)||{};return{...publicProfile(identities.profiles.get(item.userId)),points:item.points,uniqueFixtures:fixtures,attainedAt:item.attainedAt,risingEligible:lifetimeItem.points>=100&&lifetimeItem.fixtures.size>=10,influencerEligible:lifetimeItem.points>=500&&lifetimeItem.fixtures.size>=50&&!persona.moderation_flag}})).slice(0,50);
}

module.exports={TABLES,awardPoints,canonicalEventId,eventFor,eventMap,eventTiming,freezeSession,identityMaps,leaderboard,ownerProfile,pilotFor,profileFor,personaFor,publicProfile,pulseSeedForEvent,rows,rowsPath,snapshots,submissionReceipt,submitRating,sydneyMonday};
