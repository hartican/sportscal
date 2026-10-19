#!/usr/bin/env node
'use strict';
// Retain the established command; test the real phase-specific controls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const policy=require('../config/epic-classics'),project=path.resolve(__dirname,'..'),output=process.env.STAKES_QA_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});
const close=(a,b)=>Math.abs(a-b)<.1;
(async()=>{
 let server,browser,cases=0;
 try{
  let base=process.env.REPAIR_QA_URL;
  if(!base){
   server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(project,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(project+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    const type={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(fs.readFileSync(file));
   });
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  }
  const engine=process.env.STAKES_QA_BROWSER==='webkit'?webkit:chromium;
  browser=await engine.launch({headless:true,...(engine===chromium?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{})});
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort('blockedbyclient'));
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'day',selectedSelectorEntityIds:['sport:f1'],followedSports:['f1']})));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating(),null,{timeout:60000});
   const samples=await page.evaluate(()=>{
    const results=[],crowd=[],ev={id:'qa-spectacle',key:'f1',name:'Controlled rating fixture',startTimeUtc:'2026-10-19T12:00:00Z',timePrecision:'exact'};
    const mount=(snapshot,inDrawer)=>{
     document.getElementById('spectacle-test')?.remove();const card=document.createElement('div');card.id='spectacle-test';card.className=inDrawer?'event-card nsc-panel':'event-card feed-fixture';
     card.style.cssText='width:min(100%,360px);box-sizing:border-box;padding:12px;margin:0 auto;position:relative;z-index:10000';card.appendChild(buildNothingscorePeerResults(ev,snapshot,{inDrawer}));document.body.appendChild(card);return card;
    };
    for(const theme of ['day','night'])for(const inDrawer of [false,true])for(const phase of ['heat','pulse','impact'])for(let rating=0;rating<=5;rating++){
     document.documentElement.dataset.theme=theme;const card=mount({phase,currentUser:{submissions:{[phase]:{rating}}},peerResults:{count:3,average:3,rawAverage:3,label:'Wrong legacy adjective'}},inDrawer),buttons=[...card.querySelectorAll('.nsc-rating-block')];
     const expected=document.createElement('div');expected.innerHTML=glyphMarkup(nothingscorePhaseCopy(phase).glyph);
     results.push({theme,inDrawer,phase,rating,card:card.getBoundingClientRect().toJSON(),rowWidth:card.querySelector('.nsc-rating-blocks').getBoundingClientRect().width,boxes:buttons.map(button=>{
      const b=button.getBoundingClientRect(),svg=button.querySelector('svg'),g=svg.getBoundingClientRect(),style=getComputedStyle(svg);
      return{left:b.left,right:b.right,width:b.width,height:b.height,svgLeft:g.left,svgRight:g.right,svgWidth:g.width,svgHeight:g.height,opacity:style.opacity,filter:style.filter,stroke:style.stroke,markup:button.innerHTML.replace(/ style="opacity: [^"]+;"/,'')};
     }),expectedGlyph:expected.innerHTML,disabled:buttons.some(b=>b.disabled),filled:buttons.filter(b=>b.classList.contains('is-filled')).length,pressed:buttons.map(b=>b.getAttribute('aria-pressed')),aria:buttons.map(b=>b.getAttribute('aria-label')),heading:card.querySelector('.nsc-rating-phase').textContent,prompt:card.querySelector('.nsc-rating-prompt').textContent,promptHidden:card.querySelector('.nsc-rating-prompt').hidden,summary:card.querySelector('.nsc-peer-summary').textContent});
    }
    for(const rawAverage of [1,2.49,2.5,3.49,3.5,4.49,4.5,5]){const average=Math.round(rawAverage*10)/10,card=mount({phase:'heat',peerResults:{count:3,average,rawAverage,label:'Wrong legacy adjective'}},false);crowd.push({rawAverage,average,text:card.querySelector('.nsc-peer-summary').textContent});}
    return{results,crowd};
   });
   for(const s of samples.results){
    const copy=policy.phaseCopy(s.phase),labels=copy.labels,description=JSON.stringify({width,theme:s.theme,phase:s.phase,rating:s.rating,inDrawer:s.inDrawer});
    assert.equal(s.rowWidth,220,description);assert.equal(s.boxes.length,5,description);assert(s.boxes.every(b=>b.width>=44&&b.height>=44&&close(b.svgWidth,30)&&close(b.svgHeight,20)),description);
    assert(s.boxes.slice(1).every((b,i)=>close(b.left-s.boxes[i].right,0)&&close(b.svgLeft-s.boxes[i].svgRight,14)),description);assert(s.boxes.every(b=>b.left>=s.card.left&&b.right<=s.card.right),description);
    assert.equal(s.disabled,false,description);assert.equal(s.filled,s.rating,description);assert.deepEqual(s.pressed,labels.map((_,i)=>String(i+1===s.rating)),description);assert.deepEqual(s.aria,labels.map((label,i)=>`${i+1} out of 5: ${label}`),description);
    assert.equal(s.heading,copy.name+' · '+copy.detail,description);assert.equal(s.prompt,s.rating?labels[s.rating-1]:s.phase==='heat'?copy.tip:'',description);assert.equal(s.promptHidden,!s.rating&&s.phase!=='heat',description);
    assert.equal(s.summary,`3 Nothingers ${s.phase==='heat'?'expect':s.phase==='pulse'?'are rating this':'have rated this'} ${labels[2]} · 3.0/5`,description);
    for(const [i,b] of s.boxes.entries()){assert.equal(b.markup,s.expectedGlyph,description);assert.equal(Number(b.opacity),i<s.rating?1:.35,description);assert.equal(b.filter,'none',description);assert.notEqual(b.stroke,'none',description);}cases++;
   }
   for(const c of samples.crowd)assert.equal(c.text,`3 Nothingers expect ${policy.phaseCopy('heat').labels[Math.round(c.rawAverage)-1]} · ${c.average.toFixed(1)}/5`);
   let fail=false,release,delayed=false,saved={phase:'heat',currentUser:{}};const writes=[];
   await page.route('**/api/nothingscore**',async route=>{
    const body=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(body){writes.push(body);if(delayed)await new Promise(resolve=>release=resolve);if(!fail)saved={phase:body.phase,currentUser:{submissions:{[body.phase]:{rating:body.rating}}}};return route.fulfill({status:fail?500:200,contentType:'application/json',body:JSON.stringify(fail?{error:'QA save failure'}:{rating:body.rating,pointsAwarded:1})});}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({detail:saved,events:[],viewer:{signedIn:true}})});
   });
   await page.evaluate(()=>{
    const token='qa.'+btoa(JSON.stringify({sub:'qa-spectacle-owner'}))+'.local';sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:token,refreshToken:'qa-local-only',expiresAt:Date.now()+3600000}));serverPersistence.user={id:'qa-spectacle-owner'};
    window.mountSpectacleQA=snapshot=>{document.getElementById('spectacle-test')?.remove();const host=document.createElement('div');host.id='spectacle-test';host.className='event-card';host.style.cssText='padding:16px;position:relative;z-index:10000';document.body.appendChild(host);host.appendChild(buildInlineCrowdRating({id:'qa-spectacle-save',key:'f1',name:'Controlled rating fixture',startTimeUtc:'2026-10-19T12:00:00Z'},snapshot));};
   });
   const host=page.locator('#spectacle-test'),buttons=host.locator('.nsc-rating-block');
   for(const phase of ['heat','pulse','impact']){
    await page.evaluate(phase=>mountSpectacleQA({phase,currentUser:{contribution:{rating:2}}}),phase);delayed=true;release=undefined;
    await buttons.nth(3).click();await host.getByText('Saving…',{exact:true}).waitFor();assert.equal(await host.locator('.nsc-rating-prompt').textContent(),policy.phaseCopy(phase).labels[3]);assert.equal(await buttons.locator(':scope:disabled').count(),5);
    for(let attempt=0;attempt<100&&!release;attempt++)await page.waitForTimeout(10);assert.equal(typeof release,'function');delayed=false;release();await host.getByText('+1 points',{exact:true}).waitFor();assert.equal(await buttons.locator(':scope:disabled').count(),0);
    fail=true;await buttons.nth(4).click();await host.getByText(/QA save failure/).waitFor();fail=false;assert.equal(await host.locator('.nsc-rating-prompt').textContent(),policy.phaseCopy(phase).labels[3]);assert.equal(await host.locator('.is-filled').count(),4);
    await page.evaluate(phase=>mountSpectacleQA({phase,currentUser:{submissions:{[phase]:{rating:4}}}}),phase);assert.equal(await host.locator('.nsc-rating-prompt').textContent(),policy.phaseCopy(phase).labels[3]);
   }
   assert.deepEqual(writes,['heat','pulse','impact'].flatMap(phase=>[4,5].map(rating=>({action:phase==='pulse'?'pulse':'submit',eventId:'qa-spectacle-save',phase,rating,tags:[]}))));
   saved={phase:'heat',currentUser:{submissions:{heat:{rating:4}}}};
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating(),null,{timeout:60000});
   await page.evaluate(async()=>{const response=await serverSyncClient.nothingscoreRequest({eventId:'qa-spectacle-save'});const host=document.createElement('div');host.id='spectacle-test';document.body.appendChild(host);host.appendChild(buildInlineCrowdRating({id:'qa-spectacle-save'},response.detail));});
   assert.equal(await host.locator('.nsc-rating-prompt').textContent(),'Must-watch','Reload restores saved server rating');assert.equal(await host.locator('.is-filled').count(),4);
   await page.evaluate(()=>{serverSyncClient.clearSession();serverPersistence.user=null;openSettings=()=>{};const host=document.getElementById('spectacle-test');host.replaceChildren(buildInlineCrowdRating({id:'qa-spectacle-save'},{phase:'heat',currentUser:{contribution:{rating:2}}}));});
   await buttons.first().focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'2 out of 5: Promising');
   await buttons.nth(4).click();await host.getByText('Sign in to rate this fixture.',{exact:true}).waitFor();assert.equal(await host.locator('.nsc-rating-prompt').textContent(),'Promising');assert.equal(writes.length,6);
   if(width===390&&output)for(const theme of ['day','night']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await host.screenshot({path:path.join(output,`spectacle-${theme}.png`)});}
   assert.deepEqual(errors,[]);await context.close();console.log(`${width}px: phase labels/glyphs, geometry, crowd rounding, save/failure, reload and keyboard passed`);
  }
  console.log(JSON.stringify({browser:engine===webkit?'webkit':'chromium',presentationCases:cases,passed:true,scope:'Controlled native renderer/local mocked account writes; no provider or real-account proof'}));
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
