(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.NOTHINGSPORTS_ODI_DISPLAY=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const CUTOFF=10*3600000,FRESH=10*60000;
 function awaiting(event,now=new Date()){
  if(!/^(?:cricket|sport:cricket)$/i.test(event.key||event.sportDomainId||''))return false;
  if(!/\bodi\b|one[ -]day international/i.test([event.format,event.matchFormat,event.roundLabel,event.competitionName,event.name].join(' ')))return false;
  if(/^(completed|finished|final|abandoned|cancelled|canceled|postponed|suspended|interrupted|delayed|rain-delay|stumps|break)$/i.test(event.status||event.scheduleStatus||''))return false;
  const actual=Date.parse(event.actualStartTimeUtc||'');
  if(!Number.isFinite(actual)&&(event.timeTbc||event.startTimeTbc||event.dateOnly||event.timePrecision&&!['exact','session-start'].includes(event.timePrecision)))return false;
  const start=Number.isFinite(actual)?actual:Date.parse(event.startTimeUtc||'');
  const current=+new Date(now),observed=Date.parse(event.livePlayObservedAt||'');
  const fresh=/^(live|in_progress|in-progress|ongoing)$/i.test(event.status||'')&&Number.isFinite(observed)&&observed<=current&&current-observed<=FRESH;
  return Number.isFinite(start)&&Number.isFinite(current)&&current>=start+CUTOFF&&!fresh;
 }
 return Object.freeze({awaiting,CUTOFF,FRESH,label:'Awaiting confirmed result'});
});
