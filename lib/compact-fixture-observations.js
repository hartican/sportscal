'use strict';
const assert=require('node:assert/strict');
const SCORE_FIELDS=['homeScore','awayScore','scoreDisplay','score','sets','games','innings','rubbers','canonicalResultScoreline'];
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
const present=e=>SCORE_FIELDS.filter(k=>e[k]!=null&&e[k]!==''&&(!Array.isArray(e[k])||e[k].length));
function instant(value,now){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const stamp=Date.parse(value);return Number.isFinite(stamp)&&stamp<=+now+300000?new Date(stamp).toISOString():null;
}
function split(fixtures,{observedFixtures=fixtures,now=new Date()}={}){
  assert(Array.isArray(fixtures)&&fixtures.length<=5000,'Compact fixture observation budget exceeded');
  const index=new Map();
  assert(Array.isArray(observedFixtures)&&observedFixtures.length<=5000,'Source observation budget exceeded');
  for(const e of observedFixtures.filter(e=>e&&typeof e==='object'&&!Array.isArray(e)))for(const id of aliases(e)){const prior=index.get(id);assert(!prior||prior===e,'Ambiguous source observation identity');index.set(id,e);}
  return {fixtures:fixtures.map(e=>Object.fromEntries(Object.entries(e).filter(([k])=>!SCORE_FIELDS.includes(k)))),scores:fixtures.map(e=>{
    const matches=[...new Set(aliases(e).map(id=>index.get(id)).filter(Boolean))];assert(matches.length<=1,'Ambiguous source observation');
    const observed=matches[0],keys=observed?present(observed):[];
    const paired=!keys.some(k=>k==='homeScore'||k==='awayScore')||keys.includes('homeScore')&&keys.includes('awayScore');
    const scoreObserved=paired&&keys.length>0&&keys.every(k=>JSON.stringify(observed[k])===JSON.stringify(e[k]));
    const statusObserved=observed?.status&&observed.status===e.status;
    const checked=observed&&(observed.sourceCheckedAt||observed.canonicalSourceCheckedAt);
    const scoreAt=scoreObserved?instant(observed.scoreCheckedAt||checked,now):null;
    const statusAt=statusObserved?instant(observed.statusCheckedAt||checked,now):null;
    return {id:String(e.id||e.eventId||e.canonicalEventId),status:e.status,...Object.fromEntries((scoreObserved?keys:SCORE_FIELDS.filter(k=>e[k]!=null)).map(k=>[k,e[k]])),observationSchema:'fixture-observations.v1',scoreObserved:Boolean(scoreAt),statusObserved:Boolean(statusAt),...(scoreAt?{scoreCheckedAt:scoreAt}:{}),...(statusAt?{statusCheckedAt:statusAt}:{})};
  })};
}
function publicReport(report){if(!report)return null;const {_fixtureObservations,...publicFields}=report;return Object.keys(publicFields).length?publicFields:null;}
module.exports={split,SCORE_FIELDS,instant,publicReport};
