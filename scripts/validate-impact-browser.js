'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=require('../data/follow-schedule/tennis.json').fixtures.find(e=>e.id.endsWith('184950')),evidence=[];
(async()=>{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],transport={available:true,writes:0,queries:[]};page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>{const url=new URL(r.request().url());if(url.pathname==='/api/inbox'&&url.searchParams.get('impact')==='1'){transport.queries.push(Object.fromEntries(url.searchParams));return r.fulfill({json:{items:transport.available?[{id:'request',kind:'impact_request',eventId:fixture.id,detail:fixture.name,phase:'impact'}]:[]}});}if(url.pathname==='/api/nothingscore'){if(r.request().method()!=='GET')transport.writes++;return r.fulfill({json:{event:fixture,detail:{eventId:fixture.id,canonicalEventId:fixture.id,phase:'impact',aggregate:null,peerResults:{count:0},currentUser:{submissions:{}},aggregates:{heat:null,pulse:null,impact:null}}}});}return r.fulfill({status:503,json:{}});});
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:27,onboardingComplete:true,showSpoilers:false})));
 await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34111');await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.addScriptTag({url:(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34111')+'/assets/js/impact-feedback-ui.js'});
 await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();const id='11111111-1111-4111-8111-111111111111',token='test.'+btoa(JSON.stringify({sub:id}))+'.signature';localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify({accessToken:token,refreshToken:'controlled-browser',expiresAt:Date.now()+3600000}));serverPersistence.user={id};});
 for(const results of [false,true]){
  const before=await page.evaluate(value=>{userPreferences.showSpoilers=value;return JSON.stringify([userPreferences,eventActions]);},results);
  await page.evaluate(id=>NOTHINGSPORTS_IMPACT_UI.open(id),fixture.id);
  const drawer=page.locator('#nothingscoreBody');await drawer.locator('[data-rating-phase=impact]').waitFor();assert.equal(await drawer.getByRole('group',{name:'Your Impact rating out of five'}).getByRole('button').count(),5);
  assert.equal(transport.writes,0);assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences,eventActions])),before,'Opening does not reveal Results, follow, rate or restore any card');
  if(!results)assert(!/6[–-]1|6[–-]3|winner|won|24[–-]22/i.test(await drawer.innerText()),'Results OFF preserves outcomes');
  await page.evaluate(()=>setNothingscoreDrawerOpen(false));
  await page.evaluate(()=>NOTHINGSPORTS_IMPACT_UI.inbox('2026-10-16'));const list=page.getByRole('dialog',{name:'Your Impact requests'});await list.waitFor();assert.equal(await list.getByRole('button',{name:fixture.name,exact:true}).count(),1);assert.equal(transport.queries.at(-1).digestDay,'2026-10-16');
  await list.getByRole('button',{name:fixture.name,exact:true}).click();await drawer.locator('[data-rating-phase=impact]').waitFor();assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences,eventActions])),before);await page.evaluate(()=>setNothingscoreDrawerOpen(false));
  transport.available=false;await assert.rejects(()=>page.evaluate(id=>NOTHINGSPORTS_IMPACT_UI.open(id),fixture.id),/no longer available/);transport.available=true;
  evidence.push({engine,width,results,actualRatingDrawer:true,digestScoped:true,noWrites:true,noPreferencesChanged:true,obsoleteSuppressed:true});
 }
 await page.evaluate(()=>NOTHINGSPORTS_IMPACT_UI.inbox('2026-10-16'));await page.evaluate(()=>{serverSyncClient.clearSession();serverPersistence.user=null;dispatchEvent(new Event('ns-account-change'));});await page.getByRole('dialog',{name:'Your Impact requests'}).waitFor({state:'hidden'});
 assert.equal(transport.writes,0);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}}
 if(process.env.IMPACT_BROWSER_EVIDENCE)fs.writeFileSync(process.env.IMPACT_BROWSER_EVIDENCE,JSON.stringify({checkedAt:new Date().toISOString(),controlledAccountTransport:true,physicalDevice:false,realPush:false,evidence},null,2)+'\n');console.log(JSON.stringify({passed:true,cases:evidence.length,engines:['chromium','webkit'],realPush:false}));})().catch(e=>{console.error(e);process.exitCode=1;});
