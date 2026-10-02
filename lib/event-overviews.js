'use strict';
const policy=require('../config/follow-feed-policy');
function build(fixtures){
 const groups=new Map();
 for(const f of fixtures){
  if(!f.date||!['tennis','tennis-women','golf','golf-women','cricket','cricket-women','f1','motogp','wrc','sailgp','wsl','wsl'].includes(policy.sportKey(f)))continue;
  if(f.parentTieId||f.contestUnit==='rubber'||['cancelled','abandoned'].includes(f.status))continue;
  const series=(policy.sportKey(f)==='wrc'?(f.canonicalEventId||f.id):null)||f.weekendId||f.tournamentId||f.tennisTournamentId||f.seriesId||f.circuitId||f.eventFamilyId||f.competitionId;if(!series)continue;
  const category=policy.sportKey(f),id=`overview:${category}:${series}:${f.season||f.date.slice(0,4)}`;
  const name=f.tournamentName||f.seriesName||(f.circuitId?String(f.name).replace(/\s*[—–-]?\s*(?:sprint qualifying|qualifying|sprint|race|practice|FP[123])$/i,'').trim():f.competitionName)||f.name;
  const prior=groups.get(id)||{id,key:f.key,sportKey:category,name,competitionId:f.competitionId,tournamentId:f.tournamentId,circuitId:f.circuitId,gender:f.gender,sourceUrl:f.sourceUrl,...(['motogp','wrc','sailgp','wsl'].includes(category)?Object.fromEntries(['venue','venueOfficialName','venueId','venueVerified','venueCity','venueCountryCode','venueConfigurationId','venueConfigurationVerified','venueArtworkId','weekendId','venueSourceUrl','venueCaption','courseArtworkId','courseGeometryVerified','courseGeometrySourceUrl','season','canonicalEventId'].filter(k=>f[k]!=null).map(k=>[k,f[k]])):{}),fixtureIds:[],date:f.date,endDate:f.endDate||f.date};
  if(category==='sailgp')prior.venueCaption=`Published race weekend • ${f.season||f.date.slice(0,4)} • Course unverified`;
  prior.date=[prior.date,f.date].sort()[0];prior.endDate=[prior.endDate,f.endDate||f.date].sort().at(-1);prior.fixtureIds.push(f.id);groups.set(id,prior);
 }
 return [...groups.values()].map(e=>({...e,fixtureIds:[...new Set(e.fixtureIds)]})).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
module.exports={build};
