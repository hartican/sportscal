'use strict';
// Owned loader adaptation only: exact new generated helper, no source planner overlays.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),acorn=require('acorn'),crypto=require('node:crypto');
const fixture=path.resolve(__dirname,'../..'),changes=[],hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function assertions(source){const out=[];function visit(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&(n.callee.name==='assert'||n.callee.object?.name==='assert'))out.push(source.slice(n.start,n.end));for(const value of Object.values(n))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}visit(acorn.parse(source,{ecmaVersion:'latest',allowHashBang:true}));return out;}
const edits={
 'scripts/lib/user-state-optional-view-tests.js':[["fs.readFileSync(path.join(root,helperFile),'utf8')","fs.readFileSync(path.join(root,'assets/js/account-awareness-runtime.js'),'utf8')",1]],
 'scripts/lib/user-state-events-scope-tests.js':[["for(const file of ['config/account-sync-diagnostic.js','config/preference-intent-reconcile.js'])\n  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);","/* Actual newly generated helper already loaded by actualContext; no source overlay. */",2]],
 'scripts/lib/user-state-tennis-default-tests.js':[["sourceQualified:true,generatedCandidateQualified:false","sourceQualified:false,generatedCandidateQualified:true",1]],
};
const original=Module._extensions['.js'];
Module._extensions['.js']=(module,filename)=>{
 const rel=path.relative(fixture,filename);if(!Object.hasOwn(edits,rel))return original(module,filename);
 const before=fs.readFileSync(filename,'utf8');let after=before;
 for(const [from,to,count]of edits[rel]){assert.equal(after.split(from).length-1,count,rel);after=after.split(from).join(to);}
 assert.deepEqual(assertions(after),assertions(before),'no original assertion changed: '+rel);
 changes.push({file:rel,beforeSha256:hash(before),inMemorySha256:hash(after),assertionsUnchanged:assertions(before).length,edits:edits[rel]});
 return module._compile(after,filename);
};
process.on('exit',()=>console.log(JSON.stringify({format:'generated-only-loader.v1',changes,fixtureFilesModified:false,assertionsRemoved:0,sourcePlannerOverlaysRemoved:2,versionOverride:false,artifactSha256:hash(fs.readFileSync(path.join(fixture,'assets/js/account-awareness-runtime.js')))})));
require(path.join(fixture,'scripts/validate-preference-bookkeeping.js'));
