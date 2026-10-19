#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const adapter=require('./lib/australian-championship');
const facts=require('./fixtures/australian-championship/2026/facts.json');
const clone=value=>structuredClone(value),project=value=>adapter.project(adapter.fromFacts(value));
const result=project(facts),document=result.document;
assert.equal(document.events.length,48);assert.equal(result.clubs.length,16);assert.equal(document.standings.length,16);
assert.equal(new Set(document.events.map(event=>event.id)).size,48);
assert.equal(new Set(document.standings.map(row=>row.groupId)).size,4);
assert.equal(document.events.filter(event=>event.status==='completed').length,8);
assert.deepEqual(document.coverage.emptyFixtureRounds,[7,8,9]);
assert(document.events.every(event=>event.roundNumber<=6));
assert.equal(document.events[0].score,'Preston Lions 0–0 Wollongong Wolves · Penalties 5–6');
assert.equal(document.events[0].sourceWinnerId,0,'unknown source winner must remain unknown');
assert.equal(document.events.filter(event=>event.scheduledEndStatus).length,3);
assert(document.events.filter(event=>event.scheduledEndStatus).every(event=>!Object.hasOwn(event,'endTimeUtc')),'equal source endpoints cannot invent a duration');
assert(document.events.every(event=>event.viewingOptions.length===0&&event.broadcastOptions.length===0&&event.viewingStatus==='unverified'));
assert(result.clubs.every(club=>club.crestUrl===null&&club.playerCoverage==='unavailable'));
const special=document.standings.find(row=>row.displayName==='Sydney United 58');
assert.equal(special.drawn,1);assert.equal(special.points,2,'published points cannot be recomputed');
const sutherland=document.standings.find(row=>row.displayName==='Sutherland Sharks');
assert.equal(sutherland.played,1);assert.equal(sutherland.won+sutherland.drawn+sutherland.lost,0,'retain inconsistent source columns');
for(const event of document.events){
 const original=facts.rounds.flatMap(round=>round.matches).find(match=>match.id===event.officialMatchId);
 const source=facts.sources.find(source=>source.key==='round-'+event.roundNumber);
 assert.equal(event.sourceCheckedAt,original.last_updated);assert.equal(event.providerResponseTimestamp,source.providerTimestamp);assert.equal(event.captureReceivedAt,source.checkedAt);
}
assert.deepEqual(project(clone(facts)),result,'replay cannot renew source clocks or mutate factual output');
const invalid=[
 ['competition',f=>f.competition.id=1],['season',f=>f.season.id=2027],
 ['missing source',f=>f.sources.pop()],['duplicate source',f=>f.sources[10]=clone(f.sources[0])],
 ['source URL',f=>f.sources[0].url='https://example.invalid/summary'],
 ['source clock',f=>f.sources[0].providerTimestamp='2099-01-01T00:00:00Z'],
 ['missing club',f=>f.clubs.pop()],['duplicate club',f=>f.clubs[1]=clone(f.clubs[0])],
 ['missing group',f=>f.groups.pop()],['duplicate rank',f=>f.groups[0].rows[1].position=f.groups[0].rows[0].position],
 ['missing points',f=>delete f.groups[0].rows[0].points],
 ['missing round',f=>f.rounds.pop()],['duplicate round',f=>f.rounds[8]=clone(f.rounds[7])],
 ['invented finals',f=>f.rounds[8].matches.push(clone(f.rounds[0].matches[0]))],
 ['duplicate fixture',f=>f.rounds[0].matches[1]=clone(f.rounds[0].matches[0])],
 ['missing result',f=>f.rounds[0].matches[0].result=null],
 ['future fixture clock',f=>f.rounds[0].matches[0].last_updated='2099-01-01T00:00:00Z'],
 ['backwards end',f=>f.rounds[0].matches[0].end_date='2000-01-01T00:00:00Z'],
 ['unknown opponent',f=>f.rounds[0].matches[0].awayClubId=-1],
 ['logo field',f=>f.clubs[0].logo='https://example.invalid/logo.png'],
 ['raw body field',f=>f.rawBody='unnecessary'],['operational field',f=>f.sources[0].requestBudget=11],
];
for(const [label,change] of invalid){const changed=clone(facts);change(changed);assert.throws(()=>project(changed),undefined,label);}
// Exercise the existing writer only against constructed disposable directories.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-champ-facts-'));
try{
 const canonical=path.join(temp,'data/canonical');fs.mkdirSync(canonical,{recursive:true});
 const peer={sources:[{id:'source:peer',checkedAt:'2001-01-01T00:00:00Z'}],leagues:[{id:'competition:peer'}],teams:[{id:'team:peer',leagueId:'competition:peer'}],players:[{id:'player:peer',leagueId:'competition:peer'}],checkedAt:'2001-01-01T00:00:00Z'};
 const index={teams:[{id:'team:peer',leagueId:'competition:peer',retained:true}],players:[{id:'player:peer'}]};
 fs.writeFileSync(path.join(canonical,'football-directory.v1.json'),JSON.stringify(peer));fs.writeFileSync(path.join(canonical,'football-follow-index.v1.json'),JSON.stringify(index));
 const captureFolder=path.join(__dirname,'fixtures/australian-championship/2026');
 const first=adapter.apply({root:temp,captureFolder});assert.equal(first.changed.length,6);
 const written=JSON.parse(fs.readFileSync(path.join(canonical,'football-directory.v1.json'),'utf8'));
 assert.deepEqual(written.players,peer.players);assert.deepEqual(written.teams[0],peer.teams[0]);assert.equal(written.checkedAt,peer.checkedAt);assert.equal(written.leagues.length,2);
 const before=adapter.outputPaths().map(name=>fs.readFileSync(path.join(temp,name)));
 assert.deepEqual(adapter.apply({root:temp,captureFolder}).changed,[],'second apply changes zero bytes');
 adapter.outputPaths().forEach((name,i)=>assert(before[i].equals(fs.readFileSync(path.join(temp,name)))));
 const invalidFolder=path.join(temp,'invalid');fs.mkdirSync(invalidFolder);const bad=clone(facts);bad.rounds.pop();fs.writeFileSync(path.join(invalidFolder,'facts.json'),JSON.stringify(bad));
 assert.throws(()=>adapter.apply({root:temp,captureFolder:invalidFolder}));
 adapter.outputPaths().forEach((name,i)=>assert(before[i].equals(fs.readFileSync(path.join(temp,name)))),'invalid source changes no output');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({passed:true,fixtures:48,clubs:16,groupTables:4,emptyFinalsRounds:[7,8,9],constructedRejectionCases:invalid.length,writer:'disposable fixture only; six-file idempotence and prewrite rejection',sourceTransport:'none',limits:'Retained factual projection and constructed local tests; no new source freshness, full app integration, production or physical-device evidence'}));
