(function(root,factory){const api=factory();root.NOTHINGSPORTS_CRICKET_INNINGS=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(typeof globalThis!=="undefined"?globalThis:window,function(){
"use strict";
  function cricketInnings(event){
    if(event?.key!=='cricket'||!['completed','finished','past','live','ongoing','in_progress','in-progress','stumps','rain-delay','interrupted','suspended','break'].includes(event.status)||!Array.isArray(event.innings)||!event.innings.length)return null;
    const participants=new Map((event.participants||[]).filter(p=>p&&typeof p==='object'&&p.id).map(p=>[p.id,p.displayName||p.name]));
    const seen=new Set(),rows=[];let unavailable=0,duplicate=false;
    for(const inning of event.innings){
      const n=inning?.inningNumber,name=participants.get(inning?.participantId),runs=inning?.runsScored,wickets=inning?.numberOfWicketsFallen,overs=inning?.oversBowled;
      if(seen.has(n))duplicate=true;seen.add(n);
      if(!Number.isSafeInteger(n)||n<1||typeof name!=='string'||!name.trim()||!Number.isSafeInteger(runs)||runs<0||!Number.isSafeInteger(wickets)||wickets<0||wickets>10||overs!=null&&(typeof overs!=='string'||!/^\d+(?:\.[0-5])?$/.test(overs))){unavailable++;continue;}
      const notes=[inning.isDeclared===true?'Declared':null,inning.isFollowOn===true?'Follow-on':null,inning.isForfeited===true?'Forfeited':null].filter(Boolean).join(' · ');
      rows.push({inningNumber:n,participantId:inning.participantId,name:name.trim(),score:inning.isForfeited===true?'Forfeited':wickets===10?`${runs} all out`:`${runs}/${wickets}`,overs:overs??'—',notes});
    }
    if(duplicate)return {label:'Innings details',rows:[],unavailable:event.innings.length};
    rows.sort((a,b)=>a.inningNumber-b.inningNumber);
    return {label:['completed','finished','past'].includes(event.status)?'Final innings':'Latest sourced innings',rows,unavailable};
  }
function build(ev){
  if(globalThis.NOTHINGSPORTS_COVERAGE_PAUSES?.womensT20(ev))return null;
  const innings=cricketInnings(ev);if(!innings)return null;
  const wrap=document.createElement('div');wrap.className='card-result-line cricket-innings';
  if(innings.rows.length){
    const table=document.createElement('table');table.className='tennis-set-table cricket-innings-table';table.setAttribute('aria-label',innings.label);
    const caption=document.createElement('caption');caption.textContent=innings.label;const checked=Date.parse(ev.scoreCheckedAt);if(innings.label==='Latest sourced innings'&&Number.isFinite(checked))caption.textContent+=` · checked ${new Date(checked).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}`;table.append(caption);
    const head=document.createElement('tr');for(const label of ['Team / innings','Score','Overs']){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);}const thead=document.createElement('thead');thead.append(head);table.append(thead);
    const body=document.createElement('tbody');for(const inning of innings.rows){const row=document.createElement('tr'),name=document.createElement('th');name.scope='row';name.textContent=`${inning.name} · ${inning.inningNumber}${inning.notes?' · '+inning.notes:''}`;row.append(name);for(const value of [inning.score,inning.overs]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}table.append(body);wrap.append(table);
  }
  if(innings.unavailable){const note=document.createElement('p');note.textContent='Some innings details are unavailable.';wrap.append(note);}
  return wrap;
}

return Object.freeze({cricketInnings,build});
});
