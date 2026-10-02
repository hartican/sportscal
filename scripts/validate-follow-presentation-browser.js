'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.replace(/^\//,'')||'index.html';
  if(name.includes('..')){res.writeHead(400);res.end();return;}
  fs.readFile(path.join(root,name),(error,bytes)=>{res.writeHead(error?404:200,{'content-type':({'.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(name)]||'text/html'});res.end(error?'':bytes);});
});
async function ready(page){
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:[],selectedSelectorEntityIds:[]})));
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Isolated presentation QA'}}));
  await page.goto(process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating(),null,{timeout:60000});
}
const openFollow=page=>page.locator('[data-tab="follow"]').click();
const savedChoices=page=>page.evaluate(()=>JSON.stringify({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds,entities:userPreferences.preferenceGraph.entityFollows,spoilers:userPreferences.showSpoilers,theme:userPreferences.theme,notifications:userPreferences.notifications}));
async function directory(page,sport){
  await page.evaluate(sport=>{saveFollowBrowse({sportId:'sport:'+sport,categoryId:'sport:'+sport,section:'teams-players'});renderFollowView();},sport);
  await page.locator(sport==='football'?'.football-club-row':'.follow-directory-row').first().waitFor();
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const evidence={at:new Date().toISOString(),url:process.env.QA_BASE_URL||'local candidate',checks:[]};
  try{
    for(const engine of (process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit'])){
      const browser=await engines[engine].launch({headless:true});
      try{
        for(const width of [320,390,768,1280]){
          const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let requests=0;
          page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/follow-presentation-ui.js'))requests++;});
          await ready(page);assert.equal(requests,0,'Feed startup must not fetch Follow presentation');
          const initial=await savedChoices(page);
          await openFollow(page);await page.locator('.follow-navigation').waitFor();assert.equal(requests,1);
          assert.equal(await savedChoices(page),initial,'opening Follow cannot change follows, spoiler, appearance or notification choices');
          await directory(page,'ice-hockey');
          const row=page.locator('.follow-directory-row').first();assert(await row.count());assert(await page.locator('.follow-directory-row').count()<=40);
          const patch=await row.evaluate(row=>{const b=row.querySelector('.football-follow-toggle'),before=b.textContent;b.click();const changed=b.textContent!==before,connected=row.isConnected;b.click();return {changed,connected,restored:b.textContent===before};});
          assert.deepEqual(patch,{changed:true,connected:true,restored:true});
          await directory(page,'football');assert(await page.locator('.football-club-row').count()<=40);
          const footballPatch=await page.locator('.football-club-row').first().evaluate(row=>{const b=row.querySelector('.football-follow-toggle'),before=b.textContent;b.click();const changed=b.textContent!==before,connected=row.isConnected;b.click();return {changed,connected,restored:b.textContent===before};});
          assert.deepEqual(footballPatch,{changed:true,connected:true,restored:true});
          await page.locator('[data-tab="feed"]').click();await openFollow(page);await page.locator('.follow-navigation').waitFor();assert.equal(requests,1,'return visits reuse the same interface');
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
          evidence.checks.push({engine,width,coldFeedRequests:0,firstFollowRequests:1,reused:true,preferencePreserved:true,rowsPatched:true,noOverflow:true});await context.close();
        }
        // First open failure is recoverable, repeated renders coalesce, and a late
        // response cannot take over Feed after the user has navigated away.
        const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();let count=0,release;
        await page.route('**/follow-presentation-ui.js?*',async route=>{count++;if(count===1){await route.abort();return;}await new Promise(resolve=>{release=resolve;});await route.continue();});
        await ready(page);await openFollow(page);await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
        assert.equal(count,1);await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForFunction(()=>document.getElementById('listView').dataset.followPresentation==='loading');
        await page.evaluate(()=>{renderFollowView();renderFollowView();});await page.waitForTimeout(100);assert.equal(count,2,'concurrent renders use one request');
        await page.locator('[data-tab="feed"]').click();await openFollow(page);
        assert.equal(await page.locator('#listView').innerText(),'Loading Follow…','returning while the request is pending keeps a readable loading state');
        await page.locator('[data-tab="feed"]').click();release();await page.waitForFunction(()=>typeof globalThis.renderFollowViewLoaded==='function');assert.equal(await page.evaluate(()=>activeTab),'feed');
        await openFollow(page);await page.locator('.follow-navigation').waitFor();assert.equal(count,2);await directory(page,'tennis');
        evidence.checks.push({engine,failureRetry:true,coalesced:true,navigationAwayPreserved:true,tennisLoaded:true});await context.close();
      }finally{await browser.close();}
    }
    if(process.env.QA_OUTPUT)fs.writeFileSync(process.env.QA_OUTPUT,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
  }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
