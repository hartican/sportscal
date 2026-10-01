'use strict';
const {rscObjects,participant}=require('./golf-participation');
function parse(html,{base,sourceUrl,checkedAt=new Date().toISOString()}){
 const objects=rscObjects(html),payload=objects.find(o=>o.results?.entries&&String(o.tournamentId)===String(base.tournamentId));
 if(!payload)throw Error('LPGA results edition unavailable');
 const {tournament}=payload.results;
 const entries=payload.results.entries.filter(e=>!(e.ad&&Object.keys(e).length===1));
 if(String(tournament?.tournamentId)!==String(base.tournamentId)||tournament.startDate?.slice(0,10)!==base.date||tournament.endDate?.slice(0,10)!==base.endDate)throw Error('LPGA results edition mismatch');
 const rounds=tournament.totalRounds;
 if(!Number.isInteger(rounds)||rounds<1||rounds>5||entries.length<10||entries.length>250)throw Error('LPGA results structure incomplete');
 const ranked=entries.filter(e=>/^T?\d+$/.test(String(e.position)));
 const winners=ranked.filter(e=>String(e.position)==='1');
 // A populated live leaderboard is insufficient: require a settled award and all classified rounds.
 if(winners.length!==1||!/^\$+[\d,]+(?:\.\d+)?$/.test(winners[0].prizeMoney||'')||Number(winners[0].prizeMoney.replace(/[$,]/g,''))<=0)throw Error('LPGA final winner not settled');
 const ids=new Set();
 for(const e of entries){
  if(!e.player?.playerId||typeof e.player.firstName!=='string'||typeof e.player.lastName!=='string'||!e.player.firstName.trim()||!e.player.lastName.trim()||ids.has(e.player.playerId))throw Error('LPGA result identity invalid or duplicate');ids.add(e.player.playerId);
  if(!/^(?:T?\d+|CUT|WD|WDC|DQ|DSQ|DNS)$/i.test(String(e.position)))throw Error('LPGA result position invalid');
  if(!/^(?:E|[+-]?\d+)$/.test(String(e.toPar)))throw Error('LPGA to-par score invalid');
  if(!Array.isArray(e.scores)||e.scores.some(v=>!/^\d{2,3}$/.test(String(v)))||!Number.isFinite(e.total)||e.scores.reduce((n,v)=>n+Number(v),0)!==e.total)throw Error('LPGA round totals invalid');
  if(/^T?\d+$/.test(String(e.position))&&e.scores.length!==rounds)throw Error('LPGA classified rounds incomplete');
 }
 if(ranked.length<2||ranked.some(e=>e.total<winners[0].total))throw Error('LPGA winner disagrees with classified totals');
 const winner=participant(winners[0].player,{gender:'female',sourceUrl,checkedAt});
 const outcomeText=`${winner.displayName} won ${base.name} at ${winners[0].toPar} (${winners[0].total} strokes).`;
 return {...base,status:'completed',outcomeText,scoreDisplay:`Winner: ${winner.displayName} (${winners[0].toPar})`,recapText:outcomeText,resultLabels:['Official result'],resultPublishedAt:base.resultPublishedAt||checkedAt,sourceUrl,sourceName:'LPGA official results',sourceCheckedAt:checkedAt,fixtureResults:{schemaVersion:'fixture-results.v1',columns:['Pos','Player',...Array.from({length:rounds},(_,i)=>'R'+(i+1)),'Strokes','To par'],rows:entries.map(e=>[String(e.position),[e.player.firstName,e.player.lastName].join(' '),...Array.from({length:rounds},(_,i)=>String(e.scores[i]??'—')),String(e.total),String(e.toPar)]),sourceUrl,checkedAt}};
}
const facts=value=>JSON.stringify(value,(k,v)=>['sourceCheckedAt','checkedAt','resultPublishedAt'].includes(k)?undefined:v);
async function refresh(document,{now=new Date(),fetchImpl=fetch}={}){
 const candidates=(document.lpga||[]).filter(e=>Number.isFinite(Date.parse(e.endDate))&&Date.parse(e.endDate)+36*3600000<=+now&&Date.parse(e.endDate)>=+now-14*86400000).slice(0,4);
 const updates=new Map(),failures=[];
 for(const base of candidates){
  try{
   const url=new URL(base.sourceUrl);if(url.protocol!=='https:'||url.hostname!=='www.lpga.com'||!/^\/tournaments\/[^/]+\/(?:pairings|entries|leaderboard|results)$/.test(url.pathname))throw Error('Unrecognised LPGA source URL');url.pathname=url.pathname.replace(/\/(pairings|entries|leaderboard|results)$/,'/results');
   const response=await fetchImpl(url.href,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('LPGA results HTTP '+response.status);
   const next=parse(await response.text(),{base,sourceUrl:url.href,checkedAt:now.toISOString()});if(facts(next)!==facts(base))updates.set(base.id,next);
  }catch(error){failures.push({id:base.id,message:error.message});}
 }
 return {document:{...document,lpga:(document.lpga||[]).map(e=>updates.get(e.id)||e)},changed:updates.size,checked:candidates.length,failures};
}
module.exports={parse,refresh};
