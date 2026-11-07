#!/usr/bin/env node
'use strict';
// The canonical cards owner ingests reviewed organiser calendar facts. No
// unattended site scraping, result integration or independent scheduler.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),metadata=require('../config/sailgp-venues.json');
const {local}=require('./refresh-motogp-sessions');
const COLLECTIONS={2026:'6zSK9lO75W6vKlYYgmvIzD',2027:'2Zz90QAkUc0Vdhi3TR3M4Y'};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function validate(doc){
 if(doc.schemaVersion!=='sailgp-reviewed-calendar.v1'||doc.collectionId!==COLLECTIONS[doc.year]||doc.sourceUrl!==`https://sailgp.com/general/${doc.year}/calendar/`||!Number.isFinite(Date.parse(doc.checkedAt))||doc.races?.length!==13)throw Error('Incomplete or wrong-edition SailGP calendar');
 if(new Set(doc.races.map(r=>r.contentfulId)).size!==13)throw Error('Duplicate SailGP event');
 const slugs=new Set();
 for(const r of doc.races){
  if(!r.contentfulId||!r.name||!Number.isFinite(Date.parse(r.startDateTime))||!Number.isFinite(Date.parse(r.endDateTime))||r.endDateTime.slice(0,10)<r.startDateTime.slice(0,10)||!r.startDateTime.startsWith(doc.year+'-')||!r.ctaLink?.includes(`/races/${doc.year}/`))throw Error('Invalid SailGP calendar event');
  if(r.tbcDatesTextOverride)continue; // A CMS envelope never overrides a public TBC label.
  const v=metadata.venues[r.locationName];if(!v||slugs.has(v.slug))throw Error('Unreviewed or duplicate SailGP venue');slugs.add(v.slug);
  for(const d of r.raceDays||[]){if(!Number.isFinite(Date.parse(d.startDateTime))||!Number.isFinite(Date.parse(d.endDateTime))||d.startDateTime.slice(0,10)<r.startDateTime.slice(0,10)||d.startDateTime.slice(0,10)>r.endDateTime.slice(0,10)||!/^Race Day [12]$/.test(d.shortName||''))throw Error('Invalid SailGP race-day evidence');}
 }
 return doc;
}
function eventsFor(document,now=new Date()){
 const doc=validate(document),through=new Date(now);through.setUTCFullYear(through.getUTCFullYear()+1);
 const horizon=local(through.toISOString()).date,current=Number(local(now.toISOString()).date.slice(0,4));
 return doc.races.filter(r=>!r.tbcDatesTextOverride&&(doc.year===current||r.startDateTime.slice(0,10)<=horizon)).flatMap(r=>{
  const v=metadata.venues[r.locationName],venueVerified=Boolean(v.name&&v.seasons.includes(doc.year));
  const raceDays=(r.raceDays||[]).map(d=>({date:d.startDateTime.slice(0,10),day:Number(d.shortName.slice(-1)),start:d.startDateTime,end:d.endDateTime,finished:['finished','replayAvailable'].includes(d.state),sourceUrl:r.ctaLink.replace(/^http:/,'https:')}));
  const extra=metadata.extraPublishedDays[`${doc.year}:${v.slug}`];if(extra&&!raceDays.some(d=>d.date===extra.date))raceDays.push({...extra,finished:true});
  // Explicit published two-day weekends + official team format establish days,
  // not times, future participants, buoy placement or individual fleet races.
  if(!raceDays.length){const first=r.startDateTime.slice(0,10),last=r.endDateTime.slice(0,10);if(!DATE.test(first)||new Date(last+'T00:00Z')-new Date(first+'T00:00Z')!==86400000)throw Error('Unverified two-day weekend');raceDays.push({date:first,day:1},{date:last,day:2});}
  return raceDays.sort((a,b)=>a.day-b.day).map(d=>{
   const timed=Boolean(d.start),start=timed?new Date(d.start).toISOString():null,timing=timed?local(start):{date:d.date,time:'00:00'};
   const name=`${r.locationName} Sail Grand Prix`,sourceUrl=d.sourceUrl||doc.sourceUrl,sourceId=`sailgp-calendar-${doc.year}-${v.slug}-day-${d.day}`;
   return {id:`event:sailgp:${doc.year}:${v.slug}-day-${d.day}`,sportKey:'sailgp',codeId:'competition:sailgp',competitionId:'competition:sailgp',season:String(doc.year),name:`${name} — race day ${d.day}`,tournamentName:name,weekendId:`sailgp:${doc.year}:${v.slug}`,roundNumber:Number(String(r.eventLabel||'').match(/\d+/)?.[0])||doc.races.indexOf(r)+1,roundLabel:r.eventLabel||`Event ${doc.races.indexOf(r)+1}`,round:'all',stage:'fleet racing',sessionType:`race-day-${d.day}`,
    ...timing,...(start?{startTimeUtc:start,endTimeUtc:new Date(d.end).toISOString(),endTimeBasis:'official-session-window'}:{}),timeTbc:!timed,timePrecision:timed?'exact':'tbc',status:d.finished?'completed':'upcoming',resultCoverage:'calendar-only',participantIds:[],participantsConfirmed:false,expected:8,liveWindow:2,
    venue:venueVerified?v.name:r.locationName,venueOfficialName:venueVerified?v.name:null,venueVerified,venueCity:v.city,venueCountryCode:v.countryCode,venueSourceUrl:venueVerified?v.sourceUrl:r.ctaLink.replace(/^http:/,'https:'),venueCaption:`Race day ${d.day} • ${doc.year} • Course unverified`,courseGeometryVerified:false,
    sourceId,sourceUrl,sourceCheckedAt:doc.checkedAt,...(d.finished?{result:{status:'pending',sourceId,checkedAt:doc.checkedAt}}:{}),scheduleNote:d.note||(!timed?'Published race day; start time and event-specific entries are unconfirmed.':null),calendarProvenance:{sourceUrl:doc.sourceUrl,checkedAt:doc.checkedAt},hook:`Race day ${d.day} at ${r.locationName} in the ${doc.year} SailGP season.`,context:'Published SailGP race-day coverage. Course geometry and event-specific entries remain unverified.'};
  });
 });
}
function apply(prior,documents,now=new Date()){
 const currentYear=Number(local(now.toISOString()).date.slice(0,4));
 const fresh=documents.flatMap(d=>eventsFor(d,now)),old=new Map(prior.events.filter(e=>e.sportKey==='sailgp').map(e=>[e.id,e]));
 const sources={...prior.sources};
 const fields=['season','tournamentName','weekendId','roundNumber','sessionType','venueOfficialName','venueVerified','venueCity','venueCountryCode','venueSourceUrl','venueCaption','courseGeometryVerified','calendarProvenance'];
 const merged=fresh.map(e=>{
  sources[e.sourceId]={name:'SailGP official published calendar and race-day evidence',url:e.sourceUrl,type:'official',checkedAt:e.sourceCheckedAt};
  const known=old.get(e.id);if(!known)return e;
  // Reviewed dates/clocks/results/actions remain authoritative. A changed
  // retained date needs explicit review; do not quietly move user actions.
  if(known.date!==e.date)throw Error('SailGP source date correction requires identity review: '+e.id);
  return {...known,...Object.fromEntries(fields.filter(k=>e[k]!=null).map(k=>[k,e[k]])),venue:e.venue,...(!known.result&&known.resultCoverage==='calendar-only'&&known.status==='completed'&&e.result?{result:e.result}:{})};
 });
 const ids=new Set(fresh.map(e=>e.id));
 const retained=prior.events.map(e=>ids.has(e.id)?merged.find(n=>n.id===e.id):e);
 const additions=merged.filter(e=>!old.has(e.id));
 return {...prior,sources,events:[...retained,...additions],sailgpCalendarCoverage:{checkedAt:documents.map(d=>d.checkedAt).sort().at(-1),currentSeason:currentYear,publishedCurrentEvents:documents.find(d=>d.year===currentYear)?.races.length||0,futurePublishedEvents:documents.find(d=>d.year===currentYear+1)?.races.length||0,inWindowFutureEvents:new Set(fresh.filter(e=>Number(e.season)>currentYear).map(e=>e.weekendId)).size,raceDayCount:retained.filter(e=>e.sportKey==='sailgp').length+additions.length,coverageStatus:'partial',note:'Published calendars and race days; results, event-specific entries, future exact times and course geometry remain partial. Unconfirmed Grand Final and events outside twelve months are not expanded.'}};
}
function refresh({root=ROOT,now=new Date(),documents}={}){
 const file=path.join(root,'data/canonical/fiba-women-sailgp-motogp-2026.json'),prior=JSON.parse(fs.readFileSync(file));
 const docs=documents||[2026,2027].map(y=>JSON.parse(fs.readFileSync(path.join(root,`feeds/provider-exports/sailgp/calendar-${y}.v1.json`))));
 const next=apply(prior,docs,now);fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return next.sailgpCalendarCoverage;
}
if(require.main===module){try{console.log(JSON.stringify(refresh()));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={validate,eventsFor,apply,refresh};
