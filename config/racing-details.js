(function(root,factory){const api=factory();root.NOTHINGSPORTS_RACING_DETAILS=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const views=new WeakMap(),cache=new Map(),requests=new Map();
const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const lap=value=>Number.isFinite(value)&&value>0?`${Math.floor(value/60)}:${(value%60).toFixed(4).padStart(7,'0')}`:'';
const columns=[['Pos','position'],['Car','number'],['Drivers','drivers'],['Current driver','currentDriver'],['Team','team'],['Laps','laps'],['Gap','gap'],['Last lap','lastLap'],['Best lap','bestLap'],['S1','sector1'],['S2','sector2'],['S3','sector3'],['Tyre','tyre'],['Pit stops','pitStops'],['Pit state','pitState']];
const horseColumns=[['Horse no.','number'],['Gate','barrier'],['Weight (kg)','weight'],['Horse name (country code)','name'],['Trainer','trainer'],['Jockey','jockey']];
const countryAliases={AUS:'AU',NZ:'NZ',GB:'GB',FR:'FR',IRE:'IE',USA:'US',GER:'DE',JPN:'JP',SAF:'ZA',ARG:'AR',BRZ:'BR',CAN:'CA',CHI:'CL',ITY:'IT',SWI:'CH',UAE:'AE'};
function horseIdentity(entry,trustedSuffix=true){
 const match=String(entry.name||'').match(/^(.*?)\s*\(([A-Z]{2,3})\)$/),source=String(entry.countryCode||'').toUpperCase();
 const countryCode=/^[A-Z]{2}$/.test(source)?source:trustedSuffix&&match?countryAliases[match[2]]||(/^[A-Z]{2}$/.test(match[2])?match[2]:null):null;
 return {name:match?match[1].trim():entry.name,countryCode};
}
function sanitizeHorseDetail(detail,{horse=false}={}){
 if(detail?.kind!=='horse')return horse?null:detail;
 if(Array.isArray(detail.entries)&&(detail.entries.length>100||detail.entries.some(e=>!e||typeof e.id!=='string'||!e.id||typeof e.name!=='string'||!e.name)||new Set(detail.entries.map(e=>e.id)).size!==detail.entries.length))throw RangeError('Incomplete racing detail');
 const keys=['schema','kind','eventId','sessionId','sessionName','provider','officialUrl','providerAt','providerClock','checkedAt','phase','status','statusText','raceNumber','raceTime','startTimeUtc','entryCount'];
 const clean=Object.fromEntries(keys.filter(k=>Object.hasOwn(detail,k)).map(k=>[k,detail[k]]));
 if(detail.phaseProvenance)clean.phaseProvenance=Object.fromEntries(['sourceUrl','publishedDate','checkedAt'].filter(k=>Object.hasOwn(detail.phaseProvenance,k)).map(k=>[k,detail.phaseProvenance[k]]));
 if(Array.isArray(detail.entries))clean.entries=detail.entries.map(entry=>{
  const value=Object.fromEntries(['id','number','barrier','weight','trainer','jockey','scratched','position','margin'].filter(k=>Object.hasOwn(entry,k)).map(k=>[k,entry[k]]));
  const identity=horseIdentity(entry,detail.provider==='Racing Australia');return {...value,name:identity.name,...(identity.countryCode?{countryCode:identity.countryCode}:{})};
 });
 return clean;
}
function numeric(value,kind='weight'){
 const raw=String(value??'').trim(),pattern=kind==='gate'?/^\d+$/:kind==='number'?/^\d+e?$/i:/^\d+(?:\.\d+)?(?:\s*kg)?$/i;return pattern.test(raw)&&parseFloat(raw)>0?parseFloat(raw):null;
}
function horseEntries(detail){
 const entries=sanitizeHorseDetail(detail)?.entries||[],gates=entries.some(e=>numeric(e.barrier,'gate')!=null);
 const value=e=>gates?numeric(e.barrier,'gate'):numeric(e.weight);
 return [...entries].sort((a,b)=>{
  const x=value(a),y=value(b);if(x!==y)return x==null?1:y==null?-1:gates?x-y:y-x;
  const n=numeric(a.number,'number'),m=numeric(b.number,'number');return (n===m?0:n==null?1:m==null?-1:n-m)||String(a.name||'').localeCompare(String(b.name||''))||String(a.id).localeCompare(String(b.id));
 });
}
function horseLabel(detail,resultsVisible=true){
 if(['nominations','acceptances'].includes(detail?.phase))return 'Early entries';
 if(detail?.phase==='cancelled')return 'Race cancelled';
 if(resultsVisible&&['official-result','provisional-result'].includes(detail?.phase))return detail.phase==='official-result'?'Official results':'Provisional results';
 return detail?.entries?.length||detail?.entryCount?'Race field':'Entries not yet published';
}
function horseNotice(){
 styles();
 const p=node('p');p.className='horse-gambling-free';
 p.append('NS is deliberately a gambling-free space. Do not rely on NS information to assess bets or make financial decisions. ');
 // The separately approved shared Charter link is added only after publication.
 p.append('If gambling is causing harm to you or someone you care about, free, confidential support is available through ');
 const link=node('a','Gambling Help Online');link.href='https://www.gamblinghelponline.org.au/';link.target='_blank';link.rel='noopener noreferrer';
 const phone=node('a','1800 858 858');phone.href='tel:1800858858';p.append(link,' or by calling ',phone,', 24/7.');return p;
}
function styles(){if(document.querySelector('[data-racing-details-style]'))return;const l=node('link');l.rel='stylesheet';l.href='assets/styles/racing-details.css?v=491';l.dataset.racingDetailsStyle='';document.head.append(l);}
function summary(detail,now=Date.now()){
 if(!detail)return '';
 if(detail.kind==='horse')return [horseLabel(detail),`${detail.entryCount??detail.entries?.length??0} entries`,detail.raceTime?'Race time '+detail.raceTime:null].filter(Boolean).join(' · ');
 if(detail.kind==='classification')return [detail.leader?.drivers?.join(' / '),detail.statusText].filter(Boolean).join(' · ');
 const leader=detail.entries?.[0]||detail.leader,at=Date.parse(detail.checkedAt||''),old=!Number.isFinite(at)||now-at>=480000;
 const state=detail.status==='suspended'?detail.statusText||'Paused':old&&detail.phase==='running'?'Awaiting update':detail.statusText||'';
 return [leader?.currentDriver||leader?.drivers?.join(' / ')||leader?.name,leader?.laps!=null?`Lap ${leader.laps}${detail.totalLaps?' / '+detail.totalLaps:''}`:null,state].filter(Boolean).join(' · ');
}
function patch(slot,detail,{visible=()=>true,resultsVisible=visible,followed=()=>false}={}){
 if(!slot.isConnected)return;
 if(!visible()){slot.replaceChildren();views.delete(slot);return;}
 detail=sanitizeHorseDetail(detail);const horse=detail?.kind==='horse',results=resultsVisible();styles();let view=views.get(slot);const fields=horse?[...horseColumns,...(results&&['official-result','provisional-result'].includes(detail.phase)?[['Finish','position'],['Margin','margin']]:[])]:detail?.columns||columns,fieldKey=JSON.stringify(fields),scroll=view?.wrap.scrollLeft||0,focused=view?.wrap===document.activeElement;
 if(view&&(view.kind!==(detail?.kind||'circuit')||view.fieldKey!==fieldKey)){slot.replaceChildren();views.delete(slot);view=null;}
 if(!view){const note=node('p'),wrap=node('div'),table=node('table'),caption=node('caption'),head=node('thead'),tr=node('tr'),body=node('tbody'),source=node('a'),stageSource=node('a'),age=node('small');wrap.className='racing-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Full racing field');table.className='racing-table';for(const [label] of fields){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(caption,head,body);wrap.append(table);source.textContent=horse?'Official field / results':'Official timing / results';source.target='_blank';source.rel='noopener noreferrer';stageSource.textContent='Published field stage';stageSource.target='_blank';stageSource.rel='noopener noreferrer';if(horse)slot.append(horseNotice());slot.append(note,wrap,age,source,stageSource);view={note,wrap,caption,body,source,stageSource,age,kind:detail?.kind||'circuit',fieldKey,rows:new Map()};views.set(slot,view);if(focused)wrap.focus({preventScroll:true});wrap.scrollLeft=scroll;}
 view.note.textContent=horse?[horseLabel(detail,results),detail.entries?.length?detail.entries.length+' entries':null,results&&detail.raceTime?'Race time '+detail.raceTime:null].filter(Boolean).join(' · '):summary(detail);view.caption.textContent=detail?.sessionName||'Full racing field';
 const entries=horse?horseEntries(detail):detail?.entries||[],keep=new Set(entries.map(e=>e.id));for(const [id,row] of view.rows)if(!keep.has(id)){row.remove();view.rows.delete(id);}
 entries.forEach((entry,index)=>{let row=view.rows.get(entry.id);if(!row){row=node('tr');row.dataset.racingEntryId=entry.id;fields.forEach(([,key],i)=>{const c=node(i?'td':'th');if(!i)c.scope='row';c.dataset.field=key;row.append(c);});view.rows.set(entry.id,row);}const values={...entry,...(horse?{barrier:numeric(entry.barrier,'gate'),name:entry.name+' ('+(entry.countryCode||'—')+')'+(entry.scratched?' · Scratched':''),weight:numeric(entry.weight)}:{}),scratching:entry.scratched?'Scratched':'',drivers:entry.drivers?.join(' / '),lastLap:lap(entry.lastLap),bestLap:lap(entry.bestLap),sector1:lap(entry.sectors?.[0]),sector2:lap(entry.sectors?.[1]),sector3:lap(entry.sectors?.[2]),pitState:entry.pitState==='N'?'':entry.pitState};for(const cell of row.children){const text=String(values[cell.dataset.field]??(horse?'—':''));if(cell.textContent!==text)cell.textContent=text;}row.classList.toggle('racing-followed',followed(entry));if(view.body.children[index]!==row)view.body.insertBefore(row,view.body.children[index]||null);});
 view.wrap.hidden=!entries.length;const at=Date.parse(detail?.checkedAt||'');view.age.textContent=Number.isFinite(at)?'Checked '+new Date(at).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Timing details unavailable';
 const url=detail?.officialUrl;let safe=false;try{const u=new URL(url);safe=u.protocol==='https:'||u.href==='http://server.natsoft.com.au:8080/LiveMeeting/v8super';}catch{}view.source.hidden=!safe;if(safe)view.source.href=url;const stageUrl=detail?.phaseProvenance?.sourceUrl;view.stageSource.hidden=!/^https:\/\//.test(stageUrl||'');if(!view.stageSource.hidden)view.stageSource.href=stageUrl;
}
async function read(id){
 const old=cache.get(id);if(old&&Date.now()-old.readAt<240000)return old.detail;
 if(requests.has(id))return requests.get(id);
 const p=(async()=>{const r=await fetch('/api/match-centre?ids='+encodeURIComponent(id)+'&details=racing',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Racing details unavailable');const json=await r.json(),detail=json.fixtures?.find(f=>f.id===id)?.score?.racing;if(detail?.schema!=='racing.v1'||!Array.isArray(detail.entries)||detail.entries.length>100)throw Error('Incomplete racing detail');cache.set(id,{readAt:Date.now(),detail});return detail;})().finally(()=>requests.delete(id));requests.set(id,p);return p;
}
async function mount(slot,event,options={}){
 const horse=event.key==='horse-racing'||event.sportKey==='horse-racing';
 const id=String(event.canonicalEventId||event.eventId||event.id),raw=event.score?.racing||globalThis.NOTHINGSPORTS_MATCH_CENTRE?.racingDetail(event),detail=sanitizeHorseDetail(raw,{horse}),prior=cache.get(id)?.detail;patch(slot,detail?.entries?.length?detail:prior||detail||{...(horse?{kind:'horse'}:{}),officialUrl:event.officialTimingUrl||event.sourceUrl,sessionName:event.name},options);
 if(detail?.entries?.length){cache.set(id,{readAt:Date.now(),detail});return;}
 try{const full=await read(id);patch(slot,full,options);}catch{const old=cache.get(id)?.detail;if(old)patch(slot,old,options);}
}
return {mount,patch,summary,lap,sanitizeHorseDetail,horseIdentity,horseEntries,horseLabel,horseNotice,numeric};
});
