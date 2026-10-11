'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),model=require('../config/match-centre');
const capture=require('./fixtures/match-centre-mobile-layout-20261012.json');
const now=Date.parse('2026-10-12T00:00:00Z'),stamp=new Date(now-60000).toISOString(),restart='2026-10-12T07:30:00Z';
const cricket={...capture.events[0],status:'stumps',statusCheckedAt:stamp,statusFactObservedAt:stamp,restartTimeUtc:restart};
const base=capture.events[1];
const fixture=(id,status,minutes,extra={})=>({...base,id,eventId:id,canonicalEventId:id,sourceEventIds:[],status,statusCheckedAt:stamp,statusFactObservedAt:new Date(now-minutes*60000).toISOString(),pauseObservation:{status,reason:status==='break'?'half-time':'rain delay',observedAt:new Date(now-minutes*60000).toISOString()},completedAt:null,startTimeUtc:new Date(now-(minutes+60)*60000).toISOString(),...extra});
const events=[cricket,fixture('brief','break',1,{statusText:'Half-time'}),fixture('long','rain-delay',30),fixture('awaiting','live',50,{statusCheckedAt:new Date(now-240001).toISOString()}),fixture('soon','scheduled',5,{startTimeUtc:new Date(now+60000).toISOString()}),fixture('finished','completed',5,{completedAt:stamp}),fixture('playing','live',1)];
const results=[];
(async()=>{for(const engine of (process.env.PAUSED_ENGINE?[process.env.PAUSED_ENGINE]:['chromium','webkit'])){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
 try{for(const width of (process.env.PAUSED_WIDTH?[Number(process.env.PAUSED_WIDTH)]:[320,390])){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',timezoneId:'Australia/Sydney'}),errors=[];let snapshots=events.map(e=>model.compact(e));
  page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,followedSports:[],selectedSelectorEntityIds:[],fantasyDeadlines:{enabled:false}})));
  await page.route('**/api/**',r=>r.request().url().includes('/api/match-centre?')?r.fulfill({json:{enabled:true,events,fixtures:snapshots,membershipStale:false,pagination:{nextCursor:null}}}):r.fulfill({status:503,json:{}}));
  await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34219');await page.locator('#startupLaunch').waitFor({state:'hidden'});
  await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('tab',{name:'Everything',exact:true}).click();
  const mc=page.locator('[data-match-id="'+model.id(cricket)+'"]');await mc.waitFor();
  assert.deepEqual(await page.locator('.mc-section:not([hidden])>h3').allTextContents(),['Live','Paused','Awaiting update','Starting soon','Recently finished','Ongoing · not in play']);
  assert.deepEqual(await page.locator('.mc-section').filter({has:page.getByRole('heading',{name:'Live',exact:true})}).locator('[data-match-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.matchId)),['playing']);
  assert.equal(await mc.locator('details').getAttribute('open'),null);assert.equal(await mc.locator('.mc-status').innerText(),'Stumps');assert.equal(await mc.locator('.mc-row-restart').innerText(),'Live again at 6:30 pm');
  assert.equal(await page.locator('[data-match-id=long] .mc-row-restart').innerText(),'Resume time unconfirmed');
  await mc.locator('summary').click();await mc.locator('summary').focus();
  // Only compact facts change: the membership catalogue deliberately keeps its older Stumps record.
  snapshots=snapshots.map(s=>s.id===model.id(cricket)?{...s,status:'rain-delay',statusText:null,statusFactObservedAt:stamp,pauseObservation:{status:'rain-delay',reason:'rain delay',observedAt:stamp},restartTimeUtc:null,restartSourceUrl:null,restartSourceCheckedAt:null}:s);
  await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await page.getByText('Latest available scores loaded.',{exact:true}).waitFor();
  assert.equal(await mc.locator('details').getAttribute('open'),'');assert.equal(await mc.locator('.mc-status').innerText(),'Rain delay');assert.equal(await mc.locator('.mc-row-restart').innerText(),'Resume time unconfirmed');
  assert.equal(await mc.evaluate(card=>card.closest('.mc-section').querySelector('h3').textContent),'Paused','A new pause uses its own compact source fact clock');
  await page.evaluate(()=>{userPreferences.showSpoilers=false;renderMatchCentre();});assert.equal(await mc.locator('.mc-row-restart').innerText(),'Resume time unconfirmed');assert((await mc.locator('.mc-participant-score').allTextContents()).every(t=>t==='Hidden'));
  await page.locator('.tabs [data-tab=feed]').click();
  const feedResults=await page.evaluate(({cricket,events,now})=>{
   activeTab='feed';activeView='list';activeInspectorCodeId=null;const host=document.createElement('section');host.id='pauseEvidence';document.getElementById('listView').replaceChildren(host);
   const labels=[];for(const restartTimeUtc of [cricket.restartTimeUtc,null,'2026-10-11T23:00:00Z']){const e={...cricket,restartTimeUtc};setCardState(e,'compact');const card=buildEventCard(e,{mode:'feed'});host.append(card);labels.push(card.querySelector('.compact-card-time').textContent);}
   const first=events.find(e=>e.id==='soon'),playing=events.find(e=>e.id==='playing');activeEvents=[playing,first];
   const marker=buildFeedNowMarker(first);host.prepend(marker);const initial={text:marker.textContent,red:marker.classList.contains('is-active'),aria:marker.getAttribute('aria-label')};
   host.append(buildFeedNowMarker(playing));const live=host.lastChild;const liveInitial={text:live.textContent,red:live.classList.contains('is-active')};live.remove();
   activeEvents=[{...first,status:'live',statusCheckedAt:new Date(now-60000).toISOString()},playing];refreshFeedClock();const updated={text:marker.textContent,red:marker.classList.contains('is-active'),aria:marker.getAttribute('aria-label')};
   activeEvents=[{...first,status:'stumps',statusCheckedAt:new Date(now-60000).toISOString()},playing];refreshFeedClock();const paused={text:marker.textContent,red:marker.classList.contains('is-active'),aria:marker.getAttribute('aria-label')};
   multiDayCricketExpanded.add(cricket.id);setCardState(cricket,'selected');const selected=buildEventCard(cricket,{mode:'feed'});host.append(selected);const selectedRestart=selected.querySelector('.fixture-restart')?.textContent;
   return {labels,initial,liveInitial,updated,paused,selectedRestart};
  },{cricket,events,now});
  for(const [i,label] of ['Live again at 6:30 pm','Resume time unconfirmed','Awaiting resumption update'].entries())assert(feedResults.labels[i].includes(label));
  assert(feedResults.selectedRestart.includes('Live again at 6:30 pm'),'The ordinary collapsed Feed card also shows the restart: '+feedResults.selectedRestart);
  assert.deepEqual(feedResults.initial,{text:'Time Now',red:false,aria:'Time Now'},'A live fixture elsewhere does not change the following scheduled fixture');assert.deepEqual(feedResults.liveInitial,{text:'● Live Now',red:true});
  assert.equal(feedResults.updated.text,'● Live Now');assert(feedResults.updated.red);assert.match(feedResults.updated.aria,/^Live Now /);assert.equal(feedResults.paused.text,'Time Now');assert(!feedResults.paused.red);assert.match(feedResults.paused.aria,/^Time Now /);
  const rendered=await page.evaluate(({cricket,stamp,restart})=>{
   userPreferences.preferenceGraph={...userPreferences.preferenceGraph,entityFollows:[{participantId:cricket.awayParticipantId,followLevel:'follow'}]};activeFilter='all';
   const fixture={...cricket,date:'2026-10-12',status:'live',statusText:null,statusCheckedAt:stamp,sourceStale:false,stale:false,restartTimeUtc:null};
   const read=()=>{const marker=document.getElementById('calendarNowAnchor');return {label:marker?.textContent,next:marker?.nextElementSibling?.dataset.feedEventId,red:marker?.classList.contains('is-active')};};
   activeEvents=[fixture];renderListView();const playing=read();activeEvents=[{...fixture,status:'stumps',restartTimeUtc:restart}];renderListView();return {playing,paused:read()};
  },{cricket,stamp,restart});
  assert.equal(rendered.playing.label,'● Live Now','The actual filtered Feed renderer passes its following fixture');assert.equal(rendered.playing.next,model.id(cricket));assert(rendered.playing.red);assert.equal(rendered.paused.label,'Time Now');assert(!rendered.paused.red);
  await page.evaluate(()=>refreshFeedClock());await page.clock.setFixedTime(new Date(Date.parse(restart)+60000));assert.equal(await page.evaluate(()=>appendFeedPageToCurrentList([])),false,'The real incremental page path cannot consume an elapsed restart redraw');await page.evaluate(()=>refreshFeedClock());
  try{await page.waitForFunction(()=>[...document.querySelectorAll('#listView .fixture-restart,#listView .compact-card-time')].some(node=>node.textContent.includes('Awaiting resumption update')));}catch(error){console.error(await page.evaluate(()=>({tab:activeTab,view:activeView,now:nowAEST().toISOString(),key:feedClockKey(),previous:previousFeedClockKey,pending:String(pendingScrollIdleMutation),scroll:scrollMomentumActive,busy:calendarChoice.busy,committed:committedFeedPresentationFingerprint?.slice(-800),current:currentFeedPresentationFingerprint()?.slice(-800),slots:[...feedCardSlots.values()].map(({slot,event})=>({connected:slot.isConnected,id:event.id,pause:JSON.stringify(NOTHINGSPORTS_CARD_TIMING.pausePresentation(event,nowAEST())),fresh:buildEventCard(event,{mode:'feed'}).querySelector('.fixture-restart')?.textContent})),hydrating:startupCoordinator.isHydrating(),events:activeEvents.map(e=>({id:e.id,status:e.status,restart:e.restartTimeUtc})),text:document.getElementById('listView').innerText.slice(0,2500)})));console.error({engine,width});throw error;}
  const specialMinute=await page.evaluate(({base,stamp})=>{activeEvents=[];const event={...base,id:'saved-major-contest',eventId:'saved-major-contest',canonicalEventId:'saved-major-contest',status:'live',statusCheckedAt:nowAEST().toISOString(),stale:false,sourceStale:false};const host=document.getElementById('listView');resetFeedCardWindow();host.replaceChildren(buildFeedNowMarker(event),buildFeedCardSlot(event));previousFeedClockKey=feedClockKey();refreshFeedClock();return {text:host.firstChild.textContent,aria:host.firstChild.getAttribute('aria-label'),slots:feedCardSlots.size};},{base,stamp});assert.equal(specialMinute.text,'● Live Now');assert.match(specialMinute.aria,/^Live Now /);assert.equal(specialMinute.slots,1);
  const pauseLabels=await page.evaluate(({cricket})=>{
   activeTab='feed';activeView='list';userPreferences.showSpoilers=false;resetFeedCardWindow();const host=document.getElementById('listView');host.replaceChildren();
   return [{status:'rain-delay',statusText:'Bad light',expected:'BAD LIGHT'},{status:'break',statusText:'Australia lead by 139 runs',expected:'BREAK'},{status:'break',statusText:'Half-time',statusCheckedAt:new Date(+nowAEST()-240001).toISOString(),expected:'Awaiting match update'},{status:'break',scheduleStatus:'cancelled',statusText:'Australia lead by 139 runs',expected:'CANCELLED'},{status:'break',scheduleStatus:'completed',statusText:'Australia lead by 139 runs',expected:'FINISHED'}].flatMap((changes,index)=>['compact','selected'].map(state=>{
    const e={...cricket,id:'pause-label-'+index+'-'+state,eventId:'pause-label-'+index+'-'+state,canonicalEventId:'pause-label-'+index+'-'+state,sourceEventIds:[],restartTimeUtc:null,statusCheckedAt:nowAEST().toISOString(),scheduleStatus:changes.status,...changes};multiDayCricketExpanded.add(e.id);setCardState(e,state);const before=JSON.stringify(e),card=buildEventCard(e,{mode:'feed'});host.append(card);const timing=card.querySelector(state==='compact'?'.compact-card-time':'.fixture-timing-badge'),summary=card.querySelector(state==='compact'?'.compact-card-summary':'.fixture-timing-badge');return {state,...changes,text:timing?.textContent,aria:summary?.getAttribute('aria-label'),restart:card.querySelector('.fixture-restart')?.textContent,sourceUnchanged:JSON.stringify(e)===before};
   }));
  },{cricket});
  for(const row of pauseLabels){assert(row.text?.includes(row.expected),JSON.stringify(row));assert(row.aria?.includes(row.expected),JSON.stringify(row));assert(!/Australia lead by 139 runs/.test(row.text+row.aria),'Results OFF cannot expose source score narrative');if(row.statusText==='Bad light')assert(!/rain delay/i.test(row.text+row.aria),'Bad light remains the actual interruption');if(row.expected==='Awaiting match update')assert(/half-time/i.test(row.text+row.aria+row.restart),'Stale half-time keeps its pause qualifier');assert(row.sourceUnchanged);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  if(process.env.PAUSED_STATUS_OUTPUT)await page.screenshot({path:process.env.PAUSED_STATUS_OUTPUT+'/'+engine+'-'+width+'.png',fullPage:true});results.push({engine,width,feedResults,rendered,pauseLabels,errors});await page.close();
 }}finally{await browser.close();}
}
const receipt={mode:'controlled lifecycle replay through actual native Feed and Match Centre; no provider reads',results};if(process.env.PAUSED_STATUS_OUTPUT)fs.writeFileSync(process.env.PAUSED_STATUS_OUTPUT+'/paused-browser.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
