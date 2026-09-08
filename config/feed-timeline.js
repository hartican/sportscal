(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./calendar-export'):root.NOTHINGSPORTS_CALENDAR,typeof module==='object'&&module.exports?require('./feed-controls'):root.NOTHINGSPORTS_FEED_CONTROLS);
  root.NOTHINGSPORTS_FEED_TIMELINE=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(calendar,controls){
  'use strict';
  function status(event,now=new Date()){
    if(['completed','finished','final','cancelled','canceled','postponed'].includes(String(event.status || event.scheduleStatus || '').toLowerCase()))return 'past';
    if(event.dateOnly && event.endDate){
      const today=calendar.sydneyDay(now),start=event.date || event.startDate;
      if(start && today>=start && today<=event.endDate)return 'live';
      if(today>event.endDate)return 'past';
    }
    if(controls.timingState(event,now)?.key==='live-now')return 'live';
    const start=calendar.eventStart(event);
    return start && +start<=+now?'past':'upcoming';
  }
  function compare(a,b){return +(calendar.eventStart(a)||new Date(`${a.date || a.startDate}T00:00:00Z`)) - +(calendar.eventStart(b)||new Date(`${b.date || b.startDate}T00:00:00Z`)) || calendar.idFor(a).localeCompare(calendar.idFor(b));}
  function groups(events,now=new Date()){
    const today=calendar.sydneyDay(now),result={retainedPast:[],today:[],future:[],unknown:[]};
    for(const event of events){
      const date=event.date || event.startDate;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))result.unknown.push(event);
      else if(date===today || date<today && status(event,now)==='live')result.today.push(event);
      else if(date<today)result.retainedPast.push(event);
      else if(date>today)result.future.push(event);
    }
    Object.values(result).forEach(group=>group.sort(compare));
    result.today.sort((a,b)=>Number(status(a,now)!=='past')-Number(status(b,now)!=='past') || compare(a,b));
    return result;
  }
  return {status,compare,groups};
});
