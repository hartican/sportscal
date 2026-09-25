'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:33986';
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture={id:'fixture:nrl:startup-test',key:'nrl',name:'Panthers v Storm',status:'live',startTimeUtc:new Date(Date.now()-600000).toISOString(),participantIds:['team:nrl:4','team:nrl:3']};
 let release,failScript=true;await page.route('**/assets/js/match-centre-ui.js?*',async route=>{if(failScript){await new Promise(r=>{release=r;});await route.abort();}else await route.continue();});
 await page.route('**/api/**',r=>r.request().url().includes('scope=match-centre')?r.fulfill({json:{events:[fixture],pagination:{nextCursor:null}}}):r.fulfill({status:503,json:{}}));
 await page.goto(base);await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&typeof startupCoordinator!=='undefined');
 await page.evaluate(()=>{document.getElementById('startupLaunch')?.remove();document.querySelectorAll('[role=dialog]').forEach(n=>n.parentElement.style.display='none');document.getElementById('listView').textContent='Previous Feed content';globalThis.__oldHydrating=startupCoordinator.isHydrating;startupCoordinator.isHydrating=()=>true;activateTopLevelTab('match-centre');});
 await page.getByText('Loading Match Centre…',{exact:true}).waitFor();assert(!(await page.locator('#listView').innerText()).includes('Previous Feed content'));
 for(let i=0;!release&&i<100;i++)await page.evaluate(()=>new Promise(requestAnimationFrame));assert(release);release();
 await page.getByRole('button',{name:'Retry',exact:true}).waitFor();failScript=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
 // The failed script is retryable; it must not cache a rejected promise.
 await page.waitForTimeout(50);if(await page.getByRole('button',{name:'Retry',exact:true}).count())await page.getByRole('button',{name:'Retry',exact:true}).click();
 try{await page.locator('.match-centre-card').waitFor();}catch(error){console.log(await page.evaluate(()=>({tab:activeTab,content:document.getElementById('listView').innerText,loaded:typeof renderMatchCentre})),errors);throw error;}assert.equal(await page.locator('.event-card').count(),0);
 await page.evaluate(()=>{startupCoordinator.isHydrating=globalThis.__oldHydrating;activeTab='follow';saveFollowBrowse({sportId:'sport:golf',categoryId:'',section:'schedule',scheduleScope:null});renderAll();});
 await page.locator('.follow-navigation').waitFor();await page.getByRole('button',{name:'Filter schedule',exact:true}).waitFor();
 assert.equal(await page.locator('#codeInspectorStartingRound').count(),0);
 await page.evaluate(()=>{document.body.style.overflow='';document.querySelector('.follow-navigation button').focus();scrollTo(0,900);});
 await page.getByRole('button',{name:'Expand Follow navigation'}).waitFor();
 const box=await page.getByRole('button',{name:'Expand Follow navigation'}).boundingBox();assert(box&&box.y>=0&&box.y<844,'chevron stays in viewport');
 await page.getByRole('button',{name:'Expand Follow navigation'}).click();assert(await page.locator('#follow-navigation-controls').isVisible());
 await page.getByRole('button',{name:'Filter',exact:true}).click();await page.getByRole('dialog',{name:'Filter schedule'}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const f1=require('../data/events.json').events.find(e=>e.key==='f1'&&e.venueCountryCode==='AZ');
 await page.evaluate(ev=>{activeTab='feed';activeInspectorCodeId=null;document.getElementById('listView').replaceChildren(buildEventCard(ev));},f1);
 await page.locator('.f1-location-hero img').waitFor();await page.waitForFunction(()=>document.querySelector('.f1-location-hero img').naturalWidth>0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{document.body.style.overflow='';scrollTo(0,0);});
 await page.screenshot({path:`${process.env.QA_ARTIFACT_DIR||'/tmp'}/f1-${engine.name()}.png`,fullPage:false});
 const cup=require('../data/canonical/pga-tour-schedule.json').presidentsCup.find(e=>e.tournamentParent);
 await page.evaluate(async ev=>{await loadDeferredScript('assets/js/tournament-fixture-ui.js?v='+document.querySelector('meta[name=app-shell-version]').content);userPreferences=FOLLOW_FIRST.migratePreferences({selectedSelectorEntityIds:['sport:golf'],followFirst:{australiansOnlySportIds:['sport:golf']}});const host=document.getElementById('listView');host.replaceChildren();NOTHINGSPORTS_TOURNAMENT_UI.append(host,ev);},cup);
 await page.getByText('Tournament schedule',{exact:true}).click();await page.getByText(/Min Woo Lee/).first().waitFor();assert(await page.getByText('All published pairings',{exact:true}).isVisible());
 assert(!(await page.locator('#listView').innerText()).includes('To be confirmed'));
 const bjk={id:'bjk-ui-test',tournamentId:'tournament:tennis:bjk-cup-finals-2026'};
 await page.evaluate(ev=>{const host=document.getElementById('listView');host.replaceChildren();userPreferences.showSpoilers=true;NOTHINGSPORTS_TOURNAMENT_UI.append(host,ev);},bjk);
 await page.getByText('Tournament schedule',{exact:true}).click();await page.getByText('Czechia v Great Britain',{exact:true}).waitFor();const bjkText=await page.locator('#listView').innerText();assert(/Italy|Ukraine|China|USA|Japan|Spain|Great Britain|Czech/i.test(bjkText));assert(!/Quarter-final [1-4]|Slot [1-9]|TBC v TBC/.test(bjkText));
 for(const sportId of ['sport:nrl','sport:f1','sport:tennis']){
  await page.evaluate(id=>{activeTab='follow';saveFollowBrowse({sportId:id,categoryId:'',section:'schedule',scheduleScope:null});renderAll();},sportId);
  await page.locator('.follow-navigation').waitFor();await page.waitForFunction(id=>codeInspectorChunk?.code?.id===id&&!codeInspectorChunkLoading,sportId);
  assert.equal(await page.locator('#codeInspectorStartingRound').count(),0);
 }
 const preferencesBefore=await page.evaluate(()=>JSON.stringify(userPreferences));
 await page.getByRole('button',{name:'Filter schedule',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Filter schedule'});await dialog.locator('details').first().locator('summary').click();await dialog.locator('input[type=checkbox]').first().check();await dialog.getByRole('button',{name:'Apply',exact:true}).click();
 const saved=await page.evaluate(()=>localStorage.getItem('ns_follow_filters_v1'));assert(saved&&saved.includes('sport:tennis'));assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences)),preferencesBefore,'Follow filters do not alter sporting follows or Feed');
 assert.deepEqual(errors,[]);
 console.log(engine.name()+': early navigation, script failure/retry, Follow chevron, filters, F1 circuit and no overflow passed');
}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1});
