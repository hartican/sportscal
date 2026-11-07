'use strict';
const LIVE_MS=15*60*1000;
function phaseFor(event,now=new Date()){
  const status=String(event.status || event.scheduleStatus || '').toLowerCase();
  if(['cancelled','canceled','abandoned','postponed'].includes(status))return null;
  if(event.sourceAttribution?.provider==='OpenLigaDB' && (status==='suspended'||require('../config/feed-controls').timingState(event,now)?.key==='awaiting-update'))return null;
  if(['completed','finished','final'].includes(status))return 'impact';
  if(['live','inprogress','in_progress','in-progress','ongoing','stumps','rain-delay','break','interrupted'].includes(status))return require('../config/epic-classics').confirmedOngoing(event,now)?'pulse':null;
  const start=Date.parse(event.startTimeUtc || '');
  if(!Number.isFinite(start))return 'heat';
  if(+now<start)return 'heat';
  return null; // A scheduled clock alone proves neither play nor completion.
}
function latestVotes(rows,{phase,now=new Date(),excludeUser=null,cutoff=null,liveWindowMs=LIVE_MS}={}){
  const latest=new Map();
  for(const row of rows || []){
    const user=row.user_id || row.userId, time=Date.parse(row.updated_at || row.updatedAt || row.submitted_at || row.created_at || '');
    if(!user||user===excludeUser||row.demo||row.modelled||row.phase!==phase||!Number.isInteger(Number(row.rating))||row.rating<1||row.rating>5||!Number.isFinite(time)||time>+now||(cutoff&&time>+cutoff))continue;
    if(phase==='pulse' && liveWindowMs!==null && +now-time>=liveWindowMs)continue;
    if(!latest.has(user)||time>latest.get(user).time)latest.set(user,{...row,time,userId:user,rating:Number(row.rating)});
  }
  return [...latest.values()];
}
function summary(rows,options){
  const votes=latestVotes(rows,{liveWindowMs:options.phase==='pulse'?LIVE_MS:null,...options}),count=votes.length,policy=require('../config/epic-classics'),raw=policy.average(votes);
  return {phase:options.phase,count,average:raw===null?null:Math.round(raw*10)/10,rawAverage:raw,label:raw===null?null:policy.phaseCopy(options.phase).labels[Math.round(raw)-1],ranked:count>=1,source:'real-users',weighting:'curators-8x',excludesViewer:false,calculatedAt:new Date(options.now || Date.now()).toISOString()};
}
function compare(a,b){
  const bucket=x=>x.crowd.ranked?0:x.crowd.count?1:2;
  return bucket(a)-bucket(b)||(b.crowd.rawAverage || 0)-(a.crowd.rawAverage || 0)||b.crowd.count-a.crowd.count||Date.parse(a.startTimeUtc || 0)-Date.parse(b.startTimeUtc || 0)||a.id.localeCompare(b.id);
}
function foresight({prediction,ratings=[],userId=null}){
 const matched=ratings.some(v=>!v.modelled&&!v.demo&&(v.userId||v.user_id)!==userId&&['pulse','impact'].includes(v.phase)&&Number(v.rating)===Number(prediction));
 return {accurate:matched,total:matched?20:1,bonus:matched?19:0};
}
module.exports={LIVE_MS,phaseFor,latestVotes,summary,compare,foresight};
