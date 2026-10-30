'use strict';
// Real icon UI, account client and Settings owners in a disposable DOM.
// Transport is injected locally; no browser, server, network or customer data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const {readInlineOwner}=require('./app-shell-test-utils');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const owners=['openSettings','closeSettings','navigateSettingsSection','syncThemeBrandAssets'].map(name=>readInlineOwner(name,html)).join('\n');
const appearanceSource=read('config/fantasy-deadline-ui.js');
const appearance=require('acorn').parse(appearanceSource,{ecmaVersion:'latest'}).body[0].expression.callee.body.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='renderAppearanceSettings');
assert(appearance,'use the actual Appearance owner');
const cases=[];
const test=(name,run)=>cases.push({name,run});
async function settle(){for(let i=0;i<25;i++)await Promise.resolve();}
function fixture(points=100){
 const dom=new JSDOM('<!doctype html><head><link rel="icon" href="/old.png"><link rel="apple-touch-icon" href="/old-touch.png"><link rel="manifest" href="/manifest.webmanifest"></head><body><button id="closeSettingsBtn"></button><div id="settingsModal"><main id="settingsBody"></main></div><img data-brand-asset="icon" src="/old.png"></body>',{url:'https://fixture.invalid/',runScripts:'outside-only'});
 const w=dom.window,requests=[],errors=[];let clock=1800000000000,next=null,forbidden=0;
 // jsdom lacks HTMLLinkElement.sizes; preserve the real owner's metadata read.
 for(const link of w.document.querySelectorAll('link'))if(!link.sizes)Object.defineProperty(link,'sizes',{get:()=>({value:link.getAttribute('sizes')||''})});
 const deny=()=>{forbidden++;throw Error('I/O forbidden in icon lifecycle test');};
 w.fetch=deny;w.XMLHttpRequest=deny;w.WebSocket=deny;w.Worker=deny;w.BroadcastChannel=undefined;
 w.AbortController=globalThis.AbortController;w.Date.now=()=>clock;
 w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
 let token;const seed=subject=>{token=`fixture.${Buffer.from(JSON.stringify({sub:subject})).toString('base64url')}.fixture`;w.sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:token,refreshToken:'synthetic-refresh',expiresAt:clock+3600000}));};seed('synthetic-A');
 w.eval(read('config/server-sync.js'));
 const client=w.NOTHINGSPORTS_SERVER_SYNC.createClient({storage:w.sessionStorage,persistentStorage:w.localStorage,now:()=>clock,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/nothingscore?icon=1');assert.equal(options.headers.Authorization,`Bearer ${token}`);
  requests.push(url);const response=next;next=null;
  if(response)return response();
  return {ok:true,status:200,json:async()=>({canChooseIcon:points>=100,minimumPoints:100})};
 }});
 w.serverSyncClient=client;w.__renders=[];w.__applied=[];
 w.eval(`var draftPreferences=null,settingsViewportAnchor=null,settingsSection='main',settingsNavigationStack=[],settingsReturnFocus=null,settingsFirstRun=false,settingsWizardStep=0,settingsFocusedDomainId=null,sportsFollowedTab='sports',legalDocumentRenderToken=0,settingsDraftBaseline=null;
 var userPreferences={theme:'night'},ONBOARDING_SECTIONS=['main'];
 function clonePreferences(v){return JSON.parse(JSON.stringify(v));}
 function captureViewportRenderAnchor(){return {};}
 function syncDraftPreferenceGraph(){} function restoreViewportAnchorAfterLayout(){} function settingsBackgroundInert(){} function openSelectorOptInPrompt(){}
 function normalizeThemePreference(v){return v;}
 function syncThemeTeamAssets(){} function syncThemeEventAssets(){}
 function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
 var BRAND_ASSETS={logo:{},hero:{}};
 function applyThemePreference(theme){__applied.push(theme);syncThemeBrandAssets(theme==='night');}
 function renderSettingsScreen(){__renders.push(settingsSection);const body=document.getElementById('settingsBody');body.replaceChildren();if(settingsSection==='appearance')renderAppearanceSettings(body);else if(settingsSection==='main'){const menu=document.createElement('div');menu.className='settings-menu';body.append(menu);NOTHINGSPORTS_APP_ICON_SETTINGS.menu(body);}}
 ${owners}\n${appearanceSource.slice(appearance.start,appearance.end)}`);
 w.eval(read('config/app-icon-choice.js'));w.eval(read('config/app-icon-settings-ui.js'));
 return {w,requests,errors,open:section=>w.openSettings({section}),close:()=>w.closeSettings({restoreViewport:false}),setPoints:n=>{points=n;},advance:ms=>{clock+=ms;},rejectNext:()=>{next=async()=>{throw Error('Synthetic fresh read failed');};},
  changeAccount(subject='synthetic-B'){client.clearSession();seed(subject);},
  deferNext(){let resolve;const pending=new Promise(done=>{resolve=done;});next=()=>pending;return ()=>resolve({ok:true,status:200,json:async()=>({canChooseIcon:true,minimumPoints:100})});},
  snapshot:()=>JSON.stringify({icon:w.localStorage.getItem('nsIcon'),links:[...w.document.querySelectorAll('link')].map(n=>n.href),image:w.document.body.lastElementChild.src}),
  dispose(){assert.equal(forbidden,0);assert.deepEqual(errors,[]);dom.window.close();}};
}
test('fresh failure keeps cached eligible action locked',async()=>{
 const f=fixture();try{
  f.open('main');await settle();const button=f.w.document.querySelector('.app-icon-action');assert.equal(button.getAttribute('aria-disabled'),'false');
  const before=f.snapshot();f.rejectNext();button.click();await settle();
  assert.equal(button.getAttribute('aria-disabled'),'true','failed fresh check cannot reuse cached positive');
  assert.equal(button.lastElementChild.textContent,'🔒');assert.equal(f.w.settingsSection,'main');assert.equal(f.snapshot(),before);
 }finally{f.dispose();}
});
test('99 to 100 unlock stays at eight unique choices after repeated clicks',async()=>{
 const f=fixture(99);try{
  f.open('appearance');await settle();const button=f.w.document.querySelector('.app-icon-action');assert.equal(button.getAttribute('aria-disabled'),'true');
  const before=f.snapshot();f.setPoints(100);button.click();await settle();assert.equal(f.w.document.querySelectorAll('[data-icon-choice]').length,8);
  button.click();await settle();
  const choices=[...f.w.document.querySelectorAll('[data-icon-choice]')];assert.equal(choices.length,8,'repeated unlock must not append another eight choices');
  assert.equal(new Set(choices.map(node=>node.dataset.iconChoice)).size,8);assert.equal(f.w.document.querySelectorAll('.app-icon-action').length,0,'remove exhausted unlock action');assert.equal(f.snapshot(),before);
  const theme=f.w.document.querySelector('input[value="day"]');theme.checked=true;theme.dispatchEvent(new f.w.Event('change',{bubbles:true}));await settle();
  assert.equal(f.w.draftPreferences.theme,'day');assert.equal(f.w.document.querySelectorAll('[data-icon-choice]').length,8,'theme controls remain usable');
 }finally{f.dispose();}
});
test('deferred eligible action cannot navigate after Settings closes',async()=>{
 const f=fixture();try{
  f.open('main');await settle();const finish=f.deferNext();f.w.document.querySelector('.app-icon-action').click();await settle();
  f.close();const before=f.snapshot(),renders=JSON.stringify(f.w.__renders);finish();await settle();
  assert.equal(f.w.settingsSection,'main','late entitlement cannot navigate closed Settings');assert.equal(JSON.stringify(f.w.__renders),renders);assert.equal(f.snapshot(),before);
 }finally{f.dispose();}
});
const changes=[
 ['close',f=>f.close()],
 ['reopen',f=>{const section=f.w.settingsSection;f.close();f.open(section);}],
 ['draft replacement',f=>{f.w.draftPreferences=f.w.clonePreferences(f.w.draftPreferences);}],
 ['section change',f=>f.w.navigateSettingsSection('pilot')],
 ['account change',f=>f.changeAccount()],
 ['same account new generation',f=>f.changeAccount('synthetic-A')],
];
for(const [name,change] of changes)for(const selection of [false,true])test(`deferred ${selection?'selection':'action'} refuses ${name}`,async()=>{
 const f=fixture();try{
  f.w.localStorage.setItem('nsIcon',JSON.stringify('light-full-colour'));f.open(selection?'appearance':'main');await settle();
  const button=f.w.document.querySelector(selection?'[data-icon-choice="inverted"]':'.app-icon-action'),finish=f.deferNext(),requests=f.requests.length;
  button.click();await settle();assert.equal(f.requests.length,requests+1,'the actual client must be awaiting its injected transport');
  change(f);const before=f.snapshot(),section=f.w.settingsSection,draft=f.w.draftPreferences,renders=JSON.stringify(f.w.__renders);finish();await settle();
  assert.equal(f.w.settingsSection,section,'late result cannot navigate');assert.equal(f.w.draftPreferences,draft,'late result cannot replace current draft');assert.equal(JSON.stringify(f.w.__renders),renders);assert.equal(f.snapshot(),before,'late result cannot change saved icon or metadata');
 }finally{f.dispose();}
});
test('failed selection and expired or changed account checks preserve saved icon',async()=>{
 const f=fixture();try{
  f.w.localStorage.setItem('nsIcon',JSON.stringify('light-full-colour'));f.open('appearance');await settle();const before=f.snapshot();
  f.rejectNext();f.w.document.querySelector('[data-icon-choice="inverted"]').click();await settle();assert.equal(f.snapshot(),before);assert.match(f.w.document.querySelector('[role="status"]').textContent,/could not be changed/);
  f.advance(30001);f.rejectNext();f.w.navigateSettingsSection('main');await settle();assert.equal(f.w.document.querySelector('.app-icon-action').getAttribute('aria-disabled'),'true');assert.equal(f.w.localStorage.getItem('nsIcon'),'"light-full-colour"');
  f.changeAccount();f.rejectNext();f.open('main');await settle();assert.equal(f.w.document.querySelector('.app-icon-action').getAttribute('aria-disabled'),'true');assert.equal(f.w.localStorage.getItem('nsIcon'),'"light-full-colour"');
 }finally{f.dispose();}
});
test('older success cannot restore entitlement after newer failure',async()=>{
 const f=fixture();try{
  f.open('main');await settle();const finish=f.deferNext();f.w.document.querySelector('.app-icon-action').click();await settle();
  f.open('main');await settle();f.rejectNext();f.w.document.querySelector('.app-icon-action').click();await settle();
  assert.equal(f.w.document.querySelector('.app-icon-action').getAttribute('aria-disabled'),'true');const before=f.snapshot();
  finish();await settle();f.w.renderSettingsScreen();await settle();
  assert.equal(f.w.document.querySelector('.app-icon-action').getAttribute('aria-disabled'),'true','older eligible result cannot overwrite a newer failed check');assert.equal(f.snapshot(),before);
 }finally{f.dispose();}
});
test('current eligible action and all eight selections still work',async()=>{
 const f=fixture();try{
  f.open('main');await settle();f.w.document.querySelector('.app-icon-action').click();await settle();assert.equal(f.w.settingsSection,'appearance');
  const ids=['dark-full-colour','light-full-colour','clear-glass','greyscale-dark','greyscale-light','inverted','high-contrast-neon','monochrome-white'];
  assert.equal(f.w.document.querySelectorAll('[data-icon-choice]').length,8);
  for(const id of ids){f.w.document.querySelector(`[data-icon-choice="${id}"]`).click();await settle();assert.equal(f.w.localStorage.getItem('nsIcon'),JSON.stringify(id));assert(f.w.document.querySelector('link[rel="icon"]').href.endsWith(`${id}-n-32.png`));assert.equal(f.w.document.querySelector(`[data-icon-choice="${id}"]`).getAttribute('aria-pressed'),'true');}
 }finally{f.dispose();}
});
function denyIo(){
 const restores=[],attempts={network:0,child:0,worker:0};
 function block(object,key,kind){if(typeof object[key]!=='function')return;const old=object[key];object[key]=()=>{attempts[kind]++;throw Error(`${kind} forbidden in icon lifecycle test`);};restores.push(()=>{object[key]=old;});}
 block(globalThis,'fetch','network');
 for(const name of ['http','https','net','tls','dgram'])for(const key of ['request','get','connect','createConnection','createSocket'])block(require(`node:${name}`),key,'network');
 block(require('node:net').Socket.prototype,'connect','network');
 for(const key of ['exec','execFile','execSync','execFileSync','fork','spawn','spawnSync'])block(require('node:child_process'),key,'child');
 for(const key of ['Worker','BroadcastChannel'])block(require('node:worker_threads'),key,'worker');
 return {attempts,restore:()=>restores.reverse().forEach(restore=>restore())};
}
async function run(){const selected=process.argv[2],guard=denyIo();let passed=0;try{for(const c of cases){if(selected&&!c.name.includes(selected))continue;try{await c.run();passed++;}catch(error){error.message=`${c.name}: ${error.message}`;throw error;}}assert(passed>0,'at least one lifecycle case ran');assert.deepEqual(guard.attempts,{network:0,child:0,worker:0});console.log(JSON.stringify({kind:'app-icon-settings-lifecycle',passed:true,cases:passed,nativeExecuted:false,forbiddenAttempts:guard.attempts}));}finally{guard.restore();}}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={run};
