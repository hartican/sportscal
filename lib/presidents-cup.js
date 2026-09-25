'use strict';
const URL='https://www.presidentscup.com/scoring';
const FAMILY='presidents-cup';
function localParts(value){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function parse(html,{previous=[],checkedAt=new Date().toISOString()}={}){
 const encoded=String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 if(!encoded)throw Error('Presidents Cup structured scoring unavailable');
 const queries=JSON.parse(encoded).props?.pageProps?.dehydratedState?.queries||[];
 const data=name=>queries.find(q=>q.queryKey?.[0]===name)?.state?.data;
 const t=data('tournament'),overview=data('cupPlayOverviewLeaderboard');
 if(t?.formatType!=='TEAM_CUP'||!/^R\d{4}500$/.test(t.id)||overview?.tournamentId!==t.id)throw Error('Presidents Cup tournament mismatch');
 const id=`fixture:golf:pga:${t.id}`,prior=previous.find(e=>e.id===id)||{};
 const status=({IN_PROGRESS:'live',COMPLETED:'completed',CANCELED:'cancelled',CANCELLED:'cancelled',UPCOMING:'upcoming',SCHEDULED:'upcoming'})[t.tournamentStatus];
 if(!status)throw Error('Unknown Presidents Cup tournament status');
 const teams=['USA','INTL'].map(id=>overview.teams?.find(team=>team.teamId===id));
 const valid=teams.every(team=>typeof team?.totalValue==='number'&&Number.isFinite(team.totalValue)&&team.totalValue>=0&&team.totalValue<=30&&Number.isInteger(team.totalValue*2));
 const base={...prior,id,eventId:id,canonicalEventId:id,key:'golf',codeId:'sport:golf',competitionId:'competition:presidents-cup',competitionName:'Presidents Cup',eventFamilyId:FAMILY,tournamentId:t.id,tournamentName:'Presidents Cup',name:'Presidents Cup',tournamentParent:true,season:Number(t.seasonYear),status,venue:t.courses?.find(c=>c.hostCourse)?.courseName||prior.venue,venueCity:t.city||prior.venueCity,venueCountryCode:'US',sourceUrl:URL,sourceName:'Presidents Cup official scoring',sourceType:'official',sourceCheckedAt:checkedAt,statusCheckedAt:checkedAt,homeParticipantId:'team:golf:usa',awayParticipantId:'team:golf:international',participantIds:['team:golf:usa','team:golf:international'],participants:[{id:'team:golf:usa',name:'USA',displayName:'USA'},{id:'team:golf:international',name:'International',displayName:'International'}]};
 delete base.detailsUnavailable;
 if(valid)Object.assign(base,{homeScore:teams[0].totalValue,awayScore:teams[1].totalValue,scoreCheckedAt:checkedAt});
 if(status==='completed')base.firstConfirmedCompleteAt=prior.firstConfirmedCompleteAt||checkedAt;
 // A round marked Official is not evidence the tournament is completed.
 const leaderboard=data('cupTournamentLeaderboard'),tee=data('cupTeeTimes');
 const children=(leaderboard?.allRounds||[]).map(round=>{
  const number=round.roundNum,old=previous.find(e=>e.id===`${id}:round:${number}`)||{};
  const source=tee?.rounds?.find(r=>r.roundNum===number);
  const stamps=(source?.matches||[]).map(m=>m.teeTime).filter(n=>Number.isFinite(n)&&n>0);
  const start=stamps.length?new Date(Math.min(...stamps)).toISOString():old.startTimeUtc;
  // Published round titles establish the local competition day; no tee time is invented.
  const day=String(round.roundDisplayName).split(' ')[0],offset={Thursday:0,Friday:1,Saturday:2,Sunday:3}[day];
  const date=base.date&&offset!=null?new Date(Date.parse(base.date+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10):old.date;
  const complete=source?.totalMatches>0&&source.completedMatches===source.totalMatches;
  const knownRound=leaderboard?.currentRound===number&&leaderboard.totalMatches>0&&leaderboard.completedMatches===leaderboard.totalMatches;
  const live=leaderboard?.currentRound===number&&t.roundStatus==='IN_PROGRESS';
  const event={...old,id:`${id}:round:${number}`,eventId:`${id}:round:${number}`,key:'golf',codeId:'sport:golf',competitionId:base.competitionId,eventFamilyId:FAMILY,tournamentId:t.id,tournamentName:'Presidents Cup',parentEventId:id,cardType:'golf_session',name:`Presidents Cup · ${round.roundDisplayName}`,stage:round.roundDisplayName,date:start?localParts(start).date:date,time:start?localParts(start).time:null,timeTbc:!start,timePrecision:start?'exact':'tbc',...(start?{startTimeUtc:start}:{}),status:complete||knownRound?'completed':live?'live':old.status||'upcoming',venue:base.venue,venueCity:base.venueCity,venueCountryCode:'US',participants:[],participantIds:[],sourceUrl:URL,sourceName:base.sourceName,sourceCheckedAt:checkedAt};
  if(event.status==='completed')event.firstConfirmedCompleteAt=old.firstConfirmedCompleteAt||checkedAt;
  return event;
 });
 return [base,...children];
}
async function refresh({previous=[],now=new Date(),fetchImpl=fetch,signal}={}){
 const parent=previous.find(e=>e.tournamentParent);
 if(parent&&parent.date&&(+now<Date.parse(parent.date+'T00:00:00Z')-86400000||parent.status==='completed'&&+now>Date.parse(parent.firstConfirmedCompleteAt||'')+3600000))return previous;
 const response=await fetchImpl(URL,{signal:signal||AbortSignal.timeout(10000)});if(!response.ok)throw Error(`Presidents Cup HTTP ${response.status}`);
 return parse(await response.text(),{previous,checkedAt:now.toISOString()});
}
module.exports={URL,FAMILY,parse,refresh};
