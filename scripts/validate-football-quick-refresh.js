#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {refreshPremierLeagueTable,projectionSteps,retainedFeedProjectionSteps,patchKnown,retainReviewedResultEditorial}=require('./quick-results');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-football-quick-'));
// Actual settled primary facts must not become 100 Feed updates after a check.
const final=require('../feeds/incoming/events.json').events.find(e=>e.key==='premier-league'&&e.status==='completed');
assert(final?.scoreCheckedAt&&final.resultSourceCheckedAt,'real sourced completed EPL regression');
const rechecked={...final,scoreCheckedAt:'2026-10-04T13:37:39.383Z',sourceCheckedAt:'2026-10-04T13:37:39.383Z',resultSourceCheckedAt:'2026-10-04T13:37:39.383Z'};
assert.equal(patchKnown([final],[rechecked]).count,0,'an unchanged primary final retains its original score observation');
assert.deepEqual(patchKnown([final],[rechecked]).events,[final]);
const moved={...rechecked,startTimeUtc:'2026-10-01T12:00:00.000Z'};
assert.equal(patchKnown([final],[moved]).count,1,'a sporting schedule correction still persists');
assert.equal(patchKnown([final],[moved]).events[0].scoreCheckedAt,final.scoreCheckedAt,'unchanged score does not acquire a schedule observation');
assert.equal(patchKnown([final],[moved]).events[0].resultSourceCheckedAt,final.resultSourceCheckedAt,'unchanged result keeps its source/date tuple');
const undated={...final};delete undated.scoreCheckedAt;
assert.equal(patchKnown([undated],[rechecked]).count,1,'a genuine first score observation can fill a missing date');
const corrected={...rechecked,homeScore:final.homeScore+1,score:`corrected ${final.homeScore+1}-${final.awayScore}`};
assert.equal(patchKnown([final],[corrected]).count,1,'real corrected final is admitted');
assert.equal(patchKnown([final],[corrected]).events[0].scoreCheckedAt,rechecked.scoreCheckedAt,'correction retains its actual new observation');
const live={...final,status:'live'},liveCheck={...rechecked,status:'live'};
assert.equal(patchKnown([live],[liveCheck]).count,1,'same-score live observation still refreshes live freshness');
for(const key of ['sourceName','sourceUrl','resultSourceUrl','resultStatus','delayedResultSource','sourceAttribution']){
 const changed={...rechecked,[key]:key.endsWith('Url')?'https://example.com/changed':key==='sourceAttribution'?{provider:'changed'}:'changed'};
 assert.equal(patchKnown([final],[changed]).events[0].scoreCheckedAt,rechecked.scoreCheckedAt,key+' cannot borrow an old provider/result observation');
}
assert(!retainedFeedProjectionSteps(['EPL standings source check','European Football source check']).some(s=>['scripts/publish-feed.js','scripts/build-paged-feed.js','scripts/build-follow-fixtures.js'].includes(s[0])),'real source/table dates do not require unchanged Feed publication');
(async()=>{try{
 const bundlePath=path.join(directory,'context.json');fs.copyFileSync(path.join(root,'data/canonical/afl-nrl-2026.json'),bundlePath);
 const before=fs.readFileSync(bundlePath,'utf8'),initial=JSON.parse(before),table=initial.ladderSnapshots.find(t=>t.competitionId==='competition:premier-league-2026-27');
 const now=new Date(Date.parse(table.snapshotTimeUtc)+3600000);
 const payload={compSeason:{id:841,competition:{id:1}},tables:[{entries:table.entries.map(e=>({position:e.sortOrder??e.rank,team:{club:{id:Number(e.participantId.split(':').at(-1))}},overall:{played:e.played,won:e.won,drawn:e.drawn,lost:e.lost,goalsFor:e.pointsFor,goalsAgainst:e.pointsAgainst,goalsDifference:e.pointsDifference,points:e.ladderPoints}}))}]};
 let calls=0;const changes=[];
 const options={now,bundlePath,directoryPath:path.join(root,'data/canonical/football-directory.v1.json'),fetcher:async()=>{calls++;return payload;}};
 const observation=await refreshPremierLeagueTable(changes,options);
 assert.equal(calls,1,'one primary table request, no retry');assert.equal(observation.checkedAt,now.toISOString());assert.equal(observation.rows,20);
 assert.deepEqual(changes,['EPL standings source check'],'a genuine unchanged primary observation still reaches dated presentation');
 const persisted=JSON.parse(fs.readFileSync(bundlePath,'utf8'));
 assert.deepEqual(persisted.events,initial.events,'table checking preserves every fixture identity and fact');
 assert.deepEqual(persisted.ladderSnapshots.filter(t=>t.competitionId!==table.competitionId),initial.ladderSnapshots.filter(t=>t.competitionId!==table.competitionId),'other sports tables survive');
 assert.deepEqual(persisted.ladderSnapshots.find(t=>t.competitionId===table.competitionId).entries,table.entries,'unchanged table facts are retained');
 const steps=projectionSteps(changes);assert(steps.some(s=>s.includes('--codes=football')));assert(!steps.some(s=>s[0]==='scripts/publish-feed.js'));
 const scoped=retainedFeedProjectionSteps(['Premier League 2']);
 assert.equal(scoped.find(s=>s[0]==='scripts/publish-feed.js')[1],'data/events.json','targeted Football changes start from the actual published Feed');
 assert(!scoped.some(s=>s[0]==='scripts/enrich-storyline-cards.js'||s[0]==='scripts/select-result-editorial.js'),'a Football-only check cannot rewrite unrelated editorial');
 const published=JSON.parse(fs.readFileSync(path.join(root,'data/events.json'),'utf8')).events;
 const sailing=published.find(e=>e.id==='evt_sailgp_2026_geneva_day_1');assert(sailing?.endTimeUtc,'the reproduced unrelated completed-event boundary exists in the baseline');
 const incoming=JSON.parse(fs.readFileSync(path.join(root,'feeds/incoming/events.json'),'utf8')).events;
 const reconciled=require('../lib/fixture-snapshot').mergeFixtureSnapshot(published,require('./lib/feed-utils').protectVerifiedEventFacts(incoming,published)).events;
 assert.equal(reconciled.find(e=>e.id===sailing.id).endTimeUtc,sailing.endTimeUtc,'ordinary quick publication retains a completed-event boundary omitted by the incoming snapshot');
 assert(projectionSteps(['Premier League 2']).find(s=>s[0]==='scripts/publish-feed.js').includes('--preserve-known'),'the weekday publisher uses that retention contract');
 const fixture=published.find(e=>e.key==='premier-league');
 const completed=published.find(e=>e.key==='premier-league'&&e.status==='completed'&&e.storyline);
 const enriched={...completed,selectedSentence:'Reviewed factual hook',fullSpiel:'Reviewed source-backed context',editorialPreview:{sourceUrl:'https://www.premierleague.com/'}};
 const metadataOnly=patchKnown([enriched],[{...completed,sourceUrl:'https://www.premierleague.com/en/matches',sourceName:'Premier League primary refresh'}]).events[0];
 for(const key of ['selectedSentence','fullSpiel','storyline','editorialPreview'])assert.deepEqual(metadataOnly[key],enriched[key],'primary source metadata cannot discard reviewed editorial');
 const correction=patchKnown([enriched],[{...completed,homeScore:completed.homeScore+1,score:'Corrected explicit final score'}]).events[0];
 assert.notEqual(correction.selectedSentence,enriched.selectedSentence,'actual result changes rebuild spoiler-safe copy');assert.equal(correction.editorialPreview,undefined,'old editorial cannot survive a different confirmed result');
 const patched=patchKnown(published,[{...fixture,startTimeUtc:new Date(Date.parse(fixture.startTimeUtc)+3600000).toISOString()}]);
 assert.equal(patched.count,1);assert.deepEqual(patched.events.find(e=>e.id===sailing.id),sailing,'a primary Football reschedule cannot remove a sailing result/completion boundary');
 const repeat=[];await refreshPremierLeagueTable(repeat,options);assert.deepEqual(repeat,[],'the same actual observation is idempotent');
 const good=fs.readFileSync(bundlePath,'utf8'),invalid=structuredClone(payload);invalid.tables[0].entries[0].overall.played++;
 await assert.rejects(refreshPremierLeagueTable([],{...options,fetcher:async()=>invalid}),/inconsistent/);
 assert.equal(fs.readFileSync(bundlePath,'utf8'),good,'malformed responses preserve original last-good bytes and date');
 await assert.rejects(refreshPremierLeagueTable([],{...options,fetcher:async()=>{throw Error('synthetic table transport failure');}}),/synthetic table transport failure/);
 assert.equal(fs.readFileSync(bundlePath,'utf8'),good,'a failed primary/backup comparison cannot refresh the date or replace table facts');
 const owner=fs.readFileSync(path.join(root,'scripts/update-cards.js'),'utf8'),quick=fs.readFileSync(path.join(root,'scripts/quick-results.js'),'utf8');
 assert(owner.includes("'--source=football'"),'a scoped source-to-screen verification remains inside the canonical owner');
 assert(quick.includes('await refreshPremierLeagueTable(changes,{now});'),'the weekday path checks EPL standings');
 assert(!quick.includes("run('scripts/refresh-premier-league-context.js')"),'the reusable validated owner handles failure and timestamps directly');
 // Real enrichment is the ordinary refresh stage that caused the 44-card
 // downgrade. Retention is conditional on unchanged sporting/schedule facts.
 const reviewed=structuredClone(completed);
 reviewed.selectedSentence='Two contrasting attacks met in a test of their season plans, with the result protected until you reveal it.';
 reviewed.fullSpiel='This completed match tested two contrasting season plans. The result and its consequences remain protected until you choose to reveal them.';
 reviewed.storyline={...reviewed.storyline,hookSpoilerOff:reviewed.selectedSentence,synopsisSpoilerOff:reviewed.fullSpiel,arcStage:'recap'};
 reviewed.editorialPreview={status:'journalistic',angle:'Two contrasting attacks tested',contextSignals:['event-specific','narrative:matchup'],sourceName:'Premier League table',sourceUrl:'https://www.premierleague.com/en/tables/premier-league/2026-27',sourceCheckedAt:table.source.checkedAt};
 for(const name of ['feeds/incoming/events.json','data/events.json']){fs.mkdirSync(path.dirname(path.join(directory,name)),{recursive:true});fs.writeFileSync(path.join(directory,name),JSON.stringify({events:[reviewed]}));}
 const cp=require('node:child_process');const enrichedRun=cp.spawnSync(process.execPath,[path.join(root,'scripts/enrich-storyline-cards.js'),'--write'],{cwd:directory,encoding:'utf8'});assert.equal(enrichedRun.status,0,enrichedRun.stderr);
 const generic=JSON.parse(fs.readFileSync(path.join(directory,'feeds/incoming/events.json'))).events[0];assert.notEqual(generic.selectedSentence,reviewed.selectedSentence,'rehearsal must actually reproduce the ordinary enrichment downgrade');
 const kept=retainReviewedResultEditorial([generic],[reviewed])[0];for(const key of ['selectedSentence','fullSpiel','storyline','editorialPreview'])assert.deepEqual(kept[key],reviewed[key]);
 const computed=retainReviewedResultEditorial([{...generic,storyline:{...generic.storyline,stakes:5,intensity:4}}],[reviewed])[0];assert.equal(computed.storyline.stakes,5);assert.equal(computed.storyline.intensity,4);assert.equal(computed.storyline.hookSpoilerOff,reviewed.storyline.hookSpoilerOff,'fresh computed metrics survive retained reviewed text');
 for(const changed of [{score:'0-0',homeScore:0,awayScore:0},{status:'upcoming'},{startTimeUtc:new Date(Date.parse(generic.startTimeUtc)+3600000).toISOString()},{participantIds:['different-home','different-away']}])assert.deepEqual(retainReviewedResultEditorial([{...generic,...changed}],[reviewed])[0],{...generic,...changed},'changed results/participants/schedule cannot resurrect old copy');
 const unsafe={...reviewed,selectedSentence:'The home side defeated its opponent 4-0.'};assert.deepEqual(retainReviewedResultEditorial([generic],[unsafe])[0],generic,'unsafe old root copy is not restored');
 const historicalBathurst=require('./fixtures/bathurst-prematch-editorial-20261011.json');
 assert.equal(historicalBathurst.event.status,'scheduled','the captured restoration regression must remain pre-match');
 assert(/^[a-f0-9]{40}$/.test(historicalBathurst.sourceSnapshot),'historical inputs retain their exact source snapshot');
 const document=JSON.parse(fs.readFileSync(path.join(root,'data/events.json')));document.events=document.events.map(event=>event.id===reviewed.id?reviewed:event.id===historicalBathurst.event.id?structuredClone(historicalBathurst.event):event);
 const bathurst=document.events.find(event=>event.id==='supercars-bathurst-1000-2026'),fullBathurst=structuredClone(bathurst);
 bathurst.editorialNarrative={...bathurst.editorialNarrative,hook:'Retained old Mountain preview',synopsis:'Retained old context',formCopy:undefined,closingCopy:undefined,researchedAt:'2026-09-24T01:50:44.155Z'};
 bathurst.selectedSentence=bathurst.editorialNarrative.hook;bathurst.fullSpiel=bathurst.editorialNarrative.synopsis;
 // This restoration case is pre-match. The same live catalogue card later
 // completing must not turn it into an invalid short final or restore a preview.
 fs.writeFileSync(path.join(directory,'data/editorial-knowledge.v1.json'),JSON.stringify(historicalBathurst.knowledge));
 for(const name of ['feeds/incoming/events.json','data/events.json'])fs.writeFileSync(path.join(directory,name),JSON.stringify(document));
 fs.symlinkSync(path.join(root,'scripts'),path.join(directory,'scripts'),'dir');
 const projected=cp.spawnSync(process.execPath,['-e',`const q=require(${JSON.stringify(path.join(root,'scripts/quick-results'))});q.runProjectionSteps([['scripts/enrich-storyline-cards.js','--write'],['scripts/select-result-editorial.js'],['scripts/publish-feed.js','feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known']],{editorialBaseline:new Map(['feeds/incoming/events.json','data/events.json'].map(file=>[file,JSON.parse(require('fs').readFileSync(file)).events]))});`],{cwd:directory,encoding:'utf8'});
 assert.equal(projected.status,0,projected.stdout+'\n'+projected.stderr);
 const persistedCopy=JSON.parse(fs.readFileSync(path.join(directory,'data/events.json'))).events.find(event=>event.id===reviewed.id);
 for(const file of ['feeds/incoming/events.json','data/events.json']){
  const restored=JSON.parse(fs.readFileSync(path.join(directory,file))).events.find(event=>event.id===bathurst.id);
  assert(require('../config/editorial-maintenance').equalCopy(require('../config/editorial-maintenance').copy(restored),require('../config/editorial-maintenance').copy(fullBathurst)),'actual quick enrichment/publication retains all four Bathurst sections on '+file);
  for(const key of ['date','time','startTimeUtc','venue','status','sourceCheckedAt'])assert.deepEqual(restored[key],fullBathurst[key],key+' remains a sporting fact');
 }
 for(const key of ['selectedSentence','fullSpiel','storyline','editorialPreview'])assert.deepEqual(persistedCopy[key],reviewed[key],'ordinary enrichment/select/publication must persist unchanged reviewed result copy');
 // Replay the actual current published data independently, including a later
 // official Bathurst final. No synthetic short-copy corruption enters it.
 for(const name of ['feeds/incoming/events.json','data/events.json','data/editorial-knowledge.v1.json'])fs.copyFileSync(path.join(root,name),path.join(directory,name));
 const current=JSON.parse(fs.readFileSync(path.join(root,'data/events.json'))),currentBathurst=current.events.find(event=>event.id===bathurst.id);
 const currentRun=cp.spawnSync(process.execPath,['-e',`const q=require(${JSON.stringify(path.join(root,'scripts/quick-results'))});q.runProjectionSteps([['scripts/enrich-storyline-cards.js','--write'],['scripts/select-result-editorial.js'],['scripts/publish-feed.js','feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known']],{editorialBaseline:new Map(['feeds/incoming/events.json','data/events.json'].map(file=>[file,JSON.parse(require('fs').readFileSync(file)).events]))});`],{cwd:directory,encoding:'utf8'});
 assert.equal(currentRun.status,0,currentRun.stdout+'\n'+currentRun.stderr);
 for(const name of ['feeds/incoming/events.json','data/events.json']){
  const after=JSON.parse(fs.readFileSync(path.join(directory,name))).events.find(event=>event.id===bathurst.id);
  assert(require('../config/editorial-maintenance').equalCopy(require('../config/editorial-maintenance').copy(after),require('../config/editorial-maintenance').copy(currentBathurst)),'current source-backed copy remains on '+name);
  for(const key of ['id','date','time','startTimeUtc','endTimeUtc','venue','status','score','fixtureResults','sourceCheckedAt','resultSourceCheckedAt','firstConfirmedCompleteAt'])assert.deepEqual(after[key],currentBathurst[key],key+' stays independent of editorial projection');
 }
 if(['completed','finished','final'].includes(currentBathurst.status)){
  const shortFinal={...currentBathurst,editorialNarrative:{...currentBathurst.editorialNarrative,synopsis:'Retained old context'}};
  assert.deepEqual(require('./lib/editorial-publication').reconcileFullPreviews([shortFinal],historicalBathurst.knowledge),[shortFinal],'a pre-match projection cannot repair or overwrite a later final');
  assert(require('./lib/feed-utils').validateFeed({...current,events:[shortFinal]}).some(issue=>issue.includes('synopsis must be 80-700')),'short final copy still fails the real publication schema');
 }
 assert(quick.includes('runProjectionSteps(projectionSteps(changes,')&&quick.includes("if(file==='scripts/publish-feed.js'&&editorialBaseline)"),'the ordinary publication boundary must execute retention after enrichment');
 console.log('Football daily table: one request, genuine observation, fixture/other-sport retention, idempotence, failure/date retention and scoped projections passed.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
