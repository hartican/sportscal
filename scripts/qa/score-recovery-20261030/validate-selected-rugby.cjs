'use strict';
// Constructed inputs and in-memory SQL only. This never launches the updater,
// a supervisor, provider request or real service request.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const P=require('./protocol.cjs'),{Transport}=require('./transport.cjs');
const selected=JSON.parse(fs.readFileSync(path.join(__dirname,'public-fixture-shape.rugby.json'))),combined=JSON.parse(fs.readFileSync(path.join(__dirname,'public-fixture-shape.json')));
const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'rugby-control-fixture.json'))).result;
const marker=process.env.NS_SELECTED_TEST_KEY||'sb_secret_'+crypto.randomBytes(36).toString('base64url'),privacy=P.privacy([marker]);
const names=[],rejections=[];let activeCase='setup',nativeAttempts=0;
async function check(name,run){activeCase=name;await run();names.push(name);}
const at=process.argv.indexOf('--source-root');
assert(at>=0);const root=path.resolve(process.argv[at+1]);
for(const k of ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])assert(!process.env[k]);
const deny=()=>{nativeAttempts++;throw Error('CONSTRUCTED_NETWORK_FORBIDDEN');};global.fetch=deny;
for(const n of ['http','https'])for(const k of ['get','request'])require('node:'+n)[k]=deny;
for(const[n,keys]of[['net',['connect','createConnection']],['tls',['connect']],['dns',['lookup','resolve','resolve4','resolve6']]])for(const k of keys)require('node:'+n)[k]=deny;
require('node:net').Socket.prototype.connect=deny;
const caller=require(path.join(root,'scripts/sync-live-coverage')),sdk=require(path.join(root,'lib/supabase-server'));
const row=(n=0,source=P.RUGBY_SOURCES[0],fixture)=>{const f=fixture||{id:'controlled-rugby-'+n,key:'rugby',status:'scheduled',name:'Constructed Rugby '+n,sourceCheckedAt:'2026-10-13T11:30:00Z'};return{source_id:source,fixture_id:f.id,fixture:f};};
async function read(pages,{scope='rugby-union',queryScope=scope,schema=selected,textFor,statusFor,advanceAt}={}){
 const bodies=[],records=[],urls=[],original=P.performance.now.bind(P.performance);let clockAdvance=0,error,value,fetches=0;
 Object.defineProperty(P.performance,'now',{configurable:true,value:()=>original()+clockAdvance});
 const tx=new Transport({schema,values:[marker],coverageSport:scope,capture:{start(){},commit(n,b){bodies.push(Buffer.from(b));return true;},finish:r=>records.push(r)}});
 global.fetch=(url,options)=>tx.fetch(url,options,async()=>{urls.push(url);const n=fetches++,text=textFor?textFor(n):JSON.stringify(pages[n]||[]),status=statusFor?statusFor(n):200;return new Response(text,{status,headers:{'content-type':'application/json'}});});
 const request=(url,options)=>tx.service(url,options,async()=>{
  const answer=await sdk.supabaseServiceRequest(url,{...options,environment:{SUPABASE_URL:P.ORIGIN,SUPABASE_SECRET_KEY:marker}});
  if(advanceAt==='consumer')clockAdvance=10001;return answer;
 });
 try{value=await caller.readRows(request,{coverageSport:queryScope});}catch(e){error=e;}
 finally{global.fetch=deny;Object.defineProperty(P.performance,'now',{configurable:true,value:original});}
 assert(!tx.summary().activeCall);
assert.equal(tx.summary().readersOpen,0);
assert(records.every(r=>r.readerReleased&&r.captureFileClosed));
 assert(!privacy.contains(JSON.stringify(records)));return{value,error,tx,bodies,records,urls,fetches};
}
async function refused(rows,code,options){const r=await read([rows],options);
assert.equal(r.error?.code,code);
assert.equal(r.bodies.length,0);
assert.equal(r.records[0]?.consumerParsed,false);
assert.equal(r.records[0]?.captureFileOpened,false);if(r.records[0]?.shapeFailure)rejections.push(r.records[0]);return r;}
async function main(){
 await check('finite-eight-sources-equal-actual-source-helper',()=>{assert.deepEqual(caller.SOURCES,P.SOURCES);
assert.equal(P.SOURCES.length,12);
assert.equal(P.RUGBY_SOURCES.length,8);
assert.deepEqual(require(path.join(root,'scripts/lib/live-coverage-scope')).sourcesFor('rugby-union'),P.RUGBY_SOURCES);});
 await check('selected-schema-only-known-nullable-clock-extension',()=>{assert.deepEqual(Object.keys(selected.paths).sort(),Object.keys(combined.paths).sort());for(const[k,v]of Object.entries(combined.paths))assert.deepEqual(selected.paths[k],k==='.livePlayObservedAt'?['null','string']:v);for(const k of ['maxDepth','maxNodes','maxStringBytes'])assert.equal(selected[k],combined[k]);});
 await check('all-eight-selected-sources-through-actual-sdk-and-caller',async()=>{const r=await read([P.RUGBY_SOURCES.map((s,n)=>row(n,s))]);
assert(!r.error);
assert.equal(r.value.length,8);
assert.equal(r.bodies.length,1);
assert.equal(r.records[0].consumerParsed,true);
assert.equal(r.urls[0],P.endpoint(0,'rugby-union'));
assert(!r.urls[0].includes('cricket'));});
 await check('combined-twelve-query-refused-before-fetch-in-selected-transport',async()=>{const r=await read([[row()]],{queryScope:null});
assert.equal(r.error?.code,'POST_GUARD_SERVICE_SCOPE');
assert.equal(r.fetches,0);
assert.equal(r.bodies.length,0);});
 await check('combined-default-control-remains-available',async()=>{const f={id:'controlled-cricket',key:'cricket',status:'scheduled'};const r=await read([[row(0,'cricket-ca-current',f)]],{scope:null,schema:combined});
assert(!r.error);
assert.equal(r.value.length,1);
assert.equal(r.urls[0],P.endpoint(0));});
 await check('cricket-source-refused-before-consumer-or-capture',()=>refused([row(0,'cricket-ca-current')],'POST_GUARD_ROW_SHAPE'));
 await check('cricket-fixture-under-rugby-source-refused-before-consumer-or-capture',()=>refused([row(0,undefined,{id:'controlled-cricket',key:'cricket'})],'POST_GUARD_ROW_SHAPE'));
 await check('arbitrary-selected-sport-refused-before-fetch',()=>assert.throws(()=>new Transport({schema:selected,values:[marker],coverageSport:'cricket'}),e=>e.code==='POST_GUARD_SCOPE'));
 await check('private-root-field-refused',()=>refused([{...row(),user_id:'private'}],'POST_GUARD_ROW_SHAPE'));
 await check('private-fixture-field-refused',()=>refused([row(0,undefined,{...seed,preferences:{private:true}})],'POST_GUARD_PRIVATE_PAYLOAD'));
 await check('unknown-root-null-remains-refused',()=>refused([row(0,undefined,{...seed,unreviewedRoot:null})],'POST_GUARD_FIXTURE_SHAPE'));
 await check('wrong-known-type-remains-refused',()=>refused([row(0,undefined,{...seed,name:{unknown:true}})],'POST_GUARD_FIXTURE_SHAPE'));
 for(const type of ['number','boolean','object','array'])await check('nullable-clock-refuses-'+type,()=>refused([row(0,undefined,{...seed,livePlayObservedAt:{number:1,boolean:false,object:{},array:[]}[type]})],'POST_GUARD_FIXTURE_SHAPE'));
 for(const encoding of ['raw','hex','percent'])await check('secret-bearing-unknown-name-'+encoding+'-refused-without-echo',async()=>{const value=encoding==='hex'?Buffer.from(marker).toString('hex').toUpperCase():encoding==='percent'?[...marker].map(c=>'%'+c.charCodeAt(0).toString(16)).join(''):marker;const r=await refused([row(0,undefined,{...seed,['unknown-'+value]:true})],'POST_GUARD_PRIVATE_PAYLOAD');
assert(!r.records[0].shapeFailure);});
 await check('short-page-completeness-two-pages-actual-caller',async()=>{const r=await read([Array.from({length:500},(_,n)=>row(n)),[row(500)]]);
assert(!r.error);
assert.equal(r.value.length,501);
assert.equal(r.tx.requests,2);
assert.equal(r.tx.finished,true);});
 await check('eight-full-pages-never-count-as-complete',async()=>{const r=await read(Array.from({length:8},(_,p)=>Array.from({length:500},(_,n)=>row(p*500+n))));
assert(r.error);
assert.equal(r.tx.requests,8);
assert.equal(r.tx.finished,false);});
 await check('later-failure-retains-only-earlier-valid-capture',async()=>{const r=await read([Array.from({length:500},(_,n)=>row(n))],{statusFor:n=>n?503:200});
assert.equal(r.error?.code,'POST_GUARD_HTTP_503');
assert.equal(r.bodies.length,1);
assert.equal(r.records[1].consumerParsed,false);});
 await check('overlap-page-refused-before-second-capture',async()=>{const first=Array.from({length:500},(_,n)=>row(n)),r=await read([first,[first[0]]]);
assert.equal(r.error?.code,'POST_GUARD_OVERLAP');
assert.equal(r.bodies.length,1);});
 await check('duplicate-json-field-refused-before-consumer',async()=>{const text=JSON.stringify([row()]).replace('"status":','"status":"shadow","status":');await refused([], 'POST_GUARD_DUPLICATE_KEY',{textFor:()=>text});});
 await check('page-over-four-mib-refused',()=>refused([],'POST_GUARD_PAGE_BYTES',{textFor:()=>JSON.stringify([row()])+' '.repeat(P.PAGE_BYTES)}));
 await check('total-over-sixteen-mib-refused-on-fifth-page',async()=>{const r=await read([],{textFor:n=>{const text=JSON.stringify(Array.from({length:500},(_,i)=>row(n*500+i)));return text+' '.repeat(P.PAGE_BYTES-Buffer.byteLength(text));}});
assert.equal(r.error?.code,'POST_GUARD_TOTAL_BYTES');
assert.equal(r.tx.requests,5);
assert.equal(r.bodies.length,4);
assert.equal(r.tx.captured,P.TOTAL_BYTES);});
 await check('same-deadline-includes-actual-consumer-parse',()=>refused([row()],'POST_GUARD_BODY_DEADLINE',{advanceAt:'consumer'}));
 const identity=require(path.join(root,'config/fixture-identity')),base={...seed,scoreCheckedAt:seed.scoreFactObservedAt,statusCheckedAt:seed.statusFactObservedAt,livePlayObservedAt:'2026-10-13T10:00:00Z'},next={...base,status:'live',homeScore:1,sourceCheckedAt:'2026-10-13T12:00:00Z',scoreCheckedAt:'2026-10-13T12:00:00Z'};delete next.livePlayObservedAt;
 const protectedFinal=identity.mergeOverlays([base],[next])[0];
 await check('actual-terminal-writer-keeps-final-and-original-score-clock',()=>{assert.equal(protectedFinal.status,'completed');
assert.equal(protectedFinal.homeScore,0);
assert.equal(protectedFinal.livePlayObservedAt,null);
assert.equal(protectedFinal.scoreCheckedAt,base.scoreCheckedAt);});
 await check('omitted-live-witness-retains-prior-witness',()=>{const live={...base,status:'live'},same={...live,sourceCheckedAt:next.sourceCheckedAt};delete same.livePlayObservedAt;
assert.equal(identity.mergeOverlays([live],[same])[0].livePlayObservedAt,base.livePlayObservedAt);});
 await check('omitted-live-witness-remains-absent-with-no-prior',()=>{const live={...base,status:'live'};delete live.livePlayObservedAt;
assert(!Object.hasOwn(identity.mergeOverlays([live],[{...live,sourceCheckedAt:next.sourceCheckedAt}])[0],'livePlayObservedAt'));});
 await check('original-combined-schema-still-rejects-terminal-null',()=>{assert.throws(()=>P.validatePublic([row(0,undefined,protectedFinal)],combined,privacy),e=>e.code==='POST_GUARD_FIXTURE_SHAPE');});
 const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[root,...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]})),db=new PGlite();
 try{
  await db.exec("set timezone='UTC';create table public.nothingsports_fixture_current(source_id text,fixture_id text,fixture jsonb,identity_keys text[]);create table public.nothingsports_fixture_sources(source_id text,discovery_report jsonb);create table public.nothingsports_live_scores(source_id text,fixture_id text,score jsonb,first_completed_at timestamptz);");
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261002171936_preserve_compact_fixture_observations.sql'),'utf8');for(const name of ['nothingsports_fixture_observation_time','nothingsports_project_fixture_observations','nothingsports_read_current_fixtures']){const start=sql.indexOf('create or replace function public.'+name+'('),end=sql.indexOf('$$;',start)+3;
assert(start>=0&&end>start);await db.exec(sql.slice(start,end));}
  await db.query('insert into public.nothingsports_fixture_current values($1,$2,$3,$4)',[P.RUGBY_SOURCES[0],protectedFinal.id,JSON.stringify(protectedFinal),[protectedFinal.id]]);
  await db.query('insert into public.nothingsports_fixture_sources values($1,$2)',[P.RUGBY_SOURCES[0],JSON.stringify({})]);
  const rows=(await db.query('select * from public.nothingsports_read_current_fixtures(null) order by source_id,fixture_id')).rows;
  await check('actual-writer-through-pinned-sql-sdk-selected-guard-caller',async()=>{assert.equal(rows.length,1);
assert.equal(rows[0].fixture.livePlayObservedAt,null);const r=await read([rows]);
assert(!r.error);
assert.deepEqual(r.value,rows);
assert.equal(Date.parse(r.value[0].fixture.scoreCheckedAt),Date.parse(protectedFinal.scoreCheckedAt));
assert.equal(Date.parse(r.value[0].fixture.scoreFactObservedAt),Date.parse(protectedFinal.scoreFactObservedAt));
assert.equal(Date.parse(r.value[0].fixture.statusFactObservedAt),Date.parse(protectedFinal.statusFactObservedAt));const result=caller.project({events:[],participants:[],competitions:[],sources:[]},r.value,{coverageSport:'rugby-union',strictSourceEvidence:true,now:new Date('2026-10-13T12:00:01Z')});
assert.equal(result.report.rowsRead,1);});
 }finally{await db.close();}
 await check('actual-combined-mode-refused-before-execution',()=>{const p=JSON.parse(fs.readFileSync(path.join(__dirname,'profile.json')));p.mode='live-coverage-canonical';P.validateActualScope(p);for(const change of [v=>v.coverageSport=null,v=>v.entryArgv=v.entryArgv.filter(x=>!x.startsWith('--coverage-sport')),v=>v.sourceArgv=v.sourceArgv.filter(x=>!x.startsWith('--coverage-sport')),v=>v.sourceGitSha='3b1f6ceab669d3c643535ef303976742b14705eb',v=>v.childArgvs.push(['scripts/publish-feed.js','--preserve-known'])]){const bad=structuredClone(p);change(bad);
assert.throws(()=>P.validateActualScope(bad),e=>e.code==='GUARD_ACTUAL_SCOPE');}});
 assert.equal(nativeAttempts,0);report({status:'PASS',checks:names.length,names,rejections,realKeys:0,realServiceRequests:0,nativeAttempts,scope:'constructed fixed-eight SDK/transport/privacy and in-memory SQL; no updater/supervisor/native execution'});
}
function report(v){const body=JSON.stringify(v);
assert(!privacy.contains(body));const at=process.argv.indexOf('--report');if(at>=0)fs.writeFileSync(process.argv[at+1],body+'\n',{mode:0o600});console.log(body);}
main().catch(()=>{report({status:'FAIL',code:'SELECTED_RUGBY_CONTROL_FAILED',failedCase:activeCase,completed:names.length,nativeAttempts,realKeys:0,realServiceRequests:0});process.exitCode=1;});
