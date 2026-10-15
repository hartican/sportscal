'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let constructions=0;
class CountedDateTimeFormat extends Intl.DateTimeFormat{constructor(...args){super(...args);constructions++;}}
const context={module:{exports:{}},require:require('node:module').createRequire(require('node:path').resolve('config/card-timing.js')),Intl:{DateTimeFormat:CountedDateTimeFormat}};
vm.runInNewContext(fs.readFileSync('config/card-timing.js','utf8'),context);
const timing=context.module.exports,now='2026-09-21T14:30:00Z';
const fixtures=[
 {date:'2026-09-25',startTimeUtc:'2026-09-24T16:30:00Z'},
 {date:'2026-10-04',startTimeUtc:'2026-10-03T16:30:00Z'},
 {date:'2027-01-02',startTimeUtc:'2027-01-01T15:30:00Z'},
 {date:'2026-09-25',dateOnly:true,endDate:'2026-09-28'},
 {date:'2026-09-25',timePrecision:'estimated',estimatedStartTimeUtc:'2026-09-24T17:30:00Z'},
 {date:'2026-09-25',status:'stumps',restartTimeUtc:'2027-01-02T01:00:00Z'},
 {date:'2026-09-25',status:'break',restartTimeUtc:'2026-09-21T20:00:00Z'},
 {}
];
const expected=fixtures.map(event=>({presentation:timing.presentation(event,now),pause:timing.pausePresentation(event,now)}));
const warmed=constructions;
for(let repeat=0;repeat<100;repeat++)fixtures.forEach((event,i)=>assert.deepEqual({presentation:timing.presentation(event,now),pause:timing.pausePresentation(event,now)},expected[i]));
assert(warmed<=8,'Only the finite internal formatting styles should be constructed');
assert.equal(constructions,warmed,'Repeated card rendering must reuse formatters while reading each current fixture');
assert.equal(timing.presentation({...fixtures[0],status:'completed'},now).label,'FINISHED');
assert.equal(timing.presentation(fixtures[0],now).label,'FRI 2:30 AM','a changed status cannot remain cached');
console.log(JSON.stringify({passed:true,styles:warmed,renderCases:fixtures.length*100,currentFactsRead:true}));
