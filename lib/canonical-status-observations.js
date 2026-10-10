'use strict';
const active=new Set(['live','postponed','cancelled','break']);
function validClock(value,now=Date.now()){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return false;
 const date=value.slice(0,10),time=Date.parse(value);
 return Number.isFinite(time)&&time<=now&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
function observation(event,{now=Date.now()}={}){
 if(!active.has(event?.status))return null;
 const checkedAt=event.statusCheckedAt||event.source?.checkedAt;
 const sourceUrl=event.statusSourceUrl||(event.statusCheckedAt?event.sourceUrl:null)||event.source?.sourceUrl;
 if((event.sourceType||event.source?.sourceType)!=='official'||!validClock(checkedAt,now))return null;
 try{const url=new URL(sourceUrl);if(url.protocol!=='https:'||url.username||url.password)return null;}catch{return null;}
 if(event.status==='break'){
  const evidence=event.statusEvidence,id=evidence?.providerFixtureId;
  if(event.key!=='premier-league'||event.competitionId!=='competition:premier-league-2026-27'||event.season!=='2026/27'
   ||event.statusText!=='Half-time'||evidence?.kind!=='primary-fixture-status'||evidence.rawStatus!=='L'||evidence.nonPlayingPhase!=='H'
   ||!Number.isSafeInteger(id)||event.canonicalEventId!==`event:premier-league:${id}`||String(event.canonicalSourceId)!==String(id)
   ||evidence.checkedAt!==checkedAt||evidence.sourceUrl!==sourceUrl||sourceUrl!=='https://www.premierleague.com/en/matches/premier-league/2026-27'
   ||![event.homeScore,event.awayScore].every(s=>Number.isSafeInteger(s)&&s>=0))return null;
 }
 if(event.status==='live'||event.status==='break'){
  const start=Date.parse(event.startTimeUtc);
  if(!Number.isFinite(start)||Date.parse(checkedAt)<start)return null;
 }
 return {status:event.status,statusCheckedAt:checkedAt,statusSourceUrl:sourceUrl,...(event.status==='break'?{statusText:'Half-time'}:{})};
}
function aliases(event){return [event?.id,event?.eventId,event?.canonicalEventId,...(event?.sourceEventIds||[])].filter(Boolean);}
function apply(previous,event,options){
 const observed=observation(event,options);
 if(!observed||!['scheduled','upcoming','live','break','postponed','cancelled'].includes(previous?.status))return previous;
 // A current source fact cannot reopen a settled result or another fixture.
 if(['postponed','cancelled'].includes(previous.status)&&['live','break'].includes(event.status))return previous;
 if(!aliases(previous).some(id=>aliases(event).includes(id))||previous.competitionId!==event.competitionId
   ||previous.startTimeUtc!==event.startTimeUtc)return previous;
 const a=previous.participantIds,b=event.participantIds;
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2
   ||a.some((id,index)=>!id||id!==b[index]))return previous;
 const prior=previous.statusCheckedAt||previous.statusSource?.checkedAt
   ||(previous.fixtureObservationSchema?null:previous.sourceCheckedAt||previous.source?.checkedAt);
 if(validClock(prior,options?.now)&&Date.parse(observed.statusCheckedAt)<=Date.parse(prior))return previous;
 // Keep scores, editorial, schedule, identity and their independent clocks.
 return {...previous,...observed,...(previous.status==='break'&&event.status!=='break'?{statusText:null}:{})};
}
module.exports={observation,apply};
