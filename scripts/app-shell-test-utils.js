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
module.exports = {assertShellModule,readFollowApplicationSource};
