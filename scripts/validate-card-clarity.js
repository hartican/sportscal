'use strict';
const assert=require('node:assert/strict'),labels=require('../config/fixture-labels'),results=require('../config/card-results');
for(const [event,want]of [[{key:'cricket',format:'Test',gender:'men'},'Test Match Men'],[{key:'football',competitionName:'Ligue 1',gender:'men'},'Ligue 1 Men'],[{key:'nrl',gender:'women'},'NRLW'],[{key:'aflw'},'AFLW']])assert.equal(labels.badge(event),want);
assert.equal(labels.badge({key:'football',competitionName:'Unknown competition'}),'Unknown competition');assert.equal(labels.gender({name:'A v B'}),null);
for(const key of ['cricket','rugby']){assert.equal(labels.sport({key,gender:'men'}),key);assert.notEqual(labels.sport({key,gender:'women'}),key);assert.notEqual(labels.sport({key}),key);}
assert.equal(labels.sport({key:'tennis',gender:'women'}),'tennis');assert.equal(labels.sport({key:'nrlw'}),'nrlw');
const parse=score=>results.tennisSets({key:'tennis',name:'One v Two',scoreDisplay:score},'One v Two',{});
assert.equal(parse('One 6(3)-7(7) 6-2 6-4 6-4 Two').sets.length,4);
assert.deepEqual(parse('One 7-6(5) 4-6 [10-8] Two').sets[2],{label:'Match TB',scores:[{games:10,tieBreak:null},{games:8,tieBreak:null}]});
assert.equal(parse('One 6-4 4-6 7-6(3) 6-7(5) 12-10 Two').sets[4].label,'Set 5');
assert.equal(parse('Two 6-4 6-3 One').sets[0].scores[0].games,4);
assert.equal(parse('One 6-4 2-0 RET Two').status,'RET');assert.equal(parse('W/O'),null);assert.equal(parse('3-2'),null,'set-win totals are not a first set');
console.log('Card clarity: canonical badge scope, gender boundaries, tennis orientation, tie-breaks, five/extended sets, match TB and retirement passed.');
