'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function run(){
 const root=path.resolve(__dirname,'..'),filename=path.join(root,'api/feed.js'),unit=new Module(filename,module);unit.filename=filename;unit.paths=Module._nodeModulePaths(path.dirname(filename));unit._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.auditDependencies=feedDependencies;',filename);
 const api=unit.exports,d={...api.auditDependencies()},live=require('../lib/live-fixtures'),now=new Date('2026-10-17T01:47:30Z');
 const preferences={version:26,onboardingComplete:true,showSpoilers:false,selectedSelectorEntityIds:['sport:football','sport:tennis','sport:nrl','sport:afl','sport:rugby-union','sport:cricket','sport:f1','sport:nba'],followedSports:['football','tennis','nrl','afl','rugby','cricket','f1','nba'],preferenceGraph:{entityFollows:[]}},actions={};
 for(const event of d.contextualEvents.slice(0,700)){
  const id=event.eventId||event.id;if(id)actions[id]={saved:true,addedToFixtures:true,lastActionAt:'2026-10-16T00:00:00Z',addedFixture:{eventId:id,key:event.key,name:event.name,date:event.date,startTimeUtc:event.startTimeUtc,participantIds:event.participantIds,homeParticipantId:event.homeParticipantId,awayParticipantId:event.awayParticipantId}};
 }
 const userState={preferences,event_user_state:actions},before=JSON.stringify(userState),stateBytes=Buffer.byteLength(before);assert(stateBytes<512*1024,'Controlled history fits the existing account cap');
 let ioCallbacks=0;const store=live.createSnapshotStore({request:(route,{body})=>new Promise(resolve=>setTimeout(()=>{
  ioCallbacks++;resolve(route.endsWith('source_health')?[]:{schemaVersion:'current-fixture-bundle.v1',scope:'participants',complete:true,rows:[],sportKeys:body.p_sport_keys,knownSportKeys:body.p_known_sport_keys,participantIds:body.p_participant_ids,requiredIds:body.p_required_ids});
 },0))});
 d.readLiveSnapshots=async options=>options?.scope==='participants'?live.readLiveSnapshots({...options,store,maxAgeMs:0}):{sources:[],stale:false,revision:'controlled'};
 const authentication=()=>({...require('../lib/supabase-server'),bearerToken:()=>'',authenticatedUser:async()=>({id:'controlled-local-account'}),loadUserState:async()=>userState});
 const response=finished=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;finished?.();return this;},send(body){this.body=JSON.parse(body);finished?.();return this;}});
 const synchronous={...d,buildServerFeed:options=>d.buildServerFeed({...options,cooperative:false}),resolveUserFollowFixtures:options=>d.resolveUserFollowFixtures({...options,cooperative:false})};
 const expected=response();await api.createFeedHandler({load:()=>synchronous,clock:()=>new Date(now),authenticate:authentication})({url:'/api/feed?limit=50',method:'GET'},expected);
 let feedDone=false,profileBeforeFeed=false;const profile=response(()=>{profileBeforeFeed=!feedDone;}),feed=response(()=>{feedDone=true;});
 const handler=api.createFeedHandler({load:()=>d,clock:()=>new Date(now),authenticate:authentication});
 await Promise.all([
  handler({url:'/api/feed?scope=athletes&participantId=team:football:sydney-fc&limit=50',method:'POST',body:{preferences,eventUserState:{}}},profile),
  handler({url:'/api/feed?limit=50',method:'GET'},feed)
 ]);
 assert.equal(profile.code,200);assert.equal(feed.code,200);assert(profileBeforeFeed,'The actual profile route finishes before the other large saved Feed');assert.equal(profile.body.fixtureSnapshotStale,false,'Ready snapshot I/O is not starved into a false timeout');assert.equal(ioCallbacks,2,'Retain the same pair of shared reads');assert.deepEqual(feed.body,expected.body,'The complete ordinary Feed response remains exact');assert.equal(JSON.stringify(userState),before,'Neither concurrent route mutates private choices');
 console.log(JSON.stringify({passed:true,savedActions:Object.keys(actions).length,stateBytes,actualApiRoutes:true,profileBeforeLargeFeed:true,healthySharedSnapshot:true,completeFeedOutputExact:true,immutableChoices:true,noProductionRequests:true}));
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run};
