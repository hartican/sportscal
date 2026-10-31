'use strict';
// Private release artifacts only. Never log raw responses, errors or account data.
const scalar=(value,type)=>typeof value===type?value:null;
const pick=(value,keys,type)=>Object.fromEntries(keys.map(key=>[key,scalar(value?.[key],type)]));
function scoreRead(value){return {available:value?.schemaVersion==='score-read.v1',outcome:['not-needed','succeeded','failed'].includes(value?.outcome)?value.outcome:null,...Object.fromEntries(['plannedBatches','attemptedBatches','completedBatches','failedBatches','pendingBatches','unattemptedBatches'].map(key=>[key,Number.isSafeInteger(value?.[key])&&value[key]>=0?value[key]:null]))};}
function project(row,receipt=null){
 if(!row||typeof row!=='object')return null;
 const stamp=value=>typeof value==='string'&&value.length<=100?value:null,r=receipt;
 return {...Object.fromEntries(['id','sport','status','homeParticipantId','awayParticipantId','startTimeUtc','scoreCheckedAt','statusCheckedAt','statusFactObservedAt','checkedAt'].map(key=>[key,stamp(row[key])])),stale:scalar(row.stale,'boolean'),freshnessReceipt:{available:r?.schemaVersion==='fixture-freshness.v1',evaluatedAt:stamp(r?.evaluatedAt),budgetMs:Number.isFinite(r?.budgetMs)?r.budgetMs:null,candidateCheckedAt:stamp(r?.candidateCheckedAt),ageMs:Number.isFinite(r?.ageMs)?r.ageMs:null,reasons:pick(r?.reasons,['membershipDegraded','scoreReadFailed','missingCheckedAt','ageExpired','explicitStale','sourceMarkedStale','missingScoreObservation','retainedPrior'],'boolean'),retention:['settled-prior','older-observation','interruption-score'].includes(r?.retention)?r.retention:null,decision:['retained-prior','projected'].includes(r?.decision)?r.decision:null,returnedCheckedAt:stamp(r?.returnedCheckedAt),returnedScoreCheckedAt:stamp(r?.returnedScoreCheckedAt),returnedStatusCheckedAt:stamp(r?.returnedStatusCheckedAt),returnedStale:scalar(r?.returnedStale,'boolean')}};
}
function collector(){
 const report={schemaVersion:'match-centre-read-evidence.v1',acceptance:false,reads:[],chosenId:null};
 return {report,capture({kind,sha,body,read}){
  report.sha=sha;
  const fixtures=Array.isArray(body?.fixtures)?body.fixtures:[];
  if(kind==='membership'){const target=fixtures.find(f=>f?.stale===false)||fixtures[0];report.chosenId=target?String(target.canonicalEventId||target.eventId||target.id||''):null;report.listing=project(target,body.freshnessReceipts?.find(r=>r.id===report.chosenId));}
  if(kind==='selected')report.selected=project(fixtures.find(f=>f?.id===report.chosenId),body.freshnessReceipts?.find(r=>r.id===report.chosenId));
  report.reads.push({kind,requestStartedAt:read.requestStartedAt,responseEndedAt:read.responseEndedAt,status:read.status,elapsedMs:read.elapsedMs,serverMs:Object.fromEntries(['catalogue','prepare','snapshot','merge','selection','scores','projection','total'].filter(k=>Number.isFinite(read.serverMs?.[k])).map(k=>[k,read.serverMs[k]])),scoreRead:scoreRead(body?.scoreRead)});
  return report;
 }};
}
module.exports={collector,project,scoreRead};
