/* Lazy, read-only score surface. The host owns Feed eligibility and identity. */
(() => {
 'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=463';link.dataset.mcStyle='';document.head.append(link);
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
 function observations(){if(membershipOwner!==owner())return [];return membership.map(e=>{const s=scores.get(m().id(e));if(!s)return e;const source=m().compact(e),latest=m().observation(source,s);return {...e,status:latest.status,statusCheckedAt:latest.statusCheckedAt,livePlayObservedAt:latest.livePlayObservedAt,completedAt:latest.completedAt||e.completedAt,...(latest.court?{court:latest.court}:{}),...(latest.statusSourceType?{statusSourceType:latest.statusSourceType}:{})};}).filter(e=>{if(selectedView==='everything')return true;const a=getEventAction(e);return !a.archived&&!a.dismissed&&Boolean(eventFollowReason(e));});}
 function candidates(){return m().select(observations());}
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
   membershipOwner=owner();membershipKey=t.key;membershipCheckedAt=Date.now();notice=data.membershipConflicts?'Conflicting court updates are withheld while the source is checked.':data.membershipStale?'Match list needs rechecking. Showing published fixtures.':'';
   viewCache.set(selectedView,{events:membership,key:membershipKey,checked:membershipCheckedAt,nextCursor});
  })();hydrating=operation;try{return await operation;}finally{if(hydrating===operation)hydrating=null;}
 }
 function scoreText(s){if(!s)return 'Scores unavailable';if(s.innings)return s.innings.length?s.innings.map(i=>`${i.team||i.participantId||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · '):'Scores unavailable';if(s.sets?.length||s.games)return (s.sets||[]).map(x=>`${x.home??'—'}–${x.away??'—'}`).join('  ')+(s.games?` · Games ${s.games.home??'—'}–${s.games.away??'—'}`:'');return s.home!=null&&s.away!=null?`${s.home}–${s.away}`:'Scores unavailable';}
 function statusText(e,snapshot){const current={...e,...snapshot},state=m().liveState(current);return m().final(current)?'Finished':state==='awaiting-update'?'Awaiting update':state==='paused'?String(current.status).replace(/-/g,' '):state==='playing'?'Live':'Starting soon';}
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
 const cards=new Map();let chrome=null,chromeKey='';
 const patchText=(element,value)=>{const text=String(value??'');if(element.textContent!==text)element.textContent=text;};
 function makeCard(e){
  const id=m().id(e),card=node('article',null,'match-centre-card event-overview-card'),details=node('details'),summary=node('summary',null,'mc-row'),top=node('div',null,'mc-card-top'),mark=node('span',null,'mc-event-mark');card.dataset.matchId=id;details.open=expanded.has(id);summary.setAttribute('aria-label',`Expand ${spoilerSafeDisplayTitle(e)}`);renderEventIdentityMark(mark,e,sportMetaForEvent(e));top.append(mark,node('small',[e.tournamentName||e.competitionName||e.eventName,e.court].filter(Boolean).join(' · ')));summary.append(top);
  const identities=matchupIdentityMatches(e,spoilerSafeDisplayTitle(e)),sides=node('div',null,'mc-participants');summary.append(sides);
  const snapshot=m().compact(e),ids=[snapshot.homeParticipantId,snapshot.awayParticipantId].filter(Boolean),ordered=ids.length===2?ids.map(id=>identities.find(i=>i.participant?.id===id||i.mark?.id===id)||{participant:(e.participants||[]).find(p=>p.id===id),label:(e.participants||[]).find(p=>p.id===id)?.displayName||id}):identities;
  const rows=[];for(const identity of ordered){const row=node('div',null,'mc-participant-row'),score=node('div',null,'mc-participant-score');const identityNode=buildCompactParticipant(identity,e),participant=(e.participants||[]).find(p=>p.id===(identity.participant?.id||identity.mark?.id)),country=participant?.countryCode||identity.participant?.countryCode||identity.mark?.countryCode;const flag=COUNTRY_FLAGS?.flagMarkup?.(country,{className:'mc-participant-flag'});if(flag&&!identity.mark?.url&&!identity.mark?.logo?.primary){identityNode.insertAdjacentHTML('afterbegin',flag);const image=identityNode.querySelector('.mc-participant-flag');image.onload=()=>identityNode.querySelector('.compact-participant-fallback')?.remove();image.onerror=()=>image.remove();}row.append(identityNode,score);sides.append(row);rows.push({id:identity.participant?.id||identity.mark?.id,score});}
  if(!ordered.length)sides.append(node('h3',spoilerSafeDisplayTitle(e)));
  const status=node('span',null,'mc-status'),freshness=node('small',null,'mc-row-freshness'),classification=node('div',null,'mc-classification');summary.append(classification,status,freshness);details.append(summary);
  const content=node('div',null,'mc-expanded');content.append(buildFixtureTimingGroup(e));if(e.venue||e.court)content.append(node('p',[e.venue,e.court&&e.court!==e.venue?e.court:null].filter(Boolean).join(' · ')));const updates=node('div',null,'mc-score-details');content.append(updates);
  const actions=node('div',null,'match-centre-actions');actions.append(feedButton(e));appendEventQuickActions(actions,e,{chat:false,viewing:false});if(snapshot.officialUrl){const official=node('a',e.sourceType==='official'?'Official fixture':(e.sourceName||'Published')+' source','btn ghost');official.href=snapshot.officialUrl;official.target='_blank';official.rel='noopener noreferrer';actions.append(official);}content.append(actions);details.append(content);card.append(details);
  details.ontoggle=()=>{if(!details.isConnected)return;if(details.open){expanded.add(id);if(userPreferences.showSpoilers&&e.rubbers)void poll([e],true);}else expanded.delete(id);};
  return {card,details,rows,status,freshness,classification,updates,updateKey:'',scoreKeys:new Map()};
 }
 function patchCard(view,e){
  const snapshot=m().observation(m().compact(e),scores.get(m().id(e))||m().compact(e)),score=snapshot.score||{},visible=userPreferences.showSpoilers;
  patchText(view.status,[statusText(e,snapshot),visible?snapshot.clock:null].filter(Boolean).join(' · '));view.status.classList.toggle('mc-active-live',m().liveState({...e,...snapshot})==='playing');
  const checked=Date.parse(snapshot.statusCheckedAt||snapshot.checkedAt||'');patchText(view.freshness,Number.isFinite(checked)?'Source update '+new Date(checked).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}):'Awaiting source update');
  for(const [index,row] of view.rows.entries()){
   const side=row.id===snapshot.homeParticipantId?'home':row.id===snapshot.awayParticipantId?'away':index===0?'home':'away';let values=[];
   if(!visible)values=['Hidden'];else if(score.sets?.length||score.games){values=(score.sets||[]).map(set=>set[side]!=null?String(set[side])+(set[side+'Tiebreak']!=null?'('+set[side+'Tiebreak']+')':''):'—');if(score.games)values.push(score.games[side]??'—');}else if(score.innings){values=score.innings.filter(i=>i.participantId===row.id).map(i=>`${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'})`);}else if(score[side]!=null)values=[score[side]];else values=['—'];
   const shape=values.length;if(row.score.children.length!==shape)row.score.replaceChildren(...values.map(()=>node('span',null,'mc-score-cell')));values.forEach((value,i)=>patchText(row.score.children[i],value));row.score.classList.toggle('mc-score-hidden',!visible);row.score.setAttribute('aria-label',!visible?'Results hidden':score.sets?.length?'Set scores'+(score.games?' and current games':''):'Score');
  }
  const data=visible?JSON.stringify([snapshot.statusText,snapshot.incidents,snapshot.rubbers,score.classification]):'hidden';if(data!==view.updateKey){view.updateKey=data;view.updates.replaceChildren();view.classification.replaceChildren();if(visible){if(snapshot.statusText)view.updates.append(node('p',snapshot.statusText));for(const incident of snapshot.incidents||[])view.updates.append(node('p',[incident.type,incident.name,incident.time].filter(Boolean).join(' · ')));for(const rubber of snapshot.rubbers||[])view.updates.append(node('p',rubber.name+': '+(/upcoming|unconfirmed/.test(rubber.status)?'Awaiting official score':scoreText(rubber.score))));for(const entry of score.classification||[])view.classification.append(node('p',Array.isArray(entry)?entry.join(' · '):[entry.position,entry.displayName||entry.name,entry.time||entry.points].filter(v=>v!=null).join(' · ')));}}
 }
 function render(){
  if(activeTab!=='match-centre')return;const panel=document.getElementById('listView'),all=candidates();
  const key=JSON.stringify([selectedView,owner(),userPreferences.showSpoilers,[...new Set(all.map(e=>m().sport(e)))].sort()]);
  if(!chrome?.heading.isConnected||chromeKey!==key){chromeKey=key;cards.clear();panel.className='match-centre';const heading=node('div',null,'match-centre-heading'),refresh=node('button','Refresh','btn ghost'),tabs=node('div',null,'mc-membership-tabs'),noticeNode=node('p',null,'mc-refresh-notice'),empty=node('p'),more=node('button','Load more live fixtures','btn ghost');heading.append(node('h2','Match Centre'),refresh);refresh.type='button';refresh.setAttribute('aria-label','Refresh Match Centre');refresh.onclick=()=>void manualRefresh();tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Match Centre fixtures');
   for(const [view,label] of [['everything','Everything'],['followed','Followed']]){const tab=node('button',label,'btn ghost');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(selectedView===view));tab.onclick=()=>{if(selectedView===view)return;generation++;selectedView=view;manual=null;notice='';const cached=viewCache.get(view);membership=cached?.events||[];membershipKey=cached?.key||'';membershipCheckedAt=cached?.checked||0;nextCursor=cached?.nextCursor??null;membershipOwner=owner();renderMatchCentre();};tabs.append(tab);}
   const choice=buildSurfaceCategoryChooser('match-centre',all,render,{includeAll:true});heading.append(choice.select);noticeNode.setAttribute('role','status');noticeNode.setAttribute('aria-live','polite');const sections=new Map();panel.replaceChildren(heading,tabs,noticeNode,empty);for(const [id,title] of [['live','Live'],['starting-soon','Starting soon'],['recently-finished','Recently finished']]){const section=node('section',null,'mc-section'),list=node('div',null,'mc-card-list');section.append(node('h3',title),list);panel.append(section);sections.set(id,{section,list});}more.type='button';more.onclick=async()=>{more.disabled=true;try{await hydrate(false,true);render();void poll();}catch{notice='More fixtures could not load. Retry when connected.';render();}};panel.append(more);chrome={heading,refresh,noticeNode,empty,sections,more,choice};
  }
  chrome.refresh.disabled=Boolean(manual);panel.setAttribute('aria-busy',String(Boolean(manual||hydrating)));const events=all.filter(e=>NOTHINGSPORTS_SURFACE_CATEGORY.matches(e,chrome.choice.select.value)),conflicts=m().conflicts(observations());patchText(chrome.noticeNode,conflicts.length?'Conflicting court updates are withheld while the source is checked.':notice);patchText(chrome.empty,hydrating?'Loading current fixtures…':selectedView==='everything'?'No fixtures in the current live window.':'No followed fixtures in the current live window.');chrome.empty.hidden=Boolean(events.length);chrome.more.hidden=nextCursor===null;chrome.more.disabled=false;
  const keep=new Set(events.map(m().id));for(const [id,view] of cards)if(!keep.has(id)){view.card.remove();cards.delete(id);}for(const {section} of chrome.sections.values())section.hidden=true;
  const positions=new Map();for(const e of events){const id=m().id(e),group=chrome.sections.get(m().section(e));if(!group)continue;group.section.hidden=false;let view=cards.get(id);if(!view){view=makeCard(e);cards.set(id,view);}patchCard(view,e);const index=positions.get(group.list)||0;if(group.list.children[index]!==view.card)group.list.insertBefore(view.card,group.list.children[index]||null);positions.set(group.list,index+1);}
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
