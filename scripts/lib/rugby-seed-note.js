'use strict';
const assert=require('node:assert/strict');
const review=require('../../data/canonical/rugby-seed-note-review.v1.json');
const clockKeys=['date','endDate','time','startDate','startTimeUtc','endTimeUtc','estimatedStartTimeUtc','timelineSortTimeUtc','sessionStartTimeUtc','notBeforeTimeUtc','actualStartTimeUtc','actualEndTimeUtc'];
const arrays=['participantIds','participantSlots','participants','participantCountryCodes','viewingOptions','broadcastOptions','broadcasts','broadcasterIds','consensusTags'];
function validate(value=review){
 assert.equal(value.schemaVersion,'reviewed-rugby-seed-note.v1');assert.equal(value.reviewId,'rugby-seed-2026-10-12');assert.equal(value.id,'evt_100');
 assert.equal(value.originalName,'Australia v Ireland (Nov tour)');assert.equal(value.originalDate,'2026-11-28');assert.equal(value.originalTime,'00:00');
 assert.equal(value.originalSourceUrl,'https://github.com/hartican/sportscal');assert.equal(value.originalSourceCheckedAt,'2026-07-10T08:30:00+10:00');
 assert.equal(value.sourceUrl,'https://www.rugby.com.au/news/2026-nations-rugby-championship-fixtures-schedule-how-to-watch-international-rugby-wallabies-fixtures-2026-2026630');
 assert.equal(value.observedAt,'2026-10-11T20:45:56.555Z');assert.equal(value.sourceSha256,'9db9d76eb8e062db229d7194da35edb03e8760b7d04e862b375903030bd1d345');
 assert.equal(value.observationBasis,'response-received');assert(Date.parse(value.observedAt)<=Date.now(),'A review cannot use future source evidence');
 assert(value.name.length<=80&&value.hook.length<=180&&value.detail.length<=700);
 assert(!value.date&&!value.time&&!value.startTimeUtc&&!value.localDateWindow,'Unconfirmed named listing cannot acquire a fixture window');
 return value;
}
function isReviewedNote(event){
 const note=event?.calendarNote,original=event?.importedSeedFacts;
 return !!(event?.id===review.id&&event.key==='rugby'&&event.cardKind==='calendar-note'&&event.sourceType==='personal-calendar'&&event.sourceTrust==='unverified'
  &&event.name===review.name&&event.displayTitleCompact===review.name&&event.dateStatus==='tbc'&&event.timePrecision==='unknown'&&event.scheduleStatus==='tbc'
  &&event.status==='upcoming'&&event.timeTbc===true&&event.startTimeTbc===true&&event.participantsConfirmed===false&&event.expected===null&&event.venue==null
  &&clockKeys.every(key=>event[key]==null||event[key]==='')&&arrays.every(key=>!event[key]?.length)&&!event.competitionId&&!event.schedulingWindow&&!event.dateOnly&&!event.score&&!event.result&&!event.scoreDisplay&&!event.canonicalResultScoreline&&!event.outcomeText&&!event.recapText
  &&event.broadcaster==='Australian viewing unconfirmed'&&event.sourceUrl===review.originalSourceUrl&&event.sourceCheckedAt===review.originalSourceCheckedAt
  // The incoming seed had no status observation; the published seed did. The
  // preservation merge may retain that exact original July check, never a new
  // date derived from this organiser review or another publication.
  &&((event.statusCheckedAt==null&&original?.statusCheckedAt==null)||(event.statusCheckedAt===review.originalSourceCheckedAt&&(original?.statusCheckedAt==null||original.statusCheckedAt===review.originalSourceCheckedAt)))
  &&original?.name===review.originalName&&original.date===review.originalDate&&original.time===review.originalTime&&original.sourceCheckedAt===review.originalSourceCheckedAt
  &&event.selectedSentence===review.hook&&event.fullSpiel===review.detail&&!event.storyline&&!event.editorialPreview&&!event.editorialNarrative
  &&note?.reviewId===review.reviewId&&note.state==='unconfirmed'&&note.identityStatus==='unresolved'&&note.sourceUrl===review.sourceUrl&&note.observedAt===review.observedAt&&note.sourceSha256===review.sourceSha256&&note.observationBasis===review.observationBasis
  &&!note.localDateWindow&&!note.relatedEventId&&(!event.canonicalEventId||event.canonicalEventId===review.id)&&(!event.eventId||event.eventId===review.id));
}
function qualify(event){
 if(event.id!==review.id)return event;
 if(event.sourceTrust==='verified'&&['official','broadcaster','explicitly-permitted'].includes(event.sourceType)){
  assert(/^https:\/\//.test(event.sourceUrl||'')&&Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now(),'Verified recovery requires a genuine dated source');return event;
 }
 if(!['upcoming','scheduled'].includes(event.status)||event.score||event.result||event.scoreDisplay||event.canonicalResultScoreline)return event;
 // Validate only when this review is applied. An unrelated historical source
 // replay may import the updater under its own clock without using this note.
 validate();
 if(event.calendarNote){assert(isReviewedNote(event),'Invalid retained Rugby note');return event;}
 assert(event.key==='rugby'&&event.name===review.originalName&&event.date===review.originalDate&&event.time===review.originalTime&&!event.startTimeUtc&&!event.competitionId
  &&event.sourceTrust==='unverified'&&event.sourceName==='Bundled nothingsport seed data'&&event.sourceUrl===review.originalSourceUrl&&event.sourceCheckedAt===review.originalSourceCheckedAt,'Changed Rugby seed needs a new review before qualification');
 assert.deepEqual([...(event.participantIds||[])].sort(),['team:rugby:ireland','team:rugby:wallabies'],'Retain independently changed sporting identities for review');
 const importedSeedFacts=Object.fromEntries(['name',...clockKeys,...arrays,'sourceName','sourceUrl','sourceType','sourceTrust','sourceCheckedAt','statusCheckedAt','venue','broadcaster','expected','round','narrativeType','selectedSentence','fullSpiel','storyline','lastReviewedAt'].filter(key=>event[key]!=null).map(key=>[key,event[key]]));
 const next={...event,name:review.name,displayTitleCompact:review.name,sourceName:'Saved unconfirmed Rugby listing',sourceType:'personal-calendar',cardKind:'calendar-note',dateStatus:'tbc',timePrecision:'unknown',schedulePrecision:'unknown',scheduleStatus:'tbc',timeTbc:true,startTimeTbc:true,dateOnly:false,status:'upcoming',displayDateLabel:'Dates TBC',participantsConfirmed:false,venue:null,expected:null,schedulingWindow:null,broadcaster:'Australian viewing unconfirmed',selectedSentence:review.hook,fullSpiel:review.detail,resultCoverage:'unconfirmed-calendar-note',replayEligible:false,highlightEligible:false,briefingEligible:false,catchupEligible:false,importedSeedFacts,
  calendarNote:{reviewId:review.reviewId,state:'unconfirmed',identityStatus:'unresolved',sourceUrl:review.sourceUrl,observedAt:review.observedAt,sourceSha256:review.sourceSha256,observationBasis:review.observationBasis}};
 for(const key of clockKeys)next[key]=null;for(const key of arrays)next[key]=[];
 for(const key of ['participants','storyline','editorialPreview','editorialNarrative','editorialReplayRecommendation'])delete next[key];
 assert(isReviewedNote(next),'Rugby seed qualification failed');return next;
}
module.exports={qualify,isReviewedNote,validate,id:review.id,review};
