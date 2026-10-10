/* Exact fixture routing, loaded on the first navigation action. */
(() => {
'use strict';
function feed(event,{temporary=false}={}){
  const action=getEventAction(event);
  if(action.archived||action.dismissed){showToast('This fixture has been removed from your Feed.');return;}
  const id=String(event.eventId||event.id);
  // Seed this verified fixture while its Feed page loads.
  activeEvents=NOTHINGSPORTS_FIXTURE_IDENTITY.mergeOverlays(activeEvents,[event]);
  if(!matchesFeedViewFilters(event)){
    feedViewFilters={sport:'all',minimum:0};if(!temporary){localStorage.removeItem('ns-feed-view-filter-v1');showToast('Feed filters cleared to show this fixture.');}
  }
  activeView='list';calendarChoice.active=false;setCardState(event,'opened');
  pendingNotificationEventId=id;
  activateTopLevelTab('feed',{resetViewport:false,athleteMatch:temporary});
  calendarInitialJumpPending=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(activeTab!=='feed')return;
    if(pendingNotificationEventId===id)focusPendingNotificationEvent();
    // Two frames let Feed layout finish before restoring focus.
    const target=document.querySelector(`.event-card[data-event-id="${CSS.escape(id)}"]`);
    if(target){target.tabIndex=-1;window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-stickyFeedChromeHeight()-12),behavior:'auto'});target.focus({preventScroll:true});}
  }));
}
function timing(event){
  const action=getEventAction(event);
  if(eventFollowReason(event)&&!action.archived&&!action.dismissed){feed(event);void refreshLiveFixtureSnapshot();return;}
  return openCodeInspector(scheduleScopeForEvent(event).codeId,{focusFixture:event});
}
globalThis.NOTHINGSPORTS_FIXTURE_NAVIGATION={feed,timing};
})();
