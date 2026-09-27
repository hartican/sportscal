'use strict';
const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],onboardingComplete:true,showSpoilers:false,preferenceGraph:{entityFollows:[{participantId:'team:football:epl:10',followLevel:'follow'}]}})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 await page.evaluate(()=>{activeTab='follow';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:null});renderAll();});
 await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);
 const counts=await page.evaluate(()=>Object.fromEntries(['competition:uefa-champions-league','competition:uefa-europa-league'].map(id=>[id,codeInspectorChunk.fixtures.filter(f=>f.competitionId===id&&f.sourceAttribution?.provider==='OpenLigaDB').length])));
 assert.deepEqual(Object.values(counts),[144,144]);
 for(const competition of Object.keys(counts))for(const mode of ['schedule','feed']){
  const title=await page.evaluate(({competition,mode})=>{const fixture=codeInspectorChunk.fixtures.find(f=>f.competitionId===competition&&f.status==='upcoming');activeTab=mode==='feed'?'feed':'follow';const card=mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard({...fixture,eventId:fixture.id});document.getElementById('listView').replaceChildren(card);return fixture.name;},{competition,mode});
  assert((await page.locator('#listView').innerText()).includes(title.split(' v ')[0]));
  assert.equal(await page.locator('#listView .fixture-profile-link').count(),2,'both confirmed clubs retain profile links even without artwork');
  const watch=page.locator('#listView a.provider-link[aria-label*="Stan"]');assert.equal(await watch.count(),1);assert((await watch.getAttribute('href')).includes(competition.replace('competition:','')));
  const attribution=page.locator('#listView .fixture-source-attribution');await attribution.scrollIntoViewIfNeeded();assert(await attribution.isVisible());assert.equal(await attribution.getByRole('link',{name:'Dataset',exact:true}).getAttribute('href'),'/data/providers/openligadb/football-2026-27.json');
  assert.match(await attribution.locator('.fixture-source-context').innerText(),/^League phase · Matchday [1-8]$/);
  assert.match(await attribution.locator('.fixture-source-freshness').innerText(),/Source checked.*2026/);
  assert(await attribution.locator('time').getAttribute('datetime'),'machine-readable source observation');
  assert.equal(await attribution.evaluate(el=>getComputedStyle(el).fontSize),'12px');
  assert(await attribution.getByRole('link',{name:'Dataset',exact:true}).evaluate(el=>el.getBoundingClientRect().height>=24),'source link retains a usable target');
  for(const width of [320,390,768,1280])for(const theme of ['day','night']){await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${competition} ${mode} ${width} ${theme}: no overflow`);}
 }
 for(const mode of ['schedule','feed'])for(const show of [false,true]){
  const expected=await page.evaluate(({mode,show})=>{
   const f=codeInspectorChunk.fixtures.find(f=>f.footballMatchContext?.teams.every(t=>t.played===1)&&f.status==='upcoming');
   if(!f)throw Error('No current source-backed match context');
   userPreferences.showSpoilers=show;activeTab=mode==='feed'?'feed':'follow';setCardState(f,'opened');
   document.getElementById('listView').replaceChildren(mode==='schedule'?buildCodeInspectorFixture(f):buildEventCard({...f,eventId:f.id}));
   return f.footballMatchContext.teams.map(t=>`${t.name}: ${t.won}W · ${t.drawn}D · ${t.lost}L from ${t.played} match`);
  },{mode,show});
  const context=page.locator('#listView .football-match-context');await context.scrollIntoViewIfNeeded();assert(await context.isVisible());
  const text=await context.innerText();
  if(show){for(const record of expected)assert(text.includes(record));assert(text.includes('Excludes other competitions'));}
  else{assert(text.includes('Results is off'));for(const record of expected)assert(!text.includes(record),'Records cannot leak with Results off');}
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 }
 await page.evaluate(()=>{userPreferences.showSpoilers=false;});
 const malformedContext=await page.evaluate(()=>{const f=codeInspectorChunk.fixtures.find(f=>f.footballMatchContext);return [NOTHINGSPORTS_FOOTBALL_CONTEXT.context({...f,season:'wrong'},true),NOTHINGSPORTS_FOOTBALL_CONTEXT.context({...f,footballMatchContext:{...f.footballMatchContext,teams:[]}},true)].every(x=>x===null);});assert(malformedContext,'Mismatched season or missing identities must hide context');
 const unknownSource=await page.evaluate(()=>{const el=NOTHINGSPORTS_FOOTBALL_CONTEXT.attribution({sourceAttribution:{provider:'OpenLigaDB'},sourceCheckedAt:'invalid',stage:'League phase',roundNumber:99});return {time:el.querySelector('time')!==null,context:el.querySelector('.fixture-source-context')!==null};});
 assert.deepEqual(unknownSource,{time:false,context:false},'unknown source time or round cannot be fabricated');
 for(const mode of ['schedule','feed']){
  const venue=await page.evaluate(mode=>{const f=codeInspectorChunk.fixtures.find(f=>f.sourceAttribution?.provider==='OpenLigaDB'&&f.venue);if(!f)throw new Error('No sourced venue in published Football');activeTab=mode==='feed'?'feed':'follow';document.getElementById('listView').replaceChildren(mode==='schedule'?buildCodeInspectorFixture(f):buildEventCard({...f,eventId:f.id}));return f.venue;},mode);
  assert((await page.locator('#listView').innerText()).toLowerCase().includes(venue.toLowerCase()),`${mode}: source venue ${venue} is visibly retained: ${await page.locator('#listView').innerText()}`);
 }
 await page.evaluate(()=>{const f=codeInspectorChunk.fixtures.find(f=>f.participantIds.includes('team:football:club:lech-poznan')&&f.status==='upcoming');activeTab='feed';document.getElementById('listView').replaceChildren(buildEventCard({...f,eventId:f.id}));});
 await page.getByRole('button',{name:'Open Lech Poznań profile in Follow',exact:true}).click();
 const profile=page.locator('.athlete-profile-drawer');await profile.waitFor();assert((await profile.innerText()).includes('Lech Poznań'));
 await page.locator('.athlete-profile-close').click();
 await page.waitForFunction(()=>activeTab==='feed');
 const privacy=await page.evaluate(()=>{
   const f=codeInspectorChunk.fixtures.find(f=>f.sourceAttribution?.provider==='OpenLigaDB'&&f.homeScore===1&&f.awayScore===4);
   userPreferences.showSpoilers=false;const card=buildEventCard({...f,eventId:f.id});document.getElementById('listView').replaceChildren(card);return {text:card.innerText,score:f.score};
 });assert(!privacy.text.includes(privacy.score),'hidden results cannot leak the source scoreline');
 for(const mode of ['schedule','feed']){
  const unchanged=await page.evaluate(mode=>{
   const preferences=JSON.stringify(userPreferences),f=codeInspectorChunk.fixtures.find(f=>f.sourceAttribution?.provider==='OpenLigaDB'&&f.status==='upcoming');
   const record={...f,status:'unknown',startTimeUtc:new Date(+nowAEST()-3600000).toISOString()};
   activeTab=mode==='feed'?'feed':'follow';document.getElementById('listView').replaceChildren(mode==='schedule'?buildCodeInspectorFixture(record):buildEventCard({...record,eventId:record.id}));
   return preferences===JSON.stringify(userPreferences);
  },mode);
  assert(unchanged,'degraded timing must not change Follow or Results settings');
  const chip=page.locator(mode==='feed'?'#listView .fixture-timing-badge':'#listView .event-timing-state.awaiting-update');
  if(!await chip.count())throw new Error(mode+': missing update label: '+await page.locator('#listView').innerText());
  await chip.scrollIntoViewIfNeeded();assert(await chip.isVisible(),mode+': visible unconfirmed status');
  assert.equal(await chip.textContent(),'Awaiting match update');
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),mode+': unconfirmed status fits '+width);}
  assert.equal(await page.locator('#listView .event-timing-state.live-now, #listView .event-timing-state.just-finished').count(),0);
  assert.equal(await page.locator('#listView .nsc-rating-blocks').count(),0,'unknown status must not invent a local post-match rating prompt');
 }
 if(process.env.QA_SCREENSHOT){await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{applyThemePreference('day');const f=codeInspectorChunk.fixtures.find(f=>f.competitionId==='competition:uefa-europa-league'&&f.status==='upcoming');userPreferences.showSpoilers=true;renderHomeSpoilerToggle();setCardState(f,'opened');document.getElementById('listView').replaceChildren(buildEventCard({...f,eventId:f.id}));document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:process.env.QA_SCREENSHOT,fullPage:true});}
 const failurePage=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await failurePage.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await failurePage.route('**/assets/js/football-card-context.js*',r=>r.abort());
 await failurePage.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await failurePage.waitForFunction(()=>typeof buildEuropeanDetail==='function');
 await failurePage.evaluate(()=>{document.getElementById('listView').replaceChildren(buildFixtureDataAttribution({sourceAttribution:{provider:'OpenLigaDB'}}));});
 const fallback=failurePage.getByRole('link',{name:'OpenLigaDB data · ODbL',exact:true});await fallback.waitFor();
 assert.equal(await fallback.getAttribute('href'),'/data/providers/openligadb/football-2026-27.json','Optional renderer failure retains source/licence dataset link');
 await failurePage.close();
 console.log('European Football browser: 144 named fixtures per competition, Feed/Schedule cards, visible attribution, honest unconfirmed timing and four responsive widths passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
