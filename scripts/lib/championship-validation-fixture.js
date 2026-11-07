'use strict';
// Owned offline validation inputs only. No production caller imports this helper.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'../..'),FILE='data/football/fixtures/australian-championship.json',COMPETITION='competition:australian-championship';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function load(name,compressedSha,decodedSha){const packed=fs.readFileSync(path.join(__dirname,'../fixtures',name));assert.equal(sha(packed),compressedSha);const raw=zlib.gunzipSync(packed,{maxOutputLength:1048576});assert.equal(sha(raw),decodedSha);return JSON.parse(raw);}
const pre=load('championship-owned-fixed-20261031.json.gz','f11970f07d7bd3d3f2060a0425c65276ca2be93f87cf35f9127364c8119e5885','bf0bff636fe57d129029fa4e861a827f6d03565cb3a402af30d61e1a4bc7dc25');
const adopted=load('championship-adopted-fixed-20261031.json.gz','3d0a1399fa57d99cc908ed369f0bebd463e3e8c10e07c79a52f885f796990b42','d771a9a580eb6d826e214d4db300776f68aa633051027949ae3553420cb06673');
function documents(state){assert(['pre','adopted'].includes(state));return structuredClone((state==='pre'?pre:adopted).documents);}
function writeState(root,state){
 const docs=documents(state),document=docs[FILE];
 const write=(file,body)=>{const p=path.join(root,file);assert(p.startsWith(root+path.sep));fs.mkdirSync(path.dirname(p),{recursive:true});if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())fs.unlinkSync(p);fs.writeFileSync(p,body);};
 write(FILE,JSON.stringify(document,null,2)+'\n');write(FILE.replace('.json','.js'),'globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES["australian-championship"] = '+JSON.stringify(document)+';\n');
 for(const file of ['data/code-inspector/football.json','data/follow-schedule/football.json']){
  const current=JSON.parse(fs.readFileSync(path.join(ROOT,file))),rows=new Map(docs[file].fixtures.map(r=>[r.canonicalEventId,r]));let count=0;
  assert.equal(rows.size,48);const fixtures=current.fixtures.map(r=>{if(r.competitionId!==COMPETITION)return r;assert(rows.has(r.canonicalEventId));count++;return rows.get(r.canonicalEventId);});assert.equal(count,48);
  write(file,JSON.stringify({...current,fixtures})+'\n');
 }
 return document;
}
function withClock(fn){
 const OriginalDate=global.Date;global.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[adopted.clock]));}static now(){return OriginalDate.parse(adopted.clock);}};
 try{const value=fn();if(value&&typeof value.finally==='function')return value.finally(()=>{global.Date=OriginalDate;});global.Date=OriginalDate;return value;}catch(error){global.Date=OriginalDate;throw error;}
}
function createOwnedRoute(state='pre'){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-champ-owned-route-'))),steps=[],writes=[],applies=[],logs=[],ownedProcess={...process,argv:[],env:{}};
 try{
 const manifest=require('../../data/code-inspector/manifest.json');
 const targets=new Set(['data/code-inspector/football.json','data/follow-schedule/football.json','data/code-inspector/netball.json','data/follow-schedule/netball.json','data/code-inspector/manifest.json'].map(f=>path.join(root,f)));
 fs.mkdirSync(path.join(root,'data/code-inspector'),{recursive:true});fs.mkdirSync(path.join(root,'data/follow-schedule'),{recursive:true});fs.mkdirSync(path.join(root,'data/canonical'),{recursive:true});
 for(const c of manifest.codes)for(const file of ['data/code-inspector/'+c.slug+'.json',c.followSchedulePath])fs.symlinkSync(path.join(ROOT,file),path.join(root,file));
 fs.copyFileSync(path.join(ROOT,'data/code-inspector/manifest.json'),path.join(root,'data/code-inspector/manifest.json'));
 for(const file of ['data/code-inspector/netball.json','data/follow-schedule/netball.json']){fs.unlinkSync(path.join(root,file));fs.copyFileSync(path.join(ROOT,file),path.join(root,file));}
 for(const file of ['data/canonical/football-directory.v1.json','data/canonical/football-directory.v1.js','data/canonical/football-follow-index.v1.json','data/canonical/football-follow-index.v1.js'])fs.copyFileSync(path.join(ROOT,file),path.join(root,file));
 writeState(root,state);
 const safeFs=Object.create(fs);
 safeFs.writeFileSync=(file,...args)=>{const full=path.resolve(String(file));assert(targets.has(full),'Builder escaped owned target allowlist');assert(!fs.existsSync(full)||!fs.lstatSync(full).isSymbolicLink(),'Builder cannot write through peer symlinks');writes.push(full);return fs.writeFileSync(full,...args);};
 safeFs.mkdirSync=(file,...args)=>{assert(fs.existsSync(file),'Builder cannot create undeclared directories');return file;};
 for(const method of ['unlinkSync','rmSync','renameSync','appendFileSync','copyFileSync'])safeFs[method]=()=>assert.fail('Builder cannot mutate undeclared peers');
 function load(name,overrides={}){
  const filename=path.join(ROOT,'scripts',name),realRequire=createRequire(filename),mod={exports:{}};
  const localRequire=id=>{
   if(id==='node:fs')return safeFs;if(Object.hasOwn(overrides,id))return overrides[id];
   if(id.endsWith('.json')){const original=realRequire.resolve(id),relative=path.relative(ROOT,original),owned=path.join(root,relative);if(!relative.startsWith('..')&&fs.existsSync(owned))return JSON.parse(fs.readFileSync(owned,'utf8'));}
   return realRequire(id);
  };
  const source=fs.readFileSync(filename,'utf8').replace(/^#![^\n]*\n/,'')+(name==='update-cards.js'?'\nmodule.exports.ownedMain=main;':'');
  vm.runInThisContext('(function(require,module,exports,__dirname,__filename,process,console){'+source+'\n})',{filename})(localRequire,mod,mod.exports,path.join(root,'scripts'),filename,ownedProcess,{log:(...args)=>logs.push(args.join(' ')),warn:()=>{},error:()=>{}});
  return mod.exports;
 }
 const builder=load('build-code-inspector.js'),adapter=require('./australian-championship');
 const child={run:(_exe,args)=>{assert(['scripts/refresh-football-directory.js','scripts/build-code-inspector.js','scripts/build-follow-directories.js','scripts/validate-australian-championship.js','scripts/validate-australian-championship-integration.js','scripts/validate-diamonds-retained-schedule.js'].includes(args[0]),'Unexpected source/release child');steps.push(args);if(args[0]==='scripts/build-code-inspector.js'){const codes=args.find(a=>a.startsWith('--codes=')).slice(8).split(',');builder.build(args.includes('--retained-football-only')?{codeSlugs:codes,retainedFootballOnly:true}:{codeSlugs:codes,retainedCodeSlugs:codes});}return {status:0,stdout:'',stderr:''};}};
 const actual=load('update-cards.js',{'./build-code-inspector':builder,'./lib/australian-championship':{...adapter,apply:options=>{applies.push(options);return adapter.apply({...options,root});}},'./lib/refresh-child':child});
 const owner={...actual,parseOptions:(...args)=>withClock(()=>actual.parseOptions(...args)),ownedMain:()=>withClock(()=>actual.ownedMain())};
 function inventory(){const result={};function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())visit(p);else result[path.relative(root,p)]={symlink:e.isSymbolicLink()?fs.readlinkSync(p):null,sha256:e.isSymbolicLink()?null:sha(fs.readFileSync(p))};}}visit(root);return result;}
 return {root,owner,builder,steps,writes,applies,logs,inventory,setArgs:args=>{ownedProcess.argv=[process.execPath,path.join(ROOT,'scripts/update-cards.js'),...args];},setState:next=>writeState(root,next),close:()=>fs.rmSync(root,{recursive:true,force:true})};
 }catch(error){fs.rmSync(root,{recursive:true,force:true});throw error;}
}
module.exports={documents,writeState,withClock,createOwnedRoute,clock:adopted.clock,FILE};
