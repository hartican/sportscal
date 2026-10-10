(() => {
let feedLiveScoreLoading=null;
function installFeedLiveScore(card,event){
  const tab=activeTab;if(!['feed','follow','events'].includes(tab))return;
  if(tab!=='feed'&&!/^(live|in-progress|in_progress|ongoing)$/.test(event.status||''))return;
  if(tab==='feed')queueLiveFixtureSnapshot();
  const render=()=>globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES?.install(card,event,{resultsOn:isSpoilerVisible(event),label:id=>cardIdentityParticipants().find(p=>p.id===id)?.displayName||null});
  if(globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES){render();return;}
  const owner=serverSyncClient?.sessionSubject()||'public';
  feedLiveScoreLoading ||= loadDeferredScript('config/match-centre.js?v=476').then(()=>loadDeferredScript('config/feed-live-scores.js?v=476')).catch(error=>{feedLiveScoreLoading=null;throw error;});
  void feedLiveScoreLoading.then(()=>{if(card.isConnected&&activeTab===tab&&owner===(serverSyncClient?.sessionSubject()||'public'))render();}).catch(()=>{});
};

async function refreshLiveFixtureSnapshot(){
  if(document.hidden || globalThis.location?.protocol==='file:' || startupCoordinator.isHydrating() || activeTab==='follow' || activeTab==='athletes')return;
  if(liveFixtureRefresh){liveFixtureRefreshQueued=true;return liveFixtureRefresh;}
  const refreshOwner=JSON.stringify([serverSyncClient?.sessionSubject()||'public',userPreferences,eventActions]);
  const mountedIds=[...new Set([...document.querySelectorAll('.feed-card-slot .event-card:not(.tennis-feed-parent)')].map(card=>card.closest('[data-feed-event-id]')?.dataset.feedEventId).filter(Boolean))].sort().slice(0,60);
  const recent=Date.now()-liveFixtureLastRequestedAt<30_000;
  const ids=recent?mountedIds.filter(id=>!liveFixtureRequestedIds.has(id)):mountedIds;
  if(!ids.length)return;
  liveFixtureRequestedIds=new Set([...ids,...(recent?liveFixtureRequestedIds:[])].slice(0,120));
  liveFixtureRefresh=(async()=>{
    try{
      liveFixtureLastRequestedAt=Date.now();
      const response=await fetch(`/api/fixtures?ids=${encodeURIComponent(ids.join(","))}&revision=${encodeURIComponent(liveFixtureRevision)}${userPreferences.fantasyDeadlines.enabled?"&fantasy=1":""}`,{cache:'default',signal:AbortSignal.timeout(5000)});
      if(response.status===304)return;
      if(!response.ok)throw new Error('Live source unavailable');
      const snapshot=await response.json();
      if(document.hidden || refreshOwner!==JSON.stringify([serverSyncClient?.sessionSubject()||'public',userPreferences,eventActions]) || !['feed','events','athletes'].includes(activeTab))return;
      if(snapshot.schemaVersion!=='live-fixtures.v1'||!Array.isArray(snapshot.sources)||!snapshot.revision)throw new Error('Invalid live snapshot');
      fantasySourceState=snapshot.fantasySources||{};
      globalThis.fantasyDeadlineController?.sync();
      if(snapshot.revision===liveFixtureRevision)return;
      if(snapshot.sources.some(source=>!Array.isArray(source.fixtures)))throw new Error('Invalid source fixtures');
      const updates=snapshot.sources.slice().sort((a,b)=>String(a.checked_at||'').localeCompare(String(b.checked_at||''))).flatMap(source=>source.fixtures);
      const nextLive=globalThis.NOTHINGSPORTS_FIXTURE_IDENTITY.mergeOverlays(liveFixtureEvents,updates).filter(event=>eventMeetsDerivedRetention(event));
      const nextEvents=normalizeEvents(mergeFootballFixtureEvents(activeEvents,nextLive));
      liveFixtureEvents=nextLive;
      liveFixtureRevision=snapshot.revision;
      activeEvents=nextEvents;
      disposableStore?.set('live-fixtures:v2',{events:nextLive,revision:liveFixtureRevision,fantasySources:fantasySourceState});
      if(codeInspectorChunk)codeInspectorChunk={...codeInspectorChunk,fixtures:liveScheduleFixtures(codeInspectorChunk.fixtures)};
      rebuildDerivedCardCache(activeEvents);
      // Optional deadline changes need not rebuild the fixture layout.
      for(const event of nextEvents){
        for(const id of new Set([event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])])){
          const mounted=profileFixtureEvents.get(String(id));
          if(mounted)profileFixtureEvents.set(String(id),{...mounted,...event});
        }
      }
      for(const item of feedCardSlots.values()){
        const known=profileFixtureEvents.get(String(item.event.eventId||item.event.id));
        if(known){item.event={...item.event,...known};const card=item.slot.querySelector('.event-card');if(card)installFeedLiveScore(card,item.event);}
      }
      globalThis.fantasyDeadlineController?.sync();
      queueScrollIdleMutation(()=>renderFeedIfPresentationChanged({preserveViewport:true}));
    }catch(error){/* Keep static and last-good fixtures; a network failure is not an empty calendar. */}
    finally{liveFixtureRefresh=null;if(liveFixtureRefreshQueued){liveFixtureRefreshQueued=false;queueLiveFixtureSnapshot();}}
  globalThis.NOTHINGSPORTS_FEED_SCORE_UI={install:installFeedLiveScore,refresh:refreshLiveFixtureSnapshot};
})();
  return liveFixtureRefresh;
}
;
globalThis.NOTHINGSPORTS_FEED_SCORE_UI={install:installFeedLiveScore,refresh:refreshLiveFixtureSnapshot};
})();
