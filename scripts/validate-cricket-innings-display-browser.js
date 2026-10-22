'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const before=process.env.CRICKET_INNINGS_STAGE==='before',baseline='6e14bdc7e5c203727f312ba5e933d636ab565b2f';
function baselineSource(file){return require('node:child_process').execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'});}
function implementation(file){if(!before)return require('../'+file);const Module=require('node:module'),filename=path.resolve(__dirname,'..',file),copy=new Module(filename,module);copy.filename=filename;copy.paths=Module._nodeModulePaths(path.dirname(filename));copy._compile(baselineSource(file),filename);return copy.exports;}
const detail=implementation('lib/cricket-scorecard.js'),model=implementation('config/match-centre.js'),parse=require('../lib/source-coverage').parseCricketFixtures;
const raw=require('./fixtures/cricket-gqeberha-innings-20261022.json'),checkedAt='2026-10-21T17:00:00.000Z',card=detail.normalize(raw,{fixtureId:39991,checkedAt});
const event={...parse([{...card.fixture,innings:card.innings}],{sourceUrl:detail.url(39991),checkedAt})[0],status:'stumps',statusText:'Stumps',cricketPhaseConfirmed:true,cricketBalance:card.balance,scoreCheckedAt:checkedAt,statusCheckedAt:checkedAt,sourceStale:false};
const out=process.env.CRICKET_INNINGS_CAPTURE,observations=[];
const baselineAssets=new Map(before?['config/score-details.js','config/cricket-innings.js','config/match-centre.js','assets/styles/score-details.css'].map(file=>['/'+file,baselineSource(file)]):[]);
const names=['Nic Maddinson','Travis Head','Marnus Labuschagne','Matt Renshaw','Beau Webster','Scott Boland'],yet=['Steve Smith','Alex Carey','Pat Cummins','Mitchell Starc','Josh Hazlewood'];
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
 try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block',timezoneId:'Australia/Sydney'}),errors=[];
  await page.clock.setFixedTime(new Date(checkedAt));page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const url=new URL(r.request().url());if(url.hostname!=='127.0.0.1')return r.abort();if(baselineAssets.has(url.pathname))return r.fulfill({body:baselineAssets.get(url.pathname),contentType:url.pathname.endsWith('.css')?'text/css':'application/javascript'});return r.fallback();});
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,followedSports:[],selectedSelectorEntityIds:[],fantasyDeadlines:{enabled:false},preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}})));
  let responseEvent=event,holdMembership=false,releaseMembership;
  await page.route('**/api/**',async r=>{const url=r.request().url();if(url.includes('/api/match-centre?')){const source=responseEvent;if(holdMembership)await new Promise(resolve=>{releaseMembership=resolve;});return r.fulfill({json:{enabled:true,events:[source],fixtures:[model.compact(source)],membershipStale:false,pagination:{nextCursor:null}}});}return r.fulfill({status:503,json:{}});});
  await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34119',{waitUntil:'domcontentloaded'});
  try{await page.locator('#startupLaunch').waitFor({state:'hidden'});}catch(error){console.error('Startup state',await page.evaluate(()=>({phase:startupFeedState.phase,errors:startupFeedState.errors,overlay:document.getElementById('startupLaunch')?.textContent})));throw error;}
  await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
  const captures={};
  async function capture(host,name){
   if(!out)return;fs.mkdirSync(out,{recursive:true});
   await host.evaluate(host=>{globalThis.inningsCaptureHidden=[];for(const element of document.querySelectorAll('body *'))if(!host.contains(element)&&!element.contains(host)&&['fixed','sticky'].includes(getComputedStyle(element).position)){globalThis.inningsCaptureHidden.push([element,element.style.visibility]);element.style.visibility='hidden';}});
   try{await host.screenshot({path:path.join(out,name)});}finally{await page.evaluate(()=>{for(const [element,visibility] of globalThis.inningsCaptureHidden)element.style.visibility=visibility;delete globalThis.inningsCaptureHidden;});}
  }
  async function inspect(host,surface){
   const select=host.getByRole('combobox',{name:'Scorecard innings'});await select.waitFor();await select.selectOption('3');
   const table=host.locator('table').filter({has:page.locator('caption',{hasText:'Batting ·'})});
   const displayed=await table.locator('tbody th').allTextContents();
   if(before){assert.equal(displayed[2],'Scott Boland');assert.equal(await host.locator('.scorecard-player-group').count(),0);}
   else{
    assert.deepEqual(displayed,names);assert.deepEqual(await host.getByRole('list',{name:'Yet to bat',exact:true}).locator('li').allTextContents(),yet);
    assert.equal(await select.locator('option:checked').textContent(),'Australia — 2nd innings · following on');
    for(const prefix of ['Total','Batting','Bowling'])if(prefix!=='Bowling'||card.innings[2].bowling.length)assert.equal(await host.locator('caption').filter({hasText:prefix+' · Australia — 2nd innings · following on'}).count(),1);
    assert(!/Batting order unavailable|estimated order/i.test(await host.innerText()));
    const stats=await table.locator('tbody tr').evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>c.textContent)));
    assert.deepEqual(stats.map(r=>r[2]),['8','87','39','11','8','2']);
   }
   if(out){const name=`${before?'before':'after'}-${engine}-${width}-${surface}.png`;await capture(host,name);captures[surface]=name;}
   if(!before){
    for(let repeat=0;repeat<3;repeat++)for(const n of ['2','1','3']){
     await select.selectOption(n);const i=card.innings.find(i=>String(i.inningNumber)===n),expected=i.batting.filter(b=>!b.didNotBat).map(b=>b.name);
     assert.deepEqual(await table.locator('tbody th').allTextContents(),expected);
    }
    assert.equal(await select.inputValue(),'3');
   }
   return displayed;
  }
  await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('tab',{name:'Everything',exact:true}).click();
  const mc=page.locator('[data-match-id="'+event.id+'"]');await mc.waitFor();await mc.locator('.mc-status').click();await inspect(mc,'match-centre');
  if(!before){
   await mc.getByRole('combobox',{name:'Scorecard innings'}).selectOption('2');
   await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await page.getByText('Latest available scores loaded.',{exact:true}).waitFor();
   assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).inputValue(),'2','Selection survives refresh');
   await mc.locator('.mc-status').click();await mc.locator('.mc-status').click();assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).inputValue(),'2','Selection survives reopening');
   responseEvent=structuredClone(event);responseEvent.scoreCheckedAt=responseEvent.statusCheckedAt='2026-10-21T16:00:00.000Z';responseEvent.innings[2]={...responseEvent.innings[1],inningNumber:3};
   await page.clock.setFixedTime(new Date(Date.parse(checkedAt)+11000));await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await page.getByText('Latest available scores loaded.',{exact:true}).waitFor();
   assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).inputValue(),'2');await inspect(mc,'older-response');responseEvent=event;
  }
  await page.locator('.tabs [data-tab=feed]').click();
  await page.evaluate(f=>{const host=document.createElement('section');host.id='inningsDisplayEvidence';document.body.append(host);setCardState(f,'opened');host.append(buildEventCard(f,{mode:'feed'}));},event);
  const feed=page.locator('#inningsDisplayEvidence .event-card');await inspect(feed,'feed');
  if(!before){
   // The same shared component is also used by Schedule and profile reveal.
   await page.evaluate(f=>{const host=document.getElementById('inningsDisplayEvidence');host.replaceChildren();setCardState(f,'opened');host.append(buildEventCard(f,{mode:'schedule'}));},event);
   await inspect(page.locator('#inningsDisplayEvidence .event-card'),'schedule');
   await page.locator('.tabs [data-tab=match-centre]').click();assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).inputValue(),'3','Fixture selection survives cross-surface navigation');
   const captions=await mc.locator('caption').allTextContents();assert(captions.some(x=>x.includes('Australia — 2nd innings')));
   await mc.getByRole('combobox',{name:'Scorecard innings'}).focus();assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).evaluate(e=>e===document.activeElement),true);
   holdMembership=true;await page.clock.setFixedTime(new Date(Date.parse(checkedAt)+22000));await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();
   for(let wait=0;!releaseMembership&&wait<100;wait++)await page.evaluate(()=>new Promise(requestAnimationFrame));assert(releaseMembership,'Refresh reaches the controlled delayed response');
   const response=page.waitForResponse(r=>r.url().includes('/api/match-centre?'));await page.locator('.tabs [data-tab=feed]').click();holdMembership=false;releaseMembership();await response;
   assert.equal(await page.locator('.match-centre-card').count(),0,'Late response cannot redraw a different surface');
   await page.locator('.tabs [data-tab=match-centre]').click();await mc.waitFor();assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).inputValue(),'3');
   const longNames=structuredClone(event);longNames.innings[2].batting[2].name='Marnus Labuschagne — controlled very long display name for horizontal table scrolling';longNames.innings[2].batting.find(b=>b.name==='Steve Smith').name='Steve Smith — controlled very long display name that must wrap inside one separate player row';
   longNames.innings[2].batting[1].dismissalType=longNames.innings[2].batting[1].dismissal='retired hurt';const absent=longNames.innings[2].batting.find(b=>b.name==='Alex Carey');absent.dismissalType=absent.dismissal='absent hurt';
   await page.evaluate(f=>{const host=document.createElement('section');host.id='inningsDisplayLongNames';host.append(NOTHINGSPORTS_SCORE_DETAILS.cricket(f.innings,{selectedInnings:'3',fixtureId:'long-name-status-control'}));document.body.append(host);},longNames);
   const longHost=page.locator('#inningsDisplayLongNames');assert.equal(await longHost.getByRole('list',{name:'Absent hurt',exact:true}).locator('li').textContent(),'Alex Carey');
   assert((await longHost.locator('table').filter({has:page.locator('caption',{hasText:'Batting ·'})}).innerText()).includes('retired hurt'));assert.equal(await longHost.getByRole('list',{name:'Yet to bat',exact:true}).locator('li').count(),4);
   if(out)await capture(longHost,`after-${engine}-${width}-long-names-statuses.png`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  observations.push({engine,width,stage:before?'before':'after',historicalReconstruction:true,sourceFactsUnchanged:true,bugReproduced:before,repeatedInningsSwitches:before?0:36,refreshReopenNavigation:!before,olderAndDelayedResponses:!before,longNamesAndRetiredAbsent:!before,screenCaptures:captures,errors});
  console.log(JSON.stringify(observations.at(-1)));await page.close();
 }}finally{await browser.close();}
}if(out)fs.writeFileSync(path.join(out,(before?'before':'after')+'-browser-evidence.json'),JSON.stringify({observations,physicalDevice:false,liveProduction:false},null,2)+'\n');})().catch(e=>{console.error(e);process.exitCode=1;});
