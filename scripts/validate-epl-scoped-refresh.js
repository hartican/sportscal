#!/usr/bin/env node
'use strict';
// Constructed source responses and an in-memory filesystem. No provider, DB,
// browser, native child or canonical CLI execution is permitted by this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),https=require('node:https');
const {EventEmitter}=require('node:events');
const ROOT=path.resolve(__dirname,'..'),AT='2026-10-30T06:00:00.000Z',OLD='2026-10-29T06:00:00.000Z';
global.fetch=()=>assert.fail('Unexpected fetch');
for(const name of['http','net','tls'])for(const key of['get','request','connect','createConnection'])if(require('node:'+name)[key])require('node:'+name)[key]=()=>assert.fail('Unexpected network');
https.get=()=>assert.fail('Unexpected HTTPS before source control');
const original={...Object.fromEntries(['readFileSync','writeFileSync','existsSync','readdirSync','mkdirSync','mkdtempSync','renameSync','rmSync','openSync','closeSync','fstatSync','readSync'].map(k=>[k,fs[k]])),spawnSync:cp.spawnSync,Date:global.Date};
const source=require('./refresh-premier-league-cards'),table=require('./refresh-premier-league-context');
const accepted=JSON.parse(original.readFileSync(path.join(ROOT,'data/events.json'))).events.filter(e=>e.key==='premier-league');
const directory=JSON.parse(original.readFileSync(path.join(ROOT,'data/canonical/football-directory.v1.json')));
const clubs=new Map(directory.teams.map(e=>[e.id,e]));
const fixtures=accepted.map(e=>({id:Number(e.canonicalEventId.split(':').pop()),gameweek:{gameweek:e.roundNumber,compSeason:{id:841,competition:{id:1}}},status:'U',kickoff:{millis:Date.parse(e.startTimeUtc),completeness:3},provisionalKickoff:{millis:Date.parse(e.startTimeUtc)},ground:{name:e.venue},teams:e.participantIds.map(id=>({team:{id:Number(id.split(':').pop()),name:clubs.get(id).displayName,club:{id:Number(id.split(':').pop())}}}))}));
fixtures[0].status='C';fixtures[0].teams.forEach(e=>{e.score=0;});
const ids=[...new Set(fixtures.flatMap(f=>f.teams.map(t=>t.team.id)))];
function tablePayload(){return{compSeason:{id:841,competition:{id:1}},tables:[{entries:ids.map((id,i)=>({position:i+1,team:{club:{id}},overall:{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalsDifference:0,points:0}}))}]};}
const seedCards=fixtures.map(f=>source.cardForFixture(f,OLD));
const rules=require('./lib/storyline-card-rules');
for(const card of seedCards){card.storyline=rules.storylineFor(card);card.editorialPreview={status:'journalistic',sourceUrl:'https://www.premierleague.com/en/matches',sourceCheckedAt:OLD};}
const other={id:'unrelated-fixture',key:'cricket',sourceCheckedAt:OLD,selectedSentence:'Reviewed other-sport copy',unknown:{keep:true}};
const seedBundle=JSON.parse(original.readFileSync(path.join(ROOT,'data/canonical/afl-nrl-2026.json')));
const previousContext=table.buildSnapshot(tablePayload(),directory,OLD);const seed=table.updateBundle(seedBundle,previousContext,OLD);
let files,fds,nextFd,sequence,calls,children,failedChild;
const resolve=p=>path.resolve(String(p));
function reset(){files=new Map([
 [path.join(ROOT,'data/events.json'),Buffer.from(JSON.stringify({events:[other,...seedCards]}))],
 [path.join(ROOT,'feeds/incoming/events.json'),Buffer.from(JSON.stringify({events:[other,...seedCards]}))],
 [path.join(ROOT,'data/canonical/afl-nrl-2026.json'),Buffer.from(JSON.stringify(seed))],
 [path.join(ROOT,'assets/js/app-shell-runtime.js'),Buffer.from('unchanged runtime')],
 [path.join(ROOT,'data/canonical/football-delayed-results.v1.json'),Buffer.from(JSON.stringify({schemaVersion:'football-delayed-results.v1',results:[]}))],
 ]);fds=new Map();nextFd=10000;sequence=0;calls=[];children=[];failedChild=null;}
fs.readFileSync=function(p,encoding){const b=files?.get(resolve(p));return b?(typeof encoding==='string'?b.toString(encoding):encoding?.encoding?b.toString(encoding.encoding):Buffer.from(b)):original.readFileSync.apply(this,arguments);};
fs.writeFileSync=(p,body)=>{const key=resolve(p);assert(key.startsWith(ROOT+'/data/')||key.startsWith(ROOT+'/feeds/')||key===ROOT+'/assets/js/app-shell-runtime.js'||key.startsWith('/tmp/epl-noio-'),'Forbidden write '+key);files.set(key,Buffer.from(body));};
fs.existsSync=p=>files?.has(resolve(p))||original.existsSync(p);
fs.readdirSync=(p,options)=>{const base=resolve(p);if(base===ROOT+'/data'||base.startsWith(ROOT+'/data/')||base===ROOT+'/feeds'||base.startsWith(ROOT+'/feeds/')){const names=[...new Set([...files.keys()].filter(x=>x.startsWith(base+'/')).map(x=>x.slice(base.length+1).split('/')[0]))];return options?.withFileTypes?names.map(name=>({name,isDirectory:()=>[...files.keys()].some(x=>x.startsWith(base+'/'+name+'/'))})):names;}return original.readdirSync(p,options);};
fs.unlinkSync=p=>{assert(files.has(resolve(p)));files.delete(resolve(p));};
fs.mkdirSync=p=>{assert(resolve(p).startsWith('/tmp/epl-noio-')||resolve(p)===ROOT+'/data/canonical');};
fs.mkdtempSync=()=>'/tmp/epl-noio-'+(++sequence);
fs.openSync=(p,flags,...args)=>{if(flags==='r')return original.openSync(p,flags,...args);const key=resolve(p);assert(key.startsWith('/tmp/epl-noio-'));files.set(key,Buffer.alloc(0));const fd=nextFd++;fds.set(fd,key);return fd;};
fs.fstatSync=fd=>fds.has(fd)?{size:files.get(fds.get(fd)).length}:original.fstatSync(fd);
fs.readSync=(fd,...args)=>fds.has(fd)?0:original.readSync(fd,...args);
fs.closeSync=fd=>{if(fds.has(fd))fds.delete(fd);else original.closeSync(fd);};
fs.rmSync=p=>{const key=resolve(p);assert(key.startsWith('/tmp/epl-noio-'));for(const name of files.keys())if(name.startsWith(key))files.delete(name);};
fs.renameSync=(a,b)=>{a=resolve(a);b=resolve(b);assert(files.has(a)&&(b.startsWith(ROOT+'/data/')||b.startsWith('/tmp/epl-noio-')));files.set(b,files.get(a));files.delete(a);};
cp.spawnSync=(_command,args)=>{assert(!/refresh-|redeploy|settle-|update-cards/.test(args[0]),'Unexpected source/publisher child '+args[0]);children.push(args);if(failedChild===args[0]){files.set(ROOT+'/assets/js/app-shell-runtime.js',Buffer.from('rejected generated runtime'));return{status:1};}return{status:0};};
for(const key of['spawn','exec','execSync','execFile','execFileSync','fork'])cp[key]=()=>assert.fail('Unexpected child');
class Clock extends original.Date{constructor(...args){super(...(args.length?args:[AT]));}static now(){return original.Date.parse(AT);}}
global.Date=Clock;
const quick=require('./quick-results');
function transport(edit=()=>{}){
 const pages=Array.from({length:4},(_,page)=>({pageInfo:{page,numPages:4,pageSize:100,numEntries:380},content:structuredClone(fixtures.slice(page*100,page*100+100))}));
 const inputs={pages,table:tablePayload()};edit(inputs);
 https.get=(url,options,callback)=>{
  const u=new URL(url);assert.equal(u.origin,'https://footballapi.pulselive.com');assert(['/football/fixtures','/football/standings'].includes(u.pathname));calls.push(url);
  const data=u.pathname.endsWith('fixtures')?inputs.pages[Number(u.searchParams.get('page'))]:inputs.table;
  const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=error=>{request.emit('error',error);return request;};
  queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=u.pathname.endsWith('standings')?(inputs.tableStatus||200):200;response.headers={};response.setEncoding=()=>response;response.destroy=()=>{};callback(response);response.emit('data',Buffer.from(JSON.stringify(data)));response.emit('end');});return request;
 };
}
const records=[];const document=f=>JSON.parse(files.get(ROOT+'/'+f));
const final=e=>document('data/events.json').events.find(row=>row.id===e.id);
async function check(name,fn){reset();await fn();records.push({name,passed:true});}
function editFeeds(edit){for(const f of['feeds/incoming/events.json','data/events.json']){const value=document(f);edit(value.events);files.set(ROOT+'/'+f,Buffer.from(JSON.stringify(value)));}}
async function run(){
 await check('five complete primary resources, original finals and other sports preserved',async()=>{
  transport();const report=await quick.refresh({source:'epl',now:new Date(AT)});
  assert.equal(report.source,'epl');assert.equal(calls.length,5);assert.deepEqual(document('data/events.json').events[0],other);
  assert.equal(final(seedCards[0]).scoreCheckedAt,OLD);assert.equal(final(seedCards[0]).resultSourceCheckedAt,OLD);
  assert.deepEqual(final(seedCards[0]).editorialPreview,seedCards[0].editorialPreview);
  assert.deepEqual(document('data/events.json').events.map(e=>e.id),[other,...seedCards].map(e=>e.id));
 });
 await check('one unsupported primary fact defers only that fixture beside an independent verified final',async()=>{
  const bad=structuredClone(seedCards[1]);
  transport(input=>{input.pages[0].content[1].status='UNKNOWN';input.pages[0].content[2].status='C';input.pages[0].content[2].teams[0].score=2;input.pages[0].content[2].teams[1].score=0;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});
  assert.deepEqual(final(seedCards[1]),bad,'Unsupported fact retains all original fields and clocks');
  assert.equal(final(seedCards[2]).status,'completed','Independent valid primary final must proceed');
  assert.equal(final(seedCards[2]).homeScore,2);assert.equal(calls.length,5);
  assert(report.deferredFixtures.some(row=>row.fixtureId===seedCards[1].id));
 });
 await check('retained delayed overlay remains explicit while independent primary facts proceed',async()=>{
  const target=seedCards[1],row={fixtureId:target.id,competitionId:target.competitionId,homeParticipantId:target.homeParticipantId,awayParticipantId:target.awayParticipantId,roundNumber:target.roundNumber,homeScore:0,awayScore:2,providerFixtureId:'controlled-backup',sourceUrl:'https://www.football-data.org/',sourceCheckedAt:OLD,sourceUpdatedAt:new original.Date(Date.parse(target.startTimeUtc)+7200000).toISOString()},overlay={schemaVersion:'football-delayed-results.v1',results:[row]};
  files.set(ROOT+'/data/canonical/football-delayed-results.v1.json',Buffer.from(JSON.stringify(overlay)));
  editFeeds(events=>{const i=events.findIndex(e=>e.id===target.id);events[i]=require('../lib/football-delayed-results').apply([events[i]],overlay)[0];});
  const before=structuredClone(final(target));
  transport(input=>{input.pages[0].content[2].status='C';input.pages[0].content[2].teams[0].score=2;input.pages[0].content[2].teams[1].score=0;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});
  assert.equal(final(seedCards[2]).status,'completed','A retained delayed final must not suppress independent primary facts');
  assert.equal(final(target).status,'completed');assert.deepEqual(final(target).delayedResultSource,before.delayedResultSource);assert.equal(final(target).scoreCheckedAt,before.scoreCheckedAt);assert.equal(calls.length,5);
  assert(report.backup.retainedOverlayFixtureIds.includes(target.id));assert.equal(report.backup.networkRequestsAllowed,0);
 });
 await check('valid zero draw reaches both retained surfaces without new editorial claims',async()=>{
  transport(input=>{input.pages[0].content[1].status='C';input.pages[0].content[1].teams.forEach(t=>{t.score=0;});});
  await quick.refresh({source:'epl',now:new Date(AT)});
  for(const f of['feeds/incoming/events.json','data/events.json']){const event=document(f).events.find(e=>e.id===seedCards[1].id);assert.equal(event.status,'completed');assert.equal(event.homeScore,0);assert.equal(event.awayScore,0);assert.equal(event.scoreCheckedAt,AT);assert(!event.editorialPreview);assert(!event.storyline.researchDepth);assert.equal(rules.spoilerContractIssues(event).length,0);}
 });
 await check('table failure retains original table facts/date while valid fixture result proceeds',async()=>{
  const prior=document('data/canonical/afl-nrl-2026.json').ladderSnapshots.find(e=>e.competitionId===table.COMPETITION_ID);
  transport(input=>{input.pages[0].content[1].status='C';input.pages[0].content[1].teams[0].score=2;input.pages[0].content[1].teams[1].score=1;input.tableStatus=503;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.equal(final(seedCards[1]).status,'completed');assert.equal(report.resources.table.state,'retained-last-good');
  const kept=document('data/canonical/afl-nrl-2026.json').ladderSnapshots.find(e=>e.competitionId===table.COMPETITION_ID);assert.equal(kept.snapshotTimeUtc,prior.snapshotTimeUtc);assert.deepEqual(kept.entries,prior.entries);assert.equal(kept.stale,true);assert.match(kept.metadata.tableNote,/Last verified/);
 });
 await check('partial fixture page retains every card while independent valid table proceeds',async()=>{
  const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport(input=>input.pages[1].content.pop());
  const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.equal(report.resources.fixtures.state,'retained-last-good');assert.equal(report.resources.table.state,'primary');assert.equal(calls.length,3);
 });
 await check('future collection clock refuses before source work',async()=>{
  const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport();await assert.rejects(()=>quick.refresh({source:'epl',now:new Date(Date.parse(AT)+60000)}),/clock|observation|future/);assert.equal(calls.length,0);assert.deepEqual(files.get(ROOT+'/data/events.json'),before);
 });
 await check('backwards collection clock refuses before source work',async()=>{
  transport();await assert.rejects(()=>quick.refresh({source:'epl',now:new Date(Date.parse(OLD)-1000)}),/clock|observation|stale/);assert.equal(calls.length,0);
 });
 await check('a valid score correction has a new result clock and spoiler-safe copy',async()=>{
  transport(input=>{input.pages[0].content[0].teams[0].score=2;input.pages[0].content[0].teams[1].score=0;});
  await quick.refresh({source:'epl',now:new Date(AT)});const e=final(seedCards[0]);assert.equal(e.homeScore,2);assert.equal(e.scoreCheckedAt,AT);assert.equal(e.resultSourceCheckedAt,AT);assert(!e.editorialPreview);assert.equal(rules.spoilerContractIssues(e).length,0);assert(!e.storyline.researchDepth);
 });
 await check('fixture-only source does not fabricate or replace a retained viewing review',async()=>{
  const review=[{providerId:'stan',rightsScope:'fixture',sourceUrl:'https://www.stan.com.au/reviewed-fixture',verifiedAt:OLD,customEvidence:'retained'}];
  editFeeds(rows=>{rows[0+1].viewingOptions=structuredClone(review);});
  transport(input=>{input.pages[0].content[0].teams[0].score=2;input.pages[0].content[0].teams[1].score=0;});
  await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(final(seedCards[0]).viewingOptions,review);
 });
 await check('past confirmed final cannot be replaced by a future kickoff',async()=>{
  const prior=Buffer.from(files.get(ROOT+'/data/events.json'));transport(input=>{input.pages[0].content[0].kickoff.millis=Date.parse(AT)+3600000;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.equal(report.resources.fixtures.state,'retained-last-good');assert.deepEqual(files.get(ROOT+'/data/events.json'),prior);
 });
 await check('coherent but regressed table retains its original observation',async()=>{
  const frame=tablePayload();for(const e of frame.tables[0].entries)Object.assign(e.overall,{played:2,drawn:2,points:2});
  const context=table.buildSnapshot(frame,directory,OLD);files.set(ROOT+'/data/canonical/afl-nrl-2026.json',Buffer.from(JSON.stringify(table.updateBundle(seed,context,OLD))));
  transport();const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.equal(report.resources.table.state,'retained-last-good');
  const kept=document('data/canonical/afl-nrl-2026.json').ladderSnapshots.find(e=>e.competitionId===table.COMPETITION_ID);assert.equal(kept.snapshotTimeUtc,OLD);assert(kept.entries.every(e=>e.played===2));assert(kept.stale);
 });
 await check('official reschedule keeps its stable identity and independent final clock',async()=>{
  transport(input=>{const fixture=input.pages[0].content[0];fixture.kickoff.millis-=3600000;fixture.provisionalKickoff.millis=fixture.kickoff.millis;});
  await quick.refresh({source:'epl',now:new Date(AT)});const e=final(seedCards[0]);assert.equal(e.id,seedCards[0].id);assert.equal(e.startTimeUtc,new Date(fixtures[0].kickoff.millis-3600000).toISOString());assert.equal(e.scoreCheckedAt,OLD);assert.equal(e.resultSourceCheckedAt,OLD);
 });
 await check('reschedule defers only the old fixture-bound viewing review',async()=>{
  const review=[{providerId:'stan',rightsScope:'fixture',sourceUrl:'https://www.stan.com.au/reviewed-fixture',verifiedAt:OLD},{providerId:'stan',rightsScope:'competition',verifiedAt:'2026-08-25T00:00:00.000Z'}];
  editFeeds(rows=>{rows[2].viewingOptions=structuredClone(review);});transport(input=>{input.pages[0].content[1].kickoff.millis+=3600000;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(final(seedCards[1]).viewingOptions,[review[1]]);assert.deepEqual(report.deferredViewingFixtureIds,[seedCards[1].id]);
 });
 await check('reviewed primary alias keeps the original saved record ID',async()=>{
  const original=seedCards[1],alias=original.sourceEventIds.find(id=>id.startsWith('football-premier-league-'));
  assert(alias);editFeeds(rows=>{rows[2].id=alias;});transport(input=>{input.pages[0].content[1].status='C';input.pages[0].content[1].teams[0].score=1;input.pages[0].content[1].teams[1].score=0;});
  await quick.refresh({source:'epl',now:new Date(AT)});const e=document('data/events.json').events.find(e=>e.id===alias);assert.equal(e.status,'completed');assert.equal(e.homeScore,1);assert.equal(e.canonicalEventId,original.canonicalEventId);
 });
 for(const[name,edit]of[
  ['wrong-season',p=>{p.pages[0].content[1].gameweek.compSeason.id=999;}],
  ['duplicate-ID',p=>{p.pages[3].content[0].id=p.pages[0].content[1].id;}],
  ['wrong-club-order',p=>{p.pages[0].content[0].teams.reverse();}],
  ['reopened-final',p=>{p.pages[0].content[0].status='U';}],
 ])await check(name+' retains all last-good fixtures and reports the deferred collection',async()=>{
  const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport(edit);const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.equal(report.resources.fixtures.state,'retained-last-good');assert.equal(report.publicationState,'partial-candidate');assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert(calls.length<=5);assert(report.failures.length);
 });
 for(const[name,edit]of[
  ['unreviewed-status',f=>{f.status='UNKNOWN';}],
  ['unreviewed-live-phase',f=>{f.status='L';f.phase='PAUSE_UNREVIEWED';f.teams.forEach(t=>t.score=0);}],
  ['incomplete-final-score',f=>{f.status='C';f.teams[0].score=1;}],
  ['missing-kickoff',f=>{delete f.kickoff;}],
 ])await check(name+' retains that card while independent verified final proceeds',async()=>{
  const prior=structuredClone(final(seedCards[1]));transport(input=>{edit(input.pages[0].content[1]);const good=input.pages[0].content[2];good.status='C';good.teams[0].score=1;good.teams[1].score=0;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(final(seedCards[1]),prior);assert.equal(final(seedCards[2]).status,'completed');assert.equal(report.resources.fixtures.state,'partial-primary');assert(report.deferredFixtures.some(row=>row.fixtureId===prior.id));assert.equal(report.resources.table.state,'primary');assert.equal(calls.length,5);assert.equal(report.backup.networkRequestsAllowed,0);
 });
 await check('a deferred fixture preserves different last-good facts on incoming and published surfaces',async()=>{
  const published=document('data/events.json');const slot=published.events.findIndex(e=>e.id===seedCards[1].id);published.events[slot]={...published.events[slot],status:'completed',score:'Retained published final',scoreCheckedAt:OLD,resultSourceCheckedAt:OLD,homeScore:3,awayScore:1};files.set(ROOT+'/data/events.json',Buffer.from(JSON.stringify(published)));
  const incomingBefore=structuredClone(document('feeds/incoming/events.json').events.find(e=>e.id===seedCards[1].id)),publishedBefore=structuredClone(final(seedCards[1]));
  transport(input=>{input.pages[0].content[1].status='UNKNOWN';const good=input.pages[0].content[2];good.status='C';good.teams[0].score=1;good.teams[1].score=0;});
  const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(final(seedCards[1]),publishedBefore);assert.deepEqual(document('feeds/incoming/events.json').events.find(e=>e.id===seedCards[1].id),incomingBefore);assert.equal(final(seedCards[2]).status,'completed');assert.equal(report.resources.fixtures.state,'partial-primary');assert.equal(calls.length,5);
 });
 await check('unsupported facts cannot hide an unknown primary fixture identity',async()=>{
  const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport(input=>{const f=input.pages[0].content[1];f.id=999999;f.status='UNKNOWN';});const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.equal(report.resources.fixtures.state,'retained-last-good');assert.equal(report.deferredFixtures.length,0);assert(report.failures.some(f=>/binding|identit/i.test(f)));assert.equal(calls.length,5);
 });
 await check('explicit primary-only backup deferral never calls the backup provider after a collection failure',async()=>{
  transport(input=>input.pages[0].content.pop());const before=Buffer.from(files.get(ROOT+'/data/events.json'));const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.equal(report.backup.state,'deferred-unallocated');assert.equal(report.backup.networkRequestsAllowed,0);assert.equal(report.backup.coordinatorInvocationCap,4);assert.match(report.backup.recovery.backupFailure,/deferred/);assert.equal(calls.length,2);
 });
 await check('primary confirmation clears the retained delayed overlay and preserves the original action ID',async()=>{
  const target=seedCards[1],row={fixtureId:target.id,competitionId:target.competitionId,homeParticipantId:target.homeParticipantId,awayParticipantId:target.awayParticipantId,roundNumber:target.roundNumber,homeScore:0,awayScore:2,sourceUrl:'https://www.football-data.org/',sourceCheckedAt:OLD,sourceUpdatedAt:new original.Date(Date.parse(target.startTimeUtc)+7200000).toISOString()},overlay={schemaVersion:'football-delayed-results.v1',results:[row]};files.set(ROOT+'/data/canonical/football-delayed-results.v1.json',Buffer.from(JSON.stringify(overlay)));editFeeds(events=>{const i=events.findIndex(e=>e.id===target.id);events[i]=require('../lib/football-delayed-results').apply([events[i]],overlay)[0];});transport(input=>{const f=input.pages[0].content[1];f.status='C';f.teams[0].score=0;f.teams[1].score=2;});await quick.refresh({source:'epl',now:new Date(AT)});assert.equal(final(target).id,target.id);assert.equal(final(target).status,'completed');assert(!final(target).delayedResultSource);assert.equal(final(target).resultSourceUrl,source.cardForFixture(fixtures[0],AT).resultSourceUrl);assert.equal(document('data/canonical/football-delayed-results.v1.json').results.length,0);assert.equal(calls.length,5);
 });
 await check('a deferred primary final does not prune its retained delayed overlay or freshen its clocks',async()=>{
  const target=seedCards[1],row={fixtureId:target.id,competitionId:target.competitionId,homeParticipantId:target.homeParticipantId,awayParticipantId:target.awayParticipantId,roundNumber:target.roundNumber,homeScore:0,awayScore:2,sourceUrl:'https://www.football-data.org/',sourceCheckedAt:OLD,sourceUpdatedAt:new original.Date(Date.parse(target.startTimeUtc)+7200000).toISOString()},overlay={schemaVersion:'football-delayed-results.v1',results:[row]};files.set(ROOT+'/data/canonical/football-delayed-results.v1.json',Buffer.from(JSON.stringify(overlay)));editFeeds(events=>{const i=events.findIndex(e=>e.id===target.id);events[i]=require('../lib/football-delayed-results').apply([events[i]],overlay)[0];});const prior=structuredClone(final(target)),bytes=Buffer.from(files.get(ROOT+'/data/canonical/football-delayed-results.v1.json'));transport(input=>{const f=input.pages[0].content[1];f.status='C';f.teams[0].score=0;delete f.teams[1].score;});const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(final(target),prior);assert.deepEqual(files.get(ROOT+'/data/canonical/football-delayed-results.v1.json'),bytes);assert(report.deferredFixtures.some(row=>row.fixtureId===target.id));assert.equal(calls.length,5);
 });
 await check('all unsupported fixture facts plus a failed table never become a successful refresh',async()=>{
  const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport(input=>{for(const page of input.pages)for(const f of page.content)f.status='UNKNOWN';input.tableStatus=503;});await assert.rejects(()=>quick.refresh({source:'epl',now:new Date(AT)}),/No supported EPL fixture facts/);assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.equal(calls.length,5);
 });
 await check('a primary live score cannot turn a retained delayed final into live or conflicting fresh facts',async()=>{
  const target=seedCards[1],row={fixtureId:target.id,competitionId:target.competitionId,homeParticipantId:target.homeParticipantId,awayParticipantId:target.awayParticipantId,roundNumber:target.roundNumber,homeScore:0,awayScore:2,sourceUrl:'https://www.football-data.org/',sourceCheckedAt:OLD,sourceUpdatedAt:new original.Date(Date.parse(target.startTimeUtc)+7200000).toISOString()},overlay={schemaVersion:'football-delayed-results.v1',results:[row]};files.set(ROOT+'/data/canonical/football-delayed-results.v1.json',Buffer.from(JSON.stringify(overlay)));editFeeds(events=>{const i=events.findIndex(e=>e.id===target.id);events[i]=require('../lib/football-delayed-results').apply([events[i]],overlay)[0];});const prior=structuredClone(final(target));transport(input=>{const f=input.pages[0].content[1];f.status='L';f.phase='1';f.teams[0].score=0;f.teams[1].score=0;const good=input.pages[0].content[2];good.status='C';good.teams[0].score=1;good.teams[1].score=0;});const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(final(target),prior);assert.equal(final(seedCards[2]).status,'completed');assert(report.backup.retainedOverlayFixtureIds.includes(target.id));assert.equal(report.resources.fixtures.acceptedPrimaryFixtures,379);assert.equal(calls.length,5);
 });
 await check('a legacy saved ID with unsupported primary facts retains its own clocks and does not suppress another final',async()=>{
  const target=seedCards[1],alias=target.sourceEventIds.find(id=>id.startsWith('football-premier-league-'));assert(alias);editFeeds(events=>{events.find(e=>e.id===target.id).id=alias;});const before=structuredClone(document('data/events.json').events.find(e=>e.id===alias));transport(input=>{input.pages[0].content[1].status='UNKNOWN';const good=input.pages[0].content[2];good.status='C';good.teams[0].score=1;good.teams[1].score=0;});const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(document('data/events.json').events.find(e=>e.id===alias),before);assert.equal(final(seedCards[2]).status,'completed');assert(report.deferredFixtures.some(row=>row.fixtureId===alias));assert.equal(calls.length,5);
 });
 await check('an unavailable saved overlay reports bounded backup deferral rather than reopening a retained delayed final',async()=>{
  editFeeds(events=>{const e=events.find(e=>e.id===seedCards[1].id);e.status='completed';e.homeScore=0;e.awayScore=2;e.score='Retained delayed final';e.scoreCheckedAt=OLD;e.resultSourceCheckedAt=OLD;e.delayedResultSource={provider:'Football-Data.org',updatedAt:OLD,checkedAt:OLD};});const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport(input=>{const good=input.pages[0].content[2];good.status='C';good.teams[0].score=1;good.teams[1].score=0;});const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.equal(report.resources.fixtures.state,'retained-last-good');assert.equal(report.backup.state,'deferred-unallocated');assert.match(report.backup.recovery.backupFailure,/deferred/);assert.equal(calls.length,5);
 });
 await check('primary confirmation retires a delayed saved alias and keeps the user-facing alias ID',async()=>{
  const target=seedCards[1],alias=target.sourceEventIds.find(id=>id.startsWith('football-premier-league-'));assert(alias);const row={fixtureId:alias,competitionId:target.competitionId,homeParticipantId:target.homeParticipantId,awayParticipantId:target.awayParticipantId,roundNumber:target.roundNumber,homeScore:0,awayScore:2,sourceUrl:'https://www.football-data.org/',sourceCheckedAt:OLD,sourceUpdatedAt:new original.Date(Date.parse(target.startTimeUtc)+7200000).toISOString()},overlay={schemaVersion:'football-delayed-results.v1',results:[row]};files.set(ROOT+'/data/canonical/football-delayed-results.v1.json',Buffer.from(JSON.stringify(overlay)));editFeeds(events=>{const i=events.findIndex(e=>e.id===target.id);events[i].id=alias;events[i]=require('../lib/football-delayed-results').apply([events[i]],overlay)[0];});transport(input=>{const f=input.pages[0].content[1];f.status='C';f.teams[0].score=1;f.teams[1].score=0;});await quick.refresh({source:'epl',now:new Date(AT)});const e=document('data/events.json').events.find(e=>e.id===alias);assert(e);assert.equal(e.homeScore,1);assert(!e.delayedResultSource);assert.equal(document('data/canonical/football-delayed-results.v1.json').results.length,0);assert.equal(calls.length,5);
 });
 for(const[name,clock]of[['future',new Date(Date.parse(AT)+1000).toISOString()],['invalid','not-a-date'],['calendar-overflow','2026-02-30T06:00:00.000Z']])await check(name+' retained result observation stops before source calls',async()=>{
  editFeeds(rows=>{rows[1].scoreCheckedAt=clock;});const before=Buffer.from(files.get(ROOT+'/data/events.json'));transport();await assert.rejects(()=>quick.refresh({source:'epl',now:new Date(AT)}),/clock|observation|stale/);assert.equal(calls.length,0);assert.deepEqual(files.get(ROOT+'/data/events.json'),before);
 });
 await check('two unavailable resources throw the first source error and preserve the full candidate',async()=>{
  const before=new Map([...files].map(([k,v])=>[k,Buffer.from(v)]));transport(input=>{input.pages[0].content.pop();input.tableStatus=503;});
  await assert.rejects(()=>quick.atomicRefresh({source:'epl',now:new Date(AT)}),/fixture page/);for(const[k,v]of before)assert.deepEqual(files.get(k),v,k);assert.equal(fds.size,0);
 });
 await check('mandatory projection failure restores data, Feed and generated runtime',async()=>{
  const before=new Map([...files].map(([k,v])=>[k,Buffer.from(v)]));failedChild='scripts/validate-feed.js';transport(input=>{input.pages[0].content[1].status='C';input.pages[0].content[1].teams[0].score=2;input.pages[0].content[1].teams[1].score=1;});
  await assert.rejects(()=>quick.atomicRefresh({source:'epl',now:new Date(AT)}),/validate-feed.js failed/);for(const[k,v]of before)assert.deepEqual(files.get(k),v,k);assert.equal(fds.size,0);
 });
 await check('repeated identical observations do not rebuild Feed or rewrite reviewed copy',async()=>{
  transport();await quick.refresh({source:'epl',now:new Date(AT)});const before=Buffer.from(files.get(ROOT+'/data/events.json'));children=[];transport();const report=await quick.refresh({source:'epl',now:new Date(AT)});assert.deepEqual(files.get(ROOT+'/data/events.json'),before);assert.deepEqual(report.changed,[]);assert.equal(children.length,0);
 });
 await check('final shared places remain pending without fabricated UEFA qualification',async()=>{
  transport(input=>{for(const row of input.table.tables[0].entries)Object.assign(row.overall,{played:38,drawn:38,points:38});});
  await quick.refresh({source:'epl',now:new Date(AT)});const snapshot=document('data/canonical/afl-nrl-2026.json').ladderSnapshots.find(e=>e.competitionId===table.COMPETITION_ID);assert(snapshot.entries.every(e=>e.rankPending===true&&e.sharedRank===true));assert(!snapshot.entries.some(e=>e.qualified||e.champion||e.relegated));assert.match(snapshot.metadata.tableNote,/no title, relegation or qualification is inferred/);
 });
 await check('actual canonical dispatcher forwards only the EPL selector and preserves Rugby dispatch',async()=>{
  const vm=require('node:vm'),{createRequire}=require('node:module'),file=path.join(__dirname,'update-cards.js'),text=original.readFileSync(file,'utf8'),start=text.indexOf('async function runMain()'),end=text.indexOf('async function main()',start);assert(start>=0&&end>start);
  for(const selected of [['--source=epl'],['--source=live-coverage','--coverage-sport=rugby-union']]){const args=['--quick',...selected,'--local-only'],steps=[],context={require:createRequire(file),process:{argv:['node',file,...args],env:{}},parseOptions:()=>require('./update-cards').parseOptions(args,{}),runStep:args=>steps.push(args),console:{log(){}}};vm.runInNewContext(text.slice(start,end)+';globalThis.invoke=runMain',context);await context.invoke();assert.deepEqual(JSON.parse(JSON.stringify(steps)),[['scripts/quick-results.js',...selected]]);}assert.equal(calls.length,0);
 });
 await check('invalid direct EPL child/options refuse before an atomic filesystem snapshot',async()=>{
  for(const args of [['--source=epl','--offline'],['--source=epl','--source=football'],['--source=epl','--source=epl'],['--source=epl','--coverage-sport=rugby-union']])assert.throws(()=>quick.parseQuickOptions(args),/EPL-only/);assert.equal(quick.parseQuickOptions(['--source=epl']).source,'epl');
  const readdir=fs.readdirSync;let snapshots=0;fs.readdirSync=()=>{snapshots++;throw Error('UNEXPECTED_INVALID_SCOPE_SNAPSHOT');};try{for(const options of [{source:'epl',offline:true},{source:'epl',coverageSport:'rugby-union'}])await assert.rejects(()=>quick.atomicRefresh(options),/EPL-only|Shared coverage|requires/);}finally{fs.readdirSync=readdir;}assert.equal(snapshots,0);assert.equal(calls.length,0);
 });
 await check('canonical EPL flags reject mixed routes before dispatch',async()=>{
  const owner=require('./update-cards');assert.equal(owner.parseOptions(['--quick','--source=epl','--local-only'],{}).localOnly,true);
  for(const args of[['--source=epl'],['--quick','--source=epl','--source=football'],['--quick','--source=epl','--offline'],['--quick','--source=epl','--reviewed-fixtures'],['--quick','--source=epl','--source=epl']])assert.throws(()=>owner.parseOptions(args,{}),/EPL-only/);
 });
 console.log(JSON.stringify({kind:'actual-EPL-quick-caller-with-native-HTTPS-and-filesystem-doubles',externalIO:0,canonicalCLIInvocations:0,records},null,2));
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{global.Date=original.Date;});
