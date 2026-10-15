'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const follow=require('../config/follow-first'),tennis=require('../config/tennis-feed'),policy=require('../config/follow-feed-policy');
const original=globalThis.NOTHINGSPORTS_FOLLOW_FIRST;
let migrations=0;
globalThis.NOTHINGSPORTS_FOLLOW_FIRST={...follow,migratePreferences(p){migrations++;return follow.migratePreferences(p);},effectiveParticipantFollow(id,prefs,collections,prepared){if(!prepared)migrations++;return follow.effectiveParticipantFollow(id,prefs,collections,prepared);}};
const now=new Date('2026-09-24T02:00:00Z'),player='athlete:tennis:one';
const parent={id:'parent:test',key:'tennis',cardType:'tennis_parent',tournamentParent:true,date:'2026-09-20',endDate:'2026-09-30',sourceUrl:'https://sports.example/test',participantIds:[player],participantsConfirmed:true};
const variants=[
 {preferenceGraph:{entityFollows:[{participantId:player,followLevel:'follow'}]}},
 {preferenceGraph:{entityFollows:[{participantId:player,followLevel:'mute'}]}},
 {followFirst:{collectionFollows:['collection:test']}},
 {}
];
const collections={'collection:test':{id:'collection:test',memberIds:[player]}};
try{
 for(const preferences of variants)for(const event of [parent,{...parent,date:'2026-10-01',endDate:'2026-10-05',outlookParticipation:[{participantId:player,status:'entered'}]},{...parent,key:'golf',cardType:'golf_tournament'}]){
  const preparedPreferences=follow.migratePreferences(preferences);
  const expected=tennis.reason(event,preferences,{collectionsById:collections,now});
  migrations=0;
  for(let n=0;n<50;n++)assert.deepEqual(tennis.reason(event,preferences,{collectionsById:collections,preparedPreferences,now}),expected);
  assert.equal(migrations,0,'Prepared parent admission must not re-migrate per participant or fixture');
  migrations=0;tennis.reason(event,preferences,{collectionsById:collections,now});
  assert.equal(migrations,1,'Unprepared callers migrate once before checking participants');
 }
 // Exercise the native Feed call sites, where the shared prepared context already exists.
 const source=fs.readFileSync('index.html','utf8');
 const context={NOTHINGSPORTS_TENNIS_FEED:tennis,FOLLOW_FEED_POLICY:policy,FOLLOW_FIRST:globalThis.NOTHINGSPORTS_FOLLOW_FIRST,nowAEST:()=>now,tennisFeedParentDocument:{},followCollectionsById:()=>collections};
 let snapshot;
 context.buildFollowEligibilityContext=()=>snapshot;
 vm.createContext(context);
 for(const [start,end] of [['function cachedParticipantFollow(','function automaticEventFollowReason('],['function eventFollowReason(','function eventMatchesBroadcasterPreferences(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),context);
 for(const preferences of variants){
  context.userPreferences=preferences;snapshot={collectionsById:collections,preparedPreferences:follow.migratePreferences(preferences),participantFollows:new Map()};
  migrations=0;
  const expected=tennis.reason(parent,preferences,{preparedPreferences:snapshot.preparedPreferences,collectionsById:collections,now});
  for(let n=0;n<50;n++)assert.deepEqual(context.eventFollowReason(parent,snapshot),expected);
  context.cachedParticipantFollow(player);context.cachedParticipantFollow(player);
  assert.equal(migrations,0,'Native Feed and cached participant checks share the current prepared preference snapshot');
  assert.deepEqual(context.cachedParticipantFollow(player),follow.effectiveParticipantFollow(player,preferences,collections));
 }
 console.log('Prepared Follow context reused across 600 parent checks and 200 native Feed checks; current preference changes preserve admission.');
}finally{globalThis.NOTHINGSPORTS_FOLLOW_FIRST=original;}
