'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {retainReviewedCanonicalMetadata:retain}=require('./lib/retained-canonical-metadata');
// Captured inputs are supplied explicitly so this regression never polls or
// changes a real file, and never claims current freshness from an old replay.
function validate({previous,incoming,fixtureOverrides,checkedAt,expectations}){
 const baseline=JSON.stringify({previous,incoming,fixtureOverrides});
 const next=retain(previous,incoming,{fixtureOverrides,checkedAt}),old=new Map(previous.map(x=>[x.id,x])),raw=new Map(incoming.map(x=>[x.id,x]));
 for(const {id,field,from}of expectations)assert.deepEqual(next.find(x=>x.id===id)[field],(from==='previous'?old:raw).get(id)[field],from+' owns '+id+' '+field);
 const allowed=new Set(['selectedSentence','fullSpiel','editorialPreview','broadcasters']);
 for(const event of next)for(const key of new Set([...Object.keys(event),...Object.keys(raw.get(event.id))]))if(!allowed.has(key))assert.deepEqual(event[key],raw.get(event.id)[key],'fresh fact not changed: '+event.id+' '+key);
 const selected=previous.find(x=>x.editorialPreview?.status==='journalistic'&&raw.get(x.id)?.editorialPreview?.status==='journalistic');assert(selected);
 const original=raw.get(selected.id);
 // Actual captured same-fixture/same-angle changes (including Port12th->11th
 // and Carlton5th->6th) keep both incoming copy and its genuine source clock.
 const changedTable=previous.filter(event=>event.editorialPreview?.status==='journalistic'&&raw.get(event.id)?.editorialPreview?.angle===event.editorialPreview.angle&&raw.get(event.id)?.fullSpiel!==event.fullSpiel);
 assert(changedTable.length>=2,'captured fixture/ladder preview changes remain covered');
 for(const prior of changedTable){const fresh=raw.get(prior.id),actual=next.find(event=>event.id===prior.id);assert.equal(actual.fullSpiel,fresh.fullSpiel);assert.equal(actual.selectedSentence,fresh.selectedSentence);assert.deepEqual(actual.editorialPreview,fresh.editorialPreview);assert.equal(actual.editorialPreview.sourceCheckedAt,checkedAt);}
 for(const field of ['selectedSentence','fullSpiel']){
  const fresh=structuredClone(selected);fresh[field]+=' Changed primary context.';fresh.editorialPreview.sourceCheckedAt=checkedAt;
  const actual=retain([selected],[fresh],{fixtureOverrides,checkedAt})[0];assert.equal(actual[field],fresh[field]);assert.deepEqual(actual.editorialPreview,fresh.editorialPreview,'changed copy prevents old whole-preview restoration');
 }
 for(const mutate of [x=>x.id+='wrong',x=>x.competitionId='wrong',x=>x.participantIds.reverse(),x=>x.homeParticipantId=x.awayParticipantId,x=>x.startTimeUtc='2026-01-01T00:00:00Z',x=>x.status='live',x=>x.result={status:'completed',scorelineText:'Changed score'},x=>x.source.sourceUrl='https://example.com/new']){
  const altered=structuredClone(original);mutate(altered);assert.equal(retain([selected],[altered],{fixtureOverrides,checkedAt})[0],altered,'changed fixture/facts keep newly generated metadata');
 }
 for(const mutate of [x=>x.editorialPreview.angle='new research angle',x=>x.editorialPreview.evidenceReferences=[],x=>x.editorialPreview.sourceUrl='https://example.com/new']){
  const altered=structuredClone(original);mutate(altered);assert.notDeepEqual(retain([selected],[altered],{fixtureOverrides,checkedAt})[0].editorialPreview,selected.editorialPreview,'new/contrary research is not overwritten');
 }
 assert.throws(()=>retain([selected,selected],[original],{fixtureOverrides,checkedAt}),/Ambiguous/);
 const future=structuredClone(selected);future.editorialPreview.sourceCheckedAt='2099-01-01T00:00:00Z';assert.equal(retain([future],[original],{fixtureOverrides,checkedAt})[0].editorialPreview,original.editorialPreview);
 assert.deepEqual(retain(previous,next,{fixtureOverrides,checkedAt}),next,'unchanged metadata is idempotent');
 assert.equal(JSON.stringify({previous,incoming,fixtureOverrides}),baseline,'inputs immutable');
 return {retainedFields:expectations.filter(row=>row.from==='previous').length,freshFields:expectations.filter(row=>row.from==='incoming').length,events:next,negativeCases:15};
}
if(require.main===module){const result=validate(require('./fixtures/retained-canonical-metadata-20261023.json'));console.log('Canonical metadata: '+result.retainedFields+' retained fields and '+result.freshFields+' primary fields, actual changed-table/clock cases, identity/result/research refusals and idempotence passed.');}
module.exports=validate;
