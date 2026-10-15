'use strict';
const assert=require('node:assert/strict'),contract=require('../config/fixture-highlights');
const {createTopResultResolver}=require('./highlight-resolver-test');
const now=new Date('2026-10-14T08:00:00Z');
const fixture={...require('./fixtures/shanghai-highlights-184950.json'),id:'fixture:test:top-result',eventId:'fixture:test:top-result',canonicalEventId:'fixture:test:top-result',sourceEventIds:[],fixtureIdAliases:[],status:'completed',highlights:null};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(value){this.body=value;},end(value){this.body=value;}};}
async function main(){
  const original=JSON.stringify(fixture),query=contract.searchQuery(fixture,now);
  for(const event of [fixture,{...fixture,key:'f1',codeId:'sport:f1',name:'Singapore GP · Race',stage:'Race',participants:[],matchupSides:null}]){
    const action=contract.viewing(event,now),url=new URL(action.webUrl,'https://nothingsport.local');
    assert.equal(url.pathname,'/api/fixtures');assert.equal(url.searchParams.get('mode'),'highlight');assert.equal(url.searchParams.get('ids'),event.canonicalEventId);
    assert(action.highlightsTopResult);assert.equal(action.highlightsLabel,'Watch highlights');
  }
  const direct=require('../data/canonical/fixture-highlights.v1.json').events.find(e=>e.highlights).highlights;
  assert.equal(contract.viewing({...fixture,highlights:direct},now).webUrl,'/api/fixtures?mode=highlight&ids='+encodeURIComponent(fixture.canonicalEventId));
  const diagnostics=[];
  let reserve=0,grants=0,provider=0,cache=null,fail=false,granted=true,allowCache=true;
  const request=async(path,options={})=>{
    assert.equal(options.timeoutMs<=3000,true,'existing database deadline retained');
    if(path.includes('nothingsports_reserve_youtube_quota')){reserve++;if(granted)grants++;assert(['search','ordinary'].includes(options.body.p_bucket));assert.equal(options.body.p_source_token,null);return {granted};}
    if(options.method==='POST'){cache=options.body;return null;}
    return allowCache&&cache?[cache]:[];
  };
  const resolver=createTopResultResolver({discoverOfficial:async()=>[],request,diagnose:entry=>diagnostics.push(entry),environment:{YOUTUBE_DATA_API_KEY:' \ncontrolled-test-key\t '},fetchImpl:async(url,{signal})=>{
    provider++;const u=new URL(url);assert.equal(u.hostname,'www.googleapis.com');assert.equal(u.searchParams.get('key'),'controlled-test-key');assert(signal);assert.equal(grants,provider,'each dispatch has a prior durable reservation');
    if(fail)return new Response('private provider diagnostic',{status:503});
    const snippet={channelId:'unreviewed',title:'Alex de Minaur vs Karen Khachanov Highlights | Shanghai 2026',publishedAt:'2026-10-13T07:16:25Z',defaultAudioLanguage:'en'};
    if(u.pathname.endsWith('/search')){assert.equal(u.searchParams.get('q'),query);assert.equal(u.searchParams.get('maxResults'),'25');assert.equal(u.searchParams.get('publishedAfter'),new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString());assert.equal(u.searchParams.get('relevanceLanguage'),'en');assert(!u.searchParams.has('channelId'));return new Response(JSON.stringify({items:[{id:{videoId:'UNOFFICIAL1'},snippet}]}));}
    return new Response(JSON.stringify({items:[{id:'UNOFFICIAL1',snippet,contentDetails:{duration:'PT5M'},status:{privacyStatus:'public',uploadStatus:'processed'}}]}));
  }});
  const first=await Promise.all([resolver.resolve(fixture,now),resolver.resolve(fixture,now)]);
  assert.equal(first[0].url,'https://www.youtube.com/watch?v=UNOFFICIAL1','the first video is selected without an official-source chooser');assert.equal(first[1].url,first[0].url);assert.equal(provider,2,'simultaneous same-instance taps coalesce');
  assert.deepEqual(Object.keys(cache).sort(),['duration_seconds','fixture_id','published_at','query_hash','selected_at','video_id'],'cache contains public lookup metadata only');
  const reused=await resolver.resolve(fixture,now);assert(reused.cached);assert.equal(provider,2);assert.equal(reserve,2,'cached clicks consume no API quota');
  allowCache=false;granted=false;await assert.rejects(resolver.resolve(fixture,now));assert.equal(provider,2,'quota denial fails closed before dispatch');
  require('./highlight-resolver-test').reset(request); // Separate provider-outage scenario after the quota-denial cooldown.
  granted=true;fail=true;await assert.rejects(resolver.resolve(fixture,now));assert.equal(reserve,4);assert.equal(provider,3,'failed requests remain reserved');
  assert.deepEqual(diagnostics.at(-1),{stage:'provider-response',code:'provider_http',providerStatus:503},'provider failures have a bounded operator category');
  const empty=createTopResultResolver({discoverOfficial:async()=>[],request:async(_path,o)=>o.method==='POST'?{granted:true}:[],environment:{YOUTUBE_DATA_API_KEY:'private-empty-key'},fetchImpl:async()=>new Response('{"items":[]}'),diagnose:entry=>diagnostics.push(entry)});
  await assert.rejects(empty.resolve(fixture,now));assert.deepEqual(diagnostics.at(-1),{stage:'provider-response',code:'no_results',providerStatus:null},'no result is distinct from a service rejection');
  assert(!JSON.stringify(diagnostics).includes(query));assert(!JSON.stringify(diagnostics).includes('private-empty-key'));assert(!JSON.stringify(diagnostics).includes(fixture.id));
  const brokenDiagnostic=createTopResultResolver({discoverOfficial:async()=>[],request:async()=>[],environment:{},diagnose:()=>{throw Error('observer failed');}});await assert.rejects(brokenDiagnostic.resolve(fixture,now),/highlights_unavailable/,'diagnostic failure cannot replace the original availability outcome');
  const missingKey=createTopResultResolver({discoverOfficial:async()=>[],request,environment:{},fetchImpl:()=>assert.fail('no-key path cannot issue an API request')});await assert.rejects(missingKey.resolve(fixture,now));
  const blankKey=createTopResultResolver({discoverOfficial:async()=>[],request:async path=>{assert(!path.includes('/rpc/'),'blank keys cannot reserve provider quota');return [];},environment:{YOUTUBE_DATA_API_KEY:' \n\t '},fetchImpl:()=>assert.fail('blank key cannot dispatch'),diagnose:entry=>diagnostics.push(entry)});await assert.rejects(blankKey.resolve(fixture,now));assert.deepEqual(diagnostics.at(-1),{stage:'cache-read',code:'missing_key',providerStatus:null});
  const stale=createTopResultResolver({discoverOfficial:async()=>[],request:async(_p,o)=>o.method==='POST'?{granted:false}:[{video_id:'RPmOiRHHgX8',selected_at:new Date(+now-contract.MAX_CACHE_AGE_MS).toISOString()}],environment:{},fetchImpl:()=>assert.fail('expired metadata cannot become a keyless video')});await assert.rejects(stale.resolve(fixture,now));
  const dayOld={video_id:'RPmOiRHHgX8',selected_at:new Date(+now-86400000).toISOString(),published_at:'2026-10-13T07:16:25Z',duration_seconds:300};let reselected=0;
  const refreshSelection=createTopResultResolver({discoverOfficial:async()=>[],environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},request:async(_p,o)=>o.method==='POST'?{granted:true}:[dayOld],fetchImpl:async url=>{assert(new URL(url).pathname.endsWith('/videos'),'A saved result needs a metadata check, not a new search');reselected++;return new Response(JSON.stringify({items:[{id:'RPmOiRHHgX8',snippet:{channelId:'unreviewed',title:'Alex de Minaur vs Karen Khachanov Highlights | Shanghai 2026',publishedAt:'2026-10-13T07:16:25Z'},contentDetails:{duration:'PT5M'},status:{privacyStatus:'public',uploadStatus:'processed'}}]}));}});
  assert.equal((await refreshSelection.resolve(fixture,now)).url,'https://www.youtube.com/watch?v=RPmOiRHHgX8');assert.equal(reselected,1,'An hour-old current selection is revalidated by ID without spending another search');
  const retainedWithoutKey=createTopResultResolver({discoverOfficial:async()=>[],environment:{},request:async()=>[dayOld],fetchImpl:()=>assert.fail('keyless cache fallback is free')});
  assert.equal((await retainedWithoutKey.resolve(fixture,now)).url,'https://www.youtube.com/watch?v=RPmOiRHHgX8','last selected video remains usable when a new lookup has no key');
  let selected=0;
  const handler=require('../lib/live-fixture-handler').createLiveFixtureHandler({publishedFixtures:()=>[fixture],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,resolveHighlights:async(event,t)=>{selected++;assert.equal(event.canonicalEventId,fixture.canonicalEventId);assert.equal(+t,+now);return {url:'https://www.youtube.com/watch?v=UNOFFICIAL1',selection:'youtube-top-result'};}});
  const req={method:'GET',url:'/api/fixtures?mode=highlight&ids='+fixture.id,headers:{}},res=response();await handler(req,res);
  assert.equal(res.code,302);assert.equal(res.headers.Location,'https://www.youtube.com/watch?v=UNOFFICIAL1');assert.equal(res.headers['X-Highlights-Selection'],'youtube-top-result');assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(selected,1);assert.equal(res.body,undefined,'one redirect, no results/choice screen');
  for(const ids of ['',fixture.id+',other','not-a-fixture']){const bad=response();await handler({...req,url:'/api/fixtures?mode=highlight&ids='+ids},bad);assert(bad.code>=400);assert(!bad.headers.Location);}assert.equal(selected,1,'unknown/invalid fixtures cannot spend quota on arbitrary user queries');
  const liveHandler=require('../lib/live-fixture-handler').createLiveFixtureHandler({publishedFixtures:()=>[{...fixture,status:'live'}],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,resolveHighlights:()=>assert.fail('live fixture cannot trigger search')});
  const live=response();await liveHandler(req,live);assert.equal(live.code,404);
  const approved=require('../lib/live-fixture-handler').createLiveFixtureHandler({publishedFixtures:()=>[{...fixture,highlights:direct}],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,resolveHighlights:async event=>{assert.equal(event.highlights.videoId,direct.videoId);return {url:direct.url,selection:'verified-match'};}});
  const approvedRes=response();await approved(req,approvedRes);assert.equal(approvedRes.headers.Location,direct.url);assert.equal(approvedRes.headers['X-Highlights-Selection'],'verified-match');
  const broken=require('../lib/live-fixture-handler').createLiveFixtureHandler({publishedFixtures:()=>[fixture],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,resolveHighlights:async()=>{throw Error('private credentials');}});
  const unavailable=response();await broken(req,unavailable);assert.equal(unavailable.code,503);assert.match(unavailable.body,/Highlights unavailable/);assert(!unavailable.body.includes('private credentials'));assert(!unavailable.headers.Location);
  assert.equal(JSON.stringify(fixture),original,'resolution cannot mutate sporting facts or personal state');
  // The real source passes its existing lease token to the same quota authority.
  let called=0;
  const media=require('../lib/fixture-highlights');
  const feed=c=>'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><author><uri>https://www.youtube.com/channel/'+c.id+'</uri></author></feed>';
  const source=media.source({published:[fixture],environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},loadArchives:async()=>[],loadCurrent:async()=>({sources:[]}),quotaReserve:async(bucket,options)=>{called++;assert.equal(options.sourceToken,'controlled-source-token');return {granted:true,quota:{day:'2026-10-14',search:called,ordinary:0}};},fetchImpl:async url=>url.includes('/feeds/')?new Response(feed(media.channels.find(c=>url.includes(c.id)))):new Response('{"items":[]}')});
  const scheduled=await source.fetch({now,previous:[],privateCoverage:{},sourceToken:'controlled-source-token'});assert.equal(called,2);assert.equal(scheduled.coverage._highlightQuota.search,2);assert.equal(media.INTERVAL_MS,1800000);assert.equal(source.timeoutMs,20000);
  const denied=await media.refresh({events:[fixture],now,apiKey:'controlled-key',quotaReserve:async()=>({granted:false}),fetchImpl:async url=>{assert(!url.includes('/youtube/v3/'));return new Response(feed(media.channels.find(c=>url.includes(c.id))));}});assert.deepEqual(denied.coverage._highlightBackfill.attempts,{},'no dispatched provider call means no invented historical attempt/cooldown');
  assert.equal(denied.coverage._highlightQuota,undefined,'a denied durable reservation cannot inflate private usage and steal tap quota');
  console.log('YouTube top result: fixture query, recent suitable unofficial fallback, direct 302, shared reservations, cache/coalescing, no-key/quota/error/expiry paths, known/completed fixture bounds and immutable sporting facts passed.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
