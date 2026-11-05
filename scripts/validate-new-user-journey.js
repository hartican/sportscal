#!/usr/bin/env node
'use strict';
// Offline controls of the actual UI functions. This is not browser/device proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.env.NEW_USER_SOURCE_ROOT || path.join(__dirname,'..'));
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const ui = fs.readFileSync(path.join(root,'config/fantasy-deadline-ui.js'),'utf8');
function section(source,start,end){
  const a = source.indexOf(start), b = source.indexOf(end,a + start.length);
  assert(a >= 0 && b > a,`Missing actual journey seam: ${start}`);
  return source.slice(a,b);
}
class Element {
  constructor(tag='div'){ this.tagName=tag; this.children=[]; this.attributes={}; this.dataset={}; this.isConnected=true; this.value=''; }
  append(...nodes){ this.children.push(...nodes); }
  appendChild(node){ this.append(node); return node; }
  prepend(...nodes){ this.children.unshift(...nodes); }
  focus(){ this.focused=true; }
  addEventListener(name,handler){ (this.listeners ||= {})[name]=handler; }
  closest(){ return this.closestResult || null; }
  replaceChildren(...nodes){ this.children=[...nodes]; this._text=''; }
  setAttribute(key,value){ this.attributes[key]=String(value); }
  getAttribute(key){ return this.attributes[key] ?? null; }
  set textContent(value){ this._text=String(value); this.children=[]; }
  get textContent(){ return (this._text||'')+this.children.map(node=>node.textContent||'').join(''); }
  set innerHTML(value){
    this.markup=value; this.replaceChildren(); const stack=[this];
    for(const token of value.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){
      if(token[0].startsWith('</')){ if(stack.length>1)stack.pop(); continue; }
      const node=new Element(token[1]);
      for(const attr of token[2].matchAll(/([\w-]+)="([^"]*)"/g)){ node.attributes[attr[1]]=attr[2]; node[attr[1]]=attr[2]; }
      stack.at(-1).append(node);
      if(!['input','img','br','hr'].includes(node.tagName))stack.push(node);
    }
  }
  querySelectorAll(selector){
    const found=[];
    const matches=node=>selector.startsWith('#')?node.id===selector.slice(1):selector.startsWith('[')?node.attributes[selector.slice(1,-1).split('=')[0]]===selector.slice(1,-1).split('=')[1]:node.tagName===selector;
    const visit=node=>{for(const child of node.children||[]){if(matches(child))found.push(child);visit(child);}};
    visit(this);return found;
  }
  querySelector(selector){ return this.querySelectorAll(selector)[0]||null; }
  get elements(){ return Object.fromEntries(this.querySelectorAll('input').map(input=>[input.name,input])); }
}
const report=[];
function response(){return {code:200,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
function loadHandler(relative,dependencies,globals={}){
  const source=fs.readFileSync(path.join(root,relative),'utf8');
  const module={exports:{}};
  const sandbox=vm.createContext({module,exports:module.exports,process:{env:{}},URL,URLSearchParams,Buffer,Date,AbortController,
    setTimeout:()=>1,clearTimeout(){},
    fetch(){throw Error('Network forbidden in isolated journey controls');},
    require(name){if(Object.hasOwn(dependencies,name))return dependencies[name];throw Error('Unbound dependency: '+name);},...globals,
  });
  vm.runInContext(source,sandbox,{timeout:1000,filename:relative});
  return module.exports;
}
async function callbackControls(){
  const sdk=loadHandler('config/server-sync.js',{});
  const token=sub=>'x.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.synthetic';
  const a=token('synthetic-A'),b=token('synthetic-B');
  const memory=new Map([[sdk.PERSISTENT_SESSION_STORAGE_KEY,JSON.stringify({accessToken:a,refreshToken:'retained-A',expiresAt:Date.now()+3600000})],['profile-sentinel','exact-raw-A-profile'],['receipt-sentinel','exact-raw-A-receipt']]);
  const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const before=JSON.stringify([...memory]),calls=[];
  let answer={user:{id:'synthetic-B',email:'synthetic-B@example.invalid',emailVerified:true}},status=200;
  const client=sdk.createClient({storage:{getItem:()=>null,setItem(){throw Error('Unexpected session write');},removeItem(){throw Error('Unexpected session delete');}},persistentStorage:storage,fetchImpl:async(destination,options)=>{calls.push({destination,options});return {ok:status===200,status,json:async()=>answer};}});
  let cleaned='';
  const capture=sdk.captureSignupConfirmationFromLocation({location:{pathname:'/',search:'?auth=confirmed&keep=one',hash:'#type=signup&access_token='+b+'&refresh_token=do-not-store&chat=retained'},history:{state:{keep:true},replaceState(_state,_title,url){cleaned=url;}}});
  assert.equal(capture.status,'check_required');assert.equal(cleaned,'/?keep=one#chat=retained');assert(!cleaned.includes(b));
  const outcome=await client.inspectSignupConfirmation(capture.accessToken);
  assert.equal(outcome.status,'confirmed');assert.equal(outcome.user.id,'synthetic-B');assert.equal(client.sessionSubject(),'synthetic-A');
  assert.equal(calls.length,1);assert.equal(calls[0].destination,'/api/auth');assert.equal(calls[0].options.headers.Authorization,'Bearer '+b);assert.equal(JSON.stringify([...memory]),before);
  answer={user:{id:'synthetic-B',emailVerified:false}};assert.equal((await client.inspectSignupConfirmation(b)).status,'not_confirmed');
  answer={user:{id:'synthetic-B'}};assert.equal((await client.inspectSignupConfirmation(b)).status,'identity_checked');
  status=401;await assert.rejects(client.inspectSignupConfirmation(b),error=>error.code==='confirmation_link_invalid');assert.equal(JSON.stringify([...memory]),before);
  const query=sdk.captureSignupConfirmationFromLocation({location:{pathname:'/',search:'?auth=confirmed',hash:''},history:{replaceState(){}}});assert.equal(query.status,'sign_in_required');assert(!query.accessToken);
  const failed=sdk.captureSignupConfirmationFromLocation({location:{pathname:'/',search:'?auth=confirmed',hash:'#type=signup&access_token='+b},history:{replaceState(){throw Error('History unavailable');}}});assert.equal(failed.status,'url_cleanup_failed');assert(!failed.accessToken);
  const error=sdk.captureSignupConfirmationFromLocation({location:{pathname:'/',search:'?auth=confirmed&error_code=otp_expired',hash:''},history:{replaceState(){}}});assert.equal(error.status,'invalid');
  assert.equal(sdk.captureSignupConfirmationFromLocation({location:{search:'?auth=recovery',hash:'#type=recovery&access_token=retained'},history:{replaceState(){assert.fail('Recovery belongs to existing owner');}}}),null);
  const legacy=vm.createContext({SERVER_SYNC:{},URLSearchParams,window:{location:{pathname:'/',search:'?auth=confirmed&keep=one',hash:'#type=signup&access_token=do-not-keep&chat=retained'},history:{replaceState(_state,_title,url){cleaned=url;}}}});
  vm.runInContext(section(html,'function captureSignupReturnWithCurrentHelper(){','let activeSignupConfirmation ='),legacy,{timeout:1000});
  assert.equal(legacy.captureSignupReturnWithCurrentHelper().status,'unavailable');assert.equal(cleaned,'/?keep=one#chat=retained');
  let release;
  const harmless={getItem:()=>null,setItem(){},removeItem(){}};
  const switching=sdk.createClient({storage:harmless,persistentStorage:harmless,fetchImpl:()=>new Promise(resolve=>{release=resolve;})});
  const pending=switching.inspectSignupConfirmation(b);switching.clearSession();release({ok:true,status:200,json:async()=>({user:{id:'synthetic-B',emailVerified:true}})});
  await assert.rejects(pending,error=>error.code==='account_scope_changed');assert.equal(switching.sessionSubject(),'');
  report.push('actual SDK callback scrubs credentials and validates only link bearer; saved A/profile/receipt survive B, expired/unknown/error returns without adopting a session');
}
async function backendControls(){
  let user={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.invalid',email_confirmed_at:null};
  const sideEffects=[];
  class RequestError extends Error {}
  const server={SupabaseRequestError:RequestError,authenticatedUser:async()=>user,bearerToken:()=> 'synthetic-token',
    supabaseConfig:()=>({configured:true}),supabaseServiceRoleConfig:()=>({configured:true}),
    supabaseServiceRequest:async()=>{sideEffects.push('service');throw Error('Unexpected service operation');},
    publicError:error=>({status:error.status||500,body:{code:error.code||'mock_error',error:'Request unavailable'}}),
  };
  const nscServer={profileFor:async()=>null,personaFor:async()=>({moderation_flag:false}),ownerProfile:value=>value,
    refreshEventSnapshots:async()=>{},snapshots:async()=>[],canonicalEventId:id=>id,eventFor:()=>({}),};
  const nsc=loadHandler('lib/nothingscore-handler.js',{'node:crypto':{},'./supabase-server':server,'../config/nothingscore':{SCHEMA_VERSION:'test'},'./nothingscore-server':nscServer});
  for(const action of ['submit','pulse']){
    const reply=response();await nsc({method:'POST',body:{action,eventId:'synthetic'}},reply);
    assert.equal(reply.code,403);assert.equal(reply.body.code,'email_confirmation_required');
  }
  for(const query of [{viewer:'1'},{ids:'synthetic'}]){
    const reply=response();await nsc({method:'GET',query},reply);assert.equal(reply.code,200);assert.equal(reply.body.viewer.ratingEligible,false);
  }
  assert.deepEqual(sideEffects,[]);
  const confirmed='2020-01-01T00:00:00Z';
  for(const bad of [{...user,confirmed_at:confirmed,user_metadata:{emailVerified:true}},{...user,email_confirmed_at:'invalid'},{...user,email_confirmed_at:'2100-01-01T00:00:00Z'},{...user,email_confirmed_at:confirmed,is_anonymous:true},{...user,email:'',email_confirmed_at:confirmed}])assert.equal(nsc._test.emailVerified(bad),false);
  user={...user,email_confirmed_at:confirmed};
  assert.equal(nsc._test.emailVerified(user),true);
  let reply=response();await nsc({method:'GET',query:{viewer:'1'}},reply);assert.equal(reply.body.viewer.ratingEligible,true);
  assert(nsc._test.fullDisplayName('Jack'));assert(!nsc._test.fullDisplayName('J'));assert(!nsc._test.fullDisplayName('x'.repeat(81)));
  reply=response();await nsc({method:'POST',body:{action:'rate'}},reply);assert.equal(reply.code,409);assert.equal(reply.body.code,'nsc_submit_required');
  report.push('actual rating handler denies unverified writes before side effects; both viewers agree; forged/phone/future/anonymous proof refused; legacy write stays closed');
  const capability={ChatCapabilityError:RequestError,createShareCapability:()=>{},parseShareCapability:()=>{},requireShareSecret:()=>{}};
  const chat=loadHandler('api/chat.js',{'node:crypto':{},'node:fs':{readFileSync(){throw Error('Unbound app read');}},'node:path':{},'@vercel/functions':{waitUntil(){}},'../config/chat-contract':{},'../config/chat-policy':{},'../lib/chat-capability':capability,'../lib/supabase-server':server,'../lib/chat-notifications':{dispatchChatMessageNotifications(){}},'../lib/giphy-provider':{}});
  user={...user,email_confirmed_at:null};
  const restricted=['send-message','toggle-reaction','attachment-upload-url','attachment-complete','gif-reference','gif-import','create-room','add-members','enable-share','rotate-share'];
  for(const action of restricted){reply=response();await chat({method:'POST',body:{action}},reply);assert.equal(reply.code,403,action);assert.equal(reply.body.code,'email_confirmation_required',action);}
  for(const action of ['guest-preview','join-shared-room','leave-room','archive-rooms','delete-message','delete-room','saved-media-delete','disable-share','mark-read','mark-delivered'])assert.doesNotThrow(()=>chat._test.requireVerifiedParticipation({action},user));
  assert.throws(()=>chat._test.requireVerifiedParticipation({action:'resolve-invitation',resolution:'accept'},user));
  assert.doesNotThrow(()=>chat._test.requireVerifiedParticipation({action:'resolve-invitation',resolution:'reject'},user));
  user={...user,email_confirmed_at:confirmed};for(const action of restricted)assert.doesNotThrow(()=>chat._test.requireVerifiedParticipation({action},user));
  assert.deepEqual(sideEffects,[]);
  report.push('actual chat handler rejects every mapped participation entry before profile/database writes; safe reads, exits and declines remain available');
  const requests=[];let providerStatus=0;
  const auth=loadHandler('api/auth.js',{'../lib/supabase-server':{...server,requestOrigin:()=> 'https://untrusted.invalid',supabaseRequest:async(destination,options)=>{requests.push({destination,options});if(providerStatus)throw Object.assign(Error('Provider limit'),{status:providerStatus,code:'rate_limited'});return {}; }},'../config/follow-first':{},'../config/chat-contract':{},'../lib/chat-capability':{...capability,anonymousRateHash:()=>'',clientAddress:()=>'',createAnonymousSignupTicket:()=>{}}});
  reply=response();await auth({method:'POST',body:{action:'confirmation-resend',email:'SYNTHETIC@EXAMPLE.INVALID',redirect:'https://untrusted.invalid'}},reply);
  assert.equal(reply.code,200);assert.equal(reply.body.requested,true);assert.equal(requests.length,1);assert.equal(requests[0].options.body.type,'signup');assert.equal(requests[0].options.body.email,'synthetic@example.invalid');
  assert.equal(new URL('https://provider.invalid'+requests[0].destination).searchParams.get('redirect_to'),'https://nothingsport.vercel.app/?auth=confirmed');
  assert(!/delivered|verified|session/i.test(JSON.stringify(reply.body)));
  providerStatus=429;reply=response();await auth({method:'POST',body:{action:'confirmation-resend',email:'synthetic@example.invalid'}},reply);assert.equal(reply.code,429);
  report.push('actual resend adapter fixes signup type and redirect, does not adopt sessions or promise delivery, and preserves provider rate limits');
}
async function guestTransitionControls(){
  let busy=false;
  const locks={request(_name,_options,operation){if(busy)return Promise.resolve().then(()=>operation(null));busy=true;return Promise.resolve().then(()=>operation({name:'synthetic-lock'})).finally(()=>{busy=false;});}};
  const profiles=loadHandler('config/profile-storage.js',{}, {navigator:{locks}}),sdk=loadHandler('config/server-sync.js',{});
  function ram(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
  let storage=ram(),bundle=profiles.loadActiveProfile(storage);
  const prefs={version:26,onboardingComplete:true,selectedSelectorEntityIds:['sport:afl'],followedSports:['afl'],preferenceGraph:{entityFollows:[{participantId:'team:afl:guest',followLevel:'follow'}]},unknownDeviceChoice:{keep:true}};
  bundle=profiles.saveSection(storage,bundle,'preferences',prefs);
  const originalId=bundle.profile.id,originalKey=profiles.KEYS.profilePrefix+originalId,originalRaw=storage.getItem(originalKey);
  const capture=await profiles.captureAccountTransition(storage,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>true});
  assert.equal(capture.sourceRaw,originalRaw);assert.equal(capture.preferencesRaw,JSON.stringify(prefs));assert.equal(capture.freshGuest,true);
  assert.equal((await profiles.captureAccountTransition(storage,bundle,{preferences:prefs,ownerId:null,generation:1,current:()=>true})).id,capture.id);
  await assert.rejects(()=>profiles.captureAccountTransition(storage,bundle,{preferences:{...prefs,changed:true},ownerId:null,generation:0,current:()=>true}));
  const concurrent=await Promise.allSettled([
    profiles.activateAccountProfile(storage,capture,{accountId:'synthetic-B',preferenceVersion:26,hasRemoteState:false,current:()=>true}),
    profiles.activateAccountProfile(storage,capture,{accountId:'synthetic-C',preferenceVersion:26,hasRemoteState:false,current:()=>true}),
  ]);
  assert.equal(concurrent[0].status,'fulfilled');assert.equal(concurrent[1].status,'rejected');assert.match(concurrent[1].reason.message,/Another tab/);
  const target=concurrent[0].value;
  assert.equal(storage.getItem(originalKey),originalRaw);assert.notEqual(target.bundle.profile.id,originalId);assert.equal(target.bundle.preferences.version,26);assert.equal(target.bundle.preferences.selectedSelectorEntityIds.length,0);assert.equal(target.bundle.entityFollows.length,0);assert.equal(target.associationRequired,true);
  assert.equal(profiles.readAccountTransition(storage).pending.remoteStateWasPresent,false);
  await assert.rejects(()=>profiles.activateAccountProfile(storage,capture,{accountId:'synthetic-C',preferenceVersion:26,hasRemoteState:false,current:()=>true}));
  await profiles.completeAccountTransition(storage,capture,{accountId:'synthetic-B',current:()=>true});
  assert.equal(profiles.readAccountTransition(storage).pending.sourceRaw,originalRaw);
  const restored=await profiles.activateDeviceProfile(storage,{current:()=>true});assert.equal(restored.profile.id,originalId);assert.equal(restored.preferences.unknownDeviceChoice.keep,true);
  storage=ram();bundle=profiles.loadActiveProfile(storage);const untouched=storage.getItem(profiles.KEYS.profilePrefix+bundle.profile.id);
  const denied={getItem:storage.getItem,setItem(key,value){if(key===profiles.KEYS.accountTransition)throw Error('storage full');storage.setItem(key,value);},removeItem:storage.removeItem};
  await assert.rejects(()=>profiles.captureAccountTransition(denied,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>true}),/storage full/);assert.equal(storage.getItem(profiles.KEYS.profilePrefix+bundle.profile.id),untouched);
  await assert.rejects(()=>profiles.captureAccountTransition(storage,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>false}));
  const unsupported=loadHandler('config/profile-storage.js',{});
  await assert.rejects(()=>unsupported.captureAccountTransition(storage,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>true}),/Continue as a guest/);
  storage=ram();bundle=profiles.loadActiveProfile(storage);
  const racingKey=profiles.KEYS.profilePrefix+bundle.profile.id,racingRaw=storage.getItem(racingKey);
  let interleaved=false;
  const uncooperative={getItem:storage.getItem,removeItem:storage.removeItem,setItem(key,value){storage.setItem(key,value);if(key===profiles.KEYS.accountTransition&&!interleaved){interleaved=true;profiles.saveSection(storage,bundle,'preferences',{version:26,ordinaryWriterChoice:'kept'});}}};
  await assert.rejects(()=>profiles.captureAccountTransition(uncooperative,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>true}),/changed while being preserved/);
  assert.equal(profiles.readAccountTransition(storage).pending.sourceRaw,racingRaw);assert.equal(JSON.parse(storage.getItem(racingKey)).preferences.ordinaryWriterChoice,'kept');
  const returned=await profiles.activateDeviceProfile(storage,{current:()=>true,allowPending:true});assert.equal(returned.preferences.ordinaryWriterChoice,'kept');
  report.push('actual ordinary profile writer interleaving outside the transition lock invalidates capture while preserving both original raw capture and newer device choices');
  storage=ram();bundle=profiles.loadActiveProfile(storage);
  bundle=profiles.recordPreferenceIntent(storage,bundle,{ownerId:'synthetic-B',generation:8,baseUpdatedAt:null,basePreferences:{version:26},preferences:{version:26,preferenceGraph:{entityFollows:[{participantId:'team:afl:B-pending',followLevel:'unfollow'}]}},expectedReceipt:null});
  const retainedB=profiles.readPreferenceIntent(storage,bundle,'synthetic-B');
  bundle=profiles.recordPreferenceIntent(storage,bundle,{ownerId:'synthetic-A',generation:9,baseUpdatedAt:null,basePreferences:{version:26},preferences:{version:26,preferenceGraph:{entityFollows:[{participantId:'team:afl:A-pending',followLevel:'follow'}]}},expectedReceipt:null});
  const rawWithReceipts=storage.getItem(profiles.KEYS.profilePrefix+bundle.profile.id);
  const ownedCapture=await profiles.captureAccountTransition(storage,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>true});
  const ownB=await profiles.activateAccountProfile(storage,ownedCapture,{accountId:'synthetic-B',preferenceVersion:26,hasRemoteState:true,current:()=>true});
  assert.equal(JSON.stringify(profiles.readPreferenceIntent(storage,ownB.bundle,'synthetic-B')),JSON.stringify(retainedB));assert.equal(profiles.readPreferenceIntent(storage,ownB.bundle,'synthetic-A'),null);
  assert.equal(storage.getItem(profiles.KEYS.profilePrefix+bundle.profile.id),rawWithReceipts);
  report.push('actual profile storage keeps exact device/unknown choices, isolates B, blocks C, and retains a recoverable copy through repeat capture, quota and lifetime failures');
  const f=fixture();storage=ram();bundle=profiles.loadActiveProfile(storage);bundle=profiles.saveSection(storage,bundle,'preferences',prefs);
  const sourceKey=profiles.KEYS.profilePrefix+bundle.profile.id,sourceRaw=storage.getItem(sourceKey),calls=[];
  const token='x.'+Buffer.from(JSON.stringify({sub:'synthetic-B'})).toString('base64url')+'.synthetic';
  const client=sdk.createClient({storage:ram(),persistentStorage:storage,fetchImpl:async(destination,options={})=>{
    calls.push({destination,method:options.method||'GET'});
    if(destination==='/api/auth'){
      assert.equal(profiles.readAccountTransition(storage).pending.sourceRaw,sourceRaw,'capture must be durable BEFORE the real SDK sign-in request');
      return {ok:true,status:200,json:async()=>({session:{access_token:token,refresh_token:'synthetic-B-only',expires_in:3600}})};
    }
    if(destination==='/api/user-state'&&(!options.method||options.method==='GET'))return {ok:true,status:200,json:async()=>({user:{id:'synthetic-B'},state:null})};
    assert.fail('Unexpected account write or metadata request: '+destination);
  }});
  Object.assign(f.context,{PROFILE_STORAGE:profiles,SERVER_SYNC:sdk,serverSyncClient:client,activeProfileBundle:bundle,localStorage:storage,userPreferences:prefs,serverPersistence:{state:'signedOut',user:null},serverStateBaseline:null,
    accountAssociationInFlight:null,accountIndicatorJourney:null,serverStateSyncGeneration:0,localPreferenceRecoveryBusy:false,localPreferenceRecoveryBlocked:()=>false,DEFAULT_PREFERENCES:{version:26},
    invalidateServerStateSyncScope(){return ++f.context.serverStateSyncGeneration;},setServerPersistence(value){f.context.serverPersistence={...f.context.serverPersistence,...value};},
    loadPreferences:()=>f.context.activeProfileBundle.preferences,migrateEventActionRecords:value=>value,normalizeServerArchiveReferences:value=>value,
    currentServerStatePayload:()=>({preferences:f.context.userPreferences}),setServerStateBaseline(value){f.context.serverStateBaseline={state:value,accountId:'synthetic-B'};},
    serverErrorEndsSession:()=>false,hydrateUserMetaSeed:async()=>assert.fail('Absent row cannot seed guest metadata'),syncCurrentServerState:async()=>assert.fail('Absent row cannot auto-save guest choices'),
  });
  vm.runInContext(section(html,'function pendingDeviceAccountTransition(){','function saveActiveProfileSection(')+section(html,'function serverStateSyncScope(','async function reconcileCurrentServerState(')+section(html,'async function bootstrapServerPersistence(','function sydneyPartsFromIso('),f.context,{timeout:1000});
  const preAuth=await f.context.preserveDeviceChoicesBeforeAuth();await client.signIn('synthetic@example.invalid','synthetic-password-only');
  await f.context.bootstrapServerPersistence({checkStatus:false,authTransitionId:preAuth.id});
  assert.equal(f.context.serverPersistence.user.id,'synthetic-B');assert.equal(f.context.serverPersistence.state,'signedIn');assert.match(f.context.serverPersistence.message,/separately/);
  assert.equal(storage.getItem(sourceKey),sourceRaw);assert.notEqual(f.context.activeProfileBundle.profile.id,bundle.profile.id);assert.equal(f.context.userPreferences.selectedSelectorEntityIds.length,0);
  assert.equal(f.context.accountTransitionBlocksSync(),true);assert.equal(calls.filter(call=>call.destination==='/api/user-state').length,1);assert.equal(calls.filter(call=>call.method!=='GET').length,1);
  report.push('actual capture + SDK sign-in + bootstrap keep the device copy separate and refuse absent-row guest import, metadata and autosave');
  const patches=loadHandler('config/user-state-sync.js',{'./follow-first':{participantFollowIdentityKey:id=>id}});
  for(const outcome of ['unavailable','wrong-owner','acknowledged']){
    const view=fixture();storage=ram();bundle=profiles.loadActiveProfile(storage);
    bundle=profiles.saveSection(storage,bundle,'preferences',prefs);
    const handoff=await profiles.captureAccountTransition(storage,bundle,{preferences:prefs,ownerId:null,generation:0,current:()=>true});
    const activated=await profiles.activateAccountProfile(storage,handoff,{accountId:'synthetic-B',preferenceVersion:26,hasRemoteState:true,current:()=>true});
    const baseline={version:26,onboardingComplete:true,selectedSelectorEntityIds:[],followedSports:[],preferenceGraph:{entityFollows:[{participantId:'team:afl:B-kept',followLevel:'mute',unknownField:'keep'}]},unknownAccountChoice:'keep'};
    const life={accountId:'synthetic-B',generation:2,hasSession:true};
    Object.assign(view.context,{PROFILE_STORAGE:profiles,USER_STATE_SYNC:patches,SERVER_SYNC:sdk,localStorage:storage,activeProfileBundle:activated.bundle,
      userPreferences:JSON.parse(JSON.stringify(baseline)),settingsSection:'account',settingsDraftBaseline:baseline,
      serverStateBaseline:{accountId:life.accountId,generation:life.generation,state:{preferences:baseline},updatedAt:null},serverPersistence:{state:'signedIn',user:{id:life.accountId}},accountAssociationInFlight:null,
      selectorEntityById:()=>null,followedParticipantLabel:id=>id,FOLLOW_FIRST:{participantFollowIdentityKey:id=>id},
      mergePreferences:value=>JSON.parse(JSON.stringify(value)),preferenceIntentOwner:()=>life,
      pendingPreferenceIntent:owner=>profiles.readPreferenceIntent(storage,view.context.activeProfileBundle,owner),
      setServerPersistence(value){Object.assign(view.context.serverPersistence,value);},queueServerStateSync(){},
    });
    view.context.serverSyncClient.accountSnapshot=()=>({...life});
    view.context.syncCurrentServerState=async()=>{
      assert.equal(view.context.accountAssociationInFlight.id,handoff.id);
      const receipt=view.context.pendingPreferenceIntent(life.accountId);
      assert(receipt,'selected choices must have a real owner-bound receipt before sync');
      if(outcome==='unavailable')return null;
      const preferences=JSON.parse(JSON.stringify(view.context.userPreferences));
      if(outcome==='acknowledged'){
        view.context.activeProfileBundle=profiles.acknowledgePreferenceIntent(storage,view.context.activeProfileBundle,receipt,preferences,patches);
        view.context.serverPersistence.state='signedIn';
      }
      return {user:{id:outcome==='wrong-owner'?'synthetic-C':life.accountId},state:{preferences}};
    };
    vm.runInContext(section(html,'function savePreferences(next,','function applyThemePreference(')+section(html,'function appendDeviceAccountTransitionSettings(body){','function appendPublicProfileAccountSettings('),view.context,{timeout:1000});
    view.context.appendDeviceAccountTransitionSettings(view.body);
    const checkbox=view.body.querySelector('input');assert(checkbox);assert.equal(checkbox.checked,false,'existing account differences require a deliberate selection');checkbox.checked=true;
    const apply=view.body.querySelectorAll('button').find(button=>button.textContent==='Save selected choices to this account');
    await apply.onclick();
    assert.equal(view.context.userPreferences.unknownAccountChoice,'keep');
    assert.equal(view.context.userPreferences.preferenceGraph.entityFollows.find(item=>item.participantId==='team:afl:B-kept').unknownField,'keep');
    const imported=view.context.userPreferences.preferenceGraph.entityFollows.find(item=>item.participantId==='team:afl:guest');
    assert(imported,'Association did not persist the selected synthetic team: '+view.body.textContent+' '+view.state.toasts.join(' '));
    assert.equal(imported.followLevel,'follow');
    assert.equal(profiles.readAccountTransition(storage).pending.status,outcome==='acknowledged'?'resolved':'pending');
    assert.deepEqual(view.state.routes,outcome==='acknowledged'?['feed']:[]);
    assert.equal(Boolean(view.context.pendingPreferenceIntent(life.accountId)),outcome!=='acknowledged');
    assert.equal(view.context.accountAssociationInFlight,null);
  }
  report.push('actual association form + save/patch/receipt path preserves unrelated B choices and resolves only matching owned ACK; unavailable or wrong-owner results retain pending work');
  const completion=fixture();storage=ram();bundle=profiles.loadActiveProfile(storage);
  const initial={version:26,onboardingComplete:false,followedSports:['afl'],selectedSelectorEntityIds:['sport:afl'],fantasyDeadlines:{enabled:false},followFirst:{startupMeta:{sports:['afl']}},preferenceGraph:{entityFollows:[]}};
  const owner={accountId:'synthetic-B',generation:3,hasSession:true};
  completion.context.serverSyncClient.accountSnapshot=()=>owner;completion.context.serverSyncClient.saveMeta=async()=>{};
  Object.assign(completion.context,{PROFILE_STORAGE:profiles,USER_STATE_SYNC:patches,SERVER_SYNC:sdk,localStorage:storage,activeProfileBundle:bundle,
    userPreferences:JSON.parse(JSON.stringify(initial)),draftPreferences:JSON.parse(JSON.stringify(initial)),settingsDraftBaseline:JSON.parse(JSON.stringify(initial)),onboardingAccountScope:owner,
    serverStateBaseline:{accountId:owner.accountId,generation:owner.generation,state:{preferences:initial},updatedAt:null},serverPersistence:{state:'signedIn',user:{id:owner.accountId}},
    preferenceIntentOwner:()=>owner,pendingPreferenceIntent:id=>profiles.readPreferenceIntent(storage,completion.context.activeProfileBundle,id),
    mergePreferences:value=>JSON.parse(JSON.stringify(value)),syncDraftSelectorSports(){},setServerPersistence(value){Object.assign(completion.context.serverPersistence,value);},queueServerStateSync(){},
    syncNotificationInstallationPreferences:async()=>{},recordSavedPreferenceChanges(){},writeStorage(){},applyThemePreference(){},renderAll(){},
    NOTHINGSPORTS_FANTASY_DEADLINES:{onboardingChoice:enabled=>({enabled})},STORAGE_KEYS:{selectorReleaseAcknowledgement:'synthetic'},SELECTOR_TAXONOMY:{version:'synthetic'},
  });
  vm.runInContext(section(html,'function savePreferences(next,','function applyThemePreference(')+section(html,'function persistOnboardingDraft(){','function tuningInteractionDelta(')+section(html,'function saveSettingsPreferences(){','function advanceOnboardingOrSave('),completion.context,{timeout:1000});
  assert.equal(completion.context.saveSettingsPreferences(),true);
  const completedReceipt=profiles.readPreferenceIntent(storage,completion.context.activeProfileBundle,owner.accountId);
  assert.equal(completedReceipt.preferences.onboardingComplete,true,'the final accepted completion must be in the owned pending receipt');
  assert.equal(completion.context.activeProfileBundle.preferences.onboardingComplete,true);assert.deepEqual(completion.state.routes,['feed']);
  report.push('actual final onboarding save records completion in the owned receipt and local profile before returning Feed');
  for(const scenario of ['create','unavailable-resume','row-appears','creation-conflict']){
    storage=ram();bundle=profiles.loadActiveProfile(storage);const guestPreferences={...prefs};delete guestPreferences.preferenceGraph;
    bundle=profiles.commitSections(storage,bundle,{preferences:guestPreferences,entityFollows:prefs.preferenceGraph.entityFollows});
    const deviceKey=profiles.KEYS.profilePrefix+bundle.profile.id,deviceRaw=storage.getItem(deviceKey);
    let reads=0,writes=0,failed=false,created=null;
    const row=state=>({schema_version:state.schemaVersion,profile:state.profile,preferences:state.preferences,event_user_state:state.eventUserState,event_spoiler_state:state.eventSpoilerState,archived_events:state.archivedEvents,ratings:state.ratings,updated_at:'2026-11-05T00:00:00Z'});
    const appeared=()=>row(sdk.buildUserState({preferences:{version:26,selectedSelectorEntityIds:['sport:tennis'],preferenceGraph:{entityFollows:[{participantId:'team:remote:newer',followLevel:'mute'}]}}}));
    const transport=async(destination,options={})=>{
      if(destination==='/api/auth')return {ok:true,status:200,json:async()=>({session:{access_token:token,refresh_token:'synthetic-B-only',expires_in:3600}})};
      assert.equal(destination,'/api/user-state','connected handoff must not seed metadata or call another service');
      if(!options.method||options.method==='GET'){
        reads++;
        return {ok:true,status:200,json:async()=>({user:{id:'synthetic-B'},state:created||((scenario==='row-appears'&&reads>1)||(scenario==='creation-conflict'&&writes>0)?appeared():null)})};
      }
      assert.equal(options.method,'PUT');writes++;
      const patch=JSON.parse(options.body).patch;assert.equal(patch.baseUpdatedAt,null,'first-row creation must use normal absence CAS');
      if(scenario==='unavailable-resume'&&!failed){failed=true;return {ok:false,status:503,json:async()=>({code:'synthetic_unavailable',error:'Synthetic save unavailable'})};}
      if(scenario==='creation-conflict')return {ok:false,status:409,json:async()=>({code:'user_state_conflict',error:'Synthetic row appeared'})};
      created=row(patches.applyPatch(sdk.buildUserState(),patch));return {ok:true,status:200,json:async()=>({user:{id:'synthetic-B'},state:created})};
    };
    let realClient=sdk.createClient({storage:ram(),persistentStorage:storage,fetchImpl:transport});
    function mounted(){
      const m=fixture(),modal={classList:{contains:name=>name==='show'}};
      m.context.document.getElementById=id=>id==='settingsModal'?modal:null;
      Object.assign(m.context,{PROFILE_STORAGE:profiles,USER_STATE_SYNC:patches,SERVER_SYNC:sdk,localStorage:storage,serverSyncClient:realClient,activeProfileBundle:profiles.loadActiveProfile(storage),
        settingsSection:'account',serverPersistence:{state:'signedOut',user:null},serverStateBaseline:null,serverStateSyncGeneration:0,serverSyncSequence:Promise.resolve(),serverSyncTimer:null,
        accountAssociationInFlight:null,accountIndicatorJourney:null,accountIndicatorGeneration:-1,localPreferenceRecoveryBusy:false,localPreferenceRecoveryBlocked:()=>false,DEFAULT_PREFERENCES:{version:26},
        productEventOwnerId:null,productEventsQueue:{clear(){}},productExposureKeys:new Set(),clearCachedPersonalisedFeed:async()=>{},syncChatSessionState(){},syncNothingscoreSessionState(){},renderAccountIndicator(){},
        publicProfileSettingsLoading:{owner:'synthetic-B',generation:realClient.accountSnapshot().generation},nothingscoreViewerScope:{owner:'synthetic-B',generation:realClient.accountSnapshot().generation},
        setPreferenceRecovery(){},serverErrorEndsSession:()=>false,clearTimeout(){},
        mergePreferences:value=>JSON.parse(JSON.stringify(value)),migrateEventActionRecords:value=>value,normalizeServerArchiveReferences:value=>value,selectorEntityById:()=>null,followedParticipantLabel:id=>id,FOLLOW_FIRST:{participantFollowIdentityKey:id=>id},
        serverAuthoritativeFixturePins:(_remote,current)=>current,clearAcknowledgedFixturePinCommands(){},fantasyPreferencesDiffer:()=>false,
        hydrateUserMetaSeed:async()=>assert.fail('Pending guest handoff cannot seed metadata'),
        applyServerState(state){m.context.userPreferences=JSON.parse(JSON.stringify(state.preferences));},
      });
      m.context.loadPreferences=()=>({...m.context.activeProfileBundle.preferences,preferenceGraph:{entityFollows:m.context.activeProfileBundle.entityFollows||[]}});
      m.context.currentServerStatePayload=()=>sdk.buildUserState({preferences:m.context.userPreferences});
      m.context.userPreferences=m.context.loadPreferences();
      m.context.renderSettingsScreen=()=>{m.body.isConnected=false;m.body=new Element();m.context.appendDeviceAccountTransitionSettings(m.body);};
      vm.runInContext(section(html,'function pendingDeviceAccountTransition(){','function saveActiveProfileSection(')
        +section(html,'function setServerPersistence(patch){','function currentServerStatePayload(')
        +section(html,'function setServerStateBaseline(state){','function localPreferenceRecoveryBlocked(')
        +section(html,'function invalidateServerStateSyncScope(){','function serverStateSyncScope(')
        +section(html,'function serverStateSyncScope(','function normalizeServerArchiveReferences(')
        +section(html,'function preferenceIntentOwner(){','function sydneyPartsFromIso(')
        +section(html,'function savePreferences(next,','function applyThemePreference(')
        +section(html,'function appendDeviceAccountTransitionSettings(body){','function appendPublicProfileAccountSettings('),m.context,{timeout:1000});
      // Avoid scheduled saves; the real explicit sync path above is exercised.
      m.context.queueServerStateSync=()=>false;
      return m;
    }
    let m=mounted();const captured=await m.context.preserveDeviceChoicesBeforeAuth();await realClient.signIn('synthetic@example.invalid','synthetic-password-only');
    await m.context.bootstrapServerPersistence({checkStatus:false,authTransitionId:captured.id});
    assert.equal(m.context.serverStateBaseline.accountCreation.handoffId,captured.id);assert.equal(writes,0);
    m.context.renderSettingsScreen();let button=m.body.querySelectorAll('button').find(item=>item.textContent==='Save selected choices to this account');assert(button);await button.onclick();
    if(scenario==='unavailable-resume'){
      const retained=profiles.readPreferenceIntent(storage,m.context.activeProfileBundle,'synthetic-B');assert(retained);assert.equal(profiles.readAccountTransition(storage).pending.status,'pending');assert.deepEqual(m.state.routes,[]);
      realClient=sdk.createClient({storage:ram(),persistentStorage:storage,fetchImpl:transport});
      m=mounted();await m.context.bootstrapServerPersistence({checkStatus:false});m.context.renderSettingsScreen();
      button=m.body.querySelectorAll('button').find(item=>item.textContent==='Retry saved account choices sync');assert(button,'reload must offer owner-bound retry even when all selected choices already match locally');
      assert.equal(profiles.readPreferenceIntent(storage,m.context.activeProfileBundle,'synthetic-B').receiptId,retained.receiptId);await button.onclick();
    }
    const success=['create','unavailable-resume'].includes(scenario);
    assert.equal(profiles.readAccountTransition(storage).pending.status,success?'resolved':'pending',scenario);
    assert.equal(Boolean(profiles.readPreferenceIntent(storage,m.context.activeProfileBundle,'synthetic-B')),!success,scenario);
    assert.equal(storage.getItem(deviceKey),deviceRaw);assert.deepEqual(m.state.routes,success?['feed']:[]);
    if(scenario==='row-appears')assert.equal(writes,0,'a populated row cannot be treated as authenticated absence');
    if(scenario==='creation-conflict')assert.equal(writes,1,'a CAS conflict must load/hold the appeared row, not overwrite it');
  }
  report.push('connected actual bootstrap/absence witness, rerendering account state, association, deliberate receipt, SDK/reconcile/CAS/ACK: fresh create and reload retry succeed; appeared row and409 conflict retain originals/intent');
}
function fixture(){
  const state={life:{accountId:'',generation:1},saved:[],toasts:[],routes:[],writes:[],saveOkay:true,meta:{sports:['afl']}};
  const body=new Element(),document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),getElementById:()=>null};
  const context=vm.createContext({document,settingsFirstRun:true,settingsSection:'startup',settingsViewportAnchor:{},
    draftPreferences:{preferenceGraph:{entityFollows:[{participantId:'team:afl:muted',followLevel:'mute'}]}},
    startupMetaDraft:()=>state.meta,wizardProgressMarkup:()=>'',
    FOLLOW_FIRST:{STARTUP_SPORTS:[{id:'afl',label:'AFL'},{id:'tennis',label:'Tennis'}]},
    serverSyncClient:{accountSnapshot:()=>({...state.life}),signUp:async()=>{state.writes.push('signup');return {session:null};},nothingscoreRequest:async(_query,command)=>{state.writes.push(command);}},
    clonePreferences:value=>JSON.parse(JSON.stringify(value)),
    applyStartupMetaDraft:patch=>{state.meta={...state.meta,...patch};},
    persistOnboardingDraft:()=>{if(state.saveOkay)state.saved.push(JSON.stringify(context.draftPreferences));return state.saveOkay;},
    savePreferences:()=>state.saveOkay,preserveDeviceChoicesBeforeAuth:()=>true,userPreferences:{onboardingComplete:true},
    showToast:text=>state.toasts.push(text),activateTopLevelTab:tab=>state.routes.push(tab),closeSettings:()=>{},renderSettingsScreen:()=>{},
    bootstrapServerPersistence:async()=>{},directoryFilters:()=>({genderCategory:'male'}),
    NOTHINGSPORTS_PARTICIPANT_DIRECTORY:{isUnresolvedTeam:record=>record.placeholder===true},
    PREFERENCE_SYSTEM:{setEntityFollow:(graph,id,level)=>({...graph,entityFollows:[...graph.entityFollows.filter(record=>record.participantId!==id),{participantId:id,followLevel:level}]})},
    loadFollowDirectoryChunk:async()=>({records:[{id:'team:afl:first',displayName:'First',entityType:'team',genderCategory:'male'},{id:'team:afl:muted',displayName:'Muted',entityType:'team',genderCategory:'male'},{id:'slot:later',displayName:'Winner of final',entityType:'team',placeholder:true},{id:'athlete:afl:one',displayName:'Player',entityType:'athlete'}]}),
    refreshNothingscoreViewer:async()=>{},refreshChatActive:async()=>{},setChatDrawerOpen:()=>{},setNothingscoreDrawerOpen:()=>{},
  });
  const functions=section(ui,'function renderStartupMetadataSettings(body){','globalThis.notificationDiagnosticsCommand =')
    + section(html,'let pendingProfilePhoto = null;','function nothingscoreProfileForm(){');
  vm.runInContext(functions,context,{timeout:1000});
  return {state,body,context};
}
async function run(){
  new vm.Script(ui,{filename:'config/fantasy-deadline-ui.js'});
  let f=fixture();f.context.renderStartupMetadataSettings(f.body);
  assert(!/type="email"|type="password"|personalisedOffersConsent|startupLocation|notificationPermission/.test(f.body.markup),'first-run sports must have no account, offers, location or notification gate');
  const sports=f.body.querySelector('#startupSportsGrid').querySelectorAll('input');sports[1].checked=true;sports[1].onchange();
  assert(Array.isArray(f.state.meta.sports));assert.deepEqual(Array.from(f.state.meta.sports),['afl','tennis']);assert.equal(f.state.saved.length,1);assert.deepEqual(f.state.writes,[]);
  report.push('guest sport selection persists without identity or notification requests');
  // Use the real baseline/delta merger and real savePreferences call site;
  // storage ACK and unrelated fixture effects remain isolated adapters.
  f=fixture();
  const baseline={followedSports:['afl'],followFirst:{notifications:{enabled:false}},preferenceGraph:{entityFollows:[{participantId:'team:afl:old',followLevel:'follow'}]},unknown:{keep:'original'}};
  const latest=JSON.parse(JSON.stringify(baseline));latest.preferenceGraph.entityFollows.push({participantId:'team:afl:newer',followLevel:'mute',customField:'keep'});latest.unknown.keep='newer';
  const draft=JSON.parse(JSON.stringify(baseline));draft.preferenceGraph.entityFollows.push({participantId:'team:afl:chosen',followLevel:'follow'});
  const sync=loadHandler('config/user-state-sync.js',{'./follow-first':{participantFollowIdentityKey:id=>id}});
  const sdk=loadHandler('config/server-sync.js',{});
  f.state.life={accountId:'owned-synthetic',generation:1};
  const writes=[];
  Object.assign(f.context,{USER_STATE_SYNC:sync,SERVER_SYNC:sdk,userPreferences:latest,draftPreferences:draft,settingsDraftBaseline:JSON.parse(JSON.stringify(baseline)),onboardingAccountScope:{...f.state.life},
    syncDraftSelectorSports(){},mergePreferences:value=>JSON.parse(JSON.stringify(value)),serverPersistence:{user:{id:'owned-synthetic'}},serverStateBaseline:{accountId:'owned-synthetic',generation:1,state:{preferences:baseline},updatedAt:null},
    preferenceIntentOwner:()=>({...f.state.life}),pendingPreferenceIntent:()=>null,activeProfileBundle:{},
    PROFILE_STORAGE:{recordPreferenceIntent(_storage,_bundle,options){writes.push(options);return {}; }},localStorage:{},
    setServerPersistence(){},queueServerStateSync(){},});
  vm.runInContext(section(html,'function savePreferences(next,','function applyThemePreference(')+section(html,'function persistOnboardingDraft(){','function tuningInteractionDelta(){'),f.context,{timeout:1000});
  assert.equal(f.context.persistOnboardingDraft(),true);
  assert.equal(writes.length,1);
  const actual=f.context.userPreferences.preferenceGraph.entityFollows;
  assert.equal(actual.find(record=>record.participantId==='team:afl:newer').customField,'keep');
  assert.equal(actual.find(record=>record.participantId==='team:afl:newer').followLevel,'mute');
  assert.equal(actual.find(record=>record.participantId==='team:afl:chosen').followLevel,'follow');
  assert.equal(f.context.userPreferences.unknown.keep,'newer');assert.equal(f.context.draftPreferences,draft);
  const accepted=JSON.stringify(f.context.settingsDraftBaseline);f.context.PROFILE_STORAGE.recordPreferenceIntent=()=>{throw Error('storage full');};
  f.context.draftPreferences.preferenceGraph.entityFollows.push({participantId:'team:afl:unsaved',followLevel:'follow'});
  assert.equal(f.context.persistOnboardingDraft(),false);assert.equal(JSON.stringify(f.context.settingsDraftBaseline),accepted);assert(!f.context.userPreferences.preferenceGraph.entityFollows.some(record=>record.participantId==='team:afl:unsaved'));
  report.push('actual incremental setup/save path preserves newer same-owner choices and unknown fields; failed storage cannot advance the accepted draft baseline');
  f=fixture();f.context.settingsSection='teams';await f.context.renderOnboardingTeams(f.body);
  let choices=f.body.querySelector('#onboardingTeamChoices'),inputs=choices.querySelectorAll('input').filter(input=>input.type==='checkbox');
  assert.equal(inputs.length,2,'offer supported teams, excluding bracket placeholders and players when teams exist');
  inputs[0].checked=true;inputs[0].onchange();assert.equal(f.context.draftPreferences.preferenceGraph.entityFollows.find(record=>record.participantId==='team:afl:first').followLevel,'follow');
  assert.equal(f.context.draftPreferences.preferenceGraph.entityFollows.find(record=>record.participantId==='team:afl:muted').followLevel,'mute');
  const before=JSON.stringify(f.context.draftPreferences);f.state.saveOkay=false;inputs[0].checked=false;inputs[0].onchange();assert.equal(JSON.stringify(f.context.draftPreferences),before);assert.equal(inputs[0].checked,true);
  f.state.life.generation++;inputs[0].checked=false;inputs[0].onchange();assert.equal(JSON.stringify(f.context.draftPreferences),before);
  report.push('actual team controls preserve mutes, recover failed saves and reject account changes');
  f=fixture();f.context.settingsSection='teams';let release;f.context.loadFollowDirectoryChunk=()=>new Promise(resolve=>{release=resolve;});
  const pending=f.context.renderOnboardingTeams(f.body);f.state.life.accountId='another-account';release({records:[{id:'team:late',displayName:'Old account',entityType:'team'}]});await pending;
  assert(!f.body.textContent.includes('Old account'));assert.deepEqual(f.state.saved,[]);
  report.push('late directory response cannot cross an account transition');
  f=fixture();f.context.settingsSection='create-account';f.context.renderCreateAccountSettings(f.body);
  const form=f.body.querySelector('form');form.elements.email.value='synthetic@example.invalid';form.elements.password.value='synthetic-password-only';
  await form.onsubmit({preventDefault(){}});await form.onsubmit({preventDefault(){}});
  assert.deepEqual(f.state.writes,['signup']);assert.match(form.querySelector('[role=status]').textContent,/request accepted/);assert.equal(form.elements.password.value,'');
  f.body.querySelector('#continueGuestFeed').onclick();assert.deepEqual(f.state.routes,['feed']);
  report.push('one signup request, truthful no-session completion, independent continuation to Feed');
  f=fixture();let metadataOkay=false;
  f.context.serverSyncClient.nothingscoreRequest=async()=>{throw Error('handle taken');};
  await assert.rejects(f.context.savePublicProfileAndReturnToFeed({displayName:'Synthetic Person',handle:'synthetic',editor:{upload:async()=>{}},current:()=>true}),/handle taken/);
  assert.deepEqual(f.state.routes,[]);
  f.context.serverSyncClient.nothingscoreRequest=async()=>{metadataOkay=true;};
  await f.context.savePublicProfileAndReturnToFeed({displayName:'Synthetic Person',handle:'synthetic',editor:{upload:async()=>{assert(metadataOkay);throw Error('photo unavailable');}},current:()=>true});
  assert.deepEqual(f.state.routes,['feed']);assert.match(f.state.toasts.at(-1),/Profile saved.*photo could not/);
  assert(vm.runInContext('pendingProfilePhoto !== null',f.context));
  f=fixture();await f.context.savePublicProfileAndReturnToFeed({displayName:'Synthetic Person',handle:'synthetic',editor:{upload:async()=>{}},current:()=>true,viewCurrent:()=>false});
  assert.deepEqual(f.state.routes,[]);assert.match(f.state.toasts.at(-1),/Profile saved/);
  f=fixture();f.context.serverSyncClient.nothingscoreRequest=async()=>{f.state.life.generation++;};const life=f.state.life.generation;
  await f.context.savePublicProfileAndReturnToFeed({displayName:'Synthetic Person',handle:'synthetic',editor:{upload:async()=>assert.fail('stale profile must not upload')},current:()=>f.state.life.generation===life});
  assert.deepEqual(f.state.routes,[]);
  report.push('profile metadata failure stays recoverable; partial photo failure returns Feed; account switch stops continuation');
  for(const navigate of [false,true]){
    f=fixture();f.context.settingsSection='account';f.context.activeTab='feed';
    f.context.nothingscoreViewer={profile:null};f.context.buildPublicProfileAvatarEditor=()=>({element:new Element(),upload:async()=>null});
    vm.runInContext(section(html,'function renderChatPublicProfileForm(host,','function renderChatAdminControls('),f.context,{timeout:1000});
    f.context.renderChatPublicProfileForm(f.body);
    const profileForm=f.body.querySelector('form'),fields=profileForm.querySelectorAll('input');fields[0].value='Synthetic Person';fields[1].value='synthetic';
    profileForm.closestResult={classList:{contains:()=>true}};
    let release;f.context.serverSyncClient.nothingscoreRequest=async(_query,command)=>{f.state.writes.push(command);if(navigate)await new Promise(resolve=>{release=resolve;});};
    const saving=profileForm.listeners.submit({preventDefault(){}});
    if(navigate){f.context.activeTab='follow';release();}
    await saving;
    assert.equal(f.state.writes.length,1,'actual Chat Profile submit must reach metadata request');
    assert.deepEqual(f.state.routes,navigate?[]:['feed']);
    assert(!/viewCurrent|not defined/.test(profileForm.textContent));
  }
  report.push('actual Chat Profile form submission reaches Save and returns Feed; same-owner navigation blocks its late redirect');
  assert.match(html,/const ONBOARDING_SECTIONS = \["startup", "teams"\]/);
  await backendControls();
  await callbackControls();
  await guestTransitionControls();
  console.log(JSON.stringify({status:'PASS',scope:'actual source functions with RAM mocks; no browser, server, device or provider proof',cases:report},null,2));
}
run().catch(error=>{console.error(error.stack);process.exitCode=1;});
