'use strict';
// Private invocation budget for the existing F1 loader. This grants no refresh
// or result admission: the caller must separately validate sporting contents.
const https=require('node:https'),zlib=require('node:zlib');
const {performance}=require('node:perf_hooks');
const LIMITS=Object.freeze({resourceMs:15000,wholeMs:120000,resourceBytes:1048576,totalBytes:6291456,requests:6});
const INDEX='https://www.formula1.com/en/results/2026/races';
function createBudget({clock=()=>performance.now(),sessions=[]}={}){
 const kinds=new Set(['race-result','qualifying','sprint-results','sprint-qualifying','practice/1','practice/2','practice/3']);
 if(!Array.isArray(sessions)||sessions.length>5||sessions.some(row=>!row||Object.keys(row).sort().join(',')!=='kind,slug'||!kinds.has(row.kind)||typeof row.slug!=='string'||!/^[a-z]+(?:-[a-z]+)*$/.test(row.slug))||new Set(sessions.map(row=>row.slug+':'+row.kind)).size!==sessions.length)throw Error('Invalid F1 existing-session resource plan');
 const began=clock(),allowed=new Set([INDEX]),memo=new Map(),active=new Set();
 let wireTotal=0,decodedTotal=0,closed=false,failed=false,indexRead=false;
 function check(){if(closed||failed)throw Error('F1 invocation is closed or failed');if(clock()-began>=LIMITS.wholeMs)throw Error('F1 invocation deadline exceeded');}
 function bindIndex(html){
  const links=new Map();
  for(const match of html.matchAll(/href="(\/en\/results\/2026\/races\/([1-9]\d*)\/([a-z]+(?:-[a-z]+)*)\/race-result)"/g)){
   const url='https://www.formula1.com'+match[1],slug=match[3];
   if(links.has(slug)&&links.get(slug)!==url)throw Error('F1 index contains ambiguous race identity');
   links.set(slug,url);
  }
  if(!links.size)throw Error('F1 index contains no reviewed-shape race links');
  for(const session of sessions){const url=links.get(session.slug);if(url)allowed.add(url.replace(/race-result$/,session.kind));}
  indexRead=true;
 }
 function read(url,consume=text=>text){
  try{check();if(typeof url!=='string'||!allowed.has(url)||url!==INDEX&&!indexRead)throw Error('F1 resource is outside the index-derived scope');}
  catch(error){return Promise.reject(error);}
  // A repeated resource reuses its immutable decoded text; it never retries a
  // failed request or spends another network call. Each consumer is timed too.
  const reused=memo.has(url);
  if(!reused){
   if(memo.size>=LIMITS.requests)return Promise.reject(Error('F1 invocation request limit exceeded'));
   memo.set(url,request(url));
  }
  return memo.get(url).then(({text,started})=>{
   check();const parseStarted=reused?clock():started,value=consume(text);if(value&&typeof value.then==='function')throw Error('F1 resource consumer must finish synchronously');if(clock()-parseStarted>=LIMITS.resourceMs)throw Error('F1 resource parse deadline exceeded');check();return value;
  }).catch(error=>{failed=true;for(const cancel of active)cancel(error);throw error;});
 }
 function request(url){
  return new Promise((resolve,reject)=>{
   const started=clock();let req,res,decoder,timer,done=false,ended=false,wire=0,decoded=0;const chunks=[];
   const within=()=>{check();if(clock()-started>=LIMITS.resourceMs)throw Error('F1 whole-resource deadline exceeded');};
   function cleanup(destroy){clearTimeout(timer);active.delete(fail);if(destroy)for(const resource of [decoder,res,req])try{resource?.destroy?.();}catch{}}
   function fail(error){if(done)return;done=true;cleanup(true);reject(error instanceof Error?error:Error('F1 resource failed'));}
   function decodedChunk(chunk){if(done)return;try{within();const bytes=Buffer.from(chunk);decoded+=bytes.length;decodedTotal+=bytes.length;if(decoded>LIMITS.resourceBytes||decodedTotal>LIMITS.totalBytes)throw Error('F1 decoded byte limit exceeded');chunks.push(bytes);}catch(error){fail(error);}}
   function complete(){if(done)return;try{within();const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));if(url===INDEX)bindIndex(text);within();done=true;cleanup(false);resolve({text,started});}catch(error){fail(error);}}
   active.add(fail);timer=setTimeout(()=>fail(Error('F1 whole-resource deadline exceeded')),Math.min(LIMITS.resourceMs,LIMITS.wholeMs-(clock()-began)));timer.unref?.();
   try{
    req=https.get(url,{headers:{Accept:'text/html','User-Agent':'nothingsport-f1-results/1.0'}},response=>{
     res=response;if(done){res.destroy?.();return;}
     if(res.statusCode!==200){fail(Error('F1 HTTP response refused'));return;}
     const encoding=String(res.headers?.['content-encoding']||'identity').toLowerCase();
     if(!['identity','gzip','deflate','br'].includes(encoding)){fail(Error('F1 content encoding refused'));return;}
     try{decoder=encoding==='gzip'?zlib.createGunzip():encoding==='deflate'?zlib.createInflate():encoding==='br'?zlib.createBrotliDecompress():null;}catch(error){fail(error);return;}
     if(decoder){decoder.on('data',decodedChunk);decoder.on('error',fail);decoder.on('end',complete);}
     res.on('error',fail);res.on('aborted',()=>fail(Error('F1 incomplete body')));res.on('close',()=>{if(!ended)fail(Error('F1 incomplete body'));});
     res.on('data',chunk=>{if(done)return;try{within();const bytes=Buffer.from(chunk);wire+=bytes.length;wireTotal+=bytes.length;if(wire>LIMITS.resourceBytes||wireTotal>LIMITS.totalBytes)throw Error('F1 wire byte limit exceeded');if(decoder)decoder.write(bytes);else decodedChunk(bytes);}catch(error){fail(error);}});
     res.on('end',()=>{if(done)return;ended=true;const length=res.headers?.['content-length'];if(res.complete===false||length!=null&&(!/^\d+$/.test(String(length))||Number(length)!==wire)){fail(Error('F1 incomplete body'));return;}if(decoder)decoder.end();else complete();});
    });
    req.on('error',fail);if(done)req.destroy?.();
   }catch(error){fail(error);}
  });
 }
 function close(){closed=true;for(const cancel of [...active])cancel(Error('F1 invocation closed'));}
 return {read,check,close,summary:()=>({requests:memo.size,wireBytes:wireTotal,decodedBytes:decodedTotal,active:active.size,closed,failed})};
}
module.exports={createBudget,LIMITS,INDEX};
