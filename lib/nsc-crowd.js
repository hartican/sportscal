'use strict';
const LIVE_MS=15*60*1000;
function phaseFor(event,now=new Date()){
  const status=String(event.status || event.scheduleStatus || '').toLowerCase();
  if(['cancelled','canceled','abandoned','postponed'].includes(status))return null;
  if(['completed','finished','final'].includes(status))return 'impact';
  if(['live','inprogress','in_progress','in-progress'].includes(status))return 'pulse';
  const start=Date.parse(event.startTimeUtc || '');
  if(!Number.isFinite(start))return 'heat';
  if(+now<start)return 'heat';
  const end=Date.parse(event.endTimeUtc || '') || start+Number(event.liveWindow || 3)*3600000;
  return +now<end?'pulse':'impact';
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
  const votes=latestVotes(rows,{...options,liveWindowMs:null}),count=votes.length,raw=count?votes.reduce((sum,row)=>sum+row.rating,0)/count:null;
  return {phase:options.phase,count,average:raw===null?null:Math.round(raw*10)/10,rawAverage:raw,label:raw===null?null:['Boring','Mid','Interesting','Cooking','Epic'][Math.round(raw)-1],ranked:count>=1,source:'real-users',excludesViewer:false,calculatedAt:new Date(options.now || Date.now()).toISOString()};
}
function compare(a,b){
  const bucket=x=>x.crowd.ranked?0:x.crowd.count?1:2;
  return bucket(a)-bucket(b)||(b.crowd.rawAverage || 0)-(a.crowd.rawAverage || 0)||b.crowd.count-a.crowd.count||Date.parse(a.startTimeUtc || 0)-Date.parse(b.startTimeUtc || 0)||a.id.localeCompare(b.id);
}
function foresight({prediction,outcome,benchmark=null,crowdCount=0,forecast=null}){
  const error=Math.abs(prediction-outcome),accurate=error<=.5;
  const validBenchmark=Number.isFinite(benchmark)&&Number.isFinite(forecast)&&crowdCount>=5;
  const improvement=validBenchmark?Math.abs(benchmark-outcome)-error:null;
  const contrarian=accurate&&validBenchmark&&Math.abs(prediction-benchmark)>=1&&improvement>=.5;
  return {accurate,contrarian,error,improvement,total:contrarian?8:accurate?4:2,bonus:contrarian?6:accurate?2:0};
}
module.exports={LIVE_MS,phaseFor,latestVotes,summary,compare,foresight};
