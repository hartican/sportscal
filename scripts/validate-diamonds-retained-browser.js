#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const ID='fixture:netball:constellation-cup-2026-2';
async function assertDiamondsFeed(page){
 await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const previous=await page.evaluate(()=>clonePreferences(userPreferences));
 try{
  const facts=await page.evaluate(async id=>{
   const next=clonePreferences(userPreferences);next.feedCompact=false;next.selectedSelectorEntityIds=[];next.followedSports=[];next.showSpoilers=false;next.onboardingComplete=true;
   next.preferenceGraph={...next.preferenceGraph,domainPreferences:[],competitionPreferences:[],entityFollows:[{participantId:'team:netball:diamonds',followLevel:'follow'}]};
   savePreferences(next);acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});setTunePromptOpen(false);suppressSessionRatingPrompt();
   followedScheduleFixtures.delete('sport:netball');await loadFollowedScheduleFixtures();
   const f=activeEvents.find(e=>e.id===id);if(!f)throw Error('Normal Diamonds-only loader did not admit the retained fixture');
   activeTab='feed';activeFilter='all';feedViewFilters.sport='all';renderAll();
   return {id:f.id,reason:automaticEventFollowReason(f)?.id,timeTbc:f.timeTbc,sourceCheckedAt:f.sourceCheckedAt,netball:followedScheduleFixtures.get('sport:netball')?.length};
  },ID);
  assert.equal(facts.reason,'team:netball:diamonds');assert.equal(facts.timeTbc,true);assert.equal(facts.netball,4);
  // Let existing schedule reads finish their normal list replacement before scrolling.
  await page.evaluate(()=>ensureFeedSourceReadiness(userPreferences));
  const slot=page.locator(`[data-feed-event-id="${ID}"]`).first();await slot.waitFor({state:'attached'});await slot.scrollIntoViewIfNeeded();await slot.locator('.event-card').waitFor();
  assert(/Time\s*(?:TBD|to be confirmed)/i.test(await slot.innerText()),'The ordinary Feed card must keep the kickoff explicitly unknown');
  for(const level of ['sportOFF','mute']){
   const hidden=await page.evaluate(({id,level})=>{
    const next=clonePreferences(userPreferences);if(level==='sportOFF')next.preferenceGraph.domainPreferences=[{sportDomainId:'sport:netball',enabled:false}];
    else{next.preferenceGraph.domainPreferences=[];next.preferenceGraph.entityFollows=[{participantId:'team:netball:diamonds',followLevel:'mute'}];}
    savePreferences(next);renderAll();return !getFilteredEvents().some(e=>e.id===id);
   },{id:ID,level});assert(hidden,level+' excludes the card through the actual Feed filter');
  }
  return {...facts,ordinaryFeedCard:true,unknownKickoffVisible:true,sportOffAndMute:true};
 }finally{await page.evaluate(next=>{savePreferences(next);renderAll();},previous);}
}
if(require.main===module){
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});});
 (async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const rows=[];try{for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){const browser=await engine.launch({headless:true});try{const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(12000);await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto('http://127.0.0.1:'+server.address().port);rows.push({engine:name,...await assertDiamondsFeed(page)});}finally{await browser.close();}}console.log(JSON.stringify({rows,transport:'local actual files; API503; external blocked by runner; disposable profiles',actualAccount:false,physicalDevice:false}));}finally{await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={assertDiamondsFeed};
