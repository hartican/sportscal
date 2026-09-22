'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8').match(/async function loadAllFeedPages\(\)\{.*\}/)[0];
async function test(user,cursor,pageIndex,expected){
 let calls=0;const context={serverPersistence:{user},serverFeedNextCursor:cursor,publicFeedManifest:{pages:[1,2,3]},publicFeedNextPageIndex:pageIndex};
 context.loadNextFeedPage=async()=>{calls++;if(user)context.serverFeedNextCursor=calls===1?'next':null;else context.publicFeedNextPageIndex++;return true;};
 vm.createContext(context);vm.runInContext(source,context);await context.loadAllFeedPages();assert.equal(calls,expected);
}
(async()=>{await test({id:'viewer'},null,1,0);await test({id:'viewer'},'first',1,2);await test(null,null,1,2);console.log('Feed filter pagination uses only the active authenticated or public Feed, never the other cursor.');})().catch(e=>{console.error(e);process.exitCode=1;});
