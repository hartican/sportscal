'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){let renders=0,requests=0;const panel={childNodes:['saved-card'],replaceChildren(fragment){this.childNodes=fragment.nodes;},dataset:{}};const c={Date:{now:()=>c.now},now:1000,JSON,Promise,document:{hidden:true,getElementById:()=>panel,createDocumentFragment:()=>({nodes:[],append(...nodes){this.nodes=nodes;panel.childNodes=[];}})},activeTab:'feed',activeView:'list',activeFilter:'all',activeInspectorCodeId:null,userPreferences:{showSpoilers:true},eventActions:{},feedViewFilters:{sport:'all'},todayMoreReveal:false,pendingNotificationEventId:null,calendarChoice:{active:false},startupCoordinator:{isHydrating:()=>false},serverSyncClient:{sessionSubject:()=>c.account},account:'one',data:'one',currentFeedPresentationFingerprint:()=>c.data,activeSportHubKey:()=>null,feedCardSlots:new Map([['saved-slot',{event:{id:'one'}}]]),feedCardWindowObserver:{disconnect(){},observe(){}},queueLiveFixtureSnapshot(){},loadDeferredScript(){requests++;return Promise.resolve();},activateTopLevelTab(next){c.activeTab=next;if(next==='feed')c.renderListView();else panel.childNodes=['other-tab'];},renderListView(){renders++;panel.childNodes=['rebuilt'];}};c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync('config/startup-view-cache.js','utf8'),c);return {c,panel,renders:()=>renders,requests:()=>requests};}
const fast=fixture();fast.c.activateTopLevelTab('events');fast.c.feedCardSlots.clear();fast.c.activateTopLevelTab('feed');assert.deepEqual(fast.panel.childNodes,['saved-card']);assert.equal(fast.renders(),0);assert(fast.c.feedCardSlots.has('saved-slot'));assert.equal(fast.requests(),0,'Hidden idle warming performs no requests');
for(const change of [c=>c.account='two',c=>c.userPreferences.showSpoilers=false,c=>c.eventActions={dismissed:true},c=>c.data='changed-score',c=>c.now+=30000,c=>c.feedViewFilters.sport='football',c=>c.calendarChoice.active=true]){const f=fixture();f.c.activateTopLevelTab('events');change(f.c);f.c.activateTopLevelTab('feed');assert.equal(f.renders(),1,'Changed consent/account/data/expiry must invalidate the cached nodes');assert.deepEqual(f.panel.childNodes,['rebuilt']);}
console.log('Actual cached-view hooks: identity reuse, restored window slots, hidden pause, thirty-second expiry and account/consent/data/filter invalidation passed.');
const html=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('service-worker.js','utf8'),idle=fs.readFileSync('config/startup-view-cache.js','utf8');
for(const module of ['config/match-centre.js','assets/js/match-centre-ui.js','config/event-overviews-ui.js']){
 const escaped=module.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),url=new RegExp(escaped+'\\?v=\\d+');
 assert.equal(idle.match(url)?.[0],html.match(url)?.[0],'Idle and interactive callers share one '+module+' instance');
 assert(worker.includes('/'+html.match(url)?.[0]),'The required cache holds that exact deferred module');
 if(module==='config/event-overviews-ui.js')assert.equal(fs.readFileSync('assets/js/follow-presentation-ui.js','utf8').match(url)?.[0],html.match(url)?.[0],'Follow Major Events reuses the same cached overview owner');
}
const cssUrl=/assets\/styles\/match-centre\.css\?v=\d+/;
const sharedCss=fs.readFileSync('assets/js/match-centre-ui.js','utf8').match(cssUrl)?.[0];
assert.equal(fs.readFileSync('config/event-overviews-ui.js','utf8').match(cssUrl)?.[0],sharedCss,'Either first style owner installs the same current stylesheet');
assert(worker.includes('/'+sharedCss),'The shared stylesheet is required under its current cache key');
console.log('Interactive, idle and overview owners use one module instance and one installed stylesheet.');

// The actual Feed caller must not replace a cold Follow directory's queued
// redraw. The browser regression supplies the genuine response/scroll race.
const feedRenderStart=html.indexOf('function renderFeedIfPresentationChanged('),feedRenderEnd=html.indexOf('\nfunction renderCurrentSection(',feedRenderStart);
assert(feedRenderStart>=0&&feedRenderEnd>feedRenderStart);
const feedRenderSource=html.slice(feedRenderStart,feedRenderEnd),feedLifecycle=require('../config/feed-refresh-lifecycle');
function foregroundFixture(tab,{hydrating=false,scrolling=true,changed=false,lifecycle=feedLifecycle}={}){
 const followRedraw=()=>{c.followRows++;},c={activeTab:tab,scrollMomentumActive:scrolling,startupCoordinator:{isHydrating:()=>hydrating},FEED_REFRESH_LIFECYCLE:lifecycle,committedFeedPresentationFingerprint:'shown',currentFeedPresentationFingerprint:()=>changed?'updated':'shown',followRows:0,renders:0,pending:followRedraw,queueScrollIdleMutation(fn){c.pending=fn;},renderAll(){c.renders++;}};
 vm.runInNewContext(feedRenderSource,c);return {c,followRedraw};
}
for(const changed of [false,true]){
 const {c,followRedraw}=foregroundFixture('follow',{changed}),rendered=c.renderFeedIfPresentationChanged();assert.equal(c.pending,followRedraw,'Inactive Feed work cannot replace the actual foreground Follow intent');assert.equal(rendered,false);c.pending();assert.equal(c.followRows,1);assert.equal(c.renders,0);
 c.activeTab='feed';c.scrollMomentumActive=false;assert.equal(c.renderFeedIfPresentationChanged(),changed,'Returning to Feed still observes the current data fingerprint');assert.equal(c.renders,changed?1:0);
}
for(const changed of [false,true]){const {c,followRedraw}=foregroundFixture('feed',{changed});assert(c.renderFeedIfPresentationChanged());assert.notEqual(c.pending,followRedraw);c.scrollMomentumActive=false;c.pending();assert.equal(c.renders,changed?1:0,'Visible Feed processing retains its normal idle behaviour');}
const startup=foregroundFixture('follow',{hydrating:true});assert(startup.c.renderFeedIfPresentationChanged());assert.equal(startup.c.renders,1,'Existing startup hydration still renders its current section');
const noLifecycle=foregroundFixture('feed',{scrolling:false,lifecycle:null});assert(noLifecycle.c.renderFeedIfPresentationChanged());assert.equal(noLifecycle.c.renders,1,'An unavailable fingerprint helper retains the original render fallback');
console.log('Foreground Follow keeps its queued redraw; returning/active Feed, startup hydration and missing-lifecycle fallback passed.');
