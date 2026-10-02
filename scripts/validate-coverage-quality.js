#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{audit}=require('./audit-coverage-quality');
const contract=require('../config/quality/coverage-contract.json');
const baseline=audit();
assert.equal(baseline.summary.carriedFamilies,16);assert.equal(baseline.summary.requiredFamilies,13);
assert.equal(baseline.summary.pilotTotal,3);assert.equal(baseline.summary.certifiedFamilies,0);
assert(baseline.families.find(f=>f.id==='skiing').carried,'published skiing cards remain in denominator');
const surfing=baseline.families.find(f=>f.id==='surfing');
assert(surfing.codes.includes('wsl'),'authorised WSL windows remain in the existing surfing family');
assert.equal(surfing.competitions.find(c=>c.id==='competition:wsl-championship-tour').fixtures,12);
assert.equal(surfing.competitions.find(c=>c.id==='competition:wsl-championship-tour').status,'unverified','calendar publication does not certify results or the other quality gates');
assert.equal(baseline.families.find(f=>f.id==='football').competitions.find(c=>c.id==='competition:uefa-champions-league').fixtures,156);
const duplicate=structuredClone(contract);duplicate.families[1].codes.push('afl');assert.throws(()=>audit({contract:duplicate}),/Duplicate family/);
const manifest={codes:[{slug:'new-unreviewed-code'}]};assert.throws(()=>audit({manifest}),/Unreviewed new Code/);
const weak=structuredClone(contract);weak.certifications.push({competitionId:'competition:premier-league-2026-27',window:weak.window,releaseSha:'a'.repeat(40),liveVerifiedAt:'2026-09-27',gates:{}});
assert.equal(audit({contract:weak}).summary.pilotCertified,0,'release SHA alone cannot certify quality');
assert(baseline.families.some(f=>f.competitions.some(c=>c.id==='unclassified'&&c.status==='unverified')),'unclassified fixtures stay visible');
console.log('Quality gates: fixed denominator, no overlapping Code owners, explicit missing competitions and no certification from weak evidence passed.');
// The declared window must neither expand to every retained season nor turn
// empty/undated competitions into a pass just because a proof object exists.
const scoped={version:'test',window:{from:'2026-09-20',through:'2027-09-27'},minimumCarriedFamilyPassRate:0.8,requiredGates:['fixtureTruth'],families:[{id:'test',codes:['test'],carried:true}],pilotCompetitions:[],certifications:[]};
const proof=id=>({competitionId:id,window:scoped.window,releaseSha:'a'.repeat(40),liveVerifiedAt:'2026-09-27',gates:{fixtureTruth:{status:'pass',evidence:['reviewed-evidence.md']}}});
scoped.certifications.push(proof('current'));
const run=fixtures=>audit({contract:scoped,manifest:{codes:[{slug:'test'}]},read:()=>({fixtures})});
const current={id:'now',competitionId:'current',date:'2026-09-28'};
const historical={id:'old',competitionId:'old-season',date:'2025-01-01'};
let result=run([current,historical]);
assert.equal(result.summary.carriedFamilies,1);assert.equal(result.summary.certifiedFamilies,1);
assert.equal(result.families[0].competitions.find(c=>c.id==='old-season').status,'outside-window');
assert.equal(result.families[0].competitions.length,2,'historical inventory remains visible');
assert.equal(run([historical]).summary.certifiedFamilies,0,'history alone cannot certify a carried family');
assert.equal(run([current,{id:'unknown',competitionId:'unknown'}]).summary.certifiedFamilies,0,'undated records remain a gap');
for(const date of ['not-a-date','2026-99-99','2026-02-30'])assert.equal(run([current,{id:'bad',competitionId:'current',date}]).summary.certifiedFamilies,0,'invalid dates block proof');
scoped.pilotCompetitions=[{family:'test',id:'missing'}];scoped.certifications.push(proof('missing'));
assert.equal(run([current]).summary.certifiedFamilies,0,'a missing pilot blocks the family despite supplied proof');
assert.equal(run([current]).summary.pilotCertified,0,'empty pilot cannot be certified');
console.log('Current-window quality scope: history retained, frozen families preserved, undated and missing-pilot evidence fail closed.');
