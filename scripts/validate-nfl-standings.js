'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const api=require('./lib/nfl-standings'),{buildNfl}=require('./refresh-nfl-ice-hockey'),quick=require('./quick-results');
const captured=require('./fixtures/nfl-standings-20261004.json'),directory=require('../data/canonical/american-football-directory.v1.json');
const checkedAt='2026-10-04T10:29:49.683Z',later='2026-10-05T10:29:49.683Z',options={teamIds:directory.teams.map(t=>t.id),checkedAt,now:new Date(checkedAt)};
const rows=api.parse(captured,options);assert.equal(rows.length,32);
for(const conferenceId of ['AFC','NFC'])assert.deepEqual(rows.filter(r=>r.conferenceId===conferenceId).map(r=>r.conferenceSeed),Array.from({length:16},(_,i)=>i+1),'seeds are ordered separately in each conference');
assert.equal(rows.find(r=>r.participantId==='team:nfl:kc').wins,3);assert.equal(rows.find(r=>r.participantId==='team:nfl:hou').wins,0,'a sourced zero remains zero');
let rejected=0;
for(const mutate of [p=>p.season.year=2025,p=>p.children.pop(),p=>p.children[0].standings.entries.pop(),p=>p.children[0].standings.seasonType=3,p=>p.children[0].standings.entries[0].team.abbreviation='UNKNOWN',p=>p.children[0].standings.entries[1].team.abbreviation=p.children[0].standings.entries[0].team.abbreviation,p=>p.children[0].standings.entries[0].stats[0].value=null,p=>p.children[0].standings.entries[0].stats[0].value='',p=>p.children[0].standings.entries[0].stats[0].value=true,p=>p.children[0].standings.entries[0].stats[0].value=-1,p=>p.children[0].standings.entries[0].stats[0].value=1.5,p=>p.children[0].standings.entries[0].stats[0].value=[],p=>p.children[0].standings.entries[0].stats.find(s=>s.name==='pointDifferential').value=999,p=>p.children[0].standings.entries[1].stats.find(s=>s.name==='playoffSeed').value=1,p=>p.children[0].standings.entries[0].stats.find(s=>s.name==='winPercent').value=.5,p=>p.children[0].id='99']){const p=structuredClone(captured);mutate(p);assert.throws(()=>api.parse(p,options),/NFL standings:/);rejected++;}
for(const date of ['invalid','2026-02-30T00:00:00.000Z',later])assert.throws(()=>api.parse(captured,{...options,checkedAt:date}),/observation date/);
const same=api.parse(captured,{...options,checkedAt:later,now:new Date(later)});assert.strictEqual(api.retainDates(rows,same),rows,'unchanged response retains original observations');
const conflict=structuredClone(rows);conflict[0].wins++;assert.throws(()=>api.retainDates(rows,conflict),/stale or conflicting/);conflict[0].asOf='2026-10-03T00:00:00.000Z';assert.throws(()=>api.retainDates(rows,conflict),/stale or conflicting/);
assert(quick.projectionSteps(['NFL standings 32']).some(step=>step[0]==='scripts/build-code-inspector.js'&&step[1]==='--codes=american-football'));
assert(!quick.projectionSteps(['NFL standings 32']).some(step=>/publish-feed|build-paged-feed|sync-canonical/.test(step[0])),'table update cannot republish fixture facts');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-nfl-table-'));try{
  const filePath=path.join(temp,'directory.json'),baseline={...directory,fixtures:[],standings:[]};fs.writeFileSync(filePath,JSON.stringify(baseline,null,2)+'\n');let calls=0;
  const fetchJson=async url=>{assert.equal(url,api.SOURCE_URL);calls++;return captured;};
  const result=await quick.refreshNflStandings({filePath,fetchJson,clock:()=>new Date(checkedAt)});assert(result.changed);assert.equal(calls,1);
  const persisted=JSON.parse(fs.readFileSync(filePath));assert.deepEqual(persisted.standings,rows);assert.deepEqual({...persisted,standings:[]},baseline,'actual quick persistence preserves all fixture/roster/aggregate facts');
  const bytes=fs.readFileSync(filePath);const again=await quick.refreshNflStandings({filePath,fetchJson,clock:()=>new Date(later)});assert(!again.changed);assert.equal(again.retainedFactAt,checkedAt);assert(bytes.equals(fs.readFileSync(filePath)),'unchanged rerun writes no new fact dates');
  for(const fetchJson of [async()=>{throw Error('HTTP 503');},async()=>({...captured,children:captured.children.slice(0,1)})]){await assert.rejects(()=>quick.refreshNflStandings({filePath,fetchJson,clock:()=>new Date(later)}));assert(bytes.equals(fs.readFileSync(filePath)),'failed/partial check preserves exact last-good bytes');}
  const corrected=structuredClone(captured),stats=corrected.children[0].standings.entries[0].stats;stats.find(s=>s.name==='pointsFor').value++;stats.find(s=>s.name==='pointDifferential').value++;
  const correction=await quick.refreshNflStandings({filePath,fetchJson:async()=>corrected,clock:()=>new Date(later)});assert(correction.changed);assert.equal(correction.retainedFactAt,later,'validated correction has its own genuine observation');
  const teams={sports:[{leagues:[{teams:directory.teams.map(t=>({team:{abbreviation:t.id.split(':').at(-1),displayName:t.displayName,shortDisplayName:t.shortName,logos:[],links:[]}}))}]}]};
  const fixtureResources=require('./fixtures/nfl-current-season-20261005.json').resources,fixtureRoutes=require('./lib/nfl-results').resources();
  const fullOptions={clock:()=>new Date('2026-10-04T18:46:00.000Z'),previous:{...directory,fixtures:[],standings:[]}};
  const recent=require('./lib/nfl-results').recentResource(fullOptions.clock());
  const recentPayload={...fixtureResources[0].payload,events:fixtureResources[0].payload.events.filter(e=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(e.date))===recent.day)};
  const callsFull=[];const full=await buildNfl({...fullOptions,fetchSource:async url=>{callsFull.push(url);return url===api.SOURCE_URL?captured:url.endsWith('/teams')?teams:url===recent.url?recentPayload:url.includes('/scoreboard?')?fixtureResources[fixtureRoutes.findIndex(r=>r.url===url)].payload: {athletes:[]};}});
  assert.equal(full.standings.length,32,'real full NFL builder reads the current conference tables');assert.equal(callsFull.filter(url=>url===api.SOURCE_URL).length,1,'full owner keeps one existing standings request');
  assert.deepEqual(full.standings.map(({asOf,stale,staleNote,...r})=>r),rows.map(({asOf,...r})=>r));
  if(directory.standings.length){const failed=await buildNfl({...fullOptions,previous:{...directory,fixtures:[]},fetchSource:async url=>{if(url===api.SOURCE_URL)throw Error('HTTP 503');return url.endsWith('/teams')?teams:url===recent.url?recentPayload:url.includes('/scoreboard?')?fixtureResources[fixtureRoutes.findIndex(r=>r.url===url)].payload:{athletes:[]};}});assert.deepEqual(failed.standings.map(({stale,staleNote,...r})=>r),directory.standings.map(({stale,staleNote,...r})=>r),'full owner retains the published table on optional failure');}
  const published=require('../data/code-inspector/american-football.json');if(published.standings.length){assert.equal(published.standings.length,32);assert.equal(published.coverageStatus,'partial');for(const r of published.standings)assert.equal(r.rank,r.conferenceSeed,'projector retains the supplied conference seed');}
  console.log(`NFL standings: actual full/quick ingestion, 32 known clubs, 2 seed scopes, ${rejected+3} invalid controls, unchanged reruns, last-good failures, real correction and fixture-preserving persistence pass.`);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
