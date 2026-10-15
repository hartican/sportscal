'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function run(){
 const proof={controlled:true,providerCalls:0,customerWrites:0,cases:[]};
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
   await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:football'],onboardingComplete:true,showSpoilers:false})));
   await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33956');
   await page.waitForFunction(()=>typeof saveFollowBrowse==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
   await page.evaluate(()=>{activeTab='follow';followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'schedule',scheduleScope:null});renderAll();});
   await page.waitForFunction(()=>codeInspectorChunk?.code?.id==='sport:football'&&!codeInspectorChunkLoading);
   await page.evaluate(()=>{
    globalThis.qaVenueFixture=codeInspectorChunk.fixtures.find(f=>f.sourceAttribution?.provider==='OpenLigaDB'&&f.venue&&f.status==='completed');
    if(!qaVenueFixture)throw Error('Missing completed published fixture with a sourced venue');
    const host=document.createElement('main');host.id='qaVenue';host.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto;padding:8px;background:var(--bg)';document.body.append(host);
    globalThis.qaVenueChoices=JSON.stringify([userPreferences,eventActions]);
   });
   for(const width of [320,390,1280])for(const theme of ['day','night'])for(const surface of ['feed','schedule'])for(const state of ['selected','opened'])for(const known of [true,false]){
    await page.setViewportSize({width,height:844});
    const result=await page.evaluate(({theme,surface,state,known})=>{
     applyThemePreference(theme);activeTab=surface==='feed'?'feed':'follow';
     const f={...qaVenueFixture,...(!known?{venue:null,venueOfficialName:null,venueName:null,venueDisplayName:null,venueCity:null,city:null,location:null}:{})};
     setCardState(f,state);const card=surface==='feed'?buildEventCard({...f,eventId:f.id}):buildCodeInspectorFixture(f);document.getElementById('qaVenue').replaceChildren(card);
     const access=card.querySelector('.fixture-access'),venue=card.querySelector('.fixture-venue');
     return {id:f.id,text:venue?.textContent,visible:!!venue&&venue.getBoundingClientRect().height>0,accessVisible:!!access&&getComputedStyle(access).display!=='none',actions:access?.querySelector('.event-quick-actions')?.childElementCount,choicesUnchanged:qaVenueChoices===JSON.stringify([userPreferences,eventActions]),overflow:document.documentElement.scrollWidth>innerWidth+1};
    },{theme,surface,state,known});
    assert.equal(result.actions,0,'Real completed fixture reproduces the empty viewing action path');
    assert.equal(result.visible,known,'Known venue remains visible; an unknown venue keeps the prior compact layout');
    assert.equal(result.accessVisible,known);assert(result.choicesUnchanged&&!result.overflow);
    if(known)assert(result.text&&!/TBD|TBC/.test(result.text));else assert.equal(result.text,undefined,'Missing venue data leaves no invented venue or placeholder row');
    proof.cases.push({engine,width,theme,surface,state,known,...result});
    if(process.env.VENUE_QA_OUTPUT&&width===390&&theme==='day'&&known&&state==='opened'){
     fs.mkdirSync(process.env.VENUE_QA_OUTPUT,{recursive:true});await page.locator('#qaVenue .event-card').screenshot({path:path.join(process.env.VENUE_QA_OUTPUT,`${engine}-${surface}-venue.png`)});
    }
   }
   for(const surface of ['feed','schedule']){
    await page.evaluate(surface=>{activeTab=surface==='feed'?'feed':'follow';setCardState(qaVenueFixture,'selected');document.getElementById('qaVenue').replaceChildren(surface==='feed'?buildEventCard({...qaVenueFixture,eventId:qaVenueFixture.id}):buildCodeInspectorFixture(qaVenueFixture));},surface);
    for(let i=0;i<4;i++){await page.locator('#qaVenue .fixture-more').click();assert(await page.locator('#qaVenue .fixture-venue').isVisible(),'Repeated expansion retains the sourced venue');}
   }
   const cachedLabels=await page.evaluate(()=>{
    const event={...qaVenueFixture,key:'tennis',name:'Player TBD v Player TBC',participantIds:[],participantSlots:[],participants:[],matchupSides:[{players:[{name:'Player TBD',shortName:'Player TBD'}]},{players:[{displayName:'Player TBC'}]}]};
    const compact=buildCompactCardSummary(event),full=majorEventMatchupLineup(event),short=majorEventMatchupLineup(event,{compact:true});
    const sides=majorEventMatchupLineup({...event,matchupSides:[{name:'Side TBC'},{displayName:'Side TBD'}]});
    return {compact:compact.querySelector('.minimised-card-label').textContent,full:full.textContent,short:short.textContent,sides:sides.textContent,choicesUnchanged:qaVenueChoices===JSON.stringify([userPreferences,eventActions])};
   });
   for(const key of ['compact','full','short','sides']){assert(!/\b(?:TBC|TBD)\b/.test(cachedLabels[key]),'Native cached participant boundary: '+key);assert.match(cachedLabels[key],/unavailable/i);}
   assert(cachedLabels.choicesUnchanged);
  }finally{await browser.close();}
 }
 proof.passed=true;
 if(process.env.VENUE_QA_OUTPUT)fs.writeFileSync(path.join(process.env.VENUE_QA_OUTPUT,'venue-browser-proof.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({passed:true,cases:proof.cases.length,engines:['chromium','webkit'],repeatedExpansion:true}));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
