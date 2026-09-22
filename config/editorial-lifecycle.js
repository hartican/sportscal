(function(root,factory){const api=factory();root.NOTHINGSPORTS_EDITORIAL_LIFECYCLE=api;if(typeof module!=='undefined')module.exports=api;})(globalThis,function(){
 'use strict';
 const completed=e=>['completed','finished','final'].includes(String(e?.status).toLowerCase());
 const signature=e=>JSON.stringify([e?.status||'',e?.outcomeText||'',e?.scoreDisplay||e?.score||'',e?.recapText||'']);
 function copy(event,narrative={},spoilers=false){
  if(!completed(event))return {hook:narrative.hook||'',synopsis:narrative.synopsis||''};
  const safe=`${event.displayTitleCompact||event.name||'This fixture'} is complete. Reveal results for the outcome.`;
  const current=narrative.resultSignature===signature(event);
  if(!spoilers)return {hook:current&&narrative.phase==='recap'?narrative.hook||safe:safe,synopsis:current&&narrative.phase==='recap'?narrative.synopsis||'':''};
  const hook=event.outcomeText||event.scoreDisplay||event.score||(current?narrative.hookSpoilerOn:'')||safe;
  const synopsis=current?narrative.synopsisSpoilerOn||event.recapText||'':event.recapText||'';
  return {hook:String(hook),synopsis:String(synopsis)};
 }
 function distinct(copy,earlier=[]){
  const words=s=>new Set(String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','was','with','match'].includes(w)));
  const seen=earlier.flatMap(s=>String(s||'').match(/[^.!?]+[.!?]*/g)||[]);
  return (String(copy||'').match(/[^.!?]+[.!?]*/g)||[]).filter(s=>{const a=words(s);if(!a.size)return false;const duplicate=seen.some(v=>{const b=words(v);let common=0;for(const w of a)if(b.has(w))common++;return common/Math.max(a.size,b.size)>=0.72;});if(!duplicate)seen.push(s);return !duplicate;}).join(' ').replace(/\s+/g,' ').trim();
 }
 return {completed,signature,copy,distinct};
});
