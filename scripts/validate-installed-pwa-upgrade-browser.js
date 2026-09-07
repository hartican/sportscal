'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const baselineSha = process.env.PWA_BASELINE_SHA || 'eb1b495';
const keepOpen = process.env.PWA_KEEP_OPEN === '1';
const candidateVersion = JSON.parse(fs.readFileSync(path.join(root,'app-version.json'))).version;
// Serve exact historical Git blobs on demand. Preparing every archived report
// and unused asset took minutes and had no bearing on an installed-page test.
const tree = new Map(execFileSync('git',['ls-tree','-rz',baselineSha],{cwd:root,maxBuffer:16*1024*1024}).toString().split('\0').filter(Boolean).map(line => {
  const split=line.indexOf('\t'); return [line.slice(split+1),line.slice(0,split).split(' ')[2]];
}));
const historical = new Map();
function baselineFile(name){
  if (!tree.has(name)) return null;
  if (historical.has(name)) return historical.get(name);
  let bytes;
  const file=path.join(root,name);
  if(fs.existsSync(file)){
    const current=fs.readFileSync(file);
    const oid=crypto.createHash('sha1').update('blob '+current.length+'\0').update(current).digest('hex');
    if(oid===tree.get(name))bytes=current;
  }
  bytes ||= execFileSync('git',['cat-file','blob',tree.get(name)],{cwd:root,maxBuffer:32*1024*1024});
  historical.set(name,bytes);return bytes;
}
const baselineVersion=baselineFile('index.html').toString().match(/name="app-shell-version" content="(\d+)"/)[1];
let phase='baseline', nextRelease=false, optionalFailure=false, coreFailure=false, networkFailure=false, versionRequests=0;
function candidateFile(name){
  const file=path.join(root,name);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
  let bytes=fs.readFileSync(file);
  if(nextRelease && ['index.html','service-worker.js','app-version.json'].includes(name)){
    bytes=Buffer.from(bytes.toString().replaceAll('v='+candidateVersion,'v='+ (+candidateVersion+1)).replaceAll('v'+candidateVersion,'v'+ (+candidateVersion+1)).replaceAll('"'+candidateVersion+'"','"'+ (+candidateVersion+1)+'"'));
  }
  return bytes;
}
const server=http.createServer((req,res)=>{
  if(networkFailure){req.socket.destroy();return;}
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
  if(name==='app-version.json')versionRequests++;
  if(name.includes('..')){res.writeHead(400);res.end();return;}
  if(phase==='candidate' && ((optionalFailure && name==='assets/identities/events/le-mans-24-hours.png') || (coreFailure && name==='assets/js/app-shell-runtime.js'))){res.writeHead(503);res.end();return;}
  const bytes=phase==='baseline'?baselineFile(name):candidateFile(name);
  if(!bytes){res.writeHead(404);res.end();return;}
  const type=({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'})[path.extname(name)]||'application/octet-stream';
  res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(bytes);
});
(async()=>{
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await (process.env.PWA_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    const page=await context.newPage();
    const navigations=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
    await page.goto(origin+'/?installed-pwa-upgrade=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:90000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof userPreferences!=='undefined' && !startupCoordinator.isHydrating(),null,{timeout:60000});
    const savedSelection=await page.evaluate(()=>{
      const next=clonePreferences(userPreferences);next.feedCompact=true;next.theme='day';next.selectedSelectorEntityIds=['sport:nrl','sport:tennis'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);
      savePreferences(next);
      sessionStorage.setItem('ns_chat_draft_v2:upgrade-test',JSON.stringify({body:'Preserve this unsent draft'}));
      return {sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds};
    });
    assert(savedSelection.selectors.includes('sport:tennis'),'The baseline must actually save the explicit tennis follow');
    if(!keepOpen)await page.close();
    phase='candidate';optionalFailure=true;
    const upgraded=keepOpen?page:await context.newPage();let upgradeNavigations=0;
    upgraded.on('framenavigated',frame=>{if(frame===upgraded.mainFrame())upgradeNavigations++;});
    if(keepOpen)await upgraded.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
    else await upgraded.goto(origin+'/?installed-pwa-upgrade=1',{waitUntil:'domcontentloaded'});
    const firstVersion=await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content');
    if(!keepOpen && +baselineVersion>=238)assert.equal(firstVersion,candidateVersion,'network-first baselines must receive the current first document');
    // Legacy cache-first workers cannot be retroactively changed: require an
    // automatic migration to the real candidate without a second user launch.
    await upgraded.waitForFunction(v=>document.querySelector('meta[name="app-shell-version"]')?.content===v,candidateVersion,{timeout:60000});
    await upgraded.waitForFunction(()=>globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot().workerVersion===document.querySelector('meta[name="app-shell-version"]').content,null,{timeout:45000});
    assert.equal(new URL(upgraded.url()).searchParams.get('installed-pwa-upgrade'),'1');
    await upgraded.waitForFunction(()=>typeof userPreferences!=='undefined');
    assert.equal(await upgraded.evaluate(()=>userPreferences.feedCompact),true,'Saved compact preference must survive legacy migration');
    assert.equal(await upgraded.evaluate(()=>userPreferences.theme),'day','Saved appearance must survive migration');
    const restoredSelection=await upgraded.evaluate(()=>({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds}));
    assert.deepEqual(restoredSelection.selectors,savedSelection.selectors,'Canonical follow selections survive migration');
    // New taxonomy children (e.g. NRLW under NRL) may expand a followed code,
    // but none of its previously included sports may disappear.
    assert(savedSelection.sports.every(sport=>restoredSelection.sports.includes(sport)),'Existing followed sport coverage survives migration');
    if(keepOpen)assert.equal(await upgraded.evaluate(()=>JSON.parse(sessionStorage.getItem('ns_chat_draft_v2:upgrade-test')).body),'Preserve this unsent draft');
    await upgraded.waitForTimeout(3500);assert(upgradeNavigations<=2,'Legacy migration must navigate at most once');
    // The ongoing release exercises an already-open page, rather than another
    // fresh navigation. The old releases above use authentic historical bytes.
    const currentState=await upgraded.evaluate(async()=>{await NOTHINGSPORTS_APP_UPDATE.check({force:true});return NOTHINGSPORTS_APP_UPDATE.snapshot();});
    assert.equal(currentState.phase,'current');
    const before=versionRequests;
    await upgraded.evaluate(()=>{for(let i=0;i<100;i++)window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    await upgraded.waitForTimeout(200);assert(versionRequests-before<=1,'Resume events must coalesce');
    await context.setOffline(true);
    await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.check({force:true}));
    assert.equal(await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.snapshot().phase),'offline');
    // Simulate an unreachable origin at the transport boundary. WebKit's
    // browser-level offline emulation can reject navigation before dispatching
    // a service-worker fetch, which is a different scenario.
    await context.setOffline(false);networkFailure=true;
    await upgraded.reload({waitUntil:'domcontentloaded'});
    assert.equal(await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content'),candidateVersion,'Offline navigation uses the validated current shell');
    networkFailure=false;await context.setOffline(false);
    await upgraded.waitForFunction(()=>typeof NOTHINGSPORTS_APP_UPDATE!=='undefined');
    await upgraded.evaluate(()=>sessionStorage.setItem('ns_chat_draft_v2:upgrade-test',JSON.stringify({body:'Preserve this unsent draft'})));
    nextRelease=true;
    // A missing required runtime must retain the last valid worker.
    coreFailure=true;
    await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.check({force:true}));
    await upgraded.waitForTimeout(2000);
    assert.equal(await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content'),candidateVersion);
    assert.equal(await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.snapshot().workerVersion),candidateVersion);
    coreFailure=false;
    // Resume an existing page after the throttle interval. No reload call.
    await upgraded.waitForTimeout(31000);
    await upgraded.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    try {await upgraded.waitForFunction(v=>document.querySelector('meta[name="app-shell-version"]')?.content===v,String(+candidateVersion+1),{timeout:45000}); } catch(error){
      console.error('Resume diagnostics', await upgraded.evaluate(async()=>({version:document.querySelector('meta[name="app-shell-version"]')?.content,state:NOTHINGSPORTS_APP_UPDATE.snapshot(),focus:document.activeElement?.outerHTML.slice(0,240),ready:document.readyState,hydrating:startupCoordinator.isHydrating(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),cacheKeys:await caches.keys()})));
      throw error;
    }
    assert.equal(await upgraded.evaluate(()=>JSON.parse(sessionStorage.getItem('ns_chat_draft_v2:upgrade-test')).body),'Preserve this unsent draft');
    await upgraded.waitForFunction(()=>typeof userPreferences!=='undefined');
    assert.equal(await upgraded.evaluate(()=>userPreferences.feedCompact),true);
    await upgraded.waitForTimeout(3500);
    assert(upgradeNavigations<=4,'No repeat navigation after resumed update');
    console.log(JSON.stringify({baselineVersion,candidateVersion,firstVersion,keepOpen,legacyAutomaticCatchup:true,upgradeNavigations,preferencesPreserved:true,optionalFailureTolerated:true,requiredFailurePreservesShell:true,offlineFallback:true,resumeUpgrade:true},null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
