'use strict';
const assert=require('node:assert/strict'),p=require('../config/editorial-maintenance');
assert(p.eligibility({count:1,mean:5,five_count:1}).eligible);
assert(!p.eligibility({count:5,mean:4.8,five_count:1}).eligible);
assert(p.eligibility({count:5,mean:4.80001}).eligible);
assert(p.eligibility({count:5,mean:3,five_count:2}).eligible);
assert(p.eligibility({count:5,mean:3,five_count:1,owner_five:true}).eligible);
assert(!p.eligibility({count:0,mean:5}).eligible);
const now=new Date('2026-10-02T00:00:00Z');
for(const [out,cadence] of [[14,5],[7,5],[6,2],[2,2],[1,1],[0,1]]){const date=p.plus(p.day(now),out),e={id:'fixture',date};assert.equal(p.schedule(e,{},now).cadenceDays,cadence);assert(p.schedule(e,{},now).due);}
assert(!p.schedule({id:'fixture',date:'2026-10-17'}, {},now).inWindow);
assert(!p.schedule({id:'fixture',date:'2026-10-02',startTimeUtc:'2026-10-01T23:59:59Z'}, {},now).due);
assert(!p.schedule({id:'fixture',date:'2026-10-04',status:'completed'}, {},now).due);
assert(!p.schedule({id:'fixture',date:'2026-10-04'}, {held:true},now).due);
assert(!p.schedule({id:'fixture',date:'2026-10-04'}, {held:true,pending_copy:{hook:'edited'}},now).due);
assert(p.schedule({id:'fixture',date:'2026-10-04'}, {held:false,pending_copy:{hook:'edited'},last_checked_at:now.toISOString()},now).due);
assert(!p.schedule({id:'evt_84',date:'2026-10-04'}, {},now).due);
assert(p.protectedFixture({canonicalEventId:'major-match:nrl-finals-2026:grand-final'}));
assert.equal(p.day('2026-10-03T14:00:00Z'),'2026-10-04');
assert.equal(p.day('2026-10-04T13:00:00Z'),'2026-10-05');
const a={hook:'one',formCopy:'two',closingCopy:'three',synopsis:'four'};assert(!p.equalCopy(a,{...a,formCopy:'changed'}));assert(!p.equalCopy(a,{...a,closingCopy:'changed'}));assert(p.equalCopy(a,{...a,hook:' one '}));
const w=require('./weekend-editorial'),facts=['form','consequence','matchup','history'].map(dimension=>({dimension,statement:'Source-backed '+dimension,sourceIndexes:[0]}));
const entry={id:'ok',title:'Fixture',hook:'Distinct hook',synopsis:'Distinct body',sources:['https://a.test','https://b.test','https://c.test'],facts,researchedAt:new Date().toISOString()};
const result=w.partitionResearch([{id:'bad'},{id:'ok'}],{entries:[entry]},()=>{});assert.equal(result.entries.length,1);assert.equal(result.deferred.length,1);
const publicationSteps=w.publicationSteps(['nrl'],['ok']);
assert.deepEqual(publicationSteps[0],['scripts/apply-editorial-narratives.js','--write','--major-events-only','--fixture-ids=ok'],'editorial updates must synchronise only selected researched Events children without rewriting unrelated cards');
assert.deepEqual(publicationSteps[1],['scripts/build-app-shell-runtime.js'],'cold saved pins must receive the same fresh editorial before validation');
assert(publicationSteps.some(step=>step[0]==='scripts/qa-storyline-spoilers.js'),'projection recovery must retain spoiler gates');
assert(publicationSteps.some(step=>step[0]==='scripts/validate-feed.js'),'projection recovery must retain shared Feed integrity');
const display=require('./lib/editorial-display-copy');
const fixture={id:'missing-preview',key:'tennis',name:'Player A v Player B',date:p.plus(p.day(now),1),status:'scheduled',storyline:{stakes:4}};
const card=(event=fixture,state={},selected=false)=>({event,state,selected,schedule:p.schedule(event,state,now)});
const select=(cards,published=[fixture])=>display.selectCards({cards},published,()=>false,now);
assert(display.needsDisplayCopy(fixture,now));
assert.equal(select([card()])[0].repairReason,'missing-required-display-copy');
assert.equal(select([card(fixture,{last_checked_at:now.toISOString()})]).length,1,'Missing copy overrides a successful check, not eligibility.');
assert.equal(select([card(fixture,{held:true})]).length,0);
assert.equal(select([card({...fixture,canonicalEventId:'major-match:nrl-finals-2026:grand-final'})]).length,0);
assert.equal(select([card({...fixture,status:'live'})]).length,0);
assert.equal(select([card({...fixture,status:'completed'})]).length,0);
assert.equal(select([card({...fixture,date:p.plus(p.day(now),15)})]).length,0);
assert.equal(select([card()],[]).length,0,'Repair cannot create coverage.');
const low={...fixture,storyline:{stakes:2}};assert.equal(select([card(low)],[low]).length,0);
const full={...fixture,selectedSentence:'Specific preview',fullSpiel:'Complete preview context'};assert(!display.needsDisplayCopy(full,now));assert.equal(select([card(full)],[full]).length,0);
const words=count=>Array(count).fill('word').join(' ');
const atLimit={...full,selectedSentence:words(25),fullSpiel:words(80)};
assert(!display.needsDisplayCopy(atLimit,now),'the shared 25/80 display limits remain inclusive');
for(const change of [{selectedSentence:words(26)},{fullSpiel:words(81)}]){
 const overlong={...full,...change};assert(display.needsDisplayCopy(overlong,now),'either spoiler state must satisfy the intact shared display limits');
 assert.equal(select([card(overlong,{last_checked_at:now.toISOString()})],[overlong]).length,1,'invalid display copy remains repairable after a recent successful check');
 assert.equal(select([card(overlong,{held:true})],[overlong]).length,0,'display length repair never overrides a hold');
 for(const blocked of [{status:'live'},{status:'completed'},{id:'evt_84'},{date:p.plus(p.day(now),15)}]){const stopped={...overlong,...blocked};assert.equal(select([card(stopped)],[stopped]).length,0,'display length repair retains kickoff, protection and horizon boundaries');}
}
for(const field of ['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']){const completed={...full,status:'completed',storyline:{stakes:4,hookSpoilerOff:'Safe hook',hookSpoilerOn:'Safe hook',synopsisSpoilerOff:'Safe context',synopsisSpoilerOn:'Safe context',[field]:words(field.startsWith('hook')?26:81)}};assert(display.needsDisplayCopy(completed,now),'both displayed completed spoiler states retain the shared length limits');assert.equal(select([card(completed)],[completed]).length,0,'post-match copy cannot enter the pre-kickoff repair owner');}
const staged={hook:'Retained hook',formCopy:'Retained form',closingCopy:'Retained storyline',synopsis:'Retained context'};
const checked={last_checked_at:now.toISOString(),staged_copy:staged};
assert.equal(select([card(full,checked,true)],[full])[0].repairReason,'unpublished-staged-copy','Recent checks must not conceal unpublished copy.');
assert.equal(select([card(full,checked,false)],[full]).length,0,'Retained copy cannot broaden real eligibility.');
assert.equal(select([card(full,{...checked,staged_copy:{hook:'Partial'}},true)],[full]).length,0);
assert.equal(select([card(full,{...checked,held:true},true)],[full]).length,0);
for(const change of [{status:'live'},{status:'completed'},{date:p.plus(p.day(now),15)},{id:'evt_84'}])assert.equal(select([card({...full,...change},checked,true)],[{...full,...change}]).length,0);
assert.equal(select([card(full,checked,true)],[]).length,0);
const servedStaged={...full,editorialNarrative:staged};
assert.equal(select([card(servedStaged,checked,true)],[servedStaged]).length,0,'Already served copy must not be rewritten before cadence.');
const retainedAlias={...full,id:'retained-alias',canonicalEventId:full.id};
assert.equal(select([card(retainedAlias,checked,true)],[full])[0].repairReason,'unpublished-staged-copy');
assert.deepEqual(display.baselineCopy(card(full,checked,true)),staged);
assert.deepEqual(display.baselineCopy(card(full,{...checked,pending_copy:a},true)),a,'Queued Owner copy remains the baseline.');
const alias={...fixture,id:'different-id',canonicalEventId:fixture.id};assert.equal(select([card(alias)]).length,1,'Canonical aliases resolve published gaps.');
assert.equal(select([card(full,{},true)],[full]).length,1,'Existing real-rating due selection remains unchanged.');
const completedFixture={...fixture,status:'completed',outcomeText:'Player A won',recapText:'Result recap'};
assert(!display.needsDisplayCopy(completedFixture,now));assert(!display.displayCopy(completedFixture,false,now).hook.includes('won'));

// Public source fixture, frozen at the failed capture clock; controls below are synthetic.
{
 const retained=JSON.parse(require('node:fs').readFileSync('scripts/fixtures/editorial-required-copy-20261114.json','utf8'));
 assert.equal(retained.schemaVersion,'editorial-required-copy-fixtures.v1');
 assert.equal(retained.source.commit,'7deeaa264a4707e58a9eba382303c2806412de59');
 assert.equal(retained.source.gitBlob,'21b741aa1729a6290bbb1a3c2e25a6560c464e41');
 assert.deepEqual(retained.events.map(event=>event.id),['evt_40','evt_41']);
 const clock=new Date(retained.capturedAt),syntheticSignals=[],syntheticStates=[];
 const make=(event,state={},selected=false)=>({event,state,selected,schedule:p.schedule(event,state,clock)});
 const choose=(cards,published)=>display.selectCards({cards,signals:syntheticSignals,states:syntheticStates},published,()=>false,clock);
 const emptyControlCards=retained.events.map(event=>make(event));
 for(const item of emptyControlCards){
  assert.equal(item.selected,false);assert(item.schedule.inWindow);
  for(const spoilers of [false,true]){
   const rendered=display.displayCopy(item.event,spoilers,clock);
   assert(rendered.hook&&rendered.synopsis,'the retained failure had non-empty fallback rendering');
   assert(rendered.hook.trim().split(/\s+/).length<=25&&rendered.synopsis.trim().split(/\s+/).length<=80);
  }
  assert(display.needsDisplayCopy(item.event,clock),'fallback rendering cannot conceal missing authored Hook/Context');
 }
 assert.deepEqual(choose(emptyControlCards,retained.events).map(item=>item.event.id),['evt_40','evt_41']);
 const independent={id:'synthetic-rugby-preview',key:'rugby',sport:'Rugby',name:'Synthetic North v Synthetic South',
  date:p.plus(p.day(clock),3),status:'scheduled',storyline:{stakes:4,hookSpoilerOff:'Rendered fallback',hookSpoilerOn:'Rendered fallback',
  synopsisSpoilerOff:'Rendered fallback context',synopsisSpoilerOn:'Rendered fallback context'}};
 const authored={hook:'Authored hook',formCopy:'Authored form',closingCopy:'Authored storyline',synopsis:'Authored context'};
 assert.equal(choose([make(independent)],[independent])[0].repairReason,'missing-required-display-copy','no fixture name, league or withheld flag is required');
 for(const missing of ['hook','synopsis']){
  const event={...independent,editorialNarrative:{...authored,[missing]:''}};
  assert.equal(choose([make(event)],[event]).length,1,'either missing authoritative display section is sufficient');
 }
 const complete={...independent,editorialNarrative:authored};
 assert.equal(choose([make(complete)],[complete]).length,0,'unrated complete copy is not selected');
 for(const missing of ['formCopy','closingCopy']){
  const event={...complete,editorialNarrative:{...authored,[missing]:''}};
  assert.equal(choose([make(event)],[event]).length,0,'non-display-only gaps do not broaden unrated repair authority');
 }
 const rawComplete={...independent,selectedSentence:authored.hook,fullSpiel:authored.synopsis,
  editorialPreview:{status:'withheld',needsPreviewRefresh:true}};
 assert.equal(choose([make(rawComplete)],[rawComplete]).length,0,'withheld/refresh flags alone cannot admit a complete raw preview');
 const recent={last_checked_at:clock.toISOString()};
 const recentGap=make(independent,recent);assert.equal(recentGap.schedule.due,false);
 assert.equal(choose([recentGap],[independent]).length,1,'required-copy repair is independent of cadence');
 const recentUnpublished=make(complete,{...recent,staged_copy:{...authored,hook:'Staged newer hook'}},true);
 assert.equal(recentUnpublished.schedule.due,false);
 assert.equal(choose([recentUnpublished],[complete])[0].repairReason,'unpublished-staged-copy');
 const aliased={...independent,id:'synthetic-alias',canonicalEventId:independent.id};
 assert.equal(choose([make(aliased)],[independent]).length,1,'served aliases retain required-copy repair');
 assert.equal(choose([make(independent,{held:true})],[independent]).length,0);
 assert.equal(choose([make(independent)],[]).length,0,'repair cannot create coverage');
 const locked={...independent,canonicalEventId:require('../config/editorial-locks').records[0].canonicalEventId};
 assert.equal(choose([make(locked)],[locked]).length,0,'existing editorial locks remain authoritative');
 for(const change of [
  {id:'evt_84'}, {canonicalEventId:'major-match:nrl-finals-2026:grand-final'},
  {storyline:{...independent.storyline,stakes:3}}, {status:'live'}, {status:'completed'},
  {date:p.plus(p.day(clock),-1)}, {date:p.plus(p.day(clock),15)},
  {date:p.day(clock),startTimeUtc:new Date(+clock-1).toISOString()},
 ]){
  const event={...independent,...change};
  assert.equal(choose([make(event)],[event]).length,0,'protection, stakes, kickoff and horizon guards remain intact');
 }
 const cricketEvent={...independent,id:'synthetic-cricket-preview',key:'cricket',sport:'Cricket',
  editorialNarrative:{editorialPolicyVersion:'cricket-editorial.v1',evidenceMode:'withheld',reviewed:true,
   phase:'preview',validUntil:new Date(+clock+86400000).toISOString()}};
 assert.equal(display.needsDisplayCopy(cricketEvent,clock),false,'reviewed cricket withholding remains complete under its existing policy');
 const incompleteCricket={...cricketEvent,editorialNarrative:{...cricketEvent.editorialNarrative,reviewed:false}};
 assert.equal(display.needsDisplayCopy(incompleteCricket,clock),true,'existing incomplete cricket handling is unchanged');
 assert.equal(choose([make(complete,{},true)],[complete]).length,1,'real-rating/request selection still enters its due path');
 const pending={...recent,pending_copy:{...authored,hook:'Queued Owner baseline'}};
 assert.deepEqual(display.baselineCopy(make(complete,pending,true)),pending.pending_copy);

 // Importing this existing helper in CI does not run main, crypto tests or service reads.
 const helper=require('./prepare-adaptive-editorial');
 const aliases=['evt_40','event:f1:2026:las-vegas:qualifying'];
 const group={event_id:'evt_40',aliases};
 const listed={id:'evt_40',pendingEdit:false,repairReason:'missing-required-display-copy',
  schedule:{held:false,protected:false,inWindow:true,due:false}};
 assert.equal(helper.canonicalAdmissionIssue(listed,'evt_40',aliases,group),null,'canonical membership, not due=true, admits a repair');
 assert.equal(helper.canonicalAdmissionIssue({...listed,repairReason:'unpublished-staged-copy'},'evt_40',aliases,group),null);
 assert.equal(helper.canonicalAdmissionIssue(null,'evt_40',aliases,group),'target-absent');
 assert.equal(helper.canonicalAdmissionIssue({...listed,schedule:{...listed.schedule,held:true}},'evt_40',aliases,group),'target-held');
 assert.equal(helper.canonicalAdmissionIssue({...listed,pendingEdit:true},'evt_40',aliases,group),'target-pending-edit','fresh queued Owner copy requires reconciliation');
 for(const candidate of [
  {id:'evt_40',repairReason:'missing-required-display-copy'},
  {...listed,id:'not-the-target'}, {...listed,pendingEdit:undefined},
  {...listed,schedule:{...listed.schedule,inWindow:false}},
  {...listed,schedule:{...listed.schedule,protected:true}},
 ])assert.equal(helper.canonicalAdmissionIssue(candidate,'evt_40',aliases,group),'noncanonical-admission');
 assert.equal(helper.canonicalAdmissionIssue(listed,'evt_40',aliases,{...group,aliases:['different']}),'noncanonical-admission');
 const failure=helper.privateFailure(Object.assign(Error('PRIVATE_SENTINEL_DO_NOT_EXPORT'),{preparationChildExit:1}),
  'canonical-inventory','list-child-failure',{listParsed:false,selectedCount:null,childSignal:'SIGTERM'});
 const binding={outcome:'failed-review-required',stage:'canonical-inventory'};
 helper.validatePrivateFailure(failure,binding);
 assert.equal(failure.childExit,1);assert.equal(failure.childSignal,'SIGTERM');
 assert(!JSON.stringify(failure).includes('PRIVATE_SENTINEL_DO_NOT_EXPORT'));
 assert.equal(failure.selectedCount,null,'failed parsing must not invent an inventory count');
 for(const mutation of [{extra:'unknown'},{substage:'PRIVATE_SENTINEL_DO_NOT_EXPORT'},{childExit:256},
  {childSignal:'PRIVATE_SENTINEL_DO_NOT_EXPORT'},{selectedCount:1001},{targetId:'private-account'},
  {sourceRevisionMatches:'false'},{reportMode:'invented'}])assert.throws(()=>helper.validatePrivateFailure({...failure,...mutation},binding));

 // A synthetic failed-list report remains diagnostic; its revision is never CAS authority.
 {
  const expectedRevision='a'.repeat(64),actualRevision='b'.repeat(64);
  const diagnostic=helper.privateFailure(null,'canonical-inventory','source-revision-mismatch',{
   listParsed:true,selectedCount:2,sourceRevisionMatches:false,horizonMatches:null,childExit:0});
  diagnostic.reportMode='list';
  diagnostic.listDiagnostic={sourceRevision:actualRevision,operations:[],runReadouts:[{mode:'list',status:'passed'}]};
  const expectedBinding={outcome:'failed-review-required',stage:'canonical-inventory',sourceRevision:expectedRevision};
  const returned={casReport:{sourceRevision:expectedRevision,operations:[]},casSql:'',selection:[],
   shellIdentity:{before:null,after:null},sourcePatch:'',newFiles:[],sourceChanges:[],failure:diagnostic};
  helper.validatePrivatePayload(returned,expectedBinding);
  assert.equal(returned.casReport.sourceRevision,expectedRevision);
  assert.equal(returned.failure.listDiagnostic.sourceRevision,actualRevision);
  for(const change of [
   {substage:'target-absent'},{sourceRevisionMatches:true},
   {listDiagnostic:{...diagnostic.listDiagnostic,sourceRevision:'invalid'}},
   {listDiagnostic:{...diagnostic.listDiagnostic,operations:[{}]}},
   {listDiagnostic:{...diagnostic.listDiagnostic,runReadouts:[{mode:'research'}]}},
  ])assert.throws(()=>helper.validatePrivatePayload({...returned,failure:{...diagnostic,...change}},expectedBinding));
  assert.throws(()=>helper.validatePrivatePayload({...returned,casSql:'prepared SQL is forbidden'},expectedBinding));
  assert.throws(()=>helper.validatePrivatePayload({...returned,casReport:{sourceRevision:actualRevision,operations:[]}},expectedBinding));
  assert.throws(()=>helper.validatePrivatePayload({...returned,casReport:{sourceRevision:expectedRevision,operations:[{}]}},expectedBinding));
  const researchFailure={...diagnostic,reportMode:'research',listDiagnostic:null};
  assert.throws(()=>helper.validatePrivatePayload({...returned,failure:researchFailure,casReport:{sourceRevision:actualRevision,operations:[]}},expectedBinding));
 }
 helper.validatePrivateFailure(null,{outcome:'prepared-review-required'});
 assert.throws(()=>helper.validatePrivateFailure(null,binding));
 for(const substage of ['list-json-invalid','source-revision-mismatch','horizon-mismatch','target-absent','target-held','target-pending-edit','noncanonical-admission']){
  const diagnostic=helper.privateFailure(null,'canonical-inventory',substage,{listParsed:true,selectedCount:2,
   sourceRevisionMatches:substage!=='source-revision-mismatch',horizonMatches:substage!=='horizon-mismatch',
   targetId:'evt_40',targetPresent:substage!=='target-absent',childExit:0});
  helper.validatePrivateFailure(diagnostic,binding);assert.equal(diagnostic.stage,'canonical-inventory');
 }
}
console.log('Adaptive editorial: real-only eligibility, cadence, holds, full-copy comparison, NRL protection, isolated failure and automatic required-copy repair passed.');
// Refreshing one fixture must not rewrite evidence retained by sibling projections.
const fs=require('node:fs'),narrative=require('./lib/editorial-narrative'),{apply}=require('./apply-fixture-research');
const knowledge=JSON.parse(fs.readFileSync('data/editorial-knowledge.v1.json','utf8'));
const researchEntry={...entry,id:'revision-fixture',title:'Revision fixture',researchDepth:5,
  hook:'A distinct fixture hook with independently sourced evidence.',
  synopsis:'This fixture has its own complete match context, supported by independently checked sources and kept separate from every sibling projection.',
  facts:facts.map(fact=>({...fact,statement:'Independently sourced fixture evidence about '+fact.dimension})),
  formCopy:'Source-backed form for this particular fixture.',
  closingCopy:'Source-backed history gives this fixture its own stakes.'};
const feed={events:[{id:researchEntry.id,key:'rugby',status:'scheduled'}]},major={events:[]};
apply(knowledge,feed,major,{entries:[researchEntry]});
const original=structuredClone(narrative.projectionForTarget(knowledge,'feed-event',{id:researchEntry.id}));
const sibling={...structuredClone(original),id:'projection:revision-sibling',targetIds:['revision-sibling'],hook:'A separate sibling keeps its independently established narrative.'};
knowledge.eventProjections.push(sibling);
const retained={sources:structuredClone(knowledge.sources),facts:structuredClone(knowledge.narrativeFacts),threads:structuredClone(knowledge.narrativeThreads)};
const refresh={...researchEntry,hook:'Updated fixture evidence leaves every sibling reference intact.',
  sources:[...researchEntry.sources,'https://d.test'],facts:researchEntry.facts.map(fact=>({...fact,sourceIndexes:[3]}))};
apply(knowledge,feed,major,{entries:[refresh]});
assert.deepEqual(narrative.validateKnowledge(knowledge),[]);
assert.deepEqual(knowledge.eventProjections.find(projection=>projection.id===sibling.id),sibling);
assert.equal(narrative.projectionForTarget(knowledge,'feed-event',{id:researchEntry.id}).id,original.id);
for(const [field,rows] of [['sources',retained.sources],['narrativeFacts',retained.facts],['narrativeThreads',retained.threads]])for(const row of rows)assert.deepEqual(knowledge[field].find(value=>value.id===row.id),row);
const counts=['subjects','sources','narrativeFacts','narrativeThreads','eventProjections'].map(field=>knowledge[field].length);
apply(knowledge,feed,major,{entries:[refresh]});
assert.deepEqual(['subjects','sources','narrativeFacts','narrativeThreads','eventProjections'].map(field=>knowledge[field].length),counts);
assert.deepEqual(narrative.validateKnowledge(knowledge),[]);
console.log('Adaptive provenance: immutable sibling evidence, stable projection identity and idempotent retries passed.');
