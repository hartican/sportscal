'use strict';
const assert=require('node:assert/strict'),natsoft=require('../lib/natsoft-snapshot'),frames=require('./fixtures/racing/natsoft-bathurst-20261011.json'),model=require('../config/match-centre');
const now=new Date('2026-10-11T02:02:17Z'),options={year:2026,sessionCode:'R17',sessionName:'2026 Repco Supercars Championship - Race 30',now};
function parse(input=frames){const read=natsoft.collector(options);for(const f of input){const value=read(f.data);if(value)return value;}return null;}
const detail=parse();assert.equal(detail.entries.length,26);assert.equal(detail.providerAt,null,'An unspecified provider timezone cannot be labelled UTC');assert.equal(detail.checkedAt,now.toISOString());
assert.deepEqual(detail.entries.find(e=>e.number==='888').drivers,['William Brown','Scott Pye']);assert.equal(detail.entries.find(e=>e.number==='11').currentDriver,'Jack Perkins');assert.equal(detail.entries.find(e=>e.number==='11').gap,'14 laps');assert.equal(detail.entries[0].sectors[1],null,'Zero unavailable sector is blank');
const full=frames.find(f=>f.data.startsWith('<L ')&&f.data.includes('Y="f"'));const start=frames.slice(0,frames.indexOf(full)+1);
assert.equal(parse(start.slice(0,-1)),null,'Metadata cannot establish a complete tower');
for(const [from,to] of [['L="26"><P','L="25"><P'],['C="26" D="1"','C="999" D="1"'],['LP="2" C="13"','LP="1" C="13"']])assert.throws(()=>parse(start.map(f=>({...f,data:f.data===full.data?f.data.replace(from,to):f.data}))),/Incomplete/);
assert.throws(()=>parse(frames.map(f=>({...f,data:f.data.replace('2026 Repco Bathurst 1000','2025 Repco Bathurst 1000')}))),/Wrong/);
const switched=parse(start.map(f=>({...f,data:f.data===full.data?f.data.replace('C="26" D="1"','C="26" D="2"'):f.data})));assert.equal(switched.entries[0].currentDriver,'Scott Pye');assert.deepEqual(switched.entries[0].drivers,detail.entries[0].drivers);
const red=parse(start.map(f=>({...f,data:f.data.replace('S="Green"','S="Red"')})));assert.equal(red.status,'suspended');assert.equal(red.statusText,'Red flag');
const final=parse(start.map(f=>({...f,data:f.data.replace('S="Green"','S="Checkered"')})));assert.equal(final.status,'completed');assert.equal(final.phase,'provisional-result','A flag alone is not an official result');
const fixture={id:'supercars-bathurst-1000-2026',key:'supercars',name:'Bathurst 1000',date:'2026-10-11',status:'live',statusCheckedAt:now.toISOString(),scoreCheckedAt:now.toISOString(),score:{racing:detail},sourceUrl:'https://www.supercars.com/events/2026-bathurst-1000',sourceType:'official'};
assert.equal(model.compact(fixture).score.racing.entries,undefined);assert.equal(model.compact(fixture).score.racing.entryCount,26);assert.equal(model.compact(fixture,{racing:true}).score.racing.entries.length,26);
assert.equal(model.liveState(fixture,+now+479999),'playing');assert.equal(model.liveState(fixture,+now+480001),'awaiting-update');assert.equal(model.liveState({...fixture,status:'suspended',score:{racing:red}},+now+86400000),'paused');assert.equal(model.pausedLabel({...fixture,status:'suspended',score:{racing:red}}),'Red flag');
const split=require('../lib/compact-fixture-observations').split([fixture],{now});assert.equal(split.fixtures[0].score,undefined);assert.equal(split.scores[0].score.racing.entries.length,26);assert.equal(split.scores[0].scoreObserved,true);
assert.equal(require('../config/feed-live-scores').presentation(fixture,{resultsOn:false,now:+now}),null);assert.match(require('../config/feed-live-scores').presentation(fixture,{resultsOn:true,now:+now}).text,/William Brown.*40.*161/);
async function main(){
 const {createMatchCentreHandler}=require('../lib/match-centre-handler');let reads=0;const handler=createMatchCentreHandler({published:()=>[fixture],enabled:()=>true,clock:()=>+now,request:async()=>{reads++;return [{fixture,checked_at:now.toISOString()}]},snapshotRead:async()=>({sources:[{fixtures:[fixture]}],readAt:+now,stale:false})});
 async function get(url){let body,status;const res={setHeader(){},status(n){status=n;return this;},json(v){body=v;}};await handler({method:'GET',url},res);return {body,status};}
 const selected=await get('/api/match-centre?ids='+fixture.id+'&details=racing');assert.equal(selected.body.fixtures[0].score.racing.entries.length,26);assert.equal(reads,1,'Detail reuses the existing selected DB read');
 const list=await get('/api/match-centre?membership=everything');assert.equal(list.body.fixtures[0].score.racing.entries,undefined);assert.equal(list.body.events[0].score.racing.entries,undefined);assert.equal((await get('/api/match-centre?membership=everything&details=racing')).status,400);
 let sockets=0,closes=0;class Socket{constructor(){sockets++;queueMicrotask(()=>{for(const f of start)this.onmessage?.({data:f.data});});}close(){closes++;}}
 const snapshot=await natsoft.readSnapshot(options,{WebSocketImpl:Socket});assert.equal(snapshot.entries.length,26);assert.equal(sockets,1);assert.equal(closes,1);
 class Incomplete{constructor(){sockets++;queueMicrotask(()=>this.onmessage?.({data:frames[0].data}));}close(){closes++;}}
 const begun=Date.now();await assert.rejects(natsoft.readSnapshot(options,{WebSocketImpl:Incomplete}),/four seconds/);assert(Date.now()-begun<4200);assert.equal(sockets,2,'No retries');assert.equal(closes,2,'Timed out socket disconnected');
 console.log('Racing: complete actual 26-car source, driver/identity/clock/pause/final boundaries, compact/detail API, persistence, Results OFF and four-second collection passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
