#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/grand-tours-calendar.v1.json';
const competitions={tdf:'tour-de-france',giro:'giro-ditalia',vuelta:'vuelta-a-espana'};
const official=e=>e.key==='giro'?'https://www.giroditalia.it/':e.key==='vuelta'?'https://www.lavuelta.es/':'https://www.letour.fr/';
function validate(doc){
 if(doc.schemaVersion!=='grand-tours-reviewed-calendar.v1'||!Number.isFinite(Date.parse(doc.checkedAt))||doc.editions?.length!==6)throw Error('Incomplete Grand Tour review');
 const seen=new Set();
 for(const e of doc.editions){
  const id=e.key+e.year;if(seen.has(id)||!competitions[e.key]||![2026,2027].includes(e.year)||!e.sourceUrl?.startsWith(official(e))&&!e.sourceUrl?.startsWith('https://www.uci.org/'))throw Error('Unreviewed Grand Tour edition');seen.add(id);
  if(e.completeStageCalendar&&(e.year!==2026||e.stages.length!==21))throw Error('Incomplete published stage calendar');
  if(!e.completeStageCalendar&&(e.year!==2027||e.stages.length!==(e.key==='tdf'?3:0)))throw Error('Unpublished future stages');
  const dates=new Set();
  e.stages.forEach((s,i)=>{if(s.number!==i+1||!/^20\d{2}-\d{2}-\d{2}$/.test(s.date)||s.date.slice(0,4)!==String(e.year)||dates.has(s.date)||i&&s.date<=e.stages[i-1].date||!s.start||!s.finish||!Number.isFinite(s.distanceKm)||s.distanceKm<=0||! /^[A-Z]{2}$/.test(s.startCountryCode)||! /^[A-Z]{2}$/.test(s.finishCountryCode)||!s.sourceUrl.startsWith(official(e)))throw Error('Invalid stage or ordering');dates.add(s.date);});
  for(const r of e.restDays||[])if(dates.has(r.date)||!r.date?.startsWith(e.year+'-'))throw Error('Rest day is not a sporting stage');
 }
 return doc;
}
function apply(prior,document){
 const doc=validate(document),sources={...prior.sources},old=new Map((prior.events||[]).map(e=>[e.id,e])),events=[];
 for(const edition of doc.editions)for(const stage of edition.stages){
  const id=`event:${edition.key}:${edition.year}:stage-${stage.number}`,known=old.get(id),sourceId=`calendar-${edition.key}-${edition.year}-${stage.number}`;
  if(known&&known.date!==stage.date)throw Error('Stage date correction requires identity review: '+id);
  sources[sourceId]={name:edition.key==='giro'?'Giro d’Italia organiser':'ASO official stage calendar',url:stage.sourceUrl,type:'official',checkedAt:doc.checkedAt};
  const base={id,sportKey:edition.key,competitionId:'competition:'+competitions[edition.key],codeId:'competition:'+competitions[edition.key],sportDomainId:'sport:cycling',season:String(edition.year),gender:'mens',name:`${edition.name} — Stage ${stage.number}: ${stage.start} → ${stage.finish}`,tournamentName:edition.name,weekendId:`${edition.key}:${edition.year}`,editionEndDate:edition.endDate||edition.stages.at(-1).date,roundNumber:stage.number,roundLabel:`Stage ${stage.number}`,round:'all',stage:stage.type,sessionType:'stage',date:stage.date,time:null,dateOnly:true,timeTbc:true,timePrecision:'date-only',status:edition.year===2026?'completed':'upcoming',participantsConfirmed:false,participantIds:[],resultCoverage:'calendar-only',expected:8,liveWindow:4,
   venue:`${stage.start} → ${stage.finish}`,venueOfficialName:`${stage.start} → ${stage.finish}`,venueVerified:true,venueCountryCode:stage.startCountryCode,finishCountryCode:stage.finishCountryCode,venueSourceUrl:stage.sourceUrl,venueCaption:`${edition.year} • ${stage.distanceKm} km • ${stage.courseGeometryVerified?'Verified organiser route':'Stage route unverified'}`,courseGeometryVerified:stage.courseGeometryVerified===true,courseArtworkId:stage.courseArtworkId,courseGeometrySourceUrl:stage.courseGeometrySourceUrl,grandTourCalendar:true,calendarProvenance:{sourceUrl:edition.sourceUrl,checkedAt:doc.checkedAt},sourceId,sourceUrl:stage.sourceUrl,sourceCheckedAt:doc.checkedAt,scheduleNote:'Published stage date; start time and edition-specific entries are unconfirmed.',hook:`${stage.start} to ${stage.finish}, ${stage.distanceKm} km.`,context:'Official published stage. Detailed route geometry, entries, results and Australian viewing remain partial.',...(edition.key==='tdf'&&edition.year===2026?{legacyCardId:`evt_${45+stage.number}`}:{})};
  if(edition.year===2026)base.result={status:'pending',sourceId,checkedAt:doc.checkedAt};
  events.push(known?{...known,...Object.fromEntries(['venue','venueOfficialName','venueVerified','venueCountryCode','finishCountryCode','venueSourceUrl','venueCaption','calendarProvenance','weekendId','tournamentName','editionEndDate','grandTourCalendar','courseArtworkId','courseGeometryVerified','courseGeometrySourceUrl'].map(k=>[k,base[k]]))}:base);
 }
 return {...prior,schemaVersion:'grand-tours-calendar.v1',participants:prior.participants||[],sources,events,editions:doc.editions,coverage:{status:'partial',currentSeasonStages:63,publishedFutureStages:3,checkedAt:doc.checkedAt,note:'All published 2026 stage calendars and three announced 2027 Tour stages. Giro/Vuelta 2027 edition dates only; unpublished stages, rest days and routes are not inferred. Results, entries and detailed course geometry remain partial.'}};
}
function refresh({root=ROOT,document}={}){const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{events:[],sources:{}};const next=apply(prior,document||JSON.parse(fs.readFileSync(path.join(root,'feeds/provider-exports/cycling/grand-tours-calendar.v1.json'))));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return next.coverage;}
if(require.main===module)try{console.log(JSON.stringify(refresh()));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={validate,apply,refresh,competitions};
