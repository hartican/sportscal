#!/usr/bin/env node
"use strict";

// Called by update-cards.js. One season request includes every weekend and
// timetable; there is no card-level network fetch or new results integration.
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const SCHEDULE = path.join(ROOT, 'data/canonical/fiba-women-sailgp-motogp-2026.json');
const API = year => `https://api.pulselive.motogp.com/motogp/v1/events?seasonYear=${year}`;
const SLUGS = {THA:'thailand',BRA:'brazil',USA:'united-states',SPA:'spain',FRA:'france',CAT:'catalunya',ITA:'italy',HUN:'hungary',CZE:'czechia',NED:'netherlands',GER:'germany',GBR:'great-britain',ARA:'aragon',RSM:'san-marino',AUT:'austria',JPN:'japan',INA:'indonesia',AUS:'australia',MAL:'malaysia',QAT:'qatar',POR:'portugal',VAL:'valencia',ARG:'argentina'};
const LABELS = {THA:'Thailand',BRA:'Brazil',USA:'Americas',SPA:'Spain',FRA:'France',CAT:'Catalunya',ITA:'Italy',HUN:'Hungary',CZE:'Czechia',NED:'Netherlands',GER:'Germany',GBR:'Great Britain',ARA:'Aragon',RSM:'San Marino',AUT:'Austria',JPN:'Japan',INA:'Indonesia',AUS:'Australia',MAL:'Malaysia',QAT:'Qatar',POR:'Portugal',VAL:'Valencia',ARG:'Argentina'};
const TYPES = {FP1:'practice-1',PR:'practice',FP2:'practice-2',WUP:'warmup',SPR:'sprint'};
const ARTWORK=require('../config/venue-artwork').motogp;
const LEGACY = new Set(['san-marino','austria','japan','indonesia','australia','malaysia','qatar','portugal','valencia']);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value,null,2)+'\n'); };
function local(iso){
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
function snapshot(raw,year,checkedAt){
 if(!Array.isArray(raw))throw Error(`${year}: calendar is not an array`);
 const weekends=raw.filter(e=>e.kind==='GP').map(e=>{
  const tracks=e.circuit?.tracks||[], active=tracks.filter(t=>t.is_active), mapped=active.filter(t=>t.assets?.simple?.path);
  const t=mapped.length===1?mapped[0]:active.length===1?active[0]:null;
  if(!e.id||!SLUGS[e.shortname]||!e.date_start||!e.date_end||!e.circuit?.id)throw Error(`${year}: unverified calendar/track ${e.shortname}`);
  // Inactive/ambiguous historical layouts cannot establish current geometry.
  const verified=Boolean(t);
  return {id:e.id,shortname:e.shortname,name:e.name.trim(),url:e.url,sequence:e.sequence,date_start:e.date_start,date_end:e.date_end,time_zone:e.time_zone,country:e.circuit.iso_code,
   circuit:{id:e.circuit.id,name:e.circuit.name,city:e.circuit.city,country:e.circuit.iso_code,trackId:t?.id||null,configurationVerified:verified,lengthMetres:t?Number(t.lenght):null,turns:t?Number(t.left_corners)+Number(t.right_corners):null,mapSourceUrl:t?.assets?.simple?.path||null},
   sessions:(e.broadcasts||[]).filter(s=>s.type==='SESSION'&&s.category?.acronym==='MGP').map(s=>({id:s.id,shortname:s.shortname,name:s.name,date_start:s.date_start,date_end:s.date_end,status:s.status}))};
 });
 if(weekends.length<20||new Set(weekends.map(e=>e.id)).size!==weekends.length||new Set(weekends.map(e=>e.shortname)).size!==weekends.length)throw Error(`${year}: incomplete or duplicate official calendar`);
 return {schemaVersion:'motogp-official-calendar.v1',year,sourceUrl:API(year),calendarUrl:`https://www.motogp.com/en/calendar/${year}`,checkedAt,weekends};
}
function eventsFor(document, participants, now=new Date()){
 const year=document.year,currentYear=Number(local(now.toISOString()).date.slice(0,4));
 const horizon=new Date(now);horizon.setUTCFullYear(horizon.getUTCFullYear()+1);const through=local(horizon.toISOString()).date;
 return document.weekends.filter(w=>year===currentYear||w.date_start.slice(0,10)<=through).flatMap(w=>{
  const slug=SLUGS[w.shortname], title=`MotoGP ${LABELS[w.shortname]} Grand Prix`, sourceId=`motogp-${year}-${slug}`;
  const sourceUrl=`https://www.motogp.com/en/calendar/${year}/event/${String(w.url).toLowerCase().replace(/[^a-z0-9]+/g,'-')}/${w.id}`;
  const q=w.sessions.filter(s=>/^Q[12]$/.test(s.shortname)).sort((a,b)=>Date.parse(a.date_start)-Date.parse(b.date_start));
  const races=w.sessions.filter(s=>/^RAC\d*$/.test(s.shortname)).sort((a,b)=>Date.parse(a.date_start)-Date.parse(b.date_start));
  const groups=[['qualifying',q],['sprint',w.sessions.filter(s=>s.shortname==='SPR')],['race',races]];
  for(const s of w.sessions)if(TYPES[s.shortname]&&s.shortname!=='SPR')groups.push([TYPES[s.shortname],[s]]);
  return groups.map(([type,sessions])=>{
   if(sessions.length&&sessions.some(s=>!Number.isFinite(Date.parse(s.date_start))))throw Error(`${w.id}: invalid ${type} time`);
   if(type==='qualifying'&&q.length!==0&&(q.length!==2||new Set(q.map(s=>s.shortname)).size!==2))throw Error(`${w.id}: incomplete combined qualifying`);
   const first=sessions[0],last=sessions.at(-1), confirmed=Boolean(first), starts=confirmed?new Date(first.date_start).toISOString():null;
   const timing=confirmed?local(starts):{date:w.date_start.slice(0,10),time:null};
   const end=confirmed&&Date.parse(last.date_end)>Date.parse(starts)?new Date(last.date_end).toISOString():null;
   const label=type==='race'?'Grand Prix':type==='qualifying'?'Qualifying (Q1 + Q2)':type==='sprint'?'Sprint':type==='warmup'?'Warm-up':type==='practice'?'Practice':type==='practice-1'?'Free Practice 1':'Free Practice 2';
   const id=year===2026&&type==='race'&&LEGACY.has(slug)?`event:motogp:2026:${slug}`:`event:motogp:${year}:${slug}:${type}`;
   return {id,sportKey:'motogp',codeId:'competition:motogp',competitionId:'competition:motogp',season:String(year),name:type==='race'?title:`${title} · ${label}`,tournamentName:title,weekendId:`motogp:${year}:${slug}`,roundNumber:w.sequence,
    ...timing,...(!confirmed?{endDate:w.date_end.slice(0,10),scheduleNote:'Session day and start time await the official timetable.'}:{}),...(starts?{startTimeUtc:starts}:{}),...(end?{endTimeUtc:end}:{}),timeTbc:!confirmed,timePrecision:confirmed?'exact':'date-only',sessionType:type,stage:label,roundLabel:label,round:'all',expected:type==='race'?9:type==='sprint'?8:type==='qualifying'?7:3,liveWindow:1,
    status:sessions.length&&sessions.every(s=>s.status==='FINISHED')?'completed':'upcoming',sourceId,sourceUrl,sourceCheckedAt:document.checkedAt,sourceSessionIds:sessions.map(s=>s.id),
    venue:w.shortname==='FRA'?'Bugatti Circuit':w.circuit.name,venueOfficialName:w.shortname==='FRA'?'Bugatti Circuit':w.circuit.name,venueVerified:true,venueId:`venue:motogp:${w.circuit.id}`,venueCity:w.circuit.city,venueCountryCode:w.circuit.country,circuitId:w.circuit.trackId?`circuit:motogp:${w.circuit.trackId}`:null,venueSourceUrl:sourceUrl,venueConfigurationId:w.circuit.trackId,venueConfigurationVerified:w.circuit.configurationVerified,venueArtworkId:w.circuit.configurationVerified?ARTWORK[w.circuit.trackId]||null:null,venueGeometrySourceUrl:w.circuit.mapSourceUrl,circuitLengthMetres:w.circuit.lengthMetres,circuitTurns:w.circuit.turns,
    participantIds:year===2026?participants.map(p=>p.id):[],participantsConfirmed:year===2026,
    hook:`${label} at ${w.shortname==='FRA'?'the Bugatti Circuit':w.circuit.name}.`,context:confirmed?`The official MotoGP timetable confirms ${label.toLowerCase()} for the premier class at ${w.circuit.name}.`:`The published ${year} calendar confirms this Grand Prix weekend. The session day and start time await the official timetable.`};
  });
 });
}
async function refresh({fetchImpl=fetch,now=new Date(),sourceDirectory=path.join(ROOT,'feeds/provider-exports/motogp'),schedulePath=SCHEDULE}={}){
 const prior=read(schedulePath),year=Number(local(now.toISOString()).date.slice(0,4)),documents=[],failures=[];
 for(const season of [year,year+1]){
  const file=path.join(sourceDirectory,`calendar-${season}.v1.json`);
  try{const r=await fetchImpl(API(season),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const doc=snapshot(await r.json(),season,now.toISOString());if(fs.existsSync(file)){const priorDocument=read(file);const names=new Set(doc.weekends.map(w=>w.shortname));if(priorDocument.weekends.some(w=>!names.has(w.shortname)))throw Error('Calendar withdrawal requires a verified correction; retained last verified season');}write(file,doc);documents.push(doc);}
  catch(error){failures.push({season,error:error.message});if(fs.existsSync(file))documents.push(read(file));}
 }
 const participants=prior.participants.filter(p=>p.sportKey==='motogp');
 const fresh=documents.flatMap(d=>eventsFor(d,participants,now));
 const covered=new Set(documents.map(d=>String(d.year)));
 const old=new Map(prior.events.filter(e=>e.sportKey==='motogp').map(e=>[e.id,e]));
 const sources={...prior.sources};
 for(const e of fresh){sources[e.sourceId]={name:'MotoGP official calendar and premier-class timetable',url:e.sourceUrl,type:'official',checkedAt:e.sourceCheckedAt};if(old.get(e.id)?.result){e.result=old.get(e.id).result;if(old.get(e.id).resultCoverage)e.resultCoverage=old.get(e.id).resultCoverage;}else if(e.status==='completed'&&!['practice','practice-1','practice-2','warmup'].includes(e.sessionType)){e.resultCoverage='calendar-only';e.result={status:'pending',sourceId:e.sourceId,checkedAt:e.sourceCheckedAt};}}
 const next={...prior,generatedAt:now.toISOString(),sources,events:[...prior.events.filter(e=>e.sportKey!=='motogp'||!covered.has(e.season||e.date.slice(0,4))),...fresh]};
 if(fresh.length)write(schedulePath,next);
 return {events:fresh.length,failures,complete:failures.length===0};
}
if(require.main===module)refresh().then(r=>{console.log(JSON.stringify(r));if(!r.complete)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={API,snapshot,eventsFor,refresh,local};
