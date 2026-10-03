#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const identity=require('../config/fixture-identity');
const {normalizeFixture}=require('./build-code-inspector');
const canonical=require('../data/canonical/afl-nrl-2026.json');
function validate({published=false}={}){
const known=canonical.events.filter(event=>typeof event.displayName==='string'&&event.displayName);
assert(known.length>500,'The actual canonical reference-sport collection must be exercised');
for(const event of known){
 const projected=normalizeFixture(event,event.sportDomainId);
 assert.equal(projected.name,event.displayName,`${event.id}: known canonical title survives Code/Schedule normalization`);
 assert.deepEqual(identity.normalizeCore(projected),identity.normalizeCore(identity.normalizeCore(projected)),`${event.id}: repeated normalization is stable`);
 assert.deepEqual(projected.participantIds,event.participantIds,`${event.id}: title repair cannot change participant identity`);
}
const record=known.find(event=>event.id==='event:nrl:129990101');
assert(record,'The reproduced canonical Knights–Cowboys fixture remains available');
assert.equal(identity.normalizeCore({...record,name:'Reviewed fixture title'}).name,'Reviewed fixture title','Explicit presentation titles retain precedence');
assert.equal(identity.normalizeCore({...record,displayTitleCompact:'Compact fixture title'}).name,'Compact fixture title','Existing compact title precedence is retained');
assert.equal(identity.normalizeCore({id:'missing-name',displayName:42}).name,'Fixture details unconfirmed','Invalid titles cannot create sporting detail');
assert.equal(identity.normalizeCore({id:'missing-name'}).name,'Fixture details unconfirmed','Genuine unknown details remain explicit');
assert.equal(identity.fromSchedule(record,{slug:'nrl'}).name,record.displayName,'Browser Schedule conversion retains the same known canonical title');
if(published){
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 let matched=0;
 for(const slug of ['afl','aflw','nrl'])for(const group of ['code-inspector','follow-schedule']){
  const fixtures=JSON.parse(fs.readFileSync(path.join(root,'data',group,slug+'.json'))).fixtures;
  for(const fixture of fixtures){
   const source=known.find(event=>event.id===fixture.id);
   if(!source||fixture.name!=='Fixture details unconfirmed')continue;
   assert.fail(`${group}/${slug}/${fixture.id}: publication cannot discard an available canonical title`);
  }
  matched+=fixtures.filter(fixture=>known.some(event=>event.id===fixture.id)).length;
 }
 assert(matched>1000,'Both actual public projection surfaces retain the canonical season collection');
 const chat=JSON.parse(fs.readFileSync(path.join(root,'data/chat-fixtures.v1.json'))).fixtures;
 const chatReferences=chat.filter(fixture=>known.some(event=>event.id===fixture.canonicalEventId));
 assert(chatReferences.length>500,'Chat context retains the actual reference collection');
 assert(chatReferences.every(fixture=>fixture.name!=='Fixture details unconfirmed'),'Known fixture chat contexts cannot lose canonical titles');
 console.log(`Published reference titles: ${matched} Code/Schedule occurrences checked`);
}
console.log(`Canonical fixture names: ${known.length} actual reference fixtures preserve known titles, identity, explicit overrides, unknown fallback and repeated normalization`);

}
if(require.main===module)validate({published:process.argv.includes('--published')});
module.exports={validate};
