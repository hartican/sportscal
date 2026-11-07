'use strict';
const assert=require('node:assert/strict');
const {createTopResultResolver}=require('./highlight-resolver-test');
const registry=require('../lib/highlight-channels'),contract=require('../config/fixture-highlights');
const now=new Date('2026-10-15T00:00:00Z');
async function main(){
  const event=require('../data/events.json').events.find(e=>e.key==='premier-league'&&contract.completed(e)&&contract.recent(e,now));assert(event);
  const channel=registry.channelsFor(event)[0];assert(channel);
  const rows=new Map(),grants=[],calls=[];let granted=true;
  const request=async(path,options={})=>{
    assert(options.timeoutMs<=3000);
    if(path.includes('reserve_youtube_quota')){grants.push(options.body.p_bucket);assert.equal(options.body.p_source_token,null);return {granted};}
    if(options.method==='POST'){rows.set(options.body.query_hash,options.body);return null;}
    const hash=new URL(path,'https://controlled.invalid').searchParams.get('query_hash')?.slice(3);
    return rows.has(hash)?[rows.get(hash)]:[];
  };
  const options={request,diagnose:()=>{},environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},discoverOfficial:async()=>[{videoId:'OFFICIAL001'}],fetchImpl:async url=>{
    calls.push(url);assert.equal(grants.at(-1),'ordinary','metadata must reserve before dispatch');assert(new URL(url).pathname.endsWith('/videos'),'a relevant official upload needs no search');
    return new Response(JSON.stringify({items:[{id:'OFFICIAL001',snippet:{channelId:channel.id,title:event.name+' | Premier League Highlights 2026',publishedAt:new Date(Date.parse(event.startTimeUtc)+4*3600000).toISOString(),defaultAudioLanguage:'en'},contentDetails:{duration:'PT5M'},status:{privacyStatus:'public',uploadStatus:'processed'}}]}));
  }};
  const original=JSON.stringify(event),firstUser=createTopResultResolver(options),secondUser=createTopResultResolver(options);
  for(const unknown of [{competitionId:'competition:chl',codeId:'sport:ice-hockey'},{competitionId:'competition:nbl-finals',codeId:'sport:nba',key:'nba'},{competitionId:'competition:other-football-league',codeId:'sport:football',key:'premier-league'}])assert.deepEqual(registry.channelsFor(unknown),[],'unknown explicit competition cannot inherit another league publisher');
  assert(registry.channelsFor({codeId:'sport:basketball',key:'nba'}).some(c=>c.label==='NBA'),'broad basketball identity may retain its explicit legacy NBA competition');
  for(const publisher of Object.values(registry.channels))assert(/^UC[\w-]{22}$/.test(publisher.id)&&publisher.reviewedAt==='2026-10-15'&&publisher.officialUrl.startsWith('https://'),'reviewed publisher has a valid channel identity and dated ownership source');
  assert.equal((await firstUser.resolve(event,now)).cached,false);
  assert((await secondUser.resolve({...event},now)).cached,'another resolver/account reuses the same public fixture selection');
  assert.equal(calls.length,1);assert.deepEqual(grants,['ordinary'],'all-user cache repeat spends zero additional quota');
  const stored=[...rows.values()][0];
  assert(!Object.keys(stored).some(key=>/user|account|profile|handle/.test(key)),'selection cache has no account identity');
  for(const patch of [{competitionId:'competition:other-league'},{season:'2025/26'},{seasonLabel:'2025/26'},{gender:'women'},{participants:event.participants.map((p,i)=>({...p,id:'team:changed:'+i}))}]){
    granted=false;await assert.rejects(secondUser.resolve({...event,...patch},now),'changed sporting context cannot reuse a prior selection');
    assert.equal(calls.length,1,'denied quota dispatches no provider request');
  }
  stored.selected_at=new Date(+now-3600000).toISOString();
  assert((await secondUser.resolve(event,now)).cached,'still-eligible current-policy cache survives denied renewal');
  stored.published_at=new Date(+now-contract.MAX_UPLOAD_AGE_MS-1).toISOString();
  await assert.rejects(secondUser.resolve(event,now),'expired video never survives denied renewal');assert.equal(calls.length,1);
  assert.equal(JSON.stringify(event),original,'resolution cannot alter the shared fixture');
  await rejectedCache(event,channel);
  console.log('All-user highlights cache: independent resolver/account reuse, zero-repeat quota, context fencing, denied renewal and upload expiry passed; no live requests.');
}
async function rejectedCache(event,channel){
 const publishedAt=new Date(+now-2*3600000).toISOString(),videoId='OFFICIAL001';
 const good={id:videoId,snippet:{channelId:channel.id,title:event.name+' | Premier League Highlights 2026',publishedAt,defaultAudioLanguage:'en'},contentDetails:{duration:'PT5M'},status:{privacyStatus:'public',uploadStatus:'processed'}};
 const cases=[['language',v=>v.snippet.defaultAudioLanguage='id'],['AU',v=>v.contentDetails.regionRestriction={blocked:['AU']}],['opponent',v=>v.snippet.title='Chelsea v Everton | Premier League Highlights 2026'],['old',v=>v.snippet.publishedAt=new Date(+now-8*86400000).toISOString()],['future',v=>v.snippet.publishedAt=new Date(+now+1000).toISOString()],['broadcast',v=>v.contentDetails.duration='PT3H'],['deleted',()=>{}]];
 for(const [label,change]of cases){
  let stored={video_id:videoId,selected_at:new Date(+now-4*3600000).toISOString(),published_at:publishedAt,duration_seconds:300},granted=true,readPath;const removed=[],provider=[];
  const request=async(path,options={})=>{
   if(path.includes('reserve_youtube_quota'))return {granted};
   if(options.method==='DELETE'){const query=new URL(path,'https://controlled.invalid').searchParams,original=new URL(readPath,'https://controlled.invalid').searchParams;assert.equal(query.get('fixture_id'),original.get('fixture_id'));assert.equal(query.get('query_hash'),original.get('query_hash'));assert.equal(query.get('video_id'),'eq.'+videoId);assert.equal(query.size,3,'withdraw only the exact invalid binding');removed.push(path);stored=null;return null;}
   assert(!options.method||options.method==='GET','rejected metadata cannot be saved');readPath=path;return stored?[stored]:[];
  };
  const resolver=createTopResultResolver({request,environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},diagnose:()=>{},discoverOfficial:async()=>[],fetchImpl:async url=>{provider.push(url);if(new URL(url).pathname.endsWith('/search'))return new Response(JSON.stringify({items:[{id:{videoId},snippet:{publishedAt}}]}));const value=structuredClone(good);change(value);return new Response(JSON.stringify({items:label==='deleted'?[]:[value]}));}});
  await assert.rejects(resolver.resolve(event,now),'fresh '+label+' rejection overrides cached fallback');assert.equal(removed.length,1,label);assert.equal(provider.length,2,'revocation adds no provider request');granted=false;await assert.rejects(resolver.resolve(event,now),'later quota exhaustion cannot resurrect rejected '+label);assert.equal(provider.length,2);
 }
 // No positive contrary evidence was obtained: retain the eligible cache.
 let deletions=0;const outage=createTopResultResolver({environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},diagnose:()=>{},discoverOfficial:async()=>[],request:async(path,options={})=>{if(path.includes('reserve_youtube_quota'))return {granted:true};if(options.method==='DELETE'){deletions++;return null;}return [{video_id:videoId,selected_at:new Date(+now-4*3600000).toISOString(),published_at:publishedAt,duration_seconds:300}];},fetchImpl:async()=>new Response('',{status:503})});assert((await outage.resolve(event,now)).cached);assert.equal(deletions,0,'provider outage does not withdraw a valid cached selection');
 // An official-candidate check can reject the cache before search is denied.
 let deleted=0;const deniedAfterRejection=createTopResultResolver({environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},diagnose:()=>{},discoverOfficial:async()=>[{videoId}],request:async(path,options={})=>{if(path.includes('reserve_youtube_quota'))return {granted:options.body.p_bucket==='ordinary'};if(options.method==='DELETE'){deleted++;return null;}return [{video_id:videoId,selected_at:new Date(+now-4*3600000).toISOString(),published_at:publishedAt,duration_seconds:300}];},fetchImpl:async()=>{const item=structuredClone(good);item.contentDetails.regionRestriction={blocked:['AU']};return new Response(JSON.stringify({items:[item]}));}});await assert.rejects(deniedAfterRejection.resolve(event,now),'later search quota denial cannot bypass a fresh AU rejection');assert.equal(deleted,1);
 // A suitable replacement in that same batch remains selectable and saved.
 const replacementId='VALIDALT001',saved=[];const replace=createTopResultResolver({environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},diagnose:()=>{},discoverOfficial:async()=>[{videoId},{videoId:replacementId}],request:async(path,options={})=>{if(path.includes('reserve_youtube_quota')){assert.equal(options.body.p_bucket,'ordinary');return {granted:true};}if(options.method==='POST'){saved.push(options.body);return null;}if(options.method==='DELETE')return null;return [{video_id:videoId,selected_at:new Date(+now-4*3600000).toISOString(),published_at:publishedAt,duration_seconds:300}];},fetchImpl:async()=>{const bad=structuredClone(good);bad.snippet.defaultAudioLanguage='id';return new Response(JSON.stringify({items:[bad,{...good,id:replacementId}]}));}});assert.equal((await replace.resolve(event,now)).url,'https://www.youtube.com/watch?v='+replacementId);assert.equal(saved[0].video_id,replacementId);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
