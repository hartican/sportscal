(function(root){
'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=463';link.dataset.mcStyle='';document.head.append(link);
}
loadMatchCentreStyles();
let eventOverviewsDocument=null,eventOverviewsPending=null;
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
async function render(container){
 const node=document.createElement('section');node.className='events-section';node.id='eventsViewPanel';node.setAttribute('role','tabpanel');node.setAttribute('aria-labelledby','events-view-tab-overviews');container.append(node);
 if(!eventOverviewsDocument){node.textContent='Loading events…';try{eventOverviewsPending||=fetch('data/event-overviews.v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).finally(()=>{eventOverviewsPending=null;});eventOverviewsDocument=await eventOverviewsPending;}catch{if(!node.isConnected)return;node.replaceChildren(text('p','Events could not refresh.'));const retry=text('button','Retry events','btn');retry.type='button';retry.onclick=()=>{node.remove();void render(container);};node.append(retry);return;}}
 if(!node.isConnected)return;
 const prefs=FOLLOW_FIRST.migratePreferences(userPreferences),selected=new Set(prefs.selectedSelectorEntityIds||[]),followed=new Set(prefs.followedSports||[]),collections=followCollectionsById();
 const follows=id=>FOLLOW_FIRST.effectiveParticipantFollow(id,prefs,collections,prefs).followed;
 const followsEvent=e=>((e.lemansCalendar||e.golfMajorCalendar)&&(prefs.followFirst?.followedMajorEventIds||[]).includes(e.eventFamilyId))||(e.sportKey!=='lemans'&&selected.has('sport:'+e.sportKey))||(prefs.preferenceGraph?.competitionPreferences||[]).some(p=>p.competitionId===e.competitionId&&p.enabled===true)||!selected.size&&followed.has(e.sportKey)&&!['tdf','giro','vuelta','wsl','dakar'].includes(e.sportKey)||(e.participantIds||[]).some(follows);
 const today=formatDateKey(nowAEST()),scope=prefs.eventsScope==='all'?'all':'followed';
 const current=eventOverviewsDocument.events.filter(e=>(e.endDate||e.date)>=today&&!FOLLOW_FEED_POLICY.explicitlyExcluded({...e,key:e.sportKey},prefs));
 const available=current.filter(e=>scope==='all'||followsEvent(e));
 const controls=document.createElement('nav');controls.className='events-view-tabs';controls.setAttribute('aria-label','Events scope');
 for(const [value,label]of [['followed','Followed events'],['all','All events']]){const button=text('button',label,'events-view-tab'+(scope===value?' active':''));button.type='button';button.setAttribute('aria-pressed',String(scope===value));button.onclick=()=>{const next=clonePreferences(userPreferences);next.eventsScope=value;savePreferences(next,{viewOnly:true});renderEventsView();};controls.append(button);}
 const jump=text('button','Jump to Now','btn ghost');jump.type='button';jump.onclick=()=>node.querySelector('.events-now-marker')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});controls.append(jump);
 const choice=buildSurfaceCategoryChooser('events',available,renderEventsView,{includeAll:true});node.replaceChildren(controls,choice.select);
 const marker=text('div','Now','events-now-marker is-active');marker.setAttribute('role','separator');marker.setAttribute('aria-label','Current and upcoming events');node.append(marker);
 const visible=available.filter(e=>choice.selected==='all'||NOTHINGSPORTS_SURFACE_CATEGORY.category(e)===choice.selected).sort((a,b)=>Math.max(a.date.localeCompare(today),0)-Math.max(b.date.localeCompare(today),0)||a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const event of visible){
  const card=document.createElement('article');card.className='match-centre-card events-overview-card';card.dataset.eventOverviewId=event.id;
  const title=text('h3',event.name),dates=text('p',NOTHINGSPORTS_AUSTRALIAN_DATES.date(event.date)+(event.endDate!==event.date?' – '+NOTHINGSPORTS_AUSTRALIAN_DATES.date(event.endDate):''));card.append(title,dates);
  const upcoming=(event.upcomingFixtures||[]).filter(f=>(f.date||'')>=today),next=upcoming.filter(f=>(f.participantIds||[]).some(follows));
  const stage=upcoming[0]?.roundLabel||upcoming[0]?.round;
  const context=[event.venueCity,event.tour,event.tournamentLevel,stage].filter(Boolean);if(context.length)card.append(text('p',[...new Set(context)].join(' · ')));
  for(const fixture of next.slice(0,2)){const row=text('p',fixture.spoilerSafeTitle||fixture.name,'athletes-next-match');const timing=NOTHINGSPORTS_CARD_TIMING.presentation(fixture,nowAEST());row.append(document.createTextNode(' · '+timing.fullSchedule));card.append(row);}
  if(!next.length&&(event.participantIds||[]).some(follows))card.append(text('p','Next followed appearance has not been verified.','athletes-coverage-gap'));
  const link=buildFeedScheduleLink({...event,sportDomainId:'sport:'+event.sportKey});link.textContent='Open schedule';card.append(link);
  if(event.sourceUrl){const source=text('a','Official event source');source.href=event.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';card.append(document.createTextNode(' · '),source);}
  if(event.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(event.sportKey))appendVenuePanel(card,card,event);node.append(card);
 }
 if(!visible.length)node.append(text('p',scope==='followed'?'No current events match your follows. Browse All events or follow an athlete, team or competition.':'No current events are published for this category.'));
}
root.NOTHINGSPORTS_EVENT_OVERVIEWS_UI={render};
})(globalThis);
