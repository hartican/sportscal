'use strict';
// Five existing primary resources; no retry, redirect or backup transport.
const https=require('node:https'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const FIXTURE_URLS=Object.freeze(Array.from({length:4},(_,page)=>'https://footballapi.pulselive.com/football/fixtures?'+new URLSearchParams({comps:'1',comp:'1',compSeasons:'841',page:String(page),pageSize:'100',altIds:'true'})));
const TABLE_URL='https://footballapi.pulselive.com/football/standings?compSeasons=841&comps=1&comp=1&altIds=true&page=0&pageSize=100';
// The collection schema fixes 100 fixtures/page and 20 table clubs. The largest
// retained real fixture is 1,656 JSON bytes; reserve 8 KiB/fixture plus a 64 KiB
// envelope. Table rows need only identity/statistics: 4 KiB/club plus 64 KiB.
// These are hard admission budgets, not a claim about a new provider response.
const LIMITS=Object.freeze({fixtures:100*8192+65536,table:20*4096+65536}),TIMEOUT_MS=20000;
function readJson(url,{onObservation}={}){
 url=String(url);const kind=FIXTURE_URLS.includes(url)?'fixtures':url===TABLE_URL?'table':null;
 if(!kind)return Promise.reject(Error('EPL primary resource is outside the declared five-resource scope'));
 const limit=LIMITS[kind],label=kind==='fixtures'?'Premier League fixture page':'Premier League standings service';
 return new Promise((resolve,reject)=>{
  const started=performance.now(),wireHash=crypto.createHash('sha256'),decodedHash=crypto.createHash('sha256');
  let request,response,decoder,timer,settled=false,ended=false,wireBytes=0,decodedBytes=0;const chunks=[];
  const error=(code,message)=>Object.assign(Error(label+' '+message),{code});
  function fail(reason){
   if(settled)return;settled=true;clearTimeout(timer);
   const failure=reason instanceof Error?reason:Error(String(reason));
   try{failure.sourceReceipt={url,status:response?.statusCode??null,wireBytes,decodedBytes,complete:false,failedAt:new Date().toISOString(),elapsedMs:performance.now()-started};}catch{}
   for(const resource of[decoder,response,request])try{resource?.destroy?.();}catch{}
   reject(failure);
  }
  function withinDeadline(){if(performance.now()-started>=TIMEOUT_MS)throw error('EPL_SOURCE_DEADLINE','exceeded its 20-second deadline');}
  function decoded(chunk){
   if(settled)return;
   const bytes=Buffer.from(chunk);decodedBytes+=bytes.length;if(decodedBytes>limit)return fail(error('EPL_SOURCE_BYTES','exceeded its decoded-body byte budget'));
   decodedHash.update(bytes);chunks.push(bytes);
  }
  function complete(){
   if(settled)return;
   try{
    withinDeadline();const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
    let payload;try{payload=JSON.parse(text);}catch(cause){throw Object.assign(error('EPL_SOURCE_JSON','returned invalid JSON'),{cause});}withinDeadline();
    const receipt={url,status:200,observedAt:new Date().toISOString(),wireBytes,decodedBytes,wireSha256:wireHash.digest('hex'),sha256:decodedHash.digest('hex'),complete:true,elapsedMs:performance.now()-started};
    onObservation?.(receipt);withinDeadline();settled=true;clearTimeout(timer);resolve(payload);
   }catch(reason){fail(reason);}
  }
  timer=setTimeout(()=>fail(error('EPL_SOURCE_DEADLINE','exceeded its 20-second deadline')),TIMEOUT_MS);timer.unref?.();
  try{
   request=https.get(url,{headers:{Accept:'application/json',Origin:'https://www.premierleague.com','User-Agent':'nothingsport-premier-league/1.0'}},res=>{
    response=res;if(settled){res.destroy?.();return;}
    if(res.statusCode!==200){fail(error('EPL_SOURCE_HTTP','returned '+res.statusCode));return;}
    const encoding=String(res.headers?.['content-encoding']||'identity').toLowerCase();
    if(!['identity','gzip','deflate','br'].includes(encoding)){fail(error('EPL_SOURCE_ENCODING','returned an unsupported content encoding'));return;}
    try{decoder=encoding==='gzip'?zlib.createGunzip():encoding==='deflate'?zlib.createInflate():encoding==='br'?zlib.createBrotliDecompress():null;}catch(reason){fail(reason);return;}
    if(decoder){decoder.on('data',decoded);decoder.on('error',fail);decoder.on('end',complete);}
    res.on('error',fail);res.on('aborted',()=>fail(error('EPL_SOURCE_PARTIAL','ended before completion')));
    res.on('close',()=>{if(!ended)fail(error('EPL_SOURCE_PARTIAL','ended before completion'));});
    res.on('data',chunk=>{
     if(settled)return;
     try{
      withinDeadline();const bytes=Buffer.from(chunk);
      wireBytes+=bytes.length;if(wireBytes>limit){fail(error('EPL_SOURCE_BYTES','exceeded its wire-body byte budget'));return;}
      wireHash.update(bytes);if(decoder)decoder.write(bytes);else decoded(bytes);
     }catch(reason){fail(reason);}
    });
    res.on('end',()=>{
     if(settled)return;ended=true;
     const length=res.headers?.['content-length'];
     if(res.complete===false||length!=null&&(!/^\d+$/.test(String(length))||Number(length)!==wireBytes)){fail(error('EPL_SOURCE_PARTIAL','ended before completion'));return;}
     if(decoder)decoder.end();else complete();
    });
   });
   request.on('error',fail);request.setTimeout(TIMEOUT_MS,()=>fail(error('EPL_SOURCE_DEADLINE','exceeded its 20-second deadline')));
   if(settled)request.destroy?.();
  }catch(reason){fail(reason);}
 });
}
module.exports={readJson,FIXTURE_URLS,TABLE_URL,LIMITS,TIMEOUT_MS};
