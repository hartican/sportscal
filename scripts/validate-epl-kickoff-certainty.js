#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const certainty=require('./lib/epl-kickoff-certainty'),review=require('../data/canonical/epl-kickoff-certainty.v1.json'),policy=require('../config/fixture-reminder-policy'),identity=require('../config/fixture-identity'),{normalizeFixture}=require('./build-code-inspector'),{overlaySnapshots}=require('../lib/live-fixtures');
const events=require('../feeds/incoming/events.json').events.filter(e=>e.competitionId===review.competitionId),baseline=structuredClone(events),now=Date.parse(review.observedAt);
assert.equal(events.length,380);
const qualified=events.map(e=>certainty.qualify(e)),upcoming=qualified.filter(e=>e.status==='upcoming'),confirmed=upcoming.filter(e=>e.scheduleStatus==='confirmed'),pending=upcoming.filter(e=>e.scheduleStatus==='provisional');
assert.equal(upcoming.length+qualified.filter(e=>e.status==='completed').length,380);
for(let i=0;i<events.length;i++){
 for(const field of ['id','eventId','canonicalEventId','participantIds','homeParticipantId','awayParticipantId','date','time','startTimeUtc','status','homeScore','awayScore','viewingOptions','sourceCheckedAt','canonicalSourceCheckedAt','resultSourceCheckedAt'])assert.deepEqual(qualified[i][field],events[i][field],field+' is preserved');
 assert.deepEqual(certainty.qualify(qualified[i]),qualified[i],'unchanged qualification is stable');
}
assert.deepEqual(events,baseline,'the source inputs are never mutated');
for(const e of pending){const projected=normalizeFixture(e,'sport:football');assert.equal(projected.timePrecision,'estimated');assert.equal(projected.scheduleStatus,'provisional');assert.equal(projected.scheduleNote,certainty.provisionalNote);assert.equal(policy.timing(identity.normalizeCore(e),now),null,'unreviewed future clocks cannot schedule a reminder');assert(require('../config/card-timing').presentation(e,new Date(now)).time.startsWith('APPROX.'));}
for(const e of confirmed){assert.equal(e.timePrecision,'exact');const p=normalizeFixture(e,'sport:football');assert.equal(p.timingProvenance.sourceUrl,e.timingProvenance.sourceUrl);assert.equal(p.timingProvenance.checkedAt,review.observedAt);}
// Controlled replay of the dated seventy reviewed matches. Current provider
// completion/rescheduling is allowed to advance without freezing a QA count.
const controlled=review.fixtures.map(row=>certainty.qualify({...baseline.find(f=>String(f.canonicalSourceId||f.canonicalEventId?.split(':').at(-1)||f.id.split('-').at(-1))===String(row.sourceFixtureId)),status:'upcoming',roundNumber:row.roundNumber,participantIds:row.participantIds,startTimeUtc:row.startTimeUtc,timeTbc:false,startTimeTbc:false}));
assert.equal(controlled.length,70);assert(controlled.every(e=>e.scheduleStatus==='confirmed'&&policy.timing(identity.normalizeCore(e),now)),'all seventy dated reviewed clocks remain eligible in the controlled replay');
const e=controlled[0];
for(const mutation of [{startTimeUtc:new Date(Date.parse(e.startTimeUtc)+3600000).toISOString()},{participantIds:[...e.participantIds].reverse()},{roundNumber:38}]){const changed=certainty.qualify({...e,...mutation});assert.equal(changed.scheduleStatus,'provisional','a changed fact cannot borrow older confirmation');assert.equal(changed.timingProvenance,undefined);}
for(const status of ['postponed','cancelled','abandoned','live'])assert.deepEqual(certainty.qualify({...e,status}),{...e,status},'source stop/live state remains authoritative');
assert.deepEqual(certainty.qualify({...e,competitionId:'other'}),{...e,competitionId:'other'});assert.deepEqual(certainty.qualify({...e,season:'2027/28'}),{...e,season:'2027/28'});
const edited={...pending[0],selectedSentence:'Owner-reviewed custom preview.',sourceCheckedAt:'2026-10-03T12:00:00.000Z'};assert.equal(certainty.qualify(edited).selectedSentence,edited.selectedSentence);
const manualOff={followFirst:{notifications:{autoRemindersEnabled:true}}},actions={[identity.canonicalFixtureId(e.id)]:{reminderChoice:'off'}};assert.equal(policy.intent(e,manualOff,actions).enabled,false,'explicit OFF survives qualification');
for(const edit of [r=>r.fixtures.pop(),r=>r.fixtures.push(structuredClone(r.fixtures[0])),r=>r.fixtures[0].sourceUrl='https://example.com/not-official',r=>r.observedAt='2099-01-01T00:00:00.000Z']){
 const bad=structuredClone(review);edit(bad);assert.throws(()=>certainty.validate(bad),'malformed review cannot be used');
}
const reversed=structuredClone(review);reversed.fixtures[0].participantIds.reverse();assert.equal(certainty.qualify(e,{review:reversed}).scheduleStatus,'provisional','a structurally valid mismatched identity cannot verify the original match');
assert.equal(certainty.qualify({...e,timeTbc:true}).scheduleStatus,'provisional','explicit uncertain timing wins over a reviewed-looking timestamp');
// A stale stored source with identical clocks must not restore false certainty
// while the ordinary source owner has not yet published its new interpretation.
const unreviewed=certainty.qualify({...baseline.find(f=>f.roundNumber===13),status:'upcoming',startTimeUtc:'2026-12-02T20:00:00.000Z'});
const old={...unreviewed,scheduleStatus:'confirmed',timePrecision:'exact',scheduleNote:undefined},before=JSON.stringify(old);
const overlaid=overlaySnapshots([unreviewed],[{source_id:'live-premier-league',checked_at:'2026-10-03T12:10:00.000Z',fixtures:[old]}]);assert.equal(overlaid[0].scheduleStatus,'provisional');assert.equal(overlaid[0].timePrecision,'estimated');assert.equal(JSON.stringify(old),before);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-epl-certainty-'));
try{
 fs.mkdirSync(path.join(root,'feeds/incoming'),{recursive:true});fs.mkdirSync(path.join(root,'data'));
 for(const file of ['feeds/incoming/events.json','data/events.json'])fs.writeFileSync(path.join(root,file),JSON.stringify({events:[...baseline,{id:'unrelated',status:'upcoming'}]})+'\n');
 const first=certainty.applyRetained({root});assert(first.every(r=>r.changed>=0));const saved=fs.readFileSync(path.join(root,'data/events.json'));const document=JSON.parse(saved);assert.deepEqual(document.events.at(-1),{id:'unrelated',status:'upcoming'});assert.equal(document.events.length,381);assert(certainty.applyRetained({root}).every(r=>r.changed===0));assert.deepEqual(fs.readFileSync(path.join(root,'data/events.json')),saved,'actual file rerun changes no bytes');
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`EPL scheduling certainty: ${confirmed.length} currently reviewed upcoming / ${pending.length} provisional / ${qualified.filter(e=>e.status==='completed').length} completed; 70 dated controlled confirmations, identity, clocks, OFF, changed facts, old live overlays and actual writer reruns preserved.`);
