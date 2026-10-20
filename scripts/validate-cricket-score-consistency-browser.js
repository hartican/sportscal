'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),model=require('../config/match-centre'),fixture=require('./validate-cricket-score-consistency').fixture;
const report=[],out=process.env.NS_CRICKET_REPORT_DIR;
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':({'.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',timezoneId:'Australia/Sydney'}),errors=[];let external=0,changed=false,reads=0;
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const e=fixture(),stamp=new Date(Date.now()-60000).toISOString();Object.assign(e,{statusCheckedAt:stamp,scoreCheckedAt:stamp});
 const next=structuredClone(e);Object.assign(next,{statusCheckedAt:new Date(Date.now()-30000).toISOString(),scoreCheckedAt:new Date(Date.now()-30000).toISOString()});next.innings.at(-1).runsScored=175;next.innings.at(-1).batting.find(p=>p.isBatting).runs+=2;
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:27,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:[],followedSports:[]})));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){external++;return route.abort();}if(!u.pathname.startsWith('/api/'))return route.continue();
  if(u.pathname==='/api/match-centre'||u.pathname==='/api/feed'&&(u.searchParams.get('scope')==='match-centre'||u.searchParams.get('membership')==='everything')){reads++;const current=changed?next:e;
   // An old server/cache can still return the raw contradictory balance. The
   // actual new browser observation path must defend its retained scoreboard.
   return route.fulfill({json:{enabled:true,events:[current],fixtures:[{...model.compact(current),cricketBalance:current.cricketBalance}],pagination:{nextCursor:null}}});}
  return route.fulfill({status:503,json:{}});
 });
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof activateTopLevelTab==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
 await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('tab',{name:'Everything',exact:true}).click();const card=page.locator('[data-match-id="'+e.id+'"]');await card.waitFor();await card.locator('summary').click();
 assert.equal(await card.locator('table').count(),0);assert(!(await card.innerText()).includes('173/6'));assert(!(await card.innerText()).includes('175'));
 await page.getByRole('switch',{name:'Results OFF',exact:true}).click();await page.getByRole('dialog',{name:'Show results?'}).getByRole('button',{name:'Show results',exact:true}).click();await card.getByText('173/6 (59.5)',{exact:true}).waitFor();
 assert.equal(await card.locator('.mc-cricket-balance').isVisible(),false);assert(!(await card.innerText()).includes('6-175'));assert.match(await card.locator('.mc-score-details').innerText(),/173\/6/);
 if(out&&width===390){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,engine+'-173-results-on.png')});}
 const feed=await page.evaluate(async e=>{await ensureFeedScoreUi();await loadDeferredScript('config/feed-live-scores.js');setCardState(e,'opened');const host=document.createElement('div');host.append(buildEventCard(e));document.body.append(host);const card=host.querySelector('.event-card');NOTHINGSPORTS_FEED_LIVE_SCORES.install(card,e,{resultsOn:true});const on=card.querySelector('.fixture-score-summary')?.textContent;NOTHINGSPORTS_FEED_LIVE_SCORES.install(card,e,{resultsOn:false});const hidden=!card.querySelector('.feed-live-score');host.remove();return {on,hidden};},e);
 assert.match(feed.on,/173\/6/);assert(!feed.on.includes('175'));assert(feed.hidden);
 changed=true;await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await card.getByText('175/6 (59.5)',{exact:true}).waitFor();assert.match(await card.locator('.mc-score-details').innerText(),/175\/6/);assert.equal(await card.locator('details').getAttribute('open')!==null,true);
 await page.getByRole('switch',{name:'Results ON',exact:true}).click();assert.equal(await card.locator('table').count(),0);assert(!(await card.innerText()).includes('175'));assert.deepEqual(errors,[]);
 report.push({engine,width,constructed:true,matchCentre173:true,contradictory175Hidden:true,feed173:true,sourceRefresh175:true,expansionPreserved:true,resultsOff:true,reads,externalRequestsCompleted:0,externalAttemptsBlocked:external,errors});
 if(out&&width===390){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,engine+'-results-off.png')});}await page.close();
 }}finally{await browser.close();}}}finally{await new Promise(resolve=>server.close(resolve));}
 if(out)fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
