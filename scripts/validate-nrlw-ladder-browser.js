#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
  const server=process.env.QA_BASE_URL?null:http.createServer((req,res)=>{
    const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
    fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});
  });
  if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,engine=process.env.BROWSER_ENGINE||'chromium';
  const browser=await pw[engine].launch(),observations=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',timezoneId:'Australia/Sydney'});
    await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
    await page.route('https://**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:nrlw']})));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
    const profileScript=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/loadDeferredScript\("(config\/athlete-profile-ui\.js\?v=\d+)"\)/)[1];
    const scheduleScript=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/loadDeferredScript\('([^']*follow-schedule-panel\.js\?v=\d+)'\)/)[1];
    const published=await page.evaluate(async ({profileScript,scheduleScript})=>{
      await loadCanonicalSportsData();await loadFollowPresentation();await loadDeferredScript(scheduleScript);await loadDeferredScript(profileScript);
      const code=await(await fetch('data/code-inspector/nrlw.json')).json();
      window.__nrlwCode=code;
      return {rows:code.standings.length,fixtureCount:code.fixtures.length,coverage:code.coverageStatus,clock:code.standings[0]?.asOf,ids:code.standings.map(r=>r.participantId),source:code.standings[0]?.sourceUrl};
    },{profileScript,scheduleScript});
    assert.equal(published.rows,12);assert.equal(published.fixtureCount,71);assert.equal(published.coverage,'partial');
    assert.equal(published.source,'https://www.nrl.com/ladder/?competition=161&season=2026');
    for(const width of [320,390,1280])for(const theme of ['day','night'])for(const results of [false,true]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(({theme,results})=>{
        userPreferences.showSpoilers=results;userPreferences.feedControls={...userPreferences.feedControls,spoilers:results?'results_visible':'standard'};standingsRevealApproved=false;applyThemePreference(theme);
        saveFollowBrowse({sportId:'sport:nrlw',categoryId:'',section:'standings',scheduleScope:null});
        codeInspectorChunk=window.__nrlwCode;
        const panel=document.createElement('div');panel.id='nrlw-ladder-test';
        document.getElementById('listView').replaceChildren(panel);
        renderCodeInspectorStandings(panel,__nrlwCode.code);
      },{theme,results});
      const panel=page.locator('#nrlw-ladder-test'),label=`${engine}/${width}/${theme}/${results}`;
      assert.equal(await panel.locator('.code-inspector-standing-row').count(),results?12:0,label+': Code respects Results');
      if(results){
        assert.match(await panel.innerText(),/Final regular-season ladder.*Round 11/);
        assert.match(await panel.innerText(),/Table checked .*Sydney/);
        assert.equal(await panel.getByRole('link',{name:'Standings source',exact:true}).getAttribute('href'),published.source);
        await panel.locator('.code-inspector-standing-row').first().scrollIntoViewIfNeeded();
        assert.match(await panel.locator('.code-inspector-standing-row').first().innerText(),/1\. Sydney Roosters.*11 played.*22 pts/s);
      }else assert.match(await panel.innerText(),/Standings hidden while Results is off/);
      const fixture=await page.evaluate(()=>__nrlwCode.fixtures.find(f=>f.id==='event:nrlw:2026:grand-final'));
      const ranks=await page.evaluate(fixture=>{
        const snapshots=canonicalSportsData.ladderSnapshots;
        const now=fixture.participantIds.map(id=>NOTHINGSPORTS_FEED_CARD_PRESENTATION.ranking(fixture,id,snapshots));
        const old=__nrlwCode.fixtures.find(f=>f.roundNumber===1);
        return {now:now.map(r=>r?.label),historic:NOTHINGSPORTS_FEED_CARD_PRESENTATION.ranking(old,old.participantIds[0],snapshots)};
      },fixture);
      assert.deepEqual(ranks,{now:['1ST','3RD'],historic:null},label+': no future table leaks into historical cards');
      await page.evaluate(fixture=>{
        userPreferences.feedCompact=true;activeTab='feed';
        const event={...fixture,eventId:fixture.id};setCardState(event,'selected');
        const card=buildEventCard(event);card.id='nrlw-ranking-card';card.style.contentVisibility='visible';
        document.getElementById('listView').append(card);
      },fixture);
      const card=page.locator('#nrlw-ranking-card');await card.scrollIntoViewIfNeeded();
      assert.deepEqual(await card.locator('.fixture-standing').allTextContents(),['1ST','3RD'],'actual upcoming card uses the reviewed positions');
      assert((await card.locator('.fixture-standing').evaluateAll(rows=>rows.map(row=>row.title))).every(title=>title.includes('Final regular-season ladder')));
      await page.evaluate(async fixture=>{
        const origin=document.createElement('button');origin.id='nrlw-profile-origin';origin.textContent='Sydney Roosters';document.getElementById('listView').append(origin);
        const record=canonicalSportsData.participants.find(p=>p.id==='team:nrlw:roosters');
        await NOTHINGSPORTS_ATHLETE_PROFILE_UI.open(record,'nrlw',origin,{teamProfile:true,fixture});
      },fixture);
      const drawer=page.locator('.athlete-profile-drawer');
      if(!results){
        assert.equal(await drawer.locator('.profile-standings-table').count(),0);
        await drawer.getByRole('button',{name:'Show profile standings',exact:true}).click();
      }
      await drawer.locator('.profile-standings-table > tr').last().waitFor();
      assert.equal(await drawer.locator('.profile-standings-table > tr').count(),12);
      assert.match(await drawer.innerText(),/Final regular-season ladder.*Round 11/);
      assert.equal(await drawer.getByRole('link',{name:'Standings source',exact:true}).getAttribute('href'),published.source);
      assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),results,'profile-local reveal does not change Results');
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),label+': no page overflow');
      await drawer.getByRole('button',{name:'Close athlete profile',exact:true}).click();
      await drawer.waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>document.activeElement.id),'nrlw-profile-origin','profile returns focus');
      observations.push({width,theme,results,rows:12,source:published.source,clock:published.clock,visibleUpcomingRanks:['1ST','3RD'],historicalRank:null,globalConsentUnchanged:true});
    }
    const report={checkedAt:new Date().toISOString(),engine,cases:observations.length,scope:'Actual local/hosted Code and profile components; public projections, synthetic preferences, APIs/workers isolated; no physical device or account proof',observations};
    if(process.env.NRLW_LADDER_REPORT_PATH)fs.writeFileSync(process.env.NRLW_LADDER_REPORT_PATH,JSON.stringify(report,null,2)+'\n');
    console.log(`NRLW ladder (${engine}): ${observations.length} responsive Code/profile cases, dated official rows, source links, Results privacy/local reveal, focus return and historical rank boundary pass.`);
  }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
