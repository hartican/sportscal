'use strict';
// Same complete-stream/abort/reader discipline as the qualified NBL transport.
// Public bytes are committed only after both guard and actual SDK JSON parses.
const crypto=require('node:crypto'),P=require('./protocol.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
class Transport{
 constructor({schema,values,capture}){
  this.schema=schema;this.values=values;this.secret=P.privacy(values);this.capture=capture;
  this.requests=0;this.received=0;this.captured=0;this.finished=false;this.failed=false;this.active=null;this.seen=new Set();this.records=[];
 }
 check(ctx){if(P.performance.now()>=ctx.deadline)throw P.error('POST_GUARD_BODY_DEADLINE');if(ctx.signal?.aborted)throw P.error('POST_GUARD_ABORTED');}
 async service(path,options,call){
  if(this.failed)throw P.error('POST_GUARD_AFTER_FAILURE');
  if(this.active)throw P.error('POST_GUARD_CONCURRENT_REQUEST');
  if(this.finished||this.requests>=P.MAX_REQUESTS)throw P.error('POST_GUARD_REQUEST_BUDGET');
  if(path!==P.endpoint(this.requests).slice(P.ORIGIN.length)||options?.method!=='POST'||JSON.stringify(options.body)!=='{"p_fixture_ids":null}'||options.timeoutMs!==P.DEADLINE||Object.keys(options).some(k=>!['method','body','timeoutMs'].includes(k)))throw P.error('POST_GUARD_SERVICE_SCOPE');
  const started=P.performance.now(),controller=new AbortController(),ctx={ordinal:this.requests,started,deadline:started+P.DEADLINE,controller,bytes:0,reader:null,readDone:false,readerReleased:false,captureFileOpened:false,captureFileClosed:true};
  this.active=ctx;ctx.cancelled=new Promise((_,reject)=>{ctx.reject=reject;});ctx.cancelled.catch(()=>{});
  ctx.timer=setTimeout(()=>{controller.abort();ctx.reject(P.error('POST_GUARD_BODY_DEADLINE'));},Math.max(1,ctx.deadline-P.performance.now()));
  let first;
  try{
   this.capture.start({ordinal:ctx.ordinal,url:P.endpoint(ctx.ordinal),startedAt:new Date().toISOString(),deadlineMs:P.DEADLINE});
   const result=await call();this.check(ctx);
   if(!ctx.buffer||!ctx.parsed||ctx.textCalls!==1||hash(JSON.stringify(result))!==ctx.parsedHash)throw P.error('POST_GUARD_CONSUMER_PARSE');
   const closed=this.capture.commit(ctx.ordinal,ctx.buffer);ctx.captureFileOpened=true;ctx.captureFileClosed=closed===true;
   this.check(ctx);if(!ctx.captureFileClosed)throw P.error('POST_GUARD_CAPTURE_CLOSE');
   this.captured+=ctx.bytes;
   for(const row of ctx.parsed)this.seen.add(row.source_id+'|'+row.fixture_id);
   this.finished=ctx.parsed.length<P.PAGE;ctx.consumerParsed=true;
   return result;
  }catch(error){
   first=ctx.first||(/^(?:POST_GUARD|GUARD)_[A-Z0-9_]+$/.test(error?.code||'')?error:P.error(P.performance.now()>=ctx.deadline?'POST_GUARD_BODY_DEADLINE':'POST_GUARD_SERVICE_FAILED'));
   this.failed=true;throw first;
  }finally{
   clearTimeout(ctx.timer);ctx.removeCaller?.();
   if(first)controller.abort();
   const record={ordinal:ctx.ordinal,status:ctx.status??null,bytesReceived:ctx.bytes,bodyComplete:ctx.readDone,guardParsed:Boolean(ctx.parsed),consumerParsed:Boolean(ctx.consumerParsed),readerAcquired:Boolean(ctx.reader),readerReleased:!ctx.reader||ctx.readerReleased,captureFileOpened:ctx.captureFileOpened,captureFileClosed:ctx.captureFileClosed,captured:ctx.consumerParsed===true,elapsedMs:Math.max(0,P.performance.now()-started),error:first?.code||null,sha256:ctx.captureFileOpened?hash(ctx.buffer):null,cleanupErrors:ctx.cleanupErrors||[]};
   const diagnostic=P.shapeFailure(first);if(diagnostic)record.shapeFailure=diagnostic;
   const summary=P.shapeFailures(first);if(summary)record.shapeFailures=summary;
   this.records.push(record);ctx.buffer=null;ctx.parsed=null;this.active=null;
   try{this.capture.finish(record);}catch{this.failed=true;if(!first)throw P.error('POST_GUARD_RECEIPT');}
  }
 }
 async fetch(input,options,fetchImpl){
  const ctx=this.active;
  if(!ctx||ctx.fetchUsed||typeof input!=='string'||input!==P.endpoint(ctx.ordinal))throw P.error('POST_GUARD_FETCH_SCOPE');
  if(options?.method!=='POST'||options.body!=='{"p_fixture_ids":null}'||Object.keys(options).some(k=>!['method','body','headers','signal'].includes(k)))throw P.error('POST_GUARD_FETCH_OPTIONS');
  const h=options.headers;if(!h||Object.getPrototypeOf(h)!==Object.prototype)throw P.error('POST_GUARD_HEADERS');
  const keys=Object.keys(h).map(k=>k.toLowerCase()),headers=Object.fromEntries(Object.entries(h).map(([k,v])=>[k.toLowerCase(),v]));
  const value=this.values[0]?.trim();
  if(!value||new Set(keys).size!==keys.length||keys.some(k=>!['apikey','authorization','accept','content-type'].includes(k))||headers.apikey!==value||headers.accept!=='application/json'||headers['content-type']!=='application/json'||(value.startsWith('sb_secret_')?headers.authorization!==undefined:headers.authorization!=='Bearer '+value))throw P.error('POST_GUARD_HEADERS');
  ctx.fetchUsed=true;this.requests++;
  const signal=options.signal?AbortSignal.any([options.signal,ctx.controller.signal]):ctx.controller.signal;ctx.signal=signal;
  const abort=()=>ctx.reject(P.error(P.performance.now()>=ctx.deadline?'POST_GUARD_BODY_DEADLINE':'POST_GUARD_ABORTED'));
  signal.addEventListener('abort',abort,{once:true});ctx.removeCaller=()=>signal.removeEventListener('abort',abort);if(signal.aborted)abort();
  let first;
  try{
   this.check(ctx);
   const pending=Promise.resolve(fetchImpl(input,{...options,redirect:'error',signal}));
   pending.then(response=>{if(signal.aborted)try{response.body?.cancel().catch(()=>{});}catch{};},()=>{});
   const response=await Promise.race([pending,ctx.cancelled]);ctx.response=response;this.check(ctx);
   ctx.status=Number.isInteger(response.status)?response.status:null;
   if(response.redirected||ctx.status!==200)throw P.error(ctx.status>=100&&ctx.status<=599?'POST_GUARD_HTTP_'+ctx.status:'POST_GUARD_HTTP_STATUS');
   const type=response.headers.get('content-type'),encoding=response.headers.get('content-encoding'),length=response.headers.get('content-length');
   if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(type||'')||encoding&&!['identity','br','gzip','deflate'].includes(encoding)||length!==null&&!/^\d{1,10}$/.test(length))throw P.error('POST_GUARD_RESPONSE_HEADERS');
   if(!response.body)throw P.error('POST_GUARD_MISSING_BODY');
   ctx.reader=response.body.getReader();const chunks=[];
   for(;;){
    const part=await Promise.race([ctx.reader.read(),ctx.cancelled]);this.check(ctx);
    if(part.done){ctx.readDone=true;break;}
    const b=Buffer.from(part.value);ctx.bytes+=b.length;this.received+=b.length;
    if(ctx.bytes>P.PAGE_BYTES)throw P.error('POST_GUARD_PAGE_BYTES');
    if(this.received>P.TOTAL_BYTES)throw P.error('POST_GUARD_TOTAL_BYTES');
    chunks.push(b);
   }
   if((!encoding||encoding==='identity')&&length!==null&&Number(length)!==ctx.bytes)throw P.error('POST_GUARD_PARTIAL_BODY');
   ctx.buffer=Buffer.concat(chunks);if(this.secret.contains(ctx.buffer))throw P.error('POST_GUARD_PRIVATE_PAYLOAD');
   let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(ctx.buffer);}catch{throw P.error('POST_GUARD_UTF8');}
   this.check(ctx);try{ctx.parsed=JSON.parse(text);}catch{throw P.error('POST_GUARD_JSON');}this.check(ctx);
   P.rejectDuplicateKeys(text);P.validatePublic(ctx.parsed,this.schema,this.secret,()=>this.check(ctx));this.check(ctx);
   const pairs=new Set();for(const row of ctx.parsed){const id=row.source_id+'|'+row.fixture_id;if(pairs.has(id)||this.seen.has(id))throw P.error('POST_GUARD_OVERLAP');pairs.add(id);}
   ctx.parsedHash=hash(JSON.stringify(ctx.parsed));ctx.textCalls=0;
   return Object.freeze({ok:true,status:200,url:input,headers:new Headers({'content-type':'application/json'}),text:async()=>{if(ctx.textCalls++)throw P.error('POST_GUARD_BODY_USED');this.check(ctx);return text;}});
  }catch(error){
   first=/^POST_GUARD_[A-Z0-9_]+$/.test(error?.code||'')?error:P.error('POST_GUARD_TRANSPORT');ctx.first=first;throw first;
  }finally{
   ctx.cleanupErrors=[];
   if(first)ctx.controller.abort();
   if(!ctx.reader&&ctx.response?.body){try{await Promise.race([ctx.response.body.cancel().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,50))]);}catch{ctx.cleanupErrors.push('CANCEL');}}
   if(ctx.reader&&!ctx.readDone){try{await Promise.race([ctx.reader.cancel().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,50))]);}catch{ctx.cleanupErrors.push('CANCEL');}}
   if(ctx.reader){try{ctx.reader.releaseLock();ctx.readerReleased=true;}catch{ctx.cleanupErrors.push('RELEASE');if(!first){ctx.first=P.error('POST_GUARD_READER_RELEASE');throw ctx.first;}}}
  }
 }
 summary(){return{requests:this.requests,receivedBytes:this.received,capturedBytes:this.captured,collectionComplete:this.finished,failed:this.failed,activeCall:Boolean(this.active),readersOpen:this.active?.reader&&!this.active.readerReleased?1:0,pages:this.records};}
}
module.exports={Transport};
