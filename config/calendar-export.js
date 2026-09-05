(function(root, factory){
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NOTHINGSPORTS_CALENDAR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const idFor = event => String(event.canonicalEventId || event.eventId || event.id || '').toLowerCase().replace(/[:_]+/g,'-');
  function sydneyDay(now = new Date()){
    return new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
  }
  const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
  function eventStart(event){
    if(event.dateStatus==='tbc' || event.timeTbc || event.startTimeTbc || event.dateOnly)return null;
    const explicit = event.startTimeUtc || event.startsAt;
    if (explicit && Number.isFinite(Date.parse(explicit))) return new Date(explicit);
    const date = event.date || event.startDate;
    if (!validDay(date) || !/^\d{2}:\d{2}$/.test(event.time || '')) return null;
    const target = Date.parse(`${date}T${event.time}:00Z`);
    let estimate = target - 10 * 3600000;
    for (let i=0; i<3; i++){
      const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(estimate));
      const p = Object.fromEntries(parts.map(part => [part.type,part.value]));
      estimate += target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    }
    return new Date(estimate);
  }
  const knownDate = event => event.dateStatus!=='tbc' && Boolean(eventStart(event) || validDay(event.startDate || event.date));
  function escape(value){ return String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,'); }
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  function fold(line){
    const encoder = new TextEncoder();
    let result='', chunk='', bytes=0;
    for (const char of line){
      const size=encoder.encode(char).length;
      if (bytes+size>75){result+=chunk+'\r\n';chunk=' ';bytes=1;}
      chunk+=char;bytes+=size;
    }
    return result+chunk;
  }
  function uniqueEvents(events){
    const seen = new Set();
    return events.filter(event => {
      const id=idFor(event);
      if (!id || seen.has(id) || event.kind === 'ticket_sale') return false;
      seen.add(id);return true;
    });
  }
  function buildIcs(events, {now=new Date(), name='Nothing Sport'}={}){
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Nothing Sport//Calendar//EN','CALSCALE:GREGORIAN',`X-WR-CALNAME:${escape(name)}`,'X-WR-TIMEZONE:Australia/Sydney','REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
    const parents=new Set(events.filter(event=>['major_event','tournament'].includes(event.kind)).map(event=>String(event.id)));
    for (const event of uniqueEvents(events).filter(knownDate).filter(event=>!parents.has(event.parentEventId || event.majorEventId) || ['major_event','tournament'].includes(event.kind))){
      const start=eventStart(event);
      const date=event.startDate || event.date;
      lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(idFor(event))}@nothingsport.app`,`DTSTAMP:${stamp(now)}`);
      if (start){
        const explicitEnd=event.endTimeUtc || event.endsAt;
        const end=explicitEnd && Number.isFinite(Date.parse(explicitEnd)) ? new Date(explicitEnd) : new Date(+start+Math.max(.25, Number(event.liveWindow) || 3)*3600000);
        lines.push(`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`);
      } else {
        const end=new Date(`${event.endDate || date}T00:00:00Z`);end.setUTCDate(end.getUTCDate()+1);
        lines.push(`DTSTART;VALUE=DATE:${date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replace(/-/g,'')}`);
      }
      lines.push(`SUMMARY:${escape(event.calendarTemplate?.title || event.name || event.title)}`,`LOCATION:${escape(event.venue || event.location)}`,`DESCRIPTION:${escape([event.broadcaster, 'Nothing Sport'].filter(Boolean).join('\n'))}`);
      const updated=event.updatedAt || event.sourceCheckedAt;
      if (updated && Number.isFinite(Date.parse(updated))) lines.push(`LAST-MODIFIED:${stamp(updated)}`);
      if (/cancelled|canceled/i.test(event.status || event.lifecycleStatus || '')) lines.push('STATUS:CANCELLED');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
  }
  function selectedEvents(events, eligibleIds, selection={}){
    const included=new Set(selection.includedIds || []), excluded=new Set(selection.excludedIds || []), eligible=new Set(eligibleIds);
    return uniqueEvents(events).filter(event=>!excluded.has(idFor(event)) && (included.has(idFor(event)) || eligible.has(idFor(event))));
  }
  return {idFor, sydneyDay, eventStart, knownDate, uniqueEvents, buildIcs, selectedEvents};
});
