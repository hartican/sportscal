'use strict';
// Actual publish-feed program and its actual normalizers/validators. Only file
// IO, process exit and console are owned in-memory boundaries; no CLI, source
// refresh, SDK, browser or native child runs in this control.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ROOT=path.resolve(__dirname,'..'),read=fs.readFileSync.bind(fs),source=read(path.join(__dirname,'publish-feed.js'),'utf8');
const captured=JSON.parse(read(path.join(ROOT,'data/events.json'),'utf8'));
const DateBefore=global.Date,clockAt=Math.max(Date.parse(captured.publishedAt||'')||0,...require('../data/canonical/cricket-reviewed-context.v1.json').records.map(r=>Date.parse(r.checkedAt)))+1000;
const identity=require('../config/fixture-identity');
const examples=['cricket','rugby','premier-league'].map(key=>captured.events.find(e=>e.key===key&&e.cardKind!=='event'&&e.cardType!=='tournament_overview'&&!(e.matchupParticipants||[]).some(p=>p.sourceEventId)));
assert(examples.every(Boolean),'Retained public sport examples required');
function publish({scoped=true,invalid=false}={}){
 const events=structuredClone(examples);delete events[0].venue;
 if(invalid)delete events[0].name;
 const input={...captured,events},files=new Map([['data/events.json',JSON.stringify(input)],['data/feed-meta.json','{}']].map(([p,b])=>[path.join(ROOT,p),b]));
 const original={readFileSync:fs.readFileSync,writeFileSync:fs.writeFileSync,mkdirSync:fs.mkdirSync,argv:process.argv,exit:process.exit,log:console.log,error:console.error};let writes=0,failure;const errors=[];
 try{
  fs.readFileSync=function(file,encoding){const value=files.get(path.resolve(String(file)));return value===undefined?read(file,encoding):encoding?value:Buffer.from(value);};
  fs.writeFileSync=(file,body)=>{const p=path.resolve(String(file));assert(['data/events.json','data/events.js','data/feed-meta.json'].some(name=>p===ROOT+'/'+name),'Unexpected publication write');files.set(p,String(body));writes++;};
  fs.mkdirSync=()=>{};console.log=()=>{};console.error=(...args)=>errors.push(args.join(' '));process.exit=code=>{throw Error('OWNED_EXIT_'+code+' '+errors.slice(0,4).join(' '));};
  global.Date=class extends DateBefore{constructor(...args){super(...(args.length?args:[clockAt]));}static now(){return clockAt;}};
  process.argv=[process.execPath,path.join(__dirname,'publish-feed.js'),'data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known',...(scoped?['--coverage-sport=rugby-union']:[])];
  const m=new Module(process.argv[1],module);m.filename=process.argv[1];m.paths=Module._nodeModulePaths(__dirname);m._compile(source,m.filename);
 }catch(error){failure=error;}finally{Object.assign(fs,{readFileSync:original.readFileSync,writeFileSync:original.writeFileSync,mkdirSync:original.mkdirSync});process.argv=original.argv;process.exit=original.exit;console.log=original.log;console.error=original.error;global.Date=DateBefore;}
 return {input,output:JSON.parse(files.get(ROOT+'/data/events.json')),bundle:files.get(ROOT+'/data/events.js'),meta:files.get(ROOT+'/data/feed-meta.json'),writes,failure};
}
const result=publish();assert.ifError(result.failure);
for(const event of result.input.events.filter(e=>identity.sportKey(e)!=='rugby'))assert.deepEqual(result.output.events.find(e=>e.id===event.id),event,'Scoped publisher changed retained '+event.key);
assert.deepEqual(result.output.events.map(e=>e.id),result.input.events.map(e=>e.id));
assert(result.bundle.includes('NOTHINGSPORTS_EVENTS'));assert.equal(JSON.parse(result.meta).version,result.output.version);
const baseline=publish({scoped:false});assert.ifError(baseline.failure);assert(Object.hasOwn(baseline.output.events.find(e=>e.id===baseline.input.events[0].id),'venue'),'Default publisher keeps its original normalization');
const invalid=publish({invalid:true});assert(invalid.failure,'Shared full-feed validation must still reject invalid retained data');assert.equal(invalid.writes,0);
console.log(JSON.stringify({checks:3,status:'PASS',actualPublisher:true,actualNormalizers:true,ownedBoundaries:['filesystem writes in RAM','public fixture reads','explicit captured clock','process exit','console'],sdkRequests:0,canonicalCliInvocations:0,nativeChildren:0}));
