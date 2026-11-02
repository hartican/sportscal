#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const frozen=require('./fixtures/rlwc-tonga-samoa-reviewed-20261101.json');
const supplement=require('../data/canonical/follow-directory-supplement.v1.json');
const major=require('../config/major-events');
const catalogue=require('../data/major-events.v1.json');
const {normalizeRecord}=require('./build-follow-directories');
const inspector=require('./build-code-inspector');
const manifest=require('../data/code-inspector/manifest.json');
const id='major-match:rlwc-2026:tonga-samoa';
const teams=['team:nrl:national:tonga','team:nrl:national:samoa'];
const localDay=now=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;};
function checkCurrent(parent,projections,now){
 assert(parent&&parent.id==='major-event:rlwc-2026','declared tournament lifecycle required');
 assert.equal(parent.competitionId,'competition:rugby-league-world-cup:2026','rugby league competition required');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(parent.endDate),'tournament end required');
 const matches=(parent.subEvents||[]).filter(row=>row.id===id);assert(matches.length<=1,'duplicate fixture');
 const current=matches[0];
 if(!current){
  assert(localDay(now)>parent.endDate,'active tournament must retain the fixture');
  for(const rows of projections)assert(!rows.some(row=>row.id===id),'retired source must not leave a stale projection');
  return;
 }
 assert.deepEqual(current.participantIds,teams,'league identities must remain distinct');
 assert.equal(current.id,frozen.approvedSource.fixtureId,'reviewed fixture identity required');
 assert.equal(current.sourceUrl,frozen.approvedSource.sourceUrl,'approved fixture source required');
 assert.equal(current.sourceName,frozen.approvedSource.sourceName,'approved source name required');
 assert(Number.isFinite(Date.parse(current.sourceCheckedAt))&&Date.parse(current.sourceCheckedAt)<=+now,'genuine source observation required');
 assert(Number.isFinite(Date.parse(current.startTimeUtc))&&current.venue,'current reviewed timing and venue required');
 const fixture=major.fixtureFromSubEvent(current,parent);assert(fixture);assert.deepEqual(fixture.participantIds,teams);
 for(const rows of projections){const found=rows.filter(row=>row.id===id);assert.equal(found.length,1,'active source must have one projection');const projected=found[0];assert.deepEqual(projected.participantIds,teams);assert.equal(projected.startTimeUtc,new Date(current.startTimeUtc).toISOString());assert.equal(projected.venue,current.venue);}
 const article=major.editorialRecordForSubEvent(current,{...parent,editorialNarrative:{projectionId:'test',dimensions:[]}},[],fixture);assert(!article.editorialNarrative,'other teams must not inherit opener claim');
}
// Captured fixture is deliberately fixed; this never asserts that current facts cannot improve.
assert.equal(frozen.approvedSource.extractedFactsSha256,'46736403c358183e6bbeec1e0dfb15e471050e8290cfeb82c10ce9aa70694050');assert.equal(frozen.match.startTimeUtc,'2026-11-01T09:05:00.000Z');assert.equal(frozen.match.sourceCheckedAt,'2026-11-01T06:51:21.342326Z');
const frozenFixture=major.fixtureFromSubEvent(frozen.match,frozen.parent);assert.equal(frozenFixture.date,'2026-11-01');assert.equal(frozenFixture.time,'20:05');
const makeProjection=match=>inspector.normalizeFixture(match,'sport:nrl',{competitionId:frozen.parent.competitionId});
const corrected={...frozen.match,startTimeUtc:'2026-11-01T10:05:00.000Z',venue:'Reviewed alternate venue',sourceCheckedAt:'2026-11-01T07:30:00.000Z'};
const correctedParent={...frozen.parent,subEvents:[corrected]},correctedRows=[makeProjection(corrected)],later=new Date('2026-11-01T08:00:00Z');
checkCurrent(correctedParent,[correctedRows],later);
assert.throws(()=>checkCurrent(correctedParent,[[]],later),/active source/);
assert.throws(()=>checkCurrent({...correctedParent,competitionId:'competition:rugby-union'},[correctedRows],later),/rugby league/);
assert.throws(()=>checkCurrent({...correctedParent,subEvents:[{...corrected,sourceCheckedAt:null}]},[correctedRows],later),/observation/);
for(const sourceUrl of ['https://example.com/match-details/2578','https://www.intrl.sport/match-details/9999'])assert.throws(()=>checkCurrent({...correctedParent,subEvents:[{...corrected,sourceUrl}]},[correctedRows],later),/approved fixture source/);
for(const sourceName of [null,'Unrelated source'])assert.throws(()=>checkCurrent({...correctedParent,subEvents:[{...corrected,sourceName}]},[correctedRows],later),/approved source name/);
const retired={...frozen.parent,subEvents:[]};assert.throws(()=>checkCurrent(retired,[[]],later),/active tournament/);
checkCurrent(retired,[[]],new Date('2026-11-17T00:00:00Z'));
assert.throws(()=>checkCurrent(retired,[correctedRows],new Date('2026-11-17T00:00:00Z')),/stale projection/);
const records=(supplement.sports.nrl?.records||[]).filter(row=>teams.includes(row.id));assert.equal(records.length,2);
for(const [i,row] of records.entries()){const output=normalizeRecord(row,{sourceRefs:[supplement.sources['irl-rlwc-tonga-samoa-20261101']]});assert.equal(output.id,teams[i]);assert.equal(output.entityType,'team');assert.equal(output.teamKind,'national');assert.notEqual(output.id,'team:rugby:'+['tonga','samoa'][i]);}
const nrl=require('../data/follow-directory/nrl.v1.json'),search=require('../data/follow-directory/search.v1.json'),idColumn=search.fields.indexOf('id');
for(const team of teams){assert(nrl.records.some(row=>row.id===team&&row.entityType==='team'&&row.teamKind==='national'),'league team selectable');assert(search.records.some(row=>row[idColumn]===team),'league team searchable');}
const parent=catalogue.events.find(row=>row.id==='major-event:rlwc-2026');
const projected=inspector.codeFixtures(manifest.codes.find(code=>code.id==='sport:nrl'));
checkCurrent(parent,[projected,require('../data/code-inspector/nrl.json').fixtures,require('../data/follow-schedule/nrl.json').fixtures],new Date());
console.log('RLWC reviewed reference, current lifecycle, discovery and projections passed.');
