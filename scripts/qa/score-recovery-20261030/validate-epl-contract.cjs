'use strict';
// Cheap pure/actual-parser models only. No guard preload, canonical dispatcher,
// supervisor main/inspect, process/signal/group test, native child or request.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),https=require('node:https'),cp=require('node:child_process');
const {EventEmitter}=require('node:events'),C=require('./epl-contract.cjs'),P=require('./protocol.cjs');
const ROOT=path.resolve(process.argv[2]||''),p=JSON.parse(fs.readFileSync(path.join(__dirname,'epl-preparation.json'),'utf8')),cases=[];
if(!path.isAbsolute(ROOT)||!fs.existsSync(path.join(ROOT,'scripts/lib/epl-only-refresh.js')))throw Error('FROZEN_APP_MODEL_ROOT_REQUIRED');
const oldGet=https.get;let requests=0;
for(const module of['http','https','net','tls','dns'])for(const key of['get','request','connect','createConnection','lookup','resolve'])if(require('node:'+module)[key])require('node:'+module)[key]=()=>assert.fail('NETWORK_FORBIDDEN');
global.fetch=()=>assert.fail('FETCH_FORBIDDEN');
for(const key of['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=()=>assert.fail('CHILD_FORBIDDEN');
function check(name,fn){fn();cases.push({name,status:'PASS'});}
function denied(name,fn){check(name,()=>assert.throws(fn,/EPL_[A-Z_]+/));}
const context=(index=0)=>({sourceOwner:true,caller:'scripts/lib/epl-source-json.js',url:C.URLS[index],method:'GET',headers:C.HEADERS});
const complete={bodyComplete:true,jsonParsed:true,sourceAdmitted:true,readerClosed:true,requestClosed:true};
const closure={sourceOwners:1,readersOpen:0,requestsOpen:0,writeDescriptorsOpen:0,processGroupClosed:true};
const fresh=()=>{const r=new C.Resources();r.request(0,context(),0);r.headers(200,'identity',1);return r;};
const values=ids=>Object.fromEntries(C.KEYS.map(key=>[key,ids]));
const arg=value=>'--epl-updated-ids='+JSON.stringify(value),first=p.surfaceIds[C.KEYS[0]][0];
check('fixed inactive policy preserves caps,429 baselines and8runtime outputs',()=>assert.equal(C.policy(p),true));
for(const[key,value]of[['wholeSeconds',181],['minimumSecondsBeforeLaunch',159],['minimumFreeBytes',4831838207],['maximumNewDiskBytes',728303894],['maxRollbackBytes',268435457],['maxFileBytes',33554433],['runtimeReady',true],['sourceGitSha','1'.repeat(40)]])denied('changed fixed '+key+' refused',()=>C.policy({...p,[key]:value}));
denied('nonlocal mixed route refused',()=>C.policy({...p,entryArgv:p.entryArgv.slice(0,-1)}));
denied('real credential route refused',()=>C.policy({...p,credentialEnvironmentNames:['SUPABASE_SECRET_KEY']}));
denied('credential discovery environment refused',()=>C.policy({...p,environmentKeys:[...p.environmentKeys,'FOOTBALL_DATA_API_TOKEN']}));
check('per-surface exact current IDs and empty counterpart accepted',()=>C.selector(arg({[C.KEYS[0]]:[first],[C.KEYS[1]]:[]}),p));
for(const[name,value]of[['duplicate',values([first,first])],['unbound-prefix',values(['epl-2026-27-999999999'])],['third-key',{...values([]),other:[]}],['array',[]]])denied(name+' publisher selector refused',()=>C.selector(arg(value),p));
const alias='football-premier-league-2026-27-999999';denied('uncaptured alias does not acquire current-surface authority',()=>C.selector(arg(values([alias])),p));
check('finite table-only child DAG',()=>assert.equal(C.childSequence([...C.PREFIX,...C.TAIL],p),'table-only'));
const pub=[...C.PUB,arg(values([first]))],full=[...C.PREFIX,pub,['scripts/qa-storyline-spoilers.js',C.KEYS[0]],['scripts/qa-storyline-spoilers.js',C.KEYS[1]],['scripts/build-paged-feed.js'],...C.TAIL];
check('finite fixture child DAG',()=>assert.equal(C.childSequence(full,p),'fixture-and-optional-table'));
for(const[name,value]of[['duplicate-child',[...full,...C.TAIL]],['publisher-replace',full.map(a=>a===pub?[...a,'--replace']:a)],['unscoped-publisher',full.map(a=>a===pub?a.slice(0,-1):a)],['unknown-child',[...C.PREFIX,['scripts/other.js'],...C.TAIL]],['missing-integrity-step',full.filter(a=>a[0]!=='scripts/validate-feed.js')]])denied(name+' refused',()=>C.childSequence(value,p));
for(const[name,change]of[['non-owner',{sourceOwner:false}],['wrong-caller',{caller:'scripts/another-source.js'}],['post-method',{method:'POST'}],['other-origin',{url:'https://example.com'}],['extra-query',{url:C.URLS[0]+'&extra=true'}],['credential-header',{headers:{...C.HEADERS,Authorization:'synthetic-marker'}}]])denied(name+' request refused',()=>new C.Resources().request(0,{...context(),...change},0));
check('all5 exact resources retain separate wire/decoded aggregate bounds',()=>{const r=new C.Resources();for(let i=0;i<5;i++){r.request(i,context(i),i*100);r.headers(200,i?'gzip':'identity',i*100+1);for(const kind of['wire','decoded'])r.bytes(kind,i===4?C.TABLE:C.FIXTURE,i*100+2);r.finish(complete,i*100+3);}const receipt=r.closure(closure);assert.equal(receipt.requests,5);assert.equal(receipt.wireBytes,C.TOTAL);assert.equal(receipt.decodedBytes,C.TOTAL);receipt.resources.forEach(C.publicReceipt);});
for(const kind of['wire','decoded'])denied(kind+' overflow independently refused',()=>fresh().bytes(kind,C.FIXTURE+1,2));
denied('overlapping resource refused',()=>fresh().request(1,context(1),2));
check('failed fixture permits independent table, preserves enum-only failure',()=>{const r=fresh();r.failure('EPL_RESOURCE_INCOMPLETE',2);r.request(4,context(4),3);r.headers(200,'identity',4);r.bytes('wire',2,5);r.bytes('decoded',2,5);r.finish(complete,6);const receipt=r.closure(closure);assert.equal(receipt.requests,2);receipt.resources.forEach(C.publicReceipt);});
denied('failed fixture cannot be retried',()=>{const r=fresh();r.failure('EPL_RESOURCE_INCOMPLETE',2);r.request(0,context(),3);});
denied('failed collection cannot launch another fixture resource',()=>{const r=fresh();r.failure('EPL_RESOURCE_INCOMPLETE',2);r.request(1,context(1),3);});
denied('redirect refused',()=>{const r=new C.Resources();r.request(0,context(),0);r.headers(302,'identity',1);});
denied('unapproved encoding refused',()=>{const r=new C.Resources();r.request(0,context(),0);r.headers(200,'unknown',1);});
for(const[name,patch]of[['JSON', {jsonParsed:false}],['admission',{sourceAdmitted:false}],['truncation',{bodyComplete:false}],['reader',{readerClosed:false}],['request',{requestClosed:false}]])denied('incomplete '+name+' cannot complete',()=>fresh().finish({...complete,...patch},2));
denied('deadline includes late admission',()=>fresh().finish(complete,20000));
denied('backwards clock refused',()=>fresh().bytes('wire',1,-1));
for(const[key,value]of[['sourceOwners',2],['readersOpen',1],['requestsOpen',1],['writeDescriptorsOpen',1],['processGroupClosed',false]])denied('closure refuses '+key,()=>new C.Resources().closure({...closure,[key]:value}));

denied('unreviewed pattern-conforming failure label refused before retention',()=>fresh().failure('EPL_PRIVATE_FIELD_EMAIL',2));
denied('unreviewed pattern-conforming failure label refused at export',()=>C.publicReceipt({resource:0,state:'failed',wireBytes:0,decodedBytes:0,elapsedMs:1,code:'EPL_PRIVATE_MARKER'}));
denied('failed resource cannot omit its fixed cause',()=>C.publicReceipt({resource:0,state:'failed',wireBytes:0,decodedBytes:0,elapsedMs:1}));
check('every reviewed fixed failure cause survives receipt validation',()=>{for(const code of C.FAILURE_CODES)assert.equal(C.publicReceipt({resource:0,state:'failed',wireBytes:0,decodedBytes:0,elapsedMs:1,code}).code,code);});
const marker='sb_secret_control_only_abc123XYZ',privacy=P.privacy([marker]);
for(const value of[marker,Buffer.from(marker).toString('base64'),Buffer.from(marker).toString('hex'),marker.split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')])check('retained privacy scanner detects constructed encoded credential',()=>assert(privacy.contains(value)));
denied('unknown raw fields never become public receipt',()=>C.publicReceipt({resource:0,state:'failed',wireBytes:0,decodedBytes:0,elapsedMs:1,code:'EPL_SOURCE',raw:{unknown:marker}}));
check('actual shared-table writer preserves unrelated source facts and clocks',()=>{const before=JSON.parse(fs.readFileSync(ROOT+'/data/canonical/afl-nrl-2026.json','utf8')),table=require(ROOT+'/scripts/refresh-premier-league-context.js'),snapshot=structuredClone(table.validatePublishedContext(before)),ids=[...new Set(Object.values(p.surfaceBindings[C.KEYS[0]]).flatMap(e=>e.participantIds))];snapshot.snapshotTimeUtc='2026-10-31T00:00:00.000Z';const after=table.updateBundle(before,{participants:before.participants.filter(e=>ids.includes(e.id)),snapshot},snapshot.snapshotTimeUtc),url=after.sources.at(-1).sourceUrl;assert(C.protectedBundle(before,after,ids,url));const changed=structuredClone(after),unrelated=changed.ladderSnapshots.find(e=>e.competitionId!==table.COMPETITION_ID);unrelated.snapshotTimeUtc='2099-01-01T00:00:00Z';assert.throws(()=>C.protectedBundle(before,changed,ids,url),/EPL_SHARED_FACTS_CHANGED/);});
check('unrelated source sharing an official URL retains its own provider clock',()=>{const url='https://www.premierleague.com/en/tables/premier-league/2026-27',before={participants:[],ladderSnapshots:[],sources:[{provider:'Other retained source',sourceUrl:url,checkedAt:'2026-10-01T00:00:00Z'}]},after=structuredClone(before);after.sources[0].checkedAt='2026-10-31T00:00:00Z';assert.throws(()=>C.protectedBundle(before,after,[],url),/EPL_SHARED_FACTS_CHANGED/);});
async function actualParserModel(){
 const source=require(ROOT+'/scripts/lib/epl-source-json.js'),ledger=new C.Resources();let observation;
 https.get=(url,options,callback)=>{
  requests++;ledger.request(0,{sourceOwner:true,caller:'scripts/lib/epl-source-json.js',url,method:'GET',headers:options.headers},0);
  const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=()=>request;
  queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;res.headers={};res.complete=true;res.destroy=()=>{};ledger.headers(200,'identity',1);callback(res);const bytes=Buffer.from('{"controlledPublicFact":true}');ledger.bytes('wire',bytes.length,2);res.emit('data',bytes);res.emit('end');});return request;
 };
 const result=await source.readJson(C.URLS[0],{onObservation:row=>{observation=row;ledger.bytes('decoded',row.decodedBytes,3);ledger.finish(complete,4);}});assert.deepEqual(result,{controlledPublicFact:true});assert.equal(observation.wireBytes,observation.decodedBytes);ledger.closure(closure);cases.push({name:'actual pinned HTTPS reader uses declared exact URL/headers and complete JSON callback through owned request double',status:'PASS'});
}
actualParserModel().then(()=>{https.get=oldGet;const result={status:'PASS',cases,checks:cases.length,ownedHttpsDoubles:requests,actualProviderRequests:0,actualCredentials:0,canonicalCliInvocations:0,nativeGuardOrSupervisorInvocations:0,nativeChildren:0,groupSignalTests:0,runtimeReady:false,qualification:'Pure/model/source-interface preparation only. 64 default +25 Rugby and new EPL native qualification remain required; integration not enabled.'};assert(!privacy.contains(JSON.stringify(result)));console.log(JSON.stringify(result,null,2));}).catch(error=>{console.error(error.stack);process.exitCode=1;});
