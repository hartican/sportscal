'use strict';
// Horse coverage now has its own limited-reference suite. Keep the existing
// combined entrypoint and native motorsport regressions on their actual data.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),suite=require('./validate-melbourne-cup-browser'),model=require('../config/match-centre');
async function main(){
 const server=suite.server();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'validate-racing-details-browser.js')],{stdio:'inherit',env:{...process.env,MATCH_CENTRE_QA_URL:base}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native motorsport suite failed: '+code)));});
 const feed=require('../data/events.json').events,f1=feed.find(e=>e.key==='f1'&&model.racingDetail(e)?.entries?.length===22),moto=feed.find(e=>e.key==='motogp'&&e.status==='upcoming'),wrc=feed.find(e=>e.key==='wrc'&&e.status==='upcoming');assert(f1&&moto&&wrc);
 for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,followedSports:['f1','motogp','wrc']})));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(events=>{setTunePromptOpen(false);suppressSessionRatingPrompt();const host=document.createElement('section');host.id='motorsportControl';document.getElementById('listView').replaceChildren(host);for(const f of events){setCardState(f,'opened');host.append(buildEventCard(f,{mode:'feed'}));}},[f1,moto,wrc]);
 const cards=page.locator('#motorsportControl .event-card');await cards.nth(0).locator('tbody tr').first().waitFor();assert.equal(await cards.nth(0).locator('tbody tr').count(),22);for(const i of [1,2]){await cards.nth(i).getByRole('link',{name:'Official timing / results',exact:true}).waitFor();assert.equal(await cards.nth(i).locator('tbody tr').count(),0);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,width,f1FullClassification:22,motogpAndWrcFallbacks:true,controlledLocal:true}));await page.close();
 }}finally{await browser.close();}}
 }finally{server.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
