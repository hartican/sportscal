'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
(async()=>{
 const cached=new Response('<meta name="app-shell-version" content="313">',{headers:{'content-type':'text/html'}});
 let mode='error',timeoutMs;
 const context={self:{addEventListener(){},location:{origin:'https://test.invalid'}},URL,Request,Response,AbortController,Map,Set,setTimeout:(fn,ms)=>{timeoutMs=ms;return setTimeout(fn,5);},clearTimeout,fetch:(_r,options)=>mode==='error'?Promise.resolve(new Response('Unavailable',{status:503})):new Promise((_resolve,reject)=>options?.signal.addEventListener('abort',()=>reject(Error('aborted')))),caches:{open:async()=>({match:async()=>mode==='missing'?undefined:cached.clone(),put:async()=>{}}),match:async()=>cached.clone()}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('service-worker.js','utf8'),context);
 const event={waitUntil(){}};
 let response=await context.networkFirst({url:'https://test.invalid/',mode:'navigate'},event);assert.equal(response.status,200,'HTTP 503 must recover the verified cached shell');
 mode='hang';response=await Promise.race([context.networkFirst({url:'https://test.invalid/',mode:'navigate'},event),new Promise((_,reject)=>setTimeout(()=>reject(Error('Navigation stalled instead of falling back')),100))]);assert.equal(timeoutMs,8000);assert((await response.text()).includes('app-shell-version'));
 mode='missing';response=await context.networkFirst({url:'https://test.invalid/data/feed/page.json',mode:'cors'},event);assert.equal(response.status,503,'missing JSON must not return HTML');
 // A successful HTTP header is not a completed cache observation. The body
 // can stall while the page has already received a last-good cached response.
 const retained=new Response('{"lastGood":true}');let bodyAborted=false,writes=0;
 context.caches.open=async()=>({match:async()=>retained.clone(),put:async(_key,value)=>{await value.text();writes++;}});
 context.fetch=(_request,options)=>Promise.resolve(new Response(new ReadableStream({start(stream){stream.enqueue(new TextEncoder().encode('{"partial":'));options.signal.addEventListener('abort',()=>{bodyAborted=true;stream.error(Error('deadline'));});}})));
 let lifetime;
 response=await context.staleWhileRevalidate(new Request('https://test.invalid/data/canonical/probe.json'),{waitUntil(value){lifetime=value;}});
 assert.equal(await response.text(),'{"lastGood":true}');assert(lifetime,'Lifetime must be registered before returning cached data');
 await Promise.race([lifetime,new Promise((_,reject)=>setTimeout(()=>reject(Error('Body kept the old worker alive')),100))]);
 assert.equal(timeoutMs,8000);assert(bodyAborted);assert.equal(writes,0,'Partial bodies must not overwrite the retained cache');
 await validateUpgradeManifest();
 console.log('Worker recovers HTTP/stalled navigation and bounds cached body refresh; partial JSON never replaces last-good data.');
})().catch(e=>{console.error(e);process.exitCode=1});

async function validateUpgradeManifest(){
 const source=fs.readFileSync('service-worker.js','utf8'),current=source.match(/const CACHE_NAME = ["']([^"']+)/)[1],manifest='/data/code-inspector/manifest.json';
 for(const preexisting of [false,true]){
  const stores=new Map([['nothingsport-shell-v573',new Map([[manifest,new Response('older')]])],['nothingsport-shell-v574',new Map([[manifest,new Response('last-good')],['/data/marquee-candidates.v1.json',new Response('private source')]])],[current,new Map(preexisting?[[manifest,new Response('current')]]:[])],['unrelated-cache',new Map()]]),handlers={},writes=[];
  const context={self:{addEventListener(name,handler){handlers[name]=handler;},location:{origin:'https://test.invalid'},clients:{claim:async()=>{},matchAll:async()=>[]}},URL,Request,Response,AbortController,Map,Set,setTimeout,clearTimeout,fetch:()=>{throw Error('An upgrade must not download optional data');},caches:{keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async cacheName=>({match:async key=>stores.get(cacheName)?.get(key)?.clone(),put:async(key,response)=>{writes.push(key);stores.get(cacheName).set(key,response.clone());}})}};
  vm.runInNewContext(source,context);let lifetime;handlers.activate({waitUntil(value){lifetime=value;}});await lifetime;
  assert.equal(await stores.get(current).get(manifest)?.text(),preexisting?'current':'last-good','Upgrade retains the newest previously used public Schedule index without replacing current data');
  assert.deepEqual(writes,preexisting?[]:[manifest]);assert(!stores.has('nothingsport-shell-v574'));assert(stores.has('unrelated-cache'));assert.equal(stores.get(current).size,1,'No private source, old executable or extra optional data crosses caches');
 }
}
