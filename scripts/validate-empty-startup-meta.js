'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const follow=require('../config/follow-first');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('async function hydrateUserMetaSeed(){'),html.indexOf('\nasync function bootstrapServerPersistence('));
async function run({preferences,remote=null,loadError=null}={}){
 const calls={load:0,save:[],preferences:[]};
 const context={userPreferences:preferences,serverPersistence:{user:{id:'isolated-user'}},FOLLOW_FIRST:follow,serverSyncClient:{async loadMeta(){calls.load++;if(loadError)throw loadError;return{meta:remote};},async saveMeta(meta){calls.save.push(meta);return{meta};}},savePreferences(p){calls.preferences.push(p);}};
 vm.createContext(context);vm.runInContext(source+'\nthis.run=hydrateUserMetaSeed;',context);
 return {result:await context.run(),calls};
}
(async()=>{
 for(const selected of [[],['sport:football']]){
  const preferences=follow.migratePreferences({selectedSelectorEntityIds:selected,showSpoilers:false,followFirst:{excludedMajorEventIds:['world-cup']},preferenceGraph:{entityFollows:[{participantId:'team:football:epl:1',followLevel:'follow'}]}}),before=JSON.stringify(preferences);
  const result=await run({preferences});assert.equal(result.result,null);assert.equal(result.calls.load,1);assert.equal(result.calls.save.length,0);assert.equal(result.calls.preferences.length,0);assert.equal(JSON.stringify(preferences),before,'saved follows/exclusions/Results cannot change');
 }
 const local=follow.migratePreferences({followFirst:{startupMeta:{sports:['football']}}});
 const seeded=await run({preferences:local});assert.equal(seeded.calls.save.length,1);assert.deepEqual(seeded.calls.save[0].sports,['football']);assert.equal(seeded.calls.preferences.length,1);
 const remote=follow.normalizeMeta({sports:['afl'],source:'admin'}),received=await run({preferences:local,remote});assert.equal(received.calls.save.length,0);assert.deepEqual(received.calls.preferences[0].followedSports,['afl','afl-premiership'],'valid existing seed semantics remain intact');
 await assert.rejects(run({preferences:local,loadError:new Error('authentication unavailable')}),/authentication unavailable/,'real service failures are not swallowed');
 console.log('Empty onboarding metadata: preserve legacy follows and Results, avoid invalid write, retain valid seed and error handling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
