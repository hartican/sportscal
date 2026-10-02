#!/usr/bin/env node
'use strict';
// Reviewed organiser event windows. The existing cards owner is the sole refresh
// path; no heats, start times, participants or results are inferred.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/wsl-calendar.v1.json';
const LEGACY_ID='calendar-nothingsport-manual-seed-wsl-margaret-river-pro-2026';
function validate(doc){
 if(doc.schemaVersion!=='wsl-reviewed-calendar.v1'||doc.year!==2026||doc.sourceUrl!=='https://www.worldsurfleague.com/events/2026/ct?all=1'||!Number.isFinite(Date.parse(doc.checkedAt))||! /^[a-f0-9]{64}$/.test(doc.sourceSnapshotSha256)||doc.events?.length!==12)throw Error('Incomplete or unreviewed WSL edition');
 if(new Set(doc.events.map(e=>e.id)).size!==12||new Set(doc.events.map(e=>e.slug)).size!==12)throw Error('Duplicate WSL event');
 for(const e of doc.events){if(!/^\d+$/.test(e.id)||!e.name||!e.venue||!e.city||! /^[A-Z]{2}$/.test(e.countryCode)||!/^2026-\d{2}-\d{2}$/.test(e.date)||!/^2026-\d{2}-\d{2}$/.test(e.endDate)||e.endDate<e.date||!['completed','upcoming'].includes(e.status)||!e.sourceUrl.startsWith(`https://www.worldsurfleague.com/events/2026/ct/${e.id}/`))throw Error('Invalid WSL window');}
 for(const e of doc.futureAnnouncements||[])if(e.datesPublished!==false||!e.sourceUrl)throw Error('Unreviewed future WSL date');
 return doc;
}
function apply(prior,document){
 const doc=validate(document),old=new Map((prior.events||[]).map(e=>[e.id,e])),sources={...prior.sources};
 const events=doc.events.map((e,index)=>{
  const sourceId=`wsl-calendar-${doc.year}-${e.id}`;sources[sourceId]={name:'World Surf League official Championship Tour calendar',url:e.sourceUrl,type:'official',checkedAt:doc.checkedAt};
  const id=`event:wsl:${doc.year}:${e.slug}`,known=old.get(id);
  if(known&&(known.date!==e.date||known.endDate!==e.endDate))throw Error('WSL date correction requires identity review: '+id);
  const fresh={id,sportKey:'wsl',codeId:'competition:wsl-championship-tour',competitionId:'competition:wsl-championship-tour',season:String(doc.year),name:`${e.name} — Men`,tournamentName:e.name,weekendId:`wsl:${doc.year}:${e.slug}`,roundNumber:index+1,roundLabel:`Event ${index+1}`,round:'all',stage:'event window',sessionType:'event-window',gender:'mens',date:e.date,endDate:e.endDate,time:null,dateOnly:true,timeTbc:true,timePrecision:'date-only',status:e.status,participantIds:[],participantsConfirmed:false,resultCoverage:'calendar-only',expected:8,liveWindow:2,
   venue:e.venue,venueOfficialName:e.venue,venueVerified:true,venueCity:e.city,venueCountryCode:e.countryCode,venueSourceUrl:e.sourceUrl,venueCaption:`${doc.year} • Break shape unverified`,courseGeometryVerified:false,
   sourceId,sourceUrl:e.sourceUrl,sourceCheckedAt:doc.checkedAt,calendarProvenance:{sourceUrl:doc.sourceUrl,checkedAt:doc.checkedAt},scheduleNote:'Published event window; daily running times and event-specific entries are unconfirmed.',hook:`Men’s Championship Tour at ${e.venue}.`,context:'Official published event window. Daily running times, entries and break geometry remain unverified.',...(e.status==='completed'?{result:{status:'pending',sourceId,checkedAt:doc.checkedAt}}:{}),
   ...(e.slug==='margaret-river'?{legacyCardId:LEGACY_ID,cardKind:'event',gender:'mixed'}:{})};
  return known?{...known,...Object.fromEntries(['venue','venueOfficialName','venueVerified','venueCity','venueCountryCode','venueSourceUrl','venueCaption','courseGeometryVerified','calendarProvenance','weekendId','tournamentName'].map(k=>[k,fresh[k]]))}:fresh;
 });
 const ids=new Set(events.map(e=>e.id));
 return {...prior,schemaVersion:'wsl-calendar.v1',sources,participants:prior.participants||[],events:[...(prior.events||[]).filter(e=>!ids.has(e.id)),...events],futureAnnouncements:doc.futureAnnouncements||[],coverage:{status:'partial',publishedEventWindows:12,year:2026,checkedAt:doc.checkedAt,note:'All published 2026 windows; eleven men’s windows and the retained mixed Margaret River record. Results, entries, daily clocks and break geometry remain partial. Raglan 2027 is announced without dates; no future windows are fabricated.'}};
}
function refresh({root=ROOT,document}={}){
 const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{sources:{},events:[],participants:[]};
 const doc=document||JSON.parse(fs.readFileSync(path.join(root,'feeds/provider-exports/wsl/calendar-2026.v1.json'))),next=apply(prior,doc);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return next.coverage;
}
if(require.main===module){try{console.log(JSON.stringify(refresh()));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={validate,apply,refresh,LEGACY_ID};
