'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8').match(/async function loadAllFeedPages\([^\n]+/)[0];
async function test(user,cursor,pageIndex,expected){
 let calls=0;const context={setTimeout,serverPersistence:{user},serverFeedNextCursor:cursor,publicFeedManifest:{pages:[1,2,3]},publicFeedNextPageIndex:pageIndex};
 context.loadNextFeedPage=async options=>{assert.equal(options.limit,50);calls++;if(user)context.serverFeedNextCursor=calls===1?'next':null;else context.publicFeedNextPageIndex++;return true;};
 vm.createContext(context);vm.runInContext(source,context);await context.loadAllFeedPages();assert.equal(calls,expected);
}
(async()=>{await test({id:'viewer'},null,1,0);await test({id:'viewer'},'first',1,2);await test(null,null,1,2);
 const context={setTimeout,serverPersistence:{user:{id:'viewer'}},serverFeedNextCursor:'stuck',loadNextFeedPage:async()=>true};vm.createContext(context);vm.runInContext(source,context);await assert.rejects(context.loadAllFeedPages(),/did not advance/);let requested=false;context.loadNextFeedPage=async()=>{requested=true;return true;};await context.loadAllFeedPages(()=>false);assert.equal(requested,false,'cancelled filter must not continue paging');
 console.log('Feed filter paging preserves active ownership, rejects repeated cursors and stops cancelled work.');})().catch(e=>{console.error(e);process.exitCode=1;});
