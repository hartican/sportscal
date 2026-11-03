'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),fixture=require(path.join(root,'scripts/lib/user-state-selection-writer-tests'));
const transport=require(path.join(root,'config/server-sync')),patches=require(path.join(root,'config/user-state-sync')),systems=require(path.join(root,'config/preference-system')),localApi=require(path.join(root,'scripts/lib/local-user-state-api'));
const clone=x=>JSON.parse(JSON.stringify(x)),results=[];
function select(c,p,ids){p.selectedSelectorEntityIds=c.normalizeSelectorEntityIds(ids);p.followedSports=c.canonicalSportKeysForSelectorIds(ids);p.taxonomySelection=c.taxonomySelectionForSelectorIds(ids);}
async function run(mode,kind){
 const {c,values,base}=fixture.setup(),api=localApi('A',{calendarHandler(){throw Error('Unexpected calendar route in owned user-state fixture');}}),sdkCalls=[],authStore=new Map();let client,newer=null,injectedR2=false;
 if(mode==='generated')vm.runInContext(fs.readFileSync(path.join(root,'assets/js/account-awareness-runtime.js'),'utf8'),c);
 // Actual application queue, conditional retry, apply and ACK owners; rendering/diagnostic UI inert.
 for(const name of ['localPreferenceRecoveryBlocked','invalidateServerStateSyncScope','serverStateSyncScope','reconcileCurrentServerState','syncCurrentServerState','applyServerStatePreservingChanges','acknowledgePreferenceReceipt','advancePreferenceReceiptBase','verifyPreferenceIntentBase'])vm.runInContext(fixture.declaration(name),c);
 Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupSessionStateBaseline:null,setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_s,current)=>current,clearAcknowledgedFixturePinCommands(){},serverErrorEndsSession:e=>e.code==='invalid_refresh_token',NOTHINGSPORTS_ACCOUNT_INDICATOR_APP:{beginDiagnostic:()=>null}});
 const storage={getItem:k=>authStore.get(k)??null,setItem:(k,v)=>authStore.set(k,String(v)),removeItem:k=>authStore.delete(k)};
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const token='e30.'+Buffer.from(JSON.stringify({sub:'A'})).toString('base64url')+'.synthetic';
 client=transport.createClient({storage,persistentStorage:storage,fetchImpl:async(url,opts={})=>{
  const method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):undefined;
  if(url==='/api/auth'){assert.equal(body.action,'password-sign-in');return response({session:{access_token:token,refresh_token:'owned-synthetic-refresh',expires_in:3600}});}
  assert.equal(url,'/api/user-state');assert.equal(opts.headers.Authorization,'Bearer '+token);
  const result=await api.handle({method,url,headers:{},body});sdkCalls.push({method,status:result.status});
  if(method==='PUT'&&result.status===200){
   if(kind==='ACK-mismatch')select(c,result.body.state.preferences,[]);
   if(kind==='R2'&&!injectedR2){injectedR2=true;c.saveFollowSport({selectorId:'sport:football'},false);newer=clone(c.pendingPreferenceIntent('A'));}
  }
  return response(result.body,result.status);
 }});
 try{
  await client.signIn('owned@example.invalid','owned-synthetic',{persist:false});c.serverSyncClient=client;c.serverPersistence={configured:true,state:'signedIn',user:{id:'A'}};c.setServerStateBaseline(base);
  api.seed(base);c.followDiscoverySport('sport:football');const receipt=clone(c.pendingPreferenceIntent('A'));
  api.mutate(state=>{state.preferences.preferenceGraph=systems.setEntityFollow(state.preferences.preferenceGraph,'team:football:epl:2','follow');});
  if(kind==='409-disjoint')api.raceOnce(()=>api.mutate(state=>{state.preferences.preferenceGraph=systems.setEntityFollow(state.preferences.preferenceGraph,'team:football:epl:3','follow');}));
  if(kind==='409-selection-conflict')api.raceOnce(()=>api.mutate(state=>select(c,state.preferences,['sport:tennis'])));
  const before={storage:JSON.stringify([...values]),current:clone(c.userPreferences),baseline:clone(c.serverStateBaseline)};let caught;
  try{await c.syncCurrentServerState();}catch(error){caught=error;}
  const status=sdkCalls.map(x=>x.method+':'+x.status).join(',');
  if(kind==='409-selection-conflict'){
   assert.equal(caught?.code,'preference_base_changed');assert.equal(status,'GET:200,PUT:409,GET:200');
   assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt);assert.equal(JSON.stringify([...values]),before.storage);assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,['sport:tennis']);
  }else if(kind==='ACK-mismatch'){
   assert.equal(caught?.code,'preference_base_changed');assert.equal(status,'GET:200,PUT:200');assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt);assert.equal(JSON.stringify([...values]),before.storage);assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,['sport:football']);
  }else if(kind==='R2'){
   assert.equal(caught,undefined);assert.equal(status,'GET:200,PUT:200');assert(newer);const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newer.receiptId);assert.deepEqual(clone(pending.preferences.selectedSelectorEntityIds),[]);assert.deepEqual(clone(c.userPreferences.selectedSelectorEntityIds),[]);assert.equal(pending.baseUpdatedAt,api.state().updatedAt);
   assert.equal(c.serverPersistence.state,'error');await c.syncCurrentServerState();assert.equal(c.pendingPreferenceIntent('A'),null);assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,[]);assert.equal(c.serverPersistence.state,'signedIn');assert.equal(sdkCalls.map(x=>x.method+':'+x.status).join(','),'GET:200,PUT:200,GET:200,PUT:200');
  }else{
   assert.equal(caught,undefined);assert.equal(status,kind==='409-disjoint'?'GET:200,PUT:409,GET:200,PUT:200':'GET:200,PUT:200');assert.equal(c.pendingPreferenceIntent('A'),null);assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,['sport:football']);assert.deepEqual(clone(c.userPreferences.selectedSelectorEntityIds),['sport:football']);assert.equal(c.serverPersistence.state,'signedIn');
  }
  const final=api.state();assert(final.preferences.preferenceGraph.entityFollows.some(e=>e.participantId==='team:football:epl:2'));
  if(kind==='409-disjoint')assert(final.preferences.preferenceGraph.entityFollows.some(e=>e.participantId==='team:football:epl:3'));
  assert.equal(client.accountSnapshot().accountId,'A');
  const result={mode,kind,passed:true,sdkPath:'actual createClient/signIn/loadState/savePatch with owned fetchImpl→actual local API handler/database doubles',sdkCalls,localRowWrites:api.metrics.rowWrites,held:!!caught,receiptPending:!!c.pendingPreferenceIntent('A'),realNetwork:false,physicalAcceptance:false};results.push(result);console.log(JSON.stringify(result));
 }finally{client.clearSession();}
}
(async()=>{for(const mode of ['source','generated'])for(const kind of ['matching-ACK','409-disjoint','409-selection-conflict','ACK-mismatch','R2'])await run(mode,kind);console.log(JSON.stringify({cases:results.length,results,generatedArtifactSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/js/account-awareness-runtime.js'))).digest('hex'),scope:'current source and generated helper; actual SDK with owned fetch and local API/database doubles only',nativeBrowserHostedDevice:false}));})().catch(error=>{console.error(error);process.exitCode=1;});
