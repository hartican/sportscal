'use strict';
// Actual adapter and pinned reader with owned EventEmitter HTTP boundaries.
// No guard preload, supervisor, canonical CLI, native socket/group or service.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),https=require('node:https'),zlib=require('node:zlib'),{EventEmitter}=require('node:events');
const root=process.argv[2],C=require('./epl-contract.cjs'),{Transport}=require('./epl-transport.cjs'),source=require(path.join(root,'scripts/lib/epl-source-json.js')),primary=require(path.join(root,'scripts/refresh-premier-league-cards.js')),table=require(path.join(root,'scripts/refresh-premier-league-context.js')),binding=require(path.join(root,'lib/epl-provider-identities.js')).binding;
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'epl-control-fixture.json'))),directory=JSON.parse(fs.readFileSync(path.join(root,'data/canonical/football-directory.v1.json'))),cases=[];global.fetch=()=>assert.fail('FETCH_FORBIDDEN');
for(const name of['net','tls','dns'])for(const key of['connect','createConnection','lookup','resolve'])if(require('node:'+name)[key])require('node:'+name)[key]=()=>assert.fail('NATIVE_NETWORK_FORBIDDEN');
for(const key of['spawn','spawnSync','exec','execSync','fork','execFile','execFileSync'])require('node:child_process')[key]=()=>assert.fail('CHILD_FORBIDDEN');
async function run(name,{encoding='identity',edit=()=>{},clockAdvance=0,expected,tableAfter=false}={}){
 const receipts=[];let time=0,native=0,sockets=0;const rawGet=(url,options,callback)=>{
  native++;assert(options.agent);const index=C.URLS.indexOf(url),request=new EventEmitter();let closed=false;request.destroy=()=>{if(!closed){closed=true;queueMicrotask(()=>request.emit('close'));}return request;};
  queueMicrotask(()=>{const response=new EventEmitter();let responseClosed=false;response.destroy=()=>{if(!responseClosed){responseClosed=true;queueMicrotask(()=>response.emit('close'));}return response;};response.complete=true;
   let payload=index===4?structuredClone(fixture.table):{pageInfo:{page:index,numPages:4,pageSize:100,numEntries:380},content:structuredClone(fixture.rawFixtures.slice(index*100,index*100+100))};
   const input={payload,status:200,encoding};edit(input,index);let body=input.body??Buffer.from(JSON.stringify(input.payload));
   if(input.encoding==='gzip')body=zlib.gzipSync(body);else if(input.encoding==='deflate')body=zlib.deflateSync(body);else if(input.encoding==='br')body=zlib.brotliCompressSync(body);
   response.statusCode=input.status;response.headers={'content-type':'application/json','content-length':String(body.length+(input.partial?1:0)),'content-encoding':input.encoding};
   callback(response);time+=clockAdvance;response.emit('data',body);response.emit('end');
  });return request;
 };
 const tx=new Transport({sourceOwner:true,reader:source.readJson,rawGet,agent:{privateAgent:true},primary:{...primary,binding},table,directory,capture:r=>receipts.push(r),values:['sb_secret_constructed_test_marker_123456789'],deny:code=>{throw Object.assign(Error(code),{code});},now:()=>time});
 https.get=(url,options,callback)=>{const view=tx.get(url,options,response=>{assert.equal(response.socket,undefined);assert.equal(response.connection,undefined);assert.equal(response.agent,undefined);callback(response);});assert.equal(view.agent,undefined);assert.equal(view.socket,undefined);return view;};
 if(expected)await assert.rejects(()=>tx.read(C.URLS[0]),new RegExp(expected));else for(let i=0;i<5;i++)await tx.read(C.URLS[i]);
 if(tableAfter){time=0;await tx.read(C.URLS[4]);assert.equal(tx.summary().collectionComplete,true);}
 assert.equal(tx.summary().activeCall,false);assert(receipts.every(r=>r.readerClosed&&r.requestClosed&&r.decoderClosed));assert.equal(sockets,0);assert(receipts.every(r=>!Object.hasOwn(r,'body')&&!Object.hasOwn(r,'payload')));cases.push({name,status:'PASS',constructedHttpsRequests:native});return{tx,receipts};
}
(async()=>{
 for(const encoding of['identity','gzip','deflate','br'])await run('complete380 +independenttable with '+encoding,{encoding});
 await run('duplicate raw identity fails before consumer and table remains independent',{edit:(p,i)=>{if(i===0)p.payload.content[1].id=p.payload.content[0].id;},expected:'EPL_FIXTURE_COLLECTION',tableAfter:true});
 await run('truncated fixture envelope retains independent table',{edit:(p,i)=>{if(i===0)p.payload.content.pop();},expected:'EPL_FIXTURE_COLLECTION',tableAfter:true});
 await run('wrong season refused',{edit:(p,i)=>{if(i===0)p.payload.content[0].gameweek.compSeason.id=1;},expected:'EPL_FIXTURE_COLLECTION'});
 await run('wire cap independent of JSON admission',{edit:(p,i)=>{if(i===0)p.body=Buffer.alloc(C.FIXTURE+1,32);},expected:'EPL_SOURCE_BYTES'});
 await run('decoded gzip cap independently enforced',{encoding:'gzip',edit:(p,i)=>{if(i===0)p.body=Buffer.alloc(C.FIXTURE+1,32);},expected:'EPL_SOURCE_BYTES'});
 await run('strict UTF8 refusal',{edit:(p,i)=>{if(i===0)p.body=Buffer.from([255]);},expected:'EPL_UTF8'});
 await run('duplicate JSON key refused without raw evidence',{edit:(p,i)=>{if(i===0)p.body=Buffer.from('{"pageInfo":{},"pageInfo":{}}');},expected:'EPL_SOURCE_JSON'});
 await run('partial Content-Length refused',{edit:(p,i)=>{if(i===0)p.partial=true;},expected:'EPL_SOURCE_PARTIAL'});
 await run('redirect is not followed',{edit:(p,i)=>{if(i===0)p.status=302;},expected:'EPL_SOURCE_HTTP'});
 await run('unknown content encoding refused',{edit:(p,i)=>{if(i===0)p.encoding='unknown';},expected:'EPL_SOURCE_ENCODING'});
 await run('encoded privacy marker never reaches raw evidence',{edit:(p,i)=>{if(i===0)p.payload.unknown=Buffer.from('sb_secret_constructed_test_marker_123456789').toString('base64');},expected:'EPL_PRIVACY'});
 await run('single deadline covers header through admission',{clockAdvance:20000,expected:'EPL_RESOURCE_DEADLINE'});
 console.log(JSON.stringify({status:'PASS',checks:cases.length,cases,actualProviderRequests:0,nativeConnections:0,guardOrSupervisorExecutions:0,canonicalCliInvocations:0},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
