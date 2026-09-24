'use strict';
const parser=require('../scripts/refresh-bjk-cup');
// Reuse the official report parser inside the existing live-source owner.
// Reports expose completed rubbers, not a dependable game-by-game scoreboard.
async function refresh({previous,now,fetchImpl=fetch,signal}){
 const due=previous.filter(f=>f.tournamentId===parser.TOURNAMENT&&f.status!=='completed'&&Date.parse(f.startTimeUtc)<=+now+1800000&&Date.parse(f.startTimeUtc)>=+now-86400000).slice(0,2);
 if(!due.length)return previous;
 const urls=[...new Set(due.flatMap(f=>(f.rubbers||[]).map(r=>r.sourceUrl).filter(Boolean)))].slice(0,2);
 if(!urls.length)return previous;
 const documents=await Promise.all(urls.map(async url=>{const response=await fetchImpl(url,{signal:signal||AbortSignal.timeout(10000)});if(!response.ok)throw Error('BJK report unavailable');const doc=parser.article(await response.text());if(!parser.parseRubbers(doc,url,now.toISOString()).length)throw Error('BJK report has no match headings');return {doc,url,checkedAt:now.toISOString()};}));
 const updated=parser.applyArticles(JSON.parse(JSON.stringify(previous)),documents,previous);
 return updated.map(f=>{if(!due.some(d=>d.id===f.id))return f;const report=documents.find(d=>parser.parseRubbers(d.doc,d.url,d.checkedAt).some(r=>r.sides.every(s=>f.participantIds.includes(s.teamId))));if(!report)return f;return {...f,sourceUrl:report.url,sourceCheckedAt:now.toISOString(),...(f.status==='completed'?{firstConfirmedCompleteAt:f.firstConfirmedCompleteAt||now.toISOString()}:{})};});
}
module.exports={refresh};
