"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const modules = require("../config/app-shell-modules.json");
function assertShellModule(html, file){
  const tag = html.match(/<script src="assets\/js\/app-shell-runtime\.js\?v=\d+"><\/script>/)?.[0];
  assert(tag, "the versioned runtime must execute before the application");
  const asset=tag.match(/src="([^"]+)"/)[1];
  assert(fs.readFileSync(path.join(root,"service-worker.js"),"utf8").includes(`"/${asset}"`),"HTML and worker must request the same versioned runtime");
  assert(html.indexOf(tag) < html.indexOf("const SPORT_META"), "shell modules must precede app state");
  assert(modules.includes(file), `${file} must be in the ordered runtime manifest`);
  assert.equal(fs.readFileSync(path.join(root,"assets/js/app-shell-runtime.js"),"utf8"),require("./build-app-shell-runtime").build(),"runtime must exactly match every source module");
}
function readFollowApplicationSource(){
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const url=html.match(/const url='(assets\/js\/follow-presentation-ui\.js\?v=\d+)'/)?.[1];
  assert(url,"Follow presentation must be mounted by the application loader");
  assert(html.includes("loadDeferredScript(url)") && html.includes("globalThis.renderFollowViewLoaded()"),"the loaded interface must be called");
  assert(fs.readFileSync(path.join(root,"service-worker.js"),"utf8").includes(`"/${url}"`),"Follow must be available in the validated offline shell");
  const source=fs.readFileSync(path.join(root,url.split("?")[0]),"utf8");
  assert.doesNotThrow(()=>new Function(source),"the deferred interface must parse");
  return html+"\n"+source;
}
function readCardApplicationSource({includeHtml=true}={}){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assertShellModule(html,'config/venue-panel-ui.js');
  return (includeHtml?html+'\n':'')+fs.readFileSync(path.join(root,'config/venue-panel-ui.js'),'utf8');
}
function readCardFunction(name){
  const source=readCardApplicationSource({includeHtml:false});
  const node=require('acorn').parse(source,{ecmaVersion:'latest'}).body.find(node=>node.type==='FunctionDeclaration'&&node.id.name===name);
  assert(node,`${name} must exist in the actual ordered card runtime owner`);
  return source.slice(node.start,node.end);
}
function readInlineOwner(name, html=fs.readFileSync(path.join(root,'index.html'),'utf8')){
  const acorn=require('acorn');
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
    const source=match[1];
    for(const node of acorn.parse(source,{ecmaVersion:'latest'}).body){
      if(node.type==='FunctionDeclaration'&&node.id?.name===name)return source.slice(node.start,node.end);
      const call=node.type==='ExpressionStatement'&&node.expression;
      if(call?.type==='CallExpression'&&call.callee.type==='FunctionExpression'&&call.callee.id?.name===name)return source.slice(node.start,node.end);
    }
  }
  assert.fail(`${name} must exist in the actual inline application owner`);
}
function assertPrimaryNavigation(html){
  const navs=[...html.matchAll(/<nav class="tabs"[^>]*>[\s\S]*?<\/nav>/g)];
  assert.equal(navs.length,1,'one primary navigation owner must remain');
  const nav=navs[0][0];
  assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(match=>match[1]),['feed','match-centre','follow'],'approved primary destination IDs and order');
  assert.deepEqual([...nav.matchAll(/<span class="tab-label">([^<]+)<\/span>/g)].map(match=>match[1]),['Feed','Match Centre','Follow'],'approved primary labels and order');
  assert.equal((nav.match(/<button\b/g)||[]).length,3,'no extra or unlabelled primary destination');
  assert(html.indexOf(nav)>html.indexOf('</header>'),'persistent navigation stays outside the scrolling header');
}
function assertLegacyEventsNavigation(html){
  const vm=require('node:vm'),owner=readInlineOwner('syncAppRouteFromLocation',html);
  const branch=require('acorn').parse(owner,{ecmaVersion:'latest'}).body[0].body.body[0];
  assert.equal(branch.type,'IfStatement','legacy routing must enter the current route owner');
  for(const hash of ['#events','#events/major/us-open','#events/alert/tickets']){
    const preferences={followedSports:['cricket'],followFirst:{excludedMajorEventIds:['kept']},showSpoilers:false};
    const before=JSON.stringify(preferences),renders=[],closed=[];
    const location={hash,pathname:'/',search:''};
    const c={location,window:{location},activeTab:'follow',activeInspectorCodeId:'sport:cricket',calendarBulkController:null,
      userPreferences:preferences,syncTopLevelNavigationState(){},renderAll:()=>renders.push(true),
      closeCodeInspector:options=>{closed.push(options);c.activeInspectorCodeId=null;}};
    c.history={replaceState:(state,title,url)=>{location.hash=url.startsWith('#')?url:'';},pushState(){}};
    vm.createContext(c);vm.runInContext(readInlineOwner('activateTopLevelTab',html),c);
    vm.runInContext('(function(){'+owner.slice(branch.start,branch.end)+'})()',c);
    assert.equal(c.activeTab,'match-centre',hash+' reaches the approved fixture destination');
    assert.equal(location.hash,'#match-centre');assert.equal(renders.length,1);
    assert.equal(c.activeInspectorCodeId,null,'legacy navigation closes the prior Inspector');
    assert.equal(closed.length,1);assert.equal(closed[0].render,false,'the navigation owner controls the final render');
    assert.equal(JSON.stringify(preferences),before,'legacy routing preserves saved choices and Results');
  }
}
module.exports = {assertShellModule,readFollowApplicationSource,readCardApplicationSource,readCardFunction,readInlineOwner,assertPrimaryNavigation,assertLegacyEventsNavigation};
