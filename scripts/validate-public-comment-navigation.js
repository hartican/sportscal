'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
 const source=fs.readFileSync('assets/js/notification-navigation.js','utf8');
 let prior=0,opened=[],release,epoch=0;
 const location=new URL('https://ns.invalid/?discussion=fixture%3Aone'),context={URL,URLSearchParams,Promise,location,navigator:{},feedCardSlots:new Map(),pendingNotificationEventId:'',focusPendingNotificationEvent:()=>{prior++;return false;},serverSyncClient:{sessionSubject:()=> 'owner',accountSnapshot:()=>({generation:epoch})},history:{state:null,replaceState(state,_,url){location.href=new URL(url,location).href;}},showToast:()=>{},loadDeferredScript:async()=>{},NOTHINGSPORTS_PUBLIC_COMMENTS_UI:{openFixture:async id=>opened.push(id)}};
 vm.createContext(context);vm.runInContext(source,context);await tick();assert.equal(prior,0,'cold discussion waits without generic friend-fixture fallback');assert(location.search.includes('discussion='));
 context.feedCardSlots.set('one',{});context.focusPendingNotificationEvent();await tick();assert.deepEqual(opened,['fixture:one']);assert.equal(prior,0);assert.equal(location.search,'');
 location.search='?discussion=fixture%3Atwo';context.loadDeferredScript=()=>new Promise(resolve=>release=resolve);context.focusPendingNotificationEvent();epoch++;release();await tick();assert.deepEqual(opened,['fixture:one'],'account lifetime change fences deferred navigation');
 context.focusPendingNotificationEvent();assert.equal(prior,1,'ordinary navigation retains its existing owner');
 const listeners={},messages=[],jobs=[],stores=new Map();
 const caches={async open(name){if(!stores.has(name)){const entries=new Map();stores.set(name,{match:async key=>entries.get(key.url)?.clone(),put:async(key,value)=>entries.set(key.url,value),delete:async key=>entries.delete(key.url),keys:async()=>[...entries.keys()].map(url=>new Request(url))});}return stores.get(name);}};
 const client={id:'installed-window',type:'window',url:'https://ns.invalid/',navigate:async()=>{throw Error('platform navigation unavailable');},focus:async()=>client,postMessage:data=>messages.push(data)};
 const worker={URL,URLSearchParams,Response,Request,Promise,Date,crypto,caches,console,setTimeout,clearTimeout,self:{location:new URL('https://ns.invalid/service-worker.js'),addEventListener(type,handler){listeners[type]=handler;},clients:{matchAll:async()=>[client]},registration:{}}};vm.createContext(worker);vm.runInContext(fs.readFileSync('service-worker.js','utf8'),worker);
 listeners.notificationclick({notification:{close(){},data:{kind:'public-comment',url:'/?discussion=fixture%3Aone'}},waitUntil:p=>jobs.push(p)});await Promise.all(jobs);assert.equal(messages.length,1);assert.equal(new URL(messages[0].url).searchParams.get('discussion'),'fixture:one');assert(!new URL(messages[0].url).searchParams.has('event'),'cold worker handoff never invokes the generic fixture fallback');
 console.log('Public comment navigation: cold/deferred Feed handoff, account lifetime fence, ordinary route preservation and actual worker failed-navigation recovery passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
