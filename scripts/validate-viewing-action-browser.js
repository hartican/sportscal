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
   const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([k])=>k!=='followBrowse'))));
   for(const width of[320,390,1280])for(const theme of['day','night'])for(const mode of['feed','schedule'])for(const scenario of scenarios){
    await page.setViewportSize({width,height:1000});
    const result=await page.evaluate(({theme,mode,scenario})=>{
     applyThemePreference(theme);activeTab=mode==='feed'?'feed':'follow';const f=scenario.fixture;setCardState(f,'opened');
     const card=mode==='schedule'?buildCodeInspectorFixture(f):buildEventCard(f);document.getElementById('listView').replaceChildren(card);
     const links=[...card.querySelectorAll('a.provider-link')].map(a=>({label:a.getAttribute('aria-label'),href:a.getAttribute('href'),target:a.target,rel:a.rel}));
     return {links,expected:FOLLOW_FIRST.viewingOptions(f).filter(o=>!o.territory||['AU','GLOBAL'].includes(o.territory)).map(o=>({label:(scenario.expectedMode==='live'?'Watch':'Check replay availability')+' on '+o.label+' · '+({free:'Free',subscription:'Subscription',ppv:'Pay-per-view',included:'Included in plan'}[o.accessType]||'Check cost'),href:o.webUrl})),overflow:document.documentElement.scrollWidth>innerWidth+1};
    },{theme,mode,scenario});
    assert(result.links.length>0,`${scenario.kind}: actual provider action missing`);assert(!result.overflow);
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
   assert.equal(replay.firstVerified,false);assert.equal(replay.secondVerified,false);assert.equal(replay.label,'Check replay availability on Stan Sport · Subscription');
   const access=await page.evaluate(async()=>{
    const f=(await(await fetch('/data/code-inspector/football.json')).json()).fixtures.find(e=>e.competitionId==='competition:premier-league-2026-27'&&e.status==='completed'),option=FOLLOW_FIRST.viewingOptions(f)[0],rows=[];
    const original=JSON.stringify(f),host=document.getElementById('listView');
    for(const accessType of ['free','subscription','ppv','included','unknown','__proto__']){
     host.replaceChildren();appendEventQuickActions(host,{...f,viewingOptions:[{...option,accessType}]},{reminder:false,chat:false});
     const link=host.querySelector('a.provider-link');rows.push({type:accessType,caption:link.querySelector('.provider-access').textContent,label:link.getAttribute('aria-label'),href:link.getAttribute('href'),checkedAt:FOLLOW_FIRST.viewingOptions({...f,viewingOptions:[{...option,accessType}]})[0].verifiedAt});
    }
    return {rows,unchanged:JSON.stringify(f)===original,sourceDate:option.verifiedAt,url:option.webUrl};
   });
   assert.deepEqual(access.rows.map(r=>r.caption),['Free','Subscription','Pay-per-view','Included in plan','Check cost','Check cost'],'Explicit access metadata governs cost; unknown or hostile values cannot become free');
   assert(access.rows.every(r=>r.label.endsWith(' · '+r.caption)&&r.label.startsWith('Check replay availability on Stan Sport')&&r.href===access.url&&r.checkedAt===access.sourceDate));assert(access.unchanged,'Cost presentation changes no stored source facts');
   const keyboard=page.locator('#listView a.provider-link');await keyboard.focus();assert(await keyboard.evaluate(e=>e===document.activeElement),'Provider with visible unknown cost remains keyboard focusable');
   observations.push({engine:name,scenario:'controlled-access-metadata',access});
   assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(userPreferences).filter(([k])=>k!=='followBrowse')))),before,'provider rendering changes no follows, subscriptions or Results');assert.deepEqual(errors,[]);
   observations.push({engine:name,scenario:'actual-metadata-round-trip',...replay});await page.close();
  }finally{await browser.close();}
 }}finally{if(local){local.closeAllConnections();await new Promise(resolve=>local.close(resolve));}}
 if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({checkedAt:new Date().toISOString(),cases:observations.length,observations,scope:'Actual published upcoming NFL and completed Football cards, explicitly controlled NFL placeholder/live status/access cases and repeated real metadata. API requests fail closed; no current sporting-live, source-backed controlled cost or authenticated playback claim.'},null,2)+'\n');}
 console.log('Viewing action browser: '+observations.length+' both-engine/width/theme/Feed/Schedule cases and unknown replay round trips passed.');
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
