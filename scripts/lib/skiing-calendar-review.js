'use strict';
const assert=require('node:assert/strict');
const reviewed=require('../../data/canonical/skiing-calendar-review.v1.json');
const scope=new Map([['evt_101',{event:62952,sector:'AL',races:[131746]}],['evt_102',{event:62952,sector:'AL',races:[131747]}],['evt_103',{event:62937,sector:'AL',races:[131690]}],['evt_104',{event:62878,sector:'FS',races:[19604,19603,19600,19599,19602,19601]}]]);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const observed=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const date=value=>typeof value==='string'&&/^2027-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function validate(doc){
 assert(doc?.schemaVersion==='skiing-calendar-review.v1'&&doc.season==='2026/27','Invalid Skiing review scope');
 assert(instant(doc.checkedAt)&&Date.parse(doc.checkedAt)<=Date.now(),'Skiing review needs a real non-future observation');
 assert(doc.events?.length===scope.size,'Skiing review must include all four retained appointments');
 const ids=new Set();
 for(const row of doc.events){
  const expected=scope.get(row.id);assert(expected&&!ids.has(row.id),'Unreviewed or duplicate Skiing identity');ids.add(row.id);
  assert(date(row.date)&&(!row.endDate||date(row.endDate)&&row.endDate>=row.date),'Invalid venue calendar date');
  if(row.hook)assert(typeof row.hook==='string'&&row.hook.trim().split(/\s+/).length<=25,'Calendar hook must fit the existing card limit');
  assert(row.name&&row.dateLabel&&row.discipline&&['men','mixed'].includes(row.gender),'Incomplete Skiing calendar identity');
  assert(['competition:fis-alpine','competition:fis-freestyle'].includes(row.competitionId),'Unreviewed Skiing competition');
  assert(JSON.stringify(row.sourceRaceIds)===JSON.stringify(expected.races),'Skiing race mapping changed without identity review');
  const url=new URL(row.sourceUrl);assert(url.protocol==='https:'&&url.hostname==='www.fis-ski.com'&&!url.username&&!url.password&&url.pathname==='/DB/general/event-details.html'&&url.searchParams.get('seasoncode')==='2027'&&url.searchParams.get('eventid')===String(expected.event)&&url.searchParams.get('sectorcode')===expected.sector,'Official FIS edition detail required');
  new Intl.DateTimeFormat('en-AU',{timeZone:row.sourceTimeZone}).format(new Date());
  assert(!row.startTimeUtc&&!row.time,'Calendar dates cannot invent a racing start');
  if(row.id==='evt_104')assert(row.programme?.length===3&&row.programme.every(p=>date(p.date)&&p.date>=row.date&&p.date<=row.endDate&&p.discipline),'Incomplete Shahdag programme');
 }
 return new Map(doc.events.map(row=>[row.id,row]));
}
const index=validate(reviewed);
function qualify(event,{review=reviewed}={}){
 const row=(review===reviewed?index:validate(review)).get(event.id);
 if(!row)return event;
 assert(['ski','skiing','snow'].includes(String(event.key||event.sportKey||event.sport||'').toLowerCase()),'Retained Skiing ID has a conflicting sport');
 assert(!event.sportDomainId||event.sportDomainId==='sport:skiing','Retained Skiing ID has a conflicting canonical domain');
 // A calendar review never undoes later sporting observations or exact starts.
 const official=event.sourceType==='official'&&event.sourceTrust==='verified';
 const exact=official&&event.scheduleStatus==='confirmed'&&event.timePrecision==='exact'&&observed(event.startTimeUtc)&&event.timeTbc!==true&&event.startTimeTbc!==true;
 if(exact||[event.status,event.scheduleStatus].some(s=>['live','ongoing','in_progress','in-progress','completed','finished','final','cancelled','canceled','postponed','abandoned','suspended'].includes(String(s||'').toLowerCase()))||official&&observed(event.sourceCheckedAt)&&Date.parse(event.sourceCheckedAt)>Date.parse(review.checkedAt))return event;
 const next={...event,name:row.name,displayTitleCompact:row.name,sportDomainId:'sport:skiing',competitionId:row.competitionId,season:review.season,discipline:row.discipline,gender:row.gender,participantDisplayMode:'field',participantsConfirmed:false,date:row.date,time:null,startTimeUtc:null,dateOnly:true,timeTbc:true,startTimeTbc:true,timePrecision:'date-only',schedulePrecision:'date-only',scheduleStatus:'provisional',displayDateLabel:row.dateLabel,resultCoverage:'calendar-only',sourceType:'official',sourceTrust:'verified',sourceName:'FIS official 2026/27 competition calendar',sourceUrl:row.sourceUrl,sourceCheckedAt:review.checkedAt,
  calendarProvenance:{sourceUrl:row.sourceUrl,checkedAt:review.checkedAt,scope:'Four retained appointments; venue-local calendar dates only',sourceRaceIds:row.sourceRaceIds},
  timingProvenance:{sourceName:'FIS competition calendar',sourceUrl:row.sourceUrl,checkedAt:review.checkedAt,precision:'venue-calendar',sourceLocalDate:row.date,sourceLocalEndDate:row.endDate||row.date,sourceTimeZone:row.sourceTimeZone},
  scheduleNote:'Published venue calendar date; race start and Sydney date/time remain unconfirmed.'};
 next.endDate=row.endDate||row.date;next.displayTime='Time TBC';
 if(next.broadcaster==='FIS broadcast')next.broadcaster='Australian viewing unconfirmed';
 if(Array.isArray(next.broadcastOptions))next.broadcastOptions=next.broadcastOptions.filter(value=>value!=='FIS broadcast');
 // Replace only the recognised unsourced seed preview, not reviewed editorial.
 if(row.preview&&/retained as a marquee winter-sport appointment/.test(event.fullSpiel||'')){
  const oldHook=event.selectedSentence,oldSynopsis=event.fullSpiel;
  next.selectedSentence=row.hook||row.preview;next.fullSpiel=row.preview;
  if(event.storyline){next.storyline={...event.storyline};for(const key of ['hookSpoilerOff','hookSpoilerOn'])if(next.storyline[key]===oldHook)next.storyline[key]=row.hook||row.preview;for(const key of ['synopsisSpoilerOff','synopsisSpoilerOn'])if(next.storyline[key]===oldSynopsis)next.storyline[key]=row.preview;}
 }
 // Shorten only this review's recognised already-published calendar hook.
 // Retain its full detail, facts and actual observation clock.
 if(row.hook&&event.sourceUrl===row.sourceUrl&&event.sourceCheckedAt===review.checkedAt&&event.fullSpiel===row.preview&&event.selectedSentence===row.preview){
  next.selectedSentence=row.hook;
  if(event.storyline){next.storyline={...next.storyline};for(const key of ['hookSpoilerOff','hookSpoilerOn'])if(next.storyline[key]===row.preview)next.storyline[key]=row.hook;}
 }
 return next;
}
function applyRetained({root=require('node:path').resolve(__dirname,'../..'),review=reviewed}={}){
 const fs=require('node:fs'),path=require('node:path'),rows=validate(review);
 const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
  const filename=path.join(root,file),bytes=fs.readFileSync(filename,'utf8'),doc=JSON.parse(bytes);
  for(const id of rows.keys())assert.equal(doc.events.filter(e=>e.id===id).length,1,`${file}: exactly one retained ${id} required`);
  const before=doc.events;doc.events=before.map(e=>qualify(e,{review}));
  return {filename,file,bytes,next:JSON.stringify(doc,null,2)+'\n',changed:doc.events.filter((e,i)=>JSON.stringify(e)!==JSON.stringify(before[i])).map(e=>e.id)};
 });
 // Complete validation and both surfaces' preflight precede any persistent write.
 for(const u of updates)if(u.bytes!==u.next)fs.writeFileSync(u.filename,u.next);
 return updates.map(({file,changed})=>({file,changed}));
}
if(require.main===module)try{console.log(JSON.stringify(applyRetained()));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={validate,qualify,applyRetained};
