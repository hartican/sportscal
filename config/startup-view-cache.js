/* Idle-only preparation. No score/provider polling runs in this module. */
(() => {
 'use strict';
 let saved;
 const key=()=>JSON.stringify([serverSyncClient?.sessionSubject()||'public',userPreferences,eventActions,feedViewFilters,activeFilter,activeView,currentFeedPresentationFingerprint(),todayMoreReveal,pendingNotificationEventId]);
 const activate=activateTopLevelTab,render=renderListView;
 activateTopLevelTab=function(next,options){
  if(activeTab==='feed'&&next!=='feed'&&!activeInspectorCodeId&&!activeSportHubKey()&&!calendarChoice.active&&!startupCoordinator.isHydrating()){
   const panel=document.getElementById('listView'),fragment=document.createDocumentFragment();
   saved={key:key(),at:Date.now(),fragment,slots:[...feedCardSlots],observer:feedCardWindowObserver};
   saved.observer?.disconnect();fragment.append(...panel.childNodes);
  }
  return activate(next,options);
 };
 renderListView=function(){
  if(saved&&Date.now()-saved.at<30000&&!calendarChoice.active&&!activeInspectorCodeId&&saved.key===key()){
   const panel=document.getElementById('listView');panel.replaceChildren(saved.fragment);panel.className='';panel.dataset.scrollList='feed';
   feedCardSlots.clear();for(const [slot,item] of saved.slots){feedCardSlots.set(slot,item);saved.observer?.observe(slot);}feedCardWindowObserver=saved.observer;saved=null;
   globalThis.fantasyDeadlineController?.sync();queueLiveFixtureSnapshot();return;
  }
  saved=null;return render();
 };
 const warm=async()=>{
  if(document.hidden)return;
  await Promise.allSettled([loadDeferredScript('config/match-centre.js?v=509'),loadDeferredScript('config/score-details.js?v=516'),loadDeferredScript('config/surface-category-ui.js?v=403'),loadDeferredScript('assets/js/match-centre-refresh.js?v=340')]);
  if(document.hidden)return;
  await Promise.allSettled([loadDeferredScript('assets/js/match-centre-ui.js?v=509'),loadDeferredScript('config/event-overviews-ui.js?v=516')]);
 };
 void warm();
})();
