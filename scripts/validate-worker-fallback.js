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
 console.log('Worker recovers HTTP failure and stalled navigation; JSON never becomes cached HTML.');
})().catch(e=>{console.error(e);process.exitCode=1});
