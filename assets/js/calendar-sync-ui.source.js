(function(){
function renderToolbar(container){
  if(!calendarChoice.active || activeTab!=='feed' || activeInspectorCodeId)return;
  const bar=document.createElement('div');bar.className='calendar-selection-toolbar';bar.setAttribute('aria-label','Calendar selection');
  const count=document.createElement('span');count.dataset.calendarCount='';count.setAttribute('role','status');bar.appendChild(count);
  for(const [label,selected] of [['Select all matching',true],['Unselect all matching',false]]){
    const button=document.createElement('button');button.type='button';button.className='btn ghost';button.textContent=label;
    button.onclick=async()=>{
      if(calendarChoice.busy)return;calendarChoice.busy=true;calendarBulkController=new AbortController();button.disabled=true;button.textContent='Loading all matching fixtures…';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn ghost';cancel.textContent='Cancel selection';cancel.onclick=()=>calendarBulkController?.abort();bar.appendChild(cancel);
      try{
        await loadDeferredScript('config/calendar-selection.js');
        if(activeTab==='feed'&&!activeInspectorCodeId){
          while(serverFeedNextCursor!==null || publicFeedManifest?.pages?.[publicFeedNextPageIndex]){
            calendarBulkController.signal.throwIfAborted();
            if(!await loadNextFeedPage())throw new Error('Could not load every page. Please retry bulk selection.');
            await new Promise(resolve=>setTimeout(resolve,0));
          }
        }
        const result=await globalThis.NOTHINGSPORTS_CALENDAR_SELECTION.selectBatch(NOTHINGSPORTS_CALENDAR.uniqueEvents(calendarMatchingEvents()),{...calendarChoice,selected,idFor:NOTHINGSPORTS_CALENDAR.idFor,knownDate:NOTHINGSPORTS_CALENDAR.knownDate,signal:calendarBulkController.signal,onProgress:(done,total)=>{button.textContent=`Selecting ${done} / ${total}…`;}});
        Object.assign(calendarChoice,result);
      }catch(error){showToast(error.name==='AbortError'?'Selection cancelled; previous selection kept.':error.message);}finally{calendarChoice.busy=false;calendarBulkController=null;cancel.remove();button.disabled=false;button.textContent=label;renderAll({preserveViewport:true});refreshCalendarChoiceCounts();}
    };bar.appendChild(button);
  }
  const review=document.createElement('button');review.type='button';review.className='btn primary';review.textContent='Review calendar';review.onclick=()=>showCalendarDialog();bar.appendChild(review);
  const done=document.createElement('button');done.type='button';done.className='btn ghost';done.textContent='Done selecting';done.onclick=()=>{calendarBulkController?.abort();calendarChoice.active=false;renderAll({preserveViewport:true});};bar.appendChild(done);
  container.appendChild(bar);queueMicrotask(refreshCalendarChoiceCounts);
}
async function showDialog(){
  const owner=serverSyncClient?.sessionSubject() || null;
  if(calendarChoice.owner!==owner){calendarChoice.owner=owner;calendarChoice.subscription=null;calendarChoice.included.clear();calendarChoice.excluded.clear();calendarChoice.refs.clear();calendarChoice.mode='import';}
  document.getElementById('calendarSyncDialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='calendarSyncDialog';dialog.className='calendar-dialog';dialog.setAttribute('aria-labelledby','calendarSyncTitle');
  dialog.innerHTML='<h2 id="calendarSyncTitle">Calendar sync</h2><p>Choose games from Feed. Dates TBC cannot be added.</p>';
  const close=document.createElement('button');close.type='button';close.className='calendar-close';close.textContent='×';close.setAttribute('aria-label','Close calendar sync');close.onclick=()=>dialog.close();dialog.prepend(close);
  const actions=document.createElement('div');actions.className='calendar-actions';
  const status=document.createElement('p');status.setAttribute('role','status');
  function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`btn ${primary?'primary':'ghost'}`;b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await action();}catch(error){status.textContent=error.message || 'Calendar request failed. Please retry.';}finally{b.disabled=false;}};actions.appendChild(b);return b;}
  button('One-off import',()=>{calendarChoice.mode='import';renderOptions();});
  button('Calendar subscription',async()=>{
    if(!serverSyncClient?.sessionSubject()){status.textContent='Sign in to keep a private subscription and its choices across devices.';return;}
    const result=await serverSyncClient.calendarRequest();calendarChoice.mode='subscription';calendarChoice.subscription=result.subscription;
    calendarChoice.included=new Set(result.subscription?.included_ids || []);calendarChoice.excluded=new Set(result.subscription?.excluded_ids || []);renderOptions();
  });
  dialog.append(actions,status);
  const options=document.createElement('div');dialog.appendChild(options);
  function renderOptions(){
    options.replaceChildren();status.textContent='';
    const info=document.createElement('p');info.textContent=calendarChoice.mode==='subscription'?'Followed fixtures are included automatically. Select or exclude individual games without changing follows. Your private URL stays the same when choices change. Calendar apps apply updates and removals when they refresh.':'One-off import downloads an ICS file. Imported entries do not receive later time changes or cancellations.';options.appendChild(info);
    const count=document.createElement('p');count.dataset.calendarCount='';options.appendChild(count);
    const controls=document.createElement('div');controls.className='calendar-actions';options.appendChild(controls);
    const choose=document.createElement('button');choose.type='button';choose.className='btn primary';choose.textContent='Select fixtures';choose.onclick=()=>{calendarChoice.active=true;activeTab='feed';activeInspectorCodeId=null;activeView='list';dialog.close();renderAll({preserveViewport:true});};controls.appendChild(choose);
    const save=document.createElement('button');save.type='button';save.className='btn primary';save.textContent=calendarChoice.mode==='subscription'?'Save subscription':'Download ICS';
    save.onclick=async()=>{
      save.disabled=true;try{
        if(calendarChoice.mode==='subscription'){
          if(!serverSyncClient?.sessionSubject())throw new Error('Sign in before creating a subscription.');
          await syncCurrentServerState();
          const result=await serverSyncClient.calendarRequest({method:'POST',body:JSON.stringify({includedIds:[...calendarChoice.included],excludedIds:[...calendarChoice.excluded],updatedAt:calendarChoice.subscription?.updated_at || null})});
          calendarChoice.subscription=result.subscription;renderOptions();status.textContent='Subscription saved. Calendar apps refresh on their own schedule.';
        }else{
          const events=[...calendarChoice.refs.values()].filter(event=>calendarIsSelected(event)&&NOTHINGSPORTS_CALENDAR.knownDate(event));
          if(!events.length)throw new Error('Select at least one dated fixture first.');
          const url=URL.createObjectURL(new Blob([NOTHINGSPORTS_CALENDAR.buildIcs(events)],{type:'text/calendar;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='nothing-sport.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='ICS downloaded. Open it in your calendar app to import.';
        }
      }catch(error){status.textContent=error.message;}finally{save.disabled=false;}
    };controls.appendChild(save);
    if(calendarChoice.mode==='subscription' && calendarChoice.subscription){
      const url=new URL('/api/calendar',location.origin);url.searchParams.set('token',calendarChoice.subscription.token);
      const privacy=document.createElement('p');privacy.textContent='Keep this URL private: anyone with it can read your selected fixtures.';options.appendChild(privacy);
      const field=document.createElement('textarea');field.readOnly=true;field.value=url.href;field.setAttribute('aria-label','Private calendar subscription URL');options.appendChild(field);
      const subscribe=document.createElement('a');subscribe.className='btn ghost';subscribe.href=url.href.replace(/^https?:/,'webcal:');subscribe.textContent='Open in calendar';controls.appendChild(subscribe);
      const copy=document.createElement('button');copy.type='button';copy.className='btn ghost';copy.textContent='Copy URL';copy.onclick=()=>navigator.clipboard.writeText(url.href).then(()=>{status.textContent='Private URL copied. In Google Calendar, use Other calendars → From URL.';}).catch(()=>{field.focus();field.select();status.textContent='Select and copy the URL above.';});controls.appendChild(copy);
      const revoke=document.createElement('button');revoke.type='button';revoke.className='btn ghost';revoke.textContent='Revoke subscription';revoke.onclick=async()=>{revoke.disabled=true;try{await serverSyncClient.calendarRequest({method:'DELETE'});calendarChoice.subscription=null;renderOptions();status.textContent='Private URL revoked. Remove the old subscription from your calendar app.';}catch(error){status.textContent=error.message;revoke.disabled=false;}};controls.appendChild(revoke);
    }
    if(!serverSyncClient?.sessionSubject()){const signIn=document.createElement('button');signIn.type='button';signIn.className='btn ghost';signIn.textContent='Sign in';signIn.onclick=()=>{dialog.close();openSettings({section:'account'});};controls.appendChild(signIn);}
    refreshCalendarChoiceCounts();
  }
  document.body.appendChild(dialog);renderOptions();dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
}

globalThis.NOTHINGSPORTS_CALENDAR_UI={renderToolbar,showDialog};
})();
