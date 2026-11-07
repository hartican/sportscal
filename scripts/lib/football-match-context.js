'use strict';
// Facts, not a prediction: only this competition's completed earlier fixtures.
function matchContext(league,fixture){
 const before=Date.parse(fixture.startTimeUtc),checked=Date.parse(league.checkedAt);
 if(!Number.isFinite(before)||!Number.isFinite(checked))return null;
 const teams=fixture.participants.map(team=>{
  const record={participantId:team.participantId,name:team.name,played:0,won:0,drawn:0,lost:0};
  for(const past of league.fixtures){
   if(past.status!=='completed'||!(Date.parse(past.startTimeUtc)<before))continue;
   const side=past.participants.findIndex(p=>p.participantId===team.participantId);if(side<0)continue;
   const scores=[past.result?.homeScore,past.result?.awayScore];
   if(!scores.every(x=>Number.isSafeInteger(x)&&x>=0))throw Error('Context requires confirmed full-time scores');
   record.played++;const difference=scores[side]-scores[1-side];
   record[difference>0?'won':difference<0?'lost':'drawn']++;
  }
  return record;
 });
 return {schemaVersion:'football-match-context.v1',competitionId:league.competitionId,season:league.season,checkedAt:league.checkedAt,beforeKickoff:fixture.startTimeUtc,teams};
}
module.exports={matchContext};
