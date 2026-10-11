'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const capture=require('./fixtures/football-table-freshness-20261012.json');
const {environment,render,all,Element}=require('./validate-football-card-privacy');
const helper=require('../config/feed-card-presentation');
const current=require('../data/code-inspector/football.json');
const note='Table and recorded match results do not yet agree.';
const original=capture.fixtures.find(f=>f.id===capture.currentFixture.id);
const baseline=()=>({code:{id:'sport:football'},fixtures:structuredClone(capture.fixtures),standings:structuredClone(capture.standings)});
async function card(doc,fixture,state={global:true}){
 const env=environment(state);env.doc.fixtures=doc.fixtures;env.doc.standings=doc.standings;
 const before=JSON.stringify([doc,fixture]),preferences=JSON.stringify(env.context.userPreferences),table=await render(env,fixture);
 assert.equal(JSON.stringify([doc,fixture]),before,'Rendering preserves facts, positions and original source dates');
 assert.equal(JSON.stringify(env.context.userPreferences),preferences);assert.equal(env.reads(),0);
 return table;
}
function fullTable(doc){
 const env=environment({global:true});env.context.codeInspectorChunk=doc;
 Object.assign(env.context,{standingsRevealApproved:false,appendFootballCalendarFilters:()=>{},NOTHINGSPORTS_SURFACE_CATEGORY:{genderMatches:()=>true},followBrowseState:()=>({sportId:'sport:football'}),CANONICAL_TAXONOMY:{competitions:[]},buildFixtureDataAttribution:()=>null});
 const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/follow-schedule-panel.js'),'utf8');
 const start=source.indexOf('function renderCodeInspectorStandings('),end=source.indexOf('function followScheduleScopeMatches(',start);assert(start>=0&&end>start);
 vm.runInContext(source.slice(start,end),env.context);const panel=new Element('main');env.context.renderCodeInspectorStandings(panel,{id:'sport:football'});return panel;
}
(async()=>{
 const clean=await card(baseline(),original);assert(!clean.textContent.includes(note),'Archived matching table has no new warning');
 const changed=await card(baseline(),capture.currentFixture);assert(changed.textContent.includes(note),'An actual newer final must warn alongside its earlier table');
 const scheduleEnv=environment({global:true}),index=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const scheduleStart=index.indexOf('function liveScheduleFixtures('),scheduleEnd=index.indexOf('let feedScoreUiLoading=',scheduleStart);assert(scheduleStart>=0&&scheduleEnd>scheduleStart);
 scheduleEnv.context.NOTHINGSPORTS_FIXTURE_IDENTITY=require('../config/fixture-identity');scheduleEnv.context.codeInspectorChunk=baseline();scheduleEnv.context.liveFixtureEvents=[capture.liveFixture];
 vm.runInContext(index.slice(scheduleStart,scheduleEnd),scheduleEnv.context);
 const scheduled=scheduleEnv.context.liveScheduleFixtures(capture.fixtures,{id:'sport:football',slug:'football'});
 assert.equal(scheduled.find(f=>f.id===original.id).status,'completed','Actual live Schedule path accepts the captured canonical Football result despite its legacy Premier League key');
 scheduleEnv.context.liveFixtureEvents=[{...capture.liveFixture,key:'football',sportDomainId:'sport:american-football'}];
 assert.equal(scheduleEnv.context.liveScheduleFixtures(capture.fixtures,{id:'sport:football',slug:'football'}).find(f=>f.id===original.id).status,original.status,'Explicit American Football identity cannot enter Football');
 const merged=baseline();merged.fixtures=require('../config/fixture-identity').mergeOverlays(merged.fixtures,[capture.liveFixture]);
 const mergedFinal=merged.fixtures.find(f=>f.id===original.id);assert.equal(mergedFinal.status,'completed');assert.equal(mergedFinal.homeScore,2);assert.equal(mergedFinal.statusCheckedAt,capture.liveFixture.statusCheckedAt,'Actual captured live observation stays unchanged');
 assert(fullTable(merged).textContent.includes(note),'Full Follow standings shares the same warning after the existing fixture overlay');
 const positive=[
  ['native Schedule finished status',{...capture.currentFixture,status:'finished'}],
  ['zero-score final',{...capture.currentFixture,homeScore:0,awayScore:0}],
  ['corrected existing final',{...capture.fixtures.find(f=>f.status==='completed'),homeScore:capture.fixtures.find(f=>f.status==='completed').homeScore+1,resultSourceCheckedAt:capture.currentFixture.resultSourceCheckedAt,scoreCheckedAt:capture.currentFixture.scoreCheckedAt}],
 ];
 for(const [label,fixture] of positive)assert((await card(baseline(),fixture)).textContent.includes(note),label);
 const unchanged=structuredClone(capture.fixtures.find(f=>f.status==='completed'));unchanged.resultSourceCheckedAt=capture.currentFixture.resultSourceCheckedAt;unchanged.scoreCheckedAt=capture.currentFixture.scoreCheckedAt;
 for(const [label,fixture] of [
  ['unchanged final observed again',unchanged],['reschedule',{...original,startTimeUtc:capture.currentFixture.startTimeUtc}],
  ['playing score',{...capture.currentFixture,status:'live'}],['half-time score',{...capture.currentFixture,status:'break'}],
  ['invalid scores',{...capture.currentFixture,homeScore:null}],['future observation',{...capture.currentFixture,resultSourceCheckedAt:'2099-01-01T00:00:00Z',scoreCheckedAt:'2099-01-01T00:00:00Z'}],
  ['ambiguous participants',{...capture.currentFixture,participantIds:[...capture.currentFixture.participantIds].reverse()}],
  ['different season',{...capture.currentFixture,season:'2027/28'}]
 ])assert(!(await card(baseline(),fixture)).textContent.includes(note),label+' cannot create a new table mismatch');
 for(const mutate of [d=>d.fixtures.pop(),d=>d.fixtures[1]=structuredClone(d.fixtures[0])]){
  const doc=baseline();mutate(doc);assert(!(await card(doc,capture.currentFixture)).textContent.includes(note),'Incomplete or duplicate collection cannot imply a complete comparison');
 }
 const stale=baseline();stale.standings.forEach(r=>{r.stale=true;r.staleNote='Existing delayed backup warning.';});assert((await card(stale,capture.currentFixture)).textContent.includes('Existing delayed backup warning.'));
 for(const state of [{global:true,override:'hide'},{global:true,strict:true},{global:false}]){
  const hidden=await card(baseline(),capture.currentFixture,state);assert.equal(all(hidden,n=>n.tagName==='li').length,0);assert(!hidden.textContent.includes(note),'Results privacy also protects mismatch information');
 }
 for(const cid of ['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league']){
  const rows=current.standings.filter(r=>r.competitionId===cid);assert.equal(helper.footballTableWarning(current,rows),'','Actual published table and recorded results agree');
  const upcoming=current.fixtures.find(f=>f.competitionId===cid&&f.status==='upcoming');assert(upcoming);
  const simulatedTime=Math.max(Date.now(),Date.parse(upcoming.startTimeUtc)+1000),checked=new Date(simulatedTime).toISOString();
  const simulated={...upcoming,status:'completed',homeScore:0,awayScore:0,resultSourceCheckedAt:checked,scoreCheckedAt:checked};
  assert.equal(helper.footballTableWarning(current,rows,[simulated],simulatedTime),note,'Controlled newer final tests this competition boundary; it is not source evidence');
  assert.equal(helper.footballTableWarning(current,rows,[{...simulated,stage:'Qualifying'}],simulatedTime),cid==='competition:premier-league-2026-27'?note:'','European qualifiers cannot change the league-phase comparison');
 }
 assert(!fullTable(current).textContent.includes(note),'Updated published table clears the warning without guessing rankings');
 console.log('Football table freshness: actual card/full-table paths and scoped new-final, correction, privacy, recovery and unsafe-input checks passed.');
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
