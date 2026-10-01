'use strict';
// Completion of a published Final 8 requires the entire bracket, not elapsed time or a partial draw.
function completeFinalEight(parent){
 if(parent.tour!=='TEAM')return parent;
 const ties=parent.childContests||[],slots=['qf1','qf2','qf3','qf4','sf1','sf2','final'];
 if(ties.length!==slots.length||new Set(ties.map(t=>t.id)).size!==slots.length||!slots.every(slot=>ties.filter(t=>t.bracketSlot===slot).length===1))return parent;
 if(ties.some(t=>t.contestUnit!=='tie'||t.status!=='completed'||t.result?.status!=='official'||!t.result?.score||!/^https:\/\//.test(t.result.sourceUrl||'')||!Number.isFinite(Date.parse(t.result.checkedAt))||!(t.participantIds||[]).includes(t.winnerParticipantId)))return parent;
 const checkedAt=ties.map(t=>t.result.checkedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
 return {...parent,status:'completed',dateLabel:[parent.date,parent.endDate!==parent.date?parent.endDate:null].filter(Boolean).join(' – ')+' · Completed',statusEvidence:{kind:'completed-final-eight',fixtureIds:ties.map(t=>t.id),sourceUrls:[...new Set(ties.map(t=>t.result.sourceUrl))],checkedAt}};
}
module.exports={completeFinalEight};
