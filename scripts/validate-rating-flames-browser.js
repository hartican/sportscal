#!/usr/bin/env node
'use strict';
// Retain the established command while validating its replacement steak control.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const labels=['Low stakes','Mid stakes','High stakes','Huge stakes','Epic stakes'];
const project=path.resolve(__dirname,'..');
const assetPath='assets/icons/flaticon/meaicon-steak.png';
assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(project,assetPath))).digest('hex'),'f8e6cbbc6b2b9721d8cf03aad1f5b5c8d856b74f554b267ce99459f0f337f674','Use the exact user-supplied PNG');
const steak=require('../config/vector-assets').openUse['ui:steak'];
assert.equal(steak.author,'meaicon');assert.equal(steak.rightsStatus,'user-supplied');
const output=process.env.STAKES_QA_OUTPUT;
const close=(a,b)=>Math.abs(a-b)<.1;
(async()=>{
 let server,browser;
 try{
  let base=process.env.REPAIR_QA_URL;
  if(!base){
   server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(project,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(project+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    const type={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(fs.readFileSync(file));
   });
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  }
  const engine=process.env.STAKES_QA_BROWSER==='webkit'?webkit:chromium;
  browser=await engine.launch({headless:true,...(engine===chromium?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{})});
  let cases=0;
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',selectedSelectorEntityIds:['sport:f1'],followedSports:['f1']})));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating(),null,{timeout:60000});
   const scenarios=await page.evaluate(async()=>{
    const source=new Image();source.src="assets/icons/flaticon/meaicon-steak.png";await source.decode();
    const canvas=document.createElement("canvas");canvas.width=canvas.height=512;const context=canvas.getContext("2d");context.drawImage(source,0,0);const pixels=context.getImageData(0,0,512,512).data;
    if(source.naturalWidth!==512||source.naturalHeight!==512||!pixels.some((v,i)=>i%4===3&&v===0)||!pixels.some((v,i)=>i%4===3&&v===255))throw Error("Supplied steak and transparent detail must load");
    const credit=document.querySelector("footer .steak-attribution a");if(credit?.textContent!=="Steak icons created by meaicon - Flaticon"||credit.href!=="https://www.flaticon.com/free-icons/steak")throw Error("Missing visible Flaticon credit");
    const results=[];
    const ev={id:'qa-stakes',key:'f1',name:'Stakes QA race',startTimeUtc:'2026-10-10T12:00:00Z',timePrecision:'exact'};
    const mount=(snapshot,inDrawer)=>{
     document.getElementById('stakes-test')?.remove();
     const card=document.createElement('div');card.id='stakes-test';card.className=inDrawer?'event-card nsc-panel':'event-card feed-fixture';
     card.style.cssText='width:min(100%,360px);box-sizing:border-box;padding:12px;margin:0 auto;position:relative;z-index:10000';
     card.appendChild(buildNothingscorePeerResults(ev,snapshot,{inDrawer}));(inDrawer?document.body:document.querySelector('#listView')).appendChild(card);return card;
    };
    for(const theme of ['day','night'])for(const inDrawer of [false,true])for(const phase of ['heat','pulse','impact'])for(let rating=0;rating<=5;rating++){
     document.documentElement.dataset.theme=theme;
     const card=mount({phase,currentUser:{submissions:{[phase]:{rating}}},peerResults:{count:3,average:3,rawAverage:3,label:'Legacy adjective'}},inDrawer);
     const buttons=[...card.querySelectorAll('.nsc-rating-block')];
     results.push({theme,inDrawer,phase,rating,boxes:buttons.map(b=>{const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,height:r.height,svgLeft:s.left,svgRight:s.right,svgWidth:s.width,svgHeight:s.height};}),card:card.getBoundingClientRect().toJSON(),rowWidth:card.querySelector('.nsc-rating-blocks').getBoundingClientRect().width,disabled:buttons.some(b=>b.disabled),filled:buttons.filter(b=>b.classList.contains('is-filled')).length,pressed:buttons.map(b=>b.getAttribute('aria-pressed')),aria:buttons.map(b=>b.getAttribute('aria-label')),prompt:card.querySelector('.nsc-rating-prompt').textContent,summary:card.querySelector('.nsc-peer-summary').textContent,tags:[...card.querySelectorAll('.fixture-tag')].map(t=>t.textContent),artwork:buttons.map(b=>{const image=b.querySelector('.steak-artwork');const style=getComputedStyle(image);return{opacity:style.opacity,filter:getComputedStyle(b.querySelector("svg")).filter,source:image.getAttribute('href')};})});
    }
    const crowd=[];
    for(const [rawAverage,average]of [[1,1],[1.49,1.5],[1.5,1.5],[2.49,2.5],[2.5,2.5],[3.49,3.5],[3.5,3.5],[4.49,4.5],[4.5,4.5],[5,5],[null,2],[undefined,3]]){
     const card=mount({phase:'heat',peerResults:{count:3,average,rawAverage,label:'Wrong legacy label'}},false);
     crowd.push({rawAverage,average,text:card.querySelector('.nsc-peer-summary').textContent});
    }
    const empty=[];
    for(const snapshot of [undefined,{phase:'heat',ratingRequired:true},{phase:'heat'},{phase:'heat',peerResults:{count:0,average:null}}])empty.push(mount(snapshot,false).querySelector('.nsc-peer-summary').textContent);
    mount({phase:'heat',currentUser:{contribution:{rating:2}},peerResults:{count:3,average:3}},false);
    return{results,crowd,empty};
   });
   for(const s of scenarios.results){
    const context=JSON.stringify({width,theme:s.theme,inDrawer:s.inDrawer,phase:s.phase,rating:s.rating});
    assert.equal(s.boxes.length,5,context);assert(close(s.rowWidth,220),context);
    assert(s.boxes.every(b=>close(b.width,44)&&close(b.height,44)&&close(b.svgWidth,30)&&close(b.svgHeight,20)),context);
    assert(s.boxes.slice(1).every((b,i)=>close(b.left-s.boxes[i].right,0)&&close(b.svgLeft-s.boxes[i].svgRight,14)),context);
    assert(s.boxes.every(b=>b.left>=s.card.left&&b.right<=s.card.right),context);
    assert.equal(s.disabled,false,context);assert.equal(s.filled,s.rating,context);
    assert.deepEqual(s.pressed,labels.map((_,i)=>String(i+1===s.rating)),context);
    assert.deepEqual(s.aria,labels.map((label,i)=>`${i+1} out of 5: ${label}`),context);
    assert.equal(s.prompt,s.rating?labels[s.rating-1]:s.phase==='pulse'?'How’s it going? Rate stakes':'Tap to rate stakes',context);
    assert.equal(s.summary,`3 Nothingers ${s.phase==='heat'?'expect':s.phase==='pulse'?'are rating this':'have rated this'} High stakes · 3.0/5`,context);
    assert(!s.tags.includes('LEGACY ADJECTIVE')&&!s.tags.includes('HIGH STAKES'),context);
    assert.deepEqual(s.artwork.map(a=>a.opacity),labels.map((_,i)=>i<s.rating?'1':'0.4'),context);
    assert(s.artwork.every(a=>a.source===assetPath),context);
    assert(s.artwork.every(a=>s.theme==='night'?a.filter.includes('invert(1)'):a.filter==='none'),context);
    cases++;
   }
   for(const c of scenarios.crowd)assert.equal(c.text,`3 Nothingers expect ${labels[Math.round(c.rawAverage??c.average)-1]} · ${c.average.toFixed(1)}/5`);
   assert.deepEqual(scenarios.empty,['Ratings loading…','Rate to reveal community ratings','Ratings unavailable','Be the first to rate']);
   let fail=false,release,delayed=false,saved={phase:'heat',currentUser:{}};const writes=[];
   await page.route('**/api/nothingscore**',async route=>{
    const body=route.request().postDataJSON();
    if(body){
     writes.push(body);
     if(delayed)await new Promise(resolve=>release=resolve);
     if(!fail)saved={phase:body.phase,currentUser:{submissions:{[body.phase]:{rating:body.rating}}}};
     return route.fulfill({status:fail?500:200,contentType:'application/json',body:JSON.stringify(fail?{error:'QA save failure'}:{rating:body.rating,pointsAwarded:1})});
    }
    await route.fulfill({contentType:'application/json',body:JSON.stringify({detail:saved})});
   });
   await page.evaluate(()=>{
    const token='qa.'+btoa(JSON.stringify({sub:'qa-stakes-owner'}))+'.local';
    localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify({accessToken:token,refreshToken:'qa-local-only',expiresAt:Date.now()+3600000}));
    serverPersistence.user={id:'qa-stakes-owner'};
    window.mountStakesQA=snapshot=>{document.getElementById('stakes-test')?.remove();const host=document.createElement('div');host.id='stakes-test';document.body.appendChild(host);host.appendChild(buildInlineCrowdRating({id:'qa-stakes-save',key:'f1',name:'QA race',startTimeUtc:'2026-10-10T12:00:00Z'},snapshot));};
    mountStakesQA();
   });
   const host=page.locator('#stakes-test'),buttons=host.locator('.nsc-rating-block');
   assert.equal(await buttons.locator(':scope:disabled').count(),5);
   assert.equal(await host.locator('.nsc-rating-status').textContent(),'Checking your rating…');
   await page.evaluate(()=>{nothingscoreLoadErrors.set('qa-stakes-save',Date.now());mountStakesQA();});
   assert((await host.locator('.nsc-rating-status').textContent()).includes('Your rating could not be loaded.'));
   assert.equal(await buttons.locator(':scope:disabled').count(),5);
   await page.evaluate(()=>nothingscoreLoadErrors.delete('qa-stakes-save'));
   for(const phase of ['heat','pulse','impact']){
    await page.evaluate(phase=>mountStakesQA({phase,currentUser:{contribution:{rating:2}}}),phase);
    delayed=true;release=undefined;
    await buttons.nth(3).click();await host.getByText('Saving…',{exact:true}).waitFor();
    assert.equal(await host.locator('.nsc-rating-prompt').textContent(),'Huge stakes');
    assert.equal(await buttons.locator(':scope:disabled').count(),5);
    for(let attempt=0;attempt<100&&!release;attempt++)await page.waitForTimeout(10);
    assert.equal(typeof release,'function');delayed=false;release();
    await host.getByText('+1 points',{exact:true}).waitFor();
    assert.equal(await buttons.locator(':scope:disabled').count(),0);
    fail=true;await buttons.nth(4).click();await host.getByText(/QA save failure/).waitFor();fail=false;
    assert.equal(await host.locator('.nsc-rating-prompt').textContent(),'Huge stakes');assert.equal(await host.locator('.is-filled').count(),4);
    assert.equal(await buttons.locator(':scope:disabled').count(),0);
    await page.evaluate(phase=>mountStakesQA({phase,currentUser:{submissions:{[phase]:{rating:4}}}}),phase);
    assert.equal(await host.locator('.nsc-rating-prompt').textContent(),'Huge stakes');
   }
   assert.deepEqual(writes,['heat','pulse','impact'].flatMap(phase=>[4,5].map(rating=>({action:phase==='pulse'?'pulse':'submit',eventId:'qa-stakes-save',phase,rating,tags:[]}))));
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating(),null,{timeout:60000});
   await page.evaluate(async()=>{
    window.mountStakesQA=snapshot=>{document.getElementById('stakes-test')?.remove();const host=document.createElement('div');host.id='stakes-test';document.body.appendChild(host);host.appendChild(buildInlineCrowdRating({id:'qa-stakes-save',key:'f1',name:'QA race',startTimeUtc:'2026-10-10T12:00:00Z'},snapshot));};
    const response=await serverSyncClient.nothingscoreRequest({eventId:'qa-stakes-save'});mountStakesQA(response.detail);
   });
   assert.equal(await host.locator('.nsc-rating-prompt').textContent(),'Huge stakes','Reload restores the saved server rating');
   assert.equal(await host.locator('.is-filled').count(),4);
   await page.evaluate(()=>{serverSyncClient.clearSession();serverPersistence.user=null;openSettings=()=>{};mountStakesQA({phase:'heat',currentUser:{contribution:{rating:2}}});});
   await buttons.first().focus();
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'2 out of 5: Mid stakes');assert.equal(await buttons.nth(1).evaluate(b=>getComputedStyle(b).outlineStyle),'solid');
   await page.keyboard.press('Enter');await host.getByText('Sign in to rate this fixture.',{exact:true}).waitFor();assert.equal(writes.length,6);
   if(width===390){
    if(output)fs.mkdirSync(output,{recursive:true});
    for(const theme of ['day','night'])for(const rating of [0,2,5]){
     await page.evaluate(({theme,rating})=>{document.documentElement.dataset.theme=theme;const host=document.getElementById('stakes-test');host.className='event-card feed-fixture';host.style.cssText='width:300px;padding:16px;margin:0 auto;display:block';document.querySelector('#listView').appendChild(host);host.replaceChildren(buildNothingscorePeerResults({id:'qa-picture',key:'f1',name:'QA race',startTimeUtc:'2026-10-10T12:00:00Z'},{phase:'heat',currentUser:{contribution:{rating}},peerResults:{count:3,average:3,rawAverage:3}}));},{theme,rating});
     await page.locator('#stakes-test').evaluate(host=>host.scrollIntoView({block:'center'}));
     const pixels=await page.locator('#stakes-test .steak-glyph').first().screenshot();
     const brightness=await page.evaluate(async source=>{const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const values=[...ctx.getImageData(0,0,canvas.width,canvas.height).data].filter((_,i)=>i%4===0);return{min:Math.min(...values),max:Math.max(...values)};},'data:image/png;base64,'+pixels.toString('base64'));
     // Inspect rendered pixels: WebKit can report a nested SVG image filter without painting it.
     if(theme==='night')assert(brightness.max>(rating?220:70),'Night steak must paint visibly in '+process.env.STAKES_QA_BROWSER);
     else assert(brightness.min<(rating?40:180),'Day steak must paint visibly');
     if(output)await page.locator('#stakes-test').screenshot({path:path.join(output,`stakes-${theme}-${rating}.png`)});
    }
   }
   assert.deepEqual(errors,[]);await page.close();console.log(`${width}px: stakes labels, crowd boundaries, touch geometry, saving/recovery and keyboard passed`);
  }
  console.log(JSON.stringify({browser:engine===webkit?'webkit':'chromium',presentationCases:cases,passed:true}));
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
