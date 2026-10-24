(function(root){
 'use strict';
 const policy=root.NOTHINGSPORTS_PUBLIC_COMMENTS;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,run)=>{const b=node('button',text,'btn ghost');b.type='button';b.onclick=e=>{e.stopPropagation();run();};return b;};
 let active=null,generation=0;
 function registered(){const owner=serverSyncClient.sessionSubject(),user=typeof serverPersistence==='undefined'?null:serverPersistence.user;return!!(owner&&user?.id===owner&&user.isAnonymous!==true&&user.is_anonymous!==true);}
 const defaultClient={owner:()=>serverSyncClient.sessionSubject()||'',registered,active:()=>activeTab==='feed',signIn:()=>openSettings({section:'account'}),
  request:(eventId,q={},command=null,signal)=>serverSyncClient.chatRequest({mode:'public-comments',roomId:eventId,after:q.after===undefined?'':String(q.after),before:q.cursor||'',q:q.parentId||''},command?{...command,eventId,action:'public-comment-'+command.action}:null,{signal}),
  gifs:()=>serverSyncClient.chatRequest({mode:'gif-config'}),load:src=>loadDeferredScript(src),profile:host=>renderChatPublicProfileForm(host,{onSaved:()=>{host.replaceChildren();}})};
 function styles(){if(document.getElementById('public-comments-styles'))return;const s=node('style');s.id='public-comments-styles';s.textContent='.public-comments{border-top:1px solid var(--border);margin-top:16px;padding-top:14px;overflow-wrap:anywhere}.public-comments h3{margin:0 0 12px}.public-comment{padding:12px 0;border-bottom:1px solid var(--border)}.public-comment header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.public-comment time,.public-comments-status{font-size:.8rem;color:var(--text-dim)}.public-comment p{white-space:pre-wrap;line-height:1.5;margin:8px 0}.public-comment img{display:block;max-width:min(100%,280px);height:auto;max-height:260px;object-fit:contain}.public-comment-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.public-comment-actions button{min-width:44px;min-height:44px}.public-comment-replies{margin-left:16px;padding-left:12px;border-left:2px solid var(--border)}.public-comment-composer textarea{width:100%;min-height:78px;box-sizing:border-box;background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px;font:inherit}.public-comment-composer{margin-top:14px}.public-comment-gifs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.public-comment-gifs button{padding:2px;min-height:44px}.public-comment-gifs img{width:100%;height:90px;object-fit:contain}.public-comments [aria-pressed=true]{color:var(--accent);border-color:var(--accent)}';document.head.append(s);}
 function reset(){generation++;if(active){active.dispose();active=null;}}
 function mount(card,event,client=defaultClient){
  if(!client.registered()){client.signIn();return null;}
  if(active?.card===card){reset();return null;}reset();styles();
  const owner=client.owner(),token=generation,eventId=event.eventId||event.id,host=node('section',undefined,'public-comments'),heading=node('h3','Public comments'),status=node('p','Loading comments…','public-comments-status'),list=node('div'),more=button('Load more comments',()=>void loadPage());
  host.setAttribute('aria-label','Public fixture discussion');status.setAttribute('role','status');more.hidden=true;
  const close=button('Close comments',reset);host.append(heading,close,status,list,more);card.append(host);
  const form=node('form',undefined,'public-comment-composer'),replyTo=node('p','','public-comments-status'),input=node('textarea');input.setAttribute('aria-label','Write a public comment');input.placeholder='Leave a comment…';input.maxLength=1000;
  const preview=node('div'),actions=node('div',undefined,'public-comment-actions'),submit=node('button','Post comment','btn primary');submit.type='submit';
  let chosenGif=null,parentId=null,clientId=null,cursor=null,revision=0,lastChange=Date.now(),timer=null,busy=false,disposed=false,visible=true,abort=null,sendPending=false,halted=false,gifController=null,backoff=false,baseline=false;
  const entries=new Map(),nodes=new Map(),replyCursors=new Map(),versions=new Map();
  const current=()=>!disposed&&!halted&&token===generation&&owner===client.owner()&&client.registered()&&host.isConnected;
  const shown=()=>current()&&!halted&&!document.hidden&&client.active()&&visible;
  const report=e=>{if(!current())return;backoff=true;status.textContent=e?.message||'Comments are temporarily unavailable.';if(['public_comments_retired','public_comment_account_unavailable','account_erasure_in_progress','account_required'].includes(e?.code)||e?.status===401){halted=true;stop();gifController?.closePicker();gifController=null;entries.clear();nodes.clear();versions.clear();replyCursors.clear();input.value='';chosenGif=null;parentId=null;clientId=null;preview.replaceChildren();list.replaceChildren();form.remove();more.hidden=true;}};
  function stop(){clearTimeout(timer);timer=null;abort?.abort();abort=null;}
  function schedule(){clearTimeout(timer);if(shown())timer=setTimeout(()=>void poll(),backoff?policy.POLLING.failure:policy.pollDelay(lastChange));}
  function render(){
   if(!current())return;const scroller=client.scrollContainer,viewportTop=scroller?.getBoundingClientRect().top||0,anchor=[...list.querySelectorAll('[data-comment]')].find(n=>n.getBoundingClientRect().bottom>viewportTop),top=anchor?.getBoundingClientRect().top,focused=document.activeElement;
   function make(entry){
    let view=nodes.get(entry.id);if(!view){
     const row=node('article',undefined,'public-comment');row.dataset.comment=entry.id;
     const head=node('header'),handle=node('strong'),time=node('time'),body=node('p'),media=node('div'),controls=node('div',undefined,'public-comment-actions'),score=node('span');
     const up=button('↑',()=>void mutate({action:'vote',id:entry.id,value:entries.get(entry.id)?.myVote===1?0:1})),down=button('↓',()=>void mutate({action:'vote',id:entry.id,value:entries.get(entry.id)?.myVote===-1?0:-1}));up.setAttribute('aria-label','Upvote comment');down.setAttribute('aria-label','Downvote comment');score.setAttribute('aria-label','Comment score');
     const reply=button('Reply',()=>{parentId=entry.parentId||entry.id;clientId=null;replyTo.textContent='Replying to '+(entries.get(entry.id)?.handle||'comment');input.focus();}),remove=button('Delete',()=>void mutate({action:'delete',id:entry.id})),children=node('div',undefined,'public-comment-replies'),older=button('View more replies',()=>void loadPage(entry.id));
     head.append(handle,time);controls.append(up,score,down,reply,remove,older);row.append(head,body,media,controls,children);view={row,handle,time,body,media,up,down,score,reply,remove,children,older};nodes.set(entry.id,view);
    }
    view.handle.textContent=entry.deleted?'Deleted comment':entry.handle||'Unavailable account';view.body.textContent=entry.body||'';view.time.textContent=new Date(entry.createdAt).toLocaleString('en-AU');view.time.dateTime=entry.createdAt;
    view.score.textContent=String(entry.score||0);view.up.setAttribute('aria-pressed',String(entry.myVote===1));view.down.setAttribute('aria-pressed',String(entry.myVote===-1));view.up.disabled=view.down.disabled=!!entry.deleted||sendPending;view.reply.hidden=!!entry.deleted;view.remove.hidden=!entry.own||!!entry.deleted;view.remove.disabled=sendPending;
    if(entry.gif&&!entry.deleted){const url=root.NOTHINGSPORTS_CHAT_MEDIA_UI?.trustedGiphyUrl(entry.gif.contentUrl);if(url&&view.media.dataset.url!==url){view.media.replaceChildren();const img=node('img');img.src=url;img.alt=entry.gif.title||'GIF';img.loading='lazy';view.media.append(img);view.media.dataset.url=url;}}
    else{view.media.replaceChildren();delete view.media.dataset.url;}
    const replies=[...entries.values()].filter(r=>r.parentId===entry.id).sort(policy.compare);reconcile(view.children,replies.map(r=>make(r)));
    view.older.hidden=!!entry.parentId||!((entry.replyCount||0)>replies.length||replyCursors.get(entry.id));return view.row;
   }
   reconcile(list,[...entries.values()].filter(e=>!e.parentId).sort(policy.compare).map(e=>make(e)));more.hidden=!cursor;
   if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});if(anchor?.isConnected&&top!==undefined){const delta=anchor.getBoundingClientRect().top-top;if(delta){if(scroller)scroller.scrollTop+=delta;else root.scrollBy?.(0,delta);}}
  }
  function reconcile(container,children){const keep=new Set(children);for(const child of [...container.children])if(!keep.has(child))child.remove();children.forEach((child,i)=>{if(container.children[i]!==child)container.insertBefore(child,container.children[i]||null);});}
  function accept(data,{delta=false,write=false}={}){if(!current())return;for(const entry of [...(data.comments||[]),...(data.comment?[data.comment]:[])]){const version=Number(entry.revision||0);if(write&&(!baseline||!entries.has(entry.id)&&version<=revision))continue;if(version<(versions.get(entry.id)||0))continue;versions.set(entry.id,version);if(entry.removed){entries.delete(entry.id);nodes.get(entry.id)?.row.remove();nodes.delete(entry.id);}else entries.set(entry.id,entry);}if(delta)revision=Math.max(revision,Number(data.revision||0));render();}
  async function loadPage(parent){
   if(!shown()||busy)return;const initial=!baseline&&!parent&&!cursor;busy=true;const controller=new AbortController();abort=controller;
   try{const data=await client.request(eventId,{...(parent?{parentId:parent,cursor:replyCursors.get(parent)}:{cursor})},null,controller.signal);if(!current())return;
    if(initial){revision=Number(data.revision||0);baseline=true;}backoff=false;if(parent)replyCursors.set(parent,data.nextCursor||null);else cursor=data.nextCursor||null;accept(data);status.textContent=entries.size?'':'No comments yet. Start the conversation.';
   }catch(e){if(e.code==='public_comment_cursor_changed'&&current()){cursor=null;if(parent)replyCursors.delete(parent);status.textContent='Comments changed. Tap Load more to refresh their order.';more.hidden=false;}else if(e.name!=='AbortError')report(e);}
   finally{if(current()){busy=false;abort=null;schedule();}}
  }
  async function poll(){
   if(!shown()){stop();return;}if(busy){schedule();return;}if(!baseline)return void loadPage();busy=true;const controller=new AbortController();abort=controller;
   try{const data=await client.request(eventId,{after:revision},null,controller.signal);if(!current())return;backoff=false;if(data.comments?.length)lastChange=Date.now();accept(data,{delta:true});status.textContent='';}
   catch(e){if(e.name!=='AbortError')report(e);}
   finally{if(current()){busy=false;abort=null;schedule();}}
  }
  async function mutate(command){
   if(!current()||halted||sendPending)return;sendPending=true;submit.disabled=true;render();
   try{const data=await client.request(eventId,{},command);if(!current())return;accept(data,{write:true});lastChange=Date.now();status.textContent='';if(command.action==='post'&&command.gif)gifController?.notifyGifSent([{providerAnalytics:command.gif.analytics}]);if(command.action==='post'&&command.clientId===clientId){input.value='';chosenGif=null;parentId=null;clientId=null;preview.replaceChildren();replyTo.textContent='';}void poll();}
   catch(e){report(e);if(e.code==='public_comment_handle_required'&&current()){const profile=node('div');host.append(profile);client.profile(profile);}}
   finally{if(current()){sendPending=false;submit.disabled=false;render();}}
  }
  async function gifs(){
   if(!current())return;try{const config=await client.gifs();if(!current())return;await Promise.all([client.load('config/chat-media.js?v=218'),client.load('config/chat-media-ui.js?v=304')]);if(!current())return;
    gifController?.closePicker();gifController=root.NOTHINGSPORTS_CHAT_MEDIA_UI.install({media:root.NOTHINGSPORTS_CHAT_MEDIA,pickerHost:host.closest('dialog')||document.body,state:()=>({capabilities:config.capabilities,pendingAttachments:[]}),request:async()=>config,isCurrent:current,returnFocus:()=>input.focus({preventScroll:true}),connection:message=>report(Error(message)),onGifSelected:gif=>{if(!current())return;chosenGif=gif;clientId=null;preview.replaceChildren();const img=node('img');img.src=gif.previewUrl;img.alt=gif.title;img.style.maxHeight='100px';preview.append(img,button('Remove GIF',()=>{chosenGif=null;clientId=null;preview.replaceChildren();}));}});
    await gifController.stylesReady;if(current())await gifController.openPicker();
   }catch(e){report(e);}
  }
  actions.append(button('GIF',()=>void gifs()),button('Cancel reply',()=>{parentId=null;clientId=null;replyTo.textContent='';}),submit);form.append(replyTo,input,preview,actions);host.append(form);
  input.oninput=()=>{clientId=null;};form.onsubmit=e=>{e.preventDefault();try{const body=policy.text(input.value);if(!body&&!chosenGif)return;clientId ||= crypto.randomUUID();void mutate({action:'post',clientId,body,...(parentId?{parentId}:{}),...(chosenGif?{gif:chosenGif}:{})});}catch(e){report(e);}};
  const visibility=()=>{stop();if(shown())void poll();};document.addEventListener('visibilitychange',visibility);
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(records=>{visible=records.some(r=>r.isIntersecting);visibility();}):null;observer?.observe(host);
  active={card,host,dispose(){disposed=true;stop();gifController?.closePicker();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);host.remove();}};
  void loadPage();return active;
 }
 root.addEventListener('ns-account-change',()=>{reset();if(typeof notificationDestinationDialog!=='undefined'&&notificationDestinationDialog?.dataset.publicComments==='true')closeNotificationDestination();});
 async function openFixture(id){
  if(!registered()){defaultClient.signIn();return;}const owner=defaultClient.owner(),life=serverSyncClient.accountSnapshot(),identity=NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(id);
  const admitted=()=>[...feedCardSlots.values()].find(item=>[item.event.id,item.event.eventId,item.event.canonicalEventId,...(item.event.sourceEventIds||[])].filter(Boolean).some(key=>NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(key)===identity)&&!['dismissed','archived','isPurged'].some(key=>typeof getEventAction==='function'&&getEventAction(item.event)[key]));
  if(!admitted())throw Error('This fixture is no longer in your Feed.');
  reset();closeNotificationDestination();styles();const dialog=node('dialog',undefined,'calendar-dialog public-comments-destination'),body=node('div');dialog.dataset.publicComments='true';dialog.setAttribute('aria-label','Fixture discussion');dialog.style.cssText='width:min(900px,calc(100% - 32px));max-height:90vh;overflow:auto;';body.append(node('p','Loading fixture discussion…'));dialog.append(button('Close fixture',closeNotificationDestination),body);document.body.append(dialog);notificationDestinationDialog=dialog;
  const current=()=>owner===defaultClient.owner()&&life.generation===serverSyncClient.accountSnapshot().generation&&notificationDestinationDialog===dialog&&dialog.isConnected&&dialog.open;
  dialog.addEventListener('close',()=>{if(active?.card&&dialog.contains(active.card))reset();if(notificationDestinationDialog===dialog)notificationDestinationDialog=null;dialog.remove();});dialog.showModal();
  // Alert navigation owns a disposable full-card host. Never mount or observe
  // an ordinary Feed card, change tabs or persist a card/admission/seen choice.
  const draw=state=>{if(!current())return;reset();const item=admitted();if(!item){body.replaceChildren(node('p','This fixture is no longer in your Feed.'));return;}const fresh=buildEventCard(item.event,{mode:'schedule',cardState:state,onCardStateChange:draw});if(fresh.dataset.cardState!==state)throw Error('Fixture discussion is waiting for the shared card update.');body.replaceChildren(fresh);if(state==='opened')mount(fresh,item.event,{...defaultClient,active:current,scrollContainer:dialog});fresh.focus({preventScroll:true});};
  try{await defaultClient.load('config/chat-media-ui.js?v=304');if(!current()){if(notificationDestinationDialog===dialog)closeNotificationDestination();return;}if(!admitted())throw Error('This fixture is no longer in your Feed.');draw('opened');}
  catch(error){if(notificationDestinationDialog===dialog)closeNotificationDestination();throw error;}
 }

 root.NOTHINGSPORTS_PUBLIC_COMMENTS_UI=Object.freeze({mount,reset,openFixture});
})(typeof globalThis!=='undefined'?globalThis:this);
