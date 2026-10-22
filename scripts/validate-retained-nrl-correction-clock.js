'use strict';
const assert=require('node:assert/strict');
function run(){
 const fixture=require('./fixtures/retained-nrl-correction-clock-20261022.json');
 const {applyOfficialNrlResultCorrections}=require('./refresh-canonical-sports');
 const next=applyOfficialNrlResultCorrections([fixture.match],fixture.observedSourceOperation,{previousEvents:[fixture.prior]});
 assert.equal(next.matches[0].resultSource.checkedAt,'2026-10-16T18:30:55.328Z','reused static NRL article keeps its original accepted observation');
 const baseline=JSON.stringify(fixture);
 const mutations=[
  p=>{p.id='event:nrl:wrong';},p=>{p.sourceId='wrong';},p=>{p.competitionId='wrong';},p=>{p.seasonLabel='2025';},
  p=>{p.roundNumber=11;},p=>{p.homeParticipantId=p.awayParticipantId;},p=>{p.participantIds.reverse();},
  p=>{p.startTimeUtc='2026-05-10T05:00:00.000Z';},p=>{p.displayName='Wrong matchup';},
  p=>{p.result.scorelineText='Storm v Wests Tigers — 44-18';},p=>{p.result.winnerParticipantId=p.awayParticipantId;},
  p=>{p.status='scheduled';},p=>{p.result.status='unknown';},p=>{p.result.source.sourceUrl='https://example.com/';},
  p=>{p.result.source.sourceType='reputable';},p=>{p.result.source.provider='Unverified';},
  p=>{p.result.source.checkedAt='2099-01-01T00:00:00Z';},p=>{p.result.source.checkedAt=null;},
  p=>{p.result.source.checkedAt='unknown';},p=>{p.result.source.checkedAt='2026-01-01T00:00:00Z';},
  p=>{p.result.source.checkedAt='2026-09-31T12:00:00Z';},p=>{p.result.source.checkedAt='2026-10-16';},
 ];
 for(const mutate of mutations){const prior=structuredClone(fixture.prior);mutate(prior);assert.throws(()=>applyOfficialNrlResultCorrections([fixture.match],fixture.observedSourceOperation,{previousEvents:[prior]}),/NRL official result correction/);}
 assert.throws(()=>applyOfficialNrlResultCorrections([fixture.match],fixture.observedSourceOperation),/qualified retained evidence/,'missing receipt cannot manufacture a new article observation');
 assert.throws(()=>applyOfficialNrlResultCorrections([fixture.match],fixture.observedSourceOperation,{previousEvents:[fixture.prior,fixture.prior]}),/qualified retained evidence/);
 assert.throws(()=>applyOfficialNrlResultCorrections([{...fixture.match,awaySquadScore:19}],fixture.observedSourceOperation,{previousEvents:[fixture.prior]}),/NRL official result correction/,'a new conflicting provider score is outside the reviewed static correction');
 for(const matchStatus of ['cancelled','postponed','live','unknown',null,undefined])assert.throws(()=>applyOfficialNrlResultCorrections([{...fixture.match,matchStatus}],fixture.observedSourceOperation,{previousEvents:[fixture.prior]}),/NRL official result correction/,'changed or missing primary status cannot be forced complete: '+matchStatus);
 const unrelated={matchId:999};assert.equal(applyOfficialNrlResultCorrections([unrelated],fixture.observedSourceOperation).matches[0],unrelated,'ordinary helper API stays unchanged outside the reviewed correction');
 assert.equal(JSON.stringify(fixture),baseline,'retained evidence and raw provider input remain unchanged');
 console.log('Retained NRL correction: original article observation,20 identity/score/source/clock refusals, missing/duplicate evidence, six primary-status refusals and unaffected helper API passed.');
}
if(require.main===module)run();
module.exports=run;
