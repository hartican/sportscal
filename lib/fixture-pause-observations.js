'use strict';
const assert=require('node:assert/strict');
const {instant,SCORE_FIELDS}=require('./compact-fixture-observations'),{pauseReason}=require('../config/card-timing');
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
const terminal=e=>/^(completed|finished|final|abandoned)$/.test(e?.status||'');
const pauseKey=e=>{const label=pauseReason(e);return label?String(e.score?.racing?.statusText||e.statusText||label).trim().toLowerCase():null;};
// A reason's first verified source receipt is evidence, not its actual onset.
// Persist it in the existing leased fixture JSON; never renew it on a recheck.
function pauseObservations(fixtures,{previous=[],observedFixtures=[],receipts={},now=new Date()}={}){
 const index=entries=>{const result=new Map();for(const e of entries)for(const id of aliases(e)){assert(!result.has(id)||result.get(id)===e,'Ambiguous pause observation');result.set(id,e);}return result;};
 const old=index(previous),current=index(observedFixtures.filter(e=>e&&typeof e==='object'&&!Array.isArray(e)));
 const match=(e,map)=>{const matches=[...new Set(aliases(e).map(id=>map.get(id)).filter(Boolean))];assert(matches.length<=1,'Ambiguous pause identity');return matches[0];};
 const rejectedStatusIds=[];
 const retainedFixtures=fixtures.map(e=>{
  const prior=match(e,old),source=match(e,current);
  if(!source)return prior?.pauseObservation?{...e,pauseObservation:prior.pauseObservation}:e;
  if(!pauseReason(e)&&!pauseReason(prior||{})&&!prior?.pauseObservation)return e;
  const checked=instant(source.statusCheckedAt||source.sourceCheckedAt||source.canonicalSourceCheckedAt,now);
  const priorChecked=instant(aliases(prior||{}).map(id=>receipts[id]?.t).find(Boolean)||prior?.statusCheckedAt||prior?.sourceCheckedAt||prior?.canonicalSourceCheckedAt,now);
  const reason=pauseKey(source),oldReason=pauseKey(prior||{});
  const accepted=source.sourceStale!==true&&source.status===e.status&&reason===pauseKey(e)&&checked&&Date.parse(checked)<=+now&&(!priorChecked||Date.parse(checked)>Date.parse(priorChecked)||checked===priorChecked&&source.status===prior?.status&&reason===oldReason)&&!(terminal(prior)&&!terminal(source));
  if(!accepted){
   rejectedStatusIds.push(String(e.id||e.eventId||e.canonicalEventId));
   const retained={...e,...(pauseReason(e)||prior?.pauseObservation?{pauseObservation:prior?.pauseObservation||null}:{})};
   if(prior&&priorChecked)for(const key of ['status','statusText','statusCheckedAt','restartTimeUtc','restartSourceUrl','restartSourceCheckedAt']){if(prior[key]!==undefined)retained[key]=prior[key];else delete retained[key];}
   if(terminal(prior)&&!terminal(source))for(const key of SCORE_FIELDS){if(prior[key]!==undefined)retained[key]=prior[key];else delete retained[key];}
   return retained;
  }
  const fact=prior?.pauseObservation,at=instant(fact?.observedAt,now);
  const unchanged=reason&&fact?.status===source.status&&fact.reason===reason&&at&&Date.parse(at)<=Date.parse(checked);
  return {...e,...(reason?{pauseObservation:unchanged?fact:{status:source.status,reason,observedAt:checked}}:fact?{pauseObservation:null}:{})};
 });
 return {fixtures:retainedFixtures,rejectedStatusIds};
}
module.exports={pauseObservations};
