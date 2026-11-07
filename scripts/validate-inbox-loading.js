'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleUrl='/assets/js/notifications-inbox.js?v=552',moduleBytes=fs.readFileSync(path.join(root,'assets/js/notifications-inbox.js'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const loader=html.slice(html.indexOf('function loadDeferredScript(url){'),html.indexOf('async function loadFootballDirectoryModule(){'));
const start=html.search(/(?:let|const) notificationsInbox[=,;]/),initializer=html.slice(start,html.indexOf("if(new URLSearchParams(location.search).has('impactRequest')",start));
const harness=`<!doctype html><button id="notificationsBtn" aria-label="Notifications" aria-expanded="false">Notifications</button><span id="notificationCount" hidden></span><p id="toast" role="status"></p><button id="rest">App works</button><script>
window.__account='account-a';window.__requests=[];window.__idle=[];
window.requestIdleCallback=callback=>{__idle.push(callback);return __idle.length;};
const serverSyncClient={sessionSubject:()=>__account,inboxRequest:async(query,seen)=>{__requests.push({query,seen,account:__account});return {items:[],unreadCount:0,nextCursor:null};}};
const userPreferences={showSpoilers:false};function openNotificationDestination(){}function closeNotificationDestination(){}function openSettings(){}
function showToast(message){document.getElementById('toast').textContent=message;}
document.getElementById('rest').onclick=()=>document.getElementById('rest').textContent='Still works';
${loader}\n${initializer}</script>`;

async function main(){
 assert(!/<script[^>]+src="assets\/js\/notifications-inbox\.js/.test(html),'Inbox must not block startup parsing');
 assert(initializer.includes('loadDeferredScript('),'Exercise the real lazy initializer, not a test substitute');
 const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 assert(worker.includes('"'+moduleUrl+'"'),'Lazy Inbox retains its exact installed-cache URL');
 assert(worker.includes('"/assets/styles/notifications-inbox.css?v=280"'),'Inbox CSS remains available offline');
 // Keep the original empty-list regression against the unchanged real module.
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const server=http.createServer((request,response)=>{
  const pathname=new URL(request.url,'http://local').pathname;
  if(pathname==='/__inbox-loading-test'){response.setHeader('Content-Type','text/html');response.end(harness);return;}
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}response.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');response.end(bytes);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const cases=[];
 try{
  const empty=await browser.newPage();await empty.setContent('<button id="notificationsBtn"></button><span id="notificationCount"></span>');await empty.addScriptTag({path:path.join(root,'assets/js/notifications-inbox.js')});
  const text=await empty.evaluate(async()=>{const inbox=NOTHINGSPORTS_INBOX.create({request:async()=>({items:[],unreadCount:0,nextCursor:null}),owner:()=> 'account',spoilers:()=>false,navigate:async()=>{},closeDestination(){},signIn(){}});inbox.show(false);await new Promise(resolve=>setTimeout(resolve,30));return document.getElementById('notificationsInbox').textContent;});
  assert(!text.includes('Loading notifications'),text);assert(text.includes('caught up'),text);await empty.close();
  for(const mode of ['idle','slow','failed','account-switch','account-round-trip']){
   const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   let requests=0,release;const pending=new Promise(resolve=>release=resolve);
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
    if(url.pathname==='/assets/js/notifications-inbox.js'){
     requests++;assert.equal(url.pathname+url.search,moduleUrl);
     if(mode==='failed'&&requests===1)return route.abort('failed');
     if(['slow','account-switch','account-round-trip'].includes(mode))await pending;
     return route.fulfill({contentType:'text/javascript',body:moduleBytes});
    }
    return route.continue();
   });
   await page.goto(origin+'/__inbox-loading-test');assert.equal(requests,0);assert.equal(await page.locator('#notificationsInbox').count(),0);
   if(mode==='idle'){
    await page.evaluate(()=>__idle.forEach(callback=>callback()));await page.waitForFunction(()=>Boolean(notificationsInbox));
    assert.equal(await page.locator('#notificationsInbox').evaluate(dialog=>dialog.open),false);await page.locator('#notificationsBtn').click();
   }else{
    await page.locator('#notificationsBtn').click();
    if(mode==='failed'){
     await page.getByRole('status').filter({hasText:/Notifications.*unavailable|could not load/i}).waitFor();
     assert.equal(await page.locator('#notificationsBtn').getAttribute('aria-busy'),null);
     await page.locator('#rest').click();assert.equal(await page.locator('#rest').textContent(),'Still works');
     await page.evaluate(()=>__idle.forEach(callback=>callback()));assert.equal(requests,1,'Idle must not retry a failed tap automatically');
     await page.locator('#notificationsBtn').click();
    }else{
     await page.waitForFunction(()=>document.getElementById('notificationsBtn').getAttribute('aria-busy')==='true');
     assert.match(await page.getByRole('status').textContent(),/Loading notifications/i);
     await page.locator('#notificationsBtn').click();await page.evaluate(()=>__idle.forEach(callback=>callback()));assert.equal(requests,1,'Idle and repeated taps share one script load');
     if(mode.startsWith('account'))await page.evaluate(roundTrip=>{__account='account-b';dispatchEvent(new Event('ns-account-change'));if(roundTrip){__account='account-a';dispatchEvent(new Event('ns-account-change'));}},mode==='account-round-trip');
     release();
    }
   }
   await page.waitForFunction(()=>Boolean(notificationsInbox));
   if(mode.startsWith('account')){
    assert.equal(await page.locator('#notificationsInbox').evaluate(dialog=>dialog.open),false,'A queued gesture cannot cross an account change');
    await page.locator('#notificationsBtn').click();
   }
   await page.locator('#notificationsInbox[open]').waitFor();await page.getByText(/caught up/).waitFor();
   assert.equal(await page.locator('#notificationsInbox').count(),1,'Exactly one Inbox factory instance');
   assert.equal(requests,mode==='failed'?2:1);assert.deepEqual(errors,[]);cases.push(mode);await context.close();
  }
  // Real required-shell installation, then first module execution while offline.
  // This does not substitute for the separate installed-app upgrade suite.
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/__inbox-loading-test');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  const cached=await page.evaluate(async url=>{const response=await caches.match(url);return response?Array.from(new Uint8Array(await response.arrayBuffer())):null;},moduleUrl);
  assert(cached,'Actual worker installation precaches the deferred Inbox');assert.equal(hash(Buffer.from(cached)),hash(moduleBytes));
  assert.equal(await page.evaluate(()=>typeof NOTHINGSPORTS_INBOX),'undefined','Offline test starts before module execution');
  await context.setOffline(true);await page.locator('#notificationsBtn').click();await page.locator('#notificationsInbox[open]').waitFor();
  assert.match(await page.locator('#notificationsInbox').textContent(),/Notifications/);assert.equal(await page.locator('#notificationsInbox').count(),1);assert.deepEqual(errors,[]);cases.push('installed-offline-first-tap');await context.close();
  console.log(JSON.stringify({cases,emptyInboxSettles:true,actualModuleSha256:hash(moduleBytes),requiredCacheRetained:true}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
