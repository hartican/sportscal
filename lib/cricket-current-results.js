'use strict';
const RESULTS_URL='https://apiv2.cricket.com.au/web/fixtures/yearfilter?isCompleted=true&limit=13&isInningInclude=true&jsconfig=eccn%3Atrue&format=json';
const CURRENT_URL='https://www.cricket.com.au/matches/';
const LOOKBACK_MS=14*86400000,CATCHUP_MS=6*3600000,MAX_PAGES=6;
// The current page drops finished matches. Reconcile exact CA identities against
// confirmed results; elapsed time selects candidates but never declares a result.
async function currentCricket({fetchImpl,now,signal,previous=[],coverage={},parseCricketPage,parseCricketFixtures}){
 const checkedAt=now.toISOString(),cutoff=+now-LOOKBACK_MS;
 const request=async url=>{const response=await fetchImpl(url,{signal:signal||AbortSignal.timeout(12000)});if(!response.ok)throw Error('Cricket Australia source unavailable');return response;};
 const current=parseCricketPage(await (await request(CURRENT_URL)).text(),{sourceUrl:CURRENT_URL,checkedAt});
 const pending=new Set([...previous,...current].filter(f=>/^fixture:cricket:CA:\d+$/.test(f.id)&&!['completed','cancelled','postponed','abandoned'].includes(f.status)&&Date.parse(f.endTimeUtc||f.startTimeUtc)<=+now&&Date.parse(f.endTimeUtc||f.startTimeUtc)>=cutoff).map(f=>f.id));
 const catchupDue=!Number.isFinite(Date.parse(coverage.completedCatchupAt))||+now-Date.parse(coverage.completedCatchupAt)>=CATCHUP_MS;
 const pageBudget=pending.size&&catchupDue?MAX_PAGES:1;
 const games=[],seen=new Map();let lastId,pages=0;
 for(;pages<pageBudget;){
  const url=new URL(RESULTS_URL);if(lastId)url.searchParams.set('lastId',lastId);
  const payload=await (await request(url.href)).json();pages++;
  if(payload.responseError||!Array.isArray(payload.fixtures)||payload.fixtures.length>13)throw Error('Invalid cricket completed-results page');
  for(const game of payload.fixtures){
   if(!Number.isSafeInteger(game.id)||game.isCompleted!==true||typeof game.resultText!=='string'||!game.resultText.trim()||!game.competition?.id||!Number.isFinite(Date.parse(game.startDateTime)))throw Error('Unconfirmed or duplicate cricket result');
   if(seen.has(game.id)){if(seen.get(game.id)!==JSON.stringify(game))throw Error('Conflicting duplicate cricket result');continue;}
   const [parsed]=parseCricketFixtures([game],{sourceUrl:RESULTS_URL,checkedAt});
   if(parsed.participantIds?.length!==2||new Set(parsed.participantIds).size!==2||!game.homeTeam?.id||!game.awayTeam?.id)throw Error('Unresolved cricket result participants');
   seen.set(game.id,JSON.stringify(game));games.push(parsed);pending.delete(parsed.id);
  }
  if(!pending.size||payload.fixtures.length<13||payload.fixtures.every(g=>Date.parse(g.endDateTime||g.startDateTime)<cutoff))break;
  const nextId=payload.fixtures.at(-1).id;if(nextId===lastId)throw Error('Repeated duplicate cricket page');lastId=nextId;
 }
 // Confirmed results take precedence over the simultaneously fetched schedule.
 // Failed pages reject the whole observation; the caller retains last-good data.
 const byId=new Map(current.map(f=>[f.id,f]));for(const game of games)byId.set(game.id,game);
 const detailFailures=[];
 // At most two due details through the existing owner. One oldest-check
 // slot prevents a long milestone window from starving other live matches.
 const detail=require('./cricket-scorecard'),sessions=require('../config/reviewed-cricket-sessions.json'),model=require('../config/match-centre'),rules=require('./milestone-rules');
 const totals=f=>(f?.innings||[]).map(i=>[i.inningNumber,i.runsScored??i.runs,typeof i.wickets==='number'?i.wickets:i.numberOfWicketsFallen,i.oversBowled??i.overs]);
 const candidates=[];
 for(const target of byId.values()){
  if(!/^fixture:cricket:CA:\d+$/.test(target.id)||!require('../config/cricket-coverage').allowed(target))continue;
  const prior=previous.find(f=>f.id===target.id),good=prior?.cricketPhaseConfirmed?Date.parse(prior?.innings?.find(i=>i.detailCheckedAt)?.detailCheckedAt||''):NaN,attempt=Date.parse(prior?.cricketDetailAttemptedAt||'');
  const last=Math.max(Number.isFinite(good)&&good<=+now?good:0,Number.isFinite(attempt)&&attempt<=+now?attempt:0)||0;
  const restart=Date.parse(prior?.restartTimeUtc||''),near=restart>=+now-120000&&restart<=+now+1800000,quiet=model.interrupted(prior||target)&&!near;
  const complete=/^(completed|abandoned|cancelled)$/.test(target.status),finalCached=complete&&prior?.status===target.status&&last&&JSON.stringify(totals(target))===JSON.stringify(totals(prior));
  const retained=failed=>{const next=require('../config/fixture-identity').mergeOverlays([prior],[target])[0];return {...next,innings:(next.innings||[]).map(i=>({...i,...(failed?{detailStale:true}:{})})),...(failed?{sourceStale:true,cricketDetailAttemptedAt:checkedAt}:{})};};
  if(prior?.innings?.some(i=>i.detailCheckedAt))byId.set(target.id,retained(false));
  const justCompleted=complete&&prior?.status==='live';
  if(finalCached||complete&&!justCompleted||!['live','ongoing','stumps','break','rain-delay','interrupted','completed'].includes(target.status))continue;
  if(last&&+now-last<(quiet?1800000:120000)&&!justCompleted)continue;
  const proximity=prior?rules.detect(prior,{now:+now,records:require('../data/canonical/cricket-record-watchlist.v1.json')}).length:0;
  candidates.push({target,prior,last,proximity,retained});
 }
 candidates.sort((a,b)=>a.last-b.last||a.target.id.localeCompare(b.target.id));
 const selected=candidates.slice(0,1),next=candidates.slice(1).sort((a,b)=>b.proximity-a.proximity||a.last-b.last)[0];if(next)selected.push(next);
 for(const {target,prior,retained} of selected){
  const fixtureId=Number(target.id.split(':').at(-1));
  try{
   const response=await fetchImpl(detail.url(fixtureId),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(4000)]):AbortSignal.timeout(4000)});if(!response.ok)throw Error('Official detail unavailable');
   const card=detail.normalize(await response.json(),{fixtureId,checkedAt});
   const [official]=parseCricketFixtures([{...card.fixture,innings:card.innings}],{sourceUrl:detail.url(fixtureId),checkedAt});
   if(!require('../config/cricket-coverage').allowed(official)||JSON.stringify(official.participantIds)!==JSON.stringify(target.participantIds)||official.startTimeUtc!==target.startTimeUtc)throw Error('Scorecard identity changed');
   const restart=fixtureId===39990&&card.phase?.status==='stumps'&&Number.isSafeInteger(card.fixture.matchDay)?sessions.playStarts[card.fixture.matchDay]:null;
   byId.set(target.id,{...target,...official,sourceStale:false,statusCheckedAt:checkedAt,scoreCheckedAt:checkedAt,cricketBalance:card.balance,cricketChase:card.chase,cricketPhaseConfirmed:true,cricketPhaseCheckedAt:checkedAt,cricketDetailAttemptedAt:checkedAt,...card.phase,officialScorecardUrl:'https://www.cricket.com.au/matches/CA%3A'+fixtureId,
    ...(Number.isFinite(Date.parse(restart))?{restartTimeUtc:restart,restartSourceUrl:sessions.sourceUrl,restartSourceCheckedAt:sessions.checkedAt}:{restartTimeUtc:null,restartSourceUrl:null,restartSourceCheckedAt:null})});
  }catch{
   detailFailures.push(target.id);
   if(prior?.innings?.some(i=>i.detailCheckedAt))byId.set(target.id,retained(true));
   else byId.set(target.id,{...target,status:target.status==='completed'?'completed':'ongoing',sourceStale:true,cricketDetailAttemptedAt:checkedAt});
  }
 }
 const events=[...byId.values()];
 events.coverage={detailFailures,failures:[],completedResultsPages:pages,completedResultsCheckedAt:checkedAt,completedCatchupAt:catchupDue?checkedAt:coverage.completedCatchupAt,unresolvedRecentFixtureIds:[...pending].sort(),completedLookbackDays:14,completedPageBudget:pageBudget};
 return events;
}
module.exports={currentCricket,RESULTS_URL,CURRENT_URL,MAX_PAGES};
