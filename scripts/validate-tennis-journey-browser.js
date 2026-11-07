'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 let server,base=process.env.QA_BASE_URL;
 if(!base){server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 try{for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
 try{const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,selectedSelectorEntityIds:['sport:nrl'],followedSports:['nrl'],showSpoilers:false})));
 await page.goto(base+'/?journey-fine-print=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof userPreferences==='object'&&!startupCoordinator.isHydrating());
 assert.equal(await page.locator('[data-results-fine-print]').count(),0);
 await page.evaluate(()=>openSettings({section:'about'}));const detail=page.locator('[data-results-fine-print]');await detail.waitFor();assert.equal(await detail.getAttribute('open'),null);
 await detail.locator('summary').click();assert.match(await detail.innerText(),/Avoid studying these cards/);assert.equal(await page.evaluate(()=>userPreferences.showSpoilers),false);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 console.log(JSON.stringify({engine,base,finePrintOnly:true,collapsedByDefault:true,resultsOffPreserved:true,widths:[320,390,768,1280]}));
 }finally{await browser.close();}}
 }finally{if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
