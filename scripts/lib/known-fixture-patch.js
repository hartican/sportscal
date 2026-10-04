'use strict';
const {storylineFor,spoilerSafeRootCopy}=require('./storyline-card-rules');
const KEYS=['teamMatchContext','season','viewingOptions','status','scheduleStatus','statusCheckedAt','startTimeUtc','endTimeUtc','actualEndTimeUtc','time','date','score','scoreDisplay','result','outcomeText','recapText','homeScore','awayScore','resultStatus','resultPublishedAt','sessionStartTimeUtc','sequenceInSession','timePrecision','sourceName','sourceUrl','sourceCheckedAt','resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt','delayedResultSource','sourceAttribution'];
function semantic(value){return JSON.stringify(value,(key,v)=>['verifiedAt','checkedAt','updatedAt','lastReviewedAt','sourceCheckedAt','statusUpdatedAt','statusCheckedAt','resultSourceCheckedAt','resultPublishedAt'].includes(key)?undefined:v);}
function retainUnchangedFinalObservation(previous,next){
 if(previous.status!=='completed'||next.status!=='completed'||!Number.isFinite(Date.parse(previous.scoreCheckedAt)))return;
 const facts=['key','id','participantIds','participants','status','score','scoreDisplay','result','homeScore','awayScore','outcomeText','recapText','fixtureResults','resultStatus','resultPublishedAt','sourceName','sourceUrl','resultSourceUrl','delayedResultSource','sourceAttribution'];
 if(facts.every(key=>JSON.stringify(previous[key])===JSON.stringify(next[key]))){
  next.scoreCheckedAt=previous.scoreCheckedAt;
  if(Number.isFinite(Date.parse(previous.resultSourceCheckedAt)))next.resultSourceCheckedAt=previous.resultSourceCheckedAt;
 }
}
function patchKnown(events,updates){
 let count=0;const byId=new Map(updates.map(e=>[e.id || e.eventId,e]));
 const result=events.map(ev=>{const update=byId.get(ev.id || ev.eventId);if(!update)return ev;const next={...ev};for(const key of [...KEYS,...(update.key==='f1'?['fixtureResults','participantIds','participants','participantsConfirmed']:[])])if(Object.hasOwn(update,key))next[key]=update[key];if(update.key==='premier-league'&&update.status==='completed'&&!update.delayedResultSource&&ev.delayedResultSource){delete next.delayedResultSource;if(next.sourceAttribution?.provider==='Football-Data.org')delete next.sourceAttribution;}retainUnchangedFinalObservation(ev,next);if(semantic(next)!==semantic(ev)){const resultChanged=['status','score','scoreDisplay','result','homeScore','awayScore','outcomeText','fixtureResults'].some(key=>JSON.stringify(next[key])!==JSON.stringify(ev[key]));if(next.status==='completed'&&next.storyline&&resultChanged){next.storyline=storylineFor(next);const safe=spoilerSafeRootCopy(next,next.storyline);next.selectedSentence=safe.hook;next.fullSpiel=safe.synopsis;delete next.editorialPreview;}count++;return next;}return ev;});
 return {events:result,count};
}
module.exports={KEYS,semantic,patchKnown};
