'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const registry=require('../data/canonical/epl-provider-identities.v1.json');
const COMPETITION='competition:premier-league-2026-27',SEASON='2026/27';
const team=id=>'team:football:epl:'+id;
function record(tuple){const [primary,secondary,home,away]=tuple;return {
 primaryId:'epl-2026-27-'+primary,canonicalId:'event:premier-league:'+primary,
 secondaryId:'football-premier-league-2026-27-'+secondary,secondaryCanonicalId:'event:football:premier-league:'+secondary,
 participantIds:[team(home),team(away)],
};}
function validate(value){
 assert(value?.schemaVersion==='epl-provider-identities.v1'&&value.competitionId===COMPETITION&&value.season===SEASON,'EPL provider identity review has the wrong scope');
 assert(Array.isArray(value.fixtures)&&value.fixtures.length===380,'EPL provider identity review must contain the complete 380-fixture season');
 assert(Number.isFinite(Date.parse(value.secondaryObservedAt)),'EPL retained secondary observation is missing');
 const primary=new Set(),secondary=new Set(),pairs=new Set(),clubs=new Set();
 for(const row of value.fixtures){
  assert(Array.isArray(row)&&row.length===4&&row.every(n=>Number.isSafeInteger(n)&&n>0),'EPL provider identities must use four positive source/club integers');
  const [p,s,h,a]=row;assert(h!==a&&!primary.has(p)&&!secondary.has(s)&&!pairs.has(h+'|'+a),'EPL provider identity review contains a duplicate or invalid directed fixture');
  primary.add(p);secondary.add(s);pairs.add(h+'|'+a);clubs.add(h);clubs.add(a);
 }
 assert.equal(clubs.size,20,'EPL provider identity review must bind the same complete twenty-club season');
 const primaryDigest=crypto.createHash('md5').update(value.fixtures.slice().sort((a,b)=>a[0]-b[0]).map(row=>{const r=record(row);return [r.primaryId,COMPETITION,SEASON,...r.participantIds].join(':');}).join('|')).digest('hex');
 const secondaryDigest=crypto.createHash('sha256').update(value.fixtures.slice().sort((a,b)=>a[1]-b[1]).map(row=>[row[1],team(row[2]),team(row[3])].join(':')).join('|')).digest('hex');
 assert.equal(primaryDigest,value.primaryIdentityDigest,'EPL primary identities differ from the complete reviewed capture');
 assert.equal(secondaryDigest,value.secondaryIdentityDigest,'EPL secondary identities differ from the complete reviewed export');
 return value.fixtures.map(record);
}
const records=validate(registry),byId=new Map();
for(const r of records)for(const id of [r.primaryId,r.canonicalId,r.secondaryId,r.secondaryCanonicalId])byId.set(id,r);
function binding(event){
 if(!event||event.competitionId!==COMPETITION||event.season!=null&&event.season!==SEASON)return null;
 const domain=event.sportDomainId||event.key||event.sportKey;
 if(domain&&!['sport:football','football','premier-league'].includes(domain))return null;
 const ids=[event.id,event.eventId,event.canonicalEventId].filter(id=>typeof id==='string'),matches=[...new Set(ids.map(id=>byId.get(id)).filter(Boolean))];
 if(matches.length!==1)return null;
 const r=matches[0],sides=event.homeParticipantId&&event.awayParticipantId?[event.homeParticipantId,event.awayParticipantId]:event.participantIds;
 if(!Array.isArray(sides)||sides.length!==2||sides.some((id,i)=>id!==r.participantIds[i]))return null;
 if(Array.isArray(event.participantIds)&&(event.participantIds.length!==2||event.participantIds.some((id,i)=>id!==r.participantIds[i])))return null;
 return {record:r,primary:ids.some(id=>id===r.primaryId||id===r.canonicalId)};
}
function aliasesForId(id){const r=byId.get(id);return r?[r.primaryId,r.canonicalId,r.secondaryId,r.secondaryCanonicalId]:[id].filter(Boolean);}
function canonicalEventId(id){return byId.get(id)?.canonicalId||id;}
function withAliases(event){
 const bound=binding(event);if(!bound?.primary)return event;
 assert(event.sourceEventIds==null||Array.isArray(event.sourceEventIds),'EPL source aliases must be a list');
 const aliases=[...new Set([...(event.sourceEventIds||[]),event.id,event.eventId,event.canonicalEventId,...aliasesForId(bound.record.canonicalId)].filter(Boolean))];
 return JSON.stringify(aliases)===JSON.stringify(event.sourceEventIds)?event:{...event,sourceEventIds:aliases};
}
function reconcileSources(base,updates){
 const primary=new Set([...base,...updates].map(binding).filter(b=>b?.primary).map(b=>b.record));
 // This review retires the retained old calendar, not a new score/status feed.
 // A later or unreadable sporting receipt needs its own source reconciliation.
 const priorSecondary=event=>['sourceCheckedAt','canonicalSourceCheckedAt','statusCheckedAt','scoreCheckedAt','statusFactObservedAt','scoreFactObservedAt','resultSourceCheckedAt'].every(key=>!event[key]||Number.isFinite(Date.parse(event[key]))&&Date.parse(event[key])<=Date.parse(registry.secondaryObservedAt));
 const project=events=>events.filter(event=>{const b=binding(event);return !b||b.primary||!primary.has(b.record)||!priorSecondary(event);}).map(withAliases);
 return {base:project(base),updates:project(updates)};
}
function reconcile(events){return reconcileSources(events,[]).base;}
function validatePrimaryCollection(events){
 const selected=events.filter(e=>e.competitionId===COMPETITION),seen=new Set();
 assert.equal(selected.length,380,'EPL primary collection must remain complete before identity projection');
 for(const event of selected){const b=binding(event);assert(b?.primary&&!seen.has(b.record),'EPL primary collection has an unknown, ambiguous or repeated fixture binding');seen.add(b.record);}
 assert.equal(seen.size,380);return selected;
}
module.exports={COMPETITION,SEASON,validate,binding,aliasesForId,canonicalEventId,withAliases,reconcile,reconcileSources,validatePrimaryCollection};
