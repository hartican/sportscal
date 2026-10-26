'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
function build({check=false}={}){
const source=['config/public-comments.js','config/public-comments-ui.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n;\n');
const output=require('terser').minify_sync(source,{compress:{passes:3},mangle:true}).code+'\n',target='assets/js/public-comments-ui.js';
if(check)assert.equal(fs.readFileSync(target,'utf8'),output,'Public comments bundle is stale');else fs.writeFileSync(target,output);
console.log('Deferred Public Feed UI: '+Buffer.byteLength(output)+' bytes.');

}
if(require.main===module)build({check:process.argv.includes('--check')});
module.exports={build};
