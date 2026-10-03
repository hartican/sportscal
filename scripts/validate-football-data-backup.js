#!/usr/bin/env node
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const trial=require('./lib/football-data-trial'),backup=require('./lib/football-data-backup'),overlay=require('../lib/football-delayed-results');
const pl=require('./refresh-premier-league-cards');
const registry=require('../config/football-data-identities.json');
const checkedAt='2026-11-01T12:00:00.000Z',now=new Date(checkedAt);
const feed=JSON.parse(fs.readFileSync(path.join(__dirname,'../feeds/incoming/events.json')));
const known=feed.events.filter(e=>e.competitionId===trial.SCOPE.PL.competitionId);
const target=known.find(e=>e.status!=='completed'&&Date.parse(e.startTimeUtc)<now.getTime());
assert(target,'A scheduled EPL fixture is needed for outage rehearsal');
function payload(events=known,code='PL'){
 const scope=trial.SCOPE[code],byId=new Map(Object.entries(registry.teams).map(([id,t])=>[t.participantId,{id:Number(id),name:t.sourceName}]));
 return {competition:{code,id:scope.id},filters:{season:2026},resultSet:{count:events.length},matches:events.map((e,i)=>({id:i+1,competition:{id:scope.id},season:{startDate:'2026-08-01'},stage:scope.stage,matchday:e.roundNumber,utcDate:e.startTimeUtc,lastUpdated:checkedAt,status:e.status==='completed'?'FINISHED':'TIMED',homeTeam:byId.get(e.homeParticipantId),awayTeam:byId.get(e.awayParticipantId),score:{fullTime:{home:e.status==='completed'?e.homeScore:null,away:e.status==='completed'?e.awayScore:null}}}))};
}
function context(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-football-integration-test-')),outputPath=path.join(directory,'overlay.json');fs.writeFileSync(outputPath,JSON.stringify({schemaVersion:'football-delayed-results.v1',results:[]}));return {directory,outputPath,now};}
async function scoped(fn){const c=context();try{return await fn(c);}finally{fs.rmSync(c.directory,{recursive:true,force:true});}}
function finished(){const p=payload();const match=p.matches[known.indexOf(target)];match.status='FINISHED';match.score.fullTime={home:0,away:2};return p;}
function coordinator(p){return async(_code,resource)=>{if(resource==='standings')throw Error('table observation unavailable');return {checkedAt,payload:p};};}
test('a new explicit zero-goal final persists separately and retains every fixture, source date and viewing field',()=>scoped(async c=>{
 const before=fs.readFileSync(path.join(__dirname,'../data/providers/openligadb/football-2026-27.json'));
 const result=await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:coordinator(finished()),...c});
 assert(result.recovered);assert.equal(result.row.newFinals,1);
 assert.deepEqual(result.events.map(e=>e.id),known.map(e=>e.id));
 const recovered=result.events.find(e=>e.id===target.id);assert.equal(recovered.homeScore,0);assert.equal(recovered.awayScore,2);assert.equal(recovered.status,'completed');
 assert.equal(recovered.sourceCheckedAt,target.sourceCheckedAt);assert.deepEqual(recovered.viewingOptions,target.viewingOptions);assert.equal(recovered.startTimeUtc,target.startTimeUtc);
 assert.equal(recovered.delayedResultSource.updatedAt,checkedAt);assert.equal(recovered.resultSourceCheckedAt,checkedAt);
 assert.equal(backup.readOverlay(c.outputPath).results[0].fixtureId,target.id);
 assert.deepEqual(fs.readFileSync(path.join(__dirname,'../data/providers/openligadb/football-2026-27.json')),before);
 const stamp=fs.readFileSync(c.outputPath);await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:coordinator(finished()),...c});assert.deepEqual(fs.readFileSync(c.outputPath),stamp,'Unchanged repeated backup does not refresh facts');
 assert(overlay.standings([{competitionId:target.competitionId}],known,backup.readOverlay(c.outputPath))[0].stale);
}));
test('changed kickoff, conflicting existing final, retracted final, partial season and future provider timestamp fail closed',()=>scoped(async c=>{
 const completedIndex=known.findIndex(e=>e.status==='completed');assert(completedIndex>=0);
 for(const mutation of [p=>p.matches[0].utcDate='2026-08-01T00:00:00.000Z',p=>p.matches[completedIndex].score.fullTime.home+=1,p=>p.matches[completedIndex].status='IN_PLAY',p=>p.matches.pop(),p=>p.matches[0].lastUpdated='2027-01-01T00:00:00Z']){
  const p=finished();mutation(p);const before=fs.readFileSync(c.outputPath);
  const result=await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:coordinator(p),...c});
  assert.equal(result.recovered,false);assert.deepEqual(fs.readFileSync(c.outputPath),before);assert.deepEqual(result.events,known);
 }
}));
test('stale observations and delayed in-play states never manufacture completion or freshness',()=>scoped(async c=>{
 const stale=await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:async()=>({payload:finished(),checkedAt:'2026-10-29T12:00:00.000Z'}),...c});assert.equal(stale.recovered,false);
 const p=finished();p.matches[known.indexOf(target)].status='IN_PLAY';
 const result=await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:coordinator(p),...c});assert(result.recovered);assert.equal(result.row.newFinals,0);assert.deepEqual(result.events,known);
}));
test('the real EPL card writer uses the recovery path and preserves its fixture partition',()=>scoped(async c=>{
 const input=path.join(c.directory,'feed.json');fs.writeFileSync(input,JSON.stringify(feed));
 await pl.refreshPremierLeagueCards(input,input,{loader:async()=>{throw Error('primary unavailable');},backupOptions:{...c,coordinator:coordinator(finished())}});
 const saved=JSON.parse(fs.readFileSync(input));assert.equal(saved.events.find(e=>e.id===target.id).homeScore,0);
 assert.deepEqual(saved.events.filter(e=>e.key!=='premier-league').map(e=>e.id).sort(),feed.events.filter(e=>e.key!=='premier-league').map(e=>e.id).sort());
}));
test('an unreviewed primary status retains validated delayed-final recovery without publishing the candidate',()=>scoped(async c=>{
 const input=path.join(c.directory,'feed.json');fs.writeFileSync(input,JSON.stringify(feed));
 const candidate={id:999999,status:'QA_UNREVIEWED',kickoff:{millis:Date.parse(target.startTimeUtc)},gameweek:{gameweek:target.roundNumber,compSeason:{id:841,competition:{id:1}}},teams:[1,2].map(id=>({team:{id,club:{id},name:'Controlled QA Club '+id}}))};
 await pl.refreshPremierLeagueCards(input,input,{loader:async()=>[candidate],backupOptions:{...c,coordinator:coordinator(finished())}});
 const saved=JSON.parse(fs.readFileSync(input));assert.deepEqual(saved.events.map(e=>e.id).sort(),feed.events.map(e=>e.id).sort(),'every existing fixture ID survives and the controlled candidate cannot appear');
 const recovered=saved.events.find(e=>e.id===target.id);assert.equal(recovered.status,'completed');assert.equal(recovered.homeScore,0);assert.equal(recovered.awayScore,2);
 for(const field of ['homeParticipantId','awayParticipantId','roundNumber','startTimeUtc','sourceCheckedAt','canonicalSourceCheckedAt','viewingOptions'])assert.deepEqual(recovered[field],target[field],'backup retains the original '+field);
 const report=JSON.parse(fs.readFileSync(path.join(c.directory,'report.json')));assert(report.checks.some(row=>row.state==='backup'&&row.primaryFailure.includes('unreviewed source status')&&row.newFinals===1),'validated delayed recovery remains explicitly degraded');
}));
test('a primary outage followed by a backup outage retains a previously accepted final; primary completion later clears the overlay',()=>scoped(async c=>{
 await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:coordinator(finished()),...c});const bytes=fs.readFileSync(c.outputPath);
 const failed=await backup.recover({code:'PL',events:known,primaryError:Error('outage'),coordinator:async()=>{throw Error('second outage');},...c});assert.equal(failed.recovered,false);assert.equal(failed.events.find(e=>e.id===target.id).homeScore,0);assert.deepEqual(fs.readFileSync(c.outputPath),bytes);
 const primary=known.map(e=>e.id===target.id?{...e,status:'completed',homeScore:1,awayScore:2}:e);
 const next=backup.primary(primary,c);assert.equal(next.find(e=>e.id===target.id).homeScore,1);assert.equal(backup.readOverlay(c.outputPath).results.length,0);
}));
test('the real UCL adapter recovers finals beside a valid Europa refresh without contaminating the provider dataset',()=>scoped(async c=>{
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/providers/openligadb/football-2026-27.json')));
 const ucl=source.events.filter(e=>e.competitionId===trial.SCOPE.CL.competitionId),p=payload(ucl,'CL');
 const targetIndex=ucl.findIndex(e=>e.status!=='completed'&&Date.parse(e.startTimeUtc)<now.getTime());assert(targetIndex>=0);
 p.matches[targetIndex].status='FINISHED';p.matches[targetIndex].score.fullTime={home:1,away:0};
 const providerPath=path.join(c.directory,'provider.json');fs.writeFileSync(providerPath,JSON.stringify(source));
 const definitions=require('./lib/openligadb-football').COMPETITIONS;
 const raw=league=>league.fixtures.map(f=>({matchID:Number(f.providerFixtureId),leagueId:definitions.uel2026.leagueId,leagueShortcut:'uel2026',leagueSeason:2026,group:{groupOrderID:f.roundNumber},team1:{teamId:Number(f.participants[0].providerId),teamName:f.participants[0].sourceName},team2:{teamId:Number(f.participants[1].providerId),teamName:f.participants[1].sourceName},matchDateTimeUTC:f.startTimeUtc,matchIsFinished:f.status==='completed',matchResults:f.result?[{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:f.result.homeScore,pointsTeam2:f.result.awayScore}]:[]}));
 const result=await require('./refresh-openligadb-football').refresh({outputPath:providerPath,now,backupOptions:{...c,coordinator:coordinator(p)},fetchImpl:async url=>url.includes('/ucl/')?{ok:false,status:503}:{ok:true,json:async()=>raw(source.leagues.find(l=>l.competitionId==='competition:uefa-europa-league'))}});
 assert.equal(result.failures.length,0);assert.equal(result.primaryFailures.length,1);
 assert.equal(backup.readOverlay(c.outputPath).results.length,1);
 const persisted=JSON.parse(fs.readFileSync(providerPath));assert.deepEqual(persisted.leagues.find(l=>l.competitionId===trial.SCOPE.CL.competitionId),source.leagues.find(l=>l.competitionId===trial.SCOPE.CL.competitionId));assert(!JSON.stringify(persisted).includes('Football-Data.org'));
 const applied=overlay.apply(persisted.events,backup.readOverlay(c.outputPath));assert.equal(applied.find(e=>e.id===ucl[targetIndex].id).status,'completed');
 assert.equal(source.events.find(e=>e.id===ucl[targetIndex].id).status,ucl[targetIndex].status);
}));
test('one invocation serializes and memoizes across coordinator instances; four resources exhaust the fixed budget',()=>scoped(async c=>{
 let time=0,calls=0;const waits=[];const token='0'.repeat(32);
 const options={directory:c.directory,token,now:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},fetchImpl:async()=>{calls++;return {ok:true,text:async()=>'{"ok":true}'};}};
 const client=backup.createCoordinator(options),same=backup.createCoordinator(options);assert.strictEqual(client,same);
 await Promise.all([client('PL','matches'),same('CL','matches'),client('PL','standings'),same('CL','standings')]);
 await client('PL','matches');assert.equal(calls,4);assert.deepEqual(waits,[6500,6500,6500]);assert.equal(JSON.parse(fs.readFileSync(path.join(c.directory,'budget.json'))).calls,4);
 assert(!fs.readFileSync(path.join(c.directory,'PL-matches.json'),'utf8').includes(token));
}));
test('missing credentials, 429, timeout and echoed credentials retain data without retries or secret artifacts',()=>scoped(async c=>{
 let calls=0;const missing=backup.createCoordinator({directory:path.join(c.directory,'missing'),token:'',fetchImpl:async()=>{calls++;}});await assert.rejects(missing('PL','matches'),/unavailable/);assert.equal(calls,0);
 const token='0'.repeat(32);
 for(const [name,fetchImpl] of [['limited',async()=>({ok:false,status:429})],['echoed',async()=>({ok:true,text:async()=>JSON.stringify({token})})],['timeout',async(_url,{signal})=>{await new Promise(r=>setTimeout(r,10));assert(signal.aborted);throw Error(token);}]]){
  let attempts=0;const directory=path.join(c.directory,name);fs.mkdirSync(directory);
  const client=backup.createCoordinator({directory,token,timeoutMs:1,fetchImpl:async(...args)=>{attempts++;return fetchImpl(...args);}});
  await assert.rejects(client('PL','matches'),e=>!e.message.includes(token));await assert.rejects(client('PL','matches'));assert.equal(attempts,1);
  assert(!fs.readFileSync(path.join(directory,'PL-matches.json'),'utf8').includes(token));
 }
}));
test('backup table evidence cannot change primary table ranks or dates',()=>scoped(async c=>{
 const entries=[{participantId:'team:football:epl:1',rank:1,played:1}];const bytes=JSON.stringify(entries);
 const result=await backup.compareTable({code:'PL',entries,primaryError:Error('table outage'),coordinator:async()=>{throw Error('backup unavailable');},...c});assert.equal(result,null);assert.equal(JSON.stringify(entries),bytes);
}));
test('primary score parsing rejects null rather than turning it into a zero goal score',()=>{
 assert.equal(pl.resultScoreline({teams:[{score:null},{score:2}]},{name:'Home'},{name:'Away'}),null);
 assert.equal(pl.resultScoreline({teams:[{score:0},{score:2}]},{name:'Home'},{name:'Away'}).homeScore,0);
});

test('quick primary recovery removes backup provenance without losing the final',()=>{
 const recovered=overlay.apply([target],{results:[{fixtureId:target.id,competitionId:target.competitionId,homeParticipantId:target.homeParticipantId,awayParticipantId:target.awayParticipantId,roundNumber:target.roundNumber,homeScore:0,awayScore:2,sourceUrl:'https://www.football-data.org/',sourceCheckedAt:checkedAt,sourceUpdatedAt:checkedAt}]})[0];
 const update={...target,status:'completed',homeScore:0,awayScore:2,resultSourceUrl:'https://www.premierleague.com/en/matches/premier-league/2026-27',resultSourceCheckedAt:checkedAt,scoreCheckedAt:checkedAt};
 const result=require('./quick-results').patchKnown([recovered],[update]);assert.equal(result.count,1);assert.equal(result.events[0].delayedResultSource,undefined);assert.equal(result.events[0].sourceAttribution,undefined);assert.equal(result.events[0].homeScore,0);assert.equal(result.events[0].resultSourceUrl,update.resultSourceUrl);
});

test('published delayed facts require existing fixture identities, reviewed teams and honest timestamps',()=>{
 const doc=backup.readOverlay();assert.equal(doc.schemaVersion,'football-delayed-results.v1');assert(Array.isArray(doc.results)&&doc.results.length<=524);
 const all=[...known,...require('../data/providers/openligadb/football-2026-27.json').events];const byId=new Map(all.map(e=>[e.id,e]));const ids=new Set();
 for(const r of doc.results){const e=byId.get(r.fixtureId);assert(e&&!ids.has(r.fixtureId));ids.add(r.fixtureId);assert.equal(r.competitionId,e.competitionId);assert.equal(overlay.key(r),overlay.key(e));assert.equal(r.sourceUrl,'https://www.football-data.org/');assert(/^\d+$/.test(r.providerFixtureId));for(const field of ['homeScore','awayScore'])assert(Number.isSafeInteger(r[field])&&r[field]>=0);for(const field of ['sourceCheckedAt','sourceUpdatedAt'])assert(Number.isFinite(Date.parse(r[field]))&&Date.parse(r[field])<=Date.now());assert(Date.parse(r.sourceUpdatedAt)>=Date.parse(e.startTimeUtc));}
});

test('the actual public fallback retains delayed attribution when optional source detail fails',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),start=source.indexOf('function buildEuropeanDetail('),end=source.indexOf('function buildFixtureResultAvailability(',start);
 assert(start>=0&&end>start);
 const element=()=>({children:[],textContent:'',append(...children){this.children.push(...children);},remove(){this.removed=true;}});
 const text=node=>[node.textContent,...(node.children||[]).map(text)].join('');
 for(const primary of [undefined,{provider:'Football-Data.org'},{provider:'OpenLigaDB'}]){
  const fixture={sourceAttribution:primary,delayedResultSource:{provider:'Football-Data.org',sourceUrl:'https://www.football-data.org/'}},loads=[];
  const node=require('node:vm').runInNewContext(source.slice(start,end)+';buildFixtureDataAttribution(fixture)',{fixture,document:{createElement:element,createTextNode:textContent=>({textContent})},loadDeferredScript:url=>{loads.push(url);return Promise.reject(Error('Controlled optional helper failure'));},userPreferences:{showSpoilers:false}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(text(node),/Football data provided by the Football-Data.org API/);assert.match(text(node),/Delayed final result; primary source unavailable at recovery\./);assert(!node.removed);
  assert.equal(text(node).includes('OpenLigaDB data · ODbL'),primary?.provider==='OpenLigaDB','ODbL applies only to the primary dataset');
  assert.equal(loads.length,1);
 }
});
