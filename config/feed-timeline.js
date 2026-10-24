(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./calendar-export'):root.NOTHINGSPORTS_CALENDAR,typeof module==='object'&&module.exports?require('./feed-controls'):root.NOTHINGSPORTS_FEED_CONTROLS);
  root.NOTHINGSPORTS_FEED_TIMELINE=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(calendar,controls){
  'use strict';
  const overview=event=>Boolean(event.tournamentParent||event.majorEventMarker||event.cardKind==='event'||['tennis_parent','tournament_overview','golf_tournament'].includes(event.cardType));
  function finalDay(event){const first=event.date||event.startDate,end=event.endDate;return end>first&&calendar.knownDate({date:first})&&calendar.knownDate({date:end})?end:null;}
  function displayDate(event,now=new Date()){
    const end=finalDay(event),first=event.date||event.startDate,today=calendar.sydneyDay(now);
    const terminal=['completed','finished','final','cancelled','canceled','abandoned','withdrawn','postponed'].includes(String(event.status||event.scheduleStatus||'').toLowerCase());
    return end&&today>=first&&(today<=end||confirmedLive(event,now))&&!terminal?today:end||first;
  }
  function todayOverview(event,now=new Date()){return overview(event)&&displayDate(event,now)===calendar.sydneyDay(now)&&!['completed','finished','final','cancelled','canceled','abandoned'].includes(event.status);}
  function confirmedLive(event,now=new Date()){
    if(overview(event)||!['live','in-progress','in_progress'].includes(String(event.status||'').toLowerCase()))return false;
    const checked=Date.parse(event.statusCheckedAt||event.livePlayObservedAt||'');
    return Number.isFinite(checked)&&checked<=+now&&+now-checked<=240000&&event.stale!==true&&event.sourceStale!==true;
  }
  function status(event,now=new Date()){
    if(['completed','finished','final','cancelled','canceled','postponed'].includes(String(event.status || event.scheduleStatus || '').toLowerCase()))return 'past';
    if(event.dateOnly && event.endDate){
      const today=calendar.sydneyDay(now),start=event.date || event.startDate;
      if(start && today>=start && today<=event.endDate)return 'live';
      if(today>event.endDate)return 'past';
    }
    const today=calendar.sydneyDay(now);
    if(event.key==='cricket'&&event.endDate>event.date&&today>=event.date&&today<=event.endDate && (today>event.date || +(calendar.eventStart(event)||Infinity)<=+now))return 'ongoing';
    const timing=controls.timingState(event,now)?.key;
    if(timing==='awaiting-update')return 'unknown';
    if(timing==='live-now')return 'live';
    if(timing==='half-time')return 'ongoing';
    const start=calendar.eventStart(event);
    return start && +start<=+now?'past':'upcoming';
  }
  function sortTime(event){const restart=/^(stumps|rain-delay|break|suspended|interrupted)$/.test(event.status||'')?Date.parse(event.restartTimeUtc||''):NaN;if(Number.isFinite(restart))return restart;return +(calendar.eventStart(event)||Infinity);}
  function compare(a,b,now=new Date()){return String(displayDate(a,now)||'9999').localeCompare(String(displayDate(b,now)||'9999'))||sortTime(a)-sortTime(b)||(a.lemansCalendar&&b.lemansCalendar?a.sessionOrder-b.sessionOrder:0)||calendar.idFor(a).localeCompare(calendar.idFor(b));}
  function beforeNow(event,now=new Date()){
    const start=sortTime(event);
    return !todayOverview(event,now)&&!confirmedLive(event,now)&&(status(event,now)==='past'||Number.isFinite(start)&&start<=+now);
  }
  function orderToday(events,now=new Date()){
    if(events.some(e=>e.multisessionOccurrence))return events.slice().sort((a,b)=>sortTime(a)-sortTime(b)||calendar.idFor(a).localeCompare(calendar.idFor(b)));
    const groups=[[],[],[],[]];for(const event of events.slice().sort((a,b)=>sortTime(a)-sortTime(b)||calendar.idFor(a).localeCompare(calendar.idFor(b))))groups[todayOverview(event,now)?0:confirmedLive(event,now)?2:beforeNow(event,now)?1:3].push(event);return groups.flat();
  }
  function normalizedStatus(event,now=new Date()){
    // Keep authoritative states across repeated browser normalisation. In
    // particular, completed follows-time matches have no exact start to infer.
    const raw=String(event.status||'').toLowerCase();
    return ['live','in-progress','in_progress','ongoing','completed','finished','final','cancelled','canceled','postponed','suspended','stumps','interrupted','rain-delay','break','abandoned'].includes(raw)?raw:status(event,now);
  }
  function groups(events,now=new Date()){
    const today=calendar.sydneyDay(now),result={retainedPast:[],today:[],future:[],unknown:[]};
    for(const event of events){
      const date=displayDate(event,now);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))result.unknown.push(event);
      else if(date===today || !finalDay(event)&&date<today && (todayOverview(event,now) || ['live','ongoing','stumps','suspended','interrupted','rain-delay','break'].includes(event.status)&&Number.isFinite(Date.parse(event.statusCheckedAt||event.livePlayObservedAt||''))))result.today.push(event);
      else if(date<today)result.retainedPast.push(event);
      else if(date>today)result.future.push(event);
    }
    Object.values(result).forEach(group=>group.sort((a,b)=>compare(a,b,now)));
    result.today=orderToday(result.today,now);
    return result;
  }
  return {status,normalizedStatus,compare,groups,confirmedLive,overview,todayOverview,beforeNow,orderToday,finalDay,displayDate};
});
