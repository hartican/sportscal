#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),observations=[],out=process.env.VIEWING_ACTION_QA_OUTPUT;
function server(){return http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});});}
(async()=>{
 const local=process.env.QA_BASE_URL?null:server();if(local)await new Promise(resolve=>local.listen(0,'127.0.0.1',resolve));
 try{for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,version:27,selectedSelectorEntityIds:['sport:football']})));
   await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${local.address().port}`,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:30000});
   const scenarios=await page.evaluate(async()=>{
    const football=(await(await fetch('/data/code-inspector/football.json')).json()).fixtures;
    const nfl=(await(await fetch('/data/code-inspector/american-football.json')).json()).fixtures;
    const rows=[];const published=nfl.find(f=>f.status==='upcoming'&&Date.parse(f.startTimeUtc)>Date.now());if(!published)throw Error('No actual forthcoming NFL fixture');
    rows.push({kind:'actual-nfl-upcoming',fixture:published,expectedMode:'live',actual:true});
    rows.push({kind:'controlled-nfl-placeholder',fixture:{...published,score:'0 - 0',scoreDisplay:'0 - 0'},expectedMode:'live',actual:false});
    for(const competitionId of ['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league']){
     const final=football.find(f=>f.competitionId===competitionId&&f.status==='completed');if(!final)throw Error('Missing actual final');
     rows.push({kind:'actual-final',fixture:final,expectedMode:'replay',actual:true});
     const id='qa-viewing:'+competitionId;const start=new Date(Date.now()-60000).toISOString();const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(start)).map(p=>[p.type,p.value]));
     rows.push({kind:'controlled-live-partial-score',fixture:{...final,id,eventId:id,canonicalEventId:id,startTimeUtc:start,endTimeUtc:new Date(Date.now()+7200000).toISOString(),date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,statusCheckedAt:new Date().toISOString(),status:'live',scheduleStatus:'live',score:'0 - 0',scoreDisplay:'0 - 0'},expectedMode:'live',actual:false});
    }
    return rows;
   });
   scenarios.push(...await page.evaluate(async()=>{const cricket=(await(await fetch('/data/code-inspector/cricket.json')).json()).fixtures;return ['competition:cricket:espn:8043','competition:cricket:espn:8626'].map(id=>{const fixture=cricket.find(f=>f.competitionId===id&&['upcoming','scheduled'].includes(f.status));if(!fixture)throw Error('Missing actual domestic Cricket viewing case '+id);return {kind:'actual-domestic-'+id,fixture,expectedMode:'live',actual:true};});}));
   const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([k])=>k!=='followBrowse'))));
   for(const width of[320,390,1280])for(const theme of['day','night'])for(const mode of['feed','schedule'])for(const scenario of scenarios){
    await page.setViewportSize({width,height:1000});
    const result=await page.evaluate(({theme,mode,scenario})=>{
     applyThemePreference(theme);activeTab=mode==='feed'?'feed':'follow';const f=scenario.fixture;setCardState(f,'opened');
     const card=mode==='schedule'?buildCodeInspectorFixture(f):buildEventCard(f);document.getElementById('listView').replaceChildren(card);
     const links=[...card.querySelectorAll('a.provider-link')].map(a=>({label:a.getAttribute('aria-label'),href:a.getAttribute('href'),target:a.target,rel:a.rel}));
     return {links,expected:FOLLOW_FIRST.viewingOptions(f).filter(o=>(!o.territory||['AU','GLOBAL'].includes(o.territory))&&(o.liveOrReplay!=='replay'||o.replayVerified)).map(o=>({label:(scenario.expectedMode==='live'?'Watch':'Replay')+' on '+o.label+' · '+({free:'Free',subscription:'Subscription',ppv:'Pay-per-view',included:'Included in plan'}[o.accessType]||'Check cost'),href:o.webUrl})),overflow:document.documentElement.scrollWidth>innerWidth+1};
    },{theme,mode,scenario});
    assert.equal(result.links.length,result.expected.length,`${scenario.kind}: supported actions only`);assert(!result.overflow);
    assert.deepEqual(result.links.map(({label,href})=>({label,href})),result.expected,`${name}/${mode}/${scenario.kind}: declared status governs actual action`);
    assert(result.links.every(l=>l.target==='_blank'&&l.rel.includes('noopener')&&l.rel.includes('noreferrer')));
    observations.push({engine:name,width,theme,mode,scenario:scenario.kind,fixtureId:scenario.fixture.id,actualPublishedFixture:scenario.actual,links:result.links});
   }
   // Read actual dated provider metadata twice, then render the shared real action component.
   const replay=await page.evaluate(async()=>{
    const fixtures=(await(await fetch('/data/code-inspector/football.json')).json()).fixtures;
    const f=fixtures.find(e=>e.competitionId==='competition:premier-league-2026-27'&&e.status==='completed');const one=FOLLOW_FIRST.viewingOptions(f);const two=FOLLOW_FIRST.viewingOptions({...f,viewingOptions:one,broadcaster:'',broadcastOptions:[]});
    const host=document.getElementById('listView');host.replaceChildren();appendEventQuickActions(host,{...f,viewingOptions:two,broadcaster:'',broadcastOptions:[]},{reminder:false,chat:false});
    return {firstVerified:one[0].replayVerified,secondVerified:two[0].replayVerified,label:host.querySelector('a.provider-link')?.getAttribute('aria-label'),href:host.querySelector('a.provider-link')?.getAttribute('href')};
   });
   assert.equal(replay.firstVerified,false);assert.equal(replay.secondVerified,false);assert.equal(replay.label,undefined,'Unconfirmed completed coverage renders no action');
   const access=await page.evaluate(async()=>{
    const f=(await(await fetch('/data/code-inspector/football.json')).json()).fixtures.find(e=>e.competitionId==='competition:premier-league-2026-27'&&e.status==='completed'),option=FOLLOW_FIRST.viewingOptions(f)[0],rows=[];
    const original=JSON.stringify(f),host=document.getElementById('listView');
    for(const accessType of ['free','subscription','ppv','included','unknown','__proto__']){
     host.replaceChildren();appendEventQuickActions(host,{...f,status:'upcoming',viewingOptions:[{...option,accessType}]},{reminder:false,chat:false});
     const link=host.querySelector('a.provider-link');rows.push({type:accessType,caption:link.querySelector('.provider-access').textContent,label:link.getAttribute('aria-label'),href:link.getAttribute('href'),checkedAt:FOLLOW_FIRST.viewingOptions({...f,status:'upcoming',viewingOptions:[{...option,accessType}]})[0].verifiedAt});
    }
    return {rows,unchanged:JSON.stringify(f)===original,sourceDate:option.verifiedAt,url:option.webUrl};
   });
   assert.deepEqual(access.rows.map(r=>r.caption),['Free','Subscription','Pay-per-view','Included in plan','Check cost','Check cost'],'Explicit access metadata governs cost; unknown or hostile values cannot become free');
   assert(access.rows.every(r=>r.label.endsWith(' · '+r.caption)&&r.label.startsWith('Watch on Stan Sport')&&r.href===access.url&&r.checkedAt===access.sourceDate));assert(access.unchanged,'Cost presentation changes no stored source facts');
   const keyboard=page.locator('#listView a.provider-link');await keyboard.focus();assert(await keyboard.evaluate(e=>e===document.activeElement),'Provider with visible unknown cost remains keyboard focusable');
   observations.push({engine:name,scenario:'controlled-access-metadata',access});
   assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([k])=>k!=='followBrowse')))),before,'provider rendering changes no follows, subscriptions or Results');assert.deepEqual(errors,[]);
   observations.push({engine:name,scenario:'actual-metadata-round-trip',...replay});
   await page.evaluate(async()=>{openSettings({section:'about'});await ensureFantasyUi();});
   const guide=page.locator('[data-about-section=ratings]');assert.equal(await guide.count(),1);assert.equal(await guide.evaluate(e=>e.open),false);await guide.locator('summary').focus();await page.keyboard.press('Enter');assert.match(await guide.innerText(),/8× weight/);assert.match(await guide.innerText(),/EPIC Hall of Fame/);assert.equal(await guide.locator('.about-rating-icon').count(),3);await page.locator('#saveSettingsBtn').click();
   await page.evaluate(async()=>{openSettings({section:'subscriptions'});await ensureFantasyUi();});
   for(const service of ['Stan Sport','Kayo Sports'])await page.locator('#subscriptionGrid label').filter({hasText:new RegExp('^'+service+'$')}).locator('input').check();
   await page.locator('#saveSettingsBtn').click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
   assert(await page.evaluate(()=>['stan','kayo'].every(id=>userPreferences.followFirst.subscriptions.includes(id))),'Subscription order survives real Settings save and reload');
   const controlled=await page.evaluate(()=>({id:'fixture:qa:order',key:'football',name:'Controlled viewing choice',date:'2026-10-18',status:'upcoming',viewingOptions:['bein','nine','stan','kayo'].map(providerId=>({providerId,rightsScope:'fixture',sourceUrl:'https://example.test/official-au-fixture',verifiedAt:'2026-10-14T00:00:00Z',territory:'AU'}))}));
   await page.route('**/assets/providers/**',r=>r.abort());
   for(const width of [320,390,1280])for(const theme of ['day','night']){
    await page.setViewportSize({width,height:1000});await page.evaluate(({controlled,theme})=>{applyThemePreference(theme);activeTab='feed';setCardState(controlled,'opened');document.getElementById('listView').replaceChildren(buildEventCard(controlled));},{controlled,theme});
    const marks=page.locator('#listView .fixture-access .provider-action-mark');assert.deepEqual(await marks.evaluateAll(nodes=>nodes.map(n=>n.dataset.providerId)),['stan','kayo','nine','bein']);
    await page.locator('#listView .fixture-access .provider-action-mark-fallback').first().waitFor();assert.equal(await page.locator('#listView .nsc-rating-help,#listView .nsc-rating-timing-note').count(),0);assert(!(await page.locator('#listView').innerText()).includes('Before it starts:'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Provider labels/fallbacks fit');
    for(const phase of ['heat','pulse','impact']){await page.evaluate(({phase,controlled})=>{const host=document.createElement('div');host.id='qa-rating-only';host.append(buildInlineCrowdRating(controlled,{phase,currentUser:{contribution:{rating:0}}}));document.getElementById('listView').replaceChildren(host);},{phase,controlled});assert.equal(await page.locator('#qa-rating-only button').count(),5);assert.equal(await page.locator('#qa-rating-only .nsc-rating-prompt').isVisible(),false);assert.equal(await page.locator('#qa-rating-only summary').count(),0);}
    await page.evaluate(controlled=>{const host=document.getElementById('listView');host.replaceChildren();appendEventQuickActions(host,{...controlled,status:'completed',viewingOptions:[]},{reminder:false,chat:false});},controlled);assert.equal(await page.locator('#listView .fixture-providers').count(),0);assert.equal(await page.locator('#listView .event-quick-actions').evaluate(e=>e.getBoundingClientRect().height),0);
    observations.push({engine:name,width,theme,scenario:'clean-feed-about-preferences-failed-logos',guideInAbout:true,emptySpace:0,storedSubscriptions:true});
   }
   assert.deepEqual(errors,[]);await page.close();
   for(const [device,userAgent] of [
    ['iphone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'],
    ['android','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/134.0 Mobile Safari/537.36']
   ]){
    const mobile=await browser.newPage({viewport:{width:390,height:1000},userAgent,serviceWorkers:'block'}),popups=[],mobileErrors=[];
    mobile.on('popup',p=>popups.push(p));mobile.on('pageerror',e=>mobileErrors.push(e.message));
    await mobile.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
    await mobile.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:false,version:27,selectedSelectorEntityIds:['sport:football']})));
    await mobile.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${local.address().port}`,{waitUntil:'domcontentloaded',timeout:45000});
    await mobile.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:30000});
    for(const theme of ['day','night'])for(const mode of ['feed','events','schedule'])for(const state of ['selected','opened']){
     const result=await mobile.evaluate(async({theme,mode,state})=>{
      const fixtures=(await(await fetch('/data/code-inspector/football.json')).json()).fixtures;
      const f=fixtures.find(e=>e.id==='fixture:football:openligadb:uefa-champions-league:87418');if(!f)throw Error('Reported published City–PSG fixture missing');
      const before=JSON.stringify([f,userPreferences.followFirst,userPreferences.showSpoilers,eventActions]);
      applyThemePreference(theme);activeTab=mode==='schedule'?'follow':mode;setCardState(f,state);
      document.getElementById('qa-stan-launch')?.remove();const host=document.createElement('section');host.id='qa-stan-launch';host.style.cssText='position:relative;z-index:50;margin:160px auto 24px;padding:12px;max-width:800px';
      const card=mode==='schedule'?buildCodeInspectorFixture(f):buildEventCard(f);host.append(card);document.body.append(host);
      const link=card.querySelector('a.provider-link .provider-action-mark[data-provider-id=stan]')?.closest('a');if(!link)throw Error('No Stan action on reported card');
      return {id:f.id,href:link.href,target:link.target,rel:link.rel,unmodified:JSON.stringify([f,userPreferences.followFirst,userPreferences.showSpoilers,eventActions])===before};
     },{theme,mode,state});
     assert.equal(result.href,'https://play.stan.com.au/sport');assert.equal(result.target,'_self');assert(result.rel.includes('noopener')&&result.rel.includes('noreferrer'));assert(result.unmodified,'Launch presentation does not alter source or saved choices');
     const anchor=mobile.locator('#qa-stan-launch a.provider-link').filter({has:mobile.locator('[data-provider-id=stan]')});await anchor.scrollIntoViewIfNeeded();assert(await anchor.isVisible(),'Test a visible card action');
     observations.push({engine:name,device,theme,mode,state,scenario:'reported-stan-card-mobile-handoff',...result});
    }
    if(out){fs.mkdirSync(out,{recursive:true});await mobile.locator('#qa-stan-launch').screenshot({path:path.join(out,`stan-${name}-${device}.png`)});}
    await mobile.route('https://play.stan.com.au/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Controlled Stan web fallback</title>'}));
    const anchor=mobile.locator('#qa-stan-launch a.provider-link').filter({has:mobile.locator('[data-provider-id=stan]')});await anchor.click();await mobile.waitForURL('https://play.stan.com.au/sport');
    assert.equal(popups.length,0,'One direct tap does not force a browser popup');assert.deepEqual(mobileErrors,[]);
    observations.push({engine:name,device,scenario:'stan-direct-tap-controlled-web-fallback',url:mobile.url(),popups:popups.length,nativeInstalledAppProven:false});await mobile.close();
   }
  }finally{await browser.close();}
 }}finally{if(local){local.closeAllConnections();await new Promise(resolve=>local.close(resolve));}}
 if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({checkedAt:new Date().toISOString(),cases:observations.length,observations,scope:'Actual published NFL/Football/Cricket records, controlled NFL live/access cases, and reported City–PSG visible shared-renderer Feed/Events/Schedule cards with iPhone/Android user agents. Direct mobile taps reach a controlled Stan web fallback without popups. API requests fail closed; no physical installed-app launch, sporting-live accuracy or authenticated playback claim.'},null,2)+'\n');}
 console.log('Viewing action browser: '+observations.length+' both-engine/width/theme/Feed/Events/Schedule cases, mobile Stan routing and unknown replay round trips passed.');
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
