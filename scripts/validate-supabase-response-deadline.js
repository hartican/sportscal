'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),{getEventListeners}=require('node:events');
const transport=require('../lib/supabase-server');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function validate({offline=false}={}){
 await validateOfflineTiming();
 await validateOfflineCapture();
 if(offline)return;
 let writes=0;const app=http.createServer((req,res)=>{
  if(req.url==='/headers-stall')return;
  if(req.url==='/combined-budget'){
   let timer=setTimeout(()=>{if(res.destroyed)return;res.writeHead(200,{'Content-Type':'application/json'});res.write('{');timer=setTimeout(()=>{if(!res.destroyed)res.end('}');},150);},150);
   res.once('close',()=>clearTimeout(timer));return;
  }
  if(req.url==='/write-stall')writes++;
  res.setHeader('Content-Type','application/json');
  if(['/body-stall','/caller-body','/write-stall'].includes(req.url)){res.writeHead(200);res.write('{');return;}
  if(req.url==='/denied'){res.writeHead(401);res.end(JSON.stringify({code:'fixture_denied',message:'Denied'}));return;}
  if(req.url==='/empty'){res.end();return;}
  if(req.url==='/text'){res.end('Unparsed text');return;}
  res.end(JSON.stringify({verified:true}));
 });
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const environment={SUPABASE_URL:'http://127.0.0.1:'+app.address().port,SUPABASE_PUBLISHABLE_KEY:'local-public-fixture'};
 const read=(path,options={})=>transport.supabaseRequest(path,{environment,timeoutMs:250,...options});
 const capture=p=>p.then(value=>({value}),error=>({error}));
 async function within(p,budget){let timer;try{const result=await Promise.race([capture(p),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),budget);})]);assert(!result.pending,'The actual read must settle within its configured budget, including response body');return result;}finally{clearTimeout(timer);}}
 const timeout=error=>error instanceof transport.SupabaseRequestError&&error.status===504&&error.payload?.code==='supabase_timeout';
 try{
  const stalled=await within(read('/body-stall',{timeoutMs:3000}),3400);assert(timeout(stalled.error),'The real partial-body fetch must return the same typed 3000ms timeout');
  const headers=await within(read('/headers-stall'),650);assert(timeout(headers.error));
  const combined=await within(read('/combined-budget'),650);assert(timeout(combined.error),'Headers and body share one original budget; body does not receive a fresh deadline');
  assert.deepEqual(await read('/okay'),{verified:true});assert.equal(await read('/empty'),null);assert.deepEqual(await read('/text'),{message:'Unparsed text'});
  await assert.rejects(read('/denied'),e=>e.status===401&&e.payload.code==='fixture_denied'&&e.message==='Denied','Upstream HTTP status and error payload remain intact');
  const bodyError=new Error('Original body failure');await assert.rejects(read('/body-error',{fetchImpl:async()=>({ok:true,text:async()=>{throw bodyError;}})}),e=>e===bodyError,'Non-abort body failures preserve their existing error mapping');
  const fetchError=new transport.SupabaseRequestError('Original fetch failure',{status:401});await assert.rejects(read('/fetch-error',{fetchImpl:()=>{throw fetchError;}}),e=>e.status===502&&e.payload?.message===fetchError.message,'Fetch failures retain the original network mapping even if a custom fetch throws a typed error');
  for(const path of ['/headers-stall','/caller-body']){
   const caller=new AbortController();let timer;
   const result=await within(read(path,{signal:caller.signal,timeoutMs:3000,fetchImpl:async(url,options)=>{
    if(path==='/headers-stall')timer=setTimeout(()=>caller.abort(new Error('Caller ended')),25);
    const response=await fetch(url,options);if(path==='/caller-body')timer=setTimeout(()=>caller.abort(new Error('Caller ended')),25);return response;
   }}),650);clearTimeout(timer);assert.equal(result.error?.status,502,'Caller cancellation keeps the existing header-abort mapping');assert.notEqual(result.error?.payload?.code,'supabase_timeout');assert.equal(getEventListeners(caller.signal,'abort').length,0,'Caller listener is removed after either phase');
  }
  const preAborted=new AbortController();preAborted.abort(new Error('Caller ended'));let preAbortedFetches=0;await assert.rejects(read('/okay',{signal:preAborted.signal,fetchImpl:()=>{preAbortedFetches++;throw fetchError;}}),e=>e.status===502&&e.payload?.code!=='supabase_timeout');assert.equal(preAbortedFetches,0,'An already-cancelled caller cannot start an uncertain write or leave an unhandled cancellation');
  const caller=new AbortController();let completedSignal;
  await read('/okay',{signal:caller.signal,fetchImpl:async(url,options)=>{completedSignal=options.signal;return fetch(url,options);}});assert.equal(getEventListeners(caller.signal,'abort').length,0);await pause(300);assert.equal(completedSignal.aborted,false,'A successful read clears its original timer');
  const written=await within(read('/write-stall',{method:'POST',body:{operation:'local-uncertain-write'}}),650);assert(timeout(written.error));assert.equal(writes,1,'A timed-out acknowledgement is neither returned as success nor retried or rolled back by the transport');
  const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures'),{createMatchCentreHandler}=require('../lib/match-centre-handler');
  const now=Date.now(),stamp=new Date(now).toISOString(),fixture={id:'fixture:deadline-retained',key:'nrl',status:'live',homeParticipantId:'team:one',awayParticipantId:'team:two',startTimeUtc:new Date(now-60000).toISOString(),scoreCheckedAt:stamp,statusCheckedAt:stamp,fixtureObservationSchema:'fixture-observations.v1'};
  let slow=false,releaseBody;
  const store=createSnapshotStore({request:(path,options)=>transport.supabaseRequest(path,{...options,environment,fetchImpl:async()=>({ok:true,status:200,text:()=>path.endsWith('source_health')?Promise.resolve(JSON.stringify([{source_id:'retained',revision:1}])):slow?new Promise(resolve=>{releaseBody=resolve;}):Promise.resolve(JSON.stringify({schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:true,rows:[{source_id:'retained',fixture}]}))})})});
  const options={store,scope:'match-centre',preserveIds:[fixture.id],maxAgeMs:0};const healthy=await readLiveSnapshots({...options,now});slow=true;
  const failed=await within(readLiveSnapshots({...options,now:now+30001}),3400);releaseBody('{}');assert.equal(failed.value?.stale,true);assert.equal(failed.value.revision,healthy.revision);assert.deepEqual(failed.value.sources,healthy.sources,'The original source facts survive a body timeout');
  const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now+30001,published:()=>[fixture],snapshotRead:async()=>failed.value,request:async()=>[]});
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};await handler({method:'GET',url:'/api/match-centre?membership=everything'},res);assert.equal(res.code,200);assert.equal(res.body.membershipStale,true,'The unchanged release gate must continue to reject degraded membership');assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.fixtures.length,1);assert.equal(res.body.fixtures[0].stale,true);
  console.log('Supabase full response: real 3000ms stalled body, headers, caller aborts, cleanup, response/error mapping, uncertain write and retained degraded membership passed; local traffic only.');
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
}
if(require.main===module)validate({offline:process.argv.includes('--offline')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports=validate;


// The same transport/parser with in-memory bodies; safe under native-network denial.
async function validateOfflineTiming(){
 const environment={SUPABASE_URL:'https://private.invalid',SUPABASE_PUBLISHABLE_KEY:'PRIVATE_KEY'},entries=[];
 const options={environment,timeoutMs:250,onTiming:entry=>entries.push(entry)};
 let reads=0,calls=0;
 const read=(text,{status=200,onTiming=options.onTiming}={})=>transport.supabaseRequest('/PRIVATE_PATH',{...options,onTiming,fetchImpl:async()=>{calls++;return {ok:status<400,status,text:async()=>{reads++;return text;}};}});
 for(const [text,wanted,format]of [['{"zero":0}',{zero:0},'json'],['',null,'empty'],['PRIVATE_INVALID_TEXT',{message:'PRIVATE_INVALID_TEXT'},'text']]){
  entries.length=0;assert.deepEqual(await read(text),wanted);assert(entries.length>0,'Opt-in transport must report safe milestones');assert.equal(entries.at(-1).phase,'complete');assert(entries.some(e=>e.phase==='text-ready'&&e.bytes===Buffer.byteLength(text)));assert(entries.some(e=>e.phase==='parse-ready'&&e.format===format));
  assert(entries.every(e=>Object.keys(e).every(k=>['phase','elapsedMs','status','bytes','format','outcome'].includes(k))));assert(!JSON.stringify(entries).includes('PRIVATE_'));assert(entries.every(e=>Number.isFinite(e.elapsedMs)&&e.elapsedMs>=0));
 }
 assert.equal(reads,3);assert.equal(calls,3,'One existing fetch and one text read per call');
 entries.length=0;await assert.rejects(read('{"code":"42501","message":"PRIVATE_DENIED"}',{status:403}),e=>e.status===403&&e.payload.code==='42501'&&e.message==='PRIVATE_DENIED');assert.equal(entries.at(-1).outcome,'http-error');
 entries.length=0;assert.deepEqual(await read('{"unchanged":true}',{onTiming:null}),{unchanged:true});assert.equal(entries.length,0,'No opt-in means no timing callback');
 assert.deepEqual(await read('{"unchanged":true}',{onTiming:()=>{throw Error('PRIVATE_CALLBACK');}}),{unchanged:true});
 assert.deepEqual(await read('{"unchanged":true}',{onTiming:()=>Promise.reject(Error('PRIVATE_CALLBACK_ASYNC'))}),{unchanged:true});
 entries.length=0;const originalBodyError=new Error('PRIVATE_BODY_FAILURE');await assert.rejects(transport.supabaseRequest('/PRIVATE_BODY',{...options,fetchImpl:async()=>({ok:true,status:200,text:async()=>{throw originalBodyError;}})}),e=>e===originalBodyError);assert.equal(entries.at(-1).outcome,'body-error');
 // A stalled header or body follows the real timer, without a socket or second body read.
 for(const phase of ['headers','body']){
  entries.length=0;let bodyReads=0;
  await assert.rejects(transport.supabaseRequest('/PRIVATE_STALL',{...options,fetchImpl:async(_url,{signal})=>{
   const pending=()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
   if(phase==='headers')return pending();return {ok:true,status:200,text:()=>{bodyReads++;return pending();}};
  }}),e=>e.status===504&&e.payload.code==='supabase_timeout');
  assert(entries.some(e=>e.phase==='timeout'));assert.equal(entries.some(e=>e.phase==='headers'),phase==='body');assert(!entries.some(e=>e.phase==='text-ready'));assert.equal(bodyReads,phase==='body'?1:0);assert(entries.every(e=>e.bytes==null),'Partial/unknown body length must stay unknown');
 }
 entries.length=0;let releaseLate;
 const late=transport.supabaseRequest('/PRIVATE_LATE',{...options,fetchImpl:async()=>({ok:true,status:200,text:()=>new Promise(resolve=>{releaseLate=resolve;})})});
 await assert.rejects(late,e=>e.status===504);const terminalCount=entries.length;releaseLate('{"late":true}');await Promise.resolve();await Promise.resolve();assert.equal(entries.length,terminalCount,'Late uncooperative body cannot report milestones after terminal failure');
 entries.length=0;const controller=new AbortController();let started=0;
 const pending=transport.supabaseRequest('/PRIVATE_ABORT',{...options,signal:controller.signal,fetchImpl:async()=>{started++;controller.abort(new Error('PRIVATE_REASON'));return new Promise(()=>{});}});
 await assert.rejects(pending,e=>e.status===502);assert.equal(started,1);assert(entries.some(e=>e.phase==='caller-abort'));assert(!JSON.stringify(entries).includes('PRIVATE_'));
 entries.length=0;const bodyController=new AbortController();let enteredBody;
 const bodyEntered=new Promise(resolve=>{enteredBody=resolve;});
 const bodyAborted=transport.supabaseRequest('/PRIVATE_BODY_ABORT',{...options,signal:bodyController.signal,fetchImpl:async(_url,{signal})=>({ok:true,status:200,text:()=>{enteredBody();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}})});
 await bodyEntered;bodyController.abort(new Error('PRIVATE_BODY_REASON'));await assert.rejects(bodyAborted,e=>e.status===502);assert(entries.some(e=>e.phase==='headers'));assert(entries.some(e=>e.phase==='caller-abort'));assert(!entries.some(e=>e.phase==='text-ready'));assert(!JSON.stringify(entries).includes('PRIVATE_'));
 entries.length=0;await assert.rejects(read('{"message":"PRIVATE_FAILURE"}',{status:403,onTiming:()=>{throw Error('PRIVATE_OBSERVER');}}),e=>e.status===403&&e.message==='PRIVATE_FAILURE');
 entries.length=0;const stopped=new AbortController();stopped.abort();await assert.rejects(transport.supabaseRequest('/PRIVATE_PREABORT',{...options,signal:stopped.signal,fetchImpl:()=>{throw Error('Must not fetch');}}),e=>e.status===502);assert(!entries.some(e=>e.phase==='fetch-start'));
 console.log('Offline transport timing: opt-in privacy, unchanged parser/errors, one body read, headers/body timeout, callback isolation and abort passed.');
}

// Existing validator extension: in-memory stream doubles, no network or files.
async function validateOfflineCapture(){
 const path='/rest/v1/rpc/nothingsports_read_match_centre_fixture_bundle';
 const environment={SUPABASE_URL:'https://private.invalid',SUPABASE_PUBLISHABLE_KEY:'PRIVATE_KEY'};
 const ordinary={method:'POST',body:{p_membership_ids:[]},environment,timeoutMs:250};
 const fixture=Buffer.from('{"zero":0,"off":false,"empty":"","null":null,"arr":[0,false,null]}');
 function stream(chunks,{stall=false,onRead}={}){
  const state={reads:0,cancels:0,releases:0,calls:0,signal:null,redirect:null};
  let at=0;
  const fetchImpl=async(_url,options)=>{
   state.calls++;state.signal=options.signal;state.redirect=options.redirect;
   return {ok:true,status:200,text(){throw Error('Capture must not use text()');},body:{getReader(){return {
    read(){state.reads++;onRead?.();if(at<chunks.length)return Promise.resolve({value:chunks[at++],done:false});return stall?new Promise(()=>{}):Promise.resolve({done:true});},
    cancel(){state.cancels++;return Promise.resolve();},releaseLock(){state.releases++;},
   };}}};
  };
  return {state,fetchImpl};
 }
 async function successful(raw,chunks,maxBytes){
  const transportState=stream(chunks),saved=[],events=[];let meta,completed=0;
  const capability=transport.createResponseCapture({maxBytes,onChunk({bytes,offset}){assert.equal(offset,Buffer.concat(saved).length);saved.push(bytes);},onComplete(value){meta=value;completed++;}});
  const value=await transport.supabaseRequest(path,{...ordinary,fetchImpl:transportState.fetchImpl,onTiming:e=>events.push(e),captureResponse:capability});
  assert.deepEqual(value,JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
  assert.deepEqual(Buffer.concat(saved),raw);assert.equal(meta.bytes,raw.length);assert.equal(completed,1);
  const crypto=require('node:crypto');assert.equal(meta.sha256,crypto.createHash('sha256').update(raw).digest('hex'));
  assert.equal(meta.gitBlobSha1,crypto.createHash('sha1').update(Buffer.from(`blob ${raw.length}\0`)).update(raw).digest('hex'));
  assert.equal(transportState.state.calls,1);assert.equal(transportState.state.redirect,'error');assert.equal(transportState.state.releases,1);
  assert.equal(events.at(-1).outcome,'success');assert(!JSON.stringify(events).includes('PRIVATE_'));
  await assert.rejects(transport.supabaseRequest(path,{...ordinary,fetchImpl:transportState.fetchImpl,captureResponse:capability}),e=>e.payload?.code==='supabase_capture_not_authorised');
  assert.equal(transportState.state.calls,1,'A capture capability cannot be replayed');
 }
 await successful(fixture,[fixture],fixture.length+1); // below cap
 await successful(fixture,[fixture],fixture.length); // exact cap
 const utf8=Buffer.from('{"label":"café 🏉","nested":{"unknown":null}}');
 await successful(utf8,[...utf8].map(n=>Uint8Array.of(n)),utf8.length);
 const bom=Buffer.concat([Buffer.from([239,187,191]),utf8]);await successful(bom,[bom],bom.length);
 async function rejected(chunks,code,{maxBytes=1024,stall=false,onChunk=()=>{},onComplete=()=>{},signal,onRead}={}){
  const mocked=stream(chunks,{stall,onRead}),events=[];let complete=0;
  const cap=transport.createResponseCapture({maxBytes,onChunk,onComplete(value){complete++;return onComplete(value);}});
  await assert.rejects(transport.supabaseRequest(path,{...ordinary,signal,fetchImpl:mocked.fetchImpl,onTiming:e=>events.push(e),captureResponse:cap}),e=>e.payload?.code===code);
  assert.equal(mocked.state.calls,1);assert.equal(mocked.state.signal.aborted,true);assert.equal(mocked.state.releases,1);
  assert(!events.some(e=>e.phase==='complete'&&e.outcome==='success'));assert(!JSON.stringify(events).includes('PRIVATE_'));
  return {mocked,events,complete};
 }
 const overflow=await rejected([fixture], 'supabase_capture_too_large',{maxBytes:fixture.length-1});
 assert.equal(overflow.complete,0);assert.equal(overflow.mocked.state.cancels,1);assert(!overflow.events.some(e=>e.phase==='parse-start'));
 const partial=[];await rejected([Buffer.from('{'),fixture],'supabase_capture_too_large',{maxBytes:fixture.length,onChunk:({bytes})=>partial.push(bytes)});assert.deepEqual(Buffer.concat(partial),Buffer.from('{'));
 assert.equal((await rejected([Uint8Array.of(255)],'supabase_capture_invalid_utf8')).complete,0);
 assert.equal((await rejected([Buffer.from('{')],'supabase_capture_invalid_json')).complete,0);
 assert.equal((await rejected([fixture],'supabase_capture_sink_failed',{onChunk(){throw Error('PRIVATE_WRITER_FAILURE');}})).complete,0);
 assert.equal((await rejected([fixture],'supabase_capture_sink_failed',{onComplete(){throw Error('PRIVATE_WRITER_FAILURE');}})).complete,1);
 const stalled=await rejected([Buffer.from('{')],'supabase_timeout',{stall:true});assert.equal(stalled.complete,0);assert.equal(stalled.mocked.state.cancels,1);
 const stalledWriter=await rejected([fixture],'supabase_timeout',{onChunk:()=>new Promise(()=>{})});assert.equal(stalledWriter.complete,0);
 const controller=new AbortController(),aborted=stream([],{stall:true,onRead:()=>controller.abort(new Error('PRIVATE_CALLER_ABORT'))});let completes=0;
 await assert.rejects(transport.supabaseRequest(path,{...ordinary,signal:controller.signal,fetchImpl:aborted.fetchImpl,captureResponse:transport.createResponseCapture({maxBytes:1024,onChunk(){},onComplete(){completes++;}})}),e=>e.status===502);
 assert.equal(completes,0);assert.equal(aborted.state.calls,1);
 let forgedCalls=0;await assert.rejects(transport.supabaseRequest(path,{...ordinary,captureResponse:{},fetchImpl:async()=>{forgedCalls++;}}),e=>e.payload?.code==='supabase_capture_not_authorised');assert.equal(forgedCalls,0);
 const wrongPath=transport.createResponseCapture({maxBytes:1024,onChunk(){},onComplete(){}});await assert.rejects(transport.supabaseRequest('/wrong',{...ordinary,captureResponse:wrongPath,fetchImpl:async()=>{forgedCalls++;}}),e=>e.payload?.code==='supabase_capture_not_authorised');assert.equal(forgedCalls,0);
 console.log('Offline bounded capture: complete/exact/overflow/UTF8/abort/deadline/sink/privacy/default separation cases passed.');
}
