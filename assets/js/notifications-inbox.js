(function(root){
 'use strict';
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 function copy(item,spoilers){
  const actor=item.actor||'A Nothinger',room=item.roomName||'chat',bonus=item.points?` · +${item.points} point${item.points===1?'':'s'}`:'';
  switch(item.kind){
   case 'chat':return {title:item.messageCount>1?`${item.messageCount} new messages in ${room}`:`${item.sender||actor} sent a message in ${room}`,detail:spoilers&&item.preview?`${item.sender||actor}: ${item.preview.slice(0,140)}`:'Open chat to read.'};
   case 'invitation':return {title:`${actor} invited you to ${room}`,detail:'Open to review your invitation.'};
   case 'added':return {title:`${actor} added you to ${room}`,detail:'Open the conversation.'};
   case 'profile_followed':return {title:`${actor} followed you${bonus}`,detail:'View their profile and sporting follows.'};
   case 'follows_copied':return {title:`${actor} copied your follows${bonus}`,detail:'Your sporting picks helped someone find what to watch.'};
   case 'points':return {title:`You earned ${item.points} point${item.points===1?'':'s'}`,detail:({heat_rating:'You rated the build-up.',pulse_rating:'You rated the live action.',impact_rating:'You rated the impact.',foresight_bonus:'Your prediction matched another fan’s rating.',follow_person:'You followed someone new.'})[item.detail]||'View your points and rewards.'};
   case 'rating':return {title:`${actor} gave an event 5 flames`,detail:`${({heat:'Heat',pulse:'Live',impact:'Impact'})[item.phase]||'Rating'} · open their pick.`};
   case 'reminder':return {title:item.title||'Your sporting reminder',detail:'It’s nearly time. See event details.'};
   default:return {title:item.title||'Nothing Sport update',detail:item.detail||'Open for details.'};
  }
 }
 function relative(at){const mins=Math.max(0,Math.floor((Date.now()-Date.parse(at))/60000));return mins<1?'Just now':mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:new Date(at).toLocaleDateString('en-AU',{day:'numeric',month:'short'});}
 function create({request,owner,spoilers,navigate,closeDestination,signIn}){
  const trigger=document.getElementById('notificationsBtn'),badge=document.getElementById('notificationCount');
  const dialog=node('dialog',null,'notifications-sheet');dialog.id='notificationsInbox';dialog.setAttribute('aria-labelledby','notificationsTitle');
  const head=node('div',null,'notifications-head'),title=node('h2','Notifications');title.id='notificationsTitle';
  const close=node('button','×','notifications-close');close.type='button';close.setAttribute('aria-label','Close notifications');head.append(title,close);
  const body=node('div',null,'notifications-body'),status=node('p',null,'notifications-status');status.setAttribute('role','status');dialog.append(head,body,status);document.body.append(dialog);
  let account='',items=[],cursor=null,count=0,generation=0,timer=null,busy=false,opened=false,position=0,readTimer=null,refreshTimer=null,lastFetch=0,loadError=false;
  const pending=new Map(),seen=new Set();
  const observer=new IntersectionObserver(entries=>{if(!opened||document.hidden)return;for(const e of entries)if(e.isIntersecting){const item=items.find(x=>x.id===e.target.dataset.id);if(item&&!item.read)pending.set(item.id,{id:item.id,version:item.version});}clearTimeout(readTimer);readTimer=setTimeout(markVisible,250);},{root:body,threshold:.5});
  function updateBadge(){badge.textContent=count>99?'99+':String(count);badge.hidden=!count;trigger.setAttribute('aria-label',count?`Notifications, ${count} unread`:'Notifications');}
  function reset(){const next=owner()||'';if(account&&account!==next)closeDestination();generation++;account=next;items=[];cursor=null;count=0;position=0;busy=false;pending.clear();seen.clear();updateBadge();if(opened)render();}
  async function markVisible(){
   if(!opened||document.hidden||!account||!pending.size)return;
   const batch=[...pending.values()].slice(0,25);for(const entry of batch)pending.delete(entry.id);const who=account;
   try{await request({},batch);if(who!==account)return;
    for(const value of batch){seen.add(`${value.id}:${value.version}`);const item=items.find(x=>x.id===value.id&&x.version===value.version);if(item&&!item.read){item.read=true;count=Math.max(0,count-1);body.querySelector(`[data-id="${item.id}"]`)?.classList.remove('is-unread');}}updateBadge();if(pending.size)await markVisible();
   }catch{if(who===account){status.textContent='Could not save read status. Reopen to retry.';}}
  }
  function render(){
   observer.disconnect();body.replaceChildren();status.textContent='';
   if(!account){body.append(node('p','Sign in to see messages, followers, points and sporting reminders.','notifications-empty'));const b=node('button','Sign in','btn primary');b.onclick=()=>{dismiss();signIn();};body.append(b);return;}
   if(!items.length)body.append(node('p',busy?'Loading notifications…':'You’re all caught up. New activity will appear here.','notifications-empty'));
   for(const item of items){
    const row=node('button',null,`notification-row${item.read?'':' is-unread'}`);row.type='button';row.dataset.id=item.id;
    const glyph=node('span',({chat:'↗',invitation:'+',added:'+',profile_followed:'+',follows_copied:'+',points:'★',rating:'★',reminder:'◷'})[item.kind]||'•','notification-glyph');glyph.setAttribute('aria-hidden','true');
    const text=node('span',null,'notification-copy'),words=copy(item,spoilers());text.append(node('strong',words.title),node('span',words.detail));const time=node('time',relative(item.at));time.dateTime=item.at;time.title=new Date(item.at).toLocaleString('en-AU');text.append(time);row.append(glyph,text);row.onclick=()=>void activate(item);body.append(row);observer.observe(row);
   }
   if(cursor){const more=node('button','Load older notifications','btn ghost');more.onclick=()=>void refresh(true);body.append(more);}
   body.scrollTop=position;
  }
  async function refresh(older=false){
   if((owner()||'')!==account)reset();
   if(!account||busy||document.hidden||navigator.onLine===false)return;
   busy=true;loadError=false;lastFetch=Date.now();const ticket=generation,who=account;
   if(opened&&!items.length)render();
   try{
    let deadline;const data=await Promise.race([request({cursor:older?cursor:'',summary:!opened}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Notification request timed out')),10000);})]).finally(()=>clearTimeout(deadline));if(ticket!==generation||who!==owner())return;
    count=data.unreadCount;updateBadge();
    if(opened){position=body.scrollTop;
     const fresh=data.items||[];
     // Refresh the head without dropping previously loaded history.
     const edge=fresh.at(-1),retained=older?items:edge?items.filter(x=>x.at<edge.at||(x.at===edge.at&&x.id<edge.id)):[];
     const map=new Map(retained.map(x=>[x.id,x]));for(const item of fresh)map.set(item.id,item);
     items=[...map.values()].sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id));
     if(older||!cursor||items.length<=25)cursor=data.nextCursor;
     render();
    }
   }catch(error){console.warn('Inbox refresh failed',error);if(ticket===generation&&opened){loadError=true;status.textContent='Couldn’t load notifications. ';body.querySelector('.notifications-empty')?.remove();const retry=node('button','Try again','btn ghost');retry.onclick=()=>void refresh(older);status.append(retry);}}
   finally{if(ticket===generation){busy=false;if(opened&&!items.length&&!loadError)render();clearTimeout(timer);if(opened&&!document.hidden)timer=setTimeout(refresh,30000);}}
  }
  function show(push=true){
   if((owner()||'')!==account)reset();
   if(opened)return;generation++;busy=false;opened=true;if(push)history.pushState({appRoute:'notifications',inbox:true},'');
   render();dialog.showModal();body.scrollTop=position;trigger.setAttribute('aria-expanded','true');document.body.classList.add('notifications-open');close.focus();void refresh();
  }
  function hide(){generation++;busy=false;opened=false;position=body.scrollTop;observer.disconnect();clearTimeout(timer);clearTimeout(readTimer);pending.clear();dialog.close();document.body.classList.remove('notifications-open');trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});}
  function dismiss(){hide();if(history.state?.inbox)history.back();}
  async function activate(item){
   const who=account;
   pending.set(item.id,{id:item.id,version:item.version});await markVisible();
   if(who!==owner()||who!==account)return;
   if(item.available===false){status.textContent='This message is no longer available.';return;}
   hide();try{await navigate(item);if(who!==owner()){closeDestination();return;}if(history.state?.inbox)history.pushState({inboxDestination:true},'');else history.replaceState({...history.state,inbox:false,inboxDestination:true},'');}
   catch(error){closeDestination();show(false);status.textContent=error.message||'This activity is no longer available.';}
  }
  close.onclick=dismiss;dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});dialog.addEventListener('click',e=>{if(e.target===dialog)dismiss();});trigger.onclick=()=>show();
  addEventListener('popstate',()=>{if(history.state?.appRoute==='notifications'&&history.state?.inbox){closeDestination();show(false);}else if(opened)hide();});
  function invalidate(){if((owner()||'')!==account){reset();lastFetch=0;}clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh(),Math.max(350,30000-(Date.now()-lastFetch)));}
  addEventListener('ns-account-change',invalidate);addEventListener('ns-activity-change',invalidate);addEventListener('focus',invalidate);addEventListener('online',invalidate);
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)invalidate();});
  // No periodic request when closed. Startup resolves account asynchronously.
  reset();void refresh();
  return {show,refresh,reset,copy};
 }
 root.NOTHINGSPORTS_INBOX={create,copy};
 if(typeof module!=='undefined')module.exports={copy};
})(typeof window==='undefined'?globalThis:window);
