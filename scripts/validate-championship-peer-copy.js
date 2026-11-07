'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const builder=require('./build-code-inspector'),root=path.resolve(__dirname,'..'),competition='competition:australian-championship';
const combined=process.argv.includes('--combined');
const files={chunk:path.join(root,'data/code-inspector/football.json'),schedule:path.join(root,'data/follow-schedule/football.json'),manifest:path.join(root,'data/code-inspector/manifest.json'),netball:path.join(root,'data/code-inspector/netball.json'),netballSchedule:path.join(root,'data/follow-schedule/netball.json')};
const originals=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,fs.readFileSync(p)])),prior=Object.fromEntries(Object.entries(originals).map(([k,b])=>[k,JSON.parse(b)]));
for(const key of ['chunk','schedule'])prior[key].fixtures.find(row=>row.competitionId!==competition).retainedPeerProbe={broadcastOptions:[],unknownFutureMetadata:'keep exact'};
prior.chunk.standings.find(row=>row.competitionId!==competition).retainedPeerProbe='keep independent group metadata';
const real={read:fs.readFileSync,write:fs.writeFileSync,mkdir:fs.mkdirSync,unlink:fs.unlinkSync},writes=new Map();
try{
 fs.readFileSync=function(file,options){const full=path.resolve(String(file)),seed=full===files.chunk?prior.chunk:full===files.schedule?prior.schedule:null;if(seed){const text=JSON.stringify(seed);return typeof options==='string'||options?.encoding?text:Buffer.from(text);}return real.read.apply(this,arguments);};
 fs.writeFileSync=function(file,body){const full=path.resolve(String(file));assert(Object.values(files).includes(full),'Retained builder cannot write another sport or registry');writes.set(full,Buffer.from(body));};
 fs.mkdirSync=function(file){assert(fs.existsSync(file),'Constructed test cannot create a real directory');};
 fs.unlinkSync=()=>assert.fail('Retained builder must not delete peers');
 builder.build(combined?{codeSlugs:['football','netball'],retainedCodeSlugs:['football','netball']}:{codeSlugs:['football'],retainedFootballOnly:true});
}finally{Object.assign(fs,{readFileSync:real.read,writeFileSync:real.write,mkdirSync:real.mkdir,unlinkSync:real.unlink});}
assert.equal(writes.size,combined?5:3);
for(const key of ['chunk','schedule']){
 const written=JSON.parse(writes.get(files[key]));
 assert.deepEqual(written.fixtures.filter(row=>row.competitionId!==competition),prior[key].fixtures.filter(row=>row.competitionId!==competition),'Actual retained writer preserves every prior peer field, including unknown metadata');
 assert.equal(written.fixtures.filter(row=>row.competitionId===competition).length,48);
 if(key==='chunk')assert.deepEqual(written.standings.filter(row=>row.competitionId!==competition),prior.chunk.standings.filter(row=>row.competitionId!==competition));
 const contract=require('./lib/championship-score-contract'),canonical=require('../data/football/fixtures/australian-championship.json');
 for(const original of canonical.events.filter(row=>row.resultSourceEvidence)){const row=written.fixtures.find(r=>r.canonicalEventId===original.canonicalEventId);assert(row,'Adopted result stays in real writer output');for(const field of contract.RESULT_FIELDS.filter(k=>Object.hasOwn(original,k)))assert.deepEqual(row[field],original[field],'Actual writer must preserve adopted result '+field);if(original.sourceWinnerId===0)assert(!row.winnerParticipantId,'Unknown source winner remains unknown');}
}
if(combined)for(const key of ['netball','netballSchedule']){const rows=JSON.parse(writes.get(files[key])).fixtures.filter(row=>row.competitionId==='competition:constellation-cup-2026');assert.equal(rows.length,4);assert(rows.every(row=>row.timeTbc===true&&row.time===null),'Retained midnight placeholders cannot become confirmed Netball kickoffs');}
for(const [key,file] of Object.entries(files))assert(fs.readFileSync(file).equals(originals[key]),'Writer interception must leave all real files unchanged');
console.log('Actual retained writer preserves exact Football peers/opaque fields, writes only declared captured outputs and leaves disk unchanged; scopes: '+(combined?'Football+Netball':'Football')+'.');
