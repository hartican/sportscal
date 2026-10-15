'use strict';
const assert=require('node:assert/strict'),timing=require('../config/card-timing'),fs=require('node:fs'),vm=require('node:vm');
const now=new Date('2026-10-13T00:26:33Z');
const base={key:'tennis',name:'First v Second',date:'2026-10-13',startTimeUtc:'2026-10-13T10:00:00Z',status:'upcoming',timePrecision:'exact'};
let cases=0;
function check(event,expected,{progress,aria}={}){
 const before=JSON.stringify(event),result=timing.minimised(event,now);
 assert.equal(result.time,expected);assert.match(result.ariaLabel,/Sydney time/,'Full date and zone remain accessible');
 if(progress!==undefined)assert.equal(result.progress,progress);if(aria)assert.match(result.ariaLabel,aria);
 assert.equal(JSON.stringify(event),before,'Minimised presentation does not rewrite source facts or clocks');assert(Object.isFrozen(result));cases++;return result;
}
check(base,'21:00');check({...base,timePrecision:'not-before'},'NB 21:00',{aria:/NOT BEFORE 9:00 PM/});
check({...base,timePrecision:'estimated',estimatedStartTimeUtc:'2026-10-13T09:30:00Z'},'APPROX. 20:30');
check({...base,timeTbc:true},'TIME TBD');check({...base,startTimeUtc:'invalid'},'TIME TBD');check({...base,timePrecision:'follows'},'FOLLOWS');
for(const [status,label] of [['live','SCHEDULED 21:00 · LIVE'],['completed','SCHEDULED 21:00 · FINISHED'],['cancelled','CANCELLED'],['postponed','POSTPONED'],['abandoned','ABANDONED']])check({...base,status},label);
const test={...base,key:'cricket',format:'Test',date:'2026-10-09',endDate:'2026-10-13',startTimeUtc:'2026-10-09T07:30:00Z',matchDay:4,numberOfDays:5,matchDaySourceUrl:'https://www.cricket.com.au/',status:'stumps'};
check({...test,restartTimeUtc:'2026-10-13T07:30:00Z'},'STUMPS · 18:30',{progress:'DAY 4',aria:/Live again at 6:30 pm/});
check({...test,restartTimeUtc:'2026-10-12T07:30:00Z'},'STUMPS · AWAITING UPDATE',{progress:'DAY 4',aria:/Awaiting resumption update/});
check({...test,restartTimeUtc:null},'STUMPS · TIME UNAVAILABLE',{progress:'DAY 4',aria:/Resume time unavailable/});
check({...test,status:'rain-delay'},'RAIN DELAY · TIME UNAVAILABLE',{progress:'DAY 4'});
check({...test,status:'completed',matchDay:2},'SCHEDULED 18:30 · FINISHED',{progress:'DAY 2'});
check({...test,matchDaySourceUrl:null},'STUMPS · TIME UNAVAILABLE',{progress:'DAY UNCONFIRMED'});
const overview={key:'tennis',name:'Combined tours',cardType:'tennis_parent',tournamentParent:true,dateOnly:true,date:'2026-10-12',endDate:'2026-10-18',status:'ongoing',representedTours:['ATP','WTA'],tournamentProgress:['ATP','WTA'].map(tour=>({tour,drawType:'singles',mainDraw:true,roundNumbers:[3,4],totalRounds:7,playDate:'2026-10-12',sourceUrl:'https://www.atptour.com/controlled-test',sourceCheckedAt:now.toISOString()}))};
check(overview,'IN PROGRESS',{progress:'ATP · ROUND 3-4 OF 7 · WTA · ROUND 3-4 OF 7'});
check({...overview,status:'completed'},'12 OCT–18 OCT · FINISHED',{progress:null});
check({...overview,status:'upcoming'},'12 OCT–18 OCT',{progress:null});
check({...overview,tournamentProgress:[{...overview.tournamentProgress[0],totalRounds:null,roundLabels:['Quarterfinal']}]},'IN PROGRESS',{progress:'ATP · QUARTERFINAL · WTA · ROUND UNCONFIRMED'});
// Dated renderer replay must not import a later day/result from mutable live data.
const currentPublished=require('../data/follow-schedule/cricket.json').fixtures.find(f=>f.sourceEventIds?.includes('fixture:cricket:CA:39990'));
assert(currentPublished,'The actual current Test remains in the published schedule');
const published=require('./fixtures/cricket-ca39990-minimised-20261013.json');
assert(published,'Captured Australia/Proteas Test exists');const final=timing.minimised(published,now);assert.equal(final.progress,'DAY 4');assert.match(final.time,/STUMPS/);assert(!final.progress.includes('OF 5'));
// Execute the actual shared DOM boundary, rather than constructing lookalike
// test markup. Browser verification supplies the complete native DOM and CSS.
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.textContent='';this.className='';this.classList={contains:name=>this.className.split(/\s+/).includes(name)};}
 append(...children){this.children.push(...children);}setAttribute(key,value){this.attributes[key]=value;}getAttribute(key){return this.attributes[key];}insertAdjacentHTML(position,html){this.html=html;}
}
const source=fs.readFileSync(require.resolve('../config/venue-panel-ui'),'utf8');
const context=vm.createContext({document:{createElement:tag=>new Element(tag)},nowAEST:()=>now,NOTHINGSPORTS_CARD_TIMING:timing,NOTHINGSPORTS_FIXTURE_LABELS:require('../config/fixture-labels'),NOTHINGSPORTS_FEED_CARD_PRESENTATION:require('../config/feed-card-presentation'),COUNTRY_FLAGS:require('../config/country-flags'),CARD_IDENTITIES:{markForEvent:()=>null},cardIdentityParticipants:()=>[],matchupIdentityMatches:event=>event.participantIds?.map(id=>({participant:event.participants?.find(p=>p.id===id)||{id},label:event.participants?.find(p=>p.id===id)?.displayName||id,mark:{id}}))||[],compactFixtureName:event=>event.name,spoilerSafeDisplayTitle:event=>event.name,cricketPlayingFormatForEvent:event=>event.format||'',FOLLOW_FIRST:{stageLabel:event=>event.roundLabel||''},activeTab:'feed'});
for(const name of ['buildMinimisedParticipant','fixtureCompetitionLabel','compactFixtureFormat','compactFixtureStage','buildCompactCardSummary']){const start=source.indexOf('function '+name+'('),next=source.indexOf('\nfunction ',start+1);assert(start>=0,'Shared runtime still owns '+name);vm.runInContext(source.slice(start,next<0?source.length:next),context);}
for(const activeTab of ['feed','events','follow']){
 context.activeTab=activeTab;const summary=context.buildCompactCardSummary(published);assert.equal(summary.tagName,'button');assert.equal(summary.type,'button');assert(summary.classList.contains('minimised-card-summary'));assert.equal(summary.children.length,4);assert.equal(summary.children.at(-1).textContent,final.time);assert.match(summary.getAttribute('aria-label'),/Sydney time/);assert.match(summary.children[0].children[1].textContent,/Aus.*S\. Africa|S\. Africa.*Aus/,'Approved short country labels appear in the actual summary');
}
for(const status of ['upcoming','completed']){const summary=context.buildCompactCardSummary({...overview,status,participantIds:[]});assert.equal(summary.children[2].textContent,'','Upcoming/completed overviews retain dates without an unconfirmed match round');}
const thin=context.buildCompactCardSummary({...overview,status:'upcoming',participantIds:require('../data/follow-schedule/tennis.json').fixtures.find(f=>f.id==='fixture:tennis:espn:wta:184356').participantIds,participants:require('../data/follow-schedule/tennis.json').fixtures.find(f=>f.id==='fixture:tennis:espn:wta:184356').participants});assert.equal(thin.children[0].children.at(-1).textContent,overview.name,'Exactly two known entrants do not turn an overview into a match');
console.log(`Minimised timing: ${cases} source-qualified clocks, terminal states, pauses, Test days and combined-tour progress cases passed.`);
