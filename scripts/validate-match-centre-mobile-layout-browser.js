'use strict';
// Replay the actual public cards from the reported mobile failure, without source reads.
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const receipt=require('./fixtures/match-centre-mobile-layout-20261012.json');
const failures=[],results=[];
(async()=>{
 for(const engine of (process.env.MC_LAYOUT_ENGINE?[process.env.MC_LAYOUT_ENGINE]:['chromium','webkit'])){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of [320,390,800]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];
   let releaseIdle;const idleReady=new Promise(resolve=>{releaseIdle=resolve;});
   await page.route('**/config/startup-view-cache.js?*',async route=>{await idleReady;await route.continue();});
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date(receipt.checkedAt));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,followedSports:[],selectedSelectorEntityIds:[],fantasyDeadlines:{enabled:false}})));
   await page.route('**/api/**',route=>{
    const url=route.request().url();
    if(url.includes('membership=everything'))return route.fulfill({json:{enabled:true,membershipStale:false,events:receipt.events,fixtures:receipt.fixtures,pagination:{nextCursor:null}}});
    if(url.includes('/api/match-centre?'))return route.fulfill({json:{enabled:true,fixtures:receipt.fixtures}});
    if(url.includes('scope=match-centre'))return route.fulfill({json:{events:[],pagination:{nextCursor:null}}});
    return route.fulfill({status:503,json:{}});
   });
   if(process.env.MC_LAYOUT_BASELINE){
    assert(/^[a-f0-9]{40}$/.test(process.env.MC_LAYOUT_BASELINE));
    for(const file of ['assets/js/match-centre-ui.js','assets/styles/match-centre.css']){
     const body=execFileSync('git',['show',process.env.MC_LAYOUT_BASELINE+':'+file],{encoding:'utf8'});
     await page.route('**/'+file+'?*',r=>r.fulfill({contentType:file.endsWith('.css')?'text/css':'application/javascript',body}));
    }
   }
   await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34219');
   await page.locator('#startupLaunch').waitFor({state:'hidden'});
   await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
   await page.locator('.tabs [data-tab=match-centre]').click();
   await page.getByRole('tab',{name:'Everything',exact:true}).click();
   const cricket=page.locator('[data-match-id="fixture:cricket:CA:39990"]'),nfl=page.locator('[data-match-id="fixture:nfl:401872990"]');
   await cricket.waitFor();await nfl.waitFor();await page.evaluate(()=>document.fonts.ready);
   const check=async(label,fn)=>{try{await fn();}catch(e){failures.push({engine,width,label,error:e.message});}};
   await check('late idle preparation preserves the selected Match Centre view',async()=>{
    releaseIdle();await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&activateTopLevelTab.toString().includes('saved'));
    const idle=fs.readFileSync('config/startup-view-cache.js','utf8'),assets=[idle.match(/assets\/js\/match-centre-ui\.js\?v=\d+/)[0],idle.match(/config\/event-overviews-ui\.js\?v=\d+/)[0]];
    await page.evaluate(async assets=>{await Promise.all(assets.map(loadDeferredScript));renderMatchCentre();},assets);
    assert.equal(await page.getByRole('tab',{name:'Everything',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await cricket.count(),1);
   });
   await check('cricket identities have readable width',async()=>{
    const boxes=await cricket.locator('.compact-matchup-side button').evaluateAll(nodes=>nodes.map(n=>{const range=document.createRange();range.selectNodeContents(n);return {name:n.textContent,width:n.getBoundingClientRect().width,client:n.clientWidth,scroll:n.scrollWidth,lines:range.getClientRects().length};}));
    assert.equal(boxes.length,2);for(const box of boxes){assert(box.width>=50,box.name+' is squeezed to '+box.width+'px');assert(box.lines<=2,box.name+' wraps into '+box.lines+' lines');assert(box.scroll<=box.client+1,box.name+' is horizontally cropped');}
   });
   await check('cricket scores fit the card',async()=>assert(await cricket.locator('.mc-score-cell').evaluateAll(cells=>cells.every(cell=>{const r=cell.getBoundingClientRect(),card=cell.closest('article').getBoundingClientRect();return r.left>=card.left&&r.right<=card.right&&cell.scrollWidth<=cell.clientWidth+1;}))));
   await check('NFL canonical names and logos',async()=>{
    for(const [name,slug] of [['Green Bay Packers','gb'],['Chicago Bears','chi']]){assert.equal(await nfl.getByRole('button',{name:'Open '+name+' profile in Follow',exact:true}).count(),1,name+' missing');const mark=nfl.locator('img[src*="/'+slug+'.png"]');assert.equal(await mark.count(),1,name+' logo missing');await mark.scrollIntoViewIfNeeded();assert((await mark.boundingBox()).width>=24);}
    await page.waitForFunction(()=>{const images=[...document.querySelectorAll('[data-match-id="fixture:nfl:401872990"] .compact-participant-mark')];return images.length===2&&images.every(image=>image.naturalWidth>0&&image.classList.contains('identity-image-decoded'));},{},{timeout:10000});
    assert(!/team:nfl:/.test(await nfl.locator('summary').innerText()),'Internal IDs appear as team names');
   });
   await check('privacy and refresh retain readable identities',async()=>{
    await page.evaluate(()=>{userPreferences.showSpoilers=false;renderMatchCentre();});
    assert.equal(await cricket.locator('.mc-participant-score').allTextContents().then(rows=>rows.every(t=>t==='Hidden')),true);
    assert.equal(await nfl.getByRole('button',{name:'Open Green Bay Packers profile in Follow',exact:true}).count(),1);
    await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();
    await page.getByText('Latest available scores loaded.',{exact:true}).waitFor();
    assert.equal(await nfl.locator('.mc-score-hidden').count(),2);
   });
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   if(process.env.MC_LAYOUT_OUTPUT){await page.evaluate(()=>{userPreferences.showSpoilers=true;renderMatchCentre();});if(!process.env.MC_LAYOUT_BASELINE)await page.waitForFunction(()=>document.querySelectorAll('[data-match-id="fixture:nfl:401872990"] .identity-image-decoded').length===2,{},{timeout:10000});await page.screenshot({path:process.env.MC_LAYOUT_OUTPUT+'/'+engine+'-'+width+'.png',fullPage:true});}
   results.push({engine,width,errors});await page.close();
  }}finally{await browser.close();}
 }
 const result={source:receipt.sourceUrl,checkedAt:receipt.checkedAt,baseline:process.env.MC_LAYOUT_BASELINE||null,mode:'captured public fixture replay; no provider reads',results,failures};
 if(process.env.MC_LAYOUT_OUTPUT)fs.writeFileSync(process.env.MC_LAYOUT_OUTPUT+'/browser-result.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));assert.equal(failures.length,0,'Match Centre mobile layout regressions');
})().catch(e=>{console.error(e);process.exitCode=1;});
