'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const review=require('../../data/canonical/surf-calendar-note-review.v1.json');
const ids=['calendar-nothingsport-manual-seed-big-wave-nazare-2026','calendar-nothingsport-manual-seed-big-wave-pipe-masters-2026'];
function validate(document){
 assert(document?.schemaVersion==='surf-calendar-note-review.v1'&&document.reviewId==='surf-seeds-2026-10-05','Invalid retained Surf note review');
 assert(document.events?.length===2,'Both retained Surf notes required');const rows=new Map();
 for(const row of document.events){
  assert(ids.includes(row.id)&&!rows.has(row.id),'Unknown or duplicate Surf note identity');
  assert(/^2026-10-04T/.test(row.observedAt)&&new Date(row.observedAt).toISOString()===row.observedAt&&Date.parse(row.observedAt)<=Date.now(),'Original non-future organiser observation required');
  assert(row.sourceUrl===(row.id===ids[0]?'https://www.worldsurfleague.com/events/2027/bwt?all=1':'https://www.worldsurfleague.com/events/2026/ct?all=1'),'Exact reviewed organiser edition required');
  assert(['response-received','request-start'].includes(row.observationBasis),'Observation semantics required');
  assert(row.name&&row.name.length<=80&&row.hook&&row.hook.length<=180&&row.hook.split(/\s+/).length<=25&&row.detail?.length<=700,'Bounded user-facing note required');
  assert(!row.date&&!row.time&&!row.startTimeUtc&&!row.schedulingWindow,'A review cannot invent a coming event window');
  if(row.relatedEventId)assert(row.id===ids[1]&&row.relatedEventId==='event:wsl:2026:pipe-masters','Unreviewed related identity');
  rows.set(row.id,row);
 }return rows;
}
const rows=validate(review),clockKeys=['date','endDate','time','startDate','startTimeUtc','endTimeUtc','estimatedStartTimeUtc','timelineSortTimeUtc','sessionStartTimeUtc','notBeforeTimeUtc','actualStartTimeUtc','actualEndTimeUtc'];
function isUnconfirmedNote(event){
 const row=rows.get(event.id),note=event.calendarNote;
 return !!(row&&event.key==='big-wave'&&event.cardKind==='calendar-note'&&event.sourceType==='personal-calendar'&&event.sourceTrust==='unverified'
  &&event.dateStatus==='tbc'&&event.timePrecision==='unknown'&&event.scheduleStatus==='tbc'&&event.status==='upcoming'&&event.timeTbc===true&&event.startTimeTbc===true
  &&clockKeys.every(k=>event[k]==null||event[k]==='')&&!event.schedulingWindow&&!event.dateOnly&&event.expected===null
  &&['participantIds','participantSlots','participants','viewingOptions','broadcastOptions','broadcasts','broadcasterIds','consensusTags'].every(k=>!event[k]?.length)
  &&!event.competitionId&&!event.score&&!event.result&&!event.outcomeText&&!event.recapText
  &&event.broadcaster==='Australian viewing unconfirmed'&&event.sourceUrl===`calendar://nothingsport-manual-seed/${row.id.split('manual-seed-')[1]}`
  &&(!event.canonicalEventId||event.canonicalEventId===row.id)&&(!event.eventId||event.eventId===row.id)
  &&(!event.sourceEventIds||event.sourceEventIds.every(id=>id===row.id))&&event.sourceCheckedAt===event.importedSeedFacts?.sourceCheckedAt&&Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now()
  &&note?.reviewId===review.reviewId&&note.state==='unconfirmed'&&note.identityStatus==='unresolved'&&note.observedAt===row.observedAt&&note.sourceUrl===row.sourceUrl&&note.observationBasis===row.observationBasis);
}
function qualify(event){
 const row=rows.get(event.id);if(!row)return event;
 // Never use an old import review to undo subsequently sourced sporting facts.
 if(event.sourceTrust==='verified'&&['official','broadcaster','explicitly-permitted'].includes(event.sourceType)){
  assert(/^https:\/\//.test(event.sourceUrl||'')&&Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now(),'Verified Surf recovery needs an actual non-future source observation');return event;
 }
 if(['live','ongoing','in_progress','completed','finished','final','cancelled','canceled','postponed','abandoned','suspended'].includes(event.status)||['cancelled','canceled','postponed','abandoned','suspended'].includes(event.scheduleStatus))return event;
 if(event.calendarNote)assert(isUnconfirmedNote(event),'Invalid retained unconfirmed Surf note');
 else assert(event.key==='big-wave'&&event.sourceType==='personal-calendar'&&event.sourceTrust==='unverified'&&event.name===row.originalName&&event.date===row.originalDate&&event.time===row.originalTime&&event.startTimeUtc===row.originalStart,'Surf seed changed; identity/timing review required before correction');
 assert(!event.competitionId&&!event.participantIds?.length&&!event.participantSlots?.length&&!event.score&&!event.result,'Surf seed acquired sporting facts; preserve for review');
 const importedSeedFacts=event.importedSeedFacts||Object.fromEntries(['name',...clockKeys,'broadcaster','broadcastOptions','expected','round','narrativeType','selectedSentence','fullSpiel','sourceName','sourceCheckedAt','statusCheckedAt','lastReviewedAt'].filter(k=>event[k]!=null).map(k=>[k,event[k]]));
 const next={...event,name:row.name,displayTitleCompact:row.name,dateStatus:'tbc',timePrecision:'unknown',schedulePrecision:'unknown',scheduleStatus:'tbc',timeTbc:true,startTimeTbc:true,dateOnly:false,cardKind:'calendar-note',displayDateLabel:'Dates TBC',broadcaster:'Australian viewing unconfirmed',broadcastOptions:[],broadcasterIds:[],broadcasts:[],viewingOptions:[],expected:null,round:'all',narrativeType:'all',consensusTags:[],participantsConfirmed:false,resultCoverage:'unconfirmed-calendar-note',replayEligible:false,highlightEligible:false,briefingEligible:false,catchupEligible:false,selectedSentence:row.hook,fullSpiel:row.detail,sourceName:'Saved calendar note',importedSeedFacts,
  calendarNote:{reviewId:review.reviewId,state:'unconfirmed',identityStatus:'unresolved',sourceUrl:row.sourceUrl,observedAt:row.observedAt,observationBasis:row.observationBasis,...(row.relatedEventId?{relatedEventId:row.relatedEventId}:{})}};
 for(const key of clockKeys)next[key]=event.calendarNote&&event[key]===''?'':null;
 next.schedulingWindow=null;for(const key of ['storyline','editorialPreview','editorialNarrative','editorialReplayRecommendation'])delete next[key];
 // Original import/fact dates remain original; organiser review is a separate observation.
 assert(isUnconfirmedNote(next),'Surf note qualification failed');return next;
}
function applyRetained({root=path.resolve(__dirname,'../..')}={}){
 const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
  const filename=path.join(root,file),before=fs.readFileSync(filename,'utf8'),document=JSON.parse(before);
  for(const id of ids)assert.equal(document.events.filter(e=>e.id===id).length,1,`${file}: exactly one retained Surf identity required`);
  const events=document.events.map(qualify);return {filename,file,before,next:JSON.stringify({...document,events},null,2)+'\n',changed:events.filter((e,i)=>JSON.stringify(e)!==JSON.stringify(document.events[i])).map(e=>e.id)};
 });
 // Validate both persistent surfaces before writing either one.
 for(const update of updates)if(update.changed.length)fs.writeFileSync(update.filename,update.next);
 return updates.map(({file,changed})=>({file,changed}));
}
if(require.main===module)try{console.log(JSON.stringify(applyRetained()));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={qualify,applyRetained,isUnconfirmedNote,validate,ids};
