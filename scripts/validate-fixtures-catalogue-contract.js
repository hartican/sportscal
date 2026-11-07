'use strict';
// Run the unchanged real fixture validator against owned catalogue mutations.
// All other source/UI checks execute; no provider, DB or browser is involved.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),file=path.join(__dirname,'validate-fixtures-contract.js'),original=fs.readFileSync,log=console.log;
const baseline=JSON.parse(original(path.join(root,'data/canonical/football-directory.v1.json'),'utf8')),source=original(file,'utf8'),cases=[];
function execute(document){
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 fs.readFileSync=function(name,...args){if(path.resolve(String(name))===path.join(root,'data/canonical/football-directory.v1.json'))return JSON.stringify(document);return original(name,...args);};
 try{console.log=()=>{};m._compile(source,file);}finally{fs.readFileSync=original;console.log=log;}
}
execute(baseline);cases.push('actual seven-pair catalogue passes every real fixture assertion');
for(const [name,edit]of [
 ['missing Australian Championship',d=>d.leagues=d.leagues.filter(row=>row.id!=='competition:australian-championship')],
 ['duplicate ID',d=>d.leagues[1].id=d.leagues[0].id],
 ['duplicate key',d=>d.leagues[1].key=d.leagues[0].key],
 ['unexpected pair',d=>d.leagues.find(row=>row.id==='competition:australian-championship').key='unreviewed-competition'],
]){const document=structuredClone(baseline);edit(document);assert.throws(()=>execute(document),error=>error.code==='ERR_ASSERTION',name+' escaped strict real fixture gate');cases.push(name+' is rejected');}
console.log(JSON.stringify({status:'PASS',controls:cases.length,externalRequests:0,catalogueDataChanged:false,cases},null,2));
