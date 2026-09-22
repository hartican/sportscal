// Loaded only when the viewer opens Feed filters.
globalThis.openFeedViewFilter=()=>{
 const dialog=document.createElement('dialog');dialog.className='calendar-dialog';dialog.setAttribute('aria-label','Filter Feed');
 const title=document.createElement('h2');title.textContent='Filter Feed';dialog.append(title);
 const makeSelect=(label,values,selected)=>{const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('select');for(const [value,text]of values){const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}input.value=String(selected);wrap.append(input);dialog.append(wrap);return input;};
 const sport=makeSelect('Sport',feedFilterOptions().map(key=>[key,feedFilterDisplayMetadata(key).label]),feedViewFilters.sport);
 const rating=makeSelect('Rating',[[0,'All ratings'],[4,'4+ flames'],[5,'5 flames']],feedViewFilters.minimum);
 const tip=document.createElement('p');tip.textContent='Your highest rating comes first. If you haven’t rated an event, we use other Nothingers’ average.';dialog.append(tip);
 const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
 const apply=document.createElement('button');apply.className='btn primary';apply.textContent='Apply';
 apply.onclick=async()=>{apply.disabled=true;status.textContent='Loading your Feed…';try{
  while((serverPersistence.user&&serverFeedNextCursor!==null)||publicFeedManifest?.pages?.[publicFeedNextPageIndex]){if(!await loadNextFeedPage())throw new Error('Couldn’t load all Feed cards. Try again.');}
  if(Number(rating.value)){const context=buildFollowEligibilityContext(),ids=activeEvents.filter(e=>eventFollowReason(e,context)).map(nothingscoreEventId);for(let i=0;i<ids.length;i+=50)await loadNothingscoreBatch(ids.slice(i,i+50),{rerender:false});}
  feedViewFilters={sport:sport.value,minimum:Number(rating.value)};feedFilterHydratedKey=`${serverSyncClient?.sessionSubject()||'public'}|${feedViewFilters.sport}|${feedViewFilters.minimum}`;localStorage.setItem('ns-feed-view-filter-v1',JSON.stringify(feedViewFilters));dialog.close();renderAll({preserveViewport:true});
 }catch(e){status.textContent=e.message;}finally{apply.disabled=false;}};
 const clear=document.createElement('button');clear.className='btn ghost';clear.textContent='Clear filters';clear.onclick=()=>{sport.value='all';rating.value='0';feedViewFilters={sport:'all',minimum:0};localStorage.removeItem('ns-feed-view-filter-v1');dialog.close();renderAll({preserveViewport:true});};
 const close=document.createElement('button');close.className='btn ghost';close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(apply,clear,close);dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('feedViewFilterBtn').focus();},{once:true});document.body.append(dialog);dialog.showModal();
};
