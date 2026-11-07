'use strict';
// Exercise real fetch/body/cache lifetimes in Chromium. A headers-only mock
// cannot reproduce an installed worker holding its successor in waiting.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'app-version.json'))).version;
const next=String(Number(version)+1);
async function scenario({cached,holdBody,upgrade}){
 let browser,phase='current',pendingResponse,requests=0,connectionClosed=false;
 const route='/data/canonical/worker-deadline-probe.json';
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1);
  if(name==='worker-deadline-probe.html'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><title>Worker deadline regression</title></html>');return;}
  if('/'+name===route){
   requests++;pendingResponse=res;res.on('close',()=>{connectionClosed=true;});
   if(holdBody){res.writeHead(200,{'content-type':'application/json'});res.write('{"partial":');}
   return;
  }
  const file=path.join(root,name);
  if(name.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let bytes=fs.readFileSync(file);
  if(name==='service-worker.js'&&phase==='next')bytes=Buffer.from(bytes.toString().replace('nothingsport-shell-v'+version,'nothingsport-shell-v'+next).replace('const SHELL_VERSION = "'+version+'"','const SHELL_VERSION = "'+next+'"'));
  res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/json','cache-control':'no-store'});res.end(bytes);
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  await page.goto(origin+'/worker-deadline-probe.html');
  await page.evaluate(()=>navigator.serviceWorker.register('/service-worker.js'));
  await page.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:30000});
  if(cached)await page.evaluate(async({url,version})=>{const cache=await caches.open('nothingsport-shell-v'+version);await cache.put(url,new Response('{"lastGood":true}',{headers:{'content-type':'application/json'}}));},{url:origin+route,version});
  const start=Date.now();
  const fetched=page.evaluate(async url=>{const response=await fetch(url);return {status:response.status,body:await response.text()};},origin+route);
  if(cached)assert.deepEqual(await fetched,{status:200,body:'{"lastGood":true}'});
  const requestDeadline=Date.now()+3000;
  while(!requests&&Date.now()<requestDeadline)await new Promise(r=>setTimeout(r,20));
  assert.equal(requests,1,'One background request, without a retry');
  if(upgrade){phase='next';await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});}
  const deadline=start+14000;
  while(!connectionClosed&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
  assert(connectionClosed,'The worker must abort the stalled headers/body without waiting for server release');
  assert(Date.now()-start<14000,'The eight-second deadline includes the complete response body');
  if(upgrade){
   await page.waitForFunction(async expected=>{
    const reg=await navigator.serviceWorker.getRegistration();
    if(reg.waiting||reg.active?.state!=='activated')return false;
    return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve(false),500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data.version===expected);};reg.active.postMessage({type:'nothingsport-worker-version'},[channel.port2]);});
   },next,{timeout:5000});
  }else if(cached){
   assert.equal(await page.evaluate(async({url,version})=>{const cache=await caches.open('nothingsport-shell-v'+version);return (await cache.match(url)).text();},{url:origin+route,version}),'{"lastGood":true}');
  }else assert.deepEqual(await fetched,{status:503,body:'Temporarily unavailable'});
  assert.equal(requests,1,'Aborting must not silently retry');
  return {cached,holdBody,upgrade,elapsedMs:Date.now()-start,requests,serverReleaseRequired:false};
 }finally{pendingResponse?.destroy();await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
(async()=>{
 const results=[];
 for(const config of [{cached:true,holdBody:true,upgrade:true},{cached:true,holdBody:true,upgrade:false},{cached:false,holdBody:false,upgrade:false}])results.push(await scenario(config));
 console.log(JSON.stringify({version,next,results,lastGoodPreserved:true,partialBodyNotPublished:true,waitingWorkerUnblocked:true},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
