#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const sync=require('../config/server-sync');
const jwt=id=>`header.${Buffer.from(JSON.stringify({sub:id})).toString('base64url')}.signature`;
const values=new Map([[sync.SESSION_STORAGE_KEY,JSON.stringify({accessToken:jwt('alice'),refreshToken:'refresh',expiresAt:Date.now()+3600000})]]);
const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
let requests=[],resolvers=[];
const client=sync.createClient({storage,persistentStorage:{getItem:()=>null},fetchImpl:async(url,options)=>{requests.push({url,options});return new Promise(resolve=>resolvers.push(resolve));}});
const result=(body,status=200)=>({ok:status===200,status,headers:{get:()=> '"etag"'},json:async()=>body});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
  const a=client.loadFeed(),b=client.loadFeed();await tick();assert.equal(requests.length,1);
  resolvers.shift()(result({events:[1]}));assert.deepEqual(await a,await b);
  const c=client.loadFeed();await tick();assert.equal(requests[1].options.headers['If-None-Match'],'"etag"');resolvers.shift()(result(null,304));assert.deepEqual(await c,{events:[1]});
  const old=client.loadFeed().catch(e=>e);await tick();client.invalidateFeed();resolvers.shift()(result({events:['old']}));assert.equal((await old).code,'feed_request_superseded');
  const fresh=client.loadFeed();await tick();assert.equal(requests.at(-1).options.headers['If-None-Match'],undefined);resolvers.shift()(result({events:['new']}));assert.deepEqual(await fresh,{events:['new']});
  const failed=client.loadFeed().catch(e=>e);await tick();resolvers.shift()(result({error:'unavailable'},503));assert.equal((await failed).status,503);
  const retry=client.loadFeed();await tick();resolvers.shift()(result({events:['retry']}));await retry;
  const malformed=client.loadFeed();await tick();const requestCount=requests.length;
  resolvers.shift()({...result(null),headers:{get:()=> '"malformed"'},json:async()=>{throw Error('PRIVATE_BODY_READ');}});
  await assert.rejects(malformed,error=>error.code==='server_response_invalid'&&!error.message.includes('PRIVATE_'),'a failed successful-response body is not an empty Feed');
  assert.equal(requests.length,requestCount,'body failure never starts an automatic retry');
  const unavailable=client.loadFeed();await tick();
  resolvers.shift()({...result(null,503),json:async()=>{throw Error('PRIVATE_ERROR_PAGE');}});
  await assert.rejects(unavailable,error=>error.status===503&&error.code==='server_sync_request_failed'&&!error.message.includes('PRIVATE_'),'a non-JSON error page preserves its HTTP failure');
  const retained=client.loadFeed();await tick();assert.equal(requests.at(-1).options.headers['If-None-Match'],'"etag"','failed body cannot replace last-good ETag/payload');
  resolvers.shift()(result(null,304));assert.deepEqual(await retained,{events:['retry']});
  let abortedRequests=0;
  const deadlineStorage={getItem:key=>key===sync.SESSION_STORAGE_KEY?JSON.stringify({accessToken:jwt('alice'),refreshToken:'refresh',expiresAt:Date.now()+3600000}):null,setItem(){},removeItem(){}};
  const deadlineClient=sync.createClient({storage:deadlineStorage,persistentStorage:{getItem:()=>null},requestTimeoutMs:10,fetchImpl:async(_url,options)=>{
    abortedRequests++;return {...result(null),json:()=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('PRIVATE_BODY_ABORT')),{once:true}))};
  }});
  await assert.rejects(deadlineClient.loadFeed(),error=>error.code==='request_timeout'&&!error.message.includes('PRIVATE_'),'the existing whole-response deadline remains an honest timeout');
  assert.equal(abortedRequests,1);
  for(const phase of ['before-fetch','during-body']){
    const stop=new AbortController(),reason=Error('CONSTRUCTED_CALLER_ABORT');let calls=0,bodyStarted;
    const ready=new Promise(resolve=>{bodyStarted=resolve;});
    const cancelledClient=sync.createClient({storage:deadlineStorage,persistentStorage:{getItem:()=>null},fetchImpl:async(_url,options)=>{
      calls++;if(options.signal.aborted)throw options.signal.reason;
      return {...result(null),json:()=>new Promise((_resolve,reject)=>{bodyStarted();options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});})};
    }});
    if(phase==='before-fetch')stop.abort(reason);
    const cancelled=cancelledClient.chatRequest({mode:'rooms'},null,{signal:stop.signal}).catch(error=>error);
    if(phase==='during-body'){await ready;stop.abort(reason);}
    assert.equal(await cancelled,reason,'caller cancellation retains its original reason: '+phase);assert.equal(calls,1);
  }
  const signedOut=client.loadFeed().catch(e=>e);await tick();client.clearSession();resolvers.shift()(result({events:['alice']}));assert.equal((await signedOut).code,'feed_request_superseded');
  console.log('Feed client: shared request, 304, invalidation, stale response, failed-body retention/deadline and sign-out isolation passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
