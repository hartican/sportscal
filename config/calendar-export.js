(function(root, factory){
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CALENDAR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const idFor = event => String(event.canonicalEventId || event.eventId || event.id || '').toLowerCase().replace(/[:_]+/g,'-');
  const LEGACY_SELECTION_IDS=Object.freeze({
    'calendar-nothingsport-manual-seed-rally-wrc-safari-2027':'event-wrc-2026-round-03',
    'calendar-nothingsport-manual-seed-rally-paris-dakar-stage-11-2026':null,
  });
  function migrateSelectionIds(values){return [...new Set((Array.isArray(values)?values:[]).map(value=>LEGACY_SELECTION_IDS[String(value)]===undefined?String(value):LEGACY_SELECTION_IDS[String(value)]).filter(Boolean))];}
  const sydneyDayFormatter = new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"});
  const sydneyTimeFormatter = new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  function sydneyDay(now = new Date()){ return sydneyDayFormatter.format(now); }
  const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
  function eventStart(event){
    if(event.timePrecision==='estimated'&&Number.isFinite(Date.parse(event.estimatedStartTimeUtc)))return new Date(event.estimatedStartTimeUtc);
    if(event.dateStatus==='tbc' || event.timePrecision==='follows' || event.timeTbc || event.startTimeTbc || event.dateOnly)return null;
    const explicit = event.startTimeUtc || event.startsAt;
    if (explicit && Number.isFinite(Date.parse(explicit))) return new Date(explicit);
    const date = event.date || event.startDate;
    if (!validDay(date) || !/^\d{2}:\d{2}$/.test(event.time || '')) return null;
    const target = Date.parse(`${date}T${event.time}:00Z`);
    let estimate = target - 10 * 3600000;
    for (let i=0; i<3; i++){
      const parts = sydneyTimeFormatter.formatToParts(new Date(estimate));
      const p = Object.fromEntries(parts.map(part => [part.type,part.value]));
      estimate += target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    }
    return new Date(estimate);
  }
  const knownDate = event => event.dateStatus!=='tbc' && Boolean(eventStart(event) || validDay(event.startDate || event.date));
  function uniqueEvents(events){
    const seen = new Set();
    return events.filter(event => {
      const id=idFor(event);
      if (!id || seen.has(id) || event.kind === 'ticket_sale') return false;
      seen.add(id);return true;
    });
  }
  function buildIcs(events, options){
    const encoder = typeof module === 'object' && module.exports ? require('./calendar-ics') : globalThis.NOTHINGSPORTS_CALENDAR_ICS;
    return encoder.buildIcs(events, options);
  }
  function selectedEvents(events, eligibleIds, selection={}){
    const included=new Set(migrateSelectionIds(selection.includedIds)), excluded=new Set(migrateSelectionIds(selection.excludedIds)), eligible=new Set(migrateSelectionIds(eligibleIds));
    return uniqueEvents(events).filter(event=>!excluded.has(idFor(event)) && (included.has(idFor(event)) || eligible.has(idFor(event))));
  }
  const api={idFor, sydneyDay, eventStart, knownDate, uniqueEvents, buildIcs};
  if(typeof module==='object'&&module.exports){api.selectedEvents=selectedEvents;api.migrateSelectionIds=migrateSelectionIds;}
  return api;
});
