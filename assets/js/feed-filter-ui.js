// Loaded only when the viewer opens Feed filters.
globalThis.openFeedViewFilter=()=>{
 const dialog=document.createElement('dialog');dialog.className='calendar-dialog';dialog.setAttribute('aria-label','Filter Feed');
 const title=document.createElement('h2');title.textContent='Filter Feed';dialog.append(title);
 const makeSelect=(label,values,selected)=>{const wrap=document.createElement('label');wrap.textContent=label;wrap.style.cssText='display:grid;gap:6px;margin-bottom:12px';const input=document.createElement('select');input.setAttribute('aria-label',label);input.style.minHeight='44px';for(const [value,text]of values){const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}input.value=String(selected);wrap.append(input);dialog.append(wrap);return input;};
 const sport=makeSelect('Sport',feedFilterOptions().map(key=>[key,feedFilterDisplayMetadata(key).label]),feedViewFilters.sport);
 const rating=makeSelect('Rating',[[0,'All ratings'],[4,'4+ stakes'],[5,'5 stakes']],feedViewFilters.minimum);
 const tip=document.createElement('p');tip.textContent='Your highest rating comes first. If you haven’t rated an event, we use other Nothingers’ average.';dialog.append(tip);
 const apply=document.createElement('button');apply.className='btn primary';apply.textContent='Apply';
 apply.onclick=()=>{feedViewFilters={sport:sport.value,minimum:Number(rating.value)};feedFilterHydratedKey='';feedFilterError='';localStorage.setItem('ns-feed-view-filter-v1',JSON.stringify(feedViewFilters));dialog.close();renderAll({preserveViewport:true});};
 const clear=document.createElement('button');clear.className='btn ghost';clear.textContent='Clear filters';clear.onclick=()=>{sport.value='all';rating.value='0';feedViewFilters={sport:'all',minimum:0};localStorage.removeItem('ns-feed-view-filter-v1');dialog.close();renderAll({preserveViewport:true});};
 const close=document.createElement('button');close.className='btn ghost';close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(apply,clear,close);dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('feedViewFilterBtn').focus();},{once:true});document.body.append(dialog);dialog.showModal();
};

// Optional pagination and ratings run after Apply; stale filter/account jobs stop.
globalThis.hydrateFeedViewFilter=async({key,generation,filter})=>{
 const current=()=>key===feedFilterKey()&&generation===feedViewGeneration&&activeTab==='feed';
 await loadAllFeedPages(current);
 if(filter.minimum&&current()){
  const context=buildFollowEligibilityContext(),ids=[...new Set(activeEvents.filter(e=>eventFollowReason(e,context)&&(filter.sport==='all'||feedFilterMatchesEvent(filter.sport,e))).map(nothingscoreEventId))];
  for(let i=0;i<ids.length&&current();i+=50)await loadNothingscoreBatch(ids.slice(i,i+50),{rerender:false});
 }
 if(!current()&&key===feedFilterKey())feedFilterHydratedKey='';
};

globalThis.renderFeedFilterStatus=container=>{if(activeTab==='feed'&&(feedViewFilters.sport!=='all'||feedViewFilters.minimum)&&(feedFilterHydration||feedFilterError)){const notice=document.createElement('p');notice.setAttribute('role','status');notice.dataset.feedFilterStatus='';notice.textContent=feedFilterError||'Showing available matches while more cards and ratings load…';if(feedFilterError){const retry=document.createElement('button');retry.className='btn ghost';retry.textContent='Retry';retry.onclick=()=>{feedFilterHydratedKey='';renderAll({preserveViewport:true});};notice.append(retry);}container.append(notice);}};
