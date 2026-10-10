'use strict';
// Provisional scheduling only. This never changes a sporting status or the
// confirmed UTC start, and never grants automatic-reminder eligibility.
const identity=require('../config/event-action-identity');
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)+'T00:00:00Z').toISOString().startsWith(value.slice(0,10))?Date.parse(value):NaN;
const settled=e=>['completed','finished','final'].includes(e.status);
function estimate(fixture,rows,now=new Date()){
 const proof=fixture.sessionOrderEvidence,at=+now;
 if(!proof||proof.kind!=='official-session-order'||!['scheduled','upcoming'].includes(fixture.status)||fixture.sourceStale||fixture.stale||fixture.manualEstimateHeld||fixture.participantsConfirmed!==true)return null;
 const checked=instant(proof.checkedAt),start=instant(proof.startsAt);
 if(!Number.isFinite(checked)||checked>at||at-checked>48*3600000||!Number.isFinite(start)||!/^https:\/\/www\.protennislive\.com\/posting\/\d{4}\/\d+\/op\.pdf$/.test(proof.sourceUrl)||!/^[a-f0-9]{64}$/.test(proof.sourceSha256||'')||proof.court!==fixture.court||proof.tournamentId!==fixture.tournamentId||!Array.isArray(proof.fixtureIds)||proof.fixtureIds.length>20||new Set(proof.fixtureIds).size!==proof.fixtureIds.length)return null;
 if(/doubles|mixed|team/i.test([fixture.discipline,fixture.drawType,fixture.eventType,fixture.format].join(' ')))return null;
 const key=identity.stableKey(fixture),position=proof.fixtureIds.indexOf(key);
 if(position<1||!['followed-by','follows','estimated'].includes(fixture.timePrecision)||JSON.stringify(proof.participantIdsByFixture?.[key])!==JSON.stringify(fixture.participantIds))return null;
 const aliases=new Map();for(const row of rows)for(const id of identity.aliasesForEvent(row))aliases.set(id,row);
 const first=aliases.get(proof.fixtureIds[0]);
 if(!first||first.scheduleEvidence?.startsAt!==proof.startsAt||first.scheduleEvidence?.sourceSha256!==proof.sourceSha256||first.scheduleEvidence?.playOrder!==1)return null;
 let predicted=start;const durationMinutes=90,changeoverMinutes=10;
 for(const id of proof.fixtureIds.slice(0,position)){
  const row=aliases.get(id);
  if(!row||row.tournamentId!==proof.tournamentId||row.court!==proof.court||JSON.stringify(proof.participantIdsByFixture[id])!==JSON.stringify(row.participantIds)||row.sourceStale||row.stale||row.manualEstimateHeld)return null;
  if(['cancelled','canceled','abandoned','postponed','stumps','suspended','interrupted','rain-delay','break'].includes(row.status))return null;
  const observed=instant(row.statusCheckedAt||row.livePlayObservedAt);
  if(settled(row)){
   const finished=instant(row.actualEndTimeUtc||row.completedAt||row.firstConfirmedCompleteAt||row.statusFactObservedAt||row.statusCheckedAt);
   if(!Number.isFinite(finished)||finished>at||finished<start)return null;
   predicted=Math.max(start,finished)+changeoverMinutes*60000;
  }else if(['live','in-progress','in_progress'].includes(row.status)){
   if(!Number.isFinite(observed)||observed>at||at-observed>240000)return null;
   const actual=instant(row.actualStartTimeUtc),seconds=row.matchDurationSeconds;
   let remaining=Number.isFinite(seconds)&&seconds>=0?Math.max(15,durationMinutes-seconds/60):null;
   if(remaining===null&&typeof row.matchDuration==='string'&&/^\d{1,2}:\d{2}(?::\d{2})?$/.test(row.matchDuration)){const bits=row.matchDuration.split(':').map(Number);remaining=Math.max(15,durationMinutes-(bits[0]*60+bits[1]+(bits[2]||0)/60));}
   predicted=(remaining!==null?at+remaining*60000:Math.max(at+15*60000,(Number.isFinite(actual)?actual:predicted)+durationMinutes*60000))+changeoverMinutes*60000;
  }else if(['upcoming','scheduled'].includes(row.status)){
   const bound=instant(row.startTimeUtc);if(Math.max(predicted,Number.isFinite(bound)?bound:predicted)<=at&&(!Number.isFinite(observed)||at-observed>240000))return null;predicted=Math.max(predicted,Number.isFinite(bound)?bound:predicted)+durationMinutes*60000+changeoverMinutes*60000;
  }else return null;
 }
 if(predicted<=at||predicted>start+24*3600000)return null;
 return {kind:'official-session-order-estimate',verified:true,fixtureId:key,startsAt:new Date(predicted).toISOString(),calculatedAt:fixture.manualStartEstimate?.startsAt===new Date(predicted).toISOString()?fixture.manualStartEstimate.calculatedAt:new Date(at).toISOString(),sourceCheckedAt:proof.checkedAt,sourceUrl:proof.sourceUrl,sourceSha256:proof.sourceSha256,sessionId:proof.sessionId,assumedDurationMinutes:durationMinutes,changeoverMinutes};
}
function apply(rows,now=new Date()){
 if(!rows.some(e=>e.sessionOrderEvidence||e.manualStartEstimate))return rows;
 return rows.map(e=>{
  const provisional=estimate(e,rows,now);
  if(provisional){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(provisional.startsAt)).map(p=>[p.type,p.value]));return {...e,manualStartEstimate:provisional,estimatedStartTimeUtc:provisional.startsAt,timePrecision:'estimated',scheduleStatus:'provisional',timeTbc:false,startTimeTbc:false,time:`${parts.hour}:${parts.minute}`,scheduleNote:'Approximate start from official court order; assumes 90-minute matches and 10-minute changeovers. Adjusts with verified preceding-match progress.'};}
  if(e.manualStartEstimate){const {manualStartEstimate,...rest}=e;return {...rest,estimatedStartTimeUtc:null,timePrecision:e.scheduleEvidence?.timePrecision||'unresolved',scheduleStatus:'unresolved',timeTbc:true,startTimeTbc:true,time:null};}
  return e;
 });
}
function contextIds(ids,rows){const selected=new Set(ids);for(const row of rows)if(identity.aliasesForEvent(row).some(id=>selected.has(id)))for(const id of row.sessionOrderEvidence?.fixtureIds||[])if(selected.size<60)selected.add(id);return [...selected];}
module.exports={estimate,apply,contextIds};
