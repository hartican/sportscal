'use strict';
// Only the server assembles provider searches. Browser cards carry fixture IDs.
const contract=require('../config/fixture-highlights'),policy=require('../config/epic-classics');
function searchQuery(event,now=Date.now()){
  const selection=contract.searchCandidate(event,now);if(!selection)return null;
  const {title,namedTennis,place,format}=selection;
  const date=policy.validDay(event.date)?event.date:policy.finalDay({...event,status:'completed'},new Date(now));
  const sport=namedTennis?(/women|female|\bWTA\b/i.test(format+' '+event.gender+' '+event.key)?'WTA':'ATP Tour Tennis TV'):String(event.codeId||event.sportKey||event.key||'').replace(/^(?:sport|competition):/,'').replace(/[-:]/g,' ');
  return [title,namedTennis?place:event.competitionName||event.tournamentName,namedTennis?date.slice(0,4):date,namedTennis?event.roundLabel||event.round:event.stage||event.roundLabel,sport,'highlights'].filter(Boolean).join(' ');
}
module.exports={searchQuery};
