/* The delegated Match Centre range view. Only one Match Centre view owns work. */
(() => {
 'use strict';
 globalThis.createAllSportsView=({active,owner,selectView})=>{
  const model=()=>NOTHINGSPORTS_ALL_SPORTS,match=()=>NOTHINGSPORTS_MATCH_CENTRE;
  const states=new Map(),requested=new Map(),positions=new Map();
  let range='today',revision=0,account=owner(),timer=null,loading=null,polling=null,controller=null,pollController=null,expanded=null,compactPosition=0,chrome=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const state=()=>{if(!states.has(range))states.set(range,{events:[],window:model().windowFor(range),complete:false,notice:'',checked:0,scroll:0});return states.get(range);};
  const valid=(ticket)=>active()&&!document.hidden&&ticket===revision&&account===owner();
  const storageKey=()=>`all-sports:v1:${account}:${range}`;
  const dateLabel=day=>new Intl.DateTimeFormat('en-AU',{timeZone:model().ZONE,weekday:'long',day:'numeric',month:'short'}).format(new Date(model().midnight(day)));
  function remember(){if(chrome?.root.isConnected){for(const t of chrome.body.querySelectorAll('[data-overlap-group]'))positions.set(range+':'+t.dataset.overlapGroup,t.scrollLeft);state().scroll=scrollY;}}
  function stop(){remember();revision++;clearInterval(timer);timer=null;controller?.abort();pollController?.abort();controller=null;pollController=null;loading=null;polling=null;}
  function qualifyCard(slot,item){
   const approximate=item.event.estimatedStartTimeUtc?' · Approximate timing only':'',text=item.underway?(match().liveState(item.event)==='playing'?'Underway':'Ongoing · '+(match().interruption(item.event)?.label||'Awaiting update')):item.tbc?(item.qualified?'May fall within this range':'Start time unavailable')+approximate:'';
   let label=slot.querySelector(':scope > .as-qualifier');if(!text){label?.remove();return;}if(!label){label=el('small',null,'as-qualifier');slot.prepend(label);}label.textContent=text;
  }
  const cardKey=item=>{
   const e=item.event,compact=match().compact(e);
   // Retain every source input, including unknown fields. Compact fills only
   // the defaults added by selected transport; original renderer inputs win.
   // Sport transport uses the canonical key; retain the actual renderer's
   // metadata too, including its label fallback for unrecognised keys.
   const {score,homeScore,awayScore,sets,games,statusCheckedAt,scoreCheckedAt,checkedAt,stale,sourceStale,...facts}={...compact,...e,sport:compact.sport};
   return [facts,sportMetaForEvent(e)];
  };
  const layoutKey=days=>JSON.stringify([range,expanded,days.map(day=>[day.day,day.groups.map(group=>[group.id,group.entries.map(cardKey)]),day.tbc.map(cardKey)])]);
  // Score observations use the shared card updater so an in-flight disclosure
  // press keeps its button and horizontal track. Structural changes still render.
  function patchCards(days,key){
   if(!days.length||chrome.layout!==key)return false;
   const rows=days.flatMap(day=>[...day.groups.flatMap(group=>group.entries),...day.tbc]).map(item=>{const id=match().id(item.event),slot=chrome.body.querySelector(`[data-sports-id="${CSS.escape(id)}"]`);return {item,id,slot,card:slot?.querySelector('.event-card')};});
   // The shared expanded updater skips other statuses, including scheduled.
   if(rows.some(({item,id,slot,card})=>!slot?.isConnected||card?.dataset.cardMode!=='schedule'||card.dataset.cardState!==(expanded===id?'opened':'compact')||expanded!==id&&!card.querySelector('.minimised-card-summary')||expanded===id&&!/^(live|in-progress|in_progress|ongoing|break|stumps|rain-delay|interrupted|suspended)$/.test(item.event.status||'')))return false;
   for(const {item,id,slot,card} of rows){
    profileFixtureEvents.set(String(item.event.eventId||item.event.id),item.event);qualifyCard(slot,item);
    if(expanded===id)installFeedLiveScore(card,item.event);else refreshMinimisedCard(card,item.event);
   }
   return true;
  }
  function makeCard(item){
   const id=match().id(item.event),slot=el('div',null,'as-fixture');slot.dataset.sportsId=id;slot.classList.toggle('as-expanded',expanded===id);
   const card=buildEventCard(item.event,{mode:'schedule',cardState:expanded===id?'opened':'compact',onCardStateChange:()=>{
    const group=slot.closest('.as-track'),prior=group?.scrollLeft||0;
    if(expanded===id){expanded=null;render();const key=group?.dataset.overlapGroup||'',track=chrome.body.querySelector(`[data-overlap-group="${CSS.escape(key)}"]`);positions.set(range+':'+key,compactPosition);if(track)track.scrollLeft=compactPosition;}
    else{compactPosition=prior;expanded=id;render();const next=chrome.body.querySelector(`[data-sports-id="${CSS.escape(id)}"]`);next?.scrollIntoView({block:'nearest',inline:'start'});}
    const target=chrome.body.querySelector(`[data-sports-id="${CSS.escape(id)}"]`);(target?.querySelector('.event-card-disclosure,button')||target)?.focus({preventScroll:true});
   }});
   slot.append(card);
   qualifyCard(slot,item);
   return slot;
  }
  function groupNode(group){
   const section=el('div',null,'as-overlap'),track=el('div',null,'as-track');track.dataset.overlapGroup=group.id;track.classList.toggle('as-multiple',group.entries.length>1);track.setAttribute('role','group');track.setAttribute('aria-label',group.entries.length>1?'Overlapping fixtures':'Fixture');
   group.entries.forEach(item=>track.append(makeCard(item)));section.append(track);
   if(group.entries.length>1){
    const controls=el('div',null,'as-page-controls'),previous=el('button','Previous','btn ghost'),next=el('button','Next','btn ghost'),position=el('span',null,'as-page-position');previous.type=next.type='button';previous.setAttribute('aria-label','Previous overlapping fixtures');next.setAttribute('aria-label','Next overlapping fixtures');position.setAttribute('aria-live','polite');
    const update=()=>{const size=Math.max(1,track.clientWidth),stride=size+12,total=Math.max(1,Math.ceil((track.scrollWidth+12)/stride)),page=Math.min(total,Math.round(track.scrollLeft/stride)+1);position.textContent=`Page ${page} of ${total}`;previous.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft+size>=track.scrollWidth-2;};
    previous.onclick=()=>track.scrollBy({left:-track.clientWidth,behavior:'auto'});next.onclick=()=>track.scrollBy({left:track.clientWidth,behavior:'auto'});
    track.addEventListener('scroll',()=>{positions.set(range+':'+group.id,track.scrollLeft);update();void poll();},{passive:true});controls.append(previous,position,next);section.append(controls);requestAnimationFrame(update);
   }
   requestAnimationFrame(()=>{if(track.isConnected)track.scrollLeft=positions.get(range+':'+group.id)||0;});return section;
  }
  function render(selected=false){
   if(!active())return;
   const host=document.getElementById('listView'),s=state(),mounting=!chrome?.root.isConnected,savedScroll=s.scroll;
   if(!chrome?.root.isConnected){
    const root=el('div',null,'all-sports-view'),heading=el('div',null,'match-centre-heading'),refresh=el('button','Refresh','btn ghost'),views=el('div',null,'mc-membership-tabs'),ranges=el('div',null,'as-range-tabs'),notice=el('p',null,'as-notice'),bounds=el('p',null,'as-window'),body=el('div');
    heading.append(el('h2','All Sports View'),refresh);refresh.type='button';refresh.setAttribute('aria-label','Refresh All Sports View');refresh.onclick=()=>void load(true);
    views.setAttribute('role','tablist');views.setAttribute('aria-label','Match Centre fixtures');for(const [view,label] of [['followed','Followed'],['everything','Everything'],['all-sports','All Sports']]){const b=el('button',label,'btn ghost');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(view==='all-sports'));b.onclick=()=>{if(view!=='all-sports')selectView(view);};views.append(b);}
    ranges.setAttribute('role','tablist');ranges.setAttribute('aria-label','Fixture time range');for(const [value,label] of [['today','Today'],['24','+24 hours'],['48','+48 hours']]){const b=el('button',label,'btn ghost');b.type='button';b.dataset.range=value;b.setAttribute('role','tab');b.onclick=()=>{if(value===range)return;stop();range=value;expanded=null;chrome.body.replaceChildren();render();scrollTo({top:state().scroll,behavior:'auto'});start();};ranges.append(b);}
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');root.append(heading,views,ranges,bounds,notice,body);host.className='match-centre';host.replaceChildren(root);chrome={root,refresh,ranges,bounds,notice,body,restoringScroll:true};
   }
   chrome.ranges.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.range===range)));
   chrome.refresh.disabled=Boolean(loading);
   chrome.notice.textContent=loading?`Loading fixtures${s.total!=null?' · '+s.events.length+' of '+s.total:''}…` :s.notice||(!s.complete?'Schedule incomplete. Refresh to retry.':'');
   const clock=new Intl.DateTimeFormat('en-AU',{timeZone:model().ZONE,day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
   chrome.bounds.textContent=`${clock.format(new Date(s.window.asOf))} – ${clock.format(new Date(s.window.end))} · Sydney time`;
   const anchor=[...chrome.body.querySelectorAll('[data-sports-id]')].find(n=>{const r=n.getBoundingClientRect();return r.bottom>stickyFeedChromeHeight()+12&&r.left<innerWidth&&r.right>0;});
   const id=anchor?.dataset.sportsId,before=anchor?.getBoundingClientRect().top,focus=document.activeElement,focusSlot=focus?.closest('[data-sports-id]'),focusIndex=focusSlot?[...focusSlot.querySelectorAll('button,a,input,select,textarea')].indexOf(focus):-1;
   if(chrome.range===range&&!chrome.restoringScroll)remember();chrome.range=range;
   const days=model().groups(model().select(s.events,s.window),s.window),key=layoutKey(days),patched=selected&&patchCards(days,key),children=[];
   if(!patched)for(const day of days){
    const section=el('section',null,'as-date');section.append(el('h3',dateLabel(day.day)));
    day.groups.forEach(group=>section.append(groupNode(group)));
    if(day.tbc.length){const unknown=el('section',null,'as-tbc');unknown.append(el('h4','Time TBC'));day.tbc.forEach(item=>unknown.append(makeCard(item)));section.append(unknown);}
    children.push(section);
   }
   if(!patched){if(!children.length&&!loading)children.push(el('p',s.complete?'No known fixtures in this range.':'No published fixtures loaded yet. Refresh to retry.'));chrome.body.replaceChildren(...children);chrome.layout=key;}
   if(mounting){const mounted=chrome;requestAnimationFrame(()=>{if(mounted===chrome&&mounted.root.isConnected){scrollTo({top:savedScroll,behavior:'auto'});mounted.restoringScroll=false;}});}
   if(id){const next=chrome.body.querySelector(`[data-sports-id="${CSS.escape(id)}"]`);if(next)scrollBy({top:next.getBoundingClientRect().top-before,behavior:'auto'});}
   if(focusSlot&&focusIndex>=0)chrome.body.querySelector(`[data-sports-id="${CSS.escape(focusSlot.dataset.sportsId)}"]`)?.querySelectorAll('button,a,input,select,textarea')[focusIndex]?.focus({preventScroll:true});
  }
  async function restore(){
   const t=revision,s=state();if(s.restored||!disposableStore?.hydrate)return;s.restored=true;
   const cached=await disposableStore.hydrate(storageKey(),null);if(!valid(t)||s.events.length||!Array.isArray(cached?.events))return;
   s.events=cached.events.filter(model().supported).map(e=>({...e,stale:true}));s.notice='Showing the last available published schedule. Checking current updates…';render();
  }
  async function load(force=false){
   if(!active()||document.hidden||loading)return loading;
   const s=state();if(!force&&Date.now()-s.checked<120000)return;
   const t=revision;s.window=model().windowFor(range);s.complete=false;s.total=null;
   const abort=new AbortController();controller=abort;
   let operation;operation=(async()=>{
    const retained=s.events;let events=[],cursor=0,revisionKey=null,stale=false;
    try{
     do{
      if(!valid(t))return;
      const q=new URLSearchParams({view:'all-sports',membership:'everything',range,limit:'50',cursor:String(cursor),...(cursor?{asOf:String(s.window.asOf),revision:revisionKey}:{})});
      const response=await fetch('/api/match-centre?'+q,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])});if(!response.ok)throw Error('Schedule unavailable');const data=await response.json();
      if(!valid(t))return;
      const p=data.pagination,w=data.window;
      if(data.enabled!==true||data.schemaVersion!=='all-sports.v1'||!Array.isArray(data.events)||data.events.some(e=>!e||!match().id(e)||!model().supported(e))||!w||w.range!==range||!Number.isSafeInteger(w.asOf)||w.end!==model().windowFor(range,w.asOf).end||!p||p.cursor!==cursor||!Number.isSafeInteger(p.total)||p.total<0||typeof data.revision!=='string'||p.nextCursor!==null&&(!Number.isSafeInteger(p.nextCursor)||p.nextCursor<=cursor||p.nextCursor>=p.total)||cursor&&(data.revision!==revisionKey||w.asOf!==s.window.asOf))throw Error('Invalid schedule page');
      if(!cursor){s.window=w;revisionKey=data.revision;s.total=p.total;}else if(s.total!==p.total)throw Error('Schedule changed');
      events.push(...data.events);stale||=data.membershipStale===true;
      if(new Set(events.map(match().id)).size!==events.length||events.length>p.total||p.nextCursor!==null&&events.length!==p.nextCursor)throw Error('Incomplete schedule page');
      s.events=[...new Map([...retained,...events].map(e=>[match().id(e),e])).values()].map(e=>stale?{...e,stale:true}:e);
      cursor=p.nextCursor;render();
     }while(cursor!==null);
     if(events.length!==s.total)throw Error('Incomplete schedule');
     s.events=stale?s.events:events;s.complete=true;s.checked=Date.now();s.notice=stale?'Published schedule loaded. Current updates are unavailable; showing last available fixture information.':'';
     if(!stale&&valid(t)&&disposableStore?.set){disposableStore.set(storageKey(),{events:s.events},{ttlMs:7*86400000});void disposableStore.flush?.();}
    }catch(error){if(valid(t)){s.events=s.events.map(e=>({...e,stale:true}));s.complete=false;s.checked=Date.now();s.notice='Schedule incomplete. Showing available fixtures. Refresh to retry.';}}
    finally{if(loading===operation){loading=null;controller=null;if(valid(t)){render();void poll();}}}
   })();loading=operation;render();return operation;
  }
  async function poll(){
   if(!active()||document.hidden||polling)return;
   const s=state(),now=Date.now(),visible=new Set([...chrome?.body.querySelectorAll('[data-sports-id]')||[]].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;}).map(n=>n.dataset.sportsId));
   const selected=s.events.filter(e=>visible.has(match().id(e))&&now-(requested.get(match().id(e))||0)>=match().interval(e,now)).slice(0,60);if(!selected.length)return;
   const ids=selected.map(match().id),t=revision;ids.forEach(id=>requested.set(id,now));
   const abort=new AbortController();pollController=abort;
   let operation;operation=(async()=>{try{
    const response=await fetch('/api/match-centre?view=all-sports&ids='+encodeURIComponent(ids.join(',')),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(5000)])});if(!response.ok)throw Error();const data=await response.json();if(!valid(t))return;
    if(data.enabled!==true||!Array.isArray(data.fixtures)||!Array.isArray(data.events))throw Error();
    const byId=new Map(data.events.filter(e=>ids.includes(match().id(e))).map(e=>[match().id(e),e])),scores=new Map(data.fixtures.filter(e=>ids.includes(e.id)).map(e=>[e.id,e]));
    s.events=s.events.map(e=>{const id=match().id(e);if(!ids.includes(id))return e;const current=byId.get(id)||e,snapshot=scores.get(id);return snapshot?{...current,...match().observation(match().compact(current),snapshot),id:e.id,eventId:e.eventId,canonicalEventId:e.canonicalEventId}:{...e,stale:true};});render(true);
   }catch{if(valid(t)){s.events=s.events.map(e=>ids.includes(match().id(e))?{...e,stale:true}:e);s.notice='Current scores are unavailable. Showing last available fixture information.';render(true);}}
   finally{if(polling===operation){polling=null;pollController=null;}}})();polling=operation;return operation;
  }
  function start(){
   if(account!==owner()){stop();account=owner();states.clear();positions.clear();requested.clear();expanded=null;chrome=null;}
   render();if(document.hidden)return;const t=revision;void restore().then(()=>{if(valid(t))return load();}).catch(()=>{if(valid(t))void load();});clearInterval(timer);timer=setInterval(()=>{if(!active()){stop();return;}if(!document.hidden){void load();void poll();}},15000);void poll();
  }
  function visibility(){if(document.hidden){stop();}else if(active()){state().checked=0;start();}}
  return {start,stop,render,visibility};
 };
})();
