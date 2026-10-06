'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const review=require('../../data/canonical/surf-calendar-note-review.v1.json');
const manualReview=require('../../data/canonical/manual-calendar-note-review.v1.json');
const prefix='calendar-nothingsport-manual-seed-';
const surfIds=['big-wave-nazare-2026','big-wave-pipe-masters-2026'].map(id=>prefix+id);
const manualIds=['goodwood-festival-of-speed-2027','uci-downhill-mtb-world-cup-2026'].map(id=>prefix+id);
const ids=[...surfIds,...manualIds];
const rules=new Map([
 [surfIds[0],{key:'big-wave',state:'unconfirmed',identityStatus:'unresolved',sourceUrl:'https://www.worldsurfleague.com/events/2027/bwt?all=1'}],
 [surfIds[1],{key:'big-wave',state:'unconfirmed',identityStatus:'unresolved',sourceUrl:'https://www.worldsurfleague.com/events/2026/ct?all=1'}],
 [manualIds[0],{key:'goodwood',state:'calendar-window',identityStatus:'confirmed-calendar',sourceUrl:'https://www.goodwood.com/grr/event-coverage/festival-of-speed/2027-fos-dates-revealed/'}],
 [manualIds[1],{key:'downhill-mtb',state:'unconfirmed',identityStatus:'unmatched',sourceUrl:'https://www.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-2026-calendar-unveiled'}]
]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function validate(document){
 const surf=document?.schemaVersion==='surf-calendar-note-review.v1';
 assert(surf?document.reviewId==='surf-seeds-2026-10-05':document?.schemaVersion==='manual-calendar-note-review.v1'&&document.reviewId==='manual-seeds-2026-10-05','Unknown dated calendar-note review');
 const expected=surf?surfIds:manualIds;assert(document.events?.length===expected.length,'Complete reviewed identity set required');const rows=new Map();
 for(const row of document.events){
  assert(expected.includes(row.id)&&!rows.has(row.id),'Unknown or duplicate calendar note');const rule=rules.get(row.id);
  assert(/^2026-10-04T/.test(row.observedAt)&&new Date(row.observedAt).toISOString()===row.observedAt&&Date.parse(row.observedAt)<=Date.now(),'Original non-future organiser receipt required');
  assert(row.sourceUrl===rule.sourceUrl,'Exact reviewed organiser edition required');
  assert(['response-received','request-start'].includes(row.observationBasis),'Observation semantics required');
  assert(row.name&&row.name.length<=80&&row.hook&&row.hook.length<=180&&row.hook.split(/\s+/).length<=25&&row.detail?.length<=700,'Bounded user-facing context required');
  assert(!row.date&&!row.time&&!row.startTimeUtc&&!row.schedulingWindow,'Calendar context cannot create an exact fixture clock');
  if(row.id===manualIds[0])assert(same(row.localDateWindow,{from:'2027-07-15',through:'2027-07-18',timeZone:'Europe/London'})&&row.localDateLabel==='15–18 July 2027 · UK dates','Exact reviewed Goodwood local window required');
  else assert(!row.localDateWindow&&!row.localDateLabel,'Unmatched identities cannot acquire a window');
  if(row.relatedEventId)assert(row.id===surfIds[1]&&row.relatedEventId==='event:wsl:2026:pipe-masters','Unreviewed related identity');
  rows.set(row.id,{...row,...rule,reviewId:document.reviewId});
 }return rows;
}
const rows=new Map([...validate(review),...validate(manualReview)]),clockKeys=['date','endDate','time','startDate','startTimeUtc','endTimeUtc','estimatedStartTimeUtc','timelineSortTimeUtc','sessionStartTimeUtc','notBeforeTimeUtc','actualStartTimeUtc','actualEndTimeUtc'];
function isReviewedNote(event){
 const row=rows.get(event.id),note=event.calendarNote;
 return !!(row&&event.key===row.key&&event.cardKind==='calendar-note'&&event.sourceType==='personal-calendar'&&event.sourceTrust==='unverified'
  &&event.dateStatus==='tbc'&&event.timePrecision==='unknown'&&event.scheduleStatus==='tbc'&&event.status==='upcoming'&&event.timeTbc===true&&event.startTimeTbc===true
  &&clockKeys.every(k=>event[k]==null||event[k]==='')&&!event.schedulingWindow&&!event.dateOnly&&event.expected===null
  &&['participantIds','participantSlots','participants','viewingOptions','broadcastOptions','broadcasts','broadcasterIds','consensusTags'].every(k=>!event[k]?.length)
  &&!event.competitionId&&!event.score&&!event.result&&!event.outcomeText&&!event.recapText
  &&event.broadcaster==='Australian viewing unconfirmed'&&event.sourceUrl===`calendar://nothingsport-manual-seed/${row.id.split('manual-seed-')[1]}`
  &&(!event.canonicalEventId||event.canonicalEventId===row.id)&&(!event.eventId||event.eventId===row.id)
  &&(!event.sourceEventIds||event.sourceEventIds.every(id=>id===row.id))&&event.sourceCheckedAt===event.importedSeedFacts?.sourceCheckedAt&&Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now()
  &&note?.reviewId===row.reviewId&&note.state===row.state&&note.identityStatus===row.identityStatus&&note.observedAt===row.observedAt&&note.sourceUrl===row.sourceUrl&&note.observationBasis===row.observationBasis&&same(note.localDateWindow,row.localDateWindow)&&note.localDateLabel===row.localDateLabel&&(row.identityStatus!=='unmatched'||event.venue==null));
}
function qualify(event){
 const row=rows.get(event.id);if(!row)return event;
 // Never use an old import review to undo subsequently sourced sporting facts.
 if(event.sourceTrust==='verified'&&['official','broadcaster','explicitly-permitted'].includes(event.sourceType)){
  assert(/^https:\/\//.test(event.sourceUrl||'')&&Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now(),'Verified calendar recovery needs an actual non-future source observation');return event;
 }
 if(['live','ongoing','in_progress','completed','finished','final','cancelled','canceled','postponed','abandoned','suspended'].includes(event.status)||['cancelled','canceled','postponed','abandoned','suspended'].includes(event.scheduleStatus))return event;
 if(event.calendarNote)assert(isReviewedNote(event),'Invalid retained unconfirmed calendar note');
 else assert(event.key===row.key&&event.sourceType==='personal-calendar'&&event.sourceTrust==='unverified'&&event.name===row.originalName&&event.date===row.originalDate&&event.time===row.originalTime&&event.startTimeUtc===row.originalStart,'calendar seed changed; identity/timing review required before correction');
 assert(!event.competitionId&&!event.participantIds?.length&&!event.participantSlots?.length&&!event.score&&!event.result,'calendar seed acquired sporting facts; preserve for review');
 const importedSeedFacts=event.importedSeedFacts||Object.fromEntries(['name',...clockKeys,'venue','broadcaster','broadcastOptions','expected','round','narrativeType','selectedSentence','fullSpiel','sourceName','sourceCheckedAt','statusCheckedAt','lastReviewedAt'].filter(k=>event[k]!=null).map(k=>[k,event[k]]));
 const next={...event,name:row.name,displayTitleCompact:row.name,dateStatus:'tbc',timePrecision:'unknown',schedulePrecision:'unknown',scheduleStatus:'tbc',timeTbc:true,startTimeTbc:true,dateOnly:false,cardKind:'calendar-note',displayDateLabel:row.localDateLabel||'Dates TBC',broadcaster:'Australian viewing unconfirmed',broadcastOptions:[],broadcasterIds:[],broadcasts:[],viewingOptions:[],expected:null,round:'all',narrativeType:'all',consensusTags:[],participantsConfirmed:false,resultCoverage:'unconfirmed-calendar-note',replayEligible:false,highlightEligible:false,briefingEligible:false,catchupEligible:false,selectedSentence:row.hook,fullSpiel:row.detail,sourceName:'Saved calendar note',importedSeedFacts,
  calendarNote:{reviewId:row.reviewId,state:row.state,identityStatus:row.identityStatus,sourceUrl:row.sourceUrl,observedAt:row.observedAt,observationBasis:row.observationBasis,...(row.relatedEventId?{relatedEventId:row.relatedEventId}:{}),...(row.localDateWindow?{localDateWindow:row.localDateWindow,localDateLabel:row.localDateLabel}:{})}};
 if(row.identityStatus==='unmatched')next.venue=null;
 for(const key of clockKeys)next[key]=event.calendarNote&&event[key]===''?'':null;
 next.schedulingWindow=null;for(const key of ['storyline','editorialPreview','editorialNarrative','editorialReplayRecommendation'])delete next[key];
 // Original import/fact dates remain original; organiser review is a separate observation.
 assert(isReviewedNote(next),'calendar note qualification failed');return next;
}
function applyRetained({root=path.resolve(__dirname,'../..'),selectedIds=ids}={}){
 assert(selectedIds.length&&new Set(selectedIds).size===selectedIds.length&&selectedIds.every(id=>ids.includes(id)),'Unknown/duplicate review selection');const selected=new Set(selectedIds);
 const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
  const filename=path.join(root,file),before=fs.readFileSync(filename,'utf8'),document=JSON.parse(before);
  for(const id of selected)assert.equal(document.events.filter(e=>e.id===id).length,1,`${file}: exactly one retained Surf identity required`);
  const events=document.events.map(event=>selected.has(event.id)?qualify(event):event);return {filename,file,before,next:JSON.stringify({...document,events},null,2)+'\n',changed:events.filter((e,i)=>JSON.stringify(e)!==JSON.stringify(document.events[i])).map(e=>e.id)};
 });
 // Validate both persistent surfaces before writing either one.
 for(const update of updates)if(update.changed.length)fs.writeFileSync(update.filename,update.next);
 return updates.map(({file,changed})=>({file,changed}));
}
if(require.main===module)try{console.log(JSON.stringify(applyRetained()));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={qualify,applyRetained,isReviewedNote,isUnconfirmedNote:isReviewedNote,validate,ids,surfIds,manualIds};
