'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),cp=require('node:child_process');
function validate(){
 const timing=require('../config/card-timing'),labels=require('../config/fixture-labels');
 const now='2026-10-12T01:00:00Z',source={sourceUrl:'https://www.wtatennis.com/',sourceCheckedAt:'2026-10-11T12:00:00Z',drawId:'main-singles',drawType:'singles',mainDraw:true,tour:'WTA',playDate:'2026-10-11'};
 const parent={key:'tennis',cardType:'tennis_parent',tournamentParent:true,status:'ongoing',dateOnly:true,date:'2026-10-01',endDate:'2026-10-14',tournamentProgress:[{...source,roundNumbers:[4],totalRounds:7}]};
 assert.equal(timing.progress(parent,now),'ROUND 4 OF 7');
 assert.equal(timing.progress({...parent,tournamentProgress:[{...source,roundNumbers:[4,3,4],totalRounds:7}]},now),'ROUND 3-4 OF 7');
 const both={...parent,tournamentProgress:[parent.tournamentProgress[0],{...source,tour:'ATP',roundNumbers:[3],totalRounds:6}]};
 assert.equal(timing.progress(both,now),'WTA · ROUND 4 OF 7 · ATP · ROUND 3 OF 6');
 for(const progress of [{...source,roundNumbers:[4],roundLabels:['Quarter-final']},{...source,roundNumbers:[-1,4],totalRounds:7,roundLabels:['Quarter-final']},{...source,roundNumbers:[3,4],totalRounds:7,playDate:null,roundLabels:['Round of 16','Quarter-final']}])assert(!timing.progress({...parent,tournamentProgress:[progress]},now).match(/^ROUND \d+(?:-\d+)? OF \d+$/));
 assert.equal(timing.progress({...parent,tournamentProgress:[{...source,roundLabels:['Quarter-final']}]},now),'QUARTER-FINAL');
 for(const invalid of [{...source,drawType:'doubles'},{...source,mainDraw:false},{...source,sourceUrl:null},{...source,sourceCheckedAt:'2027-01-01T00:00:00Z'}])assert.equal(timing.progress({...parent,tournamentProgress:[invalid]},now),'ROUND UNCONFIRMED');
 for(const status of ['upcoming','completed','cancelled','postponed'])assert.equal(timing.progress({...parent,status},now),null);
 assert.equal(timing.progress({...parent,tournamentProgress:[]},now),'ROUND UNCONFIRMED');
 const test={key:'cricket',format:'Test',matchDay:2,numberOfDays:5,matchDaySourceUrl:'https://www.cricket.com.au/',date:'2026-10-09',endDate:'2026-10-13',status:'stumps'};
 for(const status of ['stumps','rain-delay','live','completed']){const e={...test,status};assert.equal(timing.progress(e,now),'DAY 2');assert.equal(timing.progress(e,'2026-10-13T20:00:00Z'),'DAY 2');assert(timing.presentation(e,now).ariaLabel.includes('9 OCT'));}
 assert.equal(timing.progress({...test,matchDay:undefined},now),'DAY UNCONFIRMED');assert.equal(timing.progress({...test,status:'upcoming'},now),null);assert.equal(timing.progress({...test,status:'completed',scheduleStatus:'cancelled'},now),null);
 for(const [round,expected]of [['Round of 32','Round of 32'],['Quarterfinal','QF'],['Semifinal','SF'],['Final','Final']]){const value=labels.tennisContext({key:'tennis',tour:'WTA',tournamentLevel:'1000',roundLabel:round});assert.equal(value.competition,'WTA1000');assert.equal(value.round,expected);assert.equal(value.finals,expected!=='Round of 32');}
 assert.equal(labels.tennisContext({key:'tennis',tour:'ATP',tournamentLevel:'500',roundLabel:'Round of 16'}).competition,'ATP500');assert.equal(labels.tennisContext({key:'tennis',name:'ATP Finals',tour:'ATP',roundLabel:'Group stage'}).finals,false);assert.equal(labels.tennisContext({key:'tennis',tournamentLevel:'500'}).competition,'Competition unconfirmed');
 const actual=require('../data/follow-schedule/tennis.json').fixtures.find(f=>f.id==='fixture:tennis:espn:wta:184356');assert.equal(labels.tennisContext(actual).competition,'WTA1000');assert.equal(labels.tennisContext(actual).round,'Final');
 const projected=require('./build-code-inspector').normalizeFixture({...actual,tournamentProgress:parent.tournamentProgress,matchDay:2,matchDaySourceUrl:test.matchDaySourceUrl,numberOfDays:5},'sport:tennis');assert.deepEqual(projected.tournamentProgress,parent.tournamentProgress);assert.equal(projected.matchDay,2);
 const compact=require('../lib/compact-fixture-observations').split([{...parent,id:'progress-test'}]);assert.deepEqual(compact.fixtures[0].tournamentProgress,parent.tournamentProgress);
 const observation={...actual,status:'live',sourceStale:false,statusCheckedAt:source.sourceCheckedAt,roundLabel:'Quarter-final'};
 const named=require('../lib/tournament-progress').tennis(parent,[observation,{...observation,eventCode:'WD',roundLabel:'Final'}]);assert.equal(named.length,1);assert.deepEqual(named[0].roundLabels,['Quarter-final']);assert.equal(named[0].totalRounds,undefined,'Partial matches never establish a total');assert.equal(named[0].playDate,'2026-10-11');
 const before=JSON.stringify(parent);timing.presentation(parent,'2026-10-12T16:00:00Z');assert.equal(JSON.stringify(parent),before,'Sydney midnight does not rewrite the official play day or source numbers');
 const calendar=require('../config/calendar-export'),legacy={module:{exports:{}},globalThis:{},TextEncoder,Date,Intl};vm.runInNewContext(cp.execFileSync('git',['show','033e44e7:config/calendar-export.js'],{encoding:'utf8'}),legacy);
 for(const fixture of [actual,{id:'all-day',name:'é; tennis,\\\n',date:'2026-10-11',endDate:'2026-10-12',dateOnly:true},{...actual,status:'cancelled'}])assert.equal(calendar.buildIcs([fixture],{now:new Date(now)}),legacy.module.exports.buildIcs([fixture],{now:new Date(now)}),'Encoder extraction keeps exported bytes identical');
 const runtime=fs.readFileSync('assets/js/calendar-sync-ui.js','utf8');assert(runtime.includes('NOTHINGSPORTS_CALENDAR_ICS'));assert(runtime.includes('refreshCounts')&&runtime.includes('matchingEvents'));
 console.log('Card context: real tennis labels, verified round ranges/tours, unknown and final states, frozen Test days, projection/compact transport and identical calendar bytes passed.');
}
if(require.main===module)validate();module.exports=validate;
