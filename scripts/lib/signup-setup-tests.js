// Portable changed signup/setup regressions, owned by validate-server-persistence.
// Only Node built-ins and repository-relative source reads; no ambient environment,
// provider credentials, product hooks, generated output or network access.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),clone=x=>JSON.parse(JSON.stringify(x));
const read=p=>fs.readFileSync(p,'utf8'),source=rel=>read(path.join(root,rel));
function slice(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start);assert(start>=0&&end>start,a);return s.slice(start,end);}
function moduleVM(text,extra={}){const c={module:{exports:{}},structuredClone,URL,URLSearchParams,Buffer,AbortController,setTimeout,clearTimeout,performance,fetch:()=>{throw Error('Unexpected offline network request');},...extra};vm.runInNewContext(text,c,{timeout:1000});return c.module.exports;}
const follow=moduleVM(source('config/follow-first.js'));
const sync=moduleVM(source('config/user-state-sync.js'),{NOTHINGSPORTS_FOLLOW_FIRST:follow});
const profile=moduleVM(source('config/profile-storage.js'));
const transport=moduleVM(source('config/server-sync.js'));
function memory(){const values=new Map();return{fail:false,getItem:k=>values.get(k)||null,setItem(k,v){if(this.fail)throw Error('synthetic storage refusal');values.set(k,String(v));},removeItem:k=>values.delete(k),snapshot:()=>Object.fromEntries(values)};}
function response(){return{statusCode:null,body:null,setHeader(){},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};}
// Synthetic upstream shapes are embedded so normal repository validation is portable.
const shapes=[
  {
    "id": "direct-pending-user",
    "status": 200,
    "payload": {
      "id": "00000000-0000-4000-8000-000000000001",
      "email": "synthetic@example.invalid",
      "created_at": "2000-01-01T00:00:00Z",
      "email_confirmed_at": null,
      "confirmation_sent_at": "2000-01-01T00:00:00Z",
      "is_anonymous": false,
      "identities": [
        {
          "provider": "email"
        }
      ]
    }
  },
  {
    "id": "obfuscated-existing-user",
    "status": 200,
    "payload": {
      "id": "00000000-0000-4000-8000-000000000003",
      "email": "synthetic@example.invalid",
      "created_at": "2000-01-01T00:00:00Z",
      "updated_at": "2000-01-01T00:00:00Z",
      "confirmation_sent_at": "2000-01-01T00:00:00Z",
      "email_confirmed_at": null,
      "confirmed_at": null,
      "last_sign_in_at": null,
      "phone_confirmed_at": null,
      "role": "",
      "identities": [],
      "user_metadata": {},
      "app_metadata": {
        "provider": "email",
        "providers": [
          "email"
        ]
      }
    }
  },
  {
    "id": "embedded-no-session",
    "status": 200,
    "payload": {
      "user": {
        "id": "00000000-0000-4000-8000-000000000001",
        "email": "synthetic@example.invalid",
        "created_at": "2000-01-01T00:00:00Z",
        "email_confirmed_at": null,
        "confirmation_sent_at": "2000-01-01T00:00:00Z",
        "is_anonymous": false,
        "identities": [
          {
            "provider": "email"
          }
        ]
      }
    }
  },
  {
    "id": "embedded-user-immediate-session",
    "status": 200,
    "payload": {
      "access_token": "offline-synthetic-access",
      "refresh_token": "offline-synthetic-refresh",
      "token_type": "bearer",
      "expires_in": 3600,
      "user": {
        "id": "00000000-0000-4000-8000-000000000001",
        "email": "synthetic@example.invalid",
        "created_at": "2000-01-01T00:00:00Z",
        "email_confirmed_at": "2000-01-01T00:00:00Z",
        "confirmation_sent_at": "2000-01-01T00:00:00Z",
        "is_anonymous": false,
        "identities": [
          {
            "provider": "email"
          }
        ]
      }
    }
  },
  {
    "id": "confirmation-send-error",
    "status": 500,
    "payload": {
      "code": "synthetic_confirmation_send_error",
      "message": "Offline synthetic confirmation-send failure"
    }
  }
];
async function apiCase(test,seedFailure=false){
 const calls={signup:0,metadata:0,consent:[]};
 const fetch=async(target,opts)=>{const p=new URL(target).pathname;
  if(p==='/auth/v1/signup'){calls.signup++;assert.equal(opts.method,'POST');return{ok:test.status<300,status:test.status,text:async()=>JSON.stringify(test.payload)};}
  if(p==='/rest/v1/nothingsports_user_meta'){calls.metadata++;calls.consent.push(JSON.parse(opts.body).personalised_offers_consent);if(seedFailure)throw Error('synthetic seed unavailable');return{ok:true,status:201,text:async()=>''};}
  throw Error('Unallocated offline target');};
 const server=moduleVM(source('lib/supabase-server.js'),{process:{env:{SUPABASE_URL:'https://synthetic.invalid',SUPABASE_PUBLISHABLE_KEY:'offline-publishable',SUPABASE_SECRET_KEY:'sb_secret_offline'}},fetch,require:id=>{assert.equal(id,'../config/event-action-identity');return{};}});
 const deps={'../lib/supabase-server':server,'../config/follow-first':follow,'../config/chat-contract':{},'../lib/chat-capability':{ChatCapabilityError:class extends Error{}}};
 const handler=moduleVM(source('api/auth.js'),{process:{env:{}},require:id=>{assert(Object.hasOwn(deps,id),id);return deps[id];}}),res=response();
 await handler({method:'POST',headers:{host:'nothingsport.app'},body:{action:'sign-up',email:'synthetic@example.invalid',password:'offline-only-value',meta:{sports:['football'],personalisedOffersConsent:true}}},res);
 assert.equal(calls.signup,1);assert(calls.consent.every(v=>v===false));return{res,calls};
}
class Node{
 constructor(){this.listeners={};this.children=[];this.style={};this.textContent='';this.value='';this.isConnected=true;this.classList={v:new Set(),add(...v){v.forEach(x=>this.v.add(x));},remove(...v){v.forEach(x=>this.v.delete(x));},contains(v){return this.v.has(v);}};}
 addEventListener(type,fn){this.listeners[type]=fn;} append(...children){this.children.push(...children);} appendChild(child){this.append(child);} setAttribute(){} focus(){} closest(){return null;}
 querySelectorAll(tag){return this.children.flatMap(child=>child instanceof Node?[...(child.tagName===tag?[child]:[]),...child.querySelectorAll(tag)]:[]);}
}
function setup(storage=memory()){
 const html=source('index.html'),ui=source('config/fantasy-deadline-ui.js'),nodes={},toasts=[],effects={notifications:0,meta:0,signup:0,retry:0,seed:0};
 for(const id of ['settingsModal','settingsBody','closeSettingsBtn'])nodes[id]=new Node();
 const body=nodes.settingsBody;Object.defineProperty(body,'innerHTML',{set(markup){
  for(const [id,node] of Object.entries(nodes))if(id.startsWith('startup')||id==='personalisedOffersConsent'||id==='findStartupLocationBtn'||id==='useCurrentLocationBtn'){node.isConnected=false;delete nodes[id];}
  for(const match of markup.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Node();if(/style="display:none"/.test(match[0]))n.style.display='none';nodes[match[1]]=n;}
 }});
 body.querySelector=selector=>nodes[selector.slice(1)]||null;
 const document={body:new Node(),activeElement:null,getElementById:id=>nodes[id]||null,createElement:tag=>Object.assign(new Node(),{tagName:tag}),createTextNode:x=>x};
 let life={accountId:'',generation:0,hasSession:false};
 const client=transport.createClient({storage:memory(),persistentStorage:memory(),fetchImpl:async(url,opts)=>{assert.equal(url,'/api/auth');assert.equal(JSON.parse(opts.body).action,'sign-up');effects.signup++;return{ok:true,status:200,json:async()=>({user:null,session:null,confirmationRequired:true,metadataDeferred:false})};}});
 const initial=follow.migratePreferences({fantasyDeadlines:{enabled:false},followFirst:{startupMeta:{sports:['afl']}}});
 const c={document,structuredClone,clonePreferences:clone,USER_STATE_SYNC:sync,FOLLOW_FIRST:follow,SERVER_SYNC:transport,PROFILE_STORAGE:profile,localStorage:storage,activeProfileBundle:profile.loadActiveProfile(storage),profileStorageBootstrapError:null,
 userPreferences:initial,draftPreferences:null,settingsDraftBaseline:null,settingsViewportAnchor:null,settingsFirstRun:false,settingsSection:'main',settingsWizardStep:0,settingsNavigationStack:[],settingsReturnFocus:null,legalDocumentRenderToken:0,
 ONBOARDING_SECTIONS:['startup','teams'],onboardingAccountScope:null,BROADCASTER_LIBRARY:{},PREFERENCE_SYSTEM:null,STORAGE_KEYS:{selectorReleaseAcknowledgement:'synthetic-selector-ack'},SELECTOR_TAXONOMY:{version:'synthetic-taxonomy'},NOTHINGSPORTS_FANTASY_DEADLINES:{onboardingChoice:enabled=>({enabled})},
 serverPersistence:{user:null},console:{warn(){}},setTimeout(){},openSelectorOptInPrompt(){},settingsBackgroundInert(){},captureViewportRenderAnchor:()=>({}),restoreViewportAnchorAfterLayout(){},applyThemePreference(){},renderSettingsScreen(){},renderAll(){},wizardProgressMarkup:()=>'',syncDraftPreferenceGraph(){},syncDraftSelectorSports(){},mergePreferences:clone,
 saveActiveProfileSections:null,notifyDurableStorageFailure(){},retryDurableProfileWrite(){effects.retry++;},queueServerStateSync(){},backfillWebPushReminders:async()=>{},syncNotificationInstallationPreferences:async()=>{effects.notifications++;},recordSavedPreferenceChanges(){},writeStorage:(k,v)=>{try{storage.setItem(k,JSON.stringify(v));return true;}catch(_error){return false;}},showToast:v=>toasts.push(v),selectedPreferenceDomainIds:()=>['afl'],activateTopLevelTab:tab=>effects.route=tab,
 serverSyncClient:{...client,accountSnapshot:()=>({...life}),saveMeta:async()=>{effects.meta++;throw Error('Unexpected signed-out metadata call');}},bootstrapServerPersistence:async()=>{throw Error('No-session must not bootstrap');},
 };
 vm.createContext(c);
 const pieces=[slice(html,'function openSettings(','\nfunction closeSettings('),slice(html,'function closeSettings(','\nfunction openFirstRunSettingsAfterFeedAlignment('),slice(html,'function saveActiveProfileSections(','\nlet activeFilter'),slice(html,'function savePreferences(','\nfunction applyThemePreference('),slice(html,'function startupMetaDraft(','\nasync function resolveSetupLocation('),slice(html,'function persistOnboardingDraft(){','\nfunction tuningInteractionDelta('),slice(html,'function saveSettingsPreferences(','\ndocument.getElementById(\'accountIndicatorFallback\')'),slice(ui,'function renderStartupMetadataSettings(','\nglobalThis.notificationDiagnosticsCommand')];
 vm.runInContext(pieces.join('\n'),c,{timeout:1000});
 c.openSettings({firstRun:true});c.renderStartupMetadataSettings(body);
 return{c,nodes,storage,toasts,effects,life,replaceLife:v=>{life=v;},async save(){return c.saveSettingsPreferences();}};
}
function hydrationSource(){const html=source('index.html');return slice(html,'function serverStateSyncScope(','\nasync function reconcileCurrentServerState(')+'\n'+slice(html,'async function hydrateUserMetaSeed(','\nfunction preferenceIntentOwner(');}
async function hydration(preferences,mode){
 const calls={read:0,write:0,applied:0};let subject='A';
 const remote=follow.normalizeMeta({sports:['afl'],source:'admin'});
 const c={userPreferences:clone(preferences),FOLLOW_FIRST:follow,accountTransitionBlocksSync:()=>false,localPreferenceRecoveryBusy:false,localPreferenceRecoveryBlocked:()=>false,serverStateSyncGeneration:4,serverPersistence:{state:'signedIn',user:{id:'A'}},serverSyncClient:{sessionSubject:()=>subject,loadMeta:async({accountId})=>{calls.read++;assert.equal(accountId,'A');if(mode==='switch-after-read')subject='B';return{meta:mode==='existing'?remote:null};},saveMeta:async(meta,{accountId})=>{calls.write++;assert.equal(accountId,'A');assert.equal(subject,'A');assert.deepEqual(clone(meta.sports),['football']);if(mode==='switch-after-create')subject='B';return{meta};}},savePreferences:v=>{calls.applied++;c.userPreferences=clone(v);}};
 vm.createContext(c);vm.runInContext(hydrationSource(),c,{timeout:1000});await c.hydrateUserMetaSeed();return{calls,preferences:c.userPreferences};
}
module.exports=async function validateSignupSetup(){
 const rows=[];
 const noSessions=[];
 for(const test of shapes){const {res,calls}=await apiCase(test);
  if(test.id==='embedded-user-immediate-session'){assert.equal(res.statusCode,200);assert(res.body.user&&res.body.session);assert.equal(res.body.confirmationRequired,false);assert.equal(calls.metadata,1);}
  else if(test.id==='confirmation-send-error'){assert.equal(res.statusCode,500);assert.equal(res.body.code,'synthetic_confirmation_send_error');assert.equal(res.body.error,'Server sync is temporarily unavailable.');assert.equal(calls.metadata,0);}
  else{assert.equal(res.statusCode,200);assert.deepEqual(clone(res.body),{user:null,session:null,confirmationRequired:true,metadataDeferred:false});assert.equal(calls.metadata,0);noSessions.push(clone(res.body));}
  rows.push({id:'api-'+test.id,metadataWrites:calls.metadata,pass:true});}
 assert(noSessions.every(v=>JSON.stringify(v)===JSON.stringify(noSessions[0])));
 const deferred=await apiCase(shapes[3],true);assert.equal(deferred.res.statusCode,200);assert.equal(deferred.res.body.metadataDeferred,true);assert(deferred.res.body.user&&deferred.res.body.session);rows.push({id:'api-valid-session-seed-failure-defers',pass:true});
 const ok=setup();ok.c.applyStartupMetaDraft({sports:['football']});assert.equal(await ok.save(),true);assert.equal(ok.effects.signup,0);assert.equal(ok.effects.meta,0);assert.equal(ok.effects.route,'feed');assert(ok.toasts.includes('Feed setup saved.'));
 const stored=profile.loadActiveProfile(ok.storage);assert.deepEqual(clone(stored.preferences.followFirst.startupMeta.sports),['football']);assert.equal(stored.preferences.onboardingComplete,true);assert(!JSON.stringify(ok.storage.snapshot()).includes('synthetic@example.invalid'));assert(!JSON.stringify(ok.storage.snapshot()).includes('offline-only-password'));ok.c.userPreferences=clone(stored.preferences);ok.c.openSettings({firstRun:true});assert.deepEqual(clone(ok.c.startupMetaDraft().sports),['football']);rows.push({id:'guest-completion-real-storage-feed-close-reopen',pass:true,unauthenticatedMetadataWrites:0});
 const failed=setup();failed.c.applyStartupMetaDraft({sports:['football']});failed.storage.fail=true;assert.equal(await failed.save(),false);assert.equal(failed.c.settingsSection,'startup');assert(failed.c.draftPreferences);assert.deepEqual(clone(failed.c.startupMetaDraft().sports),['football']);assert(!failed.toasts.includes('Feed setup saved.'));assert.equal(failed.effects.notifications,0);assert.equal(failed.effects.meta,0);assert.equal(failed.effects.retry,1,'Existing lower owner retains its retry; no new retry added');rows.push({id:'storage-refusal-retains-form-draft-no-success',pass:true});
 const thrown=setup();const realSave=thrown.c.savePreferences;let saveCalls=0;thrown.c.savePreferences=(...args)=>{if(++saveCalls===2)throw Error('synthetic uncertain completion');return realSave(...args);};assert.equal(await thrown.save(),false);assert(thrown.c.draftPreferences);assert.equal(thrown.c.settingsSection,'startup');assert(!thrown.toasts.includes('Feed setup saved.'));rows.push({id:'final-storage-exception-retains-form',pass:true});
 for(const change of ['account','same-owner-new-generation']){const t=setup();t.c.applyStartupMetaDraft({sports:['football']});if(change==='account'){t.replaceLife({accountId:'B',generation:1,hasSession:true});t.c.serverPersistence.user={id:'B'};}else t.replaceLife({accountId:'',generation:2,hasSession:false});assert.equal(await t.save(),false);assert.equal(t.c.settingsSection,'startup');assert.deepEqual(clone(t.c.userPreferences.followFirst.startupMeta.sports),['afl']);assert.equal(t.effects.meta,0);assert.equal(t.effects.notifications,0);rows.push({id:'completion-owner-fence-'+change,pass:true});}
 const sportsOnly=setup();assert.equal(sportsOnly.nodes.startupAccountEmail,undefined);assert.equal(sportsOnly.nodes.startupCreateAccountBtn,undefined);assert.equal(sportsOnly.effects.signup,0);assert.equal(sportsOnly.effects.notifications,0);rows.push({id:'sports-selection-without-identity-or-notification-prompt',pass:true});
 const next=setup();next.c.applyStartupMetaDraft({sports:['football']});next.c.advanceOnboardingOrSave();assert.equal(next.c.settingsSection,'teams');assert.equal(next.c.settingsWizardStep,1);assert.deepEqual(clone(profile.loadActiveProfile(next.storage).preferences.followFirst.startupMeta.sports),['football']);assert.equal(next.effects.signup,0);rows.push({id:'sport-to-team-continuation-persists-locally',pass:true});
 for(const mode of ['missing','existing','switch-after-read','switch-after-create']){const h=await hydration(stored.preferences,mode);if(mode==='missing'){assert.equal(h.calls.write,1);assert.deepEqual(clone(h.preferences.followFirst.startupMeta.sports),['football']);}if(mode==='existing'){assert.equal(h.calls.write,0);assert.deepEqual(clone(h.preferences.followFirst.startupMeta.sports),['afl']);}if(mode.startsWith('switch')){assert.equal(h.calls.applied,0);assert.equal(h.calls.write,mode==='switch-after-create'?1:0);}rows.push({id:'existing-authenticated-meta-owner-'+mode,pass:true});}
 assert.equal(rows.length,17,'All selected changed-boundary cases must remain covered');
 console.log(JSON.stringify({signupSetup:'passed',cases:rows.length,scope:'Actual Auth helper/handler, SDK, Settings/profile storage and metadata owner in isolated VM/RAM fixtures; no network or account connection.'}));
 return rows;
};
