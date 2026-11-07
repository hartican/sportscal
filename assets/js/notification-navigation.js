/* Device-local destination handoff, loaded outside the startup barrier. */
function focusMilestoneNotification(){
  const id=pendingNotificationEventId,moment=new URLSearchParams(location.search).get('moment'),owner=serverSyncClient?.sessionSubject(),key=JSON.stringify([id,moment,owner]);
  if(focusMilestoneNotification.current?.key===key&&notificationFixtureLoading===focusMilestoneNotification.current.operation)return true;
  const previous=notificationFixtureLoading,ticket={key};focusMilestoneNotification.current=ticket;
  const current=()=>{
    const query=new URLSearchParams(location.search);
    return focusMilestoneNotification.current===ticket&&ticket.revision===fixtureNavigationRevision&&owner===serverSyncClient?.sessionSubject()&&pendingNotificationEventId===id&&query.get('event')===id&&query.get('moment')===moment&&query.get('surface')==='match-centre';
  };
  const operation=routeFixture('milestone',id,{current}).finally(()=>{
    if(notificationFixtureLoading===operation)notificationFixtureLoading=false;
    if(focusMilestoneNotification.current===ticket)focusMilestoneNotification.current=null;
  });
  ticket.revision=fixtureNavigationRevision;ticket.operation=operation;ticket.current=current;notificationFixtureLoading=operation;
  // A request started before this deferred module loads has legacy cleanup.
  // Restore the newest active promise after that cleanup.
  if(previous?.then){const restore=()=>{const newest=focusMilestoneNotification.current;if(newest?.current())notificationFixtureLoading=newest.operation;};void previous.then(restore,restore);}
  return true;
}
// Keep ordinary Feed notification routing intact; this module owns milestone taps.
(() => {
  const previous=focusPendingNotificationEvent;
  focusPendingNotificationEvent=function(){
    if(pendingNotificationEventId&&new URLSearchParams(location.search).get('surface')==='match-centre')return focusMilestoneNotification();
    return previous();
  };
})();
function startMilestoneNotificationNavigation(){
  if(startMilestoneNotificationNavigation.started||!('serviceWorker' in navigator))return;
  startMilestoneNotificationNavigation.started=true;
  const accepted=new Set();
  function receive(data,worker){
    if(data?.type!=='nothingsport-notification-navigation'||typeof data.token!=='string'||data.token.length>80||!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+120000)return;
    let target;try{
      const source=new URL(worker.scriptURL),url=new URL(data.url,location.origin),id=url.searchParams.get('event');
      if(source.origin!==location.origin||source.pathname!=='/service-worker.js'||url.origin!==location.origin||!['/','/index.html'].includes(url.pathname)||url.searchParams.get('surface')!=='match-centre'||!id||id.length>180)return;
      target=new URL('/',location.origin);target.searchParams.set('event',id);target.searchParams.set('surface','match-centre');
      const moment=url.searchParams.get('moment');if(moment&&moment.length<=200)target.searchParams.set('moment',moment);
    }catch{return;}
    if(!accepted.has(data.token)){
      accepted.add(data.token);if(accepted.size>20)accepted.delete(accepted.values().next().value);
      // Replace a restored root/hash route before using the normal exact-fixture path.
      history.replaceState(history.state,'',target.href);
      void syncAppRouteFromLocation();
    }
    try{worker.postMessage({type:'nothingsport-notification-navigation-accepted',token:data.token});}catch{}
  }
  function request(){
    void navigator.serviceWorker.ready.then(registration=>{
      const worker=navigator.serviceWorker.controller||registration.active;if(!worker)return;
      const channel=new MessageChannel(),timeout=setTimeout(()=>channel.port1.close(),1000);
      channel.port1.onmessage=event=>{clearTimeout(timeout);channel.port1.close();receive(event.data,worker);};
      worker.postMessage({type:'nothingsport-notification-navigation-request'},[channel.port2]);
    }).catch(()=>{});
  }
  navigator.serviceWorker.addEventListener('message',event=>receive(event.data,event.source));
  navigator.serviceWorker.addEventListener('controllerchange',request);
  window.addEventListener('focus',request);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)request();});
  request();
}

startMilestoneNotificationNavigation();
