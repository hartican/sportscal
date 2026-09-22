#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={};let reloads=0;
const never=()=>new Promise(()=>{});
const window={fetch:never,addEventListener(){}};
const context={window,document:{querySelector:()=>({content:'285'}),addEventListener(){},activeElement:null},navigator:{onLine:true,serviceWorker:{register:never,addEventListener:(name,fn)=>handlers[name]=fn}},location:{protocol:'https:'},setTimeout,clearTimeout,AbortController,sessionStorage:{getItem:()=>null,setItem(){}},console};
vm.runInNewContext(fs.readFileSync('assets/js/app-update.js','utf8'),context);
window.NOTHINGSPORTS_APP_UPDATE.configure(async()=>{reloads++;});
handlers.message({data:{type:'nothingsport-shell-probe',version:'284'},ports:[{postMessage(){}}]});
assert.equal(reloads,0,'an older controlling worker must not trigger a backwards reload of a newer page');
handlers.message({data:{type:'nothingsport-shell-probe',version:'286'},ports:[{postMessage(){}}]});
assert.equal(reloads,1,'a newer worker must still trigger a forward upgrade');
console.log('App update ignores stale worker versions and preserves forward upgrades.');
