(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NothingSportMeasurement=api;
})(globalThis,function(){
 'use strict';
 const PIXEL='1149008224326641',KEY='ns-website-measurement-v1',VERSION=1,ORIGIN='https://nothingsport.com';
 function choiceOf(raw){try{const value=JSON.parse(raw||'null');return value?.version===VERSION&&typeof value.allowed==='boolean'?value.allowed:null;}catch{return null;}}
 function cleanContext(value,initial=true){
  try{const url=new URL(value.url),safeHash=!url.hash||(!initial&&['#whats-on','#how-it-works','#get-the-app'].includes(url.hash));return url.origin===ORIGIN&&url.pathname==='/'&&!url.search&&safeHash&&value.referrer==='';}catch{return false;}
 }
 function createController({storage,context,sdkEnabled=false,createSdk,navigate,onChange=()=>{}}){
  let allowed=false,choice='unset',phase='off',generation=0,sdk=null,started=false,disposed=false;
  const seen=new WeakSet();
  const snapshot=()=>Object.freeze({allowed,choice,phase,active:phase==='active'});
  function notify(){onChange(snapshot());}
  function canonical(){try{return new URL(context().url).origin===ORIGIN;}catch{return false;}}
  function save(value){try{const text=JSON.stringify({version:VERSION,allowed:value});storage.setItem(KEY,text);return storage.getItem(KEY)===text;}catch{return false;}}
  function stop(){generation++;allowed=false;try{sdk?.revoke();}catch{}try{sdk?.dispose();}catch{}sdk=null;}
  function reload(deny=false){generation++;phase='reloading';notify();navigate({deny});}
  function current(token){
   if(disposed||!allowed||token!==generation||!cleanContext(context(),false))return false;
   try{return choiceOf(storage.getItem(KEY))===true;}catch{return false;}
  }
  async function start(){
   if(started||disposed)return snapshot();started=true;
   if(!canonical()){phase='unavailable';notify();return snapshot();}
   try{
    const url=new URL(context().url),value=choiceOf(storage.getItem(KEY));
    if(url.searchParams.get('privacy')==='off'){allowed=false;choice='refused';phase=save(false)?'off':'storage-error';notify();return snapshot();}
    allowed=value===true;choice=value===null?'unset':value?'allowed':'refused';
   }catch{allowed=false;phase='storage-error';notify();return snapshot();}
   if(!allowed){notify();return snapshot();}
   if(!save(true)){allowed=false;phase='storage-error';notify();return snapshot();}
   if(!sdkEnabled){phase='candidate';notify();return snapshot();}
   if(!cleanContext(context())){if(context().attemptedClean){allowed=false;phase='unavailable';notify();}else reload();return snapshot();}
   const token=++generation;phase='loading';notify();
   try{
    sdk=createSdk();await sdk.ready;
    if(!current(token)){if(token===generation){stop();phase='unavailable';notify();}return snapshot();}
    sdk.grant();sdk.pageView();phase='active';
   }catch{if(!disposed&&token===generation){stop();phase='unavailable';}}
   notify();return snapshot();
  }
  async function choose(value){
   if(disposed||typeof value!=='boolean')return snapshot();
   if(value&&!canonical()){allowed=false;phase='unavailable';notify();return snapshot();}
   const loaded=Boolean(sdk);stop();choice=value?'allowed':'refused';const saved=save(value);
   if(!saved){choice='refused';phase='storage-error';notify();reload(true);return snapshot();}
   allowed=value;phase=value&&!sdkEnabled?'candidate':'off';notify();
   if(loaded||(value&&sdkEnabled))reload();return snapshot();
  }
  async function openApp(event){
   if(!event?.isTrusted||event.defaultPrevented||seen.has(event)||!((event.type==='click'&&event.button===0)||(event.type==='auxclick'&&event.button===1)))return false;
   const link=event.target?.closest?.('a[href]');if(!link||link.hasAttribute('download'))return false;
   let url;try{url=new URL(link.href);}catch{return false;}
   if(url.protocol!=='https:'||url.hostname!=='nothingsport.app'||url.port||url.username||url.password)return false;
   seen.add(event);const token=generation;await Promise.resolve();
   if(event.defaultPrevented||phase!=='active')return false;
   if(!current(token)){if(token===generation){stop();phase='unavailable';notify();}return false;}
   try{sdk.openApp();return true;}catch{stop();phase='unavailable';notify();return false;}
  }
  function dispose(){stop();disposed=true;phase='off';notify();}
  function suspend(){stop();phase='off';notify();}
  return Object.freeze({start,choose,openApp,suspend,dispose,snapshot});
 }
 function createBrowserSdk(w){
  if(!cleanContext({url:w.location.href,referrer:w.document.referrer}))throw Error('A clean consented document is required.');
  if(w.fbq||w._fbq)throw Error('Another Meta owner is already present.');
  const q=function(){q.callMethod?q.callMethod.apply(q,arguments):q.queue.push(arguments);};
  q.push=q;q.loaded=true;q.version='2.0';q.queue=[];w.fbq=q;w._fbq=q;
  // Standard public bootstrap/commands only. These do not prove that vendor
  // metadata, automatic events or cookie behaviour satisfies the release gate.
  q('consent','revoke');q('set','autoConfig',false,PIXEL);q('init',PIXEL);
  const script=w.document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';script.referrerPolicy='no-referrer';
  let disposed=false,rejectReady;const ready=new Promise((resolve,reject)=>{rejectReady=reject;script.onload=()=>{if(!disposed)resolve();};script.onerror=()=>reject(Error('Measurement unavailable.'));});
  w.document.head.append(script);
  return {ready,grant(){if(disposed)throw Error('Measurement ended.');q('consent','grant');},pageView:()=>q('trackSingle',PIXEL,'PageView'),openApp:()=>q('trackSingleCustom',PIXEL,'OpenApp'),
   revoke:()=>q('consent','revoke'),dispose(){disposed=true;script.onload=null;script.onerror=null;script.remove();rejectReady(Error('Measurement ended.'));}};
 }
 const mounted=new WeakMap();
 function mount(w,{sdkEnabled=false,createSdk=()=>createBrowserSdk(w),navigate,onState=()=>{}}={}){
  if(mounted.has(w.document))return mounted.get(w.document);
  const doc=w.document,notice=doc.getElementById('measurement-notice'),status=doc.getElementById('measurement-status');
  if(!notice||!status)throw Error('Measurement controls are missing.');
  let storage;try{storage=w.localStorage;}catch{storage={getItem(){throw Error('Storage unavailable.');},setItem(){throw Error('Storage unavailable.');}};}
  const entryURL=new URL(w.location.href),attemptedClean=entryURL.searchParams.get('privacy')==='resume';
  // Remove only our fixed transition marker, before any vendor code exists.
  // Referrer remains a real browser value and must independently be empty.
  if(entryURL.search==='?privacy=resume'&&!entryURL.hash)w.history.replaceState(w.history.state,'','/');
  const reload=navigate||(({deny})=>{
   w.NothingSportWebsiteView?.checkpoint();
   const link=doc.createElement('a');link.href='/privacy/reload'+(deny?'?off=1':'');link.rel='noreferrer';link.referrerPolicy='no-referrer';link.hidden=true;doc.body.append(link);link.click();link.remove();
  });
  const api=createController({storage,context:()=>({url:w.location.href,referrer:doc.referrer,attemptedClean}),sdkEnabled,createSdk,navigate:reload,onChange:s=>{
   if(s.choice==='unset'||['storage-error','unavailable'].includes(s.phase))notice.hidden=false;
   else notice.hidden=true;
   status.textContent=({'storage-error':'Your choice could not be saved. Measurement stays off.','unavailable':'Measurement is unavailable. You can keep using the website.','candidate':'Choice saved. Measurement is not active.','loading':'Starting optional measurement…','reloading':'Reloading to apply your choice…','active':'Optional measurement is on.','off':s.choice==='refused'?'Optional measurement is off.':''})[s.phase]||'';
   doc.querySelector('[data-measurement-choice="refuse"]').textContent=s.allowed?'Turn off':'Decline';
   onState(s);
  }});
  for(const button of doc.querySelectorAll('[data-measurement-choice]'))button.addEventListener('click',()=>{void api.choose(button.dataset.measurementChoice==='allow');});
  doc.querySelector('[data-measurement-manage]')?.addEventListener('click',()=>{notice.hidden=false;doc.querySelector('[data-measurement-choice="allow"]').focus({preventScroll:true});});
  for(const type of ['click','auxclick'])doc.addEventListener(type,event=>{void api.openApp(event);});
  w.addEventListener('storage',event=>{if(event.key===KEY&&choiceOf(event.newValue)!==true)void api.choose(false);});
  w.addEventListener('pagehide',()=>api.suspend());
  mounted.set(doc,api);void api.start();return api;
 }
 return Object.freeze({PIXEL,KEY,VERSION,ORIGIN,choiceOf,cleanContext,createController,createBrowserSdk,mount});
});
