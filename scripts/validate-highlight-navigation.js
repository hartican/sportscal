'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const origin='https://nothingsport.test';
const fixtureId='rlwc-australia-new-zealand-2026';
const href=origin+'/api/fixtures?mode=highlight&ids='+fixtureId;
const shell='<html><body>Preparing your Feed…</body></html>';
function feedback(){
  let body;const headers={};
  require('../lib/youtube-top-result').unavailable({setHeader:(k,v)=>headers[k]=v,status(){return this;},end(value){body=value;}},503,{fixtureId});
  return new Response(body,{status:503,headers});
}
async function run(){
  for(const outcome of ['unavailable','not-found','success','redirect','offline']){
    const listeners={},writes=[],pending=[];
    class WorkerRequest extends Request{constructor(input,options){super(typeof input==='string'?new URL(input,origin):input,options);}}
    const cachedShell=new Response(shell,{headers:{'Content-Type':'text/html'}});
    const cache={match:async request=>new URL(typeof request==='string'?request:request.url,origin).pathname==='/index.html'?cachedShell.clone():undefined,put:async(key,response)=>writes.push({url:key.url,body:await response.text()})};
    const network=()=>{
      if(outcome==='offline')return Promise.reject(Error('offline'));
      if(outcome==='unavailable')return Promise.resolve(feedback());
      if(outcome==='not-found')return Promise.resolve(new Response('Waiting for a fixture update',{status:404}));
      if(outcome==='redirect')return Promise.resolve(Response.redirect('https://www.youtube.com/watch?v=abcdefghijk',302));
      return Promise.resolve(new Response('<html>Highlights feedback</html>',{headers:{'Content-Type':'text/html'}}));
    };
    const sandbox={URL,Request:WorkerRequest,Response,AbortController,setTimeout,clearTimeout,console,crypto:globalThis.crypto,fetch:network,caches:{open:async()=>cache,match:async()=>cachedShell.clone()},self:{location:{origin,href:origin+'/service-worker.js'},addEventListener:(type,listener)=>listeners[type]=listener}};
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../service-worker.js'),'utf8'),sandbox);
    let response;
    listeners.fetch({request:{method:'GET',url:href,mode:'navigate',headers:new Headers()},clientId:'',waitUntil:p=>pending.push(p),respondWith:p=>response=Promise.resolve(p)});
    let result;
    try{result=await response;}catch(error){assert.equal(outcome,'offline');assert.equal(error.message,'offline');}
    await Promise.all(pending);
    if(result){
      const body=await result.text();assert(!body.includes('Preparing your Feed'),'Highlights '+outcome+' must never receive the Feed loading shell');
      assert.equal(result.status,{unavailable:503,'not-found':404,success:200,redirect:302}[outcome]);
      if(outcome==='unavailable')assert(body.includes('Back to fixture'));
      if(outcome==='redirect')assert.equal(result.headers.get('Location'),'https://www.youtube.com/watch?v=abcdefghijk');
    }
    assert.equal(writes.length,0,'Highlights '+outcome+' must never overwrite the installed Feed shell');
  }
  console.log('Highlights navigation preserves API responses and never returns or overwrites the Feed shell (5 cases).');
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run};
