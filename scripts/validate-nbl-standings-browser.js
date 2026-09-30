'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const expected=require('../data/canonical/nbl-2026-27.json').standings;
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Isolated public-data UI check'}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:basketball'],showSpoilers:false})));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 await page.evaluate(async()=>{activeTab='follow';await openCodeInspector('sport:nbl',{startingTab:'standings'});});
 await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:nbl'&&!codeInspectorChunkLoading);
 const hidden=page.getByText('Standings hidden while Results is off.',{exact:true});await hidden.waitFor();
 assert.equal(await page.locator('.code-inspector-standing-row').count(),0);
 const prior=await page.evaluate(()=>JSON.stringify(userPreferences));
 await page.getByRole('button',{name:'Reveal standings',exact:true}).click();
 await page.locator('#confirmStandingsRevealBtn').click();
 await page.waitForFunction(first=>document.querySelector('.code-inspector-standing-row strong')?.textContent===`${first.rank}. ${first.displayName}`,expected[0]);
 const rows=page.locator('.code-inspector-standing-row');await rows.first().waitFor();assert.equal(await rows.count(),10);
 for(let i=0;i<10;i++){await rows.nth(i).scrollIntoViewIfNeeded();const text=await rows.nth(i).innerText(),r=expected[i];assert(text.includes(`${r.rank}. ${r.displayName}`),`Expected ${r.rank}. ${r.displayName}; got ${text}`);assert(text.includes(`${r.played} played`));assert(text.includes(`${r.won} wins`));assert(text.includes(`${r.lost} losses`));assert(!/draws|GF|GD|pts/.test(text));}
 assert((await page.locator('.code-inspector-published-standings').innerText()).includes('Not the Ignite Cup table'));
 assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false,'Local reveal cannot enable global spoilers');
 assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences)),prior,'Inspecting standings preserves preferences');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);console.log('NBL standings browser: ten official positions/records, four widths, explicit local reveal, Results privacy and unchanged preferences passed. Public/offline API fallback, not physical-device proof.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
