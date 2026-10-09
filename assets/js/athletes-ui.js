/* Deferred Athletes destination. Eligibility and identities stay owned by Follow. */
(() => {
 'use strict';
 const model=NOTHINGSPORTS_ATHLETES,node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const owner=()=>serverSyncClient?.sessionSubject()||'public';
 let nextCursor=null;
 let account=owner(),key='',checked=0,events=[],records=[],generation=0,timer=null,loading=null,loadingKey='',loadingGeneration=0,queuedHydration=null,queuedOptions=null,lastManual=0,journeys=null,journeyLoading=null,journeysPending=false,origin=null,profileId='',notice='',matchReturn=null;
 const ticket=()=>({generation,owner:owner(),profileId,preferences:JSON.stringify([userPreferences,eventActions])});
 const valid=t=>t.profileId===profileId&&t.generation===generation&&t.owner===owner()&&t.preferences===JSON.stringify([userPreferences,eventActions])&&(activeTab==='follow'&&followHomeView==='favourites');
 let pendingFocus=null,selection=null,profileTab='fixtures';
 function deadline(promise,ms=10000){let timeout;return Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Schedule read timed out')),ms);})]).finally(()=>clearTimeout(timeout));}
 function selectFixtures(){const eligible=availableEvents(),all=events.filter(e=>!globalThis.NOTHINGSPORTS_TENNIS_FEED?.isParent(e));return {next:model.indexNext(eligible),hidden:all.length===eligible.length?null:model.indexNext(all),reasons:new Map(),followContext:null};}
 const focusContext=element=>{const key=element?.dataset?.athletesFocusKey||element?.getAttribute('aria-label');return key?{key,participantId:element.closest('.athletes-person')?.dataset.athleteId||null}:null;};
 function rememberFocus(button){if(document.activeElement===button)pendingFocus={context:focusContext(button),ticket:ticket()};}
 function restoreFocus(panel,context,t){if(!context)return;requestAnimationFrame(()=>{if(!valid(t)||!panel.isConnected||document.activeElement!==document.body)return;const target=[...panel.querySelectorAll('[aria-label],[data-athletes-focus-key]')].find(element=>{const current=focusContext(element);return current?.key===context.key&&current.participantId===context.participantId;})||(context.key==='load-more'?panel.querySelector('.athletes-heading button'):null);target?.focus();});}
 const recordKey=p=>model.identity(p.id);
 const preferencesKey=()=>JSON.stringify([owner(),userPreferences,eventActions,profileId]);
 const allRecords=()=>[...records,...(canonicalPreferenceParticipants||[]),...(userPreferences.preferenceGraph?.entityFollows||[]).map(p=>globalThis.NOTHINGSPORTS_PARTICIPANT_SEARCH?.getRecord(p.participantId)).filter(Boolean),...(footballFollowIndex?.identities||[]),...cardIdentityParticipants(),...(journeys?.players||[]).map(p=>({...p,sportKey:'tennis'})),...[...followDirectoryChunks.values()].flatMap(c=>[...(c.participants||[]),...(c.players||[]),...(c.records||[])])];
 function followed(){const prepared=FOLLOW_FIRST.migratePreferences(userPreferences),collections=followCollectionsById();return [...new Map(allRecords().filter(p=>model.individual(p)||String(p.id).startsWith('team:')).filter(p=>{const f=FOLLOW_FIRST.effectiveParticipantFollow(p.id,userPreferences,collections,prepared);return f.followed&&(!String(p.id).startsWith('team:')||f.source==='explicit');}).map(p=>[recordKey(p),{...p,sportKey:model.sport(p),displayName:p.displayName||p.canonicalName||p.name||'Athlete'}])).values()];}
 function availableEvents(){return events.filter(e=>!globalThis.NOTHINGSPORTS_TENNIS_FEED?.isParent(e)&&!FOLLOW_FEED_POLICY.explicitlyExcluded(e,userPreferences)&&!getEventAction(e).dismissed&&!getEventAction(e).archived);}
 function resolve(id,label,sportKey){const record=globalThis.NOTHINGSPORTS_PARTICIPANT_SEARCH?.getRecord(id)||allRecords().find(p=>model.identity(p.id)===model.identity(id))||{id,displayName:label||'Athlete'};return {...record,sportKey:model.sport({...record,sportKey:record.sportKey||sportKey})};}
 async function loadJourneys(){
  if(journeys)return journeys;
  journeyLoading ||= Promise.all([loadDeferredScript('config/tennis-journeys.js?v=463'),fetch('data/tennis-journeys.v1.json',{cache:'default'}).then(r=>{if(!r.ok)throw Error();return r.json();})]).then(([,d])=>{journeys=d;return d;}).finally(()=>{journeyLoading=null;});
  return journeyLoading;
 }
 async function hydrate(force=false,append=false){
  const requestKey=preferencesKey()+'|'+(append?(nextCursor||0):0);
  if(loading){
   if(!queuedHydration&&loadingKey===requestKey&&loadingGeneration===generation)return loading;
   queuedOptions={force,append};
   queuedHydration ||= loading.then(()=>{const options=queuedOptions;queuedHydration=null;queuedOptions=null;return options&&activeTab==='follow'&&followHomeView==='favourites'?hydrate(options.force,options.append):false;});
   return queuedHydration;
  }
  if(!append&&!force&&key===preferencesKey()&&Date.now()-checked<300000)return false;
  const t=ticket(),queryKey=preferencesKey();
  loadingKey=requestKey;loadingGeneration=generation;
  loading=(async()=>{
   await Promise.resolve();if(!valid(t))return false;render();
   // Identity enrichment is optional: it never owns the schedule loading state.
   const sources=[footballFollowIndex,canonicalPreferenceParticipants,...followDirectoryChunks.values()];
   const identityKeys=new Set((userPreferences.preferenceGraph?.entityFollows||[]).filter(p=>['follow','priority'].includes(p.followLevel)).map(p=>{const key=model.sport({id:p.participantId});return key==='tennis'&&/:wta:/.test(p.participantId)?'tennis-women':key;}));
   const identityLoads=[ensureFollowCollectionDirectories(),...[...identityKeys].filter(key=>!['football','nrl','afl','aflw'].includes(key)).map(key=>loadFollowDirectoryChunk(({nfl:'american-football',nhl:'ice-hockey','rugby-union':'rugby',nba:'basketball'})[key]||key))];
   void deadline(Promise.allSettled(identityLoads)).then(()=>{const current=[footballFollowIndex,canonicalPreferenceParticipants,...followDirectoryChunks.values()];if(valid(t)&&(current.length!==sources.length||current.some((source,i)=>source!==sources[i])))render();}).catch(()=>{});
   let cursor=append?(nextCursor||0):0,next=append?[...events]:[],people=append?[...records]:[],pages=0;
   do{
    const data=serverPersistence.user?await deadline(serverSyncClient.loadFeed({cursor,limit:50,scope:'athletes',participantId:profileId||null})):await fetch(`/api/feed?scope=athletes&limit=50&cursor=${cursor}${profileId?"&participantId="+encodeURIComponent(profileId):""}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:userPreferences,eventUserState:eventActions}),signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error('Athletes feed unavailable');return r.json();});
    if(!valid(t))return false;next.push(...(data.events||[]));people.push(...(data.athletes||[]));const prior=cursor;cursor=data.pagination?.nextCursor??null;pages++;if(cursor!==null&&(cursor<=prior||pages>=40))throw Error('Athletes pagination is incomplete');
   }while(false);
   nextCursor=cursor;
   if(!valid(t))return false;events=[...new Map(next.map(e=>[e.canonicalEventId||e.eventId||e.id,e])).values()];records=people.length?people:records;key=queryKey;checked=Date.now();notice='';return true;
  })().catch(()=>{if(valid(t))notice='Showing available information. Refresh to check for updates.';return false;}).finally(()=>{loading=null;if(activeTab==='follow'&&followHomeView==='favourites')render();});
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
  const saved=snapshotOrigin(trigger);generation++;origin=saved;profileId=id;profileTab='fixtures';notice='';events=activeEvents;key='';checked=0;nextCursor=null;records.push(resolve(id,label,sportKey));
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
  const calendar=model.calendarTiming(event);if(calendar)return calendar;
  if(String(event.timePrecision).replace('_','-')==='followed-by'&&!Number.isFinite(Date.parse(event.startTimeUtc)))return 'Match time unresolved · follows an earlier match';
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
 function schedule(host,record,{compact=false}={}){
  const event=selection.next.get(recordKey(record));
  if(compact){
   if(event){host.append(node('p',spoilerSafeDisplayTitle(event)||event.name,'athletes-next-match'),node('p',[event.eventName||event.tournamentName||event.competitionName,event.roundLabel||event.round].filter(Boolean).join(' · ')),node('p',(/^(live|in-progress)$/.test(event.status||'')?(Date.parse(event.statusCheckedAt||event.livePlayObservedAt||'')<=Date.now()&&Date.now()-Date.parse(event.statusCheckedAt||event.livePlayObservedAt||'')<=1800000?'Live · ':'Last reported live · '):'')+timing(event)));
    if(event.cardType==='golf_appearance'){const partners=(event.participants||[]).filter(p=>model.identity(p.id)!==recordKey(record)).map(p=>p.displayName||p.name);host.append(node('p',['Tee '+event.tee,partners.length?'Paired with '+partners.join(' and '):null].filter(Boolean).join(' · '),'athletes-tee-partners'));}
    const actions=node('div',null,'athletes-actions'),button=node('button','Open match','btn');button.type='button';button.setAttribute('aria-label','Open match');button.onclick=()=>openMatch(event,button);actions.append(button,buildParticipantFeedButton(event));appendEventQuickActions(actions,event,{chat:false,viewing:false,reminder:Boolean(getEventAction(event).reminderRequested)||reminderCanBeScheduled(eventReminderTiming(event))});host.append(actions);
   }else{const context=model.currentContext(journeys,record.id,formatDateKey(nowAEST()),userPreferences),review=journeys?.players.find(p=>recordKey(p)===recordKey(record))?.scheduleReview;if(context)host.append(node('p',context.edition.name+' · Participation verified'));if(review?.summary&&review.validUntil>=formatDateKey(nowAEST()))host.append(node('p',review.summary));host.append(node('p',selection.hidden?.get(recordKey(record))?'Fixture hidden':loading||!checked?notice?'Schedule unavailable':'Schedule pending':nextCursor!==null?'Schedule not loaded':'No published '+(record.sportKey.startsWith('tennis')?'match':'fixture'),'athletes-coverage-gap'));}
   return;
  }
  if(!event){const context=model.currentContext(journeys,record.id,formatDateKey(nowAEST()),userPreferences);if(context){host.append(node('p',context.edition.name+' · '+({'official_entry':'Entry verified','official_participation':'Participation verified','official_qualification':'Qualification verified'}[context.participation.evidenceKind]||'Participation verified')),node('small',context.window.startDate+' – '+context.window.endDate+' · tournament dates'));}const review=journeys?.players.find(p=>recordKey(p)===recordKey(record))?.scheduleReview;if(review?.summary&&review.validUntil>=formatDateKey(nowAEST())){host.append(node('p',review.summary));const link=node('a',(review.sourceLabel||'Official draw')+' · checked '+new Date(review.checkedAt).toLocaleString('en-AU'),'athletes-official');link.href=review.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';host.append(link);}
  const hidden=selection.hidden?.get(recordKey(record));host.append(node('p',hidden?'No upcoming fixture to show. Removed fixtures stay hidden.':loading||!checked?notice?'Schedule is temporarily unavailable. Refresh to try again.':'Checking published fixtures…':context?.review?'NS has not verified this player’s next match details.':'NS has not verified the next '+(record.sportKey==='tennis'?'match':'fixture')+'.','athletes-coverage-gap'));}
  else{
   const title=node('p',spoilerSafeDisplayTitle(event)||event.name,'athletes-next-match');host.append(title,node('p',[event.eventName||event.tournamentName||event.competitionName,event.roundLabel||event.round].filter(Boolean).join(' · ')),node('p',timing(event)));
   if(event.cardType==='golf_appearance'){const partners=(event.participants||[]).filter(p=>model.identity(p.id)!==recordKey(record)).map(p=>p.displayName||p.name);host.append(node('p',['Tee '+event.tee,partners.length?'Paired with '+partners.join(' and '):null].filter(Boolean).join(' · '),'athletes-tee-partners'));}
   appendMatchEvidence(host,event);
   const actions=node('div',null,'athletes-actions');
   {const button=node('button','Open match','btn');button.type='button';button.setAttribute('aria-label','Open match');button.onclick=()=>openMatch(event,button);actions.append(button,buildParticipantFeedButton(event));appendEventQuickActions(actions,event,{chat:false,viewing:false});}
   host.append(actions);
  }
 const source=event?.sourceUrl?null:official(record);if(source){const a=node('a',source.label,'athletes-official');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';host.append(a);}
 }
 function appendMatchEvidence(host,event){
  const calendar=Boolean(model.calendarTiming(event));
  if(event.venue||event.court||event.sourceCheckedAt){const details=node('details',null,'athletes-match-details');details.append(node('summary',calendar?'Tournament details':'Match details'));if(event.venue||event.court)details.append(node('p',[event.venue,event.court&&event.court!==event.venue?event.court:null].filter(Boolean).join(' · ')));if(event.scheduleNote)details.append(node('p',event.scheduleNote));if(event.sourceCheckedAt)details.append(node('small','Checked '+new Date(event.sourceCheckedAt).toLocaleString('en-AU',{timeZone:'Australia/Sydney'})));host.append(details);}
  if(event.sourceUrl){const link=node('a',event.sourceType==='official'?(calendar?'Official tournament source':'Official match source'):(event.sourceName||'Published')+(calendar?' tournament source':' match source'),'athletes-official');link.href=event.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';host.append(link);}
 }
 function buildParticipantFeedButton(event){
  const action=getEventAction(event),context=selection||{reasons:new Map()};context.followContext ||= buildFollowEligibilityContext();if(!context.reasons.has(event))context.reasons.set(event,eventFollowReason(event,context.followContext));const visible=Boolean(context.reasons.get(event))&&!action.dismissed&&!action.archived;
  const button=node('button',visible?'In Feed':'Add to Feed','btn ghost');button.type='button';button.disabled=visible||FOLLOW_FEED_POLICY.explicitlyExcluded(event,userPreferences);
  button.onclick=()=>{const latest=getEventAction(event);const next=updateEventAction(event,{addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),addedFixture:{...event,manualPin:true},dismissed:false,archived:false,pinState:'added',pinRevision:(Number(latest.pinRevision)||0)+1,pinMutationId:crypto.randomUUID()});queueFixturePinCommand(eventActionKey(event),next);activeEvents=mergeCanonicalEventPages(activeEvents,[event]);button.textContent='In Feed';button.disabled=true;};return button;
 }
 function appendProfileAlertSetup(host){
  const section=node('details',null,'athletes-alert-setup'),summary=node('summary','Start alerts'),text=node('p'),button=node('button','Enable alerts','btn ghost');button.type='button';section.append(summary,text,button);host.append(section);
  const prefs=userPreferences.followFirst?.notifications||{};
  if(prefs.enabled===false||prefs.sportingRemindersEnabled===false||prefs.autoRemindersEnabled===false){summary.textContent='Start alerts · Off';text.textContent='Start alerts are off in Settings.';button.textContent='Manage alerts';button.onclick=()=>openSettings({section:'notifications'});return;}
  summary.textContent='Start alerts · Setup';text.textContent='15 minutes before a verified match start. Check device setup.';
  button.onclick=async()=>{button.disabled=true;try{await ensurePushInstallation({requestPermission:true});summary.textContent='Start alerts · Device enabled';text.textContent='Device alerts enabled. Eligible matches can notify even when absent from Feed.';button.hidden=true;}catch(error){text.textContent=error.message;button.disabled=false;}};
  if(typeof Notification!=='undefined'&&Notification.permission==='granted')void navigator.serviceWorker?.getRegistration().then(r=>r?.pushManager?.getSubscription()).then(subscription=>{if(section.isConnected&&subscription){summary.textContent='Start alerts · Check readiness';text.textContent='Check Notifications for delivery readiness.';button.textContent='Manage alerts';button.onclick=()=>openSettings({section:'notifications'});}}).catch(()=>{});
 }
 function monthLabel(day){return day&&/^\d{4}-\d{2}/.test(day)?new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(day.slice(0,7)+'-01T12:00:00Z')):'Dates to be announced';}
 function calendar(host,record,t){
  const start=formatDateKey(nowAEST()),until=globalThis.NOTHINGSPORTS_TENNIS_JOURNEYS?.through(start)||String(Number(start.slice(0,4))+1)+start.slice(4);
  const keys=new Set([recordKey(record),record.currentTeamId&&model.identity(record.currentTeamId)].filter(Boolean));
  const fixtures=availableEvents().filter(e=>model.participantIds(e).some(id=>keys.has(model.identity(id)))).filter(e=>{if(e.date)return e.date>=start&&e.date<=until||model.spansCurrentCalendarDay(e,start,until);const window=e.schedulingWindow;return !window?.startsOn||window.startsOn<=until&&(!window.endsOn||window.endsOn>=start);});
  const outlook=record.sportKey?.startsWith('tennis')&&journeys?NOTHINGSPORTS_TENNIS_JOURNEYS.forParticipant(journeys,record,start,userPreferences):[];
  const rows=[...fixtures.map(e=>({day:(e.date&&e.date<start?start:e.date)||(e.schedulingWindow?.startsOn?e.schedulingWindow.startsOn<start?start:e.schedulingWindow.startsOn:''),event:e})),...outlook.map(e=>({day:e.tourWindows[0]?.startDate||'',edition:e}))].sort((a,b)=>(a.day||'9999').localeCompare(b.day||'9999')||String(a.event?.startTimeUtc||'').localeCompare(String(b.event?.startTimeUtc||'')));
  host.append(node('h3','Next twelve months'),node('small',start+' – '+until));
  if(!rows.length&&!loading)host.append(node('p','Future appearances will appear here as schedules are published.'));
  let month='',group;
  for(const item of rows){const label=monthLabel(item.day);if(month!==label){month=label;group=node('section',null,'participant-month');group.append(node('h3',label));host.append(group);}const row=node('article',null,'participant-calendar-row');group.append(row);
   if(item.event){const event=item.event;row.append(node('strong',spoilerSafeDisplayTitle(event)||event.name),node('p',[event.tournamentName||event.competitionName||event.eventName,event.roundLabel||event.round].filter(Boolean).join(' · ')),node('small',timing(event)));appendMatchEvidence(row,event);
    if(record.currentTeamId&&!model.participantIds(event).some(id=>model.identity(id)===recordKey(record)))row.append(node('small','Current team fixture · player selection not confirmed'));
    const actions=node('div',null,'athletes-actions'),button=node('button',model.calendarTiming(event)?'Open tournament':'Open match','btn ghost');button.type='button';button.onclick=()=>openMatch(event,button);actions.append(button,buildParticipantFeedButton(event));appendEventQuickActions(actions,event,{chat:false,viewing:false,reminder:Boolean(getEventAction(event).reminderRequested)||reminderCanBeScheduled(eventReminderTiming(event))});row.append(actions);
   }else{const e=item.edition;row.dataset.journeyEdition=e.id;row.append(node('strong',e.name+' '+e.season),node('p',e.label),node('small',e.tourWindows.length?e.tourWindows.map(w=>w.tour+' · '+w.startDate+' – '+w.endDate+' · tournament dates').join(' / '):'Dates to be announced'),node('p',e.reason));
    const details=node('details');details.append(node('summary','Sources'));for(const id of e.sourceIds){const source=journeys.sources.find(s=>s.id===id);if(source){const a=node('a',(source.label||'Calendar source')+(source.verifiedAt?' · checked '+source.verifiedAt:''),'athletes-official');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';details.append(a);}}row.append(details);
   }
  }
 }
 function profile(panel,record,t){
  const back=node('button','Back','btn ghost athletes-profile-back');back.type='button';back.setAttribute('aria-label','Back');back.onclick=()=>{if(history.state?.athleteProfile)history.back();else{profileId='';followHomeView='browse';history.replaceState({},'','#follow');renderAll();}};panel.append(back);
  const directory=NOTHINGSPORTS_PARTICIPANT_DIRECTORY,header=node('header',null,'participant-profile-header'),name=node('h2',record.displayName||record.name),identity=node('div',null,'participant-profile-identity');identity.append(name,node('small',[directory.sportLabel(record),directory.competition(record),directory.standing(record)?'Rank '+directory.standing(record):null].filter(Boolean).join(' · ')));const flag=COUNTRY_FLAGS?.flagMarkup?.(record.countryCode,{label:record.displayName});if(flag)identity.insertAdjacentHTML('afterbegin',flag);header.append(identity,buildDirectoryFollowButton(record.id,{sportKey:record.sportKey,label:record.displayName}));panel.append(header);
  const tabs=node('div',null,'participant-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Participant information');panel.append(tabs);
  const body=node('section',null,'athletes-profile-fixtures');body.id='participant-content';body.setAttribute('role','tabpanel');panel.append(body);
  const show=()=>{body.replaceChildren();for(const button of tabs.children)button.setAttribute('aria-selected',String(button.dataset.tab===profileTab));if(profileTab==='fixtures'){const next=selection.next.get(recordKey(record))||selection.next.get(model.identity(record.currentTeamId||''));if(next){body.append(node('h3',model.calendarTiming(next)?'Tournament':'Next appearance'),node('p',spoilerSafeDisplayTitle(next)||next.name),node('small',timing(next))); }else schedule(body,record,t);calendar(body,record,t);if(nextCursor!==null){const more=node('button','Load more fixtures','btn ghost');more.type='button';more.dataset.athletesFocusKey='load-more';more.onclick=async()=>{rememberFocus(more);more.disabled=true;await hydrate(false,true);};body.append(more);}}
   else{if(directory.standing(record))body.append(node('p',(record.rankingBasis||directory.competition(record))+' · Rank '+directory.standing(record)));void ensureAthleteProfileUi().then(ui=>{if(body.isConnected&&profileTab==='standings')return ui.standings(body,record,record.sportKey?.replace(/-women$/,''),null);}).catch(()=>{if(body.isConnected)body.append(node('p','Standings could not load. Select the tab to try again.'));});}};
  for(const [id,label] of [['fixtures','Fixtures'],['standings',record.id.startsWith('team:')?'Ladder':'Standings']]){const button=node('button',label,'btn ghost');button.type='button';button.dataset.tab=id;button.setAttribute('role','tab');button.setAttribute('aria-controls',body.id);button.onclick=()=>{profileTab=id;show();};tabs.append(button);}show();
  void ensureAthleteProfileUi().then(ui=>{if(header.isConnected)ui.decorateIdentity(name,{...record,profileRef:null},record.sportKey);}).catch(()=>{});
 }
 function render(){
  if((activeTab!=='follow'||followHomeView!=='favourites'))return;
  if(account!==owner()){generation++;records=[];events=[];key='';checked=0;profileId='';origin=null;account=owner();}
  const panel=document.getElementById('listView'),focus=panel.contains(document.activeElement)?focusContext(document.activeElement):document.activeElement===document.body&&pendingFocus&&valid(pendingFocus.ticket)?pendingFocus.context:null;pendingFocus=null;panel.className='athletes-hub';panel.replaceChildren();restoreFocus(panel,focus,ticket());
  const heading=node('div',null,'athletes-heading');const refresh=node('button','Refresh','btn ghost');refresh.type='button';refresh.dataset.athletesFocusKey='refresh';refresh.setAttribute('aria-busy',String(Boolean(loading)));refresh.onclick=async()=>{if(Date.now()-lastManual<10000)return;lastManual=Date.now();rememberFocus(refresh);refresh.disabled=true;await hydrate(true);};heading.append(refresh);panel.append(heading);buildFollowHomeTabs(panel);
  if(notice)panel.append(node('p',notice));else if(loading){const status=node('small','Updating…');status.setAttribute('role','status');heading.prepend(status);}
  selection=selectFixtures();
  const route=location.hash.match(/^#(?:follow\/profile|athletes)\/(.+)$/);if(route){try{profileId=decodeURIComponent(route[1]);}catch{profileId='';}}
  if(profileId){profile(panel,resolve(profileId),ticket());return;}
  const directory=NOTHINGSPORTS_PARTICIPANT_DIRECTORY,orderingRecords=allRecords(),people=followed().sort((a,b)=>directory.compare(a,b,orderingRecords));
  if(!people.length&&checked&&!loading)panel.append(node('p','Follow players or teams to keep their fixtures here.'));
  let sport='',competition='',sportGroup,group;
  for(const record of people){const sportLabel=directory.sportLabel(record),competitionLabel=directory.competition(record);if(sport!==sportLabel){sport=sportLabel;competition='';group=null;sportGroup=node('section',null,'athletes-sport-group');sportGroup.append(node('h2',sport));panel.append(sportGroup);}if(!group||competition!==competitionLabel){competition=competitionLabel;group=node('section',null,'athletes-competition-group');if(competition)group.append(node('h3',competition));sportGroup.append(group);}
   const card=node('article',null,'athletes-person'),row=node('div',null,'athletes-person-row');card.dataset.athleteId=record.id;const name=node('button',record.displayName,'athletes-name');name.type='button';name.dataset.profileTrigger='favourite:'+record.id;name.setAttribute('aria-label',`Open ${record.displayName} profile in Follow`);name.onclick=()=>open(record.id,record.displayName,record.sportKey,name);const rank=directory.standing(record);if(rank)row.append(node('span',String(rank),'athletes-rank'));row.append(name,buildDirectoryFollowButton(record.id,{sportKey:record.sportKey,label:record.displayName}));card.append(row);
   const next=selection.next.get(recordKey(record));if(next)card.append(node('small',[next.tournamentName||next.competitionName||next.eventName||next.name,next.date,model.timingState(next)==='published'?timing(next):null].filter(Boolean).join(' · '),'athletes-cached-next'));group.append(card);
  }
  if(nextCursor!==null){const more=node('button','Load more favourites','btn ghost');more.dataset.athletesFocusKey='load-more';more.onclick=async()=>{rememberFocus(more);more.disabled=true;await hydrate(false,true);};panel.append(more);}

 }
 function start(){
  if((activeTab!=='follow'||followHomeView!=='favourites'))return;if(!checked&&account===owner())events=activeEvents;render();
  if(profileId&&resolve(profileId).sportKey?.startsWith('tennis')&&!journeys&&!journeysPending){journeysPending=true;void loadJourneys().then(()=>{if((activeTab==='follow'&&followHomeView==='favourites'))render();}).catch(()=>{}).finally(()=>{journeysPending=false;});}
  if(key!==preferencesKey()||Date.now()-checked>=300000)void hydrate();

 }
 function stop(){generation++;queuedOptions=null;pendingFocus=null;clearInterval(timer);timer=null;}
 function navigate(tab){if(matchReturn)pendingNotificationEventId='';if(tab==='follow'){profileId='';origin=null;}else{profileId='';origin=null;matchReturn=null;}}
 function route(){
  if(location.hash==='#follow/favourites'||location.hash==='#athletes'||(location.hash.startsWith('#follow/profile/')||location.hash.startsWith('#athletes/'))){const matchOrigin=matchReturn;matchReturn=null;if(matchOrigin)pendingNotificationEventId='';activeTab='follow';followHomeView='favourites';activeInspectorCodeId=null;try{profileId=history.state?.athleteProfile||decodeURIComponent(location.hash.match(/^#(?:follow\/profile|athletes)\/(.+)$/)?.[1]||'');}catch{profileId='';}if(!(model.individual(profileId)||profileId.startsWith('team:')))profileId='';if(history.state?.athleteOrigin)origin=history.state.athleteOrigin;syncTopLevelNavigationState();if(matchOrigin)restore(matchOrigin);else if(!profileId&&origin?.tab==='follow'){const saved=origin;origin=null;restore(saved);}else renderAll();return true;}
  if((activeTab==='follow'&&followHomeView==='favourites')&&origin){const saved=origin;origin=null;profileId='';stop();restore(saved);return true;}return false;
 }
 async function refresh(){if(document.hidden||(activeTab!=='follow'||followHomeView!=='favourites'))return;return hydrate();}
 // WebKit cancels the old read before pagehide. Do not let its completion
 // start a queued request in the outgoing document. No lasting unload flag:
 // cancelled navigation can Refresh, and a restored page resumes normally.
 window.addEventListener('beforeunload',()=>{queuedOptions=null;});
 window.addEventListener('pagehide',stop);
 window.addEventListener('pageshow',event=>{if(event.persisted)start();});
 const style=node('style');style.textContent='.athletes-heading,.athletes-actions,.athletes-featured-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.athletes-heading{justify-content:flex-end}.athletes-profile,.athletes-profile-fixtures,.athletes-featured{padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card)}.athletes-person p,.athletes-profile-fixtures p{font-size:.8rem;line-height:1.5}.athletes-person small,.athletes-profile-fixtures small{color:var(--text-dim)}.athletes-profile-fixtures small{display:block;line-height:1.5;margin-top:6px}.athletes-official{display:block;padding:10px 0;color:var(--accent);font-size:.8rem}.athletes-profile-fixtures details{padding:10px 0}.athletes-coverage-gap{color:var(--text-dim)}';document.head.append(style);
 globalThis.NOTHINGSPORTS_ATHLETES_UI={start,stop,open,route,render,openMatch,navigate,refresh,buildParticipantFeedButton};
})();
