'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const transport=require('../config/server-sync'),profile=require('../config/profile-storage');
const html=fs.readFileSync('index.html','utf8'),source=html.slice(html.indexOf('function followCollectionsById(){'),html.indexOf('function syncDirectoryFollowButton('));
const ownerStart=html.indexOf('function preferenceIntentOwner('),ownerEnd=html.indexOf('\nfunction pendingPreferenceIntent(',ownerStart);
assert(ownerStart>=0&&ownerEnd>ownerStart,'Extract the actual app ownership helper');
const ownerSource=html.slice(ownerStart,ownerEnd);
const chunks={tennis:require('../data/follow-directory/tennis.v1.json'),'tennis-women':require('../data/follow-directory/tennis-women.v1.json')};
(async()=>{
 for(const [ids,expected] of [[['collection:tennis:womens-top-10'],['tennis-women']],[['collection:tennis:mens-top-10'],['tennis']],[['collection:tennis:all-time-greats'],['tennis','tennis-women']],[['collection:tennis:mens-top-10','collection:tennis:womens-top-10'],['tennis','tennis-women']]]){
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  let authCalls=0;
  const owner='collection-gate-owner',token='e30.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.disposable';
  const client=transport.createClient({storage,persistentStorage:storage,fetchImpl:async(url,options)=>{
    authCalls++;assert.equal(url,'/api/auth');assert.equal(JSON.parse(options.body).action,'password-sign-in');
    return new Response(JSON.stringify({session:{accessToken:token,refreshToken:'disposable-test-refresh',expiresAt:Date.now()+3600000}}),{headers:{'Content-Type':'application/json'}});
  }});
  await client.signIn('disposable@example.invalid','test-only',{persist:false});
  const preferences={followFirst:{collectionFollows:ids}},activeProfileBundle=profile.saveSection(storage,profile.loadActiveProfile(storage),'preferences',preferences);
  const requests=[],context={FOLLOW_FIRST:require('../config/follow-first'),savePreferences:next=>{context.userPreferences=next;},userPreferences:preferences,followDirectoryChunks:new Map(),serverSyncClient:client,serverStateSyncGeneration:0,activeProfileBundle,serverPersistence:{state:'signedIn',user:{id:client.sessionSubject()}},profileHasFootballEntityFollow:()=>false,profileHasNrlEntityFollow:()=>false,profileHasAflEntityFollow:()=>false,profileHasAflwEntityFollow:()=>false};
  context.loadFollowDirectoryChunk=async key=>{requests.push(key);context.followDirectoryChunks.set(key,chunks[key]);return chunks[key];};vm.createContext(context);vm.runInContext(ownerSource+'\n'+source,context);
  assert.equal(context.preferenceIntentOwner().accountId,owner);assert.equal(context.preferenceIntentOwner().generation,client.accountSnapshot().generation);assert(activeProfileBundle.profile.id);
  await context.ensureFollowCollectionDirectories();assert.equal(authCalls,1,'Scope observation and collection hydration must not refresh authentication');assert.deepEqual(requests.sort(),expected.sort(),'Cold restored collections load their actual gender directories');assert.equal(context.userPreferences.followFirst.collectionFollows.length,0,'Loaded groups become individual follows');assert(context.userPreferences.preferenceGraph.entityFollows.length>0);
  if(ids.includes('collection:tennis:womens-top-10'))assert(context.followCollectionsById()['collection:tennis:womens-top-10'].memberIds.includes('competitor:tennis:wta:karolina-muchova'));
  for(const order of [['tennis','tennis-women'],['tennis-women','tennis']]){context.followDirectoryChunks=new Map(order.map(key=>[key,chunks[key]]));const merged=context.followCollectionsById()['collection:tennis:all-time-greats'].memberIds;const expected=new Set(Object.values(chunks).flatMap(c=>c.collections.find(g=>g.id==='collection:tennis:all-time-greats').memberIds));assert.deepEqual([...merged].sort(),[...expected].sort(),'Loading either gender first cannot erase shared group members');}
 }
 console.log('Follow collections: gender-specific cold loads, shared membership independent of load order, frozen individual follows passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

require('./validate-standings-presentation-deferral');
