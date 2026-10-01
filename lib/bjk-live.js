'use strict';
const parser=require('../scripts/refresh-bjk-cup');
// Reviewed report facts can arrive through canonical hydration after the live report window has closed.
function reconcileReviewed(previous,reviewed,now){
 const official=require('./tennis-parent-completion').officialTieResult;
 const byId=new Map(reviewed.filter(f=>f.tournamentId===parser.TOURNAMENT&&official(f)&&Date.parse(f.result.checkedAt)<=+now).map(f=>[f.id,f]));
 return previous.map(prior=>{
  const known=byId.get(prior.id);
  if(!known||prior.tournamentId!==known.tournamentId||prior.bracketSlot!==known.bracketSlot)return prior;
  if(official(prior)&&Date.parse(prior.result.checkedAt)>=Date.parse(known.result.checkedAt))return prior;
  return {...prior,...known,firstConfirmedCompleteAt:prior.firstConfirmedCompleteAt||known.result.checkedAt};
 });
}
// Reuse the official report parser inside the existing live-source owner.
// Reports expose completed rubbers, not a dependable game-by-game scoreboard.
async function refresh({previous,now,fetchImpl=fetch,signal}){
 previous=reconcileReviewed(previous,require('../data/canonical/tennis-team-contests.v1.json').fixtures,now);
 const due=previous.filter(f=>f.tournamentId===parser.TOURNAMENT&&f.status!=='completed'&&Date.parse(f.startTimeUtc)<=+now+1800000&&Date.parse(f.startTimeUtc)>=+now-86400000).slice(0,2);
 if(!due.length)return previous;
 const urls=[...new Set(due.flatMap(f=>(f.rubbers||[]).map(r=>r.sourceUrl).filter(Boolean)))].slice(0,2);
 if(!urls.length)return previous;
 const documents=await Promise.all(urls.map(async url=>{const response=await fetchImpl(url,{signal:signal||AbortSignal.timeout(10000)});if(!response.ok)throw Error('BJK report unavailable');const doc=parser.article(await response.text());if(!parser.parseRubbers(doc,url,now.toISOString()).length)throw Error('BJK report has no match headings');return {doc,url,checkedAt:now.toISOString()};}));
 const updated=parser.applyArticles(JSON.parse(JSON.stringify(previous)),documents,previous);
 return updated.map(f=>{if(!due.some(d=>d.id===f.id))return f;const report=documents.find(d=>parser.parseRubbers(d.doc,d.url,d.checkedAt).some(r=>r.sides.every(s=>f.participantIds.includes(s.teamId))));if(!report)return f;return {...f,sourceUrl:report.url,sourceCheckedAt:now.toISOString(),...(f.status==='completed'?{firstConfirmedCompleteAt:f.firstConfirmedCompleteAt||now.toISOString()}:{})};});
}
module.exports={refresh,reconcileReviewed};
