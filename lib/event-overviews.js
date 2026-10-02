'use strict';
const policy=require('../config/follow-feed-policy');
function build(fixtures){
 const groups=new Map();
 for(const f of fixtures){
  if(!f.date||!['tennis','tennis-women','golf','golf-women','cricket','cricket-women','f1','motogp','wrc','sailgp','wsl','tdf','giro','vuelta'].includes(policy.sportKey(f)))continue;
  if(f.parentTieId||f.contestUnit==='rubber'||['cancelled','abandoned'].includes(f.status))continue;
  const series=(policy.sportKey(f)==='wrc'?(f.canonicalEventId||f.id):null)||f.weekendId||f.tournamentId||f.tennisTournamentId||f.seriesId||f.circuitId||f.eventFamilyId||f.competitionId;if(!series)continue;
  const category=policy.sportKey(f),id=`overview:${category}:${series}:${f.season||f.date.slice(0,4)}`;
  const name=f.tournamentName||f.seriesName||(f.circuitId?String(f.name).replace(/\s*[—–-]?\s*(?:sprint qualifying|qualifying|sprint|race|practice|FP[123])$/i,'').trim():f.competitionName)||f.name;
  const prior=groups.get(id)||{id,key:f.key,sportKey:category,name,competitionId:f.competitionId,tournamentId:f.tournamentId,circuitId:f.circuitId,gender:f.gender,sourceUrl:f.sourceUrl,...(['motogp','wrc','sailgp','wsl','tdf','giro','vuelta'].includes(category)?Object.fromEntries(['venue','venueOfficialName','venueId','venueVerified','venueCity','venueCountryCode','venueConfigurationId','venueConfigurationVerified','venueArtworkId','weekendId','venueSourceUrl','venueCaption','courseArtworkId','courseGeometryVerified','courseGeometrySourceUrl','editionArtworkId','editionGeometryVerified','season','canonicalEventId'].filter(k=>f[k]!=null).map(k=>[k,f[k]])):{}),fixtureIds:[],date:f.date,endDate:f.endDate||f.date};
  if(category==='sailgp')prior.venueCaption=`Published race weekend • ${f.season||f.date.slice(0,4)} • Course unverified`;
  prior.date=[prior.date,f.date].sort()[0];prior.endDate=[prior.endDate,f.endDate||f.date].sort().at(-1);prior.fixtureIds.push(f.id);groups.set(id,prior);
 }
 // An edition date window can be published before any stage itinerary. It is
 // Events metadata, never an invented fixture or a rating target.
 const editions=require('../data/canonical/grand-tours-calendar.v1.json').editions;
 for(const e of editions){
  const id=`overview:${e.key}:${e.key}:${e.year}:${e.year}`,prior=groups.get(id);
  const date=e.date||e.stages[0]?.date,endDate=e.endDate||e.stages.at(-1)?.date;
  if(!date||!endDate)continue;
  const overview={...prior,id,key:e.key,sportKey:e.key,name:e.name,gender:'mens',competitionId:'competition:'+({tdf:'tour-de-france',giro:'giro-ditalia',vuelta:'vuelta-a-espana'}[e.key]),season:String(e.year),weekendId:`${e.key}:${e.year}`,date:prior?.date&&prior.date<date?prior.date:date,endDate:prior?.endDate&&prior.endDate>endDate?prior.endDate:endDate,fixtureIds:prior?.fixtureIds||[],sourceUrl:e.sourceUrl,isEditionOverview:true,venue:e.completeStageCalendar?'Published edition route':'Edition route unconfirmed',venueCountryCode:e.stages[0]?.startCountryCode||null,editionArtworkId:e.editionArtworkId,editionGeometryVerified:e.editionGeometryVerified===true,courseGeometryVerified:false,courseArtworkId:null,venueCaption:e.completeStageCalendar?`${e.year} • 21 stages • ${e.editionGeometryVerified?'Verified edition route':'Edition geometry unverified'}`:e.stages.length?`${e.year} • Three stages published; remaining route unconfirmed`:`${e.year} • Dates published; stages and route unconfirmed`};
  groups.set(id,overview);
 }
 return [...groups.values()].map(e=>({...e,fixtureIds:[...new Set(e.fixtureIds)]})).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
module.exports={build};
