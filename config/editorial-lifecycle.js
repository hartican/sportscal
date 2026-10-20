(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./epic-classics'):root.NOTHINGSPORTS_EPIC);root.NOTHINGSPORTS_EDITORIAL_LIFECYCLE=api;if(typeof module!=='undefined')module.exports=api;})(globalThis,function(epic){
 'use strict';
 const completed=e=>['completed','finished','final','past'].includes(String(e?.status).toLowerCase());
 const signature=e=>JSON.stringify([completed(e)?'completed':e?.status||'',e?.outcomeText||'',e?.scoreDisplay||e?.score||'',e?.recapText||'']);
 const completionCopy=(event,text='Reveal results for the outcome.')=>`${event.displayTitleCompact||event.name||'This fixture'} is complete. ${text}`;
 function copy(event,narrative={},spoilers=false){
  const ongoing=epic.liveContext(event);if(ongoing&&spoilers)return {hook:ongoing.hook,synopsis:ongoing.body};
  if(epic.completed(event)&&event.postMatchEditorial?.body&&event.postMatchEditorial.factsSignature===epic.factsSignature(event))return spoilers?{hook:event.postMatchEditorial.hook,synopsis:event.postMatchEditorial.body}:{hook:completionCopy(event),synopsis:''};
  if(!completed(event)||event.key==='horse-racing'||event.sportKey==='horse-racing')return {hook:narrative.hook||'',synopsis:narrative.synopsis||''};
  const safe=completionCopy(event);
  const current=narrative.resultSignature===signature(event);
  if(!spoilers)return {hook:current&&narrative.phase==='recap'?narrative.hook||safe:safe,synopsis:current&&narrative.phase==='recap'?narrative.synopsis||'':''};
  const hook=event.outcomeText||event.scoreDisplay||event.score||(current?narrative.hookSpoilerOn:'')||completionCopy(event,'Result not yet available.');
  const synopsis=current?narrative.synopsisSpoilerOn||event.recapText||'':event.recapText||'';
  return {hook:String(hook),synopsis:String(synopsis)};
 }
 function distinct(copy,earlier=[]){
  const words=s=>new Set(String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','was','with','match'].includes(w)));
  const sentences=s=>String(s||'').match(/(?:[^.!?]|\.(?=\d))+[.!?]*/g)||[];
  const seen=earlier.flatMap(sentences).map(words);
  return sentences(copy).filter(s=>{const a=words(s);if(!a.size)return false;const duplicate=seen.some(b=>{let common=0;for(const w of a)if(b.has(w))common++;return common/Math.max(a.size,b.size)>=0.72;});if(!duplicate)seen.push(a);return !duplicate;}).join(' ').replace(/\s+/g,' ').trim();
 }
 return {completed,signature,copy,distinct};
});
