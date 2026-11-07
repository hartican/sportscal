#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {contentHash}=require('../lib/live-fixtures');
const {liveSources}=require('../lib/live-source-adapters');
// The pre-agreed external-source -> fixture seam. Seed fixtures deliberately
// match the published Schedule contract, which omits canonical roundNumber.
const now=new Date('2026-09-08T09:00:00Z');
const match={id:9001,providerId:'CD_AFL_20260100101',status:'CONCLUDED',utcStartTime:'2026-09-06T05:00:00Z',round:{roundNumber:1,name:'Round 1'},home:{team:{id:1,name:'Sydney Swans',abbreviation:'SYD'},score:{totalScore:92}},away:{team:{id:2,name:'Collingwood',abbreviation:'COLL'},score:{totalScore:81}},venue:{name:'SCG',timezone:'Australia/Sydney'}};
const nrlMatch={matchId:9002,matchStatus:'complete',utcStartTime:'2026-09-06T05:00:00Z',roundNumber:1,homeSquadId:1,awaySquadId:2,homeSquadNickname:'Roosters',awaySquadNickname:'Knights',homeSquadScore:24,awaySquadScore:18,venueName:'SCG'};
async function fetchSource(url){
 const value=new URL(url);let payload;
 if(value.pathname.endsWith('/fixture.json'))payload={fixture:{match:[nrlMatch]}};
 else if(value.pathname.endsWith('/compseasons'))payload={compSeasons:[{id:100,name:'2026 Season',currentRoundNumber:1}]};
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
 for(const code of ['afl','aflw','nrl']){
  const source=liveSources(fetchSource).find(item=>item.id===`live-${code}`);
  const first=await source.fetch({now,previous:[]});
  const later=new Date(+now+1800000);
  const second=await source.fetch({now:later,previous:first});
  assert.equal(second[0].createdAt,first[0].createdAt,code+': original creation retained');
  assert.equal(second[0].updatedAt,later.toISOString());assert.equal(second[0].source.checkedAt,later.toISOString());
  assert.equal(contentHash(first),contentHash(second),code+': unchanged producer facts do not revise snapshots');
  const rediscovered=await source.fetch({now:later,previous:[{...first[0],id:'different-id'}]});
  assert.equal(rediscovered[0].createdAt,later.toISOString(),'a new identity receives its own first observation');
  for(const change of [{homeScore:100},{status:'postponed'},{startTimeUtc:'2026-09-08T14:00:00Z'},{participantIds:['new-team','other-team']},{venueName:'New venue'},{createdAt:'2025-01-01T00:00:00Z'}])assert.notEqual(contentHash(first),contentHash([{...second[0],...change}]),code+': meaningful change remains detectable');
 }
 console.log('Live AFL/AFLW/NRL: stable first observation, fresh checks and meaningful fact revisions passed.');
 console.log('Live AFL/AFLW: published-card seeds without roundNumber still fetch and parse official match results.');
})().catch(error=>{console.error(error);process.exitCode=1;});
