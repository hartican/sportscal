'use strict';
const assert=require('node:assert/strict'),social=require('../lib/nsc-social');
(async()=>{
 const available=[{kind:'entity',id:'team:nrl:one',sport:'nrl'},{kind:'entity',id:'team:nrl:muted',sport:'nrl'},{kind:'entity',id:'team:afl:one',sport:'afl'}];
 const own={preferences:{preferenceGraph:{entityFollows:[{participantId:'team:tennis:existing',followLevel:'priority'},{participantId:'team:nrl:muted',followLevel:'mute'}]}},event_user_state:{saved:{kept:true}}};let writes=[];
 const deps={profileLookup:async()=>({user_id:'source',profile_id:'source-public'}),stateLookup:async id=>id==='source'?{source:true}:own,listPicks:state=>state.source?available:[],query:async(path,{body})=>{writes.push(body);return {bonusAwarded:20};}};
 const result=await social.copy({targetProfileId:'source-public',items:[available[0],{kind:'entity',id:'forged'}]},{id:'actor'},deps);
 assert.equal(result.added,1,'partial copy adds only a source-owned selection');assert.deepEqual(writes[0].added_sports,['nrl']);assert.equal(writes[0].actor,'actor');assert.deepEqual(writes[0].expected_preferences,own.preferences);assert.deepEqual(writes[0].new_events,own.event_user_state);
 assert(writes[0].new_preferences.preferenceGraph.entityFollows.some(x=>x.participantId==='team:tennis:existing'&&x.followLevel==='priority'),'unrelated follow retained');
 await assert.rejects(social.copy({items:[available[1]]},{id:'actor'},deps),/Select the excluded pick/);assert.equal(writes.length,1);
 await social.copy({items:[available[1]],overrideIds:[available[1].id]},{id:'actor'},deps);assert(writes[1].new_preferences.preferenceGraph.entityFollows.some(x=>x.participantId===available[1].id&&x.followLevel==='follow'));
 const none=await social.copy({items:[]},{id:'actor'},deps);assert.equal(none.bonusAwarded,0);assert.equal(writes.length,2);
 await assert.rejects(social.copy({items:'forged'},{id:'actor'},deps),/Select up to/);
 console.log('Social picks: partial selection, source ownership, actor identity, additive follows, exclusion overrides and no-op rewards passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
