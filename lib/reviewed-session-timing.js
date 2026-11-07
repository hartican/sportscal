'use strict';
const assert=require('node:assert/strict');
const fields=['date','time','startTimeUtc','endTimeUtc','endTimeBasis','timingProvenance'];
const aliases=record=>[record.id,record.eventId,record.canonicalEventId,...(record.sourceEventIds||[])].filter(Boolean);
function validate(rows=[],reference=new Date()){
  assert(Array.isArray(rows),'Reviewed timings must be an array');
  const seen=new Set();
  for(const row of rows){
    assert(row&&typeof row==='object'&&!Array.isArray(row),'Invalid reviewed timing');
    assert(Object.keys(row).every(key=>['id','canonicalId',...fields].includes(key)),'A timing review cannot change results, identity or participation');
    for(const id of [row.id,row.canonicalId]){assert(typeof id==='string'&&id&&!seen.has(id),'Missing/duplicate reviewed timing identity');seen.add(id);}
    assert(/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&/^\d{2}:\d{2}$/.test(row.time),'Missing reviewed date/time');
    const start=Date.parse(row.startTimeUtc),end=Date.parse(row.endTimeUtc),checked=Date.parse(row.timingProvenance?.checkedAt);
    for(const value of [row.startTimeUtc,row.endTimeUtc,row.timingProvenance?.checkedAt])assert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'Timing timestamps must be ISO instants');
    assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000,'Invalid reviewed session window');
    assert(row.endTimeBasis==='official-session-window'&&row.timingProvenance?.kind==='official','Session window must be explicit official evidence');
    assert(Number.isFinite(checked)&&checked<=Number(reference)&&checked>=end,'Invalid/future historical timing observation');
    const url=new URL(row.timingProvenance.sourceUrl);
    assert(url.protocol==='https:'&&['sailgp.com','mediahub.sailgp.com'].includes(url.hostname)&&!url.username&&!url.password&&!url.search&&!url.hash,'Invalid reviewed timing source');
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(start)).map(p=>[p.type,p.value]));
    assert.equal(row.date,`${parts.year}-${parts.month}-${parts.day}`,'Reviewed date disagrees with Sydney start');
    assert.equal(row.time,`${parts.hour}:${parts.minute}`,'Reviewed clock disagrees with Sydney start');
  }
  return rows;
}
function apply(records,rows,{required=false}={}){
  const matched=new Map();
  const next=records.map(record=>{
    const matches=rows.filter(row=>aliases(record).some(id=>id===row.id||id===row.canonicalId));
    assert(matches.length<=1,'Ambiguous reviewed session identity');
    if(!matches.length)return record;
    const row=matches[0];matched.set(row.id,(matched.get(row.id)||0)+1);
    assert.equal(record.date,row.date,'Historical timing review cannot move a fixture date');
    const prior=Date.parse(record.timingProvenance?.checkedAt);
    if(prior>Date.parse(row.timingProvenance.checkedAt))return record;
    const patch=Object.fromEntries(fields.map(key=>[key,row[key]]));
    const changed=fields.some(key=>JSON.stringify(record[key])!==JSON.stringify(patch[key]));
    if(prior===Date.parse(row.timingProvenance.checkedAt))assert(!changed,'Conflicting timing at the same observation');
    return changed?{...record,...patch}:record;
  });
  for(const row of rows)assert(required?matched.get(row.id)===1:(matched.get(row.id)||0)<=1,'Missing/duplicate reviewed session in retained records: '+row.id);
  return next;
}
module.exports={validate,apply,fields};
