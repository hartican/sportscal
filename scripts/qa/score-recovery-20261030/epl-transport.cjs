'use strict';
// Private guard-owned HTTPS boundary. It never grants an ALS network context or
// returns a native Request/Response/Agent/socket to the pinned consumer.
const {EventEmitter}=require('node:events'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {performance}=require('node:perf_hooks'),C=require('./epl-contract.cjs'),P=require('./protocol.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const code=value=>C.FAILURE_CODES.includes(value)?value:'EPL_NETWORK';
const error=value=>Object.assign(Error(code(value)),{code:code(value)});
class Transport{
 constructor({sourceOwner,reader,rawGet,agent,primary,table,directory,capture,values=[],deny,blocked=()=>false,now=()=>performance.now()}){
  // All capabilities stay in this private closure; this live instance is held
  // solely by guard.cjs, never by the consumer or a module export.
  const privacy=P.privacy(values),seen=new Set(),records=[],allFixtures=[],ids=new Set();
  let active=null,synchronousGet=false,totalWire=0,totalDecoded=0,fixtureFailed=false,tableStarted=false;
  const check=ctx=>{if(blocked())throw error('EPL_NATIVE_CONTAINMENT');if(now()-ctx.started>=C.TIME)throw error('EPL_RESOURCE_DEADLINE');};
  const cleanup=ctx=>{for(const resource of[ctx.decoder,ctx.response,ctx.request])try{resource?.destroy?.();}catch{};};
  function admitted(ctx,body){
   check(ctx);let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(body);}catch{throw error('EPL_UTF8');}check(ctx);
   let payload;try{P.rejectDuplicateKeys(text);payload=JSON.parse(text);}catch{throw error('EPL_SOURCE_JSON');}check(ctx);
   if(privacy.contains(body))throw error('EPL_PRIVACY');
   if(ctx.index<4){
    try{primary.validateFixturePage(payload,ctx.index,{allowFixtureDeferrals:true});}catch{throw error('EPL_FIXTURE_COLLECTION');}
    for(const fixture of payload.content){
     const sides=fixture.teams?.map(row=>'team:football:epl:'+(row?.team?.club?.id||row?.team?.id));
     const binding=primary.binding({id:'epl-2026-27-'+fixture.id,competitionId:'competition:premier-league-2026-27',season:'2026/27',key:'premier-league',participantIds:sides});
     if(!Number.isSafeInteger(fixture.id)||fixture.id<=0||!Array.isArray(fixture.teams)||fixture.teams.length!==2||fixture.teams.some(row=>!Number.isSafeInteger(row?.team?.club?.id||row?.team?.id))||!binding?.primary||ids.has(fixture.id)||fixture.gameweek?.compSeason?.id!==841||fixture.gameweek.compSeason.competition?.id!==1||!Number.isInteger(fixture.gameweek.gameweek)||fixture.gameweek.gameweek<1||fixture.gameweek.gameweek>38)throw error('EPL_FIXTURE_COLLECTION');
     ids.add(fixture.id);allFixtures.push(fixture);check(ctx);
    }
    if(ctx.index===3)try{primary.validateFixtureCollection(allFixtures,{allowFixtureDeferrals:true});}catch{throw error('EPL_FIXTURE_COLLECTION');}
   }else try{table.buildSnapshot(payload,directory,new Date().toISOString());}catch{throw error('EPL_TABLE_ADMISSION');}
   check(ctx);ctx.parsedHash=hash(JSON.stringify(payload));ctx.guardParsed=true;
  }
  const finishRecord=ctx=>{
   clearTimeout(ctx.timer);cleanup(ctx);
   const row={resource:ctx.index,httpStatus:ctx.httpStatus??null,encoding:ctx.encoding??null,state:ctx.first?'failed':'complete',wireBytes:Math.min(ctx.wire,ctx.cap+1),decodedBytes:Math.min(ctx.decoded,ctx.cap+1),elapsedMs:Math.max(0,Math.min(C.TIME,now()-ctx.started)),...(ctx.first?{code:ctx.first.code}:{}),wireSha256:ctx.wireHash.digest('hex'),decodedSha256:ctx.decodedHash.digest('hex'),bodyComplete:ctx.bodyComplete===true,guardParsed:ctx.guardParsed===true,consumerParsed:ctx.consumerParsed===true,readerClosed:!ctx.response||ctx.responseClosed===true,requestClosed:!ctx.request||ctx.requestClosed===true,decoderClosed:!ctx.decoder||ctx.decoderClosed===true};
   records.push(row);active=null;ctx.wireChunks=[];ctx.decodedChunks=[];capture(row);
  };
  const get=(url,options,callback)=>{
   const ctx=active;
   if(blocked()||!sourceOwner||!synchronousGet||!ctx||ctx.getUsed||url!==C.URLS[ctx.index]||typeof callback!=='function'||!options||Object.keys(options).length!==1||JSON.stringify(options.headers)!==JSON.stringify(C.HEADERS))return deny('GUARD_EPL_GET_SCOPE');
   ctx.getUsed=true;const requestView=new EventEmitter();
   requestView.setTimeout=(ms,fn)=>{if(ms!==C.TIME||typeof fn!=='function')deny('GUARD_EPL_TIMEOUT_SCOPE');return requestView;};
   requestView.destroy=()=>{cleanup(ctx);return requestView;};
   const publishFailure=()=>{if(ctx.delivered)return;ctx.delivered=true;queueMicrotask(()=>requestView.emit('error',ctx.first));};
   const fail=value=>{ctx.first ||= error(value);if(ctx.index<4)fixtureFailed=true;cleanup(ctx);if((!ctx.request||ctx.requestClosed)&&(!ctx.response||ctx.responseClosed)&&(!ctx.decoder||ctx.decoderClosed))publishFailure();};
   const maybe=()=>{
    if(ctx.first){fail(ctx.first.code);return;}
    if(!ctx.ended||!ctx.decodedEnded||!ctx.requestClosed||!ctx.responseClosed||ctx.decoder&&!ctx.decoderClosed)return;
    try{admitted(ctx,Buffer.concat(ctx.decodedChunks));}catch(e){fail(e.code||'EPL_SOURCE_PARTIAL');return;}
    if(ctx.delivered)return;ctx.delivered=true;
    queueMicrotask(()=>{
     if(ctx.first){requestView.emit('error',ctx.first);return;}
     const responseView=ctx.responseView=new EventEmitter();responseView.statusCode=200;responseView.complete=true;
     responseView.headers={'content-encoding':ctx.encoding,'content-length':String(ctx.wire)};
     responseView.destroy=()=>responseView;callback(responseView);
     for(const chunk of ctx.wireChunks)responseView.emit('data',chunk);
     responseView.emit('end');responseView.emit('close');
    });
   };
   const decoded=chunk=>{
    try{check(ctx);const bytes=Buffer.from(chunk);const count=Math.min(bytes.length,ctx.cap+1-ctx.decoded,C.TOTAL+1-totalDecoded);ctx.decoded+=count;totalDecoded+=count;if(ctx.decoded>ctx.cap||totalDecoded>C.TOTAL)return fail('EPL_SOURCE_BYTES');ctx.decodedHash.update(bytes);ctx.decodedChunks.push(bytes);}catch{fail('EPL_RESOURCE_DEADLINE');}
   };
   ctx.timer=setTimeout(()=>{ctx.first ||= error('EPL_RESOURCE_DEADLINE');cleanup(ctx);ctx.cancel(ctx.first);if(ctx.responseView){ctx.responseView.emit('error',ctx.first);ctx.responseView.emit('close');}else publishFailure();},Math.max(1,C.TIME-(now()-ctx.started)));ctx.timer.unref?.();
   try{
    ctx.request=rawGet(url,{headers:C.HEADERS,agent},response=>{
     ctx.response=response;ctx.responseClosed=false;
     response.on('close',()=>{ctx.responseClosed=true;if(!ctx.ended)fail('EPL_SOURCE_PARTIAL');else maybe();});
     response.on('error',()=>fail('EPL_NETWORK'));response.on('aborted',()=>fail('EPL_SOURCE_PARTIAL'));
     try{
      check(ctx);ctx.httpStatus=Number.isInteger(response.statusCode)&&response.statusCode>=100&&response.statusCode<=599?response.statusCode:null;const encoding=String(response.headers?.['content-encoding']||'identity').toLowerCase(),length=response.headers?.['content-length'],type=response.headers?.['content-type'];
      if(response.statusCode!==200)return fail('EPL_SOURCE_HTTP');
      if(!['identity','gzip','deflate','br'].includes(encoding)){ctx.encoding='unapproved';return fail('EPL_SOURCE_ENCODING');}
      if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(type||'')||length!=null&&!/^\d{1,10}$/.test(String(length)))return fail('EPL_SOURCE_PARTIAL');
      ctx.encoding=encoding;ctx.length=length;if(length!=null&&Number(length)>ctx.cap)return fail('EPL_SOURCE_BYTES');
      ctx.decoder=encoding==='gzip'?zlib.createGunzip():encoding==='deflate'?zlib.createInflate():encoding==='br'?zlib.createBrotliDecompress():null;
      if(ctx.decoder){ctx.decoderClosed=false;ctx.decoder.on('data',decoded);ctx.decoder.on('error',()=>fail('EPL_SOURCE_ENCODING'));ctx.decoder.on('end',()=>{ctx.decodedEnded=true;ctx.decoder.destroy();maybe();});ctx.decoder.on('close',()=>{ctx.decoderClosed=true;maybe();});}
      response.on('data',chunk=>{if(ctx.first)return;try{check(ctx);const bytes=Buffer.from(chunk);const count=Math.min(bytes.length,ctx.cap+1-ctx.wire,C.TOTAL+1-totalWire);ctx.wire+=count;totalWire+=count;if(ctx.wire>ctx.cap||totalWire>C.TOTAL)return fail('EPL_SOURCE_BYTES');ctx.wireHash.update(bytes);ctx.wireChunks.push(bytes);if(ctx.decoder)ctx.decoder.write(bytes);else decoded(bytes);}catch{fail('EPL_RESOURCE_DEADLINE');}});
      response.on('end',()=>{if(ctx.first)return;ctx.ended=true;if(response.complete===false||ctx.length!=null&&Number(ctx.length)!==ctx.wire)return fail('EPL_SOURCE_PARTIAL');ctx.bodyComplete=true;if(ctx.decoder)ctx.decoder.end();else ctx.decodedEnded=true;cleanupNative();maybe();});
      function cleanupNative(){try{ctx.request.destroy();response.destroy();}catch{fail('EPL_NETWORK');}}
     }catch{fail('EPL_SOURCE_PARTIAL');}
    });
    ctx.requestClosed=false;ctx.request.on('close',()=>{ctx.requestClosed=true;maybe();});ctx.request.on('error',()=>fail('EPL_NETWORK'));
   }catch{fail('EPL_NETWORK');}
   return requestView;
  };
  const read=async(url,options={})=>{
   if(blocked()||!sourceOwner||active||Object.keys(options).some(k=>k!=='onObservation')||options.onObservation!==undefined&&typeof options.onObservation!=='function')return deny('GUARD_EPL_SOURCE_SCOPE');
   const index=C.URLS.indexOf(String(url));
   if(index<0||seen.has(index)||seen.size>=5||tableStarted||index<4&&(fixtureFailed||index!==seen.size)||index===4&&!seen.has(0))return deny('GUARD_EPL_RESOURCE_SCOPE');
   seen.add(index);if(index===4)tableStarted=true;
   const ctx=active={index,started:now(),cap:index===4?C.TABLE:C.FIXTURE,wire:0,decoded:0,wireHash:crypto.createHash('sha256'),decodedHash:crypto.createHash('sha256'),wireChunks:[],decodedChunks:[]};
   ctx.cancelled=new Promise((resolve,reject)=>{ctx.cancel=reject;});ctx.cancelled.catch(()=>{});
   try{
    let pending;synchronousGet=true;
    try{pending=reader(url,{onObservation:receipt=>{check(ctx);if(receipt.wireBytes!==ctx.wire||receipt.decodedBytes!==ctx.decoded||receipt.wireSha256!==hash(Buffer.concat(ctx.wireChunks))||receipt.sha256!==hash(Buffer.concat(ctx.decodedChunks)))throw error('EPL_RESOURCE_INCOMPLETE');options.onObservation?.(receipt);check(ctx);}});}finally{synchronousGet=false;}
    const value=await Promise.race([pending,ctx.cancelled]);check(ctx);
    if(!ctx.guardParsed||hash(JSON.stringify(value))!==ctx.parsedHash)throw error('EPL_RESOURCE_INCOMPLETE');
    ctx.consumerParsed=true;return value;
   }catch(e){ctx.first ||= error(e.code);if(index<4)fixtureFailed=true;throw ctx.first;}
   finally{finishRecord(ctx);}
  };
  this.get=get;this.read=read;
  this.summary=()=>({protocol:'epl',requests:seen.size,receivedBytes:Math.min(totalWire,C.TOTAL+1),decodedBytes:Math.min(totalDecoded,C.TOTAL+1),capturedBytes:0,collectionComplete:records.filter(r=>r.resource<4&&r.state==='complete').length===4||records.some(r=>r.resource===4&&r.state==='complete'),failed:false,degraded:records.some(r=>r.state==='failed'),activeCall:Boolean(active),readersOpen:active?1:0,requestsOpen:active?1:0,pages:records});
 }
}
module.exports={Transport};
