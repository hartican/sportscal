#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{audit}=require('./audit-coverage-quality');
const contract=require('../config/quality/coverage-contract.json');
const baseline=audit();
assert.equal(baseline.summary.carriedFamilies,16);assert.equal(baseline.summary.requiredFamilies,13);
assert.equal(baseline.summary.pilotTotal,3);assert.equal(baseline.summary.certifiedFamilies,0);
assert(baseline.families.find(f=>f.id==='skiing').carried,'published skiing cards remain in denominator');
assert.equal(baseline.families.find(f=>f.id==='football').competitions.find(c=>c.id==='competition:uefa-champions-league').fixtures,13);
const duplicate=structuredClone(contract);duplicate.families[1].codes.push('afl');assert.throws(()=>audit({contract:duplicate}),/Duplicate family/);
const manifest={codes:[{slug:'new-unreviewed-code'}]};assert.throws(()=>audit({manifest}),/Unreviewed new Code/);
const weak=structuredClone(contract);weak.certifications.push({competitionId:'competition:premier-league-2026-27',window:weak.window,releaseSha:'a'.repeat(40),liveVerifiedAt:'2026-09-27',gates:{}});
assert.equal(audit({contract:weak}).summary.pilotCertified,0,'release SHA alone cannot certify quality');
assert(baseline.families.some(f=>f.competitions.some(c=>c.id==='unclassified'&&c.status==='unverified')),'unclassified fixtures stay visible');
console.log('Quality gates: fixed denominator, no overlapping Code owners, explicit missing competitions and no certification from weak evidence passed.');
