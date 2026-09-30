#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{parse,refresh}=require('../lib/lpga-results');
const fixture=require('./fixtures/golf/lpga-walmart-results-2026.json');
const page=value=>'<script>self.__next_f.push('+JSON.stringify([1,'0:'+JSON.stringify(value)+'\n'])+')</script>';
const base={id:'fixture:golf:lpga:2026063',tournamentId:'2026063',key:'golf',competitionId:'competition:lpga-tour',name:'Walmart NW Arkansas Championship',date:'2026-09-25',endDate:'2026-09-27',status:'live',sourceUrl:'https://www.lpga.com/tournaments/walmartnwarkansaschampionshippresentedbypg/pairings',participantsConfirmed:false,appearances:[]};
const options={base,sourceUrl:base.sourceUrl.replace('pairings','leaderboard'),checkedAt:'2026-09-30T00:00:00Z'};
async function main(){
 const result=parse(page(fixture),options);assert.equal(result.status,'completed');assert.match(result.outcomeText,/Yuna Nishimura.*-21.*192/);assert.equal(result.fixtureResults.rows.length,144);assert.equal(result.id,base.id);assert(result.fixtureResults.rows.some(r=>r[0]==='WDC'));
 for(const mutate of [v=>v.results.tournament.tournamentId++,v=>v.results.tournament.startDate='2025-09-25',v=>v.results.entries[0].prizeMoney='',v=>v.results.entries[0].position='T1',v=>v.results.entries[0].scores.pop(),v=>v.results.entries[0].total++,v=>v.results.entries.push(v.results.entries[0]),v=>delete v.results.entries[0].player,v=>v.results.entries[1].scores[0]='-']){const bad=structuredClone(fixture);mutate(bad);assert.throws(()=>parse(page(bad),options));}
 const doc={lpga:[base]},now=new Date(options.checkedAt),fetchImpl=async()=>({ok:true,text:async()=>page(fixture)});
 const updated=await refresh(doc,{now,fetchImpl});assert.equal(updated.changed,1);
 const same=await refresh(updated.document,{now:new Date('2026-09-30T01:00:00Z'),fetchImpl});assert.equal(same.changed,0);assert.deepEqual(same.document,updated.document);
 const failed=await refresh(updated.document,{now,fetchImpl:async()=>{throw Error('unavailable')}});assert.equal(failed.failures.length,1);assert.deepEqual(failed.document,updated.document);
 const retained=require('../lib/golf-participation').mergeObservation(base,result);assert.equal(retained.status,'completed');assert.equal(retained.outcomeText,result.outcomeText);assert.deepEqual(retained.fixtureResults,result.fixtureResults);
 const future=await refresh({lpga:[{...base,endDate:'2026-10-10'}]},{now,fetchImpl:async()=>{throw Error('unexpected fetch')}});assert.equal(future.checked,0);
 assert.deepEqual(require('./quick-results').projectionSteps(['LPGA 1']).find(s=>s[0]==='scripts/build-code-inspector.js'),['scripts/build-code-inspector.js','--codes=golf']);
 console.log('LPGA results: official edition, final classification, totals, identity, retained failure, no-op and Golf-only projection passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
