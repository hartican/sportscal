/* Lazy, read-only score surface. The host owns Feed eligibility and identity. */
(() => {
 'use strict';
 const scores=new Map(),requested=new Map(),expanded=new Set();let timer,inflight=null,hydrating=null,membership=[],membershipKey='',membershipOwner='';
 const m=()=>globalThis.NOTHINGSPORTS_MATCH_CENTRE;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function candidates(){if(membershipOwner!==(serverSyncClient?.sessionSubject()||'public'))return [];return m().select(membership.map(e=>{const s=scores.get(m().id(e));return s?{...e,status:s.status,completedAt:s.completedAt||e.completedAt}:e;}).filter(e=>{const a=getEventAction(e);return !a.archived&&!a.dismissed;}));}
 async function hydrate(){
  const key=JSON.stringify([serverSyncClient?.sessionSubject()||'public',userPreferences,eventActions,Math.floor(Date.now()/300000)]);if(key===membershipKey)return;
  const next=[];let cursor=0;
  do{const data=serverPersistence.user?await serverSyncClient.loadFeed({cursor,limit:50,scope:'match-centre'}):await fetch(`/api/feed?scope=match-centre&limit=50&cursor=${cursor}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:userPreferences,eventUserState:eventActions}),signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();});next.push(...(data.events||[]));cursor=data.pagination?.nextCursor??null;}while(cursor!==null&&activeTab==='match-centre');
  if(key!==JSON.stringify([serverSyncClient?.sessionSubject()||'public',userPreferences,eventActions,Math.floor(Date.now()/300000)]))return;
  membership=next;membershipKey=key;membershipOwner=serverSyncClient?.sessionSubject()||'public';
 }
 function scoreText(s){if(!s)return 'Scores unavailable';if(s.innings)return s.innings.length?s.innings.map(i=>`${i.team||i.participantId||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · '):'Scores unavailable';if(s.sets?.length||s.games)return (s.sets||[]).map(x=>`${x.home??'—'}–${x.away??'—'}`).join('  ')+(s.games?` · Games ${s.games.home??'—'}–${s.games.away??'—'}`:'');return s.home!=null&&s.away!=null?`${s.home}–${s.away}`:'Scores unavailable';}
 function render(){
  if(activeTab!=='match-centre')return;
  const panel=document.getElementById('listView');panel.className='match-centre';panel.replaceChildren(node('h2','Match Centre'));
  panel.append(node('p','Your Feed fixtures · team scores checked every 5 minutes; tennis every 2 minutes.','match-centre-note'));
  const events=candidates();
  if(!events.length)panel.append(node('p',hydrating?'Loading your Feed fixtures…':'No Feed matches in the live window. Fixtures appear 30 minutes before start.'));
  for(const e of events){
   const id=m().id(e),snapshot=scores.get(id)||m().compact(e),card=node('article',null,'match-centre-card');card.dataset.matchId=id;
   card.append(node('h3',spoilerSafeDisplayTitle(e)));
   if(m().sport(e)==='tennis'){const brand=node('div',null,'event-hero-mark');renderEventIdentityMark(brand,e,sportMetaForEvent(e));card.append(brand);}
   const sides=buildMatchupIdentity(e,spoilerSafeDisplayTitle(e));if(sides)card.append(sides);
   const status=m().final(e)?'Finished':m().interrupted(e)?String(e.status).replace(/-/g,' '):/live|in.progress/.test(e.status)?'Live':'Not started';
   card.append(node('p',status));
   if(userPreferences.showSpoilers){
    const scored=node('p',null,'match-centre-score'),identities=matchupIdentityMatches(e,spoilerSafeDisplayTitle(e));
    const label=id=>identities.find(i=>i.participant?.id===id||i.mark?.id===id)?.label||(e.matchupSides||[]).find(s=>s.players?.some(p=>p.id===id))?.name||cardIdentityParticipants().find(p=>p.id===id)?.displayName;
    if(snapshot.score.home!=null&&snapshot.score.away!=null){
     scored.textContent=`${label(snapshot.homeParticipantId)||'Home'}: ${snapshot.score.home} · ${label(snapshot.awayParticipantId)||'Away'}: ${snapshot.score.away}`;
    }else if(snapshot.score.sets?.length||snapshot.score.games){scored.textContent=`${label(snapshot.homeParticipantId)||'First source side'} / ${label(snapshot.awayParticipantId)||'Second source side'}: ${scoreText(snapshot.score)}`;}
    else scored.textContent=scoreText(snapshot.score);card.append(scored);
    const age=Date.parse(snapshot.checkedAt||'');card.append(node('small',`${snapshot.stale||!Number.isFinite(age)||Date.now()-age>m().interval(e)*2?'Stale / ':''}${Number.isFinite(age)?'Checked '+new Date(age).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}):'Awaiting source update'}`));
    if(m().sport(e)==='tennis'&&(e.contestUnit==='tie'||e.contestType==='tie'||e.kind==='tie'||e.rubbers)){
     const details=node('details'),summary=node('summary','Individual rubbers');details.append(summary);details.open=expanded.has(id);
     for(const r of snapshot.rubbers||[])details.append(node('p',`${r.name}: ${scoreText(r.score)}`));
     details.ontoggle=()=>{if(details.open){expanded.add(id);if(!snapshot.rubbers)void poll([e],true);}else expanded.delete(id);};card.append(details);
    }
   }else card.append(node('p','Results hidden'));
   const actions=node('div',null,'match-centre-actions'),open=node('a','Open fixture','btn');open.href=`/fixture/${encodeURIComponent(id)}`;actions.append(open);
   if(snapshot.officialUrl){const official=node('a','Official scores','btn ghost');official.href=snapshot.officialUrl;official.target='_blank';official.rel='noopener noreferrer';actions.append(official);}card.append(actions);panel.append(card);
  }
 }
 async function poll(explicit=null,rubbers=false){
  if(document.hidden||activeTab!=='match-centre'||inflight)return;
  const visible=new Set([...document.querySelectorAll('[data-match-id]')].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>=0&&r.top<=innerHeight;}).map(n=>n.dataset.matchId));
  const events=(explicit||candidates().filter(e=>visible.has(m().id(e))&&Date.now()-(requested.get(m().id(e))||0)>=m().interval(e))).slice(0,60);if(!events.length)return;
  const ids=events.map(m().id).sort();ids.forEach(id=>requested.set(id,Date.now()));
  inflight=(async()=>{try{const r=await fetch(`/api/match-centre?ids=${encodeURIComponent(ids.join(','))}${rubbers?'&rubbers=1':''}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const data=await r.json();if(!data.enabled)return;for(const s of data.fixtures||[]){const prior=scores.get(s.id);scores.set(s.id,s.stale&&prior?{...prior,stale:true}:{...prior,...s});}render();}catch{ids.forEach(id=>{if(scores.has(id))scores.get(id).stale=true;});render();}finally{inflight=null;}})();return inflight;
 }
 globalThis.renderMatchCentre=()=>{
  render();if(!hydrating){hydrating=hydrate().then(()=>{render();void poll();}).catch(()=>{if(activeTab==='match-centre')document.getElementById('listView').append(node('p','Some Feed fixtures could not load. Reopen Match Centre to retry.'));}).finally(()=>{hydrating=null;});}
  clearInterval(timer);timer=setInterval(()=>{if(activeTab!=='match-centre'){clearInterval(timer);return;}if(document.hidden)return;void hydrate().then(()=>{render();void poll();}).catch(()=>{});},15000);void poll();
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
})();
