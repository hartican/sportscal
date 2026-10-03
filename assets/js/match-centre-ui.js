/* Lazy, read-only score surface. The host owns Feed eligibility and identity. */
(() => {
 'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=403';link.dataset.mcStyle='';document.head.append(link);
}
loadMatchCentreStyles();

 let selectedView='everything',nextCursor=null;const viewCache=new Map();
 const scores=new Map(),requested=new Map(),expanded=new Set();let timer,inflight=null,hydrating=null,membership=[],membershipKey='',membershipOwner='',membershipCheckedAt=0,generation=0,manual=null,lastManual=-Infinity,notice='',refreshControl;
 const owner=()=>serverSyncClient?.sessionSubject()||'public';
 const membershipQueryKey=()=>selectedView==='everything'?'everything':JSON.stringify([owner(),userPreferences,eventActions]);
 const ticket=()=>({generation,owner:owner(),view:selectedView,key:membershipQueryKey()});
 const valid=t=>t.generation===generation&&t.owner===owner()&&t.view===selectedView&&t.key===membershipQueryKey()&&activeTab==='match-centre';
 const m=()=>globalThis.NOTHINGSPORTS_MATCH_CENTRE;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function candidates(){if(membershipOwner!==owner())return [];return m().select(membership.map(e=>{const s=scores.get(m().id(e));if(!s)return e;const source=m().compact(e),latest=m().observation(source,s);return {...e,status:latest.status,completedAt:latest.completedAt||e.completedAt};}).filter(e=>{if(selectedView==='everything')return true;const a=getEventAction(e);return !a.archived&&!a.dismissed&&Boolean(eventFollowReason(e));}));}
 async function hydrate(force=false,append=false){
  const t=ticket();if(hydrating){await hydrating;if(!valid(t))return;}
  if(!valid(t)||(!append&&!force&&t.key===membershipKey&&Date.now()-membershipCheckedAt<300000))return;
  const operation=(async()=>{
   const cursor=append?(nextCursor||0):0;
   let data;
   if(selectedView==='everything'){const response=await fetch(`/api/match-centre?membership=everything&limit=50&cursor=${cursor}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();data=await response.json();if(data.enabled!==true)throw Error('Match Centre is unavailable');}
   else data=serverPersistence.user?await serverSyncClient.loadFeed({cursor,limit:50,scope:'match-centre'}):await fetch(`/api/feed?scope=match-centre&limit=50&cursor=${cursor}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:userPreferences,eventUserState:eventActions}),signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();});
   if(!valid(t))return;
   for(const snapshot of data.fixtures||[])scores.set(snapshot.id,m().observation(scores.get(snapshot.id),snapshot));
   membership=[...new Map([...(append?membership:[]),...(data.events||[])].map(e=>[m().id(e),e])).values()];
   nextCursor=data.pagination?.nextCursor??null;if(nextCursor!==null&&(!Number.isSafeInteger(nextCursor)||nextCursor<=cursor))throw Error('Invalid membership continuation');
   membershipOwner=owner();membershipKey=t.key;membershipCheckedAt=Date.now();notice='';
   viewCache.set(selectedView,{events:membership,key:membershipKey,checked:membershipCheckedAt,nextCursor});
  })();hydrating=operation;try{return await operation;}finally{if(hydrating===operation)hydrating=null;}
 }
 function scoreText(s){if(!s)return 'Scores unavailable';if(s.innings)return s.innings.length?s.innings.map(i=>`${i.team||i.participantId||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · '):'Scores unavailable';if(s.sets?.length||s.games)return (s.sets||[]).map(x=>`${x.home??'—'}–${x.away??'—'}`).join('  ')+(s.games?` · Games ${s.games.home??'—'}–${s.games.away??'—'}`:'');return s.home!=null&&s.away!=null?`${s.home}–${s.away}`:'Scores unavailable';}
 function statusText(e,snapshot){return globalThis.NOTHINGSPORTS_ODI_DISPLAY.awaiting({...e,...snapshot})?'Awaiting confirmed result':m().final(snapshot)?'Finished':m().interrupted(snapshot)?String(snapshot.status).replace(/-/g,' '):/live|in.progress/.test(snapshot.status)?(snapshot.stale?'Awaiting match update':'Live'):snapshot.status==='ongoing'?'Ongoing · between sessions':/cancel|abandon|postpon/.test(snapshot.status)?String(snapshot.status):/scheduled|upcoming/.test(snapshot.status)?(Date.parse(e.startTimeUtc)<Date.now()?'Start passed · awaiting status':'Starting soon'):'Status unavailable';}
 function scoreLabel(e,snapshot){
  const identities=matchupIdentityMatches(e,spoilerSafeDisplayTitle(e)),label=id=>identities.find(i=>i.participant?.id===id||i.mark?.id===id)?.label||(e.participantSlots||[]).find(s=>s.participantId===id)?.label||(e.participants||[]).find(p=>p.id===id)?.displayName||(e.participants||[]).find(p=>p.id===id)?.name||cardIdentityParticipants().find(p=>p.id===id)?.displayName;
  if(snapshot.score.home!=null&&snapshot.score.away!=null)return `${label(snapshot.homeParticipantId)||'Home'}: ${snapshot.score.home} · ${label(snapshot.awayParticipantId)||'Away'}: ${snapshot.score.away}`;
  if(snapshot.score.sets?.length||snapshot.score.games)return `${label(snapshot.homeParticipantId)||'First source side'} / ${label(snapshot.awayParticipantId)||'Second source side'}: ${scoreText(snapshot.score)}`;
  return scoreText(snapshot.score);
 }
 function feedButton(e){
  const action=getEventAction(e),included=Boolean(eventFollowReason(e))&&!action.dismissed&&!action.archived,button=node('button',included?'In Feed':'Add to Feed','btn ghost');button.type='button';const scheduleOnly=!FOLLOW_FEED_POLICY.feedEligibleSession(e)||!FOLLOW_FEED_POLICY.sportingFixture(e);button.disabled=included||scheduleOnly||FOLLOW_FEED_POLICY.explicitlyExcluded(e,userPreferences);if(scheduleOnly)button.textContent='Schedule only';
  button.onclick=()=>{const prior=getEventAction(e),next=updateEventAction(e,{addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),addedFixture:{...e,manualPin:true},dismissed:false,archived:false,pinState:'added',pinRevision:(Number(prior.pinRevision)||0)+1,pinMutationId:crypto.randomUUID()});queueFixturePinCommand(eventActionKey(e),next);activeEvents=mergeCanonicalEventPages(activeEvents,[e]);button.textContent='In Feed';button.disabled=true;};return button;
 }
 function render(){
  if(activeTab!=='match-centre')return;
  const panel=document.getElementById('listView'),focused=panel.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;panel.className='match-centre';
  const heading=node('div',null,'match-centre-heading');heading.append(node('h2','Match Centre'));
  const refresh=node('button','Refresh','btn ghost');refresh.type='button';refresh.setAttribute('aria-label','Refresh Match Centre');refresh.disabled=Boolean(manual);refresh.onclick=()=>void manualRefresh();heading.append(refresh);panel.replaceChildren(heading);
  const tabs=node('div',null,'mc-membership-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Match Centre fixtures');
  for(const [view,label] of [['everything','Everything'],['followed','Followed']]){const tab=node('button',label,'btn ghost');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(selectedView===view));tab.onclick=()=>{if(selectedView===view)return;generation++;selectedView=view;manual=null;notice='';const cached=viewCache.get(view);membership=cached?.events||[];membershipKey=cached?.key||'';membershipCheckedAt=cached?.checked||0;nextCursor=cached?.nextCursor??null;membershipOwner=owner();renderMatchCentre();};tabs.append(tab);}panel.append(tabs);
  const announcement=node('p',notice,'mc-refresh-notice');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');panel.append(announcement);panel.setAttribute('aria-busy',String(Boolean(manual||hydrating)));
  const all=candidates(),choice=buildSurfaceCategoryChooser('match-centre',all,render,{includeAll:true});heading.append(choice.select);const events=all.filter(e=>NOTHINGSPORTS_SURFACE_CATEGORY.matches(e,choice.selected));
  if(!events.length)panel.append(node('p',hydrating?'Loading live fixtures…':selectedView==='everything'?'No fixtures in the live window. Fixtures appear 30 minutes before start.':'No followed fixtures in the live window. Add a fixture to Feed or follow its participants.'));
  for(const e of events){
   const id=m().id(e),snapshot=m().observation(m().compact(e),scores.get(id)||m().compact(e)),card=node('article',null,'match-centre-card'),details=node('details'),summary=node('summary',null,'mc-row');card.dataset.matchId=id;details.open=expanded.has(id);summary.setAttribute('aria-label',`Expand ${spoilerSafeDisplayTitle(e)}`);
   const identity=node('div',null,'mc-row-identity');identity.append(node('h3',spoilerSafeDisplayTitle(e)),node('small',[e.sport||m().sport(e),e.tournamentName||e.competitionName||e.eventName].filter(Boolean).join(' · ')));summary.append(identity);
   const status=node('div',null,'mc-row-status');status.append(node('span',[statusText(e,snapshot),snapshot.clock].filter(Boolean).join(' · ')),node('p',userPreferences.showSpoilers?NOTHINGSPORTS_FIXTURE_LABELS.displayName(scoreLabel(e,snapshot),e):'Results hidden',userPreferences.showSpoilers?'match-centre-score':''));summary.append(status);
   const age=Date.parse(snapshot.scoreCheckedAt||snapshot.checkedAt||'');summary.append(node('small',`${snapshot.stale||!Number.isFinite(age)||Date.now()-age>m().interval(e)*2?'Stale · ':''}${Number.isFinite(age)?'Checked '+new Date(age).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}):'Awaiting source update'}`,'mc-row-freshness'));details.append(summary);
   const content=node('div',null,'mc-expanded');content.append(buildFixtureTimingGroup(e));if(e.venue||e.court)content.append(node('p',[e.venue,e.court].filter(Boolean).join(' · ')));if(userPreferences.showSpoilers&&snapshot.statusText)content.append(node('p',snapshot.statusText));
   if(userPreferences.showSpoilers){
    for(const incident of snapshot.incidents||[])content.append(node('p',[incident.type,incident.name,incident.time!=null?String(incident.time):null].filter(Boolean).join(' · ')));
    if(snapshot.score.innings?.length)for(const inning of snapshot.score.innings)content.append(node('p',`${inning.team||inning.participantId||'Innings'} ${inning.runs??'—'}/${inning.wickets??'—'} (${inning.overs??'—'} overs)`));
    for(const rubber of snapshot.rubbers||[])content.append(node('p',`${rubber.name}: ${rubber.status==='not-required'?'Not required':rubber.status==='upcoming'||rubber.status==='unconfirmed'?'Awaiting official score':scoreText(rubber.score)}`));
   }
   const actions=node('div',null,'match-centre-actions');actions.append(feedButton(e));if(snapshot.officialUrl){const official=node('a','Official fixture','btn ghost');official.href=snapshot.officialUrl;official.target='_blank';official.rel='noopener noreferrer';actions.append(official);}content.append(actions);details.append(content);card.append(details);panel.append(card);
   details.ontoggle=()=>{if(!details.isConnected)return;if(details.open){expanded.add(id);if(userPreferences.showSpoilers&&e.rubbers&&!snapshot.rubbers)void poll([e],true);}else expanded.delete(id);};
  }
  if(nextCursor!==null){const more=node('button','Load more live fixtures','btn ghost');more.onclick=async()=>{more.disabled=true;try{await hydrate(false,true);render();void poll();}catch{notice='More fixtures could not load. Retry when connected.';render();}};panel.append(more);}
  if(focused)requestAnimationFrame(()=>[...panel.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focused)?.focus({preventScroll:true}));
 }
 async function poll(explicit=null,rubbers=false,force=false){
  if(document.hidden||activeTab!=='match-centre')return true;
  if(inflight){const result=await inflight;if(!force)return result;}
  const t=ticket();
  const visible=new Set([...document.querySelectorAll('[data-match-id]')].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>=0&&r.top<=innerHeight;}).map(n=>n.dataset.matchId));
  let events=explicit||candidates().filter(e=>visible.has(m().id(e))&&(force||Date.now()-(requested.get(m().id(e))||0)>=m().interval(e)));
  events=events.slice(0,60);if(!events.length)return true;
  if(events.some(e=>expanded.has(m().id(e))))rubbers=true;
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
  if(membershipOwner&&membershipOwner!==owner()){globalThis.stopMatchCentre();membership=[];membershipKey='';membershipOwner=owner();lastManual=-Infinity;scores.clear();requested.clear();expanded.clear();viewCache.clear();nextCursor=null;}
  refreshControl||=globalThis.createMatchCentreRefresh({panel:document.getElementById('listView'),enabled:()=>activeTab==='match-centre'&&!document.hidden,refresh:manualRefresh});
  if(!membership.length){membership=selectedView==='followed'?[...activeEvents].filter(e=>Boolean(eventFollowReason(e))):[];membershipOwner=owner();}
  const t=ticket();render();void hydrate().then(()=>{if(!valid(t))return;render();if(!manual)void poll();}).catch(()=>{if(!valid(t))return;if(!manual&& !notice)notice='Some fixtures could not load. Refresh to retry.';render();});
  clearInterval(timer);timer=setInterval(()=>{if(activeTab!=='match-centre'){globalThis.stopMatchCentre();return;}if(document.hidden||manual||refreshControl.pulling)return;void hydrate().then(()=>{render();void poll();}).catch(()=>{});},15000);if(!manual)void poll();
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
})();
