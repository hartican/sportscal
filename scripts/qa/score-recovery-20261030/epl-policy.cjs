'use strict';
const path=require('node:path'),C=require('./epl-contract.cjs');
const fail=()=>{throw Object.assign(Error('GUARD_EPL_POLICY'),{code:'GUARD_EPL_POLICY'});};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const normalize=(args,root)=>[path.resolve(root,args[0]),...args.slice(1)];
function child(args,p){
 if(!Array.isArray(args)||args.some(a=>typeof a!=='string'))return false;
 const normalized=[path.relative(p.root,path.resolve(p.root,args[0])),...args.slice(1)];
 if(same(normalized,C.PUB.concat(normalized[6]))){try{C.selector(normalized[6],p);return true;}catch{return false;}}
 return [p.sourceArgv,...C.PREFIX,...C.TAIL,['scripts/qa-storyline-spoilers.js',C.KEYS[0]],['scripts/qa-storyline-spoilers.js',C.KEYS[1]],['scripts/build-paged-feed.js']].some(a=>same(normalize(args,p.root),normalize(a,p.root)));
}
function validate(p){
 if(p.sourceGitSha!==C.SHA||p.sourceProtocol!=='epl'||p.credentialEnvironmentNames.length!==0||!same(p.http,{requests:5,deadlineMs:20000,fixtureWireAndDecodedBytes:884736,tableWireAndDecodedBytes:147456,totalWireAndDecodedBytes:3686400,retries:0,redirect:'error'}))fail();
 if(p.mode==='epl-canonical'){
  const profile=require('./epl-profile.json');
  if(!same(p.writeFiles,profile.writeFiles.map(f=>path.join(p.root,f)))||!same(p.writeCaps,Object.fromEntries(Object.entries(profile.writeCaps).map(([f,v])=>[path.join(p.root,f),v])))||!same(p.rollbackHashes,Object.fromEntries(Object.entries(profile.rollbackInventory).map(([f,v])=>[path.join(p.root,f),v.sha256])))||!same(p.surfaceIds,profile.surfaceIds)||!same(p.surfaceBindings,profile.surfaceBindings))fail();
  if(p.root!==p.sourceRoot||!same(p.entryArgv,['scripts/update-cards.js','--quick','--source=epl','--local-only'])||!same(p.sourceArgv,['scripts/quick-results.js','--source=epl'])||Object.keys(p).some(k=>k.startsWith('control'))||p.wholeSeconds!==180||p.minimumSecondsBeforeLaunch!==160||p.minimumFreeBytes!==4831838208||p.maximumNewDiskBytes!==728303893||p.maxRollbackBytes!==268435456||p.maxFileBytes!==33554432||p.writeFiles.length!==161||Object.keys(p.rollbackHashes).length!==429)fail();
 }else if(p.mode==='owned-control'){
  if(p.root===p.sourceRoot||!p.controlBoundary||!same(p.entryArgv,[path.join(p.sourceRoot,'scripts/quick-results.js'),'--source=epl'])||!same(p.entryArgv,p.sourceArgv))fail();
 }else fail();
 for(const file of C.KEYS)if(!Array.isArray(p.surfaceIds?.[file])||p.surfaceIds[file].length!==380||new Set(p.surfaceIds[file]).size!==380||!p.surfaceBindings?.[file])fail();
 for(const k of p.environmentKeys)if(/SUPABASE|API_TOKEN|SECRET|PASSWORD/.test(k))fail();
 return true;
}
function dag(p,role){
 const sequence=[];let sourceLaunched=false;
 const next=args=>{
  if(role==='entry'){if(sourceLaunched||!same(normalize(args,p.root),normalize(p.sourceArgv,p.root)))fail();sourceLaunched=true;return;}
  if(role!=='source'||!child(args,p))fail();
  const candidate=[...sequence,args],placeholder=C.PUB.concat('<selector>');
  const templates=[C.PREFIX.concat(C.TAIL),[...C.PREFIX,placeholder,['scripts/qa-storyline-spoilers.js',C.KEYS[0]],['scripts/qa-storyline-spoilers.js',C.KEYS[1]],['scripts/build-paged-feed.js'],...C.TAIL]];
  if(!templates.some(t=>candidate.length<=t.length&&candidate.every((a,i)=>t[i]===placeholder?a.length===7&&same(a.slice(0,6),C.PUB)&&child(a,p):same(normalize(a,p.root),normalize(t[i],p.root)))))fail();
  sequence.push(args);
 };
 const complete=()=>role==='entry'?sourceLaunched:role==='source'?Boolean(C.childSequence(sequence,p)):sequence.length===0;
 return {next,complete,history:()=>sequence.map(a=>[...a])};
}
module.exports={validate,child,dag};
