'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://local').pathname;if(route==='/profile-test.html'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><head></head><body><button id="origin">Open profile</button></body></html>');return;}const file=path.join(root,route);fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'content-type':file.endsWith('.js')?'application/javascript':'application/json'});res.end(error?'':bytes);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const observations=[];
 try{for(const engine of process.env.BROWSER_ENGINE?[process.env.BROWSER_ENGINE]:['chromium','webkit']){
  const browser=await pw[engine].launch(engine==='chromium'?{channel:'chrome'}:{});
  try{for(const scenario of ['empty','history','off','failed','published-failed','closed','switch','script-failed']){
   const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),pending=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/fixtures?athlete=*',route=>{pending.push(route);});
   if(scenario==='script-failed')await page.route('**/data/canonical/athlete-participation.v1.js',route=>route.abort());
   await page.goto(`http://127.0.0.1:${server.address().port}/profile-test.html`);
   await page.evaluate(({off,scriptFailed,published})=>{window.userPreferences={showSpoilers:!off};if(!scriptFailed)window.NOTHINGSPORTS_ATHLETE_PARTICIPATION={athletes:published?[{id:'team:football:epl:1',history:[{eventId:'synthetic:published',date:'2026-09-29',discipline:'Football',kind:'match',description:'Synthetic published experience',sourceUrl:'https://source.invalid/published'}]}]:[]};},{off:scenario==='off',scriptFailed:scenario==='script-failed',published:scenario==='published-failed'});
   await page.addScriptTag({url:`http://127.0.0.1:${server.address().port}/config/athlete-profile-ui.js`});
   const rich=!['empty','script-failed'].includes(scenario);
   await page.evaluate(({rich})=>{
    const record={id:'team:football:epl:1',displayName:'Arsenal',...(rich?{profileOnly:true,biography:'Synthetic result biography',keyFacts:[{label:'Synthetic wins',value:0}],sourceLinks:[{url:'https://source.invalid/background',label:'Background source'}]}:{})};
    window.__profileOpening=NOTHINGSPORTS_ATHLETE_PROFILE_UI.open(record,'football',document.getElementById('origin'));
   },{rich});
   const began=Date.now();while(!pending.length){assert(Date.now()-began<5000,'Optional lookup starts within test deadline');await new Promise(r=>setTimeout(r,10));}
   const body=page.locator('.athlete-profile-body');
   assert.equal(await body.locator('h2').textContent({timeout:250}),'Arsenal','Known profile body must appear while optional history is held');
   if(scenario==='off'){assert.equal(await body.getByRole('heading',{name:'Biography',exact:true}).count(),0);assert.equal(await body.locator('.athlete-stat').count(),0);}
   if(scenario==='history')await body.getByRole('link',{name:'Background source',exact:true}).focus();
   if(scenario==='closed')await page.getByRole('button',{name:'Close athlete profile',exact:true}).click();
   if(scenario==='switch'){
    await page.evaluate(()=>{window.__secondOpening=NOTHINGSPORTS_ATHLETE_PROFILE_UI.open({id:'team:football:epl:2',displayName:'Aston Villa'},'football',document.getElementById('origin'));});
    const switched=Date.now();while(pending.length<2){assert(Date.now()-switched<5000);await new Promise(r=>setTimeout(r,10));}
    assert.equal(await page.locator('.athlete-profile-body h2').textContent(),'Aston Villa');
   }
   const history={schemaVersion:'athlete-participation-live.v1',history:[{eventId:'synthetic:experience',date:'2026-09-30',discipline:'Football',kind:'match',description:'Synthetic source-backed experience',sourceUrl:'https://source.invalid/experience'}]};
   await pending[0].fulfill(['failed','published-failed'].includes(scenario)?{status:503,json:{}}:{json:scenario==='empty'?{...history,history:[]}:history});
   await page.evaluate(()=>window.__profileOpening);
   if(scenario==='switch'){assert.equal(await page.locator('.athlete-profile-body h2').textContent(),'Aston Villa');assert.equal(await page.getByText('Synthetic source-backed experience',{exact:false}).count(),0);await pending[1].fulfill({json:{...history,history:[]}});await page.evaluate(()=>window.__secondOpening);}
   else if(scenario==='closed')assert.equal(await page.locator('.athlete-profile-backdrop').count(),0,'Late history cannot reopen a closed profile');
   else{
    assert.equal(await body.locator('h2').textContent(),'Arsenal');
    const shown=!['empty','off','failed'].includes(scenario);
    assert.equal(await body.getByRole('heading',{name:'Other disciplines & experience',exact:true}).count(),shown?1:0,'Verified history stays source-backed and Results-gated');
    if(shown)assert.equal(await body.getByRole('link',{name:'Source',exact:true}).getAttribute('href'),scenario==='published-failed'?'https://source.invalid/published':'https://source.invalid/experience');
    if(scenario==='history')assert(await body.getByRole('link',{name:'Background source',exact:true}).evaluate(el=>el===document.activeElement),'Optional arrival must not replace focused existing profile content');
   }
   assert.deepEqual(errors,[]);observations.push({engine,scenario,knownBodyBeforeOptionalCompletion:true,lateHistoryAndPrivacyPassed:true});await page.close();
  }}finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 if(process.env.PROFILE_PROGRESSIVE_CAPTURE)fs.writeFileSync(process.env.PROFILE_PROGRESSIVE_CAPTURE,JSON.stringify({checkedAt:new Date().toISOString(),cases:observations.length,observations},null,2)+'\n');
 console.log('Progressive profile: '+observations.length+' actual public-renderer cases preserve immediate identity/core content, Results privacy, source history, focus, failure and late-route isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
