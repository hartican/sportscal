'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),model=require('../config/match-centre');
const {fixture,now}=require('./validate-match-interruptions');
const root=path.resolve(__dirname,'..');
const output=process.env.MATCH_INTERRUPTION_OUTPUT;if(output)fs.mkdirSync(output,{recursive:true});
const legacyStyles=require('node:child_process').execFileSync('git',['show','0651bb7d6f328f616e8732f516d7cccd92c7a299:assets/styles/match-centre.css'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
// Real local app; default source renderer, or actual disk-generated renderer
// with MATCH_INTERRUPTION_GENERATED=1. Constructed/local-only APIs; no hosted
// release, real-account or physical-device proof.
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
  try{for(const width of (process.env.MATCH_INTERRUPTION_WIDTHS||'390,1280').split(',').map(Number))for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,serviceWorkers:'block'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));let phase=0,apiNow=now,membershipReads=0,selectedReads=0,failed=false,nonLocal=0,cold=true;
   const row=()=>{
    const at=new Date(apiNow).toISOString(),e={...fixture,fixtureObservationSchema:'fixture-observations.v1',sourceCheckedAt:at,statusCheckedAt:at,scoreCheckedAt:at,statusFactObservedAt:at};
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
    if(url.pathname==='/assets/styles/match-centre.css'&&url.searchParams.get('v')==='507')return route.fulfill({contentType:'text/css',body:legacyStyles});
    if(url.pathname==='/assets/js/app-shell-runtime.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'assets/js/app-shell-runtime.js'),'utf8')});
    if(cold&&url.pathname==='/config/match-centre.js')return route.fulfill({contentType:'text/javascript',body:'/* Deferred model intentionally withheld during cold Feed/Schedule checks. */'});
    if(url.pathname==='/assets/js/match-centre-ui.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,process.env.MATCH_INTERRUPTION_GENERATED==='1'?'assets/js/match-centre-ui.js':'assets/js/match-centre-ui.source.js'),'utf8')});
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
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme==='dark'?'night':'day';},theme);
   const coldCards=await page.evaluate(fixture=>{
    if(typeof NOTHINGSPORTS_MATCH_CENTRE!=='undefined')throw Error('Cold rendering must precede deferred Match Centre');
    const host=document.createElement('section');document.getElementById('listView').append(host);const result=[];userPreferences.showSpoilers=false;
    for(const surface of ['feed','follow'])for(const state of ['compact','selected']){
     activeTab=surface;const event={...fixture,id:fixture.id+':cold:'+surface+':'+state,eventId:fixture.id+':cold:'+surface+':'+state,canonicalEventId:fixture.id+':cold:'+surface+':'+state,status:'suspended',statusText:'Lightning',restartTimeUtc:'2026-10-18T11:00:00Z',restartSourceUrl:null,restartSourceCheckedAt:null};
     const before=JSON.stringify(event);setCardState(event,state);const card=buildEventCard(event,{mode:surface==='feed'?'feed':'schedule'});host.append(card);
     const timing=card.querySelector(state==='compact'?'.compact-card-time':'.fixture-timing-badge'),summary=card.querySelector(state==='compact'?'.compact-card-summary':'.fixture-timing-badge');
     result.push({surface,state,text:timing?.textContent,aria:summary?.getAttribute('aria-label'),titles:[...card.querySelectorAll('[title]')].map(e=>e.title).join(' '),sourceUnchanged:JSON.stringify(event)===before});
    }
    activeTab='feed';userPreferences.showSpoilers=true;host.remove();return result;
   },fixture);
   for(const item of coldCards){assert.match(item.text,/PLAY SUSPENDED · LIGHTNING/);assert.match(item.aria,/PLAY SUSPENDED · LIGHTNING/);assert(!/10:00\s*PM|22:00/i.test(item.text+item.aria+item.titles),'A bare restart is absent from visible, title and accessible cold cards');assert(item.sourceUnchanged);}
   if(theme==='dark')await page.evaluate(()=>new Promise((resolve,reject)=>{if(document.querySelector('link[data-mc-style]'))throw Error('Legacy stylesheet setup must precede Match Centre');const link=document.createElement('link');link.rel='stylesheet';link.dataset.mcStyle='';link.href='assets/styles/match-centre.css?v=507';link.onload=resolve;link.onerror=()=>reject(Error('Controlled legacy stylesheet did not load'));globalThis.legacyMcStylesheet=link;document.head.append(link);}));
   cold=false;
   await page.addScriptTag({path:path.join(root,'config/match-centre.js')});
   await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
   await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('tab',{name:'Everything',exact:true}).click();
   const card=page.locator('[data-match-id="'+fixture.id+'"]');await card.waitFor();
   await page.waitForFunction(()=>document.querySelector('link[data-mc-style]')?.sheet?.href===new URL('assets/styles/match-centre.css?v=572',document.baseURI).href);
   assert.equal(await page.locator('link[data-mc-style]').count(),1,'One shared stylesheet owner');if(theme==='dark')assert(await page.evaluate(()=>legacyMcStylesheet===document.querySelector('link[data-mc-style]')),'Legacy overview stylesheet link is reused');
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
   // Isolate absence from retention: this constructed fixture has never had a
   // score, then receives a genuine zero innings through the same renderer.
   const emptyId='controlled:mc-empty-innings';
   await page.evaluate(({fixture,id})=>{
    const at=new Date().toISOString(),e={...fixture,id,eventId:id,canonicalEventId:id,sourceEventIds:[],status:'live',statusText:null,statusCheckedAt:at,scoreCheckedAt:null,sourceCheckedAt:at,innings:[],stale:true,sourceStale:false,fixtureObservationSchema:'fixture-observations.v1'};
    globalThis.mcEmptySource=e;openMilestoneMatchCentreFixture(e,NOTHINGSPORTS_MATCH_CENTRE.compact(e));
   },{fixture,id:emptyId});
   const empty=page.locator('[data-match-id="'+emptyId+'"]');await empty.waitFor();if(!await empty.locator('details').evaluate(element=>element.open))await empty.locator('summary').click();
   assert.deepEqual(await empty.locator('.mc-score-cell').allTextContents(),['—','—'],'No innings renders unavailable, never an invented0');
   assert.equal(await empty.locator('.mc-participant-score[aria-label="Score unavailable"]').count(),2);
   assert.match(await empty.locator('.mc-status').textContent(),/Last reported live/);
   assert.match(await empty.locator('.fixture-timing-badge').textContent(),/LAST REPORTED LIVE/);
   await empty.locator('.milestone-mute').waitFor();
   const layout=await empty.evaluate(card=>{
    const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number),light=values=>values.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const button=card.querySelector('.fixture-timing-badge');
    const contrast=element=>{const layers=[];for(let p=element;p;p=p.parentElement){const c=rgb(getComputedStyle(p).backgroundColor);layers.push(c);if(c.length===3||c[3]===1)break;}let background=[255,255,255];for(const c of layers.reverse()){const alpha=c[3]??1;background=background.map((n,i)=>(c[i]||0)*alpha+n*(1-alpha));}const style=getComputedStyle(element),color=rgb(style.color),alpha=(color[3]??1)*Number(style.opacity);const foreground=light(background.map((n,i)=>color[i]*alpha+n*(1-alpha))),back=light(background);return (Math.max(foreground,back)+.05)/(Math.min(foreground,back)+.05);};
    const text=[button,...button.querySelectorAll('.fixture-timing-day,.fixture-timing-clock,.fixture-timing-status')].filter(element=>element.textContent.trim()).map(contrast);
    const alert=card.querySelector('.milestone-mute'),rect=alert.getBoundingClientRect(),cardRect=card.getBoundingClientRect();return {contrast:Math.min(...text),textContrastRatios:text,alertWidth:rect.width,alertHeight:rect.height,clipped:alert.scrollWidth>alert.clientWidth||alert.scrollHeight>alert.clientHeight||rect.right>cardRect.right||rect.left<cardRect.left};
   });
   assert(layout.contrast>=4.5,JSON.stringify(layout));assert(layout.alertWidth>=44&&layout.alertHeight>=44&&!layout.clipped,JSON.stringify(layout));
   if(output)await empty.screenshot({path:path.join(output,`${engine}-${width}-${theme}-unavailable.png`),animations:'disabled'});
   await page.evaluate(()=>{const at=new Date().toISOString(),home=NOTHINGSPORTS_MATCH_CENTRE.compact(mcEmptySource).homeParticipantId,e={...mcEmptySource,stale:false,statusCheckedAt:at,scoreCheckedAt:at,innings:[{participantId:home,runs:0,wickets:0,overs:'0.0'}]};openMilestoneMatchCentreFixture(e,NOTHINGSPORTS_MATCH_CENTRE.compact(e));});
   assert.match(await empty.locator('.mc-score-cell').first().textContent(),/^0\/0/);assert.equal(await empty.locator('.mc-status').textContent(),'Live');
   await page.evaluate(()=>{userPreferences.showSpoilers=false;renderMatchCentre();});assert((await empty.locator('.mc-score-cell').allTextContents()).every(text=>text==='Hidden'));
   assert.deepEqual(errors,[]);assert(membershipReads>1&&selectedReads>0);
   console.log(JSON.stringify({engine,width,theme,constructed:true,providerRainHistory:false,sourceRenderer:process.env.MATCH_INTERRUPTION_GENERATED!=='1',generatedRelease:false,generatedAssets:process.env.MATCH_INTERRUPTION_GENERATED==='1',emptyScoreRepair:true,legacyStylesheetReused:theme==='dark',themeContrast:layout.contrast,alertTarget:{width:layout.alertWidth,height:layout.alertHeight,clipped:layout.clipped},coldCards,automaticTransitions:6,resultsOff:true,focusRetained:true,membershipReads,selectedReads,blockedExternal:nonLocal}));passes++;await page.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(resolve=>server.close(resolve));}
 console.log(JSON.stringify({browserPasses:passes,providerRequests:0,databaseRequests:0}));
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;
