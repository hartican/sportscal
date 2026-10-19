#!/usr/bin/env node
'use strict';
// Actual mounted shell with disposable local auth responses. No live service.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.ACCOUNT_APP_QA_URL;
assert(url && ['127.0.0.1','localhost'].includes(new URL(url).hostname),'A loopback candidate URL is required');
const output=process.env.ACCOUNT_APP_QA_OUTPUT;if(output)fs.mkdirSync(output,{recursive:true});
const engineName=process.env.ACCOUNT_APP_QA_BROWSER||'chromium';
const engine=engineName==='webkit'?webkit:chromium;
const token=(id,nonce)=>'e30.'+Buffer.from(JSON.stringify({sub:id,nonce})).toString('base64url')+'.disposable';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await engine.launch({headless:true,...(engineName==='chromium'?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{})});
 let layouts=0,behaviours=0;const allErrors=[],chooserProof=[],chooserCounts=[];
 try{
  for(const width of (process.env.ACCOUNT_APP_QA_WIDTHS||'320,390,768,1280').split(',').map(Number)){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<=390,serviceWorkers:'block'});
   await context.addInitScript(()=>{if('serviceWorker' in navigator)Object.defineProperty(navigator.serviceWorker,'ready',{configurable:true,value:Promise.resolve({pushManager:{getSubscription:async()=>null}})});});
   const api=[],errors=[],chooserEvents=[];let owner='qa-a',nonce=0,expired=false,holdState=false,releaseState,failHelper=false,holdHelper=false,releaseHelper;
   let row=null,meta={sports:[]};
   const viewerProfiles={};let holdViewer=false,releaseViewer=null,holdImage=false,releaseImage=null;const imageRequests=[];
   await context.route('**/*',async route=>{
    const request=route.request(),u=new URL(request.url());
    if(u.origin!==new URL(url).origin)return route.abort('blockedbyclient');
    if(u.pathname==='/assets/js/account-awareness-runtime.js'){
     if(failHelper)return route.fulfill({status:503,body:'Unavailable'});
     if(holdHelper)await new Promise(resolve=>releaseHelper=resolve);
     return route.continue();
    }
    if(u.pathname.startsWith('/account-avatar-qa/')){
     imageRequests.push(u.pathname);
     if(u.pathname.endsWith('fail.svg'))return route.fulfill({status:503,body:'Unavailable'});
     if(holdImage&&u.pathname.endsWith('late.svg'))await new Promise(resolve=>releaseImage=resolve);
     return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#467f9a"/></svg>'});
    }
    if(!u.pathname.startsWith('/api/'))return route.continue();
    const body=request.postDataJSON?.()||{},method=request.method();
    api.push({path:u.pathname,query:u.search,method,action:body.action||''});
    if(u.pathname==='/api/auth'){
     if(method==='GET')return route.fulfill({json:{configured:true}});
     if(['password-sign-in','sign-up'].includes(body.action))return route.fulfill({json:{session:{access_token:token(owner,++nonce),refresh_token:'disposable-'+nonce,expires_at:Date.now()+(expired?-10000:3600000)}}});
     if(body.action==='logout')return route.fulfill({json:{ok:true}});
    }
    if(u.pathname==='/api/user-state'&&method==='GET'){
     if(holdState)await new Promise(resolve=>releaseState=resolve);
     return route.fulfill({json:{user:{id:owner,email:owner+'@example.invalid'},state:row}});
    }
    if(u.pathname==='/api/user-meta'&&method==='GET')return route.fulfill({json:{meta}});
    if(u.pathname==='/api/nothingscore'&&method==='GET'){
     const profile={...(viewerProfiles[owner]||{handle:'qa_handle',displayName:'Avery Sample',visibility:'visible'})};
     if(holdViewer){holdViewer=false;await new Promise(resolve=>releaseViewer=resolve);}
     return route.fulfill({json:{viewer:{signedIn:true,ratingEligible:true,profile}}});
    }
    if(u.pathname==='/api/fixtures')return route.fulfill({status:304});
    return route.fulfill({status:503,json:{error:'Disposable unavailable response'}});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('filechooser',chooser=>chooserEvents.push(chooser));
   const readyForControls=async()=>{await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.waitForTimeout(300);for(const id of ['dismissTunePromptBtn','skipSelectorOptInBtn']){const dismiss=page.locator('#'+id);if(await dismiss.isVisible())await dismiss.click();}};
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.onboardingComplete=true;savePreferences(p);writeStorage(STORAGE_KEYS.selectorReleaseAcknowledgement,SELECTOR_TAXONOMY.version);closeSelectorOptInPrompt();if(document.getElementById('settingsModal').classList.contains('show'))closeSettings();});
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating());await readyForControls();
   await page.waitForFunction(()=>Boolean(accountIndicatorController));
   const chip=page.locator('#accountIndicator .account-awareness-control');
   const status=async expected=>{try{await page.waitForFunction(expected=>document.querySelector('#accountIndicator [data-account-status]')?.dataset.accountStatus===expected,expected);}catch(error){console.error(JSON.stringify({expected,diagnosis:await page.evaluate(()=>({state:serverPersistence.state,user:serverPersistence.user?.id,life:serverSyncClient.accountSnapshot(),generation:accountIndicatorGeneration,control:document.getElementById('accountIndicator').innerText,scope:serverStateSyncGeneration})),api:api.slice(-14)}));throw error;}};
   const preferences=()=>page.evaluate(()=>JSON.stringify(currentServerStatePayload()));
   const before=await preferences();
   await status('signedOut');assert.equal(await chip.locator('.account-awareness-label').innerText(),'Not signed in');
   const setState=async(state,user)=>page.evaluate(({state,user})=>setServerPersistence({configured:true,state,user,message:''}),{state,user});
   const signIn=async(id='qa-a',isExpired=false)=>{
    owner=id;expired=isExpired;
    await page.evaluate(()=>serverSyncClient.signIn('disposable@example.invalid','test-only',{persist:true}));
    await setState('signedIn',{id,email:id+'@example.invalid'});
   };
   const modes=[['signedOut',async()=>{await page.evaluate(()=>serverSyncClient.clearSession());await setState('signedOut',null);} ],
    ['checking',async()=>{await signIn();await setState('checking',{id:owner,email:owner+'@example.invalid'});} ],
    ['signedIn',async()=>{await signIn();await page.evaluate(()=>acceptNothingscoreViewer({signedIn:true,profile:{handle:'long_public_handle',displayName:'Avery Sample'}},'qa-a',serverSyncClient.accountSnapshot().generation));} ],
    ['offline',async()=>{await signIn();await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});dispatchEvent(new Event('offline'));});await setState('error',{id:owner,email:owner+'@example.invalid'});} ],
    ['reconnect',async()=>{await signIn('qa-a',true);} ]];
   for(const theme of ['day','night'])for(const [expected,prepare] of modes){
    await page.evaluate(theme=>{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});document.documentElement.dataset.theme=theme;},theme);
    await prepare();await status(expected);
    const geometry=await chip.evaluate(b=>{const r=b.getBoundingClientRect(),l=b.querySelector('.account-awareness-label').getBoundingClientRect();return{x:r.x,right:r.right,height:r.height,labelWidth:l.width,labelRight:l.right,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert(geometry.x>=0&&geometry.right<=width+.1&&geometry.height>=44&&geometry.labelWidth>0&&geometry.labelRight<=geometry.right+.1&&!geometry.overflow,JSON.stringify({width,theme,expected,geometry}));
    const controls=await page.locator('.header-utilities').evaluate(row=>({targets:[...row.querySelectorAll('button')].map(node=>node.getBoundingClientRect()).filter(r=>r.width>0).map(r=>({width:r.width,height:r.height})),left:row.getBoundingClientRect().left,order:[...row.children].map(node=>node.id),boxes:[...row.children].map(node=>{const r=node.getBoundingClientRect();return{id:node.id,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height};})}));
    assert.deepEqual(controls.order,['accountIndicator','settingsBtn','calendarSyncBtn','shareAppBtn','notificationsBtn'],'Account first; Settings immediately precedes Calendar');
    const [account,settings,calendar]=controls.boxes;assert(Math.abs(account.x-controls.left)<.1&&account.x<settings.x&&account.right<=settings.x+.1&&Math.abs(calendar.x-settings.right-2)<1&&Math.abs(settings.y-calendar.y)<.1,'Account left aligned; Settings immediately left of Calendar: '+JSON.stringify(controls));assert(controls.targets.every(box=>box.width>=44&&box.height>=44)&&controls.boxes.every(box=>box.width>=44&&box.height>=44)&&controls.boxes.slice(1).every((box,i)=>controls.boxes[i].right<=box.x+.1),'44px header controls without overlap');
    assert(await page.locator('#settingsBtn').isVisible());assert.equal(await chip.evaluate(b=>getComputedStyle(b).backgroundColor),'rgba(0, 0, 0, 0)','Account text keeps the existing header background in both themes');layouts++;
    if(output&&width===390&&['signedIn','signedOut'].includes(expected))await page.locator('header.top').screenshot({path:path.join(output,`${engineName}-${theme}-${expected}.png`)});
   }
   await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{value:true,configurable:true}));
   await page.evaluate(()=>serverSyncClient.clearSession());await setState('signedOut',null);await status('signedOut');
   const writes=()=>api.filter(x=>['/api/user-state','/api/user-meta'].includes(x.path)&&x.method!=='GET').length;
   const writesBefore=writes();
   for(const theme of ['day','night'])for(const tab of ['Feed','Events','Match Centre','Follow']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.locator('.tabs .tab-btn').filter({has:page.locator('.tab-label',{hasText:new RegExp('^'+tab+'$')})}).click();await status('signedOut');assert(await chip.isVisible());
    assert(await chip.evaluate(b=>{const r=b.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.height>=44;}),tab+' header fits');layouts++;
    const beforeAccount=await preferences();await chip.click();await page.locator('#settingsModal.show').waitFor();await page.locator('#accountSignInForm').waitFor();
    await page.locator('#closeSettingsBtn').click();assert.equal(await page.evaluate(()=>accountIndicatorJourney),null);assert.equal(await preferences(),beforeAccount,'Account open/cancel preserves guest data');behaviours++;
   }
   assert.equal(writes(),writesBefore,'Indicator navigation adds no personal-state writes');
   if(width===390){
    // The actual form cannot complete its Account callback before full hydration.
    await chip.click();const payload=await page.evaluate(()=>currentServerStatePayload());
    row={schema_version:'user-state.v2',profile:payload.profile,preferences:payload.preferences,event_user_state:payload.eventUserState,event_spoiler_state:payload.eventSpoilerState,archived_events:payload.archivedEvents,ratings:payload.ratings,updated_at:'2026-10-19T00:00:00Z'};
    meta=await page.evaluate(()=>userPreferences.followFirst.startupMeta);owner='qa-a';expired=false;holdState=true;
    await page.locator('#accountEmail').fill('disposable@example.invalid');await page.locator('#accountPassword').fill('test-only');await page.locator('#accountSignInForm [type=submit]').click();
    for(let i=0;i<100&&!releaseState;i++)await delay(20);assert(releaseState,'actual account hydration reached mocked transport');
    assert.equal(await page.evaluate(()=>accountIndicatorJourney?.phase),'signing-in');
    assert.notEqual(await chip.getAttribute('data-account-status'),'signedIn');
    holdState=false;releaseState();await status('signedIn');await page.waitForFunction(()=>accountIndicatorJourney===null);behaviours++;
    await page.locator('#signOutAccountBtn').click();await status('signedOut');assert.equal(await page.evaluate(()=>serverPersistence.user),null);behaviours++;
    await page.locator('#closeSettingsBtn').click();
    await context.setOffline(true);await status('signedOut');await chip.click();await page.locator('#settingsModal.show').waitFor();await page.locator('#closeSettingsBtn').click();await context.setOffline(false);behaviours++;
    const life=await page.evaluate(()=>serverSyncClient.accountSnapshot());
    // Profile results are tagged with the originating lifetime, including same-ID replacement.
    await signIn('qa-a');await page.evaluate(old=>acceptNothingscoreViewer({profile:{handle:'STALE_PROFILE'}},'qa-a',old),life.generation);
    assert(!(await chip.innerText()).includes('STALE_PROFILE'));behaviours++;
    // Real cross-tab storage events update the existing client; no account fetch is added.
    const peer=await context.newPage();await peer.goto(url+'/account-test-peer');
    const peerSession={accessToken:token('qa-b',++nonce),refreshToken:'disposable-peer',expiresAt:Date.now()+3600000};
    await chip.click();await page.locator('#settingsModal.show').waitFor();
    const authReads=api.filter(x=>x.path==='/api/auth').length;
    await peer.evaluate(s=>localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify(s)),peerSession);
    await status('reconnect');assert.equal(await page.evaluate(()=>serverSyncClient.accountSnapshot().accountId),'qa-b');assert(!(await chip.innerText()).includes('qa-a'));assert.equal(api.filter(x=>x.path==='/api/auth').length,authReads);assert.equal(await page.evaluate(()=>accountIndicatorJourney),null);await page.locator('#closeSettingsBtn').click();behaviours++;
    await peer.evaluate(()=>localStorage.removeItem('ns_auth_persistent_session_v1'));await status('signedOut');behaviours++;
    owner='qa-a';await page.evaluate(()=>serverSyncClient.signIn('disposable@example.invalid','test-only',{persist:false}));await setState('signedIn',{id:owner,email:owner+'@example.invalid'});
    await peer.evaluate(s=>localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify(s)),peerSession);await page.evaluate(()=>new Promise(r=>setTimeout(r,80)));
    assert.equal(await page.evaluate(()=>serverSyncClient.accountSnapshot().accountId),'qa-a');await status('signedIn');behaviours++;
    await peer.close();
    // A failed optional helper leaves the native direct Account button usable.
    failHelper=true;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating());await readyForControls();
    await page.locator('#accountIndicatorFallback').waitFor();await page.locator('#accountIndicatorFallback').click();await page.locator('#settingsModal.show').waitFor();await page.locator('#closeSettingsBtn').click();behaviours++;
    failHelper=false;holdHelper=true;releaseHelper=null;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating());await readyForControls();
    await page.locator('#accountIndicatorFallback').click();await page.locator('#settingsModal.show').waitFor();await page.locator('#closeSettingsBtn').click();
    for(let i=0;i<100&&!releaseHelper;i++)await delay(20);assert(releaseHelper);
    viewerProfiles['qa-a']={handle:'casey',displayName:'Casey Vale',avatarUrl:url+'/account-avatar-qa/a.svg'};await signIn('qa-a');await page.evaluate(()=>refreshNothingscoreViewer());
    assert(await page.evaluate(()=>!globalThis.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP&&nothingscoreViewerScope.owner==='qa-a'&&nothingscoreViewerScope.generation===serverSyncClient.accountSnapshot().generation),'accepted profile receipt predates optional helper');
    await page.locator('#accountIndicatorFallback').focus();holdHelper=false;releaseHelper();await page.waitForFunction(()=>Boolean(accountIndicatorController));assert.equal(await page.locator('#accountIndicator button').count(),2);assert(await chip.evaluate(button=>document.activeElement===button),'delayed helper transfers normal Account focus to handle control');const beforeEnter=chooserEvents.length;await page.keyboard.press('Enter');await page.locator('#settingsModal.show').waitFor();assert.equal(chooserEvents.length,beforeEnter,'focused fallback→helper→Enter retains normal Account action');await page.locator('#closeSettingsBtn').click();behaviours++;
    const photo=page.locator('#accountIndicator .account-awareness-avatar img'),avatar=page.locator('#accountIndicator .account-awareness-avatar');
    const decoded=async()=>page.waitForFunction(()=>{const image=document.querySelector('#accountIndicator img');return image?.complete&&image.naturalWidth>0;});
    await decoded();assert.equal(await photo.getAttribute('src'),viewerProfiles['qa-a'].avatarUrl);assert.equal(await photo.evaluate(image=>getComputedStyle(image).objectFit),'cover');behaviours++;
    await readyForControls();if(await page.locator('#settingsModal.show').count())await page.locator('#closeSettingsBtn').click();
    for(const theme of ['day','night']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const rect=await photo.boundingBox();assert(Math.abs(rect.width-24)<.1&&Math.abs(rect.height-24)<.1,'current picture remains24px square');if(output)await page.locator('header.top').screenshot({path:path.join(output,`${engineName}-current-picture-${theme}.png`)});behaviours++;}
    viewerProfiles['qa-b']={handle:'blair',displayName:'Blair Stone'};await signIn('qa-b');await page.evaluate(()=>refreshNothingscoreViewer());assert.equal(await photo.count(),0);assert.equal(await avatar.innerText(),'BS');behaviours++;
    await signIn('qa-a');await page.evaluate(()=>refreshNothingscoreViewer());await decoded();await page.evaluate(()=>window.priorAccountImage=document.querySelector('#accountIndicator img'));
    viewerProfiles['qa-a']={handle:'casey',displayName:'Casey Vale',avatarUrl:url+'/account-avatar-qa/fail.svg'};await page.evaluate(()=>refreshNothingscoreViewer());await page.waitForFunction(()=>!document.querySelector('#accountIndicator img'));assert.equal(await avatar.innerText(),'CV');behaviours++;
    viewerProfiles['qa-a']={handle:'missing_name'};await page.evaluate(()=>refreshNothingscoreViewer());assert.equal(await avatar.innerText(),'');assert.equal(await avatar.locator('svg').count(),1);behaviours++;
    holdImage=true;releaseImage=null;viewerProfiles['qa-a']={handle:'casey',displayName:'Casey Vale',avatarUrl:url+'/account-avatar-qa/late.svg'};await page.evaluate(()=>refreshNothingscoreViewer());for(let i=0;i<100&&!releaseImage;i++)await delay(20);assert(releaseImage,'native old image request reached held transport');await page.evaluate(()=>window.lateAccountImage=document.querySelector('#accountIndicator img'));
    await signIn('qa-b');await page.evaluate(()=>refreshNothingscoreViewer());holdImage=false;releaseImage();await page.evaluate(()=>{lateAccountImage.dispatchEvent(new Event('error'));priorAccountImage.dispatchEvent(new Event('error'));});assert.equal(await avatar.innerText(),'BS');assert.equal(await photo.count(),0);behaviours++;
    await signIn('qa-a');viewerProfiles['qa-a']={handle:'casey',displayName:'Casey Vale',avatarUrl:url+'/account-avatar-qa/a.svg'};await page.evaluate(()=>refreshNothingscoreViewer());await decoded();await page.evaluate(()=>window.oldEpochImage=document.querySelector('#accountIndicator img'));
    holdViewer=true;releaseViewer=null;await page.evaluate(()=>{window.lateProfileResult=refreshNothingscoreViewer().catch(error=>({code:error.code}));});for(let i=0;i<100&&!releaseViewer;i++)await delay(20);assert(releaseViewer,'old profile request reached held transport');
    await signIn('qa-b');await page.evaluate(()=>refreshNothingscoreViewer());await signIn('qa-a');viewerProfiles['qa-a']={handle:'avery',displayName:'Avery Lane',avatarUrl:url+'/account-avatar-qa/current-a.svg'};await page.evaluate(()=>refreshNothingscoreViewer());await decoded();releaseViewer();await page.evaluate(()=>lateProfileResult);await page.evaluate(()=>oldEpochImage.dispatchEvent(new Event('error')));
    assert(await page.evaluate(()=>oldEpochImage!==document.querySelector('#accountIndicator img')));assert.equal(await photo.getAttribute('src'),viewerProfiles['qa-a'].avatarUrl);assert.equal(await page.evaluate(()=>nothingscoreViewer.profile.displayName),'Avery Lane');assert(await page.evaluate(()=>nothingscoreViewerScope.generation===serverSyncClient.accountSnapshot().generation));behaviours++;
    assert.equal(api.filter(item=>item.action==='profile-avatar-access'||item.query.includes('avatarExpanded')).length,0,'header never requests expanded/private avatars');
   }
   if([390,1280].includes(width)){
    const picture=page.locator('#accountIndicator .account-awareness-picture-control'),avatar=page.locator('#accountIndicator .account-awareness-avatar');
    const closeAccount=async()=>{await page.locator('#closeSettingsBtn').click();await page.locator('#settingsModal.show').waitFor({state:'hidden'});};
    const writesBefore=api.filter(item=>item.action==='profile'||item.action.startsWith('profile-avatar-')).length;
    for(const theme of ['day','night']){
     await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
     viewerProfiles['qa-a']={handle:'casey_unique',displayName:'Casey Vale',avatarUrl:url+'/account-avatar-qa/chooser.svg'};await signIn('qa-a');await page.evaluate(()=>refreshNothingscoreViewer());await readyForControls();
     assert.equal(await chip.locator('.account-awareness-label').innerText(),'@casey_unique');assert.equal(await page.locator('#accountIndicator button button').count(),0);
     let count=chooserEvents.length;await chip.click();await page.locator('#settingsModal.show').waitFor();assert.equal(chooserEvents.length,count,'handle opens Account without a chooser');await closeAccount();behaviours++;
     const chooseOnce=async gesture=>{const before=chooserEvents.length,opened=page.waitForEvent('filechooser');await picture.evaluate(node=>{globalThis.lastPictureActivation=null;node.addEventListener('click',event=>globalThis.lastPictureActivation={trusted:event.isTrusted,active:navigator.userActivation?.isActive??null},{once:true,capture:true});});if(gesture==='tap')await picture.tap();else if(gesture==='click')await picture.click();else{await picture.focus();await page.keyboard.press(gesture);}const chooser=await opened;assert.equal(chooserEvents.length,before+1,'exactly one native chooser per '+gesture);const input=page.locator('#settingsBody .public-profile-avatar-editor input[type=file]');await input.waitFor();assert(await input.evaluate(node=>document.activeElement===node),'existing picture input receives focus');assert.equal(await chooser.element().getAttribute('aria-label'),'Choose profile picture');assert.equal(await input.count(),1);assert(await chooser.element().evaluate(node=>node===document.querySelector('#settingsBody .public-profile-avatar-editor input[type=file]')),'one existing editor input');const activation=await page.evaluate(()=>lastPictureActivation);assert(activation.trusted&&activation.active!==false,'native activation preserved');chooserProof.push({width,theme,gesture,events:1,activation,source:'existing Account file input',selection:'empty cancellation'});await chooser.setFiles([]);assert.equal(await input.evaluate(node=>node.files.length),0);await closeAccount();assert(await picture.evaluate(node=>document.activeElement===node),'close returns focus to avatar');assert.equal(chooserEvents.length,before+1,'focus/cancel never reopens picker');behaviours++;};
     await chooseOnce(width===390?'tap':'click');
     viewerProfiles['qa-a']={handle:'casey_unique',displayName:'Casey Vale'};await page.evaluate(()=>refreshNothingscoreViewer());assert.equal(await avatar.innerText(),'CV');await chooseOnce('Enter');await chooseOnce('Space');
     // A pending neutral account opens the existing loading page only. Later
     // accepted metadata cannot replay a chooser without a fresh gesture.
     await page.evaluate(()=>acceptNothingscoreViewer({signedIn:false,profile:null},'qa-a',serverSyncClient.accountSnapshot().generation));holdViewer=true;releaseViewer=null;count=chooserEvents.length;await picture.click();await page.locator('#settingsModal.show').waitFor();for(let i=0;i<100&&!releaseViewer;i++)await delay(20);assert(releaseViewer);assert.equal(await page.locator('#settingsBody input[type=file]').count(),0);assert.equal(chooserEvents.length,count);await closeAccount();releaseViewer();await page.waitForFunction(()=>nothingscoreViewer.signedIn);assert.equal(chooserEvents.length,count,'late hydration does not replay closed intent');await chooseOnce('Enter');behaviours++;
     // Replacement while the native chooser is open removes the old input;
     // cancellation must not restore a prior account's file or open another.
     const oldCount=chooserEvents.length,opened=page.waitForEvent('filechooser');await picture.click();const chooser=await opened;await signIn('qa-b');viewerProfiles['qa-b']={handle:'blair_unique',displayName:'Blair Stone'};await page.evaluate(()=>refreshNothingscoreViewer());await chooser.setFiles([]).catch(error=>assert.match(error.message,/detach|not attached|closed/i));assert.equal(chooserEvents.length,oldCount+1);assert.equal(await page.locator('#settingsBody input[type=file]').evaluate(node=>node.files.length),0);await closeAccount();assert.equal(await chip.locator('.account-awareness-label').innerText(),'@blair_unique');behaviours++;
     await page.evaluate(()=>serverSyncClient.clearSession());await setState('signedOut',null);await status('signedOut');assert.equal(await picture.isVisible(),false);count=chooserEvents.length;await chip.click();await page.locator('#accountSignInForm').waitFor();assert.equal(chooserEvents.length,count,'signed-out Account never opens a file chooser');await closeAccount();behaviours++;
    }
    assert.equal(api.filter(item=>item.action==='profile'||item.action.startsWith('profile-avatar-')).length,writesBefore,'opening/cancelling chooser never saves or uploads a profile');
   }
   if(width===320){
    failHelper=true;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!startupCoordinator.isHydrating());await readyForControls();const fallback=page.locator('#accountIndicatorFallback');await fallback.waitFor();
    const box=await fallback.boundingBox(),settings=await page.locator('#settingsBtn').boundingBox();assert(box.x>=0&&box.x+box.width<=settings.x+.1&&box.width>=44&&box.height>=44,'narrow helper-failure fallback retains its own44px space: '+JSON.stringify({box,settings}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);behaviours++;
   }
   assert.equal(chooserEvents.length,[390,1280].includes(width)?10:0,'total native chooser count matches deliberate gestures only');chooserCounts.push({width,nativeChooserEvents:chooserEvents.length});assert.deepEqual(errors,[],'No unhandled mounted-app errors');allErrors.push(...errors);await context.close();
  }
  const result={engine:engineName,actualMountedApp:true,layouts,behaviours,errors:allErrors,chooserCounts,chooserProof,pendingNeutral:'Account/loading only; no asynchronous chooser replay',avatarCases:'actual accepted callback, pre/post helper, picture/no-picture/native failure/missing name/late image/late profile/A-B-A',layoutContract:'Account first/left; Settings immediately left of Calendar;44px controls',transport:'loopback static candidate, mocked disposable API; external origins blocked',limits:'Component and local integration evidence; no hosted, real account or physical device claim'};
  if(output)fs.writeFileSync(path.join(output,engineName+'-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
