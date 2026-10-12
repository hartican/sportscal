'use strict';
// Labels describe retained sporting observations, never calendar advancement.
function tennis(parent,fixtures){
 const groups=new Map();
 for(const f of fixtures){
  if(!['live','in-progress','in_progress','ongoing','break','suspended','interrupted'].includes(f.status)||f.sourceStale||f.stale||f.contestUnit==='tie'||f.parentTieId||['MD','WD','XD'].includes(f.eventCode)||f.matchupSides?.some(s=>s.players?.length>1)||/doubles|qualif|mixed|team/i.test([f.drawType,f.discipline,f.eventType,f.format,f.roundLabel].join(' ')))continue;
  const tour=f.tour||parent.tour,round=f.roundLabel||f.round;
  const sourceUrl=f.statusSourceUrl||f.sourceUrl,sourceCheckedAt=f.statusCheckedAt||f.sourceCheckedAt;
  if(!round||!['ATP','WTA'].includes(tour)||!/^https:\/\//.test(sourceUrl||'')||!Number.isFinite(Date.parse(sourceCheckedAt)))continue;
  const day=f.scheduleEvidence?.matchDateLocal||f.sourceLocalDate||null;
  const key=tour+'|'+(f.drawId||'singles')+'|'+(day||'unconfirmed');
  const p=groups.get(key)||{tour,drawId:f.drawId||'singles',drawType:'singles',mainDraw:true,playDate:day,roundLabels:[],sourceUrl,sourceCheckedAt};
  p.roundLabels.push(round);if(sourceCheckedAt>p.sourceCheckedAt)p.sourceCheckedAt=sourceCheckedAt;
  groups.set(key,p);
 }
 return [...groups.values()].map(p=>({...p,roundLabels:[...new Set(p.roundLabels)]}));
}
function golf(record,{sourceUrl,sourceCheckedAt,playDate=null}={}){
 if(!Number.isSafeInteger(record?.currentRound)||record.currentRound<1)return null;
 const total=record.totalRounds||record.numberOfRounds;
 return [{drawId:'stroke-play',roundNumbers:[record.currentRound],...(Number.isSafeInteger(total)?{totalRounds:total}:{}),roundLabels:['Round '+record.currentRound],playDate,sourceUrl,sourceCheckedAt}];
}
module.exports={tennis,golf};
