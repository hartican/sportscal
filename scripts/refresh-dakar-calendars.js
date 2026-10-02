#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/dakar-calendar.v1.json';
const official=url=>/^https:\/\/(?:www\.dakar\.com\/|storage-aso\.lequipe\.fr\/ASO\/)/.test(url||'');
function validate(doc){
 if(doc.schemaVersion!=='dakar-reviewed-calendar.v1'||!Number.isFinite(Date.parse(doc.checkedAt))||doc.editions?.length!==2)throw Error('Incomplete Dakar calendar review');
 const years=new Set();
 for(const e of doc.editions){
  if(years.has(e.year)||![2026,2027].includes(e.year)||!official(e.sourceUrl)||!e.completeStageCalendar||e.stages?.length!==14||e.restDays?.length!==1)throw Error('Unreviewed Dakar edition');years.add(e.year);
  const dates=new Set();e.stages.forEach((s,i)=>{if(s.number!==i||!/^20\d\d-\d\d-\d\d$/.test(s.date)||!s.date.startsWith(e.year+'-')||dates.has(s.date)||i&&s.date<=e.stages[i-1].date||!s.start||!s.finish||s.startCountryCode!=='SA'||s.finishCountryCode!=='SA'||!official(s.sourceUrl)||s.courseGeometryVerified)throw Error('Invalid stage or unreviewed stage geometry');dates.add(s.date);if(s.specialDistanceKm!=null&&(!(s.specialDistanceKm>0)||s.totalDistanceKm<s.specialDistanceKm))throw Error('Invalid published distance');});
  if(e.date!==e.stages[0].date||e.endDate!==e.stages.at(-1).date||e.status!==(e.year===2026?'completed':'upcoming'))throw Error('Incorrect edition window');
  for(const r of e.restDays)if(dates.has(r.date)||!r.date.startsWith(e.year+'-')||!r.venue||!official(r.sourceUrl)||r.date<=e.date||r.date>=e.endDate)throw Error('Rest day is not a competitive stage');
  if(!e.editionGeometryVerified||e.editionArtworkId!==`dakar-${e.year}`||!official(e.editionGeometrySourceUrl))throw Error('Unverified edition geometry');
 }
 return doc;
}
function apply(prior,document){
 const doc=validate(document),old=new Map((prior.events||[]).map(e=>[e.id,e])),sources={...prior.sources},events=[];
 for(const e of doc.editions)for(const s of e.stages){
  const id=`event:dakar:${e.year}:${s.number?'stage-'+s.number:'prologue'}`,known=old.get(id),sourceId=`dakar-${e.year}-calendar`;
  if(known&&known.date!==s.date)throw Error('Stage date correction requires identity review: '+id);
  sources[sourceId]={name:'Dakar / ASO official itinerary',url:e.sourceUrl,type:'official',checkedAt:doc.checkedAt};
  const label=s.number?`Stage ${s.number}`:'Prologue',venue=`${s.start} → ${s.finish}`;
  const record={id,sportKey:'dakar',codeId:'competition:dakar',taxonomyNodeId:'competition:dakar',competitionId:'competition:dakar',sportDomainId:'sport:motorsport',season:String(e.year),gender:'mixed',name:`${e.name} — ${label}: ${venue}`,displayTitleCompact:`${e.name} — ${label}`,tournamentName:e.name,weekendId:`dakar:${e.year}`,editionEndDate:e.endDate,roundNumber:s.number,roundLabel:label,round:'all',stage:label,sessionType:s.number?'stage':'prologue',date:s.date,time:null,dateOnly:true,timeTbc:true,timePrecision:'date-only',status:e.status,participantsConfirmed:false,participantIds:[],resultCoverage:'calendar-only',expected:8,liveWindow:8,
   venue,venueOfficialName:venue,venueVerified:true,venueCountryCode:s.startCountryCode,finishCountryCode:s.finishCountryCode,venueSourceUrl:s.sourceUrl,venueCaption:`${e.year} • ${s.specialDistanceKm?`${s.specialDistanceKm} km special • `:''}Stage route unverified`,courseGeometryVerified:false,dakarCalendar:true,itineraryScope:s.itineraryScope||s.distanceScope,totalDistanceKm:s.totalDistanceKm,specialDistanceKm:s.specialDistanceKm,calendarProvenance:{sourceUrl:e.sourceUrl,checkedAt:doc.checkedAt},sourceId,sourceUrl:s.sourceUrl,sourceCheckedAt:doc.checkedAt,scheduleNote:`Published competitive date; start time and stage geometry unconfirmed. ${s.itineraryScope||'Distances from the published edition overview; class routes may differ.'}`,hook:`${label}: ${venue}.`,context:'Published Dakar competitive itinerary. Stage geometry, class entries, results and Australian viewing remain partial.'};
  if(e.status==='completed')record.result={status:'pending',sourceId,checkedAt:doc.checkedAt};
  events.push(known?{...record,...known,...Object.fromEntries(['venue','venueOfficialName','venueCountryCode','finishCountryCode','venueSourceUrl','venueCaption','calendarProvenance','scheduleNote','itineraryScope','totalDistanceKm','specialDistanceKm'].map(k=>[k,record[k]]))}:record);
 }
 return {...prior,schemaVersion:'dakar-calendar.v1',sources,participants:prior.participants||[],events,editions:doc.editions,coverage:{status:'partial',completeStageCalendars:true,publishedCompetitiveDays:28,restDays:2,checkedAt:doc.checkedAt,note:'Official 2026 and 2027 prologues and 13 stages per edition. Rest days are schedule notes. Edition route artwork is restricted to Events parents; start times, stage geometry, entries, results and viewing remain unconfirmed.'}};
}
function refresh({root=ROOT,document}={}){const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{events:[],sources:{}};const next=apply(prior,document||JSON.parse(fs.readFileSync(path.join(root,'feeds/provider-exports/dakar/calendar.v1.json'))));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return next.coverage;}
if(require.main===module)try{console.log(JSON.stringify(refresh()));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={validate,apply,refresh};
