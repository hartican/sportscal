'use strict';
const parser=require('./golf-participation'),scope=require('./golf-tracked-scope');
const terminal=e=>/^(completed|finished|cancelled|abandoned)$/.test(e.status||'');
// Tee-time appearances share a tournament ID but are not leaderboard owners.
const isTournamentParent=e=>e.cardType!=='golf_appearance'&&e.cardKind!=='golf_appearance'&&!e.parentEventId;
function snapshot(html,{base,checkedAt,previous=base}={}){
 const queries=parser.pgaQueries(html),tournaments=queries.filter(q=>q.queryKey?.[0]==='tournament'&&q.state?.data?.id===base.tournamentId);
 const t=tournaments[0]?.state?.data;
 if(!t||Number(t.seasonYear)!==Number(base.season)||tournaments.some(q=>JSON.stringify(q.state.data)!==JSON.stringify(t))||!Number.isSafeInteger(t.currentRound)||t.currentRound<1||t.currentRound>5)throw Error('Invalid Golf round identity');
 const raw=queries.find(q=>q.queryKey?.[0]==='leaderboard')?.state?.data;
 const rows=parser.parsePgaLeaderboard(html,{base,sourceUrl:base.leaderboardUrl,checkedAt});
 const expected=base.tournamentId==='R2026527'?72:previous.golfFieldSize;
 if(!expected||!rows.length||rows.length!==expected||raw.tournamentStatus!==t.tournamentStatus)throw Error('Incomplete Golf leaderboard');
 const entrants=(base.entries||base.participants||[]).filter(p=>!['withdrawn','excluded'].includes(p.entryStatus));
 if(entrants.some(p=>!rows.some(r=>scope.identity(r.participantId)===scope.identity(p.id))))throw Error('Missing retained Golf participant');
 const status=parser.pgaStatus(queries,base);if(!status)throw Error('Unknown Golf tournament status');
 const roundPhase=status==='completed'?'tournament-completed':status==='suspended'?'suspended':t.roundStatus==='OFFICIAL'?'round-completed':['IN_PROGRESS','INPROGRESS','ACTIVE'].includes(t.roundStatus)?'playing':'unknown';
 const roundComplete=rows.every(r=>/^(CUT|WD|DQ)$/.test(r.position)||r.currentRound===t.currentRound&&r.roundStatus==='R'+t.currentRound+' Completed');
 if(roundPhase==='round-completed'&&!roundComplete)throw Error('Incomplete Golf round');
 const winners=raw.winners?.length?raw.winners:[raw.winner].filter(Boolean);
 if(status==='completed'&&(!winners.length||winners.some(w=>!raw.players.some(p=>String(p.player?.id)===String(w.id)&&p.scoringData.position==='1'))||t.roundStatus!=='OFFICIAL'||!roundComplete))throw Error('Unconfirmed Golf final');
 const projected=scope.project({...base,roundScores:rows},{ids:scope.trackedIds((base.participantIds||[])),now:Date.parse(checkedAt)});
 const golf={round:t.currentRound,phase:roundPhase,statusText:roundPhase==='round-completed'?'Play finished for today':roundPhase==='tournament-completed'?'Official result':roundPhase==='suspended'?'Play suspended':roundPhase==='playing'?'Live':'Awaiting update',officialUrl:base.leaderboardUrl,fieldCount:rows.length,rows:projected.roundScores};
 projected.tournamentProgress=require('./tournament-progress').golf(t,{sourceUrl:base.leaderboardUrl,sourceCheckedAt:checkedAt});
 return {...projected,roundScores:undefined,golfFieldSize:rows.length,status:status==='completed'?'completed':status==='cancelled'?'cancelled':roundPhase==='playing'?'live':status==='suspended'?'suspended':'ongoing',statusText:golf.statusText,score:{golf},scoreCheckedAt:checkedAt,statusCheckedAt:checkedAt,sourceCheckedAt:checkedAt,statusSourceType:'official',sourceType:'official',sourceName:'PGA TOUR official leaderboard',sourceUrl:base.leaderboardUrl};
}
function source({fetchImpl,published=[]}={}){
 const seed=published.filter(e=>isTournamentParent(e)&&e.key==='golf'&&/^R\d{7}$/.test(e.tournamentId||'')&&(e.tournamentId==='R2026527'||Number.isSafeInteger(e.golfFieldSize)));
 return {id:'live-golf-current',seed,allowEmpty:true,timeoutMs:4000,minimumRuntimeMs:4000,minimumIntervalMs:120000,
  refreshInterval:(fixtures,now)=>fixtures.some(e=>isTournamentParent(e)&&!terminal(e)&&e.score?.golf?.phase==='playing')?120000:1800000,
  fetch:async({now,previous=seed,signal})=>{
   const candidates=previous.filter(e=>isTournamentParent(e)&&!terminal(e)&&Date.parse(e.date)<=+now&&Date.parse((e.endDate||e.date)+'T23:59:59Z')>=+now-7*86400000).sort((a,b)=>Number(b.status==='live')-Number(a.status==='live')||String(a.date).localeCompare(String(b.date)));
   const base=candidates[0];if(!base)return previous;
   const slug=base.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),url=`https://www.pgatour.com/tournaments/${base.season}/${slug}/${base.tournamentId}/leaderboard`;
   const abort=AbortSignal.timeout(4000),response=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,abort]):abort});if(!response.ok)throw Error('Official Golf leaderboard unavailable');
   let html='';const reader=response.body?.getReader();if(reader){let bytes=0;const decoder=new TextDecoder();try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>4*1024*1024)throw Error('Golf source byte budget exceeded');html+=decoder.decode(chunk.value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel();}}else html=await response.text();
   if(Buffer.byteLength(html)>4*1024*1024)throw Error('Golf source byte budget exceeded');
   const next=snapshot(html,{base:{...base,leaderboardUrl:url},previous:base,checkedAt:now.toISOString()});
   return previous.map(e=>e.id===base.id?next:e);
  }};
}
module.exports={snapshot,source};
