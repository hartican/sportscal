'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const output=require('terser').minify_sync(fs.readFileSync('config/epic-classics-ui.js','utf8'),{compress:{passes:3},mangle:true}).code+'\n',target='assets/js/epic-classics-ui.js';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),output,'EPIC UI bundle is stale');else fs.writeFileSync(target,output);
console.log('Deferred EPIC UI: '+Buffer.byteLength(output)+' bytes.');
