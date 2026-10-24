'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
  const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const receipts=[];
  try{for(const engine of (process.env.MULTISESSION_ENGINES||'chromium,webkit').split(',')){
    const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
    try{
      const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'Disposable local verification'}}));
      await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,selectedSelectorEntityIds:['sport:f1','sport:tennis','sport:cricket','sport:rugby','sport:golf'],followedSports:['f1','tennis','cricket','rugby','golf'],showSpoilers:false})));
      await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof userPreferences==='object'&&startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:45000});
      await page.clock.setFixedTime(new Date('2026-10-24T00:00:00Z'));
      await page.evaluate(async()=>{await loadDeferredScript('assets/js/multisession-card-ui.js?v=1');await loadDeferredScript('config/major-events.js');MAJOR_EVENTS=globalThis.NOTHINGSPORTS_MAJOR_EVENTS;await loadFollowPresentation();await loadDeferredScript('assets/js/follow-navigation.js?v=522');});
      for(const width of [320,390,768,1280])for(const theme of ['day','night']){
        await page.setViewportSize({width,height:1000});
        const proof=await page.evaluate(({theme})=>{
          nowAEST=()=>new Date('2026-10-24T00:00:00Z');activeTab='feed';activeView='list';activeFilter='all';document.documentElement.dataset.theme=theme;
          const fixture=(session,start)=>({id:'event:f1:2026:qa-weekend:'+session,key:'f1',name:'QA Grand Prix · '+session,sessionType:session,startTimeUtc:start,date:NOTHINGSPORTS_CALENDAR.sydneyDay(new Date(start)),timePrecision:'exact',status:'upcoming',scheduleStatus:'confirmed',sourceUrl:'https://organiser.example/qa',sourceCheckedAt:'2026-10-23T00:00:00Z',venue:'QA Circuit',participantIds:[],participants:[]});
          const sessions=[fixture('practice-1','2026-10-24T01:00:00Z'),fixture('qualifying','2026-10-24T03:00:00Z'),fixture('race','2026-10-25T03:00:00Z')];
          activeEvents=sessions;majorEventsDocument={events:[]};tennisFeedParentDocument={tournaments:[]};
          renderListView();const list=document.getElementById('listView');
          const cards=[...list.querySelectorAll('.multisession-card')],practice=list.querySelector('[data-session-id$="practice-1"]');
          return {reminders:cards[0]?.querySelectorAll('.multisession-today [data-reminder-action-key]').length,cards:cards.length,todayRows:cards[0].querySelectorAll('.multisession-today > .multisession-row').length,practiceUnrated:practice.textContent.includes('Unrated practice')&&!practice.querySelector('[data-rating-phase]'),fullRows:cards[0].querySelectorAll('.multisession-full > .multisession-row').length,firstClock:cards[0].querySelector('time').dateTime,children:sessions.map(e=>e.id)};
        },{theme});
        assert.equal(proof.cards,2);assert.equal(proof.reminders,2);assert.equal(proof.todayRows,2);assert(proof.practiceUnrated);assert.equal(proof.fullRows,3);assert.equal(proof.firstClock,'2026-10-24T01:00:00.000Z');
        await page.locator('.multisession-card').first().locator('.multisession-full > summary').click();
        assert(await page.locator('.multisession-card').first().locator('.multisession-full').getAttribute('open')!==null);
        assert(await page.evaluate(()=>{const c=document.querySelector('.multisession-card'),h=c.querySelector('.multisession-header').getBoundingClientRect(),t=c.querySelector('.multisession-today').getBoundingClientRect(),f=c.querySelector('.multisession-full').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&t.top>=h.bottom-1&&f.top>=t.bottom-1&&[...c.querySelectorAll('.multisession-row')].every(row=>row.scrollWidth<=row.clientWidth+1);}), 'vertical sections and unclipped session rows');
        if(process.env.QA_EVIDENCE_DIR)await page.screenshot({path:path.join(process.env.QA_EVIDENCE_DIR,`${engine}-${width}-${theme}.png`)});
        receipts.push({engine,width,theme,...proof});
      }
      const reminders=await page.evaluate(async()=>{
        const card=document.querySelector('.multisession-card'),row=card.querySelector('.multisession-today .multisession-row'),session=activeEvents.find(e=>e.id===row.dataset.sessionId),other=activeEvents.find(e=>e.sessionType==='qualifying'),requests=[];
        ensureWebPushReminder=async(event,timing)=>{requests.push({id:NOTHINGSPORTS_MULTISESSION.id(event),...timing});return {scheduled:true};};
        removeWebPushReminder=async event=>{requests.push({id:NOTHINGSPORTS_MULTISESSION.id(event),cancelled:true});return {removed:true};};
        const button=row.querySelector('[data-reminder-action-key]');if(button.disabled)throw Error('Published practice reminder disabled');
        await toggleQuickReminder(session,button);const on=getEventAction(session).reminderChoice;
        await toggleQuickReminder(session,button);const off=getEventAction(session).reminderChoice;
        const preference=card.querySelector('.session-reminder-preferences input');preference.checked=true;preference.dispatchEvent(new Event('change'));
        row.querySelector('button:not([data-reminder-action-key])').click();
        return {on,off,otherChoice:getEventAction(other).reminderChoice||null,requests,preset:userPreferences.followFirst.notifications.sessionPresets['competition:formula-one'],practiceRatings:card.querySelectorAll('.multisession-detail [data-rating-phase]').length,childId:card.querySelector('.multisession-detail .event-card')?.dataset.eventId,syntheticSaved:Object.keys(eventActions).some(id=>id.includes(':day:'))};
      });
      assert.equal(reminders.on,'on');assert.equal(reminders.off,'off');assert.equal(reminders.otherChoice,null);assert.equal(reminders.requests[0].remindAt,'2026-10-24T00:45:00.000Z');assert(reminders.requests[0].id.endsWith(':practice-1'));assert(reminders.preset.enabled);assert.deepEqual(reminders.preset.sessionTypes.slice().sort(),['race','sprint']);assert.equal(reminders.practiceRatings,0);assert(reminders.childId.endsWith(':practice-1'));assert(!reminders.syntheticSaved);
      const routing=await page.evaluate(()=>{
        const sessions=[...activeEvents],qualifying=sessions.find(e=>e.sessionType==='qualifying'),race=sessions.find(e=>e.sessionType==='race');
        updateEventAction(qualifying,{archived:true});activeEvents=[{...race,eventGroupSchedule:sessions}];renderListView();
        const restoredArchived=Boolean(document.querySelector('[data-session-id="'+qualifying.id+'"]'));
        let routed=null;openNothingscoreContribution=async event=>{routed=event.id;};pendingNotificationEventId=race.id;const url=new URL(location.href);url.searchParams.set('event',race.id);url.searchParams.set('liveRatings','1');history.replaceState(null,'',url);const focused=focusPendingNotificationEvent();
        activeEvents=sessions;updateEventAction(qualifying,{archived:false});return {restoredArchived,focused,routed};
      });
      assert(!routing.restoredArchived,'Cached closure cannot restore an archived session');assert(routing.focused);assert.equal(routing.routed,'event:f1:2026:qa-weekend:race','Rating notification uses exact competitive child');
      const follow=await page.evaluate(async()=>{
        activeTab='follow';followHomeView='browse';activeInspectorCodeId=null;saveFollowBrowse({sportId:'sport:tennis',categoryId:'',section:'teams-players',genderBySport:{}});renderFollowView();
        const palette=()=>[...document.querySelectorAll('.follow-sport-bar [data-follow-sport]')].map(b=>b.dataset.followSport),before=palette(),choices=JSON.stringify(userPreferences.selectedSelectorEntityIds);
        const women=[...document.querySelectorAll('.follow-gender-tabs button')].find(b=>b.textContent==='Women');if(!women)throw Error('Sport-first gender control missing');women.click();
        const after=palette(),remembered=followBrowseState().genderBySport['sport:tennis'];
        return {samePalette:JSON.stringify(before)===JSON.stringify(after),remembered,choicesUnchanged:choices===JSON.stringify(userPreferences.selectedSelectorEntityIds),sportFirst:Boolean(document.querySelector('.follow-navigation-controls')?.querySelector('.follow-sport-bar')||document.querySelector('#follow-navigation-controls .follow-sport-bar'))};
      });
      assert(follow.samePalette);assert.equal(follow.remembered,'women');assert(follow.choicesUnchanged);assert(follow.sportFirst);assert.deepEqual(errors,[]);
      await page.evaluate(()=>{const all=[...document.querySelectorAll('.follow-gender-tabs button')].find(b=>b.textContent==='All supported');all.click();updateDirectoryFilters('tennis',{entityType:'athlete'});renderFollowView();});
      await page.waitForFunction(()=>followDirectoryChunks.has('tennis')&&followDirectoryChunks.has('tennis-women'));
      assert.equal(await page.evaluate(()=>directoryFilters('tennis').genderCategory),'','All supported clears the saved gender filter');
      await page.evaluate(()=>{updateDirectoryFilters('tennis',{query:'Sabalenka'});renderFollowView();});
      await page.waitForFunction(()=>[...document.querySelectorAll('.follow-directory-row')].some(row=>row.textContent.includes('Sabalenka')),null,{timeout:10000});
      await page.evaluate(()=>updateDirectoryFilters('tennis',{query:''}));
      await page.evaluate(async()=>{await loadCodeInspectorManifest();await loadDeferredScript('assets/js/follow-schedule-panel.js?v=576');const code=codeInspectorManifest.codes.find(c=>c.id==='sport:f1');codeInspectorChunk={code,fixtures:activeEvents.filter(e=>e.id.startsWith('event:f1:2026:qa-weekend:')),standings:[]};activeTab='follow';saveFollowBrowse({sportId:'sport:motorsport',categoryId:'sport:f1',section:'schedule',genderBySport:{'sport:motorsport':'open'}});renderFollowView();});
      await page.locator('.follow-schedule-panel .multisession-card').first().waitFor();assert.equal(await page.locator('.follow-schedule-panel .multisession-card').count(),2,'Schedule uses the same daily projection');
      const focus=await page.evaluate(()=>{
        const base=codeInspectorChunk.fixtures.find(e=>e.sessionType==='race'),later=Array.from({length:5},(_,i)=>({...base,id:'event:f1:2026:qa-later-'+i+':race',date:'2026-11-'+String(1+i).padStart(2,'0'),startTimeUtc:'2026-11-'+String(1+i).padStart(2,'0')+'T01:00:00Z'}));
        codeInspectorChunk.fixtures.push(...later);codeInspectorFocusedFixture=later.at(-1);codeInspectorFocusedOwner=serverSyncClient?.sessionSubject()||'public';renderFollowView();
        return document.querySelector('.follow-schedule-panel .multisession-detail .event-card')?.dataset.eventId;
      });
      assert.equal(focus,'event:f1:2026:qa-later-4:race','Exact Schedule route selects a target outside the current three groups');
      await page.evaluate(()=>{codeInspectorFocusedFixture=null;codeInspectorFocusedOwner=null;});
      await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:nbl',categoryId:'sport:nbl',section:'teams-players'});activeInspectorCodeId=null;renderFollowView();});
      await page.waitForFunction(()=>document.querySelectorAll('.follow-directory-row').length===10);assert.equal(await page.evaluate(()=>followBrowseState().sportId),'sport:nba');assert(await page.locator('.follow-category-bar button').filter({hasText:'NBL'}).count());
      assert(await page.evaluate(()=>{const controls=document.getElementById('follow-navigation-controls'),bar=controls.querySelector('.follow-sport-bar'),gender=controls.querySelector('.follow-gender-tabs'),category=controls.querySelector('.follow-category-bar');return Boolean(bar.compareDocumentPosition(gender)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(gender.compareDocumentPosition(category)&Node.DOCUMENT_POSITION_FOLLOWING);}), 'Navigation order is sport, gender, competition');
      await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:rugby',categoryId:'',section:'teams-players',genderBySport:{'sport:rugby':'men'}});renderFollowView();});
      await page.locator('.rugby-competition-choices').waitFor();assert.equal(await page.locator('.rugby-competition-choices input').count(),6);assert.equal(await page.locator('.rugby-competition-choices input:checked').count(),0);assert(await page.locator('.rugby-competition-choices img').evaluateAll(images=>images.every(img=>img.getAttribute('src').startsWith('assets/identities/rugby/'))));
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({engine,cases:8,follow,reminders,routing,focus,scheduleDailyGroups:2,nblTeams:10,rugbyCompetitions:6}));await page.close();
    }finally{await browser.close();}
  }}finally{await new Promise(resolve=>server.close(resolve));}
  if(process.env.QA_EVIDENCE_DIR)fs.writeFileSync(path.join(process.env.QA_EVIDENCE_DIR,'browser-receipts.json'),JSON.stringify(receipts,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
