// Viewer-scoped, short-lived cache. Never share permitted Upcoming responses
// across accounts. In-flight reads are reused; failed reads retain valid rows.
(function(){
const cache=new Map(),pending=new Map();
let cacheEpoch=0;
function clear(){cache.clear();pending.clear();++cacheEpoch;}
async function request(options,{force=false}={}){
  const key=JSON.stringify([serverSyncClient.sessionSubject?.()||'guest',options]);
  const cached=cache.get(key);
  if(!force&&cached&&Date.now()-cached.at<30000)return cached.payload;
  if(pending.has(key))return pending.get(key);
  const epoch=cacheEpoch;
  const promise=serverSyncClient.nothingscoreRequest({rankings:options}).then(payload=>{
    if(epoch===cacheEpoch){cache.set(key,{at:Date.now(),payload});if(cache.size>24)cache.delete(cache.keys().next().value);}return payload;
  }).finally(()=>{if(pending.get(key)===promise)pending.delete(key);});pending.set(key,promise);return promise;
}
window.NOTHINGSPORTS_CROWD_RANKINGS={clear,render:async function renderCrowdRankings(){
  const generation=++nscRankingGeneration;clearTimeout(nscRankingTimer);
  const options=()=>({tab:nscRankingState.tab,scope:nscRankingState.scope,sport:nscRankingState.sport,days:nscRankingState.days,cursor:nscRankingState.cursor,preferences:JSON.stringify({followFirst:userPreferences.followFirst,preferenceGraph:userPreferences.preferenceGraph,followedSports:userPreferences.followedSports,selectedSelectorEntityIds:userPreferences.selectedSelectorEntityIds})});
  const key=JSON.stringify([serverSyncClient.sessionSubject?.()||'guest',options()]);
  const body=document.getElementById('nothingscoreBody');
  const retained=body.querySelector('.nsc-ranking-list');
  const currentList=retained?.dataset.cacheKey===key?retained:null;
  const scrollTop=currentList?body.scrollTop:nscRankingState.scrollTop||0;
  body.replaceChildren();
  document.getElementById('nothingscoreTitle').textContent='Crowd rankings';
  document.getElementById('nothingscoreSubtitle').textContent='What fans are looking forward to, enjoying live and recommending afterwards.';
  const controls=document.createElement('div');controls.className='nsc-ranking-controls';
  for(const [key,label] of [['upcoming','Upcoming'],['live','Live'],['past','Past']]){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.setAttribute('aria-pressed',String(nscRankingState.tab===key));b.onclick=()=>{nscRankingState.tab=key;nscRankingState.cursor=0;nscRankingState.scrollTop=0;localStorage.setItem('nscRankingTab',key);renderCrowdRankings();};controls.appendChild(b);}
  const scope=document.createElement('select');scope.setAttribute('aria-label','Fixture scope');for(const [value,label] of [['following','Following'],['all','All sports']])scope.add(new Option(label,value));scope.value=nscRankingState.scope;scope.onchange=()=>{nscRankingState.scope=scope.value;nscRankingState.cursor=0;nscRankingState.scrollTop=0;renderCrowdRankings();};controls.appendChild(scope);
  const sport=document.createElement('select');sport.setAttribute('aria-label','Sport filter');sport.add(new Option('Every sport',''));BASE_SPORT_SELECTOR_ENTITIES.filter(e=>Number(e.level)===2).forEach(e=>sport.add(new Option(e.label,e.id.replace('sport:',''))));sport.value=nscRankingState.sport;sport.onchange=()=>{nscRankingState.sport=sport.value;nscRankingState.cursor=0;nscRankingState.scrollTop=0;renderCrowdRankings();};controls.appendChild(sport);
  if(nscRankingState.tab!=='live'){const days=document.createElement('select');days.setAttribute('aria-label','Date range');[7,30,90,365].forEach(n=>days.add(new Option(`${n} days`,String(n))));days.value=String(nscRankingState.days);days.onchange=()=>{nscRankingState.days=Number(days.value);nscRankingState.cursor=0;nscRankingState.scrollTop=0;renderCrowdRankings();};controls.appendChild(days);}
  const mine=document.createElement('button');mine.type='button';mine.className='btn ghost';mine.textContent='My NSC';mine.onclick=()=>{nscRankingState.scrollTop=body.scrollTop;history.pushState({nscPage:{view:'mine'}},'', '#nsc');nscMyView=true;renderNothingscoreDrawer();};controls.appendChild(mine);body.appendChild(controls);document.getElementById('nscMyAccountBtn')?.remove();mine.id='nscMyAccountBtn';document.querySelector('#nothingscoreDrawer .chat-head').prepend(mine);
  const list=currentList||document.createElement('div');list.className='nsc-ranking-list';list.dataset.cacheKey=key;if(!currentList)list.textContent='Loading crowd ratings…';body.appendChild(list);
  function paintCrowd(value,ev){value.replaceChildren();if(ev.ratingRequired){value.textContent='Rate to reveal';return;}const crowd=ev.crowd||{};value.textContent=crowd.count?`${Number(crowd.average).toFixed(1)}/5`:'—';const count=document.createElement('small');count.textContent=crowd.count?`${crowd.count} ratings${crowd.early?' · Early':''}`:ev.phase==='pulse'?'No recent ratings':'Unrated';value.appendChild(count);}
  function draw(payload){
    list.replaceChildren();if(!payload.entries?.length){list.textContent=nscRankingState.scope==='following'?'No matching fixtures. Try All sports.':'No matching fixtures in this period.';return;}
    payload.entries.forEach(ev=>{
      const row=document.createElement('div');row.className='nsc-fixture-row';row.dataset.rankFixture=ev.id;
      const rank=document.createElement('span');rank.textContent=ev.rank || '–';
      const identity=document.createElement('button');identity.type='button';identity.className='nsc-rank-identity';identity.textContent=ev.name;const time=document.createElement('small');time.textContent=ev.phase==='pulse'?'Live':ev.startTimeUtc?new Date(ev.startTimeUtc).toLocaleString('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'Time TBC';identity.appendChild(time);
      const value=document.createElement('span');value.className='nsc-rank-value';paintCrowd(value,ev);
      identity.onclick=()=>{nscRankingState.scrollTop=body.scrollTop;void openNothingscoreContribution({...ev,eventId:ev.id},{showResults:true});};
      row.append(rank,identity,value);
      if(ev.phase==='heat'&&ev.ratingRequired){const rating=buildInlineCrowdRating({...ev,eventId:ev.id,timePrecision:ev.startTimeUtc?'exact':'tbc'},{phase:'heat',ratingRequired:true,currentUser:null});rating.classList.add('nsc-ranking-inline-rating');row.appendChild(rating);}
      list.appendChild(row);
    });
    if(nscRankingState.cursor>0){const prev=document.createElement('button');prev.className='btn ghost';prev.textContent='Previous';prev.onclick=()=>{nscRankingState.cursor=Math.max(0,nscRankingState.cursor-25);renderCrowdRankings();};list.appendChild(prev);}
    if(payload.nextCursor!==null){const next=document.createElement('button');next.className='btn ghost';next.textContent='Next';next.onclick=()=>{nscRankingState.cursor=payload.nextCursor;renderCrowdRankings();};list.appendChild(next);}
  }
  try{
    const cached=cache.get(key);if(cached&&!currentList)draw(cached.payload);
    body.scrollTop=scrollTop;
    let payload=await request(options());if(generation!==nscRankingGeneration||!list.isConnected)return;const currentTop=body.scrollTop;draw(payload);body.scrollTop=currentTop;
    if(nscRankingState.tab==='live'){
      const poll=async()=>{if(generation!==nscRankingGeneration||!list.isConnected||!document.getElementById('nothingscoreBackdrop').classList.contains('show'))return;
        try{const updated=await request(options(),{force:true});
          if(generation!==nscRankingGeneration||!list.isConnected)return;
          for(const ev of updated.entries){const row=Array.from(list.querySelectorAll('[data-rank-fixture]')).find(r=>r.dataset.rankFixture===ev.id);if(row){paintCrowd(row.querySelector('.nsc-rank-value'),ev);row.firstElementChild.textContent=ev.rank || '–';}}
          const changed=updated.entries.map(e=>e.id).join('|')!==Array.from(list.querySelectorAll('[data-rank-fixture]')).map(r=>r.dataset.rankFixture).join('|');
          payload=updated;
          let refresh=body.querySelector('[data-rankings-refresh]');
          if(changed&&!refresh){refresh=document.createElement('button');refresh.type='button';refresh.className='btn ghost';refresh.dataset.rankingsRefresh='';refresh.textContent='Rankings updated';refresh.onclick=()=>{const top=body.scrollTop;draw(payload);refresh.remove();body.scrollTop=top;};controls.after(refresh);}
          if(!changed&&refresh)refresh.remove();
        }catch{}nscRankingTimer=setTimeout(poll,30000);};nscRankingTimer=setTimeout(poll,30000);
    }
  }catch(error){if(generation!==nscRankingGeneration||!list.isConnected)return;if(!list.querySelector('[data-rank-fixture]'))list.textContent=error.message || 'Rankings unavailable.';const note=document.createElement('p');note.className='nsc-refresh-status';note.setAttribute('role','status');note.textContent='Refresh unavailable. Showing the last loaded rankings.';body.appendChild(note);const retry=document.createElement('button');retry.className='btn ghost';retry.textContent='Retry';retry.onclick=renderCrowdRankings;list.appendChild(retry);}
}};
})();
