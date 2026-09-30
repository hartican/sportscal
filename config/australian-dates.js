(function(root,factory){const api=factory();root.NOTHINGSPORTS_AUSTRALIAN_DATES=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
'use strict';
function date(value,{year=false,reference=new Date()}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 'DATE TBC';
 const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(+d))return 'DATE TBC';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric'}).formatToParts(d).map(p=>[p.type,p.value]));
 const current=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric'}).format(reference);
 return `${parts.weekday} ${parts.day} ${parts.month.replace('Sept','Sep')}${year||parts.year!==current?' '+parts.year:''}`.toUpperCase();
}
function numeric(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'DATE TBC';}
return {date,numeric};
});
