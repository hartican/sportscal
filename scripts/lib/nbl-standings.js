'use strict';
// Published current positions, not a guessed points-percentage ranking formula.
function officialStandings(matches,events,{checkedAt,teamFor,sourceUrl}){
 const records=new Map();
 for(const match of matches)for(const side of [match.home,match.away]){
  const team=teamFor(side),stats=[side.position,side.wins,side.losses];
  if(!stats.every(Number.isSafeInteger)||side.position<1||side.position>10||side.wins<0||side.losses<0||side.wins+side.losses>33)throw Error('NBL standings contain invalid position or record');
  const row={participantId:team.id,displayName:team.displayName,rank:side.position,played:side.wins+side.losses,won:side.wins,lost:side.losses};
  const prior=records.get(team.id);
  if(prior&&JSON.stringify(prior)!==JSON.stringify(row))throw Error('NBL standings disagree across schedule records');
  records.set(team.id,row);
 }
 if(records.size!==10||new Set([...records.values()].map(r=>r.rank)).size!==10)throw Error('NBL standings require ten unique published ranks');
 const totals=new Map([...records.keys()].map(id=>[id,{won:0,lost:0}]));
 for(const event of events.filter(e=>e.status==='completed')){
  const scores=[event.result?.homeScore,event.result?.awayScore];
  if(!scores.every(s=>Number.isSafeInteger(s)&&s>=0)||scores[0]===scores[1])throw Error('NBL standings require decisive completed results');
  event.participantIds.forEach((id,i)=>totals.get(id)[scores[i]>scores[1-i]?'won':'lost']++);
 }
 for(const row of records.values())if(row.won!==totals.get(row.participantId).won||row.lost!==totals.get(row.participantId).lost)throw Error('NBL published standings disagree with completed regular-season results');
 return [...records.values()].sort((a,b)=>a.rank-b.rank).map(row=>({...row,competitionId:'competition:nbl',competitionName:'NBL27 regular season',season:'2026-27',asOf:checkedAt,sourceUrl,
  tableNote:'Current positions and records published by NBL; regular season only. Not the Ignite Cup table or a pre-game record.'}));
}
module.exports={officialStandings};
