#!/usr/bin/env node
'use strict';
// Bounded disposable loopback UI proof. No installed worker or real account.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const output=process.env.PEACH_QA_OUTPUT;
const engines=process.env.PEACH_QA_ENGINE?[process.env.PEACH_QA_ENGINE]:['chromium','webkit'];
const modalHistoryOnly=process.env.PEACH_QA_CASE==='modal-history';
const timelineOnly=process.env.PEACH_QA_CASE==='timeline-modal';
const timelineControlsOnly=process.env.PEACH_QA_CASE==='timeline-controls';
const records=[],errors=[],blocked=new Set();let server,browser,activePage,requests=0,timedOut=false;
const fixture=require('../data/events.json').events.find(event=>event.key==='cricket');assert(fixture,'retained source fixture for renderer checks');
const receipt={mode:'Disposable local browser, API unavailable; no installed/hosted/physical acceptance',engines,records,errors,blocked:[],cleanup:{}};
const digest=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex');
const inputFiles=['index.html','assets/js/app-shell-runtime.js','assets/js/app-update.js','assets/styles/nothingsport-foundation.css','styles/follow-feed-rework.css','assets/styles/card-clarity.css','assets/styles/notifications-inbox.css','scripts/validate-peach-redesign-browser.js'];
const inputHashes=()=>Object.fromEntries(inputFiles.map(file=>[file,digest(fs.readFileSync(path.join(root,file)))]));
const git=(...args)=>require('node:child_process').execFileSync('git',args,{cwd:root,maxBuffer:16*1024*1024});
const testedHead=git('rev-parse','HEAD').toString().trim(),testedTree=git('rev-parse','HEAD^{tree}').toString().trim(),servedHashes=new Map();
receipt.inputBinding={head:testedHead,tree:testedTree,start:inputHashes()};
if(output)fs.mkdirSync(output,{recursive:true});
async function check(label,operation){await operation();records.push({label,passed:true});console.log(label);}
async function modalHistory(page,engine){
 const choices=()=>page.evaluate(()=>JSON.stringify({sports:userPreferences.followedSports,graph:userPreferences.preferenceGraph,selected:userPreferences.selectedSelectorEntityIds,first:userPreferences.followFirst?.excludedMajorEventIds,scope:userPreferences.eventsScope}));
 const original=await choices();
 async function observe(phase){
  const state=await page.evaluate(()=>({hash:location.hash,settings:document.getElementById('settingsModal').classList.contains('show'),section:settingsSection,nsc:document.body.classList.contains('nsc-open'),
   inert:[...document.querySelectorAll('#mainContent,header.top,nav.tabs')].map(node=>node.inert),
   focus:document.activeElement?.id,settingsFocus:document.getElementById('settingsModal').contains(document.activeElement),nscFocus:document.getElementById('nothingscoreDrawer').contains(document.activeElement)}));
  (receipt.modalHistory||=[]).push({engine,phase,...state});return state;
 }
 async function overlap(){
  await page.locator('#nothingscoreBtn').click();
  await page.getByRole('tab',{name:'Global Leaderboard',exact:true}).waitFor();
  const guestButtons=await page.getByRole('button',{name:'Open sign in',exact:true}).count();
  (receipt.guestControlObservations||=[]).push({engine,guestButtons,actualPath:'Leader Board → native Back → header Account → browser Forward'});
  await page.locator('#closeNothingscoreBtn').click();await page.waitForFunction(()=>!document.body.classList.contains('nsc-open')&&location.hash!=='#nsc');
  await page.locator('#accountIndicator button:visible').first().click();await page.waitForFunction(()=>settingsSection==='account'&&document.getElementById('settingsModal').classList.contains('show'));
  await page.goForward();await page.waitForFunction(()=>location.hash==='#nsc'&&document.body.classList.contains('nsc-open'));
  const state=await observe('history-forward-overlap');assert.equal(state.settings,true);assert(state.inert.every(Boolean));
 }
 await overlap();
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.body.classList.contains('nsc-open')&&document.getElementById('settingsModal').classList.contains('show'));
 const retained=await observe('escape-closes-nsc-settings-stays');
 assert.equal(retained.section,'main');assert(retained.inert.every(Boolean),'closing NSC must retain background isolation while Settings remains open');
 assert.equal(retained.settingsFocus,true,'closing NSC cannot restore focus behind visible Settings');
 await page.locator('#closeSettingsBtn').click();const closed=await observe('settings-closes-last');assert(closed.inert.every(value=>!value));assert.equal(closed.settings,false);
 records.push({label:`${engine}: native history/Escape closes NSC first, Settings retains isolation/focus`,passed:true});
 await overlap();
 // NSC is visually above Settings. Exercise the existing close owner directly
 // rather than force-clicking a Settings control behind that visible drawer.
 await page.evaluate(()=>closeSettings());
 const nsc=await observe('settings-owner-closes-first');assert.equal(nsc.settings,false);assert.equal(nsc.nsc,true);assert(nsc.inert.every(Boolean));assert.equal(nsc.nscFocus,true);
 await page.locator('#closeNothingscoreBtn').click();await page.waitForFunction(()=>!document.body.classList.contains('nsc-open'));
 const last=await observe('nsc-closes-last');assert(last.inert.every(value=>!value));assert.equal(last.settings,false);
 assert.equal(await choices(),original,'modal history and both close orders preserve every saved choice');
 records.push({label:`${engine}: Settings close owner first, NSC retains isolation/focus; both close orders preserve choices`,passed:true});
}
async function timelineModal(page,engine){
 await page.locator('#timelineTools').waitFor({state:'visible'});
 await page.locator('#accountIndicator button:visible').first().click();await page.locator('#settingsModal').waitFor({state:'visible'});
 const before=await page.evaluate(()=>['feedViewFilterBtn','timelineExpandBtn','jumpTodayBtn'].map(id=>{
  const button=document.getElementById(id);button.focus();return {id,inert:!!button.closest('[inert]'),focused:document.activeElement===button};
 }));
 (receipt.timelineIsolation||=[]).push({engine,phase:'settings-open',controls:before});
 assert(before.every(control=>control.inert&&!control.focused),'all three existing timeline controls must be inert and unfocusable behind Settings');
 await page.locator('#closeSettingsBtn').click();
 const after=await page.evaluate(()=>['feedViewFilterBtn','timelineExpandBtn','jumpTodayBtn'].map(id=>{
  const button=document.getElementById(id);button.focus();return {id,inert:!!button.closest('[inert]'),focused:document.activeElement===button};
 }));
 receipt.timelineIsolation.push({engine,phase:'settings-closed',controls:after});
 assert(after.every(control=>!control.inert&&control.focused),'closing the last modal restores all timeline controls');
 records.push({label:`${engine}: existing Feed timeline controls isolate and restore with Settings`,passed:true});
}
async function timelineControls(page,engine){
 const choices=()=>page.evaluate(()=>JSON.stringify({sports:userPreferences.followedSports,selected:userPreferences.selectedSelectorEntityIds,
  entities:userPreferences.preferenceGraph?.entityFollows,competitions:userPreferences.preferenceGraph?.competitionPreferences,
  excluded:userPreferences.followFirst?.excludedMajorEventIds,results:userPreferences.showSpoilers,filters:feedViewFilters}));
 const original=await choices();
 async function geometry(label){
  const state=await page.evaluate(()=>{
   const nav=document.querySelector('nav.tabs'),tools=document.getElementById('timelineTools'),box=nav.getBoundingClientRect();
   return {width:innerWidth,height:innerHeight,navSpace:getComputedStyle(document.documentElement).getPropertyValue('--ns-nav-space'),
    nav:{...box.toJSON(),position:getComputedStyle(nav).position,z:getComputedStyle(nav).zIndex},
    tools:{...tools.getBoundingClientRect().toJSON(),hidden:tools.hidden,inert:tools.inert,bottom:getComputedStyle(tools).bottom,z:getComputedStyle(tools).zIndex},
    controls:['feedViewFilterBtn','timelineExpandBtn','jumpTodayBtn'].map(id=>{const button=document.getElementById(id),r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
     return {id,...r.toJSON(),hidden:button.hidden,label:button.getAttribute('aria-label'),hit:button.contains(document.elementFromPoint(x,y)),
      stack:document.elementsFromPoint(x,y).slice(0,5).map(node=>({tag:node.tagName,id:node.id,className:node.getAttribute('class')}))};})};
  });
  (receipt.timelineGeometry||=[]).push({engine,label,...state});
  if(output)await page.screenshot({path:path.join(output,`${engine}-timeline-${label}.png`)});
  assert.equal(state.nav.position,'fixed','the actual fixed-footer stylesheet must be loaded before qualifying this case');
  assert(state.nav.height>=70&&state.navSpace.trim(),'the actual peach navigation space must be resolved');
  assert.equal(state.tools.hidden,false);assert.equal(state.tools.inert,false);
  assert(state.tools.bottom<=state.nav.top-8,'Feed controls must clear the fixed bottom navigation');
  assert(state.controls.every(button=>!button.hidden&&button.width>=44&&button.height>=44&&button.label&&button.hit),
   'all three Feed controls must have unobstructed native pointer targets');
  records.push({label:`${engine}: timeline ${label} clears footer and all three hit targets`,passed:true});
 }
 for(const width of [390,320,768,1280])for(const theme of ['night','day']){
  await page.setViewportSize({width,height:844});await page.evaluate(theme=>{applyThemePreference(theme);window.scrollTo(0,0);},theme);
  await geometry(`${width}-${theme}`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{applyThemePreference('night');document.documentElement.style.setProperty('--ns-nav-space','112px');});
 try{await geometry('390-increased-footer-space');}finally{await page.evaluate(()=>document.documentElement.style.removeProperty('--ns-nav-space'));}
 await page.locator('#feedViewFilterBtn').click();
 const dialog=page.getByRole('dialog',{name:'Filter Feed',exact:true});await dialog.waitFor();
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>document.activeElement.id),'feedViewFilterBtn');
 const initialCompact=await page.evaluate(()=>Boolean(userPreferences.feedCompact));
 for(const target of [!initialCompact,initialCompact]){
  await page.locator('#timelineExpandBtn').click();await page.waitForFunction(value=>Boolean(userPreferences.feedCompact)===value,target);
  assert.equal(await page.locator('#timelineExpandBtn').getAttribute('aria-label'),target?'Expand all cards':'Collapse all cards');
 }
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const destination=await page.locator('#jumpTodayBtn').getAttribute('data-jump-destination');
 assert(['today','now'].includes(destination));await page.locator('#jumpTodayBtn').click();
 await page.waitForFunction(destination=>{const marker=document.getElementById(destination==='today'?activeTodayAnchorId():'calendarNowAnchor');
  if(!marker)return false;const r=marker.getBoundingClientRect();return r.top>=-1&&r.top<innerHeight;},destination);
 await geometry('390-after-native-controls');
 assert.equal(await choices(),original,'floating controls preserve Follow, Results and filter choices');
 records.push({label:`${engine}: native Filter open/close, compact toggle/restore and contextual jump`,passed:true});
}
(async()=>{
 const deadline=setTimeout(()=>{timedOut=true;void browser?.close();server?.closeAllConnections();},180000);
 try{
  server=http.createServer((req,res)=>{
   requests++;if(requests>600){res.writeHead(429);res.end();return;}
   const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
   if(url.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   const type={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
   const bytes=fs.readFileSync(file),relative=path.relative(root,file),hash=digest(bytes);
   if(!servedHashes.has(relative))servedHashes.set(relative,new Set());servedHashes.get(relative).add(hash);
   res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(bytes);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;receipt.origin=base;
  for(const engine of engines){
   assert(['chromium','webkit'].includes(engine));browser=await pw[engine].launch({headless:true});
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   context.setDefaultTimeout(10000);
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base){blocked.add(url.origin);return route.abort('blockedbyclient');}
    return route.continue();
   });
   await context.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'night',followedSports:['cricket'],selectedSelectorEntityIds:['sport:cricket']})));
   const page=await context.newPage();activePage=page;page.on('pageerror',error=>errors.push({engine,message:error.message}));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:45000});
   await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();acknowledgeSelectorRelease();if(document.getElementById('selectorOptInModal').classList.contains('show'))closeSelectorOptInPrompt();});
   if(!timelineOnly&&!timelineControlsOnly)await modalHistory(page,engine);
   if(!modalHistoryOnly&&!timelineControlsOnly)await timelineModal(page,engine);
   if(!modalHistoryOnly&&!timelineOnly)await timelineControls(page,engine);
   if(modalHistoryOnly||timelineOnly||timelineControlsOnly){assert.deepEqual(errors,[]);await context.close();await browser.close();browser=null;continue;}
   await page.evaluate(fixture=>{
    const host=document.createElement('section');host.id='peach-rendered-card';setCardState(fixture,'opened');host.append(buildEventCard(fixture));document.getElementById('mainContent').append(host);
   },fixture);
   const choices=()=>page.evaluate(()=>JSON.stringify({sports:userPreferences.followedSports,graph:userPreferences.preferenceGraph,selected:userPreferences.selectedSelectorEntityIds,first:userPreferences.followFirst?.excludedMajorEventIds,scope:userPreferences.eventsScope}));
   const originalChoices=await choices();
   let documentChoices=originalChoices;
   for(const width of [320,390,768,1280])for(const theme of ['day','night']){
    await page.setViewportSize({width,height:844});await page.evaluate(theme=>{applyThemePreference(theme);window.scrollTo(0,0);},theme);
    await check(`${engine}/${width}/${theme}: fixed three destinations and clearance`,async()=>{
     const geometry=await page.evaluate(()=>{
      const nav=document.querySelector('nav.tabs'),box=nav.getBoundingClientRect();
      return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,bottom:box.bottom,position:getComputedStyle(nav).position,
       tabs:[...nav.querySelectorAll('button')].map(b=>({tab:b.dataset.tab,height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width,label:b.textContent.trim()})),
       clearance:parseFloat(getComputedStyle(document.body).paddingBottom),height:box.height,more:getComputedStyle(document.getElementById('headerMoreBtn')).display};
     });
     assert.equal(geometry.overflow,false);assert.equal(geometry.position,'fixed');assert(Math.abs(geometry.bottom-844)<1);
     assert.deepEqual(geometry.tabs.map(tab=>tab.tab),['feed','match-centre','follow']);assert(geometry.tabs.every(tab=>tab.height>=44&&tab.width>=44&&tab.label));
     assert(geometry.clearance>=geometry.height);assert.equal(geometry.more==='none',width>=768);
     if(output&&width===390)await page.screenshot({path:path.join(output,`${engine}-${theme}-390.png`)});
    });
   }
   await page.setViewportSize({width:390,height:844});
   await check(`${engine}: retained source card native collapse and expand`,async()=>{
    const host=page.locator('#peach-rendered-card');await host.locator('.event-card-disclosure').click();
    await host.locator('.minimised-card-summary').click();await host.locator('.event-card-disclosure').waitFor();
    assert.equal(await choices(),originalChoices);
    await page.evaluate(()=>window.scrollTo(0,0));
   });
   await check(`${engine}: System follows both appearances and reduced motion`,async()=>{
    await page.evaluate(()=>{userPreferences.theme='system';applyThemePreference('system');});
    for(const colorScheme of ['dark','light']){
     await page.emulateMedia({colorScheme,reducedMotion:'reduce'});
     await page.waitForFunction(dark=>matchMedia('(prefers-color-scheme: dark)').matches===dark,colorScheme==='dark');
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.waitForFunction(expected=>getComputedStyle(document.body).backgroundColor===expected,colorScheme==='dark'?'rgb(12, 16, 16)':'rgb(248, 241, 245)',{timeout:1000});
     assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'system');
     const sample=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,preference:userPreferences.theme,
      dark:matchMedia('(prefers-color-scheme: dark)').matches,light:matchMedia('(prefers-color-scheme: light)').matches,
      background:getComputedStyle(document.body).backgroundColor,nsBg:getComputedStyle(document.documentElement).getPropertyValue('--ns-bg'),bg:getComputedStyle(document.documentElement).getPropertyValue('--bg'),
      sheets:[...document.styleSheets].map(sheet=>({href:sheet.href,rules:sheet.cssRules.length}))}));
     (receipt.systemSamples||=[]).push({engine,colorScheme,...sample});
     assert.equal(sample.background,colorScheme==='dark'?'rgb(12, 16, 16)':'rgb(248, 241, 245)');
    }
    await page.evaluate(()=>{userPreferences.theme='night';applyThemePreference('night');});
    assert.equal(await page.locator('header.top').evaluate(element=>getComputedStyle(element).transitionDuration),'0s');
   });
   await check(`${engine}: More native controls, Escape and focus`,async()=>{
    const more=page.locator('#headerMoreBtn');await more.click();
    assert.equal(await more.getAttribute('aria-expanded'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsBtn');
    for(const id of ['settingsBtn','calendarSyncBtn','shareAppBtn'])assert(await page.locator('#'+id).isVisible());
    await page.keyboard.press('Escape');assert.equal(await more.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.id),'headerMoreBtn');
    await more.click();await page.locator('#settingsBtn').click();await page.locator('#settingsModal').waitFor({state:'visible'});
    assert.equal(await page.locator('header.top').evaluate(node=>node.inert),true);assert.equal(await page.locator('nav.tabs').evaluate(node=>node.inert),true);
    assert.equal(await page.locator('.app-footer').evaluate(node=>node.inert),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'closeSettingsBtn');
    await page.evaluate(()=>closeSettings());assert.equal(await page.locator('nav.tabs').evaluate(node=>node.inert),false);
   });
   await check(`${engine}: scroll direction and keyboard pin`,async()=>{
    await page.evaluate(()=>{document.activeElement?.blur();const space=document.createElement('div');space.id='peach-scroll-space';space.style.height='2400px';document.body.append(space);window.scrollTo(0,0);});
    await page.mouse.move(200,500);
    await page.mouse.wheel(0,650);await page.waitForFunction(()=>document.querySelector('header.top').classList.contains('is-scroll-hidden'));
    assert(Math.abs((await page.locator('nav.tabs').boundingBox()).y+(await page.locator('nav.tabs').boundingBox()).height-844)<1);
    await page.mouse.wheel(0,-120);await page.waitForFunction(()=>!document.querySelector('header.top').classList.contains('is-scroll-hidden'));
    await page.locator('#headerMoreBtn').focus();await page.mouse.wheel(0,180);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('header.top').evaluate(node=>node.classList.contains('is-scroll-hidden')),false);
    await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,document.body.scrollHeight);});
    await page.locator('#peach-scroll-space').evaluate(node=>node.remove());await page.evaluate(()=>window.scrollTo(0,0));
   });
   await check(`${engine}: actual tabs, legacy routes, Inspector cleanup and Back`,async()=>{
    await page.locator('[data-tab="follow"]').click();await page.waitForFunction(()=>activeTab==='follow');
    await page.evaluate(()=>openCodeInspector('sport:cricket',{pushHistory:true}));
    assert.equal(await page.evaluate(()=>activeInspectorCodeId),'sport:cricket');
    await page.getByRole('button',{name:'Major Events',exact:true}).click();
    await page.waitForFunction(()=>followViewSection==='major-events');
    assert.equal(await choices(),originalChoices,'retained discovery cannot alter saved choices');
    for(const hash of ['#events','#events/major/us-open','#events/alert/tickets']){
     await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForFunction(()=>activeTab==='match-centre'&&location.hash==='#match-centre');
     assert.equal(await page.evaluate(()=>activeInspectorCodeId),null);assert.equal(await page.locator('[data-tab="match-centre"]').getAttribute('class').then(value=>value.includes('active')),true);
    }
    await page.locator('[data-tab="follow"]').click();await page.waitForFunction(()=>location.hash==='#follow');
    await page.goBack();await page.waitForFunction(()=>activeTab==='match-centre');
    await page.locator('[data-tab="feed"]').click();await page.waitForFunction(()=>activeTab==='feed');
    assert.equal(await choices(),originalChoices,'navigation cannot change saved follow/major-event choices');
   });
   await check(`${engine}: actual notification URL retains fixture and choices`,async()=>{
    await page.goto(base+'/?event='+encodeURIComponent(fixture.eventId||fixture.id),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:45000});
    assert.equal(await page.evaluate(()=>activeTab),'feed');
    assert.equal(await page.evaluate(()=>pendingNotificationEventId),String(fixture.eventId||fixture.id));
    const restored=JSON.parse(await choices()),expected=JSON.parse(originalChoices);
    const stamp=Date.parse(restored.graph.updatedAt),clock=await page.evaluate(()=>({start:performance.timeOrigin,now:Date.now()}));
    assert(stamp>=Math.floor(clock.start)&&stamp<=clock.now,'restored graph stamp belongs to this actual document');
    assert(stamp>=Date.parse(expected.graph.updatedAt));expected.graph.updatedAt=restored.graph.updatedAt;
    assert.deepEqual(restored,expected,'complete restored choices permit only their source-owned graph timestamp; key order is not choice identity');
    documentChoices=await choices();
   });
   await check(`${engine}: real recovery explanation survives Account rerender`,async()=>{
    await page.evaluate(()=>{
     const token='qa.'+btoa(JSON.stringify({sub:'disposable-peach-owner'}))+'.local';
     sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:token,refreshToken:'disposable-local-only',expiresAt:Date.now()+3600000}));
     serverPersistence={...serverPersistence,state:'error',user:{id:'disposable-peach-owner'},message:'Disposable local UI fixture'};
     openSettings({section:'account'});
    });
    const open=page.locator('[data-local-recovery-open]'),warning=page.locator('[data-local-recovery-warning]');
    await open.waitFor();await open.click();assert(await warning.isVisible());
    await page.evaluate(()=>renderSettingsScreen());await warning.waitFor({state:'visible'});
    await page.locator('[data-local-recovery-confirm]').focus();assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-local-recovery-confirm')),true);
    assert.equal(await page.locator('nav.tabs').evaluate(node=>node.inert),true);
    await page.evaluate(()=>closeSettings());
    await page.evaluate(()=>openSettings({section:'account'}));await open.waitFor();assert.equal(await warning.isVisible(),false,'new settings opening needs a fresh explanation');
    await page.evaluate(()=>closeSettings());assert.equal(await choices(),documentChoices);
   });
   assert.deepEqual(errors,[]);await context.close();await browser.close();browser=null;
  }
  assert.equal(timedOut,false);assert(requests<=600,'owned loopback request ceiling');receipt.passed=true;
 }catch(error){
  receipt.passed=false;receipt.failure=error.stack;
  if(activePage&&!activePage.isClosed())receipt.failureState=await activePage.evaluate(()=>({scrollY,bodyClass:document.body.className,activeId:document.activeElement?.id,openModals:[...document.querySelectorAll('.modal-backdrop.show')].map(node=>node.id)})).catch(()=>null);
  throw error;
 }
 finally{
  clearTimeout(deadline);if(browser)await browser.close();receipt.cleanup.browserClosed=true;
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}receipt.cleanup.serverClosed=true;
  receipt.requests=requests;receipt.blocked=[...blocked];receipt.timedOut=timedOut;
  const binding=receipt.inputBinding;binding.end=inputHashes();binding.endHead=git('rev-parse','HEAD').toString().trim();
  binding.startEndEqual=JSON.stringify(binding.start)===JSON.stringify(binding.end);
  binding.committedInputsMatch=Object.entries(binding.start).every(([file,hash])=>digest(git('show',testedHead+':'+file))===hash);
  binding.served=Object.fromEntries([...servedHashes].sort(([a],[b])=>a.localeCompare(b)).map(([file,hashes])=>[file,[...hashes]]));
  binding.servedMatchesCommit=Object.entries(binding.served).every(([file,hashes])=>hashes.length===1&&digest(git('show',testedHead+':'+file))===hashes[0]);
  const bound=binding.startEndEqual&&binding.committedInputsMatch&&binding.servedMatchesCommit&&binding.endHead===testedHead;
  if(!bound){receipt.passed=false;receipt.failure||='Browser input binding changed or did not match the recorded commit';}
  if(output)fs.writeFileSync(path.join(output,'peach-browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
  assert(bound,'start/end inputs and actual served bytes must match the tested commit');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
