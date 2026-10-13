'use strict';
const identity=e=>e.canonicalEventId||e.eventId||e.id;
function instant(value){
 const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
 if(!m||+m[4]>23||+m[5]>59||+(m[6]||0)>59||new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).toISOString().slice(0,10)!==m.slice(1,4).join('-'))return NaN;
 return Date.parse(value);
}
function displayedClockAgrees(label,startsAt){
 const m=String(label||'').match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*(EDT|EST|ET)\b/i);
 if(!m)return false;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'}).formatToParts(new Date(startsAt)).map(p=>[p.type,p.value]));
 return (m[6].toUpperCase()==='ET'||parts.timeZoneName===m[6].toUpperCase())&&parts.month.toLowerCase()===m[1].toLowerCase()&&+parts.day===+m[2]&&+parts.hour===+m[3]&&+parts.minute===+(m[4]||0)&&parts.dayPeriod.toUpperCase()===m[5].toUpperCase();
}
function apply(event,proof,now=Date.now()){
 now=+new Date(now);if(!Number.isFinite(now))return event;
 if(!proof||proof.kind!=='publisher-start-estimate'||proof.fixtureId!==identity(event)||proof.startsAt!==event.estimatedStartTimeUtc||proof.timeTbc!==false||event.dateOnly||event.tournamentParent||event.majorEventMarker||['event','tennis_parent','golf_tournament','tournament_overview'].includes(event.cardKind||event.cardType)||event.participantsConfirmed===false||event.manualEstimateHeld||event.sessionOrderEvidence)return event;
 if(!['scheduled','upcoming'].includes(event.status)||/^(cancelled|canceled|abandoned|postponed|withdrawn|suspended|interrupted|completed|final|live)$/.test(event.scheduleStatus||''))return event;
 if(['exact','not-before','not_before'].includes(event.timePrecision)&&Number.isFinite(Date.parse(event.startTimeUtc)))return event;
 const start=instant(proof.startsAt),checked=instant(proof.checkedAt);
 if(!Number.isFinite(start)||start<=+now||!Number.isFinite(checked)||checked>+now||typeof proof.sourceName!=='string'||!proof.sourceName.trim()||proof.sourceName.length>80)return event;
 try{const u=new URL(proof.sourceUrl);if(u.protocol!=='https:'||u.username||u.password)return event;}catch{return event;}
 if(!Array.isArray(proof.participantIds)||!Array.isArray(event.participantIds)||JSON.stringify([...proof.participantIds].sort())!==JSON.stringify([...event.participantIds].sort()))return event;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(start)).map(p=>[p.type,p.value]));
 return {...event,planningTimeEvidence:proof,timePrecision:'estimated',scheduleStatus:'provisional',timeTbc:false,startTimeTbc:false,time:`${parts.hour}:${parts.minute}`,date:`${parts.year}-${parts.month}-${parts.day}`};
}
// A later source check may confirm the same planning fact after its instant.
// Retain an earlier admission, never admit a first or changed elapsed guess.
function retainElapsed(previous,event,proof,now=Date.now()){
 now=+new Date(now);const admitted=previous.planningTimeEvidence,start=instant(proof?.startsAt),checked=instant(proof?.checkedAt);
 if(event.planningTimeEvidence||previous.startTimeUtc||event.startTimeUtc||previous.timePrecision!=='estimated'||!admitted||!Number.isFinite(now)||!Number.isFinite(start)||start>now||!Number.isFinite(checked)||checked>now||now-checked>6*3600000||checked<instant(admitted.checkedAt))return event;
 if(!['kind','fixtureId','startsAt','sourceName','sourceUrl','timeTbc'].every(k=>JSON.stringify(proof[k])===JSON.stringify(admitted[k]))||!Array.isArray(proof.participantIds)||!Array.isArray(admitted.participantIds)||JSON.stringify([...proof.participantIds].sort())!==JSON.stringify([...admitted.participantIds].sort()))return event;
 const priorCheck=instant(admitted.checkedAt);
 if(apply(previous,admitted,priorCheck)===previous)return event;
 const retained=apply(event,{...proof,checkedAt:admitted.checkedAt},priorCheck);
 return retained===event?event:{...retained,planningTimeEvidence:admitted,scheduleNote:previous.scheduleNote};
}
module.exports={apply,retainElapsed,instant,displayedClockAgrees};
