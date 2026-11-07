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
 const reviewed=identity.normalizeCore(event);
 assert.equal(projected.name,event.displayName,`${event.id}: known canonical title survives Code/Schedule normalization`);
 assert.equal(projected.sourceUrl,reviewed.sourceUrl||event.source.sourceUrl,`${event.id}: the stored or explicitly reviewed source reference survives Code/Schedule normalization`);
 assert.equal(projected.sourceName,reviewed.sourceName||event.source.provider,`${event.id}: supplied publisher identity survives`);
 assert.equal(projected.sourceType,reviewed.sourceType||event.source.sourceType,`${event.id}: supplied source type survives without inferring a licence`);
 assert.equal(projected.sourceCheckedAt,reviewed.sourceCheckedAt||event.source.checkedAt,`${event.id}: original or explicitly reviewed observation survives without renewal`);
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
const explicit={...record,sourceUrl:'https://example.test/reviewed-fixture',sourceName:'Reviewed publisher',sourceType:'reputable',sourceCheckedAt:'2026-09-20T00:00:00Z'};
const override=normalizeFixture(explicit,'sport:nrl');
for(const key of ['sourceUrl','sourceName','sourceType','sourceCheckedAt'])assert.equal(override[key],explicit[key],'Existing flat source metadata retains precedence');
const flatReference=normalizeFixture({...record,sourceUrl:explicit.sourceUrl},'sport:nrl');
assert.equal(flatReference.sourceName,undefined,'A different flat source cannot inherit the nested publisher identity');
assert.equal(flatReference.sourceCheckedAt,undefined,'A different flat source cannot inherit the nested check clock');
for(const sourceUrl of ['javascript:alert(1)','file:///tmp/private-source','https://user:password@example.test/fixture']){
 const invalid=normalizeFixture({...record,source:{...record.source,sourceUrl}},'sport:nrl');
 assert.equal(invalid.sourceUrl,null,'Unsafe nested source references cannot enter public projections');
 assert.equal(invalid.sourceCheckedAt,undefined,'Rejected nested sources cannot claim verification');
}
for(const checkedAt of ['not-a-date','2099-01-01T00:00:00Z','2026-02-30T00:00:00Z']){
 const invalid=normalizeFixture({...record,source:{...record.source,checkedAt}},'sport:nrl');
 assert.equal(invalid.sourceCheckedAt,undefined,'Invalid/future nested clocks cannot claim verification');
}
if(published){
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 let matched=0;
 for(const slug of ['afl','aflw','nrl'])for(const group of ['code-inspector','follow-schedule']){
  const fixtures=JSON.parse(fs.readFileSync(path.join(root,'data',group,slug+'.json'))).fixtures;
  for(const fixture of fixtures){
   const source=known.find(event=>event.id===fixture.id);
   if(!source)continue;
   const label=`${group}/${slug}/${fixture.id}`;
   assert.notEqual(fixture.name,'Fixture details unconfirmed',label+': publication cannot discard an available canonical title');
   const url=new URL(fixture.sourceUrl);
   assert(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password,label+': publication retains a safe source reference');
   assert.equal(typeof fixture.sourceName,'string',label+': supplied publisher survives publication');
   assert.equal(typeof fixture.sourceType,'string',label+': supplied source type survives publication');
   assert(Number.isFinite(Date.parse(fixture.sourceCheckedAt))&&Date.parse(fixture.sourceCheckedAt)<=Date.now(),label+': publication retains a valid observation');
   const converted=identity.fromSchedule(fixture,{slug});
   for(const key of ['sourceUrl','sourceName','sourceType','sourceCheckedAt'])assert.equal(converted[key],fixture[key],label+': Schedule conversion retains supplied '+key);
  }
  matched+=fixtures.filter(fixture=>known.some(event=>event.id===fixture.id)).length;
 }
 assert(matched>1000,'Both actual public projection surfaces retain the canonical season collection');
 const chat=JSON.parse(fs.readFileSync(path.join(root,'data/chat-fixtures.v1.json'))).fixtures;
 const chatReferences=chat.filter(fixture=>known.some(event=>event.id===fixture.canonicalEventId));
 assert(chatReferences.length>500,'Chat context retains the actual reference collection');
 assert(chatReferences.every(fixture=>fixture.name!=='Fixture details unconfirmed'),'Known fixture chat contexts cannot lose canonical titles');
 assert(chatReferences.every(fixture=>fixture.sourceUrl&&fixture.sourceName&&Number.isFinite(Date.parse(fixture.sourceCheckedAt))),'Derived chat context retains the supplied source reference, publisher and observation');
 console.log(`Published reference titles/provenance: ${matched} Code/Schedule occurrences and ${chatReferences.length} chat contexts checked`);
}
console.log(`Canonical fixtures: ${known.length} actual references preserve names, source links/publisher/type/original clocks, identity, explicit overrides, unknown fallback and repeated normalization`);

}
if(require.main===module)validate({published:process.argv.includes('--published')});
module.exports={validate};
