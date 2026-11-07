'use strict';
// Synthetic tool regression, not app/offline or physical-device acceptance.
// https://github.com/microsoft/playwright/pull/42894
const assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {create}=require('./lib/installed-test-network');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PWA_BROWSER||'webkit';
assert(['chromium','webkit'].includes(engine));
const html='<!doctype html><meta name="app-shell-version" content="1"><h1>Synthetic offline fallback</h1>';
const expected={version:'1',indexSha256:crypto.createHash('sha256').update(html).digest('hex')};
const modes={literal:'new Response('+JSON.stringify(html)+', {headers:{"content-type":"text/html"}})',cache:'caches.match("/index.html")',fallback:'fetch(event.request).catch(()=>caches.match("/index.html"))'};
const worker=mode=>`self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open('nothingsport-shell-v1');await cache.add('/index.html');await self.skipWaiting();})()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(${modes[mode]});});`;
async function main(){
 const isolation=create(),rows=[];let browser,originalError,mode='literal',origin;
 const server=http.createServer((req,res)=>{
  if(isolation.handleRequest(req))return;
  if(isolation.preflightDocument(req,res))return;
  const name=new URL(req.url,origin).pathname;
  res.writeHead(200,{'content-type':name==='/service-worker.js'?'text/javascript':'text/html','cache-control':'no-store'});
  res.end(name==='/service-worker.js'?worker(mode):html);
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  isolation.setOrigin(origin);isolation.attachServer(server);
  browser=await pw[engine].launch({headless:true,...isolation.launchOptions()});
  await isolation.preflight(browser,expected);
  for(mode of Object.keys(modes)){
   const context=await browser.newContext({serviceWorkers:'allow'});let caseError,stage='setup';
   try{
    context.setDefaultTimeout(10000);await isolation.attachContext(context);const page=await context.newPage();
    await page.goto(origin);await page.evaluate(async()=>{await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    assert(await page.evaluate(async()=>Boolean(await caches.match('/index.html'))));
    stage='offline_existing_page';await context.setOffline(true);
    const offline=await page.goto(origin+'/offline-target');assert.equal(offline.status(),200);assert.equal(offline.fromServiceWorker(),true);assert.equal(await page.locator('h1').textContent(),'Synthetic offline fallback');assert.equal(await page.evaluate(()=>navigator.onLine),false);
    stage='offline_new_page';const reopened=await context.newPage();const reopenedResponse=await reopened.goto(origin+'/offline-reopened');assert.equal(reopenedResponse.status(),200);assert.equal(reopenedResponse.fromServiceWorker(),true);assert.equal(await reopened.locator('h1').textContent(),'Synthetic offline fallback');assert.equal(await reopened.evaluate(()=>navigator.onLine),false);
    stage='restored_online';await context.setOffline(false);assert.equal(await page.evaluate(()=>navigator.onLine),true);assert.equal(await page.evaluate(()=>fetch('/online-check').then(r=>r.text())),html);
   }catch(error){caseError=error;}
   finally{try{await context.close();}catch(error){caseError ||= error;}}
   rows.push({mode,passed:!caseError,stage,error:caseError?(/WebKit encountered an internal error/.test(String(caseError.message))?'webkit_internal_error':'other_failure'):null});
  }
  isolation.assertIsolated();assert(rows.every(row=>row.passed),'Synthetic offline emulation regression failed');
 }catch(error){originalError=error;}
 finally{
  try{await isolation.close(browser,server,originalError);}catch(error){originalError ||= error;}
  console.log(JSON.stringify({format:'installed-offline-emulation.v1',engine,playwright:require((process.env.PLAYWRIGHT_MODULE||'playwright')+'/package.json').version,passed:!originalError,cases:rows,network:isolation.snapshot(),scope:'Synthetic cached/literal service-worker responses, original and reopened pages, restored online state; no app, account, hosted or physical-device acceptance',retries:0}));
 }
 if(originalError)throw Error('Synthetic offline emulation regression failed');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
