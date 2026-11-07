'use strict';
const assert=require('node:assert/strict');
const {resolveUserFollowFixtures}=require('../lib/follow-fixture-resolver');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const document=require('../data/events.json');
const primary=document.events.filter(e=>e.competitionId==='competition:premier-league-2026-27');
const secondary=require('../data/football/fixtures/premier-league.json').events;
const identity=require('../lib/epl-provider-identities'),actions=require('../config/event-action-identity');
const registry=require('../data/canonical/epl-provider-identities.v1.json'),sample=require('./fixtures/epl-provider-identity-20261013.json').fixtures;
assert.equal(identity.validate(registry).length,380);
identity.validatePrimaryCollection(primary);
assert.throws(()=>identity.validate({...registry,fixtures:registry.fixtures.slice(1)}),/complete 380/);
assert.throws(()=>identity.validate({...registry,fixtures:[registry.fixtures[1],...registry.fixtures.slice(1)]}),/duplicate/);
assert.throws(()=>identity.validate({...registry,season:'2025/26'}),/wrong scope/);
assert.throws(()=>identity.validatePrimaryCollection(primary.slice(1)),/complete/);
const withoutAliases=event=>{const {sourceEventIds,...facts}=event;return facts;};
for(const sources of [[...secondary,...primary],[...primary,...secondary]]){
 const reconciled=identity.reconcile(sources);assert.equal(reconciled.length,380);
 for(const event of reconciled){const original=primary.find(p=>p.id===event.id);assert(original);assert.deepEqual(withoutAliases(event),withoutAliases(original),'identity metadata cannot alter any primary sporting or presentation fact');assert.equal(new Set(event.sourceEventIds).size,event.sourceEventIds.length);}
}
assert.deepEqual(identity.reconcile(secondary),secondary,'absent primary retains the entire original last-good secondary calendar');
for(const {primary:p,secondary:s} of sample){
 const [event]=identity.reconcile([s,p]);assert.equal(event.id,p.id);assert.equal(event.canonicalEventId,p.canonicalEventId);
 for(const id of [s.id,s.canonicalEventId,p.id,p.canonicalEventId])assert(event.sourceEventIds.includes(id),'all four durable source/action identities remain');
 const old={saved:true,reminderChoice:'on',lastActionAt:'2026-10-10T00:00:00Z'},off={saved:true,reminderChoice:'off',lastActionAt:'2026-10-11T00:00:00Z'};
 assert.equal(actions.resolveAction(event,{[s.canonicalEventId]:old,[p.canonicalEventId]:off}).action,off,'later explicit OFF remains the effective saved choice');
 const fresh={...s,scoreCheckedAt:'2026-10-12T17:00:00Z'};assert.equal(identity.reconcile([fresh,p]).length,2,'a new secondary sporting receipt cannot be discarded by a frozen calendar review');
 const invalid={...s,sourceCheckedAt:'not-a-date'};assert.equal(identity.reconcile([invalid,p]).length,2,'unreadable observations are unresolved, not silently retired');
 const unknownReceipt={...s};for(const key of ['sourceCheckedAt','canonicalSourceCheckedAt','statusCheckedAt','scoreCheckedAt','statusFactObservedAt','scoreFactObservedAt','resultSourceCheckedAt'])delete unknownReceipt[key];assert.equal(identity.reconcile([unknownReceipt,p]).length,2,'an absent fixture observation cannot be inferred from a frozen calendar review');
 for(const wrong of [{...p,season:'2025/26'},{...p,competitionId:'competition:fa-cup-2026-27'},{...p,participantIds:[...p.participantIds].reverse()},{...p,homeParticipantId:p.awayParticipantId,awayParticipantId:p.homeParticipantId},{...p,key:'american-football',sportDomainId:'sport:american-football'}])assert.equal(identity.binding(wrong),null,'another season/competition/orientation/domain cannot bind');
 const missingClock={...p,startTimeUtc:null,timePrecision:'unknown',timeTbc:true},bound=identity.withAliases(missingClock);assert.equal(bound.startTimeUtc,null);assert.equal(bound.timePrecision,'unknown');assert.equal(bound.timeTbc,true);
 const zero={...p,status:'completed',homeScore:0,awayScore:0,score:'0-0',scoreCheckedAt:'2026-10-01T00:00:00Z'};assert.deepEqual(withoutAliases(identity.reconcile([{...s,status:'completed',homeScore:9,awayScore:7},zero])[0]),withoutAliases(zero),'retained secondary conflict cannot change a validated primary zero final');
 const twice=identity.withAliases(identity.withAliases(p));assert.deepEqual(twice,identity.withAliases(p),'unchanged alias projection is idempotent');
}
assert.equal(identity.canonicalEventId('unknown:football:fixture'),'unknown:football:fixture');
const upcomingCase=sample.find(({primary:p,secondary:s})=>p.status==='upcoming'&&p.startTimeUtc!==s.startTimeUtc);
assert(upcomingCase);
const afterCollectionCheck=require('../lib/live-fixtures').overlaySnapshots([upcomingCase.primary],[{source_id:'retained-secondary-calendar',checked_at:'2026-10-12T19:00:00Z',fixtures:[upcomingCase.secondary]}],{now:new Date('2026-10-12T18:00:00Z')});
assert.equal(afterCollectionCheck.length,1);
for(const field of ['id','canonicalEventId','startTimeUtc','sourceCheckedAt'])assert.equal(afterCollectionCheck[0][field],upcomingCase.primary[field],'a newer collection check cannot turn an old fixture receipt into a new sporting observation');
const prefs={version:26,onboardingComplete:true,showSpoilers:false,followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}};
const participantId='team:football:epl:1',now=new Date('2026-10-12T18:24:20.229Z');
const resolved=resolveUserFollowFixtures({events:primary,userState:{preferences:prefs,eventUserState:{}},participantId,includeCompactArtifact:true});
const result=buildServerFeed({events:resolved.events,userId:'epl-identity-regression',userState:{preferences:prefs,eventUserState:{}},athletesOnly:true,participantId,now,limit:50});
const league=result.events.filter(e=>e.competitionId==='competition:premier-league-2026-27');
const pairs=league.map(e=>e.participantIds.join('|'));
assert.equal(new Set(pairs).size,league.length,'the actual unfollowed Arsenal calendar must not repeat a proven current-season league fixture after rescheduling');
for(const event of league){
 const original=primary.find(p=>p.canonicalEventId===event.canonicalEventId);
 assert(original,'a reconciled league fixture keeps its official primary identity');
 for(const field of ['startTimeUtc','timePrecision','scheduleStatus','sourceCheckedAt'])assert.equal(event[field],original[field],field+' retains the published official fact and uncertainty');
}
assert.deepEqual(prefs.preferenceGraph.entityFollows,[]);
console.log(JSON.stringify({completeMappedFixtures:380,actualSourceCases:7,sourceOrders:true,completeResponseGuards:true,absentPrimaryPreserved:true,newSecondaryObservationsRetained:true,savedOffPreserved:true,zeroAndConflictingFinals:true,idempotent:true,actualServerProfile:true,totalProfileFixtures:result.events.length,leagueFixtures:league.length,duplicatePairs:0,originalPrimaryClocks:true,unchangedFollows:true}));
