#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,768,1280])for(const theme of ['day','night']){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
  await page.addInitScript(()=>localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,followedSports:['tennis'],selectedSelectorEntityIds:['sport:tennis']})));
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
  await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
  await page.waitForFunction(()=>typeof openCodeInspector==='function'&&typeof userPreferences==='object');
  await page.evaluate(async theme=>{applyThemePreference(theme);await openCodeInspector('sport:tennis');await loadTennisScheduleUi();await loadTennisTournamentCatalogue();renderCodeInspector();},theme);
  await page.getByRole('combobox',{name:'Tournament and edition'}).waitFor();
  const current=await page.getByRole('combobox',{name:'Tournament and edition'}).inputValue();assert(current.includes('bjk-cup'),'current tournament opens by default');
  await page.getByRole('combobox',{name:'Tournament and edition'}).selectOption('tournament:tennis:grand-slam-us-open-2026');
  assert(await page.locator('.tennis-schedule-round').count()>1,'rounds grouped within tournament');
  const older=await page.locator('.tennis-schedule-round').evaluateAll(rows=>rows.map(r=>({open:r.open,text:r.querySelector('summary').textContent})));
  assert(older.some(r=>r.open)&&older.some(r=>!r.open),'latest completed rounds open; earlier rounds deliberately collapsed');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'schedule horizontal overflow');
  await page.evaluate(()=>{activeInspectorCodeId=null;activeTab='follow';saveFollowBrowse({sportId:'sport:tennis',categoryId:'sport:tennis',section:'major-events'});renderFollowView();});
  assert.equal(await page.locator('.tennis-catalogue-category').count(),5);
  const families=await page.locator('.tennis-catalogue-row').evaluateAll(rows=>rows.map(r=>r.dataset.eventFamilyId));
  for(const family of ['australian-open','roland-garros','wimbledon','us-open','davis-cup','billie-jean-king-cup','united-cup'])assert(families.includes(family),family);
  const follow=await page.evaluate(()=>{const id='roland-garros';toggleMajorEventFollow(id);const first=userPreferences.followFirst.followedMajorEventIds.includes(id);toggleMajorEventFollow(id);const excluded=userPreferences.followFirst.excludedMajorEventIds.includes(id);return {first,excluded};});assert(follow.first&&follow.excluded,'family decisions persist through toggles');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'catalogue horizontal overflow');
  const result=await page.evaluate(async()=>{
    const data=await fetch('data/code-inspector/cricket.json').then(r=>r.json());
    const f=data.fixtures.find(e=>e.id==='fixture:cricket:espn:1530205'||e.canonicalEventId==='fixture:cricket:espn:1530205');if(!f)throw new Error('Zimbabwe third ODI missing');
    userPreferences.feedControls.spoilers='standard';hideSpoilersForEvent(f);setCardState(f,'opened');const off=buildEventWhyItMatters(f)?.textContent||'';
    markSpoilerRevealed(f);setCardState(f,'selected');const collapsed=buildEventWhyItMatters(f)?.textContent||'';setCardState(f,'opened');const expanded=buildEventWhyItMatters(f)?.textContent||'';
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:100px 8px auto;z-index:500;background:var(--bg-card)';const card=buildEventCard(f);host.append(card);document.body.append(host);
    return {off,collapsed,expanded,card:card.textContent,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert(!/one wicket|3–0|Ellis/.test(result.off));assert.match(result.collapsed,/27 for the last wicket/);assert.match(result.expanded,/27 for the last wicket/);assert.equal((result.expanded.match(/Australia defeated Zimbabwe by one wicket/g)||[]).length,0);assert.equal(result.overflow,0);assert.equal((result.card.match(/Australia defeated Zimbabwe by one wicket/g)||[]).length,1,"headline outcome appears only once on expanded card");
  if(width===390&&theme==='day'&&process.env.QA_SCREENSHOT_PATH)await page.screenshot({path:process.env.QA_SCREENSHOT_PATH});
  await page.evaluate(()=>openCodeInspector('sport:golf'));
  const golf=await page.evaluate(()=>({count:codeInspectorChunk.fixtures.filter(f=>f.tournamentId?.startsWith('R20')).length,results:codeInspectorChunk.fixtures.filter(f=>f.tournamentId?.startsWith('R20')&&f.outcomeText).length,note:document.querySelector('.code-inspector-panel').textContent,overflow:document.documentElement.scrollWidth-innerWidth}));assert(golf.count>=84&&golf.results>=38);assert.match(golf.note,/round-by-round scores/);assert.equal(golf.overflow,0);
  console.log(width,theme,'golf schedule, tennis edition navigation, family controls, protected/result editorial and overflow passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
