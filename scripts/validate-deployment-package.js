#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'.');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'deployment-files.json'),'utf8'));
for(const file of inventory.files){
  assert(!file.path.includes('supabase_keys.txt')&&!file.path.split('/').some(p=>p.startsWith('.env')),'Secret excluded');
  if(!file.path.endsWith('.js')||file.path.startsWith('assets/'))continue;
  const source=fs.readFileSync(path.join(root,file.path),'utf8');
  for(const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){
    const base=path.resolve(root,path.dirname(file.path),match[1]);
    assert([base,base+'.js',base+'.json',path.join(base,'index.js')].some(p=>fs.existsSync(p)),`${file.path}: missing ${match[1]}`);
  }
}
for(const file of ['index.html','service-worker.js','manifest.webmanifest','app-version.json','data/feed/manifest.json','data/code-inspector/manifest.json','data/follow-directory/manifest.v1.json','api/feed.js','api/chat.js','api/user-state.js'])assert(fs.existsSync(path.join(root,file)),`Missing required runtime ${file}`);
for(const manifest of ['data/code-inspector/manifest.json','data/follow-directory/manifest.v1.json','data/feed/manifest.json']){
  const source=fs.readFileSync(path.join(root,manifest),'utf8');
  for(const [,file] of source.matchAll(/"(?:chunkPath|path|url|scriptPath|jsonUrl|scriptUrl)"\s*:\s*"((?:\/?data\/)[^"]+)"/g))assert(fs.existsSync(path.join(root,file.replace(/^\//,''))),`Missing dynamic asset ${file}`);
}
// Exercise real filesystem-based catalogue discovery from the staged package.
const catalogue=require(path.join(root,'lib/calendar-catalogue')).catalogue();
assert(catalogue.length>500,'Staged catalogue lost coverage');
require(path.join(root,'lib/live-source-adapters'));
console.log(`Deployment package verified: ${inventory.files.length} files, ${inventory.bytes} bytes, ${catalogue.length} catalogue events`);
