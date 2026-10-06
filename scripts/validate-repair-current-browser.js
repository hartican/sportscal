'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const catalogue=require('../lib/calendar-catalogue').catalogue(),baseball=require('../data/code-inspector/baseball.json').fixtures.find(f=>f.id.includes('849839')),nfl=require('../data/code-inspector/american-football.json').fixtures.find(f=>f.id.includes('401872979'));
const final=catalogue.find(f=>f.canonicalEventId==='fixture:tennis:atp-beijing-2026:f:djokovic-de-minaur');
(async()=>{for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]]){const browser=await engine.launch(engineName==='chromium'?{channel:'chrome'}:{});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-06T04:15:00Z')});
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,selectedSelectorEntityIds:[],followFirst:{refinement:{promptedAt:'2026-10-06T00:00:00Z'}}})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:34006');await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 const data=await page.evaluate(({baseball,nfl,final})=>{
  closeSettings();acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});activeTab='feed';
  const p=clonePreferences(userPreferences);p.onboardingComplete=true;p.showSpoilers=false;p.selectedSelectorEntityIds=[];p.followedSports=[];p.preferenceGraph.entityFollows=[{participantId:'athlete:tennis:alex-de-minaur',followLevel:'follow'}];savePreferences(p);
  const automatic=NOTHINGSPORTS_REMINDER_POLICY.automatic(final,userPreferences,{},Date.now()),remind=NOTHINGSPORTS_REMINDER_POLICY.timing(final,Date.now());
  const admission=FOLLOW_FEED_POLICY.participantFeedEligible(final)&&Boolean(eventFollowReason(final));
  const cards=[baseball,nfl].map(f=>{const e={...canonicalFeedFixtureForInspector(f),...f,key:f===baseball?'baseball':'american-football',eventId:f.id,canonicalEventId:f.id,cardKind:'fixture',participantsConfirmed:true,participantIds:f.participantSlots.map(s=>s.participantId)};const card=buildEventCard(e);document.getElementById('listView').append(card);return {id:e.id,html:card.outerHTML,text:card.textContent,viewing:FOLLOW_FIRST.viewingOptions(e).map(x=>x.label)};});
  return {automatic,remind,admission,cards};
 },{baseball,nfl,final});
 assert(data.admission&&data.automatic,'actual Beijing final enters the followed Feed and reminder scope');assert.equal(data.remind.remindAt,'2026-10-06T10:45:00.000Z');
 assert(data.cards[0].viewing.includes('Kayo Sports · ESPN2'));assert(data.cards[1].viewing.includes('Kayo Sports · ESPN'));for(const card of data.cards){assert(/New York Yankees|New Orleans Saints/.test(card.text));assert(!/5–2|24–45|45–24/.test(card.text),'results stay hidden');}
 await page.locator('#calendarSyncBtn').click();await page.locator('#calendarSyncDialog').waitFor();await page.getByRole('button',{name:'Close calendar sync',exact:true}).click();assert.deepEqual(errors,[]);await page.close();console.log(`${engineName}/${width}: official named cards, viewing channels, spoiler protection, Beijing automatic admission/10:45pm reminder, deferred calendar`);
 }}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
