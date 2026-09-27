#!/usr/bin/env node
"use strict";
const assert=require('node:assert/strict');
const {eventMatchesCode,codeFixtures}=require('./build-code-inspector');
const football={id:'sport:football',slug:'football'};
for(const event of [
 {sport:'American Football',key:'nfl'},
 {sportDomainId:'sport:american-football',key:'football'},
 {codeId:'sport:american-football',sport:'Football'},
 {sport:'Australian Football'},
 {sport:'Football highlights'},
])assert.equal(eventMatchesCode(event,football),false,JSON.stringify(event));
for(const event of [{sport:'Football'},{sport:'Soccer'},{key:'premier-league'},{sportDomainId:'sport:football',key:'uefa-champions-league'}])assert.equal(eventMatchesCode(event,football),true,JSON.stringify(event));
const projected=codeFixtures(football);
assert(projected.some(event=>String(event.competitionId).includes('premier-league')),'retain EPL fixtures');
assert(!projected.some(event=>event.id==='evt_78'||event.key==='nfl'),'Super Bowl must not enter Football projection');
if(process.argv.includes('--published')){
 for(const folder of ['code-inspector','follow-schedule']){
  const data=require('../data/'+folder+'/football.json');
  assert(!data.fixtures.some(event=>event.id==='evt_78'||event.key==='nfl'),folder+' must exclude NFL');
 }
}
for(const args of [[],['--codes=football,'],['--codes=not-a-code']]){
 const result=require('node:child_process').spawnSync(process.execPath,['scripts/update-cards.js','--code-projections',...args],{encoding:'utf8'});
 assert.notEqual(result.status,0,'invalid projection scope must fail before writes');
}
console.log('Football classification: exact aliases, canonical domain and generated surfaces passed.');
