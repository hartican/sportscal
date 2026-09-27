'use strict';

// Provider facts only. Identity aliases, Australian rights and editorial belong
// to their own reviewed inputs; none is inferred from this community database.
const LICENCE = 'https://opendatacommons.org/licenses/odbl/1-0/';
const COMPETITIONS = Object.freeze({
  ucl: { leagueId:4946, competitionId:'competition:uefa-champions-league', name:'UEFA Champions League' },
  uel2026: { leagueId:6000, competitionId:'competition:uefa-europa-league', name:'UEFA Europa League' },
});
function fail(message){ throw new Error(`OpenLigaDB rejected: ${message}`); }
function integer(value, label, min=1){ if(!Number.isSafeInteger(value)||value<min)fail(label);return value; }
function timestamp(value,label){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail(label);
  const normalized=new Date(value).toISOString();
  if(normalized.slice(0,19)!==value.slice(0,19))fail(label);
  return normalized;
}
function normalizeLeague(matches,{league,season=2026,checkedAt}={}){
  const competition=COMPETITIONS[league];if(!competition||season!==2026)fail('unreviewed competition or season');
  checkedAt=timestamp(checkedAt,'check time must be explicit UTC');
  if(!Array.isArray(matches)||matches.length!==144)fail('expected all 144 league-phase fixtures');
  const ids=new Set(),rounds=new Map(),teams=new Map(),counts=new Map(),pairs=new Set();
  const fixtures=matches.map(match=>{
    const id=integer(match.matchID,'invalid fixture ID');if(ids.has(id))fail('duplicate fixture ID');ids.add(id);
    if(match.leagueId!==competition.leagueId||match.leagueShortcut!==league||match.leagueSeason!==season)fail(`fixture ${id}: competition/season mismatch`);
    const round=integer(match.group?.groupOrderID,'invalid matchday');if(round>8)fail('unsupported stage; league-phase contract needs review');
    rounds.set(round,(rounds.get(round)||0)+1);
    const participants=[match.team1,match.team2].map((team,index)=>{
      const teamId=integer(team?.teamId,'invalid club ID');const name=String(team.teamName||'').trim();if(!name)fail('missing club name');
      if(teams.has(teamId)&&teams.get(teamId)!==name)fail('one club ID has conflicting names');teams.set(teamId,name);
      const count=counts.get(teamId)||{total:0,home:0,rounds:new Set()};
      if(count.rounds.has(round))fail('club appears twice in one matchday');
      count.total++;count.home+=index===0?1:0;count.rounds.add(round);counts.set(teamId,count);
      return {providerId:String(teamId),sourceName:name,role:index===0?'home':'away'};
    });
    if(participants[0].providerId===participants[1].providerId)fail('club plays itself');
    const pair=participants.map(p=>Number(p.providerId)).sort((a,b)=>a-b).join(':');if(pairs.has(pair))fail('repeated opponent in league phase');pairs.add(pair);
    const startTimeUtc=timestamp(match.matchDateTimeUTC,`fixture ${id}: UTC kickoff missing`);
    if(startTimeUtc<'2026-09-01'||startTimeUtc>='2027-02-01')fail('kickoff outside reviewed league-phase season');
    if(typeof match.matchIsFinished!=='boolean')fail('ambiguous completion state');
    if(!Array.isArray(match.matchResults))fail('invalid result collection');
    const finalResults=match.matchResults.filter(r=>r.resultTypeID===2);
    let result=null;
    if(match.matchIsFinished){
      if(finalResults.length!==1||finalResults[0].resultTypeKind!=='After90Minutes')fail('finished fixture lacks an unambiguous full-time result');
      result={homeScore:integer(finalResults[0].pointsTeam1,'invalid home score',0),awayScore:integer(finalResults[0].pointsTeam2,'invalid away score',0)};
      if(Date.parse(startTimeUtc)>Date.parse(checkedAt))fail('future fixture marked completed');
    }else if(finalResults.length)fail('unfinished fixture has a final result');
    return {providerFixtureId:String(id),competitionId:competition.competitionId,season:'2026/27',stage:'league-phase',roundNumber:round,startTimeUtc,participants,
      // Elapsed time is not evidence of live play or completion.
      status:match.matchIsFinished?'completed':Date.parse(startTimeUtc)>Date.parse(checkedAt)?'upcoming':'unknown',result};
  }).sort((a,b)=>a.startTimeUtc.localeCompare(b.startTimeUtc)||a.providerFixtureId.localeCompare(b.providerFixtureId));
  if(teams.size!==36||rounds.size!==8||[...rounds.values()].some(n=>n!==18))fail('incomplete clubs or matchdays');
  if([...counts.values()].some(c=>c.total!==8||c.home!==4))fail('each club must have eight games, four at home');
  return {schemaVersion:'openligadb-football-facts.v1',competitionId:competition.competitionId,competitionName:competition.name,season:'2026/27',scope:'league-phase',checkedAt,
    source:{name:'OpenLigaDB community database',url:`https://api.openligadb.de/getmatchdata/${league}/${season}`,type:'community',licence:LICENCE,attribution:'Data from OpenLigaDB, available under the Open Database License (ODbL).'},
    teams:[...teams].sort((a,b)=>a[0]-b[0]).map(([providerId,sourceName])=>({providerId:String(providerId),sourceName})),fixtures};
}
function resolveLeagueIdentities(facts, registry){
  const records=registry?.teams;if(!Array.isArray(records))fail('missing reviewed identity map');
  const byId=new Map(records.map(team=>[team.providerId,team]));
  if(byId.size!==records.length||new Set(records.map(t=>t.participantId)).size!==records.length)fail('ambiguous identity map');
  const resolve=team=>{
    const mapped=byId.get(team.providerId);
    if(!mapped||!/^team:football:/.test(mapped.participantId)||!mapped.displayName||!mapped.sourceNames?.includes(team.sourceName))fail(`unreviewed club identity ${team.providerId}`);
    return {...team,participantId:mapped.participantId,name:mapped.displayName};
  };
  return {...facts,teams:facts.teams.map(resolve),fixtures:facts.fixtures.map(fixture=>({...fixture,participants:fixture.participants.map(resolve)}))};
}
module.exports={normalizeLeague,resolveLeagueIdentities,COMPETITIONS,LICENCE};
