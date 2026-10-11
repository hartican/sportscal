(function(root,factory){const api=factory();root.NOTHINGSPORTS_RACING_DETAILS=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const views=new WeakMap(),cache=new Map(),requests=new Map();
const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const lap=value=>Number.isFinite(value)&&value>0?`${Math.floor(value/60)}:${(value%60).toFixed(4).padStart(7,'0')}`:'';
const columns=[['Pos','position'],['Car','number'],['Drivers','drivers'],['Current driver','currentDriver'],['Team','team'],['Laps','laps'],['Gap','gap'],['Last lap','lastLap'],['Best lap','bestLap'],['S1','sector1'],['S2','sector2'],['S3','sector3'],['Tyre','tyre'],['Pit stops','pitStops'],['Pit state','pitState']];
const horseColumns=[['Finish','position'],['No.','number'],['Horse','name'],['Jockey','jockey'],['Trainer','trainer'],['Barrier','barrier'],['Weight','weight'],['Form','form'],['Scratchings','scratching'],['Margin','margin']];
function styles(){if(document.querySelector('[data-racing-details-style]'))return;const l=node('link');l.rel='stylesheet';l.href='assets/styles/racing-details.css?v=491';l.dataset.racingDetailsStyle='';document.head.append(l);}
function summary(detail,now=Date.now()){
 if(!detail)return '';
 if(detail.kind==='horse')return [detail.statusText,`${detail.entryCount??detail.entries?.length??0} entries`,detail.raceTime?'Race time '+detail.raceTime:null].filter(Boolean).join(' · ');
 if(detail.kind==='classification')return [detail.leader?.drivers?.join(' / '),detail.statusText].filter(Boolean).join(' · ');
 const leader=detail.entries?.[0]||detail.leader,at=Date.parse(detail.checkedAt||''),old=!Number.isFinite(at)||now-at>=480000;
 const state=detail.status==='suspended'?detail.statusText||'Paused':old&&detail.phase==='running'?'Awaiting update':detail.statusText||'';
 return [leader?.currentDriver||leader?.drivers?.join(' / ')||leader?.name,leader?.laps!=null?`Lap ${leader.laps}${detail.totalLaps?' / '+detail.totalLaps:''}`:null,state].filter(Boolean).join(' · ');
}
function patch(slot,detail,{visible=()=>true,followed=()=>false}={}){
 if(!slot.isConnected)return;
 if(!visible()){slot.replaceChildren();views.delete(slot);return;}
 styles();let view=views.get(slot);const fields=detail?.kind==='horse'?horseColumns:detail?.columns||columns,fieldKey=JSON.stringify(fields),scroll=view?.wrap.scrollLeft||0,focused=view?.wrap===document.activeElement;
 if(view&&(view.kind!==(detail?.kind||'circuit')||view.fieldKey!==fieldKey)){slot.replaceChildren();views.delete(slot);view=null;}
 if(!view){const note=node('p'),wrap=node('div'),table=node('table'),caption=node('caption'),head=node('thead'),tr=node('tr'),body=node('tbody'),source=node('a'),stageSource=node('a'),age=node('small');wrap.className='racing-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Full racing field');table.className='racing-table';for(const [label] of fields){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(caption,head,body);wrap.append(table);source.textContent='Official timing / results';source.target='_blank';source.rel='noopener noreferrer';stageSource.textContent='Published field stage';stageSource.target='_blank';stageSource.rel='noopener noreferrer';slot.append(note,wrap,age,source,stageSource);view={note,wrap,caption,body,source,stageSource,age,kind:detail?.kind||'circuit',fieldKey,rows:new Map()};views.set(slot,view);if(focused)wrap.focus({preventScroll:true});wrap.scrollLeft=scroll;}
 view.note.textContent=summary(detail);view.caption.textContent=detail?.sessionName||'Full racing field';
 const entries=detail?.entries||[],keep=new Set(entries.map(e=>e.id));for(const [id,row] of view.rows)if(!keep.has(id)){row.remove();view.rows.delete(id);}
 entries.forEach((entry,index)=>{let row=view.rows.get(entry.id);if(!row){row=node('tr');row.dataset.racingEntryId=entry.id;fields.forEach(([,key],i)=>{const c=node(i?'td':'th');if(!i)c.scope='row';c.dataset.field=key;row.append(c);});view.rows.set(entry.id,row);}const values={...entry,scratching:entry.scratched?'Scratched':'',drivers:entry.drivers?.join(' / '),lastLap:lap(entry.lastLap),bestLap:lap(entry.bestLap),sector1:lap(entry.sectors?.[0]),sector2:lap(entry.sectors?.[1]),sector3:lap(entry.sectors?.[2]),pitState:entry.pitState==='N'?'':entry.pitState};for(const cell of row.children){const text=String(values[cell.dataset.field]??'');if(cell.textContent!==text)cell.textContent=text;}row.classList.toggle('racing-followed',followed(entry));if(view.body.children[index]!==row)view.body.insertBefore(row,view.body.children[index]||null);});
 view.wrap.hidden=!entries.length;const at=Date.parse(detail?.checkedAt||'');view.age.textContent=Number.isFinite(at)?'Last complete snapshot '+new Date(at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Timing details unavailable';
 const url=detail?.officialUrl;let safe=false;try{const u=new URL(url);safe=u.protocol==='https:'||u.href==='http://server.natsoft.com.au:8080/LiveMeeting/v8super';}catch{}view.source.hidden=!safe;if(safe)view.source.href=url;const stageUrl=detail?.phaseProvenance?.sourceUrl;view.stageSource.hidden=!/^https:\/\//.test(stageUrl||'');if(!view.stageSource.hidden)view.stageSource.href=stageUrl;
}
async function read(id){
 const old=cache.get(id);if(old&&Date.now()-old.readAt<240000)return old.detail;
 if(requests.has(id))return requests.get(id);
 const p=(async()=>{const r=await fetch('/api/match-centre?ids='+encodeURIComponent(id)+'&details=racing',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Racing details unavailable');const json=await r.json(),detail=json.fixtures?.find(f=>f.id===id)?.score?.racing;if(detail?.schema!=='racing.v1'||!Array.isArray(detail.entries)||detail.entries.length>100)throw Error('Incomplete racing detail');cache.set(id,{readAt:Date.now(),detail});return detail;})().finally(()=>requests.delete(id));requests.set(id,p);return p;
}
async function mount(slot,event,options={}){
 const id=String(event.canonicalEventId||event.eventId||event.id),detail=event.score?.racing||globalThis.NOTHINGSPORTS_MATCH_CENTRE?.racingDetail(event),prior=cache.get(id)?.detail;patch(slot,detail?.entries?.length?detail:prior||detail||{officialUrl:event.officialTimingUrl||event.sourceUrl,sessionName:event.name},options);
 if(detail?.entries?.length){cache.set(id,{readAt:Date.now(),detail});return;}
 try{const full=await read(id);patch(slot,full,options);}catch{const old=cache.get(id)?.detail;if(old)patch(slot,old,options);}
}
return {mount,patch,summary,lap};
});
