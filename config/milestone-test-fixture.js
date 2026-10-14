(function(root,factory){const api=factory(root);root.NOTHINGSPORTS_MILESTONE_TEST_FIXTURE=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
 'use strict';
 const coverage=root.NOTHINGSPORTS_CRICKET_COVERAGE||(typeof require==='function'?require('./cricket-coverage'):null);
 function supported(e){return Boolean(e&&/^cricket(?:-women)?$/.test(e.key||'')&&[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].some(id=>/^fixture:cricket:CA:\d+$/.test(id||''))&&coverage?.allowed(e));}
 function active(e,now=Date.now()){
  if(!supported(e)||e.status!=='live'||e.cricketPhaseConfirmed!==true||e.stale===true||e.sourceStale===true||!Array.isArray(e.innings)||new Set(e.innings.map(i=>i.inningNumber)).size!==e.innings.length)return false;
  const latest=[...e.innings].sort((a,b)=>a.inningNumber-b.inningNumber).at(-1),checked=Date.parse(latest?.detailCheckedAt||'');
  return latest?.detailStale!==true&&Number.isFinite(checked)&&checked<=+now&&+now-checked<=240000;
 }
 function select(events,now=Date.now()){const known=(events||[]).filter(supported);return known.find(e=>active(e,now))||known[0]||null;}
 return {supported,active,select};
});
