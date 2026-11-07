'use strict';
// One bounded public contract for the existing global read's failure. Never
// copy dependency messages, paths, query bodies, fixtures or account fields.
const SCHEMA='fixture-snapshot-failure.v1';
const phases=new Set(['source-health','fixture-bundle','validation','projection']);
const transportPhases=new Set(['fetch-start','headers','text-start','text-ready','parse-start','parse-ready','timeout','caller-abort','error','complete']);
const outcomes=new Set(['success','http-error','transport-error','body-error','timeout','caller-abort']);
const code=value=>typeof value==='string'&&/^(?:[0-9A-Z]{5}|PGRST\d{3}|supabase_timeout|supabase_maintenance)$/.test(value)?value:null;
const status=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;
const duration=value=>value===null?null:typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=60000?value:undefined;
function diagnostic(value){
 if(!value||value.schemaVersion!==SCHEMA||value.scope!=='global'||!phases.has(value.phase)||![3000,6000].includes(value.deadlineMs))return null;
 if(typeof value.readId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.readId))return null;
 if(typeof value.startedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.startedAt)||!Number.isFinite(Date.parse(value.startedAt))||new Date(value.startedAt).toISOString()!==value.startedAt)return null;
 const elapsed=duration(value.elapsedMs),validation=duration(value.timings?.validationMs),projection=duration(value.timings?.projectionMs);
 if(elapsed==null||validation===undefined||projection===undefined)return null;
 const legs={};
 for(const name of ['source-health','fixture-bundle']){
  const leg=value.timings?.legs?.[name];if(!leg)continue;
  if(!['success','error',null].includes(leg.outcome)||duration(leg.elapsedMs)===undefined||!Array.isArray(leg.transport)||leg.transport.length>12)return null;
  const transport=[];
  for(const entry of leg.transport){
   if(!transportPhases.has(entry?.phase)||duration(entry.elapsedMs)===undefined)return null;
   const bytes=entry.bytes===null?null:typeof entry.bytes==='number'&&Number.isFinite(entry.bytes)&&entry.bytes>=0&&entry.bytes<=64*1024*1024?entry.bytes:undefined;
   if(bytes===undefined)return null;
   transport.push({phase:entry.phase,elapsedMs:entry.elapsedMs,status:status(entry.status),bytes,
    ...(['empty','json','text'].includes(entry.format)?{format:entry.format}:{}),...(outcomes.has(entry.outcome)?{outcome:entry.outcome}:{})});
  }
  legs[name]={elapsedMs:leg.elapsedMs,outcome:leg.outcome,transport};
 }
 if(!Object.keys(legs).length)return null;
 const result={schemaVersion:SCHEMA,readId:value.readId,startedAt:value.startedAt,scope:'global',phase:value.phase,status:status(value.status),code:code(value.code),deadlineMs:value.deadlineMs,elapsedMs:elapsed,timings:{legs,validationMs:validation,projectionMs:projection}};
 return Buffer.byteLength(JSON.stringify(result))<=8192?result:null;
}
function failure(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const detail=diagnostic(value.diagnostic);
 return {code:code(value.code)||'current_input_unavailable',status:status(value.status),...(detail?{diagnostic:detail}:{})};
}
module.exports={SCHEMA,code,status,diagnostic,failure};
