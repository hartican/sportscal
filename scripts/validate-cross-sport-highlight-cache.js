'use strict';
const assert=require('node:assert/strict');
const {createTopResultResolver}=require('../lib/youtube-top-result');
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
  console.log('All-user highlights cache: independent resolver/account reuse, zero-repeat quota, context fencing, denied renewal and upload expiry passed; no live requests.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
