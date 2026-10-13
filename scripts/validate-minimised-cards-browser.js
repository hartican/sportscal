'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const reference='2026-10-13T00:26:33Z';
const published=require('../data/events.json').events;
const cricket=require('../data/follow-schedule/cricket.json').fixtures.find(f=>f.sourceEventIds?.includes('fixture:cricket:CA:39990'));
const tennis=require('../data/follow-schedule/tennis.json').fixtures.find(f=>f.id==='fixture:tennis:espn:wta:184356');
const football=require('../data/code-inspector/football.json').fixtures.find(f=>f.key==='football'&&f.participantIds?.length===2&&f.startTimeUtc);
const parents=require('../data/tennis-feed-parents.v1.json').parents;
const fixtures=[
 {label:'published-cricket',event:cricket},
 {label:'published-tennis',event:tennis},
 {label:'published-nrl',event:published.find(f=>f.id==='major-match-nrl-finals-2026-preliminary-final-2')},
 {label:'published-afl',event:published.find(f=>f.key==='afl'&&f.participantIds?.length===2)},
 {label:'published-football',event:football},
 {label:'published-combined-overview',event:parents.find(f=>f.id==='tennis-parent:australian-open:2027:main')},
 {label:'controlled-combined-progress',event:{...parents.find(f=>f.tour==='BOTH'),id:'qa:minimised:combined',eventId:'qa:minimised:combined',tournamentId:'qa:minimised:combined',tennisTournamentId:'qa:minimised:combined',competitionId:'competition:qa:minimised:combined',startDate:'2026-10-12',participantIds:tennis.participantIds,participants:tennis.participants,status:'ongoing',scheduleStatus:'ongoing',date:'2026-10-12',endDate:'2026-10-18',tournamentProgress:['ATP','WTA'].map(tour=>({tour,drawType:'singles',mainDraw:true,roundNumbers:[3,4],totalRounds:7,playDate:'2026-10-12',sourceUrl:'https://www.atptour.com/controlled-browser-case',sourceCheckedAt:reference}))}},
 {label:'controlled-long-missing',event:{id:'qa:minimised:long',eventId:'qa:minimised:long',key:'tennis',name:'A DeliberatelyLongFirstParticipantSurname v B DeliberatelyLongSecondParticipantSurname',participantIds:['qa:player:first','qa:player:second'],participants:[{id:'qa:player:first',displayName:'A DeliberatelyLongFirstParticipantSurname'},{id:'qa:player:second',displayName:'B DeliberatelyLongSecondParticipantSurname'}],date:'2026-10-14',timeTbc:true,status:'upcoming',roundLabel:'Round of 32'}}
];
assert(fixtures.every(f=>f.event),'Published representatives must exist');
const overviewDocument=require('../data/event-overviews.v1.json');
const dedicatedOverviews=[require('../lib/event-overviews').build([fixtures[5].event]).find(e=>e.tournamentId===fixtures[5].event.tournamentId),require('../lib/event-overviews').build([fixtures[6].event]).find(e=>e.tournamentId===fixtures[6].event.tournamentId),overviewDocument.events.find(e=>e.name==='Buick LPGA Shanghai')];
assert(dedicatedOverviews.every(Boolean),'Published and controlled dedicated overview representatives must exist');
function serve(){const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));}
async function prepare(page,base){
 page.__qaErrors=[];page.on('pageerror',error=>page.__qaErrors.push(error.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.route('**/data/event-overviews.v1.json',r=>r.fulfill({json:{schemaVersion:'event-overviews.v1',events:dedicatedOverviews}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:27,onboardingComplete:true,showSpoilers:true,feedCompact:false,followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}})));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 await page.evaluate(async()=>{document.getElementById('startupLaunch')?.remove();document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));document.body.classList.remove('modal-open','settings-open');await ensureFeedScoreUi();renderAll=()=>{};renderListView=()=>{};});
 await page.addStyleTag({content:'*{animation:none!important;transition:none!important}header.top,#timelineTools{visibility:hidden!important}'});
}
async function render(page,cases,surface,theme,state='compact'){
 return page.evaluate(({cases,surface,theme,state,reference})=>{
  nowAEST=()=>new Date(reference);applyThemePreference(theme);activeTab=surface==='schedule'?'follow':surface;activeInspectorCodeId=surface==='schedule'?'sport:cricket':null;userPreferences.feedCompact=false;userPreferences.showSpoilers=true;
  document.querySelectorAll('main>section').forEach(n=>n.style.display=n.id==='listView'?'':'none');const list=document.getElementById('listView');list.style.display='';list.replaceChildren();
  for(const [i,{event,label}] of cases.entries()){
   const before=JSON.stringify(event);
   setCardState(event,state);const card=surface==='schedule'?buildCodeInspectorFixture({...event,codeId:event.codeId||'sport:'+event.key}):buildEventCard(event);
   card.dataset.minimisedQa=String(i);card.dataset.qaCase=label;list.append(card);
   if(JSON.stringify(event)!==before)throw Error('Native rendering rewrote source event '+label);
  }
  observeDeferredCardImages();return cases.map(({event,label})=>({id:event.eventId||event.id,label,source:JSON.stringify(event)}));
 },{cases,surface,theme,state,reference});
}
async function geometry(page){return page.locator('[data-minimised-qa]').evaluateAll(cards=>cards.map(card=>{
 const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const summary=card.querySelector('.minimised-card-summary'),name=card.querySelector('.minimised-card-name'),time=card.querySelector('.minimised-card-time');
 return {id:card.dataset.eventId,label:card.dataset.qaCase,state:card.dataset.cardState,classes:card.className,card:rect(card),summary:summary&&rect(summary),name:name&&rect(name),time:time&&rect(time),timeText:time?.textContent,text:card.textContent,aria:summary?.getAttribute('aria-label'),title:summary?.title,children:card.children.length,nested:card.querySelectorAll('a,button,input,select,textarea,details,summary').length,forbidden:card.querySelectorAll('.feed-live-score,.fixture-score-summary,.nsc-summary,.fixture-venue,.event-quick-actions,.fixture-card-footer,.fixture-why,.event-card-controls,.event-card-disclosure,.fixture-competition-link,.fixture-data-attribution').length,frames:[...card.querySelectorAll('.minimised-participant-frame')].map(rect),marks:[...card.querySelectorAll('.minimised-participant-mark')].map(n=>({...rect(n),opacity:getComputedStyle(n).opacity,naturalWidth:n.naturalWidth})),formatDisplay:card.querySelector('.minimised-card-format')&&getComputedStyle(card.querySelector('.minimised-card-format')).display,progressText:card.querySelector('.minimised-card-progress')?.textContent,progressDisplay:card.querySelector('.minimised-card-progress')&&getComputedStyle(card.querySelector('.minimised-card-progress')).display};
}));}
async function coldDeferred(browser,base){
 const receipts=[];
 for(const mode of ['reminimise','leave-route','failed-logos']){
  const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block',timezoneId:'Australia/Sydney',locale:'en-AU'});let release;const gate=new Promise(resolve=>release=resolve);let requested;const request=new Promise(resolve=>requested=resolve);
  try{
   if(mode==='failed-logos')await page.route('**/*',r=>r.request().resourceType()==='image'?r.abort():r.continue());
   else await page.route('**/config/feed-live-scores.js*',async route=>{requested();await gate;await route.continue();});
   await prepare(page,base);await render(page,[mode==='failed-logos'?fixtures[2]:fixtures[0]],'feed','day');
   if(mode==='failed-logos'){
    await page.waitForFunction(()=>[...document.querySelectorAll('#listView .minimised-participant-frame')].length===2&&[...document.querySelectorAll('#listView .minimised-participant-frame')].every(frame=>!frame.querySelector('img')));
    const failures=await page.locator('#listView .minimised-participant-frame').evaluateAll(frames=>frames.map(frame=>{const fallback=frame.querySelector('.minimised-participant-fallback');if(!fallback)return{count:0};const a=frame.getBoundingClientRect(),b=fallback.getBoundingClientRect();return{count:frame.querySelectorAll('.minimised-participant-fallback').length,offset:Math.abs(a.y+a.height/2-b.y-b.height/2),size:a.width};}));assert(failures.every(f=>f.count===1&&f.offset<1&&Math.round(f.size)===20),'failed original tiny artwork retains one centred fallback');receipts.push({mode,failures});continue;
   }
   assert(await page.evaluate(()=>!globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES),'Cold case starts before the score module loads');
   await page.locator('#listView .minimised-card-summary').click();await Promise.race([request,new Promise((_,reject)=>setTimeout(()=>reject(Error('Deferred score request did not begin')),5000))]);
   if(mode==='reminimise')await page.locator('#listView .event-card-disclosure').click();else await page.evaluate(()=>{activeTab='events';document.getElementById('listView').replaceChildren();});
   release();await page.waitForFunction(()=>Boolean(globalThis.NOTHINGSPORTS_FEED_LIVE_SCORES));await page.waitForTimeout(50);assert.equal(await page.locator('#listView .feed-live-score').count(),0,'late score completion cannot recreate hidden/left-route content');
   if(mode==='reminimise'){assert.equal(await page.locator('#listView .is-minimised-row').count(),1);assert.equal(await page.locator('#listView .event-card').evaluate(n=>n.children.length),1);await page.locator('#listView .minimised-card-summary').click();await page.locator('#listView .fixture-score-summary').waitFor({state:'visible'});assert.equal(await page.locator('#listView .event-card').getAttribute('data-card-state'),'selected');}
   receipts.push({mode,lateScoreAbsent:true,normalRestored:mode==='reminimise'});
  }finally{release();const errors=page.__qaErrors||[];await page.close();assert.deepEqual(errors,[],'Cold native renderer has no JavaScript exceptions');}
 }
 return receipts;
}
async function dedicated(page,width,theme){
 await page.evaluate(async({parents,overviews,theme})=>{
  if(!globalThis.NOTHINGSPORTS_TENNIS_PARENT_UI)await loadDeferredScript('assets/js/tennis-parent-ui.js?v=522');if(!globalThis.NOTHINGSPORTS_EVENT_OVERVIEWS_UI)await loadDeferredScript('config/event-overviews-ui.js?v=522');applyThemePreference(theme);activeTab='feed';activeInspectorCodeId=null;userPreferences.feedCompact=false;
  const list=document.getElementById('listView');list.replaceChildren();
  for(const [i,event] of parents.entries()){setCardState(event,'compact');const card=NOTHINGSPORTS_TENNIS_PARENT_UI.build(event);card.dataset.minimisedQa=String(i);card.dataset.qaCase='dedicated-parent-'+i;list.append(card);}
 },{parents:[fixtures[5].event,fixtures[6].event],overviews:dedicatedOverviews,theme});
 const parentRows=await geometry(page);for(const row of parentRows){assert.equal(Math.round(row.card.height),56);assert.equal(row.children,1);assert.equal(row.nested,1);assert.equal(row.forbidden,0);assert(row.time.right<=row.card.right+1&&row.name.right<=row.time.x+1,'dedicated parent stays in one line');}
 await page.locator('[data-minimised-qa="0"] .minimised-card-summary').focus();await page.keyboard.press('Enter');const normalParent=page.locator('#listView .tennis-feed-parent').first();assert(!(await normalParent.getAttribute('class')).includes('is-minimised-row'));assert.equal(await normalParent.locator('details').getAttribute('open'),null,'parent row opens normal card, keeping matches closed');assert.equal(await normalParent.locator('.fixture-source-dates').count(),1,'normal parent retains complete dates');const alignments=await normalParent.locator('.tennis-parent-title,.tournament-parent-context,.tennis-parent-dates').evaluateAll(ns=>ns.map(n=>({className:n.className,align:getComputedStyle(n).textAlign})));assert(alignments.every(n=>n.align==='center'),'normal parent non-editorial labels are centred: '+JSON.stringify(alignments));
 await normalParent.locator('.event-card-disclosure').click();assert((await normalParent.getAttribute('class')).includes('is-minimised-row'),'dedicated parent minimise control returns to shared row');
 await page.evaluate(async overviews=>{activeTab='events';userPreferences.eventsScope='all';for(const e of overviews)setCardState(e,'compact');const list=document.getElementById('listView');list.replaceChildren();await NOTHINGSPORTS_EVENT_OVERVIEWS_UI.render(list);for(const [i,card] of [...list.querySelectorAll('.events-overview-card')].entries()){card.dataset.minimisedQa=String(i);card.dataset.qaCase='dedicated-events-'+i;}},dedicatedOverviews);
 const overviewRows=await geometry(page);assert.equal(overviewRows.length,3);for(const row of overviewRows){assert.equal(Math.round(row.card.height),56);assert.equal(row.children,1);assert.equal(row.nested,1);assert.equal(row.forbidden,0);assert(row.time.right<=row.card.right+1&&row.name.right<=row.time.x+1,'dedicated Events overview stays in one line');}
 const overviewCard=page.locator('#listView .events-overview-card').first();await overviewCard.locator('.minimised-card-summary').click();assert(!(await overviewCard.getAttribute('class')).includes('is-minimised-row'));assert.equal(await overviewCard.locator('details').getAttribute('open'),null,'Events row keeps Fixtures closed');assert(await overviewCard.locator('.event-edition-toggle').count()||await overviewCard.locator('[aria-pressed]').count(),'normal Events overview retains its edition control');await overviewCard.locator('.event-card-disclosure').click();assert((await overviewCard.getAttribute('class')).includes('is-minimised-row'));
 // Consume a real navigation target once; a retained tournament match must
 // not reopen Fixtures when the user subsequently expands a minimised row.
 await page.evaluate(async overviews=>{
  for(const event of overviews)setCardState(event,'selected');
  pendingMajorEventFocusId=overviews[0].id;globalThis.pendingTournamentFocusFixture={id:'qa:overview-navigation-target',tournamentId:overviews[0].tournamentId};
  const list=document.getElementById('listView');list.replaceChildren();await NOTHINGSPORTS_EVENT_OVERVIEWS_UI.render(list);
 },dedicatedOverviews);
 await page.waitForFunction(()=>pendingMajorEventFocusId===null&&globalThis.pendingTournamentFocusFixture===null);
 const targeted=page.locator(`#listView .events-overview-card[data-event-overview-id="${dedicatedOverviews[0].id}"]`);
 assert.equal(await targeted.locator('details').getAttribute('open'),'','initial navigation still opens the target fixtures');
 for(let i=0;i<2;i++){
  await targeted.locator('.event-card-disclosure').click();await targeted.locator('.minimised-card-summary').click();
  assert.equal(await targeted.locator('details').getAttribute('open'),null,'reopening a targeted row keeps Fixtures closed');
  await targeted.locator('details>summary').click();assert.equal(await targeted.locator('details').getAttribute('open'),'','explicit Fixtures choice still opens details');
 }
 // A delayed published-fixture read may finish after the user minimises the
 // parent. It must not resurrect detached normal-card content into the row.
 await page.evaluate(async parent=>{
  activeTab='feed';window.minimisedOriginalContestLoader=loadTennisFeedContests;loadTennisFeedContests=()=>new Promise(resolve=>window.minimisedResolveContests=resolve);tennisFeedOpenParents.add(parent.id);setCardState(parent,'selected');document.getElementById('listView').replaceChildren(NOTHINGSPORTS_TENNIS_PARENT_UI.build(parent));await Promise.resolve();
 },fixtures[5].event);
 const late=page.locator('#listView .tennis-feed-parent');await page.waitForFunction(()=>typeof minimisedResolveContests==='function');await late.locator('.event-card-disclosure').click();await page.evaluate(async()=>{minimisedResolveContests({fixtures:[]});await Promise.resolve();loadTennisFeedContests=minimisedOriginalContestLoader;});await page.waitForTimeout(50);assert.equal(await late.locator('.minimised-card-summary').count(),1);assert.equal(await late.locator('.tennis-parent-next,.tennis-parent-contests,details').count(),0,'late fixture response does not recreate the hidden body');await late.locator('.minimised-card-summary').click();assert.equal(await late.locator('details').getAttribute('open'),null,'previously open matches do not bypass normal state');
 return{width,theme,parentRows:parentRows.map(r=>({id:r.id,height:r.card.height,time:r.timeText})),overviewRows:overviewRows.map(r=>({id:r.id,height:r.card.height,time:r.timeText})),delayedParent:true};
}
async function run(){
 const output=process.env.QA_SCREENSHOT_DIR||'/Users/jackhartican/Documents/AI/Codex/compact-cards-ratings-2026-10-13';fs.mkdirSync(output,{recursive:true});
 const server=await serve(),base=process.env.QA_BASE_URL||'http://127.0.0.1:'+server.address().port,results=[];
 try{for(const engine of (process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit'])){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block',timezoneId:'Australia/Sydney',locale:'en-AU'});await prepare(page,base);
   for(const width of [320,390,1280])for(const theme of ['day','night']){for(const surface of ['feed','events','schedule']){
    await page.setViewportSize({width,height:1000});await render(page,fixtures,surface,theme);await page.waitForFunction(()=>[...document.querySelectorAll('#listView .minimised-participant-mark')].every(img=>img.complete&&img.naturalWidth>0&&getComputedStyle(img).opacity==='1'));
    const rows=await geometry(page);fs.writeFileSync(path.join(output,`minimised-observed-${engine}-${width}-${theme}-${surface}.json`),JSON.stringify({engine,width,theme,surface,evidence:'Local native rendering observations; assertions may not have passed.',rows},null,2));if(surface==='feed')await page.locator('#listView').screenshot({path:path.join(output,`minimised-observed-${engine}-${width}-${theme}.png`)});assert.equal(rows.length,fixtures.length);
    for(const row of rows){
     assert(row.classes.includes('is-minimised-row'),JSON.stringify({width,theme,surface,row}));assert.equal(Math.round(row.card.height),56,`${row.label} fixed row height`);assert.equal(row.children,1,'row contains only its shared summary');assert.equal(row.nested,1,'native row button is the sole activation target');assert.equal(row.forbidden,0,'row excludes detailed content/actions');
     assert(row.name&&row.time&&row.aria&&row.title,'names/time and full accessible context remain');assert(row.time.width>0,'time/status cannot disappear');assert(row.name.height<30&&row.time.height<30,'names and clocks remain one line');assert(row.time.right<=row.card.right+1&&row.name.right<=row.time.x+1,'names cannot overlap the clock: '+JSON.stringify({width,theme,surface,row}));assert(row.summary.right<=row.card.right+1,'summary fits card');
     for(const frame of row.frames)assert.equal(Math.round(frame.width),20,'tiny logo frame');for(const mark of row.marks){assert.equal(Math.round(mark.width),20);assert.equal(Math.round(mark.height),20);assert.equal(mark.opacity,'1','loaded tiny artwork is visible');assert(mark.naturalWidth>0,'loaded tiny artwork has decoded pixels');}
     if(width===320&&row.formatDisplay!=='none')assert.equal(row.progressDisplay,'none','format must be omitted before progress');
     if(row.label==='published-combined-overview')assert.equal(row.progressText,'','upcoming overview retains dates without a match-round placeholder');if(row.label==='controlled-combined-progress')assert(!row.text.includes(' v '),'a twoentrant overview stilluses eventname');
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document has no horizontal overflow');
    await page.locator('[data-minimised-qa="0"] .minimised-card-summary').focus();await page.keyboard.press('Enter');
    const expanded=page.locator('#listView .event-card').first();await expanded.waitFor();assert.equal(await expanded.getAttribute('data-card-state'),'selected','Enter opens the normal card');assert(!(await expanded.getAttribute('class')).includes('is-minimised-row'));
    assert.equal(await expanded.locator('.fixture-venue').count(),1,'normal card restores venue');
    const score=expanded.locator('.fixture-score-summary');if(surface==='feed'){
     await score.waitFor({state:'visible',timeout:5000});assert.equal(await score.count(),1,'normal Cricket restores a score summary');assert.match(await score.textContent(),/Proteas.*102\/4/);assert(!/South Africa Men|Australia Men/.test(await score.textContent()),'summary deduplicates gender/name');
     const type=await score.evaluate(n=>({decoration:getComputedStyle(n).textDecorationLine,font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight,align:getComputedStyle(n).textAlign,venueFont:getComputedStyle(n.closest('.event-card').querySelector('.fixture-venue')).fontSize,venueWeight:getComputedStyle(n.closest('.event-card').querySelector('.fixture-venue')).fontWeight}));assert.equal(type.decoration,'none');assert.equal(type.font,type.venueFont);assert.equal(type.weight,type.venueWeight);assert.equal(type.align,'center');
    }
    const fullFrames=await expanded.locator('.matchup-team-logo-slot').evaluateAll(ns=>ns.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));assert.equal(fullFrames.length,2,'Cricket restores the two full team marks');for(const frame of fullFrames){assert.equal(Math.round(frame.width),width<360?80:96);assert.equal(Math.round(frame.height),width<360?80:96);}
    await render(page,[fixtures[0]],surface,theme);await page.locator('#listView .is-minimised-row .minimised-card-summary').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#listView .event-card').first().getAttribute('data-card-state'),'selected','Space opens normal card');
    await render(page,fixtures,surface,theme);await page.locator('[data-minimised-qa="1"]').click();assert.equal(await page.locator('#listView .event-card').nth(1).getAttribute('data-card-state'),'selected','pointer opens normal card');
    await render(page,fixtures,surface,theme);await page.locator('[data-minimised-qa="5"] .minimised-card-summary').click();assert(!(await page.locator('#listView .event-card').nth(5).getAttribute('class')).includes('is-minimised-row'),'overview row opens its ordinary native renderer');
    await render(page,fixtures,surface,theme);if(surface==='feed')await page.locator('#listView').screenshot({path:path.join(output,`minimised-${engine}-${width}-${theme}.png`)});
    results.push({engine,width,theme,surface,cases:rows.map(r=>({label:r.label,height:r.card.height,time:r.timeText,formatVisible:r.formatDisplay!=='none',progressVisible:r.progressDisplay!=='none'})),keyboard:true,pointer:true,normalCricketLogoSize:width<360?80:96});console.log(`${engine}/${width}/${theme}/${surface}: ${rows.length} native rows, keyboard/pointer and normal Cricket passed`);
   }results.push({engine,dedicated:await dedicated(page,width,theme)});console.log(`${engine}/${width}/${theme}: dedicated parent/Events overviews and delayed parent response passed`);}
   results.push({engine,coldDeferred:await coldDeferred(browser,base)});
   const controlled=[{label:'controlled-not-before',event:{...tennis,id:'qa:minimised:nb',eventId:'qa:minimised:nb',canonicalEventId:'qa:minimised:nb',date:'2026-10-13',startTimeUtc:'2026-10-13T10:00:00Z',status:'upcoming',scheduleStatus:'upcoming',timePrecision:'not-before',timeTbc:false,startTimeTbc:false,dateOnly:false,sourceEventIds:[]}},...['live','completed','stumps','rain-delay'].map(status=>({label:'controlled-'+status,event:{...cricket,id:'qa:minimised:'+status,eventId:'qa:minimised:'+status,canonicalEventId:'qa:minimised:'+status,sourceEventIds:[],status,scheduleStatus:status,statusCheckedAt:reference,scoreCheckedAt:reference,restartTimeUtc:status==='stumps'?'2026-10-13T07:30:00Z':null}})),{label:'controlled-expired-restart',event:{...cricket,id:'qa:minimised:expired',eventId:'qa:minimised:expired',canonicalEventId:'qa:minimised:expired',sourceEventIds:[],restartTimeUtc:'2026-10-12T07:30:00Z',statusCheckedAt:reference}}];
   await render(page,controlled,'feed','day');const statusRows=await geometry(page);assert.match(statusRows[0].timeText,/NB\s*21:00/);assert.match(statusRows[1].timeText,/LIVE/);assert.match(statusRows[2].timeText,/FINISHED/);assert.match(statusRows[3].timeText,/18:30/);assert(!statusRows[5].timeText.includes('18:30'),'expired restart does not retain a future-looking clock');assert.match(statusRows[5].aria,/Awaiting resumption update/i);
   await render(page,[fixtures[0]],'feed','day','selected');await page.evaluate(event=>{userPreferences.showSpoilers=false;document.getElementById('listView').replaceChildren(buildEventCard(event));},cricket);assert.equal(await page.locator('#listView .feed-live-score').count(),0,'normal Cricket preserves Results OFF');
   results.push({engine,controlledTiming:statusRows.map(r=>({label:r.label,time:r.timeText,aria:r.aria})),errors:page.__qaErrors});assert.deepEqual(page.__qaErrors,[],'Native renderers have no JavaScript exceptions');
  }finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(output,'minimised-browser-results.json'),JSON.stringify({reference,evidence:'Local native renderer against published fixtures and explicitly labelled controlled cases; API unavailable response injected; no physical-device evidence.',results},null,2));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixtures,reference};
