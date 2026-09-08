#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {liveSources}=require('../lib/live-source-adapters');
// The pre-agreed external-source -> fixture seam. Seed fixtures deliberately
// match the published Schedule contract, which omits canonical roundNumber.
const now=new Date('2026-09-08T09:00:00Z');
const match={id:9001,providerId:'CD_AFL_20260100101',status:'CONCLUDED',utcStartTime:'2026-09-06T05:00:00Z',round:{roundNumber:1,name:'Round 1'},home:{team:{id:1,name:'Sydney Swans',abbreviation:'SYD'},score:{totalScore:92}},away:{team:{id:2,name:'Collingwood',abbreviation:'COLL'},score:{totalScore:81}},venue:{name:'SCG',timezone:'Australia/Sydney'}};
async function fetchSource(url){
 const value=new URL(url);let payload;
 if(value.pathname.endsWith('/compseasons'))payload={compSeasons:[{id:100,name:'2026 Season',currentRoundNumber:1}]};
 else if(value.pathname.endsWith('/compseasons/100'))payload={compSeasons:[{rounds:[{roundNumber:1,name:'Round 1',startDate:'2026-09-05T00:00:00Z',endDate:'2026-09-08T00:00:00Z'}]}]};
 else if(value.pathname.endsWith('/matches'))payload={matches:[match]};
 else throw new Error('Unexpected source URL');
 return {ok:true,json:async()=>payload};
}
(async()=>{
 for(const code of ['afl','aflw']){
  const source=liveSources(fetchSource).find(item=>item.id===`live-${code}`);
  const fixtures=await source.fetch({now,previous:[{id:'retained',key:code,name:'Published fixture',roundLabel:'Round 1',startTimeUtc:'2026-09-06T05:00:00Z'}]});
  assert.equal(fixtures.length,1,`${code} refresh returns official results without requiring roundNumber on saved cards`);
  assert.equal(fixtures[0].status,'completed');assert.equal(fixtures[0].homeScore,92);
  assert.equal(fixtures[0].key,code,'AFLW must not become AFL or an unclassified fixture');assert.match(fixtures[0].name,/Sydney.*Collingwood/);
 }
 console.log('Live AFL/AFLW: published-card seeds without roundNumber still fetch and parse official match results.');
})().catch(error=>{console.error(error);process.exitCode=1;});
