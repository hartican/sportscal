'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const majorEvents=require('../config/major-events.js');
const root=require('node:path').resolve(__dirname,'..');
const html=fs.readFileSync(root+'/index.html','utf8');
const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const fixtureDoc=JSON.parse(fs.readFileSync(root+'/data/follow-schedule/cricket.json'));
const current=fixtureDoc.fixtures.filter(f=>['fixture:cricket:espn:1530204','fixture:cricket:espn:1530205'].includes(f.id));
assert.equal(current.length,2);
const stale=current.map(({editorialNarrative,editorialPreview,storyline,...fixture})=>fixture);
let rendered=false;
const saved=new Map();
const context=vm.createContext({console,Map,Promise,Date,
  NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),
  FEED_FIXTURE_RECONCILIATION:require('../config/feed-fixture-reconciliation'),
  userPreferences:{},liveFixtureRevision:'loaded',liveFixtureEvents:[],
  activeEvents:structuredClone(stale),followedScheduleFixtures:new Map(),followedScheduleLoads:new Map(),
  disposableStore:{hydrate:async()=>({events:structuredClone(stale)}),set:(key,value)=>saved.set(key,value)},
  loadCodeInspectorManifest:async()=>({codes:[{id:'sport:cricket',slug:'cricket',followSchedulePath:'data/follow-schedule/cricket.json'}]}),
  fetchJson:async(_path,options)=>{assert.equal(options.cache,'no-store');return fixtureDoc;},
  buildFollowEligibilityContext:()=>({}),FOLLOW_FIRST:{reasonForEvent:f=>current.some(c=>c.id===f.id)},
  eventMeetsDerivedRetention:()=>true,mergeFootballFixtureEvents:events=>events,
  normalizeEvents:()=>{},rebuildDerivedCardCache:()=>{},startupFunnelFinished:true,
  renderFeedIfPresentationChanged:()=>{rendered=true;},
});
context.userPreferences={followedSports:['cricket']};
vm.runInContext(extract('function mergeCanonicalEventPages(', 'function applyFeedEvents(')+extract('async function loadFollowedScheduleFixtures(', 'function applyLoadedFootballBundle('),context);
(async()=>{
  await context.loadFollowedScheduleFixtures();
  for(const fixture of current){
    const actual=context.activeEvents.find(event=>event.id===fixture.id);
    assert.equal(actual.editorialNarrative.hook,fixture.editorialNarrative.hook,'Fresh editorial replaces cached fixture');
    assert.equal(actual.editorialNarrative.synopsis,fixture.editorialNarrative.synopsis);
    assert.equal(saved.get('followed-schedule:v2:sport:cricket').events.find(e=>e.id===fixture.id).editorialNarrative.hook,fixture.editorialNarrative.hook);
  }
  assert(rendered,'Open feed must rerender after schedule refresh');
  const worker=fs.readFileSync(root+'/service-worker.js','utf8');
  assert(worker.includes('(?:code-inspector|follow-schedule)'),'Schedule must use network-first worker route');
  assert(worker.includes("data/feed-meta.json"),"Feed manifest must use a fresh worker route");
  assert(worker.includes("data/feed/"),"Feed pages must use a fresh worker route");
  assert(worker.includes("fresh:true"),"Published feed must bypass stale service-worker responses");
  assert.equal(majorEvents.effectiveSubEventStatus({status:'upcoming',startTimeUtc:'2026-09-18T09:40:00.000Z',liveWindow:3},new Date('2026-09-18T11:07:00.000Z')),'live','AFL finals children must show Live during their published live window');
  console.log('Installed-app schedule regression passed: fresh ODI editorial replaces hydrated and active stale copies and triggers render.');
})().catch(error=>{console.error(error);process.exitCode=1;});
