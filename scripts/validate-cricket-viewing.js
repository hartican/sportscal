'use strict';
const assert=require('node:assert/strict');const {viewingOptions}=require('../config/follow-first');
const fixtures=require('../data/follow-schedule/cricket.json').fixtures;
const tour=fixtures.filter(e=>['competition:cricket:4567','competition:cricket:espn:24203'].includes(e.competitionId)&&e.date>='2026-09-24'&&e.date<='2026-09-30');
assert(tour.length>=3,'all published ODI dates');
for(const fixture of tour){
 for(const status of ['upcoming','live','completed']){
 const options=viewingOptions({...fixture,status},['seven']);assert.deepEqual(options.map(p=>p.providerId),['kayo','foxtel']);
 assert(options.every(p=>p.territory==='AU'&&/^https:\/\//.test(p.sourceUrl)&&p.verifiedAt&&p.logoPath));
 }
}
for(const competitionId of ['competition:cricket:4567','competition:cricket:espn:24203']){
 assert.deepEqual(viewingOptions({key:'cricket',competitionId,date:'2027-09-24'}),[],'no assumed next-season rights');
}
assert.deepEqual(viewingOptions({key:'cricket',competitionId:'competition:cricket:unknown',name:'Other overseas tour',date:'2026-09-24'}),[]);
console.log('ODI viewing: all three fixtures, CA/ESPN identities, statuses, territory, provenance and season bounds passed.');
