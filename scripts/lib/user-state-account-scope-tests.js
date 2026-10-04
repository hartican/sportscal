'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sync=require('../../config/user-state-sync'),transport=require('../../config/server-sync');
const clone=x=>JSON.parse(JSON.stringify(x));
function sources(){
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const slice=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert(a>=0&&b>a,'actual application scope source');return html.slice(a,b);};
 return {scope:slice('function invalidateServerStateSyncScope(','\nasync function reconcileCurrentServerState('),reconcile:slice('async function reconcileCurrentServerState(','\nfunction syncCurrentServerState('),queue:slice('function syncCurrentServerState(','\nfunction normalizeServerArchiveReferences('),preserve:slice('function applyServerStatePreservingChanges(','\nfunction queueServerStateSync('),bootstrap:slice('async function hydrateUserMetaSeed(','\nfunction sydneyPartsFromIso('),logout:slice('      const signedOutUserId = serverPersistence.user?.id || serverSyncClient?.sessionSubject?.();','\n    });\n    appendPublicProfileAccountSettings')};
}
function context(src){
 let subject='A',device={preferences:{theme:'night'},profile:{},eventUserState:{}},baseline={...clone(device),preferences:{theme:'day'},updatedAt:'2026-10-04T00:00:00Z'};
 const calls={reads:0,writes:0,applies:0,metaReads:0,metaWrites:0,seed:0};
 const c={USER_STATE_SYNC:sync,structuredClone,serverSyncTimer:null,serverStateSyncGeneration:0,serverSyncSequence:Promise.resolve(),serverPersistence:{state:'signedIn',user:{id:'A'}},serverStateBaseline:{state:clone(baseline),updatedAt:baseline.updatedAt},startupSessionStateBaseline:clone(device),userPreferences:{followFirst:{startupMeta:{sports:['football']}}},
 clearTimeout(){},currentServerStatePayload:()=>clone(device),emptyServerStatePayload:()=>({}),setServerPersistence:p=>Object.assign(c.serverPersistence,p),setPreferenceRecovery(){},setServerStateBaseline:s=>{c.serverStateBaseline={state:clone(s),updatedAt:s.updatedAt};},serverAuthoritativeFixturePins:(_s,d)=>d,clearAcknowledgedFixturePinCommands(){},applyServerState:s=>{calls.applies++;device=clone(s);},serverErrorEndsSession:e=>e.code==='invalid_refresh_token',showToast(){},fantasyPreferencesDiffer:()=>false,savePreferences(){calls.seed++;},FOLLOW_FIRST:{normalizeMeta:x=>x,applyMetaSeed:()=>({changed:true,preferences:{}})},console:{warn(){}},disablePushInstallation:async()=>{},clearCachedPersonalisedFeed:async()=>{},
 serverSyncClient:{sessionSubject:()=>subject,status:async()=>({configured:true}),restoreSession:async()=>({accessToken:'synthetic'}),loadState:async opts=>{calls.reads++;assert.equal(opts.accountId,'A');return{user:{id:'A'},state:clone(baseline)};},savePatch:async(p,opts)=>{calls.writes++;assert.equal(opts.accountId,'A');return{user:{id:'A'},state:{...sync.applyPatch(baseline,p),updatedAt:'2026-10-04T00:01:00Z'}};},loadMeta:async opts=>{calls.metaReads++;assert.equal(opts.accountId,'A');return{meta:{sports:['football']}};},saveMeta:async(m,opts)=>{calls.metaWrites++;assert.equal(opts.accountId,'A');return{meta:m};},signOut:async opts=>{calls.logout=(calls.logout||0)+1;assert.equal(opts.accountId,'A');subject='';}},
 switchAccount(){subject='B';c.serverPersistence={state:'signedIn',user:{id:'B'},message:'B active'};c.serverStateBaseline={state:{preferences:{theme:'B'}},updatedAt:'B baseline'};},endSession(){subject='';},currentDevice:()=>clone(device),calls,
 };
 vm.createContext(c);vm.runInContext([src.scope,src.preserve,src.reconcile,src.queue,src.bootstrap,'async function qaLogout(){\n'+src.logout+'\n}'].join('\n'),c);return c;
}
async function orchestration(){
 const src=sources(),results=[];
 for(const phase of ['load','success','conflict','failure','mismatch']){
  const c=context(src),originalRead=c.serverSyncClient.loadState;
  if(phase==='load')c.serverSyncClient.loadState=async opts=>{const result=await originalRead(opts);c.switchAccount();return result;};
  if(phase==='mismatch')c.serverSyncClient.loadState=async opts=>({...await originalRead(opts),user:{id:'B'}});
  if(['success','conflict','failure'].includes(phase))c.serverSyncClient.savePatch=async()=>{c.calls.writes++;c.switchAccount();if(phase!=='success')throw Object.assign(new Error('late A response'),{status:409,code:phase==='conflict'?'user_state_conflict':'invalid_refresh_token'});return{user:{id:'A'},state:{preferences:{theme:'old A'}}};};
  if(phase==='mismatch')await assert.rejects(c.reconcileCurrentServerState(),e=>e.code==='user_state_identity_mismatch');else await c.reconcileCurrentServerState();
  assert.equal(c.calls.applies,0);assert.equal(c.calls.writes,phase==='load'||phase==='mismatch'?0:1);assert.equal(c.calls.reads,1,'no retry read after switch');
  if(phase!=='mismatch'){assert.equal(c.serverPersistence.user.id,'B');assert.equal(c.serverPersistence.message,'B active');assert.equal(c.serverStateBaseline.updatedAt,'B baseline');}
  results.push('sync '+phase);
 }
 {
  const c=context(src);let release;c.serverSyncSequence=new Promise(r=>{release=r;});const queued=c.syncCurrentServerState();c.switchAccount();release();await queued;assert.equal(c.calls.reads,0);assert.equal(c.calls.writes,0);results.push('queued save cancelled');
 }
 for(const phase of ['status','restore','load','meta','error']){
  const c=context(src);
  const wrap=fn=>async(...args)=>{const value=await fn(...args);c.switchAccount();c.invalidateServerStateSyncScope();return value;};
  if(phase==='status')c.serverSyncClient.status=wrap(c.serverSyncClient.status);
  if(phase==='restore')c.serverSyncClient.restoreSession=wrap(c.serverSyncClient.restoreSession);
  if(phase==='load')c.serverSyncClient.loadState=wrap(c.serverSyncClient.loadState);
  if(phase==='meta')c.serverSyncClient.loadMeta=wrap(c.serverSyncClient.loadMeta);
  if(phase==='error')c.serverSyncClient.loadState=async()=>{c.switchAccount();c.invalidateServerStateSyncScope();throw Object.assign(new Error('old failure'),{code:'invalid_refresh_token'});};
  await c.bootstrapServerPersistence();assert.equal(c.serverPersistence.user.id,'B');assert.equal(c.serverPersistence.message,'B active');assert.equal(c.calls.writes,0);assert.equal(c.calls.seed,0);assert.equal(c.serverStateBaseline.updatedAt,'B baseline');results.push('hydration '+phase);
 }
 for(const phase of ['meta-read','meta-create','logout-detach','logout-response','normal-logout','terminal-session']){
  const c=context(src);
  if(phase==='meta-read'){c.serverSyncClient.loadMeta=async()=>{c.switchAccount();return{meta:{sports:['nrl']}};};await c.hydrateUserMetaSeed();assert.equal(c.calls.seed,0);assert.equal(c.calls.metaWrites,0);}
  if(phase==='meta-create'){c.serverSyncClient.loadMeta=async()=>({meta:null});c.serverSyncClient.saveMeta=async()=>{c.calls.metaWrites++;c.switchAccount();return{meta:{sports:['nrl']}};};await c.hydrateUserMetaSeed();assert.equal(c.calls.seed,0);}
  if(phase==='logout-detach'){c.disablePushInstallation=async()=>{c.switchAccount();};await c.qaLogout();assert.equal(c.calls.logout||0,0);assert.equal(c.serverPersistence.user.id,'B');}
  if(phase==='logout-response'){c.serverSyncClient.signOut=async()=>{c.calls.logout=1;c.switchAccount();};await c.qaLogout();assert.equal(c.serverPersistence.user.id,'B');assert.equal(c.serverStateBaseline.updatedAt,'B baseline');}
  if(phase==='normal-logout'){const before=c.currentDevice();await c.qaLogout();assert.equal(c.serverPersistence.state,'signedOut');assert.equal(c.serverPersistence.user,null);assert.deepEqual(c.currentDevice(),before,'approved retained local copy remains');}
  if(phase==='terminal-session'){c.serverSyncClient.savePatch=async()=>{c.endSession();throw Object.assign(new Error('ended'),{code:'invalid_refresh_token'});};await assert.rejects(c.reconcileCurrentServerState(),e=>e.code==='invalid_refresh_token');assert.equal(c.serverPersistence.state,'signedOut');assert.equal(c.serverPersistence.user,null);}
  results.push(phase);
 }
 return results;
}
function memoryStorage(){const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
let clientNumber=0;
async function sdk(){
 const results=[];
 for(const action of ['loadState','savePatch','loadMeta','saveMeta','signOut','resetPreferences','undoPreferencesReset','refresh-same','refresh-switch','refresh-response-switch','refresh-failure-switch','logout-response']){
  const id=++clientNumber,requests=[];let target='A',client,queried=0;const token=sub=>'e30.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.synthetic';
  const response=(json,status=200)=>new Response(JSON.stringify(json),{status,headers:{'Content-Type':'application/json'}});
  client=transport.createClient({storage:memoryStorage(),persistentStorage:memoryStorage(),fetchImpl:async(url,opts={})=>{
   const body=opts.body?JSON.parse(opts.body):{},method=opts.method||'GET';requests.push({url,method,action:body.action||'',authorization:opts.headers?.Authorization||''});
   if(url==='/api/auth'&&body.action==='password-sign-in')return response({session:{access_token:token(target),refresh_token:`synthetic-${id}-${target}`,expires_in:3600}});
   if(url==='/api/auth'&&body.action==='refresh'){if(['refresh-response-switch','refresh-failure-switch'].includes(action)){target='B';await client.signIn('qa@example.invalid','synthetic',{persist:false});}if(action==='refresh-failure-switch')return response({error:'old A expired',code:'invalid_refresh_token'},400);return response({session:{access_token:token('A'),refresh_token:`synthetic-${id}-A-rotated`,expires_in:3600}});}
   if(url==='/api/auth'&&body.action==='logout'){if(action==='logout-response'){target='B';await client.signIn('qa@example.invalid','synthetic',{persist:false});}return response({ok:true});}
   queried++;
   if(action.startsWith('refresh')&&queried===1){if(action==='refresh-switch'){target='B';await client.signIn('qa@example.invalid','synthetic',{persist:false});}return response({error:'synthetic expiry',code:'token_expired'},401);}
   return response({user:{id:'A'},state:{schema_version:'user-state.v2',preferences:{theme:'day'}},meta:{sports:['football']}});
  }});
  await client.signIn('qa@example.invalid','synthetic',{persist:false});
  const invoke=()=>action==='savePatch'?client.savePatch(sync.createPatch({},{}),{accountId:'A'}):action==='saveMeta'?client.saveMeta({sports:['football']},{accountId:'A'}):action==='resetPreferences'?client.resetPreferences({},{accountId:'A'}):action==='undoPreferencesReset'?client.undoPreferencesReset('synthetic-reset',{accountId:'A'}):action==='signOut'||action==='logout-response'?client.signOut({accountId:'A'}):action.startsWith('refresh')?client.loadState({accountId:'A'}):client[action]({accountId:'A'});
  if(['loadState','savePatch','loadMeta','saveMeta','signOut','resetPreferences','undoPreferencesReset'].includes(action)){
   target='B';await client.signIn('qa@example.invalid','synthetic',{persist:false});const count=requests.length;await assert.rejects(invoke(),e=>e.code==='account_scope_changed');assert.equal(requests.length,count,'wrong-owner operation never reaches mocked fetch');assert.equal(client.sessionSubject(),'B');
  }else if(['refresh-response-switch','refresh-failure-switch'].includes(action)){await assert.rejects(invoke(),e=>e.code==='account_scope_changed');assert.equal(client.sessionSubject(),'B','old Auth result/failure must not replace or clear B');}else if(action==='refresh-switch'){
   await assert.rejects(invoke(),e=>e.code==='account_scope_changed');assert.equal(requests.filter(x=>x.action==='refresh').length,0,'old 401 cannot refresh the new account');assert.equal(client.sessionSubject(),'B');
  }else if(action==='refresh-same'){
   await invoke();assert.equal(queried,2);assert.equal(requests.filter(x=>x.action==='refresh').length,1,'normal same-account refresh retains its existing retry');assert.equal(client.sessionSubject(),'A');
  }else{
   await invoke();assert.equal(client.sessionSubject(),'B','late logout cannot clear the replacement session');
  }
  assert(requests.filter(x=>x.url!=='/api/auth').every(x=>x.authorization==='Bearer '+token('A')),'profile/meta request always uses its captured account');
  client.clearSession();results.push('SDK '+action);
 }
 return results;
}
async function recoveryUi(){
 const ui=require('../../config/preference-reset-ui'),results=[];
 for(const action of ['reset','undo'])for(const phase of ['before','response','normal']){
  let current=phase!=='before',applied=0,requests=0;
  const accountScope={accountId:'A',current:()=>current,verify:result=>current&&result.user.id==='A'};
  const result=()=>{requests++;if(phase==='response')current=false;return{user:{id:'A'},state:{preferences:{theme:'day'}}};};
  const api={accountScope,signedIn:()=>true,defaults:()=>({theme:'day'}),recovery:()=>({resetId:'synthetic'}),serverSync:{resetPreferences:async(_p,opts)=>{assert.equal(opts.accountId,'A');return result();},undoPreferencesReset:async(_id,opts)=>{assert.equal(opts.accountId,'A');return result();}},acceptServerResult:()=>{applied++;},afterApply(){}};
  if(phase==='normal')await ui[action](api);else await assert.rejects(ui[action](api),/account changed/);
  assert.equal(applied,phase==='normal'?1:0);assert.equal(requests,phase==='before'?0:1);results.push('Recovery UI '+action+' '+phase);
 }
 return results;
}
async function overlappingRefreshes(){
 const pending=[],requests=[],storage=memoryStorage(),token=sub=>'e30.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.synthetic';
 const response=(json,status=200)=>new Response(JSON.stringify(json),{status,headers:{'Content-Type':'application/json'}});
 let target='A';
 const client=transport.createClient({storage:memoryStorage(),persistentStorage:storage,fetchImpl:async(url,opts={})=>{
  const body=opts.body?JSON.parse(opts.body):{};requests.push(body.action||'state');
  if(body.action==='password-sign-in')return response({session:{access_token:token(target),refresh_token:'synthetic-'+target,expires_in:3600}});
  if(body.action==='refresh')return await new Promise(resolve=>pending.push({body,resolve}));
  return response({error:'synthetic expiry',code:'token_expired'},401);
 }});
 const until=async predicate=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,10));assert(predicate());};
 await client.signIn('qa@example.invalid','synthetic',{persist:false});
 const old=client.loadState({accountId:'A'});const oldRejected=assert.rejects(old,e=>e.code==='account_scope_changed');await until(()=>pending.length===1);
 target='B';await client.signIn('qa@example.invalid','synthetic',{persist:false});
 const first=client.loadState({accountId:'B'}),firstRejected=assert.rejects(first,e=>e.status===401);await until(()=>requests.filter(x=>x==='state').length===2);
 pending[0].resolve(response({session:{access_token:token('A'),refresh_token:'old-A-rotated',expires_in:3600}}));await oldRejected;await until(()=>pending.length===2);
 const second=client.loadState({accountId:'B'}),secondRejected=assert.rejects(second,e=>e.status===401);await until(()=>requests.filter(x=>x==='state').length>=3);
 assert.equal(pending.length,2,'old completion must not clear the replacement refresh job');
 pending[1].resolve(response({session:{access_token:token('B'),refresh_token:'new-B-rotated',expires_in:3600}}));await Promise.all([firstRejected,secondRejected]);
 assert.equal(client.sessionSubject(),'B');assert.equal(requests.filter(x=>x==='refresh').length,2);client.clearSession();return ['SDK overlapping refresh jobs'];
}
module.exports=async function validateAccountScopes(){const cases=[...await orchestration(),...await sdk(),...await recoveryUi(),...await overlappingRefreshes()];console.log(`Account isolation: ${cases.length} actual orchestration/SDK/recovery scenarios passed; no service or database connection.`);return cases;};
