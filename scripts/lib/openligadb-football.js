'use strict';

// Provider facts only. Identity aliases, Australian rights and editorial belong
// to their own reviewed inputs; none is inferred from this community database.
const LICENCE = 'https://opendatacommons.org/licenses/odbl/1-0/';
const COMPETITIONS = Object.freeze({
  ucl: { leagueId:4946, competitionId:'competition:uefa-champions-league', name:'UEFA Champions League' },
  uel2026: { leagueId:6000, competitionId:'competition:uefa-europa-league', name:'UEFA Europa League' },
});
class SourceIntegrityError extends Error {}
class InvalidMatchResult extends Error {
  constructor(code,message){super(message);this.code=code;}
}
function fail(message){ throw new SourceIntegrityError(`OpenLigaDB rejected: ${message}`); }
function invalidResult(code,message){throw new InvalidMatchResult(code,message);}
function matchResult(match){
  const finalResults=match.matchResults.filter(r=>r.resultTypeID===2);
  if(!match.matchIsFinished){if(finalResults.length)invalidResult('unfinished-with-final','unfinished fixture has a final result');return null;}
  if(finalResults.length!==1||finalResults[0].resultTypeKind!=='After90Minutes')invalidResult('ambiguous-full-time','finished fixture lacks an unambiguous full-time result');
  const score=(value,side)=>{if(!Number.isSafeInteger(value)||value<0)invalidResult('invalid-score',`invalid ${side} score`);return value;};
  return {homeScore:score(finalResults[0].pointsTeam1,'home'),awayScore:score(finalResults[0].pointsTeam2,'away')};
}
function integer(value, label, min=1){ if(!Number.isSafeInteger(value)||value<min)fail(label);return value; }
function timestamp(value,label){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail(label);
  const normalized=new Date(value).toISOString();
  if(normalized.slice(0,19)!==value.slice(0,19))fail(label);
  return normalized;
}
function sourcePlace(value){
  if(typeof value!=='string')return null;
  const clean=value.trim().replace(/\s+/g,' ');
  return clean&&!/^(?:tbc|tbd|unknown|-|n\/a)$/i.test(clean)&&clean.length<=200?clean:null;
}
function goalDetails(match,result){
  // Optional detail cannot invalidate otherwise verified fixture/results.
  const rows=match.goals;if(!Array.isArray(rows)||rows.length>40||!result)return null;
  const goals=rows.filter(g=>g&&g.disallowed!==true&&g.isDisallowed!==true&&g.cancelled!==true).slice().sort((a,b)=>(a.scoreTeam1+a.scoreTeam2)-(b.scoreTeam1+b.scoreTeam2));
  if(goals.length!==result.homeScore+result.awayScore)return null;
  const ids=new Set();let home=0,away=0;
  const normalized=[];
  for(const g of goals){
    const name=sourcePlace(g.goalGetterName),minute=g.matchMinute;
    if(!Number.isSafeInteger(g.goalID)||ids.has(g.goalID)||!name||!Number.isSafeInteger(g.scoreTeam1)||!Number.isSafeInteger(g.scoreTeam2)||g.scoreTeam1<0||g.scoreTeam2<0)return null;
    ids.add(g.goalID);const delta=[g.scoreTeam1-home,g.scoreTeam2-away];
    if(!(delta[0]===1&&delta[1]===0||delta[0]===0&&delta[1]===1))return null;
    const team=delta[0]?match.team1:match.team2;
    if(g.scoringTeamId!=null&&g.scoringTeamId!==team.teamId)return null;
    normalized.push({id:String(g.goalID),name,minute:Number.isSafeInteger(minute)&&minute>0&&minute<=180?minute:null,...(Number.isSafeInteger(g.addedTime)&&g.addedTime>0&&g.addedTime<=30?{addedTime:g.addedTime}:{}),ownGoal:g.isOwnGoal===true,penalty:g.isPenalty===true,type:'Goal',teamProviderId:String(team.teamId)});
    home=g.scoreTeam1;away=g.scoreTeam2;
  }
  return home===result.homeScore&&away===result.awayScore?normalized:null;
}
function normalizeLeague(matches,{league,season=2026,checkedAt}={}){
  const competition=COMPETITIONS[league];if(!competition||season!==2026)fail('unreviewed competition or season');
  checkedAt=timestamp(checkedAt,'check time must be explicit UTC');
  if(!Array.isArray(matches)||matches.length!==144)fail('expected all 144 league-phase fixtures');
  const ids=new Set(),rounds=new Map(),teams=new Map(),counts=new Map(),pairs=new Set(),repairs=[];
  const fixtures=matches.map(match=>{
    if(!match||typeof match!=='object'||Array.isArray(match))fail('invalid fixture record');
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
    if(!Array.isArray(match.matchResults)||match.matchResults.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('invalid result collection');
    if(match.matchIsFinished&&Date.parse(startTimeUtc)>Date.parse(checkedAt))fail('future fixture marked completed');
    let result=null,repair;
    try{
      result=matchResult(match);
    }catch(error){
      // Only these explicitly classified result defects are match-local. Raw
      // structure, calendar, identity and unexpected programming errors escape.
      if(!(error instanceof InvalidMatchResult))throw error;
      repair={providerFixtureId:String(id),code:error.code,reason:error.message,disposition:'omitted',resultEvidence:{matchIsFinished:match.matchIsFinished,matchResults:match.matchResults.filter(r=>r.resultTypeID===2).map(({resultTypeID,resultTypeKind,pointsTeam1,pointsTeam2})=>({resultTypeID,resultTypeKind,pointsTeam1,pointsTeam2}))}};
    }
    const goals=goalDetails(match,result);
    const fixture={providerFixtureId:String(id),competitionId:competition.competitionId,season:'2026/27',stage:'league-phase',roundNumber:round,startTimeUtc,participants,...(goals?{goalScorers:goals,goalDetailsCheckedAt:checkedAt}:{}),
      venue:sourcePlace(match.location?.locationStadium),venueCity:sourcePlace(match.location?.locationCity),
      // Elapsed time is not evidence of live play or completion.
      status:repair?'unknown':match.matchIsFinished?'completed':Date.parse(startTimeUtc)>Date.parse(checkedAt)?'upcoming':'unknown',result};
    if(repair)repairs.push({...repair,rawFixture:fixture});
    return fixture;
  }).sort((a,b)=>a.startTimeUtc.localeCompare(b.startTimeUtc)||a.providerFixtureId.localeCompare(b.providerFixtureId));
  if(teams.size!==36||rounds.size!==8||[...rounds.values()].some(n=>n!==18))fail('incomplete clubs or matchdays');
  if([...counts.values()].some(c=>c.total!==8||c.home!==4))fail('each club must have eight games, four at home');
  const omitted=new Set(repairs.map(r=>r.providerFixtureId));
  const facts={schemaVersion:'openligadb-football-facts.v1',competitionId:competition.competitionId,competitionName:competition.name,season:'2026/27',scope:'league-phase',checkedAt,
    source:{name:'OpenLigaDB community database',url:`https://api.openligadb.de/getmatchdata/${league}/${season}`,type:'community',licence:LICENCE,attribution:'Data from OpenLigaDB, available under the Open Database License (ODbL).'},
    teams:[...teams].sort((a,b)=>a[0]-b[0]).map(([providerId,sourceName])=>({providerId:String(providerId),sourceName})),fixtures:fixtures.filter(f=>!omitted.has(f.providerFixtureId)),
    ...(repairs.length?{resultIsolation:{rawFixtureIds:fixtures.map(f=>f.providerFixtureId),repairs}}:{})};
  assertResultAdmission(facts);return facts;
}
function rawScheduleFixtures(league){
  const rows=new Map(league.fixtures.map(f=>[f.providerFixtureId,f]));
  for(const repair of league.resultIsolation?.repairs||[])if(!rows.has(repair.providerFixtureId))rows.set(repair.providerFixtureId,repair.rawFixture);
  return [...rows.values()];
}
function assertResultAdmission(league){
  const ids=league.fixtures.map(f=>f.providerFixtureId),isolation=league.resultIsolation;
  if(new Set(ids).size!==ids.length)fail('duplicate accepted fixture identity');
  for(const f of league.fixtures)if(f.status==='completed'&&(!Number.isSafeInteger(f.result?.homeScore)||f.result.homeScore<0||!Number.isSafeInteger(f.result?.awayScore)||f.result.awayScore<0))fail('accepted completed fixture lacks validated scores');
  if(!isolation){if(ids.length!==144)fail('accepted fixtures do not reconcile to all 144 raw fixtures');return;}
  const raw=isolation.rawFixtureIds,repairs=isolation.repairs;
  if(!Array.isArray(raw)||raw.length!==144||new Set(raw).size!==144||raw.some(id=>typeof id!=='string'||!/^\d+$/.test(id)))fail('invalid raw schedule identity inventory');
  if(!Array.isArray(repairs)||!repairs.length||new Set(repairs.map(r=>r.providerFixtureId)).size!==repairs.length)fail('invalid result repair inventory');
  const omitted=[];
  for(const repair of repairs){
    if(!raw.includes(repair.providerFixtureId)||!repair.reason||!repair.code||repair.rawFixture?.providerFixtureId!==repair.providerFixtureId)fail('unexplained result omission');
    const evidence=repair.resultEvidence;
    if(!evidence||typeof evidence.matchIsFinished!=='boolean'||!Array.isArray(evidence.matchResults)||evidence.matchResults.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('missing invalid-result evidence');
    let issue;try{matchResult(evidence);}catch(error){if(!(error instanceof InvalidMatchResult))throw error;issue=error;}
    if(!issue||issue.code!==repair.code||issue.message!==repair.reason)fail('result repair does not document a specifically invalid result');
    if(repair.rawFixture.competitionId!==league.competitionId||repair.rawFixture.season!==league.season||repair.rawFixture.status!=='unknown'||repair.rawFixture.result!==null)fail('invalid quarantined schedule identity');
    if(repair.disposition==='omitted')omitted.push(repair.providerFixtureId);
    else if(repair.disposition!=='retained'||!ids.includes(repair.providerFixtureId))fail('invalid retained-result admission');
    else{
      const kept=league.fixtures.find(f=>f.providerFixtureId===repair.providerFixtureId);
      if(kept.status!=='completed'||kept.sourceCheckedAt!==repair.retainedSourceCheckedAt||kept.scoreCheckedAt!==repair.retainedScoreCheckedAt)fail('retained result lost its original observations');
    }
  }
  const accounted=[...ids,...omitted];
  if(new Set(accounted).size!==accounted.length||accounted.length!==raw.length||raw.some(id=>!accounted.includes(id)))fail('accepted plus explicitly omitted fixtures do not reconcile to validated raw schedule');
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
  const fixtureFor=fixture=>{const participants=fixture.participants.map(resolve);return {...fixture,participants,...(fixture.goalScorers?{goalScorers:fixture.goalScorers.map(g=>{const team=participants.find(p=>p.providerId===g.teamProviderId);return {...g,teamName:team?.name||null,teamParticipantId:team?.participantId||null};})}:{})};};
  return {...facts,teams:facts.teams.map(resolve),fixtures:facts.fixtures.map(fixtureFor),...(facts.resultIsolation?{resultIsolation:{...facts.resultIsolation,repairs:facts.resultIsolation.repairs.map(r=>({...r,rawFixture:fixtureFor(r.rawFixture)}))}}:{})};
}
function assertSnapshotContinuity(previous, next) {
  if (!previous) return;
  if (previous.competitionId !== next.competitionId || previous.season !== next.season) fail('snapshot scope changed');
  if (Date.parse(next.checkedAt) < Date.parse(previous.checkedAt)) fail('observation predates last-good snapshot');
  assertResultAdmission(previous);assertResultAdmission(next);
  const incoming = new Map(rawScheduleFixtures(next).map(fixture => [fixture.providerFixtureId, fixture]));
  const isolated=new Set((next.resultIsolation?.repairs||[]).map(r=>r.providerFixtureId));
  for (const known of rawScheduleFixtures(previous)) {
    const fixture = incoming.get(known.providerFixtureId);
    if (!fixture) fail(`fixture ${known.providerFixtureId}: identity disappeared; reviewed migration required`);
    // A changed kickoff is allowed. A reused ID must not move saved follows,
    // ratings or reminders onto a different home/away pairing.
    if (JSON.stringify(known.participants.map(p => [p.participantId, p.role])) !== JSON.stringify(fixture.participants.map(p => [p.participantId, p.role]))) {
      fail(`fixture ${known.providerFixtureId}: participant identity changed; reviewed migration required`);
    }
    if (known.status === 'completed' && fixture.status !== 'completed'&&!isolated.has(known.providerFixtureId)) fail(`fixture ${known.providerFixtureId}: confirmed result regressed`);
  }
}
function retainFixtureObservations(previous, next) {
  const known = new Map((previous?.fixtures || []).map(f => [f.providerFixtureId, f]));
  const valid = value => Number.isFinite(Date.parse(value));
  const facts = ['providerFixtureId','competitionId','season','stage','roundNumber','startTimeUtc','participants','venue','venueCity','status','result','goalScorers'];
  const sameSource = previous?.source?.name === next.source.name && previous?.source?.url === next.source.url && previous?.source?.type === next.source.type;
  const isolated=new Set((next.resultIsolation?.repairs||[]).map(r=>r.providerFixtureId));
  const fixtures=next.fixtures.filter(f=>!isolated.has(f.providerFixtureId)).map(fixture => {
    const prior = known.get(fixture.providerFixtureId), result = {...fixture, sourceCheckedAt: next.checkedAt};
    if(sameSource&&prior?.goalScorers&&fixture.goalScorers&&JSON.stringify(prior.goalScorers)===JSON.stringify(fixture.goalScorers))result.goalDetailsCheckedAt=prior.goalDetailsCheckedAt||prior.sourceCheckedAt||previous.checkedAt;
    else if(sameSource&&prior?.goalScorers&&!fixture.goalScorers&&JSON.stringify(prior.result)===JSON.stringify(fixture.result))Object.assign(result,{goalScorers:prior.goalScorers,goalDetailsCheckedAt:prior.goalDetailsCheckedAt||prior.sourceCheckedAt||previous.checkedAt,goalDetailsStale:true});
    // Compare the retained facts after optional goal-detail preservation, so
    // an unchanged retained detail does not renew the fixture observation.
    if (sameSource && prior && facts.every(key => JSON.stringify(prior[key]) === JSON.stringify(result[key]))) {
      const observed = prior.sourceCheckedAt || previous.checkedAt;
      if (valid(observed)) result.sourceCheckedAt = observed;
    }
    if (fixture.status === 'completed') {
      result.scoreCheckedAt = next.checkedAt;
      if (sameSource && prior?.status === 'completed' && JSON.stringify(prior.participants) === JSON.stringify(fixture.participants) && JSON.stringify(prior.result) === JSON.stringify(fixture.result)) {
        const observed = prior.scoreCheckedAt || previous.checkedAt;
        if (valid(observed)) result.scoreCheckedAt = observed;
      }
    }
    return result;
  });
  if(!next.resultIsolation)return {...next,fixtures};
  const repairs=next.resultIsolation.repairs.map(repair=>{
    const prior=known.get(repair.providerFixtureId),raw=repair.rawFixture;
    const sourceClock=prior?.sourceCheckedAt||previous?.checkedAt,scoreClock=prior?.scoreCheckedAt||previous?.checkedAt;
    const eligible=sameSource&&prior?.status==='completed'&&prior.competitionId===raw.competitionId&&prior.season===raw.season&&prior.startTimeUtc===raw.startTimeUtc&&prior.roundNumber===raw.roundNumber&&
      JSON.stringify(prior.participants)===JSON.stringify(raw.participants)&&Number.isSafeInteger(prior.result?.homeScore)&&prior.result.homeScore>=0&&Number.isSafeInteger(prior.result?.awayScore)&&prior.result.awayScore>=0&&valid(sourceClock)&&valid(scoreClock)&&Date.parse(sourceClock)<=Date.parse(next.checkedAt)&&Date.parse(scoreClock)<=Date.parse(next.checkedAt)&&Date.parse(scoreClock)>=Date.parse(prior.startTimeUtc);
    if(!eligible)return {...repair,disposition:'omitted'};
    fixtures.push({...prior,sourceCheckedAt:sourceClock,scoreCheckedAt:scoreClock});
    return {...repair,disposition:'retained',retainedSourceCheckedAt:sourceClock,retainedScoreCheckedAt:scoreClock};
  });
  fixtures.sort((a,b)=>a.startTimeUtc.localeCompare(b.startTimeUtc)||a.providerFixtureId.localeCompare(b.providerFixtureId));
  const result={...next,fixtures,resultIsolation:{...next.resultIsolation,repairs}};assertResultAdmission(result);return result;
}
module.exports={normalizeLeague,resolveLeagueIdentities,assertSnapshotContinuity,retainFixtureObservations,assertResultAdmission,rawScheduleFixtures,goalDetails,COMPETITIONS,LICENCE};
