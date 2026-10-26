'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),acorn=require('acorn'),{JSDOM}=require('jsdom');

function extract(source,name){
 const start=source.indexOf('function '+name+'(');assert(start>=0,'Actual function missing: '+name);
 return source.slice(start,acorn.parseExpressionAt(source,start,{ecmaVersion:'latest'}).end);
}

// Source/DOM regression only: layout subrenderers, platform observations and
// persistence boundaries are controlled. The renderer and entire affected
// exposure/eligibility/participation-owner call chain are actual app source.
function run({baselineRef}={}){
 const html=fs.readFileSync('index.html','utf8');
 const source=baselineRef?cp.execFileSync('git',['show',baselineRef+':config/venue-panel-ui.js'],{encoding:'utf8'}):fs.readFileSync('config/venue-panel-ui.js','utf8');
 for(const local of [true,false])for(const [enabled,started,registered] of [[true,null,true],[false,null,true],[true,'2026-10-24T00:00:00.000Z',true],[true,null,false]]){
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'}),w=dom.window,saves=[],observations=[],seen=[];
  try{
   const element=()=>w.document.createElement('div');
   Object.assign(w,{
    activeTab:'feed',activeView:'list',activeFilter:'all',serverPersistence:{user:registered?{id:'reader'}:null},
    userPreferences:{showSpoilers:false,followedSports:[],followFirst:{notifications:{enabled:false}},pilotMeasurement:{enabled,participationVersion:'pilot-participation.v1',participationStartedAt:started}},
    PRODUCT_EVENTS:require('../config/product-events'),productEventsQueue:{},productExposureObserver:null,productExposureTargets:new WeakMap(),productExposureKeys:new Set(),productExposureTimers:new Map(),
    savePreferences(next){saves.push(next);w.userPreferences=next;},
    IntersectionObserver:class{observe(card){observations.push(card);}},
    sportMetaForEvent:()=>({color:'grey'}),getEventStatus:()=> 'live',FEED_CONTROLS:{timingState:()=>null},nowAEST:()=>new Date(),
    surfacePresentationForEvent:()=>({isNew:false,feedBucket:'direct'}),eventEnrichment:()=>({cardVariant:'standard',intensity:1,mustWatchScore:5}),
    spoilerSafeDisplayTitle:event=>event.name,CARD_IDENTITIES:{isTeamSportMatchup:()=>false},cardStateForEvent:()=> 'opened',importanceColorForEvent:()=> 'grey',
    isSpoilerVisible:()=>false,spoilerFactsForEvent:()=>({}),hasSpoilerSensitiveContent:()=>false,isLocalGame:()=>false,eventRecommendationClassification:()=> 'direct',
    getEventAction:()=>({}),appendCalendarChoice(){},nothingscoreSnapshotFor:()=>null,buildEventCardControls:element,bindCardCycle(){},cardLevelForState:()=> 'L2',
    buildCardDisclosureControl:element,buildFixtureTimingGroup:element,appendFixtureCardArtwork(){},buildFixtureCardEssentials:element,buildNothingscoreSummary:element,
    appendFixtureCardInformation(){},composeFeedCard(){},observeNewSurfaceItem:card=>seen.push(card),productRecommendationContext:()=>({}),
   });
   for(const name of ['clonePreferences','pilotMeasurementPreferences','ensureDefaultPilotMeasurementParticipation','pilotMeasurementEligible','productEventContextForEvent','getProductExposureObserver','observeProductOpportunity'])w.eval(extract(html,name));
   w.eval(extract(source,'buildDetailedEventCard'));
   const before=JSON.stringify(w.userPreferences),card=w.buildDetailedEventCard({id:'fixture:local-exposure',key:'nrl',name:'Fixture'},
    {mode:'schedule',...(local?{cardState:'opened',onCardStateChange(){}}:{})});
   assert.equal(card.dataset.cardState,'opened');
   if(local){
    assert.deepEqual(saves,[],'Transient fixture render must not invoke the actual pilot participation preference writer');
    assert.deepEqual(observations,[],'Transient card cannot register a normal Feed opportunity');
    assert.deepEqual(seen,[]);assert.equal(JSON.stringify(w.userPreferences),before);
   }else{
    assert.equal(seen.length,1,'Ordinary Feed card retains its existing seen owner');
    assert.equal(saves.length,enabled&&!started&&registered?1:0,'Existing ordinary Feed participation behaviour remains');
    assert.equal(observations.length,enabled&&registered?1:0);
    if(saves.length)assert.equal(typeof saves[0].pilotMeasurement.participationStartedAt,'string');
    assert.equal(w.userPreferences.followFirst.notifications.enabled,false);assert.equal(w.userPreferences.showSpoilers,false);
   }
  }finally{dom.window.close();}
 }
}

if(require.main===module){
 try{
  run({baselineRef:process.argv.find(arg=>arg.startsWith('--baseline-ref='))?.slice(15)});
  console.log('Transient card exposure: actual renderer/owner isolation, ordinary Feed, OFF, existing participant and signed-out controls passed.');
 }catch(error){console.error(error);process.exitCode=1;}
}
module.exports={run};
