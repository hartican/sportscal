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
  function presentation(event, reference = new Date()){
    const now = new Date(reference);
    const precision = event.timePrecision;
    const uncertain = event.timeTbc || event.startTimeTbc;
    const raw = precision === "estimated" ? event.estimatedStartTimeUtc || event.startTimeUtc : event.startTimeUtc;
    const parsed = new Date(raw || "");
    const hasTime = !event.dateOnly && !uncertain && (!precision || ["exact","session-start","estimated"].includes(precision)) && Number.isFinite(+parsed);
    const date = hasTime ? parsed : calendarDate(event.date || event.startDate);
    const currentDay = dayKey(now);
    const key = date ? dayKey(date) : null;
    const delta = key ? (Date.parse(key) - Date.parse(currentDay)) / 86400000 : null;
    const dated = value => format(value, {weekday:"short", day:"numeric", month:"short", ...(dayKey(value).slice(0,4) !== currentDay.slice(0,4) ? {year:"numeric"} : {})});
    let day = date ? delta === 0 ? "TODAY" : delta > 0 && delta < 7 ? format(date,{weekday:"short"}) : dated(date) : "DATE TBC";
    let fullDate = date ? format(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : "DATE TBC";
    const end = calendarDate(event.endDate);
    const range = end && key && dayKey(end) !== key;
    if (range){ day = `${dated(date)} – ${dated(end)}`; fullDate += ` – ${format(end,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}`; }
    const clock = hasTime ? format(parsed,{hour:"numeric",minute:"2-digit",hour12:true}).replace(/\s+/g," ") : "";
    const time = precision === "follows" ? "FOLLOWS PRIOR MATCH" : event.dateOnly ? "" : uncertain || !clock ? "TIME TBC" : `${precision === "estimated" ? "APPROX. " : ""}${clock}`;
    const schedule = [day,time].filter(Boolean).join(delta !== null && delta >= 0 && delta < 7 && !range ? " " : " · ");
    const fullSchedule = [fullDate,time].filter(Boolean).join(" · ") + " (Sydney time)";
    // Explicit source status only: duration heuristics must not claim completion.
    const statuses = [event.status,event.scheduleStatus].map(value => String(value || "").toLowerCase());
    let status = "";
    if (statuses.some(value => ["cancelled","canceled"].includes(value))) status = "CANCELLED";
    else if (statuses.includes("postponed")) status = "POSTPONED";
    else if (statuses.some(value => ["completed","finished","final"].includes(value))) status = "FINISHED";
    else if (statuses.some(value => ["live","in_progress","in-progress","ongoing"].includes(value))) status = "LIVE";
    return Object.freeze({label:status || schedule, primary:status || (range || event.dateOnly ? schedule : time), status, schedule, fullSchedule, ariaLabel:status ? `${status}. Scheduled ${fullSchedule}` : fullSchedule});
  }
  return Object.freeze({presentation});
});
