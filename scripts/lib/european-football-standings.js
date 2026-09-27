'use strict';
// Derived exclusively from reviewed OpenLigaDB results; not an official table.
// Interim rules: UEFA 2026/27 Article 18, explanations dated 11/18 September.
const interim=['ladderPoints','pointsDifference','pointsFor','awayGoals','won','awayWins'];
function deriveStandings(league){
 const teams=new Map(league.teams.map(t=>[t.participantId,{participantId:t.participantId,displayName:t.name,played:0,won:0,drawn:0,lost:0,pointsFor:0,pointsAgainst:0,pointsDifference:0,ladderPoints:0,awayGoals:0,awayWins:0,opponents:[]} ]));
 const complete=league.fixtures.filter(f=>f.status==='completed');
 for(const f of league.fixtures){
  const [home,away]=f.participants.map(p=>teams.get(p.participantId));
  if(!home||!away||home===away)throw Error('Unresolved standings participant');
  home.opponents.push(away.participantId);away.opponents.push(home.participantId);
  if(f.status!=='completed')continue;
  const h=f.result?.homeScore,a=f.result?.awayScore;
  if(!Number.isSafeInteger(h)||h<0||!Number.isSafeInteger(a)||a<0)throw Error('Completed fixture requires validated scores');
  for(const [team,scored,conceded,isAway] of [[home,h,a,false],[away,a,h,true]]){
   team.played++;team.pointsFor+=scored;team.pointsAgainst+=conceded;team.pointsDifference+=scored-conceded;
   if(scored>conceded){team.won++;team.ladderPoints+=3;if(isAway)team.awayWins++;}
   else if(scored===conceded){team.drawn++;team.ladderPoints++;}else team.lost++;
   if(isAway)team.awayGoals+=scored;
  }
 }
 const final=league.fixtures.length===144&&complete.length===144;
 const keys=final?[...interim,'opponentPoints','opponentGoalDifference','opponentGoals']:interim;
 const rows=[...teams.values()];
 for(const team of rows){for(const [field,target] of [['opponentPoints','ladderPoints'],['opponentGoalDifference','pointsDifference'],['opponentGoals','pointsFor']])team[field]=team.opponents.reduce((n,id)=>n+teams.get(id)[target],0);}
 const compare=(a,b)=>{for(const key of keys){if(a[key]!==b[key])return b[key]-a[key];}return 0;};
 rows.sort((a,b)=>compare(a,b)||a.displayName.localeCompare(b.displayName,'en')||a.participantId.localeCompare(b.participantId));
 let rank=1;
 return rows.map((row,index)=>{
  if(!index||compare(row,rows[index-1]))rank=index+1;
  const tied=(index>0&&!compare(row,rows[index-1]))||(index<rows.length-1&&!compare(row,rows[index+1]));
  const {opponents,...stats}=row;
  return {...stats,rank:final&&tied?null:rank,sharedRank:!final&&tied,sortOrder:index+1,rankPending:final&&tied,
   competitionId:league.competitionId,competitionName:league.competitionName,season:league.season,asOf:league.checkedAt,sourceUrl:league.source.url,
   derived:true,provisional:true,sourceAttribution:{provider:'OpenLigaDB',licence:'ODbL',datasetUrl:'/data/providers/openligadb/football-2026-27.json'},
   tableNote:final?'Derived from community results. Final tied positions require disciplinary and coefficient verification; no qualification is confirmed.':'Provisional table derived from community results. Equal ranks remain tied; alphabetical display uses NS club names. No qualification is confirmed.'};
 });
}
module.exports={deriveStandings};
