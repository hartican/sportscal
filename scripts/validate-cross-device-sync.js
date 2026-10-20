#!/usr/bin/env node

const assert = require("node:assert/strict");
const userStateSync = require("../config/user-state-sync");

const lastSyncedState = {
  schemaVersion: "user-state.v1",
  preferences: {
    theme: "day",
    selectedBroadcasters: ["kayo"],
    viewing: { viewingWindowEnabled: true, startHourLocal: 7 },
  },
  profile: { timezone: "Australia/Sydney" },
};

const thisDeviceState = {
  ...lastSyncedState,
  preferences: {
    ...lastSyncedState.preferences,
    theme: "night",
  },
};

const latestCloudState = {
  ...lastSyncedState,
  updatedAt: "2026-08-12T01:00:00.000Z",
  profile: { timezone: "Australia/Sydney", futureProfileField: "keep" },
  preferences: {
    ...lastSyncedState.preferences,
    selectedBroadcasters: ["stan"],
    viewing: { viewingWindowEnabled: false, startHourLocal: 9 },
  },
};

const cloudFollowState = {
  ...latestCloudState,
  preferences: {
    ...latestCloudState.preferences,
    followFirst:{ collectionFollows:["collection:tennis:mens-top-10"] },
  },
};
const stalePreHydrationDevice = {
  ...lastSyncedState,
  preferences:{ ...lastSyncedState.preferences, followFirst:{ collectionFollows:[] } },
};
const unchangedStartupPatch = userStateSync.createPatch(stalePreHydrationDevice, stalePreHydrationDevice, {
  baseUpdatedAt:cloudFollowState.updatedAt,
});
assert.deepEqual(
  userStateSync.applyPatch(cloudFollowState, unchangedStartupPatch).preferences.followFirst.collectionFollows,
  ["collection:tennis:mens-top-10"],
  "a shell/data update must hydrate the saved cloud collection instead of treating a stale local empty list as a new unfollow",
);

const cloudOnlyResult = userStateSync.applyPatch(
  latestCloudState,
  userStateSync.createPatch(lastSyncedState, lastSyncedState, {
    baseUpdatedAt: "2026-08-12T00:00:00.000Z",
  })
);
assert.deepEqual(
  cloudOnlyResult.preferences,
  latestCloudState.preferences,
  "a session with no local changes must load the latest cloud settings exactly"
);

const localChanges = userStateSync.createPatch(lastSyncedState, thisDeviceState, {
  baseUpdatedAt: "2026-08-12T00:00:00.000Z",
});
const reconciledState = userStateSync.applyPatch(latestCloudState, localChanges);

assert.equal(reconciledState.preferences.theme, "night", "the setting changed on this device must win when it syncs last");
assert.equal(reconciledState.profile.futureProfileField, "keep", "newer cloud fields unknown to this device must survive reconciliation");
assert.deepEqual(
  reconciledState.preferences.selectedBroadcasters,
  ["stan"],
  "an untouched setting must inherit the latest cloud value"
);
assert.deepEqual(
  reconciledState.preferences.viewing,
  { viewingWindowEnabled: false, startHourLocal: 9 },
  "untouched nested settings must inherit the latest cloud values"
);

const repeatedPatch = userStateSync.createPatch(reconciledState, reconciledState, {
  baseUpdatedAt: latestCloudState.updatedAt,
});
assert.equal(userStateSync.hasChanges(repeatedPatch), false, "repeating the same sync must be idempotent");

const explicitChoices = {
  ...reconciledState,
  preferences: {
    ...reconciledState.preferences,
    followedSports: [],
    showSpoilers: false,
  },
};
const explicitPatch = userStateSync.createPatch(reconciledState, explicitChoices, {
  baseUpdatedAt: latestCloudState.updatedAt,
});
const explicitResult = userStateSync.applyPatch(reconciledState, explicitPatch);
assert.deepEqual(explicitResult.preferences.followedSports, [], "an explicit empty selection must sync");
assert.equal(explicitResult.preferences.showSpoilers, false, "an explicit false setting must sync");

const stateWithTemporarySetting = {
  ...explicitResult,
  preferences: { ...explicitResult.preferences, temporarySetting: "remove-me" },
};
const removedSettingState = {
  ...stateWithTemporarySetting,
  preferences: { ...stateWithTemporarySetting.preferences },
};
delete removedSettingState.preferences.temporarySetting;
const removalPatch = userStateSync.createPatch(stateWithTemporarySetting, removedSettingState, {
  baseUpdatedAt: latestCloudState.updatedAt,
});
assert.equal(
  Object.prototype.hasOwnProperty.call(userStateSync.applyPatch(stateWithTemporarySetting, removalPatch).preferences, "temporarySetting"),
  false,
  "a setting removed on this device must be removed when it writes last"
);

assert.throws(
  () => userStateSync.applyPatch({}, {
    schemaVersion: "user-state-patch.v1",
    baseUpdatedAt: null,
    changes: [{ path: ["preferences", "__proto__", "polluted"], value: true }],
  }),
  /invalid path/i,
  "unsafe object paths must be rejected"
);

async function validateActualConflictRetry(){
  const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  function source(startMarker, endMarker){
    const start = html.indexOf(startMarker), end = html.indexOf(endMarker, start);
    assert(start >= 0 && end > start, "the actual application orchestration must be tested");
    return html.slice(start, end);
  }
  const orchestration = source("async function reconcileCurrentServerState(", "\nfunction syncCurrentServerState(");
  const accountScope = source("function invalidateServerStateSyncScope(", "\nasync function reconcileCurrentServerState(");
  const preserve = source("function applyServerStatePreservingChanges(", "\nfunction queueServerStateSync(");
  const pins = source("function fixturePinAction(", "\nfunction clearAcknowledgedFixturePinCommands(");
  const clone = value => JSON.parse(JSON.stringify(value));
  const scenarios = [
    { name:"no conflict", conflicts:0 },
    { name:"one conflict", conflicts:1 },
    { name:"two conflicts", conflicts:2 },
    { name:"remote temporarily agrees with local edit", conflicts:2, converge:true },
    { name:"explicit empty, false and OFF", conflicts:1, explicit:true },
    { name:"removed local field", conflicts:1, remove:true },
    { name:"late local edit", conflicts:1, late:true },
    { name:"fixture pin authority", conflicts:1, pins:true },
    { name:"three conflicts stop", conflicts:3, failure:"user_state_conflict" },
    { name:"unrelated 409 stops", conflicts:1, failure:"client_update_required" },
    { name:"ended session stops", conflicts:1, failure:"invalid_refresh_token" },
    { name:"unchanged device loads remote", conflicts:0, unchanged:true },
  ];
  for (const scenario of scenarios){
    const baseline = clone(lastSyncedState);
    baseline.eventUserState = {};
    baseline.preferences.showSpoilers = true;
    baseline.preferences.notificationPreferences = { enabled:true };
    baseline.preferences.preferenceGraph = { entityFollows:[{ participantId:"team:football:arsenal", followLevel:"follow" }] };
    baseline.preferences.temporarySetting = "remove-me";
    let device = clone(baseline);
    if (!scenario.unchanged) device.preferences.theme = "night";
    if (scenario.explicit){
      device.preferences.selectedBroadcasters = [];
      device.preferences.showSpoilers = false;
      device.preferences.notificationPreferences.enabled = false;
      device.preferences.preferenceGraph.entityFollows = [];
    }
    if (scenario.remove) delete device.preferences.temporarySetting;
    if (scenario.pins) baseline.eventUserState = device.eventUserState = { match:{ pinRevision:1, excluded:true } };
    const originalDevice = clone(device);
    let cloud = clone(baseline);
    cloud.preferences.selectedBroadcasters = ["stan"];
    cloud.preferences.viewing = { viewingWindowEnabled:false, startHourLocal:9 };
    cloud.profile.futureProfileField = "keep";
    cloud.updatedAt = "2026-08-12T01:00:00.000Z";
    let writes = 0, reads = 0;
    const patches = [];
    const context = {
      USER_STATE_SYNC:userStateSync, structuredClone, serverSyncTimer:null, serverStateSyncGeneration:0, fixturePinQueue:{},
      serverStateBaseline:{ state:clone(baseline), updatedAt:"2026-08-12T00:00:00.000Z" },
      serverPersistence:{ state:"signedIn", user:{ id:"synthetic-account" } },
      clearTimeout(){}, currentServerStatePayload(){ return clone(device); }, emptyServerStatePayload(){ return {}; },
      setServerPersistence(value){ Object.assign(context.serverPersistence, value); }, setPreferenceRecovery(){},
      clearAcknowledgedFixturePinCommands(){}, applyServerState(state){ device = clone(state); },
      setServerStateBaseline(state){ context.serverStateBaseline = { state:clone(state), updatedAt:state.updatedAt }; },
      serverErrorEndsSession(error){ return error.code === "invalid_refresh_token"; }, showToast(){},
      serverSyncClient:{
        sessionSubject(){ return "synthetic-account"; },
        async loadState(){ reads += 1; return { user:{ id:"synthetic-account" }, state:clone(cloud) }; },
        async savePatch(patch){
          writes += 1;
          patches.push(clone(patch));
          if (writes <= scenario.conflicts){
            if (scenario.converge) cloud.preferences.theme = writes === 1 ? "night" : "day";
            cloud.preferences.viewing.startHourLocal = 9 + writes;
            cloud.updatedAt = `2026-08-12T0${writes + 1}:00:00.000Z`;
            if (scenario.pins) cloud.eventUserState.match = { pinRevision:2, excluded:false };
            const code = scenario.failure && scenario.failure !== "user_state_conflict" ? scenario.failure : "user_state_conflict";
            throw Object.assign(new Error("synthetic concurrent save"), { status:409, code });
          }
          assert.equal(patch.baseUpdatedAt, cloud.updatedAt, scenario.name + ": use the latest comparison timestamp");
          cloud = userStateSync.applyPatch(cloud, patch);
          cloud.updatedAt = "2026-08-12T05:00:00.000Z";
          if (scenario.late) device.preferences.selectedBroadcasters = ["kayo", "sbs"];
          return { user:{ id:"synthetic-account" }, state:clone(cloud) };
        },
      },
    };
    vm.createContext(context);
    const preferenceHooks=html.slice(html.indexOf("function preferenceIntentOwner(){"),html.indexOf("async function bootstrapServerPersistence("));
    vm.runInContext(preferenceHooks + "\n" + pins + "\n" + preserve + "\n" + accountScope + "\n" + orchestration, context);
    if (scenario.failure){
      await assert.rejects(context.reconcileCurrentServerState(), error => error.code === scenario.failure, scenario.name);
      assert.equal(writes, scenario.failure === "user_state_conflict" ? 3 : 1, "unchanged retry cap and typed conflict requirement");
      assert.deepEqual(device, originalDevice, "failed saves retain the local copy");
      assert.equal(context.serverPersistence.state, scenario.failure === "invalid_refresh_token" ? "signedOut" : "error");
      continue;
    }
    await context.reconcileCurrentServerState();
    assert.equal(writes, scenario.unchanged ? 0 : scenario.conflicts + 1, scenario.name + ": bounded writes");
    assert.equal(reads, scenario.unchanged ? 1 : scenario.conflicts + 1, scenario.name + ": one new read per actual conflict");
    assert.equal(cloud.preferences.theme, scenario.unchanged ? "day" : "night", "deliberate local edit wins");
    assert.deepEqual(cloud.preferences.selectedBroadcasters, scenario.explicit ? [] : ["stan"], "a retry cannot turn an untouched local field into an overwrite");
    assert.equal(cloud.preferences.viewing.startHourLocal, 9 + scenario.conflicts, "concurrent remote field survives");
    assert.equal(cloud.profile.futureProfileField, "keep", "unknown remote fields survive");
    if (scenario.explicit){
      assert.equal(cloud.preferences.showSpoilers, false);
      assert.equal(cloud.preferences.notificationPreferences.enabled, false, "Remind OFF survives");
      assert.deepEqual(cloud.preferences.preferenceGraph.entityFollows, [], "explicit unfollow does not union old follows");
    }
    if (scenario.remove) assert.equal(Object.hasOwn(cloud.preferences, "temporarySetting"), false, "deliberate removal survives");
    if (scenario.late){
      assert.deepEqual(device.preferences.selectedBroadcasters, ["kayo", "sbs"], "an edit made during save stays local");
      const nextPatch = userStateSync.createPatch(context.serverStateBaseline.state, device);
      assert.deepEqual(nextPatch.changes.map(change => change.path.join(".")), ["preferences.selectedBroadcasters"], "only the late edit remains pending");
    }
    if (scenario.pins){
      assert.deepEqual(cloud.eventUserState.match, { pinRevision:2, excluded:false }, "retry retains remote fixture authority");
      assert.deepEqual(device.eventUserState.match, cloud.eventUserState.match, "unchanged old local pins cannot masquerade as edits made during sync");
    }
    for (const patch of patches){
      assert(!patch.changes.some(change => change.path[0] === "profile"), "no fabricated profile overwrite");
      assert(!patch.changes.some(change => change.path.join(".") === "preferences.viewing.startHourLocal"), "no fabricated viewing overwrite");
    }
  }
  console.log(`Actual account-sync orchestration: ${scenarios.length} synthetic conflict, consent, late-edit and failure scenarios passed.`);
}

async function validateAcceptedBootstrapBaseline(){
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const slice=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert(a>=0&&b>a);return html.slice(a,b);};
  const source=[
    slice('function invalidateServerStateSyncScope(','\nasync function reconcileCurrentServerState('),
    slice('function applyServerStatePreservingChanges(','\nfunction queueServerStateSync('),
    slice('async function reconcileCurrentServerState(','\nfunction syncCurrentServerState('),
    slice('function syncCurrentServerState(','\nfunction normalizeServerArchiveReferences('),
    slice('async function hydrateUserMetaSeed(','\nfunction sydneyPartsFromIso('),
  ].join('\n');
  const signInMarker='  document.getElementById("accountSignInForm").addEventListener("submit", async event => {';
  const start=html.indexOf(signInMarker),end=html.indexOf('\n  });\n  appendPreferenceRecoverySettings(body);',start);assert(start>=0&&end>start);
  const signIn='async function submitSignIn(event){'+html.slice(start+signInMarker.length,end)+'\n}';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const state=owner=>({schemaVersion:'user-state.v2',preferences:{theme:'day',preferenceGraph:{entityFollows:[{entityId:'team:synthetic:'+owner,followed:true}],domainPreferences:[],competitionPreferences:[]},followFirst:{startupMeta:{sports:[]}}},profile:{usernameLabel:owner},eventUserState:{['fixture:'+owner]:{addedToFixtures:true,reminderEnabled:false},['excluded:'+owner]:{excluded:true}},eventSpoilerState:{['fixture:'+owner]:false},archivedEvents:[],ratings:{},updatedAt:'2026-10-20T08:00:00Z'});
  const cases=['uninterrupted','held-meta','failed-meta','failed-state','failed-auth','empty-graph','absent-preferences','deliberate-local'];
  for(const scenario of cases){
    const states={A:state('A'),B:state('B'),C:state('C')};
    if(scenario==='empty-graph')states.B.preferences.preferenceGraph.entityFollows=[];
    if(scenario==='absent-preferences')states.B.preferences={};
    const original=clone(states);let device=state('local'),target='A',release,held=false,applied=0;
    const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
    const requests=[],listeners=new Map();
    const app={module:{exports:{}},AbortController,Event,Response,URLSearchParams,Buffer,structuredClone,setTimeout,clearTimeout,
      USER_STATE_SYNC:userStateSync,accountIndicatorJourney:null,serverSyncTimer:null,serverStateSyncGeneration:0,serverSyncSequence:Promise.resolve(),serverPersistence:{state:'signedOut',user:null},serverStateBaseline:null,startupSessionStateBaseline:clone(device),
      userPreferences:device.preferences,currentServerStatePayload:()=>clone(device),emptyServerStatePayload:()=>({}),
      setServerPersistence:patch=>Object.assign(app.serverPersistence,patch),setPreferenceRecovery(){},setServerStateBaseline:value=>{app.serverStateBaseline={state:clone(value),updatedAt:value.updatedAt};},serverAuthoritativeFixturePins:(_state,local)=>local,clearAcknowledgedFixturePinCommands(){},
      applyServerState:value=>{device=clone(value);app.userPreferences=device.preferences;applied++;},serverErrorEndsSession:error=>error.code==='invalid_refresh_token',showToast(){},fantasyPreferencesDiffer:()=>false,savePreferences(){throw Error('This fixture does not seed metadata');},console:{warn(){}},
      FOLLOW_FIRST:{normalizeMeta:value=>value||{sports:[]},applyMetaSeed:preferences=>({changed:false,preferences})},
      document:{getElementById:id=>({value:id==='accountEmail'?target+'@example.invalid':'synthetic',checked:true})},
      addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);},
    };
    vm.createContext(app);vm.runInContext(fs.readFileSync(path.join(__dirname,'../config/server-sync.js'),'utf8'),app);
    const token=owner=>'e30.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.synthetic';
    const response=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
    const row=value=>({schema_version:value.schemaVersion,preferences:value.preferences,profile:value.profile,event_user_state:value.eventUserState,event_spoiler_state:value.eventSpoilerState,archived_events:value.archivedEvents,ratings:value.ratings,updated_at:value.updatedAt});
    app.serverSyncClient=app.module.exports.createClient({storage:storage(),persistentStorage:storage(),fetchImpl:async(url,options={})=>{
      const body=options.body?JSON.parse(options.body):{},method=options.method||'GET';
      const owner=options.headers?.Authorization?JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1],'base64url')).sub:'';
      requests.push({url,method,owner});
      if(url==='/api/auth'&&body.action==='password-sign-in'&&target==='A'&&scenario==='failed-auth'&&!held){held=true;return response({error:'synthetic rejected sign-in',code:'auth_bad_credentials'},400);}
      if(url==='/api/auth')return response(body.action==='password-sign-in'?{session:{access_token:token(target),refresh_token:'synthetic-'+target,expires_in:3600}}:{configured:true});
      if(url==='/api/user-meta'){
        if(owner==='A'&&scenario==='failed-meta'&&!held){held=true;throw Error('synthetic offline metadata read');}
        if(owner==='A'&&['held-meta','empty-graph','absent-preferences'].includes(scenario)&&!held){held=true;return new Promise(resolve=>{release=()=>resolve(response({meta:{sports:[]}}));});}
        return response({meta:{sports:[]}});
      }
      assert.equal(url,'/api/user-state');assert(states[owner]);
      if(owner==='A'&&scenario==='failed-state'&&!held){held=true;throw Error('synthetic interrupted profile read');}
      if(method==='PUT'){states[owner]=userStateSync.applyPatch(states[owner],body.patch);states[owner].updatedAt='2026-10-20T08:01:00Z';}
      return response({user:{id:owner},state:row(states[owner])});
    }});
    vm.runInContext(source+'\n'+signIn,app);
    if(scenario==='deliberate-local'){device.preferences.theme='night';original.A.preferences.theme='night';original.A.updatedAt='2026-10-20T08:01:00Z';}
    const signInAs=async owner=>{target=owner;await app.submitSignIn({preventDefault(){}});};
    const first=signInAs('A');
    if(['held-meta','empty-graph','absent-preferences'].includes(scenario)){
      for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,1));
      assert(release,scenario+' reaches metadata through actual SDK and Account submit/bootstrap');assert.equal(applied,1);
    }else await first;
    for(const owner of ['B','C']){await signInAs(owner);assert.deepEqual(device,original[owner],scenario+': each account loads only its own saved state, pins and OFF choices');}
    if(release){release();await first;}
    await signInAs('A');assert.deepEqual(device,original.A);
    assert.deepEqual(states,original,scenario+': sign-in cannot manufacture cross-account edits');
    const writes=requests.filter(request=>request.method==='PUT');
    assert.equal(writes.length,scenario==='deliberate-local'?1:0,scenario+': only a deliberate local edit can write');
    if(writes.length)assert.equal(writes[0].owner,'A','A local edit cannot write another account');
  }
  console.log(`Accepted account bootstrap: ${cases.length} actual Account/SDK A-B-C-A, delayed/failed hydration and empty/absent preference cases passed; no service connection.`);
}

async function validateDurablePreferenceIntent(){
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const profile=require(path.join(root,'config/profile-storage')),sdk=require(path.join(root,'config/server-sync')),sync=require(path.join(root,'config/user-state-sync'));
const clone=x=>JSON.parse(JSON.stringify(x));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const slice=(s,from,to)=>{const a=s.indexOf(from),b=s.indexOf(to,a);assert(a>=0&&b>a);return s.slice(a,b);};
const helperPath=path.join(root,'scripts/lib/user-state-account-scope-tests.js'),helper={module:{exports:{}},require:createRequire(helperPath),__dirname:path.dirname(helperPath),console,structuredClone,Response,AbortController,Event,setTimeout,clearTimeout,Buffer};
vm.runInNewContext(fs.readFileSync(helperPath,'utf8')+'\nmodule.exports.assessment={sources,context};',helper);
const {sources,context}=helper.module.exports.assessment;
function storage(){const values=new Map();return{fail:false,getItem:key=>values.get(key)||null,setItem(key,value){if(this.fail)throw Object.assign(new Error('synthetic quota'),{name:'QuotaExceededError'});values.set(key,String(value));},removeItem:key=>values.delete(key)};}
const store=storage(),initial=sdk.buildUserState({preferences:{theme:'day',followFirst:{startupMeta:{sports:[]}},preferenceGraph:{entityFollows:[{participantId:'team:synthetic:base',followed:true}],domainPreferences:[],competitionPreferences:[]}},profile:{usernameLabel:'synthetic'}});
const states=Object.fromEntries(['A','B','C'].map(owner=>[owner,{...clone(initial),updatedAt:'2026-10-20T22:00:00Z'}]));let writes=0,saveMode='normal';
const token=owner=>'e30.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.synthetic';
const response=json=>new Response(JSON.stringify(json),{status:200,headers:{'Content-Type':'application/json'}});
let signInOwner='A';
const fetchImpl=async(url,options={})=>{const body=options.body?JSON.parse(options.body):{},owner=options.headers?.Authorization?JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1],'base64url')).sub:'';
 if(url==='/api/auth')return response(body.action==='password-sign-in'?{session:{access_token:token(signInOwner),refresh_token:'synthetic-'+signInOwner,expires_in:3600}}:{configured:true});
 if(url==='/api/user-meta')return response({meta:{sports:[]}});
 assert.equal(url,'/api/user-state');const current=states[owner];if(!current){assert.notEqual(options.method,'PUT');return response({user:{id:owner},state:null});}
 if(options.method==='PUT'){if(saveMode==='reject-before'){saveMode='normal';throw new TypeError('synthetic offline save');}assert.equal(body.patch.baseUpdatedAt,current.updatedAt);states[owner]=sync.applyPatch(current,body.patch);states[owner].updatedAt='2026-10-20T22:01:'+String(++writes).padStart(2,'0')+'Z';if(saveMode==='lost-ack'){saveMode='normal';throw new TypeError('synthetic lost acknowledgement');}}
 const row=states[owner];return response({user:{id:owner},state:{schema_version:row.schemaVersion,profile:row.profile,preferences:row.preferences,event_user_state:row.eventUserState,event_spoiler_state:row.eventSpoilerState,archived_events:row.archivedEvents,ratings:row.ratings,updated_at:row.updatedAt}});
};
async function makeApp(owner,{oldBootstrap=false,unownedEdit=false}={}){
 const client=sdk.createClient({storage:storage(),persistentStorage:store,fetchImpl});signInOwner=owner;await client.signIn(owner+'@example.invalid','synthetic',{persist:true});
 const bundle=profile.loadActiveProfile(store),seed=sdk.buildUserState({profile:initial.profile,preferences:bundle.preferences||initial.preferences,eventUserState:bundle.eventUserState,eventSpoilerState:bundle.eventSpoilerState,archivedEvents:[],ratings:bundle.ratings});
 const app=context(sources(),{A:seed,B:seed});Object.assign(app,{setTimeout,clearTimeout,serverSyncClient:client,serverPersistence:{state:'signedOut',user:null},serverStateBaseline:null,PROFILE_STORAGE:profile,SERVER_SYNC:sdk,activeProfileBundle:bundle,localStorage:store,userPreferences:clone(seed.preferences),eventActions:{},eventSpoilerState:{},ratings:{},archivedEventRefs:[],activeEvents:[],serverSyncApplying:false,followSharedHandle(){},mergePreferences:clone,clearFantasyPlaceholderSpace(){},NOTHINGSPORTS_FANTASY_DEADLINES:{hydratePreferences:value=>value||{}},ensureFeedSourceReadiness:async()=>{},rebuildDerivedCardCache(){},renderAll(){},renderTabCounts(){},recordPreferenceChange(){},migrateEventActionRecords:clone,normalizeServerArchiveReferences:items=>items||[],syncLegacyArchiveReferences(){},STORAGE_KEYS:{preferences:'ns_preferences_v1',eventUserState:'ns_event_user_state_v1',eventSpoilerState:'ns_event_spoiler_state_v1',ratings:'ns_ratings_v1'},writeStorage:(key,value)=>store.setItem(key,JSON.stringify(value)),document:{readyState:'loading',getElementById:()=>null},applyThemePreference(){},maybeInviteClassicReview(){},backfillWebPushReminders:async()=>{},queueDirectoryFollowEffects(){},showToast(){},FOLLOW_FIRST:{normalizeMeta:value=>value||{sports:[]},applyMetaSeed:preferences=>({changed:false,preferences})}});
 app.currentServerStatePayload=()=>sdk.buildUserState({profile:initial.profile,preferences:app.userPreferences,eventUserState:app.eventActions,eventSpoilerState:app.eventSpoilerState,archivedEvents:app.archivedEventRefs,ratings:app.ratings});
 app.startupSessionStateBaseline=clone(app.currentServerStatePayload());
 if(unownedEdit){app.userPreferences.unownedLegacyChoice='do-not-import';app.userPreferences.preferenceGraph={entityFollows:[],domainPreferences:[],competitionPreferences:[]};}
 vm.runInContext(slice(html,'function applyServerState(state){','\nasync function hydrateUserMetaSeed(')+'\n'+slice(html,'function setServerStateBaseline(state){','\nfunction emptyServerStatePayload(')+'\n'+slice(html,'function savePreferences(next,','\nfunction '),app);

 vm.runInContext(slice(html,'async function hydrateUserMetaSeed(','\nfunction sydneyPartsFromIso(').replace('}catch(error){','}catch(error){globalThis.diagnosticBootstrapError=error;'),app);
 await app.bootstrapServerPersistence();if(app.diagnosticBootstrapError)console.error(app.diagnosticBootstrapError.stack);assert(['signedIn','error'].includes(app.serverPersistence.state));return app;
}


 const app=await makeApp('A');assert.equal(app.serverPersistence.state,'signedIn');
 const next=clone(app.userPreferences);next.preferenceGraph.entityFollows.push({participantId:'team:synthetic:pending',followed:true});next.showSpoilers=false;next.followFirst.notifications={enabled:false};
 assert.equal(app.savePreferences(next,{deliberate:true,deferFollowEffects:true}),true);
 const receipt=profile.readPreferenceIntent(store,app.activeProfileBundle,'A');assert(receipt);assert.equal(writes,0);
 const staleBundle=clone(app.activeProfileBundle);
 // Quota failure must not update memory or replace the last durable receipt.
 store.fail=true;const failed=clone(next);failed.theme='night';assert.equal(app.savePreferences(failed,{deliberate:true,deferFollowEffects:true}),false);store.fail=false;
 assert.equal(app.userPreferences.theme,'day');assert.equal(profile.readPreferenceIntent(store,app.activeProfileBundle,'A').receiptId,receipt.receiptId);
 const previousLife=app.serverSyncClient.accountSnapshot();signInOwner='A';await app.serverSyncClient.signIn('A@example.invalid','synthetic',{persist:true});app.acknowledgePreferenceReceipt(receipt,{preferences:receipt.preferences},previousLife);assert.equal(profile.readPreferenceIntent(store,app.activeProfileBundle,'A').receiptId,receipt.receiptId,'an old lifetime cannot acknowledge the pending receipt');
 const restart=await makeApp('A',{oldBootstrap:false,unownedEdit:true});
 const restored=restart.userPreferences.preferenceGraph.entityFollows.some(f=>f.participantId==='team:synthetic:pending');
 const result={oldBootstrap:false,restored,writes,status:restart.serverPersistence.state,receiptRemaining:Boolean(profile.readPreferenceIntent(store,restart.activeProfileBundle,'A'))};console.log(JSON.stringify(result));
 assert.equal(restored,true,'new-writer deliberate intent must survive actual same-owner restart');
 assert.equal(writes,1);assert.equal(profile.readPreferenceIntent(store,restart.activeProfileBundle,'A'),null);assert.equal(Object.hasOwn(states.A.preferences,'unownedLegacyChoice'),false,'an existing owned receipt cannot import unowned startup edits');assert.equal(restart.userPreferences.showSpoilers,false);assert.equal(restart.userPreferences.followFirst.notifications.enabled,false);
 // Failed and interrupted acknowledgements remain durable until a matching read/write.
 const failedSave=clone(restart.userPreferences);failedSave.theme='night';assert(restart.savePreferences(failedSave,{deliberate:true,deferFollowEffects:true}));
 saveMode='reject-before';await assert.rejects(restart.syncCurrentServerState(),/synthetic offline save/);assert(profile.readPreferenceIntent(store,restart.activeProfileBundle,'A'));
 const retry=await makeApp('A');assert.equal(retry.userPreferences.theme,'night');assert.equal(profile.readPreferenceIntent(store,retry.activeProfileBundle,'A'),null);
 const lost=clone(retry.userPreferences);lost.theme='day';assert(retry.savePreferences(lost,{deliberate:true,deferFollowEffects:true}));
 saveMode='lost-ack';await assert.rejects(retry.syncCurrentServerState(),/synthetic lost acknowledgement/);assert(profile.readPreferenceIntent(store,retry.activeProfileBundle,'A'));
 const writesBeforeRead=writes,lostAck=await makeApp('A');assert.equal(writes,writesBeforeRead,'an already accepted choice is acknowledged by the matching returned state without another PUT');assert.equal(profile.readPreferenceIntent(store,lostAck.activeProfileBundle,'A'),null);
 // Two accounts can each leave a pending choice, without importing either graph.
 const ownerA=await makeApp('A');const empty=clone(ownerA.userPreferences);empty.preferenceGraph.entityFollows=[];empty.showSpoilers=false;
 assert(ownerA.savePreferences(empty,{deliberate:true,deferFollowEffects:true}));
 const ownerB=await makeApp('B');const bChoices=clone(ownerB.userPreferences);bChoices.preferenceGraph.entityFollows=[{participantId:'team:synthetic:B-only',followed:true}];
 assert(ownerB.savePreferences(bChoices,{deliberate:true,deferFollowEffects:true}));
 assert(profile.readPreferenceIntent(store,ownerB.activeProfileBundle,'A'));assert(profile.readPreferenceIntent(store,ownerB.activeProfileBundle,'B'));
 const aReturn=await makeApp('A');assert.deepEqual(aReturn.userPreferences.preferenceGraph.entityFollows,[]);assert(profile.readPreferenceIntent(store,aReturn.activeProfileBundle,'B'));
 const bReturn=await makeApp('B');assert.equal(bReturn.userPreferences.preferenceGraph.entityFollows[0].participantId,'team:synthetic:B-only');assert.equal(profile.readPreferenceIntent(store,bReturn.activeProfileBundle,'B'),null);
 assert.deepEqual(states.A.preferences.preferenceGraph.entityFollows,[]);
 // A stale bundle/ACK cannot clear a newer receipt or another pending owner.
 let bundle=profile.recordPreferenceIntent(store,staleBundle,{ownerId:'B',generation:1,baseUpdatedAt:'b',basePreferences:{},preferences:{empty:[]}});
 const b=profile.readPreferenceIntent(store,bundle,'B');
 bundle=profile.recordPreferenceIntent(store,bundle,{ownerId:'A',generation:2,baseUpdatedAt:'a',basePreferences:{},preferences:{off:false}});const a=profile.readPreferenceIntent(store,bundle,'A');
 bundle=profile.recordPreferenceIntent(store,bundle,{ownerId:'A',generation:2,baseUpdatedAt:'a',basePreferences:{},preferences:{off:false,removed:[]}});const newer=profile.readPreferenceIntent(store,bundle,'A');
 bundle=profile.saveSection(store,staleBundle,'ratings',{kept:3});
 bundle=profile.acknowledgePreferenceIntent(store,bundle,a,a.preferences);assert.equal(profile.readPreferenceIntent(store,bundle,'A').receiptId,newer.receiptId);assert.equal(profile.readPreferenceIntent(store,bundle,'B').receiptId,b.receiptId);
 assert(profile.preferenceIntentMatches(newer,{...newer.preferences,remoteUntouched:'keep'},sync));assert(!profile.preferenceIntentMatches(newer,{off:true,removed:[]},sync));
 bundle=profile.acknowledgePreferenceIntent(store,bundle,newer,newer.preferences);assert.equal(profile.readPreferenceIntent(store,bundle,'A'),null);assert.equal(profile.readPreferenceIntent(store,bundle,'B').receiptId,b.receiptId);assert.equal(bundle.ratings.kept,3);
 // Unknown/mismatched bases stay visibly pending; no new conflict/import policy.
 const conflictApp=await makeApp('C'),conflictChoice=clone(conflictApp.userPreferences);conflictChoice.theme='night';assert(conflictApp.savePreferences(conflictChoice,{deliberate:true,deferFollowEffects:true}));
 states.C.preferences.selectedBroadcasters=['synthetic-remote'];states.C.updatedAt='2026-10-20T23:10:00Z';const beforeConflictWrites=writes;
 const conflicted=await makeApp('C');assert.equal(conflicted.serverPersistence.state,'error');assert.equal(conflicted.userPreferences.theme,'night');assert.equal(writes,beforeConflictWrites);assert(profile.readPreferenceIntent(store,conflicted.activeProfileBundle,'C'));assert.deepEqual(states.C.preferences.selectedBroadcasters,['synthetic-remote']);
 states.C=null;const missing=await makeApp('C');assert.equal(missing.serverPersistence.state,'error');assert.equal(writes,beforeConflictWrites);assert(profile.readPreferenceIntent(store,missing.activeProfileBundle,'C'));
 console.log('GREEN: actual new writer/restart/ACK, failed save/lost ACK, explicit empty/OFF, quota failure, two pending owners, stale bundle/exact receipt, and pending mismatched/missing bases.');

}

validateActualConflictRetry().then(validateAcceptedBootstrapBaseline).then(validateDurablePreferenceIntent).then(() => require("./lib/user-state-account-scope-tests")()).then(() => {
  console.log("Cross-device sync valid: actual retries preserve untouched cloud choices and original local intent.");
}).catch(error => { console.error(error); process.exitCode = 1; });
