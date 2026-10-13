(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CARD_TIMING = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";
  const timeZone = "Australia/Sydney";
  const format = (date, options) => new Intl.DateTimeFormat("en-AU", {timeZone, ...options}).format(date).replace(/,/g, "").replace(/Sept\b/g, "Sep").toUpperCase();
  function dayKey(date){
    const parts = new Intl.DateTimeFormat("en-CA", {timeZone, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(date);
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function calendarDate(value){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const date = new Date(`${value}T12:00:00+10:00`);
    return Number.isFinite(+date) && dayKey(date)===value ? date : null;
  }
  // A multi-day tournament phase is not evidence that a session is live now.
  // Keep this separate from clock filters and never infer it from its dates.
  function tournamentPhase(event){
    if (!(event.dateOnly || event.timePrecision === 'date-only') ||
        !(event.tournamentParent || ['golf_tournament','tennis_parent'].includes(event.cardType))) return null;
    const statuses = [event.status,event.scheduleStatus].map(value => String(value || '').toLowerCase());
    if (statuses.some(value => ['completed','finished','final','cancelled','canceled','abandoned','postponed','suspended','interrupted'].includes(value))) return null;
    if (!statuses.some(value => ['live','ongoing','in_progress','in-progress'].includes(value))) return null;
    return Object.freeze({key:'in-progress',label:'In progress',ariaLabel:'Tournament in progress. Session times vary.'});
  }
  function pauseReason(event){
    if(event.tournamentParent||event.majorEventMarker||['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType)||!['stumps','rain-delay','break','suspended','interrupted','delayed','ongoing'].includes(event.status))return null;
    const racingPause=/^(Red flag|Safety car|Virtual safety car|Race suspended|Session suspended|Play suspended)$/i.test(event.score?.racing?.statusText||'')?event.score.racing.statusText:null;
    return racingPause||(/^(Half-time|Lunch|Tea|Drinks|Innings break|Break|Stumps|Rain delay|Bad light|End of day|Session ended|Suspended|Interrupted|Delayed|Ongoing)$/i.test(event.statusText||'')?event.statusText:({'break':'Break','stumps':'Stumps','rain-delay':'Rain delay','suspended':'Suspended','interrupted':'Interrupted','delayed':'Delayed','ongoing':'Ongoing'})[event.status]);
  }
  function pausePresentation(event, reference = new Date()){
    const label=pauseReason(event);if(!label)return null;
    const restart=Date.parse(event.restartTimeUtc||''),now=new Date(reference);
    const clock=Number.isFinite(restart)&&restart>+now?new Date(restart):null;
    const time=clock?new Intl.DateTimeFormat('en-AU',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(clock):null;
    const day=clock&&dayKey(clock)!==dayKey(now)?new Intl.DateTimeFormat('en-AU',{timeZone,weekday:'short',day:'numeric',month:'short',...(dayKey(clock).slice(0,4)!==dayKey(now).slice(0,4)?{year:'numeric'}:{})}).format(clock).replace(/,/g,'')+', ':'';
    return {label,restart:clock?'Live again at '+day+time:Number.isFinite(restart)?'Awaiting resumption update':'Resume time TBD'};
  }
  function progress(event, reference = new Date()){
    const statuses=[event.status,event.scheduleStatus].map(value=>String(value||'').toLowerCase());
    const started=statuses.some(value=>/^(live|ongoing|in_progress|in-progress|stumps|rain-delay|break|suspended|interrupted|completed|finished|final)$/.test(value));
    if(!started||statuses.some(value=>/^(cancelled|canceled|abandoned|postponed)$/.test(value)))return null;
    if(/^cricket/.test(event.key||event.sportKey||'')&&/\btest\b/i.test([event.format,event.matchFormat].join(' '))){
      const valid=Number.isSafeInteger(event.matchDay)&&event.matchDay>0&&(!event.numberOfDays||event.matchDay<=event.numberOfDays)&&/^https:\/\//.test(event.matchDaySourceUrl||'');
      return valid?'DAY '+event.matchDay:'DAY UNCONFIRMED';
    }
    if(statuses.some(value=>/^(completed|finished|final)$/.test(value))||!(event.tournamentParent||event.isEditionOverview||['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType)))return null;
    const tennis=/tennis|wimbledon/.test(event.key||event.sportKey||'');
    const records=(Array.isArray(event.tournamentProgress)?event.tournamentProgress:[]).filter(p=>p&&/^https:\/\//.test(p.sourceUrl||'')&&Number.isFinite(Date.parse(p.sourceCheckedAt))&&Date.parse(p.sourceCheckedAt)<=+new Date(reference)&&(!tennis||['ATP','WTA'].includes(p.tour)&&p.drawType==='singles'&&p.mainDraw===true));
    const tours=new Set([...(tennis?(event.representedTours|| (event.tour==='BOTH'?['ATP','WTA']:[])):[]),...records.map(p=>p.tour)].filter(t=>['ATP','WTA'].includes(t)));
    const labels=records.map(p=>{
      const raw=Array.isArray(p.roundNumbers)?p.roundNumbers:[],rounds=[...new Set(raw.filter(n=>Number.isSafeInteger(n)&&n>0))].sort((a,b)=>a-b);
      const count=p.totalRounds,numbered=rounds.length&&rounds.length===new Set(raw).size&&Number.isSafeInteger(count)&&count>=rounds.at(-1)&&(rounds.length===1||/^\d{4}-\d{2}-\d{2}$/.test(p.playDate||''));
      const names=[...new Set((Array.isArray(p.roundLabels)?p.roundLabels:[]).filter(n=>typeof n==='string'&&n.trim()).map(n=>n.trim().toUpperCase()))];
      const label=numbered?'ROUND '+rounds[0]+(rounds.length>1?'-'+rounds.at(-1):'')+' OF '+count:names.join(' / ')||'ROUND UNCONFIRMED';
      return (tours.size>1?p.tour+' · ':'')+label;
    });
    if(tours.size>1)for(const tour of tours)if(!records.some(p=>p.tour===tour))labels.push(tour+' · ROUND UNCONFIRMED');
    return [...new Set(labels)].join(' · ')||'ROUND UNCONFIRMED';
  }
  function presentation(event, reference = new Date(), {fullRange=false} = {}){
    const now = new Date(reference);
    const precision = event.timePrecision;
    const uncertain = event.timeTbc || event.startTimeTbc;
    const pausedRestart=/^(stumps|rain-delay|break|suspended|interrupted)$/.test(event.status||'')&&Number.isFinite(Date.parse(event.restartTimeUtc||''))?event.restartTimeUtc:null;
    const raw = pausedRestart || (precision === "estimated" ? event.estimatedStartTimeUtc || event.startTimeUtc : event.startTimeUtc);
    const parsed = new Date(raw || "");
    const hasTime = !event.dateOnly && !uncertain && (!precision || ["exact","session-start","estimated","not-before"].includes(precision)) && Number.isFinite(+parsed);
    const first = calendarDate(event.date || event.startDate), end = calendarDate(event.endDate);
    const date = fullRange && first && end > first ? first : hasTime ? parsed : first;
    const currentDay = dayKey(now);
    const key = date ? dayKey(date) : null;
    const delta = key ? (Date.parse(key) - Date.parse(currentDay)) / 86400000 : null;
    const dated = value => format(value, {weekday:"short", day:"numeric", month:"short", ...(dayKey(value).slice(0,4) !== currentDay.slice(0,4) ? {year:"numeric"} : {})});
    let day = date ? delta === 0 ? "TODAY" : delta > 0 && (delta < 7 || precision==='not-before' && delta===7) ? format(date,{weekday:"short"}) : dated(date) : "DATE TBD";
    if(precision==='not-before'&&hasTime&&delta===0)day='';
    let fullDate = date ? dated(date) : "DATE TBD";
    const range = end && key && dayKey(end) > key;
    if (range){ day = `${dated(date)} – ${dated(end)}`; fullDate += ` – ${dated(end)}`; }
    const clock = hasTime ? format(parsed,{hour:"numeric",minute:"2-digit",hour12:true}).replace(/\s+/g," ") : "";
    const overview=(event.dateOnly||precision==='date-only')&&(event.key==='wrc'||event.cardType==='golf_tournament');
    const settled=/^(completed|finished|final|cancelled|canceled|abandoned)$/.test(event.status||'');
    const windowStart=new Date(event.estimatedEarliestStartTimeUtc||''),windowEnd=new Date(event.estimatedLatestStartTimeUtc||'');
    const windowLabel=precision==='estimated'&&Number.isFinite(+windowStart)&&Number.isFinite(+windowEnd)?'APPROX. '+format(windowStart,{hour:'numeric',minute:'2-digit',hour12:true})+' – '+format(windowEnd,{hour:'numeric',minute:'2-digit',hour12:true}):null;
    const progressLabel=progress(event,reference);
    const originalDate=progressLabel&&first;if(originalDate)fullDate=dated(originalDate)+(end>originalDate?' – '+dated(end):'');
    const time = progressLabel&&event.dateOnly?'':windowLabel || (overview ? settled?'':event.key==='wrc'?'RALLY DATES':'TOURNAMENT DATES' : precision === "follows" ? "FOLLOWS PRIOR MATCH" : event.dateOnly || uncertain || !clock ? "TIME TBD" : `${precision === "estimated" ? "APPROX. " : precision === "not-before" ? "NOT BEFORE " : ""}${clock}`);
    const schedule = [day,time].filter(Boolean).join(delta !== null && delta >= 0 && (delta < 7 || precision==='not-before' && delta===7) && !range ? " " : " · ");
    // Venue calendar dates cannot establish Sydney dates without a race start.
    const venueCalendar = !hasTime && event.timingProvenance?.precision === 'venue-calendar' && event.displayDateLabel;
    if(venueCalendar){day=fullDate=event.displayDateLabel;}
    const scheduleLabel = venueCalendar ? [day,time].join(' · ') : schedule;
    const fullSchedule = [fullDate,time].filter(Boolean).join(" · ") + (venueCalendar ? ' · Sydney start TBD' : " (Sydney time)");
    // Explicit source status only: duration heuristics must not claim completion.
    const statuses = [event.status,event.scheduleStatus].map(value => String(value || "").toLowerCase());
    const pause = pauseReason(event);
    let status = "";
    if (statuses.some(value => ["cancelled","canceled"].includes(value))) status = "CANCELLED";
    else if (statuses.includes("postponed")) status = "POSTPONED";
    else if (statuses.includes("abandoned")) status = "ABANDONED";
    else if (statuses.includes("suspended")) status = (pause || "SUSPENDED").toUpperCase();
    else if (statuses.some(value => ["completed","finished","final"].includes(value))) status = "FINISHED";
    else if(pause)status=pause.toUpperCase();
    else if(statuses.includes("stumps"))status="STUMPS";
    else if(statuses.includes("rain-delay"))status="RAIN DELAY";
    else if(statuses.includes("break"))status="BREAK";
    else if(statuses.includes("ongoing"))status="ONGOING";
    else if (statuses.some(value => ["live","in_progress","in-progress"].includes(value))) status = "LIVE";
    if (tournamentPhase(event)) status = 'IN PROGRESS';
    const odi=typeof module==='object'&&module.exports?require('./odi-display'):globalThis.NOTHINGSPORTS_ODI_DISPLAY;
    if(odi?.awaiting(event,reference))status=odi.label;
    const controls=typeof module==='object'&&module.exports?require('./feed-controls'):globalThis.NOTHINGSPORTS_FEED_CONTROLS;
    const observed=controls?.timingState(event,reference);
    if(observed?.key==='half-time')status='HALF-TIME';
    if(observed?.key==='awaiting-update')status=observed.label;
    return Object.freeze({day:fullRange&&range?day:progressLabel|| (precision==='not-before'?day:venueCalendar?day:date?(range?day:dated(date)):'DATE TBD'),time,label:status || scheduleLabel, primary:status || (range || event.dateOnly ? scheduleLabel : time), status, schedule:progressLabel||scheduleLabel, fullSchedule, progress:progressLabel, ariaLabel:[progressLabel,status ? `${status}. Scheduled ${fullSchedule}` : fullSchedule].filter(Boolean).join('. ')});
  }
  function minimised(event, reference = new Date()){
    const value=presentation(event,reference),pause=pausePresentation(event,reference);
    const clock=raw=>new Intl.DateTimeFormat('en-AU',{timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(raw));
    const restart=Date.parse(event.restartTimeUtc||'');
    let time=value.status;
    if(pause&&!/^(FINISHED|CANCELLED|POSTPONED|ABANDONED)$/.test(time)){
      const suffix=Number.isFinite(restart)&&restart>+new Date(reference)?clock(restart):Number.isFinite(restart)||/awaiting/i.test(value.status)?'AWAITING UPDATE':'TIME TBD';
      time=pause.label.toUpperCase()+' · '+suffix;
    }else if(/awaiting/i.test(time))time='AWAITING UPDATE';
    if(!time){
      const raw=event.timePrecision==='estimated'?event.estimatedStartTimeUtc||event.startTimeUtc:event.startTimeUtc;
      const known=!event.dateOnly&&!event.timeTbc&&!event.startTimeTbc&&(!event.timePrecision||['exact','session-start','estimated','not-before'].includes(event.timePrecision))&&Number.isFinite(Date.parse(raw||''));
      time=known?(event.timePrecision==='not-before'?'NB ':event.timePrecision==='estimated'?'APPROX. ':'')+clock(raw):event.timePrecision==='follows'?'FOLLOWS':'TIME TBD';
    }
    const overview=event.tournamentParent||event.isEditionOverview||event.majorEventMarker||['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType);
    if(overview&&!value.progress){
      const date=calendarDate(event.date||event.startDate),end=calendarDate(event.endDate);
      const short=day=>format(day,{day:'numeric',month:'short'});
      time=(date?short(date)+(end&&dayKey(end)!==dayKey(date)?'–'+short(end):''):'DATE TBD')+(value.status?' · '+value.status:'');
    }
    const ariaLabel=[value.ariaLabel,pause?[pause.label,pause.restart].join('. '):''].filter(Boolean).join('. ');
    return Object.freeze({...value,time,ariaLabel});
  }
  function dateOnlyLabel(event){
    if(['completed','finished','final'].includes(event.status))return 'Completed';
    return event.eventType==='match'||event.timingProvenance?.precision==='venue-calendar'?'Time TBD':String(event.displayTime||'Session times vary').replace(/\bTBC\b/gi,'TBD');
  }
  return Object.freeze({presentation,minimised,tournamentPhase,dateOnlyLabel,pausePresentation,pauseReason,progress});
});
