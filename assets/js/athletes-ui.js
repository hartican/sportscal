/* Deferred Athletes destination. Eligibility and identities stay owned by Follow. */
(() => {
 'use strict';
 const model=NOTHINGSPORTS_ATHLETES,node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const owner=()=>serverSyncClient?.sessionSubject()||'public';
 let nextCursor=null;
 let account=owner(),key='',checked=0,events=[],records=[],generation=0,timer=null,loading=null,loadingKey='',loadingGeneration=0,queuedHydration=null,queuedOptions=null,lastManual=0,journeys=null,journeyLoading=null,journeysPending=false,origin=null,profileId='',notice='',matchReturn=null;
 const ticket=()=>({generation,owner:owner(),profileId,preferences:JSON.stringify([userPreferences,eventActions])});
 const valid=t=>t.profileId===profileId&&t.generation===generation&&t.owner===owner()&&t.preferences===JSON.stringify([userPreferences,eventActions])&&(activeTab==='follow'&&followHomeView==='favourites');
 const recordKey=p=>model.identity(p.id);
 const preferencesKey=()=>JSON.stringify([owner(),userPreferences,eventActions,profileId]);
 const allRecords=()=>[...records,...cardIdentityParticipants(),...(journeys?.players||[]).map(p=>({...p,sportKey:'tennis'})),...[...followDirectoryChunks.values()].flatMap(c=>[...(c.participants||[]),...(c.players||[]),...(c.records||[])])];
 function followed(){const prepared=FOLLOW_FIRST.migratePreferences(userPreferences),collections=followCollectionsById();return [...new Map(allRecords().filter(p=>model.individual(p)||String(p.id).startsWith('team:')).filter(p=>{const f=FOLLOW_FIRST.effectiveParticipantFollow(p.id,userPreferences,collections,prepared);return f.followed&&(!String(p.id).startsWith('team:')||f.source==='explicit');}).map(p=>[recordKey(p),{...p,sportKey:model.sport(p),displayName:p.displayName||p.canonicalName||p.name||'Athlete'}])).values()];}
 function availableEvents(){return events.filter(e=>!globalThis.NOTHINGSPORTS_TENNIS_FEED?.isParent(e)&&!FOLLOW_FEED_POLICY.explicitlyExcluded(e,userPreferences)&&!getEventAction(e).dismissed&&!getEventAction(e).archived);}
 function resolve(id,label,sportKey){return allRecords().find(p=>model.identity(p.id)===model.identity(id))||{id,displayName:label||'Athlete',sportKey:sportKey||model.sport({id})};}
 async function loadJourneys(){
  if(journeys)return journeys;
  journeyLoading ||= Promise.all([loadDeferredScript('config/tennis-journeys.js?v=368'),fetch('data/tennis-journeys.v1.json',{cache:'default'}).then(r=>{if(!r.ok)throw Error();return r.json();})]).then(([,d])=>{journeys=d;return d;}).finally(()=>{journeyLoading=null;});
  return journeyLoading;
 }
 async function hydrate(force=false,append=false){
  const requestKey=preferencesKey()+'|'+(append?(nextCursor||0):0);
  if(loading){
   if(!queuedHydration&&loadingKey===requestKey&&loadingGeneration===generation)return loading;
   queuedOptions={force,append};
   queuedHydration ||= loading.then(()=>{const options=queuedOptions;queuedHydration=null;queuedOptions=null;return activeTab==='follow'&&followHomeView==='favourites'?hydrate(options.force,options.append):false;});
   return queuedHydration;
  }
  if(!append&&!force&&key===preferencesKey()&&Date.now()-checked<300000)return false;
  const t=ticket(),queryKey=preferencesKey();
  loadingKey=requestKey;loadingGeneration=generation;
  loading=(async()=>{
   await ensureFollowCollectionDirectories();if(!valid(t))return false;
   let cursor=append?(nextCursor||0):0,next=append?[...events]:[],people=append?[...records]:[],pages=0;
   do{
    const data=serverPersistence.user?await serverSyncClient.loadFeed({cursor,limit:50,scope:'athletes',participantId:profileId||null}):await fetch(`/api/feed?scope=athletes&limit=50&cursor=${cursor}${profileId?"&participantId="+encodeURIComponent(profileId):""}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:userPreferences,eventUserState:eventActions}),signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error('Athletes feed unavailable');return r.json();});
    if(!valid(t))return false;next.push(...(data.events||[]));people.push(...(data.athletes||[]));const prior=cursor;cursor=data.pagination?.nextCursor??null;pages++;if(cursor!==null&&(cursor<=prior||pages>=40))throw Error('Athletes pagination is incomplete');
   }while(false);
   nextCursor=cursor;
   if(!valid(t))return false;events=[...new Map((profileId?[...events,...next]:next).map(e=>[e.canonicalEventId||e.eventId||e.id,e])).values()];records=people.length?people:records;key=queryKey;checked=Date.now();notice='';return true;
  })().catch(()=>{if(valid(t))notice='Showing available information. Refresh to check for updates.';return false;}).finally(()=>{loading=null;if(valid(t))render();});
  return loading;
 }
 function snapshotOrigin(trigger){
  const card=trigger?.closest('[data-event-id]');
  return {account:owner(),tab:activeTab,view:activeView,filter:activeFilter,inspector:activeInspectorCodeId,browse:{...followBrowseState()},feedFilters:{...feedViewFilters},cardStates:{...cardViewStates},y:scrollY,eventId:card?.dataset.eventId,top:card?.getBoundingClientRect().top,label:trigger?.getAttribute('aria-label'),triggerKey:trigger?.dataset.profileTrigger,major:activeMajorEventNowId,eventsTab:eventsViewTab,parentOpen:[...tennisFeedOpenParents],directorySession:JSON.parse(JSON.stringify(readStandingsDirectorySession())),profileId,followHomeView};
 }
 function restore(state){
  if(!state||state.account!==owner()){activateTopLevelTab('feed');return;}
  profileId=state.profileId||'';followHomeView=state.followHomeView||'favourites';activeTab=state.tab;activeView=state.view;activeFilter=state.filter;activeInspectorCodeId=state.inspector;activeMajorEventNowId=state.major;eventsViewTab=state.eventsTab||eventsViewTab;feedViewFilters=state.feedFilters;cardViewStates=state.cardStates;tennisFeedOpenParents.clear();(state.parentOpen||[]).forEach(id=>tennisFeedOpenParents.add(id));saveFollowBrowse(state.browse);if(state.directorySession)writeStandingsDirectorySession(state.directorySession);syncTopLevelNavigationState();renderAll();
  let cancelled=false;const stop=()=>{cancelled=true;observer.disconnect();};const host=document.getElementById('listView');
  const focus=()=>{if(cancelled||activeTab!==state.tab)return;const item=[...feedCardSlots.values()].find(i=>String(i.event.eventId||i.event.id)===state.eventId);if(item&&!item.mounted&&!getEventAction(item.event).dismissed){item.slot.replaceChildren(buildEventCard(item.event));item.mounted=true;}
   const card=[...host.querySelectorAll('[data-event-id]')].find(c=>c.dataset.eventId===state.eventId),target=[...(card?card.querySelectorAll('[aria-label]'):host.querySelectorAll('[aria-label]'))].find(n=>n.getAttribute('aria-label')===state.label);const directoryTarget=state.triggerKey?[...host.querySelectorAll('[data-profile-trigger]')].find(n=>n.dataset.profileTrigger===state.triggerKey):null;(directoryTarget||target||card)?.focus({preventScroll:true});scrollTo({top:card&&Number.isFinite(state.top)?scrollY+card.getBoundingClientRect().top-state.top:state.y,behavior:'instant'});};
  const observer=new MutationObserver(()=>requestAnimationFrame(focus));observer.observe(host,{childList:true,subtree:true});requestAnimationFrame(focus);
  for(const event of ['pointerdown','touchstart','wheel','keydown','pagehide'])window.addEventListener(event,stop,{once:true,passive:true});setTimeout(stop,10000);
 }
 function open(id,label,sportKey,trigger){
  if(!(model.individual(id)||id.startsWith('team:'))||/^(winner|loser|tbc|tbd|placeholder|slot):/.test(id))return;
  const saved=snapshotOrigin(trigger);generation++;origin=saved;profileId=id;notice='';records.push(resolve(id,label,sportKey));
  history.pushState({athleteProfile:id,athleteOrigin:saved},'',`#follow/profile/${encodeURIComponent(id)}`);
  activeInspectorCodeId=null;activeTab='follow';followHomeView='favourites';syncTopLevelNavigationState();renderAll();scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>document.querySelector('.athletes-profile-back')?.focus({preventScroll:true}));
 }
 function openMatch(event,trigger){
  if(FOLLOW_FEED_POLICY.explicitlyExcluded(event,userPreferences)||getEventAction(event).dismissed||getEventAction(event).archived){showToast('This fixture is unavailable in your Feed.');return;}
  const state=snapshotOrigin(trigger);state.profileId=profileId;state.tab='follow';
  matchReturn=state;history.pushState({athleteMatchReturn:state},'',location.pathname+location.search);
  openMatchCentreFeedFixture(event,{temporary:true});
 }
 function timing(event){
  const state=model.timingState(event);if(state==='publication-pending')return 'Organiser publication pending';if(state==='unresolved')return 'Match time unresolved';if(state==='unverified')return 'Match time not verified';if(state==='stale'&&!Number.isFinite(Date.parse(event.startTimeUtc)))return 'Timing needs rechecking';
  return (state==='stale'?'Update needed · last published time: ':'')+(String(event.timePrecision).replace('_','-')==='not-before'?'Not before ':'')+new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(event.startTimeUtc));
 }
 function official(record){
  const context=model.currentContext(journeys,record.id,formatDateKey(nowAEST()),userPreferences);if(context?.review)return {url:context.review.scheduleUrl,label:'Official '+context.edition.name+' schedule'};
  const player=journeys?.players.find(p=>model.identity(p.id)===recordKey(record));
  if(player?.tour==='WTA'||record.tour==='WTA'||record.id?.startsWith('competitor:tennis:wta:')||record.sportKey==='tennis-women')return {url:'https://www.wtatennis.com/scores',label:'Official tennis schedule'};
  if(record.sportKey==='tennis')return {url:'https://www.atptour.com/en/scores/current',label:'Official tennis schedules'};
  const url=record.sourceUrl||record.metadata?.sourceUrl||record.sourceRefs?.[0];return url?{url,label:'Official information'}:null;
 }
 function schedule(host,record){
  const event=model.next(availableEvents(),record.id);
  if(!event){const context=model.currentContext(journeys,record.id,formatDateKey(nowAEST()),userPreferences);if(context){host.append(node('p',context.edition.name+' · '+({'official_entry':'Entry verified','official_participation':'Participation verified','official_qualification':'Qualification verified'}[context.participation.evidenceKind]||'Participation verified')),node('small',context.window.startDate+' – '+context.window.endDate+' · tournament dates'));}const review=journeys?.players.find(p=>recordKey(p)===recordKey(record))?.scheduleReview;if(review?.summary&&review.validUntil>=formatDateKey(nowAEST())){host.append(node('p',review.summary));const link=node('a',(review.sourceLabel||'Official draw')+' · checked '+new Date(review.checkedAt).toLocaleString('en-AU'),'athletes-official');link.href=review.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';host.append(link);}
  const hidden=model.next(events.filter(e=>!globalThis.NOTHINGSPORTS_TENNIS_FEED?.isParent(e)),record.id);host.append(node('p',hidden?'No upcoming fixture to show. Removed fixtures stay hidden.':loading||!checked?notice?'Schedule is temporarily unavailable. Refresh to try again.':'Checking published fixtures…':context?.review?'NS has not verified this player’s next match details.':'NS has not verified the next '+(record.sportKey==='tennis'?'match':'fixture')+'.','athletes-coverage-gap'));}
  else{
   const title=node('p',spoilerSafeDisplayTitle(event)||event.name,'athletes-next-match');host.append(title,node('p',[event.eventName||event.tournamentName||event.competitionName,event.roundLabel||event.round,event.venue,event.court,timing(event)].filter(Boolean).join(' · ')));
   if(event.sourceCheckedAt)host.append(node('small','Checked '+new Date(event.sourceCheckedAt).toLocaleString('en-AU',{timeZone:'Australia/Sydney'})));
   if(event.sourceUrl){const link=node('a','Official match source','athletes-official');link.href=event.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';host.append(link);}
   const actions=node('div',null,'athletes-actions');
   {const button=node('button','Open match','btn');button.type='button';button.setAttribute('aria-label','Open match');button.onclick=()=>openMatch(event,button);actions.append(button,buildParticipantFeedButton(event));appendEventQuickActions(actions,event,{chat:false,viewing:false});}
   if(model.timingState(event)!=='published')actions.append(node('span','Reminder timing needs verification'));
   host.append(actions);const readiness=node('small','Device notification readiness has not been checked.');host.append(readiness);const settings=userPreferences.followFirst?.notifications||{};if(settings.enabled===false||settings.sportingRemindersEnabled===false)readiness.textContent='Sporting notifications are off in Settings.';else if(typeof Notification==='undefined'||Notification.permission!=='granted')readiness.textContent='Device notifications are not enabled. Use Notifications in Settings.';else{void navigator.serviceWorker?.getRegistration().then(r=>r?.pushManager?.getSubscription()).then(subscription=>{if(readiness.isConnected)readiness.textContent=subscription?'Device permission and push subscription are present. Delivery still requires an enabled installation.':'Device notifications need setup in Settings.';}).catch(()=>{});}
  }
  const source=official(record);if(source){const a=node('a',source.label,'athletes-official');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';host.append(a);}
 }
 function buildParticipantFeedButton(event){
  const action=getEventAction(event),visible=Boolean(eventFollowReason(event))&&!action.dismissed&&!action.archived;
  const button=node('button',visible?'In Feed':'Add to Feed','btn ghost');button.type='button';button.disabled=visible||FOLLOW_FEED_POLICY.explicitlyExcluded(event,userPreferences);
  button.onclick=()=>{const latest=getEventAction(event);const next=updateEventAction(event,{addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),addedFixture:{...event,manualPin:true},dismissed:false,archived:false,pinState:'added',pinRevision:(Number(latest.pinRevision)||0)+1,pinMutationId:crypto.randomUUID()});queueFixturePinCommand(eventActionKey(event),next);activeEvents=mergeCanonicalEventPages(activeEvents,[event]);button.textContent='In Feed';button.disabled=true;};return button;
 }
 function appendProfileAlertSetup(host){
  const section=node('div',null,'athletes-alert-setup'),text=node('p'),button=node('button','Enable alerts','btn ghost');button.type='button';section.append(text,button);host.append(section);
  const prefs=userPreferences.followFirst?.notifications||{};
  if(prefs.enabled===false||prefs.sportingRemindersEnabled===false||prefs.autoRemindersEnabled===false){text.textContent='Start alerts are off in Settings.';button.textContent='Manage alerts';button.onclick=()=>openSettings({section:'notifications'});return;}
  text.textContent='Eligible start alerts are on · 15 minutes before the published start. Device setup may be needed.';
  button.onclick=async()=>{button.disabled=true;try{await ensurePushInstallation({requestPermission:true});text.textContent='Device alerts enabled. Eligible matches will notify even when absent from Feed.';button.hidden=true;}catch(error){text.textContent=error.message;button.disabled=false;}};
  if(typeof Notification!=='undefined'&&Notification.permission==='granted')void navigator.serviceWorker?.getRegistration().then(r=>r?.pushManager?.getSubscription()).then(subscription=>{if(section.isConnected&&subscription){text.textContent='Device permission and subscription are present. Check Notifications for delivery readiness.';button.textContent='Manage alerts';button.onclick=()=>openSettings({section:'notifications'});}}).catch(()=>{});
 }
 function calendar(host,record,t){
  if(record.sportKey!=='tennis'||!journeys||!NOTHINGSPORTS_TENNIS_JOURNEYS)return;
  const editions=NOTHINGSPORTS_TENNIS_JOURNEYS.editions(journeys,formatDateKey(nowAEST()),userPreferences,followCollectionsById()).map(e=>({...e,participation:e.participation.filter(p=>model.identity(p.playerId)===recordKey(record))})).filter(e=>e.participation.length);
  if(!editions.length)return;const details=node('details'),summary=node('summary','Player journey · next twelve months');details.append(summary);host.append(details);
  for(const edition of editions){const row=node('details'),title=node('summary',edition.name+' '+edition.season);row.append(title);for(const w of edition.tourWindows)row.append(node('p',`${w.tour} · ${w.startDate} – ${w.endDate} · tournament dates`));for(const p of edition.participation){row.append(node('p',String(p.status||p.certainty||'Conditional').replace(/_/g,' ')));for(const id of p.sourceIds||[]){const source=journeys.sources.find(s=>s.id===id);if(source){const a=node('a','Evidence · checked '+source.verifiedAt);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}}}details.append(row);}
 }
 function profile(panel,record,t){
  const back=node('button','Back','btn ghost athletes-profile-back');back.type='button';back.setAttribute('aria-label','Back');back.onclick=()=>{if(history.state?.athleteProfile)history.back();else{profileId='';history.replaceState({athletes:true},'','#follow');render();}};panel.append(back);
  const body=node('section',null,'athletes-profile'),fixtures=node('section',null,'athletes-profile-fixtures');panel.append(fixtures,body);fixtures.append(node('h2','Next appearance'));schedule(fixtures,record);appendProfileAlertSetup(fixtures);calendar(fixtures,record,t);
  void (async()=>{const chunk=await loadFollowDirectoryChunk(record.sportKey).catch(()=>null);if(!valid(t))return;const directory=[...(chunk?.participants||[]),...(chunk?.players||[]),...(chunk?.records||[])].find(p=>model.identity(p.id)===recordKey(record));const resolved={...record,...directory,displayName:directory?.displayName||directory?.name||record.displayName};const ui=await ensureAthleteProfileUi();if(valid(t))await ui.renderInto(body,resolved,record.sportKey,{basicOnly:true,valid:()=>valid(t)&&body.isConnected});})().catch(()=>{if(valid(t))body.replaceChildren(node('h2',record.displayName),node('p','Detailed profile information is unavailable.'));});
 }
 function render(){
  if((activeTab!=='follow'||followHomeView!=='favourites'))return;
  if(account!==owner()){generation++;records=[];events=[];key='';checked=0;profileId='';origin=null;account=owner();}
  const panel=document.getElementById('listView'),focusLabel=panel.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;panel.className='athletes-hub';panel.replaceChildren();const t=ticket();if(focusLabel)requestAnimationFrame(()=>{[...panel.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focusLabel)?.focus({preventScroll:true});});
  const heading=node('div',null,'athletes-heading');heading.append(node('h2','My athletes & teams'));const refresh=node('button','Refresh','btn ghost');refresh.type='button';refresh.onclick=async()=>{if(Date.now()-lastManual<10000)return;lastManual=Date.now();refresh.disabled=true;await hydrate(true);};heading.append(refresh);panel.append(heading);buildFollowHomeTabs(panel);
  if(notice)panel.append(node('p',notice));else if(loading||!checked){const status=node('p','Checking published fixtures…');status.setAttribute('role','status');panel.append(status);}
  const route=location.hash.match(/^#(?:follow\/profile|athletes)\/(.+)$/);if(route){try{profileId=decodeURIComponent(route[1]);}catch{profileId='';}}
  if(profileId){profile(panel,resolve(profileId),ticket());return;}
  const people=followed();people.sort((a,b)=>{const next=p=>model.next(availableEvents(),p.id),rank=p=>{const e=next(p);return e&&/^(live|in-progress)$/.test(e.status)?0:e&&Number.isFinite(Date.parse(e.startTimeUtc))?1:2;};return rank(a)-rank(b)||(Date.parse(next(a)?.startTimeUtc)||Infinity)-(Date.parse(next(b)?.startTimeUtc)||Infinity)||a.displayName.localeCompare(b.displayName);});
  if(!people.length&&checked&&!loading){const saved=(userPreferences.preferenceGraph?.entityFollows||[]).some(f=>['follow','priority'].includes(f.followLevel))||(userPreferences.followFirst?.collectionFollows||[]).length;panel.append(node('p',saved?journeysPending?'Loading followed identities…':'Followed identities are temporarily unavailable. Refresh to try again.':'Follow athletes to see their published fixtures here.'));}
  for(const record of people){const card=node('article',null,'athletes-person');card.dataset.athleteId=record.id;const name=node('button',record.displayName,'athletes-name');name.type='button';name.setAttribute('aria-label',`Open ${record.displayName} profile in Follow`);name.onclick=()=>open(record.id,record.displayName,record.sportKey,name);card.append(name,node('small',(record.id.startsWith('team:')?'Team':model.role(record.sportKey))+' · '+record.sportKey.replace(/-/g,' ')));schedule(card,record);panel.append(card);}
  if(nextCursor!==null){const more=node('button','Load more favourites','btn ghost');more.onclick=async()=>{more.disabled=true;await hydrate(false,true);};panel.append(more);}
  const remaining=(journeys?.players||[]).filter(p=>!people.some(r=>recordKey(r)===recordKey(p)));if(remaining.length){const section=node('section',null,'athletes-featured');section.append(node('h3','Featured tennis players'));for(const p of remaining){const row=node('div',null,'athletes-featured-row'),name=node('button',p.displayName||p.name,'athletes-name');name.type='button';name.onclick=()=>open(p.id,p.displayName||p.name,'tennis',name);row.append(name,buildDirectoryFollowButton(p.id,{sportKey:'tennis',label:p.displayName||p.name}));section.append(row);}panel.append(section);}
 }
 function start(){
  if((activeTab!=='follow'||followHomeView!=='favourites'))return;if(!checked&&account===owner())events=activeEvents.filter(e=>eventFollowReason(e));render();
  if(!journeys&&!journeysPending){journeysPending=true;void loadJourneys().then(()=>{if((activeTab==='follow'&&followHomeView==='favourites'))render();}).catch(()=>{}).finally(()=>{journeysPending=false;});}
  if(key!==preferencesKey()||Date.now()-checked>=300000)void hydrate();

 }
 function stop(){generation++;clearInterval(timer);timer=null;}
 function navigate(tab){if(tab==='follow'){profileId='';origin=null;}else{profileId='';origin=null;matchReturn=null;}}
 function route(){
  if(location.hash==='#follow'||location.hash==='#athletes'||(location.hash.startsWith('#follow/profile/')||location.hash.startsWith('#athletes/'))){const matchOrigin=matchReturn;matchReturn=null;activeTab='follow';followHomeView='favourites';activeInspectorCodeId=null;try{profileId=history.state?.athleteProfile||decodeURIComponent(location.hash.match(/^#(?:follow\/profile|athletes)\/(.+)$/)?.[1]||'');}catch{profileId='';}if(!(model.individual(profileId)||profileId.startsWith('team:')))profileId='';if(history.state?.athleteOrigin)origin=history.state.athleteOrigin;syncTopLevelNavigationState();if(matchOrigin)restore(matchOrigin);else if(!profileId&&origin?.tab==='follow'){const saved=origin;origin=null;restore(saved);}else renderAll();return true;}
  if((activeTab==='follow'&&followHomeView==='favourites')&&origin){const saved=origin;origin=null;profileId='';stop();restore(saved);return true;}return false;
 }
 async function refresh(){if(document.hidden||(activeTab!=='follow'||followHomeView!=='favourites'))return;return hydrate();}
 const style=node('style');style.textContent='.athletes-heading,.athletes-actions,.athletes-featured-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.athletes-profile,.athletes-profile-fixtures,.athletes-featured{padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card)}.athletes-person p,.athletes-profile-fixtures p{font-size:.8rem;line-height:1.5}.athletes-person small,.athletes-profile-fixtures small{color:var(--text-dim)}.athletes-profile-fixtures small{display:block;line-height:1.5;margin-top:6px}.athletes-official{display:block;padding:10px 0;color:var(--accent);font-size:.8rem}.athletes-profile-fixtures details{padding:10px 0}.athletes-coverage-gap{color:var(--text-dim)}';document.head.append(style);
 globalThis.NOTHINGSPORTS_ATHLETES_UI={start,stop,open,route,render,openMatch,navigate,refresh,buildParticipantFeedButton};
})();
