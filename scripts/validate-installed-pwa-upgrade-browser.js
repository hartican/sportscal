'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const footballStatusFixture=require('../data/code-inspector/football.json').fixtures.find(event=>event.competitionId==='competition:premier-league-2026-27');
async function assertCachedFonts(page){
  for(const file of ['assets/fonts/dm-sans-latin.woff2','assets/fonts/dm-sans-latin-ext.woff2']){const digest=await page.evaluate(async file=>{const response=await caches.match('/'+file);if(!response)throw Error('Missing cached font: '+file);const bytes=await response.arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');},file);assert.equal(digest,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),'Bundled font survives upgrade/offline exactly');}
}
async function assertCachedParticipantCalendar(page){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),modelPath=html.match(/config\/athletes\.js\?v=\d+/)?.[0],uiPath=html.match(/assets\/js\/athletes-ui\.js\?v=\d+/)?.[0];
  assert(modelPath&&uiPath,'Current participant cache URLs are explicit');
  for(const file of [modelPath,uiPath])assert.equal(await page.evaluate(file=>caches.match('/'+file).then(r=>r?.text()),file),fs.readFileSync(path.join(root,file.split('?')[0]),'utf8'),'Updated participant calendar bytes remain cached exactly');
  const parent=require('../lib/calendar-catalogue').catalogue().find(e=>e.tournamentId==='R2026527'&&e.cardType==='golf_tournament');
  const result=await page.evaluate(async({modelPath,parent})=>{await loadDeferredScript(modelPath);return {included:NOTHINGSPORTS_ATHLETES.spansCurrentCalendarDay(parent,'2026-10-09','2027-10-09'),label:NOTHINGSPORTS_ATHLETES.calendarTiming(parent,Date.parse('2026-10-09T08:45:00Z'))};},{modelPath,parent});
  assert(result.included);assert.match(result.label,/Tournament dates: 8–11 Oct 2026/);assert.match(result.label,/Next tee time not verified/);
}
async function assertCachedStageCalendarPolicy(page){
  const notes=['ice-hockey','champions-league'].flatMap(code=>require('../data/code-inspector/'+code+'.json').fixtures.filter(f=>f.timingProvenance?.precision==='competition-stage-calendar'));
  assert.equal(notes.length,17);
  assert(await page.evaluate(notes=>NOTHINGSPORTS_FOLLOW_FEED_POLICY.SCHEMA_VERSION==='follow-feed-policy.v13'&&notes.every(f=>!NOTHINGSPORTS_FOLLOW_FEED_POLICY.sportingFixture(f)&&!NOTHINGSPORTS_FOLLOW_FEED_POLICY.eligibleForFollow(f,{sportFollow:true})),notes),'Updated cached policy cannot treat programme dates as followed matches');
}
async function assertCachedAflwFinalDate(page){
  const id='event:aflw:cd_m20262641601',expected=require('../data/code-inspector/aflw.json').fixtures.find(f=>f.id===id);
  const result=await page.evaluate(async id=>{const fixture=(await(await fetch('/data/code-inspector/aflw.json')).json()).fixtures.find(f=>f.id===id);return {fixture,label:NOTHINGSPORTS_CARD_TIMING.dateOnlyLabel(fixture)};},id);
  assert.deepEqual(result.fixture,expected,'Updated/offline Schedule keeps the exact reviewed date and original primary facts');assert.equal(result.label,'Time TBC');assert.equal(result.fixture.startTimeUtc,null);assert.equal(result.fixture.time,null);
}
async function assertCachedMultidayRetention(page){
  const raw=require('../data/code-inspector/cricket.json').fixtures.find(f=>f.id==='evt_91');
  const normalized=require('../lib/server-feed-pipeline').normalizeEvent(raw,new Date('2027-01-14T01:00Z'));
  const result=await page.evaluate(async ({raw,normalized})=>{
    const published=(await(await fetch('/data/code-inspector/cricket.json')).json()).fixtures.find(f=>f.id===raw.id);
    const before=JSON.stringify(userPreferences),actions=JSON.stringify(eventActions),now=new Date('2027-01-14T01:00Z');
    const states=[raw,normalized].map(f=>NOTHINGSPORTS_CARD_LIFECYCLE.lifecycleState(f,{now}));
    const cache=NOTHINGSPORTS_CARD_LIFECYCLE.materialize([normalized],{profileId:'cached-multiday-replay',now,enrich:()=>({cardVariant:'plain',intensity:1}),actionFor:()=>({reminderChoice:'off'})});
    return {publishedUnchanged:JSON.stringify(published)===JSON.stringify(raw),states,cards:cache.derivedCards.length,expiry:cache.derivedCards[0]?.expiresAt,choicesPreserved:JSON.stringify(userPreferences)===before&&JSON.stringify(eventActions)===actions};
  },{raw,normalized});
  assert(result.publishedUnchanged&&result.choicesPreserved,'Cached retention cannot mutate source observations or saved choices');
  assert(result.states.every(s=>s.state==='active'&&s.archivesAt==='2027-01-15T12:59:59.999Z'&&s.expiresAt==='2027-01-22T12:59:59.999Z'),'Upgraded/offline runtime honours the actual five-day calendar window on raw and server-normalized fixtures');
  assert.equal(result.cards,1,'The cached materializer retains the actual fourth Test within its end-window week');
  assert.equal(result.expiry,'2027-01-22T12:59:59.999Z');
}
async function assertCachedReviewedCalendarNotes(page){
  const panel=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/loadDeferredScript\('([^']*follow-schedule-panel\.js\?v=\d+)'\)/)[1];
  await page.evaluate(panel=>loadDeferredScript(panel),panel);
  assert.equal(await page.evaluate(panel=>caches.match('/'+panel).then(r=>r?.text()),panel),fs.readFileSync(path.join(root,panel.split('?')[0]),'utf8'),'First offline Schedule uses the exact current precached module');
  const api=require('./lib/reviewed-calendar-notes'),legacy=JSON.parse(baselineFile('data/events.json')).events.filter(e=>api.ids.includes(e.id));
  // MTB has no carried Code. Exercise its retained renderer without inventing one.
  const mtb=require('../data/events.json').events.find(e=>e.id===api.manualIds[1]);
  const result=await page.evaluate(async ({legacy,mtb})=>{
    const fixtures=(await Promise.all(['surf','motorsport'].map(async slug=>(await(await fetch('/data/code-inspector/'+slug+'.json')).json()).fixtures.filter(f=>f.calendarNote)))).flat();
    const before=JSON.stringify(userPreferences),priorTab=activeTab,checks=[];
    try{activeTab='feed';const host=document.getElementById('listView');for(const [origin,records] of [['current-code',fixtures],['retained-mtb-mount',[mtb]],['archived-baseline',legacy]])for(const event of records){const original=JSON.stringify(event);host.replaceChildren(buildEventCard(event));checks.push({id:event.id,origin,text:host.innerText,hasWindow:!!event.calendarNote?.localDateWindow,noClock:!eventReminderTiming(NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(event)),unchanged:JSON.stringify(event)===original});}return {checks,preferencesPreserved:JSON.stringify(userPreferences)===before};}finally{activeTab=priorTab;}
  },{legacy,mtb});
  assert.equal(result.checks.length,8,'Three carried notes, separately mounted MTB and four actual archived records must be rehearsed');assert(result.preferencesPreserved);
  for(const check of result.checks){assert(check.noClock&&check.unchanged);assert(check.hasWindow?/15–18 July 2027.*UK dates.*Sydney time TBC/s.test(check.text):/DATE TBC.*TIME TBC/s.test(check.text));assert(!/22 JAN|7 FEB|7:00 PM|2:00 AM|10 JUL|5 NOV|10:00 AM|8:00 AM|Tap to rate|Remind/.test(check.text),'An upgraded/offline cache cannot restore unsupported seed claims');}
}
async function assertCachedCanonicalResults(page){
  await page.evaluate(()=>loadDeferredScript('config/cricket-innings.js?v=431'));
  const cricket=await page.evaluate(async()=>{
    const f=(await(await fetch('/data/code-inspector/cricket.json')).json()).fixtures.find(f=>f.id==='fixture:cricket:CA:41001'),before=JSON.stringify(f),prior=userPreferences.showSpoilers,priorTab=activeTab,states=cardViewStates;
    try{activeTab='follow';cardViewStates={...states,[(canonicalFeedFixtureForInspector(f)||f).id]:'opened'};userPreferences.showSpoilers=true;const host=document.getElementById('listView');host.replaceChildren(buildCodeInspectorFixture(f));await Promise.resolve();const visible=host.textContent;userPreferences.showSpoilers=false;const hidden=buildCodeInspectorFixture(f);return {innings:f.innings.length,visible,hiddenTables:hidden.querySelectorAll('.cricket-innings-table').length,unchanged:before===JSON.stringify(f)};}finally{userPreferences.showSpoilers=prior;activeTab=priorTab;cardViewStates=states;}
  });
  assert.equal(cricket.innings,2,'upgraded/offline Cricket projection retains actual innings');
  assert(cricket.visible.includes('165/9')&&cricket.visible.includes('102 all out')&&cricket.visible.includes('17.3'),'cached result renderer shows sourced totals and cricket overs: '+JSON.stringify(cricket));
  assert.equal(cricket.hiddenTables,0,'cached Results OFF hides innings');assert(cricket.unchanged,'cached innings presentation does not change facts or dates');
  const observations=await page.evaluate(async()=>{
    const rows=[],beforePreferences=JSON.stringify(userPreferences),priorTab=activeTab;
    try{
      activeTab='follow';
      for(const [slug,id] of [['nrl','event:nrl:129990101'],['afl','event:afl:cd_m20260140001'],['aflw','event:aflw:cd_m20262640101']]){
        const code=await(await fetch('/data/code-inspector/'+slug+'.json')).json(),fixture=code.fixtures.find(f=>f.id===id),before=JSON.stringify(fixture);
        userPreferences.showSpoilers=true;
        const visible=buildCodeInspectorFixture(fixture).textContent;
        userPreferences.showSpoilers=false;
        const hidden=buildCodeInspectorFixture(fixture);
        rows.push({slug,expected:fixture.result.scorelineText.split('—').at(-1).trim(),visible,hidden:hidden.textContent,hiddenResultNodes:hidden.querySelectorAll('.card-result-line,.spoiler-facts').length,nonFinalScore:spoilerFactsForEvent({...fixture,status:'upcoming'}).score,unchanged:JSON.stringify(fixture)===before});
      }
    }finally{userPreferences=JSON.parse(beforePreferences);activeTab=priorTab;}
    return {rows,preferencesPreserved:JSON.stringify(userPreferences)===beforePreferences};
  });
  assert(observations.preferencesPreserved,'Cached result checks preserve the saved Results choice');
  for(const row of observations.rows){
    assert(row.visible.includes(row.expected),'Upgraded/offline '+row.slug+' shows the supplied canonical final with Results on');
    assert(!row.hidden.includes(row.expected)&&row.hiddenResultNodes===0,'Upgraded/offline '+row.slug+' keeps Results off private');
    assert.equal(row.nonFinalScore,null,'Cached upcoming records cannot borrow an old nested final');
    assert(row.unchanged,'Cached presentation preserves sporting facts and source clocks');
  }
}
async function assertCachedFootballStatus(page){
  const settled=await page.evaluate(async()=>{
    await loadDeferredScript('config/match-centre.js?v=463');await loadDeferredScript('config/feed-live-scores.js?v=437');
    const code=await(await fetch('/data/code-inspector/football.json')).json(),host=document.createElement('div');document.body.append(host);
    try{return ['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league'].map(id=>{const fixture=code.fixtures.find(f=>f.competitionId===id&&f.status==='completed'),before=JSON.stringify(fixture);NOTHINGSPORTS_FEED_LIVE_SCORES.install(host,fixture,{resultsOn:true});const shown={text:host.textContent,date:host.querySelector('time')?.dateTime};NOTHINGSPORTS_FEED_LIVE_SCORES.install(host,fixture,{resultsOn:false});return {id,shown,explicitStale:Boolean(fixture.stale),checkedAt:fixture.scoreCheckedAt,hidden:!host.querySelector('.feed-live-score'),unchanged:before===JSON.stringify(fixture)};});}finally{host.remove();}
  });
  for(const final of settled){assert(final.shown.text.includes('Finished')&&final.shown.text.includes('Update needed')===final.explicitStale,'cached settled final does not expire with elapsed age');assert.equal(final.shown.date,final.checkedAt,'cached calendar date retains original final observation');assert(/\b20\d{2}\b/.test(final.shown.text),'cached source check includes its year');assert(final.hidden&&final.unchanged,'cached source-date detail preserves privacy and facts');}
  const preview=await page.evaluate(async()=>{await loadDeferredScript('assets/js/football-card-context.js?v=463');const code=await(await fetch('/data/code-inspector/football.json')).json(),f=code.fixtures.find(f=>f.competitionId==='competition:uefa-champions-league'&&f.status==='upcoming'),saved=userPreferences.showSpoilers;try{userPreferences.showSpoilers=false;const hidden=await NOTHINGSPORTS_FOOTBALL_CONTEXT.standings(f);userPreferences.showSpoilers=true;const shown=await NOTHINGSPORTS_FOOTBALL_CONTEXT.standings(f);return {hiddenRows:hidden.querySelectorAll('li').length,hiddenText:hidden.textContent,shownRows:shown.querySelectorAll('li').length,source:shown.querySelector('a')?.href};}finally{userPreferences.showSpoilers=saved;}});
  assert.equal(preview.hiddenRows,0);assert.match(preview.hiddenText,/Results is off/);assert.equal(preview.shownRows,2);assert(preview.source);
  assert.equal(await page.evaluate(()=>caches.match('/assets/js/football-card-context.js?v=463').then(r=>r?.text())),fs.readFileSync(path.join(root,'assets/js/football-card-context.js'),'utf8'),'Cached UEFA preview executes the exact current source module');
  const priorLive=JSON.parse(baselineFile('data/code-inspector/american-football.json')).fixtures.find(f=>f.status==='live')||require('./fixtures/nfl-retained-live-observation.json').fixture;
  const nfl=await page.evaluate(async priorLive=>{
    await loadDeferredScript('assets/js/follow-navigation.js?v=463');await loadDeferredScript('assets/js/follow-schedule-panel.js?v=453');
    const document=await(await fetch('/data/code-inspector/american-football.json')).json();
    const previous=codeInspectorChunk,saved=JSON.stringify(userPreferences),reveal=standingsRevealApproved;
    try{
      codeInspectorChunk=document;userPreferences.showSpoilers=true;
      const panel=window.document.createElement('div');renderCodeInspectorStandings(panel,{id:'sport:american-football',slug:'american-football'});
      const visible={tables:panel.querySelectorAll('table').length,rows:panel.querySelectorAll('tbody tr').length,text:panel.textContent};
      userPreferences.showSpoilers=false;standingsRevealApproved=false;panel.replaceChildren();renderCodeInspectorStandings(panel,{id:'sport:american-football',slug:'american-football'});
      const fixtures=document.fixtures.filter(f=>f.season===2026&&f.id.startsWith('fixture:nfl:'));
      const final=fixtures.find(f=>f.status==='completed'),states=cardViewStates,tab=activeTab;
      let finalVisible,finalHidden;try{activeTab='follow';cardViewStates={...states,[final.id]:'selected'};userPreferences.showSpoilers=true;finalVisible=buildCodeInspectorFixture(final).textContent;userPreferences.showSpoilers=false;finalHidden=buildCodeInspectorFixture(final).textContent;}finally{activeTab=tab;cardViewStates=states;}
      const score=`${final.participantSlots.find(s=>s.homeAway==='away').score}-${final.participantSlots.find(s=>s.homeAway==='home').score}`;
      // Ordinary source progress may finish every live game between releases.
      // Keep checking real published final facts and the actual retained prior
      // live observation's stale transition; never manufacture a current live game.
      const live=fixtures.find(f=>f.status==='live')||priorLive;
      if(!live?.statusCheckedAt)throw Error('Cached NFL freshness check requires an actual current or baseline live observation');
      return {visible,hiddenTables:panel.querySelectorAll('table').length,hidden:panel.textContent,coverage:document.coverageStatus,asOf:[...new Set(document.standings.map(r=>r.asOf))],unchanged:JSON.stringify(document)===JSON.stringify(codeInspectorChunk),fixtureProof:{fixtures:fixtures.length,regular:fixtures.filter(f=>/^Week /.test(f.roundLabel)).length,tbc:fixtures.filter(f=>f.timeTbc).length,noExactTbc:fixtures.filter(f=>f.timeTbc).every(f=>f.startTimeUtc===null&&f.time===null),finalVisible:finalVisible.includes(score),finalHidden:!finalHidden.includes(score),staleStatus:FEED_CONTROLS.timingState(live,new Date(Date.parse(live.statusCheckedAt)+31*60000)).key}};
    }finally{codeInspectorChunk=previous;userPreferences=JSON.parse(saved);standingsRevealApproved=reveal;}
  },priorLive);
  assert.equal(nfl.visible.tables,2);assert.equal(nfl.visible.rows,32);
  assert(nfl.visible.text.includes('NFL AFC standings')&&nfl.visible.text.includes('NFL NFC standings'));
  assert(nfl.visible.text.includes('not final playoff qualifications'));
  assert.equal(nfl.hiddenTables,0);assert(nfl.hidden.includes('Results is off'));
  assert.equal(nfl.coverage,'partial');
  assert.deepEqual(nfl.asOf,[require('../data/canonical/american-football-directory.v1.json').standings[0].asOf],'upgrade/offline table keeps the published fact observation');
  assert(nfl.unchanged,'cached standings rendering cannot mutate source facts');
  assert.deepEqual(nfl.fixtureProof,{fixtures:321,regular:272,tbc:24,noExactTbc:true,finalVisible:true,finalHidden:true,staleStatus:'awaiting-update'},'upgraded/offline NFL keeps the complete season, provisional clocks, score order and source freshness');
  const hockey=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/ice-hockey.json')).json(),fixture=code.fixtures.find(f=>f.id==='fixture:chl:0636729f7d82ee17686c2f79');
    const previous=codeInspectorChunk,saved=JSON.stringify(userPreferences),reveal=standingsRevealApproved,tab=activeTab;
    const nhl=code.fixtures.filter(f=>f.competitionId==='competition:nhl');
    const final=nhl.find(f=>f.id==='fixture:nhl:2026020001');
    const nhlViewing={subscriptionVisible:buildCodeInspectorFixture(final).querySelector('.fixture-providers')?.textContent.includes('Subscription'),qualified:nhl.filter(f=>FOLLOW_FIRST.viewingOptions(f).some(o=>o.providerId==='disney')).length,
      excluded:nhl.filter(f=>f.roundLabel==='Preseason'&&FOLLOW_FIRST.viewingOptions(f).length===0).length,
      final:FOLLOW_FIRST.viewingOptions(final).map(o=>({provider:o.providerId,url:o.url,purpose:o.liveOrReplay,replayVerified:o.replayVerified,rightsScope:o.rightsScope,linkScope:o.linkScope,verifiedAt:o.verifiedAt})),
      expired:FOLLOW_FIRST.viewingOptions({...final,startTimeUtc:'2027-04-11T14:00:00Z',date:'2027-04-12'}).map(o=>o.providerId)};

    try{
      codeInspectorChunk=code;activeTab='follow';userPreferences.showSpoilers=true;
      const panel=document.createElement('div');renderCodeInspectorStandings(panel,{id:'sport:ice-hockey',slug:'ice-hockey'});
      const table=panel.querySelector('.chl-club-records-table'),visible=buildCodeInspectorFixture(fixture).textContent;
      const nhlRecords={text:panel.textContent,final:buildCodeInspectorFixture(final).textContent,labels:final.resultLabels,checkedAt:final.scoreCheckedAt,rows:code.standings.filter(r=>r.competitionId==='competition:nhl').length,pastTiming:FEED_CONTROLS.timingState({...final,status:'upcoming'},new Date(Date.parse(final.startTimeUtc)+3600000))?.key};
      userPreferences.showSpoilers=false;standingsRevealApproved=false;const hidden=buildCodeInspectorFixture(fixture);panel.replaceChildren();renderCodeInspectorStandings(panel,{id:'sport:ice-hockey',slug:'ice-hockey'});
      return {nhlRecords,nhlViewing,records:table.querySelectorAll('tbody tr').length,headers:[...table.querySelectorAll('thead th')].map(h=>h.textContent),visible,expected:fixture.participantSlots.map(s=>s.score).join('-'),hidden:hidden.textContent,hiddenResults:hidden.querySelectorAll('.card-result-line,.spoiler-facts').length,hiddenTables:panel.querySelectorAll('table').length,calendars:code.fixtures.filter(f=>f.competitionId==='competition:chl'&&!f.participantSlots.length).map(f=>({id:f.id,start:f.startTimeUtc,participants:f.participantIds,time:f.time})),asOf:[...new Set(code.standings.filter(r=>r.competitionId==='competition:chl').map(r=>r.asOf))],clubObservations:Object.fromEntries(code.standings.filter(r=>r.competitionId==='competition:chl').map(r=>[r.participantId,r.asOf])),coverage:code.coverageStatus};
    }finally{codeInspectorChunk=previous;userPreferences=JSON.parse(saved);standingsRevealApproved=reveal;activeTab=tab;}
  });
  assert.deepEqual(hockey.nhlViewing,{subscriptionVisible:true,qualified:1344,excluded:65,final:[{provider:'disney',url:'https://www.disneyplus.com/en-au/welcome/espn-sports',purpose:'replay',replayVerified:false,rightsScope:'competition',linkScope:'sport',verifiedAt:'2026-10-04T14:47:13.000Z'}],expired:[]},'upgraded/offline NHL cached projections and runtime retain scope, original date and honest replay');
  assert.equal(hockey.nhlRecords.rows,32);assert(hockey.nhlRecords.text.includes('OT/SO losses'));assert(hockey.nhlRecords.final.includes('After overtime'));assert.deepEqual(hockey.nhlRecords.labels,['After overtime']);assert.equal(hockey.nhlRecords.checkedAt,require('../data/canonical/ice-hockey-directory.v1.json').fixtures.find(f=>f.id==='fixture:nhl:2026020001').scoreCheckedAt);assert.equal(hockey.nhlRecords.pastTiming,'awaiting-update','cached hockey cannot infer live from a scheduled clock');
  assert.equal(hockey.records,24);assert.deepEqual(hockey.headers,['Team','P','W','L','GF','GA']);assert(hockey.visible.includes(hockey.expected),'cached CHL final shows its supplied zero');assert(!hockey.hidden.includes(hockey.expected)&&hockey.hiddenResults===0&&hockey.hiddenTables===0,'cached CHL Results OFF remains private');assert.equal(hockey.calendars.length,12);assert(hockey.calendars.every(f=>f.start===null&&f.time===null&&!f.participants.length));assert.equal(hockey.coverage,'partial');assert.deepEqual(hockey.asOf,[...new Set(require('../data/canonical/ice-hockey-directory.v1.json').standings.filter(r=>r.competitionId==='competition:chl').map(r=>r.asOf))]);assert.deepEqual(hockey.clubObservations,Object.fromEntries(require('../data/canonical/ice-hockey-directory.v1.json').standings.filter(r=>r.competitionId==='competition:chl').map(r=>[r.participantId,r.asOf])),'cached club records preserve each supplied observation instead of inventing a common collection clock');
  const priorNhlLive=JSON.parse(baselineFile('data/code-inspector/ice-hockey.json')).fixtures.find(f=>f.id==='fixture:nhl:2026020035'&&f.status==='live')||require('./fixtures/nhl-retained-live-observation.json').fixture;
  const nhlLive=await page.evaluate(async priorNhlLive=>{
    await loadDeferredScript('config/feed-live-score-loader.js?v=437');await loadDeferredScript('config/match-centre.js?v=463');await loadDeferredScript('config/feed-live-scores.js?v=437');
    const code=await(await fetch('/data/code-inspector/ice-hockey.json')).json(),fixture=code.fixtures.find(f=>f.id==='fixture:nhl:2026020035'),saved=JSON.stringify(userPreferences),tab=activeTab,spoilers=eventSpoilerState,queue=queueLiveFixtureSnapshot;let queued=0;
    const host=document.createElement('div');host.className='event-card';document.body.append(host);
    try{activeTab='follow';queueLiveFixtureSnapshot=()=>queued++;eventSpoilerState={};userPreferences.showSpoilers=true;userPreferences.feedControls.spoilers='standard';NOTHINGSPORTS_FEED_SCORE_UI.install(host,{...fixture,key:'ice-hockey'});
      if(fixture.status==='completed')host.replaceChildren(buildCodeInspectorFixture(fixture));
      const visible=host.textContent;userPreferences.showSpoilers=false;NOTHINGSPORTS_FEED_SCORE_UI.install(host,{...fixture,key:'ice-hockey'});if(fixture.status==='completed')host.replaceChildren(buildCodeInspectorFixture(fixture));const hidden=host.querySelectorAll('.feed-live-score,.card-result-line,.spoiler-facts').length===0;
      userPreferences.showSpoilers=true;host.replaceChildren();NOTHINGSPORTS_FEED_SCORE_UI.install(host,{...priorNhlLive,key:'ice-hockey'});
      const retainedVisible=host.textContent,retainedExpected=priorNhlLive.participantSlots.map(s=>`${s.label} ${s.score}`).join(' · ');
      userPreferences.showSpoilers=false;NOTHINGSPORTS_FEED_SCORE_UI.install(host,{...priorNhlLive,key:'ice-hockey'});
      const historical={status:priorNhlLive.status,visible:retainedVisible.includes(retainedExpected),hidden:!host.querySelector('.feed-live-score'),stale:NOTHINGSPORTS_CARD_TIMING.presentation(priorNhlLive,new Date(Date.parse(priorNhlLive.statusCheckedAt)+31*60000)).status};
      return {visible,hidden,queued,historical,status:fixture.status,scoreAt:fixture.scoreCheckedAt,statusAt:fixture.statusCheckedAt,stale:NOTHINGSPORTS_CARD_TIMING.presentation(fixture,new Date(Date.parse(fixture.statusCheckedAt)+31*60000)).status,expected:fixture.status==='completed'?fixture.participantSlots.map(s=>s.score).join('-'):fixture.participantSlots.map(s=>`${s.label} ${s.score}`).join(' · ')};
    }finally{host.remove();queueLiveFixtureSnapshot=queue;activeTab=tab;eventSpoilerState=spoilers;userPreferences=JSON.parse(saved);}
  },priorNhlLive);
  assert(nhlLive.visible.includes(nhlLive.expected)&&nhlLive.hidden,'upgraded/offline Schedule presents the sourced paired score and hides it with Results OFF');assert.equal(nhlLive.queued,0,'offline Schedule never queues fixture polling');assert.equal(nhlLive.stale,nhlLive.status==='completed'?'FINISHED':'Awaiting match update','completed and underway observations retain their actual lifecycle');assert.equal(nhlLive.scoreAt,require('../data/canonical/ice-hockey-directory.v1.json').fixtures.find(f=>f.id==='fixture:nhl:2026020035').scoreCheckedAt);
  assert.deepEqual(nhlLive.historical,{status:'live',visible:true,hidden:true,stale:'Awaiting match update'},'actual archived live observation retains its paired score, privacy and stale transition');
  const season=await page.evaluate(async()=>{
    const nrlw=await(await fetch('/data/code-inspector/nrlw.json')).json(),wrc=await(await fetch('/data/code-inspector/wrc.json')).json();
    return {count:nrlw.fixtures.length,coverage:nrlw.coverageStatus,completed:nrlw.fixtures.filter(f=>f.status==='completed').length,withdrawn:wrc.fixtures.find(f=>f.id==='event:wrc:2026:round-14')?.status};
  });
  assert.deepEqual(season,{count:71,coverage:'partial',completed:71,withdrawn:'cancelled'},'upgraded/offline projections retain the dated NRLW collection, separately reviewed Grand Final and actual WRC withdrawal');
  const nrlwFinal=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/nrlw.json')).json();
    const fixture=code.fixtures.find(f=>f.id==='event:nrlw:2026:grand-final');
    const before=JSON.stringify(fixture),saved=JSON.stringify(userPreferences),tab=activeTab;
    try{
      activeTab='follow';userPreferences.showSpoilers=true;
      const visible=buildCodeInspectorFixture(fixture).textContent;
      userPreferences.showSpoilers=false;
      const hidden=buildCodeInspectorFixture(fixture);
      return {visible,hidden:hidden.textContent,hiddenResultNodes:hidden.querySelectorAll('.card-result-line,.spoiler-facts').length,sourceCheckedAt:fixture.sourceCheckedAt,resultSourceCheckedAt:fixture.resultSourceCheckedAt,unchanged:before===JSON.stringify(fixture)};
    }finally{userPreferences=JSON.parse(saved);activeTab=tab;}
  });
  assert(/30\s*[-–]\s*6/.test(nrlwFinal.visible),'cached Grand Final renders the separately verified score with Results on');
  assert(!/30\s*[-–]\s*6/.test(nrlwFinal.hidden)&&nrlwFinal.hiddenResultNodes===0,'cached Grand Final protects Results off');
  assert.equal(nrlwFinal.sourceCheckedAt,'2026-09-27T13:57:48.000Z');
  assert.equal(nrlwFinal.resultSourceCheckedAt,'2026-10-04T09:19:16.000Z');
  assert(nrlwFinal.unchanged,'cached rendering cannot renew programme or result facts');
  const nrlwLadder=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/nrlw.json')).json();
    const snapshot=NOTHINGSPORTS_FEED_CARD_STANDINGS.find(s=>s.competitionId==='competition:nrlw-premiership-2026');
    return {rows:code.standings.length,ids:code.standings.map(r=>r.participantId),ranks:snapshot.entries.map(r=>r.rank),runtimeIds:snapshot.entries.map(r=>r.participantId),checkedAt:snapshot.snapshotTimeUtc,codeClocks:[...new Set(code.standings.map(r=>r.asOf))]};
  });
  assert.equal(nrlwLadder.rows,12);assert.deepEqual(nrlwLadder.ids,nrlwLadder.runtimeIds);
  assert.deepEqual(nrlwLadder.ranks,Array.from({length:12},(_,i)=>i+1));
  assert.deepEqual(nrlwLadder.codeClocks,[nrlwLadder.checkedAt],'upgraded/offline Code and card ranks retain the actual dated source clock');
  await page.evaluate(async url=>{await loadDeferredScript(url);},candidateMatchCentrePath);
  const centreUi=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/loadDeferredScript\('([^']*assets\/js\/match-centre-ui\.js\?v=\d+)'\)/)[1];
  await page.evaluate(async url=>{await loadDeferredScript(url);},centreUi);
  assert.equal(await page.evaluate(url=>caches.match('/'+url).then(r=>r?.text()),centreUi),fs.readFileSync(path.join(root,'assets/js/match-centre-ui.js'),'utf8'),'Upgraded and offline Match Centre uses the exact current recovery module');
  const status=await page.evaluate(fixture=>{
    const event={...fixture,status:'upcoming',scheduleStatus:'upcoming',statusCheckedAt:null,statusSource:null,timingSource:null};
    return globalThis.NOTHINGSPORTS_CARD_TIMING.presentation(event,new Date(Date.parse(event.startTimeUtc)+30*60000)).status;
  },footballStatusFixture);
  assert.equal(status,'Awaiting match update','the upgraded/offline runtime must execute the current Football status rule');
  const stageCalendar=await page.evaluate(stage=>{
    const unknown=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(stage);
    const confirmed=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore({...stage,startTimeUtc:'2027-06-05T19:00:00Z',timePrecision:'exact',scheduleStatus:'confirmed',timeTbc:false});
    const unconfirmed=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore({...stage,startTimeUtc:'2027-06-05T19:00:00Z',timePrecision:'exact',scheduleStatus:'confirmed',timeTbc:false,startTimeTbc:true});
    return {unknownLabel:unknown.displayDateLabel,unknownStart:unknown.startTimeUtc,confirmedLabel:confirmed.displayDateLabel||null,confirmedDate:confirmed.date,unconfirmedLabel:unconfirmed.displayDateLabel||null};
  },require('../data/code-inspector/champions-league.json').fixtures.find(f=>f.id==='major-stage:uefa-champions-league-2026-27:final'));
  assert.deepEqual(stageCalendar,{unknownLabel:'Saturday 5 June 2027 (Madrid dates)',unknownStart:null,confirmedLabel:null,confirmedDate:'2027-06-06',unconfirmedLabel:'Saturday 5 June 2027 (Madrid dates)'},'upgraded/offline runtime retains actual UCL calendar precision and the controlled confirmed-UTC transition');
  const viewingActions=await page.evaluate(fixture=>{
    const api=NOTHINGSPORTS_FOLLOW_FIRST;
    const live=api.viewingOptions({...fixture,status:'live',scheduleStatus:'live',score:'0 - 0',scoreDisplay:'0 - 0'});
    const final={...fixture,status:'completed',scheduleStatus:'completed'};
    const first=api.viewingOptions(final),second=api.viewingOptions({...final,viewingOptions:first,broadcastOptions:[],broadcaster:''});
    return {livePurpose:live[0].liveOrReplay,firstReplay:first[0].replayVerified,secondReplay:second[0].replayVerified};
  },footballStatusFixture);
  assert.deepEqual(viewingActions,{livePurpose:'live',firstReplay:false,secondReplay:false},'upgraded/offline viewing cannot turn partial scores into replays or unknown provider metadata into replay proof');
  const compactObservation=await page.evaluate(()=>{
    const marker='fixture-observations.v1',prior={id:'offline-correction',key:'nrl',status:'completed',homeScore:1,awayScore:0,sourceCheckedAt:'2026-09-24T13:00:00Z'};
    const corrected=NOTHINGSPORTS_FIXTURE_IDENTITY.mergeOverlays([prior],[{...prior,homeScore:2,fixtureObservationSchema:marker,scoreCheckedAt:'2026-09-24T14:00:00Z',statusCheckedAt:'2026-09-24T14:00:00Z'}])[0];
    const unknown=NOTHINGSPORTS_MATCH_CENTRE.compact({...corrected,status:'live',scoreCheckedAt:null,statusCheckedAt:'2026-09-24T15:00:00Z'});
    return {home:corrected.homeScore,away:corrected.awayScore,unknownClock:unknown.checkedAt,unknownStale:unknown.stale};
  });
  assert.deepEqual(compactObservation,{home:2,away:0,unknownClock:null,unknownStale:true},'upgraded/offline shared and deferred modules preserve corrected finals and unknown score freshness');
  const nblStatus=await page.evaluate(()=>globalThis.NOTHINGSPORTS_CARD_TIMING.presentation({competitionId:'competition:nbl',status:'live',startTimeUtc:'2026-10-02T09:30:00Z',statusCheckedAt:'2026-10-02T09:00:00Z'},new Date('2026-10-02T10:00:00Z')).status);
  assert.equal(nblStatus,'Awaiting match update','the upgraded/offline runtime must reject stale NBL live status');
  const referenceStatus=await page.evaluate(()=>{
    const event={competitionId:'competition:aflw-2026',status:'live',startTimeUtc:'2026-10-04T04:05:00Z',statusCheckedAt:'2026-10-04T05:49:24.432Z'};
    return [NOTHINGSPORTS_CARD_TIMING.presentation(event,'2026-10-04T06:00:00Z').status,NOTHINGSPORTS_CARD_TIMING.presentation(event,'2026-10-04T08:00:00Z').status,NOTHINGSPORTS_FEED_CONTROLS.timingState(event,new Date('2026-10-04T08:00:00Z')).key];
  });
  assert.deepEqual(referenceStatus,['LIVE','Awaiting match update','awaiting-update'],'cached/offline reference status preserves the genuine observation and cannot advertise stale play');
  const tournamentPhase=await page.evaluate(()=>{
    const event={id:'offline-phase-qa',name:'Tournament phase QA',key:'golf',cardType:'golf_tournament',dateOnly:true,date:'2026-10-01',endDate:'2026-10-04',status:'live'};
    const priorTab=activeTab;
    try{
      activeTab='follow';
      const compact=buildCompactCardSummary(event),chip=buildEventTimingStateChip(event);
      activeTab='feed';
      return {compact:compact.querySelector('.event-timing-state')?.textContent,accessible:compact.getAttribute('aria-label'),chip:chip?.textContent,feed:buildFixtureTimingBadge(event).dataset.timingStatus,clock:NOTHINGSPORTS_FEED_CONTROLS.timingState(event),scheduled:NOTHINGSPORTS_CARD_TIMING.tournamentPhase({...event,status:'scheduled'})};
    }finally{activeTab=priorTab;}
  });
  assert.equal(tournamentPhase.compact,'In progress');assert.equal(tournamentPhase.chip,'In progress');assert.match(tournamentPhase.accessible,/Tournament in progress/);
  assert.equal(tournamentPhase.feed,'IN PROGRESS');assert.equal(tournamentPhase.clock,null);assert.equal(tournamentPhase.scheduled,null,'cached dates alone never invent tournament progress');
  const wsl=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/wsl.json')).json();
    const e=code.fixtures.find(f=>f.id.endsWith('portugal'));
    const image=new Image();image.src='/assets/identities/wsl/wave-white.svg';await image.decode();
    const brand=new Image();brand.src='/assets/identities/wsl/brand.png';await brand.decode();
    return {count:code.fixtures.length,coverage:code.coverageStatus,unfollowed:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:25,selectedSelectorEntityIds:['sport:surf']}),followed:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:25,selectedSelectorEntityIds:['sport:wsl']}),precision:e.timePrecision,time:e.time,providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(e),glyph:image.naturalWidth,brand:brand.naturalWidth};
  });
  assert.equal(wsl.count,12);assert.equal(wsl.coverage,'partial');assert(wsl.unfollowed&&wsl.followed&&wsl.glyph>0&&wsl.brand>0);assert.equal(wsl.precision,'date-only');assert.equal(wsl.time,null);assert.deepEqual(wsl.providers,[],'cached WSL windows never invent Australian viewing');
  const sailgp=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/sailgp.json')).json();
    return {coverage:code.coverageStatus,copy:codeInspectorCoverageCopy(code.code?{...code.code,coverageStatus:code.coverageStatus}:code),geneva:code.fixtures.filter(f=>f.id.includes('geneva')).map(f=>({start:f.startTimeUtc,end:f.endTimeUtc,timingCheckedAt:f.timingProvenance?.checkedAt,resultCheckedAt:f.resultSourceCheckedAt})),future:code.fixtures.filter(f=>f.season==='2026'&&/(dubai|abu-dhabi)/.test(f.id)).map(f=>({start:f.startTimeUtc,precision:f.timePrecision})),nextSeason:code.fixtures.filter(f=>f.season==='2027').map(f=>({confirmed:f.participantsConfirmed,entries:f.participantIds||[],providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>o.providerId),start:f.startTimeUtc,precision:f.timePrecision}))};
  });
  assert.equal(sailgp.coverage,'partial');assert.match(sailgp.copy,/Season teams may be listed/);assert.equal(sailgp.geneva.length,2);
  for(const [i,f]of sailgp.geneva.entries()){assert.equal(f.start,`2026-09-${19+i}T13:30:00.000Z`);assert.equal(f.end,`2026-09-${19+i}T15:00:00.000Z`);assert.equal(f.timingCheckedAt,'2026-10-02T16:06:23.274Z');assert.equal(f.resultCheckedAt,'2026-09-21T20:24:10.712468Z');}
  assert.equal(sailgp.future.length,4);assert(sailgp.future.every(f=>!f.start&&f.precision==='tbc'),'cached event envelopes never become invented daily sessions');
  assert.equal(sailgp.nextSeason.length,require('../data/canonical/fiba-women-sailgp-motogp-2026.json').events.filter(e=>e.sportKey==='sailgp'&&e.season==='2027').length);assert(sailgp.nextSeason.every(f=>f.confirmed===false&&!f.entries.length&&!f.providers.length&&!f.start&&f.precision==='tbc'),'upgraded/offline future SailGP keeps unpublished times, entries and rights unresolved');
  const abandoned=await page.evaluate(()=>{
    const event={key:'cricket',status:'abandoned',startTimeUtc:'2026-09-28T04:30:00Z',endTimeUtc:'2026-09-28T09:00:00Z'};
    const now=new Date('2026-09-28T05:00:00Z');
    const prior={...event,status:'completed',statusCheckedAt:'2026-09-30T00:00:00Z'};
    const next={...event,statusCheckedAt:'2026-10-02T00:00:00Z'};
    return {status:NOTHINGSPORTS_CARD_TIMING.presentation(event,now).status,timing:NOTHINGSPORTS_FEED_CONTROLS.timingState(event,now),observation:NOTHINGSPORTS_MATCH_CENTRE.observation(prior,next).status};
  });
  assert.equal(abandoned.status,'ABANDONED');assert.equal(abandoned.timing,null,'upgraded/offline runtime never calls an abandoned match live');
  assert.equal(abandoned.observation,'abandoned','upgraded/offline deferred Match Centre accepts the official abandonment correction');
  const rugby=await page.evaluate(f=>{const normalized=NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(f);const oldRatings=ratings;try{ratings={[f.id]:5};return {id:normalized.id,start:normalized.startTimeUtc,scoreCheckedAt:normalized.scoreCheckedAt,rating:getActual('rugby-australia-south-africa-2026-09-27')};}finally{ratings=oldRatings;}},require('./fixtures/rugby-reviewed-provider-pair.json').worldRugby);
  assert.equal(rugby.id,'rugby-australia-south-africa-2026-09-27');assert.equal(rugby.start,'2026-09-27T09:45:00.000Z');assert.equal(rugby.rating,5,'cached runtime reads the old saved Rugby rating');assert.equal(rugby.scoreCheckedAt,require('./fixtures/rugby-reviewed-provider-pair.json').worldRugby.scoreCheckedAt,'cached host timing never refreshes score facts');
  const futureRugby=await page.evaluate(async()=>{
    const d=await(await fetch('/data/code-inspector/rugby-union.json')).json();const id='rugby-australia-new-zealand-2026-10-17',old='fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8';
    const fixtures=d.fixtures.filter(f=>NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(f.id)===id);const f=fixtures[0];
    return {count:fixtures.length,id:f.id,start:f.startTimeUtc,time:f.time,checkedAt:f.timingProvenance?.checkedAt,legacy:NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(old),providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>o.providerId)};
  });
  assert.deepEqual(futureRugby,{count:1,id:'rugby-australia-new-zealand-2026-10-17',start:'2026-10-17T05:00:00.000Z',time:'16:00',checkedAt:'2026-10-02T08:24:46.814Z',legacy:'rugby-australia-new-zealand-2026-10-17',providers:['nine-tv','nine','stan']},'upgraded/offline cached future Bledisloe uses one reviewed identity and original host observation');
  const motoAssets=require('../assets/identities/motogp/asset-manifest.json').assets.map(a=>a.path).concat('assets/identities/motogp/motorcycle-white.svg',require('../assets/identities/wrc/asset-manifest.json').assets.map(a=>a.path),'assets/identities/sailgp/sailing-white.svg');
  const motoOffline=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{const r=await fetch('/'+path);const source=await r.text();return r.ok&&source.includes('<svg')&&!source.includes('<image');})),motoAssets);
  assert(motoOffline.every(Boolean),'every MotoGP and WRC vector must remain available in the installed/offline shell');
  const sailgpIdentity=await page.evaluate(async()=>Promise.all(['light','dark'].map(async theme=>{const image=new Image();image.src='/assets/identities/sailgp/brand-'+theme+'.png';await image.decode();return image.naturalWidth===1670&&image.naturalHeight===335;})));
  assert(sailgpIdentity.every(Boolean),'both complete local SailGP marks decode after upgrade and remain cached offline');
  const tours=await page.evaluate(async()=>Promise.all(['tour-de-france','giro-ditalia','vuelta-a-espana'].map(async slug=>{
    const code=await(await fetch('/data/code-inspector/'+slug+'.json')).json();
    const schedule=await(await fetch('/data/follow-schedule/'+slug+'.json')).json();
    const event=code.fixtures.find(f=>f.season==='2027')||code.fixtures[0],key=event.key;
    const prefs={version:26,selectedSelectorEntityIds:['sport:cycling'],followedSports:['cycling',key]};
    return {slug,count:code.fixtures.length,scheduleCount:schedule.fixtures?.length||schedule.events?.length,coverage:code.coverageStatus,unfollowed:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(event,prefs),followed:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(event,{...prefs,selectedSelectorEntityIds:['sport:'+key]})};
  })));
  assert.deepEqual(tours.map(t=>t.count),[24,21,21]);assert(tours.every(t=>t.coverage==='partial'&&t.unfollowed&&t.followed),'cached Grand Tours require explicit competition consent');
  const tourAssets=require('../assets/identities/cycling/asset-manifest.json').assets;
  const decodedTours=await page.evaluate(async assets=>Promise.all(assets.map(async a=>{
    const r=await fetch('/'+a.path);if(!r.ok)return false;
    if(a.path.endsWith('.svg')){const source=await r.text();if(!source.includes('<svg')||source.includes('<image'))return false;}
    const image=new Image();image.src='/'+a.path;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;
  })),tourAssets);
  assert(decodedTours.every(Boolean),'all 39 verified routes, bicycle fallback and complete Grand Tour marks decode offline');
  const majors=await page.evaluate(async()=>{
    const code=await(await fetch('/data/code-inspector/golf.json')).json(),rounds=code.fixtures.filter(e=>e.golfMajorCalendar&&e.cardType==='golf_session');
    const future=rounds.filter(e=>e.season==='2027');
    return {rounds:rounds.length,future:future.length,unconfirmed:future.every(e=>!e.time&&e.dateOnly&&!e.startTimeUtc&&!e.participantIds?.length),unfollowed:future.every(e=>!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{})),followed:future.every(e=>!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:26,selectedSelectorEntityIds:['sport:golf']})),providers:future.flatMap(e=>NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(e))};
  });
  assert.equal(majors.rounds,32);assert.equal(majors.future,16);assert(majors.unconfirmed&&majors.unfollowed&&majors.followed);assert.deepEqual(majors.providers,[]);
  const dakar=await page.evaluate(async()=>{const c=await(await fetch('/data/code-inspector/dakar.json')).json(),e=c.fixtures.find(f=>f.season==='2027');return {count:c.fixtures.length,notes:c.scheduleNotes,precision:e.timePrecision,time:e.time,off:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:27,selectedSelectorEntityIds:['sport:motorsport']}),on:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:27,selectedSelectorEntityIds:['sport:dakar']}),providers:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(e)};});
  assert.equal(dakar.count,28);assert.equal(dakar.notes.length,2);assert(dakar.off&&dakar.on);assert.equal(dakar.precision,'date-only');assert.equal(dakar.time,null);assert.deepEqual(dakar.providers,[]);
  const decodedDakar=await page.evaluate(async assets=>Promise.all(assets.map(async a=>{const r=await fetch('/'+a.path);if(!r.ok)return false;const image=new Image();image.src='/'+a.path;await image.decode();return image.naturalWidth>0;})),require('../assets/identities/dakar/asset-manifest.json').assets);assert(decodedDakar.every(Boolean),'Dakar assets and projections remain available after upgrade and offline');
  const lemans=await page.evaluate(async()=>{const c=await(await fetch('/data/code-inspector/lemans.json')).json(),e=c.fixtures.find(f=>f.season==='2027'&&f.sessionType==='qualifying'),finish=c.fixtures.find(f=>f.sourceEventIds?.includes('evt_80'));const image=new Image();image.src='/assets/identities/lemans/sarthe-white.svg';await image.decode();return {count:c.fixtures.length,off:!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:27,selectedSelectorEntityIds:['sport:motorsport']}),on:!!NOTHINGSPORTS_FOLLOW_FIRST.reasonForEvent(e,{version:27,followFirst:{followedMajorEventIds:['le-mans-24-hours']}}),tbc:e.time===null&&e.dateOnly,finish:finish.estimatedStartTimeUtc,label:NOTHINGSPORTS_CARD_TIMING.presentation(finish).timeLabel,decoded:image.naturalWidth>0};});
  assert.equal(lemans.count,26);assert(lemans.off&&lemans.on&&lemans.tbc&&lemans.decoded);assert.equal(lemans.finish,'2026-06-14T14:00:00.000Z');
  const majorAssets=require('../assets/identities/golf/asset-manifest.json').assets;
  const decodedMajors=await page.evaluate(async assets=>Promise.all(assets.map(async a=>{const r=await fetch('/'+a.path);if(!r.ok)return false;const image=new Image();image.src='/'+a.path;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;})),majorAssets);
  assert(decodedMajors.every(Boolean),'used major artwork and complete identity marks decode after upgrade and offline');
  const viewing=await page.evaluate(async()=>{
    const load=async code=>(await(await fetch(`/data/code-inspector/${code}.json`)).json()).fixtures;
    const rugby=await load('rugby-union'),cricket=await load('cricket'),golf=await load('golf');
    const providers=f=>NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>o.providerId);
    const final=rugby.find(f=>f.id==='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be');
    const lpga=['2026068','2026070'].map(id=>golf.find(f=>f.id==='fixture:golf:lpga:'+id));
    return {unknown:providers({key:'rugby',broadcaster:'Stan Sport'}),bledisloe:providers(rugby.find(f=>f.id==='rugby-new-zealand-australia-2026-10-10')),test:providers(cricket.find(f=>f.id==='fixture:cricket:espn:1525659')),final:providers(final),venue:NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(final).venue,
      lpga:lpga.map(f=>({id:f.id,providers:providers(f),options:NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(f).map(o=>({scope:o.rightsScope,replay:o.replayVerified})),participationCheckedAt:f.participationCheckedAt})),
      unrelatedLpga:providers({key:'golf',competitionId:'competition:lpga-tour',name:'LPGA Tour'})};
  });
  const currentLpga=require('../data/canonical/pga-tour-schedule.json').lpga;
  const expectedLpga=['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070'].map(id=>currentLpga.find(f=>f.id===id)).map(f=>({id:f.id,providers:['kayo','foxtel'],options:[{scope:'competition',replay:false},{scope:'competition',replay:false}],participationCheckedAt:f.participationCheckedAt}));
  assert.deepEqual(viewing,{unknown:[],bledisloe:['nine-tv','nine','stan'],test:['kayo','foxtel'],final:['youtube','stan'],venue:'Scotch College Playing Fields, Swanbourne, Perth',lpga:expectedLpga,unrelatedLpga:[]},'upgraded/offline runtime and cached projections retain honest AU viewing, LPGA token boundaries and original Golf observations');
  const finalsDestinations=await page.evaluate(async()=>{
    const data=await(await fetch('/data/follow-schedule/nrl.json')).json(),final=data.fixtures.find(f=>f.canonicalEventId==='evt_84');
    const options=NOTHINGSPORTS_FOLLOW_FIRST.viewingOptions(final),controls=document.createElement('div');
    appendEventQuickActions(controls,final,{reminder:false,chat:false});
    return {options:options.map(o=>({id:o.providerId,url:o.webUrl,scope:o.linkScope,checkedAt:o.verifiedAt,permalink:o.permalinkVerifiedAt})),destinations:[...controls.querySelectorAll('a.provider-link')].map(a=>a.getAttribute('href'))};
  });
  assert.deepEqual(finalsDestinations.options.map(o=>o.id),['nine-tv','nine']);
  assert(finalsDestinations.options.every(o=>o.url==='https://www.9now.com.au/'&&o.scope==='sport'&&o.checkedAt==='2026-09-27T13:39:49.102Z'&&o.permalink===null),'cached reader preserves general destinations and original rights evidence');
  assert.deepEqual(finalsDestinations.destinations,['https://www.9now.com.au/','https://www.9now.com.au/'],'cached controls retain external destinations after upgrade and offline');
}

const baselineSha = process.env.PWA_BASELINE_SHA || 'eb1b495';
const keepOpen = process.env.PWA_KEEP_OPEN === '1';
const candidateVersion = JSON.parse(fs.readFileSync(path.join(root,'app-version.json'))).version;
// Serve exact historical Git blobs on demand. Preparing every archived report
// and unused asset took minutes and had no bearing on an installed-page test.
const tree = new Map(execFileSync('git',['ls-tree','-rz',baselineSha],{cwd:root,maxBuffer:16*1024*1024}).toString().split('\0').filter(Boolean).map(line => {
  const split=line.indexOf('\t'); return [line.slice(split+1),line.slice(0,split).split(' ')[2]];
}));
const historical = new Map();
const candidateHeaders=Object.fromEntries((require('../vercel.json').headers.find(rule=>rule.source==='/(.*)')?.headers||[]).map(h=>[h.key,h.value]));
function baselineFile(name){
  if (!tree.has(name)) return null;
  if (historical.has(name)) return historical.get(name);
  let bytes;
  const file=path.join(root,name);
  if(fs.existsSync(file)){
    const current=fs.readFileSync(file);
    const oid=crypto.createHash('sha1').update('blob '+current.length+'\0').update(current).digest('hex');
    if(oid===tree.get(name))bytes=current;
  }
  bytes ||= execFileSync('git',['cat-file','blob',tree.get(name)],{cwd:root,maxBuffer:32*1024*1024});
  historical.set(name,bytes);return bytes;
}
const baselineVersion=baselineFile('index.html').toString().match(/name="app-shell-version" content="(\d+)"/)[1];
const profilePath=html=>html.match(/loadDeferredScript\(["'](config\/athlete-profile-ui\.js\?v=\d+)["']\)/)?.[1];
const baselineProfilePath=profilePath(baselineFile('index.html').toString());
const candidateProfilePath=profilePath(fs.readFileSync(path.join(root,'index.html'),'utf8'));
const matchCentrePath=html=>html.match(/loadDeferredScript\(["'](config\/match-centre\.js\?v=\d+)["']\)/)?.[1];
const baselineMatchCentrePath=matchCentrePath(baselineFile('index.html').toString());
const candidateMatchCentrePath=matchCentrePath(fs.readFileSync(path.join(root,'index.html'),'utf8'));
const launchOptions=process.env.PWA_EXECUTABLE_PATH?{executablePath:process.env.PWA_EXECUTABLE_PATH}:{};
let phase='baseline', nextRelease=false, optionalFailure=false, coreFailure=false, networkFailure=false, versionRequests=0;
function candidateFile(name){
  const file=path.join(root,name);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
  let bytes=fs.readFileSync(file);
  if(nextRelease && ['index.html','service-worker.js','app-version.json'].includes(name)){
    bytes=Buffer.from(bytes.toString().replaceAll('v='+candidateVersion,'v='+ (+candidateVersion+1)).replaceAll('v'+candidateVersion,'v'+ (+candidateVersion+1)).replaceAll('"'+candidateVersion+'"','"'+ (+candidateVersion+1)+'"'));
  }
  return bytes;
}
const server=http.createServer((req,res)=>{
  if(networkFailure){req.socket.destroy();return;}
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
  if(name==='app-version.json')versionRequests++;
  if(name.includes('..')){res.writeHead(400);res.end();return;}
  if(phase==='candidate' && ['data/marquee-candidates.v1.json','data/comms-sources.v1.json','data/editorial-maintenance-sources.v1.json'].includes(name)){res.writeHead(404,{'cache-control':'private, no-store'});res.end('Not a public resource');return;}
  if(phase==='candidate' && ((optionalFailure && name==='assets/identities/events/le-mans-24-hours.png') || (coreFailure && name===(process.env.PWA_REQUIRED_FAILURE_ASSET||'assets/js/app-shell-runtime.js')))){res.writeHead(503);res.end();return;}
  const bytes=phase==='baseline'?baselineFile(name):candidateFile(name);
  if(!bytes){res.writeHead(404);res.end();return;}
  const type=({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'})[path.extname(name)]||'application/octet-stream';
  res.writeHead(200,{...(phase==='candidate'?candidateHeaders:{}),'content-type':type,'cache-control':'no-store'});res.end(bytes);
});
(async()=>{
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await (process.env.PWA_BROWSER==='webkit'?webkit:chromium).launch({headless:true,...launchOptions});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    const page=await context.newPage();
    const pending=new Set(); context.on('request',r=>pending.add(r.url()));context.on('requestfinished',r=>pending.delete(r.url()));context.on('requestfailed',r=>pending.delete(r.url()));
    const navigations=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
    await page.goto(origin+'/?installed-pwa-upgrade=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:90000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof userPreferences!=='undefined' && !startupCoordinator.isHydrating(),null,{timeout:60000});
    const savedSelection=await page.evaluate(modernBaseline=>{
      const next=clonePreferences(userPreferences);next.onboardingComplete=true;next.feedCompact=true;next.theme='day';next.selectedSelectorEntityIds=['sport:nrl','sport:tennis','sport:f1'];next.followedSports=canonicalSportKeysForSelectorIds(next.selectedSelectorEntityIds);
      if(modernBaseline){
        next.preferenceGraph.entityFollows=[{participantId:'team:football:epl:1',followLevel:'follow'},{participantId:'team:football:epl:2',followLevel:'mute'},{participantId:'team:football:epl:3',followLevel:'unfollow'}];
        next.followFirst.notifications={...next.followFirst.notifications,userChoice:false,enabled:false,autoRemindersEnabled:false,sportingRemindersEnabled:false};
      }
      savePreferences(next);acknowledgeSelectorRelease();closeSelectorOptInPrompt();closeSettings({restoreTheme:false});
      sessionStorage.setItem('ns_chat_draft_v2:upgrade-test',JSON.stringify({body:'Preserve this unsent draft'}));
      return {sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds,...(modernBaseline?{entities:userPreferences.preferenceGraph.entityFollows,reminders:userPreferences.followFirst.notifications}:{})};
    },Number(baselineVersion)>=420);
    const assertSavedNativeChoices=async page=>{if(savedSelection.entities){assert.deepEqual(await page.evaluate(()=>userPreferences.preferenceGraph.entityFollows),savedSelection.entities,'Actual native follows/mutes/unfollows survive cached upgrade and reload');assert.deepEqual(await page.evaluate(()=>userPreferences.followFirst.notifications),savedSelection.reminders,'Remind OFF survives cached upgrade and reload');}};
    assert(savedSelection.selectors.includes('sport:tennis'),'The baseline must actually save the explicit tennis follow');
    if(baselineProfilePath)await page.evaluate(async url=>{const response=await fetch('/'+url);if(!response.ok)throw Error('Baseline profile cache could not be populated');await response.text();},baselineProfilePath);
    if(baselineMatchCentrePath)await page.evaluate(async url=>{const response=await fetch('/'+url);if(!response.ok)throw Error('Baseline Match Centre cache could not be populated');await response.text();},baselineMatchCentrePath);
    await page.evaluate(async version=>{const cache=await caches.open('nothingsport-shell-v'+version);await cache.put('/data/marquee-candidates.v1.json',new Response('{"qaLegacyDraft":true}'));},baselineVersion);
    await page.evaluate(async version=>{const cache=await caches.open('nothingsport-shell-v'+version);await cache.put('/data/%6darquee-candidates.v1.json',new Response('{"qaLegacyEncodedDraft":true}'));},baselineVersion);
    if(!keepOpen)await page.close();
    phase='candidate';optionalFailure=true;
    const upgraded=keepOpen?page:await context.newPage();let upgradeNavigations=0;
    const upgradeNavigationLog=[];
    // Count document navigations for the reload-loop gate. Follow's ordinary
    // hash/history transitions also emit framenavigated; retain them separately.
    const upgradeDocuments=[];upgraded.on('request',r=>{if(r.isNavigationRequest()&&r.resourceType()==='document'&&r.frame()===upgraded.mainFrame()){upgradeNavigations++;upgradeDocuments.push({url:r.url(),at:Date.now(),nextRelease});}});
    upgraded.on('framenavigated',frame=>{if(frame===upgraded.mainFrame())upgradeNavigationLog.push({url:frame.url(),at:Date.now(),nextRelease});});
    if(keepOpen)await upgraded.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
    else await upgraded.goto(origin+'/?installed-pwa-upgrade=1',{waitUntil:'domcontentloaded'});
    const firstVersion=await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content');
    if(!keepOpen && +baselineVersion>=238)assert.equal(firstVersion,candidateVersion,'network-first baselines must receive the current first document');
    // Legacy cache-first workers cannot be retroactively changed: require an
    // automatic migration to the real candidate without a second user launch.
    try { await upgraded.waitForFunction(v=>document.querySelector('meta[name="app-shell-version"]')?.content===v,candidateVersion,{timeout:60000}); } catch(error) { console.error('Pending requests', [...pending]); console.error('Legacy catch-up diagnostic', await upgraded.evaluate(async()=>({version:document.querySelector('meta[name="app-shell-version"]')?.content,update:globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.scriptURL,waiting:r.waiting?.state,installing:r.installing?.state})),caches:await caches.keys()}))); throw error; }
    try { await upgraded.waitForFunction(()=>globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot().workerVersion===document.querySelector('meta[name="app-shell-version"]').content,null,{timeout:45000}); }
    catch(error){console.error('Pending requests', [...pending]);console.error('Worker upgrade diagnostics',await upgraded.evaluate(async()=>({version:document.querySelector('meta[name="app-shell-version"]')?.content,state:globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),caches:await caches.keys()})));throw error;}

    assert.equal(new URL(upgraded.url()).searchParams.get('installed-pwa-upgrade'),'1');
    const expectedStandings=JSON.parse(JSON.stringify(require('./build-app-shell-runtime').cardStandings().map(({competitionId,snapshotTimeUtc,entries})=>({competitionId,snapshotTimeUtc,entries}))));
    await upgraded.waitForFunction(()=>Array.isArray(globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS));
    const calendarUi=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/loadDeferredScript\('([^']*calendar-sync-ui\.js\?v=\d+)'\)/)[1];
    assert.equal(await upgraded.evaluate(url=>caches.match('/'+url).then(r=>r?.text()),calendarUi),fs.readFileSync(path.join(root,'assets/js/calendar-sync-ui.js'),'utf8'),'Calendar UI is available from the exact upgraded offline cache');
    const stylesheet=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/href="(styles\/follow-feed-rework\.css\?v=\d+)"/)[1];
    assert.equal(await upgraded.evaluate(url=>caches.match('/'+url).then(r=>r?.text()),stylesheet),fs.readFileSync(path.join(root,'styles/follow-feed-rework.css'),'utf8'),'Upgraded cache must contain the exact versioned card stylesheet');

    assert.deepEqual(await upgraded.evaluate(()=>globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS.map(({competitionId,snapshotTimeUtc,entries})=>({competitionId,snapshotTimeUtc,entries}))),expectedStandings,'cached old runtime cannot conceal current source observations and shared/pending ranks');
    let profileCacheVerified=false;
    if(candidateProfilePath){
      const profile=await upgraded.evaluate(async url=>{const response=await fetch('/'+url);if(!response.ok)throw Error('Candidate profile module unavailable');return response.text();},candidateProfilePath);
    assert.equal(crypto.createHash('sha256').update(profile).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'config/athlete-profile-ui.js'))).digest('hex'),'Previously cached profile must not conceal the upgraded module');
      for(const prefix of ['config/athletes.js','assets/js/athletes-ui.js']){
        const url=fs.readFileSync(path.join(root,'index.html'),'utf8').match(new RegExp(prefix.replaceAll('.','\\.')+'\\?v=\\d+'))[0];
        assert.equal(await upgraded.evaluate(url=>caches.match('/'+url).then(r=>r?.text()),url),fs.readFileSync(path.join(root,prefix),'utf8'),'The upgraded offline cache retains the exact current Follow module');
      }
      profileCacheVerified=true;
      await assertCachedFootballStatus(upgraded);
      await assertCachedCanonicalResults(upgraded);
      await assertCachedMultidayRetention(upgraded);
    await assertCachedFonts(upgraded);await assertCachedParticipantCalendar(upgraded);await assertCachedStageCalendarPolicy(upgraded);await assertCachedAflwFinalDate(upgraded);
      await assertCachedReviewedCalendarNotes(upgraded);
    }
    await upgraded.waitForFunction(()=>typeof userPreferences!=='undefined');
    assert.equal(await upgraded.evaluate(()=>userPreferences.feedCompact),true,'Saved compact preference must survive legacy migration');
    assert.equal(await upgraded.evaluate(()=>userPreferences.theme),'day','Saved appearance must survive migration');
    const restoredSelection=await upgraded.evaluate(()=>({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds}));
    await assertSavedNativeChoices(upgraded);
    assert.deepEqual(restoredSelection.selectors,savedSelection.selectors,'Canonical follow selections survive migration');
    // New taxonomy children (e.g. NRLW under NRL) may expand a followed code,
    // but none of its previously included sports may disappear.
    assert(savedSelection.sports.every(sport=>restoredSelection.sports.includes(sport)),'Existing followed sport coverage survives migration');
    if(keepOpen)assert.equal(await upgraded.evaluate(()=>JSON.parse(sessionStorage.getItem('ns_chat_draft_v2:upgrade-test')).body),'Preserve this unsent draft');
    await upgraded.waitForTimeout(3500);assert(upgradeNavigations<=2,'Legacy migration must navigate at most once: '+JSON.stringify(upgradeNavigationLog));
    // The ongoing release exercises an already-open page, rather than another
    // fresh navigation. The old releases above use authentic historical bytes.
    const currentState=await upgraded.evaluate(async()=>{await NOTHINGSPORTS_APP_UPDATE.check({force:true});return NOTHINGSPORTS_APP_UPDATE.snapshot();});
    assert.equal(currentState.phase,'current');
    if(candidateHeaders['Content-Security-Policy']){
      const cachedPolicy=await upgraded.evaluate(async()=>{const shell=await caches.match('/index.html');return shell?.headers.get('content-security-policy');});
      assert.equal(cachedPolicy,candidateHeaders['Content-Security-Policy'],'installed shell must retain the new response policy offline');
    }
    const before=versionRequests;
    await upgraded.evaluate(()=>{for(let i=0;i<100;i++)window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    await upgraded.waitForTimeout(200);assert(versionRequests-before<=1,'Resume events must coalesce');
    const assertOwnerSourcesClosed=async()=>{
      const values=await upgraded.evaluate(async()=>Promise.all(['/data/marquee-candidates.v1.json','/data/comms-sources.v1.json','/data/editorial-maintenance-sources.v1.json','/data/%6darquee-candidates.v1.json','/data%2fmarquee-candidates.v1.json'].map(async url=>{const r=await fetch(url);return {status:r.status,cached:Boolean(await caches.match(url))};})));
      assert.deepEqual(values,Array.from({length:5},()=>({status:404,cached:false})),'upgraded worker must deny plain/encoded source downloads and discard seeded legacy draft caches');
    };
    await assertOwnerSourcesClosed();
    await upgraded.evaluate(async()=>{const r=await fetch('/participate.html');if(!r.ok)throw Error('Public fixture page unavailable');await r.text();});
    await upgraded.waitForFunction(async()=>Boolean(await caches.match('/participate.html')));
    const participationCache=await upgraded.evaluate(async()=>await(await caches.match('/participate.html')).text());
    assert(!participationCache.includes('/data/marquee-candidates.v1.json')&&participationCache.includes('/api/participation'),'cached fixture page must use the public projection');
    await context.setOffline(true);
    await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.check({force:true}));
    assert.equal(await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.snapshot().phase),'offline');
    // Simulate an unreachable origin at the transport boundary. WebKit's
    // browser-level offline emulation can reject navigation before dispatching
    // a service-worker fetch, which is a different scenario.
    await context.setOffline(false);networkFailure=true;
    await upgraded.reload({waitUntil:'domcontentloaded'});
    assert.equal(await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content'),candidateVersion,'Offline navigation uses the validated current shell');
    await upgraded.waitForFunction(()=>Array.isArray(globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS));
    assert.deepEqual(await upgraded.evaluate(()=>globalThis.NOTHINGSPORTS_FEED_CARD_STANDINGS.map(({competitionId,snapshotTimeUtc,entries})=>({competitionId,snapshotTimeUtc,entries}))),expectedStandings,'offline restart retains the upgraded source observations and all positions');
    await assertOwnerSourcesClosed();
    await assertCachedFootballStatus(upgraded);
    await assertCachedCanonicalResults(upgraded);
    await assertCachedMultidayRetention(upgraded);
    await assertCachedFonts(upgraded);await assertCachedParticipantCalendar(upgraded);await assertCachedStageCalendarPolicy(upgraded);await assertCachedAflwFinalDate(upgraded);
    await assertCachedReviewedCalendarNotes(upgraded);
    await assertSavedNativeChoices(upgraded);
    if(fs.existsSync(path.join(root,'assets/js/follow-presentation-ui.js'))){
      const choices=()=>JSON.stringify({sports:userPreferences.followedSports,selectors:userPreferences.selectedSelectorEntityIds,entities:userPreferences.preferenceGraph.entityFollows,spoilers:userPreferences.showSpoilers,theme:userPreferences.theme,notifications:userPreferences.notifications});
      const before=await upgraded.evaluate(choices);
      await upgraded.evaluate(()=>{closeSettings();activeTab='follow';followHomeView='favourites';renderAll();});
      await upgraded.getByRole('button',{name:'Sports',exact:true}).click();
      await upgraded.locator('.follow-navigation').waitFor();
      assert.equal(await upgraded.evaluate(choices),before,'first Follow open offline retains follows, spoiler, appearance and notification choices');
      const url=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/const url='(assets\/js\/follow-presentation-ui\.js\?v=\d+)'/)[1];
      const cached=await upgraded.evaluate(async url=>{const r=await caches.match('/'+url);return r?await r.text():null;},url);
      assert.equal(cached,fs.readFileSync(path.join(root,'assets/js/follow-presentation-ui.js'),'utf8'),'offline first open executes the exact precached Follow interface');
      await upgraded.evaluate(()=>{activeTab='feed';renderAll();});
    }
    networkFailure=false;await context.setOffline(false);
    await upgraded.waitForFunction(()=>typeof NOTHINGSPORTS_APP_UPDATE!=='undefined');
    await upgraded.evaluate(()=>sessionStorage.setItem('ns_chat_draft_v2:upgrade-test',JSON.stringify({body:'Preserve this unsent draft'})));
    nextRelease=true;
    // A missing required runtime must retain the last valid worker.
    coreFailure=true;
    await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.check({force:true}));
    await upgraded.waitForTimeout(2000);
    assert.equal(await upgraded.locator('meta[name="app-shell-version"]').getAttribute('content'),candidateVersion);
    assert.equal(await upgraded.evaluate(()=>NOTHINGSPORTS_APP_UPDATE.snapshot().workerVersion),candidateVersion);
    coreFailure=false;
    // Resume an existing page after the throttle interval. No reload call.
    await upgraded.waitForTimeout(31000);
    await upgraded.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    try {await upgraded.waitForFunction(v=>document.querySelector('meta[name="app-shell-version"]')?.content===v,String(+candidateVersion+1),{timeout:45000}); } catch(error){
      console.error('Resume diagnostics', await upgraded.evaluate(async()=>({version:document.querySelector('meta[name="app-shell-version"]')?.content,state:NOTHINGSPORTS_APP_UPDATE.snapshot(),focus:document.activeElement?.outerHTML.slice(0,240),ready:document.readyState,hydrating:startupCoordinator.isHydrating(),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),cacheKeys:await caches.keys()})));
      throw error;
    }
    assert.equal(await upgraded.evaluate(()=>JSON.parse(sessionStorage.getItem('ns_chat_draft_v2:upgrade-test')).body),'Preserve this unsent draft');
    await upgraded.waitForFunction(()=>typeof userPreferences!=='undefined');
    assert.equal(await upgraded.evaluate(()=>userPreferences.feedCompact),true);
    await assertSavedNativeChoices(upgraded);
    await upgraded.waitForTimeout(3500);
    assert(upgradeNavigations<=4,'No repeat navigation after resumed update: '+JSON.stringify({frames:upgradeNavigationLog,documents:upgradeDocuments}));
    console.log(JSON.stringify({baselineVersion,candidateVersion,firstVersion,keepOpen,legacyAutomaticCatchup:true,upgradeNavigations,upgradeDocuments,frameNavigationEvents:upgradeNavigationLog,preferencesPreserved:true,nativeDispositionAndRemindOffVerified:!!savedSelection.entities,optionalFailureTolerated:true,requiredFailurePreservesShell:true,offlineFallback:true,resumeUpgrade:true,profileCacheVerified,standingsCacheVerified:true,footballStatusCacheVerified:true,canonicalFinalResultsCacheVerified:true,multidayRetentionCacheVerified:true,cricketStatusCacheVerified:true,nhlViewingCacheVerified:true,matchCentreCacheVerified:true,fontCacheVerified:true},null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
