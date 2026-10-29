#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const index=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('service-worker.js','utf8');
const shell=worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1];assert(shell,'Worker install manifest exists');
const cached=new Set([...shell.matchAll(/"([^"\n]+)"/g)].map(m=>m[1]));
const shellVersion=index.match(/name="app-shell-version" content="(\d+)"/)?.[1];
assert(shellVersion,'Page shell version exists');
assert(index.includes('loadDeferredScript("config/preference-reset-ui.js?v="+document.querySelector'), 'Recovery UI follows the page shell version');
assert(cached.has('/config/preference-reset-ui.js?v='+shellVersion),'Recovery UI must be pre-cached at the current page shell version');
const scripts=[...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]).filter(s=>!/^https?:/.test(s));
for(const src of scripts){const url=new URL(src,'https://example.test/');assert(cached.has(url.pathname+url.search),'Required page script is not pre-cached at its exact version: '+src);}
const follow=fs.readFileSync('assets/js/follow-presentation-ui.js','utf8');
const navigation=follow.match(/loadDeferredScript\('([^']*follow-navigation\.js\?v=\d+)'\)/)?.[1];
assert(navigation&&cached.has('/'+navigation),'First Follow open must use the exact cached navigation dependency: '+navigation);
const warm=fs.readFileSync('config/startup-view-cache.js','utf8');
const centreUrls=[index,warm].flatMap(source=>[...source.matchAll(/loadDeferredScript\(['"](assets\/js\/match-centre-ui\.js\?v=\d+)['"]\)/g)].map(match=>match[1]));
assert.equal(centreUrls.length,2,'Direct navigation and idle warm-up both declare their Match Centre dependency');
assert.equal(new Set(centreUrls).size,1,'Idle warm-up must not execute a second Match Centre UI version and reset private state');
assert(cached.has('/'+centreUrls[0]),'Both Match Centre entry paths use the exact installed cached module');
let milestoneLoaders=0;
for(const directory of ['config','assets/js'])for(const file of fs.readdirSync(directory,{recursive:true}).filter(file=>file.endsWith('.js'))){
 const source=fs.readFileSync(directory+'/'+file,'utf8');
 for(const match of source.matchAll(/loadDeferredScript\(['"]((?:config\/(?:match-centre|score-details|event-overviews-ui)|assets\/js\/(?:tournament-card-ui|follow-navigation|football-card-context|follow-schedule-panel))\.js\?v=\d+)['"]\)/g))assert(cached.has('/'+match[1]),'Deferred consumers must use the exact cached shared owner in '+directory+'/'+file+': '+match[1]);
 for(const match of source.matchAll(/loadDeferredScript\(['"](assets\/js\/milestone-alerts-ui\.js\?v=\d+)['"]\)/g)){
  milestoneLoaders++;assert(cached.has('/'+match[1]),'Milestone loader must use the exact cached dependency in '+directory+'/'+file+': '+match[1]);
 }
}
assert(milestoneLoaders>=3,'Card, Settings and notification landing milestone loaders are checked');
const styles=[...index.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]).filter(s=>!/^https?:/.test(s));
for(const src of styles){const url=new URL(src,'https://example.test/');assert(cached.has(url.pathname+url.search),'Required page stylesheet is not pre-cached at its exact version: '+src);}
console.log('Worker install manifest matches all '+scripts.length+' critical scripts and '+styles.length+' stylesheets including version queries.');
