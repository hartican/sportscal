'use strict';
const {storylineFor,spoilerSafeRootCopy}=require('./storyline-card-rules');
const KEYS=['teamMatchContext','season','viewingOptions','status','scheduleStatus','statusCheckedAt','startTimeUtc','endTimeUtc','actualEndTimeUtc','time','date','score','scoreDisplay','result','outcomeText','recapText','homeScore','awayScore','resultStatus','resultPublishedAt','sessionStartTimeUtc','sequenceInSession','timePrecision','sourceName','sourceUrl','sourceCheckedAt','resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt','delayedResultSource','sourceAttribution'];
function semantic(value){return JSON.stringify(value,(key,v)=>['verifiedAt','checkedAt','updatedAt','lastReviewedAt','sourceCheckedAt','statusUpdatedAt','statusCheckedAt','resultSourceCheckedAt','resultPublishedAt'].includes(key)?undefined:v);}
function validateNblPair(previous,update){
 if(update.competitionId!=='competition:nbl'||(!Object.hasOwn(update,'homeScore')&&!Object.hasOwn(update,'awayScore')))return;
 if(![update.homeScore,update.awayScore].every(score=>Number.isSafeInteger(score)&&score>=0)||update.homeScore===update.awayScore)throw Error('NBL final requires a complete decisive numeric score pair');
 if(!Array.isArray(previous.participantIds)||previous.participantIds.length!==2
  ||update.homeParticipantId!==previous.participantIds[0]||update.awayParticipantId!==previous.participantIds[1])throw Error('NBL final participant order disagrees with retained fixture');
}
function retainUnchangedFinalObservation(previous,next){
 const validF1Observation=value=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=Date.parse(previous.startTimeUtc)&&Date.parse(value)<=Date.now();
 const observed=next.key==='f1'?[previous.scoreCheckedAt,previous.fixtureResults?.checkedAt].find(validF1Observation):previous.scoreCheckedAt||(next.competitionId==='competition:nbl'&&Object.hasOwn(next,'scoreCheckedAt')?previous.resultSourceCheckedAt:null);
 if(previous.status!=='completed'||next.status!=='completed'||!Number.isFinite(Date.parse(observed)))return;
 const facts=['key','id','participantIds','participants','status','score','scoreDisplay','result','homeScore','awayScore','outcomeText','recapText','fixtureResults','resultStatus','resultPublishedAt','sourceName','sourceUrl','resultSourceUrl','delayedResultSource','sourceAttribution'];
 // NBL's legacy official score already contains the same source-ordered pair.
 // Adding explicit numeric fields is a representation change, not a new final.
 const sameLegacyNblPair=next.competitionId==='competition:nbl'&&previous.competitionId===next.competitionId
  &&!Object.hasOwn(previous,'homeScore')&&!Object.hasOwn(previous,'awayScore')
  &&[next.homeScore,next.awayScore].every(score=>Number.isSafeInteger(score)&&score>=0)
  &&previous.score===`${next.homeScore}-${next.awayScore}`;
 if(facts.every(key=>sameLegacyNblPair&&['homeScore','awayScore'].includes(key)||JSON.stringify(previous[key])===JSON.stringify(next[key]))){
  next.scoreCheckedAt=observed;
  if(Number.isFinite(Date.parse(previous.resultSourceCheckedAt)))next.resultSourceCheckedAt=previous.resultSourceCheckedAt;
 }
}
function patchKnown(events,updates){
 let count=0;const byId=new Map(updates.map(e=>[e.id || e.eventId,e]));
 const result=events.map(ev=>{const update=byId.get(ev.id || ev.eventId);if(!update)return ev;validateNblPair(ev,update);const next={...ev};for(const key of [...KEYS,...(update.key==='f1'?['fixtureResults','participantIds','participants','participantsConfirmed']:[]),...(update.competitionId==='competition:nbl'?['homeParticipantId','awayParticipantId']:[])])if(Object.hasOwn(update,key))next[key]=update[key];if(update.key==='premier-league'&&update.status==='completed'&&!update.delayedResultSource&&ev.delayedResultSource){delete next.delayedResultSource;if(next.sourceAttribution?.provider==='Football-Data.org')delete next.sourceAttribution;}retainUnchangedFinalObservation(ev,next);if(semantic(next)!==semantic(ev)){const resultChanged=['status','score','scoreDisplay','result','homeScore','awayScore','outcomeText','fixtureResults'].some(key=>JSON.stringify(next[key])!==JSON.stringify(ev[key]));if(next.status==='completed'&&next.storyline&&resultChanged){next.storyline=storylineFor(next);const safe=spoilerSafeRootCopy(next,next.storyline);next.selectedSentence=safe.hook;next.fullSpiel=safe.synopsis;delete next.editorialPreview;}count++;return next;}return ev;});
 return {events:result,count};
}
module.exports={KEYS,semantic,patchKnown};
