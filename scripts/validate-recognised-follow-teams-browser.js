'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const {ready}=require('./validate-follow-presentation-browser');
const baseline=process.env.QA_BASELINE_SHA||'ed1536be1bd58658e5fcb6478085df222f9cd5cf';
const previous=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:16*1024*1024});
const server=http.createServer((req,res)=>{
 const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(file.includes('..')){res.writeHead(400);res.end();return;}
 fs.readFile(path.join(root,file),(error,bytes)=>{res.writeHead(error?404:200,{'content-type':({'.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'text/html'});res.end(error?'':bytes);});
});
async function selectSport(page,id){
 const toggle=page.locator('.follow-navigation-toggle');if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 const button=page.locator('[data-follow-sport="'+id+'"]');
 if(!await button.isVisible())await page.locator('.follow-more-trigger').click();
 await button.click();await page.locator('.follow-directory-tabs').waitFor();
}
const tabs=page=>page.locator('.follow-directory-tabs');
async function selected(page,label){await page.waitForFunction(label=>[...document.querySelectorAll('.follow-directory-tabs button')].some(b=>b.textContent===label&&b.getAttribute('aria-pressed')==='true'),label);}
async function assertDirectoryDefaults(page){
 await page.getByRole('tab',{name:'Men',exact:true}).click();await selectSport(page,'sport:tennis');await selected(page,'Teams');
 await tabs(page).getByRole('button',{name:'Players',exact:true}).click();await page.evaluate(()=>renderAll());await selected(page,'Players');
 await page.locator('.follow-section-tabs').getByRole('button',{name:'Teams & Players',exact:true}).click();await selected(page,'Teams');
 await selectSport(page,'sport:golf');await selected(page,'Golfers');assert(await tabs(page).getByRole('button',{name:'Teams',exact:true}).isDisabled());
 await selectSport(page,'sport:tennis');await selected(page,'Teams');
}
async function journey(page){
 await page.locator('#startupLaunch').waitFor({state:'hidden'});
 await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();updateDirectoryFilters('aflw',{entityType:'athlete'});});
 await page.locator('.tabs [data-tab="follow"]').click();await tabs(page).waitFor();await selected(page,'Teams');
 assert.deepEqual(await tabs(page).locator('button').allTextContents(),['Teams','Players']);
 assert.equal(await page.locator('.follow-section-tabs button').first().textContent(),'Teams & Players');
 await page.locator('.football-club-row').first().waitFor();
 assert.equal(await page.locator('.football-club-row').count(),20,'Old AFLW data must show 18 clubs and two retained national identities');
 assert(!/\b(?:Loser|Winner) of\b/.test(await page.locator('.follow-directory-content').innerText()));
 await tabs(page).getByRole('button',{name:'Players',exact:true}).click();await page.locator('.football-player-row').first().waitFor();
 await page.evaluate(()=>{renderAll();renderFollowView();});await selected(page,'Players');
 const first=page.locator('.football-player-row').first(),toggle=first.locator('.football-follow-toggle');
 const initial=await toggle.textContent();await toggle.click();await selected(page,'Players');assert.notEqual(await toggle.textContent(),initial);await toggle.click();assert.equal(await toggle.textContent(),initial);
 const trigger=page.locator('.football-player-name').nth(1),key=await trigger.getAttribute('data-profile-trigger');
 await trigger.click();await page.locator('.participant-profile-header').waitFor();await page.getByRole('button',{name:'Back',exact:true}).click();await tabs(page).waitFor();await selected(page,'Players');
 await page.waitForFunction(key=>document.activeElement?.dataset.profileTrigger===key,key);
 await page.locator('.follow-section-tabs').getByRole('button',{name:'Teams & Players',exact:true}).click();await selected(page,'Teams');
 const input=page.locator('.follow-global-search-input');await input.fill('Loser of QF');await page.waitForFunction(()=>/result|No players or teams/.test(document.querySelector('.global-search-status')?.textContent||''));
 assert(await page.locator('.global-search-result').evaluateAll(rows=>rows.every(row=>!NOTHINGSPORTS_PARTICIPANT_DIRECTORY.isUnresolvedTeam(NOTHINGSPORTS_PARTICIPANT_SEARCH.getRecord(row.dataset.participantId)))),'Fuzzy matches may include real athletes, never bracket slots');
 await input.fill('Carlton');await page.waitForFunction(()=>[...document.querySelectorAll('.global-search-result')].some(r=>r.textContent.includes('Carlton')));await input.fill('');
 await page.getByRole('tab',{name:'Men',exact:true}).click();await selectSport(page,'sport:tennis');await selected(page,'Teams');
 await tabs(page).getByRole('button',{name:'Players',exact:true}).click();
 const list=page.locator('.football-directory-field').filter({hasText:'List'}).locator('select');await list.selectOption('collection:tennis:mens-top-10');await selected(page,'Players');
 assert.equal(await page.locator('.follow-directory-row').count(),10);
 await page.locator('.follow-section-tabs').getByRole('button',{name:'Teams & Players',exact:true}).click();await selected(page,'Teams');assert.equal(await tabs(page).getByRole('button',{name:'Teams',exact:true}).isDisabled(),false);
 assert(await page.locator('.follow-directory-row').count()>0,'A remembered player List cannot hide recognised teams');
 await tabs(page).getByRole('button',{name:'Players',exact:true}).click();assert.equal(await list.inputValue(),'collection:tennis:mens-top-10');
 await list.selectOption('');assert.equal(await page.locator('.follow-directory-row').count(),40,'All players shows the first full uncurated page');
 await selectSport(page,'sport:golf');await selected(page,'Golfers');const disabled=tabs(page).getByRole('button',{name:'Teams',exact:true});assert(await disabled.isDisabled());assert.equal(await disabled.getAttribute('aria-pressed'),'false');assert(Number(await disabled.evaluate(b=>getComputedStyle(b).opacity))<1);
 await page.evaluate(()=>{updateDirectoryFilters('golf',{query:'No matching player',collectionId:'nonexistent'});renderFollowView();});assert(await disabled.isDisabled());await selected(page,'Golfers');
 await page.locator('.tabs [data-tab="feed"]').click();await page.locator('.tabs [data-tab="follow"]').click();await tabs(page).waitFor();await selected(page,'Golfers');assert(await disabled.isDisabled());
 await selectSport(page,'sport:tennis');await selected(page,'Teams');await page.getByRole('tab',{name:'Women',exact:true}).click();await tabs(page).waitFor();await selected(page,'Teams');
 assert.equal(await page.locator('.follow-section-tabs button').first().textContent(),'Teams & Players');
 return {oldAflwSlotsHidden:true,oldSearchSlotsHidden:true,realTeamsRetained:20,teamsFirst:true,redrawAndFollowPreservePlayers:true,profileBackRestoresPlayersAndFocus:true,listRestored:true,allPlayers:true,noTeamsDisabled:true,genderAndSportDefaults:true};
}
if(require.main===module)(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.QA_BASE_URL ||= 'http://127.0.0.1:'+server.address().port;const evidence={checks:[],baseline,physicalDevice:false};
 try{for(const engine of process.env.QA_BROWSER?[process.env.QA_BROWSER]:['chromium','webkit']){const browser=await engines[engine].launch({headless:true});try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/data/follow-directory/aflw.v1.json',r=>r.fulfill({contentType:'application/json',body:previous('data/follow-directory/aflw.v1.json')}));await page.route('**/data/follow-directory/search.v1.json',r=>r.fulfill({contentType:'application/json',body:previous('data/follow-directory/search.v1.json')}));
  await ready(page,{onboardingComplete:true,followedSports:[],selectedSelectorEntityIds:[],followBrowse:{sportId:'sport:aflw',categoryId:'',section:'teams-players',gender:'women'}});
  evidence.checks.push({engine,...await journey(page),errors});assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}}if(process.env.QA_OUTPUT)fs.writeFileSync(process.env.QA_OUTPUT,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));}finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={journey,assertDirectoryDefaults};
