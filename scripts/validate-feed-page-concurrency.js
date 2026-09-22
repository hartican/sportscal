'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const pagination=html.slice(html.indexOf('async function loadNextFeedPage('),html.indexOf('function observeFeedPageSentinel('));
const all=html.match(/async function loadAllFeedPages\(\)\{.*\}/)[0];
async function check(signedIn,failed=false){
 let release,calls=0;const response=new Promise(resolve=>release=resolve);
 const context={FEED_PAGE_SIZE:20,feedPageLoading:false,feedPageRequest:null,feedViewGeneration:0,serverPersistence:{user:signedIn?{id:'test'}:null},serverFeedNextCursor:signedIn?'next':null,publicFeedManifest:{pages:[{path:'page.json'}]},publicFeedNextPageIndex:0,
 beginInSessionLoading:()=>({progress(){},complete(){},fail(){}}),feedPerformanceNow:()=>0,recordFeedInteraction(){},warmNextFeedPageDuringIdle(){},coerceEventList:p=>p.events,applyFeedEvents(){},console:{warn(){}},
 fetchJson:async()=>{calls++;await response;if(failed)throw Error('offline');return {events:[{id:'fixture'}]};},applyServerFeed:()=>{context.serverFeedNextCursor=null;}};
 context.serverSyncClient={loadFeed:context.fetchJson};vm.createContext(context);vm.runInContext(pagination+'\n'+all,context);
 const scrolling=context.loadNextFeedPage();
 const filtering=context.loadAllFeedPages();
 const outcome=filtering.then(()=>null,error=>error);release();await scrolling;const error=await outcome;
 assert.equal(calls,1,'scrolling and filtering share one request');
 if(failed){assert(error,'real failures remain retryable');const retry=context.loadNextFeedPage();await retry;assert.equal(calls,2,'failed in-flight request is cleared');}
 else assert.equal(error,null,'Filter must await the in-flight page, not report a load failure');
}
(async()=>{for(const signedIn of [false,true])for(const failed of [false,true])await check(signedIn,failed);console.log('Feed filtering joins in-flight public/signed-in pagination; real failures clear for retry.');})().catch(e=>{console.error(e);process.exitCode=1;});
