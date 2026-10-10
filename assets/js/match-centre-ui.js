/* Lazy, read-only score surface. The host owns Feed eligibility and identity. */
(() => {
 'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=479';link.dataset.mcStyle='';document.head.append(link);
}
loadMatchCentreStyles();

 let selectedView='followed',nextCursor=null;const viewCache=new Map();
 const scores=new Map(),requested=new Map(),expanded=new Set();let timer,inflight=null,hydrating=null,membership=[],membershipKey='',membershipOwner='',membershipCheckedAt=0,membershipMaxAge=120000,generation=0,manual=null,lastManual=-Infinity,notice='',refreshControl;
 const owner=()=>serverSyncClient?.sessionSubject()||'public';
 const membershipQueryKey=()=>selectedView==='everything'?'everything':JSON.stringify([owner(),userPreferences,eventActions]);
 const ticket=()=>({generation,owner:owner(),view:selectedView,key:membershipQueryKey()});
 const valid=t=>t.generation===generation&&t.owner===owner()&&t.view===selectedView&&t.key===membershipQueryKey()&&activeTab==='match-centre';
 const m=()=>globalThis.NOTHINGSPORTS_MATCH_CENTRE;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const cacheKey=t=>`match-centre:v1:${t.owner}:${t.view}`;
 let restoring=null;
 function saveMembership(t){
  if(!valid(t)||!disposableStore?.set)return;
  disposableStore.set(cacheKey(t),{key:t.key,events:membership,fixtures:membership.map(e=>scores.get(m().id(e))).filter(Boolean),nextCursor},{ttlMs:7*86400000});
  void disposableStore.flush?.();
 }
 async function restoreMembership(){
  const t=ticket();if(membershipKey===t.key||!disposableStore?.hydrate)return;
  if(restoring)return restoring;
  const operation=(async()=>{const cached=await disposableStore.hydrate(cacheKey(t),null);if(!valid(t)||membershipKey===t.key||cached?.key!==t.key||!Array.isArray(cached.events)||!Array.isArray(cached.fixtures))return;
   membership=cached.events.filter(e=>e&&m().id(e)&&m().supported(e));membershipOwner=t.owner;membershipKey=t.key;membershipCheckedAt=0;nextCursor=null;
   for(const snapshot of cached.fixtures)if(snapshot?.id)scores.set(snapshot.id,m().observation(scores.get(snapshot.id),snapshot));
   notice='Showing last available fixtures. Checking for updates…';render();
  })();restoring=operation;try{await operation;}finally{if(restoring===operation)restoring=null;}
 }
 function markAwaiting(ids){for(const id of ids){const prior=scores.get(id)||m().compact(membership.find(e=>m().id(e)===id)||{});scores.set(id,{...prior,stale:true});}}
 function observations(){if(membershipOwner!==owner())return [];return membership.map(e=>{const s=scores.get(m().id(e));if(!s)return e;const source=m().compact(e),latest=m().observation(source,s);return {...e,status:latest.status,stale:latest.stale,statusCheckedAt:latest.statusCheckedAt,livePlayObservedAt:latest.livePlayObservedAt,completedAt:latest.completedAt||e.completedAt,...(latest.court?{court:latest.court}:{}),...(latest.statusSourceType?{statusSourceType:latest.statusSourceType}:{})};}).filter(e=>{if(selectedView==='everything')return true;const a=getEventAction(e);return !a.archived&&!a.dismissed&&Boolean(eventFollowReason(e));});}
 function candidates(){return m().select(observations());}
 function currentFixture(e){
  const snapshot=m().observation(m().compact(e),scores.get(m().id(e))||m().compact(e)),score=snapshot.score||{};
  const current={...e,status:snapshot.status,statusCheckedAt:snapshot.statusCheckedAt,scoreCheckedAt:snapshot.scoreCheckedAt,stale:snapshot.stale,completedAt:snapshot.completedAt||e.completedAt};
  for(const field of ['sets','games','innings'])if(Object.hasOwn(score,field))current[field]=score[field];
  if(Object.hasOwn(score,'home'))current.homeScore=score.home;if(Object.hasOwn(score,'away'))current.awayScore=score.away;
  return current;
 }
 async function hydrate(force=false,append=false){
  const t=ticket();if(hydrating){try{await hydrating;}catch{}if(!valid(t))return;}
  if(!valid(t)||(!append&&!force&&t.key===membershipKey&&Date.now()-membershipCheckedAt<membershipMaxAge))return;
  const operation=(async()=>{
   const cursor=append?(nextCursor||0):0;
   let data;
   if(selectedView==='everything'){const response=await fetch(`/api/match-centre?membership=everything&limit=50&cursor=${cursor}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();data=await response.json();if(data.enabled!==true)throw Error('Match Centre is unavailable');}
   else data=serverPersistence.user?await serverSyncClient.loadFeed({cursor,limit:50,scope:'match-centre'}):await fetch(`/api/feed?scope=match-centre&limit=50&cursor=${cursor}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:userPreferences,eventUserState:eventActions}),signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();});
   if(!valid(t))return;
   if(!Array.isArray(data.events)||data.events.some(e=>!e||!m().id(e))||data.fixtures!=null&&!Array.isArray(data.fixtures))throw Error('Invalid fixture list');
   const continuation=data.pagination?.nextCursor??null;if(continuation!==null&&(!Number.isSafeInteger(continuation)||continuation<=cursor))throw Error('Invalid membership continuation');
   for(const snapshot of data.fixtures||[])if(snapshot?.id)scores.set(snapshot.id,m().observation(scores.get(snapshot.id),snapshot));
   const degraded=data.membershipStale===true,retain=membershipKey===t.key&&membershipOwner===t.owner;
   // Page omissions and failed sources cannot confirm that an unresolved
   // sporting contest ended. Explicit returned terminal facts still win.
   membership=[...new Map([...(retain?membership.filter(e=>append||m().eligible(e)):[]),...data.events].map(e=>[m().id(e),e])).values()];
   nextCursor=continuation;
   membershipOwner=owner();membershipKey=t.key;membershipCheckedAt=Date.now();membershipMaxAge=degraded?30000:120000;notice=data.membershipConflicts?'Conflicting court updates are withheld while the source is checked.':degraded?'Match list needs rechecking. Showing last available fixtures. Rechecking shortly.':'';
   viewCache.set(selectedView,{events:membership,key:membershipKey,checked:membershipCheckedAt,nextCursor,maxAge:membershipMaxAge});
   if(!degraded)saveMembership(t);
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
 function scoreTable(container,title,columns,rows){
  if(!rows?.length)return;
  const wrap=node('div',null,'mc-score-table-wrap'),table=node('table',null,'mc-score-table');wrap.tabIndex=0;wrap.setAttribute('aria-label',title);table.append(node('caption',title));
  const head=node('thead'),tr=node('tr');for(const [title] of columns){const th=node('th',title);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  const body=node('tbody');for(const row of rows){const tr=node('tr');columns.forEach(([,key],index)=>{const cell=node(index?'td':'th',row[key]??'—');if(!index)cell.scope='row';tr.append(cell);});body.append(tr);}table.append(body);wrap.append(table);container.append(wrap);
 }
 function cricketDetails(container,innings){
  for(const inning of innings||[]){const title=[inning.team||'Innings',inning.inningNumber?`innings ${inning.inningNumber}`:null].filter(Boolean).join(' · ');
   scoreTable(container,title,[['Runs','runs'],['Wickets','wickets'],['Overs','overs']],[inning]);
   scoreTable(container,'Batting · '+title,[['Player','name'],['Runs','runs'],['Balls','balls'],['4s','fours'],['6s','sixes'],['Dismissal','dismissal'],['Bowled by','bowledBy']],inning.batting);
   scoreTable(container,'Bowling · '+title,[['Player','name'],['Overs','overs'],['Maidens','maidens'],['Runs','runs'],['Wickets','wickets']],inning.bowling);
  }
 }
 function makeCard(e){
  const id=m().id(e),card=node('article',null,'match-centre-card event-overview-card'),details=node('details'),summary=node('summary',null,'mc-row'),top=node('div',null,'mc-card-top'),mark=node('span',null,'mc-event-mark');card.dataset.matchId=id;card.dataset.viewportAnchorKey='match-centre:'+id;details.open=expanded.has(id);summary.setAttribute('aria-label',`Expand ${spoilerSafeDisplayTitle(e)}`);renderEventIdentityMark(mark,e,sportMetaForEvent(e));top.append(mark,node('small',[e.tournamentName||e.competitionName||e.eventName,e.court].filter(Boolean).join(' · ')));summary.append(top);
  const identities=matchupIdentityMatches(e,spoilerSafeDisplayTitle(e)),sides=node('div',null,'mc-participants');summary.append(sides);
  const snapshot=m().compact(e),ids=[snapshot.homeParticipantId,snapshot.awayParticipantId].filter(Boolean),ordered=ids.length===2?ids.map(id=>identities.find(i=>i.participant?.id===id||i.mark?.id===id)||{participant:(e.participants||[]).find(p=>p.id===id),label:(e.participants||[]).find(p=>p.id===id)?.displayName||id}):identities;
  const rows=[];for(const identity of ordered){const row=node('div',null,'mc-participant-row'),score=node('div',null,'mc-participant-score');const identityNode=buildCompactParticipant(identity,e),participant=(e.participants||[]).find(p=>p.id===(identity.participant?.id||identity.mark?.id)),country=participant?.countryCode||identity.participant?.countryCode||identity.mark?.countryCode;const flag=COUNTRY_FLAGS?.flagMarkup?.(country,{className:'mc-participant-flag'});if(flag&&!identity.mark?.url&&!identity.mark?.logo?.primary){identityNode.insertAdjacentHTML('afterbegin',flag);const image=identityNode.querySelector('.mc-participant-flag');image.onload=()=>identityNode.querySelector('.compact-participant-fallback')?.remove();image.onerror=()=>image.remove();}row.append(identityNode,score);sides.append(row);rows.push({id:identity.participant?.id||identity.mark?.id,score});}
  if(!ordered.length)sides.append(node('h3',spoilerSafeDisplayTitle(e)));
  const status=node('span',null,'mc-status'),freshness=node('small',null,'mc-row-freshness'),classification=node('div',null,'mc-classification');summary.append(classification,status,freshness);details.append(summary);
  const content=node('div',null,'mc-expanded'),timing=buildFixtureTimingGroup(e);timing.querySelector('.fixture-timing-badge').onclick=click=>{click.stopPropagation();void openFixtureFromTimingCapsule(currentFixture(e));};content.append(timing);if(e.venue||e.court)content.append(node('p',[e.venue,e.court&&e.court!==e.venue?e.court:null].filter(Boolean).join(' · ')));const updates=node('div',null,'mc-score-details');content.append(updates);
  const actions=node('div',null,'match-centre-actions');actions.append(feedButton(e));appendEventQuickActions(actions,e,{chat:false,viewing:false});const sourceLink=node('a',null,'btn ghost');sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';actions.append(sourceLink);content.append(actions);details.append(content);card.append(details);
  details.ontoggle=()=>{if(!details.isConnected)return;if(details.open){expanded.add(id);if(isSpoilerVisible(e)&&e.rubbers)void poll([e],true);}else expanded.delete(id);const view=cards.get(id);if(view?.details===details)patchCard(view,e);};
  return {card,details,rows,status,freshness,classification,updates,sourceLink,updateKey:'',scoreKeys:new Map()};
 }
 function patchCard(view,e){
  const snapshot=m().observation(m().compact(e),scores.get(m().id(e))||m().compact(e)),score=snapshot.score||{},visible=isSpoilerVisible(e);
  patchText(view.status,[statusText(e,snapshot),visible&&snapshot.clock?(m().sport(e)==='tennis'?'Duration '+snapshot.clock:snapshot.clock):null].filter(Boolean).join(' · '));view.status.classList.toggle('mc-active-live',m().liveState({...e,...snapshot})==='playing');
  const link=snapshot.scorecardUrl||snapshot.officialUrl;view.sourceLink.hidden=!link;if(link){view.sourceLink.href=link;patchText(view.sourceLink,snapshot.scorecardUrl?(snapshot.scorecardOfficial?'Official scorecard':'Source scorecard'):e.sourceType==='official'?'Official fixture':(e.sourceName||'Published')+' source');}
  const checked=Date.parse(snapshot.statusCheckedAt||snapshot.checkedAt||'');patchText(view.freshness,Number.isFinite(checked)?'Source update '+new Date(checked).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}):'Awaiting source update');
  for(const [index,row] of view.rows.entries()){
   const side=row.id===snapshot.homeParticipantId?'home':row.id===snapshot.awayParticipantId?'away':index===0?'home':'away';let values=[];
   if(!visible)values=['Hidden'];else if(score.sets?.length||score.games){values=(score.sets||[]).map(set=>set[side]!=null?String(set[side])+(set[side+'Tiebreak']!=null?'('+set[side+'Tiebreak']+')':''):'—');if(score.games)values.push(score.games[side]??'—');}else if(score.innings){values=score.innings.filter(i=>i.participantId===row.id).map(i=>`${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'})`);}else if(score[side]!=null)values=[score[side]];else values=['—'];
   const shape=values.length;if(row.score.children.length!==shape)row.score.replaceChildren(...values.map(()=>node('span',null,'mc-score-cell')));values.forEach((value,i)=>patchText(row.score.children[i],value));row.score.classList.toggle('mc-score-hidden',!visible);row.score.setAttribute('aria-label',!visible?'Results hidden':score.sets?.length?'Set scores'+(score.games?' and current games':''):'Score');
  }
  const data=visible?JSON.stringify([view.details.open,snapshot.statusText,snapshot.incidents,snapshot.rubbers,score.classification,score.innings]):'hidden';
  if(data!==view.updateKey){
   view.updateKey=data;view.updates.replaceChildren();view.classification.replaceChildren();
   if(visible){
    if(view.details.open){
     if(snapshot.statusText)view.updates.append(node('p',snapshot.statusText));cricketDetails(view.updates,score.innings);
     for(const incident of snapshot.incidents||[])view.updates.append(node('p',[incident.type,incident.name,incident.time].filter(v=>v!=null&&v!=='').join(' · ')));
     for(const rubber of snapshot.rubbers||[])view.updates.append(node('p',rubber.name+': '+(/upcoming|unconfirmed/.test(rubber.status)?'Awaiting official score':scoreText(rubber.score))));
    }
    for(const entry of score.classification||[])view.classification.append(node('p',Array.isArray(entry)?entry.join(' · '):[entry.position,entry.displayName||entry.name,entry.time||entry.points].filter(v=>v!=null).join(' · ')));
   }
  }
 }
 function render(){
  if(activeTab!=='match-centre')return;
  const focused=document.activeElement,focusCard=focused?.closest?.('[data-match-id]'),focusPath=[];
  for(let n=focused;focusCard&&n!==focusCard;n=n.parentElement)focusPath.unshift([...n.parentElement.children].indexOf(n));
  const update=()=>{
   renderContent();
   if(focusCard&&document.activeElement!==focused){let target=cards.get(focusCard.dataset.matchId)?.card;for(const index of focusPath)target=target?.children[index];if(target?.tagName===focused.tagName&&target.className===focused.className)target.focus?.({preventScroll:true});}
  };
  // Keep viewport identity separate from Feed's DOM reconciliation: this
  // surface already owns its card nodes and handlers.
  const viewportTop=stickyFeedChromeHeight()+12,visibleCards=chrome?.heading.isConnected&&window.scrollY>0?[...document.querySelectorAll('.match-centre-card[data-viewport-anchor-key]')].filter(card=>card.getBoundingClientRect().bottom>viewportTop):[];
  const anchor=visibleCards.find(card=>card.getBoundingClientRect().top>=viewportTop)||visibleCards[0];
  if(anchor)mutateWithScrollContinuity(anchor,update,{local:true,anchorStrategy:'target',interactionName:'match-centre-update'});else update();
 }
 function renderContent(){
  if(activeTab!=='match-centre')return;for(const [id,view] of cards)if(view.card.isConnected){if(view.details.open)expanded.add(id);else expanded.delete(id);}const panel=document.getElementById('listView'),all=candidates();
  const key=JSON.stringify([selectedView,owner(),userPreferences.showSpoilers,[...new Set(all.map(e=>m().sport(e)))].sort()]);
  if(!chrome?.heading.isConnected||chromeKey!==key){chromeKey=key;cards.clear();panel.className='match-centre';const heading=node('div',null,'match-centre-heading'),refresh=node('button','Refresh','btn ghost'),tabs=node('div',null,'mc-membership-tabs'),noticeNode=node('p',null,'mc-refresh-notice'),empty=node('p'),more=node('button','Load more live fixtures','btn ghost');heading.append(node('h2','Match Centre'),refresh);refresh.type='button';refresh.setAttribute('aria-label','Refresh Match Centre');refresh.onclick=()=>void manualRefresh();tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Match Centre fixtures');
   for(const [view,label] of [['followed','Followed'],['everything','Everything']]){const tab=node('button',label,'btn ghost');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(selectedView===view));tab.onclick=()=>{if(selectedView===view)return;generation++;selectedView=view;manual=null;notice='';const cached=viewCache.get(view);membership=cached?.events||[];membershipKey=cached?.key||'';membershipCheckedAt=cached?.checked||0;membershipMaxAge=cached?.maxAge||120000;nextCursor=cached?.nextCursor??null;membershipOwner=owner();renderMatchCentre();};tabs.append(tab);}
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
    if(!Array.isArray(data.fixtures))throw Error('Invalid score list');
    const received=new Set();for(const s of data.fixtures){
     if(!ids.includes(s.id))continue;received.add(s.id);
     scores.set(s.id,m().observation(scores.get(s.id),s));
    }
    markAwaiting(ids.filter(id=>!received.has(id)));
   }
   saveMembership(t);render();return true;
  }catch{if(valid(t)){markAwaiting(ids);render();}return false;}finally{inflight=null;}})();return inflight;
 }
 async function manualRefresh(){
  if(manual||document.hidden||activeTab!=='match-centre')return manual;
  if(Date.now()-lastManual<10000){notice='Please wait a moment before refreshing again.';render();return;}
  lastManual=Date.now();const t=ticket();notice='Refreshing…';
  const operation=(async()=>{try{await hydrate(true);if(!valid(t))return;render();if(!await poll(null,false,true))throw Error();if(valid(t))notice=membershipMaxAge===30000?'Match list needs rechecking. Showing last available fixtures. Rechecking shortly.':'Latest available scores loaded.';}catch{if(valid(t)){markAwaiting(membership.map(m().id));notice='Couldn’t refresh. Showing last available scores.';}}finally{if(manual===operation)manual=null;if(valid(t)){refreshControl?.setBusy(false);render();}}})();
  manual=operation;refreshControl?.setBusy(true);render();return manual;
 }
 globalThis.stopMatchCentre=()=>{generation++;clearInterval(timer);refreshControl?.cancel();manual=null;notice='';document.getElementById('listView')?.removeAttribute('aria-busy');};
 globalThis.renderMatchCentre=()=>{
  if(membershipOwner&&membershipOwner!==owner()){globalThis.stopMatchCentre();membership=[];membershipKey='';membershipOwner=owner();membershipMaxAge=120000;lastManual=-Infinity;scores.clear();requested.clear();cards.clear();expanded.clear();viewCache.clear();nextCursor=null;}
  refreshControl||=globalThis.createMatchCentreRefresh({panel:document.getElementById('listView'),enabled:()=>activeTab==='match-centre'&&!document.hidden,refresh:manualRefresh});
  if(!membership.length){membership=selectedView==='followed'?[...activeEvents].filter(e=>Boolean(eventFollowReason(e))):[];membershipOwner=owner();}
  const t=ticket();render();void restoreMembership().then(()=>hydrate()).then(()=>{if(!valid(t))return;render();if(!manual)void poll();}).catch(()=>{if(!valid(t))return;markAwaiting(membership.map(m().id));if(!manual)notice='Some fixtures could not load. Showing last available scores. Refresh to retry.';render();});
  clearInterval(timer);timer=setInterval(()=>{if(activeTab!=='match-centre'){globalThis.stopMatchCentre();return;}if(document.hidden||manual||refreshControl.pulling)return;void hydrate().then(()=>{render();void poll();}).catch(()=>{});},15000);if(!manual)void poll();
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
})();
