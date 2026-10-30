#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),https=require('node:https');
const {EventEmitter}=require('node:events'),table=require('./refresh-premier-league-context');
const reader=require('./lib/epl-source-json'),zlib=require('node:zlib'),crypto=require('node:crypto');
async function fixedTableDeadline(){
 const get=https.get,set=global.setTimeout,clear=global.clearTimeout;
 let expired,request,pending;const timer={unref(){}};
 global.setTimeout=(fn,ms,...args)=>{if(ms===20000){expired=fn;return timer;}return set(fn,ms,...args);};
 global.clearTimeout=id=>{if(id!==timer)clear(id);};
 https.get=(_url,_options,callback)=>{
  request=new EventEmitter();request.setTimeout=()=>request;request.destroy=error=>{request.emit('error',error);return request;};
  queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=200;response.headers={};response.setEncoding=()=>response;response.destroy=()=>{};callback(response);response.emit('data',Buffer.from('{"tables":['));});return request;
 };
 try{pending=table.fetchJson(table.STANDINGS_URL);pending.catch(()=>{});await Promise.resolve();assert.equal(typeof expired,'function','An active table response needs the fixed existing20s full-body/decode deadline');expired();await assert.rejects(pending,/20-second deadline/);}
 finally{if(pending)request.destroy(Error('owned test cleanup'));https.get=get;global.setTimeout=set;global.clearTimeout=clear;}
}
const records=[];
async function check(name,fn){await fn();records.push({name,passed:true});}
async function response(body,{headers={},status=200,event='end',incomplete=false,cleanupThrows=false}={},run){
 const get=https.get;let calls=0,destroyed=0;
 https.get=(url,options,callback)=>{
  calls++;assert.equal(options.headers.Origin,'https://www.premierleague.com');assert(!options.headers.Authorization);
  const request=new EventEmitter();request.setTimeout=ms=>{assert.equal(ms,20000);return request;};request.destroy=()=>{destroyed++;if(cleanupThrows)throw Error('secondary request cleanup');return request;};
  queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=status;res.headers=headers;res.complete=incomplete?false:undefined;res.destroy=()=>{destroyed++;if(cleanupThrows)throw Error('secondary response cleanup');};callback(res);for(const chunk of Array.isArray(body)?body:[body])res.emit('data',Buffer.from(chunk));res.emit(event,event==='error'?Error('original response error'):undefined);});return request;
 };
 try{return await run(()=>calls,()=>destroyed);}finally{https.get=get;}
}
const request=(options={})=>reader.readJson(reader.FIXTURE_URLS[0],options);
async function main(){
 await check('fixed20s includes an active table body',fixedTableDeadline);
 await check('one original response, one observed body hash, no second request',()=>response(Buffer.from('{"ok":true}'),{},async calls=>{let receipt;assert.deepEqual(await request({onObservation:r=>{receipt=r;}}),{ok:true});assert.equal(calls(),1);assert.equal(receipt.sha256,crypto.createHash('sha256').update('{"ok":true}').digest('hex'));assert.equal(receipt.decodedBytes,11);assert(receipt.complete);}));
 await check('exact declared fixture byte budget accepted',()=>{const body=Buffer.from(JSON.stringify({x:'x'.repeat(reader.LIMITS.fixtures-8)}));assert.equal(body.length,reader.LIMITS.fixtures);return response(body,{},async()=>{assert.equal((await request()).x.length,reader.LIMITS.fixtures-8);});});
 await check('one byte over the fixture budget refused',()=>response(Buffer.alloc(reader.LIMITS.fixtures+1,32),{},async(calls,destroyed)=>{await assert.rejects(request,/wire-body byte budget/);assert.equal(calls(),1);assert(destroyed());}));
 await check('table has its smaller20-club byte budget',()=>response(Buffer.alloc(reader.LIMITS.table+1,32),{},async()=>{await assert.rejects(()=>table.fetchJson(table.STANDINGS_URL),/wire-body byte budget/);}));
 for(const[encoding,encode]of[['gzip',zlib.gzipSync],['deflate',zlib.deflateSync],['br',zlib.brotliCompressSync]])await check(encoding+' decoded inside original request deadline',()=>response(encode(Buffer.from('{"ok":true}')),{headers:{'content-encoding':encoding}},async calls=>{assert.deepEqual(await request(),{ok:true});assert.equal(calls(),1);}));
 await check('compressed oversized decoded body refused without another GET',()=>response(zlib.gzipSync(Buffer.from(JSON.stringify({x:'x'.repeat(reader.LIMITS.fixtures)}))),{headers:{'content-encoding':'gzip'}},async calls=>{await assert.rejects(request,/decoded-body byte budget/);assert.equal(calls(),1);}));
 await check('wire content-length mismatch refused',()=>response(Buffer.from('{}'),{headers:{'content-length':'99'}},async()=>{await assert.rejects(request,/ended before completion/);}));
 await check('incomplete response refused even when an end event arrives',()=>response(Buffer.from('{}'),{incomplete:true},async()=>{await assert.rejects(request,/ended before completion/);}));
 for(const event of['error','aborted','close'])await check(event+' before body completion refuses',()=>response(Buffer.from('{'),{event},async()=>{await assert.rejects(request,event==='error'?/original response error/:/ended before completion/);}));
 await check('non200 and redirects never become source success',async()=>{for(const status of[302,403,429,503])await response(Buffer.from('{}'),{status},async calls=>{await assert.rejects(request,new RegExp('returned '+status));assert.equal(calls(),1);});});
 await check('unknown encoding refuses',()=>response(Buffer.from('{}'),{headers:{'content-encoding':'unknown'}},async()=>{await assert.rejects(request,/unsupported content encoding/);}));
 await check('UTF8 split across chunks survives exactly',()=>{const b=Buffer.from('{"club":"A😀B"}');return response([b.subarray(0,12),b.subarray(12,14),b.subarray(14)],{},async()=>{assert.deepEqual(await request(),{club:'A😀B'});});});
 await check('invalid UTF8 and invalid JSON refuse',async()=>{await response(Buffer.from([255]),{},async()=>assert.rejects(request));await response(Buffer.from('{broken'),{},async()=>assert.rejects(request));});
 await check('post-JSON deadline rejects before returning data',async()=>{
  const perf=require('node:perf_hooks').performance,descriptor=Object.getOwnPropertyDescriptor(perf,'now'),parse=JSON.parse;let at=0;
  Object.defineProperty(perf,'now',{configurable:true,value:()=>at});JSON.parse=text=>{const value=parse(text);at=20001;return value;};
  try{await response(Buffer.from('{}'),{},async()=>assert.rejects(request,/20-second deadline/));}finally{JSON.parse=parse;if(descriptor)Object.defineProperty(perf,'now',descriptor);else delete perf.now;}
 });
 await check('undeclared resource rejects before transport',async()=>{const get=https.get;https.get=()=>assert.fail('No undeclared request');try{await assert.rejects(()=>reader.readJson('https://example.test/'),/declared five-resource scope/);}finally{https.get=get;}});
 await check('fallible observation sink preserves its original failure',()=>response(Buffer.from('{}'),{},async()=>{const original=Object.freeze(Error('first observation failure'));await assert.rejects(()=>request({onObservation:()=>{throw original;}}),e=>e===original);}));
 await check('fallible cleanup cannot replace the original source failure',()=>response(Buffer.from('{}'),{status:503,cleanupThrows:true},async()=>{await assert.rejects(request,/returned 503/);}));
 console.log(JSON.stringify({kind:'native-HTTPS-reader-with-constructed-event-streams',externalIO:0,records},null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
