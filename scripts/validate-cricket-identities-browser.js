'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:33991',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof buildDirectoryFollowButton==='function'&&startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 const result=await page.evaluate(async()=>{
  const d=await(await fetch('/data/code-inspector/cricket.json')).json(),ids=['fixture:cricket:CA:39484','fixture:cricket:espn:1513451'];
  const matches=d.fixtures.filter(f=>[f.id,...(f.sourceEventIds||[])].some(id=>ids.includes(id)));
  const checks=[];
  for(const [stored,displayed] of [['team:cricket:espn-1116','team:cricket:ca-50'],['team:cricket:ca-50','team:cricket:espn-1116']]){
   const prefs=clonePreferences(userPreferences);prefs.preferenceGraph=PREFERENCE_SYSTEM.setEntityFollow(prefs.preferenceGraph,stored,'follow');savePreferences(prefs,{deferFollowEffects:true});
   const button=buildDirectoryFollowButton(displayed,{sportKey:'cricket',label:'Lancashire'});document.getElementById('listView').replaceChildren(button);
   const before=button.textContent;button.click();const off=!FOLLOW_FIRST.effectiveParticipantFollow(stored,userPreferences).followed&&!FOLLOW_FIRST.effectiveParticipantFollow(displayed,userPreferences).followed;button.click();
   checks.push({stored,displayed,before,off,on:FOLLOW_FIRST.effectiveParticipantFollow(stored,userPreferences).followed&&FOLLOW_FIRST.effectiveParticipantFollow(displayed,userPreferences).followed,records:userPreferences.preferenceGraph.entityFollows.filter(f=>FOLLOW_FIRST.participantFollowIdentityKey(f.participantId)===FOLLOW_FIRST.participantFollowIdentityKey(stored)).length});
  }
  return {matches:matches.map(f=>({id:f.id,status:f.status,score:f.scoreDisplay})),checks};
 });
 assert.equal(result.matches.length,1);assert.equal(result.matches[0].status,'completed');assert.match(result.matches[0].score,/draw/i);
 for(const c of result.checks){assert.equal(c.before,'Following');assert(c.off&&c.on);assert.equal(c.records,1);}
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>startupFeedState.phase==='ready'&&!startupCoordinator.isHydrating());
 assert(await page.evaluate(()=>FOLLOW_FIRST.effectiveParticipantFollow('team:cricket:ca-50',userPreferences).followed&&FOLLOW_FIRST.effectiveParticipantFollow('team:cricket:espn-1116',userPreferences).followed));
 console.log('Cricket identity browser: one completed draw; either saved provider Follow drives both buttons; Unfollow/refollow/reload preserve one explicit choice.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
