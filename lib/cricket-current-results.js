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
 const events=[...byId.values()];
 events.coverage={failures:[],completedResultsPages:pages,completedResultsCheckedAt:checkedAt,completedCatchupAt:catchupDue?checkedAt:coverage.completedCatchupAt,unresolvedRecentFixtureIds:[...pending].sort(),completedLookbackDays:14,completedPageBudget:pageBudget};
 return events;
}
module.exports={currentCricket,RESULTS_URL,CURRENT_URL,MAX_PAGES};
