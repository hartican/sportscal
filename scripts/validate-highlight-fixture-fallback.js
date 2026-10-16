'use strict';
// Replay actual public Feed fallback identities. Resolver/provider responses
// are injected; this test performs no account, provider or database reads.
const assert=require('node:assert/strict'),contract=require('../config/fixture-highlights'),{createLiveFixtureHandler,fixtureMatches}=require('../lib/live-fixture-handler');
const now=new Date('2026-10-15T08:00:00Z'),publicRows=[...require('../lib/calendar-catalogue').catalogue(),...require('../data/follow-fixtures.v1.json').events];
const ids=['fixture:nhl:2026020088','fixture:nhl:2026020076','fixture:nhl:2026020064','fixture:nhl:2026020059','event:nbl:2026-27:36fb1b72-58ad-11f1-a2a4-7da015763581','event:nbl:2026-27:36fe21e3-58ad-11f1-ba69-dd12ee8972e9','fixture:nba:0012600037','fixture:nba:0012600030','event:aflw:cd_m20262640904','fixture:tennis:atp-shanghai-2026:r64:de-minaur-molcan'];
const actual=ids.map(id=>{const event=publicRows.find(e=>fixtureMatches(e,new Set([id])));assert(event&&contract.completed(event),'actual saved Feed public fallback exists completed: '+id);return event;});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(body){this.body=body;return this;}});
async function replay({id=ids[0],fallback=actual,published=[],live=[],mode='highlight',readFails=false,defaultLoader=false}={}){
 let fallbackReads=0;const resolved=[];const options={publishedFixtures:()=>published,highlightFixtures:()=>{fallbackReads++;return fallback;},read:async()=>{if(readFails)throw Error('controlled');return {sources:[{source_id:'controlled-current',checked_at:now.toISOString(),fixtures:live}],revision:'controlled',stale:false};},clock:()=>now,environment:{},resolveHighlights:async event=>{resolved.push(event);return {url:'https://www.youtube.com/watch?v=CONTROLLED1'};}};
 if(defaultLoader){delete options.publishedFixtures;delete options.highlightFixtures;}
 const handler=createLiveFixtureHandler(options),res=response();await handler({method:'GET',url:'/api/fixtures?ids='+encodeURIComponent(id)+(mode?'&mode='+mode:''),headers:{}},res);return {res,resolved,fallbackReads};
}
async function main(){
 const original=JSON.stringify(actual);
 for(const [index,id]of ids.entries()){
  const r=await replay({id});assert.equal(r.res.code,302,id+' reaches current resolver from the same public Feed fallback');assert.equal(r.resolved.length,1);assert(fixtureMatches(r.resolved[0],new Set([id])));assert.equal(r.resolved[0].startTimeUtc,actual[index].startTimeUtc,'source clock retained');
  const ordinary=await replay({id,mode:''});assert.equal(ordinary.res.code,200);assert.equal(ordinary.fallbackReads,0,'ordinary reader never loads media fallback');assert.equal(ordinary.res.body.sources[0].fixtures.length,0,'no new ordinary-reader membership');
 }
 // The public selected reader retained this September schedule shell, not a
 // newer contrary result: both explicit fixture-status observations are null.
 const aflw=actual[8],aflwId=ids[8],passive={id:aflw.id,eventId:aflw.eventId,canonicalEventId:aflw.canonicalEventId,name:aflw.name,key:aflw.key,date:aflw.date,status:'scheduled',sourceCheckedAt:'2026-09-04T15:01:43.938Z',canonicalSourceCheckedAt:'2026-09-15T19:58:09.007Z',fixtureObservationSchema:'fixture-observations.v1',statusCheckedAt:null,statusFactObservedAt:null};
 assert.equal(require('../lib/highlight-fixture-fallback').disposition(aflw,passive,[passive],now),'terminal-continuity','classify captured passive AFLW schedule against its sourced October final');
 const continued=await replay({id:aflwId,live:[passive]});assert.equal(continued.res.code,302,'passive calendar placeholder does not reopen sourced final');assert.equal(continued.resolved[0].status,'completed');assert.equal(continued.resolved[0].statusCheckedAt,aflw.statusCheckedAt);assert.equal(continued.resolved[0].scoreCheckedAt,aflw.scoreCheckedAt);
 for(const status of ['scheduled','live','cancelled','rescheduled']){
  const contrary={...passive,status,fixtureObservationSchema:'compact-fixture-observation.v1',statusFactObservedAt:'2026-10-14T12:00:00Z',statusCheckedAt:'2026-10-14T12:00:00Z'};
  const r=await replay({id:aflwId,live:[contrary]});assert.equal(r.res.code,404,'newer explicit fixture status conflict fails closed: '+status);assert.equal(r.resolved.length,0,'contradiction cannot spend provider quota');
  const p=await replay({id:aflwId,published:[contrary]});assert.equal(p.res.code,404,'newer published fixture status also fails closed: '+status);assert.equal(p.resolved.length,0,'published contradiction cannot spend provider quota');
 }
 assert.equal((await replay({id:aflwId,live:[{...passive,status:'cancelled'}]})).res.code,404,'unclocked explicit cancellation is unresolved, not proof of a completed fixture');
 assert.equal((await replay({id:aflwId,live:[{...passive,sourceCheckedAt:now.toISOString()}]})).res.code,302,'a new collection/source receipt alone cannot reopen the final');
 const legacyPassive={...passive};delete legacyPassive.fixtureObservationSchema;delete legacyPassive.statusCheckedAt;delete legacyPassive.statusFactObservedAt;
 assert.equal((await replay({id:aflwId,live:[legacyPassive]})).res.code,302,'legacy collection receipt cannot become a contrary per-fixture status fact');
 const current={...actual[0],status:'completed',statusCheckedAt:'2026-10-14T12:00:00Z',sourceCheckedAt:'2026-10-14T12:00:00Z',homeScore:7,awayScore:3};
 const currentResult=await replay({live:[current]});assert.equal(currentResult.res.code,302);assert.equal(currentResult.fallbackReads,0,'existing current completed context and cache binding are unchanged');assert.equal(currentResult.resolved[0].homeScore,7);assert.equal(currentResult.resolved[0].sourceCheckedAt,current.sourceCheckedAt);
 const withdrawn=await replay({id:aflwId,live:[{...passive,highlights:null}]});assert.equal(withdrawn.resolved[0].highlights,null,'explicit media withdrawal survives fallback');
 const old={...actual[0],date:'2026-09-01',endDate:'2026-09-01',startTimeUtc:'2026-09-01T00:00:00Z'};assert.equal((await replay({fallback:[old]})).res.code,404,'expired fallback never starts a search');
 assert.equal((await replay({id:'fixture:controlled:unknown'})).res.code,404,'unknown identity does not borrow another fixture');
 assert.equal((await replay({id:actual[4].id})).res.code,302,'accepted native alias resolves the same fixture');
 const canonicalNbl={id:ids[4],status:'cancelled',fixtureObservationSchema:'compact-fixture-observation.v1',statusFactObservedAt:'2026-10-15T07:00:00Z',highlights:null};
 // This is the historical 15 October contradiction, not a cancellation newer
 // than every future primary check. Keep its actual pre-cancellation packet.
 const historicalNbl=require('./fixtures/highlight-native-cancellation-20261015.json').fixture;
 assert(fixtureMatches(historicalNbl,new Set([ids[4],actual[4].id])));
 assert(Date.parse(historicalNbl.statusCheckedAt)<Date.parse(canonicalNbl.statusFactObservedAt)&&Date.parse(canonicalNbl.statusFactObservedAt)<+now,'Historical cancellation must genuinely follow the captured final and precede validation');
 const historicalUnchanged=JSON.stringify(historicalNbl);
 const aliasConflict=await replay({id:historicalNbl.id,fallback:[historicalNbl],live:[canonicalNbl]});assert.equal(aliasConflict.res.code,404,'native request respects cancellation under canonical fixture alias');assert.equal(aliasConflict.resolved.length,0);
 assert.equal(JSON.stringify(historicalNbl),historicalUnchanged,'Historical sporting facts and receipts are immutable');
 const aliasWithdrawal=await replay({id:actual[4].id,live:[{...canonicalNbl,status:'scheduled',statusFactObservedAt:null,statusCheckedAt:null}]});assert.equal(aliasWithdrawal.res.code,302);assert.equal(aliasWithdrawal.resolved[0].highlights,null,'native request retains canonical explicit media withdrawal');
 const mediaOnlyWithdrawal=await replay({id:actual[4].id,live:[{id:ids[4],enrichmentOnly:true,highlightsOnly:true,highlights:null}]});assert.equal(mediaOnlyWithdrawal.res.code,302);assert.equal(mediaOnlyWithdrawal.resolved[0].highlights,null,'missing-target media-only withdrawal survives after fallback gains a base fixture');
 const malformed=await replay({id:ids[0]+','+ids[1]});assert.equal(malformed.res.code,400);assert.equal(malformed.fallbackReads,0,'multi-ID highlight input is rejected before fallback loading');
 assert.equal((await replay({fallback:[{...actual[0],status:'scheduled'}]})).res.code,404,'publication alone does not manufacture completion');
 assert.equal((await replay({readFails:true})).res.code,302,'published fallback remains available during an ordinary source read failure');
 const realDefault=await replay({id:ids[6],defaultLoader:true});assert.equal(realDefault.res.code,302,'production default lazily includes native NBA Feed pack');
 assert.equal(JSON.stringify(actual),original,'public fallback sporting facts/receipts remain immutable');
 console.log('Highlights-only fixture fallback: ten actual missing identities, ordinary-reader isolation, original clocks/finals, explicit newer contradictions, expiry/unknown IDs and media withdrawal passed; zero live requests.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
