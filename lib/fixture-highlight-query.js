'use strict';
// Provider discovery stays server-only; results pages use the public formatter.
const contract=require('../config/fixture-highlights');
function searchQuery(event,now=Date.now()){
  const selection=contract.searchCandidate(event,now);if(!selection)return null;
  const {title,namedTennis,place,format}=selection;
  const date=contract.searchDate(event,now);
  if(namedTennis)return [title,require('./fixture-highlights').tournament(event),date.slice(0,4),/women|female|\bWTA\b/i.test(format+' '+event.gender+' '+event.key)?'WTA':'ATP','highlights'].filter(Boolean).join(' ');
  if((event.key||event.sportKey)==='motogp'&&/indonesia|mandalika/i.test(title+' '+place))return ['MotoGP Indonesian GP',date.slice(0,4),/sprint|qualifying|practice|warm/i.test(event.stage||'')?event.stage:null,'highlights|moments'].filter(Boolean).join(' ');
  const sport=String(event.codeId||event.sportKey||event.key||'').replace(/^(?:sport|competition):/,'').replace(/[-:]/g,' ');
  return [title,event.competitionName||event.tournamentName,date,event.stage||event.roundLabel,contract.cricketDay(event)?'Day '+contract.cricketDay(event):null,sport,'highlights'].filter(Boolean).join(' ');
}
module.exports={searchQuery};
