// Loaded only when the crowd rankings drawer opens. Shares the app shell state.
window.NOTHINGSPORTS_CROWD_RANKINGS={render:async function renderCrowdRankings(){
  const generation=++nscRankingGeneration;clearTimeout(nscRankingTimer);
  const body=document.getElementById('nothingscoreBody');body.replaceChildren();
  document.getElementById('nothingscoreTitle').textContent='Crowd rankings';
  document.getElementById('nothingscoreSubtitle').textContent='What fans are looking forward to, enjoying live and recommending afterwards.';
  const controls=document.createElement('div');controls.className='nsc-ranking-controls';
  for(const [key,label] of [['upcoming','Upcoming'],['live','Live'],['past','Past']]){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.setAttribute('aria-pressed',String(nscRankingState.tab===key));b.onclick=()=>{nscRankingState.tab=key;nscRankingState.cursor=0;localStorage.setItem('nscRankingTab',key);renderCrowdRankings();};controls.appendChild(b);}
  const scope=document.createElement('select');scope.setAttribute('aria-label','Fixture scope');for(const [value,label] of [['following','Following'],['all','All sports']])scope.add(new Option(label,value));scope.value=nscRankingState.scope;scope.onchange=()=>{nscRankingState.scope=scope.value;nscRankingState.cursor=0;renderCrowdRankings();};controls.appendChild(scope);
  const sport=document.createElement('select');sport.setAttribute('aria-label','Sport filter');sport.add(new Option('Every sport',''));BASE_SPORT_SELECTOR_ENTITIES.filter(e=>Number(e.level)===2).forEach(e=>sport.add(new Option(e.label,e.id.replace('sport:',''))));sport.value=nscRankingState.sport;sport.onchange=()=>{nscRankingState.sport=sport.value;nscRankingState.cursor=0;renderCrowdRankings();};controls.appendChild(sport);
  if(nscRankingState.tab!=='live'){const days=document.createElement('select');days.setAttribute('aria-label','Date range');[7,30,90,365].forEach(n=>days.add(new Option(`${n} days`,String(n))));days.value=String(nscRankingState.days);days.onchange=()=>{nscRankingState.days=Number(days.value);nscRankingState.cursor=0;renderCrowdRankings();};controls.appendChild(days);}
  const mine=document.createElement('button');mine.type='button';mine.className='btn ghost';mine.textContent='My NSC';mine.onclick=()=>{nscMyView=true;renderNothingscoreDrawer();};controls.appendChild(mine);body.appendChild(controls);
  const list=document.createElement('div');list.className='nsc-ranking-list';list.textContent='Loading crowd ratings…';body.appendChild(list);
  const options=()=>({...nscRankingState,preferences:JSON.stringify({followFirst:userPreferences.followFirst,preferenceGraph:userPreferences.preferenceGraph,followedSports:userPreferences.followedSports,selectedSelectorEntityIds:userPreferences.selectedSelectorEntityIds})});
  function paintCrowd(value,ev){value.textContent=ev.crowd.count?`${Number(ev.crowd.average).toFixed(1)}/5`:'—';const count=document.createElement('small');count.textContent=ev.crowd.count?`${ev.crowd.count} ratings${ev.crowd.early?' · Early':''}`:ev.phase==='pulse'?'No recent ratings':'Unrated';value.appendChild(count);}
  function draw(payload){
    list.replaceChildren();if(!payload.entries?.length){list.textContent=nscRankingState.scope==='following'?'No matching fixtures. Try All sports.':'No matching fixtures in this period.';return;}
    payload.entries.forEach(ev=>{
      const row=document.createElement('button');row.type='button';row.className='nsc-fixture-row';row.dataset.rankFixture=ev.id;
      const rank=document.createElement('span');rank.textContent=ev.rank || '–';
      const identity=document.createElement('span');identity.textContent=ev.name;const time=document.createElement('small');time.textContent=ev.phase==='pulse'?'Live':ev.startTimeUtc?new Date(ev.startTimeUtc).toLocaleString('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'Time TBC';identity.appendChild(time);
      const value=document.createElement('span');value.className='nsc-rank-value';paintCrowd(value,ev);
      row.append(rank,identity,value);row.onclick=()=>{nscRankingState.scrollTop=body.scrollTop;void openNothingscoreContribution({...ev,eventId:ev.id},{showResults:true});};list.appendChild(row);
    });
    if(nscRankingState.cursor>0){const prev=document.createElement('button');prev.className='btn ghost';prev.textContent='Previous';prev.onclick=()=>{nscRankingState.cursor=Math.max(0,nscRankingState.cursor-25);renderCrowdRankings();};list.appendChild(prev);}
    if(payload.nextCursor!==null){const next=document.createElement('button');next.className='btn ghost';next.textContent='Next';next.onclick=()=>{nscRankingState.cursor=payload.nextCursor;renderCrowdRankings();};list.appendChild(next);}
  }
  try{
    let payload=await serverSyncClient.nothingscoreRequest({rankings:options()});if(generation!==nscRankingGeneration||!list.isConnected)return;draw(payload);body.scrollTop=nscRankingState.scrollTop||0;
    if(nscRankingState.tab==='live'){
      const poll=async()=>{if(generation!==nscRankingGeneration||!list.isConnected||!document.getElementById('nothingscoreBackdrop').classList.contains('show'))return;
        try{const updated=await serverSyncClient.nothingscoreRequest({rankings:options()});
          if(generation!==nscRankingGeneration||!list.isConnected)return;
          for(const ev of updated.entries){const row=Array.from(list.querySelectorAll('[data-rank-fixture]')).find(r=>r.dataset.rankFixture===ev.id);if(row){paintCrowd(row.querySelector('.nsc-rank-value'),ev);row.firstElementChild.textContent=ev.rank || '–';}}
          const changed=updated.entries.map(e=>e.id).join('|')!==Array.from(list.querySelectorAll('[data-rank-fixture]')).map(r=>r.dataset.rankFixture).join('|');
          payload=updated;
          let refresh=body.querySelector('[data-rankings-refresh]');
          if(changed&&!refresh){refresh=document.createElement('button');refresh.type='button';refresh.className='btn ghost';refresh.dataset.rankingsRefresh='';refresh.textContent='Rankings updated';refresh.onclick=()=>{const top=body.scrollTop;draw(payload);refresh.remove();body.scrollTop=top;};controls.after(refresh);}
          if(!changed&&refresh)refresh.remove();
        }catch{}nscRankingTimer=setTimeout(poll,30000);};nscRankingTimer=setTimeout(poll,30000);
    }
  }catch(error){list.textContent=error.message || 'Rankings unavailable.';const retry=document.createElement('button');retry.className='btn ghost';retry.textContent='Retry';retry.onclick=renderCrowdRankings;list.appendChild(retry);}
}};
