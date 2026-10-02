(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NOTHINGSPORTS_EDITORIAL_MAINTENANCE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=86400000,fields=['hook','formCopy','closingCopy','synopsis'];
  const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const plus=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const ids=event=>[...new Set([event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].filter(Boolean))];
  const protectedFixture=event=>ids(event).some(id=>['evt_84','major-match:nrl-finals-2026:grand-final'].includes(id));
  function eligibility(signal={}){
    const count=Number(signal.count||0),mean=Number(signal.mean),five=Number(signal.five_count||0);
    const reasons=[];if(five>=2)reasons.push('two-real-five-star-votes');if(signal.owner_five===true)reasons.push('owner-five-star-vote');if(count>0&&Number.isFinite(mean)&&mean>4.8)reasons.push('real-average-above-4.8');
    return {eligible:reasons.length>0,reasons,count,mean:count>0&&Number.isFinite(mean)?mean:null,fiveCount:five};
  }
  function copy(event){const n=event.editorialNarrative||{};return {hook:n.hook||event.selectedSentence||'',formCopy:n.formCopy||'',closingCopy:n.closingCopy||'',synopsis:n.synopsis||event.fullSpiel||''};}
  const equalCopy=(a,b)=>fields.every(field=>String(a?.[field]||'').trim()===String(b?.[field]||'').trim());
  function schedule(event,state={},now=new Date()){
    const today=day(now),date=event.startTimeUtc&&!event.dateOnly&&!event.timeTbc&&!event.startTimeTbc?day(event.startTimeUtc):String(event.date||event.startDate||'').slice(0,10);
    const days=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/DAY);
    const status=String(event.status||event.scheduleStatus||'').toLowerCase();
    const knownStart=Date.parse(event.startTimeUtc||'');
    const stopped=['live','in_progress','completed','finished','final','cancelled','canceled','abandoned','retired','postponed','suspended'].includes(status)||(Number.isFinite(knownStart)&&!event.dateOnly&&!event.timeTbc&&!event.startTimeTbc&&knownStart<=+new Date(now));
    const inWindow=Number.isFinite(days)&&days>=0&&days<=14&&!stopped;
    const cadenceDays=days>=7?5:days>=2?2:1;
    const checked=state.last_checked_at&&Number.isFinite(Date.parse(state.last_checked_at))?day(state.last_checked_at):null;
    const nextDueDate=checked?plus(checked,cadenceDays):today;
    const pending=Boolean(state.pending_copy);
    return {date,daysUntil:days,cadenceDays,inWindow,stopped,held:state.held===true,protected:protectedFixture(event),nextDueDate,due:inWindow&&!protectedFixture(event)&&state.held!==true&&(pending||!checked||today>=nextDueDate)};
  }
  return Object.freeze({DAY,fields,day,plus,ids,protectedFixture,eligibility,copy,equalCopy,schedule});
});
