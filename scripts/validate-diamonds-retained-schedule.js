#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const writes=['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync','rmSync','copyFileSync'];
const original=Object.fromEntries(writes.map(name=>[name,fs[name]]));
try{
 for(const name of writes)fs[name]=()=>{throw Error('Pure Diamonds projection attempted '+name);};
 const builder=require('./build-code-inspector'),follow=require('../config/follow-first'),identity=require('../config/fixture-identity'),policy=require('../config/follow-feed-policy');
 const official=require('../data/follow-sources/official.v1.json');
 const code=require('../config/canonical-sports-taxonomy').sportDomains.find(code=>code.id==='sport:netball');assert(code);
 const retained=official.events.filter(event=>event.key==='netball'&&event.sportDomainId==='sport:netball'&&event.competitionId==='competition:constellation-cup-2026');
 assert.equal(retained.length,4,'the retained addition is exactly the four already collected fixtures');
 const fixtureId='fixture:netball:constellation-cup-2026-2';
 const projected=builder.codeFixtures(code),fixture=projected.find(event=>event.id===fixtureId||event.eventId===fixtureId);
 assert(fixture,'actual pure Netball builder must project the retained 21 October Diamonds fixture');
 assert.deepEqual(projected.filter(event=>retained.some(source=>source.id===event.id)).map(event=>event.id).sort(),retained.map(event=>event.id).sort());
 assert.equal(new Set(projected.map(event=>event.id)).size,projected.length,'each fixture appears once');
 for(const source of retained){
  const row=projected.find(event=>event.id===source.id);assert(row);
  for(const field of ['date','startTimeUtc','endTimeUtc','timeTbc','status','sourceCheckedAt','sourceUrl'])assert.deepEqual(row[field],source[field],source.id+' preserves '+field);
  assert.equal(row.timeTbc,true,'midnight placeholders are not a confirmed kickoff');assert.equal(row.time,null,'existing Inspector normalization keeps unconfirmed time undisplayed');
  for(const field of ['homeScore','awayScore','score','result'])assert.equal(row[field],source[field],source.id+' adds no result');
 }
 const preferences=follow.migratePreferences({version:24,selectedSelectorEntityIds:[],followedSports:[],preferenceGraph:{entityFollows:[{participantId:'team:netball:diamonds',followLevel:'follow'}]}});
 assert.deepEqual(identity.followedScheduleCodes(preferences,[code]).map(value=>value.id),['sport:netball']);
 assert.equal(follow.reasonForEvent(fixture,preferences)?.id,'team:netball:diamonds');
 const controls=[
  ['sportOFF',{domainPreferences:[{sportDomainId:'sport:netball',enabled:false}]}],
  ['competitionOFF',{competitionPreferences:[{competitionId:fixture.competitionId,enabled:false}]}],
  ['mute',{entityFollows:[{participantId:'team:netball:diamonds',followLevel:'mute'}]}],
 ];
 for(const [label,patch] of controls){
  const next=follow.migratePreferences({...preferences,preferenceGraph:{...preferences.preferenceGraph,...patch}});
  assert.equal(follow.reasonForEvent(fixture,next),null,label+' remains authoritative');assert.equal(policy.explicitlyExcluded(fixture,next),true);
 }
 const resolved=require('../lib/follow-fixture-resolver').resolveUserFollowFixtures({events:[],userState:{preferences}});
 assert(resolved.events.some(event=>event.id===fixtureId),'existing server resolver still admits the same retained fixture');
 console.log(JSON.stringify({passed:true,actualBuilderProjection:true,retainedFixtures:retained.length,fixtureId,canonicalFollow:true,exclusionControls:controls.map(([name])=>name),sourceClocksRenewed:false,generatedWrites:0,transport:'none',limits:'Pure existing builder and constructed Follow controls; not generated-file, installed-app or actual-account diagnosis proof'}));
}finally{for(const name of writes)fs[name]=original[name];}
