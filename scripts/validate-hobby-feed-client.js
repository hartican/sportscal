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
  const signedOut=client.loadFeed().catch(e=>e);await tick();client.clearSession();resolvers.shift()(result({events:['alice']}));assert.equal((await signedOut).code,'feed_request_superseded');
  console.log('Feed client: one overlapping request, conditional 304, invalidation, stale response rejection, retry and sign-out isolation passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
