(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CARD_TIMING = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";
  const timeZone = "Australia/Sydney";
  // Only the fixed styles below are retained; fixture values and clocks stay current.
  const formats=Object.create(null);
  function formatter(locale,options){const key=locale+JSON.stringify(options);return formats[key]||(formats[key]=new Intl.DateTimeFormat(locale,{timeZone,...options}));}
  const format = (date, options) => formatter("en-AU", options).format(date).replace(/,/g, "").replace(/Sept\b/g, "Sep").toUpperCase();
  function dayKey(date){
    const parts = formatter("en-CA", {year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(date);
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
  const interrupted=e=>/^(stumps|suspended|interrupted|delayed|rain-delay|break)$/.test(e.status||'');
  function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 // Interpret canonical states, not arbitrary provider codes or score narratives.
 // Keep source text for provenance; only recognised status phrases become a
 // Results-OFF label. Sport adapters remain responsible for their raw codes.
 function interruption(e){
  const status=String(e.status||''),sourceText=typeof e.statusText==='string'?e.statusText:null,text=(sourceText||'').trim();
  const result=(state,label,reason=null)=>({state,label,reason,sourceStatus:status,sourceText});
  if(!interrupted(e)&&status!=='ongoing'&&!/^(postponed|abandoned|cancelled|canceled)$/.test(status))return null;
  if(status==='stumps')return result('normal-break','Stumps');
  if(/^(break|ongoing)$/.test(status)&&/^(Half-time|Lunch|Tea|Drinks|Innings (?:break|interval)|Break|Stumps|End of day|Session ended)$/i.test(text))return result('normal-break',text);
  const racing=e.score?.racing?.statusText;
  if(interrupted(e)&&/^(Red flag|Race suspended|Session suspended|Play suspended)$/i.test(racing||''))return result('suspended',racing,racing);
  if(interrupted(e)&&/^(Safety car|Virtual safety car)$/i.test(racing||''))return result('sport-pause',racing);
  // Anchored phrases cannot reveal a score, winner or free-form commentary.
  const reason=/^(?:(?:(?:start|play|match|race|session|toss)\s+)?(?:is\s+)?(?:delayed(?: start)?|suspended|interrupted|stopped|postponed|abandoned|cancelled|canceled)\s*(?:(?:due to|because of|for|by)\s*|[-:–—]\s*))?(rain(?: delay)?|lightning|bad light|unsafe (?:conditions|pitch|surface)|lighting(?: failure)?|lighting\/power failure|power (?:failure|outage)|floodlights?(?: failure)?|crowd (?:incident|incidents|disturbance)|medical (?:emergency|emergencies)|wet (?:outfield|pitch)|weather|fog|snow|extreme heat|excessive heat)[.!]?$/i.exec(text)?.[1]||null;
  if(/^(postponed|abandoned|cancelled|canceled)$/.test(status)){const name=status==='canceled'?'Cancelled':status[0].toUpperCase()+status.slice(1);return result(status==='canceled'?'cancelled':status,name+(reason?' · '+reason:''),reason);}
  if(status==='break'||status==='ongoing'){
   if(!reason)return result('normal-break',status==='break'?'Break':text==='Session ended'?text:'Ongoing');
  }
  const start=Date.parse(e.actualStartTimeUtc||e.livePlayObservedAt||''),observedAt=Date.parse(e.statusCheckedAt||'');
  const started=Number.isFinite(start)&&Number.isFinite(observedAt)&&start<=observedAt;
  const state=status==='delayed'||/^(?:delayed start|start delayed|(?:match )?(?:start|toss) (?:is )?delayed)\b/i.test(text)?'delayed-start':status==='rain-delay'&&!started?'delayed':'suspended';
  const generic=state==='suspended'?'Play suspended':'Delayed';
  // A legacy rain-delay enum is not evidence of rain: some adapters used it
  // for any weather/delay. A reason must be present in the source text.
  return result(state,reason?generic+' · '+reason:generic,reason);
 }
 const unexpected=e=>['delayed-start','delayed','suspended'].includes(interruption(e)?.state);
 function interruptionPresentation(e,now=Date.now()){
  const fact=interruption(e);if(!fact||!interrupted(e)&&e.status!=='ongoing')return null;
  const at=Date.parse(e.restartSourceCheckedAt||''),restart=Date.parse(e.restartTimeUtc||''),confirmed=Boolean(safeUrl(e.restartSourceUrl)&&Number.isFinite(at)&&at<=now&&Number.isFinite(restart));
  let text=fact.state==='delayed-start'?'Start time unconfirmed':'Resume time unconfirmed';
  if(confirmed&&restart<=now)text='Awaiting resumption update';
  if(confirmed&&restart>now){const clock=new Date(restart),format=options=>formatter('en-AU',options),day=format({year:'numeric',month:'2-digit',day:'2-digit'}),year=format({year:'numeric'}),prefix=day.format(clock)!==day.format(new Date(now))?format({weekday:'short',day:'numeric',month:'short',...(year.format(clock)!==year.format(new Date(now))?{year:'numeric'}:{})}).format(clock).replace(/,/g,'')+', ':'';text=(fact.state==='delayed-start'?'Starts at ':'Live again at ')+prefix+format({hour:'numeric',minute:'2-digit',hour12:true}).format(clock);}
  return {...fact,restart:text,restartTimeUtc:confirmed&&restart>now?e.restartTimeUtc:null};
 }
  const canPause=event=>!event.tournamentParent&&!event.majorEventMarker&&!['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType)&&!['completed','finished','final','cancelled','canceled','abandoned','postponed'].includes(event.scheduleStatus)&&['stumps','rain-delay','break','suspended','interrupted','delayed','ongoing'].includes(event.status);
  function pauseReason(event){return canPause(event)?interruption(event)?.label||null:null;}
  function pausePresentation(event, reference = new Date()){
    return canPause(event)?interruptionPresentation(event,+new Date(reference))||null:null;
  }
  const multiDayCricket=event=>/^cricket/.test(event.key||event.sportKey||'')&&(/\b(?:test|first[- ]class)\b/i.test([event.format,event.matchFormat,event.playingFormat].join(' '))||Number.isSafeInteger(event.numberOfDays)&&event.numberOfDays>1);
  function progress(event, reference = new Date(), multiDay = false){
    const statuses=[event.status,event.scheduleStatus].map(value=>String(value||'').toLowerCase());
    const started=statuses.some(value=>/^(live|ongoing|in_progress|in-progress|stumps|rain-delay|break|suspended|interrupted|completed|finished|final)$/.test(value));
    if(!started||statuses.some(value=>/^(cancelled|canceled|abandoned|postponed)$/.test(value)))return null;
    if(multiDay?multiDayCricket(event):/^cricket/.test(event.key||event.sportKey||'')&&/\btest\b/i.test([event.format,event.matchFormat].join(' '))){
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
  function played(event){
    return !event.tournamentParent&&!event.majorEventMarker&&!event.isEditionOverview&&!['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType)&&/^(live|in_progress|in-progress|break|stumps|rain-delay|suspended|interrupted|completed|finished|final|past)$/i.test(event.status||'');
  }
  function actualStart(event, reference=new Date()){
    const proof=event.actualStartEvidence,raw=event.actualStartTimeUtc,start=Date.parse(raw||''),checked=Date.parse(proof?.checkedAt||'');
    if(!played(event)||!proof||proof.kind!=='publisher-reported-match-start'||proof.verified!==true||proof.startsAt!==raw||!Number.isFinite(start)||!Number.isFinite(checked)||start>checked||checked>+new Date(reference)||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw||'')||new Date(raw.slice(0,10)+'T00:00Z').toISOString().slice(0,10)!==raw.slice(0,10)||!/^https:\/\/[^/@\s]+(?:\/|$)/.test(proof.sourceUrl||'')||![event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].includes(proof.fixtureId)||!Array.isArray(proof.participantIds)||!event.participantIds?.length||JSON.stringify([...proof.participantIds].sort())!==JSON.stringify([...event.participantIds].sort()))return null;
    return new Date(start);
  }
  function estimateClock(event, raw){
    const at=Date.parse(raw||'');
    return event.manualStartEstimate?.kind==='official-session-order-estimate'&&Number.isFinite(at)?new Date(Math.round(at/900000)*900000).toISOString():raw;
  }
  function presentation(event, reference = new Date(), {fullRange=false,compactCricket=false} = {}){
    const now = new Date(reference);
    const statuses = [event.status,event.scheduleStatus].map(value => String(value || "").toLowerCase());
    const terminal=statuses.some(value=>['completed','finished','final','cancelled','canceled','abandoned','postponed'].includes(value));
    const compact=compactCricket&&multiDayCricket(event);
    const started=played(event),actual=compact&&!terminal?null:actualStart(event,reference);
    const precision = actual?'actual':event.timePrecision;
    const uncertain = event.timeTbc || event.startTimeTbc;
    const pausedRestart=compact?null:pausePresentation(event,reference)?.restartTimeUtc||null;
    const raw = pausedRestart || (actual?actual.toISOString():precision === "estimated" ? estimateClock(event,event.estimatedStartTimeUtc || event.startTimeUtc) : event.startTimeUtc);
    const parsed = new Date(raw || "");
    const hasTime = (actual||!event.dateOnly&&!uncertain) && (!precision || ["actual","exact","session-start","estimated","not-before"].includes(precision)) && Number.isFinite(+parsed);
    const first = calendarDate(event.date || event.startDate), end = compact?null:calendarDate(event.endDate);
    const date = fullRange && first && end > first ? first : hasTime ? parsed : first;
    const currentDay = dayKey(now);
    const key = date ? dayKey(date) : null;
    const delta = key ? (Date.parse(key) - Date.parse(currentDay)) / 86400000 : null;
    const dated = value => format(value, {weekday:"short", day:"numeric", month:"short", ...(dayKey(value).slice(0,4) !== currentDay.slice(0,4) ? {year:"numeric"} : {})});
    let day = date ? delta === 0 ? "TODAY" : delta > 0 && (delta < 7 || precision==='not-before' && delta===7) ? format(date,{weekday:"short"}) : dated(date) : "DATE UNAVAILABLE";
    if(precision==='not-before'&&hasTime&&delta===0)day='';
    let fullDate = date ? dated(date) : "DATE UNAVAILABLE";
    const range = end && key && dayKey(end) > key;
    if (range){ day = `${dated(date)} – ${dated(end)}`; fullDate += ` – ${dated(end)}`; }
    const clock = hasTime ? format(parsed,{hour:"numeric",minute:"2-digit",hour12:true}).replace(/\s+/g," ") : "";
    const overview=(event.dateOnly||precision==='date-only')&&(event.key==='wrc'||event.cardType==='golf_tournament');
    const settled=/^(completed|finished|final|cancelled|canceled|abandoned)$/.test(event.status||'');
    const windowStart=new Date(event.estimatedEarliestStartTimeUtc||''),windowEnd=new Date(event.estimatedLatestStartTimeUtc||'');
    const windowLabel=precision==='estimated'&&event.manualStartEstimate?.kind!=='official-session-order-estimate'&&Number.isFinite(+windowStart)&&Number.isFinite(+windowEnd)?'APPROX. '+format(windowStart,{hour:'numeric',minute:'2-digit',hour12:true})+' – '+format(windowEnd,{hour:'numeric',minute:'2-digit',hour12:true}):null;
    const sourceProgress=progress(event,reference,compact),progressLabel=compact&&sourceProgress==='DAY UNCONFIRMED'?null:sourceProgress;
    const originalDate=progressLabel&&first;if(originalDate)fullDate=dated(originalDate)+(end>originalDate?' – '+dated(end):'');
    const scheduled=started&&!actual&&!pausedRestart&&!overview&&clock?'SCHEDULED '+(precision==='estimated'?'APPROX. ':precision==='not-before'?'NOT BEFORE ':'')+clock:'';
    const time = actual&&!pausedRestart?'REPORTED START '+clock:scheduled?scheduled:started&&!pausedRestart&&!overview&&!progressLabel?'':progressLabel&&event.dateOnly?'':windowLabel || (overview ? settled?'':event.key==='wrc'?'RALLY DATES':'TOURNAMENT DATES' : precision === "follows" ? "FOLLOWS PRIOR MATCH" : event.dateOnly || uncertain || !clock ? started?'':"TIME TBD" : `${precision === "estimated" ? "APPROX. " : precision === "not-before" ? "NOT BEFORE " : ""}${clock}`);
    const schedule = [day,time].filter(Boolean).join(delta !== null && delta >= 0 && (delta < 7 || precision==='not-before' && delta===7) && !range ? " " : " · ");
    // Venue calendar dates cannot establish Sydney dates without a race start.
    const venueCalendar = !hasTime && event.timingProvenance?.precision === 'venue-calendar' && event.displayDateLabel;
    if(venueCalendar){day=fullDate=event.displayDateLabel;}
    const scheduleLabel = venueCalendar ? [day,time].filter(Boolean).join(' · ') : schedule;
    const fullSchedule = [fullDate,time].filter(Boolean).join(" · ") + (venueCalendar ? started?'':' · Sydney start unavailable' : " (Sydney time)");
    // Explicit source status only: duration heuristics must not claim completion.
    const pause = pauseReason(event);
    let status = "";
    if (statuses.some(value => ["cancelled","canceled"].includes(value))) status = "CANCELLED";
    else if (statuses.includes("postponed")) status = "POSTPONED";
    else if (statuses.includes("abandoned")) status = "ABANDONED";
    else if (statuses.includes("suspended")) status = (pause || "PLAY SUSPENDED").toUpperCase();
    else if (statuses.some(value => ["completed","finished","final"].includes(value))) status = "FINISHED";
    else if(pause)status=pause.toUpperCase();
    else if(statuses.includes("stumps"))status="STUMPS";
    else if(statuses.includes("rain-delay"))status="DELAYED";
    else if(statuses.includes("break"))status="BREAK";
    else if(statuses.includes("ongoing"))status="ONGOING";
    else if (statuses.some(value => ["live","in_progress","in-progress"].includes(value))) status = "LIVE";
    const fact=interruption(event);if(fact&&['cancelled','abandoned','postponed'].includes(fact.state)&&status===fact.state.toUpperCase())status=fact.label.toUpperCase();
    if (tournamentPhase(event)) status = 'IN PROGRESS';
    const odi=typeof module==='object'&&module.exports?require('./odi-display'):globalThis.NOTHINGSPORTS_ODI_DISPLAY;
    if(odi?.awaiting(event,reference))status=odi.label;
    const controls=typeof module==='object'&&module.exports?require('./feed-controls'):globalThis.NOTHINGSPORTS_FEED_CONTROLS;
    const observed=controls?.timingState(event,reference);
    if(observed?.key==='half-time')status='HALF-TIME';
    const isUnexpected=unexpected(event);
    if(observed?.key==='awaiting-update'&&!isUnexpected&&!terminal)status=observed.label;
    const freshness=event.stale===true||event.sourceStale===true?'Awaiting update':!terminal&&observed?.key==='awaiting-update'?observed.label:null;
    if(status==='LIVE'&&freshness)status='LAST REPORTED LIVE';
    return Object.freeze({...(compact?{compactCricket:true}:{}),day:compact?progressLabel||'':fullRange&&range?day:progressLabel|| (precision==='not-before'?day:venueCalendar?day:date?(range?day:dated(date)):'DATE UNAVAILABLE'),time,label:status || scheduleLabel, primary:status || (range || event.dateOnly ? scheduleLabel : time), status, freshness, schedule:progressLabel||scheduleLabel, fullSchedule, progress:progressLabel, ariaLabel:[progressLabel,status ? `${status}. ${started?'':'Scheduled '}${fullSchedule}` : fullSchedule].filter(Boolean).join('. ')});
  }
  // One pure view for construction and live patches; DOM remains with callers.
  function badgePresentation(event,reference=new Date(),options={}){
    const value=presentation(event,reference,options),pause=pausePresentation(event,reference),pausedClock=!value.compactCricket&&pause&&(event.key==='cricket'&&value.progress||pause.restartTimeUtc);
    const terminal=/^(FINISHED|CANCELLED|ABANDONED|POSTPONED)\b/.test(value.status);
    const restart=value.compactCricket&&pause&&(pause.restartTimeUtc||pause.restart==='Awaiting resumption update')?pause.restart:null;
    return Object.freeze({...value,pause,badgeClock:value.compactCricket&&pause?restart||'':terminal&&!value.time.startsWith('REPORTED START ')?'':pausedClock?[pause.label.toUpperCase(),pause.restart].join(' • '):value.time,badgeStatus:value.compactCricket?value.status:pausedClock?'':pause&&value.freshness?pause.label.toUpperCase():value.status,badgeFreshness:pause||value.status==='LAST REPORTED LIVE'?value.freshness:null,ariaLabel:[pause&&value.freshness?pause.label:null,pausedClock?pause.restart:restart,value.ariaLabel,'Open fixture'].filter(Boolean).join('. ')});
  }
  function minimised(event, reference = new Date()){
    const value=presentation(event,reference),pause=pausePresentation(event,reference);
    const clock=raw=>formatter('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(raw));
    const restart=Date.parse(pause?.restartTimeUtc||'');
    const actual=actualStart(event,reference);
    const started=played(event),raw=event.timePrecision==='estimated'?estimateClock(event,event.estimatedStartTimeUtc||event.startTimeUtc):event.startTimeUtc;
    let time=actual&&!pause?'REPORTED START '+clock(actual)+(value.status?' · '+value.status:''):started&&!pause?[value.time?'SCHEDULED '+(event.timePrecision==='estimated'?'APPROX. ':event.timePrecision==='not-before'?'NOT BEFORE ':'')+clock(raw):'',value.status].filter(Boolean).join(' · '):value.status;
    if(pause&&!/^(FINISHED|CANCELLED|POSTPONED|ABANDONED)$/.test(time)){
      const suffix=Number.isFinite(restart)&&restart>+new Date(reference)?clock(restart):pause.restart==='Awaiting resumption update'||/awaiting/i.test(value.status)?'AWAITING UPDATE':'TIME UNAVAILABLE';
      time=pause.label.toUpperCase()+' · '+suffix;
    }else if(/awaiting/i.test(time))time='AWAITING UPDATE';
    if(!time&&!started){
      const known=!event.dateOnly&&!event.timeTbc&&!event.startTimeTbc&&(!event.timePrecision||['exact','session-start','estimated','not-before'].includes(event.timePrecision))&&Number.isFinite(Date.parse(raw||''));
      time=known?(event.timePrecision==='not-before'?'NB ':event.timePrecision==='estimated'?'APPROX. ':'')+clock(raw):event.timePrecision==='follows'?'FOLLOWS':'TIME TBD';
    }
    const overview=event.tournamentParent||event.isEditionOverview||event.majorEventMarker||['tennis_parent','golf_tournament','tournament_overview'].includes(event.cardType);
    if(overview&&!value.progress){
      const date=calendarDate(event.date||event.startDate),end=calendarDate(event.endDate);
      const short=day=>format(day,{day:'numeric',month:'short'});
      time=(date?short(date)+(end&&dayKey(end)!==dayKey(date)?'–'+short(end):''):'DATE UNAVAILABLE')+(value.status?' · '+value.status:'');
    }
    const ariaLabel=[value.ariaLabel,pause?[pause.label,pause.restart].join('. '):''].filter(Boolean).join('. ');
    return Object.freeze({...value,time,ariaLabel});
  }
  function dateOnlyLabel(event){
    if(['completed','finished','final'].includes(event.status))return 'Completed';
    return event.eventType==='match'||event.timingProvenance?.precision==='venue-calendar'?'Time TBD':String(event.displayTime||'Session times vary').replace(/\b(?:TBC|unavailable)\b/gi,'TBD');
  }
  return Object.freeze({interruption,unexpected,interruptionPresentation,presentation,badgePresentation,minimised,tournamentPhase,dateOnlyLabel,pausePresentation,pauseReason,progress,played,actualStart,estimateClock});
});
