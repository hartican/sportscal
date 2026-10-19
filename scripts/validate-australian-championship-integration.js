#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const adapter=require('./lib/australian-championship'),follow=require('../config/follow-first');
const root=path.resolve(__dirname,'..'),folder=path.join(__dirname,'fixtures/australian-championship/2026');
async function validateRetainedPeerGuard(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-champ-peer-guard-')),inspector=path.join(temp,'data/code-inspector'),manifest=require('../data/code-inspector/manifest.json'),writes=[],applies=[];
 const vm=require('node:vm'),{createRequire}=require('node:module');
 // Run the actual modules with a disposable ROOT and their real dependencies.
 // Mutators are tripwires, so a failed guard cannot write through peer symlinks.
 const readOnlyFs=Object.create(fs);
 for(const method of ['writeFileSync','mkdirSync','renameSync','rmSync','unlinkSync','appendFileSync','copyFileSync'])readOnlyFs[method]=(...args)=>{writes.push({method,path:String(args[0])});throw Error('Peer guard attempted a write');};
 const load=(name,overrides={})=>{
  const filename=path.join(__dirname,name),realRequire=createRequire(filename),mod={exports:{}};
  const localRequire=id=>id==='node:fs'?readOnlyFs:Object.hasOwn(overrides,id)?overrides[id]:realRequire(id);
  const script=fs.readFileSync(filename,'utf8').replace(/^#![^\n]*\n/,'')+(name==='update-cards.js'?'\nmodule.exports.guardTestMain=main;':'');
  vm.runInThisContext('(function(require,module,exports,__dirname,__filename,process){'+script+'\n})',{filename})(localRequire,mod,mod.exports,path.join(temp,'scripts'),filename,{...process,argv:[process.execPath,filename,'--australian-championship','--capture='+folder,'--local-only','-p'],env:{...process.env,REFRESH_REPORT:''}});
  return mod.exports;
 };
 try{
  fs.mkdirSync(inspector,{recursive:true});fs.mkdirSync(path.join(temp,'data/follow-schedule'),{recursive:true});
  for(const code of manifest.codes){fs.symlinkSync(path.join(root,'data/code-inspector',code.slug+'.json'),path.join(inspector,code.slug+'.json'));fs.symlinkSync(path.join(root,code.followSchedulePath),path.join(temp,code.followSchedulePath));}
  const builder=load('build-code-inspector.js'),owner=load('update-cards.js',{'./build-code-inspector':builder,'./lib/australian-championship':{...adapter,apply:()=>{applies.push('apply');throw Error('Canonical apply reached before peer guard');}}});
  const save=value=>fs.writeFileSync(path.join(inspector,'manifest.json'),JSON.stringify(value));
  save(manifest);assert.equal(builder.preflightRetainedFootballOnly().codes.length,manifest.codes.length);assert(owner.parseOptions(['--australian-championship','--capture='+folder,'--local-only']).australianChampionship);
  const cases=[['omitted Tennis row, existing chunk retained',m=>m.codes=m.codes.filter(c=>c.slug!=='tennis')],['duplicate row',m=>m.codes[m.codes.length-1]=m.codes[0]],['unknown row',m=>m.codes[m.codes.length-1]={...m.codes.at(-1),id:'sport:unknown-peer',slug:'unknown-peer'}],['unknown row without identity',m=>m.codes[m.codes.length-1]={slug:'unknown-peer'}],['mismatched known id and slug',m=>{[m.codes[0].id,m.codes[1].id]=[m.codes[1].id,m.codes[0].id];}]];
  for(const [label,change]of cases){
   const bad=structuredClone(manifest);change(bad);save(bad);const before=fs.readFileSync(path.join(inspector,'manifest.json'),'utf8');
   assert(fs.existsSync(path.join(inspector,'tennis.json')),'omitted-row regression keeps its real chunk present');
   assert.throws(()=>builder.preflightRetainedFootballOnly(),/complete existing Code manifest/,label);
   assert.throws(()=>builder.build({codeSlugs:['football'],retainedFootballOnly:true}),/complete existing Code manifest/,'builder rejects '+label);
   await assert.rejects(owner.guardTestMain(),/complete existing Code manifest/,'canonical owner rejects '+label+' before apply');
   assert.equal(fs.readFileSync(path.join(inspector,'manifest.json'),'utf8'),before);assert.equal(writes.length,0);assert.equal(applies.length,0);
  }
  const tennis=manifest.codes.find(code=>code.slug==='tennis'),schedule=path.join(temp,tennis.followSchedulePath);
  fs.unlinkSync(schedule);
  const rejectSchedule=async(value,pattern,label)=>{
   save(value);const before=fs.readFileSync(path.join(inspector,'manifest.json'),'utf8');
   assert.throws(()=>builder.preflightRetainedFootballOnly(),pattern,label);
   assert.throws(()=>builder.build({codeSlugs:['football'],retainedFootballOnly:true}),pattern,'builder rejects '+label);
   await assert.rejects(owner.guardTestMain(),pattern,'canonical owner rejects '+label+' before apply');
   assert.equal(fs.readFileSync(path.join(inspector,'manifest.json'),'utf8'),before);assert.equal(writes.length,0);assert.equal(applies.length,0);
  };
  const redirected=structuredClone(manifest);redirected.codes.find(code=>code.slug==='tennis').followSchedulePath='data/code-inspector/tennis.json';
  assert(fs.existsSync(path.join(inspector,'tennis.json'))&&!fs.existsSync(schedule),'same-code Inspector exists while genuine Schedule is missing');
  await rejectSchedule(redirected,/peer schedule path mismatch/,'redirected same-code Inspector cannot replace missing Schedule');
  await rejectSchedule(manifest,/ENOENT/,'canonical Schedule path with missing file');
  fs.symlinkSync(path.join(root,tennis.followSchedulePath),schedule);
  const football=manifest.codes.find(code=>code.slug==='football'),footballSchedule=path.join(temp,football.followSchedulePath);
  fs.unlinkSync(footballSchedule);await rejectSchedule(manifest,/ENOENT/,'Football peer-copy requires its genuine Schedule before apply');fs.symlinkSync(path.join(root,football.followSchedulePath),footballSchedule);
  save(manifest);assert.equal(builder.preflightRetainedFootballOnly().codes.length,manifest.codes.length);assert(owner.parseOptions(['--australian-championship','--capture='+folder,'--local-only']).australianChampionship);
  console.log('Retained peer guard: valid canonical inventory/paths accepted; omitted/duplicate/unknown/mismatched entries, redirected same-code Inspector and missing genuine Schedule rejected by preflight, builder and canonical owner; zero apply calls/writes.');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
async function main({pure=process.argv.includes('--pure')}={}){
 await validateRetainedPeerGuard();if(process.argv.includes('--peer-guard-only'))return;
 const capture=adapter.loadCapture(folder),result=adapter.project(capture),events=result.document.events,byId=new Map(events.map(e=>[e.officialMatchId,e]));
 const first=events[0];
 const moved=structuredClone(capture),m=moved.documents['round-2'].rounds[0];m.start_date=new Date(Date.parse(m.start_date)+600000).toISOString();m.end_date=new Date(Date.parse(m.end_date)+600000).toISOString();assert.equal(adapter.project(moved).document.events.find(e=>e.officialMatchId===m.id).id,byId.get(m.id).id,'rescheduling retains source-bound activity identity');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-championship-contract-'));
 try{
  const target=path.join(temp,'capture');fs.mkdirSync(target);const badFacts=structuredClone(require('./fixtures/australian-championship/2026/facts.json'));badFacts.rounds.pop();fs.writeFileSync(path.join(target,'facts.json'),JSON.stringify(badFacts));assert.throws(()=>adapter.loadCapture(target),/Australian Championship/);
  const valid=['--australian-championship','--capture='+folder,'--local-only','-p'];assert(require('./update-cards').parseOptions(valid).australianChampionship);
  for(const args of [valid.filter(x=>x!=='--local-only'),valid.filter(x=>!x.startsWith('--capture=')),[...valid,'--quick'],[...valid,'--offline'],[...valid,'--a-league'],[...valid,'--capture='+folder],['--australian-championship','--capture='+target,'--local-only']])assert.throws(()=>require('./update-cards').parseOptions(args));
  const report=path.join(temp,'report.json');fs.writeFileSync(report,'untouched');assert.throws(()=>require('./update-cards').parseOptions(valid,{REFRESH_REPORT:report}),/REFRESH_REPORT/);assert.equal(fs.readFileSync(report,'utf8'),'untouched');
  const builder=require('./build-code-inspector');assert.throws(()=>builder.build({codeSlugs:['tennis'],retainedFootballOnly:true}),/exactly/);
  const partial=path.join(temp,'partial-inspector');fs.mkdirSync(partial);fs.copyFileSync(path.join(root,'data/code-inspector/manifest.json'),path.join(partial,'manifest.json'));assert.throws(()=>builder.preflightRetainedFootballOnly(partial),/ENOENT/,'missing peers fail before any fallback or write');assert.equal(fs.readdirSync(partial).length,1);
  for(const args of [['--retained-football-only'],['--retained-football-only','--codes=tennis'],['--retained-football-only','--codes=football','--check']]){
   const child=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'build-code-inspector.js'),...args],{cwd:root,env:process.env,encoding:'utf8'});assert.notEqual(child.status,0);assert(child.stderr.includes('permits only'),'invalid builder arguments reject before writes');
  }
  const savedRoot=path.join(temp,'root');
  for(const name of ['data/canonical/football-directory.v1.json','data/canonical/football-follow-index.v1.json']){fs.mkdirSync(path.dirname(path.join(savedRoot,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(savedRoot,name));}
  const before=JSON.parse(fs.readFileSync(path.join(savedRoot,'data/canonical/football-directory.v1.json'))),firstApply=adapter.apply({root:savedRoot,captureFolder:folder}),after=JSON.parse(fs.readFileSync(path.join(savedRoot,'data/canonical/football-directory.v1.json')));
  assert.equal(firstApply.networkRequests,0);assert.equal(after.generatedAt,before.generatedAt);assert.deepEqual(after.players,before.players);assert.deepEqual(after.teams.filter(t=>t.leagueId!==adapter.COMPETITION),before.teams.filter(t=>t.leagueId!==adapter.COMPETITION));assert.deepEqual(after.leagues.filter(t=>t.id!==adapter.COMPETITION),before.leagues.filter(t=>t.id!==adapter.COMPETITION));assert.deepEqual(adapter.apply({root:savedRoot,captureFolder:folder}).changed,[],'retained replay is byte-idempotent and renews no clock');
  const rebuilt=adapter.preserveDirectory({...before,leagues:before.leagues.filter(l=>l.id!==adapter.COMPETITION),teams:before.teams.filter(l=>l.leagueId!==adapter.COMPETITION)},after);assert.equal(rebuilt.teams.filter(t=>t.leagueId===adapter.COMPETITION).length,16);assert.equal(rebuilt.leagues.find(l=>l.id===adapter.COMPETITION).sourceCheckedAt,after.leagues.find(l=>l.id===adapter.COMPETITION).sourceCheckedAt);
  const maintenance=require('./lib/football-directory-maintenance'),requests=[];
  const current=await maintenance.refreshDue({root:savedRoot,now:new Date(after.generatedAt),fetchImpl:()=>{throw Error('No source allowed');}});assert.equal(current.requests,0);assert.equal(current.retainedOnly[0].leagueId,adapter.COMPETITION);
  const due=await maintenance.refreshDue({root:savedRoot,now:new Date(Date.parse(after.generatedAt)+31*86400000),fetchImpl:async url=>{
   requests.push(url);assert(!url.includes('ffa.football')&&!url.includes('australian-championship'),'maintenance cannot add a new Championship provider');
   const code=url.match(/soccer\/([^/]+)\//)?.[1],key=Object.entries({'premier-league':'eng.1',bundesliga:'ger.1','la-liga':'esp.1','serie-a':'ita.1','ligue-1':'fra.1','a-league-men':'aus.1'}).find(([,v])=>v===code)?.[0];assert(key);
   const league=after.leagues.find(l=>l.key===key),club=url.match(/teams\/(\d+)\/roster/),teams=after.teams.filter(t=>t.leagueId===league.id);
   const payload=club?{athletes:after.players.filter(p=>p.currentTeamId===teams.find(t=>String(t.externalIds.espn)===club[1])?.id).map(p=>({id:p.externalIds.espn}))}:{sports:[{leagues:[{teams:teams.map(t=>({team:{id:t.externalIds.espn}}))}]}]};return{ok:true,text:async()=>JSON.stringify(payload)};
  }});
  assert.equal(due.requests,requests.length);assert.equal(due.retainedOnly[0].checkedAt,after.leagues.find(l=>l.id===adapter.COMPETITION).sourceCheckedAt);
  const maintained=JSON.parse(fs.readFileSync(path.join(savedRoot,'data/canonical/football-directory.v1.json')));assert.deepEqual(maintained.teams.filter(t=>t.leagueId===adapter.COMPETITION),after.teams.filter(t=>t.leagueId===adapter.COMPETITION));assert.deepEqual(maintained.sources.filter(s=>s.id.startsWith(adapter.sourceId(''))),after.sources.filter(s=>s.id.startsWith(adapter.sourceId(''))));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 if(pure){console.log('Championship integration preflight: factual snapshot/route guards, peer preservation, idempotence and six-source maintenance passed.');return;}
 const document=require('../data/football/fixtures/australian-championship.json');assert.deepEqual(document,result.document);
 const directory=require('../data/canonical/football-directory.v1.json');assert.equal(directory.leagues.length,7);assert.equal(directory.teams.filter(t=>t.leagueId===adapter.COMPETITION).length,16);assert.equal(directory.teams.filter(t=>t.leagueId==='competition:a-leagues').length,12);assert.equal(require('../data/football/fixtures/a-league-men.json').events.filter(e=>e.stage==='Regular Season').length,156);
 const league=follow.migratePreferences({version:24,preferenceGraph:{competitionPreferences:[{competitionId:adapter.COMPETITION,enabled:true}]}}),broad=follow.migratePreferences({version:24,followedSports:['football'],selectedSelectorEntityIds:['sport:football']});
 assert.equal(events.filter(e=>follow.reasonForEvent(e,league)).length,48,'explicit Championship league must admit all published matches');assert.equal(events.filter(e=>follow.reasonForEvent(e,broad)).length,0,'broad Football alone does not opt into the new league');
 const club=follow.migratePreferences({version:24,preferenceGraph:{entityFollows:[{participantId:first.homeParticipantId,followLevel:'follow'}]}}),expected=events.filter(e=>e.participantIds.includes(first.homeParticipantId));assert.equal(events.filter(e=>follow.reasonForEvent(e,club)).length,expected.length);
 const muted=structuredClone(league);muted.preferenceGraph.entityFollows=[{participantId:first.homeParticipantId,followLevel:'mute'}];assert.equal(follow.reasonForEvent(first,muted),null);
 const excluded=structuredClone(league);excluded.preferenceGraph.competitionPreferences[0].enabled=false;assert.equal(events.filter(e=>follow.reasonForEvent(e,excluded)).length,0);
 const domainOff=structuredClone(league);domainOff.preferenceGraph.domainPreferences=[{sportDomainId:'sport:football',enabled:false}];assert.equal(events.filter(e=>follow.reasonForEvent(e,domainOff)).length,0,'explicit sport exclusion remains authoritative over a league follow');
 const resolved=require('../lib/follow-fixture-resolver').resolveUserFollowFixtures({events:[],userState:{preferences:league},includeCompactArtifact:false});assert.equal(resolved.events.filter(e=>e.competitionId===adapter.COMPETITION).length,48,'server resolver loads explicit league without a club follow/global seed');
 const inspector=require('../data/code-inspector/football.json');assert.equal(inspector.fixtures.filter(e=>e.competitionId===adapter.COMPETITION).length,48);assert.equal(inspector.standings.filter(e=>e.competitionId===adapter.COMPETITION).length,16);assert.equal(new Set(inspector.standings.filter(e=>e.competitionId===adapter.COMPETITION).map(r=>r.groupId)).size,4);
 console.log('Championship integration: exact retained projection, league/club/exclusion admission,server resolver,Inspector groups,and six prior leagues preserved.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,validateRetainedPeerGuard};
