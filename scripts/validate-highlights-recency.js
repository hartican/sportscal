'use strict';
const assert = require('node:assert/strict');
const { createTopResultResolver } = require('./highlight-resolver-test');
const contract=require('../config/fixture-highlights'),media=require('../lib/fixture-highlights'),selection=require('../lib/highlight-selection');
const now = new Date('2026-10-15T00:00:00Z');
const fixture = { ...require('./fixtures/shanghai-highlights-184950.json'), id: 'fixture:test:recency', canonicalEventId: 'fixture:test:recency', eventId: 'fixture:test:recency', status: 'completed', highlights: null };
async function main() {
  const resolver = createTopResultResolver({discoverOfficial:async()=>[],
    environment: { YOUTUBE_DATA_API_KEY: 'controlled-key' }, diagnose: () => {},
    request: async (path, options = {}) => path.includes('reserve_youtube_quota') ? { granted: true } : options.method === 'POST' ? null : [],
    fetchImpl: async () => new Response(JSON.stringify({ items: [{ id: { videoId: 'OLDVIDEO123' }, snippet: { publishedAt: '2022-10-14T10:00:00Z' } }] }))
  });
  await assert.rejects(resolver.resolve(fixture, now), /highlights_unavailable/, 'a four-year-old upload must never become the Watch highlights destination');
  const actual=require('../data/follow-schedule/tennis.json').fixtures;
  const match={...actual.find(e=>e.id==='fixture:tennis:espn:atp:184949'),status:'completed'};
  const botic={...actual.find(e=>e.id==='fixture:tennis:espn:atp:184953'),status:'completed'};
  const channel=media.channels.find(c=>c.handle==='tennistv');
  const snippet={channelId:channel.id,title:'Stefanos Tsitsipas & Daniil Medvedev Clash Again | Shanghai 2026 Highlights',publishedAt:'2026-10-14T15:00:00Z',defaultAudioLanguage:'en',description:''};
  const video=(id,patch={},details={})=>({id,snippet:{...snippet,...patch},contentDetails:{duration:'PT5M',...details},status:{privacyStatus:'public',uploadStatus:'processed'}});
  const dedicated=video('B8EO9eKy-mY');
  const reel=video('BPI3JafcKns',{title:'Tsitsipas Faces Medvedev, Botic Plays Jodar; Ruud & Paul Feature | Shanghai 2026 Highlights Day 8',description:'Botic van de Zandschulp v Rafael Jodar. Daniil Medvedev v Stefanos Tsitsipas.'},{duration:'PT12M6S'});
  for(const suffix of ['Compilation','All Matches','and More']){
    const generic={...reel.snippet,title:'Medvedev v Tsitsipas | Shanghai 2026 Highlights '+suffix,videoId:reel.id,url:'https://www.youtube.com/watch?v='+reel.id};
    assert(!media.suitable(generic,match,now),'ordinary '+suffix+' is not source evidence of a tournament-day highlights reel');
    assert(!selection.contextMatches(generic,match,now),'general fallback cannot reclassify an excluded ordinary compilation');
  }
  function controlled(items,{cache=null,granted=true,environment={YOUTUBE_DATA_API_KEY:'controlled-key'},searched=items,official=[]}={}){
    const grants=[],calls=[],saved=[];
    return {grants,calls,saved,resolver:createTopResultResolver({discoverOfficial:async()=>official,environment,diagnose:()=>{},request:async(path,options={})=>{
      if(path.includes('reserve_youtube_quota')){grants.push(options.body.p_bucket);return {granted};}
      if(options.method==='POST'){saved.push(options.body);return null;}return cache?[cache]:[];
    },fetchImpl:async url=>{
      const u=new URL(url);calls.push(u.pathname);assert.equal(grants.length,calls.length,'metadata and search each reserve before dispatch');
      if(u.pathname.endsWith('/search')){assert.equal(u.searchParams.get('publishedAfter'),new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString());assert.equal(u.searchParams.get('publishedBefore'),now.toISOString());assert.equal(u.searchParams.get('relevanceLanguage'),'en');return new Response(JSON.stringify({items:searched.map(v=>({id:{videoId:v.id},snippet:v.snippet}))}));}
      return new Response(JSON.stringify({items}));
    }})};
  }
  const old={...dedicated,snippet:{...snippet,publishedAt:'2022-10-14T15:00:00Z'}};
  const foreign=video('FOREIGN1234',{defaultAudioLanguage:'id',title:'Medvedev v Tsitsipas Shanghai 2026 Highlights'});
  const marathon=video('MARATHON123',{}, {duration:'PT3H'});
  const full=video('FULLRACE123',{title:'Medvedev v Tsitsipas Shanghai 2026 Full Match Highlights'});
  const unreviewed=video('UNOFFICIAL1',{channelId:'unreviewed',title:'Medvedev v Tsitsipas Shanghai 2026 Highlights'});
  const ranked=controlled([old,foreign,marathon,full,unreviewed,reel,dedicated]);
  assert.equal((await ranked.resolver.resolve(match,now)).url,'https://www.youtube.com/watch?v=B8EO9eKy-mY','recent dedicated official video wins over a reel and general relevance');
  assert.deepEqual(ranked.grants,['search','ordinary']);assert.equal(ranked.saved[0].published_at,snippet.publishedAt);assert.equal(ranked.saved[0].duration_seconds,300);
  const completionOnly={...match,date:null,startTimeUtc:null,actualStartTimeUtc:null,completedAt:'2026-10-14T19:00:00Z'};assert(contract.searchQuery(completionOnly,now));assert.equal((await controlled([dedicated]).resolver.resolve(completionOnly,now)).url,'https://www.youtube.com/watch?v=B8EO9eKy-mY','quality checks share the approved completion-calendar fallback rather than losing a valid match year');
  const fromFeed=controlled([reel,dedicated],{official:[{videoId:reel.id},{videoId:dedicated.id}]});assert.equal((await fromFeed.resolver.resolve(match,now)).url,'https://www.youtube.com/watch?v=B8EO9eKy-mY');assert.deepEqual(fromFeed.grants,['ordinary'],'recent official upload feeds avoid search quota entirely');
  const translated=structuredClone(dedicated);delete translated.snippet.defaultAudioLanguage;translated.snippet.defaultLanguage='id';
  const translatedFeed=controlled([translated],{official:[{videoId:translated.id}]});
  assert.equal((await translatedFeed.resolver.resolve(match,now)).url,'https://www.youtube.com/watch?v=B8EO9eKy-mY','translated text alone cannot reject an otherwise eligible official clip');
  assert.deepEqual(translatedFeed.grants,['ordinary'],'audio-language correction adds no search or metadata batch');
  for(const bad of [old,foreign,marathon,full,video('FUTURE12345',{publishedAt:new Date(+now+1).toISOString()}),video('MISSING1234',{publishedAt:undefined}),video('WRONGYEAR12',{title:snippet.title.replace('2026','2025')}),video('WRONGPLACE1',{title:snippet.title.replace('Shanghai','Paris')})])await assert.rejects(controlled([bad]).resolver.resolve(match,now),'unsuitable videos fail closed');
  // Search timestamps are insufficient: independently retrieved upload time can differ.
  await assert.rejects(controlled([old],{searched:[dedicated]}).resolver.resolve(match,now));
  const fallback=controlled([unreviewed]);assert.equal((await fallback.resolver.resolve(match,now)).url,'https://www.youtube.com/watch?v=UNOFFICIAL1','suitable unofficial highlights still open automatically');
  const cached={video_id:dedicated.id,selected_at:now.toISOString(),published_at:snippet.publishedAt,duration_seconds:300};
  const reuse=controlled([],{cache:cached,environment:{}});assert((await reuse.resolver.resolve(match,now)).cached);assert.equal(reuse.calls.length,0);assert.equal(reuse.grants.length,0);
  const retained=controlled([],{cache:{...cached,selected_at:new Date(+now-3600000).toISOString()},granted:false,official:[{videoId:dedicated.id}]});assert((await retained.resolver.resolve(match,now)).cached);assert.equal(retained.calls.length,0,'denied metadata reservation retains only already validated recent highlights');
  for(const patch of [{published_at:'2022-10-14T15:00:00Z'},{published_at:undefined},{published_at:new Date(+now+1).toISOString()},{duration_seconds:10800},{duration_seconds:undefined}])await assert.rejects(controlled([],{cache:{...cached,...patch},environment:{}}).resolver.resolve(match,now),'a new selection timestamp cannot rescue old/unvalidated video metadata');
  const cutoff=new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString();assert(contract.recentUpload(cutoff,now));assert(!contract.recentUpload(new Date(Date.parse(cutoff)-1).toISOString(),now));
  const official={...require('../data/canonical/fixture-highlights.v1.json').events.find(e=>e.highlights).highlights,publishedAt:'2022-10-14T15:00:00Z',verifiedAt:now.toISOString(),checkedAt:now.toISOString(),sourceCheckedAt:now.toISOString()};
  assert(!contract.valid(official,now));assert(contract.viewing({...match,highlights:official},now).webUrl.startsWith('/api/fixtures?'),'old direct official records fall back to fresh discovery');
  assert.equal(media.applyCached([{...match,highlights:official}],[],now)[0].highlights,null);
  const archived={...match,date:'2026-09-01',startTimeUtc:null,actualStartTimeUtc:null,completedAt:null,firstConfirmedCompleteAt:null,highlights:official};
  assert.equal(contract.viewing(archived,now),null,'archived direct links have no exemption from the actual-upload seven-day limit');
  assert.match(contract.viewing({...archived,highlights:{...official,publishedAt:snippet.publishedAt}},now).webUrl,/^\/api\/fixtures\?mode=highlight&ids=/,'a recent archived candidate retains metadata validation without reviving Feed admission');
  // One official day reel can bind several explicitly named matches. A later
  // standalone upload replaces the reel without a second chooser or new cron.
  const pool=[reel],feed=c=>'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><author><uri>https://www.youtube.com/channel/'+c.id+'</uri></author>'+(c.id===channel.id?pool.map(v=>'<entry><yt:videoId>'+v.id+'</yt:videoId><yt:channelId>'+c.id+'</yt:channelId><title><![CDATA['+v.snippet.title+']]></title><link rel="alternate" href="https://www.youtube.com/watch?v='+v.id+'"/><published>'+v.snippet.publishedAt+'</published><media:description>'+v.snippet.description+'</media:description></entry>').join(''):'')+'</feed>';
  const fetchImpl=async url=>url.includes('/feeds/')?new Response(feed(media.channels.find(c=>url.includes(c.id)))):new Response(JSON.stringify({type:'video',author_name:channel.label,author_url:'https://www.youtube.com/@'+channel.handle,title:pool.find(v=>url.includes(v.id)).snippet.title}));
  assert.deepEqual((await selection.officialCandidates(match,now,{fetchImpl})).map(v=>v.videoId),[reel.id],'the production public-feed parser finds a relevant shared reel');
  const shared=await media.refresh({events:[match,botic],now,fetchImpl});assert.equal(shared.length,2);assert(shared.every(row=>row.highlights?.videoId===reel.id&&row.highlights.standalone===false&&row.highlights.videoScope==='tournament-day'));assert(shared.every(row=>contract.valid(row.highlights,now)));
  const withApiDuration=duration=>async url=>url.includes('/youtube/v3/search')?new Response('{"items":[]}'):url.includes('/youtube/v3/videos')?new Response(JSON.stringify({items:pool.map(v=>({...v,contentDetails:{duration}}))})):fetchImpl(url);
  assert.equal((await media.refresh({events:[match,botic],now,apiKey:'controlled-key',fetchImpl:withApiDuration('PT3H')})).filter(row=>row.highlights).length,0,'official feed watch URLs cannot bypass independently known broadcast duration');
  assert((await media.refresh({events:[match,botic],previous:shared,coverage:shared.coverage,now,apiKey:'controlled-key',fetchImpl:withApiDuration('PT3H')})).every(row=>row.highlights===null),'a retained public-feed link is withdrawn when new metadata reveals full coverage');
  pool.push(dedicated);const upgraded=await media.refresh({events:[match,botic],previous:shared,coverage:shared.coverage,now:new Date(+now+1800000),fetchImpl});assert.equal(upgraded.find(e=>e.id===match.id).highlights.videoId,dedicated.id);assert.equal(upgraded.find(e=>e.id===botic.id).highlights.videoId,reel.id);
  const ajv=new (require('ajv/dist/2020'))({strict:false});require('ajv-formats')(ajv);const validate=ajv.compile(require('../schemas/fixture-highlights.schema.json'));assert(validate(shared[0].highlights));assert(!validate({...shared[0].highlights,videoScope:undefined}));
  const moto={...require('../data/follow-schedule/motogp.json').fixtures.find(e=>e.id==='event:motogp:2026:indonesia'),status:'completed'};
  const correctMoto=video('BNdINLkDUvQ',{channelId:'UC8pYaQzbBBXg9GIOHRvTmDQ',title:'Best MotoGP Moments | 2026 Indonesian GP',publishedAt:'2026-10-11T10:00:00Z'},{duration:'PT6M'});
  const wrongMoto=video('MOTOFULL123',{title:'2026 Indonesian GP MotoGP Highlights',defaultAudioLanguage:'id'},{duration:'PT3H'});
  const brief=video('BRIEFCLIP12',{...correctMoto.snippet},{duration:'PT45S'});
  assert.equal((await controlled([brief],{official:[{videoId:brief.id}]}).resolver.resolve(moto,now)).url,'https://www.youtube.com/watch?v=BRIEFCLIP12','a valid brief official highlights video is not excluded by an invented one-minute minimum');
  assert.equal((await controlled([wrongMoto,correctMoto]).resolver.resolve(moto,now)).url,'https://www.youtube.com/watch?v=BNdINLkDUvQ');
  assert.equal((await controlled([correctMoto],{official:[{videoId:correctMoto.id}]}).resolver.resolve(moto,now)).url,'https://www.youtube.com/watch?v=BNdINLkDUvQ','official MotoGP uploads are found without general search');
  assert.equal(selection.score({...reel.snippet,videoId:reel.id,url:'https://www.youtube.com/watch?v='+reel.id},match,now),1);
  console.log('Highlights recency: old/future/missing uploads, fresh-but-old cache and direct metadata, exact seven-day cutoff, independently checked duration/language, official standalone priority, shared reel/replacement, suitable unofficial fallback and Mandalika correction passed.');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
