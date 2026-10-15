'use strict';
const assert=require('node:assert/strict'),presentation=require('../config/feed-card-presentation'),timing=require('../config/card-timing');
const now=new Date('2026-10-16T00:00:00Z');
const rugby=require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026');
const golf=require('../data/code-inspector/golf.json').fixtures.find(e=>(e.name||'').startsWith('Minjee Lee /'));
const football=require('../data/providers/openligadb/football-2026-27.json').events.filter(e=>/LASK v Liverpool|Manchester City v Paris/.test(e.name));
assert(rugby&&golf&&football.length===2);
for(const fixture of [rugby,golf])assert.equal(require('../config/fixture-highlights').viewing({...fixture,status:'past'},now),null,'A cached past/elapsed-clock label is not source-confirmed completion and cannot promise highlights');
assert.deepEqual(require('../lib/highlight-channels').channelsFor(rugby).map(c=>c.label),['NRL'],'The reported World Cup fixture must use its reviewed official NRL publisher');
assert(!require('../lib/highlight-channels').channelsFor({...rugby,competitionId:'competition:rugby-world-cup-2027',key:'rugby'}).some(c=>c.label==='NRL'),'Rugby Union cannot borrow the Rugby League publisher');
for(const displayTime of ['Time TBC','Time TBD'])assert.equal(timing.dateOnlyLabel({displayTime}),'Time unavailable','Cached placeholders use truthful missing-data language');
for(const fixture of football)assert.equal(presentation.venue({...fixture,venue:null,venueCity:null}),'');
for(const fixture of [{date:'2026-10-17',dateOnly:true},{...rugby,status:'completed',actualStartTimeUtc:null},{...golf,timeTbc:true},{status:'stumps',key:'cricket',date:'2026-10-15'}]){
 const value=timing.presentation(fixture,now);assert(!/\b(?:TBD|TBC)\b|to be determined/i.test(JSON.stringify(value)),'Missing app metadata must not imply an organiser decision: '+JSON.stringify(value));
}
function response(){return{headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},end(value){this.body=value;},json(value){this.body=value;}};}
async function main(){
 for(const fixture of [rugby,golf]){
  const event={...fixture,status:'upcoming'};
  for(const key of ['result','resultStatus','resultPublishedAt','fixtureResults','score','scoreDisplay','homeScore','awayScore','outcomeText','recapText'])delete event[key];
  const handler=require('../lib/live-fixture-handler').createLiveFixtureHandler({publishedFixtures:()=>[event],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,resolveHighlights:()=>assert.fail('Unconfirmed completion cannot spend provider quota')});
  const res=response();await handler({method:'GET',headers:{},url:'/api/fixtures?mode=highlight&ids='+encodeURIComponent(event.id)},res);
  assert.equal(res.code,404);assert.match(res.body,/Nothing Sport.*(?:received|confirmed)/);assert.match(res.body,/fixture update/i);assert(!res.body.includes('Highlights unavailable right now'),'The app must identify its missing fixture update');assert(res.body.includes('/?event='+encodeURIComponent(event.id)),'Return to the same fixture');assert.equal(res.headers['Cache-Control'],'no-store');
 }
 console.log('Missing fixture metadata: real football venue gaps, unknown clocks, and reported RLWC/Minjee highlight eligibility failures explain the app data gap without inventing sporting facts or spending lookup quota.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
