'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const retained=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.filter(e=>e.sessionOrderEvidence);
const estimated=require('../lib/session-order-estimates').apply(retained,new Date('2026-10-10T23:00:00Z')).find(e=>e.id.endsWith('184929'));
const evidence=[];
(async()=>{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',timezoneId:'Australia/Sydney'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-10T23:00:00Z'));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({version:27,onboardingComplete:true,showSpoilers:false,followFirst:{notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}})));
 await page.goto(process.env.MATCH_CENTRE_QA_URL||'http://127.0.0.1:34109');await page.locator('#startupLaunch').waitFor({state:'hidden'});
 for(const results of [false,true])for(const surface of ['feed','events','match-centre']){
  const report=await page.evaluate(({estimated,results,surface})=>{
   setTunePromptOpen(false);suppressSessionRatingPrompt();userPreferences.showSpoilers=results;activeTab=surface;const settingsBefore=JSON.stringify(userPreferences.followFirst.notifications);
   document.getElementById('usefulStartsTest')?.remove();const host=document.createElement('section');host.id='usefulStartsTest';document.body.append(host);
   const final={...estimated,id:'useful-starts-final',eventId:'useful-starts-final',canonicalEventId:'useful-starts-final',sourceEventIds:[],status:'completed',scheduleStatus:'completed',date:'2026-10-10',startTimeUtc:'2026-10-10T09:05:00Z',timePrecision:'exact',timeTbc:false,startTimeTbc:false,manualStartEstimate:null,sessionOrderEvidence:null,estimatedStartTimeUtc:null,homeScore:24,awayScore:22,score:{home:24,away:22}};
   const fixtures=[final,{...final,id:'useful-starts-unknown',eventId:'useful-starts-unknown',startTimeUtc:null},estimated];
   const before=JSON.stringify(fixtures),labels=[];
   for(const fixture of fixtures){const local=[];for(const state of ['compact','selected','opened']){setCardState(fixture,state);const card=buildEventCard(fixture,{mode:surface==='events'?'events':'feed'});host.append(card);const timing=card.querySelector('.compact-card-time,.fixture-timing-badge,.compact-card-meta,.event-date-chip');local.push({state,label:timing?.textContent||'',aria:timing?.getAttribute('aria-label')||'',text:card.innerText});}const shared=buildFixtureTimingGroup(fixture);host.append(shared);labels.push({variants:local,shared:shared.innerText});}
   return {labels,immutable:JSON.stringify(fixtures)===before,settingsBefore,settingsAfter:JSON.stringify(userPreferences.followFirst.notifications),results:userPreferences.showSpoilers};
  },{estimated,results,surface});
  assert(report.immutable);assert.equal(report.results,results);assert.equal(report.settingsAfter,report.settingsBefore,'Rendering cannot enable notifications');
  for(const row of report.labels[0].variants)assert.match(row.label,/SCHEDULED (?:8:05 PM|20:05)/,JSON.stringify({engine,width,surface,row}));
  for(const row of report.labels[1].variants){assert(!/START (?:UNAVAILABLE|TBD)|TIME (?:UNAVAILABLE|TBD)/.test(row.label));}
  for(const row of report.labels[2].variants)assert.match(row.label,/APPROX\. (?:4:45 PM|16:45)/);
  assert.match(report.labels[0].shared,/SCHEDULED 8:05 PM/);assert.match(report.labels[2].shared,/APPROX\. 4:45 PM/);
  if(!results)for(const item of report.labels)for(const row of item.variants)assert(!/24\s*[–—-]\s*22/.test(row.text+' '+row.aria),'Results OFF has no paired outcome');
  assert.deepEqual(errors,[]);evidence.push({engine,width,surface,results,sharedNativeTiming:true,compactAndExpanded:true,immutable:true,errors:[]});
 }
 await page.close();
 }}finally{await browser.close();}}if(process.env.USEFUL_STARTS_EVIDENCE)fs.writeFileSync(process.env.USEFUL_STARTS_EVIDENCE,JSON.stringify({checkedAt:new Date().toISOString(),controlledRenderer:true,physicalDevice:false,evidence},null,2)+'\n');console.log(JSON.stringify({passed:true,cases:evidence.length,engines:['chromium','webkit'],realPush:false}));})().catch(e=>{console.error(e);process.exitCode=1;});
