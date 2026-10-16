'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const out=process.env.HIGHLIGHTS_EVIDENCE_DIR||'/tmp/reviewed-publisher-highlights';
const fixture=require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026');
const now=new Date('2026-10-16T02:00:00Z'),destination=require('../config/fixture-highlights').viewing(fixture,now).webUrl;
assert.equal(new URL(destination).hostname,'www.rlwc2026.com');
const preferences={version:27,onboardingComplete:true,showSpoilers:false,theme:'night',selectedSelectorEntityIds:['sport:nrl'],preferenceGraph:{entityFollows:[{participantId:'team:nrl:kangaroos',followLevel:'follow'}]},followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}};
const types={'.js':'application/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(404);return res.end();}fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(error?'':bytes);});});
async function main(){
 fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,runs=[];
 try{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true});try{for(const width of [320,390,1280]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:1000}}),page=await context.newPage(),errors=[];let resolverRequests=0,publisherRequests=0;
  page.on('pageerror',error=>errors.push(error.message));await page.clock.setFixedTime(now);
  await context.addInitScript(p=>localStorage.setItem('ns_preferences_v1',JSON.stringify(p)),preferences);
  await context.route('**/api/**',route=>{if(new URL(route.request().url()).searchParams.get('mode')==='highlight')resolverRequests++;return route.fulfill({status:503,json:{}});});
  // Transport stub only: actual publisher footage is verified separately in the native browser.
  await context.route(destination,route=>{publisherRequests++;return route.fulfill({status:200,contentType:'text/html',body:'<h1>Official publisher destination</h1>'});});
  await page.goto(base,{waitUntil:'commit'});await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:60000});await page.waitForTimeout(5500);
  for(const theme of ['day','night'])for(const tab of ['feed','events']){
   await page.evaluate(({fixture,theme,tab})=>{acknowledgeSelectorRelease();closeSelectorOptInPrompt({restoreViewport:false});document.querySelectorAll('[role=dialog]').forEach(n=>n.parentElement.style.display='none');document.getElementById('startupLaunch')?.remove();document.documentElement.dataset.theme=theme;activeTab=tab;activeEvents=[fixture];userPreferences.showSpoilers=false;setCardState(fixture,'selected');const host=document.getElementById('listView');host.style.display='block';host.replaceChildren(buildEventCard(fixture));},{fixture,theme,tab});
   const card=page.locator('#listView .event-card'),link=card.locator('.fixture-highlights-link');await link.scrollIntoViewIfNeeded();await link.waitFor({state:'visible'});
   assert.equal(await link.count(),1);assert.equal(await link.getAttribute('href'),destination);assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);assert.match(await link.innerText(),/RLWC2026.*Watch highlights/s);assert.match(await link.getAttribute('aria-label'),/Watch highlights/);assert.equal(await link.locator('img').count(),0,'No YouTube logo on the official publisher action');assert.equal(await card.locator('iframe').count(),0);
   assert(!/24[–-]22/.test(await card.innerText()),'Results OFF preserves score privacy');const box=await link.boundingBox();assert(box.width>=44&&box.height>=44);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
   const choices=await page.evaluate(()=>JSON.stringify([userPreferences.preferenceGraph,userPreferences.followFirst,eventActions]));
   for(let i=0;i<3;i++){await card.getByRole('button',{name:'More…',exact:true}).click();await card.getByRole('button',{name:'Less',exact:true}).waitFor();assert.equal(await link.count(),1);assert.equal(await link.getAttribute('href'),destination);await card.getByRole('button',{name:'Less',exact:true}).click();}
   const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),destination);await popup.close();assert.equal(resolverRequests,0,'Exact publisher tap consumes zero resolver/search calls');assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences.preferenceGraph,userPreferences.followFirst,eventActions])),choices,'Viewing and repeated expansion preserve saved choices');
   await page.screenshot({path:path.join(out,`${engine}-${width}-${theme}-${tab}.png`)});
   await page.evaluate(f=>{setCardState(f,'compact');document.getElementById('listView').replaceChildren(buildEventCard(f));},fixture);const mini=page.locator('#listView .event-card'),miniLink=mini.locator('.fixture-highlights-link');await miniLink.scrollIntoViewIfNeeded();assert.equal(await miniLink.getAttribute('href'),destination);const miniBox=await mini.boundingBox(),actionBox=await miniLink.boundingBox();assert.equal(Math.round(miniBox.height),56);assert(actionBox.width>=44&&actionBox.height>=44&&actionBox.y+actionBox.height<=miniBox.y+miniBox.height+1);
   await miniLink.evaluate(node=>node.addEventListener('click',event=>event.preventDefault(),{once:true}));await miniLink.click();assert.equal(await mini.getAttribute('data-card-level'),'L0');
   await page.screenshot({path:path.join(out,`${engine}-${width}-${theme}-${tab}-compact.png`)});
   // A mounted action must recheck source expiry at the tap, without a resolver or popup.
   await page.clock.setFixedTime(new Date('2026-10-23T23:03:49.044Z'));const before=publisherRequests;let unexpectedPopup=false;const observe=()=>{unexpectedPopup=true;};page.on('popup',observe);await miniLink.click();await page.waitForTimeout(50);page.off('popup',observe);assert(!unexpectedPopup);assert.equal(publisherRequests,before);assert.equal(resolverRequests,0);await page.clock.setFixedTime(now);
   runs.push({engine,width,theme,tab,collapsedExpandedCompact:true,actualPublisherTap:true,resolverRequests,expiryBlocksMountedTap:true});
  }
  // An unrelated completed match keeps the existing Feed-only YouTube route.
  await page.evaluate(f=>{const ordinary={...f,id:'fixture:test:other',eventId:'fixture:test:other',canonicalEventId:'fixture:test:other'};activeTab='feed';activeEvents=[ordinary];setCardState(ordinary,'selected');document.getElementById('listView').replaceChildren(buildEventCard(ordinary));},fixture);const generic=page.locator('#listView .fixture-highlights-link');assert.match(await generic.getAttribute('href'),/^\/api\/fixtures\?mode=highlight&ids=/);assert.match(await generic.locator('img').getAttribute('src'),/youtube\.png/);assert.deepEqual(errors,[]);
  await context.close();console.log('Reviewed publisher native renderer',engine,width,'passed');
 }}finally{await browser.close();}}}finally{await new Promise(resolve=>server.close(resolve));}
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Actual shared renderer/launch; controlled publisher transport; separate native footage proof',runs},null,2)+'\n');console.log('Reviewed publisher highlights: '+runs.length+' Feed/Events browser/width/theme cases passed; zero resolver/provider API requests.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
