(function(root,factory){const api=factory();root.NOTHINGSPORTS_AUSTRALIAN_DATES=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
'use strict';
function date(value,{year=false,reference=new Date()}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 'DATE UNAVAILABLE';
 const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(+d))return 'DATE UNAVAILABLE';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric'}).formatToParts(d).map(p=>[p.type,p.value]));
 const current=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric'}).format(reference);
 return `${parts.weekday} ${parts.day} ${parts.month.replace('Sept','Sep')}${year||parts.year!==current?' '+parts.year:''}`.toUpperCase();
}
function numeric(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'DATE UNAVAILABLE';}
function programme(record){
  if (!record?.startDate || record.dateStatus === "tbc") return "Dates unavailable";
  const formatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const start = new Date(`${record.startDate}T00:00:00Z`),end = new Date(`${record.endDate||record.startDate}T00:00:00Z`);
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<start||start.toISOString().slice(0,10)!==record.startDate||end.toISOString().slice(0,10)!==(record.endDate||record.startDate))return 'Dates unavailable';
  let basis='Time zone unconfirmed';try{new Intl.DateTimeFormat('en-AU',{timeZone:record.timezone||''});basis=record.timezone.split('/').at(-1).replaceAll('_',' ')+' dates';}catch{}
  return (record.endDate&&record.endDate!==record.startDate?formatter.formatRange(start,end):formatter.format(start))+' · '+basis;
}
return {date,numeric,programme};
});
