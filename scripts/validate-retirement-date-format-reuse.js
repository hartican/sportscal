'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let constructions=0;
class CountedDateTimeFormat extends Intl.DateTimeFormat {constructor(...args){super(...args);constructions++;}}
const context={module:{exports:{}},Intl:{DateTimeFormat:CountedDateTimeFormat}};
vm.runInNewContext(fs.readFileSync('config/epic-classics.js','utf8'),context);
const epic=context.module.exports;
const cases=[
 ['2026-10-03T13:59:59Z','2026-10-03'],['2026-10-03T14:00:00Z','2026-10-04'],
 ['2026-10-15T12:59:59Z','2026-10-15'],['2026-10-15T13:00:00Z','2026-10-16'],
 ['2026-04-04T12:59:59Z','2026-04-04'],['2026-04-04T13:00:00Z','2026-04-05'],
 [null,null],[undefined,null],['',null],['invalid',null]
];
for(let repeat=0;repeat<100;repeat++)for(const [input,expected]of cases)assert.equal(epic.day(input),expected);
// Exercise the actual shared retirement caller on both sides of Sydney midnight.
const fixture={status:'completed',date:'2026-10-07',startTimeUtc:'2026-10-07T01:00:00Z',completedAt:'2026-10-07T05:00:00Z'};
for(let repeat=0;repeat<100;repeat++){
 assert.equal(epic.retired(fixture,new Date('2026-10-15T12:59:59Z')),true);
 assert.equal(epic.retired({...fixture,date:'2026-10-08',startTimeUtc:'2026-10-08T01:00:00Z',completedAt:'2026-10-08T05:00:00Z'},new Date('2026-10-15T12:59:59Z')),false);
 assert.equal(epic.retired({...fixture,date:'2026-10-08',startTimeUtc:'2026-10-08T01:00:00Z',completedAt:'2026-10-08T05:00:00Z'},new Date('2026-10-15T13:00:00Z')),true);
}
assert.equal(constructions,1,'Repeated shared calendar/retirement checks must reuse one Sydney formatter');
console.log(JSON.stringify({passed:true,formatterConstructions:constructions,dayCases:cases.length*100,retirementCases:300,sourceFactsCached:false}));
