/* TEST-ONLY transport/resource facade. Never included by the production app. */
(() => {
 'use strict';
 document.documentElement.dataset.publicFeedTest='';
 const nativeFetch=globalThis.fetch.bind(globalThis),audit=[],assetPrefix='/preview/gifs/';
 let currentView='feed',model,ready=false,accountBusy=false;
 const message=text=>{const status=document.getElementById('test-status');if(status)status.textContent=text;};
 const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
 model=PUBLIC_FEED_TEST_MODEL.create({storage,policy:NOTHINGSPORTS_PUBLIC_COMMENTS,epic:NOTHINGSPORTS_EPIC,changed:()=>{if(ready)refreshStatus();}});
 const token=id=>'e30.'+btoa(JSON.stringify({sub:id}))+'.synthetic-test-only';
 const session=()=>{const a=model.account();return a?{access_token:token(a.id),refresh_token:'synthetic-test-only',expires_in:3600,user:{id:a.id,isAnonymous:false}}:null;};
 const preferences=()=>({version:27,onboardingComplete:true,showSpoilers:model.account()?.settings.results!==false,followedSports:[],selectedSelectorEntityIds:[],feedControls:{spoilers:model.account()?.settings.results===false?'strict':'results_visible'},fantasyDeadlines:{enabled:false},followFirst:{notifications:{enabled:false,autoRemindersEnabled:false},refinement:{promptedAt:'2026-10-26'}}});
 function seedSession(){localStorage.setItem('ns_preferences_v1',JSON.stringify(preferences()));localStorage.setItem('ns_auth_persistence_v1','session');localStorage.removeItem('ns_auth_persistent_session_v1');const a=model.account();if(a)sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:token(a.id),refreshToken:'synthetic-test-only',expiresAt:Date.now()+3600000}));else sessionStorage.removeItem('ns_auth_session_v1');}
 seedSession();
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const actor=options=>{try{return JSON.parse(atob(new Headers(options?.headers).get('Authorization')?.replace(/^Bearer /,'').split('.')[1])).sub;}catch{return null;}};
 function gifPayload(offset=0,query=''){const names=['cheer','wow','clap'].filter(name=>!query||name.includes(query.toLowerCase().trim())),items=names.slice(offset,offset+2).map(name=>({id:'preview-'+name,title:'TEST GIF · '+name,url:'https://giphy.com/',images:{original:{url:'https://media.giphy.com/media/preview-'+name+'/giphy.gif',width:'120',height:'80'},fixed_width:{url:'https://media.giphy.com/media/preview-'+name+'/giphy.gif',width:'120',height:'80'}}}));return{data:items,pagination:{count:items.length,total_count:names.length,offset}};}
 function gifConfig(){const a=model.registered();return{provider:'giphy',capabilities:{canUseGifs:a.points>=25,lifetimeNscPoints:a.points,gifMinimumPoints:25},clientConfig:{apiKey:'TEST-NO-CREDENTIAL',searchEndpoint:'https://api.giphy.com/v1/gifs/search',trendingEndpoint:'https://api.giphy.com/v1/gifs/trending'}};}
 async function api(url,options){
  const method=(options.method||'GET').toUpperCase(),body=options.body?JSON.parse(options.body):null,a=model.account();
  audit.push({path:url.pathname,method,action:body?.action||null});if(audit.length>200)audit.shift();
  if(url.pathname==='/api/auth'){
   if(body?.action==='password-sign-in'){if(!a||body.email!==a.name+'@test.invalid'||body.password!=='preview-only')throw Object.assign(Error('Use the supplied test-account selector.'),{status:403});return json({configured:true,user:session().user,session:session()});}
   if(body&&(body.action==='logout'||/sign.?out/i.test(body.action||'')))return json({configured:true,user:null});
   if(method!=='GET')throw Object.assign(Error('Real sign-in is disabled in TEST MODE.'),{status:405});return json({configured:true,user:session()?.user||null});
  }
  if(url.pathname==='/api/chat'){
   if(actor(options)!==a?.id)throw Object.assign(Error('The test account changed. Reopen comments.'),{status:401,code:'account_required'});
   if(url.searchParams.get('mode')==='gif-config')return json(gifConfig());
   if(url.searchParams.get('mode')==='public-comments'||body?.action?.startsWith('public-comment-')){
    const eventId=body?.eventId||url.searchParams.get('roomId');
    return json(body?model.write(eventId,{...body,action:body.action.slice(15)}):model.read(eventId,{after:url.searchParams.has('after')&&url.searchParams.get('after')!==''?url.searchParams.get('after'):undefined,before:url.searchParams.get('before'),q:url.searchParams.get('q')}));
   }
   throw Object.assign(Error('Private chat and real profile services are outside this test.'),{status:503,code:'test_service_disabled'});
  }
  if(url.pathname==='/api/nothingscore'&&method==='GET')return json({points:a?.points||0,settlements:[],entries:[],privileges:[]});
  // All normal service calls fail locally. No request is forwarded to a server.
  return json({error:'TEST MODE: this service is disabled.',code:'test_service_disabled'},503);
 }
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
  if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  try{
   if(url.origin==='https://api.giphy.com'&&['/v1/gifs/search','/v1/gifs/trending'].includes(url.pathname))return json(gifPayload(Number(url.searchParams.get('offset')||0),url.searchParams.get('q')||''));
   if(url.origin!==location.origin)throw Error('External requests are disabled in TEST MODE.');
   if(url.pathname.startsWith('/api/'))return await api(url,options);
   if(url.pathname.startsWith('/data/')){
    if(url.pathname==='/data/feed/manifest.json')return json({schemaVersion:'public-feed.v2',sourceVersion:'synthetic-test-v1',sourcePublishedAt:model.snapshot().startedAt,pages:[{path:'data/feed/page-001.json',count:3}],totalCount:3});
    if(url.pathname==='/data/feed/page-001.json')return json({schemaVersion:'public-feed-page.v2',sourceVersion:'synthetic-test-v1',events:model.fixtures()});
    return json({schemaVersion:'test-only',events:[],fixtures:[],entries:[],codes:[],chunks:[],entities:[],sports:[]});
   }
   if(!['GET','HEAD'].includes((options.method||'GET').toUpperCase()))throw Error('Network writes are disabled in TEST MODE.');
   if(!/^\/(?:assets|config|styles|preview)\//.test(url.pathname)&&url.pathname!=='/app-version.json')throw Error('This path is not part of the test artifact.');
   return nativeFetch(input,options);
  }catch(error){if(url.origin===location.origin&&url.pathname.startsWith('/api/'))return json({error:error.message,code:error.code||'test_request_refused'},error.status||400);throw error;}
 };
 // Trusted GIPHY-shaped metadata is exercised by the real picker. Every pixel
 // is a bundled synthetic GIF; no provider request or analytics leave the page.
 const image=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src'),setAttribute=HTMLImageElement.prototype.setAttribute;
 const mirror=value=>{try{const u=new URL(String(value),location.href),match=u.href.match(/^https:\/\/media\.giphy\.com\/media\/preview-(cheer|wow|clap)\/giphy\.gif$/);if(match)return assetPrefix+match[1]+'.gif';if(u.origin!==location.origin&&!['data:','blob:'].includes(u.protocol))return assetPrefix+'cheer.gif';}catch{}return value;};
 Object.defineProperty(HTMLImageElement.prototype,'src',{...image,set(value){image.set.call(this,mirror(value));}});
 HTMLImageElement.prototype.setAttribute=function(name,value){return setAttribute.call(this,name,name.toLowerCase()==='src'?mirror(value):value);};
 const localBlob=value=>{try{const u=new URL(value,location.href);return u.protocol==='blob:'&&u.origin===location.origin;}catch{return false;}};
 const anchor=Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype,'href');
 Object.defineProperty(HTMLAnchorElement.prototype,'href',{...anchor,set(value){anchor.set.call(this,localBlob(value)?value:'#test-link-disabled');}});
 const scrubLinks=root=>{for(const a of root.querySelectorAll?.('a[href]')||[]){if(a.getAttribute('href')!=='#test-link-disabled'&&!localBlob(a.getAttribute('href')))a.setAttribute('href','#test-link-disabled');a.removeAttribute('target');}};
 new MutationObserver(records=>{for(const record of records){if(record.type==='attributes'&&record.target.matches('a[href]'))scrubLinks(record.target.parentNode);else for(const added of record.addedNodes)if(added.nodeType===1){if(added.matches('a[href]')){if(!localBlob(added.getAttribute('href')))added.setAttribute('href','#test-link-disabled');added.removeAttribute('target');}scrubLinks(added);}}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
 // A dedicated preview origin also has CSP worker-src none and contains no
 // service-worker file. This test facade prevents normal app permission flows.
 if(navigator.serviceWorker){navigator.serviceWorker.register=async()=>{audit.push({suppressed:'service-worker'});return{active:null,waiting:null,installing:null,scope:location.origin+'/',addEventListener(){},update:async()=>{}};};}
 if(navigator.sendBeacon)navigator.sendBeacon=()=>false;
 if(globalThis.Notification)Notification.requestPermission=async()=>{audit.push({suppressed:'notification-permission'});return'denied';};
 if(navigator.share)navigator.share=undefined;
 if(navigator.canShare)navigator.canShare=()=>false;
 globalThis.open=()=>{message('External pages are disabled in this test.');return null;};
 document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(link&&!(link.hasAttribute('download')&&localBlob(link.href))){event.preventDefault();message('This is a test link. No external page was opened.');}},true);
 addEventListener('storage',event=>{if(event.key===model.KEY)model.sync();});
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 function button(text,run){const b=node('button',text);b.type='button';b.onclick=()=>{if(accountBusy)return;return Promise.resolve().then(run).catch(e=>message(e.message));};return b;}
 function refreshStatus(){const s=model.snapshot(),a=model.account(),badge=document.getElementById('test-identity');if(badge)badge.textContent=a?a.handle+' · '+a.points+' NSC test points':'Visitor · sign-in required';const count=document.getElementById('test-alert-count');if(count)count.textContent=String(s.notifications.filter(n=>n.recipient===s.owner).length);for(const option of document.querySelectorAll('[aria-label="Choose a test account"] option')){const actor=s.accounts.find(person=>person.id===option.value);if(actor)option.textContent=actor.handle+' · '+actor.points+' points';}}
 function closeAll(){globalThis.NOTHINGSPORTS_PUBLIC_COMMENTS_UI?.reset();if(typeof closeNotificationDestination==='function')closeNotificationDestination();for(const d of document.querySelectorAll('dialog[open]'))d.close();}
 async function choose(owner){accountBusy=true;const select=document.querySelector('[aria-label="Choose a test account"]');if(select)select.disabled=true;const content=document.getElementById('test-content');if(content)content.inert=true;message('Switching test account…');try{closeAll();model.select(owner);seedSession();if(owner==='visitor'){if(serverSyncClient.signOut)await serverSyncClient.signOut();serverPersistence.user=null;}else{await serverSyncClient.signIn(model.account().name+'@test.invalid','preview-only',{persist:false});serverPersistence.user={id:owner,isAnonymous:false};}document.dispatchEvent(new Event('visibilitychange'));await view(currentView);message('Test account ready.');}finally{accountBusy=false;if(select)select.disabled=false;if(content)content.inert=false;}}
 function installAdmission(){feedCardSlots.clear();for(const event of model.fixtures())if(model.admitted(event.id))buildFeedCardSlot(event);activeEvents=model.fixtures();}
 function fixtureCard(event){
  const wrapper=node('section');wrapper.className='test-fixture';
  const draw=state=>{NOTHINGSPORTS_PUBLIC_COMMENTS_UI.reset();const card=buildEventCard(event,{mode:'schedule',cardState:state,onCardStateChange:draw});wrapper.replaceChildren(card);const actions=node('div');actions.className='test-card-tools';actions.append(button('Open public comments',()=>{if(!model.account())return message('Choose a registered test account above.');NOTHINGSPORTS_PUBLIC_COMMENTS_UI.mount(state==='opened'?card:draw('opened'),event);}),button('Rate 5/5 for yearbook',()=>{model.rate(event.id,5);message('Your test 5/5 is saved. Top comments are captured when this completed fixture retires.');}),button('Dismiss for me',()=>{model.dismiss(event.id);NOTHINGSPORTS_PUBLIC_COMMENTS_UI.reset();message('Your card was dismissed; the shared discussion is kept.');wrapper.hidden=true;}));wrapper.append(actions);return card;};draw('opened');return wrapper;
 }
 async function view(name){
  closeAll();currentView=name;const content=document.getElementById('test-content');content.replaceChildren();document.querySelectorAll('[data-test-view]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.testView===name)));
  if(typeof userPreferences!=='undefined'){userPreferences.showSpoilers=model.account()?.settings.results!==false;userPreferences.feedControls ||= {};userPreferences.feedControls.spoilers=userPreferences.showSpoilers?'results_visible':'strict';}
  activeTab='feed';installAdmission();
  if(name==='feed'){for(const event of model.fixtures()){if(model.admitted(event.id))content.append(fixtureCard(event));else if(model.snapshot().threads[event.id].closed)content.append(node('p',event.name+' · retired. View your yearbook.'));}return;}
  if(name==='notifications'){
   content.append(node('h2','Notification demonstrations'),node('p','These are browser-only examples. No notification is sent and no permission is requested.'));
   const s=model.snapshot(),entries=s.notifications.filter(n=>n.recipient===s.owner);if(!entries.length)content.append(node('p','No simulated alerts yet. Use Test controls to add comments from people you follow.'));
   for(const entry of entries){const card=node('article');card.className='test-notification';const a=s.accounts.find(a=>a.id===entry.actor),fixture=s.fixtures.find(f=>f.id===entry.eventId);card.append(node('h3',(a?.handle||'Unavailable test account')+' commented'),node('p',entry.count+' comment'+(entry.count===1?'':'s')+' on '+fixture.name),button('Open fixture and comments',()=>NOTHINGSPORTS_PUBLIC_COMMENTS_UI.openFixture(entry.eventId)));content.append(card);}return;
  }
  if(name==='yearbook'){
   content.append(node('h2','Your test yearbook'),node('p','Rate a completed fixture 5/5, add comments, then advance to day 8 and retire it in Test controls. Saved comments contain text and handles only.'));
   const host=node('div');content.append(host);if(!model.account()){host.textContent='Choose a registered test account to open the yearbook.';return;}
   await NOTHINGSPORTS_EPIC_UI.mount(host,{owner:()=>model.account()?.id||'',results:()=>model.account()?.settings.results!==false,active:()=>currentView==='yearbook',toast:message,request:async(q,c)=>model.classics(q,c)});return;
  }
  content.append(node('h2','Test controls'),node('p','Everything here is synthetic and stored only in this browser. Other people using the URL have their own copy.'));
  const a=model.account(),s=model.snapshot(),first=s.fixtures[0],final=s.fixtures[2];
  const people=node('section');people.append(node('h3','Live comments and alert runs'));
  const commentAs=(id,text)=>model.write(first.id,{action:'post',clientId:crypto.randomUUID(),body:text},id);
  for(const [label,trail]of [['A → A → A',[idsFor('sam'),idsFor('sam'),idsFor('sam')]],['A → unfollowed B → A',[idsFor('sam'),idsFor('bob'),idsFor('sam')]],['A → followed C → A',[idsFor('sam'),idsFor('carol'),idsFor('sam')]]])people.append(button('Simulate '+label,()=>{for(const id of trail)commentAs(id,'TEST activity from '+s.accounts.find(a=>a.id===id).handle);message('Trail added to the live fixture. View simulated alerts; only followed people reset a run.');}));
  people.append(button('Add one live comment as Sam',()=>{commentAs(idsFor('sam'),'A new test comment, updated live 👋');message('Sam added a test comment.');}));content.append(people);
  if(a){const settings=node('section');settings.append(node('h3','Your test settings'));for(const[key,label]of [['comments','Comments from people I follow'],['global','Global notifications'],['device','Device delivery'],['results','Show results']]){const l=node('label'),input=node('input');input.type='checkbox';input.checked=a.settings[key];input.onchange=()=>{model.settings({[key]:input.checked});message('Test setting saved.');};l.append(input,node('span',label));settings.append(l);}for(const author of s.accounts.filter(x=>x.id!==a.id)){const l=node('label'),input=node('input');input.type='checkbox';input.checked=a.followed.includes(author.id);input.onchange=()=>model.follow(author.id,input.checked);l.append(input,node('span','Follow '+author.handle));settings.append(l);}content.append(settings);}
  const clock=node('section');clock.append(node('h3','Seven-day retirement and yearbook'),node('p','Test clock: '+s.clock+' · completed fixture: '+final.name),button('Give completed fixture 5/5',()=>{model.rate(final.id,5);message('Test 5/5 saved.');}),button('Day 7: keep comments',()=>{model.advance(7);message('Day 7: '+model.retire().length+' fixtures retired. The seventh day stays available.');}),button('Day 8: retire completed fixture',()=>{model.advance(8);const retired=model.retire();message(retired.length?'Completed test fixture retired; qualifying yearbooks captured the top three text comments/replies.':'Nothing new retired. Rate the fixture 5/5 first to keep its top comments.');}),button('Simulate archive-capture failure',()=>{model.captureFailure(true);message('Test failure enabled. A retirement attempt will keep the comments.');}),button('Clear capture failure and retry',()=>{model.captureFailure(false);message('Archive failure cleared. '+model.retire().length+' test fixture retired.');}),button('Restore my dismissed cards',()=>{for(const f of model.fixtures())model.dismiss(f.id,false);message('Your test cards are back in Fixtures.');}));content.append(clock);
  const privacy=node('section');privacy.append(node('h3','Privacy and erasure examples'),node('p','These controls affect test accounts only. GIF search uses three bundled sample animations; it never contacts GIPHY.'),button('Hide Sam’s test profile',()=>{model.privacy(idsFor('sam'),{visible:false});message('Sam’s test comments and archive quotes are hidden.');}),button('Show Sam’s test profile',()=>{model.privacy(idsFor('sam'),{visible:true});message('Sam’s test profile is visible.');}),button('Give Bob 25 test points',()=>{model.points(idsFor('bob'),25);message('Bob now has 25 synthetic points. Reopen the GIF picker as Bob.');}),button('Erase Bob’s test account',()=>{model.privacy(idsFor('bob'),{erase:true});message('Bob’s synthetic comments/votes/archive attribution were removed.');}));content.append(privacy);
 }
 function idsFor(name){return PUBLIC_FEED_TEST_MODEL.ids[name];}
 async function start(){
  // The real score presenter captures this model at script evaluation time.
  await loadDeferredScript('config/match-centre.js?v=595');
  await Promise.all([loadDeferredScript('assets/js/public-comments-ui.js?v=1'),loadDeferredScript('config/chat-media-ui.js?v=304'),loadDeferredScript('config/feed-live-scores.js?v=576'),loadDeferredScript('assets/js/epic-classics-ui.js?v=1')]);
  setTunePromptOpen(false);suppressSessionRatingPrompt();closeSettings({restoreTheme:false});closeAll();serverPersistence.user=model.account()?{id:model.account().id,isAnonymous:false}:null;
  const root=node('main');root.id='public-feed-test';const header=node('header');header.className='test-header';header.append(node('strong','PUBLIC FEED · TEST MODE'),node('p','Test accounts and fixtures only. Nothing is posted or sent to the live service.'));
  const select=node('select');select.setAttribute('aria-label','Choose a test account');for(const a of model.snapshot().accounts){const o=node('option',a.handle+' · '+a.points+' points');o.value=a.id;o.selected=a.id===model.snapshot().owner;select.append(o);}const visitor=node('option','Visitor · cannot open comments');visitor.value='visitor';visitor.selected=model.snapshot().owner==='visitor';select.append(visitor);select.onchange=()=>void choose(select.value).catch(e=>message(e.message));const identity=node('p');identity.id='test-identity';header.append(select,identity);
  const nav=node('nav');for(const[name,title]of [['feed','Fixtures'],['notifications','Alerts'],['yearbook','Yearbook'],['controls','Test controls']]){const b=button(title,()=>view(name));b.dataset.testView=name;if(name==='notifications'){const count=node('span');count.id='test-alert-count';b.append(document.createTextNode(' '),count);}nav.append(b);}header.append(nav);
  const status=node('p','Open a fixture’s public comments, then try a reply, vote or GIF.');status.id='test-status';status.setAttribute('role','status');const content=node('div');content.id='test-content';
  root.append(header,status,content,button('Reset all test data',async()=>{model.reset();await choose(model.snapshot().owner);select.value=model.snapshot().owner;message('All test data in this browser was reset.');}),node('p','UI test only: local synthetic data and simulated alerts. This does not prove live sign-in, database rules, delivery, cross-device sync or production readiness.'));
  document.body.append(root);ready=true;refreshStatus();await view('feed');document.getElementById('test-loading')?.remove();
  // Replace only preview navigation affordances; no production SDK export is changed.
  const normalSettings=globalThis.openSettings;globalThis.openSettings=options=>{if(options?.section==='account'){message('Use the test-account selector above. Real sign-in is disabled.');return;}return normalSettings(options);};
  globalThis.PUBLIC_FEED_PREVIEW=Object.freeze({mode:'TEST',model,audit,view,choose,ready:()=>ready,busy:()=>accountBusy});
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const loading=document.getElementById('test-loading')||node('p','TEST MODE · Loading the isolated Public Feed test…');loading.id='test-loading';if(!loading.isConnected)document.body.append(loading);
  const started=Date.now(),timer=setInterval(()=>{if(typeof buildEventCard==='function'&&typeof serverSyncClient!=='undefined'&&typeof startupFunnelFinished!=='undefined'&&startupFunnelFinished&&typeof startupCoordinator!=='undefined'&&!startupCoordinator.isHydrating()){clearInterval(timer);void start().catch(error=>{loading.textContent='The test could not start: '+error.message;});}else if(Date.now()-started>30000){clearInterval(timer);loading.textContent='The test did not finish loading. Reload this test URL; no live account is affected.';}},50);
 });
})();
