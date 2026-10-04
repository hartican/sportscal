#!/usr/bin/env node
'use strict';
// Invoked by update-cards --quick. Canonical adapters own source facts and any accompanying current standings.
const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const tennis=require('./refresh-us-open-events');
const pl=require('./refresh-premier-league-cards');
const officialResults=require('./sync-official-card-results');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const {storylineFor,spoilerSafeRootCopy,spoilerContractIssues}=require('./lib/storyline-card-rules');
const {KEYS,semantic,patchKnown}=require('./lib/known-fixture-patch');
function retainReviewedResultEditorial(events,previous){
 const byId=new Map(previous.map(event=>[event.id,event]));
 const facts=['id','name','competitionId','participantIds','participants','participantsConfirmed','date','time','timePrecision','startTimeUtc','endTimeUtc','actualEndTimeUtc','venue','roundNumber','roundLabel','scheduleStatus','status','score','scoreDisplay','canonicalResultScoreline','result','resultLabels','homeScore','awayScore','outcomeText','recapText','fixtureResults'];
 const copy=['selectedSentence','fullSpiel','storyline','editorialPreview'];
 return events.map(event=>{
  const old=byId.get(event.id);
  if(event.status!=='completed'||old?.storyline?.arcStage!=='recap'||old.editorialPreview?.status!=='journalistic'||!old.editorialPreview.sourceUrl||!Number.isFinite(Date.parse(old.editorialPreview.sourceCheckedAt))||spoilerContractIssues(old).length||facts.some(key=>JSON.stringify(old[key])!==JSON.stringify(event[key])))return event;
  const retained={...event,...Object.fromEntries(copy.filter(key=>Object.hasOwn(old,key)).map(key=>[key,old[key]]))};
  // Keep fresh computed stakes/intensity; retain only reviewed narrative fields.
  retained.storyline={...event.storyline,...Object.fromEntries(['hookSpoilerOff','synopsisSpoilerOff','hookSpoilerOn','synopsisSpoilerOn','researchDepth','lastReviewedAt'].filter(key=>Object.hasOwn(old.storyline,key)).map(key=>[key,old.storyline[key]]))};
  return retained;
 });
}
function runProjectionSteps(steps,{editorialBaseline}={}){
 for(const [file,...args] of steps){
  if(file==='scripts/publish-feed.js'&&editorialBaseline)for(const [name,previous] of editorialBaseline){
   const document=read(name),events=require('./lib/editorial-publication').reconcileFullPreviews(retainReviewedResultEditorial(document.events,previous),read('data/editorial-knowledge.v1.json'));
   if(JSON.stringify(events)!==JSON.stringify(document.events))write(name,{...document,events});
  }
  run(file,...args);
 }
}
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Origin:'https://www.afl.com.au',Referer:'https://www.afl.com.au/'}});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.json();}
function run(file,...args){const env={...process.env};if(/^scripts\/(?:validate-|audit-|qa-|verify-)/.test(file))for(const key of ['FOOTBALL_DATA_API_TOKEN','FOOTBALL_DATA_RUN_DIR','FOOTBALL_DATA_REPORT','GOLF_SOURCE_REPORT','GOLF_SOURCE_RUN_ID'])delete env[key];const result=spawnSync(process.execPath,[file,...args],{stdio:'inherit',env});if(result.status!==0)throw new Error(`${file} failed`);}
async function refreshNflResults(now){
 const path='data/canonical/american-football-directory.v1.json',directory=read(path);
 const response=await json(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${now.getFullYear()}&limit=1000`);
 const updates=new Map((response.events||[]).map(event=>{
   const competition=event.competitions?.[0]||{};
   const slots=(competition.competitors||[]).map(side=>({
     participantId:`team:nfl:${String(side?.team?.abbreviation||side?.team?.id||'').toLowerCase()}`,
     label:side?.team?.displayName||side?.team?.shortDisplayName||null,
     homeAway:side?.homeAway||null,
     ...(side?.score?.displayValue!=null||side?.score!=null?{score:String(side?.score?.displayValue??side.score)}:{}),
   }));
   return [`fixture:nfl:${event.id}`,{status:event?.status?.type?.completed===true?'completed':event?.status?.type?.state==='in'?'live':'upcoming',slots}];
 }));
 let count=0;
 const fixtures=directory.fixtures.map(fixture=>{
   const update=updates.get(fixture.id);if(!update)return fixture;
   const byId=new Map(update.slots.map(slot=>[slot.participantId,slot]));
   const participantSlots=(fixture.participantSlots||[]).map(slot=>({...slot,...(byId.get(slot.participantId)||{})}));
   const next={...fixture,status:update.status,participantSlots};
   if(semantic(next)!==semantic(fixture))count++;
   return next;
 });
 if(count)write(path,{...directory,generatedAt:response.timestamp||now.toISOString(),fixtures});
 return count;
}
// Keep unrelated projections byte-for-byte intact. Source ingestion and the
// atomic preservation boundary remain independent of deployment credentials.
function projectionSteps(changes,{rebuild=false}={}){
 if(!changes.length&&!rebuild)return [];
 const canonicalChanged=rebuild||changes.some(change=>change.startsWith('AFL/NRL')||change==='Current card evidence');
 const feedChanged=canonicalChanged||rebuild||changes.some(change=>/^(NBL|Premier League|F1|Official results|Current card evidence|Skiing calendar review)/.test(change));
 const codes=new Set();
 if(changes.includes('Skiing calendar review'))codes.add('skiing');
 for(const change of changes)if(change.startsWith('Live coverage '))codes.add(change.slice('Live coverage '.length));
 if(canonicalChanged)['afl','aflw','nrl'].forEach(code=>codes.add(code));
 if(changes.some(change=>change.startsWith('Premier League')))codes.add('football');
 if(changes.some(change=>change.startsWith('EPL standings')))codes.add('football');
 if(changes.some(change=>change.startsWith('European Football')))['football','champions-league'].forEach(code=>codes.add(code));
 if(changes.some(change=>change.startsWith('F1')))['f1','motorsport'].forEach(code=>codes.add(code));
  if(changes.some(change=>change.startsWith('US Open')))codes.add('tennis');
 if(changes.some(change=>change.startsWith('NFL')))codes.add('american-football');
 if(changes.some(change=>/^(CHL|NHL)/.test(change)))codes.add('ice-hockey');
 if(changes.some(change=>change.startsWith('LPGA')))codes.add('golf');
 if(changes.some(change=>change.startsWith('NBL')))codes.add('nbl');
 if(changes.some(change=>change.startsWith('Official results')))['aflw','nrl','nrlw','motorsport','f1','motogp','fiba-women','tennis','wrc'].forEach(code=>codes.add(code));
 if(changes.some(change=>change==='Current card evidence'||change.startsWith('Official results')))['rugby-union','cricket'].forEach(code=>codes.add(code));
 const steps=[];
 if(changes.some(change=>change.startsWith('US Open')))steps.push(['scripts/apply-editorial-narratives.js','--write','--major-events-only']);
 if(canonicalChanged){steps.push(['scripts/sync-canonical-fixtures-to-feed.js','data/canonical/afl-nrl-2026.json','feeds/incoming/events.json','feeds/incoming/events.json'],['scripts/apply-current-card-evidence.js'],['scripts/refresh-major-events-from-canonical.js']);}
 if(changes.some(change=>/^(Premier League|EPL standings)/.test(change)))steps.push(['scripts/build-canonical-context-bundle.js'],['scripts/validate-premier-league-context.js']);
 if(feedChanged){steps.push(
  ['scripts/enrich-storyline-cards.js','--write'],
  ['scripts/select-result-editorial.js'],
  ['scripts/publish-feed.js','feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
  ['scripts/qa-storyline-spoilers.js','feeds/incoming/events.json'],
  ['scripts/qa-storyline-spoilers.js','data/events.json'],
 );}
 if(feedChanged)steps.push(['scripts/build-paged-feed.js']);
 steps.push(['scripts/build-code-inspector.js',...(rebuild?[]:[`--codes=${[...codes].join(',')}`])],['scripts/build-app-shell-runtime.js'],['scripts/apply-current-card-evidence.js','--check'],['scripts/validate-current-card-coverage.js'],['scripts/validate-feed-coverage-resilience.js'],['scripts/validate-feed.js','data/events.json'],['scripts/validate-crowd-foresight.js']);
 if(changes.some(change=>change.startsWith('European Football')))steps.push(['scripts/build-follow-directories.js','--codes=football'],['scripts/validate-openligadb-football.js'],['scripts/validate-european-football-continuity.js'],['scripts/validate-european-football-standings.js']);
 return steps;
}
// A targeted source update starts from each surface's current facts. Rebuilding
// published data from older unrelated incoming records can regress other sports.
function nblProjectionSteps(changes){
 if(changes.length&&changes.every(change=>change==='NBL standings'))return [['scripts/build-code-inspector.js','--codes=nbl']];
 return retainedFeedProjectionSteps(changes);
}
function retainedFeedProjectionSteps(changes){
 return projectionSteps(changes).filter(args=>!['scripts/enrich-storyline-cards.js','scripts/select-result-editorial.js'].includes(args[0])).map(args=>args[0]==='scripts/publish-feed.js'?[args[0],'data/events.json',...args.slice(2)]:args);
}
function nblStandingsChanged(before,after){
 const facts=rows=>rows?.map(({asOf,...row})=>row);
 return JSON.stringify(facts(before))!==JSON.stringify(facts(after));
}
async function refreshPremierLeagueTable(changes,{now=new Date(),bundlePath='data/canonical/afl-nrl-2026.json',...options}={}){
 const table=document=>document.ladderSnapshots.find(row=>row.competitionId==='competition:premier-league-2026-27');
 const before=table(read(bundlePath));
 await require('./refresh-premier-league-context').refresh({...options,bundlePath,now:()=>now});
 const after=table(read(bundlePath));
 if(JSON.stringify(before)!==JSON.stringify(after))changes.push('EPL standings source check');
 return {state:'primary',checkedAt:after.source.checkedAt,rows:after.entries.length};
}
async function refreshFootball({now=new Date()}={}){
 const changes=[],failures=[];
 try{const result=await require('./refresh-openligadb-football').refresh({now});if(result.wrote)changes.push('European Football source check');failures.push(...result.failures.map(f=>`European Football ${f.league}: ${f.message}`));}catch(error){failures.push(`European Football: ${error.message}`);}
 try{await refreshPremierLeagueTable(changes,{now});}catch(error){failures.push(`EPL standings: ${error.message}`);}
 try{const doc=read('feeds/incoming/events.json'),cards=await pl.loadCards(doc.events.filter(e=>e.key==='premier-league'),{checkedAt:now.toISOString()});let count=0;for(const file of ['feeds/incoming/events.json','data/events.json']){const current=read(file),result=patchKnown(current.events,cards);count+=result.count;if(result.count)write(file,{...current,events:result.events});}if(count)changes.push(`Premier League ${count}`);}catch(error){failures.push(`Premier League: ${error.message}`);}
 for(const [file,...args] of retainedFeedProjectionSteps(changes))run(file,...args);
 const report={mode:'quick',source:'football',checkedAt:now.toISOString(),changed:changes,failures,aiCalls:0};
 if(process.env.QUICK_RESULTS_REPORT)write(process.env.QUICK_RESULTS_REPORT,report);
 console.log(JSON.stringify(report));
 if(failures.length)throw new Error('Football source checks failed; retained last-good facts. See source report.');
 return report;
}
function refreshNbl(changes,{published=false}={}){
   const nblPath='data/canonical/nbl-2026-27.json',previous=read(nblPath);
   run('scripts/refresh-nbl-schedule.js');
   const schedule=read(nblPath),participants=new Map(schedule.participants.map(p=>[p.id,p]));
   const cards=schedule.events.map(event=>require('./sync-requested-sports-to-feed').cardForEvent(event,schedule,participants));
   let count=0;
   for(const file of ['feeds/incoming/events.json',...(published?['data/events.json']:[])]){
    const doc=read(file),patched=patchKnown(doc.events,cards);count+=patched.count;
    if(patched.count)write(file,{...doc,events:patched.events});
   }
   if(count||semantic(previous.events)!==semantic(schedule.events))changes.push(`NBL ${count}`);
   else if(nblStandingsChanged(previous.standings,schedule.standings)||previous.standingsStatus!==schedule.standingsStatus)changes.push('NBL standings');
   else write(nblPath,previous);
}
async function refresh({now=new Date(),offline=false,source=null}={}){
 if(source){
  if(source==='football'&&!offline)return refreshFootball({now});
  if(source==='nhl'&&!offline){
   let nhl;
   try{nhl=await refreshNhl();}catch(error){const report={mode:'quick',source,checkedAt:new Date().toISOString(),changed:[],failures:[`NHL: ${error.message}`],aiCalls:0};if(process.env.QUICK_RESULTS_REPORT)write(process.env.QUICK_RESULTS_REPORT,report);console.log(JSON.stringify(report));throw error;}
   const changes=nhl.changed||nhl.projectionNeedsRepair?[`NHL results and standings ${nhl.finals}`]:[];
   for(const args of projectionSteps(changes))run(...args);
   const report={mode:'quick',source,checkedAt:nhl.checkedAt,changed:changes,failures:[],nhl,aiCalls:0};
   if(process.env.QUICK_RESULTS_REPORT)write(process.env.QUICK_RESULTS_REPORT,report);
   return report;
  }
  if(source==='chl'&&!offline){
   let chl;
   try{chl=await refreshChl();}catch(error){const report={mode:'quick',source,checkedAt:new Date().toISOString(),changed:[],failures:[`CHL: ${error.message}`],aiCalls:0};if(process.env.QUICK_RESULTS_REPORT)write(process.env.QUICK_RESULTS_REPORT,report);console.log(JSON.stringify(report));throw error;}
   const changes=chl.changed||chl.projectionNeedsRepair?[`CHL results and club records ${chl.finals}`]:[];
   for(const args of projectionSteps(changes))run(...args);
   const report={mode:'quick',source,checkedAt:chl.checkedAt,changed:changes,failures:[],chl,aiCalls:0};
   if(process.env.QUICK_RESULTS_REPORT)write(process.env.QUICK_RESULTS_REPORT,report);
   return report;
  }
  if(source==='nfl-standings'&&!offline){
   const nflStandings=await refreshNflStandings(),changes=nflStandings.changed?[`NFL standings ${nflStandings.rows}`]:[];
   for(const args of projectionSteps(changes))run(...args);
   return {mode:'quick',source,checkedAt:nflStandings.checkedAt,changed:changes,failures:[],nflStandings,aiCalls:0};
  }
  if(source!=='nbl'||offline)throw new Error('Scoped quick refresh supports --source=nbl with live source access only');
  const changes=[];refreshNbl(changes,{published:true});
  for(const args of nblProjectionSteps(changes))run(...args);
  return {mode:'quick',source,checkedAt:now.toISOString(),changed:changes,failures:[],aiCalls:0};
 }
 let liveCoverage=null;
 // Only restore reviewed result copy when the source facts still match the
 // pre-refresh surface. New finals/corrections must keep regenerated recaps.
 const editorialBaseline=new Map(['feeds/incoming/events.json','data/events.json'].map(file=>[file,read(file).events]));
 const changes=[],failures=[],bundlePath='data/canonical/afl-nrl-2026.json';
 const hydration=await require('./refresh-tournament-hydration').refresh({now,offline});
 if(hydration.changed.length)changes.push('Tournament hydration');
 if(!offline)try{
  const european=await require('./refresh-openligadb-football').refresh({now});
  if(european.wrote)changes.push('European Football source check');
  failures.push(...european.failures.map(f=>`European Football ${f.league}: ${f.message}`));
 }catch(error){failures.push(`European Football: ${error.message}`);}
 if(!offline)try{
  liveCoverage=await require('./sync-live-coverage').sync({now});for(const code of liveCoverage.codes)changes.push(`Live coverage ${code}`);
 }catch(error){failures.push(`Live coverage: ${error.message}`);}
 const previousBundle=read(bundlePath);let bundle=previousBundle;
 const near=ev=>{const start=Date.parse(ev.startTimeUtc||'');return Number.isFinite(start)&&Math.abs(start-+now)<=7*86400000;};
 if(!offline)try{
   run('scripts/refresh-canonical-sports.js');bundle=read(bundlePath);
   if(semantic(bundle)!==semantic(previousBundle))changes.push('AFL/NRL inventory');
 }catch(error){failures.push(`AFL/NRL: ${error.message}`);}
 const evidenceBefore=semantic({bundle:read(bundlePath),feed:read('feeds/incoming/events.json'),coverage:read('data/follow-sources/coverage.v1.json'),results:read('data/canonical/official-card-results-2026.json')});
 run('scripts/apply-current-card-evidence.js');bundle=read(bundlePath);
 const evidenceAfter=semantic({bundle,feed:read('feeds/incoming/events.json'),coverage:read('data/follow-sources/coverage.v1.json'),results:read('data/canonical/official-card-results-2026.json')});
 if(evidenceBefore!==evidenceAfter)changes.push('Current card evidence');
 if(!offline)try{
   refreshNbl(changes);
 }catch(error){failures.push(`NBL: ${error.message}`);}
 if(!offline)try{const count=await refreshNflResults(now);if(count)changes.push(`NFL ${count}`);}catch(error){failures.push(`NFL: ${error.message}`);}
 let nflStandings=null;
 if(!offline)try{nflStandings=await refreshNflStandings();if(nflStandings.changed)changes.push(`NFL standings ${nflStandings.rows}`);}catch(error){failures.push(`NFL standings: ${error.message}`);}
 let chl=null;
 if(!offline)try{chl=await refreshChl();if(chl.changed||chl.projectionNeedsRepair)changes.push(`CHL results and club records ${chl.finals}`);}catch(error){failures.push(`CHL: ${error.message}`);}
 let nhl=null;
 if(!offline)try{nhl=await refreshNhl();if(nhl.changed||nhl.projectionNeedsRepair)changes.push(`NHL results and standings ${nhl.finals}`);}catch(error){failures.push(`NHL: ${error.message}`);}
 const officialDocument=read('feeds/incoming/events.json'),officialSnapshot=read('data/canonical/official-card-results-2026.json'),official=officialResults.applyOfficialResults(officialDocument.events,officialSnapshot);
 const officialReleaseChanged=officialDocument.version!==officialSnapshot.feedVersion;
 if(official.count||officialReleaseChanged){write('feeds/incoming/events.json',{...officialDocument,version:officialSnapshot.feedVersion,events:official.events});changes.push(`Official results ${official.count}`);}
 const majorPath='data/major-events.v1.json',major=read(majorPath),us=major.events.find(e=>e.id==='major:us-open-2026'||/US Open 2026/.test(e.name));
 const usRetentionEnd=us?.endDate?new Date(`${us.endDate}T23:59:59.999Z`):null;if(usRetentionEnd)usRetentionEnd.setUTCDate(usRetentionEnd.getUTCDate()+14);
 if(!offline&&us&&us.startDate<=now.toISOString().slice(0,10)&&now<=usRetentionEnd)try{
   const snapshot=await tennis.fetchOfficialSnapshot({quick:true,now,cached:read('feeds/provider-exports/tennis/us-open-2026-official-schedule.json')});tennis.fixturesFromSnapshot(snapshot);
   const next=tennis.mergeCatalogue(major,snapshot);
   // Only persist semantic fixture changes, not fetch timestamps.
   const clean=value=>JSON.stringify(value,(key,v)=>['statusUpdatedAt','capturedAt','updatedAt','checkedAt','generatedAt'].includes(key)?undefined:v);
   if(clean(next)!==clean(major)){write(majorPath,next);write('feeds/provider-exports/tennis/us-open-2026-official-schedule.json',snapshot);changes.push('US Open schedule/results');}
 }catch(error){failures.push(`tennis: ${error.message}`);}
 if(!offline)try{
   await refreshPremierLeagueTable(changes,{now});
 }catch(error){failures.push(`EPL standings: ${error.message}`);}
 if(!offline)try{
   const doc=read('feeds/incoming/events.json'),known=doc.events.filter(e=>e.key==='premier-league'&&near(e));
   if(known.length){const cards=await pl.loadCards(doc.events.filter(e=>e.key==='premier-league'),{checkedAt:now.toISOString()});const result=patchKnown(doc.events,cards.filter(near));if(result.count){write('feeds/incoming/events.json',{...doc,events:result.events});changes.push(`Premier League ${result.count}`);}}
 }catch(error){failures.push(`Premier League: ${error.message}`);}
 if(!offline)try{const doc=read('feeds/incoming/events.json'),updates=await require('./refresh-f1-results').updatesFor(doc.events,now),patched=patchKnown(doc.events,updates);if(patched.count){write('feeds/incoming/events.json',{...doc,events:patched.events});changes.push(`F1 ${patched.count}`);}}catch(error){failures.push(`F1: ${error.message}`);}
 if(!offline)try{
  const path='data/canonical/pga-tour-schedule.json',result=await require('../lib/lpga-results').refreshOnce(read(path),{now});
  if(result.changed){write(path,result.document);changes.push(`LPGA ${result.changed}`);}
  failures.push(...result.failures.map(f=>`LPGA ${f.id}: ${f.code}`));
 }catch(error){failures.push(`LPGA: ${error.message}`);}
 const skiReview=require('./lib/skiing-calendar-review').applyRetained();
 if(skiReview.some(surface=>surface.changed.length))changes.push('Skiing calendar review');
 runProjectionSteps(projectionSteps(changes,{rebuild:process.argv.includes('--rebuild')}),{editorialBaseline});
 run('scripts/build-tennis-feed-parents.js');
 run('scripts/build-tournament-horizon.js');
 run('scripts/verify-result-completeness.js','data/events.json');

 if(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY)run('scripts/settle-nsc-foresight.js');
 const report={mode:'quick',checkedAt:now.toISOString(),changed:changes,failures,liveCoverage,nflStandings,chl,nhl,aiCalls:0};
 if(process.env.QUICK_RESULTS_REPORT){const path=require('node:path');fs.mkdirSync(path.dirname(process.env.QUICK_RESULTS_REPORT),{recursive:true});write(process.env.QUICK_RESULTS_REPORT,report);}
 console.log(JSON.stringify(report));
 if(failures.length)console.warn(`::warning::Quick refresh retained last-good data for ${failures.length} failed source checks; review the refresh report.`);
 if(failures.length&&!changes.length&&!offline)throw new Error('Quick sources failed; preserved last-known-good data.');
 return {changes,failures};
}
async function atomicRefresh(options){
 const files=new Map();function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=dir+'/'+entry.name;if(entry.isDirectory())collect(name);else if(/\.(json|js)$/.test(name))files.set(name,fs.readFileSync(name));}}
 const runtime='assets/js/app-shell-runtime.js',runtimeBefore=fs.existsSync(runtime)?fs.readFileSync(runtime):null;
 collect('data');collect('feeds');
 try{return await refresh(options);}catch(error){const after=new Map(files);files.clear();collect('data');collect('feeds');for(const name of files.keys())if(!after.has(name))fs.unlinkSync(name);for(const [name,content] of after)fs.writeFileSync(name,content);if(runtimeBefore)fs.writeFileSync(runtime,runtimeBefore);else if(fs.existsSync(runtime))fs.unlinkSync(runtime);throw error;}
}
if(require.main===module)atomicRefresh({offline:process.argv.includes('--offline'),source:process.argv.find(arg=>arg.startsWith('--source='))?.slice(9)}).then(result=>{if(process.argv.some(arg=>arg.startsWith('--source=')))console.log(JSON.stringify(result));}).catch(error=>{console.error(error.message);process.exitCode=1;});
async function text(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{accept:'text/html','user-agent':'nothingSport canonical refresh/1.0'}});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.text();}
async function refreshChl(options={}){
 const facts=require('./lib/chl-results'),filePath=options.filePath||'data/canonical/ice-hockey-directory.v1.json';
 const result=await facts.refreshFile({filePath,fetchJson:json,fetchText:text,...options});let projectionNeedsRepair=true;
 try{projectionNeedsRepair=!facts.projectionCurrent(read(filePath),{inspector:read('data/code-inspector/ice-hockey.json'),schedule:read('data/follow-schedule/ice-hockey.json')});}catch{}
 return {...result,projectionNeedsRepair};
}
function refreshNflStandings(options={}){return require('./lib/nfl-standings').refreshFile({filePath:'data/canonical/american-football-directory.v1.json',fetchJson:json,...options});}
async function refreshNhl(options={}){
 const facts=require('./lib/nhl-results'),filePath=options.filePath||'data/canonical/ice-hockey-directory.v1.json';
 const result=await facts.refreshFile({filePath,fetchJson:json,...options});let projectionNeedsRepair=true;
 try{projectionNeedsRepair=!facts.projectionCurrent(read(filePath),{inspector:read('data/code-inspector/ice-hockey.json'),schedule:read('data/follow-schedule/ice-hockey.json')});}catch{}
 return {...result,projectionNeedsRepair};
}
module.exports={nblStandingsChanged,patchKnown,retainReviewedResultEditorial,runProjectionSteps,refresh,refreshPremierLeagueTable,projectionSteps,nblProjectionSteps,retainedFeedProjectionSteps,refreshNflStandings,refreshChl,refreshNhl,KEYS};
