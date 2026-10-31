'use strict';
const assert=require('node:assert/strict'),https=require('node:https'),zlib=require('node:zlib'),{EventEmitter}=require('node:events');
const {createReader,strictJson,LIMITS}=require('./lib/a-league-source-json'),{scope}=require('./lib/a-league-score-contract');
const original=https.get;let calls=0,body=Buffer.from('[{"owned":true}]'),status=200,headers,finish=true,elapsed=0,destroyed=0;
https.get=(url,options,callback)=>{assert.equal(url,scope.sourceUrl);assert.deepEqual(Object.keys(options.headers).sort(),['Accept','User-Agent']);calls++;const request=new EventEmitter();request.destroy=()=>{destroyed++;};queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=status;response.headers=headers||{'content-type':'application/json','content-length':String(body.length)};response.complete=finish;response.destroy=()=>{destroyed++;};callback(response);response.emit('data',body);response.emit('end');});return request;};
const cases=[];
async function check(name,fn){calls=0;body=Buffer.from('[{"owned":true}]');status=200;headers=null;finish=true;elapsed=0;destroyed=0;await fn();assert(calls<=1);cases.push(name);}
async function read(consume=x=>x){const reader=createReader({began:0,clock:()=>elapsed});try{return await reader.read(consume);}finally{reader.close();assert.equal(reader.summary().active,0);assert(reader.summary().closed);}}
async function run(){
 await check('exact one native request with no credentials and complete raw hashes',async()=>{const r=await read();assert.deepEqual(r.value,[{owned:true}]);assert.equal(r.receipt.encodedBytesStored,body.length);assert.equal(r.receipt.hashScope,'complete-response-body');assert.equal(calls,1);assert(destroyed>=2);});
 for(const code of [301,302,401,403,404,429,500])await check('HTTP'+code+' refuses without redirect retry or fallback',async()=>{status=code;await assert.rejects(read(),error=>error.sourceCapture.receipt.status===code);assert.equal(calls,1);});
 for(const encoding of ['gzip','deflate','br'])await check(encoding+' decoded body stays independently bounded and hashed',async()=>{body=encoding==='gzip'?zlib.gzipSync(body):encoding==='deflate'?zlib.deflateSync(body):zlib.brotliCompressSync(body);headers={'content-type':'application/json','content-encoding':encoding,'content-length':String(body.length)};assert.deepEqual((await read()).value,[{owned:true}]);});
 await check('encoded oversize retains only bounded prefix and fails',async()=>{body=Buffer.alloc(LIMITS.encodedBytes+1,32);await assert.rejects(read(),e=>e.sourceCapture.encodedBody.length===LIMITS.encodedBytes&&e.sourceCapture.receipt.hashScope==='bounded-retained-prefix');});
 await check('compressed decoded oversize fails independently',async()=>{body=zlib.gzipSync(Buffer.alloc(LIMITS.decodedBytes+1,32));headers={'content-type':'application/json','content-encoding':'gzip'};await assert.rejects(read(),e=>e.sourceCapture.decodedBody.length===LIMITS.decodedBytes);});
 await check('incomplete native response cannot validate',async()=>{finish=false;await assert.rejects(read(),/incomplete/);});
 await check('contradictory content length cannot validate',async()=>{headers={'content-type':'application/json','content-length':'999'};await assert.rejects(read(),/incomplete/);});
 await check('unsupported encoding cannot validate',async()=>{headers={'content-type':'application/json','content-encoding':'unknown'};await assert.rejects(read(),/encoding/);});
 await check('invalid UTF8 cannot supply results',async()=>{body=Buffer.from([255]);await assert.rejects(read());});
 await check('wrong MIME type cannot supply results',async()=>{headers={'content-type':'text/html'};await assert.rejects(read(),/content type/);});
 await check('duplicate and escaped equivalent JSON keys refuse',async()=>{body=Buffer.from('[{"a":1,"a":2}]');await assert.rejects(read(),/duplicate/);assert.throws(()=>strictJson('{"a":1,"\\u0061":2}'),/duplicate/);});
 await check('JSON depth is bounded',async()=>{body=Buffer.from('['.repeat(70)+'0'+']'.repeat(70));await assert.rejects(read(),/depth/);});
 await check('whole resource clock includes synchronous domain consumer',async()=>{await assert.rejects(read(()=>{elapsed=15001;return [];}),/deadline/);});
 await check('repeated read cannot spend another request',async()=>{const reader=createReader({began:0,clock:()=>elapsed});try{await reader.read(x=>x);await assert.rejects(reader.read(x=>x),/spent/);assert.equal(calls,1);}finally{reader.close();}});
 await check('invalid clock rejects before acquisition',async()=>{const reader=createReader({began:0,clock:()=>NaN});await assert.rejects(reader.read(x=>x),/clock/);assert.equal(calls,0);reader.close();});
 console.log(JSON.stringify({status:'PASS',controls:cases.length,externalRequests:0,tokens:0,constructedResponses:true,cases},null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{https.get=original;});
