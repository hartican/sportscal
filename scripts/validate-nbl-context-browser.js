'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991');
 await page.waitForFunction(()=>typeof buildCodeInspectorFixture==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const fixtures=await page.evaluate(async()=>{const r=await fetch('/data/code-inspector/nbl.json');return (await r.json()).fixtures;});
 const cases=[fixtures.find(f=>f.teamMatchContext?.teams.every(t=>!t.played)),fixtures.find(f=>f.status==='upcoming'&&f.teamMatchContext?.teams.some(t=>t.played)),fixtures.find(f=>f.status==='completed'&&f.teamMatchContext?.teams.some(t=>t.played))];
 assert(cases.every(Boolean),'opening, upcoming and completed cases');
 for(const f of cases)for(const mode of ['feed','schedule'])for(const show of [false,true]){
  await page.evaluate(({f,mode,show})=>{activeTab=mode==='feed'?'feed':'follow';userPreferences.showSpoilers=show;setCardState(mode==='schedule'?(canonicalFeedFixtureForInspector(f)||f):f,'opened');document.getElementById('listView').replaceChildren(mode==='feed'?buildEventCard({...f,eventId:f.id}):buildCodeInspectorFixture(f));},{f,mode,show});
  const section=page.locator('#listView .football-match-context');await section.waitFor();
  const text=await section.innerText();assert(text.includes('Before this game · NBL regular season · 2026-27'));
  if(!show){assert(text.includes('Team records hidden'));assert.equal(await section.locator('li').count(),0,'no records leak');}
  else{assert.equal(await section.locator('li').count(),2);assert(!/\dD\b/.test(text),'basketball has no draws');for(const t of f.teamMatchContext.teams)assert(text.includes(t.played?`${t.name}: ${t.won}W · ${t.lost}L`:`${t.name}: no earlier confirmed result`));assert(text.includes('not a ladder or prediction'));assert(text.includes('Source checked'));}
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${mode}/${show}/${width}: no overflow`);}
 }
 const ev=cases[1];
 for(const modified of [{...ev,season:'2025-26'},{...ev,sourceCheckedAt:'2026-01-01T00:00:00Z'},{...ev,participantIds:['wrong','identity']},{...ev,teamMatchContext:{...ev.teamMatchContext,teams:ev.teamMatchContext.teams.map(t=>({...t,played:t.played+1}))}}])assert.equal(await page.evaluate(f=>NOTHINGSPORTS_FOOTBALL_CONTEXT.context(f,true),modified),null,'stale/mismatched/invalid context withheld');
 console.log('NBL context browser: opening/upcoming/completed, Results off/on, Feed/Schedule, four widths and invalid-data withholding passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
