#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const index=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('service-worker.js','utf8');
const shell=worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1];assert(shell,'Worker install manifest exists');
const cached=new Set([...shell.matchAll(/"([^"\n]+)"/g)].map(m=>m[1]));
const scripts=[...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]).filter(s=>!/^https?:/.test(s));
for(const src of scripts){const url=new URL(src,'https://example.test/');assert(cached.has(url.pathname+url.search),'Required page script is not pre-cached at its exact version: '+src);}
const styles=[...index.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]).filter(s=>!/^https?:/.test(s));
for(const src of styles){const url=new URL(src,'https://example.test/');assert(cached.has(url.pathname+url.search),'Required page stylesheet is not pre-cached at its exact version: '+src);}
console.log('Worker install manifest matches all '+scripts.length+' critical scripts and '+styles.length+' stylesheets including version queries.');
