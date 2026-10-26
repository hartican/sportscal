#!/usr/bin/env node
'use strict';
// The mounted application, real auth transport and disposable loopback responses.
// No customer accounts, production requests or server-side data changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sync = require('../config/user-state-sync');
const root = path.resolve(__dirname, '..');
const testedHtml=process.env.ACCOUNT_RECOVERY_BASELINE?execFileSync('git',['show',process.env.ACCOUNT_RECOVERY_BASELINE+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}):fs.readFileSync(path.join(root,'index.html'),'utf8');
const testedShellVersion=testedHtml.match(/<meta name="app-shell-version" content="(\d+)">/)?.[1];
assert(testedShellVersion,'exact served source declares its shell version');
const engineName = process.env.ACCOUNT_RECOVERY_BROWSER || 'chromium';
const scenario = process.env.ACCOUNT_RECOVERY_CASE || 'retry-error';
const helperRaceProbe=process.env.ACCOUNT_RECOVERY_HELPER_RACE==='1'||scenario==='helper-mount';
const cancelControl=process.env.ACCOUNT_RECOVERY_CANCEL_CONTROL==='1';
const fixtureControl=process.env.ACCOUNT_RECOVERY_LIVE_FIXTURE_CONTROL||null;
assert(fixtureControl===null||(['original','settled'].includes(fixtureControl)&&scenario==='api-stale'),'Live fixture control requires explicit api-stale original/settled mode');
assert(!cancelControl||scenario==='receipt-base-disjoint','Cancellation control requires the one explicit disjoint case');
if (scenario === 'all') {
  let failed = false;
  for (const engine of (process.env.ACCOUNT_RECOVERY_BROWSER ? [engineName] : ['chromium', 'webkit'])) {
    for (const testCase of ['helper-mount', 'diagnostic', 'retry-error', 'pending-receipt', 'resume', 'cold-retry', 'offline', 'terminal', 'refresh-failure', 'follow-roundtrip', 'origin-isolation', 'timeout', 'overlap', 'api-stale', 'api-timestamp', 'api-race', 'api-changed', 'receipt-base-disjoint', 'receipt-base-overlap', 'receipt-base-cricket']) {
      const result = spawnSync(process.execPath, [__filename], { stdio: 'inherit', env: {
        ...process.env, ACCOUNT_RECOVERY_BROWSER: engine, ACCOUNT_RECOVERY_CASE: testCase } });
      failed ||= result.status !== 0;
    }
  }
  process.exit(failed ? 1 : 0);
}
const owner = 'disposable-account-a';
const token = id => 'e30.' + Buffer.from(JSON.stringify({ sub: id })).toString('base64url') + '.disposable';
const clone = value => JSON.parse(JSON.stringify(value));
// Diagnostic only: correlate same-origin schedule reads with document lifetime.
// Keep the original pageerror collector/gate unchanged; never handle a rejection.
const traceApiStale=scenario==='api-stale';
const traceResources=scenario.startsWith('receipt-base-')||traceApiStale,resourceTrace=[];
let resourcePhase='initial-startup',documentEpoch=0,resourceSequence=0,resourceTraceDropped=0,resourceTraceReported=false;
const traceStart=Date.now(),resourceMarker='[qa-account-resource]';
let cancelControlArmed=false,heldScheduleResponse=null,scheduleBodyObserved;
const scheduleBodyHeld=new Promise(resolve=>{scheduleBodyObserved=resolve;});
function releaseScheduleBody(){
  if(heldScheduleResponse&&!heldScheduleResponse.res.destroyed&&!heldScheduleResponse.res.writableEnded)heldScheduleResponse.res.end(heldScheduleResponse.data.subarray(1));
}
function assertHeldScheduleInterruption(held,observed){
  assert.equal(observed.req,held.req,'interruption must belong to the exact held request');
  assert.equal(observed.res,held.res,'interruption must belong to the exact held response');
  assert.equal(observed.requestAborted,true,'held request must actually abort');
  assert.equal(observed.responseFinished,false,'held response must close unfinished');
}
let fixtureControlArmed=false,fixtureRouteSelected=false,heldFixtureResponse=null,fixtureRequestObserved,fixtureControlOriginalPending=null;
const fixtureRequestHeld=new Promise(resolve=>{fixtureRequestObserved=resolve;});
function releaseFixtureResponse(){
  const held=heldFixtureResponse;
  if(held&&!held.res.destroyed&&!held.res.writableEnded)held.res.writeHead(503,{'Content-Type':'application/json'}).end(held.body);
}
async function observeFixtureControl(work,label){
  let timer;
  try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' was not observed within8s')),8000);})]);}
  finally{clearTimeout(timer);}
}
function assertFixtureControlPending(held,facts){
  assert(held&&!held.req.aborted&&!held.res.destroyed&&!held.res.writableEnded&&!held.res.headersSent,'held fixture HTTP stream must be live before headers');
  assert.equal(facts.liveRefreshPending,true,'actual existing live fixture owner must remain pending after the original barrier');
}
const schedulePath=pathname=>pathname.startsWith('/data/follow-schedule/');
const legacyFixtureCase=scenario.startsWith('api-');
const tracedResourcePath=pathname=>schedulePath(pathname)||(legacyFixtureCase&&pathname==='/api/fixtures');
const resourceFrameUrl=request=>{try{return request.frame().url();}catch{return null;}};
function traceResource(event,fields={}){
  if(!traceResources)return;
  if(resourceTrace.length===160){resourceTraceDropped++;return;}
  resourceTrace.push({event,atMs:Date.now()-traceStart,phase:resourcePhase,documentEpoch,...fields});
}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if(traceResources&&tracedResourcePath(pathname)){
    const id='http-'+(++resourceSequence);
    traceResource('http-request',{id,path:pathname,host:req.headers.host,origin:req.headers.origin||null});
    req.on('aborted',()=>traceResource('http-request-aborted',{id,path:pathname}));
    res.on('finish',()=>traceResource('http-response-finished',{id,path:pathname,status:res.statusCode}));
    res.on('close',()=>traceResource('http-response-closed',{id,path:pathname,finished:res.writableFinished,status:res.statusCode}));
  }
  if(fixtureControl&&fixtureControlArmed&&pathname==='/api/fixtures'&&!heldFixtureResponse){
    let closed,finished;
    const terminal=new Promise(resolve=>{closed=resolve;}),complete=new Promise(resolve=>{finished=resolve;});
    heldFixtureResponse={req,res,terminal,complete,requestAborted:false,body:JSON.stringify({error:'Disposable optional fixtures unavailable'})};
    const held=heldFixtureResponse;
    req.once('aborted',()=>{held.requestAborted=true;});
    res.once('finish',()=>finished({req,res,responseFinished:res.writableFinished}));
    res.once('close',()=>closed({req,res,requestAborted:held.requestAborted,responseFinished:res.writableFinished}));
    traceResource('control-fixture-held-before-headers',{path:pathname,plannedStatus:503,bytesSent:0});fixtureRequestObserved();return;
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
  if (process.env.ACCOUNT_RECOVERY_BASELINE) {
    try { const data = execFileSync('git', ['show', process.env.ACCOUNT_RECOVERY_BASELINE + ':' + path.relative(root, file)], { cwd: root, maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
    catch { res.writeHead(404).end(); }
    return;
  }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    if(!error&&cancelControlArmed&&!heldScheduleResponse&&pathname==='/data/follow-schedule/football.json'){
      let closed;
      const terminal=new Promise(resolve=>{closed=resolve;});
      heldScheduleResponse={req,res,data,terminal,bytesSent:1,requestAborted:false};
      const held=heldScheduleResponse;
      req.once('aborted',()=>{held.requestAborted=true;});
      res.once('close',()=>closed({req,res,requestAborted:held.requestAborted,responseFinished:res.writableFinished}));
      res.write(data.subarray(0,1));
      traceResource('control-schedule-body-held',{path:pathname,bytesSent:1,totalBytes:data.length});scheduleBodyObserved();return;
    }
    res.end(error ? 'Not found' : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const origins = new Set([url]);
  const browser = await (engineName === 'webkit' ? webkit : chromium).launch({ headless: true,
    ...(engineName === 'chromium' ? { channel: process.env.QA_BROWSER_CHANNEL || 'chrome' } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  let row = null, readMode = 'success', refreshMode = 'success', reads = 0, writes = 0, refreshes = 0, authSignIns = 0;
  let beforeAck = null, page, controlBrowserRequest=null;
  const actualApi = (scenario.startsWith('api-')||scenario.startsWith('receipt-base-')) ? require('./lib/local-user-state-api')(owner) : null;
  const chronology = [];
  const heldReads = [];
  let holdHelper=false,helperHeld;const heldHelpers=[];
  const helperRequest=new Promise(resolve=>{helperHeld=resolve;});
  const statePayload = () => ({ user: { id: owner, email: 'disposable@example.invalid' }, state: row && {
    schema_version: row.schemaVersion, preferences: row.preferences, profile: row.profile,
    event_user_state: row.eventUserState, event_spoiler_state: row.eventSpoilerState,
    archived_events: row.archivedEvents, ratings: row.ratings, updated_at: row.updatedAt } });
  const errors = [], blocked = [], statuses = [];
  try {
    await context.addInitScript(traceResources => {
      if ('serviceWorker' in navigator) Object.defineProperty(navigator.serviceWorker, 'ready', {
        configurable: true, value: Promise.resolve({ pushManager: { getSubscription: async () => null } }) });
      if(traceResources){
        const report=(kind,error)=>console.debug('[qa-account-resource]'+JSON.stringify({kind,document:location.origin+location.pathname,
          name:String(error?.name||typeof error),message:String(error?.message||error||'').slice(0,400),stack:String(error?.stack||'').slice(0,1200)}));
        addEventListener('unhandledrejection',event=>{report('unhandledrejection',event.reason);});
        addEventListener('error',event=>{report('window-error',event.error||event.message);});
      }
    },traceResources);
    if(helperRaceProbe)await context.addInitScript(()=>{
      const frame=window.requestAnimationFrame;
      window.requestAnimationFrame=callback=>{
        if(String(callback).includes('openSettings({ firstRun: true })')){
          globalThis.qaReleaseStartupSetup=()=>{window.requestAnimationFrame=frame;frame(callback);};
          return 0;
        }
        return frame(callback);
      };
    });
    const routeHandler = async route => {
      const request = route.request(), u = new URL(request.url());
      let requestContext;if(traceApiStale){try{requestContext=request.frame().page()===page?'A':'B';}catch{requestContext='unavailable';}}
      if(traceApiStale&&u.pathname==='/api/fixtures')traceResource('route-fixtures-start',{context:requestContext,path:u.pathname,origin:u.origin,allowed:origins.has(u.origin)});
      if (!origins.has(u.origin)) { blocked.push(u.origin); return route.abort('blockedbyclient'); }
      if(holdHelper&&u.pathname==='/assets/js/account-awareness-runtime.js'){heldHelpers.push(route);helperHeld();return;}
      if (!u.pathname.startsWith('/api/')){
        if(schedulePath(u.pathname))traceResource('route-continue',{path:u.pathname,origin:u.origin,allowed:origins.has(u.origin),frameUrl:resourceFrameUrl(request)});
        return route.continue();
      }
      const body = request.postDataJSON() || {}, method = request.method();
      if (u.pathname === '/api/auth') {
        if (method === 'GET') return route.fulfill({ json: { configured: true } });
        if(body.action==='password-sign-in')authSignIns++;
        if (body.action === 'refresh') {
          refreshes++;
          if (refreshMode === 'terminal') return route.fulfill({ status: 401, json: { code: 'refresh_token_revoked', error: 'Disposable revoked session' } });
          if (refreshMode === 'failure') return route.fulfill({ status: 503, json: { error: 'Disposable offline refresh' } });
        }
        if (['password-sign-in', 'refresh'].includes(body.action)) return route.fulfill({ json: {
          session: { access_token: token(owner), refresh_token: 'disposable-' + refreshes, expires_in: 3600 } } });
        return route.fulfill({ json: { ok: true } });
      }
      if (u.pathname === '/api/user-state') {
        reads++;
        if (actualApi) {
          const result = await actualApi.handle({ url: u.pathname, method, headers: request.headers(), body });
          if (method === 'PUT' && result.status === 200) writes++;
          row = actualApi.state();
          chronology.push({ context: request.frame().page() === page ? 'A' : 'B', ...actualApi.calls.at(-1) });
          return route.fulfill({ status: result.status, json: result.body });
        }
        if (readMode === 'hold') { heldReads.push(route); return; }
        if (readMode === 'failure') return route.fulfill({ status: 503, json: { error: 'Disposable state unavailable' } });
        if (method === 'PUT') {
          writes++; row = { ...sync.applyPatch(row || {}, body.patch), updatedAt: new Date(Date.now() + writes * 1000).toISOString() };
          if (beforeAck) { const callback = beforeAck; beforeAck = null; await callback(); }
        }
        return route.fulfill({ json: statePayload() });
      }
      if (u.pathname === '/api/user-meta') return route.fulfill({ json: { meta: { sports: [] } } });
      if (actualApi && u.pathname === '/api/feed') return route.fulfill({ json: require('../lib/server-feed-pipeline').buildServerFeed({
        events: [], userId: owner, userState: actualApi.state(), now: new Date() }) });
      if (u.pathname === '/api/nothingscore' && u.searchParams.has('viewer')) return route.fulfill({ json: {
        viewer: { signedIn: true, profile: { handle: 'test_account', displayName: 'Test account', visibility: 'visible' } } } });
      if (u.pathname === '/api/fixtures') {
        if(fixtureControl&&fixtureControlArmed&&!fixtureRouteSelected&&requestContext==='A'){fixtureRouteSelected=true;traceResource('control-fixture-route-continue',{context:'A',path:u.pathname});return route.continue();}
        if(!traceApiStale)return route.fulfill({ status: 503, json: { error: 'Disposable optional fixtures unavailable' } });
        try{
          const result=await route.fulfill({ status: 503, json: { error: 'Disposable optional fixtures unavailable' } });
          if(traceApiStale)traceResource('route-fixtures-fulfilled',{context:requestContext,path:u.pathname,status:503});
          return result;
        }catch(error){if(traceApiStale)traceResource('route-fixtures-rejected',{path:u.pathname,name:String(error?.name||'').slice(0,80)});throw error;}
      }
      return route.fulfill({ status: 503, json: { error: 'Disposable optional service unavailable' } });
    };
    await context.route('**/*', routeHandler);
    page = await context.newPage();
    const tracedRequests=new Map(),terminalScheduleRequests=new Set(),failedScheduleRequests=new Map(),fixtureTerminals=new Map();
    const trackRequest=request=>{
      const u=new URL(request.url());if((!traceResources&&!legacyFixtureCase)||!tracedResourcePath(u.pathname))return null;
      if(!tracedRequests.has(request))tracedRequests.set(request,{id:'browser-'+(++resourceSequence),path:u.pathname,origin:u.origin,startedEpoch:documentEpoch,...(traceApiStale?{context:'A'}:{})});
      if(legacyFixtureCase&&u.pathname==='/api/fixtures'&&!fixtureTerminals.has(request)){
        let finish;const promise=new Promise(resolve=>{finish=resolve;});fixtureTerminals.set(request,{promise,finish,result:null});
      }
      return tracedRequests.get(request);
    };
    const finishFixture=(request,kind)=>{
      const entry=fixtureTerminals.get(request);if(entry){entry.result={kind};entry.finish(entry.result);}
    };
    page.on('request',request=>{const item=trackRequest(request);if(item)traceResource('browser-request',{...item,frameUrl:resourceFrameUrl(request),allowed:origins.has(item.origin)});});
    page.on('response',response=>{const item=trackRequest(response.request());if(item){const headers=response.headers();traceResource('browser-response',{...item,status:response.status(),contentType:headers['content-type']||null,allowOrigin:headers['access-control-allow-origin']||null,redirect:headers.location||null});}});
    page.on('requestfinished',request=>{const item=trackRequest(request);finishFixture(request,'finished');if(item)terminalScheduleRequests.add(request);if(item)traceResource('browser-request-finished',item);});
    page.on('requestfailed',request=>{const item=trackRequest(request);finishFixture(request,'failed');if(item)terminalScheduleRequests.add(request);if(item){const failure=String(request.failure()?.errorText||'').slice(0,400);failedScheduleRequests.set(request,failure);traceResource('browser-request-failed',{...item,failure});}});
    page.on('framenavigated',frame=>{if(frame===page.mainFrame()){documentEpoch++;traceResource('document-navigation',{url:frame.url()});}});
    page.on('domcontentloaded',()=>traceResource('document-domcontentloaded',{url:page.url()}));
    page.on('console',message=>{const value=message.text();if(value.startsWith(resourceMarker)){try{traceResource('window-event',JSON.parse(value.slice(resourceMarker.length)));}catch{traceResource('diagnostic-decode-failed');}}});
    page.on('pageerror', error => {errors.push(error.message);traceResource('pageerror',{message:error.message.slice(0,400),stack:String(error.stack||'').slice(0,1200),url:page.url()});});
    const traceApiBoundary=boundary=>{
      if(!traceApiStale)return;
      resourcePhase=boundary;
      traceResource('api-stale-boundary',{boundary,pendingAResource:[...tracedRequests].some(([request,item])=>
        item.path==='/api/fixtures'&&!terminalScheduleRequests.has(request))});
    };
    async function settlePrimaryFixtureBeforeReload(){
      const epoch=documentEpoch,counts={reads,writes};
      await observeFixtureControl((async()=>{
        const before=await page.evaluate(()=>{
          globalThis.qaFixtureBarrierHelper=undefined;
          return {preferences:clonePreferences(userPreferences),receipt:pendingPreferenceIntent(serverPersistence.user.id),
            account:serverSyncClient.accountSnapshot().accountId,generation:serverSyncClient.accountSnapshot().generation,baseline:serverStateBaseline.updatedAt};
        });
        while(true){
          const phase=await page.evaluate(async()=>{
            const timerState=()=>liveFixtureMountTimer===null?'unset':Number.isSafeInteger(liveFixtureMountTimer)&&liveFixtureMountTimer>=0?'scheduled':'invalid';
            let helperAwaited=false,ownerAwaited=false;
            if(timerState()==='unset'){
              const loading=feedScoreUiLoading;helperAwaited=Boolean(loading);if(loading)await loading;globalThis.qaFixtureBarrierHelper=loading;
              const owner=liveFixtureRefresh;ownerAwaited=Boolean(owner);if(owner)await owner;
            }
            return {timer:timerState(),ownerPending:Boolean(liveFixtureRefresh),helperAwaited,ownerAwaited};
          });
          traceResource('legacy-fixture-completion-phase',phase);
          assert.notEqual(phase.timer,'invalid','live fixture timer must be a typed browser handle or null');
          if(phase.timer==='scheduled'){
            await page.waitForFunction(()=>liveFixtureMountTimer===null||!Number.isSafeInteger(liveFixtureMountTimer)||liveFixtureMountTimer<0,null,{timeout:8000});
            continue;
          }
          if(phase.ownerPending)continue;
          const requests=[...tracedRequests].filter(([,item])=>item.path==='/api/fixtures'&&item.startedEpoch===epoch);
          const outcomes=await Promise.all(requests.map(([request])=>fixtureTerminals.get(request).promise));
          for(const outcome of outcomes)assert.equal(outcome.kind,'finished','fixture read failed or was cancelled before reload');
          const after=await page.evaluate(before=>({unchanged:PROFILE_STORAGE.preferenceBaseMatches({basePreferences:before.preferences},userPreferences),
            receipt:pendingPreferenceIntent(serverPersistence.user.id),account:serverSyncClient.accountSnapshot().accountId,
            generation:serverSyncClient.accountSnapshot().generation,baseline:serverStateBaseline.updatedAt,
            liveRefreshPending:Boolean(liveFixtureRefresh),liveMountScheduled:liveFixtureMountTimer!==null,
            timerValid:liveFixtureMountTimer===null||(Number.isSafeInteger(liveFixtureMountTimer)&&liveFixtureMountTimer>=0),
            helperMatched:feedScoreUiLoading===globalThis.qaFixtureBarrierHelper}),before);
          assert.equal(after.unchanged,true,'fixture completion preserves projected choices');
          for(const key of ['receipt','account','generation','baseline'])assert.deepEqual(after[key],before[key],'fixture completion preserves '+key);
          assert.equal(after.timerValid,true,'live fixture timer changed to an invalid handle');
          let pending=false;
          for(const [request,item] of tracedRequests)if(item.path==='/api/fixtures'&&item.startedEpoch===epoch){
            const result=fixtureTerminals.get(request).result;
            assert.notEqual(result?.kind,'failed','new fixture work failed or was cancelled before reload');
            if(result?.kind!=='finished')pending=true;
          }
          assert.equal(documentEpoch,epoch,'fixture completion cannot navigate');assert.deepEqual({reads,writes},counts,'fixture completion cannot issue account operations');
          if(after.liveMountScheduled||after.liveRefreshPending||pending||!after.helperMatched)continue;
          assert.equal(after.helperMatched,true,'current fixture helper was not successfully awaited');
          assert.equal(after.liveRefreshPending,false,'a new live fixture owner remains active');
          assert.equal(after.liveMountScheduled,false,'scheduled live fixture work remains before reload');
          traceResource('legacy-fixture-work-complete',{requests:requests.length,ownerPending:false,scheduled:false,choicesUnchanged:true,receiptUnchanged:true});
          return;
        }
      })(),'existing fixture owner and terminal completion');
    }
    page.setDefaultTimeout(15000);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
    if(helperRaceProbe)await page.waitForFunction(()=>typeof qaReleaseStartupSetup==='function');
    row = await page.evaluate(actualApi => {
      const p = clonePreferences(userPreferences); p.onboardingComplete = true;
      if (actualApi) {
        p.pilotMeasurement = { enabled: false, participationStartedAt: null };
        p.followFirst.notifications = { ...p.followFirst.notifications, enabled: false, sportingRemindersEnabled: false,
          autoRemindersEnabled: false, chatAlertsEnabled: false, liveRatingsEnabled: false, socialAlertsEnabled: false, userChoice: false };
        setBackgroundNotificationPreference(p, false);
      }
      savePreferences(p); writeStorage(STORAGE_KEYS.selectorReleaseAcknowledgement, SELECTOR_TAXONOMY.version);
      closeSelectorOptInPrompt();
      return { ...currentServerStatePayload(), updatedAt: '2026-10-23T01:00:00Z' };
    }, Boolean(actualApi));
    if(helperRaceProbe){
      await page.evaluate(()=>{closeSettings();openSettings({section:'account'});});
      await page.locator('#accountEmail').fill('disposable@example.invalid');
      await page.locator('#accountPassword').fill('test-only-password');
      const before=await page.evaluate(()=>{
        globalThis.qaStartupForm=document.getElementById('accountSignInForm');
        globalThis.qaStartupEmail=document.getElementById('accountEmail');
        globalThis.qaStartupPassword=document.getElementById('accountPassword');
        return {preferences:clonePreferences(userPreferences),generation:serverSyncClient.accountSnapshot().generation};
      });
      await page.evaluate(()=>qaReleaseStartupSetup());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const retained=await page.evaluate(before=>({
        form:qaStartupForm===document.getElementById('accountSignInForm'),
        email:qaStartupEmail===document.getElementById('accountEmail'),
        password:qaStartupPassword===document.getElementById('accountPassword'),
        focused:document.activeElement===qaStartupPassword,
        valid:qaStartupEmail.validity.valid&&qaStartupPassword.validity.valid,
        account:settingsSection==='account'&&!settingsFirstRun,
        choices:PROFILE_STORAGE.preferenceBaseMatches({basePreferences:before.preferences},userPreferences),
        generation:serverSyncClient.accountSnapshot().generation===before.generation,
      }),before);
      assert.deepEqual(retained,{form:true,email:true,password:true,focused:true,valid:true,account:true,choices:true,generation:true},'Pending first-run setup must preserve the native Account form and choices');
      console.log(JSON.stringify({phase:'pending-first-run-form-retention',scenario,engine:engineName,retained}));
      await page.evaluate(()=>{closeSettings();openSettings({firstRun:true});});
      assert.deepEqual(await page.evaluate(()=>({firstRun:settingsFirstRun,section:settingsSection,open:document.getElementById('settingsModal').classList.contains('show')})),
        {firstRun:true,section:'startup',open:true},'Explicit first-run setup remains available');
    }
    if (actualApi) { actualApi.seed(row); row = actualApi.state(); }
    holdHelper=helperRaceProbe;
    traceApiBoundary('setup-before-controlled-reload');
    await page.reload({ waitUntil: 'domcontentloaded' });
    if(traceApiStale)resourcePhase='setup-after-controlled-reload';
    await page.waitForFunction(() => !startupCoordinator.isHydrating());
    await page.locator('#startupLaunch').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      globalThis.qaSignInTrace=[];
      const forms=new WeakMap();let nextForm=0;
      const snapshot=event=>{
        const form=document.getElementById('accountSignInForm');
        if(form&&!forms.has(form))forms.set(form,++nextForm);
        const email=document.getElementById('accountEmail'),password=document.getElementById('accountPassword');
        qaSignInTrace.push({event,form:form?forms.get(form):null,emailPresent:Boolean(email?.value),
          passwordPresent:Boolean(password?.value),emailValid:email?.validity.valid??null,
          passwordValid:password?.validity.valid??null,state:serverPersistence.state});
      };
      for(const type of ['input','change','invalid','click','submit'])document.addEventListener(type,event=>{
        if(event.target.closest?.('#accountSignInForm'))snapshot(type+':'+(event.target.id||event.target.tagName));
      },true);
      const render=renderAccountSettings;
      renderAccountSettings=function(...args){snapshot('before-render');const result=render(...args);snapshot('after-render');return result;};
      closeSettings();openSettings({section:'account'});snapshot('opened');
    });
    await page.locator('#accountEmail').fill('disposable@example.invalid');
    await page.locator('#accountPassword').fill('test-only-password');
    if(helperRaceProbe){
      await page.evaluate(()=>{globalThis.qaSignInForm=document.getElementById('accountSignInForm');openFirstRunSettingsAfterFeedAlignment();void ensureAccountIndicator();});
      let helperTimer;
      try{await Promise.race([helperRequest,new Promise((_,reject)=>{helperTimer=setTimeout(()=>reject(new Error('Deferred Account helper request was not observed')),8000);})]);}
      finally{clearTimeout(helperTimer);}
      holdHelper=false;
      for(const route of heldHelpers)await route.continue();
      await page.evaluate(()=>ensureAccountIndicator());
      // The exact filled form used by the following native submit must survive
      // both deferred owners, including an already-completed setup callback.
      await page.evaluate(()=>qaReleaseStartupSetup());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const retained=await page.evaluate(()=>({sameForm:qaSignInForm===document.getElementById('accountSignInForm'),
        passwordFocused:document.activeElement===document.getElementById('accountPassword'),
        emailValid:document.getElementById('accountEmail').validity.valid,passwordValid:document.getElementById('accountPassword').validity.valid}));
      console.log(JSON.stringify({phase:'held-helper-form-retention',scenario,engine:engineName,retained}));
      assert.deepEqual(retained,{sameForm:true,passwordFocused:true,emailValid:true,passwordValid:true},'helper mount must retain the actual filled form and focus');
    }
    await page.locator('#accountSignInForm button[type="submit"]').click();
    if(helperRaceProbe){
      const trace=await page.evaluate(()=>qaSignInTrace);
      console.log(JSON.stringify({phase:'held-helper-sign-in-probe',scenario,engine:engineName,trace}));
      assert.equal(trace.filter(event=>event.event==='submit:accountSignInForm').length,1,'a filled form must submit even when its deferred helper finishes before the click');
    }
    await page.waitForFunction(() => serverPersistence.state === 'signedIn').catch(async error=>{
      console.error(JSON.stringify({phase:'initial-sign-in',scenario,engine:engineName,reads,writes,refreshes,errors,
        state:await page.evaluate(()=>({state:serverPersistence.state,message:serverPersistence.message,
          hasSession:serverSyncClient.accountSnapshot().hasSession,pending:Boolean(pendingPreferenceIntent(serverPersistence.user?.id)),trace:qaSignInTrace}))}));
      throw error;
    });
    await page.waitForFunction(() => Boolean(accountIndicatorController));
    await page.waitForFunction(() => nothingscoreViewerScope?.owner === serverPersistence.user?.id);
    await page.waitForTimeout(1200); // Drain optional sign-in/profile/Follow effects before isolating resume.
    await page.evaluate(() => serverSyncSequence);
    await page.evaluate(() => {
      const original = setServerPersistence;
      globalThis.qaSyncStates = [];
      setServerPersistence = patch => { qaSyncStates.push(patch.state); return original(patch); };
    });
    if (scenario.startsWith('receipt-base-')) {
      const participant='team:football:australian-championship:11255',other='team:football:epl:2';
      const settleFixtureWork=async(boundary,readiness)=>{
        resourcePhase=boundary;
        const before=await page.evaluate(()=>({preferences:clonePreferences(userPreferences),receipt:pendingPreferenceIntent(serverPersistence.user.id),
          owner:serverSyncClient.accountSnapshot().accountId,generation:serverSyncClient.accountSnapshot().generation,baseline:serverStateBaseline.updatedAt}));
        const settled=await page.evaluate(async({before,readiness})=>{
          if(readiness)await ensureFeedSourceReadiness(userPreferences);
          const work=[...followedScheduleLoads.entries()];
          const results=await Promise.allSettled(work.map(([,promise])=>promise));
          return {codes:work.map(([code])=>code),statuses:results.map(result=>result.status),pending:[...followedScheduleLoads.keys()],
            unchanged:PROFILE_STORAGE.preferenceBaseMatches({basePreferences:before.preferences},userPreferences),receipt:pendingPreferenceIntent(serverPersistence.user.id),
            owner:serverSyncClient.accountSnapshot().accountId,generation:serverSyncClient.accountSnapshot().generation,baseline:serverStateBaseline.updatedAt};
        },{before,readiness});
        assert.equal(settled.unchanged,true,boundary+': fixture settlement cannot change account choices');
        for(const key of ['receipt','owner','generation','baseline'])assert.deepEqual(settled[key],before[key],boundary+': fixture settlement preserves '+key);
        assert(settled.statuses.every(status=>status==='fulfilled'),boundary+': actual fixture tasks must finish');
        assert.deepEqual(settled.pending,[],boundary+': no existing fixture task may cross the boundary');
        traceResource('fixture-work-settled',{boundary,codes:settled.codes,pending:settled.pending,readiness});
      };
      resourcePhase='baseline-follow-edit';cancelControlArmed=cancelControl;

      // Establish an ordinary saved baseline, then use the actual deliberate writer.
      await page.evaluate(participant=>{
        const p=clonePreferences(userPreferences);
        p.followedSports=[];p.selectedSelectorEntityIds=[];
        p.preferenceGraph=PREFERENCE_SYSTEM.createPreferenceGraph({profileId:activeProfileBundle.profile.id});
        p.preferenceGraph=PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph,participant,'follow');
        p.preferenceGraph=PREFERENCE_SYSTEM.quickAddDomain(p.preferenceGraph,'sport:football','template:like');
        p.followBrowse={sportId:'sport:football',section:'teams-players',page:0};p.feedCompact=false;
        if(!savePreferences(p,{deferFollowEffects:true}))throw Error('Baseline fixture rejected');
        clearTimeout(serverSyncTimer);
      },participant);
      resourcePhase='baseline-sync';
      await page.evaluate(()=>syncCurrentServerState());
      if(cancelControl){
        let observerTimer;
        try{await Promise.race([scheduleBodyHeld,new Promise((_,reject)=>{observerTimer=setTimeout(()=>reject(Error('Held schedule body not observed')),8000);})]);}
        finally{clearTimeout(observerTimer);}
      }else await settleFixtureWork('baseline-fixtures-settled',true);
      resourcePhase='local-owned-follow-edit';
      const base=clone(actualApi.state());
      const original=await page.evaluate(({participant,cricket})=>{
        let p=clonePreferences(userPreferences);
        p.preferenceGraph=PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph,participant,'unfollow');
        p.preferenceGraph=PREFERENCE_SYSTEM.quickAddDomain(p.preferenceGraph,'sport:football','template:casual');
        p.followBrowse={sportId:'sport:cricket',section:'teams-players',page:0};p.feedCompact=true;
        if(cricket)p=NOTHINGSPORTS_CRICKET_COVERAGE.setFormatFollow(p,'team:cricket:australia','Tests',true);
        if(!savePreferences(p,{deliberate:true,deferFollowEffects:true}))throw Error('Owned local edit rejected');
        clearTimeout(serverSyncTimer);
        return pendingPreferenceIntent(serverPersistence.user.id);
      },{participant,cricket:scenario==='receipt-base-cricket'});
      const remote=clone(base);
      remote.preferences.followBrowse={sportId:'sport:tennis',section:'teams-players',page:0};
      remote.preferences.preferenceGraph.entityFollows.push({participantId:other,followLevel:'follow'});
      remote.preferences.preferenceGraph.domainPreferences.push(require('../config/preference-system').expandTemplate('remote-B','sport:cricket','template:froth',{enabled:false}));
      if(scenario==='receipt-base-overlap')remote.preferences.preferenceGraph.entityFollows.find(row=>row.participantId===participant).followLevel='priority';
      const changed=await actualApi.handle({method:'PUT',url:'/api/user-state',headers:{},body:{patch:sync.createPatch(base,remote,{baseUpdatedAt:base.updatedAt})}});
      assert.equal(changed.status,200);row=actualApi.state();const savedRemote=clone(row),beforeWrites=writes;
      // Hold the real helper response. Offline suppresses its existing automatic
      // recovery only during this explicit mounted manual-retry scenario.
      holdHelper=true;
      await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:false}));
      if(cancelControl)assert(await page.evaluate(()=>followedScheduleLoads.has('sport:football')),'cancellation control requires actual pending fixture work');
      else await settleFixtureWork('pre-reload-fixtures-settled',false);
      resourcePhase='persisted-restart';traceResource('controlled-reload');
      if(cancelControl){
        const pending=[...tracedRequests].filter(([request,item])=>item.path==='/data/follow-schedule/football.json'&&item.startedEpoch===documentEpoch&&!terminalScheduleRequests.has(request));
        assert.equal(pending.length,1,'control must identify exactly one pending old-document Football request');
        controlBrowserRequest=pending[0][0];
        const held=heldScheduleResponse,oldEpoch=documentEpoch;
        assert(held&&!held.req.aborted&&!held.res.destroyed&&!held.res.writableEnded&&!held.res.writableFinished,
          'exact held HTTP stream must still be live before reload');
        assert.equal(held.bytesSent,1);assert(held.data.length>held.bytesSent);
        assert.equal(new URL(controlBrowserRequest.url()).pathname,held.req.url);
        let terminalTimer;
        try{
          const observationDeadline=new Promise((_,reject)=>{
            terminalTimer=setTimeout(()=>reject(Error('Navigation and held HTTP interruption exceeded deadline')),8000);
          });
          const [,observed]=await Promise.race([
            Promise.all([page.reload({waitUntil:'domcontentloaded'}),held.terminal]),observationDeadline]);
          assertHeldScheduleInterruption(held,observed);
          assert(documentEpoch>oldEpoch,'control must navigate to a new document');
          traceResource('control-held-http-interrupted',{requestAborted:observed.requestAborted,responseFinished:observed.responseFinished,oldEpoch,newEpoch:documentEpoch});
        }finally{clearTimeout(terminalTimer);releaseScheduleBody();}
      }else await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>serverPersistence.state==='error'&&Boolean(pendingPreferenceIntent(serverPersistence.user?.id)));
      if(cancelControl)assert.deepEqual(await page.evaluate(()=>({user:serverPersistence.user?.id,account:serverSyncClient.accountSnapshot().accountId})),
        {user:owner,account:owner},'new document must retain the authenticated account owner');
      await page.locator('#startupLaunch').waitFor({state:'hidden'});
      const restored=await page.evaluate(()=>({receipt:pendingPreferenceIntent(serverPersistence.user.id),baseline:serverStateBaseline.updatedAt,
        compatible:PROFILE_STORAGE.preferenceBaseMatches(pendingPreferenceIntent(serverPersistence.user.id),serverStateBaseline.state.preferences)}));
      assert.deepEqual(restored.receipt,original,'persisted restart retains exact owned receipt');
      assert.equal(restored.baseline,row.updatedAt);assert.equal(restored.compatible,false);
      assert.equal(writes,beforeWrites,'pre-helper bootstrap holds without saving');
      let helperTimer;
      try{await Promise.race([helperRequest,new Promise((_,reject)=>{helperTimer=setTimeout(()=>reject(Error('Restart helper request not observed')),8000);})]);}
      finally{clearTimeout(helperTimer);}
      holdHelper=false;for(const route of heldHelpers.splice(0))await route.continue();
      await page.evaluate(()=>ensureAccountIndicator());
      assert.deepEqual(await page.evaluate(()=>pendingPreferenceIntent(serverPersistence.user.id)),original,'helper mount cannot rewrite pending base');
      // Startup may show Tune 250ms after recording promptedAt, independently
      // of Account button readiness. Handle its visible overlay at action time.
      // Native backdrop dismissal closes it without the Not now preference edit.
      const tuneModal=page.locator('#tunePromptModal');
      await page.addLocatorHandler(tuneModal,async modal=>{
        const before=await page.evaluate(()=>({preferences:clonePreferences(userPreferences),receipt:pendingPreferenceIntent(serverPersistence.user.id)}));
        assert(await modal.evaluate(element=>{const rect=element.getBoundingClientRect();return document.elementFromPoint(rect.left+4,rect.top+4)===element;}),'native dismiss point must hit the visible Tune backdrop');
        await modal.click({position:{x:4,y:4}});
        await modal.waitFor({state:'hidden'});
        const after=await page.evaluate(before=>({receipt:pendingPreferenceIntent(serverPersistence.user.id),
          unchanged:PROFILE_STORAGE.preferenceBaseMatches({basePreferences:before.preferences},userPreferences)}),before);
        assert.equal(after.unchanged,true,'backdrop dismissal cannot change projected choices');
        assert.deepEqual(after.receipt,before.receipt,'backdrop dismissal cannot change the owned receipt');
        chronology.push({phase:'native-tune-backdrop-dismissal',choicesUnchanged:true,receiptUnchanged:true});
        console.log(JSON.stringify({phase:'native-tune-backdrop-dismissal',scenario,engine:engineName,choicesUnchanged:true,receiptUnchanged:true}));
      },{times:1});
      try{
        await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});openSettings({section:'account'});});
        const selectorSkip=page.locator('#skipSelectorOptInBtn');if(await selectorSkip.isVisible())await selectorSkip.click();
        await page.waitForFunction(()=>!document.getElementById('syncAccountNowBtn')?.disabled);
        resourcePhase='manual-sync';
        await page.locator('#syncAccountNowBtn').click();
      }finally{await page.removeLocatorHandler(tuneModal);}
      await page.evaluate(()=>serverSyncSequence.catch(()=>{}));
      const after=await page.evaluate(()=>({state:serverPersistence.state,receipt:pendingPreferenceIntent(serverPersistence.user.id),preferences:clonePreferences(userPreferences)}));
      if(scenario==='receipt-base-overlap'){
        assert.equal(after.state,'error');assert.deepEqual(after.receipt,original);
        assert.equal(writes,beforeWrites);assert.deepEqual(actualApi.state(),savedRemote,'overlap makes no server change');
        assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(),true);
      }else{
        assert.equal(after.state,'signedIn');assert.equal(after.receipt,null);assert.equal(writes,beforeWrites+1);
        const saved=actualApi.state().preferences;
        for(const preferences of [saved,after.preferences]){
          assert.equal(preferences.preferenceGraph.entityFollows.find(row=>row.participantId===participant).followLevel,'unfollow');
          assert(preferences.preferenceGraph.entityFollows.some(row=>row.participantId===other&&row.followLevel==='follow'));
          assert.equal(preferences.preferenceGraph.domainPreferences.find(row=>row.sportDomainId==='sport:football').templateId,'template:casual');
          assert(preferences.preferenceGraph.domainPreferences.some(row=>row.sportDomainId==='sport:cricket'&&row.templateId==='template:froth'));
          assert.equal(preferences.followFirst.notifications.enabled,false);
          if(scenario==='receipt-base-cricket'){
            const cricket=preferences.preferenceGraph.entityFollows.find(row=>row.participantId==='team:cricket:australia');
            assert.equal(cricket.followLevel,'follow');assert.deepEqual(cricket.cricketFormats,['Tests']);
          }
        }
        assert.equal(saved.followBrowse.sportId,'sport:tennis');assert.equal(saved.feedCompact,false);
        assert.equal(after.preferences.followBrowse.sportId,'sport:cricket');assert.equal(after.preferences.feedCompact,true);
      }
      const finalCounts={reads,writes};
      await settleFixtureWork('final-fixtures-settled',true);
      assert.deepEqual({reads,writes},finalCounts,'fixture settlement cannot issue account state reads or saves');
      if(!cancelControl)assert.deepEqual(resourceTrace.filter(item=>item.event==='browser-request-failed'&&/cancel|abort/i.test(item.failure)),[],
        'settled restart test must not cancel unrelated schedule work');
      chronology.push({phase:'persisted-base-manual-retry',scenario,receiptPreservedBeforeACK:true,writes:writes-beforeWrites,state:after.state});
    } else if (actualApi) {
      const participant = 'team:football:australian-championship:11255';
      const snapshot = target => target.evaluate(() => {
        const receipt = pendingPreferenceIntent(serverPersistence.user?.id), life = serverSyncClient.accountSnapshot();
        return { state: serverPersistence.state, message: serverPersistence.message, pending: Boolean(receipt),
          ownerMatches: life.accountId === serverPersistence.user?.id, generation: life.generation,
          receiptBase: receipt?.baseUpdatedAt, baseline: serverStateBaseline?.updatedAt,
          follows: userPreferences.preferenceGraph.entityFollows.map(({ participantId, followLevel }) => ({ participantId, followLevel })) };
      });
      const edit = async level => page.evaluate(level => {
        const p = clonePreferences(userPreferences);
        p.preferenceGraph = PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph, 'team:football:australian-championship:11255', level);
        if (!savePreferences(p, { deliberate: true, deferFollowEffects: true })) throw new Error('Local edit rejected');
      }, level);
      if(fixtureControl){fixtureControlArmed=true;traceApiBoundary('live-fixture-control-armed');}
      await edit('follow');
      await page.evaluate(() => syncCurrentServerState());
      // Let the first Follow's fixture reads finish before navigating. This is
      // before B exists; A still does no pre-removal account reconciliation.
      await page.waitForTimeout(600);
      if(fixtureControl){
        await observeFixtureControl(fixtureRequestHeld,'actual fixture request');
        const bound=await page.evaluate(()=>{globalThis.qaLiveFixtureControlOwner=liveFixtureRefresh;return Boolean(qaLiveFixtureControlOwner);});
        assert.equal(bound,true,'real held request must have its existing live fixture owner');
      }
      const fixtureOwnerFacts=await page.evaluate(async trace => {
        await Promise.allSettled([...followedScheduleLoads.values()]);
        if (followFeedRefreshInFlight) await followFeedRefreshInFlight;
        if(trace)return {liveRefreshPending:Boolean(liveFixtureRefresh),liveMountScheduled:liveFixtureMountTimer!==null,
          followedSchedulePending:followedScheduleLoads.size>0,followRebuildPending:Boolean(followFeedRefreshInFlight),
          liveControlOwnerMatches:globalThis.qaLiveFixtureControlOwner?liveFixtureRefresh===qaLiveFixtureControlOwner:null};
      },traceApiStale);
      traceApiBoundary('legacy-before-controlled-reload');
      if(traceApiStale)traceResource('fixture-owner-facts',{context:'A',...fixtureOwnerFacts});
      if(fixtureControl){
        const held=heldFixtureResponse,oldEpoch=documentEpoch,counts={reads,writes};
        traceResource('control-fixture-before-reload',{requestAborted:held?.req.aborted??null,headersSent:held?.res.headersSent??null,...fixtureOwnerFacts});
        assertFixtureControlPending(held,fixtureOwnerFacts);
        assert.equal(fixtureOwnerFacts.liveControlOwnerMatches,true,'the original barrier must retain the exact owner bound to the held request');
        fixtureControlOriginalPending=fixtureOwnerFacts.liveRefreshPending&&fixtureOwnerFacts.liveControlOwnerMatches;
        const pending=[...tracedRequests].filter(([request,item])=>item.path==='/api/fixtures'&&item.startedEpoch===oldEpoch&&!terminalScheduleRequests.has(request));
        assert.equal(pending.length,1,'control requires exactly one pending primary fixture request');
        const request=pending[0][0],u=new URL(request.url());assert.equal(held.req.url,u.pathname+u.search);
        const before=await page.evaluate(()=>{
          return {preferences:clonePreferences(userPreferences),receipt:pendingPreferenceIntent(serverPersistence.user.id),
            account:serverSyncClient.accountSnapshot().accountId,generation:serverSyncClient.accountSnapshot().generation,baseline:serverStateBaseline.updatedAt};
        });
        if(fixtureControl==='original'){
          const [,observed]=await observeFixtureControl(Promise.all([page.reload({waitUntil:'domcontentloaded'}),held.terminal]),'navigation and exact fixture interruption');
          assertHeldScheduleInterruption(held,observed);assert(documentEpoch>oldEpoch);
          traceResource('control-original-fixture-interrupted',{requestAborted:observed.requestAborted,responseFinished:observed.responseFinished,originalBarrierPending:true});
        }else{
          const finished=page.waitForEvent('requestfinished',{predicate:item=>item===request,timeout:8000});
          const owner=page.evaluate(async()=>{await qaLiveFixtureControlOwner;return liveFixtureRefresh===null;});
          releaseFixtureResponse();
          const [ownerFinished,,httpFinished]=await observeFixtureControl(Promise.all([owner,finished,held.complete]),'existing owner and exact fixture completion');
          assert.equal(ownerFinished,true);assert.equal(httpFinished.req,held.req);assert.equal(httpFinished.res,held.res);assert.equal(httpFinished.responseFinished,true);assert.equal(held.requestAborted,false);
          const after=await page.evaluate(before=>({unchanged:PROFILE_STORAGE.preferenceBaseMatches({basePreferences:before.preferences},userPreferences),
            receipt:pendingPreferenceIntent(serverPersistence.user.id),account:serverSyncClient.accountSnapshot().accountId,
            generation:serverSyncClient.accountSnapshot().generation,baseline:serverStateBaseline.updatedAt}),before);
          assert.equal(after.unchanged,true);for(const key of ['receipt','account','generation','baseline'])assert.deepEqual(after[key],before[key]);
          assert.deepEqual({reads,writes},counts,'fixture completion cannot issue account state reads/saves');
          traceResource('control-settled-fixture-complete',{ownerFinished,requestAborted:false,responseFinished:true,choicesUnchanged:true,receiptUnchanged:true});
          await page.reload({waitUntil:'domcontentloaded'});assert(documentEpoch>oldEpoch);
        }
      }else{await settlePrimaryFixtureBeforeReload();await page.reload({ waitUntil: 'domcontentloaded' });}
      if(traceApiStale)resourcePhase='legacy-after-controlled-reload';
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      if(fixtureControl)assert.deepEqual(await page.evaluate(()=>({user:serverPersistence.user?.id,account:serverSyncClient.accountSnapshot().accountId})),{user:owner,account:owner},'reloaded control retains its actual account owner');
      await page.waitForTimeout(1200);
      await page.evaluate(() => serverSyncSequence);
      const beforeB = clone(actualApi.state());
      const other = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      try {
        await other.route('**/*', routeHandler);
        await other.addInitScript(preferences => localStorage.setItem('ns_preferences_v1', JSON.stringify(preferences)), beforeB.preferences);
        const second = await other.newPage();
        if(traceApiStale){
          let secondEpoch=0;
          const requests=new Map();
          const tracked=request=>{
            const u=new URL(request.url());if(!tracedResourcePath(u.pathname))return null;
            if(!requests.has(request))requests.set(request,{id:'browser-B-'+(++resourceSequence),path:u.pathname,origin:u.origin,context:'B',startedEpoch:secondEpoch});
            return requests.get(request);
          };
          second.on('request',request=>{const item=tracked(request);if(item)traceResource('browser-request',item);});
          second.on('response',response=>{const item=tracked(response.request());if(item)traceResource('browser-response',{...item,status:response.status()});});
          second.on('requestfinished',request=>{const item=tracked(request);if(item)traceResource('browser-request-finished',item);});
          second.on('requestfailed',request=>{const item=tracked(request);if(item)traceResource('browser-request-failed',{...item,failure:String(request.failure()?.errorText||'').slice(0,400)});});
          second.on('framenavigated',frame=>{if(frame===second.mainFrame()){secondEpoch++;traceResource('secondary-document-navigation',{context:'B',epoch:secondEpoch});}});
          second.on('pageerror',error=>traceResource('secondary-pageerror',{context:'B',message:error.message.slice(0,400)}));
          resourcePhase='legacy-secondary-startup';
        }
        await second.goto(url, { waitUntil: 'domcontentloaded' });
        await second.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
        await second.locator('#startupLaunch').waitFor({ state: 'hidden' });
        await second.evaluate(() => { closeSettings(); openSettings({ section: 'account' }); });
        await second.locator('#accountEmail').fill('disposable@example.invalid');
        await second.locator('#accountPassword').fill('test-only-password');
        await second.locator('#accountSignInForm button[type="submit"]').click();
        await second.waitForFunction(() => serverPersistence.state === 'signedIn' && Boolean(accountIndicatorController));
        await second.waitForTimeout(1500);
        await second.evaluate(() => serverSyncSequence);
        const changedByB = sync.createPatch(beforeB, actualApi.state()).changes.map(change => change.path.join('.'));
        if (['api-timestamp', 'api-race', 'api-changed'].includes(scenario)) actualApi.mutate(state => {
          state.preferences = clone(beforeB.preferences);
          state.ratings.timestampOnly = 3;
          if (scenario === 'api-changed') state.preferences.theme = state.preferences.theme === 'night' ? 'day' : 'night';
        });
        if (scenario === 'api-race') actualApi.raceOnce(() => actualApi.mutate(state => { state.ratings.timestampOnly = 3; }));
        chronology.push({ phase: 'before-removal', changedByB, A: await snapshot(page), B: await snapshot(second) });
        await page.evaluate(() => openSettings({ section: 'account' }));
        traceApiBoundary('legacy-before-owned-removal');
        await edit('unfollow'); // Deliberately no pre-edit sync on A.
        if (scenario === 'api-changed') {
          await page.evaluate(() => syncCurrentServerState().catch(() => {}));
          const held = await snapshot(page);
          assert.equal(held.state, 'error'); assert.equal(held.pending, true);
          assert.equal(actualApi.state().preferences.preferenceGraph.entityFollows.find(item => item.participantId === participant).followLevel, 'follow');
        } else {
          await page.waitForFunction(() => !document.getElementById('syncAccountNowBtn')?.disabled, null, { timeout: 15000 });
          for (const id of ['dismissTunePromptBtn', 'skipSelectorOptInBtn']) {
            const button = page.locator('#' + id); if (await button.isVisible()) await button.click();
          }
          await page.locator('#syncAccountNowBtn').click();
          await page.waitForFunction(() => serverPersistence.state === 'signedIn' && !pendingPreferenceIntent(serverPersistence.user?.id), null, { timeout: 5000 });
          assert.equal(actualApi.state().preferences.preferenceGraph.entityFollows.find(item => item.participantId === participant).followLevel, 'unfollow');
          if (scenario === 'api-race') assert(actualApi.calls.some(call => call.status === 409), 'real conditional handler must reject the injected stale write');
          await second.clock.install();
          await second.clock.setFixedTime(new Date(Date.now() + 16000));
          await second.evaluate(() => dispatchEvent(new Event('pageshow')));
          await second.waitForFunction(() => userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === 'team:football:australian-championship:11255' && item.followLevel === 'unfollow'));
          assert.equal(actualApi.state().preferences.followFirst.notifications.enabled, false, 'OFF stays OFF across real handler writes');
          assert.equal(actualApi.state().preferences.pilotMeasurement.enabled, false);
        }
        chronology.push({ phase: 'after-removal', A: await snapshot(page), B: await snapshot(second) });
      } catch (error) { chronology.push({ phase: 'failure', A: await snapshot(page) }); throw error; }
      finally {
        console.log(JSON.stringify({ scenario, engine: engineName, chronology }));
        if(traceApiStale){resourcePhase='legacy-secondary-close';traceResource('secondary-context-close-start');}
        await other.close();
        if(traceApiStale){traceResource('secondary-context-close-complete');traceApiBoundary('legacy-before-final-gate');}
      }
    } else if (scenario === 'helper-mount') {
      assert.equal(authSignIns,1,'exactly one native password-sign-in request follows the original form submit');
    } else if (scenario === 'diagnostic') {
      await page.evaluate(() => {
        globalThis.qaDiagnosticCopies=[];
        Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>qaDiagnosticCopies.push(value)}});
      });
      readMode='failure';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state==='error');
      assert.equal(await page.locator('#accountSyncDetail').innerText(),'Sync could not be confirmed. Try Sync now.');
      assert.equal(await page.evaluate(() => qaDiagnosticCopies.length),0);
      const copy=page.getByRole('button',{name:'Copy sync diagnostic',exact:true});
      await copy.click();
      const copied=await page.evaluate(() => qaDiagnosticCopies);
      assert.equal(copied.length,1);const detail=JSON.parse(copied[0]);
      assert.equal(detail.stage,'read');assert.equal(detail.status,503);assert.equal(detail.completed,false);
      assert.equal(detail.shellVersion,testedShellVersion);
      assert(!copied[0].includes(owner));assert(!copied[0].includes('disposable'));
      assert.equal(detail.ownerMatches,null,'a failed read has no verified response owner');
      await page.locator('#signOutAccountBtn').click();
      await page.waitForFunction(() => serverPersistence.state==='signedOut');
      assert.equal(await page.getByRole('button',{name:'Copy sync diagnostic',exact:true}).count(),0);
    } else if (scenario === 'retry-error') {
      readMode = 'failure';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'error');
      const detail = await page.locator('#accountSyncDetail').innerText();
      assert.match(detail, /could not be confirmed|unavailable|retry|saved on this device|local copy/i,
        'failed manual sync must expose its failure rather than only Not synced yet / Last synced');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true, 'failed sync must release its button');
      readMode = 'success';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    } else if (scenario === 'timeout') {
      const localBefore = await page.evaluate(() => JSON.stringify(userPreferences));
      const writeCount = writes, started = Date.now();
      readMode = 'hold';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'syncing');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), false, 'active network request owns the pending state');
      await page.waitForFunction(() => serverPersistence.state === 'error', null, { timeout: 25000 });
      assert(Date.now() - started >= 14000, 'exercise the real 15-second transport deadline, not an injected HTTP error');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true, 'transport timeout releases retry');
      assert.equal(await page.evaluate(() => serverSyncClient.accountSnapshot().hasSession), true);
      assert.equal(await page.evaluate(() => JSON.stringify(userPreferences)), localBefore);
      assert.equal(writes, writeCount, 'timed-out read sends no save');
      readMode = 'success';
      for (const held of heldReads.splice(0)) await held.abort().catch(() => {}); // Already cancelled by the client's deadline.
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    } else if (scenario === 'overlap') {
      await page.clock.install();
      await page.clock.setFixedTime(new Date(Date.now() + 16000));
      const beforeReads = reads, beforeWrites = writes;
      readMode = 'hold';
      await page.evaluate(() => dispatchEvent(new Event('pageshow')));
      await page.waitForFunction(() => serverPersistence.state === 'syncing');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), false);
      await page.evaluate(() => {
        document.getElementById('syncAccountNowBtn').click(); // Disabled UI cannot dispatch another request.
        globalThis.qaQueuedRetry = syncCurrentServerState({ notify: true }); // A manual intent already queued before redraw.
        dispatchEvent(new Event('pageshow')); dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(100);
      assert.equal(reads - beforeReads, 1, 'manual/foreground overlap never starts a concurrent state request');
      assert.equal(heldReads.length, 1);
      readMode = 'success';
      await heldReads.shift().fulfill({ json: statePayload() });
      await page.evaluate(() => qaQueuedRetry);
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      assert.equal(reads - beforeReads, 2, 'one automatic read and the serialised manual retry finish');
      assert.equal(writes, beforeWrites, 'overlap creates no duplicate saves');
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true);
    } else if (scenario === 'pending-receipt') {
      await page.evaluate(() => {
        const p = clonePreferences(userPreferences); p.theme = 'night';
        savePreferences(p, { deliberate: true, deferFollowEffects: true });
      });
      beforeAck = () => page.evaluate(() => {
        const p = clonePreferences(userPreferences); p.theme = 'day';
        savePreferences(p, { deliberate: true, deferFollowEffects: true });
        clearTimeout(serverSyncTimer);
      });
      await page.evaluate(() => syncCurrentServerState({ notify: true }));
      assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true,
        'a completed request with a newer durable receipt must leave a usable retry button');
      assert.match(await page.locator('#accountSyncDetail').innerText(), /waiting|saved on this device|retry/i);
    } else if (scenario === 'offline') {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        dispatchEvent(new Event('offline'));
      });
      readMode = 'failure';
      await page.locator('#syncAccountNowBtn').click();
      await page.waitForFunction(() => serverPersistence.state === 'error');
      assert.equal(await page.evaluate(() => serverSyncClient.accountSnapshot().hasSession), true);
      const before = reads;
      readMode = 'success';
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        dispatchEvent(new Event('online')); dispatchEvent(new Event('pageshow'));
      });
      await page.waitForTimeout(100);
      assert.equal(reads, before, 'hidden app does not start recovery reads');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        dispatchEvent(new Event('online')); dispatchEvent(new Event('pageshow'));
      });
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      assert.equal(reads - before, 1, 'foreground event burst coalesces to one existing sync read');
    } else if (scenario === 'cold-retry') {
      readMode = 'failure';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => serverPersistence.state === 'error' && Boolean(accountIndicatorController));
      await page.locator('#startupLaunch').waitFor({ state: 'hidden' });
      await page.waitForTimeout(300);
      for (const id of ['dismissTunePromptBtn', 'skipSelectorOptInBtn']) {
        const button = page.locator('#' + id); if (await button.isVisible()) await button.click();
      }
      await page.evaluate(() => openSettings({ section: 'account' }));
      await page.getByRole('button', { name: 'Retry account', exact: true }).waitFor();
      assert.equal(await page.locator('#accountEmail').count(), 0, 'a temporary restore failure does not require a new password');
      readMode = 'success';
      await page.getByRole('button', { name: 'Retry account', exact: true }).click();
      await page.waitForFunction(() => serverPersistence.state === 'signedIn');
    } else if (scenario === 'origin-isolation') {
      const oldServer = http.createServer(server.listeners('request')[0]);
      await new Promise(resolve => oldServer.listen(0, '127.0.0.1', resolve));
      const oldUrl = `http://127.0.0.1:${oldServer.address().port}`;
      origins.add(oldUrl);
      const oldPage = await context.newPage(), before = writes;
      const newChoices = await page.evaluate(() => JSON.stringify(userPreferences.preferenceGraph.entityFollows));
      try {
        await oldPage.goto(oldUrl, { waitUntil: 'domcontentloaded' });
        await oldPage.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
        assert.equal(await oldPage.evaluate(() => serverSyncClient.accountSnapshot().hasSession), false, 'another origin cannot inherit the new origin session');
        await oldPage.evaluate(() => {
          const p = clonePreferences(userPreferences); p.onboardingComplete = true;
          p.preferenceGraph = PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph, 'team:football:australian-championship:11255', 'follow');
          savePreferences(p, { deferFollowEffects: true });
        });
        await oldPage.reload({ waitUntil: 'domcontentloaded' });
        await oldPage.waitForFunction(() => typeof userPreferences !== 'undefined' && !startupCoordinator.isHydrating());
        assert(await oldPage.evaluate(() => userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === 'team:football:australian-championship:11255')));
        assert.equal(await page.evaluate(() => JSON.stringify(userPreferences.preferenceGraph.entityFollows)), newChoices, 'old-origin local follows are retained, never silently imported into the new account');
        assert.equal(writes, before, 'origin-isolation check sends no extra account writes');
      } finally { await oldPage.close(); await new Promise(resolve => oldServer.close(resolve)); }
    } else if (scenario === 'follow-roundtrip') {
      const participant = 'team:football:australian-championship:11255';
      const saveFollow = async level => {
        await page.evaluate(({ participant, level }) => {
          const p = clonePreferences(userPreferences);
          p.preferenceGraph = PREFERENCE_SYSTEM.setEntityFollow(p.preferenceGraph, participant, level);
          if (!savePreferences(p, { deliberate: true, deferFollowEffects: true })) throw new Error('Disposable Follow was not saved');
        }, { participant, level });
        await page.evaluate(() => syncCurrentServerState());
      };
      await saveFollow('follow');
      assert(row.preferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'follow'));
      const session = await page.evaluate(() => serverSyncClient.getSession());
      const other = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      try {
        await other.route('**/*', routeHandler);
        await other.addInitScript(session => localStorage.setItem('ns_auth_persistent_session_v1', JSON.stringify(session)), session);
        const second = await other.newPage();
        await second.goto(url, { waitUntil: 'domcontentloaded' });
        await second.waitForFunction(participant => serverPersistence.state === 'signedIn' && userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'follow'), participant);
        const collection = require('../data/football/fixtures/australian-championship.json');
        const fixtures = Object.values(collection).find(value => Array.isArray(value) && value.some(item => item?.id === 'football-australian-championship-2026-22278878'));
        const fixture = fixtures?.find(item => item.id === 'football-australian-championship-2026-22278878');
        assert(fixture, 'retain the exact Canberra v Sutherland fixture, not the different Sydney match');
        const { buildServerFeed } = require('../lib/server-feed-pipeline');
        const feed = () => buildServerFeed({ events: [fixture], userId: owner, userState: row, now: new Date('2026-10-23T04:00:00Z') });
        assert(feed().events.some(item => item.id === fixture.id), 'the saved explicit Canberra follow admits the retained fixture');
        await second.waitForTimeout(1200);
        await second.waitForFunction(() => Boolean(accountIndicatorController));
        await second.evaluate(() => serverSyncSequence);
        await page.evaluate(() => syncCurrentServerState()); // Establish the newer device baseline before a new edit.
        await saveFollow('unfollow');
        assert.equal(feed().events.some(item => item.id === fixture.id), false, 'explicit unfollow excludes the same fixture');
        await second.clock.install();
        await second.clock.setFixedTime(new Date(Date.now() + 16000)); // A later foreground, outside the event-burst throttle.
        await second.evaluate(() => dispatchEvent(new Event('pageshow')));
        await second.waitForFunction(participant => userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'unfollow'), participant, { timeout: 5000 }).catch(async error => {
          console.error(JSON.stringify({ second: await second.evaluate(() => ({ state: serverPersistence, follows: userPreferences.preferenceGraph.entityFollows, baseline: serverStateBaseline?.updatedAt, life: serverSyncClient.accountSnapshot(), hidden:document.hidden })), remote: row.preferences.preferenceGraph.entityFollows, remoteAt:row.updatedAt }));
          throw error;
        });
        await second.reload({ waitUntil: 'domcontentloaded' });
        await second.waitForFunction(participant => serverPersistence.state === 'signedIn' && userPreferences.preferenceGraph.entityFollows.some(item => item.participantId === participant && item.followLevel === 'unfollow'), participant);
      } finally { await other.close(); }
    } else if (['resume', 'terminal', 'refresh-failure'].includes(scenario)) {
      const localBefore = await page.evaluate(() => JSON.stringify(userPreferences));
      if (scenario === 'terminal') refreshMode = 'terminal';
      if (scenario === 'refresh-failure') refreshMode = 'failure';
      await page.clock.install();
      await page.clock.setFixedTime(new Date(Date.now() + 2 * 3600000));
      await page.evaluate(() => dispatchEvent(new Event('pageshow')));
      if (scenario === 'terminal') {
        await page.waitForFunction(() => serverPersistence.state === 'signedOut' && !serverSyncClient.accountSnapshot().hasSession);
        assert.equal(await page.evaluate(() => JSON.stringify(userPreferences)), localBefore, 'terminal auth preserves local choices');
        assert.equal(await page.locator('#accountIndicator .account-awareness-label').innerText(), 'Not signed in');
      } else if (scenario === 'refresh-failure') {
        await page.waitForFunction(() => serverPersistence.state === 'error');
        assert.equal(await page.evaluate(() => serverSyncClient.accountSnapshot().hasSession), true, 'temporary refresh failure retains saved session');
        assert.match(await page.locator('#accountSyncControls').innerText(), /Saved account:/, 'expired saved identity is not labelled signed in');
        assert.equal(await page.locator('#syncAccountNowBtn').isEnabled(), true);
        refreshMode = 'success';
        await page.locator('#syncAccountNowBtn').click();
        await page.waitForFunction(() => serverPersistence.state === 'signedIn');
      } else await page.waitForFunction(() => serverSyncClient.accountSnapshot().expiresAt > Date.now()).catch(async error => {
        console.error({ scenario, refreshes, expiredSession: await page.evaluate(() => serverSyncClient.accountSnapshot().expiresAt <= Date.now()) });
        throw error;
      });
      assert(refreshes > 0, 'foreground return must refresh an expired access token automatically');
      if (scenario !== 'terminal') await page.waitForFunction(() => document.querySelector('#accountIndicator [data-account-status]')?.dataset.accountStatus === 'signedIn');
    } else throw new Error('Unknown recovery scenario ' + scenario);
    if(traceApiStale){
      const finalFacts=await page.evaluate(()=>({statuses:globalThis.qaSyncStates||[],liveRefreshPending:Boolean(liveFixtureRefresh),
        liveMountScheduled:liveFixtureMountTimer!==null,followedSchedulePending:followedScheduleLoads.size>0,followRebuildPending:Boolean(followFeedRefreshInFlight)}));
      statuses.push(...finalFacts.statuses);delete finalFacts.statuses;
      traceResource('fixture-owner-facts',{context:'A',boundary:'final-existing-evaluation',...finalFacts});
    }else statuses.push(...await page.evaluate(() => globalThis.qaSyncStates || []));
    if(cancelControl){
      const failure=failedScheduleRequests.get(controlBrowserRequest);
      if(failure!==undefined)assert.match(failure,/cancel|abort/i,'browser failure, when emitted, must describe cancellation');
      traceResource('control-browser-failure-observation',{emitted:failure!==undefined,failure:failure??null});
    }
    resourcePhase='final-assertion';
    if(traceResources){console.log(JSON.stringify({phase:'schedule-resource-lifetime',scenario,engine:engineName,cancellationControl:cancelControl,fixtureControl,fixtureControlOriginalPending,resourceTraceDropped,
      blockedOrigins:[...new Set(blocked)],uncaughtErrors:errors,trace:resourceTrace}));resourceTraceReported=true;}
    if(traceResources)assert.equal(resourceTraceDropped,0,'schedule evidence must be complete before acceptance');
    assert.deepEqual(errors, [], 'no uncaught application errors');
    if(fixtureControl==='original')assert.equal(fixtureControlOriginalPending,false,'Original api-stale barrier allowed its actual live fixture request to cross reload');
    console.log(JSON.stringify({ scenario, engine: engineName, passed: true, reads, writes, refreshes, authSignIns, statuses,
      blockedOrigins: [...new Set(blocked)], limits: 'Loopback mocked transport; no hosted or physical iPhone proof' }));
  } finally {
    // Preserve intermediate failure evidence before response/browser cleanup can
    // create terminal events. This observation does not handle the test failure.
    if(traceResources&&!resourceTraceReported)console.log(JSON.stringify({phase:'schedule-resource-lifetime-before-cleanup',scenario,engine:engineName,
      cancellationControl:cancelControl,fixtureControl,fixtureControlOriginalPending,resourceTraceDropped,blockedOrigins:[...new Set(blocked)],uncaughtErrors:errors,trace:resourceTrace}));
    releaseFixtureResponse();releaseScheduleBody(); await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
