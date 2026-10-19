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
 let layouts=0,behaviours=0;const allErrors=[];
 try{
  for(const width of (process.env.ACCOUNT_APP_QA_WIDTHS||'320,390,768,1280').split(',').map(Number)){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.addInitScript(()=>{if('serviceWorker' in navigator)Object.defineProperty(navigator.serviceWorker,'ready',{configurable:true,value:Promise.resolve({pushManager:{getSubscription:async()=>null}})});});
   const api=[],errors=[];let owner='qa-a',nonce=0,expired=false,holdState=false,releaseState,failHelper=false,holdHelper=false,releaseHelper;
   let row=null,meta={sports:[]};
   await context.route('**/*',async route=>{
    const request=route.request(),u=new URL(request.url());
    if(u.origin!==new URL(url).origin)return route.abort('blockedbyclient');
    if(u.pathname==='/assets/js/account-awareness-runtime.js'){
     if(failHelper)return route.fulfill({status:503,body:'Unavailable'});
     if(holdHelper)await new Promise(resolve=>releaseHelper=resolve);
     return route.continue();
    }
    if(!u.pathname.startsWith('/api/'))return route.continue();
    const body=request.postDataJSON?.()||{},method=request.method();
    api.push({path:u.pathname,method,action:body.action||''});
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
    if(u.pathname==='/api/nothingscore'&&method==='GET')return route.fulfill({json:{viewer:{signedIn:true,ratingEligible:true,profile:{handle:'qa_handle',displayName:'Avery Sample',visibility:'visible'}}}});
    if(u.pathname==='/api/fixtures')return route.fulfill({status:304});
    return route.fulfill({status:503,json:{error:'Disposable unavailable response'}});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.onboardingComplete=true;savePreferences(p);writeStorage(STORAGE_KEYS.selectorReleaseAcknowledgement,SELECTOR_TAXONOMY.version);closeSelectorOptInPrompt();if(document.getElementById('settingsModal').classList.contains('show'))closeSettings();});
   await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
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
    ['signedIn',async()=>{await signIn();await page.evaluate(()=>NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.acceptProfile({profile:{handle:'long_public_handle',displayName:'Avery Sample'}},'qa-a',serverSyncClient.accountSnapshot().generation));} ],
    ['offline',async()=>{await signIn();await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});dispatchEvent(new Event('offline'));});await setState('error',{id:owner,email:owner+'@example.invalid'});} ],
    ['reconnect',async()=>{await signIn('qa-a',true);} ]];
   for(const theme of ['day','night'])for(const [expected,prepare] of modes){
    await page.evaluate(theme=>{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});document.documentElement.dataset.theme=theme;},theme);
    await prepare();await status(expected);
    const geometry=await chip.evaluate(b=>{const r=b.getBoundingClientRect(),l=b.querySelector('.account-awareness-label').getBoundingClientRect();return{x:r.x,right:r.right,height:r.height,labelWidth:l.width,labelRight:l.right,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert(geometry.x>=0&&geometry.right<=width+.1&&geometry.height>=44&&geometry.labelWidth>0&&geometry.labelRight<=geometry.right+.1&&!geometry.overflow,JSON.stringify({width,theme,expected,geometry}));
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
    await signIn('qa-a');await page.evaluate(old=>NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.acceptProfile({profile:{handle:'STALE_PROFILE'}},'qa-a',old),life.generation);
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
    failHelper=true;await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
    await page.locator('#accountIndicatorFallback').waitFor();await page.locator('#accountIndicatorFallback').click();await page.locator('#settingsModal.show').waitFor();await page.locator('#closeSettingsBtn').click();behaviours++;
    failHelper=false;holdHelper=true;await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());
    await page.locator('#accountIndicatorFallback').click();await page.locator('#settingsModal.show').waitFor();await page.locator('#closeSettingsBtn').click();
    for(let i=0;i<100&&!releaseHelper;i++)await delay(20);assert(releaseHelper);holdHelper=false;releaseHelper();await page.waitForFunction(()=>Boolean(accountIndicatorController));assert.equal(await page.locator('#accountIndicator button').count(),1);behaviours++;
   }
   assert.deepEqual(errors,[],'No unhandled mounted-app errors');allErrors.push(...errors);await context.close();
  }
  const result={engine:engineName,actualMountedApp:true,layouts,behaviours,errors:allErrors,transport:'loopback static candidate, mocked disposable API; external origins blocked',limits:'Component and local integration evidence; no hosted, real account or physical device claim'};
  if(output)fs.writeFileSync(path.join(output,engineName+'-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
