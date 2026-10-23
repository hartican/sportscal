'use strict';
const assert=require('node:assert/strict'),sports=require('../config/all-sports-view'),match=require('../config/match-centre');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const now=Date.parse('2026-10-24T04:00:00Z'),stamp=new Date(now).toISOString(),window=sports.windowFor('today',now);
const base={id:'fixture:nrl:sports',key:'nrl',name:'Panthers v Storm',date:'2026-10-24',startTimeUtc:new Date(now+3600000).toISOString(),status:'upcoming',sourceCheckedAt:stamp,homeParticipantId:'team:nrl:panthers',awayParticipantId:'team:nrl:storm'};
const fixture=(id,offset,extra={})=>({...base,id,startTimeUtc:new Date(now+offset).toISOString(),homeParticipantId:'team:nrl:'+id,...extra});
assert.equal(window.end,Date.parse('2026-10-24T13:00:00Z'));
for(const [instant,hours] of [['2026-10-03T14:00:00Z',23],['2026-04-04T13:00:00Z',25]]){
 const at=Date.parse(instant);assert.equal(sports.windowFor('today',at).end-at,hours*3600000);
 for(const range of ['24','48'])assert.equal(sports.windowFor(range,at).end-at,Number(range)*3600000);
}
assert.throws(()=>sports.windowFor('tomorrow',now));assert.throws(()=>sports.windowFor('today',NaN));assert.equal(sports.validDay('2026-02-30'),false);
const before=fixture('before',-1),first=fixture('first',0),last=fixture('last',window.end-now-1),outside=fixture('outside',window.end-now);
assert.deepEqual(sports.select([before,first,last,outside],window).map(x=>x.event.id),['first','last']);
const ongoing=fixture('ongoing',-86400000,{key:'cricket',format:'Test',homeParticipantId:'team:cricket:australia',awayParticipantId:'team:cricket:south-africa',status:'stumps',statusCheckedAt:stamp,numberOfDays:5});
assert.equal(sports.select([ongoing],window)[0].underway,true);assert.equal(sports.select([{...ongoing,status:'completed',completedAt:stamp}],window).length,0);
assert.equal(sports.select([{...ongoing,status:'live',statusCheckedAt:null}],window).length,0,'Elapsed kickoff does not manufacture play');
const tbc={...base,id:'tbc',startTimeUtc:null,timePrecision:'date-only'},undated={...tbc,id:'undated',date:null};
assert.equal(sports.select([tbc,undated],window).length,1);assert.equal(sports.select([tbc],window)[0].qualified,true);
assert.equal(sports.select([{...tbc,date:'2026-10-25'}],sports.windowFor('24',now))[0].qualified,true);
assert.equal(sports.select([{...tbc,date:'2026-10-26'}],sports.windowFor('24',now)).length,0);
const estimated={...tbc,estimatedStartTimeUtc:base.startTimeUtc,timePrecision:'estimated'};assert.equal(sports.select([estimated],window)[0].tbc,true);
assert.equal(sports.supported({...base,key:'f1',sessionType:'practice'}),true,'Schedule-only sessions do not need Feed admission');
for(const e of [{...base,tournamentParent:true},{...base,kind:'ticket_sale'},{...base,published:false},{...base,key:'tennis',tournamentLevel:'ATP250'},{...base,key:'cricket',format:'First Class',homeParticipantId:'team:cricket:ca-82',awayParticipantId:'team:cricket:ca-85'}])assert.equal(sports.supported(e),false);
const alias={...base,id:'alias',sourceEventIds:[base.id]};assert.equal(sports.unique([base,alias]).length,1);
const bridge={...base,id:'bridge',sourceEventIds:['alias','separate']};assert.equal(sports.unique([base,{...fixture('separate',7200000)},alias,bridge]).length,1,'Alias bridges deduplicate across page-independent inventory');
let rows=sports.groups(sports.select([fixture('a',0,{endTimeUtc:new Date(now+3600000).toISOString()}),fixture('b',3600000,{endTimeUtc:new Date(now+7200000).toISOString()})],window),window);
assert.equal(rows[0].groups.length,2,'Touching end/start intervals are separate');
rows=sports.groups(sports.select([fixture('a',0),fixture('b',3600000),fixture('c',7200000)],window),window);assert.equal(rows[0].groups[0].entries.length,3,'Unknown finishes conservatively remain side by side');
const original=JSON.stringify([base,tbc,ongoing]);sports.groups(sports.select([base,tbc,ongoing],window),window);assert.equal(JSON.stringify([base,tbc,ongoing]),original,'Layout does not alter sporting facts');
// Exercise the actual lazy-loader ticket functions: public membership ignores
// preference bookkeeping, but account, navigation and Followed guards remain.
const vm=require('node:vm'),ui=require('node:fs').readFileSync('assets/js/match-centre-ui.source.js','utf8');
const guardSource=['membershipQueryKey','ticket','valid'].map(name=>ui.split('\n').find(line=>line.includes('const '+name+'='))).join('\n');
const context={selectedView:'all-sports',generation:1,account:'one',owner:()=>context.account,userPreferences:{showSpoilers:true},eventActions:{},activeTab:'match-centre'};
vm.runInNewContext(guardSource+';globalThis.guard={ticket,valid};',context);
let ticket=context.guard.ticket();context.userPreferences.showSpoilers=false;context.eventActions={some:'new state'};assert(context.guard.valid(ticket),'An unrelated preference change cannot strand public lazy loading');context.account='two';assert(!context.guard.valid(ticket),'An old owner cannot complete the public view loader');
context.selectedView='followed';ticket=context.guard.ticket();context.userPreferences.showSpoilers=true;assert(!context.guard.valid(ticket),'Personal Followed membership retains its preference fence');
context.selectedView='all-sports';ticket=context.guard.ticket();context.generation++;assert(!context.guard.valid(ticket));
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
async function run(){
 let scoreReads=0,snapshotCalls=[];
 const inventory=Array.from({length:137},(_,i)=>fixture('fixture:nrl:page-'+String(i).padStart(3,'0'),3600000+i*1000));inventory.push(tbc,alias,{...base,kind:'tournament',id:'parent'});
 const make=(options={})=>createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>inventory,snapshotRead:async opts=>{snapshotCalls.push(opts);return {readAt:now,stale:false,sources:[]};},request:async(_path,opts)=>{scoreReads++;assert(opts.body.p_fixture_ids.length<=60);assert.equal(opts.timeoutMs,3000);return [];},...options});
 const handler=make(),all=[];let cursor=0,revision;
 do{const r=response();await handler({url:'/api/match-centre?view=all-sports&membership=everything&range=48&limit=50&cursor='+cursor+(cursor?'&asOf='+now+'&revision='+revision:'')},r);assert.equal(r.code,200);assert.equal(r.body.schemaVersion,'all-sports.v1');revision=r.body.revision;all.push(...r.body.events);cursor=r.body.pagination.nextCursor;}while(cursor!==null);
 assert.equal(all.length,139);assert.equal(new Set(all.map(match.id)).size,all.length);assert.equal(scoreReads,0,'Membership pagination does not poll invisible scores');assert(snapshotCalls.every(o=>o.scope==='global'&&!o.interactive),'Full global membership uses the unchanged default reader policy');
 for(const query of ['range=invalid','limit=61','cursor=-1','asOf=NaN']){const r=response();await handler({url:'/api/match-centre?view=all-sports&membership=everything&'+query},r);assert.equal(r.code,400);}
 let r=response();await handler({url:'/api/match-centre?view=all-sports&membership=everything&range=48&revision=changed'},r);assert.equal(r.code,409,'Changed inventories cannot silently skip cursor members');
 const degraded=make({snapshotRead:async()=>{throw Error('private failure');}});r=response();await degraded({url:'/api/match-centre?view=all-sports&membership=everything'},r);assert.equal(r.code,200);assert.equal(r.body.membershipStale,true);assert.equal(r.headers['Cache-Control'],'no-store');assert(r.body.events.length>0);assert(!JSON.stringify(r.body).includes('private failure'));
 const freshOnly=fixture('live-only',-3600000,{status:'live',statusCheckedAt:stamp});r=response();await make({published:()=>[],snapshotRead:async()=>({stale:false,sources:[{checked_at:stamp,fixtures:[freshOnly]}]})})({url:'/api/match-centre?view=all-sports&membership=everything'},r);assert.equal(r.body.events[0].id,freshOnly.id);
 r=response();await make({published:()=>[freshOnly],snapshotRead:async()=>{throw Error('offline');}})({url:'/api/match-centre?view=all-sports&membership=everything'},r);assert.equal(r.body.events[0].stale,true);assert.equal(match.liveState(r.body.events[0],now),'awaiting-update','A failed current read cannot retain an unqualified Live claim');assert.equal(r.body.events[0].statusCheckedAt,stamp,'Degrading a source cannot renew its fact clock');assert.equal(freshOnly.stale,undefined,'Fallback does not mutate canonical facts');
 r=response();await handler({url:'/api/match-centre?view=all-sports&ids='+inventory.slice(0,60).map(match.id).join(',')},r);assert.equal(r.code,200);assert.equal(scoreReads,1);assert.equal(r.body.events.length,60);
 r=response();await handler({url:'/api/match-centre?view=all-sports&ids='+all.slice(0,61).map(match.id).join(',')},r);assert.equal(r.code,400);assert.equal(scoreReads,1);
 r=response();await handler({url:'/api/match-centre?membership=everything'},r);assert.equal(r.body.events.length,0,'The original near-live mode is not widened');
 console.log('All Sports View: Sydney/DST ranges, public scope, TBC, ongoing/terminal facts, alias/overlap identity, 139-row complete pagination, global fallback, revision rejection and bounded selected reads passed.');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports=run;
