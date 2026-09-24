'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const events=require('../data/events.json').events;
const fixtures=[events.find(e=>e.id==='major-match-nrl-finals-2026-preliminary-final-2'),events.find(e=>e.id==='event-afl-cd_m20260142901'),events.find(e=>e.id==='football-australia-brazil-2026-09-25'),require('../data/follow-schedule/cricket.json').fixtures.find(e=>e.id==='fixture:cricket:CA:39987'),require('../data/canonical/tennis-team-contests.v1.json').fixtures.find(e=>e.id==='fixture:tennis:bjk-cup:2026:finals:sf2'),events.find(e=>e.key==='tennis'&&e.participantIds?.[0]?.startsWith('athlete:')),events.find(e=>e.key==='golf'),events.find(e=>e.key==='f1'&&e.venueCountryCode)];
assert(fixtures.every(Boolean),'all eight representative fixtures exist');
(async()=>{const browser=await(process.env.QA_BROWSER==='webkit'?webkit:chromium).launch(process.env.QA_BROWSER==='webkit'?{}:{channel:'chrome'});try{
for(const width of [320,390,768,1280])for(const theme of ['day','night']){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33979');await page.waitForFunction(()=>typeof buildEventCard==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating());
 for(const compact of [false,true])for(const ev of fixtures){
  await page.evaluate(({ev,theme,compact})=>{document.querySelectorAll('[role=dialog]').forEach(n=>n.parentElement.style.display='none');document.getElementById('startupLaunch')?.remove();document.documentElement.dataset.theme=theme;activeTab='feed';setCardState(ev,compact?'compact':'selected');document.querySelector('#listView').replaceChildren(buildEventCard(ev));observeDeferredCardImages();},{ev,theme,compact});
  const card=page.locator('#listView .event-card');await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('#listView img[data-identity-image]')].every(i=>i.naturalWidth>0&&getComputedStyle(i).opacity!=='0'),null,{timeout:12000});
  const result=await card.evaluate(c=>{const rect=n=>n.getBoundingClientRect().toJSON();return {box:rect(c),text:c.innerText,header:c.querySelector('.fixture-card-header')?.innerText,links:c.querySelectorAll('.feed-schedule-link').length,footer:!!c.querySelector('.fixture-card-footer .fixture-more'),logos:[...c.querySelectorAll('.matchup-team-logo')].map(i=>({image:rect(i),frame:rect(i.parentElement)})),targets:[...c.querySelectorAll('.nsc-rating-block,.provider-link,.fixture-more,.fixture-profile-link,.fixture-competition-link')].map(rect),backgrounds:[...c.querySelectorAll('.provider-action-mark')].map(n=>getComputedStyle(n).backgroundColor),tournamentLogo:c.querySelector('.fixture-competition-link img')?.getAttribute('src')};});
  assert.equal(result.links,1,'one scoped schedule link');assert(result.footer,'shared action footer');assert(result.header,'competition identity');
  for(const t of result.targets)assert(t.width>=43.9&&t.height>=43.9,`${ev.id}: 44px targets ${JSON.stringify(t)}`);
  for(const {image:i,frame:f} of result.logos)assert(i.top>=f.top-.5&&i.left>=f.left-.5&&i.right<=f.right+.5&&i.bottom<=f.bottom+.5,'contained, uncropped logo element');
  assert(result.backgrounds.every(x=>x==='rgba(0, 0, 0, 0)'),'no decorative provider backplates');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scrolling');
  if(ev.key==='afl')assert(/Dockers/.test(result.text)&&/Lions/.test(result.text),'club nicknames');
  if(ev.key==='football')assert(/Socceroos/.test(result.text),'national nickname');
  if(ev.competitionId?.startsWith('competition:tennis:us-open')){assert(result.tournamentLogo?.includes('us-open-wordmark'),'real tournament mark on singles');assert(/US Open/.test(result.header)&&/singles/i.test(result.header),'tournament and sporting format label');}
  if(ev.key==='football')assert(!result.header.includes(' · '),'no repeated competition label');
  if(ev.contestUnit==='tie')assert(result.tournamentLogo?.includes('billie-jean-king-cup'),'real tournament mark on team ties');
  if(width===390&&!compact&&['afl','nrl'].includes(ev.key))assert(result.box.height<563,'at least 20% shorter than fixed 703px baseline');
 }
 console.log(`${width}/${theme}: eight formats, full/compact, decoded identities, shared footer, one tournament link, 44px targets, no overflow`);await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
