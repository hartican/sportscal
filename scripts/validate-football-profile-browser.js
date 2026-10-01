'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const inspector=JSON.parse(fs.readFileSync(process.env.POSITION_REHEARSAL_FILE||path.join(__dirname,'../data/code-inspector/football.json'),'utf8'));
if(process.env.POSITION_PENDING_REHEARSAL==='1')for(const entry of inspector.standings){if(entry.competitionId==='competition:uefa-champions-league'){entry.rank=null;entry.rankPending=true;entry.sharedRank=false;}}
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(__dirname,'..',new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(error?'':bytes);});});
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome'});let checks=0;
try{
 for(const compact of [false,true])for(const [competition,rows] of [['competition:premier-league-2026-27',20],['competition:uefa-champions-league',36],['competition:uefa-europa-league',36]])for(const mode of ['feed','schedule']){
  if(process.env.PROFILE_CASE_ONLY&&(!compact||!competition.includes(process.env.PROFILE_CASE_ONLY==='1'?'premier':process.env.PROFILE_CASE_ONLY)||mode!=='feed'))continue;console.log('Case',compact,competition,mode);const page=await browser.newPage({viewport:{width:compact?320:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  if(process.env.POSITION_PENDING_REHEARSAL==='1'||process.env.POSITION_REHEARSAL_FILE)await page.route('**/data/code-inspector/football.json',r=>r.fulfill({json:inspector}));
  if(inspector.positionRehearsalSnapshot)await page.route('**/assets/js/app-shell-runtime.js?*',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'../assets/js/app-shell-runtime.js'),'utf8')+require('./build-app-shell-runtime').standingsSource([inspector.positionRehearsalSnapshot])}));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:football']})));
  await page.goto(base,{waitUntil:'commit'});
  await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  const {id:target,slotId}=await page.evaluate(async({competition,mode,compact})=>{
   const d=await(await fetch('/data/code-inspector/football.json')).json();
   const f=d.fixtures.find(f=>f.competitionId===competition&&f.status==='upcoming'&&f.date>=formatDateKey(nowAEST()));if(!f)throw Error('Missing current case '+competition);
   userPreferences.feedCompact=compact;userPreferences.showSpoilers=false;
   userPreferences.preferenceGraph=PREFERENCE_SYSTEM.setEntityFollow(userPreferences.preferenceGraph,f.participantIds[0],'follow');
   activeTab=mode==='feed'?'feed':'follow';activeInspectorCodeId=null;
   feedViewFilters={sport:'sport:football',minimum:0};
   saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:{codeId:'sport:football',competitionId:competition}});
   if(mode==='feed'){
    // The selected filter loads the remaining real pages. Finish that operation
    // before inserting this public fixture so the journey is independent of
    // network speed and of an earlier published alias winning reconciliation.
    await hydrateFeedFilter();
    applyFeedEvents([f],null,{append:true});
   }
   renderAll();
   const aliases=new Set([f.id,f.eventId,f.canonicalEventId].filter(Boolean));
   const rendered=mode==='feed'?activeEvents.find(e=>[e.id,e.eventId,e.canonicalEventId].some(id=>aliases.has(id))):f;
   if(!rendered)throw Error('Fixture missing after real Feed reconciliation '+f.id);
   return {id:rendered.eventId||rendered.id,slotId:rendered.canonicalEventId||rendered.eventId||rendered.id};
  },{competition,mode,compact});
  if(mode==='feed'){const slot=page.locator(`[data-feed-event-id="${slotId}"]`).first();await slot.waitFor({state:'attached'});await slot.scrollIntoViewIfNeeded();}
  const card=page.locator(`[data-event-id="${target}"]`).first();await card.waitFor();
  if(inspector.positionRehearsalSnapshot){
    const positions=inspector.positionRehearsalSnapshot.entries;
    const ids=await page.evaluate(target=>{const e=activeEvents.find(e=>(e.eventId||e.id)===target);return e?.participantIds||[e?.homeParticipantId,e?.awayParticipantId];},target);
    assert.equal(ids.length,2);assert(ids.every(id=>positions.some(e=>e.participantId===id)),'both actual fixture participants resolve to the persisted rehearsal table');
    const expectedRanks=ids.map(id=>positions.find(e=>e.participantId===id)).filter(Boolean).filter(e=>!e.rankPending).map(e=>`JOINT ${require('../config/feed-card-presentation').ordinal(e.rank)}`);
    assert.deepEqual(await card.locator('.fixture-standing').allTextContents(),expectedRanks,'actual compact Feed badges preserve shared ranks and suppress pending positions');
  }
  if(!await card.locator('.fixture-profile-link:visible').count())await card.locator('[data-card-control="disclosure"]').click();
  const link=card.locator('.fixture-profile-link:visible').first();for(let attempt=0;;attempt++){try{await link.scrollIntoViewIfNeeded();await link.focus();break;}catch(error){if(attempt>=2||!/not attached to the DOM/.test(error.message))throw error;}}
  const label=await link.getAttribute('aria-label');
  const before=await page.evaluate(()=>({preferences:JSON.stringify(userPreferences),filters:JSON.stringify(feedViewFilters),browse:JSON.stringify(followBrowseState()),y:scrollY,tab:activeTab,inspector:activeInspectorCodeId,height:document.documentElement.scrollHeight}));
  await page.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('.fixture-profile-link'))window.__profileOriginY=scrollY;window.__profileOriginTop=e.target.closest('[data-event-id]')?.getBoundingClientRect().top;},{capture:true,once:true}));let failStandings=checks===0&&!process.env.PROFILE_CASE_ONLY;if(failStandings)await page.route('**/data/code-inspector/football.json',r=>failStandings?r.fulfill({status:503,json:{}}):r.continue());await link.click();before.y=await page.evaluate(()=>window.__profileOriginY);before.cardTop=await page.evaluate(()=>window.__profileOriginTop);const drawer=page.locator('.athlete-profile-drawer');await drawer.waitFor();
  await drawer.getByRole('button',{name:'Show profile standings',exact:true}).waitFor();
  assert.equal(await drawer.locator('.profile-context-table').count(),0,'Results-off must not insert standings');
  await page.keyboard.press('Shift+Tab');assert(await drawer.evaluate(n=>n.contains(document.activeElement)),'reverse Tab remains in modal');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Close athlete profile');
  await drawer.getByRole('button',{name:'Show profile standings',exact:true}).click();
  const standingsHeading=drawer.getByRole('heading',{name:'Ladder / standings',exact:true});
  assert(await standingsHeading.evaluate(n=>n===document.activeElement),'reveal keeps keyboard focus inside the dialog at its standings heading');
  const status=drawer.getByRole('status');assert.equal(await status.getAttribute('aria-live'),'polite');assert.equal(await status.getAttribute('aria-atomic'),'true');
  if(failStandings){await drawer.getByRole('button',{name:'Retry standings',exact:true}).waitFor();assert.equal(await drawer.locator('.profile-context-table').count(),0);assert.match(await status.innerText(),/Standings unavailable/);failStandings=false;await drawer.getByRole('button',{name:'Retry standings',exact:true}).click();assert(await standingsHeading.evaluate(n=>n===document.activeElement),'retry retains focus within the dialog');}
  await page.waitForFunction(rows=>document.querySelectorAll('.athlete-profile-drawer .profile-context-table tr').length===rows+1,rows);
  assert.equal(await drawer.locator('.profile-context-table').count(),1,'only fixture competition');
  assert.equal(await status.innerText(),'Standings loaded.','loading completion has meaningful live feedback');
  assert(await standingsHeading.evaluate(n=>n===document.activeElement),'asynchronous arrival must not send focus to the page or steal it');
  assert(await drawer.getByRole('table').getAttribute('aria-label'),'table has a competition/source-date name');
  if(competition==='competition:premier-league-2026-27')assert.match(await drawer.getByRole('table').getAttribute('aria-label'),/2026\/27 Premier League/,'the visible/accessible title uses the authoritative competition name');
  assert(await drawer.locator('.profile-context-table th').evaluateAll(headers=>headers.every(h=>h.scope==='col')),'columns have explicit header associations');
  assert(await drawer.locator('.profile-context-table').evaluate(table=>table.parentElement.scrollWidth<=table.parentElement.clientWidth+1),'four-column standings fit the mobile drawer without hiding the Played column');
  const expectedPositions=inspector.standings.filter(e=>e.competitionId===competition).map(e=>[e.rankPending?'Pending':`${e.sharedRank?'Joint ':''}${e.rank}`,e.displayName]);
  const displayedPositions=await drawer.locator('.profile-context-table tr').evaluateAll(rows=>rows.filter(r=>r.querySelector('td')).map(r=>[r.cells[0].textContent,r.cells[1].textContent]));
  if(process.env.PROFILE_CAPTURE_PATH)await drawer.screenshot({path:process.env.PROFILE_CAPTURE_PATH});
  assert.deepEqual(displayedPositions,expectedPositions,'profile positions preserve actual shared/pending source meaning');
  if(rows===36)assert.match(await drawer.innerText(),/Provisional table derived from community results/);
  assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false,'local reveal preserves global Results');
  assert(await drawer.getByRole('button',{name:'Show fixture results',exact:true}).isVisible(),'standings reveal does not reveal fixture results');
  await drawer.getByRole('button',{name:'Show fixture results',exact:true}).click();
  assert(await drawer.getByRole('heading',{name:/^Fixture results ·/}).evaluate(n=>n===document.activeElement),'fixture result reveal keeps focus at the results heading');
  assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false,'fixture-only reveal preserves global Results');
  const close=process.env.PROFILE_CLOSE_METHOD?Number(process.env.PROFILE_CLOSE_METHOD):checks%3;if(close===0)await drawer.getByRole('button',{name:'Close athlete profile',exact:true}).click();else if(close===1)await page.keyboard.press('Escape');else await page.goBack();
  await drawer.waitFor({state:'detached'});
  await page.waitForFunction(({target,label})=>document.activeElement?.closest('[data-event-id]')?.dataset.eventId===target&&document.activeElement?.getAttribute('aria-label')===label,{target,label}).catch(async e=>{console.log(await page.evaluate(({target,label})=>({target,label,tab:activeTab,inspector:activeInspectorCodeId,activeTarget:activeEvents.find(e=>(e.eventId||e.id)===target),followIds:userPreferences.preferenceGraph.entityFollows.map(f=>({id:f.participantId,level:f.followLevel})),activeCount:activeEvents.length,slotIds:[...feedCardSlots.values()].map(i=>i.event.eventId||i.event.id),focus:document.activeElement?.outerHTML.slice(0,300),cards:[...document.querySelectorAll('[data-event-id]')].map(n=>n.dataset.eventId).slice(0,20),text:document.getElementById('listView').innerText.slice(0,200)}),{target,label}));throw e;});
  const after=await page.evaluate(()=>({preferences:JSON.stringify(userPreferences),filters:JSON.stringify(feedViewFilters),browse:JSON.stringify(followBrowseState()),y:scrollY,tab:activeTab,inspector:activeInspectorCodeId,height:document.documentElement.scrollHeight}));
  assert.equal(after.preferences,before.preferences,'profile navigation/reveal cannot change preferences');assert.equal(after.filters,before.filters);assert.equal(after.browse,before.browse);assert.equal(after.tab,before.tab);assert.equal(after.inspector,before.inspector,'restore inspector route');await page.waitForFunction(({target,top})=>{const card=[...document.querySelectorAll('[data-event-id]')].find(n=>n.dataset.eventId===target);return card&&Math.abs(card.getBoundingClientRect().top-top)<=16;},{target,top:before.cardTop});const cardTop=await card.evaluate(n=>n.getBoundingClientRect().top);assert(Math.abs(cardTop-before.cardTop)<=16,`card position restored ${before.cardTop} -> ${cardTop}`);
  await page.evaluate(()=>renderAll());await page.waitForFunction(({target,label})=>document.activeElement?.closest('[data-event-id]')?.dataset.eventId===target&&document.activeElement?.getAttribute('aria-label')===label,{target,label});await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),label,'next user input releases return focus');if(checks===0&&!process.env.PROFILE_CASE_ONLY){await page.locator("#homeSpoilerToggle").click();await page.locator("dialog[open] [data-confirm]").click();await link.click();await drawer.waitFor();await page.waitForFunction(rows=>document.querySelectorAll('.athlete-profile-drawer .profile-context-table tr').length===rows+1,rows).catch(async e=>{console.log(await drawer.innerText());throw e;});assert.equal(await drawer.getByRole('button',{name:'Show profile standings',exact:true}).count(),0);await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'});}
  assert.deepEqual(errors,[]);checks++;await page.close();
 }
 console.log(`Football profiles: ${checks} tested Feed/Schedule journeys preserve focus, scroll, filters and preferences; scoped standings require local reveal. ${process.env.POSITION_REHEARSAL_FILE||process.env.POSITION_PENDING_REHEARSAL==='1'?'Intercepted standings rehearsal; no real final-season evidence.':'Actual published standings; tested card modes and close paths passed.'}`);
}finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(e=>{console.error(e);process.exitCode=1});
