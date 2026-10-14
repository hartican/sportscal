'use strict';
const crypto=require('node:crypto'),policy=require('../config/epic-classics');
const {supabaseServiceRequest}=require('./supabase-server');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value??null)).digest('hex');
const path=(table,parameters={})=>'/rest/v1/nothingsports_'+table+'?'+new URLSearchParams(parameters);
const rpc=(name,body,request=supabaseServiceRequest)=>request('/rest/v1/rpc/nothingsports_'+name,{method:'POST',body});
function recordFor(event,{sourceUrls=[],publishedSha=null,held=null,nsScore=null,now=new Date()}={}){
 const identity=require('../config/fixture-identity'),id=identity.canonicalFixtureId(event.canonicalEventId||event.eventId||event.id);
 const aliases=[...new Set([id,event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[]),...(event.legacyEventIds||[])].filter(Boolean))];
 const date=policy.finalDay(event,now),completed=policy.completed(event),narrative=event.editorialNarrative||{};
 const fixture={id,name:event.name||event.displayTitleCompact||null,key:event.key||event.sportKey||null,date:event.date||event.startDate||null,endDate:event.endDate||null,finalDate:date,year:date?Number(date.slice(0,4)):null,status:event.status||null,completed,sourceUrl:event.sourceUrl||null,...Object.fromEntries(['kind','competitionId','tournamentId','tournamentName','roundLabel','round','stage','eventType','matchType','gender','tour','participantIds','participants','participantNames','sourceEventIds','tennisDrawType','eventFamilyId','startTimeUtc','actualStartTimeUtc','actualStartEvidence','endTimeUtc','actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','displayTitleCompact'].filter(k=>event[k]!==undefined).map(k=>[k,event[k]]))};
 const copies=[],urls=[...new Set([...sourceUrls,...(event.editorialSources||[]),event.sourceUrl].filter(u=>/^https:\/\//.test(u||'')))];
 const add=(phase,copy,extraUrls=urls)=>{if(!copy||!Object.values(copy).some(v=>typeof v==='string'&&v.trim()))return;const observedAt=copy.observedAt||copy.researchedAt||now.toISOString();const normalized={...copy,finalized:phase==='impact'?completed:phase==='heat'?completed||/^(live|in_progress|in-progress|ongoing)$/.test(event.status||''):completed};copies.push({phase,milestone:'final',copy:normalized,sourceUrls:extraUrls,hash:hash(Object.fromEntries(Object.entries(normalized).filter(([key])=>!['finalized','observedAt','researchedAt'].includes(key)))),observedAt});if(phase==='heat')copies.push({...copies[copies.length-1],milestone:'first-five'});};
 const original=event.editorialPhases?.heat||(!['recap','impact'].includes(narrative.phase)?narrative:null);
 if(original)add('heat',Object.fromEntries(['hook','body','formCopy','closingCopy','synopsis','researchedAt'].filter(k=>original[k]).map(k=>[k,original[k]])));
 const live=event.editorialPhases?.pulse||policy.liveContext(event,now);if(live)add('pulse',live,live.sourceUrls||urls);
 const impact=event.postMatchEditorial||event.editorialPhases?.impact;if(impact)add('impact',impact,impact.sourceUrls||urls);
 if(Object.hasOwn(event,'highlights'))fixture.highlights=event.highlights;
 const factsSignature=completed?policy.factsSignature(event):null,signature=factsSignature?hash(factsSignature):null;
 return{eventId:id,aliases,fixture,copies,resultSignature:signature,factsSignature,nsScore:nsScore===null?Math.max(0,...[event.stakesScore,event.publishedOngoingScore,event.publishedImpactScore].map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=5)):nsScore,held,publishedSha,observedAt:event.statusCheckedAt||event.sourceCheckedAt||now.toISOString()};
}
async function record(events,options={}){
 const request=options.request||supabaseServiceRequest,records=events.map(event=>{const record=recordFor(event,options);if(options.captureCopies===false)record.copies=[];return record;});
 let batch=[],bytes=0;for(const record of records){const size=Buffer.byteLength(JSON.stringify(record));if(batch.length&&(batch.length===100||bytes+size>500000)){await rpc('record_classic_fixtures',{records:batch},request);batch=[];bytes=0;}batch.push(record);bytes+=size;}if(batch.length)await rpc('record_classic_fixtures',{records:batch},request);
 return{recorded:records.length};
}
async function afterRating(event,receipt,request=supabaseServiceRequest){
 try{if(Number(receipt.rating)!==5)return receipt;await record([event],{request});return{...receipt,classicCaptured:true};}
 catch{return{...receipt,classicSaved:false,classicPending:Number(receipt.rating)===5};} // The transactional vote latch survives source-store failure.
}
function safeFixture(record){const fixture=record?.fixture||{};return{...fixture,id:record?.event_id,canonicalEventId:record?.event_id};}
function safeEditorial(rows,results=false){return rows.map(row=>({phase:row.phase,milestone:row.milestone,capturedAt:row.captured_at,publishedSha:row.published_sha,...(row.phase==='heat'||results?{copy:row.copy,sourceUrls:row.source_urls||[]}:{available:true,redacted:true})}));}
async function referencedClassics({cursor='',limit=100,request=supabaseServiceRequest}={}){limit=Math.max(1,Math.min(499,limit));const rows=await rpc('referenced_classics',{after_event:cursor,page_limit:limit+1},request);return{entries:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].event_id:null};}
async function hydrateHighlights(eventId,highlights,{request=supabaseServiceRequest}={}){return rpc('hydrate_classic_highlights',{p_event_id:eventId,p_record:highlights},request);}
module.exports={policy,path,rpc,recordFor,record,afterRating,hash,safeFixture,safeEditorial,referencedClassics,hydrateHighlights};
