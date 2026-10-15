'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const fixture=require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026');
assert(fixture,'The reported AUS v NZ fixture must be exercised');
async function main(){
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(name.includes('..')){res.writeHead(400);res.end();return;}fs.readFile(path.join(root,name),(error,body)=>{res.writeHead(error?404:200,{'content-type':({'.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(name)]||'text/html'});res.end(error?'':body);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.QA_BASE_URL||`http://127.0.0.1:${server.address().port}`,results=[];
 try{for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
  try{for(const width of [320,390,1280])for(const theme of ['night','day']){
   const page=await browser.newPage({viewport:{width,height:844},timezoneId:'Australia/Sydney',serviceWorkers:'block'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,followedSports:['horse-racing'],selectedSelectorEntityIds:['sport:horse-racing'],followBrowse:{sportId:'sport:horse-racing',section:'schedule',gender:'women'}})));
   await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'Isolated Follow and ratings regression'}}));
   await page.goto(base+'/#follow/browse',{waitUntil:'domcontentloaded'});
   await page.locator('#startupLaunch').waitFor({state:'hidden',timeout:60000});
   await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
   await page.evaluate(theme=>{setTunePromptOpen(false);suppressSessionRatingPrompt();document.documentElement.dataset.theme=theme;},theme);
   await page.getByRole('checkbox',{name:'Follow Horse Racing',exact:true}).waitFor();
   const tabs=page.getByRole('tablist',{name:'Browse sports gender'});
   const genderCount=await tabs.count();
   const ratings=await page.evaluate(fixture=>{
    const cases=[['unavailable',{...fixture,status:'upcoming'},{eventId:fixture.id,phase:null}],['completed',{...fixture,status:'completed'},undefined],['impact',{...fixture,status:'upcoming'},{eventId:fixture.id,phase:'impact'}]];
    const host=document.createElement('section');host.id='reported-ratings-evidence';document.body.append(host);
    return cases.map(([name,event,snapshot])=>{const card=document.createElement('article');card.className='event-card';card.dataset.testCase=name;const rating=buildNothingscorePeerResults(event,snapshot);card.append(rating);host.append(card);return{name,hidden:rating.hidden,buttons:rating.querySelectorAll('.nsc-rating-block').length,phase:rating.querySelector('[data-rating-phase]')?.dataset.ratingPhase||null,disabled:[...rating.querySelectorAll('.nsc-rating-block')].every(b=>b.disabled),text:rating.textContent};});
   },fixture);
   if(genderCount!==1||ratings.some(r=>r.hidden||r.buttons!==5))console.log(JSON.stringify({engine,width,theme,genderTabs:genderCount,ratings}));
   assert.equal(genderCount,1,'Men/Women tabs remain available while Horse Racing is selected');
   for(const rating of ratings){assert.equal(rating.hidden,false,`${rating.name}: ratings must not disappear`);assert.equal(rating.buttons,5,`${rating.name}: five rating controls remain visible`);}
   assert.equal(ratings[0].disabled,true,'Unknown match state cannot accept a fabricated phase');assert.match(ratings[0].text,/awaiting|confirmed/i);
   assert.equal(ratings[1].phase,'impact');assert.equal(ratings[2].phase,'impact');
   const fullCard=await page.evaluate(fixture=>{
    const host=document.getElementById('reported-ratings-evidence');host.replaceChildren();
    nothingscoreSnapshots.set(fixture.id,{eventId:fixture.id,phase:null});nothingscoreLoadedAt.set(fixture.id,Date.now());
    setCardState(fixture,'opened');const card=buildEventCard(fixture,{mode:'feed'});host.append(card);
    const bar=card.querySelector('.nsc-inline-rating'),before=bar?.querySelectorAll('button:disabled').length;
    const snapshot={eventId:fixture.id,phase:'impact',currentUser:{contribution:{rating:4}}};nothingscoreSnapshots.set(fixture.id,snapshot);
    card.querySelector('.nsc-summary').replaceWith(buildNothingscoreSummary({...fixture,status:'completed'}));
    const after=card.querySelector('.nsc-inline-rating');
    return{before,phase:after?.dataset.ratingPhase,filled:after?.querySelectorAll('.is-filled').length};
   },fixture);
   assert.equal(fullCard.before,5,'The actual expanded AUS v NZ card retains disabled rating controls');assert.equal(fullCard.phase,'impact');assert.equal(fullCard.filled,4,'A recovered Impact snapshot restores the saved rating');
   await page.evaluate(()=>document.getElementById('reported-ratings-evidence').remove());
   const before=await page.evaluate(()=>JSON.stringify(userPreferences.selectedSelectorEntityIds));
   for(const gender of ['Men','Women','Men','Women']){
    await page.getByRole('tab',{name:gender,exact:true}).click();
    await page.waitForFunction(gender=>followBrowseState().gender===gender,gender.toLowerCase());
    assert.equal(await page.getByRole('tab',{name:gender,exact:true}).getAttribute('aria-selected'),'true');
   }
   assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences.selectedSelectorEntityIds)),before,'Browsing gender never changes follows');
   await page.getByRole('checkbox',{name:'Follow Horse Racing',exact:true}).waitFor();
   await page.waitForLoadState('networkidle');
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden',timeout:60000});
   await page.waitForFunction(()=>startupFunnelFinished&&!startupCoordinator.isHydrating());
   assert.equal(await page.getByRole('tab',{name:'Women',exact:true}).getAttribute('aria-selected'),'true','Gender route survives reload on Horse Racing');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
   results.push({engine,width,theme,horseGenderNavigation:true,ratingsVisible:true,unknownPhaseDisabled:true,confirmedImpact:true});await page.close();
  }}finally{await browser.close();}
 }}finally{server.close();}
 console.log(JSON.stringify(results,null,2));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
