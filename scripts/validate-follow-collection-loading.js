'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),source=html.slice(html.indexOf('function followCollectionsById(){'),html.indexOf('function syncDirectoryFollowButton('));
const chunks={tennis:require('../data/follow-directory/tennis.v1.json'),'tennis-women':require('../data/follow-directory/tennis-women.v1.json')};
(async()=>{
 for(const [ids,expected] of [[['collection:tennis:womens-top-10'],['tennis-women']],[['collection:tennis:mens-top-10'],['tennis']],[['collection:tennis:all-time-greats'],['tennis','tennis-women']],[['collection:tennis:mens-top-10','collection:tennis:womens-top-10'],['tennis','tennis-women']]]){
  const requests=[],preferences={followFirst:{collectionFollows:ids}},before=JSON.stringify(preferences),context={userPreferences:preferences,followDirectoryChunks:new Map(),profileHasFootballEntityFollow:()=>false,profileHasNrlEntityFollow:()=>false,profileHasAflEntityFollow:()=>false,profileHasAflwEntityFollow:()=>false};
  context.loadFollowDirectoryChunk=async key=>{requests.push(key);context.followDirectoryChunks.set(key,chunks[key]);return chunks[key];};vm.createContext(context);vm.runInContext(source,context);await context.ensureFollowCollectionDirectories();assert.deepEqual(requests.sort(),expected.sort(),'Cold restored collections load their actual gender directories');assert.equal(JSON.stringify(preferences),before);
  if(ids.includes('collection:tennis:womens-top-10'))assert(context.followCollectionsById()['collection:tennis:womens-top-10'].memberIds.includes('competitor:tennis:wta:karolina-muchova'));
  for(const order of [['tennis','tennis-women'],['tennis-women','tennis']]){context.followDirectoryChunks=new Map(order.map(key=>[key,chunks[key]]));const merged=context.followCollectionsById()['collection:tennis:all-time-greats'].memberIds;const expected=new Set(Object.values(chunks).flatMap(c=>c.collections.find(g=>g.id==='collection:tennis:all-time-greats').memberIds));assert.deepEqual([...merged].sort(),[...expected].sort(),'Loading either gender first cannot erase shared group members');}
 }
 console.log('Follow collections: gender-specific cold loads, shared membership independent of load order, no preference mutation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
