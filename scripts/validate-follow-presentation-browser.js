'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.replace(/^\//,'')||'index.html';
  if(name.includes('..')){res.writeHead(400);res.end();return;}
  fs.readFile(path.join(root,name),(error,bytes)=>{res.writeHead(error?404:200,{'content-type':({'.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(name)]||'text/html'});res.end(error?'':bytes);});
});
async function ready(page,preferences={onboardingComplete:true,followedSports:[],selectedSelectorEntityIds:[]}){
  await page.addInitScript(p=>localStorage.setItem('ns_preferences_v1',JSON.stringify(p)),preferences);
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Isolated presentation QA'}}));
  await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:60000});
}
const openFollow=page=>page.locator('[data-tab="follow"]').click();
const savedChoices=page=>page.evaluate(()=>JSON.stringify({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds,entities:userPreferences.preferenceGraph.entityFollows,spoilers:userPreferences.showSpoilers,theme:userPreferences.theme,notifications:userPreferences.notifications}));
const pickerChoices=page=>page.evaluate(()=>JSON.stringify({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds,graph:userPreferences.preferenceGraph,followFirst:userPreferences.followFirst,spoilers:userPreferences.showSpoilers,theme:userPreferences.theme,notifications:userPreferences.notifications,actions:eventActions}));
async function assertFollowPickerJourney(page){
  const originalViewport=page.viewportSize();
  await page.setViewportSize({width:originalViewport.width,height:originalViewport.width<=320?568:664});
  await page.locator('#startupLaunch').waitFor({state:'hidden'});
  await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
  await page.locator('.tabs [data-tab=follow]').tap();
  await page.locator('.follow-home-tabs').getByRole('button',{name:'Sports',exact:true}).tap();
  await page.locator('.follow-navigation').waitFor();
  const before=await pickerChoices(page);
  const expand=async()=>{if(await page.locator('.follow-navigation-toggle').getAttribute('aria-expanded')==='false')await page.getByRole('button',{name:'Expand Sports menu',exact:true}).tap();};
  const selectSport=async id=>{
    await expand();const primary=page.locator('.follow-sport-bar > [data-follow-sport="'+id+'"]');
    if(await primary.count())await primary.tap();
    else{await page.getByRole('button',{name:'More sports',exact:true}).tap();await page.getByRole('dialog',{name:'More sports',exact:true}).locator('[data-follow-sport="'+id+'"]').tap();}
  };
  await selectSport('sport:tennis');
  await expand();
  await page.getByRole('tab',{name:'Women',exact:true}).tap();
  const open=async()=>{await expand();await page.getByRole('button',{name:'More sports',exact:true}).tap();await page.getByRole('dialog',{name:'More sports',exact:true}).waitFor();};
  const scroll=async()=>{
    await page.evaluate(()=>scrollTo(0,0));
    await page.waitForTimeout(250); // Beyond the real navigation owner's 150ms scroll lock.
    const moved=await page.evaluate(()=>{const before=scrollY;scrollBy(0,150);return {before,after:scrollY};});
    assert(moved.after>moved.before+6&&moved.after>100,'Replay must reach the actual downward-scroll collapse boundary');
    await page.waitForTimeout(100);
    return moved;
  };
  const usable=async()=>{
    const state=await page.locator('.follow-more-dialog[open]').evaluate(d=>({open:d.open,modal:d.matches(':modal'),visible:d.getBoundingClientRect().height>0,hiddenAncestor:Boolean(d.closest('[hidden]'))}));
    assert.deepEqual(state,{open:true,modal:true,visible:true,hiddenAncestor:false},'An open native picker must stay visible and tappable after background scrolling: '+JSON.stringify(state));
    assert.equal(await page.locator('.follow-navigation-toggle').getAttribute('aria-expanded'),'true');
  };
  const released=async()=>{
    assert.equal(await page.locator('dialog[open]').count(),0,'Closing must release every native modal');
    await page.keyboard.press('Tab');
    assert(await page.evaluate(()=>{const e=document.activeElement;return e&&e!==document.body&&!e.closest('dialog')&&e.getBoundingClientRect().height>0;}),'Native cancellation must leave keyboard focus on a visible connected control');
  };
  await open();const movement=await scroll();await usable();
  const dialog=await page.getByRole('dialog',{name:'More sports',exact:true}).elementHandle();
  await page.evaluate(()=>{renderAll();renderFollowView();});
  assert(await dialog.evaluate(d=>d.isConnected&&d.open),'A background redraw must preserve the same open native dialog');await usable();
  await page.getByRole('dialog',{name:'More sports',exact:true}).getByRole('button',{name:'Close',exact:true}).tap();await released();
  await open();await page.keyboard.press('Escape');await released();
  await scroll();
  assert.equal(await page.locator('.follow-navigation-toggle').getAttribute('aria-expanded'),'false','Ordinary downward scrolling must still collapse the toolbar without a modal');
  for(let i=0;i<2;i++){
    await open();if(i===0){await scroll();await usable();}
    const choice=page.getByRole('dialog',{name:'More sports',exact:true}).locator('[data-follow-sport]').first(),id=await choice.getAttribute('data-follow-sport');
    await choice.tap();
    await page.waitForFunction(id=>followBrowseState().sportId===id,id);
    assert.equal(await page.locator('dialog[open]').count(),0,'Selecting a sport must release the native modal');
    assert.equal(await page.locator('.follow-navigation-toggle').getAttribute('aria-expanded'),'false','Selection closes Sports');
  }
  await selectSport('sport:tennis');
  await expand();
  assert.equal(await page.getByRole('tab',{name:'Women',exact:true}).getAttribute('aria-selected'),'true','Tennis remembers its own gender choice');
  await page.locator('.tabs [data-tab=feed]').tap();await page.waitForFunction(()=>activeTab==='feed');
  await page.locator('.tabs [data-tab=follow]').tap();await page.locator('.follow-navigation').waitFor();
  assert.equal(await page.evaluate(()=>followBrowseState().sportId),'sport:tennis','Returning to Follow retains the parent sport');
  await expand();
  assert.equal(await page.getByRole('tab',{name:'Women',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await pickerChoices(page),before,'Picker interactions cannot alter follows, exclusions, personal filters, Results or Remind OFF');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.setViewportSize(originalViewport);
  return {phoneHeight:originalViewport.width<=320?568:664,scrollWhileModalOpen:true,movement,redrawPreservedDialog:true,nativeCloseAndCancel:true,ordinaryCollapse:true,repeatedSportSelection:2,feedRoundtrip:true,choicesPreserved:true};
}
module.exports={assertFollowPickerJourney,ready};
async function directory(page,sport){
  await page.evaluate(sport=>{saveFollowBrowse({sportId:'sport:'+sport,categoryId:'sport:'+sport,section:'teams-players'});renderFollowView();},sport);
  if(sport==='football')try{await page.locator('.follow-directory-tabs').getByRole('button',{name:'Teams',exact:true}).click();}catch(error){console.error('Football tabs',await directoryState(page));throw error;}
  try{await page.locator(sport==='football'?'.football-club-row':'.follow-directory-row').first().waitFor();}catch(error){
    console.error('Original directory assertion',sport,await directoryState(page));throw error;
  }
}
const directoryState=page=>page.evaluate(()=>({tab:activeTab,browse:followBrowseState(),legacyHost:Boolean(document.getElementById('standingsContext')),directoryRuntime:Boolean(footballDirectoryApi),footballLoaded:Boolean(footballDirectoryData),footballLoading:footballDirectoryLoading,footballError:footballDirectoryError?.message||null,session:readStandingsDirectorySession(),loaded:[...followDirectoryChunks.keys()],scrollActive:scrollMomentumActive,pendingMutation:pendingScrollIdleMutation?.toString().slice(0,160)||null,trace:globalThis.qaDirectoryTrace||[],rows:document.querySelectorAll('.follow-directory-row,.football-club-row').length,text:document.querySelector('#listView')?.innerText.slice(0,1200)}));
async function coldDirectoryCase(browser,engine){
  const context=await browser.newContext({viewport:{width:390,height:664},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  let release,reads=0;const gate=new Promise(resolve=>{release=resolve;});
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.route('**/data/follow-directory/tennis-women.v1.*',async route=>{reads++;await gate;await route.continue();});
    await ready(page,{onboardingComplete:true,followedSports:[],selectedSelectorEntityIds:[],followBrowse:{sportId:'sport:tennis',categoryId:'sport:tennis',section:'teams-players',gender:'men',genderBySport:{'sport:tennis':'men'}}});
    await page.locator('#startupLaunch').waitFor({state:'hidden'});
    await openFollow(page);await page.locator('.follow-navigation').waitFor();
    await page.waitForFunction(()=>footballDirectoryApi&&followDirectoryChunks.has('tennis'));
    await page.evaluate(()=>{
      const original=queueScrollIdleMutation;globalThis.qaDirectoryTrace=[];
      queueScrollIdleMutation=function(mutation){
        const state={at:performance.now(),tab:activeTab,sport:followBrowseState().sportId,active:scrollMomentumActive,old:pendingScrollIdleMutation?.toString().slice(0,160)||null,next:mutation.toString().slice(0,160)};
        const result=original(mutation);state.queued=result;qaDirectoryTrace.push(state);return result;
      };
    });
    // Let unrelated startup reads finish before releasing this single cold read.
    await page.waitForTimeout(1000);
    const initial=await directoryState(page);
    assert(initial.rows>0,'The initial downloaded Follow directory must survive concurrent Feed-only redraws: '+JSON.stringify(initial));
    const choices=await pickerChoices(page);
    if(await page.locator('.follow-navigation-toggle').getAttribute('aria-expanded')==='false')await page.getByRole('button',{name:'Expand Sports menu',exact:true}).tap();
    await page.getByRole('tab',{name:'Women',exact:true}).tap();
    await page.waitForFunction(()=>followDirectoryChunkLoading.has('tennis-women'));
    const before=await directoryState(page);assert(!before.loaded.includes('tennis-women'));
    release();await page.waitForFunction(()=>followDirectoryChunks.has('tennis-women')&&footballDirectoryApi);
    try{await page.waitForFunction(()=>document.querySelectorAll('.follow-directory-row').length>0,null,{timeout:1500});}catch(error){
      console.error('Cold directory response did not redraw',JSON.stringify({engine,reads,before,after:await directoryState(page),errors}));throw error;
    }
    const after=await directoryState(page);assert(!after.text.includes('Loading the current Tennis directory'));
    assert.equal(await pickerChoices(page),choices,'Cold directory settlement cannot alter personal choices');assert.deepEqual(errors,[]);
    return {engine,coldWomenDirectory:true,reads,initial,before,after,choicesPreserved:true,errors};
  }finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await context.close();}
}
if(require.main===module)(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const evidence={at:new Date().toISOString(),url:process.env.QA_BASE_URL||'local candidate',checks:[]};
  try{
    for(const engine of (process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit'])){
      const browser=await engines[engine].launch({headless:true});
      try{
        if(process.env.FOLLOW_PICKER_ONLY!=='1'&&process.env.FOLLOW_PRESENTATION_ONLY!=='1')evidence.checks.push(await coldDirectoryCase(browser,engine));
        if(process.env.FOLLOW_DIRECTORY_ONLY==='1')continue;
        for(const width of (process.env.FOLLOW_PRESENTATION_ONLY==='1'?[]:[320,390]))for(const availability of ['available','delayed','unavailable']){
          const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
          let release;const gate=new Promise(resolve=>{release=resolve;});let directoryReads=0;
          page.on('pageerror',error=>errors.push(error.message));
          try{
            console.log(engine+': '+width+'px native picker, '+availability+' directory');
            await page.route('**/data/follow-directory/tennis-women.v1.*',async route=>{directoryReads++;if(availability==='delayed')await gate;if(availability==='unavailable')return route.fulfill({status:503,body:'Controlled directory failure'});await route.continue();});
            await ready(page,{onboardingComplete:true,followedSports:[],selectedSelectorEntityIds:[],followBrowse:{sportId:'sport:tennis',categoryId:'sport:tennis',section:'teams-players',gender:'men',genderBySport:{'sport:tennis':'men'}},preferenceGraph:{entityFollows:[{participantId:'team:football:epl:2',followLevel:'mute'}]},followFirst:{notifications:{userChoice:false,enabled:false,autoRemindersEnabled:false,sportingRemindersEnabled:false}}});
            const picker=await assertFollowPickerJourney(page);assert.deepEqual(errors,[]);
            assert(directoryReads>0,'The replay must actually request the women directory');
            if(availability==='delayed')assert.equal(await page.evaluate(()=>followDirectoryChunks.has('tennis-women')),false,'Picker completes while its public directory is genuinely still pending');
            if(availability==='unavailable')assert.equal(await page.evaluate(()=>followDirectoryChunks.has('tennis-women')),false,'Picker completes without a successful directory response');
            evidence.checks.push({engine,width,availability,picker,directoryReads,errors});
          }finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await context.close();}
        }
        if(process.env.FOLLOW_PICKER_ONLY==='1')continue;
        for(const width of [320,390,768,1280]){
          console.log(engine+': '+width+'px original presentation');
          const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let requests=0;
          page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/follow-presentation-ui.js'))requests++;});
          await ready(page);assert.equal(requests,0,'Feed startup must not fetch Follow presentation');
          page.setDefaultTimeout(15000);
          const initial=await savedChoices(page);
          await openFollow(page);await page.locator('.follow-navigation').waitFor();assert.equal(requests,1);
          assert.equal(await savedChoices(page),initial,'opening Follow cannot change follows, spoiler, appearance or notification choices');
          await directory(page,'ice-hockey');
          const row=page.locator('.follow-directory-row').first();assert(await row.count());assert(await page.locator('.follow-directory-row').count()<=40);
          const patch=await row.evaluate(row=>{const b=row.querySelector('.football-follow-toggle'),before=b.textContent;b.click();const changed=b.textContent!==before,connected=row.isConnected;b.click();return {changed,connected,restored:b.textContent===before};});
          assert.deepEqual(patch,{changed:true,connected:true,restored:true});
          await directory(page,'football');assert(await page.locator('.football-club-row').count()<=40);
          const footballPatch=await page.locator('.football-club-row').first().evaluate(row=>{const b=row.querySelector('.football-follow-toggle'),before=b.textContent;b.click();const changed=b.textContent!==before,connected=row.isConnected;b.click();return {changed,connected,restored:b.textContent===before};});
          assert.deepEqual(footballPatch,{changed:true,connected:true,restored:true});
          await page.locator('[data-tab="feed"]').click();await openFollow(page);await page.locator('.follow-navigation').waitFor();assert.equal(requests,1,'return visits reuse the same interface');
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
          evidence.checks.push({engine,width,coldFeedRequests:0,firstFollowRequests:1,reused:true,preferencePreserved:true,rowsPatched:true,noOverflow:true});await context.close();
        }
        // First open failure is recoverable, repeated renders coalesce, and a late
        // response cannot take over Feed after the user has navigated away.
        const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();let count=0,release;
        await page.route('**/follow-presentation-ui.js?*',async route=>{count++;if(count===1){await route.abort();return;}await new Promise(resolve=>{release=resolve;});await route.continue();});
        await ready(page);await openFollow(page);await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
        assert.equal(count,1);await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForFunction(()=>document.getElementById('listView').dataset.followPresentation==='loading');
        await page.evaluate(()=>{renderFollowView();renderFollowView();});await page.waitForTimeout(100);assert.equal(count,2,'concurrent renders use one request');
        await page.locator('[data-tab="feed"]').click();await openFollow(page);
        assert.match(await page.locator('#listView').innerText(),/Loading Follow…$/,'returning while the request is pending keeps a readable loading state');
        assert.deepEqual(await page.locator('.follow-home-tabs button').allTextContents(),['Sports','My athletes & teams'],'Follow navigation stays available while the original module request is pending');
        await page.locator('[data-tab="feed"]').click();release();await page.waitForFunction(()=>typeof globalThis.renderFollowViewLoaded==='function');assert.equal(await page.evaluate(()=>activeTab),'feed');
        await openFollow(page);await page.locator('.follow-navigation').waitFor();assert.equal(count,2);await directory(page,'tennis');
        evidence.checks.push({engine,failureRetry:true,coalesced:true,navigationAwayPreserved:true,tennisLoaded:true});await context.close();
      }finally{await browser.close();}
    }
    if(process.env.QA_OUTPUT)fs.writeFileSync(process.env.QA_OUTPUT,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
  }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
