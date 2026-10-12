(function(root, factory){
  const api=factory(typeof module==='object'&&module.exports?require('./calendar-export'):root.NOTHINGSPORTS_CALENDAR);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NOTHINGSPORTS_CALENDAR_ICS=api;
})(globalThis,function(calendar){
  'use strict';
  const {idFor,eventStart,knownDate,uniqueEvents}=calendar;
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
      lines.push(`SUMMARY:${escape(event.calendarTemplate?.title || event.name || event.title)}`,`LOCATION:${escape(event.venue || event.location)}`,`DESCRIPTION:${escape([event.timePrecision==='estimated'?'Approximate start; follows the prior match and may change.':event.timePrecision==='follows'?'Start follows the prior match; exact time is unconfirmed.':null,event.broadcaster, event.sourceAttribution?.provider==='OpenLigaDB'?'Data from OpenLigaDB under ODbL: https://opendatacommons.org/licenses/odbl/1-0/ ; dataset: https://nothingsport.vercel.app/data/providers/openligadb/football-2026-27.json':null, event.delayedResultSource?.attribution, 'Nothing Sport'].filter(Boolean).join('\n'))}`);
      const updated=event.updatedAt || event.sourceCheckedAt;
      if (updated && Number.isFinite(Date.parse(updated))) lines.push(`LAST-MODIFIED:${stamp(updated)}`);
      if (/cancelled|canceled/i.test(event.status || event.lifecycleStatus || '')) lines.push('STATUS:CANCELLED');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
  }
  return {buildIcs};
});
