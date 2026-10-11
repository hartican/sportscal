(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_GOLF_SCORES=api;})(globalThis,function(){
 'use strict';
 const rows=(event,followed)=>((event.score?.golf?.rows)||event.roundScores||[]).filter(r=>r&&typeof r.name==='string'&&followed(r.participantId));
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 function mount(slot,event,{followed,visible=true}={}){
  if(!visible){slot.replaceChildren();delete slot.dataset.golfScoreKey;return;}
  const data=rows(event,followed),key=JSON.stringify([data,event.scoreCheckedAt,event.sourceStale]);if(slot.children.length&&slot.dataset.golfScoreKey===key)return;slot.dataset.golfScoreKey=key;
  if(!data.length){slot.replaceChildren(node('p','No followed golfers have scores in this field.'));return;}
  globalThis.NOTHINGSPORTS_SCORE_DETAILS?.styles();
  const rounds=Math.max(...data.map(r=>r.rounds?.length||0));let table=slot.querySelector('table');
  if(!table||table.dataset.rounds!==String(rounds)){
   const wrap=node('div');wrap.className='mc-score-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Followed golf scores');table=node('table');table.className='mc-score-table';table.dataset.rounds=rounds;table.append(node('caption','Followed round scores'));const head=node('thead'),header=node('tr');
   for(const title of ['Golfer','Position','Total',...Array.from({length:rounds},(_,i)=>'R'+(i+1)),'Thru']){const cell=node('th',title);cell.scope='col';header.append(cell);}head.append(header);table.append(head,node('tbody'));wrap.append(table);slot.replaceChildren(wrap,node('small'));
  }
  const body=table.tBodies[0],keep=new Set(data.map(r=>r.participantId));for(const row of [...body.rows])if(!keep.has(row.dataset.golfParticipant))row.remove();
  data.forEach((r,index)=>{let tr=[...body.rows].find(row=>row.dataset.golfParticipant===r.participantId);if(!tr){tr=node('tr');tr.dataset.golfParticipant=r.participantId;for(let i=0;i<rounds+4;i++){const cell=node(i?'td':'th');if(!i)cell.scope='row';tr.append(cell);}}const values=[r.name,r.position,r.total,...Array.from({length:rounds},(_,i)=>r.rounds?.[i]??'—'),r.thru??'—'];values.forEach((value,i)=>{if(tr.children[i].textContent!==String(value??'—'))tr.children[i].textContent=value??'—';});if(body.children[index]!==tr)body.insertBefore(tr,body.children[index]||null);});
  const stamp=event.scoreCheckedAt||data[0].sourceCheckedAt;slot.querySelector('small').textContent=((event.sourceStale||data.some(r=>r.stale))?'Last available scores':'Score source update')+(stamp?' · '+new Date(stamp).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'');
 }
 return {rows,mount};
});
