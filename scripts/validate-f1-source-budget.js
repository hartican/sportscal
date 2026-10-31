'use strict';
// Owned transport controls only; these HTML snippets are not provider captures
// or proof of complete race classification / field admission.
const assert=require('node:assert/strict'),https=require('node:https'),zlib=require('node:zlib');
const {EventEmitter}=require('node:events');
const {createBudget:sourceBudget,INDEX,LIMITS}=require('./lib/f1-source-budget');
const plan=['race-result','qualifying','practice/1','practice/2','practice/3'].map(kind=>({slug:'united-states',kind}));
const createBudget=options=>sourceBudget({sessions:plan,...options});
const original=https.get,originalFetch=global.fetch,realSet=global.setTimeout,realClear=global.clearTimeout;
const link='<a href="/en/results/2026/races/1234/united-states/race-result">Race</a>';
const url=INDEX+'/1234/united-states/race-result';
let calls=0,reply,expired,destroyed;
https.get=(_url,_options,callback)=>{
 calls++;const request=new EventEmitter();request.destroy=()=>{destroyed.request++;};
 queueMicrotask(()=>{const response=new EventEmitter();response.destroy=()=>{destroyed.response++;};response.statusCode=reply?.status||200;response.headers=reply?.headers||{};callback(response);if(reply?.hang)return;for(const body of reply?.chunks||[Buffer.from(link)])response.emit('data',body);response.emit('end');});
 return request;
};
const records=[];
async function check(name,operation){calls=0;reply=null;destroyed={request:0,response:0};await operation();records.push(name);}
async function run(){
 await check('actual existing loader refuses an oversized resource before admitting results',async()=>{
  let loader=require('./refresh-f1-results');
  // A pinned old implementation can run the same actual-caller negative under
  // the same owned transport. This is source text, not a provider response.
  if(process.env.F1_RESULT_BASELINE){const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');const filename=path.join(__dirname,'refresh-f1-results-baseline.js'),loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(__dirname);loaded._compile(fs.readFileSync(process.env.F1_RESULT_BASELINE,'utf8'),filename);loader=loaded.exports;}
  const huge=link+' '.repeat(LIMITS.resourceBytes);
  reply={chunks:[Buffer.from(huge)]};
  global.fetch=async()=>({ok:true,text:async()=>huge});
  await assert.rejects(loader.updatesFor([{id:'evt_f1_2026_united_states_practice_3',key:'f1',canonicalEventId:'event:f1:2026:united-states:practice-3',name:'United States GP · Practice 3',startTimeUtc:'2026-10-24T17:30:00.000Z',status:'upcoming'}],new Date('2026-10-31T00:10:46.203Z')),/byte limit/);
  assert.equal(calls,1,'actual default loader uses the bounded HTTPS owner once');global.fetch=originalFetch;
 });
 await check('index first, exact derived paths, memoized resource reuse',async()=>{const b=createBudget();await assert.rejects(b.read(url),/scope/);await b.read(INDEX);reply={chunks:[Buffer.from('classification stand-in')]};assert.equal(await b.read(url),'classification stand-in');assert.equal(await b.read(url),'classification stand-in');assert.equal(calls,2);b.close();assert.equal(b.summary().active,0);});
 for(const encoding of ['gzip','deflate','br'])await check(encoding+' complete strict decode',async()=>{const body=encoding==='gzip'?zlib.gzipSync(link):encoding==='deflate'?zlib.deflateSync(link):zlib.brotliCompressSync(link);reply={headers:{'content-encoding':encoding},chunks:[body]};const b=createBudget();assert.equal(await b.read(INDEX),link);b.close();});
 for(const [name,value]of [['redirect',{status:302}],['wire overflow',{chunks:[Buffer.alloc(LIMITS.resourceBytes+1)]}],['decoded overflow',{headers:{'content-encoding':'gzip'},chunks:[zlib.gzipSync(Buffer.alloc(LIMITS.resourceBytes+1))]}],['invalid UTF8',{chunks:[Buffer.from([255])]}],['partial length',{headers:{'content-length':'999'}}],['unsupported encoding',{headers:{'content-encoding':'unknown'}}]])await check(name,async()=>{reply=value;const b=createBudget();await assert.rejects(b.read(INDEX));assert.equal(b.summary().active,0);await assert.rejects(b.read(INDEX));assert.equal(calls,1);b.close();});
 await check('seventh or unselected resource refuses before transport',async()=>{const b=createBudget();await b.read(INDEX);reply={chunks:[Buffer.from('stand-in')]};for(const suffix of ['qualifying','practice/1','practice/2','practice/3','race-result'])await b.read(url.replace('race-result',suffix));await assert.rejects(b.read(url.replace('race-result','sprint-results')),/scope/);assert.equal(calls,6);b.close();});
 await check('invalid or excessive selected plans refuse before transport',async()=>{assert.throws(()=>sourceBudget({sessions:[...plan,plan[0]]}),/plan/);assert.throws(()=>sourceBudget({sessions:[{slug:'../other',kind:'race-result'}]}),/plan/);assert.equal(calls,0);});
 await check('consumer parse and whole invocation clocks remain strict',async()=>{let time=0;const b=createBudget({clock:()=>time});await assert.rejects(b.read(INDEX,text=>{time=15000;return text;}),/parse deadline/);b.close();const c=createBudget({clock:()=>time});time+=120000;await assert.rejects(c.read(INDEX),/invocation deadline/);c.close();});
 await check('asynchronous consumers cannot escape the parse deadline',async()=>{const b=createBudget();await assert.rejects(b.read(INDEX,async text=>text),/synchronously/);b.close();});
 await check('parse failure destroys its owned completed response and request',async()=>{const b=createBudget();await assert.rejects(b.read(INDEX,()=>{throw Error('owned parse failure');}),/owned parse failure/);assert(destroyed.request>0);assert(destroyed.response>0);assert.equal(b.summary().active,0);b.close();});
 await check('body stall deadline cancels and closes owned reader',async()=>{global.setTimeout=fn=>{expired=fn;return{unref(){}};};global.clearTimeout=()=>{};reply={hang:true};const b=createBudget();const read=b.read(INDEX);await Promise.resolve();expired();await assert.rejects(read,/deadline/);assert.equal(b.summary().active,0);b.close();global.setTimeout=realSet;global.clearTimeout=realClear;});
 console.log(JSON.stringify({status:'PASS',controls:records.length,externalRequests:0,admissionQualified:false,records},null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{https.get=original;global.fetch=originalFetch;global.setTimeout=realSet;global.clearTimeout=realClear;});
