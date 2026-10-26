'use strict';
const assert=require('node:assert/strict');
const groups=require('../lib/fixture-source-groups');
const {createSnapshotStore,readLiveSnapshots,overlaySnapshots,contentHash,GLOBAL_BUNDLE_PATH}=require('../lib/live-fixtures');
const {supabaseServiceRequest}=require('../lib/supabase-server');
const {groupWire,sampleRows}=require('./lib/grouped-fixture-test-wire');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
let checks=0;
const verify=fn=>{fn();checks++;};
const manifestFor=rows=>[...new Set(rows.map(row=>row.source_id)),'empty-source'].map(source_id=>({source_id,revision:1,checked_at:'2026-10-26T00:00:02Z',discovery_report:{status:'verified'}}));
function fixtureStore(state,{candidate=true,timer=()=>0}={}){
 const calls=[];
 const request=(path,options={})=>{
  calls.push({path,options});
  return supabaseServiceRequest(path,{...options,environment:{SUPABASE_URL:'https://local.invalid',SUPABASE_SECRET_KEY:'sb_secret_constructed_only'},fetchImpl:async()=>{
   const health=path.endsWith('nothingsports_read_fixture_source_health');
   if(state.failure===path)return {ok:false,status:503,text:async()=>'{}'};
   const payload=health?state.manifest:path===GLOBAL_BUNDLE_PATH?[{bundle:state.wire}]:state.scoped||[];
   return {ok:true,status:200,text:async()=>health&&state.healthText!==undefined?state.healthText:JSON.stringify(payload)};
  }});
 };
 const store=createSnapshotStore({request,timer,...(candidate?{transport:groups.CANDIDATE}:{})});
 return {store,calls};
}
function referenceSources(manifest,rows){return manifest.map(source=>({...source,scoreRevision:contentHash(rows.filter(r=>r.source_id===source.source_id).map(r=>r.fixture)),fixtures:rows.filter(r=>r.source_id===source.source_id).map(r=>r.fixture)}));}
async function response(handler,url){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;},end(){}};await handler({url,headers:{}},res);return res;}
(async()=>{
 const rows=sampleRows(),wire=groupWire(rows),manifest=manifestFor(rows),state={wire,manifest};
 verify(()=>assert.equal(wire.groupCount,2586));verify(()=>assert.equal(wire.edgeCount,5145));
 verify(()=>assert.deepEqual(groups.decode(wire).rows,rows));
 const candidate=fixtureStore(state),sources=await candidate.store.read(),reference=referenceSources(manifest,rows);
 verify(()=>assert.deepEqual(sources,reference));
 verify(()=>{assert.equal(candidate.calls.length,2);assert.deepEqual(candidate.calls[1].options.headers,groups.HEADERS);assert(candidate.calls.every(c=>c.options.timeoutMs<=6000));});
 verify(()=>assert.deepEqual(overlaySnapshots([],sources),overlaySnapshots([],reference)));
 verify(()=>assert.equal(contentHash(sources),contentHash(reference)));
 // The existing default source-row guard is still exact, even for a grouped-capable server.
 const legacy={schemaVersion:'current-fixture-bundle.v1',complete:false,rows:rows.slice(0,5001)};
 await assert.rejects(fixtureStore({wire:legacy,manifest},{candidate:false}).store.read(),/Incomplete current fixture bundle/);checks++;
 await assert.rejects(fixtureStore(state,{candidate:false}).store.read(),/Incomplete current fixture bundle/);checks++;
 const small=rows.slice(0,4),old={schemaVersion:'current-fixture-bundle.v1',complete:true,rows:small};
 verify(()=>assert.deepEqual(groups.decode(groupWire(small)).rows,small));
 verify(()=>assert.deepEqual(groups.decode(groupWire([])).rows,[]));
 assert.deepEqual(await fixtureStore({wire:old,manifest}).store.read(),await fixtureStore({wire:old,manifest},{candidate:false}).store.read());checks++;
 const atLimit=sampleRows({keys:5000,edges:5000});verify(()=>assert.equal(groups.decode(groupWire(atLimit)).rows.length,5000));
 const tenThousand=sampleRows({keys:5000,edges:10000});verify(()=>assert.equal(groups.decode(groupWire(tenThousand)).rows.length,10000));
 const fanout=Array.from({length:16},(_,i)=>({...small[0],source_id:'fan:'+i}));verify(()=>assert.equal(groups.decode(groupWire(fanout)).rows.length,16));
 const negatives=[
  b=>{b.complete=false;},b=>{b.complete='true';},b=>{b.groupCount++;},b=>{b.edgeCount++;},b=>{b.groups=[];},
  b=>{b.extra=true;},b=>{b.groups[0].extra=true;},b=>{b.groups[0].fixture_id='';},b=>{b.groups.push(b.groups[0]);b.groupCount++;},
  b=>{b.groups[0].edges[0].ordinal=-1;},b=>{b.groups[0].edges[0].ordinal=0.5;},b=>{b.groups[1].edges[0].ordinal=0;},
  b=>{b.groups[0].edges[0].source_id='';},b=>{b.groups[0].edges[0].identity_keys=[0];},b=>{b.groups[0].edges[0].fixture=null;},b=>{b.groups[0].edges[0].fixture=[];},
  b=>{delete b.groups[0].edges[0].identity_keys;},b=>{b.groups[0].edges[0].extra='unknown';}
 ];
 for(const mutate of negatives){const bad=structuredClone(wire);mutate(bad);verify(()=>assert.throws(()=>groups.decode(bad),/grouped fixture/));}
 for(const bad of [groupWire(sampleRows({keys:5001,edges:5001})),groupWire(sampleRows({keys:5000,edges:10001})),groupWire([...fanout,{...small[0],source_id:'fan:16'}])])verify(()=>assert.throws(()=>groups.decode(bad),/grouped fixture/));
 const duplicate=structuredClone(groupWire(fanout));duplicate.groups[0].edges[1].source_id=duplicate.groups[0].edges[0].source_id;verify(()=>assert.throws(()=>groups.decode(duplicate),/grouped fixture/));
 let projected=0;const late=structuredClone(wire);Object.defineProperty(late.groups[0].edges[0].fixture,'witness',{enumerable:true,get(){projected++;return 0;}});late.groups.at(-1).edges[0].ordinal=-1;
 verify(()=>{assert.throws(()=>groups.decode(late),/grouped fixture/);assert.equal(projected,0);});
 const presence=[{...small[0],identity_keys:null,fixture:JSON.parse('{"id":"qa","__proto__":{"x":null},"constructor":0,"n":null,"z":0,"nested":[false,{},null]}')}];
 verify(()=>assert.deepEqual(groups.decode(groupWire(presence)).rows,presence));
 const totalWireBytes=Buffer.byteLength(JSON.stringify([{bundle:groupWire(small)}]));
 for(const delta of [-1,0,1]){
  const s={wire:groupWire(small),manifest},health=JSON.stringify(manifest),wanted=groups.LIMITS.bytes-totalWireBytes+delta;
  s.healthText=' '.repeat(wanted-Buffer.byteLength(health))+health;
  if(delta<=0)assert.deepEqual(await fixtureStore(s).store.read(),referenceSources(manifest,small));
  else await assert.rejects(fixtureStore(s).store.read(),/transport byte budget/);checks++;
 }
 const missingBytes=createSnapshotStore({transport:groups.CANDIDATE,request:async p=>p===GLOBAL_BUNDLE_PATH?[{bundle:wire}]:manifest});await assert.rejects(missingBytes.read(),/transport byte budget/);checks++;
 const extraBytes=groups.byteBudget();extraBytes.observe('source-health',{phase:'text-ready',bytes:0});extraBytes.observe('source-health',{phase:'text-ready',bytes:0});extraBytes.observe('fixture-bundle',{phase:'text-ready',bytes:1});verify(()=>assert.throws(()=>extraBytes.check(),/byte budget/));
 let time=0;
 const lateClock=createSnapshotStore({transport:groups.CANDIDATE,timer:()=>time,request:async(p,o)=>{o.onTiming?.({phase:'text-ready',bytes:1});time=6001;return p===GLOBAL_BUNDLE_PATH?[{bundle:groupWire(small)}]:manifest;}});
 await assert.rejects(lateClock.read(),e=>e.payload?.code==='supabase_timeout');checks++;time=0;
 for(const p of [GLOBAL_BUNDLE_PATH,'/rest/v1/rpc/nothingsports_read_fixture_source_health']){const failed=fixtureStore({wire,manifest,failure:p});await assert.rejects(failed.store.read());assert.equal(failed.calls.length,2);checks++;}
 for(const invalid of [true,'v1',{}, {...groups.CANDIDATE}])verify(()=>assert.throws(()=>createSnapshotStore({transport:invalid}),/trusted fixture transport/));
 verify(()=>assert.throws(()=>createSnapshotStore({transport:groups.CANDIDATE,policy:require('../lib/fixture-read-policy').REMINDER}),/trusted fixture transport/));
 for(const selectedCount of [1,60,61]){
  const selected=fixtureStore({wire,manifest,scoped:[]});await selected.store.read({ids:Array.from({length:selectedCount},(_,i)=>'qa:'+i)});
  verify(()=>{assert.equal(selected.calls.length,2);assert(selected.calls.every(c=>c.options.headers===undefined&&c.options.timeoutMs===3000));assert.equal(selected.calls[1].options.body.p_fixture_ids.length,Math.min(60,selectedCount));});
 }
 for(const scope of ['match-centre','participants']){
  const opt=scope==='participants'?{scope,interactive:true,sportKeys:['nrl'],knownSportKeys:['nrl'],participantIds:['team:qa']}:{scope,interactive:true};
  const scoped={schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[],scope,...(scope==='participants'?{sportKeys:['nrl'],knownSportKeys:['nrl'],participantIds:['team:qa'],requiredIds:[]}:{})};
  const s=fixtureStore({wire,manifest,scoped});await s.store.read(opt);verify(()=>assert(s.calls.every(c=>c.options.headers===undefined&&c.options.timeoutMs<=5000)));
 }
 // Grouped and default caches/in-flight reads are independent; 30s and original last-good remain.
 const cacheState={wire:groupWire(small),manifest},groupCache=fixtureStore(cacheState),defaultCache=fixtureStore({wire:old,manifest},{candidate:false});
 const [good,plain]=await Promise.all([readLiveSnapshots({store:groupCache.store,now:1000,maxAgeMs:0,timer:()=>0}),readLiveSnapshots({store:defaultCache.store,now:1000,maxAgeMs:0,timer:()=>0})]);
 verify(()=>{assert.equal(groupCache.calls.length,2);assert.equal(defaultCache.calls.length,2);assert.deepEqual(good,plain);});
 await readLiveSnapshots({store:groupCache.store,now:30999,timer:()=>0});verify(()=>assert.equal(groupCache.calls.length,2));
 cacheState.wire={...cacheState.wire,complete:false};const stale=await readLiveSnapshots({store:groupCache.store,now:31001,timer:()=>0});
 verify(()=>{assert.equal(stale.stale,true);assert.equal(stale.readAt,good.readAt);assert.equal(stale.revision,good.revision);assert.deepEqual(stale.sources,good.sources);assert.equal(groupCache.calls.length,4);});
  // Empty-only IDs become a global read inside the store and must not share
  // grouped/default cache ownership before that normalization occurs.
  const emptyCandidate=fixtureStore({wire,manifest}),emptyDefault=fixtureStore({wire:legacy,manifest},{candidate:false});
  await readLiveSnapshots({store:emptyCandidate.store,ids:[''],now:60001,maxAgeMs:0,timer:()=>0});
  let refused=false;
  try{const value=await readLiveSnapshots({store:emptyDefault.store,ids:[''],now:60002,timer:()=>0});refused=value.stale===true;}
  catch{refused=true;}
  verify(()=>{assert(refused,'empty IDs cannot let default reads reuse a healthy grouped snapshot');assert.equal(emptyDefault.calls.length,2);});
  const nullDefault=fixtureStore({wire:old,manifest},{candidate:false});
  await assert.rejects(readLiveSnapshots({store:nullDefault.store,ids:null,now:60003,timer:()=>0}),TypeError);
  verify(()=>assert.equal(nullDefault.calls.length,0,'candidate repair cannot add reads to an ordinary rejected-null caller'));
  // Exercise the real default factory and SDK without a service connection.
  // Enabling groups must not turn a rejected null selection into a wide read.
  const originalFetch=globalThis.fetch,environmentKeys=Object.keys(process.env).filter(k=>k.startsWith('SUPABASE_'));
  const originalEnvironment=Object.fromEntries(environmentKeys.map(k=>[k,process.env[k]])),defaultCalls=[];
  let defaultValue,nullFailure;
  try{
   for(const key of environmentKeys)delete process.env[key];
   process.env.SUPABASE_URL='https://local.invalid';process.env.SUPABASE_SECRET_KEY='sb_secret_constructed_only';
   globalThis.fetch=async(url,options)=>{const health=String(url).includes('nothingsports_read_fixture_source_health');defaultCalls.push({method:options.method,groupHeader:new Headers(options.headers).get('x-ns-fixture-source-groups')});return new Response(JSON.stringify(health?[]:[{bundle:groupWire([])}]),{status:200});};
   defaultValue=await readLiveSnapshots({now:120000,maxAgeMs:0});
   verify(()=>{assert.equal(defaultValue.stale,false);assert.deepEqual(defaultValue.sources,[]);assert.equal(defaultCalls.length,2);assert.equal(defaultCalls[1].groupHeader,'v1');});
   defaultCalls.length=0;
   try{await readLiveSnapshots({ids:null,now:120001,maxAgeMs:0});}catch(error){nullFailure=error;}
  }finally{
   globalThis.fetch=originalFetch;
   for(const key of Object.keys(process.env).filter(k=>k.startsWith('SUPABASE_')))delete process.env[key];
   Object.assign(process.env,originalEnvironment);
  }
  verify(()=>{assert(nullFailure instanceof TypeError,'Default null must reject before SDK reads; observed '+defaultCalls.length+' reads');assert.equal(defaultCalls.length,0);});
 // Actual public-handler output and validators, including retained Fantasy, agree.
 const sample=require('./fixtures/fantasy-fpl.json'),fpl=require('../lib/fantasy/providers/fpl'),fantasy=fpl.normalize(sample),modeRows=[...sample.events.map(fixture=>({source_id:'published',fixture_id:fixture.id,identity_keys:[fixture.id,fixture.canonicalEventId],fixture})),...fantasy.map(fixture=>({source_id:'live-fantasy-fpl',fixture_id:fixture.id,identity_keys:[fixture.id],fixture}))];
 const mm=manifestFor(modeRows),candidateMode=await fixtureStore({wire:groupWire(modeRows),manifest:mm}).store.read(),legacyMode=await fixtureStore({wire:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:modeRows},manifest:mm},{candidate:false}).store.read();
 const make=sources=>createLiveFixtureHandler({publishedFixtures:()=>sample.events,read:async()=>({sources,revision:'same-input',stale:false}),clock:()=>new Date('2026-08-20T00:00:00Z'),environment:{FANTASY_FPL_ENABLED:'true',FANTASY_FPL_ACCESS_APPROVED:'true'}});
 for(const url of ['/api/fixtures','/api/fixtures?fantasy=1','/api/fixtures?fantasy=1&ids='+encodeURIComponent(sample.events[0].canonicalEventId),'/api/fixtures?athlete=team%3Afootball%3Aepl%3A1']){
  const a=await response(make(candidateMode),url),b=await response(make(legacyMode),url);delete a.body.generatedAt;delete b.body.generatedAt;verify(()=>assert.deepEqual({code:a.code,headers:a.headers,body:a.body},{code:b.code,headers:b.headers,body:b.body}));
 }
 console.log(JSON.stringify({schemaVersion:'grouped-fixture-source-prototype-tests.v1',checks,constructedEdges:5145,constructedKeys:2586,legacyGuardUnchanged:true,sourceOverlayAndHashesEqual:true,fantasyModesEqual:true,completeByteLimit:groups.LIMITS.bytes,productionCalls:0,productionWrites:0,latencyImprovement:'UNMEASURED'}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
