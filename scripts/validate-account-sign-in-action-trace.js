'use strict';
// Actual diagnostic installer in an owned DOM double; no app/browser/SDK runs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const install=require('./lib/account-sign-in-action-trace');
const harness=fs.readFileSync(path.join(__dirname,'validate-account-sync-recovery-browser.js'),'utf8');
new vm.Script(harness); // Parse the real integration without importing Playwright.
function fixture(){
  const nodes=new Map(),listeners=[],observers=[],secret='SECRET_PASSWORD_OR_ACCOUNT_VALUE';let tick=0,hitOverride=null;
  function node(tag,id,parent=null,box={x:0,y:0,width:10,height:10}){
    const n={nodeType:1,tagName:tag,id,parentElement:parent,isConnected:true,disabled:false,box,
      getBoundingClientRect(){return {...this.box};},
      contains(other){for(let p=other;p;p=p.parentElement)if(p===this)return true;return false;},
      closest(selector){for(let p=this;p;p=p.parentElement)if(selector==='#'+p.id)return p;return null;},
    };
    for(const field of ['value','textContent','innerHTML'])Object.defineProperty(n,field,{get(){throw Error('Diagnostic read forbidden '+field+secret);}});
    if(id)nodes.set(id,n);return n;
  }
  const body=node('DIV','settingsBody'),form=node('FORM','accountSignInForm',body,{x:0,y:0,width:300,height:400});
  let button=node('BUTTON','',form,{x:10,y:100,width:120,height:44});
  const email=node('INPUT','accountEmail',form),password=node('INPUT','accountPassword',form);
  const help=node('P','accountSyncHelp',body,{x:0,y:0,width:300,height:20});node('SPAN','accountSyncDetail',body);
  form.querySelector=selector=>{assert.equal(selector,'button[type="submit"]');return button;};
  const doc={activeElement:password,getElementById:id=>nodes.get(id)||null,
    addEventListener(type,handler,capture){listeners.push({type,handler,capture});},
    removeEventListener(type,handler,capture){const i=listeners.findIndex(x=>x.type===type&&x.handler===handler&&x.capture===capture);assert(i>=0);listeners.splice(i,1);},
    elementFromPoint(x,y){const b=button.box;return hitOverride||(x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height?button:form);},
  };
  class Observer{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const context={document:doc,MutationObserver:Observer,ResizeObserver:Observer,TextEncoder,
    performance:{now:()=>++tick,timeOrigin:1793538499305},innerWidth:390,innerHeight:844,scrollX:0,scrollY:0,
    visualViewport:{height:844,offsetTop:0},accountIndicatorController:null,
    serverSyncClient:{signIn(){throw Error('No SDK calls');},accountSnapshot(){throw Error('No account state reads');}},
  };
  vm.createContext(context);vm.runInContext('('+install.toString()+')()',context);
  const emit=(type,target=button,capture=true,extra={})=>{
    const e={type,target,isTrusted:true,defaultPrevented:false,clientX:20,clientY:110,pointerType:'mouse',
      preventDefault(){throw Error('No event mutation');},stopPropagation(){throw Error('No event mutation');},...extra};
    for(const x of [...listeners])if(x.type===type&&x.capture===capture)x.handler(e);
  };
  return {context,body,form,email,password,help,doc,listeners,observers,emit,node,secret,
    api:context.qaSignInActionTrace,get button(){return button;},
    replaceButton(){button.isConnected=false;button=node('BUTTON','',form,{...button.box});return button;},
    setHit(n){hitOverride=n;},snapshot:()=>JSON.parse(JSON.stringify(context.qaSignInActionTrace.snapshot()))};
}
const passed=[];
function test(name,body){body();passed.push(name);}
test('actual-existing-label-formatter-does-not-collapse-button-or-child-to-form',()=>{
  const start=harness.indexOf("      for(const type of ['input','change','invalid','click','submit'])document.addEventListener");
  const end=harness.indexOf('      const render=renderAccountSettings;',start);assert(start>=0&&end>start);
  const handlers={},labels=[],form={id:'accountSignInForm',tagName:'FORM'};
  vm.runInNewContext(harness.slice(start,end),{document:{addEventListener:(type,handler)=>{handlers[type]=handler;}},snapshot:value=>labels.push(value)});
  for(const target of [{id:'',tagName:'BUTTON'},{id:'',tagName:'SPAN'},form])handlers.click({target:{...target,closest:()=>form}});
  assert.deepEqual(labels,['click:BUTTON','click:SPAN','click:accountSignInForm']);
});
test('capture-bubble-and-nested-submit-target-remain-distinct',()=>{
  const f=fixture(),span=f.node('SPAN','',f.button);f.setHit(span);f.emit('pointerdown',span);f.emit('click',span);
  f.emit('submit',f.form,true);f.emit('submit',f.form,false,{defaultPrevented:true});
  const events=f.snapshot().events,click=events.find(x=>x.kind==='click');
  assert.equal(click.target.tag,'SPAN');assert.equal(click.target.id,null);assert.equal(click.targetInsideSubmit,true);assert.equal(click.point.hit.tag,'SPAN');assert.equal(click.point.insideSubmit,true);
  const submit=events.filter(x=>x.kind==='submit');assert.deepEqual(submit.map(x=>[x.phase,x.defaultPrevented]),[['capture',false],['bubble',true]]);
});
test('synthetic-helper-layout-shift-and-missed-submit-are-visible-without-causal-claim',()=>{
  const f=fixture();f.emit('pointerdown');const before=f.snapshot().events.at(-1);
  f.context.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP={mount(){throw Error('No helper action');}};f.context.accountIndicatorController={};
  f.button.box.y=240;f.help.box.height=160;
  f.observers[1].callback([{target:f.help}]);f.emit('pointerup',f.form);f.emit('click',f.form);
  const events=f.snapshot().events,mutation=events.find(x=>x.kind==='mutation'),click=events.at(-1);
  assert.deepEqual(mutation.changes,['sync-help']);assert.equal(mutation.helperExportPresent,true);assert.equal(mutation.helperMounted,true);
  assert.equal(mutation.submit.identity,before.submit.identity);assert.equal(mutation.submitRect.y,240);assert.equal(click.target.tag,'FORM');assert.equal(click.point.insideSubmit,false);assert.equal(click.point.hit.id,'accountSignInForm');assert(!events.some(x=>x.kind==='submit'));
  assert.equal(f.snapshot().timingMayBePerturbed,true);
});
test('button-replacement-and-disconnection-have-separate-identities',()=>{
  const f=fixture();f.emit('pointerdown');const old=f.button,before=f.snapshot().events.at(-1);f.replaceButton();f.emit('click',old);
  const after=f.snapshot().events.at(-1);assert.notEqual(after.submit.identity,before.submit.identity);assert.equal(after.target.identity,before.submit.identity);assert.equal(after.target.connected,false);assert.equal(after.targetInsideSubmit,false);
});
test('no-values-text-html-account-read-or-ui-action-and-unknown-ids-redacted',()=>{
  const f=fixture(),unknown=f.node('SPAN',f.secret,f.button);f.setHit(unknown);f.api.mark(f.secret);f.emit('click',unknown);
  const snapshot=f.snapshot(),json=JSON.stringify(snapshot);assert(!json.includes(f.secret));assert.equal(snapshot.events.at(-1).target.id,null);assert.equal(snapshot.timeOrigin,1793538499305);
  assert.equal(f.doc.activeElement,f.password);assert.equal(f.button.disabled,false);assert.equal(f.button.box.y,100);
});
test('event-and-byte-caps-snapshot-isolation-and-stop-detach',()=>{
  const f=fixture();for(let i=0;i<250;i++)f.emit('pointerdown');const s=f.snapshot();assert(s.overflow&&s.dropped>0);assert(s.events.length<=96);assert(s.eventBytes<=98304);assert(Buffer.byteLength(JSON.stringify(s))<100000);
  const copy=f.api.snapshot();copy.events[0].kind='changed';assert.notEqual(f.snapshot().events[0].kind,'changed');
  f.api.stop();const count=f.snapshot().events.length;assert.equal(f.listeners.length,0);assert(f.observers.every(x=>x.disconnected));f.emit('click');f.api.mark('before-native-click');assert.equal(f.snapshot().events.length,count);
});
console.log(JSON.stringify({status:'PASS_DIAGNOSTIC_OBSERVER_ONLY',cases:passed.length,passed,
  scope:'Actual passive installer and actual existing target formatter in owned DOM doubles; syntax-only browser harness parse. No browser/SDK/app auth/network run or root-cause proof.'}));
