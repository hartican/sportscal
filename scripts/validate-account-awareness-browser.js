#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const project=path.resolve(__dirname,'..'),output=process.env.ACCOUNT_AWARENESS_QA_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});
const sources=['config/account-awareness.js','assets/js/account-awareness-ui.js'].map(file=>fs.readFileSync(path.join(project,file),'utf8'));
const html='<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{font:14px system-ui;--text:#18212d;--border:#b7bdc5;--bg-card:#fff;--panel-bg:#f4f6f9;--soft-fill:#dce2e8}[data-theme=night]{--text:#f1f4f8;--border:#555e6b;--bg-card:#141920;--panel-bg:#1e2631;--soft-fill:#374150}body{margin:8px;background:var(--bg-card);color:var(--text)}header{padding:4px}.tools{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.mock{width:44px;min-height:44px;color:inherit;background:transparent;border:1px solid var(--border);border-radius:8px}#follow{margin:24px 4px;min-height:44px}</style></head><body><header aria-label="Constructed header"><div class="tools"><button class="mock" id="settings" aria-label="Settings">⚙</button><span id="account-host"></span><button class="mock" aria-label="Calendar">▦</button><button class="mock" aria-label="Notifications">♧</button></div></header><button id="follow">Follow Test Club</button></body></html>';

(async()=>{
 const engine=process.env.ACCOUNT_AWARENESS_QA_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,...(engine===chromium?{channel:process.env.QA_BROWSER_CHANNEL||'chrome'}:{})});
 let layoutCases=0,behaviorCases=0;
 try{
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.route('**/*',route=>route.abort('blockedbyclient'));
   const page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
   await page.setContent(html);
   for(const source of sources)await page.addScriptTag({content:source});
   await page.evaluate(()=>{
    const now=Date.parse('2026-10-19T01:00:00Z');
    const avatar=letter=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#63728a"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="16">${letter}</text></svg>`);
    window.factsFor=mode=>{
     const facts={state:'signedIn',user:{id:'account-a',email:'person-a@example.test'},sessionOwnerId:'account-a',sessionExpiresAt:now+3600000,profile:{handle:'long_public_handle',displayName:'Avery Sample',avatarUrl:avatar('A')},profileOwnerId:'account-a',online:true,now};
     if(mode==='guest')facts.state='signedOut';
     if(mode==='checking')facts.state='checking';
     if(mode==='offline'){facts.state='error';facts.online=false;}
     if(mode==='expired'){facts.sessionExpiresAt=now;facts.online=false;}
     if(mode==='mismatch')facts.sessionOwnerId='account-b';
     if(mode==='no-profile')facts.profileOwnerId='account-b';
     if(mode==='name')facts.profile={displayName:'Avery Sample'};
     if(mode==='other'){facts.user={id:'account-b',email:'person-b@example.test'};facts.sessionOwnerId='account-b';facts.profileOwnerId='account-b';facts.profile={handle:'another_handle',displayName:'Blake Example',avatarUrl:avatar('B')};}
     return facts;
    };
    window.snapshot={facts:factsFor('guest'),session:{appSessionId:'constructed-app',accountEpoch:0}};
    window.results={};window.callbacks=[];window.accountJourneys=[];window.targetPresent=true;window.failPerform=false;window.delayPerform=false;window.failAccountOpen=false;
    window.makeController=()=>NOTHINGSPORTS_ACCOUNT_AWARENESS_UI.create({host:document.getElementById('account-host'),readSnapshot:()=>snapshot,openAccount:input=>{
     if(failAccountOpen)throw Error('CONSTRUCTED_INTERNAL_ACCOUNT_ERROR');
     accountJourneys.push({reason:input.reason,action:input.action||null});
     if(input.reason==='indicator')return;
     return new Promise(resolve=>window.finishAccount=resolve);
    }});
    window.controller=makeController();
    window.setMode=(mode,epoch,appSessionId='constructed-app')=>{snapshot={facts:factsFor(mode),session:{appSessionId,accountEpoch:epoch}};controller.render();};
    window.begin=(action,key)=>{
     results[key]=null;
     controller.request(action,{label:'Controlled '+action+' action',isCurrent:()=>targetPresent,perform:input=>{
      callbacks.push({action:input.action,decision:input.decision,scope:input.scope});
      if(failPerform)throw Error('Constructed action failure');
      if(delayPerform)return new Promise(resolve=>window.finishPerform=resolve);
      return 'constructed-completion';
     }}).then(result=>results[key]=result,error=>results[key]={status:'failed',message:error.message});
    };
   });
   const chip=page.locator('.account-awareness-control'),dialog=page.locator('dialog[data-account-awareness]');
   const begin=async(action,key)=>page.evaluate(({action,key})=>begin(action,key),{action,key});
   const result=async key=>{await page.waitForFunction(key=>Boolean(results[key]),key);return page.evaluate(key=>results[key],key);};
   const mode=async(name,epoch,appSessionId='constructed-app')=>page.evaluate(({name,epoch,appSessionId})=>setMode(name,epoch,appSessionId),{name,epoch,appSessionId});
   const count=()=>page.evaluate(()=>callbacks.length);
   const expected={guest:['signedOut','Not signed in'],checking:['checking','Checking account…'],offline:['offline','Offline · @long_public_…'],expired:['reconnect','Reconnect · @long_public_…'],mismatch:['reconnect','Check sign-in'],'no-profile':['signedIn','person-a@exam…'],name:['signedIn','Avery Sample'],signedIn:['signedIn','@long_public_…']};
   for(const theme of ['day','night'])for(const [name,[status,label]] of Object.entries(expected)){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await mode(name,++layoutCases);
    assert.equal(await chip.locator('.account-awareness-label').innerText(),label,name);assert.equal(await chip.getAttribute('data-account-status'),status,name);
    const geometry=await chip.evaluate(button=>{const b=button.getBoundingClientRect(),label=button.querySelector('.account-awareness-label'),r=label.getBoundingClientRect();return{left:b.left,right:b.right,width:b.width,height:b.height,labelLeft:r.left,labelRight:r.right,labelWidth:r.width,display:getComputedStyle(label).display};});
    assert(geometry.width>=44&&geometry.height>=44&&geometry.left>=0&&geometry.right<=width+.1,JSON.stringify({width,name,geometry}));
    assert(geometry.labelWidth>0&&geometry.labelLeft>=geometry.left&&geometry.labelRight<=geometry.right&&geometry.display!=='none',name);
    if(['guest','checking','mismatch','no-profile','name'].includes(name))assert.equal(await chip.locator('img').count(),0,name);
    if(['guest','checking','mismatch'].includes(name))assert(!(await chip.getAttribute('aria-label')).includes('long_public_handle'),name);
    if(name==='signedIn')assert((await chip.getAttribute('aria-label')).includes('@long_public_handle'));
    if(width===390&&output&&['guest','signedIn'].includes(name))await page.locator('header').screenshot({path:path.join(output,`${theme}-${name}.png`)});
   }
   await page.locator('#settings').focus();await page.keyboard.press('Tab');assert.equal(await chip.evaluate(button=>button===document.activeElement),true);
   await page.keyboard.press('Enter');await page.waitForFunction(()=>accountJourneys.length===1);assert.equal(await count(),0);behaviorCases++;
   for(const [i,theme] of ['day','night'].entries()){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await mode('guest',90+i);await begin('follow','prompt-layout-'+theme);await dialog.waitFor();
    const boxes=await dialog.evaluate(d=>({dialog:d.getBoundingClientRect().toJSON(),buttons:[...d.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON())}));
    assert(boxes.dialog.left>=0&&boxes.dialog.right<=width&&boxes.buttons.every(b=>b.height>=44&&b.left>=boxes.dialog.left&&b.right<=boxes.dialog.right),JSON.stringify({width,theme,boxes}));
    if(width===390&&output)await dialog.screenshot({path:path.join(output,`${theme}-guest-prompt.png`)});
    await page.keyboard.press('Escape');assert.equal((await result('prompt-layout-'+theme)).status,'cancelled');assert.equal(await count(),0);behaviorCases++;
   }
   if(width===390){
    await page.evaluate(()=>failAccountOpen=true);await chip.click();await page.getByText('Account could not be opened. Please try again.',{exact:true}).waitFor();assert(!(await page.locator('body').innerText()).includes('CONSTRUCTED_INTERNAL_ACCOUNT_ERROR'));await page.evaluate(()=>failAccountOpen=false);behaviorCases++;
    await mode('guest',100);await page.locator('#follow').focus();await begin('follow','cancel');
    assert.equal(await dialog.getAttribute('aria-labelledby'),await dialog.locator('h2').getAttribute('id'));
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Sign in');
    await page.keyboard.press('Escape');assert.equal((await result('cancel')).status,'cancelled');assert.equal(await page.locator('#follow').evaluate(button=>button===document.activeElement),true);assert.equal(await count(),0);behaviorCases++;
    await begin('follow','first');await dialog.getByRole('button',{name:'Continue on this device',exact:true}).click();assert.equal((await result('first')).decision,'continue-local');assert.equal(await count(),1);behaviorCases++;
    await page.evaluate(()=>controller.render());await begin('save','second');assert.equal((await result('second')).decision,'continue-local');assert.equal(await dialog.count(),0);behaviorCases++;
    for(const action of ['rate','reminder-on']){
     await begin(action,action);assert.equal(await dialog.getByRole('button',{name:'Continue on this device',exact:true}).count(),0);
     await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await result(action)).status,'cancelled');behaviorCases++;
    }
    await mode('guest',101);await begin('follow','pending-off');const beforeOff=await count();await begin('reminder-off','off');assert.equal((await result('off')).decision,'continue-off');assert.equal(await count(),beforeOff+1);await page.keyboard.press('Escape');await result('pending-off');behaviorCases++;
    await begin('follow','target');await page.evaluate(()=>targetPresent=false);await dialog.getByRole('button',{name:'Continue on this device',exact:true}).click();assert.equal((await result('target')).reason,'target-changed');await page.evaluate(()=>targetPresent=true);behaviorCases++;
    await mode('guest',102);await begin('follow','same-scope-unverified');await page.evaluate(()=>{snapshot.facts={...snapshot.facts,state:'checking',user:null,sessionOwnerId:''};controller.render();});await dialog.getByRole('button',{name:'Continue on this device',exact:true}).click();assert.equal((await result('same-scope-unverified')).reason,'account-unverified');behaviorCases++;
    await mode('guest',103);await begin('follow','sign-in');await dialog.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>typeof finishAccount==='function');
    await mode('signedIn',104);await page.evaluate(()=>finishAccount({signedIn:true,accountId:'account-a',appSessionId:'constructed-app',accountEpoch:104}));assert.equal((await result('sign-in')).decision,'continue-account');behaviorCases++;
    await mode('guest',105);await begin('follow','account-race');await dialog.getByRole('button',{name:'Sign in',exact:true}).click();
    await mode('other',107);await page.evaluate(()=>finishAccount({signedIn:true,accountId:'account-a',appSessionId:'constructed-app',accountEpoch:106}));assert.equal((await result('account-race')).reason,'account-changed');behaviorCases++;
    await mode('guest',108);await begin('follow','epoch');await mode('other',109);assert.equal((await result('epoch')).reason,'account-changed');assert.equal(await dialog.count(),0);behaviorCases++;
    await mode('offline',110);await begin('follow','offline');assert.equal((await result('offline')).decision,'continue-account');assert((await chip.innerText()).startsWith('Offline ·'));behaviorCases++;
    await mode('expired',111);await begin('follow','expired');await dialog.getByRole('heading',{name:'Check your sign-in'}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Continue on this device',exact:true}).count(),0);await page.keyboard.press('Escape');await result('expired');behaviorCases++;
    await mode('checking',112);await begin('reminder-off','checking-off');assert.equal((await result('checking-off')).decision,'continue-off');behaviorCases++;
    await begin('follow','checking-follow');await dialog.getByRole('heading',{name:'Checking your account'}).waitFor();await page.keyboard.press('Escape');assert.equal((await result('checking-follow')).status,'cancelled');behaviorCases++;
    await mode('signedIn',113);await page.evaluate(()=>failPerform=true);await begin('save','failure');assert.equal((await result('failure')).status,'failed');await page.evaluate(()=>failPerform=false);behaviorCases++;
    await page.evaluate(()=>delayPerform=true);await begin('follow','late');await page.waitForFunction(()=>typeof finishPerform==='function');await mode('other',114);await page.evaluate(()=>{delayPerform=false;finishPerform('old-account-completion');});assert.equal((await result('late')).reason,'account-changed');behaviorCases++;
    await mode('signedIn',115);await page.evaluate(()=>window.oldAvatar=document.querySelector('.account-awareness-avatar img'));await mode('other',116);await page.evaluate(()=>oldAvatar.dispatchEvent(new Event('error')));assert.equal(await chip.locator('img').count(),1);assert((await chip.innerText()).includes('@another_hand'));behaviorCases++;
    await page.evaluate(()=>document.querySelector('.account-awareness-avatar img').dispatchEvent(new Event('error')));assert.equal(await chip.locator('img').count(),0);assert.equal(await chip.locator('.account-awareness-avatar').innerText(),'BE');behaviorCases++;
    await mode('guest',117);await begin('follow','local-again');await dialog.getByRole('button',{name:'Continue on this device',exact:true}).click();await result('local-again');await mode('guest',117,'new-app-session');await begin('save','new-session');await dialog.waitFor();await page.keyboard.press('Escape');await result('new-session');behaviorCases++;
    await begin('follow','destroy');const beforeDestroy=await count();await page.evaluate(()=>controller.destroy());assert.equal((await result('destroy')).reason,'destroyed');assert.equal(await chip.count(),0);assert.equal(await dialog.count(),0);assert.equal(await count(),beforeDestroy);behaviorCases++;
    await page.evaluate(()=>controller=makeController());assert.equal(await page.locator('#account-awareness-styles').count(),1);await begin('follow','new-controller');await dialog.waitFor();await page.keyboard.press('Escape');await result('new-controller');behaviorCases++;
   }
   assert.deepEqual(requests,[],'constructed UI must perform no browser requests');assert.deepEqual(errors,[]);await context.close();
   console.log(`${width}px: persistent text/avatar, owner-safe state labels, geometry and keyboard passed`);
  }
  assert.doesNotMatch(sources[1],/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|setInterval|setTimeout)\b/,'UI preparation cannot introduce a network, persistence or polling owner');
  console.log(JSON.stringify({passed:true,browser:engine===webkit?'webkit':'chromium',layoutCases,behaviorCases,scope:'Constructed isolated UI and callbacks; no app hooks, provider or real-account evidence'}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
