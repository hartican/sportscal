'use strict';
const assert=require('node:assert/strict');
const {supabaseRequest,supabaseServiceRequest}=require('../lib/supabase-server');
const environment={SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLISHABLE_KEY:'synthetic-test-key',SUPABASE_SECRET_KEY:'sb_secret_synthetic_test_only'};
const encode=s=>new TextEncoder().encode(s);
async function run(){
 let checks=0,requests=0,network=0;const originalFetch=global.fetch;global.fetch=async()=>{network++;throw Error('Untrapped network');};
 const call=(response,options={})=>supabaseRequest('/rest/v1/rpc/test',{environment,maxResponseBytes:64,fetchImpl:async()=>{requests++;return response;},...options});
 function streamed(chunks,{headers={},status=200,stall=false}={}){
  const state={cancels:0,pulls:0},body=new ReadableStream({pull(c){state.pulls++;if(chunks.length)c.enqueue(chunks.shift());else if(!stall)c.close();},cancel(){state.cancels++;}});
  const response=new Response(body,{headers,status});return {response,body,state};
 }
 try{
  for(const cap of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2',null]){let hit=false;await assert.rejects(()=>supabaseRequest('/test',{environment,maxResponseBytes:cap,fetchImpl:async()=>{hit=true;return new Response('[]');}}),e=>e.payload?.code==='supabase_response_limit_invalid');assert(!hit);checks++;}
  for(const [label,chunks,value]of [['empty',[],null],['one',[encode('[]')],[]],['many',[encode('{"x":'),encode('12'),encode('}')],{x:12}],['BOM',[new Uint8Array([239,187,191]),encode('[]')],[]]]){const s=streamed(chunks);assert.deepEqual(await call(s.response),value,label);assert(!s.body.locked);checks++;}
  const utf=encode('{"label":"🏏 é"}');const split=streamed(Array.from(utf,b=>new Uint8Array([b])));assert.deepEqual(await call(split.response,{maxResponseBytes:utf.length}),{label:'🏏 é'});assert(!split.body.locked);checks++;
  const exact=streamed([encode('[]')]);assert.deepEqual(await call(exact.response,{maxResponseBytes:2}),[]);checks++;
  for(const headers of [{},{'content-length':'1'},{'content-length':'not-a-number'}]){const s=streamed([encode('['),encode('12]')],{headers,stall:true});await assert.rejects(()=>call(s.response,{maxResponseBytes:3}),e=>e.payload?.code==='supabase_response_too_large');assert(s.state.cancels>0);assert(!s.body.locked);checks++;}
  const early=streamed([encode('[]')],{headers:{'content-length':'999'},stall:true});await assert.rejects(()=>call(early.response),e=>e.payload?.code==='supabase_response_too_large');assert(early.state.cancels);assert(!early.body.locked);checks++;
  const decompressed=streamed([encode('[]')],{headers:{'content-encoding':'gzip','content-length':'99999'}});assert.deepEqual(await call(decompressed.response,{maxResponseBytes:2}),[]);checks++;
  const claimedSmall=streamed([encode('[1'),encode(',2]')],{headers:{'content-length':'1'}});assert.deepEqual(await call(claimedSmall.response,{maxResponseBytes:5}),[1,2]);checks++;
  const malformed=streamed([encode('{broken')]);assert.deepEqual(await call(malformed.response),{message:'{broken'});assert(!malformed.body.locked);checks++;
  for(const [status,text,message]of [[403,'{"message":"forbidden","code":"42501"}','forbidden'],[429,'rate limited','rate limited']]){const s=streamed([encode(text)],{status});await assert.rejects(()=>call(s.response),e=>e.status===status&&e.message===message);assert(!s.body.locked);checks++;}
  for(const response of [{ok:true,status:200,headers:new Headers(),text:async()=>{throw Error('Must not call text');}},new Response(null)])await assert.rejects(()=>call(response),e=>e.payload?.code==='supabase_response_stream_unavailable');checks++;
  const controller=new AbortController(),aborted=streamed([encode('[')],{stall:true});const aborting=call(aborted.response,{signal:controller.signal});setTimeout(()=>controller.abort(new Error('test-caller-abort')),5);await assert.rejects(()=>aborting,e=>e.status===502);await new Promise(setImmediate);assert(aborted.state.cancels>0);assert(!aborted.body.locked);checks++;
  const timeout=streamed([encode('[')],{stall:true});await assert.rejects(()=>call(timeout.response,{timeoutMs:250}),e=>e.status===504&&e.payload?.code==='supabase_timeout');await new Promise(setImmediate);assert(timeout.state.cancels>0);assert(!timeout.body.locked);checks++;
  const late=streamed([],{stall:true});let finishFetch;const latePending=supabaseRequest('/test',{environment,maxResponseBytes:64,timeoutMs:250,fetchImpl:()=>new Promise(resolve=>{finishFetch=resolve;})});await assert.rejects(()=>latePending,e=>e.status===504);finishFetch(late.response);await new Promise(setImmediate);assert(late.state.cancels>0);assert(!late.body.locked);checks++;
  const before=new AbortController();before.abort();let hit=false;await assert.rejects(()=>supabaseRequest('/test',{environment,maxResponseBytes:64,signal:before.signal,fetchImpl:async()=>{hit=true;return new Response('[]');}}));assert(!hit);checks++;
  const invalid=streamed(['not bytes'],{stall:true});await assert.rejects(()=>call(invalid.response),e=>e.payload?.code==='supabase_response_stream_invalid');assert(invalid.state.cancels>0);assert(!invalid.body.locked);checks++;
  const thrownBody=new ReadableStream({pull(c){c.error(new Error('simulated body failure'));}});await assert.rejects(()=>call(new Response(thrownBody)),/simulated body failure/);assert(!thrownBody.locked);checks++;
  const timings=[],timed=streamed([encode('['),encode('12]')]);assert.deepEqual(await call(timed.response,{onTiming:x=>{timings.push(x);if(x.phase==='text-start')throw Error('observer');}}),[12]);assert.equal(timings.at(-1).phase,'complete');assert.equal(timings.at(-1).bytes,4);checks++;
  const asyncTiming=streamed([encode('[]')]);assert.deepEqual(await call(asyncTiming.response,{onTiming:async()=>{throw Error('observer rejection');}}),[]);checks++;
  let textCalls=0;assert.deepEqual(await call({ok:true,status:200,text:async()=>{textCalls++;return '[1]';}},{maxResponseBytes:undefined}),[1]);assert.equal(textCalls,1);checks++;
  const defaultBad=streamed([encode('bad')]);assert.deepEqual(await call(defaultBad.response,{maxResponseBytes:undefined}),{message:'bad'});checks++;
  let received;const service=streamed([encode('[]')]);assert.deepEqual(await supabaseServiceRequest('/test',{environment,maxResponseBytes:2,fetchImpl:async(url,options)=>{received=options;return service.response;}}),[]);assert.equal(received.headers.apikey,environment.SUPABASE_SECRET_KEY);assert(!received.headers.Authorization);checks++;
  assert.equal(network,0);const result={checks,simulatedFetches:requests,actualNetworkRequests:network,bound:'fetch body bytes before UTF8 decode/JSON parse; may be decompressed'};console.log(JSON.stringify(result,null,2));return result;
 }finally{global.fetch=originalFetch;}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={run};
