'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 let releaseUi;const uiGate=new Promise(r=>{releaseUi=r;});
 try{
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage();
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/js/settings-optional-ui.js*',async route=>{await uiGate;await route.continue();});
  const originals=require('../data/events.json').events.filter(e=>e.key==='premier-league'&&Date.parse(e.startTimeUtc)>Date.now()).slice(0,6);assert.equal(originals.length,6);
  const checkedAt=new Date().toISOString(),start=new Date(Date.now()+3*86400000).toISOString(),deadline=new Date(Date.now()+2*86400000).toISOString();
  const events=originals.map((original,i)=>({...original,id:'fantasy-mount-'+i,eventId:'fantasy-mount-'+i,canonicalEventId:'fantasy-mount-'+i,sourceEventIds:[],date:start.slice(0,10),startTimeUtc:new Date(Date.parse(start)+i*7200000).toISOString(),endTimeUtc:new Date(Date.parse(start)+(i+1)*7200000).toISOString(),status:'upcoming',scheduleStatus:'confirmed'}));
  const enriched=events.map(e=>({...e,fantasyDeadlines:[{schemaVersion:'fantasy-deadlines.v1',providerId:'premier-league',gameId:'fpl-classic',sourceId:'live-fantasy-fpl',competitionId:e.competitionId,seasonId:'2026-27',fantasyRoundId:'fpl-classic:2026-27:mount',mappingStatus:'verified',lockoutType:'whole-team',action:'initial-team-submission',deadlineAt:deadline,fixtureStartAt:e.startTimeUtc,homeParticipantId:e.homeParticipantId,awayParticipantId:e.awayParticipantId}]}));
  let releaseRead;const readGate=new Promise(r=>{releaseRead=r;});
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());if(url.pathname!=='/api/fixtures')return route.fulfill({status:304});
   const ids=(url.searchParams.get('ids')||'').split(',');requests.push(ids);
   if(ids.includes('fantasy-mount-2'))await readGate;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaVersion:'live-fixtures.v1',revision:ids.join(','),fantasySources:{'live-fantasy-fpl':{enabled:true,accessStatus:'evaluation',checkedAt}},sources:[{source_id:'current-fixtures',fixtures:enriched.filter(e=>ids.includes(e.id))}]})});
  });
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
  await page.evaluate(events=>{
   userPreferences={...userPreferences,onboardingComplete:true,fantasyDeadlines:NOTHINGSPORTS_FANTASY_PREFERENCES.onboardingChoice(true)};document.getElementById('settingsModal').classList.remove('show');settingsFirstRun=false;activeTab='feed';activeEvents=events;window.mountTestEvents=events;renderFeedIfPresentationChanged=()=>false;
   resetFeedCardWindow();initialFeedCardIds=new Set(events.map(e=>e.id));events.forEach((e,i)=>{cardViewStates[e.id]=i%2?'compact':'selected';});const host=document.createElement('div');host.id='fantasy-mount-host';host.append(buildFeedCardSlot(events[0]));document.getElementById('listView').replaceChildren(host);
  },events);
  releaseUi();await page.evaluate(()=>ensureFantasyUi());
  await page.evaluate(async()=>{liveFixtureLastRequestedAt=0;await refreshLiveFixtureSnapshot();});
  await page.locator('[data-feed-event-id="fantasy-mount-0"] .fantasy-deadline').waitFor();
  // The user scrolls to another card before the ordinary polling interval.
  await page.evaluate(()=>document.getElementById('fantasy-mount-host').append(buildFeedCardSlot(mountTestEvents[1])));
  await page.locator('[data-feed-event-id="fantasy-mount-1"]').scrollIntoViewIfNeeded();
  await page.locator('[data-feed-event-id="fantasy-mount-1"] .event-card').waitFor();
  try{await page.locator('[data-feed-event-id="fantasy-mount-1"] .fantasy-deadline').waitFor({timeout:2500});}
  catch(error){console.error('Mounted-card requests',requests);throw error;}
  const before=requests.length;
  await page.evaluate(()=>{for(const item of feedCardSlots.values()){item.placeholder();item.slot.replaceChildren(buildEventCard(item.event));}});
  await page.locator('[data-feed-event-id="fantasy-mount-0"] .fantasy-deadline').waitFor({timeout:1500});
  await page.locator('[data-feed-event-id="fantasy-mount-1"] .fantasy-deadline').waitFor({timeout:1500});
  await page.waitForTimeout(400);assert.equal(requests.length,before,'remounting recently checked cards keeps enrichment without duplicate requests');
  await page.evaluate(()=>document.getElementById('fantasy-mount-host').append(buildFeedCardSlot(mountTestEvents[2])));
  for(let i=0;i<20&&!requests.some(ids=>ids.includes('fantasy-mount-2'));i++)await page.waitForTimeout(100);
  assert(requests.some(ids=>ids.includes('fantasy-mount-2')),'the third card begins a bounded request');
  await page.evaluate(()=>document.getElementById('fantasy-mount-host').append(buildFeedCardSlot(mountTestEvents[3])));
  await page.waitForTimeout(350);releaseRead();
  await page.locator('[data-feed-event-id="fantasy-mount-3"] .fantasy-deadline').waitFor({timeout:2500});
  assert.deepEqual(requests.filter(ids=>ids.some(id=>['fantasy-mount-1','fantasy-mount-2','fantasy-mount-3'].includes(id))),[['fantasy-mount-1'],['fantasy-mount-2'],['fantasy-mount-3']],'new fixtures batch without repeatedly reading known cards, including mounts during an in-flight request');
  const batchStart=requests.length;
  await page.evaluate(()=>{const host=document.getElementById('fantasy-mount-host');host.append(buildFeedCardSlot(mountTestEvents[4]),buildFeedCardSlot(mountTestEvents[5]));});
  await page.locator('[data-feed-event-id="fantasy-mount-5"] .fantasy-deadline').waitFor({timeout:2500});
  assert.equal(requests.length,batchStart+1,'simultaneous mounts share one request');assert.deepEqual(requests.at(-1),['fantasy-mount-4','fantasy-mount-5']);
  assert.equal(await page.locator('#fantasy-mount-host .fantasy-deadline').count(),6);
  await page.evaluate(()=>saveFantasySetting({...userPreferences.fantasyDeadlines,enabled:false}));assert.equal(await page.locator('.fantasy-deadline').count(),0);
  assert.equal(await page.evaluate(()=>fantasyDeadlineController.timerActive),false);
  assert.deepEqual(errors,[]);assert(requests.length>=2,'a newly mounted fixture requests its verified enrichment');
  assert(requests.every(ids=>ids.length<=60));
  console.log('Fantasy mounted Feed: lazy UI retrofit, new cards, remounts, in-flight mounts, shared request batches, 60-fixture bound and immediate opt-out passed.');
 }finally{releaseUi();await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
