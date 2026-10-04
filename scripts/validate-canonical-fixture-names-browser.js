#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const canonical=require('../data/canonical/afl-nrl-2026.json');
const ids=['event:nrl:129990101','event:afl:cd_m20260140001','event:aflw:cd_m20262640101'];
const slugs=['nrl','afl','aflw'];
const baseline=process.env.REFERENCE_NAMES_BASELINE_JSON?JSON.parse(fs.readFileSync(process.env.REFERENCE_NAMES_BASELINE_JSON)):null;
const fixtures=slugs.map((slug,index)=>({slug,source:canonical.events.find(e=>e.id===ids[index]),fixture:(baseline?.find(row=>row.slug===slug)?.fixtures||require(`../data/code-inspector/${slug}.json`).fixtures).find(e=>e.id===ids[index])}));
assert(fixtures.every(row=>row.source&&row.fixture),'Actual known reference-sport records must remain available');
(async()=>{
 const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});});
 if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,engine=process.env.BROWSER_ENGINE||'chromium';
 const browser=await pw[engine].launch(),observations=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:nrl']})));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
  await page.locator('#startupLaunch').waitFor({state:'hidden',timeout:60000});
  const single=process.env.NAME_CASE_ONLY==='1';
  for(const {slug,source,fixture} of (single?fixtures.slice(0,1):fixtures))for(const width of (single?[390]:[320,390,1280]))for(const theme of (single?['day']:['day','night']))for(const mode of (single?['schedule']:['feed','feed-opened','schedule']))for(const results of (single?[false]:[false,true])){
   await page.setViewportSize({width,height:844});
   const receipt=await page.evaluate(({fixture,theme,mode,results})=>{activeTab=mode==='schedule'?'follow':'feed';userPreferences.feedCompact=mode==='feed';userPreferences.showSpoilers=results;applyThemePreference(theme);const event={...fixture,eventId:fixture.id};setCardState(event,mode==='feed'?'compact':'opened');const card=mode==='schedule'?buildCodeInspectorFixture(fixture):buildEventCard(event);card.style.contentVisibility='visible';const panel=document.createElement('div');panel.className=mode==='schedule'?'follow-schedule-panel':'';panel.append(card);document.getElementById('listView').replaceChildren(panel);return {text:card.innerText,labels:[...card.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')),overflow:document.documentElement.scrollWidth>innerWidth+1,fixtureId:card.dataset.eventId};}, {fixture,theme,mode,results});
   const label=`${engine}/${slug}/${width}/${theme}/${mode}/${results}`;
   const provenance=await page.evaluate(({fixture,slug})=>{const converted=NOTHINGSPORTS_FIXTURE_IDENTITY.fromSchedule(fixture,{slug});return Object.fromEntries(['sourceUrl','sourceName','sourceType','sourceCheckedAt'].map(key=>[key,converted[key]]));},{fixture,slug});
   for(const key of ['sourceUrl','sourceName','sourceType','sourceCheckedAt'])assert.equal(provenance[key],fixture[key],label+': browser Schedule conversion retains supplied '+key);
   assert(!receipt.text.includes('Fixture details unconfirmed'),label+': known details cannot be described as unknown');
   assert(receipt.labels.every(text=>!text.includes('Fixture details unconfirmed')),label+': accessible controls must identify the known fixture');
   assert(receipt.labels.includes('Dismiss '+source.displayName),label+': dismissal names the correct contest');
   assert(!receipt.overflow,label+': no horizontal page overflow');
   if(!results&&source.result?.scorelineText){const score=source.result.scorelineText.split('—').at(-1).trim();assert(!receipt.text.includes(score),label+': source score remains protected');}
   if(results&&mode!=='feed'&&source.result?.scorelineText){const score=source.result.scorelineText.split('—').at(-1).trim();assert(receipt.text.includes(score),label+': Expanded Results-on shows the actual canonical final score');}
   observations.push({slug,id:fixture.id,width,theme,mode,results,knownTitle:source.displayName,provenance,unknownDetailLabel:false,overflow:false});
  }
  if(process.env.REFERENCE_NAMES_REPORT_PATH)fs.writeFileSync(process.env.REFERENCE_NAMES_REPORT_PATH,JSON.stringify({checkedAt:new Date().toISOString(),engine,cases:observations.length,scope:'Actual affected local/hosted component renderers using public projection records; synthetic preferences, other APIs/workers isolated; no account or physical-device proof',observations},null,2)+'\n');
  console.log(`Canonical fixture titles/provenance (${engine}): ${observations.length} actual Feed/Schedule cases preserve supplied source metadata, named accessible controls, honest known-detail labels, Results privacy and responsive layout`);
 }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
