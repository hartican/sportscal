#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const script=path.resolve(__dirname,'apply-editorial-narratives.js'),load=createRequire(script),contract=load('../config/major-events.js');
const parents=load('../data/major-events.v1.json').events.filter(p=>p.subEvents?.length).slice(0,2);
assert.equal(parents.length,2);
const fixtures=parents.flatMap(p=>p.subEvents.slice(0,3).map(s=>contract.fixtureFromSubEvent(s,p))).filter(Boolean);
assert(fixtures.length>=2);
const incoming=fixtures.map((f,i)=>({...f,editorialNarrative:{hook:'Controlled primary '+i,synopsis:'Controlled primary narrative '+i}}));
const published=fixtures.map((f,i)=>({...f,editorialNarrative:{hook:'Controlled published '+i,synopsis:'Controlled retained narrative '+i}}));
// Existing real children exercise alias/semantic selection and retained-copy
// precedence. Empty knowledge isolates candidate reuse; schema/copy policy has
// its own unchanged validators. This is not researched sporting evidence.
const documents={
 'data/editorial-knowledge.v1.json':{sources:[],narrativeFacts:[],narrativeThreads:[],eventProjections:[]},
 'feeds/incoming/events.json':{events:incoming},'data/events.json':{events:published},
 'data/major-events.v1.json':{events:parents.map(p=>({...p,subEvents:[...p.subEvents.slice(0,3),...p.subEvents.slice(0,3)]}))},
};
const before=JSON.stringify(documents),written=new Map(),seen=new Set(),calls=[];
const normalise=value=>JSON.parse(JSON.stringify(value));
const wrapper={...contract,editorialRecordForSubEvent(...args){
 const candidate=args[2];seen.add(candidate);calls.push(candidate.map(e=>e.editorialNarrative?.hook));
 const immutable=JSON.stringify(candidate),actual=contract.editorialRecordForSubEvent(...args);
 const reference=contract.editorialRecordForSubEvent(args[0],args[1],candidate.slice(),args[3]);
 assert.deepEqual(normalise(actual),normalise(reference),'Reuse must preserve the existing fresh-array reader result, including primary/retained order');
 assert.equal(JSON.stringify(candidate),immutable,'Child projections cannot mutate the indexed candidates');return actual;
}};
const fileKey=file=>path.relative(process.cwd(),String(file));
const localRequire=id=>{
 if(id==='node:fs')return {readFileSync:file=>{const key=fileKey(file);assert(Object.hasOwn(documents,key),'Unexpected projection input '+key);return JSON.stringify(documents[key]);},writeFileSync:(file,value)=>{const key=fileKey(file);assert(Object.hasOwn(documents,key),'Unexpected projection output '+key);written.set(key,JSON.parse(value));}};
 if(id==='../config/major-events.js')return wrapper;
 if(id==='./lib/editorial-narrative.js')return {...load(id),validateKnowledge:()=>[]};
 if(id==='../data/follow-sources/coverage.v1.json')return {events:[]};
 if(id==='../data/tennis-feed-parents.v1.json')return {parents:[]};
 return load(id);
};
const moduleObject={exports:{}};localRequire.main=moduleObject;const processStub={argv:['node',script,'--write'],exitCode:0};
vm.runInNewContext(fs.readFileSync(script,'utf8'),{require:localRequire,module:moduleObject,exports:moduleObject.exports,process:processStub,console:{log(){},error(message){throw Error(message);}},__dirname:path.dirname(script),__filename:script},{filename:script,timeout:10000});
assert.equal(processStub.exitCode,0);assert(calls.length>=4);assert.equal(seen.size,1,'All major children must reuse one invocation-scoped candidate array');
const expectedOrder=[...incoming,...published].map(e=>e.editorialNarrative.hook);for(const call of calls)assert.deepEqual(normalise(call),expectedOrder);
assert.equal(written.size,4,'The actual command retains all four existing outputs');assert.equal(JSON.stringify(documents),before,'Inputs remain unchanged');
assert.deepEqual(written.get('feeds/incoming/events.json'),documents['feeds/incoming/events.json']);assert.deepEqual(written.get('data/events.json'),documents['data/events.json']);
console.log('Editorial candidate reuse: actual command, multiple parents/children, primary-retained order, fresh-array reader equality, unchanged inputs and all existing outputs passed; one index candidate array.');
