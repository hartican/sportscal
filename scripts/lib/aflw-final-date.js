'use strict';
const assert=require('node:assert/strict'),review=require('../../config/reviewed-aflw-final-date.json');
const ID='event:aflw:cd_m20262641601',URL='https://www.afl.com.au/news/1596264/friday-night-lights-prime-time-stage-set-for-2026-nab-aflw-grand-final';
function validDate(value){const stamp=Date.parse(value+'T00:00:00Z');return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value;}
function validInstant(value){const stamp=Date.parse(value);return typeof value==='string'&&Number.isFinite(stamp)&&new Date(stamp).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');}
function validate(value){
 assert.equal(value.schemaVersion,'reviewed-match-date.v1');assert.equal(value.fixtureId,ID);assert.equal(value.sourceId,'CD_M20262641601');
 assert.equal(value.competitionId,'competition:aflw-2026');assert.equal(value.seasonLabel,'2026');assert.equal(value.roundLabel,'Grand Final');
 assert.equal(value.matchSourceUrl,'https://www.afl.com.au/aflw/matches/9081');assert.equal(value.sourceUrl,URL);
 assert(validDate(value.date)&&value.date==='2026-11-27','This dated review covers only the retained 27 November announcement');
 assert(validInstant(value.publishedAt)&&validInstant(value.observedAt)&&value.publishedAt<=value.observedAt,'Valid original announcement and observation timestamps required');
 assert(/^[a-f0-9]{64}$/.test(value.sourceSha256||''),'Retained actual source digest required');
 assert(typeof value.sourceName==='string'&&value.sourceName.trim());assert(typeof value.scheduleNote==='string'&&value.scheduleNote.trim());
}
function apply(event,now=new Date(),value=review){
 validate(value);if(event.id!==ID)return {event,used:false};
 assert.equal(event.sourceId,value.sourceId);assert.equal(event.competitionId,value.competitionId);assert.equal(event.seasonLabel,value.seasonLabel);assert.equal(event.roundLabel,value.roundLabel);
 assert.equal(event.source?.provider,'AFLW');assert.equal(event.source?.sourceUrl,value.matchSourceUrl);
 assert(Number.isFinite(+new Date(now)),'Review clock must be valid');
 if(+new Date(value.observedAt)>+new Date(now))return {event,used:false,diagnostic:'Announcement was not observed by this historical check'};
 if(!['scheduled','upcoming'].includes(event.status)||event.result)return {event,used:false};
 const stamp=event.startTimeUtc;
 if(stamp!=null){assert(validInstant(stamp),'Invalid primary clock must fail, not activate date fallback');return {event,used:false,diagnostic:'Primary match clock retained'};}
 if(event.date&&!validDate(event.date))throw Error('Invalid primary date must fail, not activate date fallback');
 if(event.date&&event.date!==value.date)return {event,used:false,diagnostic:'Primary date differs; retained without announcement override'};
 if(event.timingProvenance&&event.timingProvenance.sourceUrl!==URL)return {event,used:false,diagnostic:'Other primary timing evidence retained'};
 const next={...event,date:value.date,dateOnly:true,timePrecision:'date-only',time:null,startTimeUtc:null,timeTbc:true,startTimeTbc:true,scheduleStatus:'tbc',scheduleNote:value.scheduleNote,
  timingProvenance:{precision:'date-only',kind:'official-announcement',sourceUrl:value.sourceUrl,sourceName:value.sourceName,publishedAt:value.publishedAt,observedAt:value.observedAt,sourceDate:value.date,sourceSha256:value.sourceSha256}};
 return {event:next,used:true};
}
function project(bundle,now=new Date(),value=review){
 validate(value);const finals=bundle.events.filter(e=>e.competitionId===value.competitionId&&e.roundLabel===value.roundLabel);
 assert.equal(finals.length,1,'One existing official Grand Final must match uniquely');assert.equal(finals[0].id,ID,'Existing final identity must be retained');
 const decisions=bundle.events.map(e=>apply(e,now,value)),events=decisions.map(d=>d.event);
 return {bundle:{...bundle,events},used:decisions.filter(d=>d.used).length,diagnostics:decisions.map(d=>d.diagnostic).filter(Boolean)};
}
module.exports={apply,project,validate};
