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

 // Real helper return-composition functions with synthetic I/O, not a second crypto run.
 {
  const expectedRevision='d'.repeat(64),flags={listParsed:true,selectedCount:2,sourceRevisionMatches:true,horizonMatches:true};
  const base={casReport:{sourceRevision:expectedRevision,operations:[]},casSql:'',selection:[],shellIdentity:{before:null,after:null}};
  const digest='c'.repeat(64),seen=()=>({afterKind:'regular',afterBytes:7,afterSha256:digest,hashStatus:'verified',hashBudgetChargedBytes:7});
  const run=(raw,{primary=null,observe=seen,sourceResult=null,casFailure=false,diagnosticLimits={}}={})=>{
   let statusReads=0,sourceCalls=0,casCalls=0;
   const context=helper.captureContext(()=>{statusReads++;return raw;},diagnosticLimits);
   const payload=helper.composeReviewReturn(base,{primary,flags,context,report:null,mode:'research',observe,
    captureSource:()=>{sourceCalls++;for(const [index,row] of helper.captureRows(context).entries())helper.strictSourceEntry(row,index);
     return sourceResult||{sourcePatch:'synthetic allowed patch',newFiles:[],sourceChanges:[]};},
    captureCAS:()=>{casCalls++;if(casFailure)throw Error('PRIVATE_CAS_SENTINEL');return 'synthetic allowed SQL';}});
   return {payload,context,statusReads,sourceCalls,casCalls};
  };
  const rejected=run(' M data/chat-fixtures.v1.json\0');
  assert.equal(rejected.sourceCalls,1);assert.equal(rejected.casCalls,0);assert.equal(rejected.statusReads,1);
  assert.equal(rejected.payload.failure.stage,'capture-source');
  const detail=rejected.payload.failure.returnCapture;
  assert.equal(detail.phase,'capture-source');assert.equal(detail.failureCode,'strict-source-rejection');
  assert.equal(detail.sourceDisposition,'omitted-on-capture-failure');assert.equal(detail.casDisposition,'omitted-on-capture-failure');
  assert.equal(detail.statusReadComplete,true);assert.equal(detail.totalChangedCount,1);assert.equal(detail.returnedEntryCount,1);
  assert.equal(detail.entries[0].path,'data/chat-fixtures.v1.json');assert.equal(detail.entries[0].status,' M');
  assert.equal(detail.entries[0].afterSha256,digest);assert.equal(detail.entries[0].hashStatus,'verified');
  assert.equal(rejected.payload.sourcePatch,'');assert.deepEqual(rejected.payload.newFiles,[]);assert.deepEqual(rejected.payload.sourceChanges,[]);
  assert.deepEqual(rejected.payload.casReport,{sourceRevision:expectedRevision,operations:[]});assert.equal(rejected.payload.casSql,'');
  const failedBinding={sourceRevision:expectedRevision,outcome:'failed-review-required',stage:'capture-source'};
  helper.validatePrivatePayload(rejected.payload,failedBinding);
  for(const change of [{sourcePatch:'forbidden patch'},{newFiles:[{path:'data/events.json',bodyBase64:'e30='}]},
   {sourceChanges:[{}]},{casSql:'forbidden SQL'},{casReport:{sourceRevision:expectedRevision,operations:[{}]}}])
   assert.throws(()=>helper.validatePrivatePayload({...rejected.payload,...change},failedBinding));
  assert.throws(()=>helper.validatePrivatePayload(rejected.payload,{...failedBinding,outcome:'prepared-review-required'}));
  const primary=helper.privateFailure(Error('PRIVATE_SHELL_SENTINEL'),'verify-shell-after','preparation-failure',flags);
  const earlier=run(' M data/chat-fixtures.v1.json\0',{primary});
  assert.equal(earlier.payload.failure.stage,'verify-shell-after');assert.equal(earlier.payload.failure.substage,'preparation-failure');
  assert.equal(earlier.payload.failure.returnCapture.phase,'capture-source');
  assert(!JSON.stringify(earlier.payload).includes('PRIVATE_SHELL_SENTINEL'));
  helper.validatePrivatePayload(earlier.payload,{...failedBinding,stage:'verify-shell-after'});
  const normal=run(' M data/events.json\0');
  assert.equal(normal.sourceCalls,1);assert.equal(normal.casCalls,1);assert.equal(normal.statusReads,1);
  assert.equal(normal.payload.failure,null);assert.equal(normal.payload.sourcePatch,'synthetic allowed patch');assert.equal(normal.payload.casSql,'synthetic allowed SQL');
  const casRejected=run(' M data/events.json\0',{casFailure:true});
  assert.equal(casRejected.sourceCalls,1);assert.equal(casRejected.casCalls,1);assert.equal(casRejected.statusReads,1);
  assert.equal(casRejected.payload.failure.stage,'capture-cas');assert.equal(casRejected.payload.casSql,'');assert.equal(casRejected.payload.sourcePatch,'');
  assert(!JSON.stringify(casRejected.payload).includes('PRIVATE_CAS_SENTINEL'));
  const deletion=run(' D data/feed/page-001.json\0',{observe:()=>({afterKind:'absent',afterBytes:null,afterSha256:null,hashStatus:'deleted',hashBudgetChargedBytes:0})});
  assert.equal(deletion.payload.failure.returnCapture.entries[0].hashStatus,'deleted');
  assert.equal(deletion.payload.failure.returnCapture.entries[0].afterSha256,null,'deletion is not the hash of empty bytes');
  assert.equal(deletion.casCalls,0,'deletions remain forbidden for publication');
  const renamed=run('R  data/events.json\0data/old-events.json\0');
  assert.equal(renamed.payload.failure.returnCapture.entries[0].originalPath,'data/old-events.json');
  assert.equal(renamed.payload.failure.returnCapture.entries[0].path,'data/events.json');assert.equal(renamed.casCalls,0);
  const unknown=run(' M data/chat-fixtures.v1.json');
  assert.equal(unknown.payload.failure.returnCapture.statusReadComplete,false);
  assert.equal(unknown.payload.failure.returnCapture.totalChangedCount,null);assert.equal(unknown.payload.failure.returnCapture.truncated,true);
  const limited=run(Array.from({length:129},(_,index)=>' M data/feed/page-'+index+'.json\0').join(''),{diagnosticLimits:{entries:128}});
  assert.equal(limited.statusReads,1);assert.equal(limited.payload.failure.returnCapture.returnedEntryCount,128);
  assert.equal(limited.payload.failure.returnCapture.totalChangedCount,null);assert.equal(limited.payload.failure.returnCapture.truncated,true);
  const readFailed=run(' M data/chat-fixtures.v1.json\0',{observe:()=>{throw Error('PRIVATE_READ_SENTINEL');}});
  assert.equal(readFailed.payload.failure.returnCapture.statusReadComplete,true);
  assert.equal(readFailed.payload.failure.returnCapture.totalChangedCount,1);
  assert.equal(readFailed.payload.failure.returnCapture.entries[0].hashStatus,'read-failed');
  assert.equal(readFailed.payload.failure.returnCapture.hashBudgetChargedBytes,32*1024*1024,'an unknown hash failure conservatively exhausts the additional read budget');
  const exceeded=run(' M data/chat-fixtures.v1.json\0',{observe:()=>({afterKind:'regular',afterBytes:32*1024*1024+1,afterSha256:null,hashStatus:'budget-exceeded',hashBudgetChargedBytes:0})});
  assert.equal(exceeded.payload.failure.returnCapture.entries[0].hashStatus,'budget-exceeded');
  let unsafeReads=0;
  const unsafe=run(' M ../escape.json\0',{observe:()=>{unsafeReads++;return seen();}});
  assert.equal(unsafeReads,0);assert.equal(unsafe.payload.failure.returnCapture.totalChangedCount,null);
  assert(!JSON.stringify(unsafe.payload).includes('../escape.json'));
  let opens=0,lstats=0;
  const symlink=helper.observeDiagnosticEntry({path:'data/chat-fixtures.v1.json'},1024,{
   realpathSync:file=>file,lstatSync:()=>({isSymbolicLink:()=>true}),openSync:()=>{opens++;throw Error('must not follow');}});
  assert.equal(opens,0);assert.equal(symlink.afterKind,'symlink');assert.equal(symlink.hashStatus,'not-read');
  const escapedParent=helper.observeDiagnosticEntry({path:'data/chat-fixtures.v1.json'},1024,{
   realpathSync:()=>'/outside',lstatSync:()=>{lstats++;throw Error('must not inspect escaped child');},openSync:()=>{opens++;}});
  assert.equal(lstats,0);assert.equal(opens,0);assert.equal(escapedParent.hashStatus,'not-read');
  const cached=helper.captureContext(()=> ' M data/chat-fixtures.v1.json\0');helper.captureRows(cached);
  Object.assign(cached.entries[0],{beforeBlob:'e'.repeat(40),afterKind:'regular',afterBytes:7,afterSha256:digest,hashStatus:'verified'});
  let rehashes=0;const reused=helper.captureInventory(cached,()=>{rehashes++;return seen();});
  assert.equal(rehashes,0);assert.equal(reused.entries[0].beforeBlob,'e'.repeat(40));assert.equal(reused.hashBudgetChargedBytes,0);

 // Diagnostic capacity is separate from the unchanged publication/body limits.
 {
  const limits=helper.diagnosticCapacityLimits,basis=helper.diagnosticCapacityBasis;
  assert.deepEqual(basis.cardinalities,{trackedPaths:3833,feedRows:1855,finalsFixtures:20,usOpenSubEvents:957,majorEvents:8,codeDefinitions:38,postingSlotsPerEventUpper:2});
  assert.equal(basis.bound.sourceItemsUpper,2*1855+20+957+8);
  assert.equal(basis.bound.newImagePathsUpper,2*basis.bound.sourceItemsUpper);
  assert.equal(basis.bound.feedPagePathsUpper,1+Math.ceil((1855-1)/20));
  assert.equal(limits.entries,3833+9390+94+25+2*38);assert.equal(limits.entries,13418);
  assert.equal(limits.statusBytes,8*1024*1024);assert.equal(limits.metadataBytes,16*1024*1024);
  assert.equal(limits.pathCharacters,240);assert.equal(limits.hashBudgetBytes,32*1024*1024);assert.equal(limits.fileBytes,32*1024*1024);
  assert(13418*485<=limits.statusBytes,'complete two-path status sizing is bounded independently of hashes');
  assert(13418*744+128*1024+4096<=limits.metadataBytes,'compact worst-case entry, readout and header fit the private diagnostic bound');
  const full=run(Array.from({length:129},(_,index)=>' M data/feed/page-'+index+'.json\0').join(''));
  assert.equal(full.statusReads,1);assert.equal(full.sourceCalls,1);assert.equal(full.casCalls,0);
  const inventory=full.payload.failure.returnCapture;
  assert.equal(inventory.totalChangedCount,129);assert.equal(inventory.returnedEntryCount,129);
  assert.equal(inventory.statusReadComplete,true);assert.equal(inventory.truncated,false);
  assert.equal(inventory.sourceDisposition,'omitted-on-capture-failure');
  helper.validatePrivatePayload(full.payload,{...failedBinding,stage:full.payload.failure.stage});
  assert.equal(helper.strictSourceEntry(' M data/events.json',127),'data/events.json');
  assert.throws(()=>helper.strictSourceEntry(' M data/events.json',128),'publication129 is still forbidden');
  const normalBase={casReport:{sourceRevision:expectedRevision,operations:[]},casSql:'',selection:[],shellIdentity:{before:null,after:null},sourcePatch:'',newFiles:[],sourceChanges:[],failure:null};
  const preparedBinding={sourceRevision:expectedRevision,outcome:'prepared-review-required',stage:'capture-source'};
  assert.throws(()=>helper.validatePrivatePayload({...normalBase,sourceChanges:Array(129).fill({})},preparedBinding));
  assert.throws(()=>helper.validatePrivatePayload({...normalBase,newFiles:Array(129).fill({})},preparedBinding));
  let boundaryReads=0;
  const exact=helper.captureContext(()=>{boundaryReads++;return ' M data/feed/page-1.json\0 M data/feed/page-2.json\0';},{entries:2});
  assert.equal(helper.captureRows(exact).length,2);helper.captureInventory(exact,seen);assert.equal(boundaryReads,1);assert.equal(exact.totalChangedCount,2);
  const over=helper.captureContext(()=> ' M data/feed/page-1.json\0 M data/feed/page-2.json\0 M data/feed/page-3.json\0',{entries:2});
  assert.throws(()=>helper.captureRows(over));const partial=helper.captureInventory(over,seen);
  assert.equal(partial.totalChangedCount,null);assert.equal(partial.returnedEntryCount,2);assert.equal(partial.truncated,true);
  const twoPath='R  '+'n'.repeat(240)+'\0'+'o'.repeat(240)+'\0';assert.equal(Buffer.byteLength(twoPath),485);
  const exactBytes=helper.captureContext(()=>twoPath,{entries:1,statusBytes:485});helper.captureRows(exactBytes);
  assert.equal(exactBytes.entries[0].path,'n'.repeat(240));assert.equal(exactBytes.entries[0].originalPath,'o'.repeat(240));
  const overBytes=helper.captureContext(()=>twoPath,{entries:1,statusBytes:484});assert.throws(()=>helper.captureRows(overBytes));
  assert.equal(overBytes.totalChangedCount,null);assert.equal(overBytes.truncated,true);
  assert.throws(()=>helper.captureContext(()=>'',{entries:limits.entries+1}));
  assert.throws(()=>helper.captureContext(()=>'',{statusBytes:limits.statusBytes+1}));
  const spent=run(' M data/chat-fixtures.v1.json\0 M data/feed/page-1.json\0 M data/feed/page-2.json\0',{
   observe:(_entry,remaining)=>remaining===limits.hashBudgetBytes?
    {afterKind:'regular',afterBytes:limits.hashBudgetBytes,afterSha256:digest,hashStatus:'verified',hashBudgetChargedBytes:limits.hashBudgetBytes}:
    {afterKind:'regular',afterBytes:1,afterSha256:null,hashStatus:'budget-exceeded',hashBudgetChargedBytes:0}});
  assert.equal(spent.payload.failure.returnCapture.totalChangedCount,3);
  assert.equal(spent.payload.failure.returnCapture.statusReadComplete,true);
  assert.equal(spent.payload.failure.returnCapture.truncated,false);
  assert.equal(spent.payload.failure.returnCapture.hashBudgetChargedBytes,32*1024*1024);
  assert.deepEqual(spent.payload.failure.returnCapture.entries.map(row=>row.hashStatus),['verified','budget-exceeded','budget-exceeded']);
  helper.validatePrivatePayload(spent.payload,{...failedBinding,stage:spent.payload.failure.stage});
  const metadata=basis.pins.map(pin=>({...pin}));
  while(metadata.length<basis.cardinalities.trackedPaths)metadata.push({path:'synthetic-basis/'+metadata.length,mode:'100644',gitBlob:'0'.repeat(40)});
  const capacityDigest=helper.verifyDiagnosticBasisRows(metadata);
  assert.equal(inventory.capacityBasisSha256,capacityDigest);
  assert.throws(()=>helper.verifyDiagnosticBasisRows(metadata.slice(1)),'tracked cardinality drift invalidates the basis');
  const wrongData=metadata.map(row=>row.path==='data/major-events.v1.json'?{...row,gitBlob:'0'.repeat(40)}:row);
  assert.throws(()=>helper.verifyDiagnosticBasisRows(wrongData),'changed input data requires reviewed recomputation');
  const missingWriter=metadata.map(row=>row.path==='scripts/build-marquee-candidates.js'?{...row,path:'synthetic-missing-writer'}:row);
  assert.throws(()=>helper.verifyDiagnosticBasisRows(missingWriter),'changed writer closure cannot reuse an old capacity');
  assert.throws(()=>helper.validatePrivatePayload({...full.payload,failure:{...full.payload.failure,returnCapture:{...inventory,capacityBasisSha256:'0'.repeat(64)}}},{...failedBinding,stage:full.payload.failure.stage}));
 }

  for(const result of [casRejected,deletion,renamed,unknown,limited,readFailed,exceeded,unsafe])
   helper.validatePrivatePayload(result.payload,{...failedBinding,stage:result.payload.failure.stage});
  for(const change of [{totalChangedCount:0},{returnedEntryCount:129},{sourceDisposition:'complete'},
   {entries:[{...detail.entries[0],path:'/absolute'}]},{entries:[{...detail.entries[0],afterKind:'symlink'}]},
   {entries:[{...detail.entries[0],OwnerText:'PRIVATE_OWNER_SENTINEL'}]}])
   assert.throws(()=>helper.validatePrivatePayload({...rejected.payload,failure:{...rejected.payload.failure,returnCapture:{...detail,...change}}},failedBinding));
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

// Private collection/codec checks use tiny synthetic source data and native streams only.
async function validatePrivateSourceCollection(){
 const helper=require('./prepare-adaptive-editorial'),crypto=require('node:crypto'),zlib=require('node:zlib');
 const {Readable}=require('node:stream'),{EventEmitter}=require('node:events');
 const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),limits=helper.reviewCaptureLimits;
 assert.equal(limits.entries,202);assert.equal(limits.newFiles,128);assert.equal(limits.newCount,97);
 assert.equal(limits.newBytes,10*1024*1024);assert.equal(limits.trackedBytes,128*1024*1024);
 assert.equal(limits.rawPatchBytes,272*1024*1024);assert.equal(limits.compressedPatchBytes,12*1024*1024);assert.equal(limits.metadataBytes,2*1024*1024);
 const sample=Buffer.from('synthetic private patch\n'),codec=await helper.encodeReviewPatch(Readable.from([sample]));
 assert.deepEqual(zlib.gunzipSync(Buffer.from(codec.bodyBase64,'base64')),sample,'emitted framing is standard single-member gzip');
 const recovered=[];await helper.decodeReviewPatch(codec,chunk=>recovered.push(Buffer.from(chunk)));assert.deepEqual(Buffer.concat(recovered),sample);

 // Synthetic large-valid resource falsifier: retain MiB scale if it exposes a codec/Base64 failure.
 const largeSynthetic=crypto.randomBytes(1024*1024),largeExpectedSha=digest(largeSynthetic);
 const largeInput=Readable.from([largeSynthetic]);let largeInputEof=false;
 largeInput.once('end',()=>{largeInputEof=true;});
 const largeCodec=await helper.encodeReviewPatch(largeInput);
 assert.equal(largeInputEof,true);assert.equal(largeInput.readableEnded,true);assert.equal(largeInput.read(),null,'encoder consumed input through EOF');
 assert.equal(largeCodec.decodedBytes,largeSynthetic.length);assert.equal(largeCodec.decodedSha256,largeExpectedSha);
 assert(largeCodec.decodedBytes<=limits.rawPatchBytes&&largeCodec.compressedBytes<=limits.compressedPatchBytes);
 assert(largeCodec.bodyBase64.length>=1024*1024,'high-entropy synthetic data must exercise a MiB-scale Base64 string');
 let largeDecodedBytes=0;const largeDecodedHash=crypto.createHash('sha256');
 const largeDecoded=await helper.decodeReviewPatch(largeCodec,chunk=>{
  assert(largeDecodedBytes+chunk.length<=largeSynthetic.length,'decoder must not deliver bytes beyond expected EOF');
  assert.deepEqual(chunk,largeSynthetic.subarray(largeDecodedBytes,largeDecodedBytes+chunk.length));
  largeDecodedHash.update(chunk);largeDecodedBytes+=chunk.length;
 });
 assert.equal(largeDecodedBytes,largeSynthetic.length,'decoder delivered the complete payload through EOF');
 assert.equal(largeDecodedHash.digest('hex'),largeExpectedSha);
 assert.deepEqual(largeDecoded,{bytes:largeSynthetic.length,sha256:largeExpectedSha},'actual decoder completed with exact count/digest and no missing or trailing output');


 // Larger synthetic resource falsifier stays below raw272MiB/gzip12MiB patch caps; it is not a new-file payload.
 const tenMiBSynthetic=crypto.randomBytes(10*1024*1024+1),tenMiBExpectedSha=digest(tenMiBSynthetic);
 const tenMiBInput=Readable.from([tenMiBSynthetic]);let tenMiBInputEof=false;
 tenMiBInput.once('end',()=>{tenMiBInputEof=true;});
 const tenMiBCodec=await helper.encodeReviewPatch(tenMiBInput);
 assert.equal(tenMiBInputEof,true);assert.equal(tenMiBInput.readableEnded,true);assert.equal(tenMiBInput.read(),null,'larger encoder consumed input through EOF');
 assert.equal(tenMiBCodec.decodedBytes,10*1024*1024+1);assert.equal(tenMiBCodec.decodedSha256,tenMiBExpectedSha);
 assert(tenMiBCodec.decodedBytes<=limits.rawPatchBytes&&tenMiBCodec.compressedBytes<=limits.compressedPatchBytes);
 assert(tenMiBCodec.bodyBase64.length>=10*1024*1024,'high-entropy valid codec must exercise at least10MiB of Base64 text');
 const tenMiBGzip=Buffer.from(tenMiBCodec.bodyBase64,'base64');
 assert.equal(tenMiBGzip.length,tenMiBCodec.compressedBytes);
 assert.equal(tenMiBGzip.readUInt32LE(tenMiBGzip.length-8),zlib.crc32(tenMiBSynthetic)>>>0,'final gzip CRC equals complete synthetic input');
 assert.equal(tenMiBGzip.readUInt32LE(tenMiBGzip.length-4),tenMiBSynthetic.length,'final gzip ISIZE equals complete synthetic input');
 let tenMiBDecodedBytes=0;const tenMiBDecodedHash=crypto.createHash('sha256');
 const tenMiBDecoded=await helper.decodeReviewPatch(tenMiBCodec,chunk=>{
  assert(tenMiBDecodedBytes+chunk.length<=tenMiBSynthetic.length,'larger decoder must not deliver bytes beyond expected EOF');
  assert.deepEqual(chunk,tenMiBSynthetic.subarray(tenMiBDecodedBytes,tenMiBDecodedBytes+chunk.length));
  tenMiBDecodedHash.update(chunk);tenMiBDecodedBytes+=chunk.length;
 });
 assert.equal(tenMiBDecodedBytes,tenMiBSynthetic.length,'larger decoder delivered all bytes through EOF');
 assert.equal(tenMiBDecodedHash.digest('hex'),tenMiBExpectedSha);
 // Actual decodeReviewPatch returns only after its native consumed-input EOF and CRC/ISIZE assertions.
 assert.deepEqual(tenMiBDecoded,{bytes:tenMiBSynthetic.length,sha256:tenMiBExpectedSha},'actual larger decoder completed exact count/digest, consumed EOF and trailer checks');

 const empty=await helper.encodeReviewPatch(Readable.from([]));await helper.decodeReviewPatch(empty);
 const binary=Buffer.from(Array.from({length:256},(_,index)=>index));
 const binaryCodec=await helper.encodeReviewPatch(Readable.from([binary]));const binaryRecovered=[];
 await helper.decodeReviewPatch(binaryCodec,chunk=>binaryRecovered.push(Buffer.from(chunk)));assert.deepEqual(Buffer.concat(binaryRecovered),binary);
 await helper.encodeReviewPatch(Readable.from([sample]),{rawBytes:sample.length});
 await assert.rejects(()=>helper.encodeReviewPatch(Readable.from([sample]),{rawBytes:sample.length-1}));
 await helper.encodeReviewPatch(Readable.from([sample]),{compressedBytes:codec.compressedBytes});
 await assert.rejects(()=>helper.encodeReviewPatch(Readable.from([sample]),{compressedBytes:codec.compressedBytes-1}));
 for(const mutation of [{encoding:'other'},{decodedSha256:'0'.repeat(64)},{compressedSha256:'0'.repeat(64)},
  {decodedBytes:sample.length+1},{compressedBytes:codec.compressedBytes+1},{decodedBytes:limits.rawPatchBytes+1},{extra:'not-allowed'}])
  await assert.rejects(()=>helper.decodeReviewPatch({...codec,...mutation}));
 const reframe=bytes=>({...codec,compressedBytes:bytes.length,compressedSha256:digest(bytes),bodyBase64:bytes.toString('base64')});
 const encoded=Buffer.from(codec.bodyBase64,'base64');
 await assert.rejects(()=>helper.decodeReviewPatch(reframe(encoded.subarray(0,-1))),'truncated gzip is refused');
 await assert.rejects(()=>helper.decodeReviewPatch(reframe(Buffer.concat([encoded,encoded]))),'native raw-inflate consumption refuses a second gzip member');
 await assert.rejects(()=>helper.decodeReviewPatch(reframe(Buffer.concat([encoded,Buffer.from([0,0,0])]))),'trailing bytes are refused');
 const crc=Buffer.from(encoded);crc[crc.length-8]^=1;await assert.rejects(()=>helper.decodeReviewPatch(reframe(crc)));
 const size=Buffer.from(encoded);size[size.length-4]^=1;await assert.rejects(()=>helper.decodeReviewPatch(reframe(size)));
 const header=Buffer.from(encoded);header[3]=8;await assert.rejects(()=>helper.decodeReviewPatch(reframe(header)));
 const bomb=await helper.encodeReviewPatch(Readable.from([Buffer.alloc(32768,65)]));let delivered=0;
 await assert.rejects(()=>helper.decodeReviewPatch({...bomb,decodedBytes:8},chunk=>{delivered+=chunk.length;}));
 assert.equal(delivered,0,'inflation is bounded before consumer delivery, not only by the gzip trailer');
 let spawns=0,argumentsSeen;
 const fakeSpawn=(_command,args,options)=>{
  spawns++;argumentsSeen={args,options};const child=new EventEmitter();child.stdout=Readable.from([sample]);
  child.stdout.once('end',()=>queueMicrotask(()=>child.emit('close',0,null)));return child;
 };
 const tracked=Array.from({length:105},(_,index)=>'data/feed/page-'+index+'.json');
 const streamed=await helper.captureReviewGitPatch({},'1'.repeat(40),tracked,'2'.repeat(64),{spawnImpl:fakeSpawn});
 assert.equal(spawns,1);assert.equal(argumentsSeen.options.shell,false);assert.equal(argumentsSeen.options.killSignal,'SIGKILL');
 for(const flag of ['diff','--binary','--full-index','--unified=3','--no-ext-diff','--no-textconv','--no-renames'])assert(argumentsSeen.args.includes(flag));
 assert(argumentsSeen.args.includes('1'.repeat(40)));assert(!argumentsSeen.args.includes('HEAD'));
 await helper.decodeReviewPatch(streamed);
 let aborted=false,timeoutSpawns=0;
 const hangingSpawn=(_command,_args,options)=>{timeoutSpawns++;const child=new EventEmitter();child.stdout=new Readable({read(){}});
  options.signal.addEventListener('abort',()=>{aborted=true;child.stdout.destroy(Error('synthetic abort'));child.emit('close',null,'SIGKILL');},{once:true});return child;};
 await assert.rejects(()=>helper.captureReviewGitPatch({},'1'.repeat(40),tracked,'2'.repeat(64),{spawnImpl:hangingSpawn,deadlineMs:10}));
 assert.equal(aborted,true);assert.equal(timeoutSpawns,1,'failure never creates another Git diff');

 let delayedChild,delayedSpawns=0,delayedKills=0,errorNotified=false,delayedClosed=false;
 const delayedCloseSpawn=(_command,_args,options)=>{
  delayedSpawns++;delayedChild=new EventEmitter();delayedChild.stdout=new Readable({read(){}});
  delayedChild.kill=signal=>{assert.equal(signal,'SIGKILL');delayedKills++;return true;};
  options.signal.addEventListener('abort',()=>delayedChild.stdout.destroy(),{once:true});
  queueMicrotask(()=>{errorNotified=true;delayedChild.emit('error',Object.assign(Error('synthetic abort notification'),{name:'AbortError',code:'ABORT_ERR'}));});
  return delayedChild;
 };
 let delayedSettled=false;
 const delayedCapture=helper.captureReviewGitPatch({},'1'.repeat(40),tracked,'2'.repeat(64),{spawnImpl:delayedCloseSpawn,deadlineMs:1000,closeWaitMs:1000});
 delayedCapture.then(()=>{delayedSettled=true;},()=>{delayedSettled=true;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(errorNotified,true);assert.equal(delayedSettled,false,'AbortError notification is not evidence of actual child close');
 assert.equal(delayedSpawns,1);assert.equal(delayedKills,1,'operation failure explicitly kills the same owned child');
 delayedClosed=true;delayedChild.emit('close',null,'SIGKILL');
 await assert.rejects(()=>delayedCapture,error=>error.privatePatchCode==='patch-stream-failure');
 assert.equal(delayedClosed,true);assert.equal(delayedSettled,true);assert.equal(delayedSpawns,1);

 let neverCloseSpawns=0,neverCloseKills=0;
 const neverCloseSpawn=(_command,_args,options)=>{
  neverCloseSpawns++;const child=new EventEmitter();child.stdout=new Readable({read(){}});
  child.kill=signal=>{assert.equal(signal,'SIGKILL');neverCloseKills++;return true;};
  options.signal.addEventListener('abort',()=>child.stdout.destroy(),{once:true});
  queueMicrotask(()=>child.emit('error',Error('synthetic missing close')));
  return child;
 };
 await assert.rejects(()=>helper.captureReviewGitPatch({},'1'.repeat(40),tracked,'2'.repeat(64),{spawnImpl:neverCloseSpawn,deadlineMs:1000,closeWaitMs:10}),
  error=>error.privatePatchCode==='patch-cleanup-unobserved'&&error.childCloseObserved===false&&error.cleanupStatus==='unknown');
 assert.equal(neverCloseSpawns,1);assert.equal(neverCloseKills,1,'missing close is a bounded explicit unknown, never another diff child');

 let failedStreamChild,failedStreamSpawns=0,failedStreamKills=0,failedStreamAborted=false,failedStreamSettled=false;
 const failedStreamSpawn=(_command,_args,options)=>{
  failedStreamSpawns++;failedStreamChild=new EventEmitter();failedStreamChild.stdout=new Readable({read(){}});
  failedStreamChild.kill=signal=>{assert.equal(signal,'SIGKILL');failedStreamKills++;return true;};
  options.signal.addEventListener('abort',()=>{failedStreamAborted=true;},{once:true});
  queueMicrotask(()=>failedStreamChild.stdout.destroy(Error('synthetic stream failure')));
  return failedStreamChild;
 };
 const failedStreamCapture=helper.captureReviewGitPatch({},'1'.repeat(40),tracked,'2'.repeat(64),{spawnImpl:failedStreamSpawn,deadlineMs:1000,closeWaitMs:1000});
 failedStreamCapture.then(()=>{failedStreamSettled=true;},()=>{failedStreamSettled=true;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(failedStreamAborted,true);assert.equal(failedStreamSettled,false,'stream rejection and abort do not substitute for actual close');
 assert.equal(failedStreamSpawns,1);assert.equal(failedStreamKills,1);
 failedStreamChild.emit('close',null,'SIGKILL');
 await assert.rejects(()=>failedStreamCapture,error=>error.privatePatchCode==='patch-stream-failure');
 assert.equal(failedStreamSettled,true);assert.equal(failedStreamSpawns,1);

 let spawnErrorChild,spawnErrorSpawns=0,spawnErrorKills=0,spawnErrorSettled=false;
 const spawnErrorThenClose=(_command,_args,options)=>{
  spawnErrorSpawns++;spawnErrorChild=new EventEmitter();spawnErrorChild.stdout=new Readable({read(){}});
  spawnErrorChild.kill=signal=>{assert.equal(signal,'SIGKILL');spawnErrorKills++;return false;};
  options.signal.addEventListener('abort',()=>spawnErrorChild.stdout.destroy(),{once:true});
  queueMicrotask(()=>spawnErrorChild.emit('error',Object.assign(Error('synthetic spawn failure'),{code:'ENOENT'})));
  return spawnErrorChild;
 };
 const spawnErrorCapture=helper.captureReviewGitPatch({},'1'.repeat(40),tracked,'2'.repeat(64),{spawnImpl:spawnErrorThenClose,deadlineMs:1000,closeWaitMs:1000});
 spawnErrorCapture.then(()=>{spawnErrorSettled=true;},()=>{spawnErrorSettled=true;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(spawnErrorSettled,false,'spawn error alone is not an observed close');
 assert.equal(spawnErrorSpawns,1);assert.equal(spawnErrorKills,1);
 spawnErrorChild.emit('close',-2,null);
 await assert.rejects(()=>spawnErrorCapture,error=>error.privatePatchCode==='patch-stream-failure');
 assert.equal(spawnErrorSettled,true);assert.equal(spawnErrorSpawns,1);



 const dateReport='data/editorial-adaptive-report-2026-11-14.json',tree=new Map(),bodies=new Map(),oldPages=Array.from({length:36},(_,index)=>({path:'data/feed/page-'+String(index+1).padStart(3,'0')+'.json'}));
 const beforeBlob='b'.repeat(40),mark=file=>tree.set(file,{path:file,mode:'100644',gitBlob:beforeBlob});
 helper.reviewFixedPaths.forEach(file=>{mark(file);bodies.set(file,Buffer.from('{}'));});mark('data/feed/manifest.json');oldPages.forEach(page=>mark(page.path));
 const beforeManifest={pages:oldPages},afterManifest={pages:oldPages.slice(0,33)};
 const beforeArtifact={candidates:[]},afterArtifact={generatedAt:'2026-11-14T00:00:00.000Z',candidates:[]};
 const jpeg=Buffer.from([255,216,255,217]);
 for(let index=0;index<96;index++){
  const id='marquee_'+index.toString(16).padStart(16,'0'),contentHash='a'.repeat(64),relative='assets/marquee/'+id+'-'+contentHash.slice(0,12)+'.jpg';
  const image={path:'/'+relative,publicUrl:'https://nothingsport.vercel.app/'+relative};
  afterArtifact.candidates.push({campaignId:id,contentHash,assets:{fallbackHero:image,suggestedHeroes:[image]},drafts:{email:{image},instagram:{image},live:{hero:image}},live:{hero:image}});bodies.set(relative,jpeg);
 }
 for(let index=100;index<154;index++){
  const id='marquee_'+index.toString(16).padStart(16,'0'),file='assets/marquee/'+id+'-'+'c'.repeat(12)+'.jpg';mark(file);
  beforeArtifact.candidates.push({campaignId:id,timing:{endTimeUtc:'2026-11-13T00:00:00.000Z'}});
 }
 oldPages.slice(0,33).forEach(page=>bodies.set(page.path,Buffer.from('{}')));bodies.set(dateReport,Buffer.from('{}'));
 bodies.set('data/feed/manifest.json',Buffer.from(JSON.stringify(afterManifest)));bodies.set('data/marquee-candidates.v1.json',Buffer.from(JSON.stringify(afterArtifact)));
 const entries=[...helper.reviewFixedPaths.map(file=>({path:file,status:' M',originalPath:null})),{path:dateReport,status:'??',originalPath:null},
  {path:'data/feed/manifest.json',status:' M',originalPath:null},...oldPages.map((page,index)=>({path:page.path,status:index<33?' M':' D',originalPath:null})),
  ...[...bodies.keys()].filter(file=>file.startsWith('assets/marquee/')).map(file=>({path:file,status:'??',originalPath:null})),
  ...[...tree.keys()].filter(file=>file.startsWith('assets/marquee/')).map(file=>({path:file,status:' D',originalPath:null}))];
 assert.equal(entries.length,202);helper.reviewStatusShape(entries);
 const syntheticScope=helper.reviewStatusDigest(entries,tree);helper.assertReviewStatusDigest(entries,tree,syntheticScope);
 assert.throws(()=>helper.assertReviewStatusDigest(entries,tree),'synthetic fixtures are not the approved actual snapshot');
 assert.throws(()=>helper.assertReviewStatusDigest(entries.map((row,index)=>index===0?{...row,path:'data/different.json'}:row),tree,syntheticScope));
 helper.deriveReviewClosure(entries,tree,beforeManifest,afterManifest,beforeArtifact,afterArtifact,dateReport);
 assert.throws(()=>helper.reviewStatusShape([...entries,{path:'data/unexpected.json',status:'??',originalPath:null}]));
 const forbidden=entries.map((row,index)=>index===0?{...row,path:'service-worker.js'}:row);assert.throws(()=>helper.reviewStatusShape(forbidden));
 const changedStatus=entries.map((row,index)=>index===0?{...row,status:' D'}:row);assert.throws(()=>helper.reviewStatusShape(changedStatus));
 const orphan=entries.map(row=>row.path===afterArtifact.candidates[0].assets.fallbackHero.path.slice(1)?{...row,path:'assets/marquee/marquee_ffffffffffffffff-ffffffffffff.jpg'}:row);
 assert.throws(()=>helper.deriveReviewClosure(orphan,tree,beforeManifest,afterManifest,beforeArtifact,afterArtifact,dateReport),'a matching filename pattern alone is not a source reference');
 const unrecovered=new Map(tree);unrecovered.delete([...tree.keys()].find(file=>file.startsWith('assets/marquee/')));
 assert.throws(()=>helper.deriveReviewClosure(entries,unrecovered,beforeManifest,afterManifest,beforeArtifact,afterArtifact,dateReport),'every captured removal requires its baseline recovery object');
 const missing=new Map(bodies);missing.delete('data/marquee-candidates.v1.json');let bodyReads=0;
 const io={readFile:file=>{bodyReads++;assert(bodies.has(file));return bodies.get(file);},
  beforeJson:file=>file==='data/feed/manifest.json'?beforeManifest:beforeArtifact,
  beforeSizes:rows=>new Map(rows.map(row=>[row.path,{blob:tree.get(row.path).gitBlob,bytes:13}])),isAbsent:file=>!bodies.has(file)};
 const rawStatus=entries.map(row=>row.status+' '+row.path+'\0').join('');let statusReads=0;
 const context=helper.captureContext(()=>{statusReads++;return rawStatus;});
 const source=helper.collectReviewSources({},context,tree,dateReport,io);assert.equal(statusReads,1);assert.equal(source.sourceChanges.length,202);assert.equal(source.newFiles.length,97);
 assert.equal(source.sourceChanges.filter(row=>row.status==='deleted').length,57);
 assert(source.sourceChanges.filter(row=>row.status==='deleted').every(row=>row.beforeBlob===beforeBlob&&row.beforeBytes===13&&row.afterSha256===null&&row.bytes===null));
 const scopeSha=helper.reviewScopeDigest(source.sourceChanges);assert.equal(scopeSha,helper.reviewScopeDigest([...source.sourceChanges].reverse()),'scope join is independent of metadata row order');
 const patch={schemaVersion:'ns.editorial-source-patch.v1',disposition:'private-review-only',scopeSha256:scopeSha,...codec};
 const reservedShell={"version":"613","htmlVersion":"613","workerVersion":"613","cacheVersion":"613","files":[{"path":"app-version.json","bytes":18,"sha256":"e166e53fb8bd478d7cb5437c8e54c3a984764cd430a36a863f6569365719357e"},{"path":"index.html","bytes":997335,"sha256":"2dec08dca491fd65e6ab1b15f72bed2dd23f547558f1c27eb736ef45ae75ee02"},{"path":"service-worker.js","bytes":29224,"sha256":"a5bf8f778c4450ebfe684947f3397ae59a6d140705c3ff2e66476defc8107957"}]};
 const revision='d'.repeat(64),payload={casReport:{sourceRevision:revision,operations:['evt_40','evt_41'].map(eventId=>({eventId,expectedRevision:1,change:{last_checked_at:'2026-11-14T00:00:00.000Z'}}))},
  casSql:'synthetic prepared CAS only',selection:[],shellIdentity:{before:structuredClone(reservedShell),after:structuredClone(reservedShell)},...source,sourcePatch:patch,failure:null};
 const binding={sourceRevision:revision,outcome:'prepared-review-required',stage:'capture-source'};helper.validatePrivatePayload(payload,binding);
 assert.throws(()=>helper.validatePrivatePayload({...payload,sourceChanges:[...payload.sourceChanges,payload.sourceChanges[0]]},binding));
 assert.throws(()=>helper.validatePrivatePayload({...payload,shellIdentity:{...payload.shellIdentity,after:{...reservedShell,version:'614'}}},binding));
 const wrongShell=structuredClone(reservedShell);wrongShell.files[1].sha256='0'.repeat(64);
 assert.throws(()=>helper.validatePrivatePayload({...payload,shellIdentity:{before:reservedShell,after:wrongShell}},binding));
 assert.throws(()=>helper.validatePrivatePayload({...payload,newFiles:[...payload.newFiles,payload.newFiles[0]]},binding));
 assert.throws(()=>helper.validatePrivatePayload({...payload,sourcePatch:{...patch,disposition:'publication-accepted'}},binding));
 assert.throws(()=>helper.validatePrivatePayload({...payload,sourcePatch:{...patch,scopeSha256:'0'.repeat(64)}},binding));
 assert.throws(()=>helper.strictSourceEntry(' M data/events.json',128));assert.throws(()=>helper.strictSourceEntry(' D data/feed/page-034.json',0));
 const nonPrivate={...payload,sourcePatch:''};assert.throws(()=>helper.validatePrivatePayload(nonPrivate,binding),'legacy/default128 cannot admit this202 collection');
 const metaBytes=helper.reviewMetadataBytes(payload),padding='q'.repeat(limits.metadataBytes-metaBytes);
 const exactMeta={...payload,casSql:payload.casSql+padding};helper.validatePrivatePayload(exactMeta,binding);
 assert.throws(()=>helper.validatePrivatePayload({...exactMeta,casSql:exactMeta.casSql+'q'},binding));
 const tooManyNew=source.sourceChanges.map(row=>({...row})),firstNew=tooManyNew.find(row=>row.status==='new');firstNew.bytes=limits.newBytes;
 assert.throws(()=>helper.validateReviewRecords(tooManyNew));
 const tooMuchTracked=source.sourceChanges.map(row=>({...row}));tooMuchTracked.filter(row=>row.status==='modified').slice(0,5).forEach(row=>{row.beforeBytes=32*1024*1024;});
 assert.throws(()=>helper.validateReviewRecords(tooMuchTracked));
 let unsafeIO=0;assert.throws(()=>helper.readReviewFile('../private-key',{realpathSync:()=>{unsafeIO++;}}));assert.equal(unsafeIO,0);
 let opened=0;assert.throws(()=>helper.readReviewFile('data/events.json',{realpathSync:file=>file,lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>true,size:1,mode:0o100644}),openSync:()=>{opened++;}}));assert.equal(opened,0);
 assert.throws(()=>helper.readReviewFile('data/events.json',{realpathSync:file=>file,lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:32*1024*1024+1,mode:0o100644}),openSync:()=>{opened++;}}));assert.equal(opened,0);
 let rejectedReads=0;const invalidContext=helper.captureContext(()=>[...entries,{path:'data/unexpected.json',status:'??'}].map(row=>row.status+' '+row.path+'\0').join(''));
 assert.throws(()=>helper.collectReviewSources({},invalidContext,tree,dateReport,{...io,readFile:()=>{rejectedReads++;return Buffer.from('{}');}}));assert.equal(rejectedReads,0);
 const absentRecovery=helper.captureContext(()=>rawStatus);
 assert.throws(()=>helper.collectReviewSources({},absentRecovery,tree,dateReport,{...io,isAbsent:()=>false}),'private metadata must not claim a file was absent when it exists');

 assert.deepEqual(helper.packagingLimits,{plaintextBytes:32*1024*1024,envelopeBytes:48*1024*1024});
 let encryptCalls=0,lastPlaintext;
 const fakeEncrypt=bytes=>{encryptCalls++;lastPlaintext=bytes;return {synthetic:'not-a-cryptographic-return'};};
 const fakeOptions={encrypt:fakeEncrypt},packaged=helper.packageReturnEnvelope(payload,binding,'synthetic-unused-key',fakeOptions);
 assert.equal(encryptCalls,1);assert(lastPlaintext.every(byte=>byte===0),'plaintext buffer cleared after packaging');
 assert.equal(JSON.parse(packaged).synthetic,'not-a-cryptographic-return');
 const revisionBad={...payload,casReport:{...payload.casReport,sourceRevision:'e'.repeat(64)}};
 assert.throws(()=>helper.packageReturnEnvelope(revisionBad,binding,'unused',fakeOptions),error=>error.privatePackagingCode==='packaging-cas-revision');
 assert.equal(encryptCalls,1,'invalid CAS revision is rejected before encryption');
 assert.throws(()=>helper.packageReturnEnvelope({...payload,casReport:{...payload.casReport,unexpected:true}},binding,'unused',fakeOptions),error=>error.privatePackagingCode==='packaging-cas-shape');
 assert.throws(()=>helper.packageReturnEnvelope({...payload,casReport:{...payload.casReport,operations:[payload.casReport.operations[0],payload.casReport.operations[0]]}},binding,'unused',fakeOptions),error=>error.privatePackagingCode==='packaging-cas-targets');
 assert.throws(()=>helper.packageReturnEnvelope({...payload,newFiles:[]},binding,'unused',fakeOptions),error=>error.privatePackagingCode==='packaging-review-new-files');
 const jsonBoundaryEncryptCalls=encryptCalls;
 // Full private metadata is serialized by its intact contract guard before envelope JSON.
 assert.throws(()=>helper.packageReturnEnvelope({...payload,selection:[1n]},binding,'unused',fakeOptions),error=>error.privatePackagingCode==='packaging-review-metadata');
 assert.equal(encryptCalls,jsonBoundaryEncryptCalls,'private metadata rejection occurs before encryption');
 // A valid default/string-patch envelope reaches the separate JSON-packaging boundary.
 const jsonFailureFixture={...payload,sourcePatch:'',sourceChanges:[],newFiles:[],selection:[1n]};
 helper.validatePrivatePayload(jsonFailureFixture,binding);
 assert.throws(()=>helper.packageReturnEnvelope(jsonFailureFixture,binding,'unused',fakeOptions),error=>error.privatePackagingCode==='packaging-json');
 assert.equal(encryptCalls,jsonBoundaryEncryptCalls,'JSON serialization rejection occurs before encryption');
 const plainBytes=Buffer.byteLength(JSON.stringify(payload));
 helper.packageReturnEnvelope(payload,binding,'unused',{...fakeOptions,plaintextLimit:plainBytes});
 assert.throws(()=>helper.packageReturnEnvelope(payload,binding,'unused',{...fakeOptions,plaintextLimit:plainBytes-1}),error=>error.privatePackagingCode==='packaging-plaintext');
 helper.packageReturnEnvelope(payload,binding,'unused',{...fakeOptions,envelopeLimit:Buffer.byteLength(packaged)});
 assert.throws(()=>helper.packageReturnEnvelope(payload,binding,'unused',{...fakeOptions,envelopeLimit:Buffer.byteLength(packaged)-1}),error=>error.privatePackagingCode==='packaging-envelope');
 const secret='synthetic-private-value-must-not-escape';
 assert.throws(()=>helper.packageReturnEnvelope(payload,binding,'unused',{encrypt:()=>{throw Error(secret);}}),
  error=>error.privatePackagingCode==='packaging-encryption'&&!error.message.includes(secret)&&error.cause===undefined);
 assert.throws(()=>helper.packageReturnEnvelope(payload,binding,'unused',{...fakeOptions,plaintextLimit:helper.packagingLimits.plaintextBytes+1}));
 assert.throws(()=>helper.packageReturnEnvelope(payload,binding,'unused',{...fakeOptions,envelopeLimit:helper.packagingLimits.envelopeBytes+1}));

 const packagingFlags={listParsed:true,selectedCount:2,sourceRevisionMatches:true,horizonMatches:true,targetId:'evt_41',targetPresent:true,childExit:null,childSignal:null};
 const readsBeforeFallback={statusReads,bodyReads},fallback=helper.packagingFailurePayload(binding,null,packagingFlags,'packaging-cas-revision',context,revisionBad.casReport,'research');
 assert.deepEqual(fallback.casReport,{sourceRevision:binding.sourceRevision,operations:[]},'invalid report revision never becomes fallback authority');
 assert.equal(fallback.casSql,'');assert.equal(fallback.sourcePatch,'');assert.deepEqual(fallback.newFiles,[]);assert.deepEqual(fallback.sourceChanges,[]);
 assert.equal(fallback.failure.returnCapture.phase,'return-packaging');assert.equal(fallback.failure.returnCapture.failureCode,'packaging-cas-revision');
 assert.equal(fallback.failure.returnCapture.sourceDisposition,'omitted-on-packaging-failure');assert.equal(fallback.failure.returnCapture.casDisposition,'omitted-on-packaging-failure');
 assert.equal(fallback.failure.returnCapture.totalChangedCount,202);assert.equal(fallback.failure.returnCapture.readout,null,'invalid or missing aggregate stays unknown');
 assert.deepEqual({statusReads,bodyReads},readsBeforeFallback,'packaging fallback uses cached metadata without status/body/canonical/CAS reads');
 const fallbackBinding={...binding,outcome:'failed-review-required',stage:'return-packaging'};
 helper.validatePrivatePayload(fallback,fallbackBinding);helper.packageReturnEnvelope(fallback,fallbackBinding,'unused',fakeOptions);
 const unknownFallback=helper.packagingFailurePayload(binding,null,packagingFlags,'packaging-report-read',null,null,'none');
 assert.equal(unknownFallback.failure.returnCapture.totalChangedCount,null);assert.equal(unknownFallback.failure.returnCapture.truncated,true);
 const malformedContext={...context,entries:[{...context.entries[0],path:'../'+secret}]};
 const safeUnknown=helper.packagingFailurePayload(binding,null,packagingFlags,'packaging-payload-contract',malformedContext,null,'none');
 assert.equal(safeUnknown.failure.returnCapture.totalChangedCount,null);assert(!JSON.stringify(safeUnknown).includes(secret));
 const primary=helper.privateFailure(null,'canonical-inventory','list-json-invalid',packagingFlags);
 const primaryFallback=helper.packagingFailurePayload(binding,primary,packagingFlags,'packaging-report-read',null,null,'none');
 assert.equal(primaryFallback.failure.stage,'canonical-inventory');assert.equal(primaryFallback.failure.substage,'list-json-invalid');
 assert.throws(()=>helper.packagingFailurePayload(binding,null,packagingFlags,'arbitrary-'+secret,null,null,'none'));

 let writes=0;
 assert.throws(()=>helper.writeReturnOutput('/synthetic-private-output',packaged,fallbackBinding,()=>{writes++;throw Error(secret);}),
  error=>error.privatePackagingCode==='packaging-encrypted-output'&&!error.message.includes(secret));
 assert.equal(writes,1,'failed/uncertain first output is never overwritten or retried');
 writes=0;
 assert.throws(()=>helper.writeReturnOutput('/synthetic-private-output',packaged,fallbackBinding,()=>{writes++;if(writes===2)throw Error(secret);}),
  error=>error.privatePackagingCode==='packaging-manifest-output');
 assert.equal(writes,2,'manifest failure does not rewrite the already-created encrypted file');
 const outputNames=[];helper.writeReturnOutput('/synthetic-private-output',packaged,fallbackBinding,(file)=>outputNames.push(file.split('/').pop()));
 assert.deepEqual(outputNames,['private-return.encrypted.json','public-manifest.json']);


 for(const code of ["packaging-review-shell","packaging-review-records","packaging-review-codec","packaging-review-scope","packaging-review-new-files","packaging-review-metadata","packaging-payload-structure"])assert(helper.packagingFailureCodes.includes(code));
 const expectGuard=(value,code)=>assert.throws(()=>helper.packageReturnEnvelope(value,binding,'unused',fakeOptions),
  error=>error.privatePackagingCode===code&&error.message==='Private return packaging requires review.'&&error.cause===undefined);
 expectGuard({...payload,shellIdentity:{before:reservedShell,after:{...reservedShell,version:'614'}}},'packaging-review-shell');
 expectGuard({...payload,sourceChanges:[...payload.sourceChanges,payload.sourceChanges[0]]},'packaging-review-records');
 expectGuard({...payload,sourcePatch:{...payload.sourcePatch,encoding:'unsupported'}},'packaging-review-codec');
 expectGuard({...payload,sourcePatch:{...payload.sourcePatch,scopeSha256:'0'.repeat(64)}},'packaging-review-scope');
 expectGuard({...payload,newFiles:[payload.newFiles[0],...payload.newFiles.slice(0,-1)]},'packaging-review-new-files');
 expectGuard({...exactMeta,casSql:exactMeta.casSql+'q'},'packaging-review-metadata');
 expectGuard({...payload,selection:'not-an-array'},'packaging-payload-structure');
 const legacyBadShell={...jsonFailureFixture,selection:[],shellIdentity:{before:{...reservedShell,files:[]},after:null}};
 expectGuard(legacyBadShell,'packaging-payload-structure');
 assert.throws(()=>helper.packageReturnEnvelope(payload,binding,'unused',{encrypt:()=>{const error=Error(secret);error.privatePackagingCode='packaging-review-codec';throw error;}}),
  error=>error.privatePackagingCode==='packaging-review-codec'&&!error.message.includes(secret)&&error.cause===undefined);


 assert.equal(typeof helper.validateBase64,'function','vectors exercise the actual shared production validator');
 for(const [encoded,max,hex] of [['',0,''],['AA==',1,'00'],['/w==',1,'ff'],['+/8=',2,'fbff'],['Zm8=',2,'666f'],['Zm9v',3,'666f6f'],['AAAA',3,'000000'],['AAEC',3,'000102']]){
  assert.deepEqual(helper.validateBase64(encoded,max),Buffer.from(hex,'hex'),'canonical valid Base64 and exact decoded limit');
 }
 assert.deepEqual(helper.validateBase64(binary.toString('base64'),binary.length),binary,'full byte alphabet uses the actual shared validator');
 const invalidBase64=['A','AA','AAA','AAAAA','AA=','AA===','AAA==','====','A===','AA=A','A=AA','=AAA','AAA==AAA','AA==AAAA','AAA=AAAA','AAAA====','====AAAA',
  'AA_A','AA-A','AA!A','AAA ','AA A',' AA=','AA==\n','AA==\r','AA==\r\n','AA==\t',
  'AAA'+String.fromCharCode(0),'AAA'+String.fromCharCode(233),'AB==','/x==','AAB=','Zm9='];
 for(const encoded of invalidBase64)assert.throws(()=>helper.validateBase64(encoded,64),'junk,whitespace,URL alphabet,invalid padding,length and noncanonical pad bits must remain rejected');
 assert.throws(()=>helper.validateBase64('AA==',0),'encoded-string length remains bounded before decoding');
 assert.throws(()=>helper.validateBase64('AAAA',2),'decoded3bytes must not fit an allowed2byte envelope');
 assert.throws(()=>helper.validateBase64('AAAAAA==',3),'encoded-length overflow remains rejected');
 assert.throws(()=>helper.validateBase64(null,32));assert.throws(()=>helper.validateBase64(Buffer.from('AAAA'),32),'non-string input remains rejected');

 console.log('Editorial private collection/codec and packaging: faithful202 review-only scope, terminal cleanup, bounded encrypted fallback and fixed privacy-safe failure codes passed.');
}
validatePrivateSourceCollection().catch(error=>{console.error(error);process.exitCode=1;});
