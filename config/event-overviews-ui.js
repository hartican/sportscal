(function(root){
'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=479';link.dataset.mcStyle='';document.head.append(link);
}
loadMatchCentreStyles();
let eventOverviewsDocument=null,eventOverviewsPending=null;const sessionSchedules=new Map();
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
async function render(container){
 const node=document.createElement('section');node.className='events-section';node.id='eventsViewPanel';node.setAttribute('role','tabpanel');node.setAttribute('aria-labelledby','events-view-tab-overviews');container.append(node);
 if(!eventOverviewsDocument){node.textContent='Loading events…';try{eventOverviewsPending||=fetch('data/event-overviews.v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).finally(()=>{eventOverviewsPending=null;});eventOverviewsDocument=await eventOverviewsPending;}catch{if(!node.isConnected)return;node.replaceChildren(text('p','Events could not refresh.'));const retry=text('button','Retry events','btn');retry.type='button';retry.onclick=()=>{node.remove();void render(container);};node.append(retry);return;}}
 if(!node.isConnected)return;
 const prefs=FOLLOW_FIRST.migratePreferences(userPreferences),selected=new Set(prefs.selectedSelectorEntityIds||[]),followed=new Set(prefs.followedSports||[]),collections=followCollectionsById();
 const follows=id=>FOLLOW_FIRST.effectiveParticipantFollow(id,prefs,collections,prefs).followed;
 const followsEvent=e=>((e.lemansCalendar||e.golfMajorCalendar)&&(prefs.followFirst?.followedMajorEventIds||[]).includes(e.eventFamilyId))||(e.sportKey!=='lemans'&&selected.has('sport:'+e.sportKey))||(prefs.preferenceGraph?.competitionPreferences||[]).some(p=>p.competitionId===e.competitionId&&p.enabled===true)||!selected.size&&followed.has(e.sportKey)&&!['tdf','giro','vuelta','wsl','dakar'].includes(e.sportKey)||(e.participantIds||[]).some(follows);
 const today=formatDateKey(nowAEST()),scope=prefs.eventsScope==='all'?'all':'followed';
 const target=globalThis.pendingTournamentFocusFixture||activeEvents.find(e=>String(e.eventId||e.id)===pendingMajorEventFocusId)||tennisFeedParentDocument?.parents?.find(e=>e.id===pendingMajorEventFocusId);
 const isTarget=e=>e.id===pendingMajorEventFocusId || e.fixtureIds?.includes(pendingMajorEventFocusId) || target&&e.tournamentId&&[target.tournamentId,target.tennisTournamentId,...(target.tournamentIds||[])].includes(e.tournamentId)||target&&e.fixtureIds?.some(id=>[target.id,target.eventId,target.canonicalEventId,...(target.sourceEventIds||[])].includes(id));
 const current=eventOverviewsDocument.events.filter(e=>FOLLOW_FEED_POLICY.activeEligible({...e,key:e.sportKey})&&((e.endDate||e.date)>=today||isTarget(e)));
 const available=current.filter(e=>isTarget(e)||scope==='all'||!FOLLOW_FEED_POLICY.eventExcluded(e,prefs)&&(FOLLOW_FEED_POLICY.editionDecision(e,prefs)==='followed'||followsEvent(e)));
 const controls=document.createElement('nav');controls.className='events-view-tabs';controls.setAttribute('aria-label','Events scope');
 for(const [value,label]of [['followed','Followed events'],['all','All events']]){const button=text('button',label,'events-view-tab'+(scope===value?' active':''));button.type='button';button.setAttribute('aria-pressed',String(scope===value));button.onclick=()=>{const next=clonePreferences(userPreferences);next.eventsScope=value;savePreferences(next,{viewOnly:true});renderEventsView();};controls.append(button);}
 const jump=text('button','Jump to Now','btn ghost');jump.type='button';jump.onclick=()=>node.querySelector('.events-now-marker')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});controls.append(jump);
 const choice=buildSurfaceCategoryChooser('events',available,renderEventsView,{includeAll:true});node.replaceChildren(controls,choice.select);
 const marker=text('div','Now','events-now-marker is-active');marker.setAttribute('role','separator');marker.setAttribute('aria-label','Current and upcoming events');node.append(marker);
 const visible=available.filter(e=>isTarget(e)||choice.selected==='all'||NOTHINGSPORTS_SURFACE_CATEGORY.category(e)===choice.selected).sort((a,b)=>Math.max(a.date.localeCompare(today),0)-Math.max(b.date.localeCompare(today),0)||a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const event of visible){
  const card=document.createElement('article');card.className='match-centre-card events-overview-card';card.dataset.eventOverviewId=event.id;card.dataset.eventId=event.id;card.tabIndex=-1;
  const title=text('h3',event.name),dates=text('p',NOTHINGSPORTS_AUSTRALIAN_DATES.date(event.date)+(event.endDate!==event.date?' – '+NOTHINGSPORTS_AUSTRALIAN_DATES.date(event.endDate):''));card.append(title,dates);
  const upcoming=(event.upcomingFixtures||[]).filter(f=>(f.date||'')>=today),next=upcoming.filter(f=>(f.participantIds||[]).some(follows));
  const stage=upcoming[0]?.roundLabel||upcoming[0]?.round;
  const context=[event.venueCity,event.tour,event.tournamentLevel,stage].filter(Boolean);if(context.length)card.append(text('p',[...new Set(context)].join(' · ')));
  for(const fixture of next.slice(0,2)){const row=text('p',fixture.spoilerSafeTitle||fixture.name,'athletes-next-match');const timing=NOTHINGSPORTS_CARD_TIMING.presentation(fixture,nowAEST());row.append(document.createTextNode(' · '+timing.fullSchedule));card.append(row);}
  if(!next.length&&(event.participantIds||[]).some(follows))card.append(text('p','Next followed appearance has not been verified.','athletes-coverage-gap'));
  card.append(buildEventEditionToggle({...event,tournamentParent:true}));
  const details=document.createElement('details'),summary=text('summary','Fixtures');details.append(summary);details.open=Boolean(isTarget(event));card.append(details);let loaded=false;
  const mount=async()=>{if(!details.open||loaded)return;loaded=true;const list=document.createElement('div');list.textContent='Loading published fixtures…';details.append(list);try{
    let fixtures;if(event.sportKey.startsWith('tennis'))fixtures=(await loadTennisFeedContests()).fixtures.filter(f=>(f.tournamentId||f.tennisTournamentId)===event.tournamentId);
    else if(event.sportKey==='f1'){
      if(!sessionSchedules.has('f1'))sessionSchedules.set('f1',fetchJson('data/follow-schedule/f1.json',{cache:'no-cache'}).catch(error=>{sessionSchedules.delete('f1');throw error;}));
      const schedule=await sessionSchedules.get('f1');fixtures=(schedule.fixtures||[]).filter(f=>event.fixtureIds.includes(f.id));
    }else {await loadDeferredScript('assets/js/tournament-fixture-ui.js?v=467');const horizon=await loadTournamentHorizon();fixtures=horizon.tournaments?.find(t=>t.tournamentId===event.tournamentId)?.publishedFixtures||[];}
    if(!list.isConnected)return;fixtures=fixtures.filter(f=>!FOLLOW_FEED_POLICY.multiDayMarker(f)&&FOLLOW_FEED_POLICY.scheduleVisible(f,prefs,collections));
    list.replaceChildren();let count=0;const more=()=>{for(const f of fixtures.slice(count,count+20))list.append(buildEventCard(NOTHINGSPORTS_FIXTURE_IDENTITY.fromSchedule(f,event.sportKey),{mode:'schedule'}));count+=20;if(count<fixtures.length){const b=text('button','More fixtures','btn ghost');b.type='button';b.onclick=()=>{b.remove();more();};list.append(b);}};more();if(!fixtures.length)list.append(text('p','No published fixtures match this view.'));
  }catch{loaded=false;list.textContent='Fixtures could not load. ';const retry=text('button','Retry fixtures','btn ghost');retry.type='button';retry.onclick=()=>{list.remove();void mount();};list.append(retry);}};details.addEventListener('toggle',()=>void mount());const mounted=mount();
  const link=buildFeedScheduleLink({...event,sportDomainId:'sport:'+event.sportKey});link.textContent='Full schedule in Follow';card.append(link);
  if(event.sourceUrl){const source=text('a','Event source');source.href=event.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';card.append(document.createTextNode(' · '),source);}
  if(event.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(event.sportKey))appendVenuePanel(card,card,event);node.append(card);if(isTarget(event)){mounted.then(()=>requestAnimationFrame(()=>{if(!card.isConnected)return;card.style.scrollMarginTop=((document.querySelector('.header')||document.querySelector('header'))?.offsetHeight||160)+16+'px';card.scrollIntoView({block:'start'});card.focus({preventScroll:true});pendingMajorEventFocusId=null;globalThis.pendingTournamentFocusFixture=null;}));}
 }
 if(!visible.length)node.append(text('p',scope==='followed'?'No current events match your follows. Browse All events or follow an athlete, team or competition.':'No current events are published for this category.'));
}
async function followRows(container,sportKey){
 if(!eventOverviewsDocument){eventOverviewsPending ||= fetch('data/event-overviews.v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Events unavailable');return r.json();}).finally(()=>eventOverviewsPending=null);eventOverviewsDocument=await eventOverviewsPending;}
 if(!container.isConnected)return;container.replaceChildren();const today=formatDateKey(nowAEST());
 await loadMajorEventsData();if(!container.isConnected)return;
 const majors=(majorEventsDocument?.events||[]).filter(e=>e.kind!=='ticket_sale'&&COMPETITION_CLASSIFICATION.belongsInEvents(e)!==false).map(e=>({...e,...majorEventActionEvent(e),editionId:e.id,eventFamilyId:MAJOR_EVENTS.eventFamilyId(e),sportKey:e.sportKey,date:e.startDate,endDate:e.endDate,participantsConfirmed:true,legacyMajor:true}));
 const events=[...eventOverviewsDocument.events,...majors].filter(e=>e.sportKey===sportKey&&(e.endDate||e.date)>=today&&FOLLOW_FEED_POLICY.activeEligible({...e,key:e.sportKey}));
 for(const event of events){const card=document.createElement('div');card.className='follow-event-family';card.dataset.edition=FOLLOW_FEED_POLICY.editionKey(event);card.dataset.eventFamilyId=event.eventFamilyId||card.dataset.edition;const copy=text('div','');copy.append(text('strong',event.name),text('small',event.date+' – '+event.endDate));const open=text('button','Open in Events','btn ghost');open.type='button';open.onclick=()=>openMajorEventInEvents(event.id,{tournament:!event.legacyMajor});card.append(copy,buildEventEditionToggle({...event,tournamentParent:true}),open);container.append(card);}
 if(!events.length)container.append(text('p','No current editions are published for this sport.'));
 const legacy=userPreferences.followFirst?.followedMajorEventIds||[];if(legacy.length){const note=text('p','Existing recurring selections are retained. These buttons change this edition only.');container.append(note);}installFollowEventBulk(container);
}
root.NOTHINGSPORTS_EVENT_OVERVIEWS_UI={render,followRows};
})(globalThis);
