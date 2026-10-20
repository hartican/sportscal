'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const policy=require('../config/cricket-editorial-policy'),evidence=require('./lib/cricket-editorial-evidence');
const maintenance=require('../config/editorial-maintenance'),display=require('./lib/editorial-display-copy');
const fixture=require('./fixtures/cricket-editorial-policy-20261020').samples(),now=new Date(fixture.now);
const lifecycle=require('../config/editorial-lifecycle'),narrative=require('./lib/editorial-narrative');
const clone=structuredClone;
const good=fixture.cases[0],preview=fixture.cases[1],sparse=fixture.cases[2];
function checked(entry=good.entry,event=good.event){return evidence.issues(entry,event,now);}
for(const sample of fixture.cases)assert.deepEqual(checked(sample.entry,sample.event),[],sample.kind);
function rejected(mutate,pattern){const entry=clone(good.entry);mutate(entry);assert(checked(entry).some(error=>pattern.test(error)),checked(entry).join('\n'));}
rejected(e=>{e.sourceObservations[1].originId='Reuters syndicated';},/two independent/);
rejected(e=>{e.facts[0].support[1].basisId=e.facts[0].support[0].basisId;},/two independent/);
rejected(e=>{e.sourceObservations[1].reportingType='official-announcement';},/two independent/);
rejected(e=>{e.sourceObservations[0].publishedAt=null;},/Incomplete/);
rejected(e=>{e.sourceObservations[0].accessible=false;},/inaccessible/);
rejected(e=>{e.facts[0].agreement=true;e.facts[0].support[1].basisId=e.facts[0].support[0].basisId;},/Agreement/);
rejected(e=>{e.paragraphClaims.hook=[];},/sentence/);
rejected(e=>{e.facts[0].claimType='opinion';},/attribution/);
rejected(e=>{e.facts[0].claimType='disputed';e.facts[0].attribution='Reuters';},/contradictory/);
rejected(e=>{e.hook='“They wanted it more”, Boland said.';e.paragraphClaims.hook[0].text=e.hook;},/Quotation/);
for(const hook of ['Two reasonable ideas collide.','A team keeps moving its pieces.','A batting order chessboard.','Will they build a more dependable unit?'])rejected(e=>{e.hook=hook;e.paragraphClaims.hook[0].text=hook;},/Rejected/);
rejected(e=>{e.hook='South Africa 97/5 at Stumps.';},/structured/);
rejected(e=>{e.coverageThrough='2026-10-18T00:00:00.000Z';e.researchedAt=fixture.now;},/24 hours/);
rejected(e=>{e.researchUsage.articleReads=7;},/allowance/);
rejected(e=>{e.editorialReview.checks=['style'];},/Separate/);
rejected(e=>{e.hook='Unreviewed content.';},/Review must bind/);
rejected(e=>{e.facts[0].supersededAt=fixture.now;},/Superseded/);
const brief=clone(preview.entry);brief.evidenceMode='fact-brief';brief.sources=brief.sources.slice(0,1);brief.sourceObservations=brief.sourceObservations.slice(0,1);brief.facts=brief.facts.slice(0,2);brief.synopsis='';delete brief.paragraphClaims.synopsis;brief.editorialReview.contentSha256=evidence.reviewFingerprint(brief);assert.deepEqual(checked(brief,preview.event),[],'Attributed one-source brief');
assert.throws(()=>evidence.assertPublicationApproved([good.entry]),/sample approval is pending/);
const n={...good.entry,...evidence.metadata(good.entry)};
assert.equal(lifecycle.copy(good.event,n,true,now).hook,n.hook);
for(const status of ['live','stumps','suspended','interrupted','ongoing','break']){
 const event={...good.event,status},old={hook:'Legacy selection speculation',formCopy:'Neither is a confirmed selection.',synopsis:'Old match context',closingCopy:'Old storyline'};
 assert.equal(lifecycle.copy(event,old,true,now).formCopy||'','');
 assert.equal(lifecycle.copy(event,{...preview.entry,...evidence.metadata(preview.entry)},true,now).hook,'');
 assert.equal(lifecycle.copy(event,n,false,now).hook,'');
 assert.equal(lifecycle.copy(event,n,true,now).hook,n.hook);
}
assert.equal(lifecycle.copy({...good.event,status:'completed'},n,true,now).hook,'');
assert.equal(lifecycle.copy(good.event,n,true,new Date(n.validUntil)).hook,'');
assert.equal(lifecycle.copy({...good.event,sourceStale:true},n,true,now).hook,'');
assert.equal(lifecycle.copy(good.event,{...n,supersededAt:fixture.now},true,now).hook,'');
const p={...preview.entry,...evidence.metadata(preview.entry)};
assert.equal(lifecycle.copy(preview.event,p,false,now).hook,p.hook);
assert.equal(lifecycle.copy({...preview.event,status:'live'},p,false,now).hook,'');
const w={...sparse.entry,...evidence.metadata(sparse.entry)};
assert(maintenance.completeCopy(w));assert.equal(display.needsDisplayCopy({...sparse.event,editorialNarrative:w},now),false);
assert.equal(display.selectCards({cards:[{event:{...sparse.event,editorialNarrative:w},state:{},schedule:maintenance.schedule(sparse.event,{},now),selected:false}]},[{...sparse.event,editorialNarrative:w}],()=>false,now).length,0,'Withheld must not become a missing-copy loop');
assert.equal(maintenance.schedule(good.event,{},now).cadenceDays,1);assert(maintenance.schedule(good.event,{},now).inWindow);assert(!maintenance.schedule({...good.event,key:'rugby',sportKey:'rugby',sport:'Rugby Union',id:'fixture:rugby:qa'}, {},now).inWindow);
assert(maintenance.schedule(good.event,{held:true},now).held);assert(!maintenance.schedule(good.event,{held:true},now).due);
const {apply}=require('./apply-fixture-research');
for(const sample of fixture.cases){
 const k={schemaVersion:'editorial-knowledge.v2',updatedAt:fixture.now,subjects:[],sources:[],narrativeFacts:[],narrativeThreads:[],audienceMemories:[],eventProjections:[]};
 const before=clone(sample.event),feed={events:[clone(sample.event)]};
 const out=apply(k,feed,{events:[]},{entries:[sample.entry]},[],{now});
 assert.deepEqual(narrative.validateKnowledge(out.knowledge),[]);
 assert(require('./apply-editorial-narratives').projectionConforms(feed.events[0],out.knowledge.eventProjections[0],narrative.indexesFor(out.knowledge),now),'Reapplying a brief/withheld projection must not create content churn.');
 const publication=require('./lib/editorial-publication'),staged={event_id:feed.events[0].id,revision:0,staged_copy:maintenance.copy(feed.events[0])};
 assert.equal(publication.publicationPlan([staged],feed.events,feed.events,now).published.length,1);
 assert.equal(publication.publicationPlan([staged],feed.events,[{...feed.events[0],fullSpiel:'Old selection speculation'}],now).deferred.length,1,'Publication proof must reject resurrected root fallback.');
 for(const key of Object.keys(before).filter(key=>!['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline','sourceName','sourceUrl','sourceType','sourceCheckedAt'].includes(key)))assert.deepEqual(feed.events[0][key],before[key],key);
 for(const key of ['sourceName','sourceUrl','sourceType','sourceCheckedAt'])if(before[key]!=null)assert.deepEqual(feed.events[0][key],before[key],key+' provenance');
 const editorialIssues=require('./lib/feed-utils').validateFeed({schemaVersion:'events.v1',version:'cricket-policy-qa',publishedAt:fixture.now,events:feed.events}).filter(issue=>/editorial|copy contract/i.test(issue));assert.deepEqual(editorialIssues,[],'Public editorial validator accepts the sparse outcome.');
 const projected=feed.events[0].editorialNarrative;assert.equal(projected.phase,sample.entry.editorialPhase);assert(!('cricketEvidence' in projected));
 if(sample.kind==='attached-test'){assert(out.knowledge.sources.every(s=>s.sourceType==='reputable'));const changed=clone(out.knowledge);changed.sources[0].originId='Different agency';assert(narrative.validateKnowledge(changed).some(issue=>/provenance differs/.test(issue)));}
 const later=new Date('2026-11-30T00:00:00.000Z'),retained=apply(clone(out.knowledge),{events:[{...clone(sample.event),status:'completed'}]},{events:[]},{entries:[clone(sample.entry)]},[],{now:later});
 assert.equal(retained.feed.events[0].editorialNarrative.validUntil,sample.entry.validUntil,'Reprojection cannot freshen an old article.');
 assert.equal(lifecycle.copy(retained.feed.events[0],retained.feed.events[0].editorialNarrative,true,later).hook,'','Expired history must remain hidden without blocking fixture refresh.');
 const bad=clone(out.knowledge);bad.eventProjections[0].hook='Unreviewed replacement';assert(narrative.validateKnowledge(bad).some(issue=>/copy differs/.test(issue)));
}
const other={key:'rugby',status:'upcoming'},otherCopy={hook:'Rugby hook',synopsis:'Rugby context'};assert.deepEqual(lifecycle.copy(other,otherCopy,false,now),otherCopy);
const legacyKnowledge=JSON.parse(fs.readFileSync('data/editorial-knowledge.v1.json'));assert.deepEqual(narrative.validateKnowledge(legacyKnowledge),[]);
console.log('Cricket editorial policy: independent origins, shared evidence, attribution, review, budget, lifecycle, sparse outcomes, sporting-field preservation and legacy knowledge passed.');
