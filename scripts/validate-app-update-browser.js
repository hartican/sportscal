'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8887';
(async()=>{
 const browser=await (process.env.PWA_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
 try{
  for(const width of [390,834,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,feedCompact:true,followedSports:['nrl','tennis']})));
   if(width===390)await page.addInitScript(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=(input,options)=>String(input)==='/api/pwa-write-probe'?new Promise(resolve=>{window.__releaseWrite=()=>resolve(new Response(JSON.stringify({saved:true}),{headers:{'content-type':'application/json'}}));}):originalFetch(input,options);
    const register=navigator.serviceWorker.register.bind(navigator.serviceWorker);let failed=false;
    navigator.serviceWorker.register=(...args)=>{if(!failed){failed=true;return Promise.reject(new Error('Simulated transient registration failure'));}return register(...args);};
   });
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof startupCoordinator!=='undefined'&&!startupCoordinator.isHydrating());
   await page.locator('#settingsBtn').click();
   const button=page.getByRole('button',{name:'Check for updates',exact:true});
   await button.scrollIntoViewIfNeeded();await button.click();
   await page.waitForFunction(()=>document.querySelector('#appVersionStatus')?.textContent.includes('Up to date.'),null,{timeout:45000});
   const version=await page.locator('meta[name="app-shell-version"]').getAttribute('content');
   assert((await page.locator('#appVersionStatus').innerText()).includes('Version '+version));
   const box=await button.boundingBox();assert(box.height>=44&&box.width>=44,'Update button meets the touch target');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
   await page.screenshot({path:'/tmp/pwa-update-settings-'+width+'.png'});
   await context.setOffline(true);await button.click();
   assert((await page.locator('#appVersionStatus').innerText()).includes('Offline.'));
   await context.setOffline(false);
   if(width===390 && base.startsWith('http://127.0.0.1:')){
    // The injected transport below the real update wrapper holds this response
    // until explicitly released. No account request leaves the browser.
    await page.evaluate(()=>{
     window.__updateReloads=0;NOTHINGSPORTS_APP_UPDATE.configure(()=>{window.__updateReloads++;});
     const input=document.createElement('input');input.id='update-draft-probe';input.value='Unsent draft';document.body.appendChild(input);input.focus();
     window.__writeProbe=fetch('/api/pwa-write-probe',{method:'POST',body:'test'}).then(r=>r.json());
     const channel=new MessageChannel();navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{type:'nothingsport-shell-probe',version:'999'},ports:[channel.port2]}));
    });
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__updateReloads),0,'An active write/edit defers reload');
    await page.evaluate(()=>document.getElementById('update-draft-probe').blur());
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__updateReloads),0,'Reload waits for the write response');
    await page.evaluate(()=>window.__releaseWrite());
    await page.evaluate(()=>window.__writeProbe);
    await page.waitForFunction(()=>window.__updateReloads===1);await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>window.__updateReloads),1,'A completed save causes one reload only');
   }
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,version,settingsConfirmedCurrent:true,offlineStatus:true}));await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
