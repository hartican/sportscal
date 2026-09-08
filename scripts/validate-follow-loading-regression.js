#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.route('**/api/fixtures*',r=>r.fulfill({status:304}));await page.route('**/data/code-inspector/tennis.json',r=>r.fulfill({json:{standings:[{}]}}));await page.route('**/data/follow-directory/tennis.v1.json',async r=>{await new Promise(resolve=>setTimeout(resolve,250));await r.continue();});await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());await page.evaluate(()=>{const p=clonePreferences(userPreferences);p.onboardingComplete=true;p.selectedSelectorEntityIds=['sport:afl-premiership','sport:nrl','sport:cricket','sport:rugby','sport:tennis','sport:f1'];p.followedSports=canonicalSportKeysForSelectorIds(p.selectedSelectorEntityIds);p.preferenceGraph={...p.preferenceGraph,entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]};p.followBrowse={sportId:'sport:cricket',categoryId:'sport:cricket',section:'teams-players'};savePreferences(p);});await page.reload();await page.waitForFunction(()=>!startupCoordinator.isHydrating());const expected=require('../lib/competition-fixtures').fixtures().filter(e=>['afl','nrl'].includes(e.key)&&require('../config/fixture-identity').retainedInActiveTimeline(e,new Date()));
await page.waitForFunction(()=>document.querySelectorAll('[data-feed-event-id]').length>0);
const ids=await page.locator('[data-feed-event-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.feedEventId));for(const e of expected)assert(ids.includes(e.id),'AFL/NRL final reaches Feed: '+e.id);
const f1=require('../data/events.json').events.filter(e=>e.key==='f1'&&require('../config/fixture-identity').retainedInActiveTimeline(e,new Date())&&/ (Race|Qualifying)$/.test(e.name));
assert(f1.length>=20,'retained Monza and upcoming F1 sessions exist');for(const e of f1)assert(ids.includes(e.id),'F1 follow reaches Feed without a driver follow: '+e.id);
for(const id of ['fixture:cricket:espn:1552021', 'fixture:cricket:espn:1535537', 'fixture:cricket:CA:40955', 'fixture:cricket:CA:24494', 'fixture:cricket:espn:1535536', 'fixture:cricket:espn:1535538', 'fixture:cricket:espn:1552908', 'fixture:cricket:espn:1535539', 'fixture:cricket:espn:1552909', 'fixture:cricket:espn:1552915', 'fixture:rugby:wr:5147ecd2-57bc-4d17-af31-4b30c53fee9c', 'fixture:rugby:wr:c6694a4f-ec95-4f16-94b4-c6509721151d'])assert(!ids.includes(id),'screenshot fixture excluded: '+id);
for(const e of [...expected,...f1]){const slot=page.locator('[data-feed-event-id=\"'+e.id+'\"]');await slot.scrollIntoViewIfNeeded();await slot.locator('.event-card').waitFor({state:'visible'});assert(await page.locator('.feed-card-slot .event-card').count()<=60,'bounded mounted cards');}
await page.getByRole('button',{name:'Follow',exact:true}).first().click();await page.locator('.follow-directory-row').first().waitFor();await page.evaluate(()=>{saveFollowBrowse({sportId:'sport:tennis',categoryId:'sport:tennis',section:'teams-players'});renderFollowView();});await page.waitForFunction(()=>followDirectoryChunks.has('tennis'));await page.waitForTimeout(350);assert(await page.locator('.follow-directory-row').count()>0,'Downloaded Tennis directory must replace Loading without another click or unrelated request');for(const [key,count,first] of [['cricket',24,'Australia'],['rugby',35,'Wallabies']]){await page.evaluate(key=>{const entity=BASE_SPORT_SELECTOR_ENTITIES.find(e=>Number(e.level)===2&&(e.id==='sport:'+key || key==='rugby'&&/Rugby Union/.test(e.label)));if(!entity)throw Error(key);saveFollowBrowse({sportId:entity.id,categoryId:entity.id,section:'teams-players'});renderFollowView();},key);await page.waitForFunction(({count})=>document.querySelectorAll('.follow-directory-row').length===count,{count});assert((await page.locator('.follow-directory-row').first().innerText()).includes(first));}
const failureContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const failurePage=await failureContext.newPage();
let failTennis=true,tennisRequests=0;
const unhandled=[];failurePage.on('pageerror',error=>unhandled.push(error.message));
await failurePage.route('**/data/follow-directory/tennis.v1.*',route=>{tennisRequests++;return failTennis?route.fulfill({status:503,body:'Unavailable'}):route.continue();});
await failurePage.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
await failurePage.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
await failurePage.evaluate(()=>{const next=clonePreferences(userPreferences);next.onboardingComplete=true;savePreferences(next);});
await failurePage.reload();await failurePage.waitForFunction(()=>!startupCoordinator.isHydrating());
await failurePage.getByRole('button',{name:'Follow',exact:true}).first().click();
await failurePage.evaluate(()=>{saveFollowBrowse({sportId:'sport:tennis',categoryId:'sport:tennis',section:'teams-players'});renderFollowView();});
await failurePage.getByText('Tennis teams and players are temporarily unavailable.',{exact:false}).waitFor();
const failedRequests=tennisRequests;await failurePage.waitForTimeout(800);
assert.equal(tennisRequests,failedRequests,'failed Tennis requests must not loop on every render');
assert.deepEqual(unhandled,[],'failed collection requests must be handled');
failTennis=false;await failurePage.getByRole('button',{name:'Retry',exact:true}).click();
await failurePage.locator('.follow-directory-row').first().waitFor();
assert(await failurePage.locator('.tennis-collection-toggle').count()>0,'retry restores collections and player rows');
await failureContext.close();
console.log('Tennis first-load rendering, failure/retry, curated Cricket/Rugby ordering and finals reconciliation passed.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
