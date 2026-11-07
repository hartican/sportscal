'use strict';
// Local review witness, not a release gate or a source request. Pin the actual
// old parser/reader to the allocated base so later legitimate repairs cannot
// invalidate the historical RED. Every transport is an owned double.
const assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),https=require('node:https');
const {EventEmitter}=require('node:events'),BASE='85b3a8672199e851a2dc60585f8edbb889439485',file=path.join(__dirname,'refresh-canonical-sports.js');
const code=cp.execFileSync('git',['show',BASE+':scripts/refresh-canonical-sports.js'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',maxBuffer:1048576});
const legacy=new Module(file,module);legacy.filename=file;legacy.paths=Module._nodeModulePaths(path.dirname(file));legacy._compile(code+'\nmodule.exports.ownedFetchJson=fetchJson;\n',file);
const {round}=require('./fixtures/aflw-owned-round'),contract=require('./lib/aflw-round-contract'),transport=require('./lib/aflw-source-json');
const now=new Date('2026-10-31T01:30:00.000Z'),cases=[];
async function main(){
 for(const [name,edit]of [['missing total',row=>row.home.score.totalScore=null],['negative total',row=>row.home.score.totalScore=-1]]){
  const {match,binding}=contract.roundRows(round(11),11)[0];edit(match);
  const old=legacy.exports.buildAflEvent(match,now.toISOString(),new Map(),{code:'aflw',competitionId:'competition:aflw-2026',discoverySportId:'sport:aflw'}).event;
  assert.equal(old.status,'completed');if(name==='missing total')assert.equal(old.result,undefined);else assert(old.result.scorelineText.endsWith('— -1-0'));
  assert(contract.finalFacts(match,binding,{observedAt:now.toISOString(),now}).deferred);
  cases.push({name,before:'RED: actual pinned parser accepts completed status without supported result facts',after:'GREEN: current scoped admission defers only unsupported card'});
 }
 const fetch=global.fetch,get=https.get,body=JSON.stringify({owned:'x'.repeat(transport.LIMITS.resourceBytes)});let calls=0;
 try{
  global.fetch=async()=>({ok:true,json:async()=>JSON.parse(body)});
  assert((await legacy.exports.ownedFetchJson(transport.URLS[0])).owned.length>=transport.LIMITS.resourceBytes);
  https.get=(_url,_options,callback)=>{calls++;const req=new EventEmitter();req.destroy=()=>{};queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;res.headers={};res.destroy=()=>{};callback(res);res.emit('data',Buffer.from(body));res.emit('end');});return req;};
  const budget=transport.createBudget();try{await assert.rejects(budget.read(transport.URLS[0]),/byte limit/);assert.equal(calls,1);assert.equal(budget.summary().active,0);}finally{budget.close();}
  cases.push({name:'oversize complete JSON body',before:'RED: actual pinned fetchJson accepts more than the proposed resource cap',after:'GREEN: bounded reader refuses and cleans up before any admission'});
 }finally{global.fetch=fetch;https.get=get;}
 console.log(JSON.stringify({status:'PASS',base:BASE,baselineSourceSha256:crypto.createHash('sha256').update(code).digest('hex'),externalRequests:0,tokenAcquisitions:0,currentResultsObserved:0,cases},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
