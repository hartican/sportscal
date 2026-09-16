'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'chrome'});try{for(const width of [320,390,768,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['f1'],selectedSelectorEntityIds:['sport:f1']})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Isolated local QA'}}));await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:8896');await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:60000});
 const fixture={id:'qa-tennis',eventId:'qa-tennis',key:'tennis',name:'Player One v Player Two',status:'completed',startTimeUtc:'2026-09-14T02:00:00Z',endTimeUtc:'2026-09-14T06:00:00Z',date:'2026-09-14',time:'12:00',scoreDisplay:'Player One 6(3)-7(7) 7-6(5) 6-4 4-6 12-10 Player Two'};
 const e={profileId:'11111111-1111-4111-8111-111111111111',name:'Sports Friend',handle:'sports_friend',rank:1,points:41,eligible:4,efficiency:.75,fixtures:5,following:true,canFollow:true,sports:{nrl:{points:20,eligible:2,efficiency:1,rank:1},tennis:{points:21,eligible:2,efficiency:.5,rank:2}}};
 await page.route('**/api/nothingscore**',async r=>{
 const url=new URL(r.request().url()),options=Object.fromEntries(url.searchParams);
 let data;
 if(r.request().method()==='POST')data={following:true,added:1,bonusAwarded:20};
 else if(options.picks)data={items:[{kind:'selector',entityType:'sport',id:'sport:nrl',label:'NRL',sport:'nrl',following:false,excluded:false},{kind:'entity',entityType:'team',id:'team:nrl:test',label:'Test team',sport:'nrl',following:false,excluded:false},{kind:'entity',entityType:'team',id:'team:nrl:excluded',label:'Excluded team',sport:'nrl',following:false,excluded:true},{kind:'entity',entityType:'athlete',id:'competitor:nrl:test-player',label:'Test player',sport:'nrl',following:false,excluded:false}]};
 else if(options.activity)data={entries:[{id:'rec',eventId:fixture.id,fixture:fixture.name,event:fixture,phase:'heat',name:e.name,handle:e.handle}],nextCursor:null};
 else if(options.fixture)data={event:fixture};else if(options.audience==='friends')data={entries:[e],viewer:{...e,profileId:'viewer-profile',name:'Jack Hartican',handle:'jack',rank:7,isViewer:true,canFollow:false},signedIn:true,nextCursor:null};else data={entries:[e],viewer:{...e,isViewer:true},signedIn:true,nextCursor:null};await r.fulfill({json:data});
 });
 await page.evaluate(fixture=>{
 localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify({accessToken:'qa.'+btoa(JSON.stringify({sub:'qa-user'}))+'.test',refreshToken:'qa-refresh',expiresAt:Date.now()+3600000}));
 openNothingscoreDrawer();
 window.qaFixture=fixture;
 },fixture);
 assert.equal(await page.locator('.nothing-score-label').innerText(),'LEADER\nBOARD');
 const headerGeometry=await page.evaluate(()=>{const label=document.querySelector('.nothing-score-label').getBoundingClientRect(),date=document.querySelector('#calendarDateBadge').getBoundingClientRect();return{overlap:label.right>date.left&&label.left<date.right&&label.bottom>date.top&&label.top<date.bottom};});
 assert.equal(headerGeometry.overlap,false,'compact leaderboard label must not overlap the date badge');
 await page.getByRole('tab',{name:'Global Leaderboard'}).waitFor();assert.equal(await page.locator('#nothingscoreTitle').textContent(),'Nothinger Leaderboard');await page.getByRole('button',{name:'Next sport'}).click();await page.getByRole('columnheader',{name:/AFL/}).waitFor();
 await page.getByRole('table').getByRole('button',{name:'See / copy follows'}).click();await page.locator('.nsc-pick').first().waitFor();assert.equal(await page.locator('.nsc-pick input:checked').count(),0);await page.locator('.nsc-picks-dialog select[aria-label="Sport"]').selectOption('nrl');await page.locator('.nsc-picks-dialog select[aria-label="Pick type"]').selectOption('team');assert.equal(await page.locator('.nsc-pick').count(),2,'teams can be drilled into separately');await page.locator('.nsc-picks-dialog select[aria-label="Pick type"]').selectOption('athlete');assert.equal(await page.locator('.nsc-pick').count(),1,'individual players and athletes can be drilled into separately');await page.locator('.nsc-picks-dialog select[aria-label="Pick type"]').selectOption('team');await page.getByRole('button',{name:'Select visible picks'}).click();assert.equal(await page.locator('.nsc-pick input:checked').count(),1,'bulk does not override exclusions');await page.locator('.nsc-picks-dialog').getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('tab',{name:'Nothing Friends'}).click();await page.locator('[data-ladder-profile="11111111-1111-4111-8111-111111111111"]').waitFor();
 assert.equal(await page.locator('.nsc-ladder-frozen:not([hidden])').count(),0,'Friends must not obscure the mobile table with a duplicate frozen viewer row');
 const friendActions=page.locator('[data-ladder-profile="11111111-1111-4111-8111-111111111111"] .nsc-ladder-actions');
 assert.equal(await friendActions.getByRole('button',{name:'Following',exact:true}).count(),1);
 assert.equal(await friendActions.getByRole('button',{name:'See / copy follows',exact:true}).count(),1,'copy follows belongs beside Follow');
 assert.equal(await page.getByText(/once-off 20 points.+no matter how many sports/i).count(),1,'Friends screen explains the permanent person-wide copy reward');
 if(width<=390){
  const copyButton=friendActions.getByRole('button',{name:'See / copy follows',exact:true});
  const geometry=await copyButton.evaluate(button=>{const row=button.closest('.nsc-ladder-row'),body=document.querySelector('#nothingscoreBody');return{button:button.getBoundingClientRect().toJSON(),row:row.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),documentOverflow:document.documentElement.scrollWidth-innerWidth,bodyOverflow:body.scrollWidth-body.clientWidth};});
  assert(geometry.button.width>=120&&geometry.button.height>=44,'copy follows is a prominent mobile action');
  assert(geometry.button.left>=geometry.body.left&&geometry.button.right<=geometry.body.right,'copy follows remains visible without sideways paging');
  assert(geometry.row.width<=geometry.body.width+1,'Friends rows adapt to the mobile drawer width');
  assert.equal(geometry.documentOverflow,0,'the app viewport never pans horizontally');
  assert.equal(geometry.bodyOverflow,0,'the Nothing Friends screen owns no page-width overflow');
 }
 await page.getByRole('button',{name:'Add to Feed'}).waitFor();await page.locator('.nsc-friends-activity a').click();await page.locator('.nsc-friend-fixture').waitFor();await page.locator('.nsc-friend-fixture').getByRole('button',{name:'Close',exact:true}).click();
 const accent=await friendActions.getByRole('button',{name:'See / copy follows',exact:true}).evaluate(button=>({background:getComputedStyle(button).backgroundColor,color:getComputedStyle(button).color}));
 assert.equal(accent.background,'rgb(0, 127, 153)','social actions use the light-theme Nothing Sport teal');assert.equal(accent.color,'rgb(25, 22, 26)','teal actions retain dark readable text');
 await page.screenshot({path:`/tmp/nothinger-leaderboard-${width}.png`});
 if(width===390){await page.evaluate(()=>applyThemePreference('night'));await page.screenshot({path:'/tmp/nothinger-leaderboard-390-dark.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>applyThemePreference('day'));}
 await page.evaluate(()=>{setNothingscoreDrawerOpen(false);setGlobalSpoilerPreference(true,{notify:false});const host=document.createElement('section');host.id='qa-clarity';host.style.cssText='padding:12px;background:var(--bg-card);position:relative;z-index:2';host.append(buildCompactResult(qaFixture,qaFixture.name),buildInlineCrowdRating({...qaFixture,status:'scheduled',startTimeUtc:'2026-09-20T00:00:00Z'},{phase:'heat'}));document.body.prepend(host);});
 assert.equal(await page.locator('.tennis-set-table tbody tr').count(),2);assert.equal(await page.locator('.tennis-set-table thead th').count(),6);assert.equal(await page.locator('.tennis-set-table sup').count(),3);
 const dimensions=await page.locator('#qa-clarity .nsc-rating-block').first().evaluate(e=>({button:e.getBoundingClientRect().height,flame:e.querySelector('svg').getBoundingClientRect().height,color:getComputedStyle(e).color}));assert(dimensions.button>=44);assert(dimensions.flame<=20);
 await page.evaluate(()=>applyThemePreference('night'));assert(await page.locator('#qa-clarity .nsc-rating-block').first().evaluate(e=>getComputedStyle(e).color!=='rgb(21, 24, 32)'));await page.evaluate(()=>applyThemePreference('day'));await page.locator('#qa-clarity').screenshot({path:`/tmp/card-clarity-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log({width,dimensions,passed:true});await page.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
