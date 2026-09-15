#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {candidates}=require('./hobby-deployment-cleanup');
const now=Date.now(),hour=3600000;
const rows=[['live',200,'READY','production'],['rollback',200,'READY','production'],['old',73,'READY','production'],['recent',71,'READY','production'],['preview',25,'READY',null],['building',200,'BUILDING','production'],['failed',25,'ERROR',null],['invalid',NaN,'READY',null]].map(([id,age,state,target])=>({uid:id,created:now-age*hour,state,target}));
const actual=candidates(rows,{now,liveId:'live',rollbackId:'rollback'});
assert.deepEqual(actual.filter(d=>!d.reason).map(d=>d.id),['old','preview','failed']);
assert.equal(actual.find(d=>d.id==='live').reason,'live');
assert.equal(actual.find(d=>d.id==='rollback').reason,'rollback');
console.log('Hobby cleanup age, active-build and live/rollback protections passed');
const {choose}=require('./check-production-deployment');
const live={id:'live',readyState:'READY',meta:{releaseGitSha:'abc'}};
assert.equal(choose([],'abc',live).action,'live');
assert.equal(choose([],'abc',live,true).action,'create');
assert.equal(choose([{state:'BUILDING',target:'production',meta:{releaseGitSha:'def'}}],'def',live).action,'wait');
assert.equal(choose([{state:'READY',target:'production',meta:{releaseGitSha:'def'}}],'def',live).action,'reuse');
assert.equal(choose([],'def',live).action,'create');
console.log('Deployment reuse, wait and intentional-rebuild decisions passed');
