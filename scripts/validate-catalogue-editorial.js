'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {apply}=require('./apply-fixture-research');
const {selected,weekend}=require('./weekend-editorial');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const knowledge=read('data/editorial-knowledge.v1.json');
const sample=read('data/editorial-zimbabwe-australia-2026-09-18.json').entries[0];
const id='fixture:regression:catalogue-editorial';
// Synthetic research needs distinct copy: production hooks are globally unique.
const entry={...sample,id,hook:'Catalogue-only regression coverage preserves editorial without changing main Feed admission.'};
const fixture={id,date:'2026-09-18',stakesScore:5,name:'Catalogue regression fixture'};
const result=apply(structuredClone(knowledge),{events:[]},{events:[]},{entries:[entry]},[fixture]);
assert.equal(result.feed.events.length,0,'Editorial cannot admit catalogue fixtures into the main feed.');
assert(result.knowledge.eventProjections.some(p=>p.targetIds.includes(id)&&p.hook===entry.hook),'Catalogue research must persist.');
assert.throws(()=>apply(structuredClone(knowledge),{events:[]},{events:[]},{entries:[entry]},[]),/Missing researched fixture/,'Unknown fixture IDs must still fail closed.');
assert.deepEqual(weekend(new Date('2026-09-18T01:00:00Z')),{from:'2026-09-18',to:'2026-09-21'});
assert.equal(selected([fixture,{...fixture,id:'monday',date:'2026-09-21'},{...fixture,id:'low',stakesScore:3},{...fixture,id:'tuesday',date:'2026-09-22'}],{from:'2026-09-18',to:'2026-09-21'}).length,2);
// Exercise the actual full-refresh call without writing any output.
apply(structuredClone(knowledge),read('feeds/incoming/events.json'),read('data/major-events.v1.json'),read('data/editorial-fixture-research.v1.json'),read('data/follow-sources/coverage.v1.json').events);
console.log('Catalogue editorial valid: catalogue-only targets supported, unknown IDs rejected, Feed admission preserved, Friday-Monday scope enforced.');

const preview=require('./lib/editorial-preview-quality');
const previewFixture={date:'2026-09-24',status:'upcoming',editorialPreview:{status:'research-required'},sourceTrust:'unverified'};
assert.equal(preview.editorialPreviewDue(previewFixture,5,new Date('2026-09-22T00:00:00Z')),false,'Unverified imports remain queued');
assert(preview.editorialPreviewIssues({...previewFixture,sourceTrust:'verified'},5,new Date('2026-09-22T00:00:00Z')).includes('missing-journalistic-status'),'Verified fixtures still fail without substantive editorial');
