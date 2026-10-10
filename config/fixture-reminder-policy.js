(function(root,factory){const api=factory();root.NOTHINGSPORTS_REMINDER_POLICY=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:window,function(){
 'use strict';
 const deps=()=>({follow:globalThis.NOTHINGSPORTS_FOLLOW_FIRST||(typeof require==='function'?require('./follow-first'):null),feed:globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY||(typeof require==='function'?require('./follow-feed-policy'):null),identity:globalThis.NOTHINGSPORTS_EVENT_ACTION_IDENTITY||(typeof require==='function'?require('./event-action-identity'):null)});
 const STOP=/^(completed|finished|past|live|cancelled|canceled|withdrawn|postponed|suspended|abandoned|walkover)$/i;
 function fixtureId(f){return deps().identity.stableKey(f);}
 function timing(f,now=Date.now()){
  if(!f||STOP.test(f.status||'')||STOP.test(f.scheduleStatus||'')||!['upcoming','scheduled'].includes(f.status)||f.scheduleStatus!=='confirmed'||f.timingVerified===false)return null;
  const precision=f.timePrecision;
  if(!['exact','not-before','not_before'].includes(precision))return null;
  const clock=String(f.startTimeUtc||''),parts=clock.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if(!parts||new Date(Date.UTC(+parts[1],+parts[2]-1,+parts[3])).toISOString().slice(0,10)!==parts.slice(1,4).join('-'))return null;
  const start=Date.parse(f.startTimeUtc||''),verified=Date.parse(f.sourceCheckedAt||f.canonicalSourceCheckedAt||f.lastVerifiedAt||'');
  if(!Number.isFinite(start)||start<=+now||!Number.isFinite(verified)||verified>+now||!/^https:\/\//.test(f.sourceUrl||f.scheduleSourceUrl||''))return null;
  return {startsAt:new Date(start).toISOString(),remindAt:new Date(start-900000).toISOString(),deliveryMode:'match-15',precision:precision==='exact'?'exact':'not-before',late:start-900000<+now};
 }
 function knockout(f){
  // Names of competitions, parent dates and golf final rounds cannot establish a round.
  const stage=[f.stage,f.round,f.roundLabel,f.stageType,f.drawStage].filter(Boolean).join(' ').toLowerCase().replace(/_/g,' ');
  if(/qualifying (?!final)|qualifier|round.robin|group|league.phase|pool|practice|warm.up|exhibition|final round|season final/.test(stage)||f.isQualifying||f.isExhibition||f.isWarmup)return false;
  if(f.isKnockout===true||f.knockout===true)return true;
  return /\b(?:qf|sf|r128|r64|r32|r16|round of (?:128|64|32|16)|quarter.?final|semi.?final|grand final|preliminary final|elimination final|qualifying final|knockout|final)\b/.test(stage)||/^(?:1st|2nd|3rd|4th|first|second|third|fourth) round$/.test(stage);
 }
 function automaticEventScope(f){
  if(!knockout(f))return false;
  const tennis=/^(?:tennis|wimbledon)/.test(String(f.key||f.sportKey||''));if(!tennis)return true;
  const category=[f.tournamentLevel,f.category,f.tourLevel,f.competitionCategory,f.tournamentCategory].filter(Boolean).join(' ').toLowerCase().replace(/_/g,' ');
  if(/qualif|exhibition|warm.up/.test(category)||/qualif/.test([f.stage,f.round,f.roundLabel].join(' ')))return false;
  if(/\b(?:250|500)\b/.test(category)){
   const stages=[f.stage,f.round,f.roundLabel].filter(Boolean).map(v=>String(v).trim().toLowerCase().replace(/_/g,' '));
   const singles=!/doubles|mixed|team/.test([f.discipline,f.drawType,f.eventType,f.format].join(' ').toLowerCase())&&deps().feed.participantIds(f).length===2;
   const tour=/\b(?:atp|wta)\b/.test([f.tour,f.tournamentLevel,f.competitionId].join(' ').toLowerCase());
   return tour&&singles&&stages.some(v=>/^(?:singles )?(?:championship )?final$/.test(v))&&!stages.some(v=>/semi|quarter|qualif|round|group|exhibition/.test(v));
  }
  return /grand.?slam|major|1000|masters|team|davis|billie|bjk|finals/.test(category);
 }
 function automatic(f,prefs,collections={},now=Date.now()){
  const {follow,feed}=deps(),notifications=prefs?.followFirst?.notifications||{};
  if(notifications.enabled===false||notifications.sportingRemindersEnabled===false||notifications.autoRemindersEnabled===false||feed.aggregateEvent(f)||f.tournamentParent||f.majorEventMarker||f.cardKind==='event'||f.published===false||f.participantsConfirmed===false||feed.explicitlyExcluded(f,prefs)||!knockout(f))return false;
  if(!automaticEventScope({...f,key:feed.sportKey(f)}))return false;
  if(!timing(f,now))return false;
  return feed.participantIds(f).some(id=>follow.effectiveParticipantFollow(id,prefs,collections)?.followed===true);
 }
 function intent(f,prefs,actions={},collections={},now=Date.now()){
  const saved=deps().identity.resolveAction(f,actions).action||{};
  const choice=saved.reminderChoice||(Object.hasOwn(saved,'reminderRequested')?(saved.reminderRequested?'on':'off'):null);
  if(choice==='off')return {enabled:false,origin:'manual',choice:'off'};
  if(choice==='on')return {enabled:true,origin:'manual',choice:'on'};
  const enabled=automatic(f,prefs,collections,now);
  return {enabled,origin:'automatic',choice:'automatic'};
 }
 return Object.freeze({fixtureId,timing,knockout,automaticEventScope,automatic,intent});
});
