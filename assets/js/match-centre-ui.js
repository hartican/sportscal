/* Lazy, read-only score surface. The host owns Feed eligibility and identity. */
(() => {
 'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=339';link.dataset.mcStyle='';document.head.append(link);
}
loadMatchCentreStyles();

 const scores=new Map(),requested=new Map(),expanded=new Set();let timer,inflight=null,hydrating=null,membership=[],membershipKey='',membershipOwner='',membershipCheckedAt=0,generation=0,manual=null,lastManual=-Infinity,notice='',refreshControl;
 const owner=()=>serverSyncClient?.sessionSubject()||'public';
 const ticket=()=>({generation,owner:owner()});
 const valid=t=>t.generation===generation&&t.owner===owner()&&activeTab==='match-centre';
 const m=()=>globalThis.NOTHINGSPORTS_MATCH_CENTRE;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function candidates(){if(membershipOwner!==owner())return [];return m().select(membership.map(e=>{const s=scores.get(m().id(e));if(!s)return e;const source=m().compact(e),latest=m().observation(source,s);return {...e,status:latest.status,completedAt:latest.completedAt||e.completedAt};}).filter(e=>{const a=getEventAction(e);return !a.archived&&!a.dismissed;}));}
 async function hydrate(force=false){
  const t=ticket();
  if(hydrating){await hydrating;if(!force)return;}
  if(!valid(t))return;
  const operation=(async()=>{
  const key=JSON.stringify([owner(),userPreferences,eventActions]);if(!force&&key===membershipKey&&Date.now()-membershipCheckedAt<300000)return;
  const next=[];let cursor=0;
  do{const data=serverPersistence.user?await serverSyncClient.loadFeed({cursor,limit:50,scope:'match-centre'}):await fetch(`/api/feed?scope=match-centre&limit=50&cursor=${cursor}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:userPreferences,eventUserState:eventActions}),signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();});if(!valid(t)||key!==JSON.stringify([owner(),userPreferences,eventActions]))return;next.push(...(data.events||[]));const retained=membershipOwner===owner()?membership:[];membership=[...new Map([...retained,...next].map(e=>[m().id(e),e])).values()];membershipOwner=owner();render();cursor=data.pagination?.nextCursor??null;}while(cursor!==null&&activeTab==='match-centre');
  if(!valid(t)||key!==JSON.stringify([owner(),userPreferences,eventActions]))return;
  membership=next;membershipKey=key;membershipCheckedAt=Date.now();membershipOwner=serverSyncClient?.sessionSubject()||'public';
  })();hydrating=operation;try{return await operation;}finally{if(hydrating===operation)hydrating=null;}
 }
 function scoreText(s){if(!s)return 'Scores unavailable';if(s.innings)return s.innings.length?s.innings.map(i=>`${i.team||i.participantId||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · '):'Scores unavailable';if(s.sets?.length||s.games)return (s.sets||[]).map(x=>`${x.home??'—'}–${x.away??'—'}`).join('  ')+(s.games?` · Games ${s.games.home??'—'}–${s.games.away??'—'}`:'');return s.home!=null&&s.away!=null?`${s.home}–${s.away}`:'Scores unavailable';}
 function render(){
  if(activeTab!=='match-centre')return;
  const panel=document.getElementById('listView');panel.className='match-centre';
  const heading=node('div',null,'match-centre-heading');heading.append(node('h2','Match Centre'));
  const refresh=node('button','Refresh','btn ghost');refresh.type='button';refresh.setAttribute('aria-label','Refresh Match Centre');refresh.disabled=Boolean(manual);refresh.onclick=()=>void manualRefresh();heading.append(refresh);panel.replaceChildren(heading);
  const announcement=node('p',notice,'mc-refresh-notice');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');panel.append(announcement);
  panel.setAttribute('aria-busy',String(Boolean(manual||hydrating)));
  panel.append(node('p','Latest available updates for your Feed fixtures.','match-centre-note'));
  const all=candidates(),choice=buildSurfaceCategoryChooser('match-centre',all,render);heading.append(choice.select);
  const events=all.filter(e=>NOTHINGSPORTS_SURFACE_CATEGORY.matches(e,choice.selected));
  if(!events.length)panel.append(node('p',hydrating?'Loading your Feed fixtures…':'No Feed matches in the live window. Fixtures appear 30 minutes before start.'));
  for(const e of events){
   const id=m().id(e),snapshot=m().observation(m().compact(e),scores.get(id)||m().compact(e)),card=node('article',null,'match-centre-card');card.dataset.matchId=id;
   card.append(node('h3',spoilerSafeDisplayTitle(e)),buildFixtureTimingGroup(e));
   if(m().sport(e)==='tennis'){const brand=node('div',e.tournamentName||e.competitionName||'Tennis','mc-tennis-brand');card.append(brand);}
   const sides=buildMatchupIdentity(e,spoilerSafeDisplayTitle(e));if(sides)card.append(sides);
   const status=globalThis.NOTHINGSPORTS_ODI_DISPLAY.awaiting({...e,...snapshot})?'Awaiting confirmed result':m().final(e)?'Finished':m().interrupted(e)?String(e.status).replace(/-/g,' '):/live|in.progress/.test(e.status)?'Live':e.status==='ongoing'?'Ongoing · between sessions':/cancel|abandon|postpon/.test(e.status)?String(e.status):e.status==='scheduled'||e.status==='upcoming'?'Not started':'Status unavailable';
   card.append(node('p',status));
   if(userPreferences.showSpoilers){
    const scored=node('p',null,'match-centre-score'),identities=matchupIdentityMatches(e,spoilerSafeDisplayTitle(e));
    const label=id=>identities.find(i=>i.participant?.id===id||i.mark?.id===id)?.label||(e.participantSlots||[]).find(s=>s.participantId===id)?.label||(e.participants||[]).find(p=>p.id===id)?.displayName||(e.matchupSides||[]).find(s=>s.players?.some(p=>p.id===id))?.name||cardIdentityParticipants().find(p=>p.id===id)?.displayName;
    if(snapshot.score.home!=null&&snapshot.score.away!=null){
     scored.textContent=`${label(snapshot.homeParticipantId)||'Home'}: ${snapshot.score.home} · ${label(snapshot.awayParticipantId)||'Away'}: ${snapshot.score.away}`;
    }else if(snapshot.score.sets?.length||snapshot.score.games){scored.textContent=`${label(snapshot.homeParticipantId)||'First source side'} / ${label(snapshot.awayParticipantId)||'Second source side'}: ${scoreText(snapshot.score)}`;}
    else scored.textContent=scoreText(snapshot.score);scored.textContent=NOTHINGSPORTS_FIXTURE_LABELS.displayName(scored.textContent,e);card.append(scored);
    const age=Date.parse(snapshot.scoreCheckedAt||snapshot.checkedAt||'');card.append(node('small',`${snapshot.stale||!Number.isFinite(age)||Date.now()-age>m().interval(e)*2?'Stale / ':''}${Number.isFinite(age)?'Score checked '+new Date(age).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}):'Awaiting source update'}`));
    if(m().sport(e)==='tennis'&&(e.contestUnit==='tie'||e.contestType==='tie'||e.kind==='tie'||e.rubbers)){
     const details=node('details'),summary=node('summary','Individual rubbers');details.append(summary);details.open=expanded.has(id);
     for(const r of snapshot.rubbers||[])details.append(node('p',`${r.name}: ${r.status==='not-required'?'Not required':r.status==='upcoming'||r.status==='unconfirmed'?'Awaiting official score':scoreText(r.score)}`));
     details.ontoggle=()=>{if(details.open){expanded.add(id);if(!snapshot.rubbers)void poll([e],true);}else expanded.delete(id);};card.append(details);
    }
   }else card.append(node('p','Results hidden'));
   const actions=node('div',null,'match-centre-actions'),open=node('a','Open fixture','btn');open.href=`/?event=${encodeURIComponent(id)}`;
   open.onclick=click=>{if(click.metaKey||click.ctrlKey||click.shiftKey||click.altKey)return;click.preventDefault();if(membershipOwner===owner())openMatchCentreFeedFixture(e);};actions.append(open);
   if(snapshot.officialUrl){const official=node('a','Official fixture','btn ghost');official.href=snapshot.officialUrl;official.target='_blank';official.rel='noopener noreferrer';actions.append(official);}card.append(actions);panel.append(card);
  }
 }
 async function poll(explicit=null,rubbers=false,force=false){
  if(document.hidden||activeTab!=='match-centre')return true;
  if(inflight){const result=await inflight;if(!force)return result;}
  const t=ticket();
  const visible=new Set([...document.querySelectorAll('[data-match-id]')].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>=0&&r.top<=innerHeight;}).map(n=>n.dataset.matchId));
  let events=explicit||candidates().filter(e=>visible.has(m().id(e))&&(force||Date.now()-(requested.get(m().id(e))||0)>=m().interval(e)));
  if(!force)events=events.slice(0,60);if(!events.length)return true;
  const ids=events.map(m().id).sort();ids.forEach(id=>requested.set(id,Date.now()));
  inflight=(async()=>{try{
   for(let offset=0;offset<ids.length;offset+=60){
    if(!valid(t)||document.hidden)return false;
    const r=await fetch(`/api/match-centre?ids=${encodeURIComponent(ids.slice(offset,offset+60).join(','))}${rubbers?'&rubbers=1':''}`,{signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error();const data=await r.json();if(!data.enabled)throw Error();if(!valid(t))return false;
    for(const s of data.fixtures||[]){
     scores.set(s.id,m().observation(scores.get(s.id),s));
    }
   }
   render();return true;
  }catch{if(valid(t)){ids.forEach(id=>{if(scores.has(id))scores.get(id).stale=true;});render();}return false;}finally{inflight=null;}})();return inflight;
 }
 async function manualRefresh(){
  if(manual||document.hidden||activeTab!=='match-centre')return manual;
  if(Date.now()-lastManual<10000){notice='Please wait a moment before refreshing again.';render();return;}
  lastManual=Date.now();const t=ticket();notice='Refreshing…';
  const operation=(async()=>{try{await hydrate(true);if(!valid(t))return;render();if(!await poll(null,false,true))throw Error();if(valid(t))notice='Latest available scores loaded.';}catch{if(valid(t))notice='Couldn’t refresh. Showing last available scores.';}finally{if(manual===operation)manual=null;if(valid(t)){refreshControl?.setBusy(false);render();}}})();
  manual=operation;refreshControl?.setBusy(true);render();return manual;
 }
 globalThis.stopMatchCentre=()=>{generation++;clearInterval(timer);refreshControl?.cancel();manual=null;notice='';document.getElementById('listView')?.removeAttribute('aria-busy');};
 globalThis.renderMatchCentre=()=>{
  if(membershipOwner&&membershipOwner!==owner()){globalThis.stopMatchCentre();membership=[];membershipKey='';membershipOwner=owner();lastManual=-Infinity;scores.clear();requested.clear();expanded.clear();}
  refreshControl||=globalThis.createMatchCentreRefresh({panel:document.getElementById('listView'),enabled:()=>activeTab==='match-centre'&&!document.hidden,refresh:manualRefresh});
  if(!membership.length){membership=[...activeEvents].filter(e=>Boolean(eventFollowReason(e)));membershipOwner=owner();}
  const t=ticket();render();void hydrate().then(()=>{if(!valid(t))return;render();if(!manual)void poll();}).catch(()=>{if(!valid(t))return;if(!manual&& !notice)notice='Some Feed fixtures could not load. Refresh to retry.';render();});
  clearInterval(timer);timer=setInterval(()=>{if(activeTab!=='match-centre'){globalThis.stopMatchCentre();return;}if(document.hidden||manual||refreshControl.pulling)return;void hydrate().then(()=>{render();void poll();}).catch(()=>{});},15000);if(!manual)void poll();
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
})();
