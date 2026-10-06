#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{audit,projectionDigest}=require('./audit-coverage-quality');
const contract=require('../config/quality/coverage-contract.json');
require('./validate-canonical-family-repair');
const baseline=audit();
assert.equal(baseline.summary.carriedFamilies,17);assert.equal(baseline.summary.requiredFamilies,14);
assert.equal(baseline.summary.pilotTotal,3);
if(contract.certifications.length===0)assert.equal(baseline.summary.certifiedFamilies,0);
assert(baseline.families.find(f=>f.id==='skiing').carried,'published skiing cards remain in denominator');
const dakar=baseline.families.find(f=>f.id==='motorsport').competitions.find(c=>c.id==='competition:dakar');assert.equal(dakar.fixtures,28);assert.equal(dakar.status,'unverified','Dakar calendar and edition artwork cannot certify missing stage geometry, entries, results and viewing');
const surfing=baseline.families.find(f=>f.id==='surfing');
assert(surfing.codes.includes('wsl'),'authorised WSL windows remain in the existing surfing family');
assert.equal(surfing.competitions.find(c=>c.id==='competition:wsl-championship-tour').fixtures,12);
assert.equal(surfing.competitions.find(c=>c.id==='competition:wsl-championship-tour').status,'unverified','calendar publication does not certify results or the other quality gates');
assert.equal(baseline.families.find(f=>f.id==='football').competitions.find(c=>c.id==='competition:uefa-champions-league').fixtures,156);
const duplicate=structuredClone(contract);duplicate.families[1].codes.push('afl');assert.throws(()=>audit({contract:duplicate}),/Duplicate family/);
const manifest={codes:[{slug:'new-unreviewed-code'}]};assert.throws(()=>audit({manifest}),/Unreviewed new Code/);
const weak=structuredClone(contract);weak.certifications.push({competitionId:'competition:premier-league-2026-27',window:weak.window,releaseSha:'a'.repeat(40),liveVerifiedAt:'2026-09-27',gates:{}});
assert.equal(audit({contract:weak}).summary.pilotCertified,0,'release SHA alone cannot certify quality');
// Drive the real audit seam: a fully labelled proof cannot turn one sourced
// fixture into a complete 380-fixture season.
const incomplete={version:'test',window:contract.window,minimumCarriedFamilyPassRate:0.8,requiredGates:['fixtureTruth'],families:[{id:'football',codes:['test'],carried:true}],pilotCompetitions:[{family:'football',id:'epl',season:'2026/27',expectedSeasonFixtures:380}],certifications:[{competitionId:'epl',window:contract.window,releaseSha:'a'.repeat(40),liveVerifiedAt:'2026-09-27',gates:{fixtureTruth:{status:'pass',evidence:['docs/quality/football-ranking-acceptance-2026-10-02.md']}}}]};
assert.equal(audit({contract:incomplete,manifest:{codes:[{slug:'test'}]},read:()=>({fixtures:[{id:'one',competitionId:'epl',season:'2026/27',date:'2026-09-28',participantIds:['home','away'],sourceUrl:'https://example.com/fixture'}]})}).summary.pilotCertified,0,'one fixture cannot certify a 380-fixture season');
assert(baseline.families.some(f=>f.competitions.some(c=>c.id==='unclassified'&&c.status==='unverified')),'unclassified fixtures stay visible');
console.log('Quality gates: fixed denominator, no overlapping Code owners, explicit missing competitions and no certification from weak evidence passed.');
// The declared window must neither expand to every retained season nor turn
// empty/undated competitions into a pass just because a proof object exists.
const scoped={version:'test',window:{from:'2026-09-20',through:'2027-09-27'},minimumCarriedFamilyPassRate:0.8,requiredGates:['fixtureTruth'],families:[{id:'test',codes:['test'],carried:true}],pilotCompetitions:[],certifications:[]};
const current={id:'now',competitionId:'current',date:'2026-09-28',sourceUrl:'https://example.com/fixture'};
const proof=(id,fixtures=[current])=>({competitionId:id,window:scoped.window,releaseSha:'a'.repeat(40),liveVerifiedAt:'2026-09-27T12:00:00Z',expectedFixtures:fixtures.length,projectionDigest:projectionDigest(fixtures),gates:{fixtureTruth:{status:'pass',evidence:['docs/quality/football-ranking-acceptance-2026-10-02.md']}}});
scoped.certifications.push(proof('current'));
const run=fixtures=>audit({contract:scoped,manifest:{codes:[{slug:'test'}]},read:()=>({fixtures})});
const historical={id:'old',competitionId:'old-season',date:'2025-01-01',sourceUrl:'https://example.com/history'};
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

// Positive certification is possible, but every scenario invokes the actual
// audit used by production. Counts reconcile a declared season, not only the
// discovery window, and a supplied pass cannot override observable omissions.
const season=Array.from({length:380},(_,i)=>({id:`epl:${i}`,competitionId:'epl',season:'2026/27',date:i<42?'2026-08-22':'2026-09-28',participantIds:[`home:${i}`,`away:${i}`],sourceUrl:'https://example.com/fixture',status:'upcoming'}));
const football={...structuredClone(scoped),families:[{id:'football',codes:['test'],carried:true}],pilotCompetitions:[{id:'epl',family:'football',season:'2026/27',expectedSeasonFixtures:380}],certifications:[]};
function footballRun(fixtures,{mutateProof=()=>{},refreshProof=true,extraCopies=[]}={}){
 const c=structuredClone(football),p=proof('epl',refreshProof?[...fixtures,...extraCopies]:season);
 p.expectedFixtures=new Set((refreshProof?fixtures:season).map(f=>f.id)).size;
 mutateProof(p);c.certifications=[p];
 const m={codes:[{slug:'test'}]};
 if(extraCopies.length){c.families[0].codes.push('overlap');m.codes.push({slug:'overlap'});}
 return audit({contract:c,manifest:m,read:slug=>({fixtures:slug==='overlap'?extraCopies:fixtures}),now:'2026-10-03T00:00:00Z'});
}
const row=r=>r.families[0].competitions.find(c=>c.id==='epl');
const good=footballRun(season);assert.equal(good.summary.pilotCertified,1);
assert.equal(row(good).seasonFixtures,380);assert.equal(row(good).inDeclaredWindow,338,'earlier season fixtures remain part of full-season reconciliation');
const blocked=(fixtures,reason,options)=>assert(row(footballRun(fixtures,options)).certificationFailures.includes(reason),reason);
blocked(season.slice(1),'season-fixture-count');
blocked([{...season[0],season:'2025/26'},...season.slice(1)],'season-fixture-count');
for(const sourceUrl of [undefined,'','not-a-url','file:///private/record','https://user:password@example.com/fixture'])blocked([{...season[0],sourceUrl},...season.slice(1)],'missing-source');
for(const participantIds of [undefined,[],['one'],['same','same'],['','away']])blocked([{...season[0],participantIds},...season.slice(1)],'invalid-football-identity');
blocked(season,'conflicting-projections',{extraCopies:[{...season[0],date:'2026-08-23'}]});
assert.equal(footballRun(season,{extraCopies:[season[0]]}).summary.pilotCertified,1,'equal overlapping projections deduplicate');
assert.equal(footballRun(season,{extraCopies:[{...season[0],codeId:'competition:epl'}]}).summary.pilotCertified,1,'Code-specific routing is not a conflicting fixture');
const aliasedSeason=[{...season[0],sourceEventIds:['provider:1','legacy:1']},...season.slice(1)];
assert.equal(footballRun(aliasedSeason,{extraCopies:[{...aliasedSeason[0],sourceEventIds:['legacy:1','provider:1']}]}).summary.pilotCertified,1,'source alias ordering is not a conflicting fixture');
assert.equal(footballRun(season,{extraCopies:[{...season[0],preferenceDomainId:'sport:football',resultCoverage:'reviewed'}]}).summary.pilotCertified,1,'reviewed child detail is not a contradictory fact');
const withoutSource={...season[0]};delete withoutSource.sourceUrl;
blocked(season,'missing-source',{extraCopies:[withoutSource]});
const withoutDate={...season[0]};delete withoutDate.date;
blocked(season,'undated-fixtures',{extraCopies:[withoutDate]});
blocked(season,'unreviewed-projection',{refreshProof:false,extraCopies:[{...season[0],resultCoverage:'changed-detail'}]});
assert.equal(footballRun([...season].reverse(),{refreshProof:false}).summary.pilotCertified,1,'fixture array ordering is not a sporting change');
assert.equal(footballRun(season.map(f=>({...f,sourceCheckedAt:'2026-10-03T00:00:00Z',resultSourceCheckedAt:'2026-10-03T00:00:00Z'})),{refreshProof:false}).summary.pilotCertified,1,'ordinary check clocks retain snapshot evidence');
for(const change of [{date:'2026-08-23'},{status:'completed',homeScore:0,awayScore:0},{sourceObservedAt:'2026-10-03T00:00:00Z'},{watchUrl:'https://example.com/new-destination'}])blocked([{...season[0],...change},...season.slice(1)],'unreviewed-projection',{refreshProof:false});
for(const evidence of [[],[''],['missing-review.md'],['../outside-review.md'],'not-an-array'])blocked(season,'incomplete-gate-evidence',{mutateProof:p=>{p.gates.fixtureTruth.evidence=evidence;}});
blocked(season,'unreconciled-fixture-count',{mutateProof:p=>{p.expectedFixtures=1;}});
blocked(season,'unreviewed-projection',{mutateProof:p=>{delete p.projectionDigest;}});
for(const liveVerifiedAt of ['not-a-date','2026-10-04T00:00:00Z','2026-10-03','2026-02-30T00:00:00Z'])blocked(season,'invalid-live-verification-time',{mutateProof:p=>{p.liveVerifiedAt=liveVerifiedAt;}});

const league=Array.from({length:144},(_,i)=>({...season[i],id:`ucl:${i}`,competitionId:'ucl',stage:'League phase'}));
const european={...structuredClone(football),pilotCompetitions:[{id:'ucl',family:'football',season:'2026/27',expectedLeaguePhaseFixtures:144}],certifications:[proof('ucl',league)]};
const europeanRun=fixtures=>{const c=structuredClone(european);c.certifications=[proof('ucl',fixtures)];return audit({contract:c,manifest:{codes:[{slug:'test'}]},read:()=>({fixtures})});};
assert.equal(europeanRun(league).summary.pilotCertified,1);
const wrongPhase=[{...league[0],stage:'Qualifying play-off'},...league.slice(1)];
assert(europeanRun(wrongPhase).families[0].competitions[0].certificationFailures.includes('league-phase-fixture-count'),'144 mixed-phase records cannot certify 144 league-phase fixtures');
const ambiguous=structuredClone(european);ambiguous.certifications.push(structuredClone(ambiguous.certifications[0]));
assert(audit({contract:ambiguous,manifest:{codes:[{slug:'test'}]},read:()=>({fixtures:league})}).families[0].competitions[0].certificationFailures.includes('ambiguous-certification'));
console.log('Coverage proof: declared season/phase, source/identity, projection continuity, evidence references, live clocks and positive certification passed.');

// Real retained calendars are reviewed records, never substitute match data.
const uclRow=baseline.families.find(f=>f.id==='football').competitions.find(c=>c.id==='competition:uefa-champions-league');
assert.equal(uclRow.fixtures,156,'legacy inventory retains all records');
assert.equal(uclRow.matchRecords,151,'144 league-phase plus seven retained qualifying matches');
assert.equal(uclRow.calendarContexts,5);
assert.equal(uclRow.undated,5,'raw unknown Sydney dates remain visible');
assert.equal(uclRow.invalidFootballIdentity,5,'raw unknown-team diagnostics remain visible');
assert.equal(uclRow.undatedFixtures,0);
assert.equal(uclRow.invalidFootballMatchIdentity,0);
assert.equal(uclRow.calendarContextsInDeclaredWindow,5);
assert.deepEqual(uclRow.calendarContextFailures,[]);
assert.equal(uclRow.leaguePhaseFixtures,144);
assert.deepEqual(uclRow.certificationFailures,['missing-certification'],'correct record semantics do not certify a pilot');
assert.equal(uclRow.projectionDigest,projectionDigest(require('../data/code-inspector/champions-league.json').fixtures),'every context stays in the fact fingerprint');

const retainedCalendar=structuredClone(require('../data/code-inspector/champions-league.json').fixtures.find(f=>!f.date));
const review={...structuredClone(contract.reviewedCalendarContexts[0]),competitionId:'ucl',recordIds:['calendar:test']};
const calendar={...retainedCalendar,id:'calendar:test',competitionId:'ucl',sourceEventIds:['calendar:test']};
function calendarsRun(fixtures,{reviewChange=()=>{},proofChange=()=>{},copies=[]}={}){
 const c=structuredClone(european);c.reviewedCalendarContexts=[structuredClone(review)];reviewChange(c.reviewedCalendarContexts[0]);
 const p=proof('ucl',[...fixtures,...copies]);p.expectedFixtures=new Set(fixtures.map(f=>f.id)).size;
 p.expectedCalendarContexts=1;p.expectedMatchFixtures=fixtures.length-1;proofChange(p);c.certifications=[p];
 const m={codes:[{slug:'test'}]};if(copies.length){c.families[0].codes.push('overlap');m.codes.push({slug:'overlap'});}
 return audit({contract:c,manifest:m,read:slug=>({fixtures:slug==='overlap'?copies:fixtures}),now:'2026-10-03T23:00:00Z'});
}
const calendarRow=r=>r.families[0].competitions[0];
assert.equal(calendarsRun([...league,calendar]).summary.pilotCertified,1,'controlled reviewed calendars can coexist with complete explicitly reconciled match evidence');
assert.equal(calendarsRun([...league,calendar],{copies:[calendar]}).summary.pilotCertified,1,'equal overlapping contexts deduplicate');
assert(calendarRow(calendarsRun(league)).certificationFailures.includes('missing-reviewed-calendar-context'),'a reviewed planning record cannot disappear silently');
assert(calendarRow(calendarsRun([...league,calendar],{proofChange:p=>{delete p.expectedCalendarContexts;}})).certificationFailures.includes('unreconciled-record-kinds'));
assert(calendarRow(calendarsRun([...league,calendar],{proofChange:p=>{p.expectedMatchFixtures=145;}})).certificationFailures.includes('unreconciled-record-kinds'));
assert(calendarRow(calendarsRun([...league.slice(1),{...calendar,season:'2026/27',stage:'League phase'}])).certificationFailures.includes('league-phase-fixture-count'),'a context cannot replace a missing league-phase match');
assert(calendarRow(calendarsRun([calendar])).certificationFailures.includes('no-window-fixtures'),'a calendar alone cannot certify fixture coverage');

const badCalendars=[
 {...calendar,competitionId:'wrong'},
 {...calendar,schedulingWindow:null},
 {...calendar,schedulingWindow:{...calendar.schedulingWindow,startsOn:'2027-02-30'}},
 {...calendar,schedulingWindow:{...calendar.schedulingWindow,endsOn:'2027-01-01'}},
 {...calendar,schedulingWindow:{...calendar.schedulingWindow,timeZone:'Mars/Olympus'}},
 {...calendar,timingProvenance:{...calendar.timingProvenance,timeZone:'Australia/Sydney'}},
 {...calendar,timingProvenance:{...calendar.timingProvenance,observedAt:'2026-10-04T00:00:00Z'}},
 {...calendar,timingProvenance:{...calendar.timingProvenance,observedAt:'2026-02-30T00:00:00Z'}},
 {...calendar,timingProvenance:{...calendar.timingProvenance,observedAt:'2026-10-03'}},
 {...calendar,timingProvenance:null},
 {...calendar,sourceUrl:'https://example.com/unreviewed'},
 {...calendar,displayDateLabel:42},
 {...calendar,participantIds:['home','away']},
 {...calendar,participants:['Home','Away']},
 {...calendar,participantSlots:[{label:'TBC'}]},
 {...calendar,date:'2027-02-16'},
 {...calendar,startTimeUtc:'2027-02-16T20:00:00Z'},
 {...calendar,homeScore:0,awayScore:0},
 {...calendar,score:'0-0'},
 {...calendar,status:'completed'}
];
for(const changed of badCalendars){
 const result=calendarsRun([...league,changed]);
 assert.equal(result.summary.pilotCertified,0,'malformed or match-like calendars fail closed');
 assert(result.families[0].competitions.some(c=>c.certificationFailures.includes('invalid-calendar-context')));
}
const unreviewed={...calendar,id:'unreviewed-stage'};
const unknownCalendar=calendarRow(calendarsRun([...league,unreviewed]));
assert.equal(unknownCalendar.calendarContexts,0,'a source precision label alone cannot grant an exemption');
assert(unknownCalendar.certificationFailures.includes('undated-fixtures'));
assert(unknownCalendar.certificationFailures.includes('invalid-football-identity'));
assert(unknownCalendar.certificationFailures.includes('invalid-calendar-context'));
const missingMatch={...league[0],date:null,participantIds:[],timingProvenance:calendar.timingProvenance};
assert(calendarRow(calendarsRun([missingMatch,...league.slice(1),calendar])).certificationFailures.includes('invalid-football-identity'),'an ordinary missing matchup cannot disguise itself as a reviewed calendar');
assert(calendarRow(calendarsRun([...league,calendar],{reviewChange:r=>{r.evidence=['missing-review.md'];}})).certificationFailures.includes('invalid-calendar-context'));
for(const evidence of [null,'docs/quality/ucl-stage-calendar-integrity-2026-10-03.md',[]])assert(calendarRow(calendarsRun([...league,calendar],{reviewChange:r=>{r.evidence=evidence;}})).certificationFailures.includes('invalid-calendar-context'));
for(const recordIds of [null,[],[''],calendar.id])assert.throws(()=>calendarsRun([...league,calendar],{reviewChange:r=>{r.recordIds=recordIds;}}),'malformed registration cannot change record scope');
assert.throws(()=>calendarsRun([...league,calendar],{reviewChange:r=>{r.recordIds=[calendar.id,calendar.id];}}),/Duplicate reviewed calendar/);
assert.throws(()=>calendarsRun([...league,calendar],{reviewChange:r=>{r.competitionId='unreviewed';}}),/explicitly reviewed pilot/);
assert(calendarRow(calendarsRun([...league,calendar],{copies:[{...calendar,participantIds:['home','away']}]})).certificationFailures.includes('conflicting-projections'),'all overlapping views remain bound');
console.log('Record semantics: 151 actual UCL matches and five retained calendars; raw gaps, strict context validation, explicit counts and full certification gates preserved.');
