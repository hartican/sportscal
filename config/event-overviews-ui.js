(function(root){
'use strict';
function loadMatchCentreStyles(){
 if(document.querySelector('[data-mc-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='assets/styles/match-centre.css?v=339';link.dataset.mcStyle='';document.head.append(link);
}
loadMatchCentreStyles();

let eventOverviewsDocument=null,eventOverviewsPending=null;
async function render(container){
 const node=document.createElement('section');node.className='events-section';container.append(node);
 if(!eventOverviewsDocument){node.textContent='Loading events…';try{eventOverviewsPending||=fetch('data/event-overviews.v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).finally(()=>{eventOverviewsPending=null;});eventOverviewsDocument=await eventOverviewsPending;}catch{node.textContent='Events could not refresh. Open a sport’s Schedule in Follow.';return;}}
 if(!node.isConnected)return;
 const prefs=FOLLOW_FIRST.migratePreferences(userPreferences),selected=new Set(prefs.selectedSelectorEntityIds||[]),followed=new Set(prefs.followedSports||[]);
 const available=eventOverviewsDocument.events.filter(e=>{const key=e.sportKey;return (((e.lemansCalendar||e.golfMajorCalendar)&&(prefs.followFirst?.followedMajorEventIds||[]).includes(e.eventFamilyId))||(key!=='lemans'&&selected.has('sport:'+key))||(prefs.preferenceGraph?.competitionPreferences||[]).some(p=>p.competitionId===e.competitionId&&p.enabled===true)||!selected.size&&followed.has(key)&&!['tdf','giro','vuelta','wsl','dakar'].includes(key))&&!FOLLOW_FEED_POLICY.explicitlyExcluded({...e,key},prefs);}).filter(e=>(e.endDate||e.date)>=formatDateKey(nowAEST()));
 const choice=buildSurfaceCategoryChooser('events',available,renderEventsView);node.replaceChildren(choice.select);
 for(const event of available.filter(e=>e.sportKey===choice.selected)){
  const card=document.createElement('article');card.className='match-centre-card events-overview-card';const title=document.createElement('h3');title.textContent=event.name;const dates=document.createElement('p');dates.textContent=NOTHINGSPORTS_AUSTRALIAN_DATES.date(event.date)+(event.endDate!==event.date?' – '+NOTHINGSPORTS_AUSTRALIAN_DATES.date(event.endDate):'');
  const link=buildFeedScheduleLink({...event,sportDomainId:'sport:'+event.sportKey});link.textContent='Open schedule';card.append(title,dates,link);if(event.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(event.sportKey))appendVenuePanel(card,card,event);node.append(card);
 }
 if(!available.length){const empty=document.createElement('p');empty.textContent='Follow a sport to see its upcoming events.';node.append(empty);}
}
root.NOTHINGSPORTS_EVENT_OVERVIEWS_UI={render};
})(globalThis);
