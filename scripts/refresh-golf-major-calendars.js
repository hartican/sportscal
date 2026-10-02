#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/golf-major-rounds.v1.json';
const names={masters:'Masters Tournament','pga-championship':'PGA Championship','us-open':'U.S. Open','the-open':'The Open Championship'};
function validate(doc){
 if(doc.schemaVersion!=='golf-majors-reviewed-calendar.v1'||!Number.isFinite(Date.parse(doc.checkedAt))||doc.editions?.length!==8)throw Error('Incomplete major calendar review');
 const seen=new Set();
 for(const e of doc.editions){
  const id=e.slug+e.year;if(seen.has(id)||!names[e.slug]||![2026,2027].includes(e.year))throw Error('Unreviewed major edition');seen.add(id);
  if(!/^https:\/\/(?:www\.)?(?:pgatour\.com|pgachampionship\.com|usopen\.com|mediacenter\.usga\.org|theopen\.com|pebblebeach\.com)\//.test(e.sourceUrl)||!e.venue||!e.venueConfigurationId||!['US','GB'].includes(e.countryCode)||e.roundDates?.length!==4)throw Error('Unverified major venue or calendar');
  e.roundDates.forEach((date,i)=>{if(!/^20\d\d-\d\d-\d\d$/.test(date)||!date.startsWith(e.year+'-')||i&&Date.parse(date)-Date.parse(e.roundDates[i-1])!==86400000)throw Error('Invalid published round order');});
  if(e.roundDates[0]!==e.date||e.roundDates[3]!==e.endDate||e.year===2026&&e.status!=='completed'||e.year===2027&&e.status!=='upcoming')throw Error('Incorrect edition window or status');
  if(e.courseGeometryVerified&&!(e.slug==='pga-championship'&&e.year===2026&&e.courseArtworkId==='aronimink-2026'&&e.venueConfigurationId==='golf:aronimink:2026'))throw Error('Unreviewed course configuration');
 }
 return doc;
}
function presentation(e,checkedAt){return {golfMajorCalendar:true,majorSlug:e.slug,eventFamilyId:({masters:'masters-tournament','pga-championship':'pga-championship','us-open':'us-open-golf','the-open':'the-open'})[e.slug],isMajor:true,tournamentId:e.providerTournamentId,tournamentName:names[e.slug],season:String(e.year),venue:e.venue,venueOfficialName:e.venue,venueCity:e.city,venueVerified:true,venueCountryCode:e.countryCode,venueConfigurationId:e.venueConfigurationId,venueSourceUrl:e.venueSourceUrl||e.sourceUrl,venueCaption:`${e.year} • ${e.courseGeometryVerified?'Verified fairway layout':'Course layout unverified'}`,courseGeometryVerified:e.courseGeometryVerified===true,courseArtworkId:e.courseArtworkId||null,courseGeometrySourceUrl:e.courseGeometrySourceUrl||null,calendarProvenance:{sourceUrl:e.sourceUrl,checkedAt}};}
function apply(prior,document){
 const doc=validate(document),old=new Map((prior.events||[]).map(e=>[e.id,e])),sources={...(prior.sources||{})},events=[];
 for(const e of doc.editions){
  const sourceId=`major-${e.slug}-${e.year}`;sources[sourceId]={name:'Official major championship calendar',url:e.sourceUrl,type:'official',checkedAt:doc.checkedAt};
  for(let i=0;i<4;i++){
   const id=`event:golf:${e.slug}-${e.year}:round-${i+1}`,known=old.get(id);
   if(known&&known.date!==e.roundDates[i])throw Error('Round date correction requires identity review: '+id);
   const record={id,sportKey:'golf',codeId:'sport:golf',competitionId:`competition:golf:${e.slug}-${e.year}`,taxonomyNodeId:'sport:golf',name:`${e.year} ${names[e.slug]} — Round ${i+1}`,date:e.roundDates[i],time:null,dateOnly:true,timeTbc:true,timePrecision:'date-only',gender:'mens',status:e.status,round:'all',roundNumber:i+1,roundLabel:`Round ${i+1}`,stage:'Major',cardType:'golf_session',sessionType:'round',participantsConfirmed:false,participantIds:[],expected:10,liveWindow:12,resultCoverage:'calendar-only',sourceId,sourceUrl:e.sourceUrl,sourceCheckedAt:doc.checkedAt,...presentation(e,doc.checkedAt),scheduleNote:'Published championship round date; tee times and playing partners remain unconfirmed.',hook:`Round ${i+1} at ${e.venue}.`,context:'Official championship round. Entry lists, tee times, results and Australian viewing remain partial.',...(e.slug==='masters'&&e.year===2026?{legacyCardId:'evt_'+(67+i)}:{})};
   if(e.status==='completed')record.result={status:'pending',sourceId,checkedAt:doc.checkedAt};
   events.push(known?{...known,...presentation(e,doc.checkedAt)}:record);
  }
 }
 return {schemaVersion:'golf-major-rounds.v1',sources,participants:[],events,editions:doc.editions,coverage:{status:'partial',publishedRoundCount:32,completeRoundCalendars:true,checkedAt:doc.checkedAt,note:'Four published championship rounds for each authorised major in 2026 and 2027. No inferred tee times, entries, round results or unverified course layouts.'}};
}
function refresh({root=ROOT,document}={}){const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{events:[],sources:{}};const next=apply(prior,document||JSON.parse(fs.readFileSync(path.join(root,'feeds/provider-exports/golf/majors-calendar.v1.json'))));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');const windowsFile=path.join(root,'data/canonical/golf-majors-2027.json');if(fs.existsSync(windowsFile)){const windows=JSON.parse(fs.readFileSync(windowsFile));windows.events=windows.events.map(event=>{const edition=next.editions.find(e=>event.id===`event:golf:${e.slug}-${e.year}`);return edition?{...event,...presentation(edition,next.coverage.checkedAt),golfMajorOverview:true,tournamentParent:true}:event;});fs.writeFileSync(windowsFile,JSON.stringify(windows,null,2)+'\n');}return next.coverage;}
if(require.main===module)try{console.log(JSON.stringify(refresh()));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={validate,apply,refresh,presentation,names};
