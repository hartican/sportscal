'use strict';
const assert=require('node:assert/strict');
const reviewed=require('../../data/canonical/nations-finals-reviewed-2026.v1.json');
const PARENT='major-event:nations-championship-finals-2026';
const SOURCE='https://www.rugbypass.com/nations-championship/fixtures-results/';
const RFU='https://help.englandrugby.com/support/solutions/articles/103000376805-what-tickets-will-debenture-members-get-for-the-2026-nations-championship-';
const slots=[['sixth-place',6,949600,1795797600],['third-place',3,949601,1795810200],['fifth-place',5,949602,1795871400],['second-place',2,949603,1795884000],['fourth-place',4,949604,1795957800],['championship',1,949605,1795970400]];
const names={1:'First',2:'Second',3:'Third',4:'Fourth',5:'Fifth',6:'Sixth'};
function instant(value){const at=Date.parse(value);return typeof value==='string'&&Number.isFinite(at)&&new Date(at).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');}
function local(value,timeZone){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};}
function validate(review){
  assert.equal(review.schemaVersion,'reviewed-nations-finals.v1');assert.equal(review.reviewId,'nations-finals-2026-10-12');
  assert.equal(review.parentId,PARENT);assert.equal(review.competitionId,'competition:nations-championship:2026');assert.equal(review.sourceUrl,SOURCE);
  assert.equal(review.observedAt,'2026-10-11T19:48:06.159Z');assert.equal(review.sourceSha256,'8c5465652cfc26bc71b786b149f70573218d3a48af9f3dc6786b809442f731f2');
  assert.equal(review.sourceName,'RugbyPass (World Rugby) / RFU');assert.equal(review.corroboratingSources?.length,1);
  const source=review.corroboratingSources[0];assert.equal(source.url,RFU);assert.equal(source.observedAt,'2026-10-11T19:37:49.868Z');assert.equal(source.sourceSha256,'a09b052f91acaf43c524dcd60eab84a482f13773ee8326dcd96588157fc371a6');
  assert.equal(review.fixtures?.length,6,'Complete six-match final-stage review required');const seen=new Set();
  for(const row of review.fixtures){
    const expected=slots.find(([id])=>row.id===`major-match:nations-championship-2026:${id}`);
    assert(expected&&!seen.has(row.id),'Unknown or duplicate final identity');seen.add(row.id);
    assert.equal(row.northRank,expected[1]);assert.equal(row.southRank,expected[1]);assert.equal(row.publisherFixtureId,expected[2]);assert.equal(row.publishedEpochSeconds,expected[3]);
    assert(instant(row.startTimeUtc)&&Date.parse(row.startTimeUtc)===row.publishedEpochSeconds*1000,'Actual publisher epoch must establish the UTC clock');
    assert.deepEqual(local(row.startTimeUtc,'Australia/Sydney'),{date:row.sydneyDate,time:row.sydneyTime},'Publisher AEDT date and time must agree');
    assert.deepEqual(local(row.startTimeUtc,'Europe/London'),{date:row.rfuLocalDate,time:row.rfuLocalTime},'RFU local date and time must agree');
    assert(/^https:\/\/www\.world\.rugby\/beta\/en\/match\/[a-f0-9-]{36}$/.test(row.worldRugbyMatchUrl));assert.equal(row.venue,'Allianz Stadium, Twickenham');
    assert(!row.participantIds?.length&&!row.participants?.length&&!row.result&&!row.score,'This schedule review cannot assign teams or results');
  }
}
function project(document,{review=reviewed,now=new Date()}={}){
  validate(review);assert(Number.isFinite(+new Date(now)),'Valid review clock required');
  const parents=document.events.filter(e=>e.id===PARENT);assert.equal(parents.length,1,'Exactly one existing finals parent required');
  const parent=parents[0];assert.equal(parent.competitionId,review.competitionId);assert.equal(parent.subEvents?.length,6,'Retain the complete six-match identity set');
  const ids=parent.subEvents.map(e=>e.id);assert.equal(new Set(ids).size,6);assert.deepEqual([...ids].sort(),review.fixtures.map(e=>e.id).sort());
  if(Date.parse(review.observedAt)>+new Date(now))return {document,used:0,diagnostics:['Review not yet observed at this historical check']};
  const facts=new Map(review.fixtures.map(r=>[r.id,r])),diagnostics=[];let used=0;
  const subEvents=parent.subEvents.map(event=>{
    const row=facts.get(event.id);
    if(event.sourceCheckedAt!=null){
      assert(instant(event.sourceCheckedAt)&&Date.parse(event.sourceCheckedAt)<=+new Date(now),'Existing source observation must be valid and non-future');
      if(Date.parse(event.sourceCheckedAt)>Date.parse(review.observedAt)){
        diagnostics.push(`${event.id}: later primary observation retained`);return event;
      }
    }
    if(event.startTimeUtc!=null){
      assert(instant(event.startTimeUtc),'Invalid existing clock cannot activate a fallback');
      // Never let this frozen review undo a later primary schedule or result.
      diagnostics.push(`${event.id}: existing published clock retained`);return event;
    }
    if(!['scheduled','upcoming',undefined].includes(event.status)||event.result||event.scoreDisplay||event.participantIds?.length||event.participants?.some(p=>p.id)||event.participantSlots?.some(p=>p.participantId)){
      diagnostics.push(`${event.id}: later sporting facts retained`);return event;
    }
    assert.equal(event.name,`${names[row.northRank]} placed North v ${names[row.southRank]} placed South`,'Placement identity changed; review before applying');
    assert(!event.venue||event.venue===row.venue,'Conflicting venue requires review');
    used++;
    return {...event,startTimeUtc:row.startTimeUtc,timePrecision:'exact',scheduleStatus:'confirmed',participantsConfirmed:false,
      participantIds:[],participantSlots:[{slot:1,participantId:null,label:`${names[row.northRank]} placed North`},{slot:2,participantId:null,label:`${names[row.southRank]} placed South`}],
      venue:row.venue,sourceName:review.sourceName,sourceUrl:review.sourceUrl,sourceType:'official',sourceTrust:'verified',sourceCheckedAt:review.observedAt,
      timingProvenance:{kind:'reviewed-publisher-fixture',precision:'exact',reviewId:review.reviewId,sourceUrl:review.sourceUrl,observedAt:review.observedAt,sourceSha256:review.sourceSha256,publisherFixtureId:row.publisherFixtureId,worldRugbyMatchUrl:row.worldRugbyMatchUrl,northRank:row.northRank,southRank:row.southRank}};
  });
  if(!used)return {document,used,diagnostics};
  const sources=[...(parent.sources||[])];for(const source of [{name:review.sourceName,url:review.sourceUrl,checkedAt:review.observedAt},...review.corroboratingSources.map(s=>({name:s.name,url:s.url,checkedAt:s.observedAt}))])if(!sources.some(s=>s.url===source.url&&s.checkedAt===source.checkedAt))sources.push(source);
  return {document:{...document,events:document.events.map(e=>e===parent?{...parent,sources,subEvents}:e)},used,diagnostics};
}
module.exports={validate,project,local};
