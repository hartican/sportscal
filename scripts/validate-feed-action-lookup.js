'use strict';
const assert=require('node:assert/strict');
const identity=require('../config/event-action-identity');
const resolver=require('../lib/follow-fixture-resolver');
let expansions=0;const originalExpansion=resolver.expandedFollowEntityIds;
resolver.expandedFollowEntityIds=(...args)=>{expansions++;return originalExpansion(...args);};
const pipeline=require('../lib/server-feed-pipeline');
async function run(){
 let checks=0;
 const actions={
  'legacy:2026-10-01T12:00':{saved:true,lastActionAt:'2026-10-01T00:00:00Z'},
  stable:{actionKey:'stable',sourceEventIds:['shared','alias'],saved:true,lastActionAt:'2026-10-02T00:00:00Z'},
  older:{sourceEventIds:['shared'],dismissed:true,lastActionAt:'2026-10-01T00:00:00Z'},
  later:{sourceEventIds:['shared'],watchLater:true,lastActionAt:'2026-10-02T00:00:00Z'},
  purgeFirst:{sourceEventIds:['purge'],isPurged:true,purgedAt:'first'},
  purgeLater:{sourceEventIds:['purge'],isPurged:true,purgedAt:'second',lastActionAt:'2026-10-03T00:00:00Z'},
  empty:{},invalid:null,number:4,list:[],invalidClock:{sourceEventIds:['shared'],lastActionAt:'invalid'}
 };
 const events=[null,{},'unknown',{id:'legacy'},{id:'stable'},{id:'shared'},{actionKey:'stable',sourceEventIds:['shared']},{id:'purge'},{id:'empty'},{id:'invalid'},{id:'number'},{id:'list'},{id:'unknown'},{id:'alias'},{sourceEventIds:['shared','alias','shared']}];
 for(const source of [actions,identity.migrateActions(actions),null,[],{}]){
  const before=JSON.stringify(source),prepared=identity.createActionResolver(source);
  for(const event of events){assert.deepEqual(prepared(event),identity.resolveAction(event,source));checks++;}
  assert.equal(JSON.stringify(source),before,'Preparing/reading does not mutate actions');
 }
 const first=identity.createActionResolver({one:{sourceEventIds:['same'],saved:true}}),second=identity.createActionResolver({two:{sourceEventIds:['same'],dismissed:true}});
 assert.equal(first({id:'same'}).action.saved,true);assert.equal(second({id:'same'}).action.dismissed,true);assert.equal(first({id:'same'}).action.dismissed,undefined);checks++;
 const mutable={one:{saved:true}};identity.createActionResolver(mutable);mutable.two={sourceEventIds:['one'],dismissed:true,lastActionAt:'2026-10-04T00:00:00Z'};assert.equal(identity.actionFor({id:'one'},mutable).dismissed,true,'Existing mutable browser path remains dynamic');checks++;
 const catalogue=require('../lib/calendar-catalogue').catalogue(),saved={};
 for(const e of catalogue.slice(0,200)){
  const id=e.canonicalEventId||e.eventId||e.id;saved[id]={saved:true,addedToFixtures:true,lastActionAt:'2026-10-16T00:00:00Z',addedFixture:{eventId:id,key:e.key,name:e.name,date:e.date,startTimeUtc:e.startTimeUtc,participantIds:e.participantIds,homeParticipantId:e.homeParticipantId,awayParticipantId:e.awayParticipantId}};
 }
 const prepared=pipeline.prepareEventActionLookup(saved),before=JSON.stringify(saved);
 for(const event of catalogue)assert.deepEqual(pipeline.eventActionFor(event,saved,prepared),pipeline.eventActionFor(event,saved));
 assert.equal(JSON.stringify(saved),before);checks++;
 // First semantic match wins, but a nonempty direct action has precedence.
 const fixture=require('../data/football/fixtures/a-league-men.json').events[0],other={...fixture,id:'controlled:other',eventId:'controlled:other',canonicalEventId:'controlled:other'},firstSemantic={addedToFixtures:true,addedFixture:fixture,saved:true},semanticActions={one:firstSemantic,two:{...firstSemantic,saved:false},'controlled:direct':{dismissed:true}},lookup=pipeline.prepareEventActionLookup(semanticActions);
 assert.deepEqual(pipeline.eventActionFor(other,semanticActions,lookup),pipeline.eventActionFor(other,semanticActions));assert.equal(pipeline.eventActionFor(other,semanticActions,lookup),firstSemantic);
 assert.deepEqual(pipeline.eventActionFor({...other,actionKey:'controlled:direct'},semanticActions,lookup),{dismissed:true});checks++;
 const damaged={one:firstSemantic,bad:{addedToFixtures:true,addedFixture:{participantSlots:'not-an-array'}}},damagedLookup=pipeline.prepareEventActionLookup(damaged);
 assert.equal(pipeline.eventActionFor(other,damaged,damagedLookup),firstSemantic,'An earlier matching saved fixture wins before malformed later history');
 const unmatched={...other,startTimeUtc:'2099-01-01T00:00:00Z'};assert.throws(()=>pipeline.eventActionFor(unmatched,damaged),TypeError);assert.throws(()=>pipeline.eventActionFor(unmatched,damaged,damagedLookup),TypeError);checks++;
 const interrupted=function*(){yield;throw new Error('controlled policy failure');},consume=require('../lib/feed-work');assert.throws(()=>consume(interrupted()),/controlled policy failure/);await assert.rejects(consume(interrupted(),true),/controlled policy failure/);checks++;
 const now=new Date('2026-10-17T01:47:30Z'),current={...fixture,status:'live',startTimeUtc:new Date(+now-600000).toISOString(),date:'2026-10-17',participantsConfirmed:true,excludedParticipantIds:[]};
 const preferences=pipeline.normalizeUserFollowState({preferences:{version:26,onboardingComplete:true,selectedSelectorEntityIds:['sport:football'],followedSports:['football'],preferenceGraph:{entityFollows:[]}}}).preferences;
 const expanded=originalExpansion({preferences});expansions=0;
 pipeline.shouldEnrichEvent(current,preferences,{},expanded,now);assert.equal(expansions,0,'Confirmed participants without exclusions reuse the existing invocation expansion');
 pipeline.shouldEnrichEvent({...current,excludedParticipantIds:[current.homeParticipantId]},preferences,{},expanded,now);assert.equal(expansions,1,'A real exclusion retains the original per-fixture expansion');checks++;
 // Ready snapshot I/O must run while another request builds the full Feed.
 const options={events:catalogue,userId:'controlled-local-cooperation',userState:{preferences,event_user_state:saved},now,copyEvents:false,limit:50};
 const synchronous=pipeline.buildServerFeed(options);let feedDone=false,profileBeforeFeed=false;
 const store=require('../lib/live-fixtures').createSnapshotStore({request:(route,opts)=>new Promise(resolve=>setTimeout(()=>resolve(route.endsWith('source_health')?[{source_id:'controlled',checked_at:now.toISOString()}]:{schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:true,rows:[{source_id:'controlled',fixture:current}]}),0))});
 const snapshot=store.read({scope:'match-centre',interactive:true,now:+now}).then(value=>{profileBeforeFeed=!feedDone;return value;});
 const cooperative=Promise.resolve(pipeline.buildServerFeed({...options,cooperative:true})).then(value=>{feedDone=true;return value;});
 const [shared,asynchronous]=await Promise.all([snapshot,cooperative]);
 assert(profileBeforeFeed,'A ready snapshot cannot wait behind the whole other Feed request');assert.equal(shared[0].fixtures[0].id,current.id);assert.deepEqual(asynchronous,synchronous,'Cooperative processing preserves the complete result');checks++;
 const contextOptions={events:catalogue,userState:options.userState,copyEvents:false};
 assert.deepEqual(await resolver.resolveUserFollowFixtures({...contextOptions,cooperative:true}),resolver.resolveUserFollowFixtures(contextOptions),'Both resolver execution modes preserve full ordered facts and identities');checks++;
 const otherOptions={...options,userId:'controlled-other-account',userState:{preferences,event_user_state:{}}},otherExpected=pipeline.buildServerFeed(otherOptions);
 const [sameAccount,otherAccount]=await Promise.all([pipeline.buildServerFeed({...options,cooperative:true}),pipeline.buildServerFeed({...otherOptions,cooperative:true})]);assert.deepEqual(sameAccount,synchronous);assert.deepEqual(otherAccount,otherExpected,'Interleaved requests keep their own saved choices');checks++;
 console.log(JSON.stringify({passed:true,checks,catalogueEvents:catalogue.length,savedActions:Object.keys(saved).length,exactLegacyResolution:true,aliasOrderAndPurges:true,firstSemanticAndDirectPrecedence:true,requestIsolation:true,readySnapshotDuringFeed:true,cooperativeOutputExact:true,immutableInputs:true,noProductionRequests:true}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{resolver.expandedFollowEntityIds=originalExpansion;});
module.exports={run};
