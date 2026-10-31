'use strict';
// One exact existing resource, native HTTPS only; no redirect/retry/token path.
const https=require('node:https'),zlib=require('node:zlib'),{performance}=require('node:perf_hooks');
const {scope,sha}=require('./a-league-score-contract');
const LIMITS=Object.freeze({requests:1,resourceMs:15000,ownerMs:90000,cleanupMs:10000,encodedBytes:1048576,decodedBytes:1048576});
function strictJson(text,check=()=>{}){
 let at=0;const token=/(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
 const space=()=>{while(at<text.length&&/[\x20\t\r\n]/.test(text[at]))at++;};
 function string(){const start=at++;while(at<text.length){if((at&1023)===0)check();const c=text[at++];if(c==='\\'){at++;continue;}if(c==='"')return JSON.parse(text.slice(start,at));}throw Error('A-League incomplete JSON string');}
 function value(depth){check();space();if(depth>64)throw Error('A-League JSON depth refused');const c=text[at];if(c==='{'||c==='['){const object=c==='{',end=object?'}':']',keys=new Set();at++;space();if(text[at]===end){at++;return;}for(;;){if(object){space();if(text[at]!=='"')throw Error('A-League JSON key refused');const key=string();if(keys.has(key))throw Error('A-League duplicate JSON key');keys.add(key);space();if(text[at++]!==':')throw Error('A-League JSON colon refused');}value(depth+1);space();const next=text[at++];if(next===end)return;if(next!==',')throw Error('A-League JSON separator refused');}}if(c==='"'){string();return;}token.lastIndex=at;const found=token.exec(text);if(!found)throw Error('A-League JSON value refused');at=token.lastIndex;}
 value(0);space();if(at!==text.length)throw Error('A-League trailing JSON refused');check();return JSON.parse(text);
}
function createReader({clock=()=>performance.now(),began=clock()}={}){
 let attempted=false,closed=false,cancel=()=>{},resourceBegan,expired=false,active=0;
 function check(){const now=clock();if(!Number.isFinite(began)||!Number.isFinite(now)||now<began)throw Error('A-League invalid monotonic clock');if(closed||expired||now>=began+LIMITS.ownerMs||resourceBegan!=null&&now-resourceBegan>=LIMITS.resourceMs)throw Error('A-League resource/owner deadline or closure');}
 async function read(consume){check();if(attempted)throw Error('A-League one-resource allocation spent');attempted=true;resourceBegan=clock();active=1;
  return new Promise((resolve,reject)=>{
   let request,response,decoder,timer,settled=false,ended=false,wire=0,decoded=0,wireStored=0,bodyStored=0;const encoded=[],body=[];
   const receipt={url:scope.sourceUrl,method:'GET',requests:1,status:null,headers:{},complete:false,observedAt:null};
   function cleanup(){clearTimeout(timer);active=0;for(const object of [decoder,response,request])try{object?.destroy?.();}catch{}}
   function capture(){const encodedBody=Buffer.concat(encoded),decodedBody=Buffer.concat(body);return {encodedBody,decodedBody,receipt:{...receipt,elapsedMs:clock()-resourceBegan,encodedBytesObserved:wire,decodedBytesObserved:decoded,encodedBytesStored:encodedBody.length,decodedBytesStored:decodedBody.length,encodedSha256:sha(encodedBody),decodedSha256:sha(decodedBody),hashScope:receipt.complete?'complete-response-body':'bounded-retained-prefix'}};}
   function fail(error){if(settled)return;settled=true;cleanup();const e=error instanceof Error?error:Error('A-League resource failure');e.sourceCapture=capture();reject(e);}
   cancel=()=>{if(!settled)fail(Error('A-League reader closed'));else cleanup();};
   function decodedChunk(chunk){if(settled)return;try{check();const bytes=Buffer.from(chunk);decoded+=bytes.length;const kept=bytes.subarray(0,Math.max(0,LIMITS.decodedBytes-bodyStored));body.push(kept);bodyStored+=kept.length;if(decoded>LIMITS.decodedBytes)throw Error('A-League decoded byte cap');}catch(e){fail(e);}}
   function complete(){if(settled)return;try{check();receipt.complete=true;receipt.observedAt=new Date().toISOString();const captured=capture(),text=new TextDecoder('utf-8',{fatal:true}).decode(captured.decodedBody);check();const payload=strictJson(text,check),value=consume(payload,{observedAt:receipt.observedAt,bodySha256:captured.receipt.decodedSha256,check});if(value&&typeof value.then==='function')throw Error('A-League consumer must be synchronous');check();settled=true;cleanup();resolve({...captured,value});}catch(e){fail(e);}}
   timer=setTimeout(()=>{expired=true;fail(Error('A-League complete-resource deadline'));},Math.min(LIMITS.resourceMs,began+LIMITS.ownerMs-clock()));
   try{
    request=https.get(scope.sourceUrl,{headers:{Accept:'application/json','User-Agent':'NothingSport-canonical-a-league-scores/1.0'}},res=>{
     response=res;if(settled){res.destroy?.();return;}receipt.status=res.statusCode;
     for(const header of ['content-type','content-encoding','content-length'])if(res.headers?.[header]!=null)receipt.headers[header]=String(res.headers[header]).slice(0,160);
     if(res.statusCode!==200){fail(Error('A-League HTTP '+res.statusCode));return;}
     if(!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(String(res.headers?.['content-type']||''))){fail(Error('A-League JSON content type refused'));return;}
     const encoding=String(res.headers?.['content-encoding']||'identity').toLowerCase();if(!['identity','gzip','deflate','br'].includes(encoding)){fail(Error('A-League encoding refused'));return;}
     decoder=encoding==='gzip'?zlib.createGunzip():encoding==='deflate'?zlib.createInflate():encoding==='br'?zlib.createBrotliDecompress():null;
     if(decoder){decoder.on('data',decodedChunk);decoder.on('error',()=>fail(Error('A-League compressed body refused')));decoder.on('end',complete);}
     res.on('error',()=>fail(Error('A-League response failed')));res.on('aborted',()=>fail(Error('A-League aborted body')));res.on('close',()=>{if(!ended&&!settled)fail(Error('A-League incomplete body'));});
     res.on('data',chunk=>{if(settled)return;try{check();const bytes=Buffer.from(chunk);wire+=bytes.length;const kept=bytes.subarray(0,Math.max(0,LIMITS.encodedBytes-wireStored));encoded.push(kept);wireStored+=kept.length;if(wire>LIMITS.encodedBytes)throw Error('A-League encoded byte cap');if(decoder)decoder.write(bytes);else decodedChunk(bytes);}catch(e){fail(e);}});
     res.on('end',()=>{if(settled)return;ended=true;const length=res.headers?.['content-length'];if(res.complete===false||length!=null&&(!/^\d+$/.test(String(length))||Number(length)!==wire)){fail(Error('A-League incomplete body'));return;}if(decoder)decoder.end();else complete();});
    });request.on('error',()=>fail(Error('A-League connection failed')));if(settled)request.destroy?.();
   }catch(e){fail(e);}
  });
 }
 function close(){closed=true;cancel();}
 return {read,check,close,summary:()=>({requests:attempted?1:0,active,closed,sourceElapsedMs:clock()-began})};
}
module.exports={createReader,strictJson,LIMITS};
