'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),model=require('../config/match-centre');
const cricket=require('../data/follow-schedule/cricket.json').fixtures.find(f=>f.sourceEventIds?.includes('fixture:cricket:CA:39990'));
const golf=require('../data/follow-schedule/golf.json').fixtures.find(f=>f.id==='fixture:golf:pga:R2026527');
const china=require('../data/tennis-feed-parents.v1.json').parents.find(f=>f.id==='tennis-parent:china-open:2026:main');
const football=require('../data/code-inspector/champions-league.json').fixtures.find(f=>f.goalScorers?.some(g=>g.name==='John McGinn'));
const observations=[];
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',timezoneId:'Australia/Sydney'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,followedSports:[],selectedSelectorEntityIds:[],fantasyDeadlines:{enabled:false},preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'},{participantId:'competitor:golf:min-woo-lee',followLevel:'follow'},{participantId:'competitor:tennis:wta:aryna-sabalenka',followLevel:'follow'}]}})));
  await page.route('**/api/**',r=>{const url=r.request().url();if(url.includes('/api/match-centre?'))return r.fulfill({json:{enabled:true,events:[cricket],fixtures:[model.compact(cricket)],membershipStale:false,pagination:{nextCursor:null}}});return r.fulfill({status:503,json:{}});});
  await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34109',{waitUntil:'domcontentloaded'});
  await page.locator('#startupLaunch').waitFor({state:'hidden'});
  await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
  async function tables(host){
   const select=host.getByRole('combobox',{name:'Scorecard innings'});await select.waitFor();assert.equal(await select.locator('option').count(),2);
   for(const i of cricket.innings){await select.selectOption(String(i.inningNumber));const batting=host.locator('table').filter({has:page.locator('caption', {hasText:'Batting ·'})}),bowling=host.locator('table').filter({has:page.locator('caption',{hasText:'Bowling ·'})});
    assert.equal(await batting.locator('tbody tr').count(),11);assert.equal(await bowling.locator('tbody tr').count(),i.bowling.length);
    for(const b of i.batting){const cells=await batting.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:b.name,exact:true})}).locator('th,td').allTextContents();assert.deepEqual(cells,[b.name,b.dismissal??'—',...['runs','balls','fours','sixes','strikeRate'].map(k=>String(b[k]??'—'))]);}
    for(const b of i.bowling){const cells=await bowling.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:b.name,exact:true})}).locator('th,td').allTextContents();assert.deepEqual(cells,[b.name,...['overs','maidens','runs','wickets','economy','wides','noBalls'].map(k=>String(b[k]??'—'))]);}
    assert.equal(await host.locator('table').filter({has:page.locator('caption',{hasText:'Fall of wickets ·'})}).locator('tbody tr').count(),i.wickets.length);
   }
  }
  await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('tab',{name:'Everything',exact:true}).click();
  const mc=page.locator('[data-match-id="'+cricket.canonicalEventId+'"]');await mc.waitFor();await mc.locator('.mc-status').click();await tables(mc);
  assert.match(await mc.innerText(),/Stumps/);assert.match(await mc.innerText(),/South Africa trail Australia by 363 runs/);assert.match(await mc.innerText(),/Play resumes.*6:30 pm.*AEDT/i);
  assert.equal(await mc.getByRole('link',{name:'Official scorecard'}).getAttribute('href'),'https://www.cricket.com.au/matches/CA%3A39990');
  await mc.getByRole('combobox',{name:'Scorecard innings'}).selectOption('1');await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();await page.getByText('Latest available scores loaded.',{exact:true}).waitFor();assert.equal(await mc.getByRole('combobox',{name:'Scorecard innings'}).inputValue(),'1','Selected innings and expansion survive refresh');
  await page.locator('.tabs [data-tab=feed]').click();
  const ordinaryFeed=page.locator('#listView .event-card[data-event-id="'+cricket.id+'"]');await ordinaryFeed.waitFor();
  await ordinaryFeed.locator('[data-card-control="disclosure"]').click();await tables(ordinaryFeed);assert.match(await ordinaryFeed.innerText(),/Play resumes.*6:30 pm.*AEDT/i);
  if(process.env.FULL_SCORECARD_CAPTURE){fs.mkdirSync(process.env.FULL_SCORECARD_CAPTURE,{recursive:true});await ordinaryFeed.screenshot({path:path.join(process.env.FULL_SCORECARD_CAPTURE,engine+'-'+width+'-ordinary-feed-cricket.png')});}
  await page.evaluate(({cricket,golf,china})=>{const host=document.createElement('section');host.id='fullScorecardEvidence';document.body.append(host);for(const f of [cricket]){setCardState(f,'opened');multiDayCricketExpanded.add(f.id);host.append(buildEventCard(f,{mode:'feed'}));}host.append(buildTournamentMarker(golf),buildTournamentMarker(china));},{cricket,golf,china});
  const feed=page.locator('#fullScorecardEvidence .event-card[data-event-id="'+cricket.id+'"]');await tables(feed);assert.match(await feed.innerText(),/Play resumes.*6:30 pm.*AEDT/i);assert.equal(await feed.getByRole('link',{name:'Official scorecard'}).getAttribute('href'),'https://www.cricket.com.au/matches/CA%3A39990');if(process.env.FULL_SCORECARD_CAPTURE){fs.mkdirSync(process.env.FULL_SCORECARD_CAPTURE,{recursive:true});await feed.screenshot({path:path.join(process.env.FULL_SCORECARD_CAPTURE,engine+'-'+width+'-cricket.png')});}
  const bay=page.locator('#fullScorecardEvidence [data-event-id="'+golf.id+'"]');assert.equal(await bay.locator('details').getAttribute('open'),null);await bay.locator('summary').click();await bay.getByRole('heading',{name:'Followed round scores'}).waitFor();const bayText=await bay.innerText();assert.match(bayText,/Min Woo Lee/);for(const [n,s] of golf.roundScores.find(r=>r.participantId==='competitor:golf:min-woo-lee').rounds.entries())assert(bayText.includes('R'+(n+1)+' '+s));assert(!/Adam Scott|Wyndham Clark|Xander Schauffele|Ben Kohles|Christiaan Bezuidenhout/.test(bayText),'Golf detail contains only the followed athlete');
  const beijing=page.locator('#fullScorecardEvidence [data-event-id="'+china.id+'"]');await beijing.locator('summary').click();await beijing.getByRole('button',{name:'Open in Events',exact:true}).waitFor();assert(await beijing.locator('.event-card').count()>0,'China Open supplies actual followed fixtures or latest results');
  const consent=await page.evaluate(()=>JSON.stringify([userPreferences.preferenceGraph,userPreferences.followFirst.eventEditionDecisions]));
  await page.evaluate(()=>{userPreferences.surfaceCategories={...userPreferences.surfaceCategories,events:'football'};userPreferences.eventsScope='followed';});
  await bay.getByRole('button',{name:'Open in Events',exact:true}).click();const target=page.locator('[data-event-overview-id="overview:golf:R2026527:2026"]');await target.waitFor();await page.waitForFunction(()=>document.activeElement?.dataset.eventOverviewId==='overview:golf:R2026527:2026');assert(await target.locator('details').first().getAttribute('open')!==null);assert.equal(await page.evaluate(()=>JSON.stringify([userPreferences.preferenceGraph,userPreferences.followFirst.eventEditionDecisions])),consent,'Temporary Events target reveal preserves follow consent');
  await page.goBack();await page.waitForFunction(()=>activeTab==='feed');
  const toggle=await page.evaluate(()=>{
   const list=document.getElementById('listView');list.replaceChildren();const today=document.createElement('div');today.id='calendarTodayAnchor';today.textContent='Today';const space=document.createElement('div');space.style.height='1100px';list.append(today,space,buildFeedNowMarker());activeTab='feed';activeView='list';activeInspectorCodeId=null;activeFilter='all';
   scrollActiveFeedToInitialAnchor({behavior:'auto'});syncContextualJumpButton();const b=document.getElementById('jumpTodayBtn');return {label:b.textContent.trim(),aria:b.getAttribute('aria-label'),destination:b.dataset.jumpDestination};
  });assert.deepEqual(toggle,{label:'Jump to Today',aria:'Jump to Today',destination:'today'});
  await page.locator('#jumpTodayBtn').click();await page.waitForFunction(()=>document.getElementById('jumpTodayBtn').dataset.jumpDestination==='now');assert.equal(await page.locator('#jumpTodayBtn').getAttribute('aria-label'),'Jump to Now');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  // Rehearse actual published goal facts with a controlled current membership;
  // the historical fixture is not claimed to be live in production.
  const replay={...football,status:'ongoing',statusCheckedAt:new Date().toISOString(),scoreCheckedAt:new Date().toISOString()};
  await page.route('**/api/match-centre?**',r=>r.fulfill({json:{enabled:true,events:[replay],fixtures:[model.compact(replay)],membershipStale:false,pagination:{nextCursor:null}}}));
  await page.locator('.tabs [data-tab=match-centre]').click();await page.getByRole('button',{name:'Refresh Match Centre',exact:true}).click();
  const goalCard=page.locator('[data-match-id="'+football.canonicalEventId+'"]');await goalCard.waitFor();await goalCard.locator('.mc-status').click();
  async function goalRows(host){const t=host.locator('table').filter({has:page.locator('caption',{hasText:'Goals',exact:true})});await t.waitFor();assert.equal(await t.locator('tbody tr').count(),football.goalScorers.length);for(const g of football.goalScorers){const cells=await t.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:g.name,exact:true})}).locator('th,td').allTextContents();assert.deepEqual(cells,[g.name,String(g.minute)+'′',g.ownGoal?'Own goal':g.penalty?'Penalty':'Goal',g.teamName]);}}
  await goalRows(goalCard);await page.locator('.tabs [data-tab=feed]').click();
  await page.evaluate(f=>{const host=document.getElementById('fullScorecardEvidence');host.replaceChildren();setCardState(f,'opened');host.append(buildEventCard(f,{mode:'feed'}));},football);
  const goalFeed=page.locator('#fullScorecardEvidence .event-card');await goalRows(goalFeed);assert.equal(await goalFeed.getByRole('link',{name:'Source scorecard'}).getAttribute('href'),football.scorecardUrl);
  const result={engine,width,realCricketRows:true,bothCards:true,stumpsRestart:true,selectionRefresh:true,followedTournamentDetails:true,exactEventsAndBack:true,jumpToggle:true,noPageOverflow:true,errors};observations.push(result);console.log(JSON.stringify(result));
  if(process.env.FULL_SCORECARD_CAPTURE){fs.mkdirSync(process.env.FULL_SCORECARD_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.FULL_SCORECARD_CAPTURE,engine+'-'+width+'.png'),fullPage:false});}
  await page.close();
 }}finally{await browser.close();}
}if(process.env.FULL_SCORECARD_CAPTURE)fs.writeFileSync(path.join(process.env.FULL_SCORECARD_CAPTURE,'browser-evidence.json'),JSON.stringify({checkedAt:new Date().toISOString(),observations,physicalDevice:false,realPush:false},null,2)+'\n');})().catch(e=>{console.error(e);process.exitCode=1;});
