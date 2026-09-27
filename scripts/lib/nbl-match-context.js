'use strict';
// Earlier regular-season results, never a ladder, prediction or current cumulative record.
function nblMatchContext(events,fixture,{season,checkedAt,participants}){
 const before=Date.parse(fixture.startTimeUtc),checked=Date.parse(checkedAt);
 if(!Number.isFinite(before)||!Number.isFinite(checked))throw Error('NBL context needs valid fixture and observation times');
 const names=new Map(participants.map(p=>[p.id,p.displayName]));
 const ids=fixture.participantIds;
 if(ids?.length!==2||new Set(ids).size!==2||ids.some(id=>!names.has(id)))throw Error('NBL context needs two known teams');
 const seen=new Set();
 const prior=events.filter(past=>{
  if(past.competitionId!==fixture.competitionId||past.season!==season||past.stage!=='regular season'||past.status!=='completed')return false;
  const start=Date.parse(past.startTimeUtc);
  if(!(start<before&&start<checked))return false;
  if(seen.has(past.id))throw Error('Duplicate NBL result');seen.add(past.id);
  const scores=[past.result?.homeScore,past.result?.awayScore];
  if(past.result?.status!=='official'||!scores.every(x=>Number.isSafeInteger(x)&&x>=0)||scores[0]===scores[1]||past.participantIds?.length!==2||new Set(past.participantIds).size!==2)throw Error('NBL context needs confirmed, decisive scores');
  return true;
 });
 const teams=ids.map(participantId=>{
  const record={participantId,name:names.get(participantId),played:0,won:0,lost:0};
  for(const past of prior){const side=past.participantIds.indexOf(participantId);if(side<0)continue;
   const scores=[past.result.homeScore,past.result.awayScore];record.played++;record[scores[side]>scores[1-side]?'won':'lost']++;
  }
  return record;
 });
 return{schemaVersion:'nbl-match-context.v1',competitionId:fixture.competitionId,season,checkedAt,beforeKickoff:fixture.startTimeUtc,teams};
}
module.exports={nblMatchContext};
