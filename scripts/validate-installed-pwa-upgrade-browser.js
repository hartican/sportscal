'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const footballStatusFixture=require('../data/code-inspector/football.json').fixtures.find(event=>event.competitionId==='competition:premier-league-2026-27');
async function assertCachedFootballStatus(page){
  await page.evaluate(async url=>{await loadDeferredScript(url);},candidateMatchCentrePath);
  const status=await page.evaluate(fixture=>{
    const event={...fixture,status:'upcoming',scheduleStatus:'upcoming',statusCheckedAt:null,statusSource:null,timingSource:null};
    return globalThis.NOTHINGSPORTS_CARD_TIMING.presentation(event,new Date(Date.parse(event.startTimeUtc)+30*60000)).status;
  },footballStatusFixture);
  assert.equal(status,'Awaiting match update','the upgraded/offline runtime must execute the current Football status rule');
  const compactObservation=await page.evaluate(()=>{
    const marker='fixture-observations.v1',prior={id:'offline-correction',key:'nrl',status:'completed',homeScore:1,awayScore:0,sourceCheckedAt:'2026-09-24T13:00:00Z'};
    const corrected=NOTHINGSPORTS_FIXTURE_IDENTITY.mergeOverlays([prior],[{...prior,homeScore:2,fixtureObservationSchema:marker,scoreCheckedAt:'2026-09-24T14:00:00Z',statusCheckedAt:'2026-09-24T14:00:00Z'}])[0];
    const unknown=NOTHINGSPORTS_MATCH_CENTRE.compact({...corrected,status:'live',scoreCheckedAt:null,statusCheckedAt:'2026-09-24T15:00:00Z'});
    return {home:corrected.homeScore,away:corrected.awayScore,unknownClock:unknown.checkedAt,unknownStale:unknown.stale};
  });
  assert.deepEqual(compactObservation,{home:2,away:0,unknownClock:null,unknownStale:true},'upgraded/offline shared and deferred modules preserve corrected finals and unknown score freshness');
  const nblStatus=await page.evaluate(()=>globalThis.NOTHINGSPORTS_CARD_TIMING.presentation({competitionId:'competition:nbl',status:'live',startTimeUtc:'2026-10-02T09:30:00Z',statusCheckedAt:'2026-10-02T09:00:00Z'},new Date('2026-10-02T10:00:00Z')).status);
  assert.equal(nblStatus,'Awaiting match update','the upgraded/offline runtime must reject stale NBL live status');
  const tournamentPhase=await page.evaluate(()=>{
    const event={id:'offline-phase-qa',name:'Tournament phase QA',key:'golf',cardType:'golf_tournament',dateOnly:true,date:'2026-10-01',endDate:'2026-10-04',status:'live'};
    const priorTab=activeTab;
    try{
      activeTab='follow';
      const compact=buildCompactCardSummary(event),chip=buildEventTimingStateChip(event);
      activeTab='feed';
      return {compact:compact.querySelector('.event-timing-state')?.textContent,accessible:compact.getAttribute('aria-label'),chip:chip?.textContent,feed:buildFixtureTimingBadge(event).dataset.timingStatus,clock:NOTHINGSPORTS_FEED_CONTROLS.timingState(event),scheduled:NOTHINGSPORTS_CARD_TIMING.tournamentPhase({...event,status:'scheduled'})};
    }finally{activeTab=priorTab;}
  });
  assert.equal(tournamentPhase.compact,'In progress');assert.equal(tournamentPhase.chip,'In progress');assert.match(tournamentPhase.accessible,/Tournament in progress/);
  assert.equal(tournamentPhase.feed,'IN PROGRESS');assert.equal(tournamentPhase.clock,null);assert.equal(tournamentPhase.scheduled,null,'cached dates alone never invent tournament progress');
  const wsl=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/wsl.json')).json();
    const e=code.fixtures.find(f=>f.id.endsWith('portugal'));
    const image=new Image();image.src='/assets/identities/wsl/wave-white.svg';await image.decode();
    const brand=new Image();brand.src='/assets/identities/wsl/brand.png';await brand.decode();
    return {count:code.fixtures.length,coverage:code.coverageStatus,unfollowed:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:25,selectedSelectorEntityIds:['sport:surf']}),followed:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:25,selectedSelectorEntityIds:['sport:wsl']}),precision:e.timePrecision,time:e.time,providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(e),glyph:image.naturalWidth,brand:brand.naturalWidth};
  });
  assert.equal(wsl.count,12);assert.equal(wsl.coverage,'partial');assert(wsl.unfollowed&&wsl.followed&&wsl.glyph>0&&wsl.brand>0);assert.equal(wsl.precision,'date-only');assert.equal(wsl.time,null);assert.deepEqual(wsl.providers,[],'cached WSL windows never invent Australian viewing');
  const sailgp=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/sailgp.json')).json();
    return {coverage:code.coverageStatus,copy:codeInspectorCoverageCopy(code.code?{...code.code,coverageStatus:code.coverageStatus}:code),geneva:code.fixtures.filter(f=>f.id.includes('geneva')).map(f=>({start:f.startTimeUtc,end:f.endTimeUtc,timingCheckedAt:f.timingProvenance?.checkedAt,resultCheckedAt:f.resultSourceCheckedAt})),future:code.fixtures.filter(f=>f.season==='2026'&&/(dubai|abu-dhabi)/.test(f.id)).map(f=>({start:f.startTimeUtc,precision:f.timePrecision})),nextSeason:code.fixtures.filter(f=>f.season==='2027').map(f=>({confirmed:f.participantsConfirmed,entries:f.participantIds||[],providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>o.providerId),start:f.startTimeUtc,precision:f.timePrecision}))};
  });
  assert.equal(sailgp.coverage,'partial');assert.match(sailgp.copy,/Season teams may be listed/);assert.equal(sailgp.geneva.length,2);
  for(const [i,f]of sailgp.geneva.entries()){assert.equal(f.start,`2026-09-${19+i}T13:30:00.000Z`);assert.equal(f.end,`2026-09-${19+i}T15:00:00.000Z`);assert.equal(f.timingCheckedAt,'2026-10-02T16:06:23.274Z');assert.equal(f.resultCheckedAt,'2026-09-21T20:24:10.712468Z');}
  assert.equal(sailgp.future.length,4);assert(sailgp.future.every(f=>!f.start&&f.precision==='tbc'),'cached event envelopes never become invented daily sessions');
  assert.equal(sailgp.nextSeason.length,require('../data/canonical/fiba-women-sailgp-motogp-2026.json').events.filter(e=>e.sportKey==='sailgp'&&e.season==='2027').length);assert(sailgp.nextSeason.every(f=>f.confirmed===false&&!f.entries.length&&!f.providers.length&&!f.start&&f.precision==='tbc'),'upgraded/offline future SailGP keeps unpublished times, entries and rights unresolved');
  const abandoned=await page.evaluate(()=>{
    const event={key:'cricket',status:'abandoned',startTimeUtc:'2026-09-28T04:30:00Z',endTimeUtc:'2026-09-28T09:00:00Z'};
    const now=new Date('2026-09-28T05:00:00Z');
    const prior={...event,status:'completed',statusCheckedAt:'2026-09-30T00:00:00Z'};
    const next={...event,statusCheckedAt:'2026-10-02T00:00:00Z'};
    return {status:NOTHINGSPORTS_CARD_TIMING.presentation(event,now).status,timing:NOTHINGSPORTS_FEED_CONTROLS.timingState(event,now),observation:NOTHINGSPORTS_MATCH_CENTRE.observation(prior,next).status};
  });
  assert.equal(abandoned.status,'ABANDONED');assert.equal(abandoned.timing,null,'upgraded/offline runtime never calls an abandoned match live');
  assert.equal(abandoned.observation,'abandoned','upgraded/offline deferred Match Centre accepts the official abandonment correction');
  const rugby=await page.evaluate(f=>{const normalized=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(f);const oldRatings=ratings;try{ratings={[f.id]:5};return {id:normalized.id,start:normalized.startTimeUtc,scoreCheckedAt:normalized.scoreCheckedAt,rating:getActual('rugby-australia-south-africa-2026-09-27')};}finally{ratings=oldRatings;}},require('./fixtures/rugby-reviewed-provider-pair.json').worldRugby);
  assert.equal(rugby.id,'rugby-australia-south-africa-2026-09-27');assert.equal(rugby.start,'2026-09-27T09:45:00.000Z');assert.equal(rugby.rating,5,'cached runtime reads the old saved Rugby rating');assert.equal(rugby.scoreCheckedAt,require('./fixtures/rugby-reviewed-provider-pair.json').worldRugby.scoreCheckedAt,'cached host timing never refreshes score facts');
  const futureRugby=await page.evaluate(async()=>{
    const d=await(await fetch('/data/code-inspector/rugby-union.json')).json();const id='rugby-australia-new-zealand-2026-10-17',old='fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8';
    const fixtures=d.fixtures.filter(f=>NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(f.id)===id);const f=fixtures[0];
    return {count:fixtures.length,id:f.id,start:f.startTimeUtc,time:f.time,checkedAt:f.timingProvenance?.checkedAt,legacy:NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(old),providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>o.providerId)};
  });
  assert.deepEqual(futureRugby,{count:1,id:'rugby-australia-new-zealand-2026-10-17',start:'2026-10-17T05:00:00.000Z',time:'16:00',checkedAt:'2026-10-02T08:24:46.814Z',legacy:'rugby-australia-new-zealand-2026-10-17',providers:['nine-tv','nine','stan']},'upgraded/offline cached future Bledisloe uses one reviewed identity and original host observation');
  const motoAssets=require('../assets/identities/motogp/asset-manifest.json').assets.map(a=>a.path).concat('assets/identities/motogp/motorcycle-white.svg',require('../assets/identities/wrc/asset-manifest.json').assets.map(a=>a.path),'assets/identities/sailgp/sailing-white.svg');
  const motoOffline=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{const r=await fetch('/'+path);const source=await r.text();return r.ok&&source.includes('<svg')&&!source.includes('<image');})),motoAssets);
  assert(motoOffline.every(Boolean),'every MotoGP and WRC vector must remain available in the installed/offline shell');
  const sailgpIdentity=await page.evaluate(async()=>Promise.all(['light','dark'].map(async theme=>{const image=new Image();image.src='/assets/identities/sailgp/brand-'+theme+'.png';await image.decode();return image.naturalWidth===1670&&image.naturalHeight===335;})));
  assert(sailgpIdentity.every(Boolean),'both complete local SailGP marks decode after upgrade and remain cached offline');
  const tours=await page.evaluate(async()=>Promise.all(['tour-de-france','giro-ditalia','vuelta-a-espana'].map(async slug=>{
    const code=await(await fetch('/data/code-inspector/'+slug+'.json')).json();
    const schedule=await(await fetch('/data/follow-schedule/'+slug+'.json')).json();
    const event=code.fixtures.find(f=>f.season==='2027')||code.fixtures[0],key=event.key;
    const prefs={version:26,selectedSelectorEntityIds:['sport:cycling'],followedSports:['cycling',key]};
    return {slug,count:code.fixtures.length,scheduleCount:schedule.fixtures?.length||schedule.events?.length,coverage:code.coverageStatus,unfollowed:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(event,prefs),followed:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(event,{...prefs,selectedSelectorEntityIds:['sport:'+key]})};
  })));
  assert.deepEqual(tours.map(t=>t.count),[24,21,21]);assert(tours.every(t=>t.coverage==='partial'&&t.unfollowed&&t.followed),'cached Grand Tours require explicit competition consent');
  const tourAssets=require('../assets/identities/cycling/asset-manifest.json').assets;
  const decodedTours=await page.evaluate(async assets=>Promise.all(assets.map(async a=>{
    const r=await fetch('/'+a.path);if(!r.ok)return false;
    if(a.path.endsWith('.svg')){const source=await r.text();if(!source.includes('<svg')||source.includes('<image'))return false;}
    const image=new Image();image.src='/'+a.path;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;
  })),tourAssets);
  assert(decodedTours.every(Boolean),'all 39 verified routes, bicycle fallback and complete Grand Tour marks decode offline');
  const majors=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/golf.json')).json(),rounds=code.fixtures.filter(e=>e.golfMajorCalendar&&e.cardType==='golf_session');
    const future=rounds.filter(e=>e.season==='2027');
    return {rounds:rounds.length,future:future.length,unconfirmed:future.every(e=>!e.time&&e.dateOnly&&!e.startTimeUtc&&!e.participantIds?.length),unfollowed:future.every(e=>!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{})),followed:future.every(e=>!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:26,selectedSelectorEntityIds:['sport:golf']})),providers:future.flatMap(e=>NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(e))};
  });
  assert.equal(majors.rounds,32);assert.equal(majors.future,16);assert(majors.unconfirmed&&majors.unfollowed&&majors.followed);assert.deepEqual(majors.providers,[]);
  const dakar=await page.evaluate(async()=>{const c=await(await fetch('/data/code-inspector/dakar.json')).json(),e=c.fixtures.find(f=>f.season==='2027');return {count:c.fixtures.length,notes:c.scheduleNotes,precision:e.timePrecision,time:e.time,off:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:27,selectedSelectorEntityIds:['sport:motorsport']}),on:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:27,selectedSelectorEntityIds:['sport:dakar']}),providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(e)};});
  assert.equal(dakar.count,28);assert.equal(dakar.notes.length,2);assert(dakar.off&&dakar.on);assert.equal(dakar.precision,'date-only');assert.equal(dakar.time,null);assert.deepEqual(dakar.providers,[]);
  const decodedDakar=await page.evaluate(async assets=>Promise.all(assets.map(async a=>{const r=await fetch('/'+a.path);if(!r.ok)return false;const image=new Image();image.src='/'+a.path;await image.decode();return image.naturalWidth>0;})),require('../assets/identities/dakar/asset-manifest.json').assets);assert(decodedDakar.every(Boolean),'Dakar assets and projections remain available after upgrade and offline');
  const majorAssets=require('../assets/identities/golf/asset-manifest.json').assets;
  const decodedMajors=await page.evaluate(async assets=>Promise.all(assets.map(async a=>{const r=await fetch('/'+a.path);if(!r.ok)return false;const image=new Image();image.src='/'+a.path;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;})),majorAssets);
  assert(decodedMajors.every(Boolean),'used major artwork and complete identity marks decode after upgrade and offline');
  const viewing=await page.evaluate(async()=>{
    const load=async code=>(await(await fetch(`/data/code-inspector/${code}.json`)).json()).fixtures;
    const rugby=await load('rugby-union'),cricket=await load('cricket'),golf=await load('golf');
    const providers=f=>NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>o.providerId);
    const final=rugby.find(f=>f.id==='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be');
    const lpga=['2026068','2026070'].map(id=>golf.find(f=>f.id==='fixture:golf:lpga:'+id));
    return {unknown:providers({key:'rugby',broadcaster:'Stan Sport'}),bledisloe:providers(rugby.find(f=>f.id==='rugby-new-zealand-australia-2026-10-10')),test:providers(cricket.find(f=>f.id==='fixture:cricket:espn:1525659')),final:providers(final),venue:NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(final).venue,
      lpga:lpga.map(f=>({id:f.id,providers:providers(f),options:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>({scope:o.rightsScope,replay:o.replayVerified})),participationCheckedAt:f.participationCheckedAt})),
      unrelatedLpga:providers({key:'golf',competitionId:'competition:lpga-tour',name:'LPGA Tour'})};
  });
  const currentLpga=require('../data/canonical/pga-tour-schedule.json').lpga;
  const expectedLpga=['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070'].map(id=>currentLpga.find(f=>f.id===id)).map(f=>({id:f.id,providers:['kayo','foxtel'],options:[{scope:'competition',replay:false},{scope:'competition',replay:false}],participationCheckedAt:f.participationCheckedAt}));
  assert.deepEqual(viewing,{unknown:[],bledisloe:['nine-tv','nine','stan'],test:['kayo','foxtel'],final:['youtube','stan'],venue:'Scotch College Playing Fields, Swanbourne, Perth',lpga:expectedLpga,unrelatedLpga:[]},'upgraded/offline runtime and cached projections retain honest AU viewing, LPGA token boundaries and original Golf observations');
}

const baselineSha = process.env.PWA_BASELINE_SHA || 'eb1b495';
const keepOpen = process.env.PWA_KEEP_OPEN === '1';
const candidateVersion = JSON.parse(fs.readFileSync(path.join(root,'app-version.json'))).version;
// Serve exact historical Git blobs on demand. Preparing every archived report
// and unused asset took minutes and had no bearing on an installed-page test.
const tree = new Map(execFileSync('git',['ls-tree','-rz',baselineSha],{cwd:root,maxBuffer:16*1024*1024}).toString().split('\0').filter(Boolean).map(line => {
  const split=line.indexOf('\t'); return [line.slice(split+1),line.slice(0,split).split(' ')[2]];
}));
const historical = new Map();
const candidateHeaders=Object.fromEntries((require('../vercel.json').headers.find(rule=>rule.source==='/(.*)')?.headers||[]).map(h=>[h.key,h.value]));
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
const profilePath=html=>html.match(/loadDeferredScript\(["'](config\/athlete-profile-ui\.js\?v=\d+)["']\)/)?.[1];
const baselineProfilePath=profilePath(baselineFile('index.html').toString());
const candidateProfilePath=profilePath(fs.readFileSync(path.join(root,'index.html'),'utf8'));
const matchCentrePath=html=>html.match(/loadDeferredScript\(["'](config\/match-centre\.js\?v=\d+)["']\)/)?.[1];
const baselineMatchCentrePath=matchCentrePath(baselineFile('index.html').toString());
const candidateMatchCentrePath=matchCentrePath(fs.readFileSync(path.join(root,'index.html'),'utf8'));
const launchOptions=process.env.PWA_EXECUTABLE_PATH?{executablePath:process.env.PWA_EXECUTABLE_PATH}:{};
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
  if(phase==='candidate' && ((optionalFailure && name==='assets/identities/events/le-mans-24-hours.png') || (coreFailure && name===(process.env.PWA_REQUIRED_FAILURE_ASSET||'assets/js/app-shell-runtime.js')))){res.writeHead(503);res.end();return;}
  const bytes=phase==='baseline'?baselineFile(name):candidateFile(name);
  if(!bytes){res.writeHead(404);res.end();return;}
  const type=({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'})[path.extname(name)]||'application/octet-stream';
  res.writeHead(200,{...(phase==='candidate'?candidateHeaders:{}),'content-type':type,'cache-control':'no-store'});res.end(bytes);
});
(async()=>{
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await (process.env.PWA_BROWSER==='webkit'?webkit:chromium).launch({headless:true,...launchOptions});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    const page=await context.newPage();
    const pending=new Set(); context.on('request',r=>pending.add(r.url()));context.on('requestfinished',r=>pending.delete(r.url()));context.on('requestfailed',r=>pending.delete(r.url()));
    const navigations=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
    await page.goto(origin+'/?installed-pwa-upgrade=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:90000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof userPreferences!=='undefined' && !startupCoordinator.isHydrating(),null,{timeout:60000});
    const savedSelection=await page.evaluate(()=>{
      const next=clonePreferences(userPreferences);next.feedCompact=true;next.theme='day';next.selectedSelectorEntityIds=['sport:nrl','sport:tennis','sport:f1'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);
      savePreferences(next);
      sessionStorage.setItem('ns_chat_draft_v2:upgrade-test',JSON.stringify({body:'Preserve this unsent draft'}));
      return {sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds};
    });
    assert(savedSelection.selectors.includes('sport:tennis'),'The baseline must actually save the explicit tennis follow');
    if(baselineProfilePath)await page.evaluate(async url=>{const response=await fetch('/'+url);if(!response.ok)throw Error('Baseline profile cache could not be populated');await response.text();},baselineProfilePath);
    if(baselineMatchCentrePath)await page.evaluate(async url=>{const response=await fetch('/'+url);if(!response.ok)throw Error('Baseline Match Centre cache could not be populated');await response.text();},baselineMatchCentrePath);
    if(!keepOpen)await page.close();
    phase='candidate';optionalFailure=true;
    const upgraded=keepOpen?page:await context.newPage();let upgradeNavigations=0;
    const upgradeNavigationLog=[];
    upgraded.on('framenavigated',frame=>{if(frame===upgraded.mainFrame()){upgradeNavigations++;upgradeNavigationLog.push({url:frame.url(),at:Date.now(),nextRelease});}});
    if(keepOpen)await upgraded.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
    else await upgraded.goto(origin+'/?installed-pwa-upgrade=1',{waitUntil:'domcontentloaded'});
    const firstVersion=await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content');
    if(!keepOpen && +baselineVersion>=238)assert.equal(firstVersion,candidateVersion,'network-first baselines must receive the current first document');
    // Legacy cache-first workers cannot be retroactively changed: require an
    // automatic migration to the real candidate without a second user launch.
    try { await upgraded.waitForFunction(v=>document.querySelector('meta[name="app-shell-version"]')?.content===v,candidateVersion,{timeout:60000}); } catch(error) { console.error('Pending requests', [...pending]); console.error('Legacy catch-up diagnostic', await upgraded.evaluate(async()=>({version:document.querySelector('meta[name="app-shell-version"]')?.content,update:globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.scriptURL,waiting:r.waiting?.state,installing:r.installing?.state})),caches:await caches.keys()}))); throw error; }
    try { await upgraded.waitForFunction(()=>globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot().workerVersion===document.querySelector('meta[name="app-shell-version"]').content,null,{timeout:45000}); }
    catch(error){console.error('Pending requests', [...pending]);console.error('Worker upgrade diagnostics',await upgraded.evaluate(async()=>({version:document.querySelector('meta[name="app-shell-version"]')?.content,state:globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),caches:await caches.keys()})));throw error;}

    assert.equal(new URL(upgraded.url()).searchParams.get('installed-pwa-upgrade'),'1');
    const expectedStandings=JSON.parse(JSON.stringify(require('./build-app-shell-runtime').cardStandings().map(({competitionId,snapshotTimeUtc,entries})=>({competitionId,snapshotTimeUtc,entries}))));
    await upgraded.waitForFunction(()=>Array.isArray(globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS));
    assert.deepEqual(await upgraded.evaluate(()=>globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS.map(({competitionId,snapshotTimeUtc,entries})=>({competitionId,snapshotTimeUtc,entries}))),expectedStandings,'cached old runtime cannot conceal current source observations and shared/pending ranks');
    let profileCacheVerified=false;
    if(candidateProfilePath){
      const profile=await upgraded.evaluate(async url=>{const response=await fetch('/'+url);if(!response.ok)throw Error('Candidate profile module unavailable');return response.text();},candidateProfilePath);
      assert.equal(crypto.createHash('sha256').update(profile).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'config/athlete-profile-ui.js'))).digest('hex'),'Previously cached profile must not conceal the upgraded module');
      profileCacheVerified=true;
      await assertCachedFootballStatus(upgraded);
    }
    await upgraded.waitForFunction(()=>typeof userPreferences!=='undefined');
    assert.equal(await upgraded.evaluate(()=>userPreferences.feedCompact),true,'Saved compact preference must survive legacy migration');
    assert.equal(await upgraded.evaluate(()=>userPreferences.theme),'day','Saved appearance must survive migration');
    const restoredSelection=await upgraded.evaluate(()=>({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds}));
    assert.deepEqual(restoredSelection.selectors,savedSelection.selectors,'Canonical follow selections survive migration');
    // New taxonomy children (e.g. NRLW under NRL) may expand a followed code,
    // but none of its previously included sports may disappear.
    assert(savedSelection.sports.every(sport=>restoredSelection.sports.includes(sport)),'Existing followed sport coverage survives migration');
    if(keepOpen)assert.equal(await upgraded.evaluate(()=>JSON.parse(sessionStorage.getItem('ns_chat_draft_v2:upgrade-test')).body),'Preserve this unsent draft');
    await upgraded.waitForTimeout(3500);assert(upgradeNavigations<=2,'Legacy migration must navigate at most once: '+JSON.stringify(upgradeNavigationLog));
    // The ongoing release exercises an already-open page, rather than another
    // fresh navigation. The old releases above use authentic historical bytes.
    const currentState=await upgraded.evaluate(async()=>{await NOTHINGSPORTS_APP_UPDATE.check({force:true});return NOTHINGSPORTS_APP_UPDATE.snapshot();});
    assert.equal(currentState.phase,'current');
    if(candidateHeaders['Content-Security-Policy']){
      const cachedPolicy=await upgraded.evaluate(async()=>{const shell=await caches.match('/index.html');return shell?.headers.get('content-security-policy');});
      assert.equal(cachedPolicy,candidateHeaders['Content-Security-Policy'],'installed shell must retain the new response policy offline');
    }
    const before=versionRequests;
    await upgraded.evaluate(()=>{for(let i=0;i<100;i++)window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    await upgraded.waitForTimeout(200);assert(versionRequests-before<=1,'Resume events must coalesce');
    const ownerCandidates=await upgraded.evaluate(async()=>{const r=await fetch('/data/marquee-candidates.v1.json');if(!r.ok)throw Error('Owner candidates unavailable after use');return r.text();});
    await upgraded.waitForFunction(async()=>Boolean(await caches.match('/data/marquee-candidates.v1.json')));
    await context.setOffline(true);
    await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.check({force:true}));
    assert.equal(await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.snapshot().phase),'offline');
    // Simulate an unreachable origin at the transport boundary. WebKit's
    // browser-level offline emulation can reject navigation before dispatching
    // a service-worker fetch, which is a different scenario.
    await context.setOffline(false);networkFailure=true;
    await upgraded.reload({waitUntil:'domcontentloaded'});
    assert.equal(await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content'),candidateVersion,'Offline navigation uses the validated current shell');
    await upgraded.waitForFunction(()=>Array.isArray(globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS));
    assert.deepEqual(await upgraded.evaluate(()=>globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS.map(({competitionId,snapshotTimeUtc,entries})=>({competitionId,snapshotTimeUtc,entries}))),expectedStandings,'offline restart retains the upgraded source observations and all positions');
    assert.equal(await upgraded.evaluate(async()=>await(await fetch('/data/marquee-candidates.v1.json')).text()),ownerCandidates,'owner candidates remain available offline after use');
    await assertCachedFootballStatus(upgraded);
    if(fs.existsSync(path.join(root,'assets/js/follow-presentation-ui.js'))){
      const choices=()=>JSON.stringify({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds,entities:userPreferences.preferenceGraph.entityFollows,spoilers:userPreferences.showSpoilers,theme:userPreferences.theme,notifications:userPreferences.notifications});
      const before=await upgraded.evaluate(choices);
      await upgraded.evaluate(()=>{activeTab='follow';renderAll();});
      await upgraded.locator('.follow-navigation').waitFor();
      assert.equal(await upgraded.evaluate(choices),before,'first Follow open offline retains follows, spoiler, appearance and notification choices');
      const url=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/const url='(assets\/js\/follow-presentation-ui\.js\?v=\d+)'/)[1];
      const cached=await upgraded.evaluate(async url=>{const r=await caches.match('/'+url);return r?await r.text():null;},url);
      assert.equal(cached,fs.readFileSync(path.join(root,'assets/js/follow-presentation-ui.js'),'utf8'),'offline first open executes the exact precached Follow interface');
      await upgraded.evaluate(()=>{activeTab='feed';renderAll();});
    }
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
    console.log(JSON.stringify({baselineVersion,candidateVersion,firstVersion,keepOpen,legacyAutomaticCatchup:true,upgradeNavigations,preferencesPreserved:true,optionalFailureTolerated:true,requiredFailurePreservesShell:true,offlineFallback:true,resumeUpgrade:true,profileCacheVerified,standingsCacheVerified:true,footballStatusCacheVerified:true,cricketStatusCacheVerified:true,matchCentreCacheVerified:true},null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
