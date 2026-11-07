'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {summary, collect, markdown, safe} = require('./lib/canonical-source-readout');
const now = new Date('2026-10-01T03:00:00Z');
const quick = {mode:'quick', checkedAt:'2026-09-30T21:12:21.075Z', failures:['LPGA fixture:golf:lpga:2026063: LPGA results HTTP 404'], aiCalls:0};
const gap = {tournamentId:'tournament:tennis:wta-beijing-2026', name:'China Open', code:'tennis', fixtureCount:0, status:'partial', issues:['No supported fixture adapter','No published child fixtures hydrated']};
const hydration = {schemaVersion:'tournament-hydration-report.v1', checkedAt:quick.checkedAt, offline:false, tournaments:[gap]};
const run = {databaseId:36777788726, status:'completed', conclusion:'success', createdAt:'2026-09-30T21:10:00Z', headSha:'a'.repeat(40), url:'https://github.com/hartican/sportscal/actions/runs/36777788726'};
const report = summary({quick, hydration, now});
const nhlSource=require('./lib/nhl-results'),tennisSource=require('../lib/tennis-scoreboard');
const sourceTimeErrors=[
 ()=>nhlSource.parseStandings({standingsDateTimeUtc:new Date(+now+1).toISOString()},{checkedAt:now.toISOString(),now}),
 ()=>tennisSource.parse({}, {tour:'wta',checkedAt:new Date(+now-6*3600000-1).toISOString(),now}),
].map(check=>{try{check();}catch(error){return error.message;}assert.fail('Controlled invalid source time must reject');});
const timeReport=summary({quick:{mode:'quick',checkedAt:now.toISOString(),failures:sourceTimeErrors,aiCalls:0},now});
assert.equal(timeReport.quick.state,'observed');assert.deepEqual(timeReport.quick.failures,sourceTimeErrors,'Both clocks and the rejection reason survive the real bounded exception readout');
const timeMarkdown=markdown({state:'observed',run, reports:timeReport,limitations:[]});
assert(sourceTimeErrors.every(message=>timeMarkdown.includes(message)),'The existing operator readout exposes actionable source-time failures');
const finalApi=require('./lib/known-final-results'),finalNow=new Date('2026-10-04T21:00:00Z'),knownFinals={schemaVersion:'known-final-results.v1',checkedAt:'2026-10-04T20:15:00Z',checks:[{fixtureId:finalApi.NRL_ID,sourceUrl:finalApi.NRL_URL,state:'primary-final',observedAt:'2026-10-04T20:15:20Z',changed:false}],failures:[],requests:1,maxRequests:2,aiCalls:0};
assert.equal(summary({knownFinals,now:finalNow}).knownFinals.state,'observed');assert.equal(summary({knownFinals:{...knownFinals,checks:[],requests:0},now:finalNow}).knownFinals.state,'not-checked');
for(const invalid of [{schemaVersion:'wrong'},{requests:3},{checks:[knownFinals.checks[0],knownFinals.checks[0]]},{checks:[{...knownFinals.checks[0],sourceUrl:'https://example.invalid'}]},{checks:[{...knownFinals.checks[0],observedAt:'2099-01-01T00:00:00Z'}]}])assert.equal(summary({knownFinals:{...knownFinals,...invalid},now:finalNow}).knownFinals.state,'unavailable');
const blocked=summary({quick:{...quick,checkedAt:knownFinals.checkedAt,publicationState:'blocked-rolled-back',blockingError:'controlled completeness failure',finalResults:knownFinals},now:finalNow});const blockedText=markdown({state:'observed',run:{databaseId:1,url:'https://example.test',conclusion:'failure'},reports:blocked,limitations:[]});assert(blockedText.includes('blocked and rolled back')&&blockedText.includes('do not prove publication')&&blockedText.includes('unchanged facts keep their original dates'));
assert.equal(report.quick.failureCount,1, 'successful workflow must not mask retained LPGA failure');
assert.equal(report.hydration.partialCount,1);
assert.equal(report.hydration.completeCount,0, 'calendar row cannot certify match coverage');
assert.equal(report.quick.aiCalls,0);
assert.equal(report.quick.stale,false);
assert.equal(summary({quick,now:new Date('2026-10-03T03:00:00Z')}).quick.stale,true);
assert.equal(summary({hydration,now}).quick.state,'unavailable', 'missing full-run quick report does not mean zero failures');
for (const invalid of [{...quick,failures:null},{...quick,failures:[{}]},{...quick,checkedAt:'invalid'},{...quick,checkedAt:'2026-10-02T00:00:00Z'}]) assert.equal(summary({quick:invalid,now}).quick.state,'unavailable');
for (const invalid of [{...hydration,offline:true},{...hydration,tournaments:[gap,gap]},{...hydration,tournaments:[{...gap,status:'complete'}]},{...hydration,tournaments:[{...gap,fixtureCount:-1}]}]) assert.equal(summary({hydration:invalid,now}).hydration.state,'unavailable');
assert.equal(safe('HTTP https://example.test/data?api_key=secret#token Bearer secret password=private\n|next'), 'HTTP https://example.test/data Bearer [redacted] [redacted]  next');
const many = summary({quick:{...quick,failures:Array(12).fill('failure')},hydration:{...hydration,tournaments:Array.from({length:11},(_,i)=>({...gap,tournamentId:'test:'+i,name:'Gap '+i}))},now});
const compact = markdown({state:'observed',run,reports:many,limitations:[]});
assert(compact.includes('2 further failures') && compact.includes('3 further tournament gaps'));
assert(!compact.includes('Gap 10 ('), 'owner-facing readout is bounded while JSON retains full gaps');
const details={listedEntries:120,confirmedEntries:119,pairingGroups:80,pairingRounds:2,participantsConfirmed:true,participationCheckedAt:'2026-09-30T20:00:00Z'};
const golf={...gap,tournamentId:'2026068',name:'LOTTE',code:'golf',format:'tournament-card',detailEvidence:details,issues:['Tournament completeness is not attested']};
const golfReport=summary({hydration:{...hydration,tournaments:[golf]},now});
assert.deepEqual(golfReport.hydration.gaps[0].detailEvidence,details);
const golfText=markdown({state:'observed',run,reports:golfReport,limitations:[]});
assert(golfText.includes('one tournament card')&&golfText.includes('120 listed entries')&&golfText.includes('80 tee-time groups')&&golfText.includes(details.participationCheckedAt));
assert(!golfText.includes('0 child fixtures'),'intentional parent presentation is not a child-fixture defect');
for(const change of [{listedEntries:251},{confirmedEntries:121},{pairingGroups:-1},{pairingRounds:6},{participantsConfirmed:'yes'},{participationCheckedAt:'2026-10-02T00:00:00Z'}])assert.equal(summary({hydration:{...hydration,tournaments:[{...golf,detailEvidence:{...details,...change}}]},now}).hydration.state,'unavailable','malformed/future detail evidence cannot be presented as valid');
assert.equal(summary({hydration:{...hydration,tournaments:[{...golf,format:'complete-sport'}]},now}).hydration.state,'unavailable');


const golfSources={schemaVersion:'golf-source-report.v1',runId:'test-invocation',mode:'quick',checkedAt:quick.checkedAt,resultsPasses:[{checkedAt:quick.checkedAt,checked:1,failures:[{id:'fixture:golf:lpga:2026063',code:'http-429'}]}],checks:[{resource:'entries',state:'failed',code:'http-503',checkedAt:quick.checkedAt,sourceUrl:'https://www.lpga.com/tournaments/lotte-championship/entries',tournamentId:'2026068',name:'LOTTE',competitionId:'competition:lpga-tour',retainedFactAt:'2026-09-30T20:00:00Z',status:null,statusEvidence:null}]};
const sourceSummary=summary({golf:golfSources,now});
assert.equal(sourceSummary.golf.failureCount,1);assert.equal(sourceSummary.golf.exceptionCount,1);
const sourceText=markdown({state:'observed',run,reports:sourceSummary,limitations:[]});
assert(sourceText.includes('workflow success')&&sourceText.includes('1 failures')&&sourceText.includes('http-503'),'green workflow must expose Golf subsource failure');
assert(sourceText.includes('source check '+quick.checkedAt)&&sourceText.includes('retained facts 2026-09-30T20:00:00Z'),'check and retained-fact dates remain separate');
assert.equal(summary({golf:{...golfSources,checks:[],resultsPasses:[]},now}).golf.state,'not-checked');
assert(markdown({state:'observed',run,reports:summary({golf:{...golfSources,checks:[],resultsPasses:[]},now}),limitations:[]}).includes('health is unknown'));
assert.equal(summary({now}).golf.state,'unavailable');
assert.equal(summary({golf:golfSources,now:new Date('2026-10-03T03:00:00Z')}).golf.stale,true);
for(const change of [{schemaVersion:'wrong'},{checkedAt:'invalid'},{checkedAt:'2099-01-01T00:00:00Z'},{checks:[{...golfSources.checks[0],retainedFactAt:'2026-10-01T01:00:00Z'}]},{checks:[{...golfSources.checks[0],code:'Bearer private'}]},{checks:[{...golfSources.checks[0],sourceUrl:'https://other.invalid/entries'}]}])assert.equal(summary({golf:{...golfSources,...change},now}).golf.state,'unavailable');
const manyGolf=summary({golf:{...golfSources,checks:Array(11).fill(golfSources.checks[0])},now});
assert(markdown({state:'observed',run,reports:manyGolf,limitations:[]}).includes('3 further Golf exceptions'));

(async()=>{
  const calls=[];let downloaded;
  const read=async args=>{
    calls.push(args);
    if(args[0]==='run'&&args[1]==='list')return JSON.stringify([{...run,databaseId:36777788727,status:'in_progress',conclusion:null,createdAt:'2026-10-01T02:30:00Z'},run]);
    if(args[0]==='api')return JSON.stringify({total_count:1,artifacts:[{name:'tournament-hydration-report',size_in_bytes:1000,expired:false}]});
    assert.deepEqual(args.slice(0,3),['run','download',String(run.databaseId)]);
    downloaded=args.at(-1);fs.writeFileSync(path.join(downloaded,'quick-results-report.json'),JSON.stringify(quick));fs.writeFileSync(path.join(downloaded,'tournament-hydration-report.json'),JSON.stringify(hydration));fs.writeFileSync(path.join(downloaded,'golf-source-report.json'),JSON.stringify(golfSources));return '';
  };
  const actual=await collect({now,read});assert.equal(actual.state,'observed');assert.equal(actual.run.databaseId,run.databaseId);assert.equal(actual.latestRun.status,'in_progress');assert.equal(actual.reports.quick.failureCount,1);assert.equal(actual.reports.golf.failureCount,1);assert(markdown(actual).includes('http-503'));assert.equal(calls.length,3);assert(!fs.existsSync(downloaded),'temporary artifacts are removed');assert(calls.every(c=>!c.includes('--method')),'only read/download requests');assert(markdown(actual).includes('LPGA results HTTP 404'));assert(markdown(actual).includes('newer run'));assert(markdown(actual).includes('China Open'));
  const unavailable=await collect({now,read:async()=>{throw Error('unavailable');}});assert.equal(unavailable.state,'unavailable');assert(markdown(unavailable).includes('unknown'));
  let requests=0;
  const expired=await collect({now,read:async args=>{requests++;return args[0]==='run'?JSON.stringify([run]):JSON.stringify({total_count:1,artifacts:[{name:'tournament-hydration-report',size_in_bytes:1000,expired:true}]});}});assert.equal(expired.state,'unavailable');assert.equal(requests,2,'expired artifact never downloaded');
  const broken=await collect({now,read:async args=>{if(args[1]==='download')throw Error('download failed');return args[0]==='run'?JSON.stringify([run]):JSON.stringify({total_count:1,artifacts:[{name:'tournament-hydration-report',size_in_bytes:1000,expired:false}]});}});assert.equal(broken.state,'unavailable');assert(markdown(broken).includes('download failed'));
  console.log('Canonical source readout: green-workflow source failure, dated gaps, missing/stale/malformed reports, bounded read-only collection, redaction and unavailable evidence passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

const football=summary({football:{schemaVersion:'football-data-backup-report.v1',checkedAt:'2026-10-01T01:00:00Z',checks:[{code:'PL',state:'backup',newFinals:1,primaryFailure:'HTTP 503',table:{state:'unavailable'}}]},now:new Date('2026-10-01T02:00:00Z')});
assert.equal(football.football.state,'observed');assert.equal(football.football.checks[0].newFinals,1);assert.equal(football.football.checks[0].primaryFailure,'HTTP 503');
assert(markdown({state:'observed',run:{databaseId:1,url:'https://example.test',conclusion:'success'},reports:football,limitations:[]}).includes('primary failed: HTTP 503'));
assert.equal(summary({football:{schemaVersion:'wrong',checkedAt:'2026-10-01T01:00:00Z',checks:[]},now:new Date('2026-10-01T02:00:00Z')}).football.state,'unavailable');
