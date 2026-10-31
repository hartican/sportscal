'use strict';
// Private two-round budget for the existing canonical AFLW result owner. This grants no refresh
// or result admission: the caller must separately validate sporting contents.
const https=require('node:https'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const LIMITS=Object.freeze({resourceMs:15000,wholeMs:45000,resourceBytes:1048576,totalBytes:2097152,requests:2,minimumStartGapMs:1000});
const URLS=Object.freeze([11,12].map(round=>`https://aflapi.afl.com.au/afl/v2/matches?compSeasonId=96&roundNumber=${round}&pageSize=50`));
const HEADERS=Object.freeze({Accept:'application/json',Origin:'https://www.afl.com.au',Referer:'https://www.afl.com.au/','User-Agent':'nothingsport-canonical-refresh/1.0'});
const roundError=message=>Object.assign(Error(message),{aflwRoundLocal:true});
function createBudget({clock=()=>performance.now(),deadline}={}){
 const began=clock();if(deadline!=null&&!Number.isFinite(deadline))throw Error('Invalid AFLW invocation deadline');const until=Math.min(began+LIMITS.wholeMs,deadline??Infinity),memo=new Map(),active=new Set(),observations=[],attempts=[];
 let wireTotal=0,decodedTotal=0,lastStarted=-Infinity,closed=false,failed=false,acquisitionStopped=false;
 function check(){if(closed||failed)throw Error('AFLW invocation is closed or failed');if(clock()>=until)throw Error('AFLW invocation deadline exceeded');}
 function read(url,consume=payload=>payload){
  try{check();if(acquisitionStopped)throw Error('AFLW source acquisition stopped after HTTP authentication refusal');if(typeof url!=='string'||!URLS.includes(url))throw Error('AFLW resource is outside the exact season96/round11+12 scope');}
  catch(error){return Promise.reject(error);}
  // A repeated resource reuses its immutable decoded text; it never retries a
  // failed request or spends another network call. Each consumer is timed too.
  const reused=memo.has(url);
  if(!reused){
   if(memo.size>=LIMITS.requests||active.size)return Promise.reject(Error('AFLW invocation resource/concurrency limit exceeded'));
   memo.set(url,request(url));
  }
  return memo.get(url).then(({text,started,dispose})=>{
   try{check();const parseStarted=reused?clock():started,payload=(()=>{try{return JSON.parse(text);}catch{throw roundError('AFLW JSON payload refused');}})(),value=consume(payload);if(value&&typeof value.then==='function')throw Error('AFLW resource consumer must finish synchronously');check();if(clock()-parseStarted>=LIMITS.resourceMs)throw roundError('AFLW resource parse deadline exceeded');return value;}
   catch(error){dispose(true);throw error;}
   finally{dispose(false);}
  }).catch(error=>{if(error.aflwStopAcquisition){acquisitionStopped=true;for(const cancel of active)cancel(error);}else if(!error.aflwRoundLocal){failed=true;for(const cancel of active)cancel(error);}throw error;});
 }
 function request(url){
  return new Promise((resolve,reject)=>{
   const started=clock();let req,res,decoder,timer,rateTimer,done=false,ended=false,wire=0,decoded=0;const chunks=[],wireHash=crypto.createHash('sha256'),decodedHash=crypto.createHash('sha256');
   const within=()=>{check();if(clock()-started>=LIMITS.resourceMs)throw roundError('AFLW whole-resource deadline exceeded');};
   const cancel=error=>{if(done)cleanup(true);else fail(error);};
   function cleanup(destroy){clearTimeout(timer);clearTimeout(rateTimer);active.delete(cancel);if(destroy)for(const resource of [decoder,res,req])try{resource?.destroy?.();}catch{}}
   function fail(error){if(done)return;done=true;cleanup(true);const failure=error instanceof Error?error:Error('AFLW resource failed');failure.sourceReceipt={url,status:res?.statusCode??null,wireBytes:wire,decodedBytes:decoded,complete:false,elapsedMs:clock()-started};reject(failure);}
   function decodedChunk(chunk){if(done)return;try{within();const bytes=Buffer.from(chunk);decoded+=bytes.length;decodedTotal+=bytes.length;if(decodedTotal>LIMITS.totalBytes)throw Error('AFLW aggregate decoded byte limit exceeded');if(decoded>LIMITS.resourceBytes)throw roundError('AFLW decoded byte limit exceeded');decodedHash.update(bytes);chunks.push(bytes);}catch(error){fail(error);}}
   function complete(){if(done)return;try{within();let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw roundError('AFLW UTF8 body refused');}within();done=true;clearTimeout(timer);observations.push({url,observedAt:new Date().toISOString(),elapsedMs:clock()-started,wireBytes:wire,decodedBytes:decoded,wireSha256:wireHash.digest('hex'),decodedSha256:decodedHash.digest('hex')});resolve({text,started,dispose:cleanup});}catch(error){fail(error);}}
   active.add(cancel);timer=setTimeout(()=>fail(clock()>=until?Error('AFLW invocation deadline exceeded'):roundError('AFLW whole-resource deadline exceeded')),Math.min(LIMITS.resourceMs,until-clock()));timer.unref?.();
   try{
    const dispatch=()=>{try{within();lastStarted=clock();attempts.push(url);req=https.get(url,{headers:HEADERS},response=>{
     res=response;if(done){res.destroy?.();return;}
     if(res.statusCode!==200){fail(Object.assign(Error('AFLW HTTP response refused'),{aflwRoundLocal:res.statusCode>=500&&res.statusCode<=599,aflwStopAcquisition:res.statusCode===401||res.statusCode===403,status:res.statusCode}));return;}
     const encoding=String(res.headers?.['content-encoding']||'identity').toLowerCase();
     if(!['identity','gzip','deflate','br'].includes(encoding)){fail(roundError('AFLW content encoding refused'));return;}
     try{decoder=encoding==='gzip'?zlib.createGunzip():encoding==='deflate'?zlib.createInflate():encoding==='br'?zlib.createBrotliDecompress():null;}catch(error){fail(error);return;}
     if(decoder){decoder.on('data',decodedChunk);decoder.on('error',()=>fail(roundError('AFLW compressed body refused')));decoder.on('end',complete);}
     res.on('error',()=>fail(roundError('AFLW response unavailable')));res.on('aborted',()=>fail(roundError('AFLW incomplete body')));res.on('close',()=>{if(!ended)fail(roundError('AFLW incomplete body'));});
     res.on('data',chunk=>{if(done)return;try{within();const bytes=Buffer.from(chunk);wire+=bytes.length;wireTotal+=bytes.length;if(wireTotal>LIMITS.totalBytes)throw Error('AFLW aggregate wire byte limit exceeded');if(wire>LIMITS.resourceBytes)throw roundError('AFLW wire byte limit exceeded');wireHash.update(bytes);if(decoder)decoder.write(bytes);else decodedChunk(bytes);}catch(error){fail(error);}});
     res.on('end',()=>{if(done)return;ended=true;const length=res.headers?.['content-length'];if(res.complete===false||length!=null&&(!/^\d+$/.test(String(length))||Number(length)!==wire)){fail(roundError('AFLW incomplete body'));return;}if(decoder)decoder.end();else complete();});
    });
    req.on('error',()=>fail(roundError('AFLW source connection unavailable')));if(done)req.destroy?.();}catch(error){fail(error);}};
    const delay=Math.max(0,LIMITS.minimumStartGapMs-(clock()-lastStarted));if(delay)rateTimer=setTimeout(dispatch,delay);else dispatch();
   }catch(error){fail(error);}
  });
 }
 function close(){closed=true;for(const cancel of [...active])cancel(Error('AFLW invocation closed'));}
 return {read,check,close,summary:()=>({requests:attempts.length,resources:[...attempts],reservedResources:[...memo.keys()],observations:[...observations],wireBytes:wireTotal,decodedBytes:decodedTotal,active:active.size,closed,failed,acquisitionStopped})};
}
module.exports={createBudget,LIMITS,URLS,HEADERS};
