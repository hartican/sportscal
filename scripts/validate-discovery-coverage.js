#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {parseCricketScoreboard,parseWorldRugby,discoverySources}=require('../lib/coverage-discovery');
// Public ESPN scoreboard, 6 September 2026. Its isNational flag is wrong.
const payload={sports:[{slug:'cricket',leagues:[{id:'23803',name:'Ireland Women tour of England 2026',events:[{
 id:'1496554',date:'2026-09-06T09:30:00Z',endDate:'2026-09-07T23:59:00Z',timeValid:true,name:'England Women v Ireland Women',
 description:'3rd ODI, Ireland Women tour of England at Worcester, Sep 6 2026',eventType:'ODI',status:'post',
 class:{internationalClassId:'9',generalClassCard:"Women's ODI"},fullStatus:{summary:'ENG Women won by 114 runs'},
 link:'https://www.espn.in/cricket/series/23803/scorecard/1496554/england-women-vs-ireland-women-3rd-odi-23803',
 competitors:[{id:'975',displayName:'England Women',location:'England',homeAway:'home',isNational:false,score:'291'},
 {id:'2234',displayName:'Ireland Women',location:'Ireland',homeAway:'away',isNational:false,score:'177 (44.2/50 ov, target 292)'}]
}]}]}]};
const [event]=parseCricketScoreboard(payload,{checkedAt:'2026-09-08T00:00:00Z'});
assert.equal(event.date,'2026-09-06');assert.equal(event.time,'19:30');
assert.equal(event.competitionScope,'international');assert.equal(event.gender,'women');
assert.equal(event.homeParticipantId,'team:cricket:england-women');
assert.equal(event.awayParticipantId,'team:cricket:ireland-women');
assert.equal(event.status,'completed');assert.equal(event.endDate,'2026-09-06','single-day cricket must not inherit a two-day provider envelope');
assert.deepEqual(parseCricketScoreboard({sports:[{id:'200',name:'Cricket',slug:'cricket'}]}),[], 'ESPN represents a valid empty date by omitting leagues');
assert.throws(()=>parseCricketScoreboard({sports:[{slug:'cricket',leagues:{}}]}));
console.log('Discovery coverage: missing women\'s international survives classification and timing.');
const [rugby]=parseWorldRugby({content:[{matchId:'22056030-c322-43e1-9705-5fff0cbfdde2',sport:'WRU',competition:'WXV 2026',
 time:{millis:1789221600000,gmtOffset:1,label:'2026-09-12'},teams:[{id:'2517',name:'England'},{id:'2577',name:'Australia'}],scores:[0,0],status:'U',
 events:[{id:'14de5b79-3cda-4025-8150-843fa3f19ee8',label:'WXV 2026'}],venue:{name:'CorPacq Stadium',city:'Manchester',country:'England'}}]},{});
assert.equal(rugby.gender,'women');assert.equal(rugby.startTimeUtc,'2026-09-12T14:00:00.000Z');
assert.equal(rugby.date,'2026-09-13');assert.equal(rugby.time,'00:00');
assert.equal(rugby.awayParticipantId,'team:rugby:australia-women');assert.equal(rugby.competitionScope,'international');
assert.equal(rugby.homeScore,undefined,'scheduled source zeroes are not a result');
const [midnight]=parseWorldRugby({content:[{matchId:'midnight',sport:'MRU',time:{millis:Date.parse('2026-09-12T00:00:00Z'),gmtOffset:-4,label:'2026-09-11'},teams:[],status:'LHT',scores:[7,3]}]});
assert.equal(midnight.startTimeUtc,'2026-09-12T00:00:00.000Z','a real local evening must not become date-only');
assert.equal(midnight.status,'live');
async function discoveryChecks(){
 const source=discoverySources(async url=>({ok:true,json:async()=>({pageInfo:{page:Number(new URL(url).searchParams.get('page')),numPages:2,numEntries:2},content:[{matchId:new URL(url).searchParams.get('page')==='0'?'page-one':'page-two',sport:'WRU',competition:'WXV',time:{label:'2026-09-12'},teams:[],status:'U'}]})})).find(source=>source.id==='discovery-rugby-wru');
 const found=await source.fetch({now:new Date('2026-09-08T00:00:00Z'),previous:[]});
 assert.deepEqual(found.map(event=>event.id),['fixture:rugby:wr:page-one','fixture:rugby:wr:page-two']);
 assert.equal(found.coverage.pagesRead,2);assert.equal(found.coverage.failures.length,0);
 const days=discoverySources().filter(source=>source.id.startsWith('discovery-cricket-')).flatMap(source=>source.offsets||[]);
 for(let offset=-7;offset<=90;offset++)assert(days.includes(offset),`rolling cricket scan omitted day ${offset}`);
 console.log('Discovery coverage: complete pagination and every requested cricket day covered.');
}
discoveryChecks().catch(error=>{console.error(error);process.exitCode=1;});
