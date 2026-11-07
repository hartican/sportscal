'use strict';

// Internal adapter owned by update-cards.js. No provider reads or standalone CLI.
const fs=require('node:fs');
const major=require('../../config/major-events');
const {normalizeFeed,validateFeed}=require('./feed-utils');

const APPROVED=Object.freeze({
  'major-match:rlwc-2026:tonga-samoa':Object.freeze({
    parentId:'major-event:rlwc-2026',
    competitionId:'competition:rugby-league-world-cup:2026',
    participants:['team:nrl:national:tonga','team:nrl:national:samoa'],
    sourceUrl:'https://www.intrl.sport/match-details/2578',
  }),
});

function fail(message){throw Error(`Major subevent admission: ${message}`);}
function assertFeed(document,label){
  const issues=validateFeed(document);
  if(issues.length)fail(`${label} is invalid: ${issues.join('; ')}`);
}
function identities(event){return [event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[]),...(event.legacyEventIds||[])].filter(Boolean);}
function validateObservation(value,referenceTime){
  const match=typeof value==='string'&&/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$/.exec(value);
  const reference=referenceTime instanceof Date?referenceTime.getTime():NaN;
  if(!match||!Number.isFinite(reference))fail('valid source observation and admission reference time are required');
  const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  const calendar=new Date(0);calendar.setUTCFullYear(year,month-1,day);calendar.setUTCHours(hour,minute,second,0);
  const observed=Date.parse(value);
  if(!Number.isFinite(observed)||calendar.getUTCFullYear()!==year||calendar.getUTCMonth()+1!==month||calendar.getUTCDate()!==day||calendar.getUTCHours()!==hour||calendar.getUTCMinutes()!==minute||calendar.getUTCSeconds()!==second)fail('source observation must be a real calendar instant');
  // Date has millisecond resolution. A nonzero finer fraction at that same
  // boundary is still later than the explicit reference, not rounded evidence.
  if(observed>reference||observed===reference&&/[1-9]/.test((match[7]||'').slice(3)))fail('source observation is later than the admission reference time');
}
function resolve(canonical,id,referenceTime=new Date()){
  const approval=APPROVED[id];
  if(!approval)fail(`unsupported reviewed identity ${id}`);
  const matches=(canonical.events||[]).flatMap(parent=>(parent.subEvents||[]).filter(child=>child.id===id).map(child=>({parent,child})));
  if(matches.length!==1)fail(`expected one canonical ${id}; found ${matches.length}`);
  const {parent,child}=matches[0];
  if(parent.id!==approval.parentId||parent.sportKey!=='nrl'||parent.competitionId!==approval.competitionId||parent.competitionScope!=='international'||child.competitionScope!=='international'||child.isInternational!==true)fail('canonical parent/league/competition binding differs');
  if(child.participantsConfirmed!==true||!Array.isArray(child.participantIds)||child.participantIds.length!==2||new Set(child.participantIds).size!==2||!approval.participants.every(participant=>child.participantIds.includes(participant)))fail('confirmed league participant identities differ');
  if(!Array.isArray(child.participants)||child.participants.length!==2||!approval.participants.every(id=>child.participants.some(participant=>participant.id===id&&String(participant.name||'').trim())))fail('named participant evidence is incomplete');
  const start=Date.parse(child.startTimeUtc),canonicalStart=String(child.startTimeUtc||'').replace(/(\d\d:\d\d:\d\d)Z$/,'$1.000Z');
  if(child.timePrecision!=='exact'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(child.startTimeUtc||'')||!Number.isFinite(start)||new Date(start).toISOString()!==canonicalStart)fail('exact sourced calendar start is required');
  if(!String(child.venue||'').trim()||/\b(?:tbc|unknown|multiple venues)\b/i.test(child.venue))fail('a sourced stadium is required');
  if(!String(child.stage||'').trim()||child.roundLabel!==child.stage)fail('sourced matching stage and round are required');
  if(child.sourceUrl!==approval.sourceUrl||child.sourceName!=='International Rugby League')fail('official source/observation binding differs');
  validateObservation(child.sourceCheckedAt,referenceTime);
  // This adapter admits schedule facts only, never outcomes or observed play.
  if(child.status&&!['scheduled','upcoming'].includes(child.status))fail('non-schedule state requires the existing result/evidence owner');
  if(['score','scoreDisplay','result','outcomeText','actualStartTimeUtc','livePlayObservedAt','firstConfirmedCompleteAt'].some(key=>child[key]!=null&&child[key]!==''))fail('result/play observations require their existing owner');
  return {parent,child};
}
function construct(parent,child){
  const fixture=major.fixtureFromSubEvent(child,parent);
  if(!fixture)fail('canonical subevent cannot be projected');
  // Do not inherit the catalogue's default eight, parent viewing or a synthetic
  // observation. Existing researched cards are never passed through this path.
  const card={...fixture,expected:child.expected??null,sourceCheckedAt:child.sourceCheckedAt,
    sourceType:'official',participantsConfirmed:true,sportDomainId:'sport:nrl',
    competitionScope:'international',isInternational:true,
    sourceEventIds:[...new Set([child.id,...(child.sourceEventIds||[])])],
    broadcaster:null,broadcasterIds:[],broadcastOptions:[],viewingOptions:[]};
  const normalized=normalizeFeed({events:[card]}).events[0];
  // Feed storage IDs are slugs; canonical/source identities are not. Preserve
  // both through the same normalizer used by the publisher and reviewed lookup.
  if(normalized.canonicalEventId!==child.id||!normalized.sourceEventIds.includes(child.id))fail('canonical identity was lost during Feed normalization');
  return normalized;
}
function prepare({canonical,incoming,published,ids},{referenceTime=new Date()}={}){
  if(!Array.isArray(ids)||ids.length!==1||typeof ids[0]!=='string'||ids[0]!==ids[0].trim()||!ids[0])fail('exactly one explicit reviewed identity is required');
  if(canonical?.schemaVersion!=='major-events.v1'||!Array.isArray(canonical.events))fail('invalid canonical document');
  const id=ids[0],{parent,child}=resolve(canonical,id,referenceTime);
  assertFeed(incoming,'incoming Feed');assertFeed(published,'published Feed');
  const storage=normalizeFeed({events:[{id,eventId:id,key:'nrl',cardKind:'fixture',expected:null}]}).events[0];
  const existing=[incoming,published].map(document=>document.events.filter(event=>identities(event).includes(id)||event.id===storage.id||event.eventId===storage.eventId));
  for(const rows of existing){
    if(rows.length>1)fail('duplicate existing canonical identity');
    if(rows.some(event=>!identities(event).includes(id)||event.canonicalEventId&&event.canonicalEventId!==id))fail('normalized storage identity lacks an unambiguous canonical binding');
    if(rows.some(event=>event.key!=='nrl'||event.competitionId!==parent.competitionId||!Array.isArray(event.participantIds)||event.participantIds.length!==2||!child.participantIds.every(id=>event.participantIds.includes(id))))fail('existing identity conflicts with league/competition/participants');
  }
  if(existing.every(rows=>rows.length))return {changed:false,incoming,published,added:[]};
  // A retained card owns its result, preview, holds and observations. Admission
  // never repairs or rewrites it; it only fills the missing surface.
  const retained=existing[1][0]||existing[0][0];
  const card=retained||construct(parent,child);
  const documents=[incoming,published].map((document,index)=>existing[index].length?document:{...document,events:[...document.events,card]});
  assertFeed(documents[0],'projected incoming Feed');assertFeed(documents[1],'projected published Feed');
  return {changed:true,incoming:documents[0],published:documents[1],added:[id]};
}
function writePrepared(plan){
  if(!plan.changed)return;
  // The canonical owner resolves projection codes and preflights both surfaces
  // before any writes; downstream publisher/gates retain their existing owner.
  fs.writeFileSync('feeds/incoming/events.json',JSON.stringify(plan.incoming,null,2)+'\n');
  fs.writeFileSync('data/events.json',JSON.stringify(plan.published,null,2)+'\n');
}
module.exports={prepare,resolve,construct,writePrepared};
