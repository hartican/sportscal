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
    return Number.isFinite(+date) ? date : null;
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
  function presentation(event, reference = new Date()){
    const now = new Date(reference);
    const precision = event.timePrecision;
    const uncertain = event.timeTbc || event.startTimeTbc;
    const raw = precision === "estimated" ? event.estimatedStartTimeUtc || event.startTimeUtc : event.startTimeUtc;
    const parsed = new Date(raw || "");
    const hasTime = !event.dateOnly && !uncertain && (!precision || ["exact","session-start","estimated","not-before"].includes(precision)) && Number.isFinite(+parsed);
    const date = hasTime ? parsed : calendarDate(event.date || event.startDate);
    const currentDay = dayKey(now);
    const key = date ? dayKey(date) : null;
    const delta = key ? (Date.parse(key) - Date.parse(currentDay)) / 86400000 : null;
    const dated = value => format(value, {weekday:"short", day:"numeric", month:"short", ...(dayKey(value).slice(0,4) !== currentDay.slice(0,4) ? {year:"numeric"} : {})});
    let day = date ? delta === 0 ? "TODAY" : delta > 0 && delta < 7 ? format(date,{weekday:"short"}) : dated(date) : "DATE TBC";
    let fullDate = date ? dated(date) : "DATE TBC";
    const end = calendarDate(event.endDate);
    const range = end && key && dayKey(end) !== key;
    if (range){ day = `${dated(date)} – ${dated(end)}`; fullDate += ` – ${dated(end)}`; }
    const clock = hasTime ? format(parsed,{hour:"numeric",minute:"2-digit",hour12:true}).replace(/\s+/g," ") : "";
    const overview=(event.dateOnly||precision==='date-only')&&(event.key==='wrc'||event.cardType==='golf_tournament');
    const settled=/^(completed|finished|final|cancelled|canceled|abandoned)$/.test(event.status||'');
    const time = overview ? settled?'':event.key==='wrc'?'RALLY DATES':'TOURNAMENT DATES' : precision === "follows" ? "FOLLOWS PRIOR MATCH" : event.dateOnly || uncertain || !clock ? "TIME TBC" : `${precision === "estimated" ? "APPROX. " : precision === "not-before" ? "NOT BEFORE " : ""}${clock}`;
    const schedule = [day,time].filter(Boolean).join(delta !== null && delta >= 0 && delta < 7 && !range ? " " : " · ");
    // Venue calendar dates cannot establish Sydney dates without a race start.
    const venueCalendar = !hasTime && event.timingProvenance?.precision === 'venue-calendar' && event.displayDateLabel;
    if(venueCalendar){day=fullDate=event.displayDateLabel;}
    const scheduleLabel = venueCalendar ? [day,time].join(' · ') : schedule;
    const fullSchedule = [fullDate,time].filter(Boolean).join(" · ") + (venueCalendar ? ' · Sydney start TBC' : " (Sydney time)");
    // Explicit source status only: duration heuristics must not claim completion.
    const statuses = [event.status,event.scheduleStatus].map(value => String(value || "").toLowerCase());
    let status = "";
    if (statuses.some(value => ["cancelled","canceled"].includes(value))) status = "CANCELLED";
    else if (statuses.includes("postponed")) status = "POSTPONED";
    else if (statuses.includes("abandoned")) status = "ABANDONED";
    else if (statuses.includes("suspended")) status = "SUSPENDED";
    else if (statuses.some(value => ["completed","finished","final"].includes(value))) status = "FINISHED";
    else if(statuses.includes("ongoing"))status="ONGOING";
    else if (statuses.some(value => ["live","in_progress","in-progress"].includes(value))) status = "LIVE";
    if (tournamentPhase(event)) status = 'IN PROGRESS';
    const odi=typeof module==='object'&&module.exports?require('./odi-display'):globalThis.NOTHINGSPORTS_ODI_DISPLAY;
    if(odi?.awaiting(event,reference))status=odi.label;
    const controls=typeof module==='object'&&module.exports?require('./feed-controls'):globalThis.NOTHINGSPORTS_FEED_CONTROLS;
    const observed=controls?.timingState(event,reference);
    if(observed?.key==='awaiting-update')status=observed.label;
    return Object.freeze({day:venueCalendar?day:date?(range?day:dated(date)):'DATE TBC',time,label:status || scheduleLabel, primary:status || (range || event.dateOnly ? scheduleLabel : time), status, schedule:scheduleLabel, fullSchedule, ariaLabel:status ? `${status}. Scheduled ${fullSchedule}` : fullSchedule});
  }
  function dateOnlyLabel(event){
    if(['completed','finished','final'].includes(event.status))return 'Completed';
    return event.eventType==='match'||event.timingProvenance?.precision==='venue-calendar'?'Time TBC':event.displayTime||'Session times vary';
  }
  return Object.freeze({presentation,tournamentPhase,dateOnlyLabel});
});
