(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./match-centre'):root.NOTHINGSPORTS_MATCH_CENTRE,typeof module==='object'&&module.exports?require('./follow-feed-policy'):root.NOTHINGSPORTS_FOLLOW_FEED_POLICY,typeof module==='object'&&module.exports?require('./cricket-coverage'):root.NOTHINGSPORTS_CRICKET_COVERAGE);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.NOTHINGSPORTS_ALL_SPORTS=api;
})(typeof globalThis==='object'?globalThis:this,function(match,policy,cricket){
 'use strict';
 const ZONE='Australia/Sydney',HOUR=3600000,DAY=24*HOUR;
 const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
 const dayKey=at=>{const p=Object.fromEntries(dateFormat.formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;};
 function validDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const at=Date.parse(value+'T12:00:00Z');return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===value;}
 function midnight(day){
  if(!validDay(day))return NaN;
  // Find the first instant in a Sydney date, rather than adding 24 hours
  // across a 23/25-hour daylight-saving day.
  let lo=Date.parse(day+'T00:00:00Z')-15*HOUR,hi=lo+30*HOUR;
  while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(dayKey(mid)<day)lo=mid;else hi=mid;}
  return hi;
 }
 const nextDay=day=>new Date(Date.parse(day+'T12:00:00Z')+DAY).toISOString().slice(0,10);
 function windowFor(range='today',asOf=Date.now()){
  if(!['today','24','48'].includes(range)||!Number.isSafeInteger(asOf)||Math.abs(asOf)>8640000000000000||!validDay(dayKey(asOf)))throw Error('Invalid sports range');
  return {range,asOf,end:range==='today'?midnight(nextDay(dayKey(asOf))):asOf+Number(range)*HOUR,timeZone:ZONE};
 }
 function supported(e){
  if(!e||!match.id(e)||e.published===false||e.unpublished===true||!policy.activeEligible(e))return false;
  if(cricket.isCricket(e)&&!cricket.allowed(e))return false;
  return !e.tournamentParent&&!e.isEditionOverview&&!e.majorEventMarker&&!['major_event','tournament','ticket_sale'].includes(e.kind)&&!['tennis_parent','golf_tournament','tournament_overview'].includes(e.cardType)&&e.cardKind!=='calendar-note';
 }
 const terminal=e=>match.final(e)||/^(past|cancelled|canceled|abandoned)$/.test(e.status||'');
 function start(e){
  if(e.dateOnly||e.timeTbc||e.startTimeTbc||e.timingVerified===false||['date-only','follows','estimated','unconfirmed'].includes(e.timePrecision))return NaN;
  const raw=e.startTimeUtc;return typeof raw==='string'&&validDay(raw.slice(0,10))&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(raw)?Date.parse(raw):NaN;
 }
 const underway=(e,w,now=Date.now())=>!terminal(e)&&Boolean(match.liveState(e,now))&&(!Number.isFinite(start(e))||start(e)<=w.asOf);
 function unique(events){
  const entries=[],aliases=new Map();
  for(const e of events){
   if(!supported(e))continue;
   const ids=[match.id(e),e.id,e.eventId,...(e.sourceEventIds||[]),...(e.fixtureIdAliases||[])].filter(Boolean);
   const contest=match.contest(e),keys=[...ids.map(id=>'id:'+id),...(contest?['contest:'+contest]:[])];
   const matches=[...new Set(keys.map(k=>aliases.get(k)).filter(v=>v!==undefined))];
   let index=matches.length?Math.min(...matches):entries.length;
   if(!matches.length)entries.push(e);
   else{
    const candidates=[entries[index],e,...matches.filter(i=>i!==index).map(i=>entries[i])].filter(Boolean);
    entries[index]=candidates.find(e=>e.sourceType==='official')||candidates[0];
    for(const other of matches)if(other!==index){entries[other]=null;for(const [k,v] of aliases)if(v===other)aliases.set(k,index);}
   }
   keys.forEach(k=>aliases.set(k,index));
  }
  return entries.filter(Boolean);
 }
 function entry(e,w,now=Date.now()){
  if(terminal(e))return null;
  const at=start(e),live=underway(e,w,now);
  if(live)return {event:e,day:dayKey(w.asOf),start:w.asOf,underway:true,tbc:false};
  if(Number.isFinite(at))return at>=w.asOf&&at<w.end?{event:e,day:dayKey(at),start:at,underway:false,tbc:false}:null;
  const day=validDay(e.date)?e.date:null;if(!day)return null;
  const lo=midnight(day),hi=midnight(nextDay(day));
  return lo<w.end&&hi>w.asOf?{event:e,day,start:null,underway:false,tbc:true,qualified:lo<w.asOf||hi>w.end}:null;
 }
 function select(events,w,now=Date.now()){return unique(events).map(e=>entry(e,w,now)).filter(Boolean).sort((a,b)=>a.day.localeCompare(b.day)||Number(b.underway)-Number(a.underway)||Number(a.tbc)-Number(b.tbc)||(a.start??Infinity)-(b.start??Infinity)||match.id(a.event).localeCompare(match.id(b.event)));}
 function groups(entries,w){
  const days=new Map();
  for(const item of entries){let day=days.get(item.day);if(!day){day={day:item.day,groups:[],tbc:[]};days.set(item.day,day);}if(item.tbc){day.tbc.push(item);continue;}
   const raw=item.event.actualEndTimeUtc||item.event.endTimeUtc,end=typeof raw==='string'&&validDay(raw.slice(0,10))&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(raw)?Date.parse(raw):NaN;
   const limit=Math.min(w.end,midnight(nextDay(item.day))),finish=Number.isFinite(end)&&end>item.start?Math.min(end,limit):limit;
   const prior=day.groups.at(-1);
   if(prior&&item.start<prior.end){prior.entries.push(item);prior.end=Math.max(prior.end,finish);}
   else day.groups.push({id:item.day+':'+match.id(item.event),end:finish,entries:[item]});
  }
  return [...days.values()];
 }
 return Object.freeze({ZONE,dayKey,midnight,nextDay,validDay,windowFor,supported,start,underway,unique,entry,select,groups});
});
