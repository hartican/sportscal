'use strict';
// Browser-test evidence only. Serialized by Playwright into the disposable page.
// No values, text, HTML, account snapshots, requests, timers or UI actions.
module.exports = function installAccountSignInActionTrace() {
  const maxEvents=96,maxBytes=98304,maxObservedElements=384,events=[],identities=new WeakMap(),observed=new WeakSet();
  const ids=new Set(['accountSignInForm','accountEmail','accountPassword','keepAccountSignedIn',
    'accountSyncHelp','accountSyncDetail','accountSyncControls','settingsBody','settingsModal']);
  const tags=new Set(['FORM','BUTTON','INPUT','LABEL','DIV','SPAN','P']);
  const markers=new Set(['before-native-click','after-native-click']);
  const body=document.getElementById('settingsBody'),listeners=[];
  let nextIdentity=0,eventBytes=0,dropped=0,observedElementCount=0,stopped=false,resize=null,mutation=null;
  const number=value=>Number.isFinite(value)&&Math.abs(value)<=1000000?Math.round(value*100)/100:null;
  const form=()=>document.getElementById('accountSignInForm');
  const submit=()=>form()?.querySelector('button[type="submit"]')||null;
  function node(element){
    if(!element)return null;
    if(!identities.has(element))identities.set(element,++nextIdentity);
    return {identity:identities.get(element),tag:tags.has(element.tagName)?element.tagName:'other',
      id:ids.has(element.id)?element.id:null,connected:element.isConnected===true};
  }
  function rect(element){
    if(!element?.isConnected)return null;
    const r=element.getBoundingClientRect();
    return {x:number(r.x),y:number(r.y),width:number(r.width),height:number(r.height)};
  }
  function record(kind,phase=null,event=null,changes=null){
    if(stopped)return;
    if(events.length>=maxEvents){dropped=Math.min(dropped+1,1000000);return;}
    const f=form(),button=submit(),b=rect(button),x=number(event?.clientX),y=number(event?.clientY);
    const hit=x!==null&&y!==null?document.elementFromPoint(x,y):null;
    const entry={kind,phase,atMs:number(performance.now()),target:node(event?.target),
      trusted:event?event.isTrusted===true:null,defaultPrevented:event?event.defaultPrevented===true:null,
      pointerType:event?(['mouse','touch','pen'].includes(event.pointerType)?event.pointerType:null):null,
      form:node(f),submit:node(button),submitDisabled:button?button.disabled===true:null,
      submitRect:b,formRect:rect(f),helpRect:rect(document.getElementById('accountSyncHelp')),
      detailRect:rect(document.getElementById('accountSyncDetail')),focused:node(document.activeElement),
      point:event?{x,y,hit:node(hit),insideSubmit:b&&Object.values(b).every(v=>v!==null)&&x!==null&&y!==null
        ?x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height:null}:null,
      targetInsideSubmit:button&&event?.target?event.target===button||button.contains(event.target):null,
      helperExportPresent:typeof globalThis.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP?.mount==='function',
      helperMounted:typeof accountIndicatorController!=='undefined'&&Boolean(accountIndicatorController),
      signInMethodPresent:typeof serverSyncClient!=='undefined'&&typeof serverSyncClient?.signIn==='function',
      supabaseExportPresent:typeof globalThis.supabase?.createClient==='function',
      viewport:{width:number(globalThis.innerWidth),height:number(globalThis.innerHeight),
        scrollX:number(globalThis.scrollX),scrollY:number(globalThis.scrollY),
        visualHeight:number(globalThis.visualViewport?.height),visualTop:number(globalThis.visualViewport?.offsetTop)},
      changes};
    const size=new TextEncoder().encode(JSON.stringify(entry)).length;
    if(eventBytes+size>maxBytes){dropped=Math.min(dropped+1,1000000);return;}
    eventBytes+=size;events.push(entry);
  }
  function watch(){
    if(!resize||stopped)return;
    for(const element of [form(),submit(),document.getElementById('accountSyncHelp'),document.getElementById('accountSyncDetail')]){
      if(element&&!observed.has(element)&&observedElementCount<maxObservedElements){
        observed.add(element);observedElementCount++;resize.observe(element);
      }
    }
  }
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','submit','invalid','focusin','focusout']){
    for(const capture of [true,false]){
      const handler=event=>{if(event.target?.closest?.('#accountSignInForm'))record(type,capture?'capture':'bubble',event);};
      document.addEventListener(type,handler,capture);listeners.push([type,handler,capture]);
    }
  }
  if(typeof ResizeObserver==='function')resize=new ResizeObserver(()=>record('resize'));
  if(body&&typeof MutationObserver==='function'){
    mutation=new MutationObserver(records=>{
      const changes=new Set();
      for(const r of records){
        const element=r.target.nodeType===1?r.target:r.target.parentElement;
        if(element===body)changes.add('settings-body');
        if(element?.closest?.('#accountSignInForm'))changes.add('sign-in-form');
        if(element?.closest?.('#accountSyncHelp'))changes.add('sync-help');
        if(element?.closest?.('#accountSyncDetail'))changes.add('sync-detail');
        if(element?.id==='accountSyncControls')changes.add('account-controls');
      }
      watch();if(changes.size)record('mutation',null,null,[...changes].sort());
    });
    mutation.observe(body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','disabled']});
  }
  watch();record('installed');
  globalThis.qaSignInActionTrace=Object.freeze({
    mark(label){if(markers.has(label))record(label);},
    snapshot(){return JSON.parse(JSON.stringify({format:'account-sign-in-action-trace.v1',
      timeOrigin:Number.isFinite(performance.timeOrigin)&&performance.timeOrigin>=0?performance.timeOrigin:null,
      maxEvents,maxBytes,eventBytes,maxObservedElements,observedElementCount,overflow:dropped>0,dropped,
      timingMayBePerturbed:true,events}));},
    stop(){
      if(stopped)return;record('stopped');stopped=true;mutation?.disconnect();resize?.disconnect();
      for(const [type,handler,capture] of listeners)document.removeEventListener(type,handler,capture);
    },
  });
};
