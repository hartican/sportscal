#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const labels=require('../config/fixture-labels');
const cards=require('../config/card-identities');
const results=require('../config/card-results');
const e={key:'cricket',name:'South Africa v Australia — First ODI',participantIds:['team:cricket:south-africa','team:cricket:australia'],participants:[{id:'team:cricket:south-africa',name:'South Africa',countryCode:'ZA',role:'home'},{id:'team:cricket:australia',name:'Australia',countryCode:'AU',role:'away'}],homeScore:200,awayScore:201};
const before=JSON.stringify(e);
assert.equal(labels.matchupTitle(e,e.name),'Australia v South Africa — First ODI');
assert.deepEqual(cards.matchupSidesForEvent(e,[],e.name).map(s=>s.participant.id),['team:cricket:australia','team:cricket:south-africa']);
assert.equal(results.scoreLine(e,labels.matchupTitle(e,e.name),{}),'South Africa 200 — Australia 201');
assert.equal(JSON.stringify(e),before,'presentation cannot mutate fixture facts');
const sides=[{players:[{id:'foreign',name:'Opponent',countryCode:'US'}]},{players:[{id:'aus',name:'Australian',countryCode:'AUS'}]}];
assert.equal(labels.australianFirst(sides)[0],sides[1]);
assert.deepEqual(labels.australianFirst([{countryCode:'AU',id:'one'},{countryCode:'AU',id:'two'}]).map(p=>p.id),['one','two']);
assert.equal(labels.matchupTitle({name:'Unknown v Stranger'},'Unknown v Stranger'),'Unknown v Stranger');
assert.equal(labels.matchupTitle(e,'Opponent hidden v Australia'),'Opponent hidden v Australia');
assert.equal(labels.matchupTitle({key:'tennis',participants:sides.flatMap(s=>s.players)},'Opponent v Australian'),'Australian v Opponent');
console.log('Australian-first presentation preserves source roles, result labels, stable order and spoiler-hidden opponents.');

const alternate={...e,name:'South Africa Men v Australia Men',participants:e.participants.map(p=>({...p,name:p.name+' Men'})),participantSlots:e.participantIds.map(id=>({participantId:id,label:id.endsWith('australia')?'Australia cricket':'South Africa cricket'}))};
const records=alternate.participantIds.map(id=>({id,displayName:id.endsWith('australia')?'Australia cricket':'South Africa cricket'}));
assert.deepEqual(cards.matchupSidesForEvent(alternate,records,labels.matchupTitle(alternate,alternate.name,records)).map(s=>[s.label,s.participant.id]),[['Australia Men','team:cricket:australia'],['South Africa Men','team:cricket:south-africa']]);

const tennis={key:'tennis',name:'Opponent v Australian',participants:sides.flatMap(s=>s.players),scoreDisplay:'6-4 6-3'};
const table=results.tennisSets(tennis,'Australian v Opponent',{});
assert.deepEqual(table.names,['Australian','Opponent']);assert.deepEqual(table.sets[0].scores.map(s=>s.games),[4,6],'Tennis names and scores move together');
