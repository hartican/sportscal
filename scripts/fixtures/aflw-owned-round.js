'use strict';
// Constructed round11/12 stand-ins only. No current result is observed.
const captured=require('./aflw-round9-captured-20261011.json'),scope=require('./aflw-round-recovery-scope-20261031.json');
function round(roundNumber){
 return {meta:{code:200,pagination:{page:0,numPages:1,pageSize:50,numEntries:9}},matches:scope.records.filter(row=>row.roundNumber===roundNumber).map(binding=>{
  const value=structuredClone(captured.matches[0]);
  value.id=binding.numericMatchId;value.providerId=binding.providerId;value.compSeason.currentRoundNumber=12;
  value.round.roundNumber=roundNumber;value.round.providerId=`CD_R2026264${roundNumber}`;
  for(const side of ['home','away'])Object.assign(value[side].team,{id:binding[side+'NumericId'],providerId:binding[side+'ProviderId'],name:binding[side+'Name']});
  for(const side of ['home','away'])value[side].score={goals:0,behinds:0,totalScore:0,superGoals:0};
  value.utcStartTime=binding.startTimeUtc;value.status=binding.targetedResult?'CONCLUDED':'SCHEDULED';return value;
 })};
}
module.exports={round};
