'use strict';
// Test-only observations. Never supplies a response, retries, or decides acceptance.
const assert=require('node:assert/strict');
const version=v=>typeof v==='string'&&/^\d{1,16}$/.test(v)?v:null;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:null;
const lifecycle=v=>['absent','installing','installed','activating','activated','redundant'].includes(v)?v:'unavailable';
const boolean=v=>typeof v==='boolean'?v:null;
async function pageSnapshot(expected){
 const registration=await navigator.serviceWorker.getRegistration(),controller=navigator.serviceWorker.controller;
 const workerState=worker=>worker?.state||'absent',owned=new URL('/service-worker.js',location.href).href;
 const key='nothingsport-shell-v'+expected.version,keys=await caches.keys(),cachePresent=keys.includes(key);
 const response=cachePresent?await(await caches.open(key)).match('/index.html'):null;
 let indexVersion=null,indexSha256=null,indexAvailable=false;
 if(response?.ok){
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<=4194304){
   indexAvailable=true;indexVersion=new TextDecoder().decode(bytes).match(/name="app-shell-version" content="(\d{1,16})"/)?.[1]||null;
   indexSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
 }
 return{documentVersion:document.querySelector('meta[name="app-shell-version"]')?.content,online:navigator.onLine,
  controllerPresent:!!controller,controllerMatches:!!controller&&controller.scriptURL===owned,controllerState:workerState(controller),
  active:workerState(registration?.active),waiting:workerState(registration?.waiting),installing:workerState(registration?.installing),
  cachePresent,indexAvailable,indexVersion,indexSha256};
}
function sanitiseSnapshot(raw,expected){
 return{capture:'available',documentVersion:version(raw?.documentVersion),online:boolean(raw?.online),controllerPresent:boolean(raw?.controllerPresent),
  controllerMatches:boolean(raw?.controllerMatches),controllerState:lifecycle(raw?.controllerState),active:lifecycle(raw?.active),waiting:lifecycle(raw?.waiting),installing:lifecycle(raw?.installing),
  cachePresent:boolean(raw?.cachePresent),indexAvailable:boolean(raw?.indexAvailable),indexVersion:version(raw?.indexVersion),indexSha256:digest(raw?.indexSha256),
  indexMatchesSource:raw?.indexAvailable===true?version(raw.indexVersion)===expected.version&&digest(raw.indexSha256)===expected.indexSha256:null};
}
function create({origin,expectedVersion,expectedIndexSha256,log=console.log,schedule=setTimeout,cancel=clearTimeout}){
 assert.equal(new URL(origin).origin,origin);assert(version(expectedVersion)&&digest(expectedIndexSha256));
 const expected=Object.freeze({version:expectedVersion,indexSha256:expectedIndexSha256}),events=[],listeners=[],requests=new WeakMap();
 let armed=false,page,serial=0,requestSerial=0,dropped=0,unavailable=0,before={capture:'not_attempted'};
 const cutoffs={total:0,root:0,index:0,other:0};
 const snapshot=outcome=>({format:'installed-navigation-observation.v1',outcome,expected,before,events:events.slice(),dropped,unavailable,cutoffs:{...cutoffs},
  limitations:'Test-only before-reload cache binding and exposed engine events; absent events do not prove service-worker bypass or cause. Not release or device acceptance.'});
 const emit=outcome=>{try{log('Installed navigation observation '+JSON.stringify(snapshot(outcome)));}catch{unavailable++;}};
 const record=value=>{if(!armed)return;if(events.length>=16){dropped=Math.min(999,dropped+1);return;}events.push({order:++serial,...value});};
 function ownedDocument(url){try{const u=new URL(url,origin);if(u.origin!==origin)return null;return u.pathname==='/'?'root':u.pathname==='/index.html'?'index':'other_owned_document';}catch{return null;}}
 function documentRequest(request){
  if(!request.isNavigationRequest()||request.frame()!==page.mainFrame())return null;
  const target=ownedDocument(request.url());if(!target)return null;
  if(!requests.has(request))requests.set(request,++requestSerial);return{request:requests.get(request),target};
 }
 function listen(name,handler){const wrapped=value=>{try{handler(value);}catch{unavailable=Math.min(999,unavailable+1);}};try{page.on(name,wrapped);listeners.push([name,wrapped]);}catch{unavailable=Math.min(999,unavailable+1);}}
 function begin(currentPage){
  assert(!armed&&!page,'One observation per existing transport reload');page=currentPage;armed=true;
  listen('request',r=>{const doc=documentRequest(r);if(doc)record({kind:'document_request',...doc});});
  listen('requestfailed',r=>{const doc=documentRequest(r);if(doc){const text=r.failure()?.errorText;record({kind:'document_failure',...doc,error:typeof text==='string'&&/cancelled|canceled/i.test(text)?'cancelled':typeof text==='string'&&/internal error/i.test(text)?'internal_error':'other'});}});
  listen('response',r=>{const doc=documentRequest(r.request());if(doc){const status=r.status();let worker=null;try{if(typeof r.fromServiceWorker==='function')worker=boolean(r.fromServiceWorker());}catch{unavailable=Math.min(999,unavailable+1);}record({kind:'document_response',...doc,status:Number.isInteger(status)&&status>=100&&status<=599?status:null,fromServiceWorker:worker});}});
  listen('framenavigated',frame=>{if(frame===page.mainFrame()){const target=ownedDocument(frame.url());if(target)record({kind:'document_commit',target});}});
 }
 function serverCutoff(request){
  try{if(!armed)return;const target=ownedDocument(request.url);if(!target)return;cutoffs.total=Math.min(999,cutoffs.total+1);
   const bucket=target==='other_owned_document'?'other':target;cutoffs[bucket]=Math.min(999,cutoffs[bucket]+1);
   if(bucket!=='other')record({kind:'owned_server_cutoff',target});
  }catch{unavailable=Math.min(999,unavailable+1);}
 }
 async function beforeReload(){
  let timer;
  try{const raw=await Promise.race([page.evaluate(pageSnapshot,expected),new Promise((_,reject)=>{timer=schedule(()=>reject(Error('Observation expired')),1000);})]);before=sanitiseSnapshot(raw,expected);}
  catch{before={capture:'unavailable'};}
  finally{try{if(timer!==undefined)cancel(timer);}catch{before={capture:'unavailable'};}}
  emit('before_reload');
 }
 function detach(){for(const[name,handler]of listeners){try{page.off(name,handler);}catch{unavailable=Math.min(999,unavailable+1);}}armed=false;}
 async function reload(operation){
  try{const result=await operation();emit('reload_returned');return result;}
  catch(error){let outcome='original_reload_failure';try{if(typeof error?.message==='string'&&error.message.includes('WebKit encountered an internal error'))outcome='original_webkit_internal_error';}catch{}emit(outcome);throw error;}
  finally{detach();}
 }
 return{begin,beforeReload,reload,serverCutoff,snapshot};
}
module.exports={create,pageSnapshot,sanitiseSnapshot};
