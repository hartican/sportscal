'use strict';
const assert=require('node:assert/strict');
const {mergeFixtureRecords}=require('./build-code-inspector');
const follow=require('../config/follow-first');
const published=require('../data/events.json').events;
const sources=require('../data/follow-sources/coverage.v1.json').events;
const pairs=[
 ['fixture:cricket:espn:1525659','1525659'],
 ['fixture:cricket:espn:1525660','1525660'],
 ['fixture:cricket:espn:1525661','1525661'],
 ['cricket-australia-england-first-odi-2026','1528703'],
 ['cricket-australia-england-second-odi-2026','1528704'],
 ['cricket-australia-england-third-odi-2026','1528705'],
 ['cricket-australia-england-first-t20-2026','1528706'],
 ['cricket-australia-england-second-t20-2026','1528707'],
 ['cricket-australia-england-third-t20-2026','1528708'],
 ['cricket-australia-england-fourth-t20-2026','1528709'],
 ['cricket-australia-england-fifth-t20-2026','1528710'],
 ['cricket-australia-new-zealand-test-2026','1528711'],
 ['evt_90','1528713'],
];
for(const [id,sourceId] of pairs){
 const saved=published.find(e=>e.id===id),source=sources.find(e=>e.id==='fixture:cricket:espn:'+sourceId);
 assert(saved&&source,id+': retained source pair exists');
 const card={...saved};delete card.competitionId;delete card.competitionProvenance;
 const before=structuredClone([card,source]);
 for(const records of [[card,source],[source,card]]){
  const merged=mergeFixtureRecords([],records,'sport:cricket');
  assert.equal(merged.length,1,id+': one fixture');
  assert.equal(merged[0].id,id,id+': durable identity');
  assert.equal(merged[0].competitionId,source.competitionId,id+': source series survives preferred card');
  if(source.id!==saved.id)assert.equal(merged[0].sourceCheckedAt,saved.sourceCheckedAt,id+': original primary observation');
  else assert([saved.sourceCheckedAt,source.sourceCheckedAt].includes(merged[0].sourceCheckedAt),id+': original observation, never projection time');
  const prefs={preferenceGraph:{competitionPreferences:[{competitionId:source.competitionId,enabled:true}]}};
  assert.equal(follow.reasonForEvent(merged[0],prefs)?.id,source.competitionId,id+': explicit series follow');
  assert.equal(follow.reasonForEvent(merged[0],{followFirst:{followedSportIds:['cricket']}}),null,id+': broad Cricket remains insufficient');
  assert.equal(follow.reasonForEvent(merged[0],{preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}],competitionPreferences:[{competitionId:source.competitionId,enabled:false}]}}),null,id+': explicit exclusion wins');
 }
 assert.deepEqual([card,source],before,id+': no input mutation');
}
const {createResolver}=require('./lib/fixture-competition-context');
const code=require('../data/code-inspector/cricket.json').fixtures;
const [id,sourceId]=pairs[3],saved=published.find(e=>e.id===id),source=sources.find(e=>e.id==='fixture:cricket:espn:'+sourceId);
const missing={...saved};delete missing.competitionId;delete missing.competitionProvenance;
const resolve=createResolver({sources:[source],fixtures:code});
const fixed=resolve(missing);assert.equal(fixed.competitionId,source.competitionId);
assert.deepEqual(fixed.competitionProvenance,{sourceEventId:source.id,sourceUrl:source.sourceUrl,checkedAt:source.sourceCheckedAt});
assert.equal(resolve(fixed),fixed,'unchanged observation retains object and provenance');
assert.equal(resolve({...missing,startTimeUtc:'2026-11-14T03:30:00Z'}).competitionId,undefined,'reschedule is not bound by old identity');
assert.equal(resolve({...missing,participantIds:['team:cricket:australia-women','team:cricket:england-women']}).competitionId,undefined,'women are not aliased to men');
assert.equal(resolve({...missing,id:'another-fixture',eventId:'another-fixture',canonicalEventId:'another-fixture',sourceEventIds:[]}).competitionId,undefined,'unreviewed identity is not guessed');
const existing={...missing,competitionId:'competition:cricket:existing'};assert.equal(resolve(existing),existing,'known context is never replaced');
const malformed=createResolver({sources:[{...source,sourceCheckedAt:'invalid'}],fixtures:code});assert.equal(malformed(missing),missing,'invalid source observation cannot supply context');
for(const sourceUrl of ['https://example.invalid/fixture','http://www.espn.in/fixture','https://owner:secret@www.espn.in/fixture'])assert.equal(createResolver({sources:[{...source,sourceUrl}],fixtures:code})(missing),missing,'foreign or credential-bearing source cannot supply context');
assert.equal(createResolver({sources:[{...source,sourceCheckedAt:'2026-02-30T00:00:00Z'}],fixtures:code})(missing),missing,'rolled-over timestamp cannot supply context');
const ambiguous=createResolver({sources:[source,{...source,id:'another-source',competitionId:'competition:cricket:another'}],fixtures:[{...code.find(e=>e.id===id),competitionId:null,sourceEventIds:[source.id,'another-source']}]});
assert.throws(()=>ambiguous(missing),/Ambiguous competition context/,'ambiguity fails before persistence');
// Exercise the existing publication CLI on disposable real documents. A
// correct merger alone is insufficient when saved Feed cards bypass it.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-competition-context-'));
try{
 const document=structuredClone(require('../data/events.json'));
 const ids=new Set(pairs.map(([id])=>id));
 for(const event of document.events)if(ids.has(event.id)){delete event.competitionId;delete event.competitionProvenance;}
 const input=path.join(temp,'input.json'),output=path.join(temp,'events.json');fs.writeFileSync(input,JSON.stringify(document));fs.writeFileSync(output,JSON.stringify(document));
 const args=[path.join(__dirname,'publish-feed.js'),input,output,path.join(temp,'meta.json'),path.join(temp,'events.js'),'--preserve-known'];
 execFileSync(process.execPath,args,{cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 const written=JSON.parse(fs.readFileSync(output));assert.deepEqual(written.events.map(e=>e.id),document.events.map(e=>e.id),'real writer keeps all identities/order');
 for(const [id,sourceId] of pairs){
  const original=document.events.find(e=>e.id===id),actual=written.events.find(e=>e.id===id),source=sources.find(e=>e.id==='fixture:cricket:espn:'+sourceId);
  assert.equal(actual.competitionId,source.competitionId,id+': actual persisted series');
  for(const key of ['startTimeUtc','date','time','participantIds','status','sourceCheckedAt','scoreCheckedAt','statusCheckedAt'])assert.deepEqual(actual[key],original[key],id+': real writer preserves '+key);
 }
 execFileSync(process.execPath,args,{cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 assert.deepEqual(JSON.parse(fs.readFileSync(output)).events,written.events,'unchanged real publication retains fixture bytes/fact clocks');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Fixture competition context: thirteen actual pairs/both orders, original clocks/IDs, explicit follows/exclusions, no broad admission, identity/time/provenance guards passed.');
