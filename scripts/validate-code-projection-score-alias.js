'use strict';

const assert=require('node:assert/strict');
const {normalizeFixture,preserveUnchangedScoreAliasShape}=require('./build-code-inspector');
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
  const exposed={...reference,canonicalResultScoreline:alias};
  assert.deepEqual(preserveUnchangedScoreAliasShape(reference,exposed),reference,'An otherwise unchanged unrelated row must not acquire a new alias field');
  assert.deepEqual(preserveUnchangedScoreAliasShape(exposed,reference),exposed,'An existing alias must survive a rebuild with identical other fields');
  const newer={...reference,scoreCheckedAt:'2026-10-02T00:00:00.000Z',canonicalResultScoreline:'A newly observed canonical alias'};
  assert.equal(preserveUnchangedScoreAliasShape(exposed,newer),newer,'New observed facts/clocks retain their current supplied alias');
  assert.equal(preserveUnchangedScoreAliasShape(null,exposed),exposed,'A genuinely new fixture retains its supplied alias');
  assert.deepEqual(reference.result,{scorelineText:'Reference Home 2-1 Reference Away'},'Shape retention must not mutate score facts');
  console.log('Code projection score alias: '+sourceRows.length+' existing canonical aliases preserved; scores, result objects and clocks unchanged; missing aliases not manufactured. No source/provider/account/publication requests.');
  return {canonicalAliases:sourceRows.length};
}

if(require.main===module)focused();
module.exports={focused};
