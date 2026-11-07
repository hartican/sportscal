(function(root,factory){const api=factory();root.NOTHINGSPORTS_MILESTONES=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const LIMITS=Object.freeze({off:{match:0,total:0,gap:0},low:{match:1,total:3,gap:3600000},medium:{match:3,total:6,gap:1200000},high:{match:6,total:12,gap:600000}});
 const FAMILIES=['records','finishes','bowling','centuries','extraBatting'];
 function normalize(value){
  const source=value===false?{enabled:false}:value&&typeof value==='object'?value:{},sport=source.sports?.cricket||{};
  const coverage=Object.hasOwn(LIMITS,sport.coverage)?sport.coverage:'medium';
  const quiet=source.quietHours;
  let quietHours=null;
  if(quiet?.enabled===true&&/^\d{2}:\d{2}$/.test(quiet.start||'')&&/^\d{2}:\d{2}$/.test(quiet.end||'')&&quiet.start!==quiet.end){
   const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
   try{new Intl.DateTimeFormat('en',{timeZone:quiet.timezone});if(minutes(quiet.start)<1440&&minutes(quiet.end)<1440&&Number(quiet.start.slice(3))<60&&Number(quiet.end.slice(3))<60)quietHours={enabled:true,start:quiet.start,end:quiet.end,timezone:quiet.timezone};}catch{}
  }
  const families=Object.fromEntries(FAMILIES.filter(key=>typeof sport.families?.[key]==='boolean').map(key=>[key,sport.families[key]]));
  return {schemaVersion:'milestone-preferences.v1',enabled:source.enabled!==false,sports:{...source.sports,cricket:{coverage,audience:sport.audience==='sport'?'sport':'feed',families}},quietHours};
 }
 function allows(settings,family){const s=settings.sports.cricket;if(!settings.enabled||s.coverage==='off')return false;if(Object.hasOwn(s.families,family))return s.families[family];return ['records','finishes'].includes(family)||s.coverage!=='low'&&['bowling','centuries'].includes(family)||s.coverage==='high'&&family==='extraBatting';}
 function quiet(settings,now=Date.now()){
  const q=settings.quietHours;if(!q)return false;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:q.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
  const minute=Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value),at=v=>Number(v.slice(0,2))*60+Number(v.slice(3)),start=at(q.start),end=at(q.end);
  return start<end?minute>=start&&minute<end:minute>=start||minute<end;
 }
 return {LIMITS,FAMILIES,normalize,allows,quiet};
});
