'use strict';

const assert=require('node:assert/strict');
const {normalizeFixture}=require('./build-code-inspector');
const canonical=require('../data/football/fixtures/a-league-men.json');

function focused(){
  const sourceRows=canonical.events.filter(row=>row.canonicalResultScoreline!=null);
  for(const source of sourceRows){
    const before=structuredClone(source);
    const projected=normalizeFixture(source,'sport:football');
    assert.equal(projected.canonicalResultScoreline,source.canonicalResultScoreline,'Existing canonical score-observation alias must survive projection: '+source.canonicalEventId);
    for(const field of ['score','result','homeScore','awayScore','scoreCheckedAt','sourceCheckedAt','resultSourceUrl','resultSourceCheckedAt']){
      if(Object.hasOwn(source,field))assert.deepEqual(projected[field],source[field],'Projection must not rewrite '+field);
    }
    assert.deepEqual(source,before,'Projection must not mutate its source');
  }
  const reference={id:'reference:projection-score-alias',eventId:'reference:projection-score-alias',key:'football',name:'Reference Home v Reference Away',date:'2026-10-01',time:'19:00',status:'completed',score:'Reference Home 2-1 Reference Away',result:{scorelineText:'Reference Home 2-1 Reference Away'}};
  const alias='Retained source alias, not a recomputed score';
  assert.equal(normalizeFixture({...reference,canonicalResultScoreline:alias},'sport:football').canonicalResultScoreline,alias,'Preserve the supplied alias literally, without deriving or relabelling it');
  const absent=normalizeFixture(reference,'sport:football');
  assert.equal(Object.hasOwn(absent,'canonicalResultScoreline'),false,'A structured result or score alone must not manufacture an alias');
  const explicitNull=normalizeFixture({...reference,canonicalResultScoreline:null},'sport:football');
  assert.equal(Object.hasOwn(explicitNull,'canonicalResultScoreline'),false,'An unknown alias remains absent');
  console.log('Code projection score alias: '+sourceRows.length+' existing canonical aliases preserved; scores, result objects and clocks unchanged; missing aliases not manufactured. No source/provider/account/publication requests.');
  return {canonicalAliases:sourceRows.length};
}

if(require.main===module)focused();
module.exports={focused};
