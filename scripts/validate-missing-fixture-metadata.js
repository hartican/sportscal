'use strict';
const assert=require('node:assert/strict'),presentation=require('../config/feed-card-presentation'),timing=require('../config/card-timing');
const now=new Date('2026-10-16T00:00:00Z');
for(const [cached,expected] of [['Player TBD','Player unavailable'],['Side TBC','Side unavailable'],['TBA','unavailable'],['To be determined','unavailable']]){
 assert.equal(presentation.displayLabel(undefined,cached),expected,'Cached participant placeholders describe missing app data');
 assert.equal(presentation.shortLabel(undefined,'Known fallback',{shortName:cached}),expected,'Cached short names follow the same rule');
}
for(const label of ['Winner of semi-final','Loser of match 2','Qualifier to be determined']){
 assert.equal(presentation.displayLabel('team:afl:cd_t60',label),label,'Actual unresolved sporting outcomes keep their source description');
 assert.equal(presentation.shortLabel('team:afl:cd_t60',label,{shortName:'Dockers'}),label,'Compact nicknames cannot reveal a protected outcome');
}
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
assert.equal(presentation.dateBanner(null,now),'DATE UNAVAILABLE');
assert(!html.includes('Upcoming · dates to be confirmed'),'Missing app dates are described consistently');
const timeSource=html.slice(html.indexOf('function eventTimeLabel(ev){'),html.indexOf('function buildEventActionPanel(ev,'));
const context={NOTHINGSPORTS_CARD_TIMING:timing,nowAEST:()=>now,fmtTime12:()=> '7:00 PM',eventLocationLabel:e=>presentation.venue(e)};
vm.runInNewContext(timeSource,context);
for(const patch of [{},{timePrecision:'estimated'},{dateOnly:true},{timePrecision:'not-before'}]){
 const fixture={date:'2026-10-17',time:'19:00',startTimeUtc:'2026-10-17T08:00:00Z',...patch};
 const label=context.eventTimeLabel(fixture);
 assert(!/^\s*·|·\s*$/.test(label),'An omitted venue cannot leave an empty separator: '+label);
 assert.match(context.eventTimeLabel({...fixture,venueCity:'Sydney'}),/ · Sydney$/,'A sourced city remains visible');
}
function element(tag){return{tag,children:[],dataset:{},classList:{add(){}},append(...nodes){this.children.push(...nodes);},appendChild(node){this.append(node);}};}
const hubContext={document:{createElement:element},NOTHINGSPORTS_FEED_CARD_PRESENTATION:presentation,userPreferences:{showSpoilers:false},spoilerSafeDisplayTitle:e=>e.name,dayDateLabel:d=>d,fmtTime12:()=> '7:00 PM'};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/js/sport-hub-ui.js'),'utf8'),hubContext);
for(const resultsMode of [false,true])for(const key of ['wrc','nrl'])for(const venueCity of [null,'Sydney']){
 const row=hubContext.buildSportHubFixtureRow({event:{key,name:'Source fixture',date:'2026-10-17',time:'19:00',venueCity},liveProviders:[],replayProviders:[]},{resultsMode});
 const detail=row.children[1].children.find(n=>n.className==='sport-hub-fixture-detail').textContent;
 assert(!/^\s*·|·\s*$/.test(detail),'Missing legacy venue leaves no empty detail separator');
 if(venueCity)assert.match(detail,/^Sydney · /);
}
const rugby=require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026');
const golf=require('../data/code-inspector/golf.json').fixtures.find(e=>(e.name||'').startsWith('Minjee Lee /'));
const football=require('../data/providers/openligadb/football-2026-27.json').events.filter(e=>/LASK v Liverpool|Manchester City v Paris/.test(e.name));
assert(rugby&&golf&&football.length===2);
for(const fixture of [rugby,golf])assert.equal(require('../config/fixture-highlights').viewing({...fixture,status:'past'},now),null,'A cached past/elapsed-clock label is not source-confirmed completion and cannot promise highlights');
assert.deepEqual(require('../lib/highlight-channels').channelsFor(rugby).map(c=>c.label),['NRL'],'The reported World Cup fixture must use its reviewed official NRL publisher');
assert(!require('../lib/highlight-channels').channelsFor({...rugby,competitionId:'competition:rugby-world-cup-2027',key:'rugby'}).some(c=>c.label==='NRL'),'Rugby Union cannot borrow the Rugby League publisher');
for(const displayTime of ['Time TBC','Time TBD'])assert.equal(timing.dateOnlyLabel({displayTime}),'Time TBD','Cached placeholders keep the agreed upcoming unknown-time wording');
for(const fixture of football)assert.equal(presentation.venue({...fixture,venue:null,venueCity:null}),'');
for(const fixture of [{date:'2026-10-17',dateOnly:true},{...rugby,status:'completed',actualStartTimeUtc:null},{...golf,timeTbc:true},{status:'stumps',key:'cricket',date:'2026-10-15'}]){
 const value=timing.presentation(fixture,now);assert(!/\bTBC\b|to be determined/i.test(JSON.stringify(value)),'Missing app metadata must not imply an organiser decision: '+JSON.stringify(value));
 if(timing.played(fixture))assert(!/START (?:UNAVAILABLE|TBD)|^TIME TBD$/i.test(value.time),'The later played-start rule leaves unknown starts blank');
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
