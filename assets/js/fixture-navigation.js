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
  return schedule(scheduleScopeForEvent(event).codeId,{focusFixture:event});
}
async function schedule(codeId, { pushHistory = true, startingGroup = "", startingTab = "all-fixtures", focusFixture = null } = {}){
  codeInspectorFocusedFixture=focusFixture;
  codeInspectorFocusedOwner=serverSyncClient?.sessionSubject()||'public';
  const startedAt = feedPerformanceNow();
  const hydration = codeInspectorChunk ? null : beginInSessionLoading("Loading Schedule");
  const manifest = await loadCodeInspectorManifest();
  if(focusFixture&&codeInspectorFocusedOwner!==(serverSyncClient?.sessionSubject()||'public')){codeInspectorFocusedFixture=null;return;}
  if (!manifest.codes.some(code => code.id === codeId)){
    hydration?.fail("Schedule is unavailable.");
    return;
  }
  if (!activeInspectorCodeId){
    const pickerBody = document.querySelector("#tuneSheet .tune-sheet-body");
    inspectorPickerState = { scrollTop: pickerBody?.scrollTop || 0, focusCodeId: codeId };
    inspectorReturnState = {
      activeTab,
      activeView,
      activeFilter,
      scrollY: tuneSheetReturnState?.scrollY ?? window.scrollY,
      focus: tuneSheetReturnState?.focus || document.activeElement,
    };
  }
  {
    const alias={'competition:le-mans':'special:le-mans-24-hours','sport:multi-sport':'special:commonwealth-games','sport:basketball':'sport:nba','sport:rugby-union':'sport:rugby','competition:uefa-champions-league':'sport:champions-league','competition:motogp':'sport:motogp','competition:sailgp':'sport:sailgp','competition:wsl-championship-tour':'sport:wsl','competition:tour-de-france':'sport:tdf','competition:giro-ditalia':'sport:giro','competition:vuelta-a-espana':'sport:vuelta','competition:fiba-womens-world-cup':'sport:fiba-women'};
    const remembered=selectorEntityById(followBrowseState().sportId);
    const compatible=NOTHINGSPORTS_FIXTURE_IDENTITY.scheduleCode(remembered,manifest.codes)?.id===codeId;
    const entity=compatible?remembered:selectorEntityById(alias[codeId] || codeId);
    if(entity){const root=selectorEntityById(entity.parentId);saveFollowBrowse({sportId:root?.level===2?root.id:entity.id,categoryId:entity.id==='sport:afl'?'sport:afl-premiership':entity.id,section:startingTab==='standings'?'standings':'schedule'});}
  }
  activeTab = "follow";followHomeView="browse";
  activeInspectorCodeId = codeId;
  codeInspectorTab = startingTab;
  codeInspectorGroup = String(startingGroup || "");
  codeInspectorChunk = null;
  sportHubState.activeTab = "all-fixtures";
  closeTuneSheet({ restoreFocus: false, restoreViewport: false });
  if (pushHistory && window.location.hash !== codeInspectorHash(codeId)){
    history.pushState({ appRoute:"follow-schedule", codeInspector: codeId, inspectorParent: true }, "", codeInspectorHash(codeId));
  }
  syncTopLevelNavigationState();
  renderAll();
  window.scrollTo({ top: 0, behavior: "auto" });
  recordFeedInteraction("inspector_open", startedAt);
  try{
    await loadCodeInspectorChunk(codeId);
    hydration?.progress(.9);
    if (activeInspectorCodeId === codeId){
      const renderStartedAt = feedPerformanceNow();
      renderAll();
      hydration?.complete();
      recordFeedInteraction("inspector_fixture_render", renderStartedAt);
      window.requestAnimationFrame(()=>scrollInspectorToNow({behavior:'auto'}));
    }
  }catch(error){
    hydration?.fail("Schedule could not be loaded. Try again.");
    console.warn("Schedule unavailable", error);
    if (activeInspectorCodeId === codeId){
      const renderStartedAt = feedPerformanceNow();
      renderAll();
      recordFeedInteraction("inspector_fixture_error", renderStartedAt);
    }
  }
}

globalThis.NOTHINGSPORTS_FIXTURE_NAVIGATION={feed,timing,schedule};
})();
