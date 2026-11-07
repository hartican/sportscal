#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/lemans-calendar.v1.json';
const official=url=>/^https:\/\/www\.fiawec\.com\/en\/race\/24-hours-of-le-mans-202[67](?:#|$)/.test(url||'');
const TYPES=['practice','warm-up','qualifying','hyperpole','race-start','race-finish'];
const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function sydney(iso){const p=Object.fromEntries(parts.formatToParts(new Date(iso)).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function validate(doc){
 if(doc.schemaVersion!=='lemans-reviewed-calendar.v1'||!Number.isFinite(Date.parse(doc.checkedAt))||doc.editions?.length!==2)throw Error('Incomplete Le Mans source review');
 const years=new Set();for(const e of doc.editions){
  if(years.has(e.year)||![2026,2027].includes(e.year)||!official(e.sourceUrl)||!e.completePublishedProgramme||e.sessions?.length!==13)throw Error('Incomplete published Le Mans programme');years.add(e.year);
  const slugs=new Set();for(const s of e.sessions){
   if(slugs.has(s.slug)||!TYPES.includes(s.sessionType)||!s.name||!s.localDate?.startsWith(e.year+'-')||!official(s.sourceSessionId)||!official(s.timingSourceUrl))throw Error('Invalid or duplicate published session');slugs.add(s.slug);
   if(s.timePrecision==='date-only'){if(s.localStart||s.estimatedLocalStart)throw Error('TBC session cannot acquire a placeholder clock');}
   else if(s.timePrecision==='exact'){if(!/^20\d\d-\d\d-\d\dT\d\d:\d\d:00\+02:00$/.test(s.localStart||'')||!s.localStart.startsWith(s.localDate))throw Error('Missing confirmed local offset');}
   else if(s.timePrecision==='estimated'){if(s.sessionType!=='race-finish'||s.localStart||!s.endTimeBasis||!s.timingNote||!Number.isFinite(Date.parse(s.estimatedLocalStart)))throw Error('Finish estimate must be labelled');}
   else throw Error('Unknown timing precision');
  }
  if(e.sessions.filter(s=>s.sessionType==='practice').length!==4||e.sessions.filter(s=>s.sessionType==='warm-up').length!==1||e.sessions.filter(s=>s.sessionType==='qualifying').length!==2||e.sessions.filter(s=>s.sessionType==='hyperpole').length!==4)throw Error('Published session classes are incomplete');
  const start=e.sessions.find(s=>s.sessionType==='race-start'),finish=e.sessions.find(s=>s.sessionType==='race-finish');
  if(!start||!finish||new Date(finish.estimatedLocalStart)-new Date(start.localStart)!==86400000)throw Error('Race milestones must preserve confirmed start and labelled 24-hour estimate');
 }
 return doc;
}
function apply(prior,document){
 const doc=validate(document),old=new Map((prior.events||[]).map(e=>[e.id,e])),sources={...prior.sources},events=[];
 for(const e of doc.editions){
  const sourceId=`lemans-${e.year}-programme`;sources[sourceId]={name:'FIA WEC / ACO official Le Mans programme',url:e.sourceUrl,type:'official',checkedAt:doc.checkedAt};
  e.sessions.forEach((s,i)=>{
   const id=`event:lemans:${e.year}:${s.slug}`,dateOnly=s.timePrecision==='date-only',estimated=s.timePrecision==='estimated',iso=s.localStart||s.estimatedLocalStart,timing=dateOnly?{date:s.localDate,time:null}:sydney(iso);
   const record={id,sportKey:'lemans',codeId:'competition:le-mans',taxonomyNodeId:'competition:le-mans',competitionId:'competition:fia-wec',sportDomainId:'sport:motorsport',identityRef:'event:le-mans',eventFamilyId:'le-mans-24-hours',season:String(e.year),gender:'mixed',name:`${e.name} — ${s.name}`,displayTitleCompact:`24 Hours of Le Mans — ${s.name}`,tournamentName:e.name,weekendId:`lemans:${e.year}`,sessionType:s.sessionType,sessionOrder:i,sourceSessionIds:[s.sourceSessionId],roundLabel:s.name,round:'all',stage:s.name,...timing,dateOnly,timeTbc:dateOnly,timePrecision:s.timePrecision,startTimeUtc:s.localStart?new Date(s.localStart).toISOString():null,estimatedStartTimeUtc:estimated?new Date(iso).toISOString():null,...(estimated?{endTimeBasis:s.endTimeBasis}:{}),timingProvenance:{sourceUrl:s.timingSourceUrl,checkedAt:doc.checkedAt,basis:estimated?s.endTimeBasis:dateOnly?'Visible TBC overrides structured-data noon placeholders':'Explicit +02:00 source clock, concordant with visible local timetable; conflicting ICS UTC ignored'},status:e.status,participantsConfirmed:false,participantIds:[],resultCoverage:'calendar-only',expected:8,liveWindow:s.sessionType==='race-start'?24:1,
    venue:'Circuit de la Sarthe',venueOfficialName:'Circuit de la Sarthe',venueId:'venue:le-mans:sarthe',venueVerified:true,venueCity:'Le Mans',venueCountryCode:'FR',venueSourceUrl:e.sourceUrl,venueConfigurationId:'le-mans:circuit-de-la-sarthe:full',venueConfigurationVerified:true,venueArtworkId:'sarthe-white',venueGeometrySourceUrl:'https://www.fiawec.com/uploads/2024-tracks-rvb-lemans-b-976827-697a1dbfdd5da760499701.png',circuitLengthMetres:13626,circuitTurns:38,venueCaption:`${e.year} • Full 13.626 km circuit • ${s.name}`,lemansCalendar:true,calendarProvenance:{sourceUrl:e.sourceUrl,checkedAt:doc.checkedAt},sourceId,sourceUrl:e.sourceUrl,sourceCheckedAt:doc.checkedAt,scheduleNote:estimated?s.timingNote:dateOnly?'Published session date; start time TBC.':'Confirmed local source time converted to Australia/Sydney.',hook:`${s.name} at Circuit de la Sarthe.`,context:'Published Le Mans session programme. Entries, new results and Australian viewing remain unconfirmed.'};
   if(e.year===2026&&['start','finish'].includes(s.slug))record.legacyCardId=s.slug==='start'?'evt_79':'evt_80';
   if(e.status==='completed')record.result={status:'pending',sourceId,checkedAt:doc.checkedAt};
   const known=old.get(id);events.push(known?{...known,...record,...Object.fromEntries(['result','resultCoverage','participantsConfirmed','participantIds'].filter(k=>known[k]!=null).map(k=>[k,known[k]]))}:record);
  });
 }
 return {...prior,schemaVersion:'lemans-calendar.v1',sources,participants:prior.participants||[],events,editions:doc.editions,coverage:{status:'partial',completePublishedProgrammes:true,publishedSessions:24,scheduleRecords:26,sportingCards:16,checkedAt:doc.checkedAt,note:'All twelve FIA WEC sessions per edition, with race represented by separate preserved Start and approximate Finish identities. Practice/warm-up are Schedule only. Entries, future session clocks, new results and Australian viewing remain unconfirmed; support races and ceremonies are not inferred.'}};
}
function refresh({root=ROOT,document}={}){const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{events:[],sources:{}};const next=apply(prior,document||JSON.parse(fs.readFileSync(path.join(root,'feeds/provider-exports/lemans/calendar.v1.json'))));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return next.coverage;}
if(require.main===module)try{console.log(JSON.stringify(refresh()));}catch(e){console.error(e.stack);process.exitCode=1;}
module.exports={validate,apply,refresh,sydney};
