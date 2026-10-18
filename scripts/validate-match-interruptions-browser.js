'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),model=require('../config/match-centre');
const {fixture,now}=require('./validate-match-interruptions');
const root=path.resolve(__dirname,'..');
// Real local app + renderer source; every API response is constructed and all
// non-local traffic is blocked. This does not validate generated release bytes.
async function run(){
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(bytes);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 let passes=0;
 try{for(const engine of (process.env.MATCH_INTERRUPTION_ENGINES||'chromium,webkit').split(',')){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of [390,1280])for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,serviceWorkers:'block'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));let phase=0,apiNow=now,membershipReads=0,selectedReads=0,failed=false,nonLocal=0;
   const row=()=>{
    const at=new Date(apiNow).toISOString(),e={...fixture,sourceCheckedAt:at,statusCheckedAt:at,scoreCheckedAt:at,statusFactObservedAt:at};
    if(phase===0)return {...e,status:'suspended',statusText:'Rain delay'};
    if(phase===1)return {...e,status:'suspended',statusText:'Play suspended due to lightning',innings:[],scoreCheckedAt:null};
    if(phase===2)return {...e,status:'live',statusText:'Rain delay',innings:[{...fixture.innings[0],runs:1}],restartTimeUtc:'2026-10-18T11:00:00Z'};
    if(phase===3)return {...e,status:'delayed',statusText:null,actualStartTimeUtc:null,innings:[]};
    if(phase===4)return {...e,status:'suspended',statusText:'Medical emergency',restartTimeUtc:new Date(apiNow+3600000).toISOString(),restartSourceUrl:'https://www.cricket.com.au/matches/CA%3A39990',restartSourceCheckedAt:at};
    if(phase===5)return {...e,status:'break',statusText:'Innings interval'};
    return {...e,status:'abandoned',statusText:'Abandoned due to rain'};
   };
   await page.clock.install({time:now});
   await page.addInitScript(theme=>{localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,showSpoilers:true,selectedSelectorEntityIds:[],followedSports:[]}));localStorage.setItem('theme',theme);},theme);
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){nonLocal++;return route.abort();}
    if(url.pathname==='/assets/js/match-centre-ui.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'assets/js/match-centre-ui.source.js'),'utf8')});
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const e=row(),snapshot=model.compact(e);
    if(url.pathname==='/api/match-centre'){
     if(url.searchParams.get('membership')==='everything'){membershipReads++;if(failed)return route.fulfill({status:503,json:{}});return route.fulfill({json:{enabled:true,events:[e],fixtures:[snapshot],pagination:{nextCursor:null}}});}
     selectedReads++;return route.fulfill(failed?{status:503,json:{}}:{json:{enabled:true,fixtures:[snapshot]}});
    }
    if(url.pathname==='/api/feed'&&url.searchParams.get('scope')==='match-centre')return route.fulfill({json:{events:[],pagination:{nextCursor:null}}});
    return route.fulfill({status:503,json:{}});
   });
   await page.goto(origin);
   await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
   await page.locator('#startupLaunch').waitFor({state:'hidden'});
   await page.addScriptTag({path:path.join(root,'config/match-centre.js')});
   await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
   await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('tab',{name:'Everything',exact:true}).click();
   const card=page.locator('[data-match-id="'+fixture.id+'"]');await card.waitFor();
   const label=card.locator('.mc-status'),freshness=card.locator('.mc-row-freshness');
   await label.filter({hasText:'Play suspended · Rain delay'}).waitFor();
   assert.equal(await card.locator('.mc-active-live').count(),0,'Interrupted membership has no actively-playing badge');
   assert.equal(await card.locator('xpath=..').locator('xpath=..').locator('h3').first().textContent(),'Live');
   assert.match(await card.locator('.mc-score-cell').first().textContent(),/^0\/0/);
   await card.locator('summary').click({position:{x:10,y:10}});const button=card.locator('.fixture-timing-badge');await button.focus();
   assert(!/Live again at/.test(await button.textContent()),'Unconfirmed times never enter the expanded capsule');
   await page.evaluate(()=>{userPreferences.showSpoilers=false;renderMatchCentre();});
   assert.equal(await card.locator('.mc-score-cell').first().textContent(),'Hidden');assert.match(await label.textContent(),/Rain delay/);
   await page.evaluate(()=>{userPreferences.showSpoilers=true;renderMatchCentre();});
   for(phase=1;phase<=6;phase++){
    apiNow+=120001;await page.clock.fastForward(120001);
    const expected={1:'Play suspended · lightning',2:'Live',3:'Delayed',4:'Play suspended · Medical emergency',5:'Innings interval',6:'Abandoned · rain'}[phase];
    await page.waitForFunction(({id,expected})=>document.querySelector('[data-match-id="'+id+'"] .mc-status')?.textContent===expected,{id:fixture.id,expected});
    assert(await card.locator('details').evaluate(e=>e.open),'Automatic updates retain expansion');
    assert(await button.evaluate(e=>document.activeElement===e),'Automatic updates retain the same timing control and focus');
    if(phase===1){assert.match(await card.locator('.mc-score-cell').first().textContent(),/^0\/0/);assert.match(await freshness.textContent(),/Awaiting update/);failed=true;apiNow+=120001;await page.clock.fastForward(120001);assert.equal(await label.textContent(),expected,'Failed reads cannot change match status');assert.match(await freshness.textContent(),/Awaiting update/);assert.match(await card.locator('.mc-score-cell').first().textContent(),/^0\/0/);failed=false;}
    if(phase===2){assert.match(await card.locator('.mc-score-cell').first().textContent(),/^1\/0/);assert.equal(await card.locator('.mc-row-restart').isVisible(),false);assert(!/rain|suspend|Live again/i.test(await button.textContent()),'Expanded timing clears obsolete interruption presentation');assert(!/Rain delay/.test(await card.locator('.mc-score-details').textContent()),'Resumed play cannot display old source interruption prose');}
    if(phase===4)assert.match(await card.locator('.mc-row-restart').textContent(),/Live again at/,'Only a confirmed restart is displayed');
    if(phase===3)assert(!/rain/i.test(await label.textContent()),'A reasonless delayed start never implies rain');
    if(phase===6)assert.equal(await card.locator('xpath=..').locator('xpath=..').locator('h3').first().textContent(),'Recently finished');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'The current app remains within the viewport');
   assert.deepEqual(errors,[]);assert(membershipReads>1&&selectedReads>0);
   console.log(JSON.stringify({engine,width,theme,constructed:true,providerRainHistory:false,sourceRenderer:true,generatedRelease:false,automaticTransitions:6,resultsOff:true,focusRetained:true,membershipReads,selectedReads,blockedExternal:nonLocal}));passes++;await page.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(resolve=>server.close(resolve));}
 console.log(JSON.stringify({browserPasses:passes,providerRequests:0,databaseRequests:0}));
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;
