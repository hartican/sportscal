'use strict';
const identity=require('../../config/fixture-identity');
const aliases=e=>[e?.id,e?.eventId,e?.canonicalEventId,...(e?.sourceEventIds||[])].filter(Boolean);
const participants=e=>(e?.participantIds||[]).map(identity.canonicalParticipantId);
function approvedSourceUrl(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['www.cricket.com.au','apiv2.cricket.com.au','www.espn.in','www.espn.com','www.espncricinfo.com'].includes(url.hostname);}catch{return false;}
}
function sameFixture(a,b){
 const left=participants(a),right=participants(b),start=Date.parse(a?.startTimeUtc||'');
 return identity.sportKey(a)==='cricket'&&identity.sportKey(b)==='cricket'
  &&left.length===2&&new Set(left).size===2&&JSON.stringify(left)===JSON.stringify(right)
  &&Number.isFinite(start)&&start===Date.parse(b?.startTimeUtc||'');
}
function createResolver({sources=require('../../data/follow-sources/coverage.v1.json').events,fixtures=require('../../data/code-inspector/cricket.json').fixtures,now=new Date()}={}){
 const sourceById=new Map(),reviewedById=new Map();
 for(const source of sources){
  if(!/^competition:cricket:/.test(source.competitionId||'')||!['official','trusted-reporting'].includes(source.sourceType)
   ||!approvedSourceUrl(source.sourceUrl)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(source.sourceCheckedAt||'')
   ||!Number.isFinite(Date.parse(source.sourceCheckedAt))||new Date(source.sourceCheckedAt).toISOString().slice(0,19)!==source.sourceCheckedAt.slice(0,19)||Date.parse(source.sourceCheckedAt)>+now)continue;
  for(const id of aliases(source)){const rows=sourceById.get(id)||[];rows.push(source);sourceById.set(id,rows);}
 }
 for(const fixture of fixtures)for(const id of aliases(fixture)){const rows=reviewedById.get(id)||[];rows.push(fixture);reviewedById.set(id,rows);}
 return event=>{
  if(event.competitionId||identity.sportKey(event)!=='cricket')return event;
  // Only retained, already-published aliases qualify. Exact ordered senior
  // identities and UTC start must still agree; no name/date fuzzy matching.
  const reviews=aliases(event).flatMap(id=>reviewedById.get(id)||[]).filter(f=>sameFixture(event,f));
  let candidates=[...new Set([...aliases(event),...reviews.flatMap(aliases)].flatMap(id=>sourceById.get(id)||[]))].filter(s=>sameFixture(event,s));
  // Retain a previously published competition choice where equivalent
  // providers use different tour IDs. Never migrate a saved series follow.
  const known=[...new Set(reviews.map(f=>f.competitionId).filter(Boolean))];
  if(known.length>1)throw new Error('Ambiguous competition context for '+event.id);
  if(known.length)candidates=candidates.filter(s=>s.competitionId===known[0]);
  if(!candidates.length)return event;
  if(new Set(candidates.map(s=>s.competitionId)).size!==1)throw new Error('Ambiguous competition context for '+event.id);
  const source=candidates[0];
  return {...event,competitionId:source.competitionId,
   ...(!event.competitionName&&source.competitionName?{competitionName:source.competitionName}:{}),
   competitionProvenance:{sourceEventId:source.id,sourceUrl:source.sourceUrl,checkedAt:source.sourceCheckedAt}};
 };
}
module.exports={createResolver,sameFixture};
