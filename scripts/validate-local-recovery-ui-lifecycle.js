'use strict';
// Actual deferred recovery component with a disposable DOM/lifetime double. No browser or I/O.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ui=require('../config/preference-reset-ui');
class Element{
 constructor(){this.nodes=new Map();this.isConnected=true;this.hidden=false;this.disabled=false;this.handlers={};this.textContent='';}
 set innerHTML(value){this.html=value;this.nodes.clear();}
 querySelector(selector){
  if(!this.nodes.has(selector)){const node=new Element();if(selector.includes('warning'))node.hidden=true;this.nodes.set(selector,node);}
  return this.nodes.get(selector);
 }
 addEventListener(type,handler){this.handlers[type]=handler;}
 appendChild(element){element.isConnected=true;this.child=element;}
 focus(){}
}
function fixture(){
 const body=new Element();const modal={};let life={accountId:'synthetic-A',profileId:'profile:synthetic',sessionGeneration:1,modal};let current=true,actions=0,applied=0,syncGeneration=0,mounted;
 const api={signedIn:()=>true,recovery:()=>null,setRecovery:x=>x,captureScope:()=>{const generation=syncGeneration;return {current:()=>current&&generation===syncGeneration};},
  captureLocalRecoveryScope(){const captured={...life};return {...captured,current:()=>current&&Object.entries(captured).every(([key,value])=>life[key]===value)};},
  useSavedAccountPreferences:async scope=>{actions++;api.lastOperationScope=scope;},afterLocalRecovery(){applied++;},};
 function mount(){if(mounted)mounted.isConnected=false;mounted=ui.mount(body,api);return mounted;}
 return {body,api,mount,get actions(){return actions;},get applied(){return applied;},bumpSync:()=>{syncGeneration++;},change:patch=>{life={...life,...patch};},end:()=>{current=false;}};
}
async function run(){
 const previous=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{
  let cases=0;
  const click=(section,selector)=>section.querySelector(selector).handlers.click({currentTarget:section.querySelector(selector)});
  const f=fixture(),first=f.mount();await click(first,'[data-local-recovery-open]');
  assert.equal(first.querySelector('[data-local-recovery-warning]').hidden,false);
  const rerendered=f.mount();
  assert.equal(rerendered.querySelector('[data-local-recovery-warning]').hidden,false,'same-context actual mount must preserve the expanded explanation across legitimate rerender');cases++;
  await click(first,'[data-local-recovery-confirm]');assert.equal(f.actions,0,'detached old section cannot confirm');cases++;
  await click(rerendered,'[data-local-recovery-confirm]');assert.equal(f.actions,1);assert.equal(f.applied,1);assert(rerendered.querySelector('[data-local-recovery-status]').textContent.includes('loaded'));cases++;
  const status=f.mount();assert(status.querySelector('[data-local-recovery-status]').textContent.includes('loaded'));cases++;
  const notOpened=fixture(),hidden=notOpened.mount();await click(hidden,'[data-local-recovery-confirm]');assert.equal(notOpened.actions,0,'fresh explicit explanation required');cases++;
  const busy=fixture();let release;busy.api.useSavedAccountPreferences=async scope=>{busy.api.lastOperationScope=scope;busy.bumpSync();await new Promise(resolve=>{release=resolve;});};
  const original=busy.mount();await click(original,'[data-local-recovery-open]');const pending=click(original,'[data-local-recovery-confirm]');
  const fresh=busy.mount();assert.equal(fresh.querySelector('[data-local-recovery-warning]').hidden,false);assert.equal(fresh.querySelector('[data-local-recovery-confirm]').disabled,true);assert(fresh.querySelector('[data-local-recovery-status]').textContent.includes('Loading'));cases++;
  await click(fresh,'[data-local-recovery-confirm]');assert.equal(busy.api.lastOperationScope.current(),true);release();await pending;
  assert.equal(fresh.querySelector('[data-local-recovery-confirm]').disabled,false);assert(fresh.querySelector('[data-local-recovery-status]').textContent.includes('loaded'));assert.equal(busy.applied,1);cases++;
  for(const patch of [{accountId:'synthetic-B'},{profileId:'profile:other'},{sessionGeneration:2},{modal:{}}]){
   const x=fixture();let finish;
   x.api.useSavedAccountPreferences=async scope=>{x.api.lastOperationScope=scope;await new Promise(resolve=>{finish=resolve;});};
   const old=x.mount();await click(old,'[data-local-recovery-open]');const running=click(old,'[data-local-recovery-confirm]');x.change(patch);const replacement=x.mount();
   assert.equal(replacement.querySelector('[data-local-recovery-warning]').hidden,true);assert.equal(replacement.querySelector('[data-local-recovery-confirm]').disabled,false);assert.equal(x.api.lastOperationScope.current(),false);
   finish();await running;assert.equal(x.applied,0);assert.equal(replacement.querySelector('[data-local-recovery-status]').textContent,'');cases++;
  }
  const navigation=fixture();let finishNavigation;
  navigation.api.useSavedAccountPreferences=async scope=>{navigation.api.lastOperationScope=scope;await new Promise(resolve=>{finishNavigation=resolve;});};
  const nav=navigation.mount();await click(nav,'[data-local-recovery-open]');const navRunning=click(nav,'[data-local-recovery-confirm]');ui.clearLocalRecovery(navigation.body);const returned=navigation.mount();assert.equal(navigation.api.lastOperationScope.current(),false);
  finishNavigation();await navRunning;assert.equal(returned.querySelector('[data-local-recovery-warning]').hidden,true);assert.equal(navigation.applied,0);cases++;
  for(const code of ['local_recovery_refused','local_recovery_storage_uncertain']){
   const failed=fixture();failed.api.useSavedAccountPreferences=async()=>{throw Object.assign(Error('synthetic'),{code});};const section=failed.mount();await click(section,'[data-local-recovery-open]');await click(section,'[data-local-recovery-confirm]');
   const again=failed.mount();assert.equal(again.querySelector('[data-local-recovery-confirm]').disabled,false);assert(again.querySelector('[data-local-recovery-status]').textContent.includes(code.endsWith('uncertain')?'Keep this app open':'could not be completed'));cases++;
  }
  const stale=fixture(),staleSection=stale.mount();await click(staleSection,'[data-local-recovery-open]');stale.end();await click(staleSection,'[data-local-recovery-confirm]');assert.equal(stale.actions,0);cases++;
  const html=fs.readFileSync(__dirname+'/../index.html','utf8'),start=html.indexOf('function captureLocalRecoveryUiScope(){'),end=html.indexOf('let preferenceResetUiLoad',start);
  assert(start>=0&&end>start);let life={hasSession:true,accountId:'A',generation:3},visible=true;
  const c={serverSyncClient:{accountSnapshot:()=>life},activeProfileBundle:{profile:{id:'profile:A'}},serverPersistence:{user:{id:'A'}},settingsViewportAnchor:{},settingsSection:'account',document:{getElementById:()=>({classList:{contains:()=>visible}})}};
  vm.createContext(c);vm.runInContext(html.slice(start,end),c);const scope=c.captureLocalRecoveryUiScope();assert.equal(scope.current(),true);cases++;
  life={...life,generation:4};assert.equal(scope.current(),false);life={...life,generation:3};c.activeProfileBundle.profile.id='profile:B';assert.equal(scope.current(),false);c.activeProfileBundle.profile.id='profile:A';cases++;
  visible=false;assert.equal(scope.current(),false);visible=true;c.settingsSection='main';assert.equal(scope.current(),false);c.settingsSection='account';c.settingsViewportAnchor={};assert.equal(scope.current(),false);cases++;
  assert(html.includes('captureLocalRecoveryScope:captureLocalRecoveryUiScope'));assert(html.includes('if(settingsSection!=="account")globalThis.NOTHINGSPORTS_PREFERENCE_RESET_UI?.clearLocalRecovery?.(body)'));cases++;
  const reset=fixture();let resetCalls=0,undoCalls=0,applied=0;
  reset.api.captureScope=()=>({current:()=>true,accountId:'synthetic-A',verify:result=>result.user.id==='synthetic-A'});
  reset.api.defaults=()=>({theme:'system'});reset.api.serverSync={resetPreferences:async()=>{resetCalls++;return {user:{id:'synthetic-A'},state:{preferences:{theme:'system'}}};},undoPreferencesReset:async()=>{undoCalls++;return {user:{id:'synthetic-A'},state:{preferences:{theme:'night'}}};}};
  reset.api.acceptServerResult=()=>{applied++;};reset.api.afterApply=()=>{};
  const resetView=reset.mount();await click(resetView,'[data-reset-action="open"]');assert.equal(resetView.querySelector('[data-reset-warning="one"]').hidden,false);
  await click(resetView,'[data-reset-action="continue"]');const input=resetView.querySelector('[data-reset-confirm]');input.value='RESET';input.handlers.input();await click(resetView,'[data-reset-action="confirm"]');assert.equal(resetCalls,1);assert.equal(applied,1);cases++;
  reset.api.recovery=()=>({resetId:'synthetic-reset',expiresAt:'2099-01-01T00:00:00Z'});const undoView=reset.mount();await click(undoView,'[data-reset-action="undo"]');assert.equal(undoCalls,1);assert.equal(applied,2);cases++;
  assert(html.includes('loadDeferredScript("config/preference-reset-ui.js?v="+document.querySelector'));cases++;
  console.log(JSON.stringify({kind:'local-recovery-ui-lifecycle',passed:true,cases,customerOperation:false,nativeExecuted:false}));
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={run,fixture,Element};
