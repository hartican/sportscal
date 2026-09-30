'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const reference='2026-10-01T00:00:00Z';
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
(async()=>{
  const browser=await(process.env.QA_BROWSER==='webkit'?webkit.launch():chromium.launch({channel:'chrome'}));
  try{
    const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block'});
    let fixtureRequests=0;
    await page.route('**/api/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/fixtures'){
        fixtureRequests++;
        const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean);
        assert(ids.length>0&&ids.length<=60,'refresh uses bounded mounted fixture IDs');
        if(process.env.QA_USE_REAL_LIVE_API==='1')return route.continue();
        const fixture=require('../lib/competition-fixtures').fixtures().find(e=>aliases(e).includes('evt_84'));
        // Shape captured from the public production API on 1 October Sydney.
        const observed={...fixture,dateOnly:true,schedulePrecision:'date-only',timeTbc:false,startTimeTbc:false};
        return route.fulfill({json:{schemaVersion:'live-fixtures.v1',revision:'legacy-live-clock',sources:[{source_id:'current-fixtures',fixtures:[observed]}]}});
      }
      return route.fulfill({status:503,json:{}});
    });
    await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({selectedSelectorEntityIds:['sport:nrl-premiership'],followedSports:['nrl'],onboardingComplete:true,showSpoilers:false})));
    await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33962');
    await page.waitForFunction(()=>startupFeedState.phase==='ready'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
    const fixture=await page.evaluate(async()=>{
      const data=await(await fetch('/data/follow-schedule/nrl.json')).json();
      return data.fixtures.find(e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].includes('evt_84'));
    });
    assert(fixture,'published Grand Final exists');
    await page.evaluate(fixture=>{
      document.querySelectorAll('[role=dialog]').forEach(n=>n.parentElement.style.display='none');
      document.querySelectorAll('dialog[open]').forEach(n=>n.close());
      document.getElementById('startupLaunch')?.remove();
      document.body.classList.remove('modal-open','settings-open');
      activeTab='feed';followedScheduleFixtures.clear();footballFixtureEventsByBundle.clear();
      activeEvents=normalizeEvents([fixture]);liveFixtureEvents=[];liveFixtureRevision='';liveFixtureLastRequestedAt=0;
      setCardState(fixture,'opened');
      const slot=document.createElement('div');slot.className='feed-card-slot';slot.dataset.feedEventId=fixture.id;
      slot.append(buildEventCard(fixture));document.getElementById('listView').replaceChildren(slot);
    },fixture);
    assert.equal(await page.locator('#listView .fixture-timing-clock').innerText(),'7:30 PM','published card starts correct');
    await page.evaluate(()=>refreshLiveFixtureSnapshot());
    await page.waitForFunction(()=>Boolean(liveFixtureRevision));
    const result=await page.evaluate(reference=>{
      const find=events=>events.find(e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].includes('evt_84'));
      const current=find(activeEvents),live=find(liveFixtureEvents);
      return {id:current?.id,sourceEventIds:current?.sourceEventIds,time:NOTHINGSPORTS_CARD_TIMING.presentation(current,reference).time,liveDateOnly:live?.dateOnly,livePrecision:live?.schedulePrecision};
    },reference);
    assert.equal(result.time,'7:30 PM','the actual live refresh cannot restore TIME TBC');
    assert.equal(result.id,fixture.id,'saved-action fixture identity survives live refresh');
    assert(result.sourceEventIds.includes('evt_84'));assert.equal(result.liveDateOnly,false);assert.equal(result.livePrecision,'exact');
    assert(fixtureRequests>0,'test must actually request the live API');
    await page.waitForFunction(()=>[...document.querySelectorAll('#listView .event-card')].some(c=>c.innerText.includes('Roosters')&&c.querySelector('.fixture-timing-clock')?.textContent==='7:30 PM'));
    if(process.env.QA_SCREENSHOT_DIR){
      require('node:fs').mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});
      await page.addStyleTag({content:'header.top,.skip-link,#timelineTools{visibility:hidden!important}*{transition:none!important;animation:none!important}'});
      const card=page.locator('#listView .event-card').filter({hasText:'Roosters'}).filter({hasText:'Knights'}).first();
      for(const theme of ['day','night']){
        await page.evaluate(theme=>applyThemePreference(theme),theme);
        await card.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/live-clock-${process.env.QA_BROWSER||'chromium'}-${theme}.png`});
      }
    }
    console.log(JSON.stringify({liveApi:process.env.QA_USE_REAL_LIVE_API==='1',fixtureRequests,...result}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
