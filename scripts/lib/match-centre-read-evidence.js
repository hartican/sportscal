'use strict';
// Private release artifacts only. Never log raw responses, errors or account data.
const scalar=(value,type)=>typeof value===type?value:null;
const stamp=value=>typeof value==='string'&&value.length<=100?value:null;
const own=(value,key)=>!!value&&Object.hasOwn(value,key);
const clockField=(value,key)=>own(value,key)&&(value[key]===null||stamp(value[key])!==null);
const reasonKeys=['membershipDegraded','scoreReadFailed','missingCheckedAt','ageExpired','explicitStale','sourceMarkedStale','missingScoreObservation','retainedPrior'];
const retentions=['settled-prior','older-observation','interruption-score'];
function scoreRead(value){
 const names=['plannedBatches','attemptedBatches','completedBatches','failedBatches','pendingBatches','unattemptedBatches'];
 const counts=Object.fromEntries(names.map(key=>[key,Number.isSafeInteger(value?.[key])&&value[key]>=0?value[key]:null]));
 const {plannedBatches:p,attemptedBatches:a,completedBatches:c,failedBatches:f,pendingBatches:n,unattemptedBatches:u}=counts;
 const coherent=Object.values(counts).every(v=>v!==null)&&p===a+u&&a===c+f+n;
 const outcome=value?.outcome;
 const available=value?.schemaVersion==='score-read.v1'&&coherent&&(outcome==='not-needed'&&p===0||outcome==='succeeded'&&p>0&&c===p&&f===0&&n===0&&u===0||outcome==='failed'&&f>0);
 return {available,outcome:available?outcome:null,...counts};
}
function freshness(row,r){
 const retention=r?.retention,decision=r?.decision;
 const available=r?.schemaVersion==='fixture-freshness.v1'&&stamp(r.evaluatedAt)!==null&&Number.isFinite(Date.parse(r.evaluatedAt))&&Number.isFinite(r.budgetMs)&&r.budgetMs>=0&&own(r,'ageMs')&&(r.ageMs===null||Number.isFinite(r.ageMs))&&['candidateCheckedAt','returnedCheckedAt','returnedScoreCheckedAt','returnedStatusCheckedAt'].every(k=>clockField(r,k))&&reasonKeys.every(k=>typeof r.reasons?.[k]==='boolean')&&(retention===null||retentions.includes(retention))&&decision===(retention?'retained-prior':'projected')&&r.reasons.retainedPrior===Boolean(retention)&&typeof r.returnedStale==='boolean'&&typeof row.stale==='boolean'&&r.returnedStale===row.stale;
 return {available,evaluatedAt:stamp(r?.evaluatedAt),budgetMs:Number.isFinite(r?.budgetMs)?r.budgetMs:null,candidateCheckedAt:stamp(r?.candidateCheckedAt),ageMs:Number.isFinite(r?.ageMs)?r.ageMs:null,reasons:Object.fromEntries(reasonKeys.map(k=>[k,scalar(r?.reasons?.[k],'boolean')])),retention:available?retention:null,decision:available?decision:null,returnedCheckedAt:stamp(r?.returnedCheckedAt),returnedScoreCheckedAt:stamp(r?.returnedScoreCheckedAt),returnedStatusCheckedAt:stamp(r?.returnedStatusCheckedAt),returnedStale:scalar(r?.returnedStale,'boolean')};
}
function project(row,receipt=null){
 if(!row||typeof row!=='object')return null;
 return {...Object.fromEntries(['id','sport','status','homeParticipantId','awayParticipantId','startTimeUtc','scoreCheckedAt','statusCheckedAt','statusFactObservedAt','checkedAt'].map(key=>[key,stamp(row[key])])),stale:scalar(row.stale,'boolean'),freshnessReceipt:freshness(row,receipt)};
}
function receiptFor(body,id){return Array.isArray(body?.freshnessReceipts)?body.freshnessReceipts.find(r=>r&&typeof r==='object'&&!Array.isArray(r)&&r.id===id)||null:null;}
function collector(){
 const report={schemaVersion:'match-centre-read-evidence.v1',acceptance:false,reads:[],chosenId:null};
 return {report,capture({kind,sha,body,read}){
  report.sha=sha;
  const fixtures=Array.isArray(body?.fixtures)?body.fixtures:[];
  if(kind==='membership'){const target=fixtures.find(f=>f?.stale===false)||fixtures[0];report.chosenId=target?String(target.canonicalEventId||target.eventId||target.id||''):null;report.listing=project(target,receiptFor(body,report.chosenId));}
  if(kind==='selected')report.selected=project(fixtures.find(f=>f?.id===report.chosenId),receiptFor(body,report.chosenId));
  report.reads.push({kind,requestStartedAt:read.requestStartedAt,responseEndedAt:read.responseEndedAt,status:read.status,elapsedMs:read.elapsedMs,serverMs:Object.fromEntries(['catalogue','prepare','snapshot','merge','selection','scores','projection','total'].filter(k=>Number.isFinite(read.serverMs?.[k])).map(k=>[k,read.serverMs[k]])),scoreRead:scoreRead(body?.scoreRead)});
  return report;
 }};
}
module.exports={collector,project,scoreRead};
