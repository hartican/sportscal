'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const timing=require('../config/card-timing'),identity=require('../config/fixture-identity'),capture=require('./fixtures/cricket-score-address-20261020.json');
const raw=capture.rows.find(r=>r.source_id==='cricket-ca-current').fixture;
const published={...capture.published,homeParticipantId:'team:cricket:south-africa',awayParticipantId:'team:cricket:australia'};
const selected=identity.mergeOverlays([published],[raw])[0],now=capture.clock,options={fullRange:true,compactCricket:true};
const known={...selected,matchDaySourceUrl:'https://www.cricket.com.au/controlled-day-proof'};
function check(event){const before=JSON.stringify(event),value=timing.badgePresentation(event,now,options);assert.equal(JSON.stringify(event),before,'presentation preserves all sporting facts and clocks');assert(Object.isFrozen(value));return value;}
const sample=check(known);
assert.equal(sample.day,'DAY 2','compact summary uses the source-backed day instead of the full date range');
assert.equal(sample.badgeClock,'SCHEDULED 7:00 PM','Stumps retains the authoritative scheduled clock with the existing Sydney formatter');assert.equal(sample.badgeStatus,'STUMPS');assert.match(sample.fullSchedule,/18 OCT.*22 OCT/);
assert.equal(check(selected).day,'','The retained selected overlay lacks the required day-proof URL; do not invent one');
for(const day of [{matchDay:null},{matchDay:0},{matchDay:6},{matchDaySourceUrl:null}]){const value=check({...known,...day});assert.equal(value.day,'');assert(!value.ariaLabel.includes('DAY UNCONFIRMED'));}
assert.equal(check({...known,format:'First-class',matchFormat:'First-class',numberOfDays:4}).day,'DAY 2');
assert.equal(timing.presentation({...known,format:'First-class',matchFormat:'First-class',numberOfDays:4},now).progress,null,'first-class compact opt-in does not change other presentation surfaces');
assert.equal(check({...known,startTimeUtc:'2026-10-03T16:30:00Z'}).badgeClock,'SCHEDULED 3:30 AM','existing formatter handles Sydney DST');
const reported={...known,status:'live',actualStartTimeUtc:'2026-10-18T08:05:00Z',actualStartEvidence:{kind:'publisher-reported-match-start',verified:true,startsAt:'2026-10-18T08:05:00Z',checkedAt:'2026-10-18T09:00:00Z',sourceUrl:'https://www.cricket.com.au/controlled-start',fixtureId:known.id,participantIds:known.participantIds}};
assert.equal(check(reported).badgeClock,'SCHEDULED 7:00 PM','compact planned time does not become the reported actual start');assert.match(timing.presentation(reported,now).fullSchedule,/REPORTED START 7:05 PM/,'Details retain the separately confirmed actual start');assert.match(check({...reported,status:'completed'}).badgeClock,/REPORTED START 7:05 PM/,'existing terminal reported-start support is retained');
for(const missing of [{startTimeUtc:null},{timeTbc:true},{dateOnly:true},{timePrecision:'unconfirmed'}])assert.equal(check({...known,...missing}).badgeClock,'','unknown start is never manufactured');
const paused={...known,status:'suspended',statusText:'Rain',restartTimeUtc:'2026-10-20T08:00:00Z',restartSourceUrl:'https://www.cricket.com.au/controlled-resumption',restartSourceCheckedAt:now};
const restart=check(paused);assert.equal(restart.badgeClock,'SCHEDULED 7:00 PM');assert.match(restart.badgeStatus,/PLAY SUSPENDED · RAIN.*Live again at/i);
assert(!check({...paused,restartSourceUrl:null}).badgeStatus.includes('Live again'),'bare restart is not confirmed');
assert.match(check({...paused,restartTimeUtc:'2026-10-19T08:00:00Z'}).badgeStatus,/Awaiting resumption update/);
assert.equal(timing.badgePresentation({...selected,matchDay:null},'2026-10-21T21:20:55Z',options).day,'','elapsed calendar days never establish a Test day');
assert.match(check({...known,status:'live',stale:true}).badgeStatus,/LAST REPORTED LIVE/);assert.equal(check({...known,status:'live',stale:true}).badgeFreshness,'Awaiting update');
for(const status of ['completed','abandoned','cancelled','postponed'])assert.equal(check({...known,status}).badgeClock,'','settled/withdrawn compact badge does not revive scheduled play');
for(const event of [{...known,key:'football'},{...known,format:'ODI',matchFormat:'ODI',numberOfDays:1}])assert.deepEqual(timing.badgePresentation(event,now,options),timing.badgePresentation(event,now,{fullRange:true}),'other sports and single-day Cricket remain unchanged');

(async()=>{const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent('<article class="event-card feed-fixture"><div class="event-main"><span class="compact-card-time"></span></div></article>');await page.clock.setFixedTime(new Date(now));
 for(const file of ['config/card-timing.js','config/match-centre.js','config/feed-live-scores.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
 await page.addScriptTag({content:require('./app-shell-test-utils').readCardFunction('buildFixtureTimingBadge')});
 const result=await page.evaluate(({published,selected,known,now})=>{globalThis.activeTab='feed';globalThis.nowAEST=()=>new Date(now);globalThis.NOTHINGSPORTS_FEED_TIMELINE={finalDay:()=>true};globalThis.openFixtureFromTimingCapsule=()=>{};
  const card=document.querySelector('article'),main=card.firstElementChild;main.append(buildFixtureTimingBadge(published));
  const values=()=>{const b=card.querySelector('.fixture-timing-badge');return{day:b.querySelector('.fixture-timing-day')?.textContent||'',clock:b.querySelector('.fixture-timing-clock')?.textContent||'',status:b.querySelector('.fixture-timing-status:not(.fixture-timing-freshness)')?.textContent||'',compact:card.querySelector('.compact-card-time').textContent,full:b.title,progressCount:b.querySelectorAll('.fixture-source-progress').length,scoreCount:card.querySelectorAll('.feed-live-score').length};};
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(card,selected,{resultsOn:false});const patched=values();const fresh=buildFixtureTimingBadge(selected);const before=card.querySelector('.fixture-timing-badge');before.replaceWith(fresh);const constructed=values();
  NOTHINGSPORTS_FEED_LIVE_SCORES.install(card,known,{resultsOn:false});const knownOff=values();NOTHINGSPORTS_FEED_LIVE_SCORES.install(card,known,{resultsOn:true,now:Date.parse(now)});const knownOn=values();return{patched,constructed,knownOff,knownOn};
 },{published,selected,known,now});
 assert.deepEqual(result.patched,result.constructed,'selected overlay live patch and ordinary constructor use one timing rule');assert.equal(result.patched.day,'');assert.equal(result.patched.status,'STUMPS');assert.equal(result.patched.clock,'SCHEDULED 7:00 PM');assert.equal(result.patched.progressCount,0);assert.equal(result.knownOff.day,'DAY 2');assert.equal(result.knownOff.compact,'DAY 2 · SCHEDULED 7:00 PM · STUMPS');assert.equal(result.knownOff.scoreCount,0,'Results OFF retains phase without score');assert.equal(result.knownOn.scoreCount,1,'Results ON retains the existing sourced score');assert.equal(result.knownOn.status,'STUMPS');
 console.log('Cricket compact summary: actual selected overlay, ordinary constructor/live patch parity, source day, scheduled clock, genuine phase, privacy, stale/revised/settled/DST and unchanged single-day cases passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
