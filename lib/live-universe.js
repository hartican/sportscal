'use strict';
// Public membership shares the protected live writer and existing free parsers.
// Neither this reader nor Match Centre schedules a separate refresh job.
const nfl=require('../scripts/lib/nfl-results');
const mlb=require('./mlb-postseason');
function sources({fetchImpl,published=[]}={}){
 const read=async(url,signal)=>{const r=await fetchImpl(url,{signal});if(!r.ok)throw Error('Public fixture source unavailable: '+r.status);return r.json();};
 return [
  {id:'live-nfl-current',allowEmpty:true,seed:published.filter(e=>e.key==='nfl'),fetch:async({now,signal})=>{
   const route=nfl.recentResource(now),payload=await read(route.url,signal),teams=require('../data/canonical/american-football-directory.v1.json').teams;
   if(!Array.isArray(payload.events)||payload.events.length>16||payload.leagues?.[0]?.id!=='28')throw Error('Invalid current NFL scoreboard');
   return payload.events.map(e=>({...nfl.fixture(e,{teamIds:new Set(teams.map(t=>t.id)),checkedAt:now.toISOString(),now,roundLabel:'Week '+e.week?.number}),key:'nfl',sport:'American Football',participantsConfirmed:true}));
  }},
  {id:'live-mlb-current',allowEmpty:true,seed:published.filter(e=>e.key==='mlb'),fetch:async({now,signal})=>{
   const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(value),start=day(new Date(+now-8*3600000)),end=day(now),url=`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=team`;
   return mlb.parse(await read(url,signal),{checkedAt:now.toISOString(),now,universe:true}).fixtures;
  }},
  {id:'live-supercars-bathurst',allowEmpty:true,seed:[],minimumIntervalMs:300000,fetch:async({now,signal})=>{
   const edition=published.find(e=>e.key==='supercars'&&/bathurst.*1000/i.test(e.name||'')&&e.date?.startsWith(String(now.getUTCFullYear())));
   if(!edition||Math.abs(Date.parse(edition.date)-now)>7*86400000)return [];
   const url=edition.sourceUrl.replace(/\/$/,'')+'/schedule',r=await fetchImpl(url,{signal});if(!r.ok)throw Error('Official Bathurst timetable unavailable');
   return bathurstSessions(await r.text(),{edition,now,url});
  }},
  {id:'live-motogp-current',allowEmpty:true,seed:published.filter(e=>e.key==='motogp'),fetch:async({now,signal})=>{
   const parser=require('../scripts/refresh-motogp-sessions'),year=now.getUTCFullYear(),url=parser.API(year),raw=await read(url,signal),events=[];
   if(!Array.isArray(raw)||raw.length<20)throw Error('Incomplete MotoGP calendar');
   for(const weekend of raw.filter(w=>w.kind==='GP'&&Date.parse(w.date_end)>=+now-86400000&&Date.parse(w.date_start)<=+now+86400000)){
    for(const session of weekend.broadcasts||[]){
     if(session.type!=='SESSION'||!['MGP','MT2','MT3'].includes(session.category?.acronym)||!session.id)continue;
     const start=Date.parse(session.date_start),end=Date.parse(session.date_end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error('Invalid official session');
     const status=({LIVE:'live',ONGOING:'live',IN_PROGRESS:'live',FINISHED:'completed',SCHEDULED:'upcoming',NOT_STARTED:'upcoming','NOT-STARTED':'upcoming',CURRENT:'live'})[session.status];
     if(!status)continue; // An unknown provider state never establishes play.
     const local=parser.local(session.date_start),known=published.find(e=>e.sourceSessionIds?.includes(session.id)),id=known?.id||'fixture:motogp:session:'+session.id;
     events.push({id,eventId:id,canonicalEventId:id,key:'motogp',sport:'Motorcycle Racing',competitionId:'competition:motogp',weekendId:weekend.id,sessionType:session.shortname,name:(session.category.acronym==='MT3'?'Moto3':session.category.acronym==='MT2'?'Moto2':'MotoGP')+' '+weekend.name+' '+session.name,date:local.date,time:local.time,startTimeUtc:new Date(start).toISOString(),endTimeUtc:new Date(end).toISOString(),timePrecision:'exact',scheduleStatus:'confirmed',status,statusCheckedAt:now.toISOString(),sourceCheckedAt:now.toISOString(),sourceName:'MotoGP',sourceType:'official',sourceUrl:url,venue:weekend.circuit?.name,kind:'fixture',participantsConfirmed:false,universeOnly:session.category.acronym!=='MGP'});
    }
   }
   const groups=new Map();for(const e of events){const g=groups.get(e.id)||[];g.push(e);groups.set(e.id,g);}
   return [...groups.values()].map(g=>{const live=g.find(e=>e.status==='live'),chosen=live||g.find(e=>e.status==='upcoming')||g[0],known=published.find(e=>e.id===chosen.id);return {...chosen,...(known?{startTimeUtc:known.startTimeUtc,endTimeUtc:known.endTimeUtc,date:known.date,time:known.time}:{}),status:live?'live':g.every(e=>e.status==='completed')?'completed':'upcoming'};});
  }},
 ];
}
function bathurstSessions(html,{edition,now,url}){
 const objects=require('./golf-participation').rscObjects(html),rows=objects.filter(o=>o.natsoftEventCode&&o.series?.natsoftSeriesId==='SG3'&&o.startDate&&o.endDate);
 if(!rows.length)throw Error('Official Bathurst sessions unavailable');
 return [...new Map(rows.map(o=>[o.natsoftEventCode,o])).values()].map(o=>{
  const start=Date.parse(o.startDate),end=Date.parse(o.endDate);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||Math.abs(start-Date.parse(edition.date))>7*86400000)throw Error('Invalid Bathurst session edition');
  const status=({LIVE:'live',IN_PROGRESS:'live',COMPLETED:'completed',FINISHED:'completed',CANCELLED:'cancelled'})[String(o.status||o.sessionStatus||'').toUpperCase()]||'upcoming';
  const local=require('../scripts/refresh-motogp-sessions').local(o.startDate),id='fixture:supercars:bathurst:'+edition.date.slice(0,4)+':'+o.natsoftEventCode;
  return {id,eventId:id,canonicalEventId:id,key:'supercars',sport:'Motorsport',competitionId:'competition:supercars',weekendId:edition.id,name:'Bathurst 1000 · '+o.name,date:local.date,time:local.time,startTimeUtc:new Date(start).toISOString(),endTimeUtc:new Date(end).toISOString(),timePrecision:'exact',sessionType:String(o.type).toLowerCase(),status,statusCheckedAt:now.toISOString(),sourceCheckedAt:now.toISOString(),sourceName:'Supercars official timetable',sourceType:'official',sourceUrl:url,kind:'fixture',universeOnly:true,participantsConfirmed:false};
 });
}
module.exports={sources,bathurstSessions};
