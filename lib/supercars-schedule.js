'use strict';
const calendarUrl='https://www.supercars.com/calendar?tab=UPCOMING';
const identity=require('../config/fixture-identity');
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function documents(html){
 const frames=[...String(html).matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(m=>JSON.parse(m[1])).join('');
 return frames.split('\n').flatMap(line=>{try{return [JSON.parse(line.slice(line.indexOf(':')+1))];}catch{return [];}});
}
function objects(html,test){
 const found=[];
 const walk=value=>{if(!value||typeof value!=='object')return;if(test(value))found.push(value);for(const child of Object.values(value))walk(child);};
 documents(html).forEach(walk);return found;
}
function meetings(html,now=new Date()){
 const until=new Date(now);until.setUTCMonth(until.getUTCMonth()+3);
 const records=objects(html,e=>typeof e.slug==='string'&&/^20\d{2}-[a-z0-9-]+$/.test(e.slug)&&e.title&&e.startDate&&e.endDate);
 if(!records.length)throw Error('Supercars calendar collection unavailable');
 const selected=[...new Map(records.map(e=>[e.slug,e])).values()].filter(e=>Date.parse(e.endDate)>=+now&&Date.parse(e.startDate)<+until);
 if(selected.length>12)throw Error('Supercars calendar exceeds meeting budget');
 return selected;
}
function sessions(html,meeting,{now=new Date(),sourceUrl}={}){
 const found=objects(html,e=>e.name&&e.startDate&&e.series?.name==='Repco Supercars Championship');
 const rows=[...new Map(found.map(e=>[e.name+'|'+e.startDate,e])).values()].filter(e=>/practice|qualif|shootout|race|sprint|warm.?up/i.test(e.name));
 const numbered=rows.map(e=>Number(e.name.match(/^Race (\d+)$/)?.[1])).filter(Number.isFinite);
 const held=rows.filter(e=>e.name==='Race 1'&&numbered.some(n=>n>10));
 const year=meeting.slug.slice(0,4),meetingSlug=meeting.slug.slice(5),group=`event:supercars:${year}:${meetingSlug}`;
 const facts=rows.filter(e=>!held.includes(e)).map(e=>{
  const id=group+':'+slug(e.name),exact=/T\d{2}:\d{2}.*(?:Z|[+-]\d\d:\d\d)$/.test(e.startDate)&&Number.isFinite(Date.parse(e.startDate));
  return identity.normalizeCore({id,eventId:id,canonicalEventId:id,key:'supercars',sportKey:'supercars',sportDomainId:'sport:motorsport',codeId:'sport:motorsport',competitionId:'competition:supercars',competitionName:'Repco Supercars Championship',name:meeting.title+' · '+e.name,eventGroupId:group,eventGroupTitle:meeting.title,sessionType:e.name,venue:meeting.location,venueCountryCode:'AU',startTimeUtc:exact?new Date(e.startDate).toISOString():null,date:exact?undefined:e.startDate.slice(0,10),endTimeUtc:e.endDate&&Number.isFinite(Date.parse(e.endDate))?new Date(e.endDate).toISOString():null,timePrecision:exact?'exact':'date-only',dateOnly:!exact,timeTbc:!exact,scheduleStatus:exact?'confirmed':'tbc',status:/cancel/i.test(e.status||'')?'cancelled':'scheduled',sourceUrl,sourceType:'official',sourceName:'Supercars official track schedule',sourceCheckedAt:now.toISOString(),participantIds:[],participants:[],cardKind:'fixture'});
 });
 facts.coverage={provider:'Supercars',sourceUrl,meetingId:group,publishedSessions:facts.length,held:held.map(e=>({name:e.name,reason:'Ambiguous championship race number'})),schedulePublished:facts.length>0};
 return facts;
}
async function fetchSchedule({fetchImpl=globalThis.fetch,now=new Date(),signal}={}){
 const read=async url=>{signal?.throwIfAborted();const response=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});if(!response.ok)throw Error('Supercars official schedule unavailable');return response.text();};
 const calendar=await read(calendarUrl),selected=meetings(calendar,now),fixtures=[],reports=[];
 for(const meeting of selected){
  const sourceUrl=`https://www.supercars.com/events/${meeting.slug}/schedule`,rows=sessions(await read(sourceUrl),meeting,{now,sourceUrl});fixtures.push(...rows);reports.push(rows.coverage);
  if(!rows.length){
   const group=`event:supercars:${meeting.slug.slice(0,4)}:${meeting.slug.slice(5)}`,id=group+':programme';
   fixtures.push({id,eventId:id,canonicalEventId:id,key:'supercars',sportDomainId:'sport:motorsport',competitionId:'competition:supercars',competitionName:'Repco Supercars Championship',name:meeting.title,eventGroupId:group,eventGroupTitle:meeting.title,calendarOnly:true,sessionType:'Session times TBC',date:meeting.startDate.slice(0,10),endDate:meeting.endDate.slice(0,10),timeTbc:true,dateOnly:true,timePrecision:'date-only',status:'scheduled',venue:meeting.location,sourceUrl:calendarUrl,sourceType:'official',sourceCheckedAt:now.toISOString(),participantIds:[]});
  }
 }
 fixtures.coverage={provider:'Supercars',calendarUrl,from:now.toISOString(),months:3,meetings:reports};return fixtures;
}
module.exports={calendarUrl,documents,meetings,sessions,fetchSchedule};
