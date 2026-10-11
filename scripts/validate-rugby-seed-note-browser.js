'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file))),id='evt_100';
const cases=[['captured-cache',read('scripts/fixtures/rugby-seed-evt-100-20261012.json')],['retained-feed',read('data/events.json').events.find(e=>e.id===id)],['code',read('data/code-inspector/rugby-union.json').fixtures.find(e=>e.id===id)],['follow-schedule',read('data/follow-schedule/rugby-union.json').fixtures.find(e=>e.id===id)]];
(async()=>{
 const results=[];
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [320,390,1280]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['rugby'],selectedSelectorEntityIds:['sport:rugby']})));
   await page.route('**/api/**',route=>route.fulfill({status:503,json:{}}));
   await page.goto(process.env.RUGBY_NOTE_QA_URL||'http://127.0.0.1:33971',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
   await page.locator('#startupLaunch').waitFor({state:'hidden'});
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('mainContent')).opacity==='1');
   for(const [origin,record] of cases){
    const result=await page.evaluate(({record})=>{
     const preferences=JSON.stringify(userPreferences),original=JSON.stringify(record),prior=activeTab;activeTab='feed';
     document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));
     // Keep the actual renderer visible while normal background Feed hydration
     // owns listView. This isolated renderer check is not a native-route test.
     let host=document.getElementById('rugbyNoteAudit');if(!host){host=document.createElement('section');host.id='rugbyNoteAudit';document.getElementById('listView').prepend(host);}
     host.replaceChildren(buildEventCard(record));const normalized=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(record);
     const result={text:host.innerText,id:normalized.id,date:normalized.date,time:normalized.time,participants:normalized.participantIds,reminderTiming:eventReminderTiming(normalized),preferencesPreserved:JSON.stringify(userPreferences)===preferences,inputUnchanged:JSON.stringify(record)===original,buttons:[...host.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.innerText),overflow:document.documentElement.scrollWidth>innerWidth+1};activeTab=prior;return result;
    },{record});
    assert.equal(result.id,id);assert(!result.date&&!result.time&&!result.reminderTiming);assert.deepEqual(result.participants,[]);assert(result.preferencesPreserved&&result.inputUnchanged&&!result.overflow);
    assert(/unconfirmed listing/.test(result.text)&&/DATE TBC.*TIME TBC/s.test(result.text),result.text);
    assert(!/28 NOV|00:00|12:00 AM|Watch via Stan Sport|Tap to rate|Remind/.test(result.text),result.text);
    assert(!result.buttons.some(label=>/remind|calendar/i.test(label)),'Unknown appointment has no scheduling control');
    const visibleCard=page.locator('#rugbyNoteAudit .event-card');await visibleCard.waitFor({state:'visible'});await page.evaluate(()=>window.scrollTo(0,0));
    assert((await visibleCard.innerText()).includes('unconfirmed listing'),'The checked copy must actually remain visible after layout');
    assert(await visibleCard.evaluate(card=>{const outer=card.getBoundingClientRect(),copy=card.querySelector('.compact-card-copy').getBoundingClientRect();return copy.left>=outer.left-1&&copy.right<=outer.right+1;}),'The real list stylesheet must keep the message inside the card');
    results.push({engine,width,origin,...result});
    if(process.env.RUGBY_NOTE_REPORT_DIR&&width===390&&origin==='retained-feed'){
     fs.mkdirSync(process.env.RUGBY_NOTE_REPORT_DIR,{recursive:true});await visibleCard.screenshot({path:path.join(process.env.RUGBY_NOTE_REPORT_DIR,engine+'-note.png')});
    }
   }
   assert.deepEqual(errors,[]);await page.close();
  }}finally{await browser.close();}
 }
 if(process.env.RUGBY_NOTE_REPORT_DIR)fs.writeFileSync(path.join(process.env.RUGBY_NOTE_REPORT_DIR,'browser-result.json'),JSON.stringify({passed:true,simulation:true,physicalDevice:false,results},null,2)+'\n');
 console.log(JSON.stringify({passed:true,engines:['chromium','webkit'],widths:[320,390,1280],renderedCases:results.length,physicalDevice:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
